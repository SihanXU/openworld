// The faces checked as the game draws them (docs/looks.md §4): per body, every face in every mood with a hairstyle
// over it, at the portrait's own pixels; and every hairstyle alone on its bald body. Where the hair and the face
// layers meet (a box round the eyes, a wash of the hair's colour, a second pair of eyes, a brow in the eyes' colour)
// it shows here at full size.
//
//   npx tsx games/openworld/tools/src/art/looks/facecheck.ts <out prefix> ['<colours json>']
//   → <prefix>-<body>.png (faces × moods) and <prefix>-hair.png (each hairstyle on each body it is for)

import '../../../../client/src/register.ts'
import { writeFileSync } from 'node:fs'
import type { Look, Mood } from '@openworld/engine'
import { LOOK_PARTS } from '@openworld-game/content'
import { composePortrait, type PortraitManifest } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { layerFromDisk, loadManifest } from './review.ts'
import { png } from '../png.ts'

const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
// a hairstyle with a fringe over the brows for each body: the hardest case for the face under it
const FRINGE: Record<string, string> = { woman: 'hair.long', man: 'hair.messy', girl: 'hair.childbob', boy: 'hair.childbob' }
const [prefix, colorsArg] = process.argv.slice(2)
const colors = colorsArg ? (JSON.parse(colorsArg) as Record<string, string>) : { skin: 'light', hair: 'chestnut', eyes: 'leaf' }
const m = loadManifest()
if (!m) throw new Error('no manifest')

/** The head of a look at the canvas's own pixels: a square from over its top to its chin. */
function head(man: PortraitManifest, look: Look, mood: Mood | undefined): { w: number; rgba: Uint8Array } {
  const f = composePortrait(man, look, mood, layerFromDisk)
  const b = man.bodies[look.body].bust
  const side = Math.round(b.w * 0.62)
  const x0 = Math.round(b.x + (b.w - side) / 2)
  const y0 = Math.round(b.y + b.h * 0.04)
  const rgba = new Uint8Array(side * side * 4)
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const i = ((y0 + y) * man.w + x0 + x) * 4
      const a = f[i + 3] / 255
      const o = (y * side + x) * 4
      for (let k = 0; k < 3; k++) rgba[o + k] = 40 * (1 - a) + f[i + k] * a
      rgba[o + 3] = 255
    }
  return { w: side, rgba }
}

function page(cells: { w: number; rgba: Uint8Array }[][], out: string): void {
  const cw = Math.max(...cells.flat().map((c) => c.w)) + 6
  const cols = Math.max(...cells.map((r) => r.length))
  const W = cols * cw
  const H = cells.length * cw
  const px = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) px.set([24, 26, 32, 255], i * 4)
  cells.forEach((row, r) =>
    row.forEach((c, k) => {
      for (let y = 0; y < c.w; y++) px.set(c.rgba.subarray(y * c.w * 4, (y + 1) * c.w * 4), ((r * cw + y) * W + k * cw) * 4)
    }),
  )
  writeFileSync(out, png(W, H, px))
}

for (const body of ['woman', 'man', 'girl', 'boy']) {
  const faces = Object.entries(LOOK_PARTS).filter(([, p]) => p.slot === 'face' && p.bodies?.includes(body)).map(([id]) => id)
  page(
    faces.map((face) => MOODS.map((mood) => head(m, { body, parts: { face, hair: FRINGE[body] }, colors }, mood))),
    `${prefix}-${body}.png`,
  )
}
const hairRows: { w: number; rgba: Uint8Array }[][] = []
for (const body of ['woman', 'man', 'girl', 'boy']) {
  const hairs = Object.entries(LOOK_PARTS).filter(([, p]) => p.slot === 'hair' && p.bodies?.includes(body)).map(([id]) => id)
  hairRows.push(hairs.map((hair) => head(m, { body, parts: { hair }, colors }, undefined)))
}
page(hairRows, `${prefix}-hair.png`)
console.log(prefix)
