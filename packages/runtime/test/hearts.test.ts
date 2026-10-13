// A person's regard as ten hearts (ui/hearts.ts): a heart for every ten, rounded. Full regard is a mark a fading liking
// keeps for days (OpenWorld's home ground asks 95), and it reads as ten whole hearts, as the talk panel promises.

import { describe, expect, it } from 'vitest'
import { heartsOf } from '../src/ui/hearts.ts'

const count = (r: number) => heartsOf(r).reduce((n, h) => n + (h === 'on' ? 1 : h === 'half' ? 0.5 : 0), 0)

describe('regard as ten hearts', () => {
  it('a heart for every ten, rounded: whole from its fifth point, half before it; none at all for none', () => {
    expect([0, 3, 5, 12, 15, 50, 51, 90, 91, 94.9].map(count)).toEqual([0, 0.5, 1, 1.5, 2, 5, 5.5, 9, 9.5, 9.5])
    expect(heartsOf(-40)).toEqual(Array(10).fill(''))
  })

  it('95 — full regard, kept for days as a liking fades — reads ten whole hearts, as 100 does', () => {
    expect(heartsOf(95)).toEqual(Array(10).fill('on'))
    expect(heartsOf(100)).toEqual(Array(10).fill('on'))
  })
})
