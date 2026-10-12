// Chapter 1's own small pixel art (docs/chapter-1.md): what the pack lacks, drawn by code in its style.
// - Fixtures/Chalk.png: four 16x16 chalk drawings on the ground (Pell's: the shrine stone, the barrow
//   door, the bridge, the grey man at the flame);
// - Fixtures/Briar.png: a 16x16 hedge of thorns (the White Knight's kingdom; the bridge's stumps);
// - Items/CrownOfThorns.png, Items/WarmEmber.png, Items/NinthNail.png: 16x16 item icons.
//
//   npx tsx games/openworld/tools/src/art/chapter1.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [31, 26, 36, 255],
  c: [236, 232, 220, 230], // chalk
  C: [236, 232, 220, 140], // chalk, faint
  T1: [107, 74, 43, 255],
  T2: [62, 42, 24, 255],
  G: [70, 98, 52, 255], // leaf
  R: [142, 42, 42, 255],
  Y: [255, 236, 150, 255],
  O: [240, 140, 60, 255],
  E: [200, 70, 40, 255],
  S: [160, 168, 178, 255],
  s: [210, 216, 224, 255],
}

const chalk = (draw: (r: Raster) => void): Raster => {
  const r = new Raster(16, 16)
  draw(r)
  return r
}

// the shrine stone: a slab with five wounds, the first cracked
const stone = chalk((r) => {
  r.line(5, 3, 10, 3, 'c')
  r.line(5, 3, 4, 12, 'c')
  r.line(10, 3, 11, 12, 'c')
  r.line(4, 12, 11, 12, 'c')
  for (const [x, y] of [[6, 5], [9, 5], [7, 8], [6, 10], [9, 10]] as const) r.set(x, y, 'c')
  r.line(6, 5, 8, 7, 'C')
})
// the barrow door, shut, a hand-mark on it
const door = chalk((r) => {
  r.line(4, 13, 4, 5, 'c')
  r.line(11, 13, 11, 5, 'c')
  r.line(4, 5, 7, 2, 'c')
  r.line(11, 5, 8, 2, 'c')
  r.line(5, 9, 10, 9, 'C')
  for (const [x, y] of [[7, 6], [8, 6], [6, 7], [9, 7], [7, 8], [8, 8]] as const) r.set(x, y, 'c')
})
// the bridge, three boards missing
const bridge = chalk((r) => {
  r.line(1, 9, 5, 9, 'c')
  r.line(10, 9, 14, 9, 'c')
  r.line(1, 11, 5, 11, 'c')
  r.line(10, 11, 14, 11, 'c')
  for (const x of [6, 7, 8, 9]) r.set(x, 13, 'C')
  r.line(3, 4, 4, 7, 'c')
  r.line(12, 4, 11, 7, 'c')
})
// the grey man at the flame: a hooded figure, a lantern
const man = chalk((r) => {
  r.line(6, 3, 9, 3, 'c')
  r.line(5, 4, 5, 6, 'c')
  r.line(10, 4, 10, 6, 'c')
  r.line(5, 6, 4, 13, 'c')
  r.line(10, 6, 11, 13, 'c')
  r.line(4, 13, 11, 13, 'c')
  r.rect(12, 9, 2, 2, 'c')
  r.set(12, 8, 'c')
  r.set(13, 11, 'C')
})
writeAtlas('Fixtures/Chalk.png', [[stone, door, bridge, man]], PAL)

// a hedge of thorns: stems, hooked spines, a few dark leaves
const briar = new Raster(16, 16)
for (const [x0, lean] of [[3, -1], [7, 0], [11, 1], [14, 0], [5, 1], [9, -1]] as const)
  for (let y = 15; y > 3 + (x0 % 3); y--) {
    const x = Math.round(x0 + lean * (15 - y) * 0.15)
    briar.set(x, y, y % 4 === 0 ? 'T1' : 'T2')
    if (y % 3 === 0) briar.set(x + (y % 2 ? 1 : -1), y - 1, 'T2')
  }
for (const [x, y] of [[4, 9], [10, 7], [13, 11], [6, 12]] as const) briar.set(x, y, 'G')
briar.set(8, 5, 'R')
briar.outline('k')
writeAtlas('Fixtures/Briar.png', [[briar]], PAL)

// the Crown of Thorns: a twisted ring of briar, spines out, a bead of old blood
const crown = new Raster(16, 16)
crown.ellipse(8, 9, 6, 3, 'T2')
crown.ellipse(8, 9, 4, 1.5, 'T1')
crown.ellipse(8, 9, 3, 0.8, null as unknown as string)
for (let x = 3; x <= 13; x++) crown.set(x, 9, x % 2 ? 'T1' : 'T2')
for (const [x, y] of [[3, 5], [6, 4], [10, 4], [13, 5], [2, 10], [14, 10]] as const) crown.line(x, y, 8 + (x - 8) * 0.7, 8, 'T2')
crown.set(10, 11, 'R')
crown.outline('k')
writeAtlas('Items/CrownOfThorns.png', [[crown]], PAL)

// a warm ember: a coal glowing from within
const ember = new Raster(16, 16)
ember.ellipse(8, 9, 4, 3, 'E')
ember.ellipse(8, 9, 2.5, 1.8, 'O')
ember.set(8, 9, 'Y')
ember.set(7, 8, 'Y')
ember.outline('k')
writeAtlas('Items/WarmEmber.png', [[ember]], PAL)

// the ninth nail: a long square nail, pulled straight
const nail = new Raster(16, 16)
nail.line(4, 12, 11, 5, 'S', 2)
nail.line(4, 12, 11, 5, 's')
nail.rect(10, 3, 3, 3, 'S')
nail.set(3, 13, 'S')
nail.outline('k')
writeAtlas('Items/NinthNail.png', [[nail]], PAL)

console.log('chapter 1 art → public/assets/lsw/{Fixtures,Items}')
