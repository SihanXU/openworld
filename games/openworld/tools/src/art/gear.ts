// Worn gear the pack has no icon for (16x16, its look), drawn by code: pauldrons, a belt, an earring; a bow (the pack's
// is its in-hand sprite, a flat arc that reads as a bowl); and the bundle any gear shows as while it lies on the ground
// (its own icon only once picked up).
//
//   npx tsx packages/tools/src/art/gear.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [31, 26, 36, 255],
  S: [150, 160, 172, 255],
  s: [214, 222, 230, 255],
  D: [96, 104, 116, 255],
  L: [140, 92, 52, 255],
  l: [186, 132, 80, 255],
  G: [236, 196, 84, 255],
  g: [255, 236, 150, 255],
  B: [90, 170, 230, 255],
  w: [236, 232, 220, 255],
  R: [204, 64, 64, 255],
}

// pauldrons: two curved plates over the shoulders, a strap between
const pauldrons = new Raster(16, 16)
for (const cx of [4, 11]) {
  pauldrons.ellipse(cx, 8, 3.2, 2.6, 'S')
  pauldrons.ellipse(cx, 7, 2, 1.4, 's')
  pauldrons.line(cx - 3, 10, cx + 3, 10, 'D')
}
pauldrons.line(6, 7, 9, 7, 'L')
pauldrons.outline('k')
writeAtlas('Items/Pauldrons.png', [[pauldrons]], PAL)

// a belt: a leather band coiled once, a gold buckle
const belt = new Raster(16, 16)
belt.ellipse(8, 8, 6, 4, 'L')
belt.ellipse(8, 8, 4.4, 2.6, null as unknown as string)
for (let x = 3; x <= 13; x++) belt.set(x, 5, 'l')
belt.rect(6, 9, 4, 4, 'G')
belt.rect(7, 10, 2, 2, null as unknown as string)
belt.set(6, 9, 'g')
belt.outline('k')
writeAtlas('Items/Belt.png', [[belt]], PAL)

// an earring: a small gold hoop and a blue drop
const earring = new Raster(16, 16)
earring.ellipse(8, 6, 3, 3, 'G')
earring.ellipse(8, 6, 1.6, 1.6, null as unknown as string)
earring.set(7, 3, 'g')
earring.line(8, 9, 8, 10, 'G')
earring.ellipse(8, 12, 1.6, 2, 'B')
earring.set(7, 11, 's')
earring.outline('k')
writeAtlas('Items/Earring.png', [[earring]], PAL)

// a bow: a recurved limb on the diagonal, a gold grip, an arrow nocked across it (red fletching, a steel head); the
// string is drawn after the outline, so it stays a fine line
const bow = new Raster(16, 16)
const limb = (t: number): [number, number] => {
  // a curve from the upper tip (13,2) to the lower (2,13), bowed out toward the upper left
  const [a, c, b] = [[13, 2], [2.5, 2.5], [2, 13]]
  return [0, 1].map((i) => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * c[i] + t ** 2 * b[i]) as [number, number]
}
for (let t = 0; t <= 1; t += 0.02) {
  const [x, y] = limb(t)
  bow.set(Math.round(x), Math.round(y), 'l')
  bow.set(Math.round(x) + 1, Math.round(y), 'L')
}
// the tips curl back (recurve)
bow.set(14, 2, 'L')
bow.set(2, 14, 'L')
// the grip, wrapped in gold
for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]] as const) bow.set(x, y, 'G')
bow.set(5, 5, 'g')
// the arrow: shaft from the string to past the grip, head at the upper left, fletching at the string
bow.line(4, 4, 11, 11, 'l')
for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]] as const) bow.set(x, y, 'S')
bow.set(2, 2, 's')
for (const [x, y] of [[11, 12], [12, 11], [12, 12]] as const) bow.set(x, y, 'R')
bow.outline('k')
for (let i = 0; i <= 10; i++) if (!['R', 'l', 'L', 'G'].includes(bow.get(13 - i, 3 + i) ?? '')) bow.set(13 - i, 3 + i, 'w')
writeAtlas('Items/Bow.png', [[bow]], PAL)

// gear on the ground: a cloth bundle tied with a cord, a glint of what is inside
const loot = new Raster(16, 16)
loot.ellipse(8, 10, 5.5, 4, 'L')
loot.ellipse(7, 9, 3.5, 2.4, 'l')
loot.line(5, 6, 11, 6, 'L')
loot.rect(7, 4, 2, 3, 'l')
loot.line(4, 8, 12, 8, 'G')
loot.set(12, 4, 'g')
loot.set(13, 3, 'g')
loot.set(11, 3, 's')
loot.set(13, 5, 's')
loot.outline('k')
writeAtlas('Items/Loot.png', [[loot]], PAL)

console.log('gear icons → public/assets/lsw/Items')
