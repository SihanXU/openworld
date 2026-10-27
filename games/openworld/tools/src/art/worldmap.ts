// The overworld's own pictures (world-model.md §5.1): an inked map, not the ground one walks on — so the
// world map never reads as another local map. One cell, one place; 16x16 tiles in a muted map palette with
// dark ink lines:
// - WorldMap/tiles.png: the sea's coast, the river and the road as blob blocks (11 x 5 each, the layout of
//   runtime/src/assets/ground.ts BLOB47; the river's and the road's banks open, so the ground beside them shows), then
//   a row of the plains' tiles;
// - WorldMap/grounds.png: every other ground as a blob block laid over the plains (`LAID`): its edge gives way along
//   a hand-drawn rim to whatever lies beside it, its other whole tiles in the block's fifth row — no ground ends in a
//   square;
// - WorldMap/marks.png (16x20 frames): what stands on a cell — woods, mountains, hills (a wood's heart and a range's
//   peaks drawn out to the cell's sides, so they join as one mass) — and the places' icons (a village, a town, the
//   ford, a mine, …), drawn over the ground.
//
//   npx tsx games/openworld/tools/src/art/worldmap.ts

import { BLOB47 } from '@openworld/runtime/src/assets/ground.ts'
import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [52, 40, 32, 255], // ink
  D: [52, 92, 132, 255], // open sea
  S: [70, 116, 156, 255],
  h: [104, 156, 184, 255], // shallows
  w: [176, 210, 222, 255], // wave strokes, foam
  y: [222, 202, 146, 255], // sand
  g: [146, 166, 96, 255], // plains
  G: [126, 148, 80, 255],
  q: [168, 184, 114, 255],
  T: [58, 98, 60, 255], // woods
  U: [88, 136, 76, 255],
  b: [96, 70, 46, 255],
  H: [172, 160, 102, 255], // hills
  J: [136, 124, 78, 255],
  m: [156, 146, 134, 255], // mountains
  M: [110, 102, 96, 255],
  W: [244, 244, 236, 255], // snow
  n: [222, 230, 236, 255],
  N: [196, 208, 220, 255],
  r: [198, 168, 112, 255], // road
  R: [178, 74, 58, 255], // roofs
  P: [128, 50, 40, 255],
  v: [234, 222, 192, 255], // walls
  o: [140, 100, 60, 255], // timber
  B: [72, 92, 142, 255], // slate
  s: [150, 150, 146, 255], // stone
  x: [36, 32, 38, 255], // dark openings
  Y: [232, 192, 72, 255], // gold
  f: [232, 112, 52, 255], // fire
  e: [210, 70, 60, 255], // banner
  // the other regions' grounds (docs/continent.md §2)
  Z: [182, 170, 106, 255], // steppe
  z: [156, 146, 88, 255],
  E: [176, 96, 66, 255], // red badlands
  A: [140, 70, 50, 255],
  F: [204, 182, 112, 255], // fields
  c: [170, 146, 84, 255],
  Q: [218, 200, 152, 255], // dust
  d: [196, 176, 128, 255],
  X: [238, 234, 222, 255], // salt
  C: [208, 214, 216, 255],
  L: [88, 112, 90, 255], // marsh
  l: [66, 92, 96, 255],
  V: [214, 208, 192, 255], // white highland
  O: [176, 170, 156, 255],
  K: [184, 166, 140, 255], // city stone
  I: [104, 94, 80, 255], // dead wood
  // the grounds laid over the plains (each a block that gives way at its edge): their rims and second shades
  t1: [70, 110, 62, 255], // forest floor, its shade
  t2: [56, 94, 54, 255],
  t3: [74, 118, 66, 255], // a lit crown
  m1: [132, 124, 114, 255], // scree
  m2: [96, 90, 86, 255],
  m3: [186, 178, 164, 255], // a lit stone
  h1: [156, 164, 92, 255], // the hills' grass
  h2: [138, 146, 80, 255],
  g1: [116, 140, 70, 255], // a plain's tuft
  g2: [168, 186, 112, 255],
  fl: [236, 226, 196, 255], // a flower
  F2: [150, 170, 82, 255], // green crops
  F3: [126, 146, 68, 255],
  F4: [184, 150, 96, 255], // turned earth
  F5: [160, 128, 82, 255],
  hg: [92, 116, 62, 255], // a hedge
  dw: [126, 118, 98, 255], // dead ground
  dv: [108, 100, 84, 255],
  Lh: [120, 150, 152, 255], // a pool's light
  E2: [196, 120, 80, 255], // lit red rock
  Z2: [200, 188, 124, 255], // a steppe's blade
  n2: [208, 218, 228, 255], // snow's shade
}

const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

// ---------------------------------------------------------------- the coasts: blob blocks

/** How far a pixel of a tile is from the land round it, for the blob signature `sig` (N=1 … NW=128 the same). */
function landDistance(sig: number, x: number, y: number): number {
  const cx = x + 0.5
  const cy = y + 0.5
  const same = (bit: number) => (sig & bit) !== 0
  let d = Infinity
  if (!same(1)) d = Math.min(d, cy)
  if (!same(4)) d = Math.min(d, 16 - cx)
  if (!same(16)) d = Math.min(d, 16 - cy)
  if (!same(64)) d = Math.min(d, cx)
  const corner = (bit: number, a: number, b: number, px: number, py: number) => {
    if (same(a) && same(b) && !same(bit)) d = Math.min(d, Math.hypot(cx - px, cy - py))
  }
  corner(2, 1, 4, 16, 0)
  corner(8, 4, 16, 16, 16)
  corner(32, 16, 64, 0, 16)
  corner(128, 64, 1, 0, 0)
  return d
}

