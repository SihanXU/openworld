// The AI interface's guards, on the engine and the standard library alone (no game): what a learned
// rule may write, how a library keeps its trees through a copy, a save and a rule set aside, and what
// the validator refuses (design.md §5.11, §5.16).

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, isRefusal, replay, placePatch, restoreLibrary, validatePatch, type Cond, type Effect, type Ontology, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'

const STD = STDLIB_ONTOLOGY as Ontology
const STONE = 'item/stone'
const TREE = 'fixture/tree'
const HIVE = 'fixture/hive'
const onto: Ontology = {
  ...STD,
  types: {
    ...STD.types,
    [STONE]: { id: STONE, name: { en: 'stone', zh: '石头' } },
    [TREE]: { id: TREE, name: { en: 'tree', zh: '树' } },
    [HIVE]: { id: HIVE, name: { en: 'hive', zh: '蜂巢' } },
  },
  terrains: { ...STD.terrains, grass: { id: 'grass', name: { en: 'grass', zh: '草' } } },
} as Ontology
const BASE = STDLIB_RULES

/** A stone in the player's hand, used on a thing beside them. */
const scene = (target: string): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: target, x: 2, y: 1 },
  ],
  event: {},
})

/** The stone used on a thing: the port's request for the hole it reaches. */
function ask(target = TREE, lib = new RuleLibrary(BASE)) {
  const eng = buildSandbox(scene(target), onto, lib)
  const port = new ModPort(eng)
  const res = eng.act('use', 'actor', { e: 'it' })
  return { eng, port, res, req: port.records[0]?.request }
}

const is = (type: string): Cond => ({ is: { role: 'target', sel: { type } } })
/** A draft as the model writes it: the harness places it (placePatch). */
const draft = (id: string, tree: Rule['tree']): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'x' }, on: 'x', label: 'Use {instrument} on {target}', tree } }] })

