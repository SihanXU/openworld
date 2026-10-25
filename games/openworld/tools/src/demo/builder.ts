// A small authoring DSL for hand-crafted maps: terrain painting, prefab stamps (houses),
// room frames, fixtures, items, creatures and portals — emitted as engine chunks — and the
// tools of composition (docs/game-design.md §8.7): curved paths with soft edges, organic
// shapes, fences and yards, mask-driven scattering of small things, and named anchors. There is
// no picture without a thing, and no wall without one: what the map shows and what blocks are
// terrain or entities (a big thing blocks its type's footprint, and only while it stands).

import type { AiData, Entity, AppearDef, MapData, Portal, PropValue, Text } from '@openworld/engine'
import { readFileSync } from 'node:fs'
import { CHAR_OF, FORM_BY_ID, TERRAIN_CHARS, buildOntology, makeItem, type RawChunk } from '@openworld-game/content'
import { OntologyIndex, Rng, baseCovers, splitLayers } from '@openworld/engine'
import type { PrefabDef } from '@openworld/runtime/src/assets/types.ts'
import { CATALOG, FENCES, FENCE_PIECES } from '../../../client/src/catalog.ts'

/** The builders' randomness. Re-seeded for each map (`reseed`), so a map comes out the same however many were built before it. */
export let rng = new Rng(4242)
export function reseed(seed: number): void {
  rng = new Rng(seed)
}

const SOLID_TERRAIN = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'burnt_wall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'])
/** The content's types, for what the builder must know of a thing: its footprint, whether it is solid. */
const ONTO = new OntologyIndex(buildOntology())

export type Cell = [number, number]

/** An item as the author writes it: its form, and what of it is chosen (the rest is rolled); `level` a piece of gear's (else its map's). */
export type ItemSpec = string | { form: string; material?: string; quality?: string; element?: string | null; level?: number; name?: Text; tags?: string[]; props?: Record<string, PropValue>; /** A Vowbound piece's vow (content VOWS); else one is rolled. */ vow?: string }

/**
/**
 * A thing's own randomness, from its id (unique in the world; a map's own things carry the map's id): what its rolled
 * extras draw on, apart from the builders' stream, so the affix table can change without moving a map's ground or things.
 */
export function ownRandom(id: string): () => number {
  // FNV-1a over the id: a seed for a generator of its own
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  const r = new Rng(h)
  return () => r.next()
}

/**
 * An item as a spec says: its form, material, quality, element, level, name, tags and props (`id`: the thing it will be;
 * `level`: the map's, unless the piece says its own). A piece of gear's main stats are its form's at its quality and level
 * (world-model.md §6.8), never the author's: of the props given, what the form itself gives is dropped, and the rest is the
 * piece's own (a vigil's `night:def`). Every piece rolls its small extras, a named one too; a Vowbound piece takes the vow
 * the author names, else one rolled.
 */
export function itemOf(spec: ItemSpec, id: string, level = 1): Omit<Entity, 'id' | 'place'> {
  const s = typeof spec === 'string' ? { form: spec } : spec
  const form = FORM_BY_ID[s.form]
  if (!form) throw new Error(`unknown item form ${s.form}`)
  // (a form that is its own tier, the scallop, keeps it; any other is common unless the author says)
  const it = makeItem(rng, form, { material: s.material, quality: s.quality ?? (form.tags?.some((t) => t.startsWith('quality:')) ? undefined : 'common'), element: s.element === undefined ? null : s.element, vow: s.vow, level: s.level ?? level, extras: ownRandom(id) })
  if (s.name) it.name = s.name
  if (s.tags) it.tags = [...(it.tags ?? []), ...s.tags]
  if (s.props) it.props = { ...(it.props ?? {}), ...Object.fromEntries(Object.entries(s.props).filter(([k]) => !(form.props && k in form.props && typeof form.props[k] === 'number'))) }
  return it
}