const TAU = Math.PI * 2
/**
 * How far an edge wanders in or out at a pixel: waves with the tile's period (16), so an edge runs on unbroken from one
 * cell into the next and a ground's rim is drawn by hand, never by a ruler.
 */
const wander = (x: number, y: number, seed: number): number =>
  0.45 * Math.sin((TAU * (x + 0.5)) / 16 + seed) +
  0.3 * Math.sin((TAU * 2 * (x + 0.5)) / 16 + seed * 1.7) +
  0.45 * Math.sin((TAU * (y + 0.5)) / 16 + seed * 2.3) +
  0.3 * Math.sin((TAU * 2 * (y + 0.5)) / 16 + seed * 0.6)

/**
 * A water tile: `bands` from the land inwards (up to a distance, a key; null leaves it open for the ground beside it to
 * show), then the open water with its strokes.
 */
function waterTile(sig: number, bands: [number, string | null][], deep: string, mid: string, wave: string, seed: number): Raster {
  const r = new Raster(16, 16)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = landDistance(sig, x, y) + wander(x, y, seed)
      const band = bands.find(([upTo]) => d < upTo)
      r.set(x, y, band ? band[1] : deep)
    }
  // wave strokes on the open water: short arcs, two to a tile
  for (const [wx, wy, c] of [[3, 4, wave], [9, 11, wave], [10, 2, mid], [2, 12, mid]] as const) {
    const ox = wx + (hash(sig, wx, seed) % 3)
    const oy = wy + (hash(sig, wy, seed + 1) % 2)
    const open = (px: number, py: number) => landDistance(sig, px, py) > bands[bands.length - 1][0] + 1
    if (![0, 1, 2, 3].every((i) => open(ox + i, oy))) continue
    r.set(ox, oy + 1, c)
    r.set(ox + 1, oy, c)
    r.set(ox + 2, oy, c)
    r.set(ox + 3, oy + 1, c)
  }
  return r
}

/** The 11 x 5 blob block of a ground: each signature's tile where BLOB47 puts it; the spare cells its whole tile. */
function blobBlock(make: (sig: number) => Raster, fills: Raster[] = []): Raster[][] {
  const rows: Raster[][] = Array.from({ length: 5 }, () => Array.from({ length: 11 }, () => make(255)))
  for (const [sig, [c, r]] of Object.entries(BLOB47)) rows[r][c] = make(Number(sig))
  // the whole tile's other looks, in the fifth row's first cells (the catalogue's `fills`)
  fills.forEach((f, i) => (rows[4][i] = f))
  return rows
}

// the sea: a sandy beach, an inked coastline, foam, the shallows, then open water
const sea = blobBlock((sig) => waterTile(sig, [[1.6, 'y'], [2.6, 'k'], [3.4, 'w'], [5.5, 'h']], 'D', 'S', 'w', 1))
// the river: open at its banks (the ground beside it shows), an inked line, a narrow run of water
const river = blobBlock((sig) => waterTile(sig, [[3.4, null], [4.3, 'k'], [5.4, 'h']], 'S', 'h', 'w', 2))
// the road: a run of beaten earth between darker edges, open beyond them, joined to the roads beside it
const roads = blobBlock((sig) => waterTile(sig, [[4.8, null], [5.7, 'J']], 'r', 'r', 'H', 3))

// ---------------------------------------------------------------- the grounds

/** A ground's paint at a pixel of its tile. */
type Paint = (x: number, y: number) => string

/** One colour, stippled by a seed (the map's paper grain): every `every`th pixel one of `dots`. */
const stipple =
  (base: string, dots: string[], seed: number, every = 9): Paint =>
  (x, y) =>
    hash(x, y, seed) % every === 0 ? dots[hash(y, x, seed) % dots.length] : base

/** A paint with small shapes laid on it: each `at` a cell of the tile and the key it is drawn in. */
function withMarks(paint: Paint, marks: [number, number, string][]): Paint {
  const on = new Map(marks.map(([x, y, c]) => [`${x},${y}`, c]))
  return (x, y) => on.get(`${x},${y}`) ?? paint(x, y)
}

/** A tile of one paint all over. */
function whole(paint: Paint): Raster {
  const r = new Raster(16, 16)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) r.set(x, y, paint(x, y))
  return r
}

/**
 * A ground laid over the plains (the catalogue's `over`): its paint, a rim of `rim` where it gives way, open beyond
 * (whatever lies beside it shows there), the rim's pixels broken into a dither outside it, so no ground ends on a
 * ruled line.
 */
function laid(paint: Paint, rim: string, seed: number, inset = 3): (sig: number) => Raster {
  return (sig) => {
    const r = new Raster(16, 16)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = landDistance(sig, x, y)
        // (a ground's edge wanders further than a water's: its bites and tongues hide the cells' squares)
        const edge = inset + 1.7 * wander(x, y, seed)
        if (d < edge - 0.9) continue
        if (d < edge) {
          if ((x + y) % 2 === 0) r.set(x, y, rim)
          continue
        }
        r.set(x, y, d < edge + 1 ? rim : paint(x, y))
      }
    return r
  }
}

