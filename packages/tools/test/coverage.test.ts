import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, SANDBOX_MAP, buildSandbox, isDo, leaves, type Ref, type Scenario } from '@lsw/engine'
import { BASE_RULES, FORMS, buildOntology } from '@lsw/content'
import { BASELINE, FRONT, GENERIC_RULES, ORIGIN, OUTCOMES, sweep, targets, type Baseline, type Tally } from '../src/coverage.ts'

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
  const lib = new RuleLibrary(BASE_RULES)
  /** An act's own rule that uses the put thing up (building with it) or turns it into something else (sowing it) does so by design. */
  const consumes = (id: string) => {
    const r = lib.rules.get(id)
    return !!r && r.on === 'act/put' && leaves(r.tree).some((l) => isDo(l) && l.do.some((e) => e.op === 'destroy' || e.op === 'transform'))
  }

  it('every form put on every target stays in hand or can be taken back', () => {
    const lost: string[] = []
    for (const target of targets(onto)) {
      // Handing something to a person gives it away; yourself is not a place to put things.
      if (target.id === 'person' || target.id === 'self') continue
      const sc: Scenario = {
        terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
        entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }],
        event: {},
      }
      const key = target.scenario(sc)
      const ref: Ref = key === 'target' ? { e: key } : { tile: { map: SANDBOX_MAP, ...FRONT } }
      const start = buildSandbox(sc, onto, lib)
      for (const form of FORMS) {
        const eng = new Engine(structuredClone(start.world.state), start.world.onto.data, lib)
        const actor = eng.world.get('actor')!
        eng.author(() => eng.world.add({ id: 'held', type: form.id, place: { on: 'hand', holder: 'actor' } }))
        eng.trace.length = 0
        const put = eng.act('put', 'actor', ref, { instrument: { e: 'held' } })
        if (eng.trace.some((t) => t.rule && consumes(t.rule))) continue
        if (actor.held === 'held') continue
        eng.act('take', 'actor', { e: 'held' }, { instrument: null })
        if (actor.held !== 'held' && !actor.contents?.includes('held')) lost.push(`${form.id} → ${target.id} (${put.rule?.id ?? 'undefined'})`)
      }
    }
    expect(lost).toEqual([])
  })
})
