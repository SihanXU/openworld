import { describe, expect, it } from 'vitest'
import { fitScale } from '../src/fit.ts'

const size = (s: { w: number; h: number; smooth?: boolean }, box: number) => Math.max(s.w, s.h) * fitScale(s, box)

describe('a picture fitted into a box', () => {
  it('never comes out larger than the box', () => {
    for (const box of [16, 20, 32, 40, 48, 64, 96, 128, 160, 192])
      for (const side of [8, 12, 16, 18, 24, 36, 38, 64, 192, 400, 1024])
        for (const smooth of [false, true]) expect(size({ w: side, h: Math.ceil(side * 0.75), smooth }, box)).toBeLessThanOrEqual(box + 1e-9)
  })

  it('draws a painted portrait at the size of the box', () => {
    expect(size({ w: 400, h: 400, smooth: true }, 32)).toBeCloseTo(32)
    expect(size({ w: 192, h: 192, smooth: true }, 192)).toBeCloseTo(192)
  })

  it('keeps pixels even: whole halves where one fits', () => {
    expect(fitScale({ w: 16, h: 16 }, 32)).toBe(2)
    expect(fitScale({ w: 18, h: 18 }, 32)).toBe(1.5)
    expect(fitScale({ w: 16, h: 16 }, 20)).toBe(1)
    expect(fitScale({ w: 16, h: 16 }, 1000)).toBe(8)
  })

  it('shrinks a sheet too big for the box even at half size', () => {
    expect(size({ w: 64, h: 64 }, 20)).toBeCloseTo(20)
  })
})
