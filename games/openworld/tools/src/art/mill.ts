// Tam's watermill at Millbrook (docs/release-1.md; the pack has no mill): its wheel, and the millstones it turns.
//
// The wheel (48x48, a prefab three cells square stood in the race against the mill's west wall): weathered boards
// in the inn's timber, seen face on — a back rim a little behind the front one, eight spokes to the hub, twelve
// paddles round the rim, the axle into the wall — its lowest paddles in the race and the water breaking white
// round them.
// The millstones (32x32, a prefab two cells square on the mill's floor): the bed stone on its timber frame, the
// runner on it with the eye in its middle, the hopper over it on its post, a spill of flour.
//
//   npx tsx games/openworld/tools/src/art/mill.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [20, 27, 27, 255], // the pack's ink
  w: [163, 117, 78, 255], // the inn's timber
  W: [150, 83, 64, 255],
  d: [97, 55, 46, 255],
  h: [238, 207, 155, 255],
  f: [255, 255, 255, 255], // foam
  b: [184, 220, 229, 255], // the race's light water
  s: [168, 168, 176, 255], // stone
  S: [128, 128, 138, 255],
  D: [92, 92, 102, 255],
  l: [206, 206, 212, 255],
  m: [244, 238, 226, 255], // flour
}

// ------------------------------------------------------------------ the wheel
const wheel = new Raster(48, 48)
const [cx, cy] = [23, 23]
const ring = (r: Raster, ox: number, oy: number, outer: number, inner: number, c: string) => {
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy)
      if (d <= outer && d > inner) r.set(x, y, c)
    }
}
// the axle, out of the hub into the wall
wheel.rect(cx, cy - 1, 25, 3, 'd')
// the back rim, a little behind and up: its boards seen past the front ones
ring(wheel, cx + 2.5, cy - 1.5, 21.5, 19.5, 'd')
// sixteen paddles, boards from the inner ring out past the rim
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + 0.1
  wheel.line(cx + 0.5 + Math.cos(a) * 12, cy + 0.5 + Math.sin(a) * 12, cx + 0.5 + Math.cos(a) * 22, cy + 0.5 + Math.sin(a) * 22, 'W', 2)
}
// the front rim (lit along its top) and the inner ring the paddles are pinned to
ring(wheel, cx + 0.5, cy + 0.5, 19, 17, 'w')
ring(wheel, cx + 0.5, cy + 0.5, 13, 11.5, 'w')
for (let i = 0; i <= 40; i++) {
  const a = Math.PI * (1.1 + (i / 40) * 0.8)
  wheel.set(cx + 0.5 + Math.cos(a) * 18.2, cy + 0.5 + Math.sin(a) * 18.2, 'h')
}
// six spokes to the hub
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.3
  wheel.line(cx + 0.5 + Math.cos(a) * 3, cy + 0.5 + Math.sin(a) * 3, cx + 0.5 + Math.cos(a) * 11.5, cy + 0.5 + Math.sin(a) * 11.5, 'W', 1)
}
wheel.ellipse(cx + 0.5, cy + 0.5, 3, 3, 'w')
wheel.ellipse(cx + 0.5, cy + 0.5, 1.2, 1.2, 'd')
wheel.outline('k')
// the race over its lowest paddles, breaking white round them
for (let y = 41; y < 48; y++)
  for (let x = 0; x < 48; x++) if (wheel.get(x, y) !== null) wheel.set(x, y, (x * 7 + y * 3) % 5 === 0 ? 'f' : 'b')
for (const [x, y] of [[10, 41], [11, 40], [14, 41], [31, 40], [32, 41], [35, 40], [6, 42], [40, 42], [22, 41], [20, 40], [26, 41]] as const) wheel.set(x, y, 'f')
for (const [x, y, l] of [[3, 44, 6], [14, 45, 8], [27, 44, 7], [38, 45, 6]] as const) wheel.rect(x, y, l, 1, 'f')

// ------------------------------------------------------------------ the millstones
const mill = new Raster(32, 32)
// the timber frame the bed stone sits in
mill.rect(2, 20, 28, 9, 'w')
mill.rect(2, 26, 28, 3, 'W')
mill.rect(4, 29, 3, 2, 'd')
mill.rect(25, 29, 3, 2, 'd')
// the bed stone, and the runner on it with its eye
mill.ellipse(16, 21, 13, 6, 'S')
mill.ellipse(16, 22, 13, 5, 'D')
mill.ellipse(16, 19, 11, 5, 's')
mill.ellipse(15, 18, 9, 3.5, 'l')
mill.ellipse(16, 19, 2.5, 1.5, 'D')
for (const a of [0.4, 1.4, 2.6, 3.7, 5.0]) mill.line(16 + Math.cos(a) * 3.5, 19 + Math.sin(a) * 2, 16 + Math.cos(a) * 9, 19 + Math.sin(a) * 4, 'S')
// the hopper over it on its post, the grain's spout into the eye
mill.rect(15, 9, 2, 9, 'd')
mill.poly([[7, 2], [25, 2], [20, 10], [12, 10]], 'w')
mill.rect(7, 2, 18, 2, 'h')
mill.poly([[14, 9], [18, 9], [17, 13], [15, 13]], 'W')
mill.outline('k')
// a spill of flour on the frame
for (const [x, y] of [[5, 24], [6, 24], [7, 25], [24, 25], [25, 24], [26, 25], [27, 25]] as const) mill.set(x, y, 'm')

writeAtlas('Fixtures/WaterWheel.png', [[wheel]], PAL)
writeAtlas('Fixtures/Millstones.png', [[mill]], PAL)
