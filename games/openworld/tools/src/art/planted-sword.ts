// The Held Ground's heart (haven.ts): Alberic's longsword, point down in the earth, a little crooked — a knight's blade,
// steel with a gold guard and a leather grip, in a small mound of turned earth with grass round it. 16x32, its foot on
// the cell's bottom.
//
//   npx tsx games/openworld/tools/src/art/planted-sword.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [30, 24, 30, 255],
  s: [214, 222, 232, 255], // blade, lit
  S: [150, 160, 176, 255], // blade, shade
  f: [246, 250, 255, 255], // the fuller's gleam
  g: [232, 188, 74, 255], // guard and pommel
  G: [168, 120, 40, 255],
  l: [110, 66, 38, 255], // grip
  L: [78, 44, 24, 255],
  e: [120, 84, 50, 255], // earth
  E: [92, 62, 38, 255],
  h: [110, 168, 72, 255], // grass
}

const r = new Raster(16, 32)
// the mound it stands in, and grass round it
r.ellipse(8, 29.5, 6.5, 2.5, 'e')
r.ellipse(9.5, 30, 4, 1.6, 'E')
for (const [x, y] of [[2, 29], [3, 28], [13, 29], [12, 28], [5, 30], [11, 31]] as const) r.set(x, y, 'h')
// the blade, leaning a pixel to the right as it goes down (a little crooked), into the earth
for (let y = 12; y <= 28; y++) {
  const x = 7 + (y > 20 ? 1 : 0)
  r.set(x, y, 's')
  r.set(x + 1, y, 'S')
  if (y > 13 && y < 26) r.set(x, y, y % 5 === 0 ? 'f' : 's')
}
// the guard
r.rect(3, 10, 10, 2, 'g')
r.rect(3, 11, 10, 1, 'G')
r.set(2, 10, 'G')
r.set(13, 10, 'G')
// the grip, wrapped
for (let y = 4; y <= 9; y++) {
  r.set(7, y, y % 2 ? 'l' : 'L')
  r.set(8, y, y % 2 ? 'L' : 'l')
}
// the pommel
r.rect(6, 1, 4, 3, 'g')
r.rect(8, 2, 2, 2, 'G')
r.outline('k', ['h'])
writeAtlas('Fixtures/PlantedSword.png', [[r]], PAL)