/** A laid ground's block: its edges and its whole tile in `paints[0]`, its other whole tiles in the rest. */
const laidBlock = (paints: Paint[], rim: string, seed: number, inset?: number): Raster[][] => blobBlock(laid(paints[0], rim, seed, inset), paints.slice(1).map(whole))

/** Tufts of grass, flowers, stones: a few small shapes for a plain's tile (by seed, never in the same places). */
function scatter(seed: number, n: number, shapes: [number, number, string][][]): [number, number, string][] {
  const out: [number, number, string][] = []
  for (let i = 0; i < n; i++) {
    const shape = shapes[hash(i, seed, 5) % shapes.length]
    const ox = 2 + (hash(i, seed, 6) % 11)
    const oy = 2 + (hash(i, seed, 7) % 11)
    for (const [dx, dy, c] of shape) out.push([ox + dx, oy + dy, c])
  }
  return out
}
const TUFT: [number, number, string][] = [[0, 1, 'g1'], [1, 0, 'g1'], [2, 1, 'g1']]
const BLADE: [number, number, string][] = [[0, 0, 'g2'], [0, 1, 'g1']]
const FLOWER: [number, number, string][] = [[0, 0, 'fl'], [1, 1, 'g1']]
const STONE: [number, number, string][] = [[0, 0, 'm3'], [1, 0, 's'], [1, 1, 'M']]

// the plains: grass with its grain; most tiles bare, some with tufts, a flower, a stone
const PLAIN = stipple('g', ['q', 'G'], 11)
const plains = [
  whole(PLAIN),
  whole(stipple('g', ['q', 'G', 'q'], 13, 7)),
  whole(withMarks(PLAIN, scatter(1, 3, [TUFT, BLADE]))),
  whole(withMarks(PLAIN, scatter(2, 2, [TUFT, FLOWER]))),
  whole(withMarks(PLAIN, scatter(3, 3, [BLADE, TUFT, STONE]))),
  whole(withMarks(stipple('g', ['q', 'G'], 14), scatter(4, 2, [FLOWER, FLOWER, TUFT]))),
]

/** Furrows across a field: rows (or, `across`, columns) of `a` and `b` on `base`, a hedge along the tile's far sides. */
function field(base: string, a: string, b: string, across: boolean, seed: number): Paint {
  const grain = stipple(base, [a], seed, 13)
  return (x, y) => {
    if (x === 15 || y === 15) return hash(x, y, seed) % 5 ? 'hg' : 'G'
    const k = across ? x : y
    return k % 3 === 1 ? a : k % 3 === 2 ? b : grain(x, y)
  }
}

/** Paving: stones in courses, the joints darker. */
const paving: Paint = (x, y) => (y % 4 === 0 || x % 8 === ((y >> 2) % 2 ? 2 : 6) ? 'O' : hash(x, y, 61) % 13 ? 'K' : 'O')

/** A marsh: the reeds' ground, pools of still water with a gleam. */
function marsh(seed: number): Paint {
  const pools = seed % 2 ? [[4, 5, 2.5], [11, 11, 3]] : [[10, 4, 2.5], [4, 11, 2.8]]
  const grain = stipple('L', ['l', 'G'], seed, 7)
  return (x, y) => {
    for (const [px, py, rx] of pools) {
      const d = ((x - px) / rx) ** 2 + ((y - py) / (rx * 0.6)) ** 2
      if (d <= 1) return d < 0.25 && x < px ? 'Lh' : 'l'
    }
    return grain(x, y)
  }
}

/** Red rock in bands, the bands bending a little. */
function strata(seed: number): Paint {
  const grain = stipple('E', ['E2'], seed, 11)
  return (x, y) => ((y + Math.round(1.2 * Math.sin((TAU * x) / 16 + seed))) % 5 === 0 ? 'A' : grain(x, y))
}

/** A salt flat's cracks: a few straight runs between its plates. */
function cracks(seed: number): Paint {
  const grain = stipple('X', ['C'], seed, 10)
  return (x, y) => ((x + seed) % 7 === 0 && hash(0, y, seed) % 3) || ((y + seed * 3) % 6 === 0 && hash(x, 0, seed) % 3) ? 'C' : grain(x, y)
}

/** The white highland: pale stone, thin pasture in its hollows, loose stones (a different scatter on every tile). */
const PASTURE: [number, number, string][] = [[0, 0, 'q'], [1, 0, 'g2'], [1, 1, 'q'], [2, 1, 'g1']]
const highland: Paint[] = [56, 57, 58].map((seed) => withMarks(stipple('V', ['O', 'O', 'W', 'm3'], seed, 5), scatter(seed, 5, [STONE, PASTURE, PASTURE, [[0, 0, 'O'], [1, 0, 'm1']]])))

