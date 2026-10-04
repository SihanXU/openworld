// World: the mutable state plus derived indices (not serialized) for fast spatial queries.

import { calendarAt, type Calendar, type WeatherSpan } from './calendar.ts'
import { CELL_SPACES, cellId, parseCellId, splitLayers, type CellSpace, type Layers } from './cells.ts'
import { OntologyIndex } from './ontology.ts'
import { nextRandom } from './rng.ts'
import type {
  Dir,
  Entity,
  FxEvent,
  Id,
  MapData,
  Place,
  Pos,
  PropValue,
  Ref,
  MaterialDef,
  SceneState,
  Space,
  Text,
  WorldState,
} from './types.ts'
import { DIRS } from './types.ts'

export const tileKey = (map: string, x: number, y: number) => `${map}:${x}:${y}`
export const NO_EXPIRY = -1
/** A ref's key in the statusful set and the relation index: the thing's id. */
export const refKey = (r: Ref): string => r.e
/** The other side's view of a relation (design.md §5.10). */
export const REVERSE: Record<string, string> = { on: 'under', in: 'contains', held: 'holds', 'in-region': 'encloses' }

/** The id of a map's authored region (world-model.md §5.4): a thing made from the map's named area. */
export const regionId = (map: string, name: string): string => `region.${map}.${name}`

/** A uniform read-only view of whatever fills an event role. */
export interface View {
  ref: Ref
  type: string
  tags: Set<string>
  statuses: Set<string>
  props: Record<string, PropValue>
  id?: Id
  entity?: Entity
}

/** Does a base of [width, depth] standing on (ex,ey) — centred on it, reaching back (north) — cover (x,y)? */
export function baseCovers(ex: number, ey: number, [w, d]: [number, number], x: number, y: number): boolean {
  return x >= ex - Math.floor((w - 1) / 2) && x <= ex + Math.floor(w / 2) && y <= ey && y > ey - d
}

/** The spaces that make up a cell, by height: what is on top shows (terrainAt) and is acted on (cellTop). */
const CELL_RANK: Partial<Record<Space, number>> = { floor: 0, soil: 1, volume: 2 }

/** How many recent lines a request carries as context. */
export const RECENT_LINES = 6

/**
 * The right to change the world: whoever holds it runs `f` as a change of state — as the outcome
 * of `host` (it writes only that host, design.md §5.13, A3), or with no host (the clock, loading,
 * the input's posture, the author).
 */
export type Writer = <T>(f: () => T, host?: Ref) => T

/** A change of state outside an outcome (A2), or beyond its host (A3): a bug in the code, never a rule's failure. */
export class WriteError extends Error {}

/** The story's id: a thing like any other, whose props are the facts it keeps (world-model.md §3). */
const STORY_ID = 'story'

/** How long a topic stays fresh when its raiser does not say (days). */
export const TOPIC_DAYS = 4

