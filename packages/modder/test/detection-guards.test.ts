// Guards on the detection side of the modder: the deterministic fixes laid on a model's draft, the
// auditor's probe and its evidence, the blocking audit and review, the review after the fact, and the
// detection of what a model carries. Each test names the defect it holds shut.

import { describe, expect, it } from 'vitest'
import { type Rule } from '@openworld/engine'
import { buildOntology } from '@openworld-game/content'
import { stationFromRules } from '../src/index.ts'

const onto = buildOntology()

describe('stationFromRules: yields only where the rule makes them so', () => {
  const STICK = 'item/material/stick'
  const ANVIL = 'fixture/craft/anvil'
  const bits = { id: 'item/material/stone_bits', name: { en: 'Stone Bits', zh: '碎石' }, tags: ['stone'], props: { material: 'stone' }, makeup: [{ type: STICK, count: 1 }] }
  const atAnvil = (extra?: object): Rule => ({
    id: 'patch/stick-bits',
    host: { type: STICK },
    on: 'act/use',
    doc: 'd',
    tree: { if: extra ? { all: [{ is: { role: 'target', sel: { type: ANVIL } } }, extra] } : { is: { role: 'target', sel: { type: ANVIL } } }, then: { do: [{ op: 'spawn', type: bits.id, at: 'target', count: 5 }, { op: 'destroy' }] }, else: { undefined: true } } as never,
  })
  const typeOf = (rule: Rule, type: object) => (stationFromRules({ artifacts: [{ kind: 'type', type: type as never }, { kind: 'rule', rule }] }, onto).patch.artifacts[0] as { type: { station?: string; yields?: number } }).type

  it('a type made by hand keeps one for one, though a rule makes five at an anvil (E2)', () => {
    expect(typeOf(atAnvil(), { ...bits, station: 'hands' }).yields).toBeUndefined()
  })

  it('a branch taken only by chance gives neither a station nor yields (E2)', () => {
    expect(typeOf(atAnvil({ chance: 0.1 }), { ...bits, station: 'hands' }).yields).toBeUndefined()
    const t = typeOf(atAnvil({ chance: 0.1 }), bits)
    expect(t.station).toBeUndefined()
    expect(t.yields).toBeUndefined()
    // the same branch with no chance in it is the anvil's craft, five at a time
    expect(typeOf(atAnvil(), bits)).toMatchObject({ station: 'anvil', yields: 5 })
  })
})
