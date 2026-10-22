// A scarecrow over Firstlight's fields (docs/release-1.md): a straw hat, a burlap head with a stitched face, a patched
// shirt on a crossbar with straw for hands, on a pole in a little mound. 16x32, its foot on the cell's bottom. (It was
// drawn as the training dummy until 2026-10-21: two things, one picture.)
//
//   npx tsx games/openworld/tools/src/art/scarecrow.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [36, 26, 28, 255],
  w: [146, 98, 56, 255], // the pole and the crossbar
  W: [104, 66, 38, 255],
  t: [218, 186, 128, 255], // burlap
  T: [178, 142, 92, 255],
  y: [242, 208, 98, 255], // straw
  Y: [204, 162, 62, 255],
  c: [96, 128, 170, 255], // the shirt, faded
  C: [70, 96, 138, 255],
  p: [198, 88, 66, 255], // its patch, and the hat's band
  e: [120, 84, 50, 255], // earth
  E: [92, 62, 38, 255],
  h: [110, 168, 72, 255], // grass
}

const r = new Raster(16, 32)
// the mound and its grass
r.ellipse(8, 30, 4.5, 1.6, 'e')
r.ellipse(9, 30.5, 2.5, 1, 'E')
for (const [x, y] of [[3, 30], [4, 29], [12, 30], [11, 29]] as const) r.set(x, y, 'h')
// the pole, into the mound
r.rect(7, 13, 2, 17, 'w')
r.rect(8, 13, 1, 17, 'W')
// the crossbar, under the sleeves
r.rect(2, 14, 12, 2, 'w')
r.rect(2, 15, 12, 1, 'W')
// the shirt on it: the sleeves along the bar, the body down the pole, a patch, a rope at the waist, straw below
r.rect(3, 12, 10, 3, 'c')
r.rect(3, 14, 10, 1, 'C')
r.rect(4, 15, 8, 6, 'c')
r.rect(10, 15, 2, 6, 'C')
r.rect(5, 16, 2, 2, 'p')
r.rect(4, 19, 8, 1, 'Y')
for (const [x, len] of [[4, 2], [5, 3], [6, 2], [7, 3], [8, 2], [9, 3], [10, 2], [11, 1]] as const) for (let i = 0; i < len; i++) r.set(x, 21 + i, i % 2 ? 'Y' : 'y')
// straw for hands
for (const [x, y] of [[1, 12], [2, 12], [1, 13], [2, 14], [1, 15], [13, 12], [14, 12], [14, 13], [13, 14], [14, 15]] as const) r.set(x, y, (x + y) % 2 ? 'y' : 'Y')
// the burlap head, its stitched face
r.ellipse(7.5, 8.5, 3, 3, 't')
r.rect(5, 7, 6, 4, 't')
// straw under the hat's brim
for (const [x, y] of [[4, 7], [11, 7], [4, 8], [11, 8]] as const) r.set(x, y, 'y')
r.rect(5, 10, 6, 1, 'T')
r.set(6, 8, 'k')
r.set(9, 8, 'k')
for (const x of [6, 8]) r.set(x, 10, 'W')
r.set(7, 11, 'T')
r.set(8, 11, 'T')
// the straw hat: a wide brim, its crown and band
r.rect(2, 5, 12, 1, 'y')
r.rect(3, 6, 10, 1, 'Y')
r.rect(5, 2, 6, 3, 'y')
r.rect(9, 2, 2, 3, 'Y')
r.rect(5, 4, 6, 1, 'p')
r.outline('k', ['h'])
writeAtlas('Fixtures/Scarecrow.png', [[r]], PAL)
