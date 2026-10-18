// Single looks composed full-size from the cut layers (docs/looks.md §4): what a part looks like in the game, the
// figure and its bust, for checking a part as the pipeline cuts it.
//
//   npx tsx games/openworld/tools/src/art/looks/trial.ts <out.png> '<look json>' ['<look json>' …]   (a look may say its "mood")

import '../../../../client/src/register.ts'
import { writeFileSync } from 'node:fs'
import type { Look, Mood } from '@openworld/engine'
import { composePortrait } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { bustOf, layerFromDisk, loadManifest } from './review.ts'
import { png } from '../png.ts'

const [out, ...looks] = process.argv.slice(2)
const m = loadManifest()
if (!m) throw new Error('no manifest: run portrait/build.py first')
const figs = looks.map((j) => {
  // a look, and the mood its face shows (`"mood": "happy"` beside its body, parts and colours)
  const look = JSON.parse(j) as Look & { mood?: Mood }
  const fig = composePortrait(m, look, look.mood, layerFromDisk)
  return { fig, bust: bustOf(m, look, fig) }
})
// each look: its figure, then its bust at the figure's height's third
const B = Math.floor(m.h / 3)
const W = figs.length * (m.w + B + 16)
const rgba = new Uint8Array(W * m.h * 4)
for (let i = 0; i < W * m.h; i++) rgba.set([230, 226, 214, 255], i * 4)
const put = (src: Uint8ClampedArray, sw: number, sh: number, ox: number, scale: number) => {
  const dw = Math.floor(sw * scale)
  const dh = Math.floor(sh * scale)
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const i = (Math.floor(y / scale) * sw + Math.floor(x / scale)) * 4
      const a = src[i + 3] / 255
      if (!a) continue
      const o = (y * W + ox + x) * 4
      for (let k = 0; k < 3; k++) rgba[o + k] = rgba[o + k] * (1 - a) + src[i + k] * a
    }
}
figs.forEach(({ fig, bust }, n) => {
  const ox = n * (m.w + B + 16)
  put(fig, m.w, m.h, ox, 1)
  put(bust.rgba, bust.w, bust.h, ox + m.w + 8, B / bust.h)
})
writeFileSync(out, png(W, m.h, rgba))
console.log(out)
