// The continent (docs/continent.md): the world map grown from the Frostfang Coast to a continent of six regions —
// the five seals' round the Holy City — with its grounds, rivers, roads and named places (the gazetteer). It is
// made once, from a seed and the hand-made places' cells, and kept as data (continent.json): the world is built
// from that file, so a place keeps its cell and its id however the generator changes, and an author may edit it.
//
//   npm run continent      (main.ts; after a hand-made place moves: the Ford's maps decide their own cells)
//
// The Frostfang Coast's west bank stays the pocket it always was (world-model.md D22): sea to its north and west,
// a mountain range north of the Ford and the river south of it running sea to sea, so the Ford is the only way
// across. Everything else is new: one continent, every passable cell reachable from the far bank.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Rng } from '@openworld/engine'
import { CHAR_OF, REGIONS, TERRAINS, TERRAIN_CHARS } from '@openworld-game/content'
import { Namer, placeId, type Name } from './names.ts'

export const CONTINENT_FILE = fileURLToPath(new URL('./continent.json', import.meta.url))

/** Cells across and down the world map. */
export const WIDTH = 64
export const HEIGHT = 48
/** The Ford's cell: where the Frostfang Coast's hand-made places are laid out from (overworld.ts FORD_CELL). */
export const FORD = { x: 7, y: 5 }

/** A named place of the backdrop (docs/continent.md §3): what the gazetteer holds of it. */
export interface Place {
  /** Its id, and its map's: `<region>.<name>`. */
  id: string
  name: Name
  region: string
  /** What it is (its map's template, its site's icon): village, town, city, fort, cave … */
  kind: string
  x: number
  y: number
  /** Its map's own randomness. */
  seed: number
  /** The region's chief place. */
  capital?: true
  /** Its tale is not told yet: the world map shows it, the way in is shut (content UNTOLD). */
  sealed?: true
}

/** The continent as it is kept: its grounds a character a cell (the map format's), its regions a character a cell. */
export interface Continent {
  seed: number
  width: number
  height: number
  rows: string[]
  /** One character a cell: the region it belongs to (`keys`), a space where it is sea. */
  regions: string[]
  keys: Record<string, string>
  places: Place[]
}

const KEYS: Record<string, string> = { f: 'frostfang', r: 'redmarch', t: 'tithe', p: 'palefen', a: 'altar', h: 'holy' }
const KEY_OF: Record<string, string> = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [v, k]))

/** Where each region's heart lies, and how far it reaches (a weight on the distance to it). */
const SEEDS: Record<string, { x: number; y: number; w: number }> = {
  frostfang: { x: 12, y: 6, w: 0.75 },
  redmarch: { x: 36, y: 8, w: 1 },
  tithe: { x: 53, y: 24, w: 1.05 },
  palefen: { x: 38, y: 40, w: 1.05 },
  altar: { x: 12, y: 33, w: 1.05 },
  holy: { x: 31, y: 23, w: 0.85 },
}

/** How many of each kind of place each region holds, beside its capital and its seat. */
const QUOTA: Record<string, Record<string, number>> = {
  frostfang: { village: 4, farm: 3, camp: 2, ruin: 3, shrine: 2, cave: 3, tower: 2, mill: 1, graveyard: 1, mine: 1 },
  redmarch: { fort: 5, battlefield: 4, village: 6, town: 2, camp: 4, ruin: 4, tower: 3, cave: 3, shrine: 2, mine: 3, farm: 2 },
  tithe: { town: 4, village: 7, farm: 7, mill: 4, ruin: 3, shrine: 2, camp: 3, cave: 2, graveyard: 2, tower: 1 },
  palefen: { village: 6, town: 1, graveyard: 6, ruin: 5, shrine: 3, camp: 2, cave: 3, tower: 2, mill: 1 },
  altar: { cathedral: 4, shrine: 6, village: 5, town: 1, ruin: 4, cave: 4, tower: 3, camp: 2, farm: 2, mine: 2 },
  holy: { village: 5, farm: 5, shrine: 3, camp: 3, ruin: 2, mill: 2, cathedral: 1, town: 1 },
}

