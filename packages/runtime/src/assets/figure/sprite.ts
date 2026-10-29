// A look's map sprite (docs/looks.md §3.1): a 24x36 figure in the FFBE manner, in the sheet layout the renderer reads
// (columns down, up, left, right; rows 0-3 the walk, row 4 the idle pose), composed from drawn grids and painted in
// the look's colours. Pure: the client turns the pixels into a texture, the wiki and the review sheets into PNGs.
//
// A body is a base (`bases.ts`: the bald figure, its skin, eyes and plain underclothes, per facing and frame). Over
// it, frame by frame: the outfit and what is worn over it (`baseoutfit.ts`, drawn for every frame, so the sleeves
// swing with the arms and a skirt walks), then the head's parts, which follow the head as it bobs: the face's
// variants, the marks of age and scars, a beard (`basehead.ts`), the hair (`basehair.ts`, its long part hanging
// behind the body), glasses and a hat (which hides the hair it covers); last the legs and the shoes, laid on as colour
// (`basefeet.ts`). Left is right mirrored.

import type { Look } from '@openworld/engine'
import { BASES, BASE_H, BASE_PALETTE, BASE_W, type BaseBody, type BaseFacing } from './bases.ts'
import { BASE_HAIRS, HAIR_PALETTE } from './basehair.ts'
import { BASE_OUTFITS, PIECE_LETTERS, type BasePart } from './baseoutfit.ts'
import { BASE_HEADS, HEAD_FIXED, HEAD_LETTERS } from './basehead.ts'
import { BASE_FEET } from './basefeet.ts'
import { hexRgb, keyRgb, retone, shade, type RGB } from './color.ts'

/** A frame of the sheet. */
export const FW = BASE_W
export const FH = BASE_H
/** Where a frame's feet stand: the row the renderer puts on the bearer's place. */
export const ANCHOR_Y = 35
/**
 * The sheet's rows: the four of the walk, the one a figure stands in when it is not walking, and the four of the run
 * (RUN_ROW on: made of the walk's strides, `runFrames`).
 */
export const ROWS = 9
export const IDLE_ROW = 4
export const RUN_ROW = 5
/** The rows drawn from the grids: the walk's and the standing one. */
const DRAWN = 5

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
  const feet = feetOf(look, body)
  for (let col = 0; col < 4; col++) {
    const facing: BaseFacing = col === 0 ? 'down' : col === 1 ? 'up' : 'left'
    const frames = base[facing]
    // the 3/4 view faces left; right is it mirrored
    const flip = col === 3
    for (let row = 0; row < DRAWN; row++) {
      const grid = row === IDLE_ROW ? frames.idle : frames.walk[row]
      const cells = grid.map((r) => [...r])
      // the head's top: row 3 for an adult standing (9 for a child), a row lower on a step; the head's parts follow it
      const dy = grid.findIndex((r) => /[^.]/.test(r)) - 3
      for (const p of pieces) wearPart(cells, row === IDLE_ROW ? p[facing].idle : p[facing].walk[row], 0)
      for (const h of heads) if (h.grids[facing]) wearPart(cells, h.grids[facing]!, dy)
      if (hair) wearHair(cells, hair.grids[facing], hair.back[facing], dy, hat?.hides?.[facing] ?? 0)
      if (glasses?.grids[facing]) wearPart(cells, glasses.grids[facing]!, dy)
      if (hat?.grids[facing]) wearPart(cells, hat.grids[facing]!, dy)
      const over = feet.length ? layFeet(cells, feet) : undefined
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const sx = flip ? FW - 1 - x : x
          const c = over?.[y][sx] ?? color[cells[y][sx]]
          if (!c) continue
          out.set([c[0], c[1], c[2], 255], ((row * FH + y) * FW * 4 + col * FW + x) * 4)
        }
    }
    runFrames(out, col)
  }
  return out
}

/**
 * The run (RUN_ROW on), made of a facing's two strides as the walk draws them (rows 1 and 3: legs apart, the body a
 * row down), so every outfit, hair and pair of shoes runs as it walks. Each stride is shown landing, as drawn, then in
 * the air, a row up (the feet off the ground): a bound of a row, as the walk's, at the run's longer stride. Seen from
 * the side the figure leans into the run from the hips (a pixel, the head and shoulders as one, so nothing shears) and
 * its legs reach a pixel further fore and aft.
 */
