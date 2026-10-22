// The bell rope in the tower of the Chapel of the First Dawn (docs/chapter-1.md §13): a rope come down from the bell
// out of sight above, its woollen grip (the sally) faded red and cream, its end hanging loose. 16x32, a prefab a cell
// wide and two tall hung from the tower's north wall (the pack has none).
//
//   npx tsx games/openworld/tools/src/art/bell-rope.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [20, 27, 27, 255],
  r: [198, 168, 118, 255], // hemp
  R: [150, 118, 78, 255],
  s: [190, 78, 70, 255], // the sally's red
  S: [146, 56, 56, 255],
  c: [236, 222, 196, 255], // and its cream
}

const r = new Raster(16, 32)
// the rope, twisted: light and dark by turns down its length
for (let y = 0; y < 27; y++) {
  r.set(7, y, (y >> 1) % 2 ? 'r' : 'R')
  r.set(8, y, (y >> 1) % 2 ? 'R' : 'r')
}
// the sally: a woollen grip in bands, a little wider than the rope
for (let y = 15; y < 23; y++) {
  const band = Math.floor((y - 15) / 2) % 2 ? 'c' : 's'
  r.rect(6, y, 4, 1, band)
  r.set(9, y, band === 's' ? 'S' : 'r')
}
// its tail, hanging loose and frayed
for (const [x, y] of [[7, 27], [8, 27], [7, 28], [8, 28], [6, 29], [9, 29]] as const) r.set(x, y, 'R')
r.outline('k')
writeAtlas('Fixtures/BellRope.png', [[r]], PAL)
