// The backdrop's maps (docs/continent.md §3): a map for every place of the gazetteer, made from its kind, its region and
// the ground it stands on — the ground's own wild (content wild.ts) cleared where the place is built, then what the
// kind is: houses round a street, a fort's walls and towers, a graveyard's stones, a cave's mouth and the dark below
// it; each region's look over its settlements (its buildings, streets, walls and lamps, and what stands about: the
// Coast's woodpiles and pines, the March's braziers and red dirt, the Vale's dry fields, the Fens' mud, pools and mist,
// the Heights' white stone, the Holy City's lamps and statues); a city by its quarter's theme; and behind every
// building's door a room (rooms.ts). Nobody lives in them yet and no tale is told there; they are walked through, and a
// played map may take one's place later.

import type { MapMeta, Text } from '@openworld/engine'
import { TERRAIN_CHARS, wildChunk, type RawChunk } from '@openworld-game/content'
import { CATALOG } from '../../../../client/src/catalog.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import type { Continent, Place } from './generate.ts'
import { roleOf, roomsBehind, type DoorNote, type Role } from './rooms.ts'
import { stockPlace, stockRoom } from './stock.ts'

/** A kind's map size. */
const SIZE: Record<string, [number, number]> = {
  village: [40, 30], town: [48, 36], city: [48, 36], farm: [40, 30], mill: [40, 30], camp: [32, 24], ruin: [36, 28], shrine: [30, 24], cave: [36, 28], mine: [36, 28],
  tower: [32, 24], graveyard: [36, 28], fort: [44, 32], battlefield: [44, 32], cathedral: [44, 32], seat: [40, 30],
}
/** The engine's word for what a map is (MapData.kind). */
const MAP_KIND: Record<string, string> = { village: 'village', town: 'town', city: 'town' }
/** Places where night brings nothing (MapData.zone). */
const PEACEFUL = new Set(['village', 'town', 'city', 'farm', 'mill', 'camp', 'shrine', 'cathedral'])
/** The kinds a region's look is laid over (its lamps and what stands about its doors and streets). */
const SETTLED = new Set(['village', 'town', 'city', 'farm', 'mill', 'camp'])

/** Each region's buildings, streets, walls and lamps (what else stands about its settlements: `DECOR`). */
const STYLE: Record<string, { houses: string[]; street: string; wall: string; yard: 'rail' | 'fence' | 'stonewall'; lamp: string }> = {
  frostfang: { houses: ['house_wood', 'cabin', 'house_thatch'], street: 'path', wall: 'woodwall', yard: 'fence', lamp: 'fixture/light/lamppost' },
  redmarch: { houses: ['house_red', 'house_orange', 'house_red', 'house_wood'], street: 'dirt', wall: 'burnt_wall', yard: 'stonewall', lamp: 'fixture/light/brazier' },
  tithe: { houses: ['house_thatch', 'hut_straw', 'house_thatch', 'house_orange'], street: 'dirt', wall: 'woodwall', yard: 'rail', lamp: 'fixture/light/lamppost' },
  palefen: { houses: ['hut_straw', 'house_wood', 'cabin'], street: 'path', wall: 'woodwall', yard: 'fence', lamp: 'fixture/light/lantern' },
  altar: { houses: ['house_plaster', 'house_plaster', 'house_orange'], street: 'cobble', wall: 'wall', yard: 'stonewall', lamp: 'fixture/light/brazier' },
  holy: { houses: ['house_plaster', 'house_orange', 'house_plaster', 'house_thatch'], street: 'cobble', wall: 'wall', yard: 'stonewall', lamp: 'fixture/light/lamppost' },
}
/** Each region's banner (a catalogue prefab): over its forts' keeps and gates, its towns' and cities' squares. */
const BANNER: Record<string, string> = { frostfang: 'banner_green', redmarch: 'banner_red', tithe: 'banner_yellow', palefen: 'banner_grey', altar: 'banner_cream', holy: 'banner_purple' }
/** What prowls each kind of wild place, by region. */
const HAUNTS: Record<string, string[]> = {
  frostfang: ['beast/wolf', 'slime/frost_slime'],
  redmarch: ['undead/skeleton', 'imp/fire_imp'],
  tithe: ['spider', 'undead/zombie'],
  palefen: ['undead/zombie', 'undead/ghost'],
  altar: ['undead/ghost', 'golem/stone_golem'],
  holy: ['undead/skeleton', 'wisp/storm_wisp'],
}

const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'burnt_wall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'stump', 'void', 'door'])
const GROUND_OF: Record<string, string> = Object.fromEntries(Object.values(TERRAIN_CHARS).map((t) => [t, t]))

type Style = (typeof STYLE)[string]
type Build = (b: MapBuilder, p: Place, s: Style, out: MapBuilder[]) => void
type Rect = [number, number, number, number]

/** The buildings stamped on the map being made, each with a room to come. */
let doors: DoorNote[] = []

