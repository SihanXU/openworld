// World: the mutable state plus derived indices (not serialized) for fast spatial queries.

import { OntologyIndex } from './ontology.ts'
import { nextRandom } from './rng.ts'
import type {
  Dir,
  Entity,
  EntityKind,
  FxEvent,
  Id,
  MapData,
  Place,
  Pos,
  PropValue,
  Ref,
  TileState,
  WorldState,
} from './types.ts'
import { DIRS } from './types.ts'

export const tileKey = (map: string, x: number, y: number) => `${map}:${x}:${y}`
export const NO_EXPIRY = -1

/** A uniform read-only view of whatever fills an event role. */
export interface View {
  ref: Ref
  kind: EntityKind | 'tile'
  type: string
  tags: Set<string>
  statuses: Set<string>
  props: Record<string, PropValue>
  id?: Id
  isPlayer: boolean
  entity?: Entity
}

export class World {
  state: WorldState
  onto: OntologyIndex
  /** Output buffer drained by the host each frame. */
  fx: FxEvent[] = []

  private onTile = new Map<string, Set<Id>>() // tileKey -> entity ids on that tile
  private onMap = new Map<string, Set<Id>>() // map -> entity ids on its tiles
  /** Subjects that currently carry statuses: entity ids and `t|map:x:y` tile keys. */
  statusful = new Set<string>()

  constructor(state: WorldState, onto: OntologyIndex) {
    this.state = state
    this.onto = onto
    this.reindex()
  }

  // ---------------------------------------------------------------- indices

  reindex(): void {
    this.onTile.clear()
    this.onMap.clear()
    this.statusful.clear()
    for (const e of Object.values(this.state.entities)) {
      this.indexAdd(e)
      if (e.statuses && Object.keys(e.statuses).length) this.statusful.add(e.id)
    }
    for (const [k, t] of Object.entries(this.state.tiles)) {
      if (t.statuses && Object.keys(t.statuses).length) this.statusful.add('t|' + k)
    }
  }

  private indexAdd(e: Entity): void {
    if (e.place.on !== 'tile') return
    const k = tileKey(e.place.map, e.place.x, e.place.y)
    let s = this.onTile.get(k)
    if (!s) this.onTile.set(k, (s = new Set()))
    s.add(e.id)
    let m = this.onMap.get(e.place.map)
    if (!m) this.onMap.set(e.place.map, (m = new Set()))
    m.add(e.id)
  }

  private indexRemove(e: Entity): void {
    if (e.place.on !== 'tile') return
    this.onTile.get(tileKey(e.place.map, e.place.x, e.place.y))?.delete(e.id)
    this.onMap.get(e.place.map)?.delete(e.id)
  }

  // ---------------------------------------------------------------- basics

  rand(): number {
    return nextRandom(this.state)
  }

  get(id: Id | undefined): Entity | undefined {
    return id ? this.state.entities[id] : undefined
  }

  get player(): Entity {
    return this.state.entities[this.state.player]
  }

  map(id: string): MapData | undefined {
    return this.state.maps[id]
  }

  newId(prefix = 'e'): Id {
    this.state.counter += 1
    return `${prefix}${this.state.counter.toString(36)}`
  }

  entitiesAt(map: string, x: number, y: number): Entity[] {
    const s = this.onTile.get(tileKey(map, x, y))
    if (!s) return []
    const out: Entity[] = []
    for (const id of s) out.push(this.state.entities[id])
    return out
  }

  entitiesOnMap(map: string): Entity[] {
    const s = this.onMap.get(map)
    if (!s) return []
    const out: Entity[] = []
    for (const id of s) out.push(this.state.entities[id])
    return out
  }

  kindOf(e: Entity): EntityKind {
    return this.onto.resolve(e.type).kind as EntityKind
  }

  actorAt(map: string, x: number, y: number): Entity | undefined {
    return this.entitiesAt(map, x, y).find((e) => this.kindOf(e) === 'actor')
  }

  /** Map position of an entity, following holders (an item in a hand is where the hand is). */
  posOf(e: Entity | undefined, depth = 0): Pos | undefined {
    if (!e || depth > 8) return undefined
    const p = e.place
    if (p.on === 'tile') return { map: p.map, x: p.x, y: p.y }
    if (p.on === 'inside' || p.on === 'hand') return this.posOf(this.get(p.holder), depth + 1)
    return undefined
  }

  refPos(ref: Ref | undefined): Pos | undefined {
    if (!ref) return undefined
    if ('tile' in ref) return ref.tile
    return this.posOf(this.get(ref.e))
  }

