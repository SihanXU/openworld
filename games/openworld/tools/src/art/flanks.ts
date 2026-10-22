// The forest's flanks' own pictures (docs/chapter-1.md §15, docs/release-1.md): what the pack has none of.
//
// - The Charcoal Dell: the soot a kiln breathes onto the ground before its mouth, a soft dark apron over the earth
//   (48x32; the ground's `ash` was a hard square under grey tufts).
// - The Reed Bend: the fisher's nets hung to dry on a pole between two posts (32x32; the camp's cooking rack stood in
//   for them, pot and all), her rack of fish drying (32x32), and reeds as reeds — clumps of cattails, four of them
//   (16x24 each; the pack's grass tufts stood in for them).
// - The ground of a bank: sand and mud as the pack's dirt road is drawn on grass, its 47 pieces recoloured, so a beach
//   or a mud flat has soft edges on the grass round it (both were hard squares).
//
//   npx tsx games/openworld/tools/src/art/flanks.ts

import { fileURLToPath } from 'node:url'
import { Raster, writeAtlas, type Palette } from './raster.ts'
import { readPng, writePng } from './png.ts'

const INK: Palette[string] = [20, 27, 27, 255]

// ------------------------------------------------------------------ the kiln's soot

/** A small hash of a cell, for the soot's ragged edge and its flecks (deterministic). */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

{
  const PAL: Palette = {
    a: [34, 28, 26, 180], // the soot at its thickest
    b: [44, 37, 33, 135],
    c: [56, 48, 42, 85], // thinning out
    d: [64, 56, 50, 40],
    k: [22, 20, 20, 235], // a fleck of charcoal
    g: [150, 146, 138, 200], // a fleck of pale ash
  }
  const r = new Raster(48, 32)
  // an apron wider than deep, its edge ragged; thickest just before the mouth (the top middle)
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 48; x++) {
      const dx = (x - 24) / 21
      const dy = (y - 15) / 11
      const d = Math.sqrt(dx * dx + dy * dy) + (hash(x, y) - 0.5) * 0.22 + (hash(x >> 2, y >> 2) - 0.5) * 0.18
      if (d > 1) continue
      const key = d < 0.45 ? 'a' : d < 0.68 ? 'b' : d < 0.86 ? 'c' : 'd'
      r.set(x, y, key)
    }
  // flecks: charcoal crumbs where it is thick, a little pale ash
  for (let y = 2; y < 30; y++)
    for (let x = 4; x < 44; x++) {
      const k = r.get(x, y)
      if (!k) continue
      const h = hash(x + 91, y + 17)
      if ((k === 'a' || k === 'b') && h < 0.06) r.set(x, y, 'k')
      else if (k !== 'd' && h > 0.975) r.set(x, y, 'g')
    }
  writeAtlas('Fixtures/Soot.png', [[r]], PAL)
}

// ------------------------------------------------------------------ the fisher's nets, drying

{
  const PAL: Palette = {
    k: INK,
    w: [230, 124, 66, 255], // the pack's orange wood
    W: [178, 88, 50, 255],
    n: [226, 214, 182, 255], // the net's twine
    N: [168, 150, 116, 255],
    f: [212, 78, 70, 255], // a float
    s: [150, 94, 72, 255], // the shadow on the ground
  }
  const r = new Raster(32, 32)
  r.ellipse(16, 30, 13, 1.6, 's')
  // two posts and the pole across them
  r.rect(3, 7, 2, 22, 'w')
  r.rect(4, 7, 1, 22, 'W')
  r.rect(27, 7, 2, 22, 'w')
  r.rect(28, 7, 1, 22, 'W')
  r.rect(1, 5, 30, 2, 'w')
  r.rect(1, 6, 30, 1, 'W')
  r.outline('k', ['s'])
  // the net hung over the pole: a lattice of twine (open between, the ground showing through), its foot sagging,
  // a fold where it gathers by each post; drawn after the outline, so its holes stay open
  const foot = (x: number) => Math.round(21 + 4 * Math.sin((Math.PI * (x - 6)) / 20))
  for (let x = 6; x <= 25; x++)
    for (let y = 8; y <= foot(x); y++) if ((x + y) % 4 === 0 || (x - y + 32) % 4 === 0) r.set(x, y, (x + y) % 8 === 0 ? 'N' : 'n')
  for (let x = 6; x <= 25; x++) (r.set(x, foot(x), 'N'), r.set(x, foot(x) + 1, 'k'))
  for (const x of [6, 25]) for (let y = 8; y <= foot(x); y++) r.set(x, y, 'N')
  // the floats along the top, cork-red
  for (const x of [8, 13, 18, 23]) (r.rect(x, 7, 2, 2, 'f'), r.set(x, 9, 'k'), r.set(x + 1, 9, 'k'))
  writeAtlas('Fixtures/Nets.png', [[r]], PAL)
}

// ------------------------------------------------------------------ the fish, drying on their rack