export class World {
  state: WorldState
  onto: OntologyIndex
  /** The weather the world's content fixes (the evening storm): content, read on every start, never saved. */
  weather?: WeatherSpan[]
  /** Output buffer drained by the host each frame. */
  fx: FxEvent[] = []
  /** The last lines logged or said, kept past the drain of `fx` (a request's recent context). */
  recent: Text[] = []
  /**
   * The state changes only through its one writer (design.md §5.13, A2). The engine claims it
   * when it is made and lends it to outcomes (the effect runner), the clock (a status running
   * out), loading, and the input's own posture (what is in the hand). No other code holds it, so a
   * change anywhere else throws — always, not only in tests.
   */
  private writers = 0
  private granted = false
  /**
   * The host of the outcome being run (design.md §5.13, A3): its writes reach only the host, what
   * the host holds, and what the outcome makes; the world's facts only when the host is the story
   * or the world. None while the clock, loading, the input's posture or the author write.
   */
  private scope: { host: Ref; made: Set<Id> } | undefined
  grant(): Writer {
    if (this.granted) throw new Error("the world's writer is already held (design.md §5.13, A2)")
    this.granted = true
    return <T>(f: () => T, host?: Ref): T => {
      const outer = this.scope
      this.writers++
      this.scope = host ? { host, made: new Set() } : undefined
      try {
        return f()
      } finally {
        this.writers--
        this.scope = outer
      }
    }
  }
  private guard(what: string, target?: Entity | Ref | 'fact'): void {
    if (this.writers <= 0) throw new WriteError(`${what} outside an outcome (design.md §5.13, A2)`)
    const s = this.scope
    if (s && target !== undefined && !this.reaches(s, target)) {
      const of = target === 'fact' ? 'a fact' : 'id' in target ? target.id : target.e
      throw new WriteError(`${what} of ${of} in an outcome of ${s.host.e}: an outcome writes only its host (design.md §5.13, A3)`)
    }
    // a cell thing of the map's static data is kept from its first change on, under the same id
    if (target !== undefined && target !== 'fact') this.materialise('id' in target ? target : this.get(target.e))
  }
  /** Whether an outcome of `s.host` may write `target`: itself, what it holds, what it made; facts if it keeps no place (the story, the world). */
  private reaches(s: { host: Ref; made: Set<Id> }, target: Entity | Ref | 'fact'): boolean {
    const h = s.host
    if (target === 'fact') return !!this.get(h.e) && this.isPlaceless(this.get(h.e)!)
    let e: Entity | undefined = 'id' in target ? target : this.get(target.e)
    if (!e) return true
    if (s.made.has(e.id)) return true
    // the host itself, or something in its hand or its contents (at any depth)
    for (let i = 0; e && i < 32; i++) {
      if (e.id === h.e) return true
      e = e.place.on === 'inside' || e.place.on === 'hand' ? this.get(e.place.holder) : undefined
    }
    return false
  }
  /** The author's hand (the engine's `author`, installed by it): tests, world building, the dev console — never game code. */
  author: Writer = () => {
    throw new Error('no engine holds this world: nobody may write it')
  }