/** The blocks of the grounds laid over the plains, in their order in WorldMap/grounds.png (the catalogue's `over`). */
const LAID: [string, Raster[][]][] = [
  ['ow_steppe', laidBlock([withMarks(stipple('Z', ['z', 'q'], 41), scatter(41, 4, [[[0, 0, 'Z2'], [0, 1, 'z']]])), stipple('Z', ['z'], 62), withMarks(stipple('Z', ['z', 'q'], 63), scatter(63, 3, [[[0, 0, 'Z2'], [1, 1, 'z']]]))], 'z', 4)],
  ['ow_dust', laidBlock([stipple('Q', ['d', 'y'], 44, 6), stipple('Q', ['d'], 59), withMarks(stipple('Q', ['d'], 64, 8), scatter(64, 2, [STONE]))], 'd', 5)],
  ['ow_salt', laidBlock([cracks(1), cracks(3), stipple('X', ['C', 'w'], 45, 8)], 'C', 6, 2)],
  ['ow_fields', laidBlock([field('F', 'c', 'F', false, 43), field('F2', 'F3', 'F2', true, 57), field('F4', 'F5', 'F4', false, 58), field('F', 'c', 'F', true, 65)], 'hg', 7)],
  ['ow_hills', laidBlock([stipple('h1', ['h2', 'q'], 70, 6), stipple('h1', ['h2'], 71, 8), withMarks(stipple('h1', ['h2'], 72, 7), scatter(72, 2, [TUFT]))], 'h2', 8)],
  ['ow_marsh', laidBlock([marsh(51), marsh(52), stipple('L', ['l', 'G'], 53, 6)], 'l', 9)],
  ['ow_highland', laidBlock(highland, 'O', 10)],
  ['ow_snow', laidBlock([stipple('n', ['n2', 'W'], 21), stipple('n', ['n2', 'W'], 22, 7), stipple('W', ['n', 'n2'], 23, 6)], 'n2', 11)],
  ['ow_badlands', laidBlock([strata(1), strata(2.5), strata(4)], 'A', 12)],
  ['ow_deadwood', laidBlock([stipple('dw', ['dv', 'I'], 56, 7), stipple('dw', ['dv'], 66, 6), withMarks(stipple('dw', ['dv'], 67, 8), scatter(67, 3, [[[0, 0, 'I'], [1, 0, 'I']]]))], 'dv', 13)],
  ['ow_forest', laidBlock([stipple('t1', ['t2', 'T'], 80, 5), stipple('t1', ['t2', 'U'], 81, 5), stipple('t1', ['t2'], 82, 4)], 't2', 14, 1.8)],
  ['ow_mountain', laidBlock([stipple('m1', ['m2', 'm3'], 90, 4), stipple('m1', ['m2'], 91, 5), stipple('m1', ['m3', 'M'], 92, 5)], 'm2', 15, 1.8)],
  ['ow_city', laidBlock([paving, paving, paving], 'O', 16)],
]

// ---------------------------------------------------------------- what stands on a cell: 16x20

const frame = () => new Raster(16, 20)

