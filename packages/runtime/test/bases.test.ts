// The figures' bases and parts (assets/figure/base*.ts, docs/looks.md §3.1): every frame is whole and stands on the
// soles, every part is in its own letters, on the frame and where its kind belongs.

import { describe, expect, it } from 'vitest'
import { BASES, BASE_H, BASE_PALETTE, BASE_W } from '../src/assets/figure/bases.ts'
import { BASE_HAIRS, HAIR_PALETTE } from '../src/assets/figure/basehair.ts'
import { BASE_HEADS, HEAD_FIXED, HEAD_LETTERS } from '../src/assets/figure/basehead.ts'
import { BASE_OUTFITS, PIECE_LETTERS, type BasePart } from '../src/assets/figure/baseoutfit.ts'
import { retone, hexRgb } from '../src/assets/figure/color.ts'

const SOLE = 34
const lowest = (g: string[]) => Math.max(...g.map((r, y) => (/[^.]/.test(r) ? y : -1)))
const highest = (g: string[]) => g.findIndex((r) => /[^.]/.test(r))

describe('the bases', () => {
  for (const [body, facings] of Object.entries(BASES))
    for (const [facing, f] of Object.entries(facings)) {
      const frames = [f.idle, ...f.walk]
      it(`${body} ${facing}: ${BASE_W}x${BASE_H} frames in the palette's letters`, () => {
        for (const g of frames) {
          expect(g).toHaveLength(BASE_H)
          for (const r of g) {
            expect(r).toHaveLength(BASE_W)
            for (const ch of r) if (ch !== '.') expect(BASE_PALETTE[ch]).toBeDefined()
          }
        }
      })
      it(`${body} ${facing}: every frame stands on the sole row; a step carries the head one lower`, () => {
        for (const g of frames) expect(lowest(g)).toBe(SOLE)
        // passing and idle: the head's top on row 3 (a child's on 9: the same head on a shorter body); a step (frames
        // 1 and 3): one lower
        const top = body === 'girl' || body === 'boy' ? 9 : 3
        expect(highest(f.idle)).toBe(top)
        expect(f.walk.map(highest)).toEqual([top, top + 1, top, top + 1])
      })
    }
})

describe('the hairstyles on the bases', () => {
  for (const [id, hair] of Object.entries(BASE_HAIRS))
    it(`${id}: a grid per facing in the hair's letters, on the head, and a row it hangs behind from`, () => {
      for (const facing of ['down', 'up', 'left'] as const) {
        const g = hair.grids[facing]
        expect(g).toHaveLength(BASE_H)
        for (const r of g) {
          expect(r).toHaveLength(BASE_W)
          expect(r).toMatch(/^[.abcde]*$/)
        }
        // it sits on the head (the head's top is row 3; thinning hair only rings it) and does not reach the feet
        expect(highest(g)).toBeGreaterThanOrEqual(0)
        expect(highest(g)).toBeLessThanOrEqual(8)
        expect(lowest(g)).toBeLessThan(SOLE - 4)
        expect(hair.back[facing][0]).toBeGreaterThanOrEqual(12)
        expect(hair.back[facing][1]).toBeGreaterThanOrEqual(0)
      }
      for (const k of 'abcde') expect(HAIR_PALETTE[k]).toMatch(/^#[0-9a-f]{6}$/)
    })
  it('the look table names every hairstyle drawn here', () => {
    for (const id of Object.keys(BASE_HAIRS)) expect(id).toMatch(/^hair\.[a-z]+$/)
  })
})

const inFrame = (p: BasePart) => p.top >= 0 && p.top + p.rows.length <= BASE_H && p.rows.every((r) => r.length === BASE_W)

describe('the outfits and what is worn over them', () => {
  for (const [id, piece] of Object.entries(BASE_OUTFITS))
    it(`${id}: on each body it fits, a part for every frame in its slot's letters`, () => {
      const slot = id.split('.')[0] as keyof typeof PIECE_LETTERS
      // its own letters, an outline and a cleared cell; the base's where it redraws the body (a long skirt's feet)
      const letters = new Set([...Object.keys(PIECE_LETTERS[slot]), ...Object.keys(BASE_PALETTE), '_', '.'])
      for (const k of Object.keys(piece.keys)) expect(piece.keys[k], `${id} key ${k}`).toMatch(/^#[0-9a-f]{6}$/)
      expect(Object.keys(piece.bodies).length).toBeGreaterThan(0)
      for (const frames of Object.values(piece.bodies))
        for (const f of Object.values(frames!))
          for (const p of [f.idle, ...f.walk]) {
            expect(inFrame(p), id).toBe(true)
            for (const r of p.rows) for (const ch of r) expect(letters.has(ch), `${id}: '${ch}'`).toBe(true)
            // a piece's own letters name keys it has
            for (const r of p.rows) for (const ch of r) if (PIECE_LETTERS[slot][ch]) expect(piece.keys[PIECE_LETTERS[slot][ch][0]], `${id}: '${ch}'`).toBeDefined()
          }
    })
})

describe("the head's parts", () => {
  const letters = new Set([...Object.keys(BASE_PALETTE), ...Object.keys(HAIR_PALETTE), ...Object.keys(HEAD_LETTERS), ...Object.keys(HEAD_FIXED), '.'])
  for (const [id, part] of Object.entries(BASE_HEADS))
    it(`${id}: on the standing head, in the base's, the hair's or its own letters`, () => {
      for (const p of Object.values(part.grids)) {
        expect(inFrame(p!), id).toBe(true)
        for (const r of p!.rows) for (const ch of r) expect(letters.has(ch), `${id}: '${ch}'`).toBe(true)
        // the face's parts on the face, a hat (a hood's cowl) and a beard no lower than the chest
        expect(p!.top, id).toBeGreaterThanOrEqual(0)
        expect(p!.top + p!.rows.length, id).toBeLessThanOrEqual(id.startsWith('face.') || id.startsWith('mark.') || id.startsWith('age.') || id.startsWith('glasses.') ? 13 : 22)
      }
      // a face's or a mark's variant shows from the front and the side; nothing of it from behind
      if (/^(face|mark|age|glasses)\./.test(id) && Object.keys(part.grids).length) {
        expect(part.grids.down, id).toBeDefined()
        expect(part.grids.left, id).toBeDefined()
        expect(part.grids.up, id).toBeUndefined()
      }
    })
})

describe('retone', () => {
  it('the reference becomes the key, and the ramp keeps its order of lightness', () => {
    const J = hexRgb(BASE_PALETTE.J)
    const deep = hexRgb('#6b4430')
    expect(retone(J, J, deep)).toEqual(deep)
    const lum = (c: number[]) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
    const ramp = ['O', 'H', 'J', 'F', 'Q'].map((k) => lum(retone(hexRgb(BASE_PALETTE[k]), J, deep)))
    for (let i = 1; i < ramp.length; i++) expect(ramp[i]).toBeLessThan(ramp[i - 1])
  })
})
