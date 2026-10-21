// The watch's weapon rack (docs/release-1.md): a rack of the pack's orange wood with two spears and a sword stood in
// it and a round shield hung on its end. 32x32, its foot on the cell's bottom. (The watch house and the drill yard drew
// the camp's cooking rack, pot and all, until 2026-10-21.)
//
//   npx tsx games/openworld/tools/src/art/arms-rack.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [20, 27, 27, 255],
  w: [230, 124, 66, 255],
  W: [178, 88, 50, 255],
  s: [206, 214, 226, 255], // steel
  S: [140, 150, 168, 255],
  g: [232, 188, 74, 255], // a hilt's brass
  l: [110, 66, 38, 255], // a haft, a grip
  r: [196, 70, 62, 255], // the shield's paint
  R: [150, 48, 44, 255],
  f: [150, 94, 72, 255], // the shadow on the ground
}

const r = new Raster(32, 32)
r.ellipse(15, 30, 12, 1.5, 'f')
// the rack: two feet, two uprights, the rail the hafts rest in, the low bar their butts stand on
r.rect(4, 12, 2, 17, 'w')
r.rect(22, 12, 2, 17, 'w')
r.rect(3, 27, 4, 2, 'W')
r.rect(21, 27, 4, 2, 'W')
r.rect(3, 12, 22, 2, 'w')
r.rect(3, 13, 22, 1, 'W')
r.rect(5, 24, 18, 2, 'W')
// two spears: hafts up through the rail, leaf blades over it
for (const x of [8, 18]) {
  r.rect(x, 6, 1, 18, 'l')
  r.poly([[x, 1], [x + 1, 3], [x + 1, 6], [x - 1, 6], [x - 1, 3]], 's')
  r.set(x, 4, 'S')
}
// a sword between them, point down on the bar: blade, guard, grip, pommel
r.rect(13, 12, 2, 12, 's')
r.rect(14, 12, 1, 12, 'S')
r.rect(11, 10, 6, 2, 'g')
r.rect(13, 6, 2, 4, 'l')
r.rect(13, 4, 2, 2, 'g')
// the round shield hung on the right upright
r.ellipse(26, 18, 4, 4.5, 'r')
r.ellipse(27, 19, 2.5, 3, 'R')
r.ellipse(26, 18, 1, 1, 'g')
r.outline('k', ['f'])
writeAtlas('Fixtures/ArmsRack.png', [[r]], PAL)
