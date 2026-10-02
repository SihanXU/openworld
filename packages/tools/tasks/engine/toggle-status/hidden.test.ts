import { describe, expect, it } from 'vitest'
import { PRIMITIVES, RuleLibrary, buildSandbox, validatePatch, type Patch, type Rule } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
/** A creature handled with nothing in hand turns wet, or dry again. */
const rule = {
  id: 'patch/creature-toggles-wet',
  host: { type: 'actor/creature' },
  on: 'impulse/handle',
  tree: { do: [{ op: 'toggleStatus', status: 'wet' }] },
} as unknown as Rule

describe('toggleStatus (hidden)', () => {
  it('is a documented primitive', () => {
    expect((PRIMITIVES as Record<string, string>).toggleStatus).toBeTruthy()
  })

  it('adds a missing status and removes a present one', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
        ],
        event: {},
      },
      onto,
      new RuleLibrary([...BASE_RULES, { ...rule, source: { origin: 'patch' } }]),
    )
    eng.act('hands', 'actor', { e: 'slime' }, { instrument: null })
    expect(eng.world.hasStatus({ e: 'slime' }, 'wet')).toBe(true)
    eng.act('hands', 'actor', { e: 'slime' }, { instrument: null })
    expect(eng.world.hasStatus({ e: 'slime' }, 'wet')).toBe(false)
  })

  it('is validated like addStatus', () => {
    const ok: Patch = { artifacts: [{ kind: 'rule', rule }] }
    expect(validatePatch(ok, { ontology: onto, library: new RuleLibrary(BASE_RULES) }).errors).toEqual([])
    const bad: Patch = { artifacts: [{ kind: 'rule', rule: { ...rule, id: 'patch/x', tree: { do: [{ op: 'toggleStatus', status: 'nope' }] } } as unknown as Rule }] }
    expect(validatePatch(bad, { ontology: onto, library: new RuleLibrary(BASE_RULES) }).errors.join()).toMatch(/unknown status "nope"/)
  })
})
