// The edges of high ground (docs/release-1.md): the pack's relief sheet draws a plateau as a block whose top is a flat
// white mask, so it can stand only on snow. Its edges are what a hill needs — the rim round a terrace, the rock face
// where it drops to the south, the notches of its inner corners — so this cuts them out with the white made clear,
// and the ground of whatever map they stand on shows through: the renderer lays them over the heights (scene.ts
// drawHeights, the wiki's render-map.ts). Laid out as the sheet is, columns 0-6 and rows 0-4:
//
//   col 0: a terrace one cell wide (its top, its sides, its face); cols 1-3: a wide one (corners, sides, its face's
//   left end, middle and right end); rows 3-4: the inner corners' notches; cols 4-6: a face three cells tall.
//
//   npx tsx games/openworld/tools/src/art/terrace.ts

import { fileURLToPath } from 'node:url'
import { readPng, writePng } from './png.ts'

const SHEET = fileURLToPath(new URL('../../../public/assets/na/Backgrounds/Tilesets/TilesetRelief.png', import.meta.url))
const src = readPng(SHEET)
const W = 7 * 16
const H = 5 * 16
const out = new Uint8Array(W * H * 4)
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const s = (y * src.w + x) * 4
    const d = (y * W + x) * 4
    const [r, g, b, a] = src.rgba.subarray(s, s + 4)
    // the plateau's top (the white mask) and the waterfall's water the sheet keeps beside its faces: clear
    if ((r === 242 && g === 234 && b === 241) || (r === 184 && g === 220 && b === 229)) continue
    out.set([r, g, b, a], d)
  }
writePng('Relief/Terrace.png', W, H, out)
