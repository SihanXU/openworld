import { describe, expect, it } from 'vitest'
import { Engine, ModPort, RuleLibrary, SANDBOX_MAP, buildSandbox, endlessYield, repeatYields, scenarioEvent, validatePatch, type Patch, type Ref, type Rule, type Scenario } from '@lsw/engine'
import { BASE_RULES, FORMS, STORY_RULES, buildOntology } from '@lsw/content'
import { FRONT, HANDS, ORIGIN, targets, verbsFor } from '../src/coverage.ts'

// No endless yield (world-model.md §8.4, §10.2, D23): an event repeated with no time between, on a
// host that is not used up, must stop making things. The stick farm — a stump struck, a stick, the
// stump as it was, again — is what this refuses: in the base library, and in any patch.

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** A request for a blow on something that cannot break (a statue): the hole the stick farm filled. */
function blowOnStatue(): Scenario {
  const eng = buildSandbox(
    {
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'axe', type: 'item/weapon/blade/axe', x: 2, y: 2, heldBy: 'actor' },
        { key: 'statue', type: 'fixture/sacred/statue', x: 2, y: 1 },
      ],
      event: {},
    },
    onto,
    lib(),
  )
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'statue' })
  const rec = port.records.find((r) => r.event.kind === 'impulse/strike')!
  return rec.request.scenario
}

const patch = (rule: Omit<Rule, 'source'>): Patch => ({ artifacts: [{ kind: 'rule', rule: rule as Rule }] })
const STICK = { op: 'spawn' as const, type: 'item/material/stick', at: 'host' as const }

