// A person's day counted by the hour (schedule.ts): the whole day, a night past midnight, gaps and overlaps.

import { describe, expect, it } from 'vitest'
import { dayHours } from '../src/app/schedule.ts'

describe('a person\'s day', () => {
  it('0 to 24 is the whole day: no hour empty', () => {
    expect(dayHours([{ from: 0, to: 24 }])).toEqual({ empty: [], twice: [] })
  })

  it('a night runs past midnight; what is left uncovered and what is covered twice are said', () => {
    expect(dayHours([{ from: 22, to: 6 }, { from: 6, to: 20 }])).toEqual({ empty: [20, 21], twice: [] })
    expect(dayHours([{ from: 8, to: 12 }, { from: 11, to: 13 }, { from: 13, to: 8 }])).toEqual({ empty: [], twice: [11] })
  })
})
