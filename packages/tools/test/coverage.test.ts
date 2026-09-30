import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_RULES } from '@lsw/content'
import { BASELINE, GENERIC_RULES, OUTCOMES, sweep, type Baseline, type Tally } from '../src/coverage.ts'

const saved = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
const cov = sweep()
const answered = (t: Tally | undefined) => (t ? t.specific + t.generic : 0)
const REGEN = 'run `npm run coverage` to refresh the baseline and docs/roadmap.md §1'

describe('interaction coverage', () => {
  it('names only rules that exist', () => {
    const ids = new Set(BASE_RULES.map((r) => r.id))
    expect(Object.keys(GENERIC_RULES).filter((id) => !ids.has(id))).toEqual([])
  })

  it('sweeps the same space as the baseline', () => {
    const total = (t: Tally) => OUTCOMES.reduce((a, o) => a + t[o], 0)
    expect(cov.cells.length).toBe(total(cov.totals))
    expect(total(cov.totals), `the swept space changed: ${REGEN}`).toBe(total(saved.totals))
    expect(Object.keys(cov.byTarget).sort(), REGEN).toEqual(Object.keys(saved.byTarget).sort())
    expect(Object.keys(cov.byHand).sort(), REGEN).toEqual(Object.keys(saved.byHand).sort())
  })

  it('never loses an answer: no held form or target answers fewer combinations', () => {
    const lost = (now: Record<string, Tally>, was: Record<string, Tally>) =>
      Object.keys(was).filter((k) => answered(now[k]) < answered(was[k])).map((k) => `${k}: ${answered(was[k])} → ${answered(now[k])}`)
    expect(lost(cov.byHand, saved.byHand)).toEqual([])
    expect(lost(cov.byTarget, saved.byTarget)).toEqual([])
    expect(cov.totals.undefined).toBeLessThanOrEqual(saved.totals.undefined)
  })

  it('never takes a purpose away from a form or a fixture type', () => {
    expect(cov.idleForms.filter((id) => !saved.idleForms.includes(id))).toEqual([])
    expect(cov.idleFixtures.filter((id) => !saved.idleFixtures.includes(id))).toEqual([])
  })
})