describe('no endless yield (world-model.md §8.4)', () => {
  it('the validator refuses the stick farm: a blow, a stick, the host as it was', () => {
    const res = validatePatch(patch({ id: 'patch/statue-sticks', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { do: [STICK] } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(res.errors.join('\n')).toMatch(/endless yield/)
  })

  it('and refuses it when the stick comes only by chance: the check forces every chance', () => {
    const res = validatePatch(patch({ id: 'patch/statue-luck', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { if: { chance: 0.05 }, then: { do: [STICK] }, else: { do: [] } } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(res.errors.join('\n')).toMatch(/endless yield/)
    // and the other way round: nothing by chance, a stick otherwise
    const rev = validatePatch(patch({ id: 'patch/statue-unluck', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { if: { chance: 0.95 }, then: { do: [] }, else: { do: [STICK] } } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(rev.errors.join('\n')).toMatch(/endless yield/)
  })

  it('and accepts the same yield when it costs its host: a status that gates it and runs out', () => {
    const res = validatePatch(
      patch({
        id: 'patch/statue-chips',
        host: { type: 'fixture/sacred/statue' },
        on: 'impulse/strike',
        tree: { if: { not: { has: { role: 'host', status: 'notched' } } }, then: { do: [STICK, { op: 'addStatus', status: 'notched' }] }, else: { do: [] } },
      }),
      { ontology: onto, library: lib(), scenario: blowOnStatue() },
    )
    expect(res.errors.filter((e) => /endless/.test(e))).toEqual([])
  })

  it('refuses a mixed nested chance yield', () => {
    const res = validatePatch(patch({ id: 'patch/mixed-luck', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: {
      if: { chance: 0.5 }, then: { if: { chance: 0.5 }, then: { do: [] }, else: { do: [STICK] } }, else: { do: [] },
    } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(res.errors.join('\n')).toMatch(/endless yield/)
  })

  it('explores the triggering chance before it can gate off the repeat check', () => {
    const gated = { do: [{ op: 'addStatus' as const, status: 'notched' }] }
    const res = validatePatch(patch({ id: 'patch/chance-gate', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: {
      if: { has: { role: 'host', status: 'notched' } }, then: { do: [] }, else: {
        if: { chance: 0.5 }, then: { if: { chance: 0.5 }, then: gated, else: { do: [STICK] } }, else: gated,
      },
    } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(res.errors.join('\n')).toMatch(/endless yield/)
  })

  it('explores independent chances across an emission and its receiver', () => {
    const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'statue', type: 'fixture/sacred/statue', x: 2, y: 1 }], event: { kind: 'impulse/strike', host: 'statue', actor: 'actor' } }
    const library = new RuleLibrary([
      { id: 'test/send', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { if: { chance: 0.5 }, then: { do: [{ op: 'emit', impulse: 'coat', to: 'host', chance: 0.5 }] }, else: { do: [] } } },
      { id: 'test/receive', host: { type: 'fixture/sacred/statue' }, on: 'impulse/coat', tree: { if: { chance: 0.5 }, then: { do: [] }, else: { do: [STICK] } } },
    ])
    const eng = buildSandbox(sc, onto, library)
    expect(endlessYield(eng, scenarioEvent(sc, eng))).toBe(true)
  })

  it('explores a failed chance emission as well as a successful one', () => {
    const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'statue', type: 'fixture/sacred/statue', x: 2, y: 1 }], event: { kind: 'impulse/strike', host: 'statue', actor: 'actor' } }
    const library = new RuleLibrary([
      { id: 'test/send', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { do: [{ op: 'emit', impulse: 'coat', to: 'host', chance: 0.5 }, { op: 'emit', impulse: 'handle', to: 'host' }] } },
      { id: 'test/gate', host: { type: 'fixture/sacred/statue' }, on: 'impulse/coat', tree: { do: [{ op: 'setProp', key: 'gated', value: true }] } },
      { id: 'test/yield', host: { type: 'fixture/sacred/statue' }, on: 'impulse/handle', tree: { if: { prop: { role: 'host', key: 'gated', cmp: true } }, then: { do: [] }, else: { do: [STICK] } } },
    ])
    const eng = buildSandbox(sc, onto, library)
    expect(endlessYield(eng, scenarioEvent(sc, eng))).toBe(true)
  })

  it('refuses a patch when chance exploration exceeds its assignment budget', () => {
    const res = validatePatch(patch({ id: 'patch/many-chances', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: {
      if: { all: Array.from({ length: 7 }, () => ({ any: [{ chance: 0.5 }, { chance: 1 }] })) }, then: { do: [] }, else: { do: [] },
    } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toMatch(/repeat check.*64.*chance assignments.*safety/i)
  })

  it('does not explore impossible outcomes of zero or certain chances', () => {
    for (const chance of [0, 1]) {
      const res = validatePatch(patch({ id: `patch/certain-${chance}`, host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: {
        if: { chance }, then: { do: chance ? [] : [STICK] }, else: { do: chance ? [STICK] : [] },
      } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
      expect(res.errors).toEqual([])
    }
  })

  it('accepts exactly 64 safe assignments and skips unreachable chance sites', () => {
    for (const conditions of [
      Array.from({ length: 6 }, () => ({ any: [{ chance: 0.5 }, { chance: 1 }] })),
      Array.from({ length: 7 }, () => ({ chance: 0.5 })),
    ]) {
      const res = validatePatch(patch({ id: 'patch/safe-chances', host: { type: 'fixture/sacred/statue' }, on: 'impulse/strike', tree: { if: { all: conditions }, then: { do: [] }, else: { do: [] } } }), { ontology: onto, library: lib(), scenario: blowOnStatue() })
      expect(res.errors).toEqual([])
    }
  })

  it('honours both outcomes of a breakdown fraction', () => {
    const library = new RuleLibrary([{ id: 'test/break', host: { type: 'fixture/sacred/test_statue' }, on: 'impulse/handle', tree: { do: [{ op: 'breakdown' }] } }])
    library.addType({ id: 'fixture/sacred/test_statue', name: 'Test Statue', makeup: [{ type: 'item/material/stick', count: 1 }] })
    const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'statue', type: 'fixture/sacred/test_statue', x: 2, y: 1 }], event: { kind: 'impulse/handle', host: 'statue', actor: 'actor' } }
    for (const outcome of [true, false]) {
      const eng = buildSandbox(sc, onto, library)
      eng.world.luck = () => outcome
      eng.queue(scenarioEvent(sc, eng))
      expect(Object.values(eng.world.state.entities).filter((e) => e.type === STICK.type)).toHaveLength(outcome ? 1 : 0)
    }
  })

  it('a new thing that can break says what it is made of and what it leaves', () => {
    const type = (extra: object) => ({ kind: 'type' as const, type: { id: 'fixture/nature/crystal_spire', name: { en: 'Crystal Spire', zh: '水晶尖塔' }, tags: ['crystal'], ...extra } })
    const errs = (extra: object) => validatePatch({ artifacts: [type(extra)] }, { ontology: onto, library: lib() }).errors.join('\n')
    expect(errs({ props: { maxHp: 8 } })).toMatch(/props\.material/)
    expect(errs({ props: { maxHp: 8, material: 'crystal' } })).toMatch(/makeup/)
    expect(errs({ props: { maxHp: 8, material: 'unobtainium' } })).toMatch(/not a material/)
    expect(errs({ props: { maxHp: 8, material: 'crystal' }, makeup: [{ type: 'item/gem', count: 1 }] })).not.toMatch(/material|makeup/)
    // one that cannot break says so too: every new thing is made of something (world-model.md §8.3), so it
    // can be crafted, broken and recovered like the world's own
    expect(errs({})).toMatch(/props\.material/)
    expect(errs({ props: { material: 'crystal' } })).toMatch(/makeup/)
    expect(errs({ props: { material: 'crystal' }, makeup: [{ type: 'item/gem', count: 1 }] })).not.toMatch(/material|makeup/)
  })

  it('the base library: every act any input makes, on anything the player can face, stops yielding when repeated', () => {
    const endless: string[] = []
    let yielding = 0
    const library = lib()
    for (const target of targets(onto)) {
      const sc: Scenario = {
        terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
        entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }, ...FORMS.map((f, i) => ({ key: `hand${i}`, type: f.id, ...ORIGIN, inside: 'actor' }))],
        event: {},
      }
      const key = target.scenario(sc)
      const base = buildSandbox(sc, onto, library)
      HANDS.forEach((hand, i) => {
        for (const verb of verbsFor(hand, target.id)) {
          const eng = new Engine(structuredClone(base.world.state), base.world.onto.data, library)
          const ref: Ref = key === 'actor' || key === 'target' ? { e: key } : eng.world.cellRef(SANDBOX_MAP, FRONT.x, FRONT.y)
          const ev = eng.actEvent(verb, 'actor', ref, hand ? { e: `hand${i - 1}` } : undefined)
          if (!eng.preview(ev).defined || eng.preview(ev).unknown) continue
          if (!repeatYields(eng, ev, 1)[0]) continue
          yielding++
          if (endlessYield(eng, ev)) endless.push(`${hand || '(hand)'} ${verb} ${target.id}`)
        }
      })
    }
    // (it does reach what yields: felling, mining, harvesting, splitting, fishing …)
    expect(yielding).toBeGreaterThan(20)
    expect(endless).toEqual([])
  }, 300_000)
})
