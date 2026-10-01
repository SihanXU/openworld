import { describe, expect, it } from 'vitest'
import { PRIMITIVES, RuleLibrary, buildSandbox, validatePatch, type Patch, type Rule } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const rule = {
  id: 'patch/rope-toggles-wet',
  on: 'interaction',
  when: { verb: ['interact'], instrument: { tags: ['fiber'] }, target: { type: 'actor/creature' } },
  do: [{ op: 'toggleStatus', of: 'target', status: 'wet' }],
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
          { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
          { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
        ],
        event: {},
      },
      onto,
      new RuleLibrary([...BASE_RULES, rule]),
    )
    eng.interact('interact', 'actor', { e: 'slime' })
    expect(eng.world.hasStatus({ e: 'slime' }, 'wet')).toBe(true)
    eng.interact('interact', 'actor', { e: 'slime' })
    expect(eng.world.hasStatus({ e: 'slime' }, 'wet')).toBe(false)
  })

  it('is validated like addStatus', () => {
    const ok: Patch = { artifacts: [{ kind: 'rule', rule }] }
    expect(validatePatch(ok, { ontology: onto, library: new RuleLibrary(BASE_RULES) }).errors).toEqual([])
    const bad: Patch = { artifacts: [{ kind: 'rule', rule: { ...rule, id: 'patch/x', do: [{ op: 'toggleStatus', of: 'target', status: 'nope' }] } as unknown as Rule }] }
    expect(validatePatch(bad, { ontology: onto, library: new RuleLibrary(BASE_RULES) }).errors.join()).toMatch(/unknown status "nope"/)
  })
})