  private onTile = new Map<string, Set<Id>>() // tileKey -> ids of the kept things on that tile
  private onMap = new Map<string, Set<Id>>() // map -> ids of the kept things on its tiles, but its cell things
  private areas = new Map<string, Set<Id>>() // map -> its regions' ids
  /** Each map's static cell things (from its data, recomputed when the data is replaced). */
  private layers = new Map<string, { data: MapData; layers: Layers }>()
  /** The static cell things asked for so far: built from the map's data, not state (world-model.md §4.6). */
  private statics = new Map<Id, Entity>()
  /** Things that currently carry statuses, by id. */
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
    this.areas.clear()
    this.statusful.clear()
    this.statics.clear()
    for (const e of Object.values(this.state.entities)) {
      this.indexAdd(e)
      if (e.statuses && Object.keys(e.statuses).length) this.statusful.add(e.id)
    }
  }

  private indexAdd(e: Entity): void {
    if (e.place.on === 'area') {
      let a = this.areas.get(e.place.map)
      if (!a) this.areas.set(e.place.map, (a = new Set()))
      a.add(e.id)
    }
    if (e.place.on !== 'tile') return
    for (const [x, y] of this.occupiedCells(e)) {
      const k = tileKey(e.place.map, x, y)
      let s = this.onTile.get(k)
      if (!s) this.onTile.set(k, (s = new Set()))
      s.add(e.id)
    }
    // the things that make up the cells are read by cell, not with the map's loose things
    if (parseCellId(e.id)) return
    let m = this.onMap.get(e.place.map)
    if (!m) this.onMap.set(e.place.map, (m = new Set()))
    m.add(e.id)
  }

  private indexRemove(e: Entity): void {
    if (e.place.on === 'area') this.areas.get(e.place.map)?.delete(e.id)
    if (e.place.on !== 'tile') return
    for (const [x, y] of this.occupiedCells(e)) this.onTile.get(tileKey(e.place.map, x, y))?.delete(e.id)
    this.onMap.get(e.place.map)?.delete(e.id)
  }

  /** Agents occupy every base cell; other things keep their anchor tile (solidAt reads their footprint). */
  occupiedCells(e: Entity, x = e.place.on === 'tile' ? e.place.x : 0, y = e.place.on === 'tile' ? e.place.y : 0): [number, number][] {
    const [width, depth] = this.isAgent(e) ? this.onto.resolve(e.type).footprint : [1, 1]
    const cells: [number, number][] = []
    for (let dy = 0; dy < depth; dy++) for (let dx = 0; dx < width; dx++) cells.push([x - Math.floor((width - 1) / 2) + dx, y - dy])
    return cells
  }

  /** Moving a large actor validates its whole body, not just its anchor. */
  fits(e: Entity, map: string, x: number, y: number): boolean {
    return this.occupiedCells(e, x, y).every(([cx, cy]) => this.walkable(map, cx, cy, e.id, !!e.npc))
  }

  // ---------------------------------------------------------------- basics

  rand(): number {
    return nextRandom(this.state)
  }

  /** A thing by id: one kept in the state, or a cell thing of a map's static data (a destroyed one is gone). */
  get(id: Id | undefined): Entity | undefined {
    if (!id) return undefined
    const e = this.state.entities[id]
    if (e) return e.place.on === 'none' && parseCellId(id) ? undefined : e
    const c = parseCellId(id)
    return c && this.staticThing(c.map, c.x, c.y, c.space)
  }

  /** Is it a thing of a map's static data, not yet kept in the state? */
  isStatic(e: Entity): boolean {
    return this.state.entities[e.id] !== e
  }

  /** Keep a static cell thing in the state, under its id, from its first change on. */
  private materialise(e: Entity | undefined): void {
    if (!e || !this.isStatic(e) || !parseCellId(e.id)) return
    this.statics.delete(e.id)
    this.state.entities[e.id] = e
    this.indexAdd(e)
  }

  /** A map's static cell things. */
  private layersOf(map: string): Layers | undefined {
    const data = this.state.maps[map]
    if (!data) return undefined
    const hit = this.layers.get(map)
    if (hit?.data === data) return hit.layers
    const spaceOf = (t: string): CellSpace => this.onto.terrain(t)?.space ?? 'floor'
    const layers = splitLayers(data, spaceOf, (t) => !this.isSolidTerrain(t))
    this.layers.set(map, { data, layers })
    return layers
  }

  /** The thing of a map's static data in a cell's space, unless the state keeps (or lost) it. */
  private staticThing(map: string, x: number, y: number, space: CellSpace): Entity | undefined {
    if (!this.inBounds(map, x, y)) return undefined
    const t = this.layersOf(map)?.[space][y * this.state.maps[map].width + x]
    if (t === undefined) return undefined
    const id = cellId(map, x, y, space)
    if (this.state.entities[id]) return undefined
    const type = `tile/${t}`
    let e = this.statics.get(id)
    if (!e || e.type !== type) this.statics.set(id, (e = { id, type, place: { on: 'tile', map, x, y } }))
    return e
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

  /** Every thing in a cell: the kept ones, then the cell things of the map's static data. */
  entitiesAt(map: string, x: number, y: number): Entity[] {
    const out: Entity[] = []
    for (const id of this.onTile.get(tileKey(map, x, y)) ?? []) out.push(this.state.entities[id])
    for (const space of CELL_SPACES) {
      const e = this.staticThing(map, x, y, space)
      if (e) out.push(e)
    }
    return out
  }

  /** What stands or lies in a cell: its things but those that make it up (its ground, what roots in or fills it). */
  placedAt(map: string, x: number, y: number): Entity[] {
    return this.entitiesAt(map, x, y).filter((e) => !this.isTerrain(e))
  }

  /** The spaces a thing takes in its cell (world-model.md §5.2): its type's, else a body for a walking agent, the volume for a solid thing. */
  spacesOf(e: Entity): Space[] {
    const r = this.onto.resolve(e.type)
    if (r.occupies) return r.occupies
    if (this.isAgent(e)) return this.hasTag(e, 'airborne') ? [] : ['body']
    return r.solid ? ['volume'] : []
  }

  /** What takes a space of a cell, if anything. */
  occupant(map: string, x: number, y: number, space: Space): Entity | undefined {
    return this.entitiesAt(map, x, y).find((e) => this.spacesOf(e).includes(space))
  }

  /** How high in its cell a thing lies: the floor, the soil, the volume (-1: it makes up no cell). */
  cellRank(e: Entity): number {
    return Math.max(-1, ...this.spacesOf(e).map((s) => CELL_RANK[s] ?? -1))
  }

  /** Is it drawn as the ground of its cell (its type names a terrain): one of the things that make up the cell? */
  isTerrain(e: Entity): boolean {
    return this.onto.resolve(e.type).terrain !== undefined
  }

  /** What makes up a cell on top, of the things drawn as its ground: what fills it, else what roots in it, else its floor. */
  cellTop(map: string, x: number, y: number): Entity | undefined {
    let top: Entity | undefined
    let rank = -1
    for (const e of this.entitiesAt(map, x, y)) {
      if (!this.isTerrain(e)) continue
      for (const s of this.spacesOf(e)) {
        const r = CELL_RANK[s]
        if (r !== undefined && r > rank) [top, rank] = [e, r]
      }
    }
    return top
  }

  /** A cell as a reference: what makes it up on top (its floor's id if nothing does: a reference to nothing). */
  cellRef(map: string, x: number, y: number): Ref {
    return { e: this.cellTop(map, x, y)?.id ?? cellId(map, x, y, 'floor') }
  }

  /** The things of a map's cells that the state keeps (changed, made there, or gone): what differs from its data. */
  keptCells(map: string): Entity[] {
    const out: Entity[] = []
    for (const e of Object.values(this.state.entities)) if (parseCellId(e.id)?.map === map) out.push(e)
    return out
  }

  /** The regions a cell lies in (world-model.md §5.4). */
  regionsAt(map: string, x: number, y: number): Entity[] {
    const out: Entity[] = []
    for (const id of this.areas.get(map) ?? []) {
      const r = this.state.entities[id]
      if (r?.place.on === 'area' && r.place.rects.some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh)) out.push(r)
    }
    return out
  }

  /** Does a thing stand in a region (by its relation, as the last outcome left it)? */
  within(e: Entity | undefined, region: Id): boolean {
    const p = e && this.posOf(e)
    return !!p && this.regionsAt(p.map, p.x, p.y).some((r) => r.id === region)
  }

  entitiesOnMap(map: string): Entity[] {
    const s = this.onMap.get(map)
    if (!s) return []
    const out: Entity[] = []
    for (const id of s) out.push(this.state.entities[id])
    return out
  }

  // ---------------------------------------------------------------- what a thing is, as data (world-model.md §4.2)

  /** Does it act by itself, with a body that takes its cells? (the `agent` tag) */
  isAgent(e: Entity): boolean {
    return this.hasTag(e, 'agent')
  }

  /** What it is made of: its own `material:<id>` tag (an item's), else its type's, else its `material` prop. */
  materialOf(e: Entity): MaterialDef | undefined {
    const tag = [...(e.tags ?? []), ...this.onto.resolve(e.type).tags].find((t) => t.startsWith('material:'))
    const id = tag ? tag.slice(9) : this.prop(e, 'material')
    return typeof id === 'string' ? this.onto.data.materials?.[id] : undefined
  }

  /** How well an instrument works on what a thing is made of (world-model.md §6.1): its best row of the efficiency table for the thing's material category. */
  efficiency(instrument: Entity, edge: string | undefined, target: Entity): number {
    const category = this.materialOf(target)?.category
    const table = this.onto.data.efficiency
    if (!category || !table) return 1
    const rows = [...(edge ? [`edge:${edge}`] : []), ...this.onto.resolve(instrument.type).tags, ...(instrument.tags ?? [])].filter((r) => table[r]?.[category] !== undefined)
    return rows.length ? Math.max(...rows.map((r) => table[r][category])) : 1
  }

  /** The ground height of a column, in half levels (0 off the map or where the map says none). */
  heightAt(map: string, x: number, y: number): number {
    const m = this.state.maps[map]
    if (!m?.heights || !this.inBounds(map, x, y)) return 0
    return m.heights[y * m.width + x] ?? 0
  }

  /**
   * What a step from one column to the next is for a thing (world-model.md §5.5): a walk (half a
   * level up or down at most: level ground, a ramp), a fall (further down: that many levels), or a
   * climb, which one cannot make (a cliff). What flies does neither.
   */
  stepOver(e: Entity | undefined, map: string, ax: number, ay: number, bx: number, by: number): { walk: true } | { fall: number } | { climb: true } {
    if (e && this.stanceOf(e) === 'air') return { walk: true }
    const d = this.heightAt(map, bx, by) - this.heightAt(map, ax, ay)
    if (d > 1) return { climb: true }
    if (d < -1) return { fall: -d / 2 }
    return { walk: true }
  }

  /** A step one would plan to take: a walk, or a fall that does no harm (behaviour avoids unsafe drops). */
  safeStep(e: Entity | undefined, map: string, ax: number, ay: number, bx: number, by: number): boolean {
    const s = this.stepOver(e, map, ax, ay, bx, by)
    return 'walk' in s || ('fall' in s && s.fall <= (this.onto.data.params?.safeFall ?? 1))
  }

  /** Can it be carried? (the `portable` tag) */
  isPortable(e: Entity): boolean {
    return this.hasTag(e, 'portable')
  }

  /** Does it keep no place on any map (the story, the world)? */
  isPlaceless(e: Entity): boolean {
    return e.place.on === 'resident'
  }

  /** A body standing on the tile: an agent that does not fly over it. */
  actorAt(map: string, x: number, y: number, ignore?: Id): Entity | undefined {
    return this.entitiesAt(map, x, y).find((e) => e.id !== ignore && this.isAgent(e) && !this.hasTag(e, 'airborne'))
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
    return ref && this.posOf(this.get(ref.e))
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

  /** The terrain a cell shows: the terrain of the cell thing on top ('void' off the map, or with nothing there). */
  terrainAt(map: string, x: number, y: number): string {
    const top = this.cellTop(map, x, y)
    return (top && this.onto.resolve(top.type).terrain) ?? 'void'
  }

  /**
   * The author's terrain brush (world building, loading, migrations, tests — never a rule: rules
   * transform their own host): the cell shows `terrain` on top. Its space gets a thing of that
   * terrain (the one there is changed, else one is made under the cell's id); what lies above that
   * space goes.
   */
  setTerrain(map: string, x: number, y: number, terrain: string): void {
    const space = this.onto.terrain(terrain)?.space ?? 'floor'
    const above = CELL_SPACES.slice(CELL_SPACES.indexOf(space) + 1)
    for (const e of this.entitiesAt(map, x, y)) {
      if (!this.isTerrain(e)) continue
      const s = this.spacesOf(e)
      if (s.some((sp) => (above as Space[]).includes(sp))) this.destroy(e)
    }
    const there = this.entitiesAt(map, x, y).find((e) => this.spacesOf(e).includes(space))
    if (there) {
      if (there.type !== `tile/${terrain}`) this.transform(there, `tile/${terrain}`)
    } else this.add({ id: cellId(map, x, y, space), type: `tile/${terrain}`, place: { on: 'tile', map, x, y } })
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
          if (r.solid && !this.isAgent(e) && this.covers(e, map, x, y)) return e
        }
    return undefined
  }

  /** Blocked whoever moves: no floor, or the base of a solid thing (a tree, rock, water, a wall, a cart). */
  blocked(map: string, x: number, y: number, ignore?: Id): boolean {
    return !this.occupant(map, x, y, 'floor') || !!this.solidAt(map, x, y, ignore)
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
      if (e.id === ignore || !this.isAgent(e)) continue
      if (ghostNpcs && e.npc) continue
      // a bird over the path is no wall
      if (this.hasTag(e, 'airborne')) continue
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

  /** The stances a thing acts on: what can stand or lie on it (none unless its type says). */
  reachOf(e: Entity): string[] {
    return this.onto.resolve(e.type).reach ?? []
  }

  /**
   * A thing's own relations, as `how|key`: on the things of its cell whose reach includes its
   * stance (a flyer touches neither lava nor flowers) — on the floor, keyed with what the floor is
   * (ice thawing to water underfoot is a new contact); in the regions its cell lies in; in its
   * holder; held in a hand. The floor itself lies on nothing.
   */
  relationsOf(e: Entity): string[] {
    const p = e.place
    if (p.on === 'inside') return [`in|${p.holder}`]
    if (p.on === 'hand') return [`held|${p.holder}`]
    if (p.on !== 'tile') return []
    const st = this.stanceOf(e)
    const out: string[] = []
    const mine = this.spacesOf(e)
    if (!mine.includes('floor')) {
      const floor = this.occupant(p.map, p.x, p.y, 'floor')
      if (floor && this.reachOf(floor).includes(st)) out.push(`on|${floor.id}#${floor.type}`)
      // what has a reach of its own is ground for others, not something that lies on them
      if (!this.reachOf(e).length)
        for (const f of this.entitiesAt(p.map, p.x, p.y)) if (f !== floor && f.id !== e.id && this.reachOf(f).includes(st)) out.push(`on|${f.id}`)
    }
    for (const r of this.regionsAt(p.map, p.x, p.y)) out.push(`in-region|${r.id}`)
    return out
  }

  // ---------------------------------------------------------------- views

  view(ref: Ref | undefined): View | undefined {
    if (!ref) return undefined
    const e = this.get(ref.e)
    if (!e || e.place.on === 'none') return undefined
    const r = this.onto.resolve(e.type)
    const tags = new Set(r.tags)
    for (const t of e.tags ?? []) tags.add(t)
    return {
      ref,
      type: e.type,
      tags,
      statuses: new Set(e.statuses ? Object.keys(e.statuses) : []),
      props: { ...r.props, ...(e.props ?? {}) },
      id: e.id,
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

  /** A thing's own prop changes (the engine's `setProp` adds the threshold events). */
  setProp(e: Entity, key: string, value: PropValue | undefined): void {
    this.guard('setProp', e)
    if (value === undefined) {
      if (e.props) delete e.props[key]
    } else (e.props ??= {})[key] = value
  }

  addTag(e: Entity, tag: string): void {
    this.guard('addTag', e)
    if (!e.tags?.includes(tag)) (e.tags ??= []).push(tag)
  }

  removeTag(e: Entity, tag: string): void {
    this.guard('removeTag', e)
    if (e.tags?.includes(tag)) e.tags = e.tags.filter((t) => t !== tag)
  }

  // ---------------------------------------------------------------- entity lifecycle

  add(e: Entity): Entity {
    this.guard('add')
    // what an outcome makes is its own to shape
    this.scope?.made.add(e.id)
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
    this.guard('place', e)
    this.detach(e)
    e.place = to
    if (to.on === 'tile') this.indexAdd(e)
    else this.attach(e)
  }

  /** Drain the output buffer (the host, once a frame), keeping its last lines in `recent`. */
  drainFx(): FxEvent[] {
    const fx = this.fx
    this.fx = []
    for (const f of fx) if (f.t === 'log' || f.t === 'say') this.recent.push(f.text)
    if (this.recent.length > RECENT_LINES) this.recent.splice(0, this.recent.length - RECENT_LINES)
    return fx
  }

  /** Change an entity's type, re-indexing the cells it covers (a new type may have another footprint). */
  transform(e: Entity, type: string): void {
    this.guard('transform', e)
    this.indexRemove(e)
    e.type = type
    this.indexAdd(e)
  }

  destroy(e: Entity): void {
    this.guard('destroy', e)
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
    // a cell thing of the map's data stays gone: its record keeps the static one from coming back
    if (parseCellId(e.id)) this.state.entities[e.id] = { id: e.id, type: e.type, place: { on: 'none' } }
    else delete this.state.entities[e.id]
  }

  /** The author's: a cell thing as the map's data has it again (what the state kept of it is forgotten). */
  revert(e: Entity): void {
    this.guard('revert', e)
    if (!parseCellId(e.id)) throw new Error(`${e.id} is not a cell thing of a map's data`)
    this.detach(e)
    this.statusful.delete(e.id)
    delete this.state.entities[e.id]
  }

  // ---------------------------------------------------------------- statuses

  statusesOf(ref: Ref): Record<string, number> | undefined {
    return this.get(ref.e)?.statuses
  }

  hasStatus(ref: Ref, status: string): boolean {
    return this.statusesOf(ref)?.[status] !== undefined
  }

  /** Who gave a thing a status it holds (the actor of the outcome that set it), if anyone. */
  statusBy(ref: Ref, status: string): Id | undefined {
    return this.get(ref.e)?.statusBy?.[status]
  }

  /**
   * Returns true when the status was newly applied (callers emit the `status` event). `by`: who
   * gave it — its later time events carry them as their actor (a bleed or a fire one set).
   */
  setStatus(ref: Ref, status: string, expiry: number, by?: Id): boolean {
    this.guard('setStatus', ref)
    const holder = this.get(ref.e)
    if (!holder) return false
    const key = holder.id
    const bag = (holder.statuses ??= {})
    const fresh = !(status in bag)
    bag[status] = expiry
    if (by) (holder.statusBy ??= {})[status] = by
    else if (holder.statusBy) {
      delete holder.statusBy[status]
      if (!Object.keys(holder.statusBy).length) delete holder.statusBy
    }
    this.statusful.add(key)
    return fresh
  }

  clearStatus(ref: Ref, status: string): boolean {
    this.guard('clearStatus', ref)
    const bag = this.statusesOf(ref)
    if (!bag || !(status in bag)) return false
    delete bag[status]
    const holder = this.get(ref.e)
    if (holder?.statusBy) {
      delete holder.statusBy[status]
      if (!Object.keys(holder.statusBy).length) delete holder.statusBy
    }
    if (!Object.keys(bag).length) {
      this.statusful.delete(ref.e)
      if (holder) delete holder.statuses
    }
    return true
  }

  /** Resolve a statusful-set or relation key back to a ref (a floor's relation key carries its type after '#'). */
  keyRef(key: string): Ref {
    return { e: key.split('#')[0] }
  }

  // ---------------------------------------------------------------- time

  /** The clock, 0 … 24 (calendar.ts: day 1 begins at 06:00, a game minute is 7 ticks). */
  hour(): number {
    return calendarAt(this.state.tick, this.state.seed).hour
  }

  calendar(): Calendar {
    return calendarAt(this.state.tick, this.state.seed, this.weather)
  }

  // ---------------------------------------------------------------- the story's own state (world-model.md §3)

  /** The story: its props are the facts it keeps, its topics and where its script stands. */
  get story(): Entity | undefined {
    return this.get(STORY_ID)
  }

  /** A fact the story keeps: one of its props. */
  fact(key: string): PropValue | undefined {
    return this.story?.props?.[key]
  }

  /** The story keeps a fact: it sets its own prop (in its own outcome, or as the author). */
  setFact(key: string, value: PropValue): void {
    const s = this.story
    if (!s) throw new Error('no story in this world')
    this.setProp(s, key, value)
  }

  /** Is a topic fresh (raised `topic.<id>` days ago, for `topic.<id>.days` days)? */
  topicFresh(id: string, day = this.calendar().day): boolean {
    const since = this.fact(`topic.${id}`)
    if (typeof since !== 'number') return false
    const days = this.fact(`topic.${id}.days`)
    return day < since + (typeof days === 'number' ? days : TOPIC_DAYS)
  }

  /** The topics the story has ever raised (fresh or not), by id. */
  topicIds(): string[] {
    const out: string[] = []
    for (const k of Object.keys(this.story?.props ?? {})) if (k.startsWith('topic.') && !k.endsWith('.days')) out.push(k.slice(6))
    return out
  }

  /** Where the story's script stands (the scene playing): the story's behaviour memory, like a creature's chase. */
  get scene(): SceneState | undefined {
    return this.story?.script
  }

  set scene(s: SceneState | undefined) {
    const story = this.story
    if (!story) throw new Error('no story in this world')
    if (s) story.script = s
    else delete story.script
  }
}
