// A person's look on the wiki (docs/looks.md): the anime portrait and the map sprite, composed by the game's own
// code from the same record the game draws them from, written next to the site's pages.

import type { Look } from '@lsw/engine'
import { composePortrait } from '../../client/src/assets/figure/portrait.ts'
import { FH, FW, composeSprite } from '../../client/src/assets/figure/sprite.ts'
import { figureId } from '../../client/src/assets/figure/ids.ts'
import { layerFromDisk, loadManifest } from '../../tools/src/art/looks/review.ts'
import { encodePng, shrink } from './png.ts'

/** The portrait's side on the wiki. */
export const FACE_PX = 192

/** Where a look's pictures are served: the same look, the same files. */
export const lookUrls = (look: Look) => ({ face: `/wiki/_/looks/${figureId(look)}.png`, body: `/wiki/_/looks/${figureId(look)}-body.png` })

/** A look's two pictures as PNGs: the portrait (if the parts' layers are there) and the sprite standing, facing down. */
export function lookPngs(look: Look): { face?: Buffer; body: Buffer } {
  const body = composeSprite(look)
  const frame = new Uint8Array(FW * FH * 4)
  for (let y = 0; y < FH; y++) frame.set(body.subarray(y * FW * 4 * 4, y * FW * 4 * 4 + FW * 4), y * FW * 4)
  const m = loadManifest()
  let face: Buffer | undefined
  if (m) {
    const big = composePortrait(m, look, undefined, layerFromDisk)
    const im = shrink({ w: m.size, h: m.size, rgba: new Uint8Array(big.buffer, big.byteOffset, big.length) }, FACE_PX)
    face = encodePng(im.w, im.h, im.rgba)
  }
  return { face, body: encodePng(FW, FH, frame) }
}
