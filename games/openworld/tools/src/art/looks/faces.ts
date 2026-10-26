// Every face in every mood on every body it is drawn for, as busts (docs/looks.md §4): the sheet a face part is
// reviewed on — a face whose eyes, brows or mouth go wrong in one mood shows in its row.
//
//   npx tsx games/openworld/tools/src/art/looks/faces.ts <out.png> ['<colours json>'] [hair part]

import '../../../../client/src/register.ts'
import { writeFileSync } from 'node:fs'
import type { Look, Mood } from '@openworld/engine'
import { LOOK_PARTS } from '@openworld-game/content'
import { composePortrait } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { bustOf, layerFromDisk, loadManifest } from './review.ts'
import { png } from '../png.ts'

const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
const [out, colorsArg, hair] = process.argv.slice(2)
const colors = colorsArg ? (JSON.parse(colorsArg) as Record<string, string>) : { skin: 'light', hair: 'honey', eyes: 'sky' }
const m = loadManifest()
if (!m) throw new Error('no manifest: run portrait/build.py first')

const rows: { body: string; face: string }[] = []
for (const [id, p] of Object.entries(LOOK_PARTS)) if (p.slot === 'face') for (const body of p.bodies ?? []) rows.push({ body, face: id })

const S = 200
const W = MOODS.length * S
const H = rows.length * S
const rgba = new Uint8Array(W * H * 4)
for (let i = 0; i < W * H; i++) rgba.set([34, 38, 48, 255], i * 4)
rows.forEach(({ body, face }, r) =>
  MOODS.forEach((mood, c) => {
    const look: Look = { body, parts: { face, ...(hair ? { hair } : {}) }, colors }
    const b = bustOf(m, look, composePortrait(m, look, mood, layerFromDisk))
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (Math.floor((y * b.h) / S) * b.w + Math.floor((x * b.w) / S)) * 4
        const a = b.rgba[i + 3] / 255
        if (!a) continue
        const o = ((r * S + y) * W + c * S + x) * 4
        for (let k = 0; k < 3; k++) rgba[o + k] = rgba[o + k] * (1 - a) + b.rgba[i + k] * a
      }
  }),
)
writeFileSync(out, png(W, H, rgba))
console.log(out, rows.map((r) => `${r.face}@${r.body}`).join(' '))
