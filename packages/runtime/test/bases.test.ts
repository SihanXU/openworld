// The new figures' bases (assets/figure/bases.ts, docs/looks.md §3.1): every frame is whole and stands on the soles.

import { describe, expect, it } from 'vitest'
import { BASES, BASE_H, BASE_PALETTE, BASE_W } from '../src/assets/figure/bases.ts'
import { BASE_HAIRS, HAIR_PALETTE } from '../src/assets/figure/basehair.ts'
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
        // passing and idle: the head's top on row 3; a step (frames 1 and 3): one lower
        expect(highest(f.idle)).toBe(3)
        expect(f.walk.map(highest)).toEqual([3, 4, 3, 4])
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