/** The map for a place: its ground's wild, then its kind built on it, its region's look; its rooms and depths beside it. */
function placeMaps(p: Place, ground: string): MapBuilder[] {
  reseed(p.seed)
  const [w, h] = SIZE[p.kind] ?? [40, 30]
  const b = new MapBuilder(p.id, p.name, MAP_KIND[p.kind] ?? 'field', w, h, 'grass', undefined, 'outdoor', p.region)
  b.backdrop = true
  b.zone = PEACEFUL.has(p.kind) ? 'peaceful' : 'combat'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  // the ground's own wild, as wide as the place (without its beasts: the kind says what is about)
  const wild = wildChunk(p.seed, p.x, p.y, ground, undefined, p.region, { w, h })
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, GROUND_OF[wild.map.terrain[y * w + x]] ?? 'grass')
  for (const e of wild.entities) if (e.type.startsWith('item/') && e.place.on === 'tile') b.item(e.type, e.place.x, e.place.y)
  const style = STYLE[p.region] ?? STYLE.frostfang
  const out = [b]
  doors = []
  const build = KINDS[p.kind] ?? KINDS.ruin
  build(b, p, style, out)
  if (SETTLED.has(p.kind)) DECOR[p.region]?.(b, style)
  // every building's door: the cell before it clear, a room behind it
  for (const d of doors) front(b, b.doors[d.door], style)
  out.push(...roomsBehind(b, p, doors))
  // what is kept there (stock.ts): the households', the shops', the dark's — a room's by what it is
  for (const m of out) if (m === b) stockPlace(m, p)
  else if (m.kind === 'interior') stockRoom(m, p)
  else stockPlace(m, p, true)
  return out
}

/** Clear a rect to `ground` (what a place is built on): what grew or stood there goes. */
function clear(b: MapBuilder, x: number, y: number, w: number, h: number, ground: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (b.in(i, j)) b.set(i, j, ground)
  b.entities = b.entities.filter((e) => !(e.place.on === 'tile' && e.place.x >= x && e.place.x < x + w && e.place.y >= y && e.place.y < y + h))
}

/** A building's size (its prefab's grid). */
const sizeOf = (key: string): [number, number] => {
  const g = CATALOG.prefabs[key]!.grid
  return [g[0].length, g.length]
}
/** A region's buildings no more than three cells tall (where a taller one would not fit). */
const low = (s: Style) => s.houses.filter((k) => sizeOf(k)[1] <= 3)

/** A building whose door leads into a room (rooms.ts): what it is, its prefab's own unless the place says. */
function building(b: MapBuilder, key: string, x: number, y: number, role: Role = roleOf(key)): Cell {
  const door = `${b.id}.door${doors.length}`
  doors.push({ door, prefab: key, role })
  return b.house(key, x, y, door)
}

/** The cell before a door (where one comes out of its room): ground one stands on, nothing on it. */
function front(b: MapBuilder, [x, y]: Cell, s: Style): void {
  if (!b.in(x, y + 1)) return
  if (SOLID.has(b.get(x, y + 1))) b.set(x, y + 1, s.street)
  b.entities = b.entities.filter((e) => !(e.place.on === 'tile' && e.place.x === x && e.place.y === y + 1))
}

const overlaps = (a: Rect, r: Rect) => a[0] < r[0] + r[2] && r[0] < a[0] + a[2] && a[1] < r[1] + r[3] && r[1] < a[1] + a[3]

/** A building a settlement puts first on its main street (a town's shop, a quarter's chapel), and what it is. */
interface Civic {
  prefab: string
  role?: Role
}

/** What a settlement is laid out with beyond its lanes: its first buildings, and ground kept clear for its theme. */
interface Layout {
  civic?: Civic[]
  reserve?: Rect[]
}

/**
 * Houses in a row facing a street (its row `street`) between x0 and x1, a step of path from each door to it; the
 * `first` buildings before any other, none on the reserved ground.
 */
function row(b: MapBuilder, s: Style, x0: number, x1: number, street: number, first: Civic[] = [], reserve: Rect[] = []): void {
  let x = x0 + rng.int(0, 1)
  const queue = [...first]
  while (true) {
    const civic = queue[0]
    const key = civic?.prefab ?? rng.pick(s.houses)
    const [w, h] = sizeOf(key)
    if (x + w > x1) break
    if (reserve.some((r) => overlaps([x - 1, street - 1 - h, w + 2, h + 1], r))) {
      x += 1
      continue
    }
    queue.shift()
    const door = building(b, key, x, street - 1 - h, civic?.role)
    b.set(door[0], street - 1, s.street)
    x += w + rng.int(2, 3)
  }
}

/** A settlement: a cleared green, its lanes across it a house deep apart, a street down its middle, a square with a well. */
function settlement(b: MapBuilder, s: Style, lanes: number, square: string, layout: Layout = {}): void {
  clear(b, 2, 2, b.w - 4, b.h - 4, 'grass')
  const mid = Math.floor(b.h / 2)
  const cx = Math.floor(b.w / 2)
  // the lanes: the main street through the square, the others seven rows apart, above and below it in turn
  const ys = [mid, mid + 7, mid - 7, mid + 14].slice(0, lanes).filter((y) => y - 5 >= 2 && y + 1 < b.h - 2)
  for (const y of ys) b.path([[y === mid ? 0 : 3, y], [Math.floor(b.w / 3), y], [Math.floor((2 * b.w) / 3), y], [y === mid ? b.w - 1 : b.w - 4, y]], s.street, y === mid ? 2 : 1)
  b.path([[cx, 0], [cx, b.h - 1]], s.street, 2)
  const sq = { x: cx - 3, y: mid - 2 }
  const reserve = layout.reserve ?? []
  for (const y of ys) {
    row(b, s, 3, cx - 4, y, [], reserve)
    row(b, s, cx + 5, b.w - 3, y, y === mid ? layout.civic : [], reserve)
  }
  b.rect(sq.x, sq.y, 8, 5, square)
  b.fixture('fixture/water/well', cx, mid + 1)
  b.fixture(s.lamp, sq.x, sq.y)
  b.fixture(s.lamp, sq.x + 7, sq.y + 4)
  b.sprinkle('fixture/container/barrel', 0.03, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'door', 1), [2, 2, b.w - 4, b.h - 4])
  b.sprinkle('fixture/container/crate', 0.02, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'door', 2), [2, 2, b.w - 4, b.h - 4])
  b.sprinkle('fixture/nature/flowers', 0.02, (_x, _y, t) => t === 'grass', [2, 2, b.w - 4, b.h - 4])
}