/** A round-topped tree of the woods at (x, y) its foot. */
function tree(r: Raster, x: number, y: number, s = 1): void {
  r.rect(x, y - 2, 1, 2, 'b')
  r.ellipse(x, y - 5 * s, 3 * s, 3.3 * s, 'T')
  r.ellipse(x - 1, y - 6 * s, 1.6 * s, 1.4 * s, 'U')
}
/** The trees of a wood's cell, `spots` their feet and sizes, drawn back to front and inked round. */
function grove(spots: [number, number, number][]): Raster {
  const r = frame()
  for (const [x, y, s] of [...spots].sort((a, b) => a[1] - b[1])) tree(r, x, y, s)
  r.outline('k')
  return r
}
/** A wood's edge: a few trees, room between them. */
const WOODS: [number, number, number][][] = [
  [[4, 13, 1], [11, 12, 1], [7, 18, 1.1], [13, 18, 0.9]],
  [[5, 12, 0.9], [11, 14, 1.1], [4, 18, 1], [10, 19, 1]],
  [[8, 13, 1.1], [3, 17, 0.9], [12, 18, 1]],
  [[3, 12, 0.9], [9, 11, 1], [13, 15, 0.9], [6, 18, 1.1]],
]
/** Deep in a wood: crowns shoulder to shoulder out to the cell's sides, so the woods meet as one canopy. */
const CANOPY: [number, number, number][][] = [
  [[2, 10, 1], [8, 9, 1.1], [14, 10, 1], [5, 15, 1.1], [11, 15, 1.1], [2, 19, 1], [8, 20, 1.1], [14, 19, 1]],
  [[4, 9, 1.1], [11, 10, 1], [1, 14, 1], [7, 15, 1.2], [14, 15, 1], [4, 20, 1.1], [11, 20, 1.1]],
  [[2, 9, 1], [9, 10, 1.1], [15, 9, 1], [5, 14, 1], [12, 15, 1.1], [1, 19, 1], [8, 19, 1.2], [15, 20, 1]],
  [[6, 9, 1.1], [13, 10, 1], [2, 13, 1], [9, 15, 1.1], [15, 15, 1], [4, 19, 1.1], [12, 20, 1.1]],
]
/** A pine under snow: its dark cone, the snow lying on its upper boughs. */
function pine(r: Raster, x: number, y: number, s = 1): void {
  r.rect(x, y - 2, 1, 2, 'b')
  r.poly([[x - 3 * s, y - 2], [x, y - 10 * s], [x + 3 * s, y - 2]], 'T')
  r.poly([[x - 1.8 * s, y - 6 * s], [x, y - 10 * s], [x + 1.8 * s, y - 6 * s]], 'W')
}
/** A snowfield's mark (docs/release-1.md): a few pines under snow, so a snow cell is never a blank white square. */
const SNOWPINES: [number, number, number][][] = [
  [[5, 14, 0.9], [11, 16, 1.1], [7, 20, 0.8]],
  [[10, 13, 0.9], [4, 17, 1], [12, 20, 0.8]],
  [[8, 15, 1.1], [3, 19, 0.8]],
]
function snowpines(seed: number): Raster {
  const r = frame()
  for (const [x, y, s] of [...SNOWPINES[seed]].sort((a, b) => a[1] - b[1])) pine(r, x, y, s)
  r.outline('k')
  return r
}
/** A peak: lit face, shaded face, a cap of snow. */
function peak(r: Raster, x: number, base: number, h: number, half: number): void {
  r.poly([[x - half, base], [x, base - h], [x + half, base]], 'm')
  r.poly([[x, base - h], [x + half, base], [x + 1, base]], 'M')
  r.poly([[x - half * 0.35, base - h * 0.62], [x, base - h], [x + half * 0.35, base - h * 0.62], [x + 0.5, base - h * 0.52]], 'W')
}
/** A bare peak, no snow: the foothills of a range. */
function foothill(r: Raster, x: number, base: number, h: number, half: number): void {
  r.poly([[x - half, base], [x, base - h], [x + half, base]], 'm')
  r.poly([[x, base - h], [x + half, base], [x + 1, base]], 'M')
  // a ledge of lit stone across its face
  r.line(x - half * 0.45, base - h * 0.35, x - 1, base - h * 0.5, 'm3')
}
/** Peaks back to front (x, base, height, half-width, snow?), inked round. */
function range(peaks: [number, number, number, number, boolean][]): Raster {
  const r = frame()
  for (const [x, base, h, half, snow] of [...peaks].sort((a, b) => a[1] - b[1])) (snow ? peak : foothill)(r, x, base, h, half)
  r.outline('k')
  return r
}
/** A range's edge: low peaks, mostly bare. */
const FOOTHILLS: [number, number, number, number, boolean][][] = [
  [[5, 19, 10, 5.5, false], [11, 19, 13, 6, true]],
  [[10, 19, 10, 5.5, false], [5, 19, 12, 5.5, false]],
  [[8, 19, 13, 7, true]],
  [[4, 18, 8, 4.5, false], [10, 19, 11, 6, false], [14, 20, 7, 3.5, false]],
]
/** Deep in a range: tall snowy peaks out to the cell's sides, so the mountains stand as one chain. */
const PEAKS: [number, number, number, number, boolean][][] = [
  [[3, 17, 13, 6, true], [12, 17, 16, 7, true], [8, 20, 11, 6, false]],
  [[5, 17, 18, 7.5, true], [13, 18, 12, 6, true], [1, 20, 9, 5, false]],
  [[2, 18, 14, 6.5, true], [10, 16, 15, 7, true], [15, 19, 10, 5, false], [7, 20, 9, 5, false]],
  [[8, 17, 18, 8.5, true], [1, 19, 11, 5.5, false], [15, 20, 11, 5.5, false]],
]
/** Rolling hills: humps (x, y, width, height) back to front. */
function hills(humps: [number, number, number, number][]): Raster {
  const r = frame()
  for (const [x, y, rx, ry] of [...humps].sort((a, b) => a[1] - b[1])) {
    r.ellipse(x, y, rx, ry, 'H')
    r.ellipse(x + rx * 0.35, y + ry * 0.25, rx * 0.6, ry * 0.7, 'J')
    // the hump's foot cut level, so it sits on the ground
    r.rect(x - rx - 1, y + 1, rx * 2 + 3, 4, null as unknown as string)
  }
  r.outline('k')
  return r
}
const HILLS: [number, number, number, number][][] = [
  [[5, 15, 4, 3], [11, 17, 4, 3]],
  [[10, 14, 4, 3], [5, 17, 4, 3]],
  [[8, 16, 5, 3.5]],
  [[4, 14, 3.5, 2.5], [11, 15, 4, 3], [6, 18, 3.5, 2.5]],
]

