// The overworld's own pictures (world-model.md §5.1): an inked map, not the ground one walks on — so the
// world map never reads as another local map. One cell, one place; 16x16 tiles in a muted map palette with
// dark ink lines:
// - WorldMap/tiles.png: the sea's and the river's coasts as blob blocks (11 x 5 each, the layout of
//   runtime/src/assets/ground.ts BLOB47), then two rows of plain grounds (plains, snowfield, road; the other regions'),
//   then the road as a blob block (it turns and joins);
// - WorldMap/marks.png (16x20 frames): what stands on a cell — woods, mountains, hills — and the places'
//   icons (a village, a town, the ford, a mine, …), drawn over the ground.
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

/** A water tile: `bands` from the land inwards (up to a distance, a key), then the open water with its strokes. */
function waterTile(sig: number, bands: [number, string][], deep: string, mid: string, wave: string, seed: number): Raster {
  const r = new Raster(16, 16)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      // a little wobble so a coast is drawn by hand, not by a ruler
      const d = landDistance(sig, x, y) + ((hash(x, y, seed) % 3) - 1) * 0.35
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

/** The 11 x 5 blob block of a water: each signature's tile where BLOB47 puts it; the spare cells plain open water. */
function blobBlock(make: (sig: number) => Raster): Raster[][] {
  const rows: Raster[][] = Array.from({ length: 5 }, () => Array.from({ length: 11 }, () => make(255)))
  for (const [sig, [c, r]] of Object.entries(BLOB47)) rows[r][c] = make(Number(sig))
  return rows
}

// the sea: a sandy beach, an inked coastline, foam, the shallows, then open water
const sea = blobBlock((sig) => waterTile(sig, [[1.6, 'y'], [2.6, 'k'], [3.4, 'w'], [5.5, 'h']], 'D', 'S', 'w', 1))
// the river: a green bank, an inked line, a narrow run of water
const river = blobBlock((sig) => waterTile(sig, [[3.2, 'g'], [4.2, 'k'], [5.4, 'h']], 'S', 'h', 'w', 2))
// the road: a run of beaten earth between inked edges, joined to the roads beside it (the continent's roads turn)
const roads = blobBlock((sig) => waterTile(sig, [[4.6, 'g'], [5.6, 'J']], 'r', 'r', 'H', 3))

// ---------------------------------------------------------------- plain grounds

/** A ground of one colour, stippled by a seed (the map's paper grain). */
function ground(base: string, dots: string[], seed: number, every = 9): Raster {
  const r = new Raster(16, 16)
  r.rect(0, 0, 16, 16, base)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (hash(x, y, seed) % every === 0) r.set(x, y, dots[hash(y, x, seed) % dots.length])
  return r
}
const road = (): Raster => {
  const r = ground('g', ['q', 'G'], 31)
  // a road east to west through the cell, inked at its edges, a dashed rut down its middle
  r.rect(0, 6, 16, 4, 'r')
  r.rect(0, 5, 16, 1, 'J')
  r.rect(0, 10, 16, 1, 'J')
  for (let x = 1; x < 16; x += 4) r.rect(x, 8, 2, 1, 'H')
  return r
}
const grounds = [ground('g', ['q', 'G'], 11), ground('g', ['q', 'G'], 12), ground('g', ['q', 'G', 'q'], 13, 7), ground('n', ['N', 'W'], 21), ground('n', ['N', 'W'], 22, 7), road()]
/** A field of furrows: rows of `a` and `b` across a ground. */
function furrows(base: string, a: string, b: string, seed: number): Raster {
  const r = ground(base, [a], seed, 11)
  for (let y = 2; y < 16; y += 4) (r.rect(0, y, 16, 1, a), r.rect(0, y + 1, 16, 1, b))
  return r
}
/** Paving: stones in courses, inked joints. */
function paving(): Raster {
  const r = ground('K', ['O'], 61, 13)
  for (let y = 0; y < 16; y += 4) {
    r.rect(0, y, 16, 1, 'O')
    for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) r.rect(x, y, 1, 4, 'O')
  }
  return r
}
/** Pools in a marsh: dark water among the reeds' ground. */
function marsh(seed: number): Raster {
  const r = ground('L', ['l', 'G'], seed, 7)
  for (const [x, y, rx] of seed % 2 ? [[4, 5, 2.5], [11, 11, 3]] : [[10, 4, 2.5], [4, 11, 2.8]]) r.ellipse(x, y, rx, rx * 0.6, 'l')
  return r
}
// the other regions' grounds (docs/continent.md §2), in the row's spare cells and a row of their own
grounds.push(ground('Z', ['z', 'q'], 41), ground('E', ['A', 'H'], 42, 7), furrows('F', 'c', 'F', 43), ground('Q', ['d', 'y'], 44, 6), ground('X', ['C', 'w'], 45, 8))
const grounds2 = [marsh(51), marsh(52), ground('V', ['O', 'W'], 53, 7), ground('V', ['O'], 54), paving(), ground('d', ['I', 'H'], 56, 7), furrows('F', 'c', 'H', 57), ground('E', ['A'], 58), ground('Q', ['d'], 59), ground('X', ['C'], 60), ground('Z', ['z'], 62)]