  front(e: Entity, dir: Dir = e.facing ?? 'down'): Pos | undefined {
    const p = this.posOf(e)
    if (!p) return undefined
    const [dx, dy] = DIRS[dir]
    return { map: p.map, x: p.x + dx, y: p.y + dy }
  }

  // ---------------------------------------------------------------- terrain & tiles

  inBounds(map: string, x: number, y: number): boolean {
    const m = this.state.maps[map]
    return !!m && x >= 0 && y >= 0 && x < m.width && y < m.height
  }

  terrainAt(map: string, x: number, y: number): string {
    const t = this.state.tiles[tileKey(map, x, y)]
    if (t?.terrain) return t.terrain
    const m = this.state.maps[map]
    if (!m || x < 0 || y < 0 || x >= m.width || y >= m.height) return 'void'
    return m.terrain[y * m.width + x]
  }

  tileState(map: string, x: number, y: number, create = false): TileState | undefined {
    const k = tileKey(map, x, y)
    let t = this.state.tiles[k]
    if (!t && create) this.state.tiles[k] = t = {}
    return t
  }

  setTerrain(map: string, x: number, y: number, terrain: string): void {
    const base = this.state.maps[map]?.terrain[y * (this.state.maps[map]?.width ?? 0) + x]
    const t = this.tileState(map, x, y, true)!
    if (terrain === base) delete t.terrain
    else t.terrain = terrain
    this.pruneTile(map, x, y)
  }

  private pruneTile(map: string, x: number, y: number): void {
    const k = tileKey(map, x, y)
    const t = this.state.tiles[k]
    if (t && !t.terrain && (!t.statuses || !Object.keys(t.statuses).length)) delete this.state.tiles[k]
  }

  isSolidTerrain(terrain: string): boolean {
    const d = this.onto.terrain(terrain)
    return !d || !!d.solid
  }

  /** Static passability for path planning: terrain and solid fixtures, ignoring actors. */
  passable(map: string, x: number, y: number): boolean {
    if (!this.inBounds(map, x, y) || this.isSolidTerrain(this.terrainAt(map, x, y))) return false
    for (const e of this.entitiesAt(map, x, y)) {
      const r = this.onto.resolve(e.type)
      if (r.kind === 'fixture' && r.solid) return false
    }
    return true
  }

  /**
   * Can an actor step onto this tile? With `ghostNpcs`, townsfolk pass through each other
   * (crowds never deadlock); the player and creatures still block.
   */
  walkable(map: string, x: number, y: number, ignore?: Id, ghostNpcs = false): boolean {
    if (!this.inBounds(map, x, y)) return false
    if (this.isSolidTerrain(this.terrainAt(map, x, y))) return false
    for (const e of this.entitiesAt(map, x, y)) {
      if (e.id === ignore) continue
      const r = this.onto.resolve(e.type)
      if (r.kind === 'actor') {
        if (ghostNpcs && e.npc) continue
        return false
      }
      if (r.kind === 'fixture' && r.solid) return false
    }
    return true
  }

  // ---------------------------------------------------------------- views

  view(ref: Ref | undefined): View | undefined {
    if (!ref) return undefined
    if ('tile' in ref) {
      const { map, x, y } = ref.tile
      const terrain = this.terrainAt(map, x, y)
      const def = this.onto.terrain(terrain)
      const st = this.tileState(map, x, y)?.statuses
      return {
        ref,
        kind: 'tile',
        type: `tile/${terrain}`,
        tags: new Set(def?.tags ?? []),
        statuses: new Set(st ? Object.keys(st) : []),
        props: {},
        isPlayer: false,
      }
    }
    const e = this.get(ref.e)
    if (!e || e.place.on === 'none') return undefined
    const r = this.onto.resolve(e.type)
    const tags = new Set(r.tags)
    for (const t of e.tags ?? []) tags.add(t)
    return {
      ref,
      kind: r.kind,
      type: e.type,
      tags,
      statuses: new Set(e.statuses ? Object.keys(e.statuses) : []),
      props: { ...r.props, ...(e.props ?? {}) },
      id: e.id,
      isPlayer: e.id === this.state.player,
      entity: e,
    }
  }

  prop(e: Entity, key: string): PropValue | undefined {
    return e.props?.[key] ?? this.onto.resolve(e.type).props[key]
  }

  num(e: Entity, key: string, dflt = 0): number {
    const v = this.prop(e, key)
    return typeof v === 'number' ? v : dflt
  }