/** A house: walls, a pitched roof of `roof`, a door. */
function house(r: Raster, x: number, y: number, w: number, roof = 'R', shade = 'P'): void {
  const top = y - 4 - Math.ceil(w / 2)
  r.rect(x, y - 4, w, 4, 'v')
  r.poly([[x - 1, y - 4], [x + w / 2, top], [x + w + 1, y - 4]], roof)
  // the far slope in shade
  r.poly([[x + w / 2, top], [x + w + 1, y - 4], [x + w / 2, y - 4]], shade)
  r.rect(x + Math.floor(w / 2) - 1, y - 2, 1, 2, 'o')
}
const village = (): Raster => {
  const r = frame()
  house(r, 1, 14, 6)
  house(r, 9, 13, 6, 'B', 'B')
  house(r, 5, 19, 6)
  r.outline('k')
  return r
}
const town = (): Raster => {
  const r = frame()
  // a wall with a gate, roofs and a smoking forge behind
  r.rect(1, 13, 14, 6, 's')
  for (let x = 1; x < 15; x += 2) r.set(x, 12, 's')
  r.rect(7, 15, 2, 4, 'x')
  house(r, 2, 11, 5)
  house(r, 9, 10, 5, 'B', 'B')
  r.rect(12, 2, 2, 4, 's')
  r.set(12, 1, 'M')
  r.set(13, 0, 'M')
  r.outline('k')
  return r
}
const ford = (): Raster => {
  const r = frame()
  // two houses, one on each bank, a footbridge between them over the water
  house(r, 0, 12, 5)
  house(r, 11, 12, 5, 'B', 'B')
  r.rect(2, 15, 12, 2, 'o')
  for (let x = 3; x < 14; x += 3) r.rect(x, 17, 1, 2, 'o')
  r.rect(2, 14, 12, 1, 'b')
  r.outline('k')
  return r
}
const farm = (): Raster => {
  const r = frame()
  house(r, 2, 11, 7)
  // fields in rows, a fence
  for (let y = 13; y < 19; y += 2) r.rect(1, y, 14, 1, 'H')
  for (let y = 14; y < 19; y += 2) r.rect(1, y, 14, 1, 'U')
  r.rect(11, 6, 3, 5, 'R')
  r.outline('k')
  return r
}
const mill = (): Raster => {
  const r = frame()
  r.poly([[5, 19], [6, 8], [10, 8], [11, 19]], 'v')
  r.poly([[5, 9], [8, 5], [11, 9]], 'P')
  r.rect(7, 16, 2, 3, 'o')
  // the sails, a cross over the cap
  r.line(3, 3, 13, 13, 'o')
  r.line(13, 3, 3, 13, 'o')
  r.rect(7, 7, 2, 2, 'b')
  r.outline('k')
  return r
}
/** A watermill (Millbrook's): the mill house, its wheel turning in the brook at its side. */
const watermill = (): Raster => {
  const r = frame()
  r.rect(0, 18, 16, 2, 'h')
  r.rect(2, 11, 8, 7, 'v')
  r.poly([[1, 11], [6, 6], [11, 11]], 'R')
  r.rect(5, 14, 2, 4, 'o')
  r.ellipse(12, 14, 3.2, 3.6, 'o')
  r.ellipse(12, 14, 1.6, 1.8, 'v')
  r.line(12, 10, 12, 18, 'b')
  r.line(8.8, 14, 15.2, 14, 'b')
  r.outline('k')
  return r
}
const woodsPlace = (): Raster => {
  const r = frame()
  tree(r, 3, 12)
  tree(r, 13, 12)
  house(r, 5, 19, 6, 'o', 'b')
  tree(r, 2, 19, 0.9)
  tree(r, 14, 19, 0.9)
  r.outline('k')
  return r
}
const hollow = (): Raster => {
  const r = frame()
  tree(r, 4, 13, 1.1)
  tree(r, 12, 13, 1.1)
  tree(r, 8, 11, 1)
  // a dark hollow under the trees, a mushroom ring
  r.ellipse(8, 17, 4.5, 2, 'x')
  for (const [x, y] of [[2, 18], [14, 18], [8, 19.5]] as const) (r.set(x, y, 'R'), r.set(x, y + 1, 'v'))
  r.outline('k')
  return r
}
const barrow = (): Raster => {
  const r = frame()
  r.ellipse(8, 15, 7, 4.5, 'G')
  r.ellipse(6, 14, 4, 2.5, 'q')
  // the stones of its door
  r.rect(6, 15, 4, 4, 's')
  r.rect(7, 16, 2, 3, 'x')
  r.rect(5, 14, 6, 1, 'M')
  r.outline('k')
  return r
}
const cave = (dark: boolean) => (): Raster => {
  const r = frame()
  peak(r, 8, 19, 15, 7.5)
  r.ellipse(8, 17, 3, 3, 'x')
  r.rect(5, 17, 7, 3, 'x')
  if (dark) {
    // bones at the mouth, a red glow inside
    r.set(7, 17, 'f')
    r.set(9, 18, 'f')
    r.rect(3, 19, 3, 1, 'W')
    r.rect(11, 19, 2, 1, 'W')
  } else {
    // the mine's timbers and a cart rail
    r.rect(5, 14, 7, 1, 'o')
    r.rect(5, 14, 1, 6, 'o')
    r.rect(11, 14, 1, 6, 'o')
  }
  r.outline('k')
  return r
}
const pass = (): Raster => {
  const r = frame()
  peak(r, 3, 19, 13, 4)
  peak(r, 13, 19, 13, 4)
  // a watchtower in the gap
  r.rect(6, 8, 4, 11, 's')
  r.rect(5, 6, 6, 2, 'M')
  r.rect(7, 12, 2, 3, 'x')
  r.rect(7, 2, 1, 4, 'b')
  r.rect(8, 2, 3, 2, 'e')
  r.outline('k')
  return r
}
const summit = (): Raster => {
  const r = frame()
  peak(r, 8, 19, 17, 8)
  r.poly([[3, 12], [8, 2], [13, 12], [8, 8]], 'W')
  // a flag on the top
  r.rect(8, 0, 1, 4, 'b')
  r.rect(9, 0, 3, 2, 'e')
  r.outline('k')
  return r
}
const shrine = (): Raster => {
  const r = frame()
  // dawn over a hill: the sun half risen behind it, its rays fanning out, a path up the slope
  for (const [dx, dy] of [[-7, -1], [-5, -5], [0, -7], [5, -5], [7, -1]] as const) r.line(8, 12, 8 + dx, 12 + dy, 'Y')
  r.ellipse(8, 12, 4, 4, 'f')
  r.ellipse(8, 12, 3, 3, 'Y')
  r.ellipse(8, 19, 8, 6.5, 'G')
  r.ellipse(6, 17, 4, 2.5, 'q')
  r.rect(0, 19, 16, 1, 'G')
  r.line(8, 13, 10, 19, 'H')
  r.outline('k')
  return r
}
const camp = (): Raster => {
  const r = frame()
  peak(r, 11, 15, 12, 5)
  // a tent and a fire at the foot of the trail
  r.poly([[1, 19], [5, 12], [9, 19]], 'R')
  r.poly([[5, 12], [9, 19], [5, 19]], 'P')
  r.rect(4, 17, 2, 2, 'x')
  r.rect(11, 18, 3, 1, 'b')
  r.set(12, 17, 'f')
  r.set(12, 16, 'Y')
  r.outline('k')
  return r
}
const waystone = (): Raster => {
  const r = frame()
  r.rect(7, 9, 3, 10, 's')
  r.rect(8, 8, 1, 1, 's')
  r.rect(8, 11, 1, 5, 'M')
  // a signpost beside it
  r.rect(3, 12, 1, 7, 'o')
  r.rect(1, 12, 5, 2, 'v')
  r.rect(12, 14, 1, 5, 'o')
  r.rect(10, 14, 5, 2, 'v')
  r.outline('k')
  return r
}

