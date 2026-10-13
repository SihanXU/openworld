// The homestead's own icons (16x16, the pack's look), drawn by code: the Dawnmark coin (its file keeps the coin's old
// name, Thornmark, as its type id does), a sack of fertilizer, a sack
// of feed, an animal crate, a bucket of milk, a golden carp. (Bait is the pack's shrimp.)
//
//   npx tsx games/openworld/tools/src/art/homestead.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [31, 26, 36, 255],
  S: [168, 178, 190, 255],
  s: [226, 232, 240, 255],
  D: [104, 112, 124, 255],
  G: [74, 140, 70, 255],
  B: [140, 98, 58, 255],
  b: [196, 150, 96, 255],
  d: [92, 62, 36, 255],
  W: [246, 246, 240, 255],
  Y: [240, 190, 60, 255],
  y: [255, 232, 140, 255],
  O: [214, 120, 40, 255],
  w: [120, 84, 52, 255],
  A: [178, 116, 28, 255],
}

const draw = (name: string, f: (r: Raster) => void) => {
  const r = new Raster(16, 16)
  f(r)
  r.outline('k')
  writeAtlas(`Items/${name}.png`, [[r]], PAL)
}

// the Dawnmark: a gold coin, the first dawn after the First Night stamped on it — a sun half risen over the horizon, its rays
// (the file keeps the coin's first name, as the type id item/misc/thornmark does: saves name it)
draw('Thornmark', (r) => {
  r.ellipse(8, 8, 5.5, 5.5, 'A')
  r.ellipse(7.6, 7.6, 4.5, 4.5, 'Y')
  // the sun, half over the horizon (pale gold, white at its heart), and the dark ground under the horizon
  r.ellipse(8, 11, 2.6, 2.6, 'y')
  r.ellipse(8, 11, 1.6, 1.6, 'W')
  r.line(4, 11, 12, 11, 'O')
  r.line(5, 12, 11, 12, 'A')
  r.line(6, 13, 10, 13, 'A')
  // its rays
  for (const [x, y] of [[8, 6], [5, 8], [11, 8]] as const) r.set(x, y, 'W')
  for (const [x, y] of [[6, 7], [10, 7]] as const) r.set(x, y, 'y')
})
// sacks: fertilizer (green band), feed (wheat band)
const sack = (band: string, mark: string) => (r: Raster) => {
  r.ellipse(8, 10, 5, 4.5, 'B')
  r.rect(5, 4, 6, 4, 'B')
  r.ellipse(7, 9, 3, 2.5, 'b')
  r.line(5, 4, 10, 4, 'd')
  r.rect(4, 9, 8, 2, band)
  r.set(8, 3, mark)
  r.set(7, 2, mark)
  r.set(9, 2, mark)
}
draw('Fertilizer', sack('G', 'G'))
draw('Feed', sack('Y', 'y'))
// an animal crate: slatted, a breathing gap
draw('Crate', (r) => {
  r.rect(2, 4, 12, 10, 'b')
  for (const y of [4, 8, 12]) r.line(2, y, 13, y, 'B')
  for (const x of [2, 13]) r.line(x, 4, x, 13, 'd')
  r.rect(6, 6, 4, 1, 'w')
})
// a bucket of milk
draw('Milk', (r) => {
  r.rect(4, 6, 8, 8, 'B')
  r.rect(5, 7, 6, 6, 'b')
  r.line(4, 9, 11, 9, 'd')
  r.ellipse(8, 6, 4, 1.2, 'W')
  r.line(3, 5, 7, 2, 'D')
  r.line(12, 5, 9, 2, 'D')
})
// a golden carp
draw('Carp', (r) => {
  r.ellipse(7, 8, 5, 3, 'Y')
  r.ellipse(6, 7, 3, 1.5, 'y')
  r.line(12, 8, 14, 5, 'O')
  r.line(12, 8, 14, 11, 'O')
  r.line(14, 5, 14, 11, 'O')
  r.set(4, 7, 'k')
  r.line(7, 5, 9, 4, 'O')
})

// the waters' fish (homestead.ts FISH): one fish drawn, coloured and stretched for each kind
const fish = (name: string, body: string, belly: string, fin: string, len: number, extra?: (r: Raster) => void) =>
  draw(name, (r) => {
    r.ellipse(7, 8, len, 2.6, body)
    r.ellipse(6, 9, len - 1.5, 1.1, belly)
    r.line(7 + len, 8, 14, 5, fin)
    r.line(7 + len, 8, 14, 11, fin)
    r.line(14, 5, 14, 11, fin)
    r.line(6, 5, 8, 4, fin)
    r.set(7 - len + 1, 7, 'k')
    extra?.(r)
  })
const FPAL: Palette = { ...PAL, a: [244, 196, 64, 255], b: [252, 232, 150, 255], c: [216, 112, 40, 255], e: [116, 150, 70, 255], f: [196, 210, 120, 255], g: [120, 110, 100, 255], h: [170, 160, 146, 255], i: [70, 80, 64, 255], j: [130, 140, 110, 255], l: [90, 140, 90, 255], m: [180, 210, 160, 255], n: [255, 246, 210, 255], o: [255, 210, 120, 255] }
Object.assign(PAL, FPAL)
fish('Sunfish', 'a', 'b', 'c', 4)
fish('Perch', 'e', 'f', 'c', 4.5, (r) => { for (const x of [5, 8, 11]) r.line(x, 6, x, 9, 'i') })
fish('Catfish', 'g', 'h', 'i', 5, (r) => { r.line(2, 9, 0, 11, 'i'); r.line(3, 10, 1, 13, 'i') })
fish('Eel', 'i', 'j', 'i', 6)
fish('Pike', 'l', 'm', 'i', 6, (r) => { r.set(2, 8, 's') })
fish('Dawnscale', 'n', 'o', 'a', 4.5, (r) => { r.set(5, 6, 'W'); r.set(9, 6, 'W'); r.set(12, 3, 'y'); r.set(3, 4, 'y') })

console.log('homestead icons → public/assets/lsw/Items')