/** The small things of the ground (content ontology.ts, life.ts forage/pick), and how much of a mask's density they get since 2026-10-24. */
const LITTER = new Set(['fixture/nature/flowers', 'fixture/nature/tuft', 'fixture/nature/ferns', 'fixture/nature/leaves', 'fixture/nature/pebbles', 'fixture/nature/moss', 'fixture/nature/reeds'])
const LITTER_SCALE = 0.25
/** The chance a mask's cell gets a thing: the ground's litter at a quarter of what the mask asks (a thing to pick up, not a carpet). */
export const litterChance = (type: string, p: number): number => (LITTER.has(type) ? p * LITTER_SCALE : p)

export class MapBuilder {
  cells: string[][]
  portals: Portal[] = []
  entities: Entity[] = []
  stamps: { key: string; x: number; y: number }[] = []
  rooms: { style: string; x: number; y: number; w: number; h: number }[] = []
  private seq = 0
  /** Door tiles of stamped prefabs, by a name the author chooses. */
  doors: Record<string, [number, number]> = {}
  anchors: Record<string, [number, number]> = {}
  /** Named areas [x, y, w, h] (the goal's far bank). */
  regions: Record<string, [number, number, number, number]> = {}
  /** What a named area is beyond its cells (MapData.regionProps): whose it is, whether it is private. */
  regionProps: Record<string, Record<string, PropValue>> = {}
  /** The watch that keeps the law here (MapData.law, docs/npc-sandbox.md §2.7). */
  law?: string
  /** What appears on the map by itself: the ground's yield, creatures that come back (MapData.appear). */
  appear: AppearDef[] = []
  /** Peaceful (towns, camps) or combat (night brings monsters): MapData.zone. */
  zone: 'peaceful' | 'combat' = 'combat'
  /** Fish shadows show in its water now and then (MapData.fish): a stocked pond. */
  fish = false
  /** The level of the gear laid on it, unless a piece says its own (world-model.md §6.8): the Ford's 1, deeper and further 2 … */
  gearLevel = 1
  /** Where the map lies on the overworld (MapData.site): its open edges lead there. */
  site?: MapData['site']
  /** Ground heights in half levels (MapData.heights): a level is two, a ramp is a column between. */
  heights: number[][] = []
  /** Background, not played yet (MapData.backdrop, docs/continent.md §1). */
  backdrop = false

