// Buildings rendered for review (not shipped): the models whose names start with any of the prefixes, side by side on
// a grass ground with the cells' grid faint over it, scaled up.
//   npx tsx try.ts <prefix,prefix…> <out.png> [scale] [width]
import { writeFileSync } from 'node:fs'
import { png } from '../png.ts'
import { render, type Rendered } from './oblique.ts'
import { MODELS as BUILT, PROPS } from './buildings/index.ts'
const MODELS = { ...BUILT, ...PROPS }

const prefixes = (process.argv[2] ?? 'abbey').split(',')
const out = process.argv[3] ?? '/tmp/sheet.png'
const scale = Number(process.argv[4] ?? 2)
const maxW = Number(process.argv[5] ?? 1400)
const names = Object.keys(MODELS).filter((n) => prefixes.some((p) => n.startsWith(p)))
const rs: Rendered[] = []
for (const n of names) {
  const t = Date.now()
  rs.push(render(MODELS[n]()))
  console.log(n, Date.now() - t, 'ms')
}
// shelves
const gap = 8
let x = gap
let y = gap
let shelf = 0
const at: [number, number][] = []
for (const r of rs) {
  if (x + r.pw > maxW / scale && x > gap) (x = gap), (y += shelf + gap), (shelf = 0)
  at.push([x, y])
  x += r.pw + gap
  shelf = Math.max(shelf, r.ph)
}
const W = Math.ceil(maxW / scale)
const H = y + shelf + gap
const px = new Uint8Array(W * H * 4)
for (let i = 0; i < W * H; i++) px.set([44, 48, 56, 255], i * 4)
rs.forEach((r, k) => {
  const [ox, oy] = at[k]
  for (let j = 0; j < r.ph; j++)
    for (let i = 0; i < r.pw; i++) {
      const s = (j * r.pw + i) * 4
      const d = ((oy + j) * W + ox + i) * 4
      if (ox + i >= W) continue
      if (r.rgba[s + 3]) px.set(r.rgba.subarray(s, s + 4), d)
      else if (j >= r.top) px.set((i % 16 === 0 || (j - r.top) % 16 === 0) ? [98, 145, 74, 255] : [118, 166, 88, 255], d)
    }
})
const SW = W * scale
const SH = H * scale
const big = new Uint8Array(SW * SH * 4)
for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) big.set(px.subarray(((Math.floor(j / scale) * W) + Math.floor(i / scale)) * 4, ((Math.floor(j / scale) * W) + Math.floor(i / scale)) * 4 + 4), (j * SW + i) * 4)
writeFileSync(out, png(SW, SH, big))
console.log(out, SW, SH)