function runFrames(out: Uint8Array, col: number): void {
  // (the side view: into the way it faces — left in its own column, right in the mirrored one)
  const ahead = col === 2 ? -1 : col === 3 ? 1 : 0
  const at = (row: number, x: number, y: number) => ((row * FH + y) * FW * 4 + col * FW + x) * 4
  const strides = [1, 1, 3, 3]
  const lifts = [0, -1, 0, -1]
  for (let i = 0; i < 4; i++) {
    const from = strides[i]
    const to = RUN_ROW + i
    // where the figure is: its top row, its hips a little over half way down, its legs' middle column
    let top = 0
    const filled = (y: number) => [...Array(FW).keys()].some((x) => out[at(from, x, y) + 3])
    while (top < FH - 1 && !filled(top)) top++
    const hips = top + Math.round((ANCHOR_Y - top) * 0.55)
    let left = FW
    let right = 0
    for (let y = hips; y < FH; y++) for (let x = 0; x < FW; x++) if (out[at(from, x, y) + 3]) (left = Math.min(left, x)), (right = Math.max(right, x))
    const mid = (left + right) / 2
    // the legs first, then the body over them
    for (const upper of [false, true]) {
      for (let sy = 0; sy < FH; sy++) {
        if (sy < hips !== upper) continue
        const y = sy + lifts[i]
        if (y < 0 || y >= FH) continue
        for (let sx = 0; sx < FW; sx++) {
          const a = at(from, sx, sy)
          if (!out[a + 3]) continue
          // the stride: each leg a pixel further from the other, below the hips (seen from the side)
          const reach = !upper && ahead && sy > hips + 1 ? (sx < mid ? -1 : sx > mid ? 1 : 0) : 0
          const x = sx + (upper ? ahead : 0) + reach
          if (x >= 0 && x < FW) out.set(out.subarray(a, a + 4), at(to, x, y))
        }
      }
    }
  }
}

/** A letter's tone, light (0) to dark (3): the skin's, the plain underclothes', and each piece's by its letters. */
const TONE: Record<string, number> = { O: 0, H: 0, J: 1, F: 2, Q: 3, V: 0, W: 1, T: 2, X: 3 }
for (const letters of Object.values(PIECE_LETTERS)) for (const [letter, [, t]] of Object.entries(letters)) TONE[letter] ??= t
const SKIN_LETTERS = new Set(['O', 'H', 'J', 'F', 'Q'])
/** An outfit's main cloth (a coat's skirts, a dress): what even tall boots go under. */
const MAIN_CLOTH = new Set(Object.entries(PIECE_LETTERS.outfit).filter(([, [k]]) => k === '1').map(([l]) => l))

type Feet = { rows: number; over: 'feet' | 'skin'; ramp: RGB[]; legs: boolean }

/** The look's legs and shoes on its body: the rows each covers and its colour's tones (shoes first). */
function feetOf(look: Look, body: BaseBody): Feet[] {
  const child = body === 'girl' || body === 'boy'
  const out: Feet[] = []
  for (const slot of ['shoes', 'legs'] as const) {
    const def = BASE_FEET[look.parts[slot] ?? '']
    if (!def) continue
    const c = keyRgb(look, `${slot}.1`)
    out.push({ rows: def.rows[child ? 1 : 0], over: def.over, ramp: [shade(c, 1), c, shade(c, -1), shade(c, -2)], legs: slot === 'legs' })
  }
  return out
}

/** The colours the legs and shoes lay on a frame's cells, counted up from its lowest row (the legs above the shoes). */
function layFeet(cells: string[][], feet: Feet[]): (RGB | undefined)[][] {
  const over: (RGB | undefined)[][] = cells.map((r) => r.map(() => undefined))
  let bottom = cells.length - 1
  while (bottom > 0 && cells[bottom].every((ch) => ch === '.')) bottom--
  const shoeRows = feet.find((f) => !f.legs)?.rows ?? 1
  for (const f of feet) {
    const to = f.legs ? bottom - shoeRows : bottom
    for (let y = Math.max(0, to - f.rows + 1); y <= to; y++)
      cells[y].forEach((ch, x) => {
        const t = TONE[ch]
        if (t === undefined || (f.over === 'skin' && !SKIN_LETTERS.has(ch)) || (f.over === 'feet' && MAIN_CLOTH.has(ch))) return
        over[y][x] = f.ramp[t]
      })
  }
  return over
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