/** Each region's chief place and its Seal-bearer's seat (the Holy City's are its quarters and the Most Holy Hall). */
const CAPITALS: Record<string, { kind: string; name: Name }> = {
  redmarch: { kind: 'city', name: { en: 'Crimsonhold', zh: '赤堡城' } },
  tithe: { kind: 'city', name: { en: 'Weighmarket', zh: '秤市城' } },
  palefen: { kind: 'town', name: { en: 'Dusk Moorings', zh: '暮泊镇' } },
  altar: { kind: 'city', name: { en: 'Candlecrest', zh: '烛岭城' } },
}
const SEATS: Record<string, Name> = {
  redmarch: { en: "The War-Giver's Bastion", zh: '赐战者堡垒' },
  tithe: { en: 'The Black Balance', zh: '黑衡圣堂' },
  palefen: { en: "The Pale Rider's Ossuary", zh: '执辔者骨堂' },
  altar: { en: 'The Altar Beneath', zh: '祭坛之下' },
}
const HALL: Name = { en: 'The Most Holy Hall', zh: '至圣大殿' }
/** The Holy City's quarters, round the Hall (north first, then clockwise). */
const QUARTERS: Name[] = [
  { en: 'Holy City — North Gate', zh: '圣城·北门区' },
  { en: 'Holy City — Bell Ward', zh: '圣城·钟楼区' },
  { en: 'Holy City — Market', zh: '圣城·市集区' },
  { en: 'Holy City — Lamp Ward', zh: '圣城·灯区' },
  { en: 'Holy City — Lower Town', zh: '圣城·下城区' },
  { en: "Holy City — Pilgrims' Quarter", zh: '圣城·朝圣者区' },
  { en: 'Holy City — Old Wall', zh: '圣城·旧墙区' },
  { en: 'Holy City — Cloister', zh: '圣城·修院区' },
]
const AROUND: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

// ---------------------------------------------------------------- noise

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 1, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function smooth(x: number, y: number, scale: number, salt: number): number {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const s = (t: number) => t * t * (3 - 2 * t)
  const a = hash(x0, y0, salt) + (hash(x0 + 1, y0, salt) - hash(x0, y0, salt)) * s(tx)
  const b = hash(x0, y0 + 1, salt) + (hash(x0 + 1, y0 + 1, salt) - hash(x0, y0 + 1, salt)) * s(tx)
  return a + (b - a) * s(ty)
}
/** Three octaves of value noise, in [0, 1). */
function fbm(x: number, y: number, salt: number): number {
  return 0.55 * smooth(x, y, 11, salt) + 0.3 * smooth(x, y, 5, salt + 17) + 0.15 * smooth(x, y, 2.5, salt + 31)
}

// ---------------------------------------------------------------- the barrier the Ford crosses

/** The west bank: the cells behind the Ford's barrier (the Frostfang Coast's first places). */
export const inPocket = (x: number, y: number): boolean => (x >= 1 && x <= FORD.x - 1 && y >= 1 && y <= FORD.y + 5) || (x === FORD.x && y >= 1 && y < FORD.y)
/** The barrier itself: the range north of the Ford, the river south of it and along the pocket's south shore to the sea. */
export function barrierAt(x: number, y: number): string | undefined {
  if (x === FORD.x + 1 && y >= 1 && y < FORD.y) return 'ow_mountain'
  if (x === FORD.x && y > FORD.y && y <= FORD.y + 6) return 'ow_river'
  if (y === FORD.y + 6 && x >= 1 && x < FORD.x) return 'ow_river'
  return undefined
}

/**
 * The west bank as drawn by hand (release 1, docs/release-1.md): a narrow valley rather than a field of filler. Peaks
 * close the north and west, snow above Cloudtop; a bay takes the south-west; what is left to walk between the
 * hand-made places is a few cells each with a reason to be there — the high snow over Cloudtop, Dawn Hill's crag,
 * Millbrook's fields, the wayside between the mill, the grassland and the dell, the Westwood behind the dell and the
 * hollow, the river meadow below the barrow. A character a cell (the map format's), x from 0 and y from 0; the
 * hand-made places' own cells are theirs (`fixed`), whatever is drawn under them.
 */
export const POCKET = [
  '00000000',
  '04444444',
  '04444445',
  '04444431',
  '04444111',
  '04441111',
  '04442111',
  '00442111',
  '00002211',
  '00000211',
  '00000011',
]

// ---------------------------------------------------------------- the generator