  hasTag(e: Entity, tag: string): boolean {
    return (e.tags?.includes(tag) ?? false) || this.onto.resolve(e.type).tags.includes(tag)
  }

  // ---------------------------------------------------------------- entity lifecycle

  add(e: Entity): Entity {
    this.state.entities[e.id] = e
    this.indexAdd(e)
    if (e.place.on === 'inside' || e.place.on === 'hand') this.attach(e)
    if (e.statuses && Object.keys(e.statuses).length) this.statusful.add(e.id)
    return e
  }

  create(type: string, place: Place, extra: Partial<Entity> = {}): Entity {
    const e: Entity = { id: this.newId(), type, place: { on: 'none' }, ...extra }
    e.place = place
    return this.add(e)
  }

  private attach(e: Entity): void {
    const p = e.place
    if (p.on === 'inside') {
      const h = this.get(p.holder)
      if (h) (h.contents ??= []).includes(e.id) || h.contents!.push(e.id)
    } else if (p.on === 'hand') {
      const h = this.get(p.holder)
      if (h) h.held = e.id
    }
  }

  private detach(e: Entity): void {
    const p = e.place
    if (p.on === 'inside') {
      const h = this.get(p.holder)
      if (h?.contents) h.contents = h.contents.filter((c) => c !== e.id)
    } else if (p.on === 'hand') {
      const h = this.get(p.holder)
      if (h && h.held === e.id) h.held = undefined
    } else this.indexRemove(e)
  }

  /** Move an entity to a new place, keeping all indices and holder links consistent. */
  place(e: Entity, to: Place): void {
    this.detach(e)
    e.place = to
    if (to.on === 'tile') this.indexAdd(e)
    else this.attach(e)
  }

  destroy(e: Entity): void {
    for (const c of [...(e.contents ?? [])]) {
      const child = this.get(c)
      if (child) this.destroy(child)
    }
    if (e.held) {
      const h = this.get(e.held)
      if (h) this.destroy(h)
    }
    this.detach(e)
    e.place = { on: 'none' }
    this.statusful.delete(e.id)
    delete this.state.entities[e.id]
  }

  // ---------------------------------------------------------------- statuses

  statusesOf(ref: Ref): Record<string, number> | undefined {
    if ('tile' in ref) return this.tileState(ref.tile.map, ref.tile.x, ref.tile.y)?.statuses
    return this.get(ref.e)?.statuses
  }

  hasStatus(ref: Ref, status: string): boolean {
    return this.statusesOf(ref)?.[status] !== undefined
  }

  /** Returns true when the status was newly applied (callers emit the `status` event). */
  setStatus(ref: Ref, status: string, expiry: number): boolean {
    let bag: Record<string, number>
    let key: string
    if ('tile' in ref) {
      const t = this.tileState(ref.tile.map, ref.tile.x, ref.tile.y, true)!
      bag = t.statuses ??= {}
      key = 't|' + tileKey(ref.tile.map, ref.tile.x, ref.tile.y)
    } else {
      const e = this.get(ref.e)
      if (!e) return false
      bag = e.statuses ??= {}
      key = e.id
    }
    const fresh = !(status in bag)
    bag[status] = expiry
    this.statusful.add(key)
    return fresh
  }

  clearStatus(ref: Ref, status: string): boolean {
    const bag = this.statusesOf(ref)
    if (!bag || !(status in bag)) return false
    delete bag[status]
    if (!Object.keys(bag).length) {
      if ('tile' in ref) {
        this.statusful.delete('t|' + tileKey(ref.tile.map, ref.tile.x, ref.tile.y))
        const t = this.tileState(ref.tile.map, ref.tile.x, ref.tile.y)
        if (t) delete t.statuses
        this.pruneTile(ref.tile.map, ref.tile.x, ref.tile.y)
      } else {
        this.statusful.delete(ref.e)
        const e = this.get(ref.e)
        if (e) delete e.statuses
      }
    }
    return true
  }

  /** Resolve a statusful-set key back to a ref. */
  keyRef(key: string): Ref {
    if (key.startsWith('t|')) {
      const [map, x, y] = key.slice(2).split(':')
      return { tile: { map, x: +x, y: +y } }
    }
    return { e: key }
  }

  // ---------------------------------------------------------------- time

  /** 600 ticks = one game hour; the day starts at 08:00. */
  hour(): number {
    return (8 + this.state.tick / 600) % 24
  }
}