// ---------------------------------------------------------------- the other regions' marks (docs/continent.md §2, §3)

/** A dead tree: a bare trunk and its forks. */
function deadTree(r: Raster, x: number, y: number, s = 1): void {
  r.rect(x, Math.round(y - 7 * s), 1, Math.round(7 * s), 'I')
  r.line(x, Math.round(y - 4 * s), Math.round(x - 3 * s), Math.round(y - 7 * s), 'I')
  r.line(x, Math.round(y - 5 * s), Math.round(x + 3 * s), Math.round(y - 8 * s), 'I')
  r.line(x, Math.round(y - 7 * s), x - 1, Math.round(y - 10 * s), 'I')
}
const DEADWOOD = [[[5, 13, 1], [12, 13, 0.9], [9, 19, 1]], [[4, 14, 1], [11, 15, 1], [7, 19, 1]], [[8, 15, 1.1], [3, 19, 0.8], [13, 20, 0.9]]]
const deadwood = (seed: number) => (): Raster => {
  const r = frame()
  for (const [x, y, s] of DEADWOOD[seed]) deadTree(r, x, y, s)
  r.outline('k')
  return r
}
const REEDS = [[2, 4, 5, 9, 11, 12, 14], [1, 3, 7, 8, 13], [5, 6, 10, 14, 15]]
const reeds = (seed: number) => (): Raster => {
  const r = frame()
  for (const x of REEDS[seed]) {
    const h = 4 + (hash(x, 3, 7 + seed) % 4)
    const foot = 19 - (hash(x, seed, 9) % 3)
    r.rect(x, foot - h, 1, h, 'z')
    r.set(x, foot - h - 1, 'b')
  }
  r.outline('k')
  return r
}
const mesa = (seed: number) => (): Raster => {
  const r = frame()
  const top = [12, 10, 14][seed]
  const [l, w] = [[2, 12], [3, 10], [5, 9]][seed]
  r.poly([[l, 19], [l + 2, top], [l + w - 2, top], [l + w, 19]], 'E')
  r.poly([[l + w - 5, top], [l + w - 2, top], [l + w, 19], [l + w - 4, 19]], 'A')
  r.rect(l + 2, top, w - 7, 1, 'E2')
  for (let y = top + 3; y < 19; y += 3) r.rect(l + 1, y, w - 2, 1, 'A')
  r.outline('k')
  return r
}
const fort = (): Raster => {
  const r = frame()
  r.rect(1, 11, 14, 8, 's')
  for (let x = 1; x < 15; x += 2) r.set(x, 10, 's')
  r.rect(6, 6, 4, 13, 'M')
  for (let x = 6; x < 10; x += 2) r.set(x, 5, 'M')
  r.rect(7, 15, 2, 4, 'x')
  r.rect(8, 1, 1, 5, 'b')
  r.rect(9, 1, 3, 2, 'e')
  r.outline('k')
  return r
}
const ruin = (): Raster => {
  const r = frame()
  r.rect(2, 11, 3, 8, 's')
  r.rect(2, 10, 2, 1, 's')
  r.rect(7, 14, 3, 5, 's')
  r.rect(11, 9, 3, 10, 'M')
  r.rect(12, 8, 1, 1, 'M')
  r.rect(4, 18, 9, 1, 'O')
  r.outline('k')
  return r
}
const graveyard = (): Raster => {
  const r = frame()
  for (const [x, y] of [[2, 14], [7, 13], [12, 14], [4, 18], [10, 18]] as const) {
    r.rect(x, y - 3, 3, 4, 's')
    r.set(x + 1, y - 4, 's')
    r.set(x + 1, y - 2, 'M')
  }
  r.outline('k')
  return r
}
const cathedral = (): Raster => {
  const r = frame()
  r.rect(2, 11, 12, 8, 'v')
  r.poly([[1, 11], [8, 6], [15, 11]], 'B')
  r.rect(6, 2, 4, 9, 'v')
  r.poly([[5, 3], [8, 0], [11, 3]], 'B')
  r.rect(7, 14, 2, 5, 'x')
  r.set(8, 5, 'Y')
  r.outline('k')
  return r
}
const city = (): Raster => {
  const r = frame()
  r.rect(0, 12, 16, 7, 'V')
  for (let x = 0; x < 16; x += 2) r.set(x, 11, 'V')
  house(r, 1, 11, 4, 'B', 'B')
  house(r, 6, 9, 4)
  house(r, 11, 11, 4, 'B', 'B')
  r.rect(7, 15, 2, 4, 'x')
  r.rect(7, 0, 2, 5, 'Y')
  r.outline('k')
  return r
}
const tower = (): Raster => {
  const r = frame()
  r.rect(5, 5, 6, 14, 's')
  for (let x = 5; x < 11; x += 2) r.set(x, 4, 's')
  r.rect(7, 8, 2, 2, 'x')
  r.rect(7, 15, 2, 4, 'x')
  r.outline('k')
  return r
}
const battlefield = (): Raster => {
  const r = frame()
  // crossed spears over a field of the fallen, a torn banner
  r.line(2, 19, 12, 7, 'b')
  r.line(14, 19, 4, 7, 'b')
  r.rect(7, 4, 1, 8, 'b')
  r.rect(8, 4, 4, 3, 'e')
  for (const [x, y] of [[3, 17], [9, 18], [13, 16]] as const) r.rect(x, y, 2, 1, 'W')
  r.outline('k')
  return r
}
const plainCave = (): Raster => {
  const r = frame()
  peak(r, 8, 19, 14, 7.5)
  r.ellipse(8, 17, 3, 3, 'x')
  r.rect(5, 17, 7, 3, 'x')
  r.outline('k')
  return r
}
const seat = (): Raster => {
  const r = frame()
  // a dark spire, its door shut, a seal of gold over it
  r.poly([[3, 19], [8, 1], [13, 19]], 'M')
  r.poly([[8, 1], [13, 19], [9, 19]], 'x')
  r.rect(7, 14, 2, 5, 'x')
  r.ellipse(8, 10, 1.5, 1.5, 'Y')
  r.outline('k')
  return r
}
const bridge = (): Raster => {
  const r = frame()
  // planks across the cell over the river, rails either side
  r.rect(0, 9, 16, 5, 'o')
  for (let x = 1; x < 16; x += 3) r.rect(x, 9, 1, 5, 'b')
  r.rect(0, 8, 16, 1, 'b')
  r.rect(0, 14, 16, 1, 'b')
  r.outline('k')
  return r
}

