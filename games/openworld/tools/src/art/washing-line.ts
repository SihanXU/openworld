// Firstlight's washing line (docs/release-1.md), put together from the pack's own pieces: the element sheet draws a
// line on two posts (3x2) and, beside it, two lengths of that line with laundry pegged on them — a blue shirt, a red
// cloth. The line is the left post, the two lengths of laundry, the right post: 64x32, its foot on the cell's bottom.
// (The game drew the bare posts alone until 2026-10-21, and the loom with them: tools/src/art/loom.ts.)
//
//   npx tsx games/openworld/tools/src/art/washing-line.ts

import { fileURLToPath } from 'node:url'
import { readPng, writePng } from './png.ts'

const SHEET = fileURLToPath(new URL('../../../public/assets/na/Backgrounds/Tilesets/TilesetElement.png', import.meta.url))
const src = readPng(SHEET)
const W = 64
const H = 32
const out = new Uint8Array(W * H * 4)
/** Copy the sheet's tile column `col` (rows 2-3, the line's two rows) to the output's column `to`. */
const column = (col: number, to: number) => {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 16; x++) {
      const s = ((32 + y) * src.w + col * 16 + x) * 4
      const d = (y * W + to * 16 + x) * 4
      for (let c = 0; c < 4; c++) out[d + c] = src.rgba[s + c]
    }
}
column(11, 0) // the left post, the line leaving it
column(14, 1) // the blue shirt
column(15, 2) // the red cloth
column(13, 3) // the right post
writePng('Fixtures/WashingLine.png', W, H, out)
