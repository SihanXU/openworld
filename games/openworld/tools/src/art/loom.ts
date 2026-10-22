// Cass's loom (docs/release-1.md): a frame loom in the pack's wood, its warp threads strung from the top beam, the
// heddle bar across them, and the cloth woven so far — blue with red stripes — rolled toward the front beam. 32x32,
// its foot on the cell's bottom. (The game drew the pack's bare washing-line posts for it until 2026-10-21.)
//
//   npx tsx games/openworld/tools/src/art/loom.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [20, 27, 27, 255], // the pack's ink
  w: [230, 124, 66, 255], // its orange wood
  W: [178, 88, 50, 255],
  t: [238, 230, 212, 255], // the warp
  c: [98, 142, 192, 255], // the cloth
  C: [72, 106, 152, 255],
  r: [212, 78, 70, 255],
  s: [150, 94, 72, 255], // the shadow on the floor
}

const r = new Raster(32, 32)
r.ellipse(16, 30, 13, 1.6, 's')
// the two uprights
r.rect(3, 6, 3, 23, 'w')
r.rect(5, 6, 1, 23, 'W')
r.rect(26, 6, 3, 23, 'w')
r.rect(28, 6, 1, 23, 'W')
// the top beam the warp hangs from
r.rect(2, 4, 28, 3, 'w')
r.rect(2, 6, 28, 1, 'W')
// the warp
for (let x = 7; x <= 24; x += 2) r.rect(x, 7, 1, 11, 't')
// the heddle bar across it
r.rect(6, 11, 20, 2, 'W')
// the cloth woven so far, its stripes
r.rect(6, 17, 20, 7, 'c')
r.rect(6, 23, 20, 1, 'C')
r.rect(6, 19, 20, 1, 'r')
r.rect(6, 22, 20, 1, 'r')
// the front beam it rolls onto
r.rect(3, 24, 26, 3, 'w')
r.rect(3, 26, 26, 1, 'W')
r.outline('k', ['s'])
writeAtlas('Fixtures/Loom.png', [[r]], PAL)