describe('a revision keeps what grew below it through a copy and a save (V3)', () => {
  it('the child stays placed live, in a clone, and in a restored save', () => {
    const { req } = ask()
    const h = holeKey(req.hole.rule, req.hole.path)
    const no = ['!' + JSON.stringify(is(TREE))]
    const root = (id: string): Rule => ({ id, host: { type: STONE }, on: 'act/use', hole: h, at: [], tree: { if: is(TREE), then: { do: [] }, else: { undefined: true } }, source: { origin: 'patch' } })
    const lib = new RuleLibrary(BASE)
    lib.add(root('r1'))
    lib.add({ id: 's', host: { type: STONE }, on: 'act/use', hole: h, at: no, tree: { do: [{ op: 'log', text: 's' }] }, source: { origin: 'patch' } })
    lib.remove('r1')
    lib.add(root('r2'), undefined, 'r1')
    expect(lib.stale()).toEqual([])
    expect(lib.clone().stale()).toEqual([])
    expect(RuleLibrary.fromJSON(lib.toJSON()).stale()).toEqual([])
    const dropped: string[] = []
    const back = restoreLibrary(BASE, lib.learnedJSON(), onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(dropped).toEqual([])
    expect(back.rules.has('s')).toBe(true)
    expect(back.rules.has('r2')).toBe(true)
  })
})

/** The stone's tree at its hole: a root that answers the tree and leaves the rest open, and a child that answers the hive. */
function grown() {
  const { req } = ask()
  const h = holeKey(req.hole.rule, req.hole.path)
  const lib = new RuleLibrary(BASE)
  lib.add({ id: 'r1', host: { type: STONE }, on: 'act/use', hole: h, at: [], tree: { if: is(TREE), then: { do: [{ op: 'log', text: 'r1' }] }, else: { undefined: true } }, source: { origin: 'patch' } })
  lib.add({ id: 's', host: { type: STONE }, on: 'act/use', hole: h, at: ['!' + JSON.stringify(is(TREE))], tree: { do: [{ op: 'log', text: 's' }] }, source: { origin: 'patch' } })
  return lib
}
/** Who answers the stone used on a thing, under a library. */
const answerOf = (target: string, lib: RuleLibrary) => {
  const eng = buildSandbox(scene(target), onto, lib)
  return eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' }))
}

describe('a rule set aside at run time keeps its place (V6)', () => {
  it('its own cases are open again, and the answer below it keeps answering, live, in a copy and after a save', () => {
    const lib = grown()
    const eng = buildSandbox(scene(TREE), onto, lib)
    expect(eng.fault('r1', 'it ran away', true)).toBe(true)
    expect(eng.world.state.quarantine?.r1).toBeDefined()
    expect(lib.rules.has('r1')).toBe(false)
    expect(lib.stale()).toEqual([])
    // the tree's case is open again: where a new answer would go is r1's old leaf
    const tree = answerOf(TREE, lib)
    expect(tree.defined).toBe(false)
    expect(tree.open?.path).toEqual([JSON.stringify(is(TREE))])
    // the hive's answer, below r1, still answers
    expect(answerOf(HIVE, lib).rule?.id).toBe('s')
    expect(lib.clone().stale()).toEqual([])
    expect(answerOf(HIVE, lib.clone()).rule?.id).toBe('s')
    expect(answerOf(TREE, lib.clone()).defined).toBe(false)
    // a save keeps it set aside, in its place
    const dropped: string[] = []
    const back = restoreLibrary(BASE, lib.learnedJSON(), onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(dropped).toEqual([])
    expect(back.rules.has('r1')).toBe(false)
    expect(back.rules.has('s')).toBe(true)
    expect(answerOf(HIVE, back).rule?.id).toBe('s')
    expect(answerOf(TREE, back).defined).toBe(false)
    expect(answerOf(HIVE, RuleLibrary.fromJSON(lib.toJSON())).rule?.id).toBe('s')
  })
})

describe('a rule set aside at run time is not served again (C1)', () => {
  it('the same answer to the question its open leaf raises is refused: the default runs, the question is not asked again', () => {
    const { eng, port, req } = ask()
    const answer = placePatch(draft('patch/a', { do: [{ op: 'log', text: 'a' }] }), req).patch
    expect(port.submit(req.id, answer).ok).toBe(true)
    expect(eng.fault('patch/a', 'it ran away', true)).toBe(true)
    // the leaf is open again: the act asks again
    port.provider = { resolve: () => new Promise(() => {}) }
    eng.act('use', 'actor', { e: 'it' })
    const again = port.records[1]
    expect(again?.status).toBe('pending')
    // the service still holds the rule, and answers with it
    eng.world.fx.length = 0
    const res = port.submit(again.id, answer)
    expect(res.ok).toBe(false)
    expect(res.errors.join()).toMatch(/set aside/)
    expect(again.status).toBe('rejected')
    expect(eng.lib.rules.has('patch/a')).toBe(false)
    expect(eng.lib.isAside('patch/a')).toBe(true)
    // the hole's default ran
    expect(eng.world.fx.some((f) => f.t === 'log' && JSON.stringify(f.text).includes('Nothing happens'))).toBe(true)
    // and the question is not asked again this session
    eng.act('use', 'actor', { e: 'it' })
    expect(port.records.length).toBe(2)
  })
})

describe("only the story's own rules write its protected facts, whoever started the chain (V1)", () => {
  const PROTECTED = ['ford.']
  /** A learned rule on the story at its handle hole (a player's chain handing the story something). */
  const onStory = (effects: Effect[]): Patch => ({ artifacts: [{ kind: 'rule', rule: { id: 'patch/story', host: { type: 'resident/story' }, on: 'impulse/handle', hole: 'core/handle', at: [], tree: { do: effects } } }] })
  const check = (p: Patch, world?: boolean) => validatePatch(p, { ontology: onto, library: new RuleLibrary(BASE), protectedFacts: PROTECTED, world })

  it('a player-started chain may not set or raise a protected fact', () => {
    for (const world of [false, true]) {
      expect(check(onStory([{ op: 'setProp', key: 'ford.crossed', value: 1 }]), world).errors.join()).toMatch(/ford\.crossed/)
      expect(check(onStory([{ op: 'addProp', key: 'ford.crossed', delta: 1 }]), world).errors.join()).toMatch(/ford\.crossed/)
    }
    // nor keep the facts an event carries, nor hand the story one to keep
    expect(check(onStory([{ op: 'facts' }])).errors.join()).toMatch(/facts/)
    const handing: Patch = { artifacts: [{ kind: 'rule', rule: { id: 'patch/hand', host: { type: STONE }, on: 'act/use', hole: holeKey(ask().req.hole.rule, ask().req.hole.path), at: [], tree: { do: [{ op: 'emit', impulse: 'handle', to: 'story', params: { 'fact.ford.crossed': 1 } }] } } }] }
    expect(check(handing).errors.join()).toMatch(/ford\.crossed/)
  })

  it('a fact of its own is still the patch\'s to keep', () => {
    expect(check(onStory([{ op: 'setProp', key: 'stones.used', value: 1 }])).errors).toEqual([])
  })
})

describe('an effect refused in the replay fails validation (V2)', () => {
  it('a spawn past the most, or an amount past what a number holds, is a replay error; the line stays a developer\'s', () => {
    for (const eff of [{ op: 'spawn', type: STONE, at: 'actor', into: 'tile', count: 1000 }, { op: 'addProp', key: 'charge', delta: { prop: 'hp', of: 'actor', mul: 1e308 } }] as Effect[]) {
      const { eng, req } = ask()
      const res = validatePatch(placePatch(draft('patch/many', { do: [eff] }), req).patch, { ontology: onto, library: eng.lib, scenario: req.scenario })
      expect(res.ok).toBe(false)
      expect(res.errors.join()).toMatch(/replay: rule patch\/many: /)
    }
    // the line a refusal leaves is the developer's, and the sandbox tells it by isRefusal
    const { eng, req } = ask()
    const p = placePatch(draft('patch/many', { do: [{ op: 'spawn', type: STONE, at: 'actor', count: 1000 }] }), req).patch
    eng.lib.add({ ...(p.artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } })
    const rp = replay(req.scenario, onto, eng.lib)
    const refused = rp.engine.world.fx.filter(isRefusal)
    expect(refused.length).toBe(1)
    expect(refused[0]).toMatchObject({ t: 'log', tone: 'dev' })
    expect(isRefusal({ t: 'log', text: 'patch rejected: x', tone: 'dev' })).toBe(false)
  })
})
