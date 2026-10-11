// The smith's mark over a smith's head (24x24, beside the trainer's crossed blades): an anvil with a hammer raised
// over it.
//
//   npx tsx games/openworld/tools/src/art/smith-mark.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [36, 26, 22, 255],
  a: [92, 98, 110, 255], // anvil
  A: [150, 158, 172, 255],
  h: [196, 202, 214, 255], // hammer head
  w: [150, 98, 52, 255], // haft
  f: [255, 196, 64, 255], // sparks
}

const r = new Raster(24, 24)
// the anvil: a horn to the left, a face, a waist, a foot
r.poly([[3, 12], [8, 11], [19, 11], [19, 15], [8, 15]], 'a')
r.rect(8, 11, 11, 2, 'A')
r.rect(10, 15, 7, 3, 'a')
r.rect(7, 18, 13, 3, 'a')
r.rect(7, 18, 13, 1, 'A')
// the hammer, raised: a haft up to the right, its head across the top
r.line(14, 9, 19, 3, 'w', 2)
r.rect(15, 1, 7, 3, 'h')
r.rect(15, 3, 7, 1, 'A')
// sparks off the face
for (const [x, y] of [[9, 8], [6, 7], [11, 6]] as const) r.set(x, y, 'f')
r.outline('k')
writeAtlas('Ui/SmithMark.png', [[r]], PAL)