// ---------------------------------------------------------------- what stands on a cell: 16x20

const frame = () => new Raster(16, 20)

/** A round-topped tree of the woods at (x, y) its foot. */
function tree(r: Raster, x: number, y: number, s = 1): void {
  r.rect(x, y - 2, 1, 2, 'b')
  r.ellipse(x, y - 5 * s, 3 * s, 3.3 * s, 'T')
  r.ellipse(x - 1, y - 6 * s, 1.6 * s, 1.4 * s, 'U')
}
function woods(seed: number): Raster {
  const r = frame()
  const spots: [number, number, number][] = seed === 0 ? [[4, 13, 1], [11, 12, 1], [7, 18, 1.1], [13, 18, 0.9]] : [[5, 12, 0.9], [11, 14, 1.1], [4, 18, 1], [10, 19, 1]]
  for (const [x, y, s] of spots.sort((a, b) => a[1] - b[1])) tree(r, x, y, s)
  r.outline('k')
  return r
}
/** A peak: lit face, shaded face, a cap of snow. */
function peak(r: Raster, x: number, base: number, h: number, half: number): void {
  r.poly([[x - half, base], [x, base - h], [x + half, base]], 'm')
  r.poly([[x, base - h], [x + half, base], [x + 1, base]], 'M')
  r.poly([[x - half * 0.35, base - h * 0.62], [x, base - h], [x + half * 0.35, base - h * 0.62], [x + 0.5, base - h * 0.52]], 'W')
}
function mountains(seed: number): Raster {
  const r = frame()
  if (seed === 0) {
    peak(r, 5, 19, 12, 5.5)
    peak(r, 10.5, 19, 16, 6)
  } else {
    peak(r, 10, 19, 12, 5.5)
    peak(r, 5, 19, 15, 5.5)
  }
  r.outline('k')
  return r
}
function hills(seed: number): Raster {
  const r = frame()
  const hump = (x: number, y: number, rx: number, ry: number) => {
    r.ellipse(x, y, rx, ry, 'H')
    r.ellipse(x + rx * 0.35, y + ry * 0.25, rx * 0.6, ry * 0.7, 'J')
    r.rect(x - rx - 1, y + 1, rx * 2 + 3, 4, null as unknown as string)
  }
  if (seed === 0) {
    hump(5, 15, 4, 3)
    hump(11, 17, 4, 3)
  } else {
    hump(10, 14, 4, 3)
    hump(5, 17, 4, 3)
  }
  r.outline('k')
  return r
}

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
const deadwood = (seed: number) => (): Raster => {
  const r = frame()
  for (const [x, y, s] of seed ? [[4, 14, 1], [11, 15, 1], [7, 19, 1]] : [[5, 13, 1], [12, 13, 0.9], [9, 19, 1]]) deadTree(r, x, y, s)
  r.outline('k')
  return r
}
const reeds = (): Raster => {
  const r = frame()
  for (const x of [2, 4, 5, 9, 11, 12, 14]) {
    const h = 4 + (hash(x, 3, 7) % 4)
    r.rect(x, 19 - h, 1, h, 'z')
    r.set(x, 18 - h, 'b')
  }
  r.outline('k')
  return r
}
const mesa = (seed: number) => (): Raster => {
  const r = frame()
  const top = seed ? 10 : 12
  r.poly([[2, 19], [4, top], [12, top], [14, 19]], 'E')
  r.poly([[9, top], [12, top], [14, 19], [10, 19]], 'A')
  for (let y = top + 3; y < 19; y += 3) r.rect(3, y, 10, 1, 'A')
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
const MARKS = ['woods', 'woods2', 'mountains', 'mountains2', 'hills', 'hills2', 'village', 'town', 'ford', 'farm', 'mill', 'woods-place', 'hollow', 'barrow', 'mine', 'lair', 'pass', 'summit', 'shrine', 'camp', 'waystone', 'none', 'deadwood', 'deadwood2', 'reeds', 'mesa', 'mesa2', 'fort', 'ruin', 'graveyard', 'cathedral', 'city', 'tower', 'battlefield', 'cave', 'seat', 'bridge'] as const
const DRAW: Record<(typeof MARKS)[number], () => Raster> = {
  woods: () => woods(0),
  woods2: () => woods(1),
  mountains: () => mountains(0),
  mountains2: () => mountains(1),
  hills: () => hills(0),
  hills2: () => hills(1),
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
  reeds,
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
}

writeAtlas('WorldMap/tiles.png', [...sea, ...river, grounds, grounds2, ...roads], PAL)
writeAtlas('WorldMap/marks.png', [MARKS.map((k) => DRAW[k]())], PAL)