/** The marks, in their order in WorldMap/marks.png (the catalogue's keys name them the same). */
const MARKS = ['woods', 'woods2', 'mountains', 'mountains2', 'hills', 'hills2', 'village', 'town', 'ford', 'farm', 'mill', 'woods-place', 'hollow', 'barrow', 'mine', 'lair', 'pass', 'summit', 'shrine', 'camp', 'waystone', 'none', 'deadwood', 'deadwood2', 'reeds', 'mesa', 'mesa2', 'fort', 'ruin', 'graveyard', 'cathedral', 'city', 'tower', 'battlefield', 'cave', 'seat', 'bridge', 'snowpines', 'snowpines2', 'watermill',
  // the variants of the masses (a wood's edge and heart, a range's foothills and peaks) and the other grounds' marks
  'woods3', 'woods4', 'canopy', 'canopy2', 'canopy3', 'canopy4', 'mountains3', 'mountains4', 'peaks', 'peaks2', 'peaks3', 'peaks4', 'hills3', 'hills4', 'deadwood3', 'reeds2', 'reeds3', 'mesa3', 'snowpines3'] as const
const DRAW: Record<(typeof MARKS)[number], () => Raster> = {
  woods: () => grove(WOODS[0]),
  woods2: () => grove(WOODS[1]),
  mountains: () => range(FOOTHILLS[0]),
  mountains2: () => range(FOOTHILLS[1]),
  hills: () => hills(HILLS[0]),
  hills2: () => hills(HILLS[1]),
  village,
  town,
  ford,
  farm,
  mill,
  'woods-place': woodsPlace,
  hollow,
  barrow,
  mine: cave(false),
  lair: cave(true),
  pass,
  summit,
  shrine,
  camp,
  waystone,
  // the wild: no mark of its own (its ground is the picture)
  none: frame,
  deadwood: deadwood(0),
  deadwood2: deadwood(1),
  reeds: reeds(0),
  mesa: mesa(0),
  mesa2: mesa(1),
  fort,
  ruin,
  graveyard,
  cathedral,
  city,
  tower,
  battlefield,
  cave: plainCave,
  seat,
  bridge,
  snowpines: () => snowpines(0),
  snowpines2: () => snowpines(1),
  watermill,
  woods3: () => grove(WOODS[2]),
  woods4: () => grove(WOODS[3]),
  canopy: () => grove(CANOPY[0]),
  canopy2: () => grove(CANOPY[1]),
  canopy3: () => grove(CANOPY[2]),
  canopy4: () => grove(CANOPY[3]),
  mountains3: () => range(FOOTHILLS[2]),
  mountains4: () => range(FOOTHILLS[3]),
  peaks: () => range(PEAKS[0]),
  peaks2: () => range(PEAKS[1]),
  peaks3: () => range(PEAKS[2]),
  peaks4: () => range(PEAKS[3]),
  hills3: () => hills(HILLS[2]),
  hills4: () => hills(HILLS[3]),
  deadwood3: deadwood(2),
  reeds2: reeds(1),
  reeds3: reeds(2),
  mesa3: mesa(2),
  snowpines3: () => snowpines(2),
}

writeAtlas('WorldMap/tiles.png', [...sea, ...river, ...roads, plains], PAL)
writeAtlas('WorldMap/grounds.png', LAID.flatMap(([, block]) => block), PAL)
writeAtlas('WorldMap/marks.png', [MARKS.map((k) => DRAW[k]())], PAL)