/** A wall ring of `t` with a door in its south side and `floor` inside: a tower, a keep, a hall. */
function hall(b: MapBuilder, x: number, y: number, w: number, h: number, t: string, floor: string): Cell {
  b.rect(x, y, w, h, t)
  b.rect(x + 1, y + 1, w - 2, h - 2, floor)
  const door: Cell = [x + Math.floor(w / 2), y + h - 1]
  b.set(door[0], door[1], 'door')
  return door
}

/** A tall piece (a tower, a pillar, a banner) standing with its foot at (x, y), what was stamped there taken away. */
function stand(b: MapBuilder, key: string, x: number, footY: number): void {
  const [w, h] = sizeOf(key)
  const y = footY - h + 1
  b.stamps = b.stamps.filter((st) => !(st.x >= x && st.x < x + w && st.y >= y && st.y < y + h))
  b.scenery(key, x, y)
}
/** The region's banner, its foot at (x, y) on open ground (a flower or a pebble there gives way). */
function banner(b: MapBuilder, region: string, x: number, y: number): void {
  if (!b.in(x, y - 1) || SOLID.has(b.get(x, y))) return
  const small = (e: (typeof b.entities)[number]) => e.place.on === 'tile' && e.place.x === x && e.place.y === y && /^fixture\/nature\/(flowers|pebbles|tuft|leaves|moss|ferns)$/.test(e.type)
  b.entities = b.entities.filter((e) => !small(e))
  if (b.free(x, y)) stand(b, BANNER[region] ?? BANNER.frostfang, x, y)
}

/** Broken walls: rings of `t` with gaps, rubble about them. */
function ruins(b: MapBuilder, t: string, n: number): void {
  for (let k = 0; k < n; k++) {
    const w = rng.int(5, 9)
    const h = rng.int(4, 7)
    const x = rng.int(3, b.w - w - 3)
    const y = rng.int(3, b.h - h - 3)
    if (Math.abs(x + w / 2 - b.w / 2) < w / 2 + 3 && Math.abs(y + h / 2 - b.h / 2) < h / 2 + 3) continue
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const edge = i === x || j === y || i === x + w - 1 || j === y + h - 1
        if (edge && rng.chance(0.65)) b.set(i, j, t)
        else if (!edge && b.get(i, j) !== 'water') b.set(i, j, rng.chance(0.2) ? 'gravel' : 'floor_stone')
      }
  }
  b.sprinkle('fixture/remains/bones', 0.01, (_x, _y, t) => t === 'floor_stone' || t === 'gravel')
  b.sprinkle('fixture/nature/pebbles', 0.02, (_x, _y, t) => t === 'gravel' || t === 'grass')
}

/** What prowls a wild place: `n` of the region's haunts, away from the middle where one comes in. */
function haunt(b: MapBuilder, p: Place, n: number): void {
  const kinds = HAUNTS[p.region] ?? HAUNTS.frostfang
  for (let k = 0; k < n; k++)
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.int(3, b.w - 4)
      const y = rng.int(3, b.h - 4)
      if (!b.walkable(x, y) || Math.hypot(x - b.w / 2, y - b.h / 2) < 8 || b.get(x, y) === 'door') continue
      b.creature(rng.pick(kinds), x, y, { leash: 6 })
      break
    }
}

/**
 * What a place keeps holy: a statue (never one of the Pilgrim's Road's wayshrines, which tell the story when an
 * offering is laid on them).
 */
const shrineOf = (_region: string) => 'fixture/sacred/statue'

/** A spot of `w`×`h` where all is open grass with nothing on it and a step of grass round it (for a pool, a plot). */
function openSpot(b: MapBuilder, w: number, h: number, tries = 40): Cell | undefined {
  for (let t = 0; t < tries; t++) {
    const x = rng.int(3, b.w - w - 3)
    const y = rng.int(3, b.h - h - 3)
    let ok = true
    for (let j = y - 1; ok && j <= y + h; j++) for (let i = x - 1; ok && i <= x + w; i++) ok = b.get(i, j) === 'grass' && b.free(i, j)
    if (ok) return [x, y]
  }
  return undefined
}

/** Next to a door (within `r`), on open ground. */
const byDoor = (b: MapBuilder, r: number) => (x: number, y: number, t: string) => !SOLID.has(t) && t !== 'water' && b.near(x, y, (n) => n === 'door', r)
/** Beside a street (within a step), off it. */
const byStreet = (b: MapBuilder, s: Style) => (x: number, y: number, t: string) => t !== s.street && !SOLID.has(t) && b.near(x, y, (n) => n === s.street, 1)
const inner = (b: MapBuilder): Rect => [2, 2, b.w - 4, b.h - 4]

