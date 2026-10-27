// The fog at a boss's door (docs/boss-rooms.md): a column of gold-white mist two cells tall standing on its one cell,
// thin enough to see the dark of the gate behind it, streaked upward where it moves; three looks, so a gate of several
// is never a row of the same picture. → Fixtures/Fog.png (three frames of 16x32 in a row).
//
//   npx tsx games/openworld/tools/src/art/fog.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  // the bright core, its gold, the thin edge, the streaks that rise
  w: [255, 250, 232, 225],
  y: [246, 214, 130, 210],
  v: [255, 246, 222, 150],
  t: [255, 248, 228, 80],
  s: [255, 255, 246, 240],
}

/** A small hash of three integers in [0, 1). */
function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function column(k: number): Raster {
  const r = new Raster(16, 32)
  // the thin body: a soft wavering column, widest near the ground
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 16; x++) {
      const half = 7.4 - (31 - y) * 0.06 + Math.sin(y * 0.4 + k * 2.1) * 0.8
      if (Math.abs(x - 7.5) <= half) r.set(x, y, 't')
    }
  // puffs rolling up it, a brighter core in each, a glint of gold at their edge
  for (let i = 0; i < 6; i++) {
    const cy = 28 - i * 5 - (k % 2) * 2
    const cx = 7.5 + Math.sin(i * 1.7 + k) * 2.2
    r.ellipse(cx, cy, 5.4 - i * 0.35, 3.2, 'v')
    r.ellipse(cx - 0.6, cy - 0.8, 3 - i * 0.2, 1.8, 'w')
    r.set(Math.round(cx + 4 - i * 0.3), Math.round(cy), 'y')
  }
  // streaks rising through it
  for (let x = 2; x < 14; x++) if (hash(x, k, 7) < 0.18) for (let y = 3 + Math.floor(hash(x, k, 8) * 8); y < 20 + Math.floor(hash(x, k, 9) * 8); y++) r.set(x, y, 's')
  return r
}

writeAtlas('Fixtures/Fog.png', [[column(0), column(1), column(2)]], PAL)
