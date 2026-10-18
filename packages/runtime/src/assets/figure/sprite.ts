// A look's map sprite (docs/looks.md §3.1): a 24x36 figure in the FFBE manner, in the sheet layout the renderer reads
// (columns down, up, left, right; rows 0-3 the walk, row 4 the idle pose), composed from drawn grids and painted in
// the look's colours. Pure: the client turns the pixels into a texture, the wiki and the review sheets into PNGs.
//
// A body is a base (`bases.ts`: the bald figure, its skin, eyes and plain underclothes, per facing and frame). Over
// it, frame by frame: the outfit and what is worn over it (`baseoutfit.ts`, drawn for every frame, so the sleeves
// swing with the arms and a skirt walks), then the head's parts, which follow the head as it bobs: the face's
// variants, the marks of age and scars, a beard (`basehead.ts`), the hair (`basehair.ts`, its long part hanging
// behind the body), glasses and a hat (which hides the hair it covers). Left is right mirrored.

import type { Look } from '@openworld/engine'
import { BASES, BASE_H, BASE_PALETTE, BASE_W, type BaseBody, type BaseFacing } from './bases.ts'
import { BASE_HAIRS, HAIR_PALETTE } from './basehair.ts'
import { BASE_OUTFITS, PIECE_LETTERS, type BasePart } from './baseoutfit.ts'
import { BASE_HEADS, HEAD_FIXED, HEAD_LETTERS } from './basehead.ts'
import { hexRgb, keyRgb, retone, shade, type RGB } from './color.ts'

/** A frame of the sheet. */
export const FW = BASE_W
export const FH = BASE_H
/** Where a frame's feet stand: the row the renderer puts on the bearer's place. */
export const ANCHOR_Y = 35
/** The sheet's rows: the four of the walk and the one a figure stands in when it is not walking. */
export const ROWS = 5
export const IDLE_ROW = 4

/** The slots drawn over the body frame by frame, in order: the outfit, then what is worn over it. */
const PIECE_SLOTS = ['outfit', 'armour', 'cloak'] as const
/** The head's parts under the hair, in order. */
const UNDER_HAIR = ['face', 'age', 'mark', 'beard'] as const

/** The sheet of a look: 4 facings by ROWS frames of FW x FH, RGBA. */
export function composeSprite(look: Look): Uint8Array {
  const out = new Uint8Array(FW * 4 * FH * ROWS * 4)
  const body = (look.body in BASES ? look.body : 'man') as BaseBody
  const base = BASES[body]
  const color = palette(look)
  const pieces = PIECE_SLOTS.map((slot) => BASE_OUTFITS[look.parts[slot] ?? '']?.bodies[body]).filter((p) => p !== undefined)
  const heads = UNDER_HAIR.map((slot) => BASE_HEADS[look.parts[slot] ?? '']).filter((h) => h !== undefined)
  const hair = BASE_HAIRS[look.parts.hair ?? '']
  const glasses = BASE_HEADS[look.parts.glasses ?? '']
  const hat = BASE_HEADS[look.parts.hat ?? '']
  for (let col = 0; col < 4; col++) {
    const facing: BaseFacing = col === 0 ? 'down' : col === 1 ? 'up' : 'left'
    const frames = base[facing]
    // the 3/4 view faces left; right is it mirrored
    const flip = col === 3
    for (let row = 0; row < ROWS; row++) {
      const grid = row === IDLE_ROW ? frames.idle : frames.walk[row]
      const cells = grid.map((r) => [...r])
      // the head's top: row 3 for an adult standing (9 for a child), a row lower on a step; the head's parts follow it
      const dy = grid.findIndex((r) => /[^.]/.test(r)) - 3
      for (const p of pieces) wearPart(cells, row === IDLE_ROW ? p[facing].idle : p[facing].walk[row], 0)
      for (const h of heads) if (h.grids[facing]) wearPart(cells, h.grids[facing]!, dy)
      if (hair) wearHair(cells, hair.grids[facing], hair.back[facing], dy, hat?.hides?.[facing] ?? 0)
      if (glasses?.grids[facing]) wearPart(cells, glasses.grids[facing]!, dy)
      if (hat?.grids[facing]) wearPart(cells, hat.grids[facing]!, dy)
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const c = color[cells[y][flip ? FW - 1 - x : x]]
          if (!c) continue
          out.set([c[0], c[1], c[2], 255], ((row * FH + y) * FW * 4 + col * FW + x) * 4)
        }
    }
  }
  return out
}

/** Every letter's colour for a look: the base's skin and eyes, the hair, each worn piece's and the head parts' keys. */
function palette(look: Look): Record<string, RGB> {
  const color: Record<string, RGB> = {}
  const skin = keyRgb(look, 'skin')
  const eyes = keyRgb(look, 'eyes')
  const J = hexRgb(BASE_PALETTE.J)
  const P = hexRgb(BASE_PALETTE.P)
  for (const [k, hex] of Object.entries(BASE_PALETTE)) {
    const c = hexRgb(hex)
    color[k] = 'OHJFQ'.includes(k) ? retone(c, J, skin) : 'MP'.includes(k) ? retone(c, P, eyes) : c
  }
  const ref = hexRgb(HAIR_PALETTE.c)
  const hair = keyRgb(look, 'hair')
  for (const [k, hex] of Object.entries(HAIR_PALETTE)) color[k] = retone(hexRgb(hex), ref, hair)
  // four tones a key: the look's colour for a key it names, the piece's own for a fixed one
  const ramp = (c: RGB): RGB[] => [shade(c, 1), c, shade(c, -1), shade(c, -2)]
  for (const slot of PIECE_SLOTS) {
    const def = BASE_OUTFITS[look.parts[slot] ?? '']
    if (!def) continue
    const ramps: Record<string, RGB[]> = {}
    for (const [k, hex] of Object.entries(def.keys)) ramps[k] = ramp(def.fixed.includes(k) ? hexRgb(hex) : keyRgb(look, `${slot}.${k}`))
    for (const [letter, [k, t]] of Object.entries(PIECE_LETTERS[slot])) if (ramps[k]) color[letter] = ramps[k][t]
  }
  for (const [letter, [key, t]] of Object.entries(HEAD_LETTERS)) if (look.parts[key.split('.')[0]]) color[letter] = ramp(keyRgb(look, key))[t]
  for (const [letter, hex] of Object.entries(HEAD_FIXED)) color[letter] = hexRgb(hex)
  return color
}

/** A part over a frame's cells, `dy` rows below where it was drawn ('_' clears a cell: a long skirt hides the stride's legs). */
function wearPart(cells: string[][], part: BasePart, dy: number): void {
  part.rows.forEach((line, i) => {
    const y = part.top + i + dy
    if (y < 0 || y >= cells.length) return
    ;[...line].forEach((ch, x) => {
      if (ch === '_') cells[y][x] = '.'
      else if (ch !== '.') cells[y][x] = ch
    })
  })
}

/**
 * A hairstyle on a frame, `dy` below its standing place: below and right of `back` it hangs behind the body; under a
 * hat the hair above the hat's `hides` row is not drawn.
 */
function wearHair(cells: string[][], grid: string[], [backRow, backCol]: [number, number], dy: number, hides: number): void {
  grid.forEach((line, y) =>
    [...line].forEach((ch, x) => {
      const Y = y + dy
      if (ch === '.' || y < hides || Y < 0 || Y >= cells.length) return
      if (y >= backRow && x >= backCol && cells[Y][x] !== '.') return
      cells[Y][x] = ch
    }),
  )
}