/** Each region's look laid over its settlements, farms, mills and camps. */
const DECOR: Record<string, (b: MapBuilder, s: Style) => void> = {
  // the Coast: pines crowding in at the edges, woodpiles by the doors, washing strung out
  frostfang: (b) => {
    b.scatter(2, 2, b.w - 4, b.h - 4, 'pine', 0.035, (c) => c === 'grass')
    b.sprinkle('fixture/container/woodpile', 0.06, byDoor(b, 2), inner(b))
    b.sprinkle('fixture/furniture/washing_line', 0.006, (_x, _y, t) => t === 'grass', inner(b))
  },
  // the March: red dirt underfoot, braziers along the streets, racks of spears by the doors, old bones
  redmarch: (b, s) => {
    b.scatter(2, 2, b.w - 4, b.h - 4, 'dirt', 0.4, (c) => c === 'grass')
    b.sprinkle(s.lamp, 0.02, byStreet(b, s), inner(b))
    b.sprinkle('fixture/furniture/rack', 0.05, byDoor(b, 2), inner(b))
    b.sprinkle('fixture/remains/bones', 0.004, (_x, _y, t) => t === 'dirt', inner(b))
  },
  // the Vale: dry grass, little fields gone to dust round the houses, sacks and carts waiting for the weighing
  tithe: (b) => {
    for (let k = 0; k < 3; k++) {
      const at = openSpot(b, 6, 3)
      if (!at) break
      b.rect(at[0], at[1], 6, 3, 'farmland')
      b.fixture('fixture/nature/haystack', at[0] + 6, at[1] + 1)
    }
    b.scatter(2, 2, b.w - 4, b.h - 4, 'drygrass', 0.35, (c) => c === 'grass')
    b.sprinkle('fixture/container/sack', 0.06, byDoor(b, 2), inner(b))
    b.sprinkle('fixture/furniture/cart', 0.004, (_x, _y, t) => t === 'grass' || t === 'drygrass', inner(b))
    b.sprinkle('fixture/scarecrow', 0.003, (_x, _y, t) => t === 'drygrass', inner(b))
  },
  // the Fens: mud, black pools with reeds, dead trees, lanterns at the doors and the mist that never quite lifts
  palefen: (b, s) => {
    for (let k = 0; k < 3; k++) {
      const at = openSpot(b, 4, 3)
      if (!at) break
      b.organic(at[0] + 2, at[1] + 1, 2, 1, 'water', { only: (t) => t === 'grass' })
      b.sprinkle('fixture/nature/reeds', 0.4, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'water', 1), [at[0] - 1, at[1] - 1, 6, 5])
    }
    b.scatter(2, 2, b.w - 4, b.h - 4, 'mud', 0.3, (c) => c === 'grass')
    b.sprinkle(s.lamp, 0.05, byDoor(b, 1), inner(b))
    b.sprinkle('fixture/nature/dead_tree', 0.01, (_x, _y, t) => t === 'grass' || t === 'mud', inner(b))
    b.sprinkle('fixture/nature/mist', 0.012, (_x, _y, t) => t === 'grass' || t === 'mud', inner(b))
  },
  // the Heights: white stone — gravel and boulders, statues over the streets, candles at the doors
  altar: (b, s) => {
    b.scatter(2, 2, b.w - 4, b.h - 4, 'gravel', 0.15, (c) => c === 'grass')
    b.sprinkle('fixture/nature/boulder', 0.006, (_x, _y, t) => t === 'grass' || t === 'gravel', inner(b))
    b.sprinkle('fixture/sacred/statue', 0.006, byStreet(b, s), inner(b))
    b.sprinkle('fixture/light/candles', 0.03, byDoor(b, 1), inner(b))
  },
  // the Holy City: cobbles everywhere, lamps along the streets, flower carts
  holy: (b, s) => {
    b.scatter(2, 2, b.w - 4, b.h - 4, 'cobble', 0.2, (c) => c === 'grass')
    b.sprinkle(s.lamp, 0.015, byStreet(b, s), inner(b))
    b.sprinkle('fixture/furniture/cart/flowers', 0.004, (_x, _y, t) => t === 'grass' || t === 'cobble', inner(b))
    b.sprinkle('fixture/nature/flowers', 0.03, (_x, _y, t) => t === 'grass', inner(b))
  },
}

