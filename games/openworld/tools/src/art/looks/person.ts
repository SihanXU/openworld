// One person's look as the game draws it (docs/looks.md §4, docs/character-art.md): the standing portrait in every mood,
// the bust the dialogue box shows, and the map sprite — the anchor a character sheet and its artists draw from.
//
//   npx tsx games/openworld/tools/src/art/looks/person.ts <person id> <out dir>

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Mood } from '@openworld/engine'
import { composePortrait } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '@openworld/runtime/src/assets/figure/sprite.ts'
import { png } from '../png.ts'
import { bustOf, layerFromDisk, loadManifest, peopleLooks } from './review.ts'

const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']

const [id, out] = process.argv.slice(2)
if (!id || !out) throw new Error('usage: person.ts <person id> <out dir>')
const m = loadManifest()
if (!m) throw new Error('no portrait manifest: run portrait/build.py first')
const person = peopleLooks().find((p) => p.id === id)
if (!person) throw new Error(`no person ${id}`)
mkdirSync(out, { recursive: true })
for (const mood of MOODS) {
  const fig = composePortrait(m, person.look, mood === 'neutral' ? undefined : mood, layerFromDisk)
  writeFileSync(join(out, `portrait-${mood}.png`), png(m.w, m.h, new Uint8Array(fig.buffer)))
  const b = bustOf(m, person.look, fig)
  writeFileSync(join(out, `bust-${mood}.png`), png(b.w, b.h, new Uint8Array(b.rgba.buffer)))
}
// the map sprite standing, facing down (its first idle frame)
const s = composeSprite(person.look)
const sprite = new Uint8Array(FW * FH * 4)
for (let y = 0; y < FH; y++) sprite.set(s.subarray((IDLE_ROW * FH + y) * FW * 4 * 4, ((IDLE_ROW * FH + y) * FW * 4 + FW) * 4), y * FW * 4)
writeFileSync(join(out, 'sprite.png'), png(FW, FH, sprite))
console.log(`${id}: ${MOODS.length} portraits (${m.w}×${m.h}), busts, sprite → ${out}`)
console.log(JSON.stringify(person.look))