  constructor(
    public id: string,
    public name: Text,
    public kind: string,
    public w: number,
    public h: number,
    fill = 'grass',
    public music?: string,
    public light: 'outdoor' | 'indoor' | 'dark' = 'outdoor',
    public region = 'frostfang',
  ) {
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill))
    this.heights = Array.from({ length: h }, () => Array(w).fill(0))
  }

  /**
   * The terrain as drawn by hand (release 1, docs/release-1.md): a map's layout file, `maps/<name>.txt` beside the
   * builders, a line to a row and a character to a cell in the map format's own characters (content TERRAIN_CHARS).
   * What is stamped and placed afterwards goes over it; a layout of the wrong size, or a character no terrain has,
   * throws.
   */
  paint(name: string) {
    const rows = readFileSync(new URL(`./maps/${name}.txt`, import.meta.url), 'utf8').split(/\r?\n/).filter((r) => r.length)
    if (rows.length !== this.h || rows.some((r) => r.length !== this.w)) throw new Error(`layout ${name}: ${rows.length} rows of ${rows.map((r) => r.length).join('/')}, the map is ${this.w}x${this.h}`)
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const t = TERRAIN_CHARS[c]
      if (!t) throw new Error(`layout ${name}: no terrain for '${c}' at ${x},${y}`)
      this.set(x, y, t)
    }))
  }

  /**
   * The ground's heights as drawn by hand: `maps/<name>.txt` beside the layout, a digit a cell in half levels (a level
   * is 2; an odd height is a ramp between two). A layout of the wrong size, or a character not a digit, throws.
   */
  lift(name: string) {
    const rows = readFileSync(new URL(`./maps/${name}.txt`, import.meta.url), 'utf8').split(/\r?\n/).filter((r) => r.length)
    if (rows.length !== this.h || rows.some((r) => r.length !== this.w)) throw new Error(`heights ${name}: ${rows.length} rows of ${rows.map((r) => r.length).join('/')}, the map is ${this.w}x${this.h}`)
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (!/[0-9]/.test(c)) throw new Error(`heights ${name}: '${c}' at ${x},${y} is not a digit`)
      this.heights[y][x] = Number(c)
    }))
  }

  /**
   * A layout's old stumps ('u') as stump things on grass: the ground's stump grows back into a tree (its clock running
   * from the first tick, so every save would carry it), a stump thing stays one. Ids of their own (`<map>.stump.<n>`),
   * so no other thing's id moves.
   */
  stumpsAsThings() {
    let n = 0
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.get(x, y) === 'stump') (this.set(x, y, 'grass'), this.fixture('fixture/nature/stump', x, y, { id: `${this.id}.stump.${n++}` }))
  }

  /** Raise ground to `half` half levels (a level is 2; an odd height is a ramp between two levels). */
  raise(x: number, y: number, w: number, h: number, half: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.in(i, j)) this.heights[j][i] = half
  }

  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x: number, y: number) {
    return this.in(x, y) ? this.cells[y][x] : 'void'
  }
  set(x: number, y: number, t: string) {
    if (this.in(x, y)) this.cells[y][x] = t
  }
  rect(x: number, y: number, w: number, h: number, t: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t)
  }
  /** Filled ellipse. */
  blob(cx: number, cy: number, rx: number, ry: number, t: string, only?: (cur: string) => boolean) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry)
        if (d <= 1 && (!only || only(this.get(x, y)))) this.set(x, y, t)
      }
  }
  border(t: string, thick = 2, gaps: [number, number, number, number][] = []) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const edge = x < thick || y < thick || x >= this.w - thick || y >= this.h - thick
        if (!edge) continue
        if (gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh)) continue
        this.set(x, y, t)
      }
  }
  /** Horizontal-then-vertical road. */
  road(ax: number, ay: number, bx: number, by: number, t = 'path', width = 1, over?: (cur: string) => boolean) {
    const put = (x: number, y: number) => {
      for (let d = 0; d < width; d++) {
        for (const [px, py] of [[x + d, y], [x, y + d]]) if (!over || over(this.get(px, py))) this.set(px, py, t)
      }
    }
    let x = ax
    let y = ay
    while (x !== bx) (put(x, y), (x += Math.sign(bx - x)))
    while (y !== by) (put(x, y), (y += Math.sign(by - y)))
    put(bx, by)
  }
  // ---------------------------------------------------------------- composition

  /** A named spot (for schedules, scenes and the modder). */
  anchor(name: string, x: number, y: number): Cell {
    if (!this.in(x, y)) throw new Error(`${this.id}: anchor ${name} out of bounds`)
    this.anchors[name] = [x, y]
    return [x, y]
  }

  /** Is the tile open ground: walkable terrain, nothing standing on it, under no thing's base? */
  free(x: number, y: number): boolean {
    if (!this.in(x, y)) return false
    if (SOLID_TERRAIN.has(this.get(x, y)) || this.get(x, y) === 'door') return false
    return !this.entities.some((e) => this.under(e, x, y))
  }

  /** Can one walk here: walkable terrain, and no solid thing's base covers it? */
  walkable(x: number, y: number): boolean {
    if (!this.in(x, y) || SOLID_TERRAIN.has(this.get(x, y))) return false
    return !this.entities.some((e) => ONTO.resolve(e.type).solid && this.under(e, x, y))
  }

  /** Does a placed thing stand on (x,y), or cover it with its base (its type's footprint)? */
  private under(e: Entity, x: number, y: number): boolean {
    if (e.place.on !== 'tile') return false
    return baseCovers(e.place.x, e.place.y, ONTO.resolve(e.type).footprint, x, y)
  }

  /** Any tile within `r` (Chebyshev) of (x,y) passes `pred`. */
  near(x: number, y: number, pred: (t: string, x: number, y: number) => boolean, r = 1): boolean {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if ((i || j) && this.in(x + i, y + j) && pred(this.get(x + i, y + j), x + i, y + j)) return true
    return false
  }

  /**
   * A curved path through control points (a Catmull-Rom spline through cell centres). Width 1
   * is a 4-connected trail; wider paths are painted as discs. `edge` terrain frays the border
   * with probability `edgeP` (soft edges, never a ruler line). Returns the centre cells.
   */
  path(points: Cell[], t = 'path', width = 2, opts: { edge?: string; edgeP?: number; over?: (cur: string) => boolean } = {}): Cell[] {
    const P = [points[0], ...points, points[points.length - 1]]
    const centre: Cell[] = []
    const seen = new Set<number>()
    const paint = new Set<number>()
    const r = width / 2
    const over = opts.over ?? ((c: string) => c !== 'door' && c !== 'wall' && c !== 'woodwall' && c !== 'water' && c !== 'deepwater')
    const add = (x: number, y: number) => this.in(x, y) && paint.add(y * this.w + x)
    const visit = (px: number, py: number) => {
      const cx = Math.floor(px)
      const cy = Math.floor(py)
      const last = centre[centre.length - 1]
      if (width <= 1 && last && last[0] !== cx && last[1] !== cy && !seen.has(last[1] * this.w + cx)) {
        // keep a 1-wide trail 4-connected
        seen.add(last[1] * this.w + cx)
        centre.push([cx, last[1]])
        add(cx, last[1])
      }
      if (!seen.has(cy * this.w + cx)) (seen.add(cy * this.w + cx), centre.push([cx, cy]))
      if (width <= 1) return void add(cx, cy)
      for (let y = Math.floor(py - r) - 1; y <= Math.ceil(py + r); y++)
        for (let x = Math.floor(px - r) - 1; x <= Math.ceil(px + r); x++) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) add(x, y)
    }
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
      const steps = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4))
      for (let s = 0; s <= steps; s++) {
        const u = s / steps
        const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
        visit(f(p0[0], p1[0], p2[0], p3[0]) + 0.5, f(p0[1], p1[1], p2[1], p3[1]) + 0.5)
      }
    }
    for (const k of paint) {
      const x = k % this.w
      const y = Math.floor(k / this.w)
      if (over(this.get(x, y))) this.set(x, y, t)
    }
    if (opts.edge) {
      const p = opts.edgeP ?? 0.35
      for (const k of paint)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = (k % this.w) + dx
          const ny = Math.floor(k / this.w) + dy
          if (!this.in(nx, ny) || paint.has(ny * this.w + nx)) continue
          const cur = this.get(nx, ny)
          if (over(cur) && !SOLID_TERRAIN.has(cur) && cur !== t && rng.chance(p)) this.set(nx, ny, opts.edge)
        }
    }
    return centre
  }

  /** An organic patch: an ellipse whose radius wanders with the angle (shorelines, clearings). */
  organic(cx: number, cy: number, rx: number, ry: number, t: string, opts: { rough?: number; only?: (cur: string) => boolean } = {}) {
    const rough = opts.rough ?? 0.22
    const ph = [rng.next() * 6.28, rng.next() * 6.28, rng.next() * 6.28]
    for (let y = Math.floor(cy - ry * (1 + rough)) - 1; y <= Math.ceil(cy + ry * (1 + rough)) + 1; y++)
      for (let x = Math.floor(cx - rx * (1 + rough)) - 1; x <= Math.ceil(cx + rx * (1 + rough)) + 1; x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        const a = Math.atan2(dy, dx)
        const lim = 1 + rough * (0.5 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.2 * Math.sin(7 * a + ph[2]))
        if (Math.hypot(dx, dy) <= lim && (!opts.only || opts.only(this.get(x, y)))) this.set(x, y, t)
      }
  }

  /**
   * Stamp a catalog prefab as scenery: the look of terrain. '#' cells become the prefab's solid
   * terrain (a wall, a cliff) unless already solid, 'D' becomes a door (named `doorName`).
   */
  scenery(key: string, x: number, y: number, doorName?: string) {
    const def = CATALOG.prefabs[key]
    if (!def) throw new Error(`prefab ${key} not in catalog`)
    this.stamps.push({ key, x, y })
    def.grid.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '#' && this.in(x + i, y + j) && !SOLID_TERRAIN.has(this.get(x + i, y + j))) this.set(x + i, y + j, def.terrain ?? 'wall')
        if (c === 'D') {
          this.set(x + i, y + j, 'door')
          if (doorName) this.doors[doorName] = [x + i, y + j]
        }
      }),
    )
  }

  /** A building from the catalog (solid walls, a named door). Returns its door cell. */
  house(key: string, x: number, y: number, doorName: string): Cell {
    const def = CATALOG.prefabs[key]
    if (!def) throw new Error(`prefab ${key} not in catalog`)
    this.prefab(key, def, x, y, doorName)
    return this.doors[doorName]
  }

  /**
   * A straight fence run (horizontal or vertical) of 'rail' | 'fence' | 'stonewall' pieces,
   * leaving gaps at `gates`. Pieces are scenery: the ground shows through, the tiles block.
   */
  fence(kind: 'rail' | 'fence' | 'stonewall', a: Cell, b: Cell, gates: Cell[] = []) {
    const horiz = a[1] === b[1]
    const key = `${kind}_${horiz ? 'h' : 'v'}`
    const [dx, dy] = horiz ? [Math.sign(b[0] - a[0]) || 1, 0] : [0, Math.sign(b[1] - a[1]) || 1]
    for (let x = a[0], y = a[1]; ; x += dx, y += dy) {
      if (!gates.some(([gx, gy]) => gx === x && gy === y)) this.scenery(key, x, y)
      if (x === b[0] && y === b[1]) break
    }
  }

  /** A fenced lot: the rectangle's outline as fence runs, with gates. */
  yard(x: number, y: number, w: number, h: number, kind: 'rail' | 'fence' | 'stonewall' = 'rail', gates: Cell[] = []) {
    this.fence(kind, [x, y], [x + w - 1, y], gates)
    this.fence(kind, [x, y + h - 1], [x + w - 1, y + h - 1], gates)
    this.fence(kind, [x, y + 1], [x, y + h - 2], gates)
    this.fence(kind, [x + w - 1, y + 1], [x + w - 1, y + h - 2], gates)
  }

  /**
   * Small things by mask: on each free cell of the rect passing `where`, a fixture of `type`
   * with probability p. Masks put things where they belong (stones at a cliff's foot, flowers
   * along a path, leaves under trees), never as uniform noise.
   */
  sprinkle(type: string, p: number, where: (x: number, y: number, t: string) => boolean, rect: [number, number, number, number] = [0, 0, this.w, this.h]) {
    const [rx, ry, rw, rh] = rect
    const chance = litterChance(type, p)
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (this.free(x, y) && where(x, y, this.get(x, y)) && rng.chance(chance)) this.fixture(type, x, y)
  }

  /** An interior partition: a wall ring inside the room with doorways (drawn as a room frame). */
  partition(style: string, x: number, y: number, w: number, h: number, doorways: Cell[] = []) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        if (!(i === x || j === y || i === x + w - 1 || j === y + h - 1)) continue
        this.set(i, j, doorways.some(([dx, dy]) => dx === i && dy === j) ? 'door' : 'wall')
      }
    this.rooms.push({ style, x, y, w, h })
  }

  /** Scatter terrain in a rect with probability p onto cells passing `only`. */
  scatter(x: number, y: number, w: number, h: number, t: string, p: number, only: (cur: string) => boolean = (c) => c === 'grass') {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (only(this.get(i, j)) && rng.chance(p)) this.set(i, j, t)
  }

  /** Stamp a prefab with its top-left at (x,y); solid cells become its terrain, the door 'door'. */
  prefab(key: string, def: PrefabDef, x: number, y: number, doorName?: string) {
    this.stamps.push({ key, x, y })
    def.grid.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '#') this.set(x + i, y + j, def.terrain ?? 'wall')
        if (c === 'D') {
          this.set(x + i, y + j, 'door')
          if (doorName) this.doors[doorName] = [x + i, y + j]
        }
      }),
    )
  }

  /** An interior room: walls on the frame, floor inside, a door in the bottom wall. */
  room(style: string, floor: string, doorX?: number) {
    this.rect(0, 0, this.w, this.h, 'wall')
    this.rect(1, 1, this.w - 2, this.h - 2, floor)
    this.rooms.push({ style, x: 0, y: 0, w: this.w, h: this.h })
    const dx = doorX ?? Math.floor(this.w / 2)
    this.set(dx, this.h - 1, 'door')
    this.doors.out = [dx, this.h - 1]
  }

  /**
   * A new id on the map. A prefixed one ('i' an item, 'c' a creature) can spell what a plain one spells later (the
   * 680th thing's "iw" is the 32nd item's): an id already given is passed over, so no id changes until a map is that full.
   */
  newId(prefix = '') {
    let id: string
    do id = `${this.id}~${prefix}${(++this.seq).toString(36)}`
    while (this.given.has(id))
    this.given.add(id)
    return id
  }
  private given = new Set<string>()

  fixture(type: string, x: number, y: number, extra: Partial<Entity> = {}, contents: ItemSpec[] = []): Entity {
    const e: Entity = { id: extra.id ?? this.newId(), type, place: { on: 'tile', map: this.id, x, y }, ...extra }
    this.entities.push(e)
    for (const it of contents) this.entities.push(this.makeItem(it, { on: 'inside', holder: e.id }))
    return e
  }

  /** A thing as a spec says, its id the map's next, where it is put; its level the map's unless it says its own. */
  makeItem(spec: ItemSpec, place: Entity['place']): Entity {
    const id = this.newId('i')
    return { ...itemOf(spec, id, this.gearLevel), id, place }
  }

  item(spec: ItemSpec, x: number, y: number): Entity {
    const e = this.makeItem(spec, { on: 'tile', map: this.id, x, y })
    this.entities.push(e)
    return e
  }

  creature(kind: string, x: number, y: number, opts: Partial<AiData> & { id?: string; loot?: ItemSpec[] } = {}): Entity {
    const ranged = ['imp/fire_imp', 'wisp/storm_wisp', 'undead/ghost'].includes(kind)
    const e: Entity = {
      id: opts.id ?? this.newId('c'),
      type: `actor/creature/${kind}`,
      place: { on: 'tile', map: this.id, x, y },
      facing: 'down',
      ai: {
        behaviour: opts.behaviour ?? (ranged ? 'ranged' : 'melee'),
        temper: opts.temper ?? 'aggressive',
        sight: opts.sight ?? 5,
        home: { map: this.id, x, y },
        ...(opts.leash !== undefined && { leash: opts.leash }),
      },
    }
    this.entities.push(e)
    for (const it of opts.loot ?? []) this.entities.push(this.makeItem(it, { on: 'inside', holder: e.id }))
    return e
  }

  /** One-way portal tile. */
  portal(x: number, y: number, to: string, tx: number, ty: number, label?: Text) {
    this.portals.push({ x, y, to, tx, ty, label })
  }

  /** Two-way link between a door here and the interior's door (arrive one tile inside/outside). */
  linkInterior(doorName: string, interior: MapBuilder) {
    const [x, y] = this.doors[doorName]
    const [ix, iy] = interior.doors.out
    this.portal(x, y, interior.id, ix, iy - 1, interior.name)
    interior.portal(ix, iy, this.id, x, y + 1, this.name)
  }

  /**
   * One occupant per space of a cell (world-model.md §5.2): a thing set where the map's terrain
   * fills the volume (a brazier against a cave wall, a vein in the rock) takes that volume, and the
   * cell shows the ground its neighbours show.
   */
  private clearVolumes(): void {
    const spaceOf = (t: string) => ONTO.data.terrains[t]?.space ?? 'floor'
    const data = { id: this.id, name: this.name, kind: this.kind, width: this.w, height: this.h, terrain: this.cells.flat(), portals: [] }
    const layers = splitLayers(data, spaceOf, (t) => !ONTO.data.terrains[t]?.solid)
    for (const e of this.entities) {
      if (e.place.on !== 'tile' || !ONTO.resolve(e.type).solid || ONTO.resolve(e.type).tags.includes('agent')) continue
      const { x, y } = e.place
      if (spaceOf(this.get(x, y)) === 'volume') this.set(x, y, layers.floor[y * this.w + x]!)
    }
  }

  /**
   * Each fence cell its joining piece (catalog FENCE_PIECES): by which of its four sides another cell of the same fence
   * touches — a corner where a run turns, an end beside a gate, a T where a run meets another, a cross. Run as the map
   * is written, so every fence the builder stamped (a yard, a run, two yards side by side) joins as one.
   */
  joinFences() {
    const PIECE: Record<number, string> = { 0: 's', 1: 'v', 4: 's', 5: 'v', 2: 'e', 8: 'w', 10: 'h', 6: 'es', 12: 'ws', 3: 'ne', 9: 'nw', 7: 'nes', 14: 'wes', 11: 'new', 13: 'nsw', 15: 'x' }
    const kindOf = (key: string) => Object.keys(FENCES).find((k) => key.startsWith(`${k}_`) && FENCE_PIECES[key.slice(k.length + 1)])
    const at = new Map<string, string>()
    for (const st of this.stamps) {
      const k = kindOf(st.key)
      if (k) at.set(`${st.x},${st.y}`, k)
    }
    for (const st of this.stamps) {
      const k = kindOf(st.key)
      if (!k) continue
      const same = (dx: number, dy: number) => at.get(`${st.x + dx},${st.y + dy}`) === k
      const mask = (same(0, -1) ? 1 : 0) | (same(1, 0) ? 2 : 0) | (same(0, 1) ? 4 : 0) | (same(-1, 0) ? 8 : 0)
      st.key = `${k}_${PIECE[mask]}`
    }
  }

  chunk(): RawChunk {
    this.clearVolumes()
    this.joinFences()
    const rows = this.cells.map((r) =>
      r
        .map((t) => {
          const c = CHAR_OF[t]
          if (!c) throw new Error(`${this.id}: terrain ${t} has no char`)
          return c
        })
        .join(''),
    )
    return {
      map: {
        id: this.id,
        name: this.name,
        region: this.region,
        kind: this.kind,
        width: this.w,
        height: this.h,
        rows,
        heights: this.heights.some((r) => r.some((v) => v)) ? this.heights.map((r) => r.join('')) : undefined,
        portals: this.portals,
        stamps: this.stamps,
        rooms: this.rooms,
        anchors: Object.keys(this.anchors).length ? this.anchors : undefined,
        regions: Object.keys(this.regions).length ? this.regions : undefined,
        regionProps: Object.keys(this.regionProps).length ? this.regionProps : undefined,
        law: this.law,
        appear: this.appear.length ? this.appear : undefined,
        music: this.music,
        light: this.light,
        fish: this.fish || undefined,
        zone: this.zone,
        site: this.site,
        ...(this.backdrop && { backdrop: true }),
      },
      entities: this.entities,
    }
  }
}

/** Link two outdoor maps through edge openings of equal width (tiles listed in order). */
export function linkEdge(a: MapBuilder, aCells: [number, number][], aIn: [number, number], b: MapBuilder, bCells: [number, number][], bIn: [number, number]) {
  aCells.forEach(([x, y], i) => a.portal(x, y, b.id, bCells[i][0] + bIn[0], bCells[i][1] + bIn[1], b.name))
  bCells.forEach(([x, y], i) => b.portal(x, y, a.id, aCells[i][0] + aIn[0], aCells[i][1] + aIn[1], a.name))
}
