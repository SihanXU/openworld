// World: the mutable state plus derived indices (not serialized) for fast spatial queries.

import { calendarAt, type Calendar } from './calendar.ts'
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
/** A ref's key in the statusful set and the relation index: an entity's id, or `t|map:x:y`. */
export const refKey = (r: Ref): string => ('e' in r ? r.e : 't|' + tileKey(r.tile.map, r.tile.x, r.tile.y))
/** The other side's view of a relation (design.md §5.10). */
export const REVERSE: Record<string, string> = { on: 'under', in: 'contains', held: 'holds' }

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

/** Does a base of [width, depth] standing on (ex,ey) — centred on it, reaching back (north) — cover (x,y)? */
export function baseCovers(ex: number, ey: number, [w, d]: [number, number], x: number, y: number): boolean {
  return x >= ex - Math.floor((w - 1) / 2) && x <= ex + Math.floor(w / 2) && y <= ey && y > ey - d
}

export class World {
  state: WorldState
  onto: OntologyIndex
  /** Output buffer drained by the host each frame. */
  fx: FxEvent[] = []
  /**
   * Who may change the state now (design.md §5.13, A2): outcomes, the clock, loading, and the
   * actor's own posture (what is in the hand, which way it faces). Anything else throws.
   */
  private writers = 0
  write<T>(f: () => T): T {
    this.writers++
    try {
      return f()
    } finally {
      this.writers--
    }
  }
  /** Strict mode (tests): a change outside an outcome, the clock or loading is a bug. */
  strict = false
  private guard(what: string): void {
    if (this.strict && this.writers <= 0) throw new Error(`${what} outside an outcome (design.md §5.13, A2)`)
  }

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

  /** Map position of an entity, following holders (an item in a hand is where the hand is). Residents have none. */
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
    this.guard('setTerrain')
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

  /** Does a thing's base (its tile, or its footprint for a bigger one) cover this tile? */
  covers(e: Entity, map: string, x: number, y: number): boolean {
    if (e.place.on !== 'tile' || e.place.map !== map) return false
    return baseCovers(e.place.x, e.place.y, this.onto.resolve(e.type).footprint, x, y)
  }

  /** The solid thing whose base covers this tile, if any: one standing on it, or a bigger one in front or beside. */
  solidAt(map: string, x: number, y: number, ignore?: Id): Entity | undefined {
    const [mw, md] = this.onto.maxFootprint
    for (let dy = 0; dy < md; dy++)
      for (let dx = -Math.floor(mw / 2); dx <= Math.floor(mw / 2); dx++)
        for (const e of this.entitiesAt(map, x + dx, y + dy)) {
          if (e.id === ignore) continue
          const r = this.onto.resolve(e.type)
          if (r.kind === 'fixture' && r.solid && this.covers(e, map, x, y)) return e
        }
    return undefined
  }

  /** Blocked whoever moves: solid terrain, or the base of a solid thing. Nothing else blocks — no layer of the map's own. */
  blocked(map: string, x: number, y: number, ignore?: Id): boolean {
    return this.isSolidTerrain(this.terrainAt(map, x, y)) || !!this.solidAt(map, x, y, ignore)
  }

  /** Static passability for path planning: terrain and solid things, ignoring actors. */
  passable(map: string, x: number, y: number): boolean {
    return this.inBounds(map, x, y) && !this.blocked(map, x, y)
  }

  /**
   * Can an actor step onto this tile? With `ghostNpcs`, townsfolk pass through each other
   * (crowds never deadlock); the player and creatures still block.
   */
  walkable(map: string, x: number, y: number, ignore?: Id, ghostNpcs = false): boolean {
    if (!this.inBounds(map, x, y)) return false
    if (this.blocked(map, x, y, ignore)) return false
    for (const e of this.entitiesAt(map, x, y)) {
      if (e.id === ignore || this.kindOf(e) !== 'actor') continue
      if (ghostNpcs && e.npc) continue
      return false
    }
    return true
  }

  // ---------------------------------------------------------------- stance, reach and relations (design.md §5.5, §5.10)

  /** Where a thing is: on the ground (the default), in the air, in water. */
  stanceOf(e: Entity): string {
    const s = this.prop(e, 'stance')
    return typeof s === 'string' ? s : 'ground'
  }

  /** The stances a tile acts on. */
  tileReach(map: string, x: number, y: number): string[] {
    return this.onto.terrain(this.terrainAt(map, x, y))?.reach ?? ['ground']
  }

  /** The stances a fixture acts on. */
  reachOf(e: Entity): string[] {
    return this.onto.resolve(e.type).reach ?? ['ground']
  }

  /**
   * A thing's own relations, as `how|key`: on its tile (keyed with its terrain, so ice thawing to
   * water underfoot is a new contact) and on the fixtures there, when its stance
   * is in their reach (a flyer touches neither lava nor flowers); in its holder; held in a hand.
   */
  relationsOf(e: Entity): string[] {
    const p = e.place
    if (p.on === 'inside') return [`in|${p.holder}`]
    if (p.on === 'hand') return [`held|${p.holder}`]
    if (p.on !== 'tile') return []
    const st = this.stanceOf(e)
    const out: string[] = []
    if (this.tileReach(p.map, p.x, p.y).includes(st)) out.push(`on|t|${tileKey(p.map, p.x, p.y)}#${this.terrainAt(p.map, p.x, p.y)}`)
    if (this.kindOf(e) !== 'fixture')
      for (const f of this.entitiesAt(p.map, p.x, p.y)) if (f.id !== e.id && this.kindOf(f) === 'fixture' && this.reachOf(f).includes(st)) out.push(`on|${f.id}`)
    return out
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
    this.guard('add')
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
    this.guard('place')
    this.detach(e)
    e.place = to
    if (to.on === 'tile') this.indexAdd(e)
    else this.attach(e)
  }

  destroy(e: Entity): void {
    this.guard('destroy')
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
    this.guard('setStatus')
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
    this.guard('clearStatus')
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
      // a tile's relation key carries its terrain after '#' (a terrain change is a new relation)
      const [map, x, y] = key.slice(2).split('#')[0].split(':')
      return { tile: { map, x: +x, y: +y } }
    }
    return { e: key }
  }

  // ---------------------------------------------------------------- time

  /** The clock, 0 … 24 (calendar.ts: day 1 begins at 06:00, a game minute is 7 ticks). */
  hour(): number {
    return calendarAt(this.state.tick, this.state.seed).hour
  }

  calendar(): Calendar {
    return calendarAt(this.state.tick, this.state.seed, Array.isArray(this.state.weather) ? this.state.weather : undefined)
  }

  fact(key: string): PropValue | undefined {
    return this.state.facts?.[key]
  }

  setFact(key: string, value: PropValue): void {
    this.guard('setFact')
    ;(this.state.facts ??= {})[key] = value
  }
}
