// The warm spring's own effects (16x16 frames, the pack's look), drawn by code:
// - Fx/Steam.png: a wisp of steam rising and thinning, four frames, looped over the spring;
// - Fx/Mend.png: green crosses rising round whoever is mending (the `mend` overlay), four frames.
//
//   npx tsx games/openworld/tools/src/art/spring.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  w: [255, 255, 255, 255],
  W: [240, 248, 255, 210],
  v: [230, 240, 250, 130],
  g: [120, 236, 120, 255],
  G: [54, 168, 72, 255],
  l: [210, 255, 200, 255],
}

// steam: two soft puffs drifting up, each frame a step higher and fainter
const steam = [0, 1, 2, 3].map((f) => {
  const r = new Raster(16, 16)
  const puff = (cx: number, cy: number, s: number, c: string) => {
    for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) if (x * x + y * y <= s * s + 1 && r.get(cx + x, cy + y) === null) r.set(cx + x, cy + y, c)
  }
  const shade = ['w', 'W', 'W', 'v'][f]
  puff(6 + (f % 2), 12 - f * 3, f < 2 ? 2 : 1, shade)
  puff(10 - (f % 2), 9 - f * 2, f < 3 ? 1 : 0, f < 2 ? 'W' : 'v')
  if (f < 3) r.set(8, 14 - f * 3, 'v')
  return r
})
writeAtlas('Fx/Steam.png', [steam], PAL)

// mend: small crosses rising, light at the top
const cross = (r: Raster, cx: number, cy: number, big: boolean) => {
  r.set(cx, cy, 'l')
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) r.set(cx + dx, cy + dy, 'g')
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) r.set(cx + dx, cy + dy, 'G')
}
const mend = [0, 1, 2, 3].map((f) => {
  const r = new Raster(16, 16)
  cross(r, 4, 13 - f * 3, f < 2)
  cross(r, 11, ((10 - f * 3) + 16) % 16 || 14, f >= 2)
  if (f % 2) r.set(8, 6, 'l')
  return r
})
writeAtlas('Fx/Mend.png', [mend], PAL)

console.log('spring fx → public/assets/lsw/Fx')