/** A wall across the map at row `y` with a gate where the street goes through it: round towers either side, posts at its ends. */
function cityWall(b: MapBuilder, region: string, y: number, gx: number): void {
  b.fence('stonewall', [3, y], [b.w - 4, y], [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((d): Cell => [gx + d, y]))
  stand(b, 'tower_round', gx - 5, y)
  stand(b, 'tower_round', gx + 4, y)
  for (const x of [2, b.w - 3]) stand(b, 'pillar', x, y)
  b.fixture('fixture/light/brazier', gx - 2, y + 1)
  b.fixture('fixture/light/brazier', gx + 3, y + 1)
  banner(b, region, gx - 2, y - 1)
  banner(b, region, gx + 3, y - 1)
}

/**
 * A city quarter's theme (the Holy City's eight by name, another city's by its seed): what it is laid out with, the
 * buildings and streets it takes, and what is built in it after its lanes.
 */
interface Theme {
  layout: (b: MapBuilder) => Layout
  style?: (s: Style) => Style
  build?: (b: MapBuilder, s: Style) => void
}
const THEMES: Record<string, Theme> = {
  // the gate: the city's wall across the north with its gatehouse, the watch's barracks on the main street
  gate: {
    layout: () => ({ civic: [{ prefab: 'house_red', role: 'barracks' }, { prefab: 'smithy' }], reserve: [[0, 1, 999, 5]] }),
    build: (b) => cityWall(b, b.region, 5, Math.floor(b.w / 2)),
  },
  // the bells: a chapel and the clergy's house on the main street, the square full of candles, an altar and a statue
  bell: {
    layout: () => ({ civic: [{ prefab: 'temple' }, { prefab: 'temple', role: 'cell' }] }),
    build: (b) => {
      const cx = Math.floor(b.w / 2)
      const mid = Math.floor(b.h / 2)
      for (const [x, y] of [[cx - 2, mid - 2], [cx + 3, mid - 2], [cx - 2, mid + 2], [cx + 3, mid + 2]]) if (b.free(x, y)) b.fixture('fixture/light/candles', x, y, { statuses: { lit: -1 } })
      if (b.free(cx - 2, mid)) b.fixture('fixture/sacred/altar', cx - 2, mid)
    },
  },
  // the market: shops first, the square's rows lined with stalls, crates by the doors, carts
  market: {
    layout: () => ({ civic: [{ prefab: 'store' }, { prefab: 'shop' }, { prefab: 'shop' }] }),
    build: (b, s) => {
      const mid = Math.floor(b.h / 2)
      for (let x = 4; x < b.w - 4; x += 3) for (const y of [mid - 2, mid + 2]) if (b.free(x, y) && b.get(x, y) !== s.street) b.fixture(rng.chance(0.7) ? 'fixture/furniture/stall' : 'fixture/furniture/stall/trade', x, y)
      b.sprinkle('fixture/container/crate', 0.05, byDoor(b, 2), inner(b))
      b.sprinkle('fixture/furniture/cart', 0.006, (_x, _y, t) => t === 'grass' || t === 'cobble', inner(b))
    },
  },
  // the lamps: teahouses and an inn, a lamp at every few steps of every street
  lamp: {
    layout: () => ({ civic: [{ prefab: 'teahouse' }, { prefab: 'teahouse' }, { prefab: 'inn' }] }),
    build: (b, s) => b.sprinkle('fixture/light/lamppost', 0.07, byStreet(b, s), inner(b)),
  },
  // the lower town: huts close together, dirt lanes, mud, washing lines, barrels at the doors
  lower: {
    layout: () => ({}),
    style: (s) => ({ ...s, street: 'dirt', houses: ['hut_straw', 'cabin', 'house_wood', 'hut_straw'] }),
    build: (b) => {
      b.scatter(2, 2, b.w - 4, b.h - 4, 'mud', 0.2, (c) => c === 'grass')
      b.sprinkle('fixture/furniture/washing_line', 0.02, (_x, _y, t) => t === 'grass' || t === 'mud', inner(b))
      b.sprinkle('fixture/container/barrel', 0.05, byDoor(b, 1), inner(b))
    },
  },
  // the pilgrims' quarter: inns, a camp of tents on the green to the north, a fire to sit round
  pilgrim: {
    layout: () => ({ civic: [{ prefab: 'inn' }, { prefab: 'inn' }], reserve: [[0, 1, 999, 6]] }),
    build: (b) => {
      const cx = Math.floor(b.w / 2)
      for (const x of [4, 9, cx + 5, cx + 10]) building(b, rng.pick(['tent', 'tent_patched']), x, 2)
      b.fixture('fixture/light/campfire', cx - 4, 4)
      b.fixture('fixture/furniture/bench/log', cx - 7, 5)
    },
  },
  // the old wall: the first city's wall, broken, across the north, its stones lying about
  oldwall: {
    layout: () => ({ reserve: [[0, 1, 999, 6]] }),
    build: (b) => {
      for (let x = 2; x < b.w - 2; x++) if (b.get(x, 4) === 'grass' && rng.chance(0.7)) b.set(x, 4, 'wall')
      for (let x = 3; x < b.w - 4; x += rng.int(4, 7)) if (b.get(x, 3) === 'grass' && b.get(x, 2) === 'grass' && b.free(x, 3)) stand(b, 'pillar', x, 3)
      b.sprinkle('fixture/nature/pebbles', 0.08, (_x, y, t) => t === 'grass' && y < 8, inner(b))
      b.sprinkle('fixture/nature/boulder', 0.02, (_x, y, t) => t === 'grass' && y < 8, inner(b))
    },
  },
  // the cloister: a walled garden behind the main street, its chapel and a brothers' house in it, a fountain
  cloister: {
    layout: (b) => ({ reserve: [[1, 1, Math.floor(b.w / 2) - 3, Math.floor(b.h / 2) - 6]] }),
    build: (b) => {
      const [x, y] = [3, 2]
      const w = Math.floor(b.w / 2) - 7
      const h = Math.floor(b.h / 2) - 9
      const gate = x + Math.floor(w / 2)
      b.rect(x + 1, y + 1, w - 2, h - 2, 'grass')
      b.yard(x, y, w, h, 'stonewall', [[gate, y + h - 1]])
      b.set(gate, y + h, 'cobble')
      building(b, 'temple', x + 2, y + 1, 'chapel')
      building(b, 'house_plaster', x + w - 6, y + 1, 'cell')
      b.fixture('fixture/water/fountain', gate - 1, y + h - 4)
      b.sprinkle('fixture/nature/flowers', 0.3, (_x, _y, t) => t === 'grass', [x + 1, y + 1, w - 2, h - 2])
    },
  },
}
/** The Holy City's quarters in the gazetteer's order (holy.quarter-1 … -8: North Gate, Bell Ward, Market, …). */
const QUARTERS = ['gate', 'bell', 'market', 'lamp', 'lower', 'pilgrim', 'oldwall', 'cloister']
/** Another city's theme, by its seed. */
const CITY_THEMES = ['gate', 'market', 'lamp', 'bell', 'lower']
const themeOf = (p: Place): Theme => THEMES[p.id.startsWith('holy.quarter-') ? QUARTERS[Number(p.id.split('-').pop()) - 1] : CITY_THEMES[p.seed % CITY_THEMES.length]]

/** A cave's mouth in a face of rock across the north, and its depths below, dark, with what lives and lies there. */
function cave(b: MapBuilder, p: Place, out: MapBuilder[], veins: number): void {
  const face = 7
  for (let y = 0; y < face; y++) for (let x = 0; x < b.w; x++) b.set(x, y, y < face - 1 || rng.chance(0.6) ? 'cave_wall' : 'rock')
  const mx = Math.floor(b.w / 2) + rng.int(-4, 4)
  b.rect(mx - 1, face - 2, 3, 3, 'cave_floor')
  b.set(mx, face - 2, 'stairs_down')
  clear(b, mx - 3, face + 1, 7, 4, 'gravel')
  b.fixture('fixture/light/brazier', mx - 2, face + 1)
  const below = new MapBuilder(`${p.id}.depths`, { en: `${p.name.en} — Depths`, zh: `${p.name.zh}·深处` } as Text, 'dungeon', 40, 30, 'cave_wall', undefined, 'dark', p.region)
  below.backdrop = true
  // a winding hollow: a walk that carves the rock from the stairs up
  let [x, y] = [20, 26]
  below.rect(19, 22, 3, 5, 'cave_floor')
  for (let step = 0; step < 900; step++) {
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, -1], [0, 1], [0, -1]] as const)
    x = Math.max(2, Math.min(37, x + dx))
    y = Math.max(2, Math.min(26, y + dy))
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) if (below.get(x + ox, y + oy) === 'cave_wall') below.set(x + ox, y + oy, 'cave_floor')
  }
  below.set(20, 26, 'stairs_up')
  b.portal(mx, face - 2, below.id, 20, 25, below.name)
  below.portal(20, 26, b.id, mx, face - 1, b.name)
  // ore in the walls beside the floor, torches, and what lives in the dark
  below.sprinkle(veins > 1 ? 'fixture/nature/vein/iron' : 'fixture/nature/vein/coal', 0.02 * veins, (x, y, t) => t === 'cave_floor' && below.near(x, y, (n) => n === 'cave_wall'))
  below.sprinkle('fixture/light/brazier', 0.004, (_x, _y, t) => t === 'cave_floor')
  below.sprinkle('fixture/remains/bones', 0.006, (_x, _y, t) => t === 'cave_floor')
  for (let k = 0; k < 4; k++)
    for (let tries = 0; tries < 40; tries++) {
      const cx = rng.int(2, 37)
      const cy = rng.int(2, 22)
      if (!below.walkable(cx, cy)) continue
      below.creature(rng.pick(['beast/bat', 'spider', 'undead/skeleton']), cx, cy, { leash: 8 })
      break
    }
  out.push(below)
}

