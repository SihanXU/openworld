import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, type Scenario } from '@lsw/engine'
import { BASE_RULES, FORMS, buildOntology } from '@lsw/content'
import { BASELINE, GENERIC_RULES, ORIGIN, OUTCOMES, sweep, targets, type Baseline, type Tally } from '../src/coverage.ts'

const saved = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
const cov = sweep()
const answered = (t: Tally | undefined) => (t ? t.specific + t.generic : 0)
const REGEN = 'run `npm run coverage` to refresh the baseline (and a finished milestone\'s row in docs/roadmap.md §3)'

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
  })

  it('never takes a purpose away from a form or a fixture type', () => {
    expect(cov.idleForms.filter((id) => !saved.idleForms.includes(id))).toEqual([])
    expect(cov.idleFixtures.filter((id) => !saved.idleFixtures.includes(id))).toEqual([])
  })
})

describe('nothing put down is lost', () => {
  const onto = buildOntology()
  const rules = new Map(BASE_RULES.map((r) => [r.id, r]))
  /** Rules that use the held item up (burning it) or turn it into something else (planting it) do so by design. */
  const consumes = (id: string) => rules.get(id)!.do.some((e) => (e.op === 'destroy' || e.op === 'transform') && e.of === 'instrument')

  it('every form put on every target stays in hand or can be taken back', () => {
    const lib = new RuleLibrary(BASE_RULES)
    const lost: string[] = []
    for (const target of targets(onto)) {
      // Handing something to a person gives it away; yourself is not a place to put things.
      if (target.id === 'person' || target.id === 'self') continue
      const sc: Scenario = {
        terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
        entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }],
        event: {},
      }
      target.scenario(sc)
      const start = buildSandbox(sc, onto, lib)
      for (const form of FORMS) {
        const eng = new Engine(structuredClone(start.world.state), start.world.onto.data, lib)
        const actor = eng.world.get('actor')!
        actor.facing = 'up'
        eng.world.add({ id: 'held', type: form.id, place: { on: 'hand', holder: 'actor' } })
        const put = eng.playerVerb('put')
        if (put?.rule && consumes(put.rule.id)) continue
        if (actor.held === 'held') continue
        eng.playerVerb('take', false, 'held')
        if (actor.held !== 'held') lost.push(`${form.id} → ${target.id} (${put?.rule?.id ?? 'undefined'})`)
      }
    }
    expect(lost).toEqual([])
  })
})
