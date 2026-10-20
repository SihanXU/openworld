// The AI interface's guards, on the engine and the standard library alone (no game): what a learned
// rule may write, how a library keeps its trees through a copy, a save and a rule set aside, and what
// the validator refuses (design.md §5.11, §5.16).

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, isRefusal, replay, placePatch, restoreLibrary, validatePatch, type Cond, type Effect, type Ontology, type Patch, type Rule, type Scenario, type StatusDef, type TypeDef } from '@openworld/engine'
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
const ruleOf = (p: Patch): Rule => (p.artifacts[0] as { rule: Rule }).rule

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

describe("a save's learned kinds and statuses are checked as they come back (V4)", () => {
  const save = (types: TypeDef[], statuses: StatusDef[] = []) => ({ rules: [], types, statuses, log: [], version: 1 })
  it("one with a game's own id is left out and reported: it never changes what the game defines", () => {
    const dropped: string[] = []
    const edible: TypeDef = { id: STONE, name: { en: 'stone', zh: '石头' }, tags: ['edible'], props: { food: 5 } }
    const lit: StatusDef = { id: 'burning', name: { en: 'burning', zh: '燃烧' } }
    const lib = restoreLibrary(BASE, save([edible], [lit]), onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(lib.types).toEqual([])
    expect(lib.statuses).toEqual([])
    expect(dropped.join('\n')).toMatch(new RegExp(`^${STONE}: .*game's own`, 'm'))
    expect(dropped.join('\n')).toMatch(/^burning: .*game's own/m)
    // and the engine over that library keeps the game's stone
    const eng = buildSandbox(scene(TREE), onto, lib)
    expect(eng.world.onto.resolve(STONE).tags).not.toContain('edible')
  })

  it('one that fails the checks is left out; one that holds comes back, and may stand on another that came back', () => {
    const dropped: string[] = []
    const nameless: TypeDef = { id: 'item/odd', name: 'odd' }
    const pebble: TypeDef = { id: 'item/pebble', name: { en: 'pebble', zh: '卵石' }, makeup: [{ type: STONE, count: 1 }] }
    const small: TypeDef = { id: 'item/pebble/small', name: { en: 'small pebble', zh: '小卵石' } }
    const fixed: StatusDef = { id: 'pinned', name: { en: 'pinned', zh: '钉住' }, immobilize: true }
    const lib = restoreLibrary(BASE, save([small, nameless, pebble], [fixed]), onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(lib.types.map((t) => t.id).sort()).toEqual(['item/pebble', 'item/pebble/small'])
    expect(dropped.map((d) => d.split(':')[0]).sort()).toEqual(['item/odd', 'pinned'])
  })
})

describe('the validator is total over malformed conditions, and a learned tree never throws out of resolution (V5)', () => {
  const malformed = [{ all: { is: { role: 'target', sel: { type: TREE } } } }, { any: 'x' }, { weather: null }, { param: null }, { hour: null }, { exists: null }, { same: 'actor' }, { prop: { role: 'host', key: 'hp', bounds: { gt: null } } }, { is: { role: 'target', sel: { tags: 7 } } }] as unknown as Cond[]
  it('a condition of the wrong shape is refused, never thrown, in a patch and in a save', () => {
    const { req } = ask()
    for (const c of malformed) {
      const p = placePatch(draft('patch/odd', { if: c, then: { do: [{ op: 'log', text: 'x' }] }, else: { undefined: true } }), req).patch
      let res: ReturnType<typeof validatePatch> | undefined
      expect(() => (res = validatePatch(p, { ontology: onto, library: new RuleLibrary(BASE), scenario: req.scenario }))).not.toThrow()
      expect(res!.ok, JSON.stringify(c)).toBe(false)
      const dropped: string[] = []
      const back = restoreLibrary(BASE, { rules: [{ ...ruleOf(p), source: { origin: 'patch' } }], types: [], statuses: [], log: [], version: 1 }, onto, [], (id) => dropped.push(id))
      expect(back.rules.has('patch/odd')).toBe(false)
      expect(dropped).toEqual(['patch/odd'])
    }
  })

  it('a learned rule whose condition throws as it runs is set aside, and the hole\'s default runs', () => {
    const { req } = ask()
    const lib = new RuleLibrary(BASE)
    lib.add({ ...ruleOf(placePatch(draft('patch/odd', { if: { hour: null } as unknown as Cond, then: { do: [{ op: 'log', text: 'x' }] }, else: { undefined: true } }), req).patch), source: { origin: 'patch' } })
    const eng = buildSandbox(scene(TREE), onto, lib)
    new ModPort(eng)
    expect(() => eng.act('use', 'actor', { e: 'it' })).not.toThrow()
    expect(eng.world.state.quarantine?.['patch/odd']?.reason).toMatch(/condition/)
    expect(eng.world.fx.some((f) => f.t === 'log' && JSON.stringify(f.text).includes('Nothing happens'))).toBe(true)
    expect(() => eng.act('use', 'actor', { e: 'it' })).not.toThrow()
  })
})

describe("the repeat check counts any participant's number that rises (D4e)", () => {
  it('a stone used on a tree that grows its own power every time is an endless yield; one that tops out is not', () => {
    const { req } = ask()
    const check = (eff: Effect) => validatePatch(placePatch(draft('patch/power', { do: [eff] }), req).patch, { ontology: onto, library: new RuleLibrary(BASE), scenario: req.scenario })
    expect(check({ op: 'addProp', key: 'power', delta: 2 }).errors.join()).toMatch(/endless yield/)
    expect(check({ op: 'addProp', key: 'power', delta: 2, max: 10 }).errors).toEqual([])
  })
})