const KINDS: Record<string, Build> = {
  village: (b, _p, s) => settlement(b, s, 2, s.street === 'cobble' ? 'cobble' : 'dirt', { civic: rng.chance(0.5) ? [{ prefab: rng.pick(['smithy', 'shop']) }] : [] }),
  town: (b, p, s) => {
    settlement(b, s, 3, 'cobble', { civic: [{ prefab: 'store' }, { prefab: 'smithy' }, { prefab: rng.pick(['inn', 'teahouse']) }] })
    const mid = Math.floor(b.h / 2)
    b.fixture('fixture/furniture/stall', Math.floor(b.w / 2) - 5, mid + 1)
    b.fixture('fixture/furniture/stall', Math.floor(b.w / 2) + 5, mid + 1)
    b.fixture(shrineOf(p.region), Math.floor(b.w / 2), mid - 1)
    banner(b, p.region, Math.floor(b.w / 2) - 4, mid - 2)
    banner(b, p.region, Math.floor(b.w / 2) + 4, mid - 2)
  },
  city: (b, p, s) => {
    const theme = themeOf(p)
    const style = theme.style?.({ ...s, street: 'cobble' }) ?? { ...s, street: 'cobble' }
    settlement(b, style, 4, 'cobble', theme.layout(b))
    b.fixture('fixture/water/fountain', Math.floor(b.w / 2) - 1, Math.floor(b.h / 2) - 1)
    b.fixture(shrineOf(p.region), Math.floor(b.w / 2) + 2, Math.floor(b.h / 2) - 2)
    b.sprinkle(s.lamp, 0.012, (_x, _y, t) => t === 'cobble')
    banner(b, p.region, Math.floor(b.w / 2) - 4, Math.floor(b.h / 2) - 2)
    banner(b, p.region, Math.floor(b.w / 2) + 5, Math.floor(b.h / 2) - 2)
    theme.build?.(b, style)
  },
  farm: (b, _p, s) => {
    clear(b, 4, 4, b.w - 8, b.h - 8, 'grass')
    const door = building(b, rng.pick(low(s)), 8, 7, 'farmhouse')
    b.road(door[0], door[1] + 1, door[0], Math.floor(b.h / 2), s.street === 'cobble' ? 'path' : s.street)
    b.path([[0, Math.floor(b.h / 2)], [b.w - 1, Math.floor(b.h / 2)]], 'path', 2)
    const fx = 18
    const fy = 5
    b.rect(fx, fy, 14, 8, 'farmland')
    b.yard(fx - 1, fy - 1, 16, 10, 'rail', [[fx + 6, fy + 8]])
    b.fixture('fixture/nature/haystack', 9, 18)
    b.fixture('fixture/nature/haystack', 11, 19)
    b.yard(20, 17, 10, 7, 'rail', [[24, 17]])
    b.creature('animal/cow', 23, 20, { temper: 'wary', behaviour: 'melee' })
    b.creature('animal/chicken', 26, 21, { temper: 'wary', behaviour: 'melee' })
  },
  mill: (b, _p, s) => {
    clear(b, 4, 4, b.w - 8, b.h - 8, 'grass')
    b.path([[0, Math.floor(b.h / 2)], [b.w - 1, Math.floor(b.h / 2)]], 'path', 2)
    const door = building(b, rng.pick(low(s)), 16, 8, 'mill')
    b.road(door[0], door[1] + 1, door[0], Math.floor(b.h / 2), 'path')
    b.rect(6, 18, 10, 6, 'farmland')
    b.rect(24, 18, 10, 6, 'farmland')
    b.fixture('fixture/nature/logpile', 21, 9)
    b.fixture('fixture/container/sack', 15, 11)
    b.fixture('fixture/container/sack', 22, 11)
  },
  camp: (b) => {
    clear(b, 7, 5, b.w - 14, b.h - 9, 'dirt')
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2)
    b.fixture('fixture/light/campfire', cx, cy + 2)
    for (const [dx, dy] of [[-7, -4], [3, -4], [-7, 3], [4, 3]]) building(b, rng.pick(['tent', 'tent_patched', 'tent_torn']), cx + dx, cy + dy)
    b.fixture('fixture/furniture/bench/log', cx - 2, cy + 2)
    b.fixture('fixture/furniture/bench/log', cx + 2, cy + 2)
    b.fixture('fixture/container/crate', cx + 1, cy - 1)
  },
  ruin: (b, p, s) => {
    ruins(b, s.wall === 'woodwall' ? 'wall' : s.wall, 5)
    haunt(b, p, 2)
    b.fixture('fixture/container/chest', Math.floor(b.w / 2) + rng.int(-8, 8), Math.floor(b.h / 2) + rng.int(-6, 6), {}, [rng.pick(['item/material/coal', 'item/material/stone', 'item/material/herb', 'item/tool/rope'])])
  },
  shrine: (b, p) => {
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2) - 3
    clear(b, cx - 5, cy - 3, 11, 9, 'grass')
    b.rect(cx - 3, cy - 2, 7, 5, 'cobble')
    b.path([[cx, cy + 3], [cx, b.h - 1]], 'path', 1)
    b.fixture(shrineOf(p.region), cx, cy)
    b.fixture('fixture/light/candles', cx - 2, cy + 1)
    b.fixture('fixture/light/candles', cx + 2, cy + 1)
    b.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => t === 'grass' && Math.hypot(x - cx, y - cy) < 6)
  },
  cave: (b, p, _s, out) => (cave(b, p, out, 1), haunt(b, p, 1)),
  mine: (b, p, _s, out) => {
    cave(b, p, out, 2)
    b.fixture('fixture/nature/logpile', Math.floor(b.w / 2) + 4, 9)
    b.fixture('fixture/furniture/cart', Math.floor(b.w / 2) - 5, 9)
  },
  tower: (b, p, s) => {
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2) - 4
    clear(b, cx - 6, cy - 4, 13, 12, 'gravel')
    const door = hall(b, cx - 2, cy - 2, 5, 5, s.wall === 'woodwall' ? 'wall' : s.wall, 'floor_stone')
    b.path([[door[0], door[1] + 1], [door[0], b.h - 1]], 'path', 1)
    b.fixture('fixture/light/brazier', door[0] - 2, door[1] + 1)
    b.fixture('fixture/light/brazier', door[0] + 2, door[1] + 1)
    haunt(b, p, 1)
  },
  graveyard: (b, p) => {
    const x = Math.floor(b.w / 2) - 9
    const y = Math.floor(b.h / 2) - 6
    clear(b, x - 1, y - 1, 20, 14, 'grass')
    b.yard(x, y, 18, 12, 'stonewall', [[x + 9, y + 11]])
    for (let j = y + 2; j < y + 10; j += 2) for (let i = x + 2; i < x + 16; i += 3) if (rng.chance(0.85)) b.fixture('fixture/sacred/gravestone', i, j)
    b.sprinkle('fixture/nature/dead_tree', 0.015, (_x, _y, t) => t === 'grass' || t === 'drygrass' || t === 'mud')
    haunt(b, p, 2)
  },
  // a walled yard: watchtowers in its corners, a gatehouse (an arch between two stone posts, the region's banners) in
  // its south wall, the keep, the barracks either side of the way in, the drill yard's dummies, a well
  fort: (b, p, s) => {
    const x = 6
    const y = 4
    const w = b.w - 12
    const h = b.h - 9
    const gx = x + Math.floor(w / 2)
    const wallRow = y + h - 1
    clear(b, x - 1, y - 1, w + 2, h + 2, 'dirt')
    const keep = hall(b, gx - 5, y + 2, 11, 7, 'wall', 'floor_stone')
    b.path([[keep[0], keep[1] + 1], [keep[0], b.h - 1]], 'path', 1)
    b.yard(x, y, w, h, 'stonewall', [-2, -1, 0, 1, 2].map((d): Cell => [gx + d, wallRow]))
    for (const tx of [x + 1, x + w - 4]) for (const ty of [y + 5, wallRow - 1]) stand(b, 'watchtower', tx, ty)
    b.scenery('arch', gx - 1, wallRow - 2)
    stand(b, 'pillar', gx - 2, wallRow)
    stand(b, 'pillar', gx + 2, wallRow)
    building(b, rng.pick(low(s)), x + 6, y + h - 7, 'barracks')
    building(b, rng.pick(low(s)), x + w - 11, y + h - 7, 'barracks')
    b.fixture('fixture/dummy', x + 6, y + 4)
    b.fixture('fixture/dummy', x + 8, y + 4)
    b.fixture('fixture/furniture/rack', x + w - 7, y + 4)
    b.fixture('fixture/water/well', x + w - 8, y + 10)
    b.fixture('fixture/light/brazier', keep[0] - 2, keep[1] + 1)
    b.fixture('fixture/light/brazier', keep[0] + 2, keep[1] + 1)
    b.fixture('fixture/light/brazier', gx - 3, wallRow + 1)
    b.fixture('fixture/light/brazier', gx + 3, wallRow + 1)
    banner(b, p.region, keep[0] - 3, keep[1] + 1)
    banner(b, p.region, keep[0] + 3, keep[1] + 1)
    banner(b, p.region, gx - 3, wallRow - 1)
    banner(b, p.region, gx + 3, wallRow - 1)
  },
  battlefield: (b, p) => {
    for (let k = 0; k < 7; k++) b.organic(rng.int(6, b.w - 6), rng.int(5, b.h - 5), rng.int(3, 6), rng.int(2, 4), rng.chance(0.5) ? 'ash' : 'dirt', { only: (t) => !SOLID.has(t) })
    b.sprinkle('fixture/remains/body', 0.008, (_x, _y, t) => t === 'ash' || t === 'dirt')
    b.sprinkle('fixture/remains/bones', 0.015, (_x, _y, t) => !SOLID.has(t))
    b.sprinkle('fixture/nature/dead_tree', 0.006, (_x, _y, t) => t === 'grass' || t === 'drygrass' || t === 'dirt')
    haunt(b, p, 4)
  },
  cathedral: (b, p) => {
    const cx = Math.floor(b.w / 2)
    clear(b, cx - 11, 3, 22, b.h - 6, 'grass')
    const door = hall(b, cx - 6, 4, 13, 9, 'wall', 'floor_stone')
    b.fixture('fixture/sacred/altar', cx, 6)
    b.fixture('fixture/light/candles', cx - 2, 6)
    b.fixture('fixture/light/candles', cx + 2, 6)
    b.rect(cx - 4, door[1] + 1, 9, 5, 'cobble')
    b.path([[cx, door[1] + 6], [cx, b.h - 1]], 'path', 2)
    b.fixture('fixture/sacred/statue', cx - 3, door[1] + 3)
    b.fixture('fixture/sacred/statue', cx + 3, door[1] + 3)
    b.fixture(shrineOf(p.region), cx, door[1] + 4)
    building(b, 'house_plaster', cx - 10, door[1] + 2, 'cell')
    building(b, 'house_plaster', cx + 7, door[1] + 2, 'cell')
    for (let i = cx - 9; i <= cx + 9; i += 3) b.fixture('fixture/sacred/gravestone', i, b.h - 5)
  },
  seat: (b, p) => {
    const cx = Math.floor(b.w / 2)
    clear(b, cx - 9, 4, 18, b.h - 8, 'cobble')
    hall(b, cx - 5, 5, 11, 8, 'wall', 'floor_stone')
    b.fixture('fixture/sacred/statue', cx - 4, 15)
    b.fixture('fixture/sacred/statue', cx + 4, 15)
    b.fixture(shrineOf(p.region), cx, 16)
    b.fixture('fixture/light/brazier', cx - 2, 14)
    b.fixture('fixture/light/brazier', cx + 2, 14)
  },
}

/** Every backdrop map of the continent: its places', the rooms behind their doors, and the depths under its caves and mines. */
export function buildBackdrop(c: Continent): RawChunk[] {
  const ground = (x: number, y: number) => TERRAIN_CHARS[c.rows[y][x]] ?? 'ow_plain'
  return c.places.flatMap((p) => placeMaps(p, ground(p.x, p.y)).map((b) => b.chunk()))
}

/** A backdrop map's line in the world's index. */
export const backdropMeta = (c: RawChunk): MapMeta => ({
  id: c.map.id,
  name: c.map.name,
  kind: c.map.kind,
  region: c.map.region,
  width: c.map.width,
  height: c.map.height,
  portals: c.map.portals,
  npcs: 0,
  items: c.entities.filter((e) => e.type.startsWith('item/')).length,
  backdrop: true,
})
