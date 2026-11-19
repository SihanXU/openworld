// The Cloudtop watchman's wall hooks, cloak, writing desk, chair and barrel.
//   npx tsx games/openworld/tools/src/art/watch-shelter.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const palette: Palette = {
  k: [29, 29, 27, 255],
  s: [38, 47, 40, 255],
  g: [74, 89, 69, 255],
  h: [107, 119, 88, 255],
  a: [175, 125, 61, 255],
  w: [83, 55, 39, 255],
  b: [131, 91, 61, 255],
  l: [165, 119, 78, 255],
  p: [211, 177, 117, 255],
  c: [237, 215, 155, 255],
  i: [140, 114, 71, 255],
  n: [59, 67, 66, 255],
  barrelOutline: [48, 30, 25, 255],
  oakShade: [112, 59, 36, 255],
  oak: [167, 89, 44, 255],
  oakLight: [198, 113, 53, 255],
  endGrain: [225, 153, 75, 255],
  endLight: [246, 187, 104, 255],
  ironShade: [53, 47, 48, 255],
  iron: [80, 75, 76, 255],
  ironLight: [137, 123, 113, 255],
  brass: [223, 160, 79, 255],
}

function hooks(): Raster {
  const rail = new Raster(32, 24)
  rail.rect(6, 3, 20, 4, 'w')
  rail.line(6, 3, 25, 3, 'b')
  for (const x of [8, 15, 22]) {
    rail.rect(x, 1, 2, 6, 'l')
    rail.set(x + 1, 6, 'a')
  }
  rail.outline()
  return rail
}

const cloak = hooks()
cloak.poly([[13, 8], [20, 8], [23, 12], [26, 21], [22, 22], [17, 23], [11, 22], [6, 21], [10, 12]], 'g')
cloak.poly([[16, 10], [19, 12], [20, 22], [17, 23], [14, 22]], 's')
cloak.line(12, 13, 9, 20, 'h')
cloak.line(14, 14, 12, 21, 's')
cloak.line(22, 13, 24, 20, 'h')
cloak.ellipse(16, 8, 6, 4, 'h')
cloak.ellipse(16, 8, 4, 3, 's')
cloak.line(11, 11, 16, 13, 'h')
cloak.rect(18, 11, 2, 2, 'a')
cloak.outline()

const desk = new Raster(32, 24)
desk.rect(3, 12, 3, 10, 'w')
desk.rect(26, 12, 3, 10, 'w')
desk.rect(4, 13, 1, 8, 'b')
desk.rect(27, 13, 1, 8, 'b')
desk.rect(1, 8, 30, 8, 'w')
desk.rect(2, 4, 28, 9, 'b')
desk.line(2, 4, 29, 4, 'l')
desk.line(2, 8, 29, 8, 'w')
desk.line(2, 12, 29, 12, 'l')
desk.rect(8, 3, 15, 9, 'w')
desk.poly([[8, 3], [13, 3], [15, 4], [17, 3], [22, 3], [22, 10], [17, 10], [15, 11], [13, 10], [8, 10]], 'p')
desk.rect(9, 3, 5, 6, 'c')
desk.rect(17, 3, 5, 6, 'c')
desk.line(15, 4, 15, 9, 'i')
for (const y of [5, 7]) {
  desk.line(10, y, 13, y, 'i')
  desk.line(17, y, 20, y, 'i')
}
desk.rect(25, 5, 3, 4, 'n')
desk.rect(25, 5, 3, 1, 'k')
desk.set(26, 5, 'n')
desk.outline('k')

const chair = new Raster(32, 24)
chair.line(8, 12, 8, 20, 'w', 2)
chair.line(22, 13, 22, 19, 'w', 2)
chair.line(16, 16, 16, 22, 'w', 2)
chair.poly([[7, 11], [15, 8], [24, 12], [17, 17]], 'b')
chair.line(8, 12, 17, 17, 'w', 2)
chair.line(17, 17, 23, 13, 'l')
chair.poly([[7, 2], [16, 7], [16, 14], [7, 9]], 'b')
chair.line(7, 2, 16, 7, 'l')
chair.line(8, 5, 15, 9, 'w', 2)
chair.line(7, 9, 16, 14, 'w')
chair.outline()

function barrel(open: boolean): Raster {
  const wood = new Raster(32, 24)
  wood.poly([[9, 5], [23, 5], [24, 11], [26, 15], [25, 18], [23, 21], [20, 22], [12, 22], [9, 21], [7, 18], [6, 15], [8, 11]], 'oak')
  // The staves bow with the belly and draw back together at the foot.
  wood.poly([[10, 6], [14, 7], [12, 14], [13, 22], [11, 21], [9, 18], [8, 14]], 'oakLight')
  wood.poly([[20, 6], [23, 6], [24, 11], [26, 15], [25, 18], [23, 21], [20, 22], [22, 15]], 'oakShade')
  for (const [top, middle, foot] of [[11, 9, 11], [14, 13, 14], [19, 19, 18], [22, 23, 21]]) {
    wood.line(top, 8, middle, 14, 'oakShade')
    wood.line(middle, 14, foot, 21, 'oakShade')
  }
  wood.line(10, 14, 10, 16, 'endGrain')
  wood.line(16, 15, 16, 17, 'oakLight')
  wood.set(17, 15, 'oakShade')

  // Two iron hoops curve down across the front, with their rivets catching the light.
  wood.poly([[8, 8], [11, 10], [16, 11], [21, 10], [24, 8], [25, 11], [22, 13], [16, 14], [10, 13], [7, 11]], 'ironShade')
  wood.poly([[8, 9], [11, 11], [16, 12], [21, 11], [24, 9], [24, 11], [21, 12], [16, 13], [11, 12], [8, 11]], 'iron')
  wood.line(9, 10, 13, 12, 'ironLight')
  wood.poly([[6, 15], [10, 17], [16, 18], [22, 17], [26, 15], [25, 18], [22, 20], [16, 21], [10, 20], [7, 18]], 'ironShade')
  wood.poly([[7, 16], [10, 18], [16, 19], [22, 18], [25, 16], [25, 17], [22, 19], [16, 20], [10, 19], [7, 17]], 'iron')
  wood.line(8, 17, 13, 19, 'ironLight')
  for (const [x, y] of [[10, 11], [16, 12], [22, 11], [10, 18], [16, 19], [22, 18]]) wood.set(x, y, 'brass')

  // The lid sits inside a raised wooden rim. Opening the barrel shows the dark interior.
  wood.ellipse(16, 5.5, 8.5, 4.5, 'endGrain')
  wood.ellipse(16, 5.5, 7, 3.5, 'barrelOutline')
  if (open) {
    wood.ellipse(16, 6.5, 6, 2.2, 'oakShade')
    wood.line(12, 7, 19, 8, 'oak')
  } else {
    wood.ellipse(16, 5.2, 6.5, 2.7, 'endGrain')
    wood.line(13, 4, 13, 7, 'oak')
    wood.line(18, 3, 18, 7, 'oak')
    wood.line(14, 4, 16, 3, 'endLight')
    wood.set(16, 6, 'oakLight')
    wood.set(20, 5, 'oak')
  }
  wood.line(11, 2, 14, 1, 'endLight')
  wood.line(10, 8, 13, 9, 'endLight')
  wood.line(20, 9, 23, 7, 'oakLight')
  wood.outline('barrelOutline')
  return wood
}

writeAtlas('Fixtures/WatchShelter.png', [[cloak, desk, hooks(), chair, barrel(false), barrel(true)]], palette)
