// The affordance set stays a set of holes (design.md §5.17): every case, a bare hand on its thing, is still a
// question the base rules leave open, so the evaluation measures the modder and not the content.

import { describe, expect, it } from 'vitest'
import { AFFORDANCE_CASES, askCase } from '../src/eval/affordanceSet.ts'

describe('the affordance set', () => {
  it('has uses and things with none, each still a hole', () => {
    expect(AFFORDANCE_CASES.filter((c) => c.expect === 'use').length).toBeGreaterThanOrEqual(6)
    expect(AFFORDANCE_CASES.filter((c) => c.expect === 'words').length).toBeGreaterThanOrEqual(6)
    for (const c of AFFORDANCE_CASES) {
      const { port } = askCase(c)
      expect(port.records.map((r) => r.request.event.kind), c.name).toEqual(['impulse/handle'])
    }
  })

  it('an owned thing is told as someone else\'s, its owner near', () => {
    const { port } = askCase(AFFORDANCE_CASES.find((c) => c.owned)!)
    expect(port.records[0].request.context.whose).toMatch(/someone else's/)
  })
})
