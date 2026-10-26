// A building's picture written large for review (the whole render, upscaled, on a grass-green ground with the
// footprint's grid faint over it), never shipped.
//
//   npx tsx games/openworld/tools/src/art/arch/review.ts <name> <out.png> [scale]

import { writeFileSync } from 'node:fs'
import { png } from '../png.ts'
import type { Rendered } from './oblique.ts'

export function reviewPng(r: Rendered, out: string, scale = 3, ground: [number, number, number] = [120, 170, 90]): void {
  const W = r.pw * scale
  const H = r.ph * scale
  const px = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / scale)
      const sy = Math.floor(y / scale)
      const i = (sy * r.pw + sx) * 4
      const o = (y * W + x) * 4
      if (r.rgba[i + 3]) px.set(r.rgba.subarray(i, i + 4), o)
      else {
        const gy = sy - r.top
        const line = gy >= 0 && (sx % 16 === 0 || gy % 16 === 0)
        px.set(gy >= 0 ? (line ? [ground[0] - 25, ground[1] - 25, ground[2] - 25, 255] : [...ground, 255]) : [40, 44, 52, 255], o)
      }
    }
  writeFileSync(out, png(W, H, px))
}
