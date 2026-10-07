// The Held Ground's own pictures (16x16, the pack's look), drawn by code:
// - Fixtures/Mist.png: a bank of mist, soft and pale, three frames' worth of swirl in one;
// - Items/OathThorn.png: one thorn of the White Knight's crown, still green, on a gold cord.
//
//   npx tsx packages/tools/src/art/haven.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  w: [244, 246, 252, 235],
  W: [214, 222, 236, 210],
  v: [186, 198, 220, 170],
  k: [31, 26, 36, 255],
  G: [74, 140, 70, 255],
  g: [140, 200, 110, 255],
  Y: [236, 196, 84, 255],
}

// a bank of mist: overlapping puffs, brighter at the top, thinning to the ground
const mist = new Raster(16, 16)
const puff = (cx: number, cy: number, rx: number, ry: number, c: string) => mist.ellipse(cx, cy, rx, ry, c)
puff(8, 11, 7.5, 4.5, 'v')
puff(5, 8, 4.5, 4, 'W')
puff(11, 7, 4.8, 4.2, 'W')
puff(8, 5, 4, 3.4, 'w')
puff(4, 6, 2.2, 1.8, 'w')
puff(12, 5, 2.4, 2, 'w')
writeAtlas('Fixtures/Mist.png', [[mist]], PAL)

// the Oath-Thorn: a curved green thorn, a loop of gold cord through its base
const thorn = new Raster(16, 16)
thorn.line(5, 12, 9, 8, 'G', 2)
thorn.line(9, 8, 12, 3, 'G')
thorn.line(8, 9, 11, 4, 'g')
thorn.set(12, 2, 'g')
thorn.ellipse(4.5, 12.5, 2.4, 2.4, 'Y')
thorn.ellipse(4.5, 12.5, 1.1, 1.1, null as unknown as string)
thorn.outline('k')
writeAtlas('Items/OathThorn.png', [[thorn]], PAL)

console.log('haven art → public/assets/lsw/{Fixtures,Items}')
