// A person's look on the wiki (docs/looks.md): the anime portrait and the map sprite, composed by the game's own
// code from the same record the game draws them from, written next to the site's pages.

// the runtime's figures draw this game's looks (packages/runtime/src/game.ts)
import '../../client/src/register.ts'
import type { Look } from '@openworld/engine'
import { composePortrait } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '@openworld/runtime/src/assets/figure/sprite.ts'
import { figureId } from '@openworld/runtime/src/assets/figure/ids.ts'
import { bustOf, layerFromDisk, loadManifest } from '../../tools/src/art/looks/review.ts'
import { encodePng, shrink } from './png.ts'

/** The portrait's side on the wiki. */
export const FACE_PX = 192

/** The sprite's head and shoulders, the wiki's small icon of a person: a square this wide, from a row above the top of the head, over the
 * columns every body's head and shoulders keep to (measured over generated looks: x 3–19, the head's top at row 2–3, a child's 8–9). */
export const HEAD_PX = 18
const HEAD_X = 2

/** Where a look's pictures are served: the same look, the same files. */
export const lookUrls = (look: Look) => {
  const id = figureId(look)
  return { face: `/wiki/_/looks/${id}.png`, body: `/wiki/_/looks/${id}-body.png`, head: `/wiki/_/looks/${id}-head.png` }
}

/** A look's pictures as PNGs: the portrait (if the parts' layers are there), the sprite standing, facing down, and its head. */
export function lookPngs(look: Look): { face?: Buffer; body: Buffer; head: Buffer } {
  const body = composeSprite(look)
  const frame = new Uint8Array(FW * FH * 4)
  for (let y = 0; y < FH; y++) {
    const from = (IDLE_ROW * FH + y) * FW * 4 * 4
    frame.set(body.subarray(from, from + FW * 4), y * FW * 4)
  }
  const m = loadManifest()
  let face: Buffer | undefined
  if (m) {
    const b = bustOf(m, look, composePortrait(m, look, undefined, layerFromDisk))
    const im = shrink({ w: b.w, h: b.h, rgba: new Uint8Array(b.rgba.buffer, b.rgba.byteOffset, b.rgba.length) }, FACE_PX)
    face = encodePng(im.w, im.h, im.rgba)
  }
  let top = 0
  while (top < FH - 1 && !frame.subarray(top * FW * 4, (top + 1) * FW * 4).some((v, i) => i % 4 === 3 && v > 0)) top++
  const y0 = Math.max(0, Math.min(FH - HEAD_PX, top - 1))
  const head = new Uint8Array(HEAD_PX * HEAD_PX * 4)
  for (let y = 0; y < HEAD_PX; y++) head.set(frame.subarray(((y0 + y) * FW + HEAD_X) * 4, ((y0 + y) * FW + HEAD_X + HEAD_PX) * 4), y * HEAD_PX * 4)
  return { face, body: encodePng(FW, FH, frame), head: encodePng(HEAD_PX, HEAD_PX, head) }
}