const SOLID = new Set(['ow_sea', 'ow_mountain', 'ow_river'])
const COST: Record<string, number> = {
  ow_road: 0.4, ow_city: 0.4, ow_bridge: 0.5, ow_plain: 1, ow_steppe: 1, ow_fields: 1, ow_salt: 1, ow_forest: 1.6, ow_hills: 1.6, ow_highland: 1.6, ow_badlands: 1.6, ow_dust: 1.6,
  ow_deadwood: 1.6, ow_snow: 1.8, ow_marsh: 2.2, ow_river: 6, ow_mountain: 14,
}

/**
 * The continent for `seed`, around the hand-made places (`fixed`: a cell's "x,y" → its ground; the Ford's own cell
 * the river's). Deterministic: the same seed and places give the same continent.
 */
export function generateContinent(seed: number, fixed: Map<string, string>, east: [number, number]): Continent {
  const rng = new Rng(seed)
  const W = WIDTH
  const H = HEIGHT
  const at = (x: number, y: number) => y * W + x
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const key = (x: number, y: number) => `${x},${y}`
  const salt = (seed % 1000) * 7

  // the land: a rounded block of continent, its coast worn by noise; the west bank's pocket always land
  const land = new Array<boolean>(W * H).fill(false)
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const dx = Math.abs(x + 0.5 - W / 2) / (W / 2 - 1.5)
      const dy = Math.abs(y + 0.5 - H / 2) / (H / 2 - 1.5)
      const d = Math.pow(Math.pow(dx, 3.2) + Math.pow(dy, 3.2), 1 / 3.2)
      // (and the Frostfang Coast east of the Ford one shore: no bay between its places)
      const east = x > FORD.x && x <= FORD.x + 10 && y >= 2 && y <= FORD.y + 4
      land[at(x, y)] = inPocket(x, y) || east || fixed.has(key(x, y)) || barrierAt(x, y) !== undefined || d + (fbm(x, y, salt + 5) - 0.5) * 0.32 < 0.97
    }
  // the sea beyond the barrier's ends: the range meets the north coast, the river the west one
  for (let x = 0; x <= FORD.x + 1; x++) land[at(x, 0)] = false
  for (let y = 0; y <= FORD.y + 6; y++) land[at(0, y)] = false

  // the regions: the nearest heart, as each reaches, the borders worn by noise; the west bank and every hand-made
  // place the Frostfang Coast's
  const region = new Array<string>(W * H).fill('')
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!land[at(x, y)]) continue
      if (inPocket(x, y) || fixed.has(key(x, y)) || barrierAt(x, y)) {
        region[at(x, y)] = 'frostfang'
        continue
      }
      const wx = x + (fbm(x, y, salt + 9) - 0.5) * 14
      const wy = y + (fbm(x, y, salt + 13) - 0.5) * 14
      let best = ''
      let bd = Infinity
      for (const [id, s] of Object.entries(SEEDS)) {
        const d = Math.hypot(wx - s.x, wy - s.y) / s.w
        if (d < bd) (bd = d), (best = id)
      }
      region[at(x, y)] = best
    }
  // the Frostfang Coast keeps to the north-west: nothing of it beyond the range of the pass
  for (let i = 0; i < W * H; i++) {
    const [x, y] = [i % W, Math.floor(i / W)]
    if (region[i] === 'frostfang' && x > 14 + Math.round(smooth(x, y, 3, salt + 21) * 10) && !fixed.has(key(x, y))) region[i] = 'redmarch'
  }

  // height and wetness, as ranks within each region (so a share of every region is high ground, whatever the noise drew)
  const rank = (f: (x: number, y: number) => number) => {
    const out = new Array<number>(W * H).fill(0)
    for (const r of Object.keys(SEEDS)) {
      const cells: [number, number][] = []
      for (let i = 0; i < W * H; i++) if (land[i] && region[i] === r) cells.push([i, f(i % W, Math.floor(i / W))])
      cells.sort((a, b) => a[1] - b[1])
      cells.forEach(([i], n) => (out[i] = n / cells.length))
    }
    return out
  }
  const elev = rank((x, y) => fbm(x, y, salt + 1))
  const wet = rank((x, y) => fbm(x, y, salt + 2))

  // the grounds, by region, height and wetness
  const holy = SEEDS.holy
  const ground = new Array<string>(W * H).fill('ow_sea')
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y)
      if (!land[i]) continue
      const e = elev[i]
      const m = wet[i]
      const r = region[i]
      let g = 'ow_plain'
      if (r === 'frostfang') {
        if (inPocket(x, y)) g = TERRAIN_CHARS[POCKET[y][x]]
        else if (e > 0.86) g = 'ow_mountain'
        else if (y <= 3 + Math.round((fbm(x, y, salt + 3) - 0.5) * 4)) g = 'ow_snow'
        else g = e > 0.68 ? 'ow_hills' : m > 0.58 ? 'ow_forest' : 'ow_plain'
      } else if (r === 'redmarch') g = e > 0.9 ? 'ow_mountain' : e > 0.6 ? 'ow_badlands' : m > 0.8 ? 'ow_hills' : m < 0.2 ? 'ow_plain' : 'ow_steppe'
      else if (r === 'tithe') g = e > 0.92 ? 'ow_hills' : m < 0.18 ? 'ow_dust' : m < 0.32 ? 'ow_salt' : m > 0.82 ? 'ow_plain' : 'ow_fields'
      else if (r === 'palefen') g = m > 0.9 ? 'ow_sea' : m > 0.55 ? 'ow_marsh' : m > 0.3 ? 'ow_deadwood' : e > 0.88 ? 'ow_hills' : m > 0.18 ? 'ow_forest' : 'ow_plain'
      else if (r === 'altar') g = e > 0.88 ? 'ow_mountain' : e > 0.42 ? 'ow_highland' : m > 0.7 ? 'ow_forest' : 'ow_plain'
      else if (r === 'holy') g = Math.hypot(x - holy.x, y - holy.y) < 2.3 ? 'ow_city' : m > 0.72 ? 'ow_forest' : m < 0.3 ? 'ow_fields' : 'ow_plain'
      // ridges along the borders between the seals' lands
      if (g !== 'ow_sea' && g !== 'ow_city' && r !== 'holy' && !inPocket(x, y) && e > 0.7 && AROUND.some(([dx, dy]) => inside(x + dx, y + dy) && region[at(x + dx, y + dy)] && region[at(x + dx, y + dy)] !== r && region[at(x + dx, y + dy)] !== 'holy')) g = 'ow_mountain'
      ground[i] = g
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = barrierAt(x, y)
      if (b) ground[at(x, y)] = b
    }
  for (const [k, g] of fixed) {
    const [x, y] = k.split(',').map(Number)
    ground[at(x, y)] = g
  }
  const near = (x: number, y: number, r: number, pred: (x: number, y: number) => boolean) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (inside(x + i, y + j) && pred(x + i, y + j)) return true
    return false
  }
  const guarded = (x: number, y: number) => inPocket(x, y) || barrierAt(x, y) !== undefined || near(x, y, 1, (a, b) => fixed.has(key(a, b)))

  // rivers: from the heights down to the sea (or a lake where they can go no lower)
  for (let n = 0; n < 8; n++) {
    let start: [number, number] | undefined
    for (let tries = 0; tries < 200 && !start; tries++) {
      const x = rng.int(2, W - 3)
      const y = rng.int(2, H - 3)
      const i = at(x, y)
      if (land[i] && elev[i] > 0.75 && ground[i] !== 'ow_mountain' && !guarded(x, y) && region[i] !== 'holy') start = [x, y]
    }
    if (!start) continue
    let [x, y] = start
    const seen = new Set<string>()
    for (let step = 0; step < 70; step++) {
      seen.add(key(x, y))
      ground[at(x, y)] = 'ow_river'
      const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
        .filter(([a, b]) => inside(a, b) && !seen.has(key(a, b)) && !guarded(a, b))
        .sort((a, b) => elev[at(a[0], a[1])] + rng.next() * 0.08 - (elev[at(b[0], b[1])] + rng.next() * 0.08))[0]
      if (!next) break
      const g = ground[at(next[0], next[1])]
      if (g === 'ow_sea' || g === 'ow_river') break
      if (elev[at(next[0], next[1])] > elev[at(x, y)] + 0.02 && step > 4) {
        ground[at(next[0], next[1])] = 'ow_sea'
        break
      }
      ;[x, y] = next
    }
  }

  // the Holy City: the Most Holy Hall and its quarters round it, on the city's ground
  const hall = { x: holy.x, y: holy.y }
  for (const [dx, dy] of [[0, 0], ...AROUND]) ground[at(hall.x + dx, hall.y + dy)] = 'ow_city'

  // the places: each region's capital near its heart, its seat at its far edge, then its quota by what suits the ground
  const places: Place[] = []
  const taken = new Set<string>()
  const namer = new Namer(rng)
  const add = (p: Omit<Place, 'id' | 'seed'>, id?: string) => {
    const place: Place = { id: id ?? placeId(p.region, p.name), ...p, seed: rng.int(1, 2 ** 30) }
    places.push(place)
    taken.add(key(p.x, p.y))
    namer.take(p.name)
    return place
  }
  const free = (x: number, y: number) => {
    const i = at(x, y)
    return land[i] && !SOLID.has(ground[i]) && !inPocket(x, y) && !fixed.has(key(x, y)) && !near(x, y, 1, (a, b) => taken.has(key(a, b)) || fixed.has(key(a, b)))
  }
  const cellsOf = (r: string) => {
    const out: [number, number][] = []
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (region[at(x, y)] === r && free(x, y)) out.push([x, y])
    return out
  }
  const nextTo = (x: number, y: number, g: string) => AROUND.some(([dx, dy]) => inside(x + dx, y + dy) && ground[at(x + dx, y + dy)] === g)
  const suits = (kind: string, x: number, y: number): number => {
    const g = ground[at(x, y)]
    const by = (list: string[], w = 1) => (list.includes(g) ? w : 0)
    switch (kind) {
      case 'fort': return by(['ow_hills', 'ow_badlands'], 1.5) + by(['ow_steppe'], 0.6) + (AROUND.some(([dx, dy]) => inside(x + dx, y + dy) && region[at(x + dx, y + dy)] !== region[at(x, y)]) ? 1 : 0)
      case 'battlefield': return by(['ow_steppe', 'ow_badlands', 'ow_plain', 'ow_fields'], 1.2)
      case 'tower': return by(['ow_hills', 'ow_highland', 'ow_badlands'], 1) + (nextTo(x, y, 'ow_mountain') ? 1 : 0)
      case 'cave':
      case 'mine': return (nextTo(x, y, 'ow_mountain') ? 2 : 0) + by(['ow_hills', 'ow_highland', 'ow_badlands'], 0.8)
      case 'graveyard': return by(['ow_marsh', 'ow_deadwood'], 1.4) + by(['ow_plain', 'ow_forest'], 0.4)
      case 'farm':
      case 'mill': return by(['ow_fields', 'ow_plain', 'ow_steppe'], 1.4) + (nextTo(x, y, 'ow_river') ? 0.6 : 0)
      case 'village':
      case 'town': return by(['ow_plain', 'ow_fields', 'ow_steppe', 'ow_highland'], 1) + by(['ow_forest', 'ow_deadwood', 'ow_marsh'], 0.3) + (nextTo(x, y, 'ow_river') || nextTo(x, y, 'ow_sea') ? 0.8 : 0)
      case 'shrine':
      case 'cathedral': return by(['ow_highland', 'ow_hills', 'ow_plain'], 1)
      default: return 0.5
    }
  }
  const place = (region: string, kind: string, score: (x: number, y: number) => number) => {
    let best: [number, number] | undefined
    let bs = -Infinity
    for (const [x, y] of cellsOf(region)) {
      const s = score(x, y) + rng.next() * 1.2
      if (s > bs) (bs = s), (best = [x, y])
    }
    return best
  }
  // the Holy City first: its Hall (sealed) and its quarters
  add({ name: HALL, region: 'holy', kind: 'cathedral', x: hall.x, y: hall.y, sealed: true, capital: true }, 'holy.hall')
  AROUND.forEach(([dx, dy], n) => add({ name: QUARTERS[n], region: 'holy', kind: 'city', x: hall.x + dx, y: hall.y + dy }, `holy.quarter-${n + 1}`))
  for (const r of REGIONS) {
    const heart = SEEDS[r.id]
    const cap = CAPITALS[r.id]
    if (cap) {
      const c = place(r.id, cap.kind, (x, y) => suits('town', x, y) - Math.hypot(x - heart.x, y - heart.y) * 0.5)
      if (c) add({ name: cap.name, region: r.id, kind: cap.kind, x: c[0], y: c[1], capital: true })
    }
    const seat = SEATS[r.id]
    if (seat) {
      const c = place(r.id, 'seat', (x, y) => Math.hypot(x - holy.x, y - holy.y) * 0.25 + (nextTo(x, y, 'ow_mountain') ? 1.5 : 0))
      if (c) add({ name: seat, region: r.id, kind: 'seat', x: c[0], y: c[1], sealed: true })
    }
    for (const [kind, n] of Object.entries(QUOTA[r.id] ?? {}))
      for (let k = 0; k < n; k++) {
        const c = place(r.id, kind, (x, y) => suits(kind, x, y))
        if (!c) break
        add({ name: namer.name(r.id, kind), region: r.id, kind, x: c[0], y: c[1] })
      }
  }
  const placeAt = new Map(places.map((p) => [key(p.x, p.y), p]))

  // roads: the pilgrims' ring through the capitals from the pass east of Emberfall, a road from each into the Holy
  // City, and within each region a tree of roads joining its settlements to its capital
  const pass = east
  const route = (from: [number, number], to: [number, number], carve: boolean): [number, number][] | undefined => {
    // A* over the world map's cost (rivers bridged, mountains passed where nothing else will do)
    const cost = (x: number, y: number) => {
      const i = at(x, y)
      if (!land[i] || inPocket(x, y) || barrierAt(x, y)) return Infinity
      if (fixed.has(key(x, y))) return fixed.get(key(x, y)) === 'ow_river' ? Infinity : 1
      if (placeAt.has(key(x, y))) return 1
      const g = ground[i]
      if (g === 'ow_sea') return Infinity
      if (g === 'ow_mountain' && !carve) return 30
      return COST[g] ?? 1
    }
    const start = at(from[0], from[1])
    const goal = at(to[0], to[1])
    const g = new Map<number, number>([[start, 0]])
    const prev = new Map<number, number>()
    const open: [number, number][] = [[start, 0]]
    while (open.length) {
      let bi = 0
      for (let j = 1; j < open.length; j++) if (open[j][1] < open[bi][1]) bi = j
      const [cur] = open.splice(bi, 1)[0]
      if (cur === goal) break
      const cx = cur % W
      const cy = Math.floor(cur / W)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (!inside(nx, ny)) continue
        const c = cost(nx, ny)
        if (!Number.isFinite(c)) continue
        const n = at(nx, ny)
        const ng = g.get(cur)! + c
        if (ng < (g.get(n) ?? Infinity)) {
          g.set(n, ng)
          prev.set(n, cur)
          open.push([n, ng + Math.abs(nx - to[0]) + Math.abs(ny - to[1]) * 0.4])
        }
      }
    }
    if (!g.has(goal)) return undefined
    const out: [number, number][] = []
    for (let c: number | undefined = goal; c !== undefined; c = prev.get(c)) out.unshift([c % W, Math.floor(c / W)])
    return out
  }
  const pave = (path: [number, number][] | undefined, road: boolean) => {
    for (const [x, y] of path ?? []) {
      const k = key(x, y)
      if (fixed.has(k) || placeAt.has(k)) continue
      const i = at(x, y)
      if (ground[i] === 'ow_river') ground[i] = 'ow_bridge'
      else if (ground[i] === 'ow_mountain') ground[i] = road ? 'ow_road' : 'ow_hills'
      else if (road && ground[i] !== 'ow_city') ground[i] = 'ow_road'
    }
  }
  const capitals = REGIONS.map((r) => places.find((p) => p.region === r.id && p.capital && r.id !== 'holy')).filter((p): p is Place => !!p)
  const ring: [number, number][] = [pass, ...capitals.map((p) => [p.x, p.y] as [number, number])]
  for (let n = 1; n < ring.length; n++) pave(route(ring[n - 1], ring[n], false), true)
  // the last capital back to the Frostfang Coast's far bank (south of the Ford): the ring closed
  const bank: [number, number] = [FORD.x + 1, FORD.y + 2]
  if (capitals.length) pave(route([capitals[capitals.length - 1].x, capitals[capitals.length - 1].y], bank, false), true)
  for (const c of capitals) pave(route([c.x, c.y], [hall.x + Math.sign(c.x - hall.x) * 1, hall.y + Math.sign(c.y - hall.y) * 1], false), true)
  for (const r of REGIONS) {
    if (r.id === 'holy') continue
    const hub = places.find((p) => p.region === r.id && p.capital) ?? (r.id === 'frostfang' ? { x: pass[0], y: pass[1] } : undefined)
    if (!hub) continue
    const towns = places.filter((p) => p.region === r.id && ['town', 'village', 'fort', 'cathedral', 'city'].includes(p.kind) && !p.capital)
    // a tree (Prim's, by distance): each settlement joined to the nearest already joined
    const joined: { x: number; y: number }[] = [hub]
    const left = [...towns]
    while (left.length) {
      let bi = 0
      let bj = 0
      let bd = Infinity
      left.forEach((t, i) => joined.forEach((j, n) => {
        const d = Math.hypot(t.x - j.x, t.y - j.y)
        if (d < bd) (bd = d), (bi = i), (bj = n)
      }))
      const t = left.splice(bi, 1)[0]
      pave(route([joined[bj].x, joined[bj].y], [t.x, t.y], false), true)
      joined.push(t)
    }
  }

  // every passable cell of the mainland reachable from the far bank: what is cut off gets a pass or a bridge
  const passable = (x: number, y: number) => land[at(x, y)] && !SOLID.has(ground[at(x, y)]) && !inPocket(x, y) && !(fixed.get(key(x, y)) === 'ow_river')
  const flood = (from: [number, number], ok: (x: number, y: number) => boolean) => {
    const seen = new Set<number>([at(from[0], from[1])])
    const queue = [from]
    while (queue.length) {
      const [cx, cy] = queue.pop()!
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (!inside(nx, ny) || seen.has(at(nx, ny)) || !ok(nx, ny)) continue
        seen.add(at(nx, ny))
        queue.push([nx, ny])
      }
    }
    return seen
  }
  const farBank: [number, number] = [FORD.x + 1, FORD.y]
  for (let pass2 = 0; pass2 < 200; pass2++) {
    const reached = flood(farBank, passable)
    let lost: [number, number] | undefined
    for (let i = 0; i < W * H && !lost; i++) if (!reached.has(i) && passable(i % W, Math.floor(i / W))) lost = [i % W, Math.floor(i / W)]
    if (!lost) break
    // the nearest reached cell, and a way to it through whatever is between
    let target: [number, number] = farBank
    let bd = Infinity
    for (const i of reached) {
      const d = Math.abs((i % W) - lost[0]) + Math.abs(Math.floor(i / W) - lost[1])
      if (d < bd) (bd = d), (target = [i % W, Math.floor(i / W)])
    }
    const way = route(lost, target, true)
    if (!way) {
      // nowhere to go (an islet): it is sea
      for (const i of flood(lost, passable)) ground[i] = 'ow_sea'
      continue
    }
    pave(way, false)
  }
  // the west bank keeps to itself: from it, nothing passable leads past the barrier but the Ford
  const pocket = flood([FORD.x - 1, FORD.y], (x, y) => land[at(x, y)] && !SOLID.has(ground[at(x, y)]) && !(fixed.get(key(x, y)) === 'ow_river'))
  for (const i of pocket) if (!inPocket(i % W, Math.floor(i / W))) throw new Error(`the west bank leaks at ${i % W},${Math.floor(i / W)}`)

  // a place keeps the ground it was put on; the sea has no region
  const rows: string[] = []
  const regions: string[] = []
  for (let y = 0; y < H; y++) {
    let row = ''
    let reg = ''
    for (let x = 0; x < W; x++) {
      const g = ground[at(x, y)]
      const c = CHAR_OF[g]
      if (!c || !TERRAINS.some((t) => t.id === g)) throw new Error(`no character for ${g}`)
      row += c
      reg += g === 'ow_sea' ? ' ' : KEY_OF[region[at(x, y)]] ?? ' '
    }
    rows.push(row)
    regions.push(reg)
  }
  return { seed, width: W, height: H, rows, regions, keys: KEYS, places }
}

/** The continent as a file: a line to a row, a line to a place (so a change to it reads as one in a diff). */
export function continentJson(c: Continent): string {
  const { rows, regions, places, ...head } = c
  const list = (xs: unknown[]) => `[\n${xs.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`
  const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  return `{\n${[...lines, `  "rows": ${list(rows)}`, `  "regions": ${list(regions)}`, `  "places": ${list(places)}`].join(',\n')}\n}\n`
}

/** Write the continent for the Ford's hand-made places (its CLI: `npm run continent`). */
export async function writeContinent(seed = 1517): Promise<Continent> {
  const { buildFord } = await import('../world.ts')
  const { handmadeGrounds } = await import('../overworld.ts')
  const { fixed, east } = handmadeGrounds(buildFord({ overworld: false }).cells)
  const c = generateContinent(seed, fixed, east)
  writeFileSync(CONTINENT_FILE, continentJson(c))
  return c
}

