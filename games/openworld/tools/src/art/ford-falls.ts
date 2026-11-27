// The falls at the head of Vesper Ford (the pack has no waterfall): the river comes over the north cliff between the
// mossy cliff's two ends and falls the cliff's height into the pool it runs on from.
//
// One picture, eight cells wide and three tall (128x48), a prefab laid over the river's top rows (its cells stay the
// river's water): the lip where the water bends over the brink, the falling sheet in the pack's two water blues with
// white and pale streaks running down it, a shadow where it meets the rock at each side, and the white water boiling
// at its foot, its last rows the river's own light blue so it runs on into the river below without a seam.
//
//   npx tsx games/openworld/tools/src/art/ford-falls.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [20, 27, 27, 255], // the pack's ink
  w: [113, 221, 238, 255], // the river's light water (TilesetWater)
  d: [121, 184, 206, 255], // its deeper water
  D: [86, 140, 168, 255], // the sheet's shadowed streaks
  p: [178, 238, 247, 255], // pale water catching the light
  f: [255, 255, 255, 255], // foam
  r: [86, 99, 77, 255], // the cliff's dark moss (TilesetRelief)
  R: [70, 64, 46, 255], // the cliff's deepest shadow
}

const W = 128
const H = 48
const falls = new Raster(W, H)
/** A fixed pseudo-random value for a column and a seed, so the picture is the same every time it is drawn. */
const hash = (x: number, s: number) => {
  let h = (x * 374761393 + s * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// the falling sheet: the light water, darker toward its sides where the rock shades it
falls.rect(0, 0, W, H, 'w')
for (let x = 0; x < W; x++) {
  const side = Math.min(x, W - 1 - x)
  if (side < 6) falls.rect(x, 4, 1, 34, 'd')
}
// the lip: the brink the water bends over, a pale band with a white crest, a little uneven
for (let x = 0; x < W; x++) {
  const crest = 2 + Math.round(hash(x >> 2, 1) * 1.4)
  falls.rect(x, 0, 1, crest, 'd')
  falls.set(x, crest, 'p')
  falls.set(x, crest + 1, hash(x, 2) < 0.55 ? 'f' : 'p')
  falls.set(x, crest + 2, 'p')
}
// the streaks: runs of deep, shadowed, pale and white water down the sheet, each column its own length
for (let x = 1; x < W - 1; x++) {
  const n = hash(x, 3)
  const top = 5 + Math.floor(hash(x, 4) * 10)
  const len = 8 + Math.floor(hash(x, 5) * 22)
  const c = n < 0.22 ? 'd' : n < 0.32 ? 'D' : n < 0.58 ? 'p' : n < 0.7 ? 'f' : null
  if (c) falls.rect(x, top, 1, Math.min(len, 38 - top), c)
  // a second, shorter run lower down
  if (hash(x, 6) < 0.35) falls.rect(x, 24 + Math.floor(hash(x, 7) * 8), 1, 4 + Math.floor(hash(x, 8) * 6), hash(x, 9) < 0.5 ? 'p' : 'd')
}
// where the sheet meets the rock at each side: the cleft's shadow and a thread of moss
for (let y = 3; y < 40; y++) {
  const l = hash(y >> 1, 10) < 0.5 ? 1 : 2
  const r = hash(y >> 1, 11) < 0.5 ? 1 : 2
  falls.rect(0, y, l, 1, y < 6 ? 'r' : 'R')
  falls.rect(W - r, y, r, 1, y < 6 ? 'r' : 'R')
  falls.set(l, y, 'D')
  falls.set(W - r - 1, y, 'D')
}
// the white water at its foot: a band of boiling foam, puffs breaking up and down out of it
for (let x = 0; x < W; x++) {
  const mid = 38 + Math.round(hash(x >> 3, 12) * 2)
  const up = 1 + Math.floor(hash(x >> 1, 13) * 4)
  const down = 1 + Math.floor(hash(x >> 1, 14) * 4)
  falls.rect(x, mid - up, 1, up + down, 'f')
  falls.set(x, mid - up - 1, 'p')
  if (hash(x, 15) < 0.4) falls.set(x, mid + down, 'p')
}
// bubbles on the pool below the foam, thinning out toward the river
for (let i = 0; i < 46; i++) {
  const x = Math.floor(hash(i, 16) * (W - 4)) + 2
  const y = 43 + Math.floor(hash(i, 17) * 4)
  falls.set(x, y, hash(i, 18) < 0.6 ? 'f' : 'p')
  if (hash(i, 19) < 0.4 && x + 1 < W) falls.set(x + 1, y, 'p')
}
// the last row is the river's own water, so the pool runs on into the river's tiles
falls.rect(0, H - 1, W, 1, 'w')

writeAtlas('Fixtures/FordFalls.png', [[falls]], PAL)

// ------------------------------------------------------------------ a rock in the river (16x16, one cell)
// A grey stone standing out of the current, wet and dark below, its top catching the light, the water breaking white
// round its foot; the cell's ground is the river's light water, so it lies on the river's open tiles.
const STONE: Palette = {
  ...PAL,
  s: [168, 168, 176, 255], // stone (the project's own, tools/src/art/mill.ts)
  S: [128, 128, 138, 255],
  T: [92, 92, 102, 255],
  l: [206, 206, 212, 255],
  m: [95, 113, 96, 255], // a little moss (TilesetRelief)
}
const rock = new Raster(16, 16)
rock.rect(0, 0, 16, 16, 'w')
// the stone: its wet foot, its body, the lit top, a little moss
rock.ellipse(8, 9.5, 5, 3.2, 'T')
rock.ellipse(8, 7.8, 4.7, 4, 'S')
rock.ellipse(7.5, 6.9, 3.8, 3, 's')
rock.ellipse(6.6, 5.8, 2, 1.3, 'l')
for (const [x, y] of [[10, 5], [10, 6], [11, 6], [11, 7]] as const) rock.set(x, y, 'm')
// its outline, in the pack's ink, round the stone alone
const isStone = (x: number, y: number) => 'TSslm'.includes(rock.get(x, y) ?? '-')
const outline: [number, number][] = []
for (let y = 0; y < 16; y++)
  for (let x = 0; x < 16; x++)
    if (!isStone(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isStone(x + dx, y + dy))) outline.push([x, y])
for (const [x, y] of outline) rock.set(x, y, 'k')
// the water breaking white round its foot, a ring of foam on the water alone (never over the stone or its ink),
// wider downstream, and the pale water it spreads into
const onWater = (x: number, y: number) => rock.get(x, y) === 'w'
for (let y = 0; y < 16; y++)
  for (let x = 0; x < 16; x++) {
    const d = ((x + 0.5 - 8) / 7.2) ** 2 + ((y + 0.5 - 11) / 3.6) ** 2
    if (onWater(x, y) && y >= 8 && d <= 1) rock.set(x, y, d > 0.55 || y >= 12 ? 'f' : 'p')
  }
for (const [x, y] of [[2, 14], [3, 15], [12, 15], [13, 14], [7, 15], [8, 15]] as const) if (onWater(x, y)) rock.set(x, y, 'p')
// a little white upstream, where the current meets it
for (const [x, y] of [[5, 1], [6, 1], [9, 1], [10, 1], [4, 2], [11, 2]] as const) if (onWater(x, y)) rock.set(x, y, 'f')

writeAtlas('Fixtures/RiverRock.png', [[rock]], STONE)
