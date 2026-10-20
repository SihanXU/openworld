// Guards on the detection side of the modder: the deterministic fixes laid on a model's draft, the
// auditor's probe and its evidence, the blocking audit and review, the review after the fact, and the
// detection of what a model carries. Each test names the defect it holds shut.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { auditTools, probe, stationFromRules, withPatch } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const TREE = 'fixture/nature/dead_tree'

/** The stone used on a dead tree: a hole in the stone's own nature (`core/use`), the stone the host. */
function useRequest(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: TREE, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

/** A learned rule for the stone on the dead tree, placed where the request fell undefined. */
const onDeadTree = (req: ModRequest, id: string, effects: unknown[]): Patch =>
  placePatch({ artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, doc: 'd', tree: { if: { is: { role: 'target', sel: { type: TREE } } }, then: { do: effects as never }, else: { undefined: true } } } }] }, req).patch

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

describe('the probe: a number that rises on every use is a farm, whoever holds it', () => {
  it('finds a stone whose power grows by two with every use, with no model (D4a)', () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const farm = onDeadTree(req, 'patch/stone-hones', [{ op: 'addProp', key: 'power', delta: 2 }])
    const found = probe(req, onto, base, withPatch(base, farm))
    expect(found.map((f) => f.kind)).toEqual(['farm'])
    expect(found[0].title).toMatch(/power every time/)
    // a number that rises once and stops (capped) is no farm
    const capped = onDeadTree(req, 'patch/stone-hones-once', [{ op: 'addProp', key: 'power', delta: 2, max: 2 }])
    expect(probe(req, onto, base, withPatch(base, capped))).toEqual([])
  })
})

describe('the auditor sees what the engine refused', () => {
  it('lists a refused effect among the warnings of a run (its dev line, "rule …")', () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const bad = onDeadTree(req, 'patch/stone-unheals', [{ op: 'heal', amount: -5 }])
    const tool = auditTools(req.scenario, onto, base, withPatch(base, bad)).find((t) => t.name === 'run')!
    const out = tool.run({ steps: [{ act: 'use', target: req.scenario.event.target, instrument: req.scenario.event.instrument }] })
    expect(out).toMatch(/warnings: rule patch\/stone-unheals: a heal of -5/)
  })
})