{
  const PAL: Palette = {
    k: INK,
    w: [230, 124, 66, 255],
    W: [178, 88, 50, 255],
    s: [206, 214, 222, 255], // a fish's belly
    S: [128, 142, 158, 255], // its back
    t: [98, 108, 124, 255], // its tail
    l: [110, 66, 38, 255], // the cord it hangs by
    f: [150, 94, 72, 255],
  }
  const r = new Raster(32, 32)
  r.ellipse(16, 30, 13, 1.6, 'f')
  r.rect(3, 6, 2, 23, 'w')
  r.rect(4, 6, 1, 23, 'W')
  r.rect(27, 6, 2, 23, 'w')
  r.rect(28, 6, 1, 23, 'W')
  r.rect(1, 5, 30, 2, 'w')
  r.rect(1, 6, 30, 1, 'W')
  r.rect(5, 17, 22, 2, 'w')
  r.rect(5, 18, 22, 1, 'W')
  /** A fish hung head down by its tail from a pole at `y`: the forked tail at the cord, the body widening to four, the head, an eye. */
  const fish = (x: number, y: number, len: number) => {
    r.set(x + 1, y, 'l')
    r.set(x + 2, y, 'l')
    r.set(x, y + 1, 't')
    r.set(x + 3, y + 1, 't')
    r.rect(x + 1, y + 2, 2, 1, 't')
    r.rect(x + 1, y + 3, 2, 1, 'S')
    r.rect(x, y + 4, 4, len, 's')
    r.rect(x, y + 4, 1, len, 'S')
    r.rect(x + 1, y + 4 + len, 2, 1, 's')
    r.set(x + 2, y + 2 + len, 'k')
  }
  for (const [x, len] of [[6, 5], [11, 4], [16, 5], [21, 4]] as const) fish(x, 7, len)
  for (const [x, len] of [[8, 4], [13, 5], [19, 4]] as const) fish(x, 19, len)
  r.outline('k', ['f'])
  writeAtlas('Fixtures/FishRack.png', [[r]], PAL)
}

// ------------------------------------------------------------------ reeds

{
  const PAL: Palette = {
    k: INK,
    g: [120, 168, 58, 255], // a blade
    G: [78, 124, 48, 255],
    h: [124, 74, 42, 255], // a cattail's head
    H: [92, 52, 32, 255],
    p: [206, 196, 150, 255], // its spike
  }
  /** A clump: each stem [x, height, has a head], blades from its foot. */
  const clump = (stems: [number, number, boolean][], blades: [number, number, number][]) => {
    const r = new Raster(16, 24)
    for (const [x, h, head] of stems) {
      r.rect(x, 23 - h, 1, h, 'G')
      if (head) {
        r.rect(x - 1, 23 - h + 1, 2, 5, 'h')
        r.rect(x, 23 - h + 1, 1, 5, 'H')
        r.set(x, 23 - h - 1, 'p')
        r.set(x, 23 - h, 'p')
      }
    }
    // blades: from the foot up and out, [x at the foot, lean, height]
    for (const [x, lean, h] of blades) r.line(x, 23, x + lean, 23 - h, 'g')
    r.outline('k')
    return r
  }
  const frames = [
    clump([[5, 18, true], [9, 21, true], [12, 14, false]], [[3, -2, 9], [7, 1, 12], [11, 3, 8]]),
    clump([[4, 15, true], [8, 19, false], [11, 20, true]], [[6, -3, 10], [9, 2, 13], [13, 2, 7]]),
    clump([[7, 20, true], [11, 16, true]], [[3, -1, 8], [5, 2, 13], [9, -2, 11], [13, 1, 9]]),
    clump([[4, 13, false], [8, 17, true], [12, 15, false]], [[6, -3, 9], [10, 3, 10], [2, 0, 6]]),
  ]
  writeAtlas('Fixtures/Reeds.png', [frames], PAL)
}

// ------------------------------------------------------------------ sand and mud on grass

{
  // the pack's dirt road on grass (TilesetFloor cols 0-10, rows 7-11: the 47-piece blob the ground is drawn with),
  // its six colours: two of the road, two of the grass, a highlight and a shade of the road
  const SHEET = fileURLToPath(new URL('../../../public/assets/na/Backgrounds/Tilesets/TilesetFloor.png', import.meta.url))
  const src = readPng(SHEET)
  const W = 11 * 16
  const H = 5 * 16
  const key = (r: number, g: number, b: number) => `${r},${g},${b}`
  /** The block with the road's four colours swapped for a ground's (the grass kept). */
  const recolour = (to: Record<string, [number, number, number]>) => {
    const out = new Uint8Array(W * H * 4)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const s = ((7 * 16 + y) * src.w + x) * 4
        const [r, g, b, a] = [src.rgba[s], src.rgba[s + 1], src.rgba[s + 2], src.rgba[s + 3]]
        const c = to[key(r, g, b)] ?? [r, g, b]
        out.set([c[0], c[1], c[2], a], (y * W + x) * 4)
      }
    return out
  }
  const ROAD = key(211, 134, 95)
  const ROAD_DARK = key(189, 121, 89)
  const ROAD_HI = key(230, 165, 120)
  const ROAD_SHADE = key(173, 112, 75)
  // sand: the pack's own sand colours
  writePng('Tiles/Sand.png', W, H, recolour({ [ROAD]: [255, 203, 141], [ROAD_DARK]: [242, 184, 120], [ROAD_HI]: [255, 226, 182], [ROAD_SHADE]: [214, 150, 96] }))
  // mud: wet dark earth, a sheen on it
  writePng('Tiles/Mud.png', W, H, recolour({ [ROAD]: [124, 94, 66], [ROAD_DARK]: [104, 78, 56], [ROAD_HI]: [150, 128, 104], [ROAD_SHADE]: [86, 64, 46] }))
}
