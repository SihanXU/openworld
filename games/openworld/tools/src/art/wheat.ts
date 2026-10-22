// Wheat's three stages (docs/release-1.md), drawn as the illustrated crops are cut (lsw/Crops/<crop>/, 16x24, rooted at
// the tile's base, docs/crop-art.md): a tuft of shoots, a stand of green blades, ripe gold heads nodding on thin stalks.
// The pack has no wheat: the game drew it as the camp sheet's kindling until 2026-10-21. What has body (a blade, an
// ear) is outlined; a stalk is a single pixel drawn under it, never outlined, so a stand reads as many thin stems.
//
//   npx tsx games/openworld/tools/src/art/wheat.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [58, 40, 28, 255], // the crops' warm dark-brown outline
  g: [126, 178, 76, 255],
  G: [82, 128, 54, 255],
  y: [240, 204, 96, 255], // ripe gold
  Y: [190, 144, 56, 255],
  c: [252, 238, 178, 255], // an ear's light
}

/** A thin stalk from the ground (y 23) up to `top`, leaning `lean` pixels at its top, laid under what is drawn. */
function stem(r: Raster, x: number, top: number, lean: number, c: string) {
  for (let y = 23; y >= top; y--) r.under(x + Math.round((lean * (23 - y)) / Math.max(1, 23 - top)), y, c)
}
/** A blade of leaf: a pixel wide, from the ground up, curving out at its tip, its shade beside it (blades are not outlined: a stand of them would be all outline). */
function blade(r: Raster, x: number, top: number, dir: number, c: string) {
  for (let y = 23; y >= top; y--) {
    const bx = x + (y < top + 3 ? dir : 0)
    r.set(bx, y, c)
    if (y > top + 1) r.under(bx + 1, y, 'k')
  }
}

// the sprout: three short blades
const sprout = new Raster(16, 24)
for (const [x, top, dir, c] of [[4, 17, -1, 'g'], [7, 15, 0, 'G'], [10, 16, 1, 'g']] as const) blade(sprout, x, top, dir, c)

// young: a stand of green blades, tall and short
const young = new Raster(16, 24)
for (const [x, top, dir, c] of [[1, 11, -1, 'g'], [4, 8, 0, 'G'], [7, 6, 0, 'g'], [10, 9, 1, 'G'], [13, 10, 1, 'g']] as const) blade(young, x, top, dir, c)

// ripe: the ears first (outlined), nodding the way their stalks lean; then the stalks under them, and a few blades
const ripe = new Raster(16, 24)
const ears: [number, number, number][] = [[2, 4, -1], [6, 2, 0], [9, 5, 0], [12, 3, 1], [14, 8, 1]]
for (const [x, top, lean] of ears)
  for (let i = 0; i < 5; i++) {
    ripe.set(x + (i > 2 ? lean : 0), top + i, i % 2 ? 'y' : 'c')
    if (i > 0 && i < 4) ripe.set(x + 1 + (i > 2 ? lean : 0), top + i, 'Y')
  }
ripe.outline('k')
for (const [x, top, lean] of ears) stem(ripe, x + lean, top + 6, -lean, 'Y')
for (const [x, top, dir] of [[4, 16, -1], [11, 15, 1], [8, 18, 0]] as const) for (let y = 23; y >= top; y--) ripe.under(x + (y < top + 2 ? dir : 0), y, 'G')

writeAtlas('Crops/wheat/sprout.png', [[sprout]], PAL)
writeAtlas('Crops/wheat/young.png', [[young]], PAL)
writeAtlas('Crops/wheat/ripe.png', [[ripe]], PAL)
