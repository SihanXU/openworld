// Learned rules take one leaf (design.md §5.16): one tree per (type, kind, hole), grown by answers
// in order; a second answer fills an open leaf of the first; sibling types are not reached; an
// answer set aside at runtime opens its leaves again; the request says where the next answer goes.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, compose, holeKey, locate, patchKey, placePatch, restoreLibrary, validatePatch, type Cond, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { WorldLibrary } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
// (a creature used on would be offered the thing: `core/use` answers it; a dead tree and a beehive are its hole)
const TREE = 'fixture/nature/dead_tree'
const HIVE = 'fixture/nature/beehive'

const scene = (target: string): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: target, x: 2, y: 1 },
  ],
  event: {},
})

/** The stone used on a thing: the port's request for the hole it reaches. */
function ask(target: string, lib = new RuleLibrary(BASE)) {
  const eng = buildSandbox(scene(target), onto, lib)
  const port = new ModPort(eng)
  const res = eng.act('use', 'actor', { e: 'it' })
  return { eng, port, res, req: port.records[0]?.request }
}

const is = (type: string): Cond => ({ is: { role: 'target', sel: { type } } })
const rule = (id: string, tree: Rule['tree']): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'x' }, on: 'x', label: 'Use {instrument} on {target}', tree } }] })

describe('one tree per (type, kind, hole)', () => {
  it('the first answer is the tree; the request for a case it left open says where the next goes', () => {
    const { port, req } = ask(TREE)
    expect(req.hole.at).toEqual([])
    // the dead tree's case answered, the rest left open
    const first = placePatch(rule('patch/stone-tree', { if: is(TREE), then: { do: [{ op: 'log', text: 'tree' }] }, else: { undefined: true } }), req).patch
    const r = (first.artifacts[0] as { rule: Rule }).rule
    expect(r).toMatchObject({ host: { type: STONE }, on: 'act/use', hole: holeKey(req.hole.rule, req.hole.path), at: [] })
    expect(port.submit(req.id, first).ok).toBe(true)
    const lib = port['eng'].lib
    // a beehive reaches the open leaf: still a hole, and the request's `at` is the path to that leaf
    const hive = ask(HIVE, lib.clone())
    expect(hive.res.defined).toBe(false)
    expect(hive.req.hole.at).toEqual(['!' + JSON.stringify(is(TREE))])
    expect(hive.req.hole.at).toEqual(hive.res.open?.path)
    // the second answer replaces that leaf; the dead tree's answer is untouched
    const second = placePatch(rule('patch/stone-hive', { do: [{ op: 'log', text: 'hive' }] }), hive.req).patch
    expect(hive.port.submit(hive.req.id, second).ok).toBe(true)
    const key = patchKey(STONE, 'act/use', hive.req.hole.rule + (hive.req.hole.path.length ? '#' + hive.req.hole.path.join('&') : ''))
    const tree = hive.eng.lib.tree(key)!
    expect(locate(tree, [])).toBeUndefined() // the root is a branch now
    expect(locate(tree, hive.req.hole.at)?.leaf).toEqual({ do: [{ op: 'log', text: 'hive' }] })
    expect(hive.eng.resolveEvent(hive.eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })).rule?.id).toBe('patch/stone-hive')
    const again = ask(TREE, hive.eng.lib.clone())
    expect(again.res.defined).toBe(true)
    expect(again.eng.resolveEvent(again.eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })).rule?.id).toBe('patch/stone-tree')
  })

  it('an answer at a leaf already answered is refused; a first answer with a path is refused', () => {
    const { port, req, eng } = ask(TREE)
    const first = placePatch(rule('patch/a', { do: [{ op: 'log', text: 'a' }] }), req).patch
    expect(port.submit(req.id, first).ok).toBe(true)
    const again = { ...first, artifacts: [{ kind: 'rule' as const, rule: { ...(first.artifacts[0] as { rule: Rule }).rule, id: 'patch/b' } }] }
    expect(validatePatch(again, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/already answered/)
    const deep = { artifacts: [{ kind: 'rule' as const, rule: { ...(first.artifacts[0] as { rule: Rule }).rule, id: 'patch/c', hole: 'core/handle', at: ['x'] } }] }
    expect(validatePatch(deep, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/no tree at this hole yet/)
  })

  it('two rules of one patch cannot take the same leaf', () => {
    const { req, eng } = ask(TREE)
    const r = (placePatch(rule('patch/a', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule
    const twice: Patch = { artifacts: [{ kind: 'rule', rule: r }, { kind: 'rule', rule: { ...r, id: 'patch/b' } }] }
    expect(validatePatch(twice, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()).toMatch(/"patch\/b".at: that leaf is already answered/)
  })

  it('a learned rule never inherits, and names one type only', () => {
    const { req, eng } = ask(TREE)
    const bad = (r: Partial<Rule>) => validatePatch({ artifacts: [{ kind: 'rule', rule: { ...(placePatch(rule('patch/x', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule, ...r } }] }, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()
    expect(bad({ tree: { if: is(HIVE), then: { do: [] }, else: 'inherit' } })).toMatch(/never inherits/)
    expect(bad({ tree: { if: is(HIVE), then: { do: [] } } })).toMatch(/never inherits/)
    expect(bad({ host: { type: 'item/material' } })).toMatch(/host of the triggering event is a item\/material\/stone/)
    expect(bad({ host: { type: STONE, tags: ['stone'] } })).toMatch(/host must be exactly/)
    expect(bad({ on: 'act' })).toMatch(/exact event kind/)
    expect(bad({ tree: { undefined: true } })).toMatch(/no leaf answers/)
  })

  it('composes in order, keeps each leaf\'s answer, and lists what lost its place', () => {
    const root: Rule = { id: 'r', host: { type: STONE }, on: 'act/use', hole: 'h', at: [], tree: { if: is(TREE), then: { do: [] }, else: { undefined: true } }, source: { origin: 'patch' } }
    const no = ['!' + JSON.stringify(is(TREE))]
    const second: Rule = { id: 's', host: { type: STONE }, on: 'act/use', hole: 'h', at: no, tree: { do: [{ op: 'log', text: 's' }] }, source: { origin: 'patch' } }
    const third: Rule = { id: 't', host: { type: STONE }, on: 'act/use', hole: 'h', at: no, tree: { do: [] }, source: { origin: 'patch' } }
    const c = compose([root, second, third])
    expect(c.stale).toEqual([{ id: 't', why: 'its leaf is already answered by "s"' }])
    expect(c.owner.get(locate(c.tree, no)!.leaf as object)).toBe('s')
    expect(c.owner.get(locate(c.tree, [JSON.stringify(is(TREE))])!.leaf as object)).toBe('r')
    // in a library: remove the root and the second has no place
    const lib = new RuleLibrary(BASE)
    lib.add(root)
    lib.add(second)
    expect(lib.stale()).toEqual([])
    lib.remove('r')
    expect(lib.stale()).toEqual([{ id: 's', why: 'placed below a leaf, but no answer holds the tree yet' }])
  })

  it('the shared library covers the same key, not a sibling type', () => {
    const library = new WorldLibrary(onto, BASE)
    const { req } = ask(TREE)
    // the dead tree's case answered, the rest left open: a beehive is not covered
    expect(library.commit(placePatch(rule('patch/stone-tree', { if: is(TREE), then: { do: [{ op: 'log', text: 'tree' }] }, else: { undefined: true } }), req).patch, req).ok).toBe(true)
    expect(library.covering(ask(TREE).req)?.rule).toBe('patch/stone-tree')
    expect(library.covering(ask(HIVE).req)).toBeUndefined()
    expect(library.asked).toHaveLength(1)
  })

  it('a leaf cannot be open and an answer at once; at run time such a leaf is open', () => {
    const { req, eng, port } = ask(TREE)
    const both = placePatch({ artifacts: [{ kind: 'rule', rule: { id: 'patch/both', host: { type: 'x' }, on: 'x', label: 'x', tree: { undefined: true, do: [{ op: 'nosuchop' } as never] } } }] }, req).patch
    expect(validatePatch(both, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()).toMatch(/never both/)
    // slipped in by hand: the engine reads it as open, so nothing it carries runs
    eng.lib.add({ ...(both.artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } })
    const res = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' }))
    expect(res.defined).toBe(false)
    expect(port.records).toHaveLength(1)
  })

  it('a question asked before the tree grew is still placed: where the event falls undefined now', () => {
    const first = ask(TREE)
    const stale = ask(HIVE) // asked while the stone's tree was empty: at []
    expect(stale.req.hole.at).toEqual([])
    const a = placePatch(rule('patch/a', { if: is(TREE), then: { do: [] }, else: { undefined: true } }), first.req).patch
    expect(first.port.submit(first.req.id, a).ok).toBe(true)
    // the library grew under the second question: its answer goes to the open leaf, not to the root
    const b = placePatch(rule('patch/b', { do: [{ op: 'log', text: 'b' }] }), stale.req, { ontology: onto, library: first.eng.lib })
    expect(b.fixes.join()).toMatch(/placed where the event falls undefined now/)
    expect((b.patch.artifacts[0] as { rule: Rule }).rule.at).toEqual(['!' + JSON.stringify(is(TREE))])
    const v = validatePatch(b.patch, { ontology: onto, library: first.eng.lib, scenario: stale.req.scenario })
    expect(v.errors).toEqual([])
  })

  it('a rule naming a hole that is not an open leaf of a base rule is refused', () => {
    const { req, eng } = ask(TREE)
    const r = (placePatch(rule('patch/x', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule
    const bad = (hole: string) => validatePatch({ artifacts: [{ kind: 'rule', rule: { ...r, hole } }] }, { ontology: onto, library: eng.lib }).errors.join()
    expect(bad('core/nothing-of-the-kind')).toMatch(/no base rule/)
    expect(bad('core/use')).toMatch(/not an open leaf/) // the root of act/use branches before its hole
    expect(bad('use/eat')).toMatch(/not an open leaf/)
  })

  it('a learned rule set aside at run time leaves the library, and its leaf takes a new answer', () => {
    const { req, eng, port } = ask(TREE)
    expect(port.submit(req.id, placePatch(rule('patch/a', { do: [{ op: 'log', text: 'a' }] }), req).patch).ok).toBe(true)
    expect(eng.fault('patch/a', 'it ran away', true)).toBe(true)
    expect(eng.lib.rules.has('patch/a')).toBe(false)
    expect(eng.world.state.quarantine?.['patch/a']).toBeDefined()
    const again = ask(TREE, eng.lib.clone())
    expect(again.res.defined).toBe(false)
    expect(again.port.submit(again.req.id, placePatch(rule('patch/b', { do: [] }), again.req).patch).ok).toBe(true)
  })

  it('a revision takes its predecessor\'s place, so what grew below it stays', () => {
    const lib = new RuleLibrary(BASE)
    const h = holeKey(ask(TREE).req.hole.rule, ask(TREE).req.hole.path)
    const no = ['!' + JSON.stringify(is(TREE))]
    const root = (id: string): Rule => ({ id, host: { type: STONE }, on: 'act/use', hole: h, at: [], tree: { if: is(TREE), then: { do: [] }, else: { undefined: true } }, source: { origin: 'patch' } })
    lib.add(root('r1'))
    lib.add({ id: 's', host: { type: STONE }, on: 'act/use', hole: h, at: no, tree: { do: [{ op: 'log', text: 's' }] }, source: { origin: 'patch' } })
    lib.remove('r1')
    expect(lib.stale().map((x) => x.id)).toEqual(['s'])
    lib.add(root('r2'), undefined, 'r1')
    expect(lib.stale()).toEqual([])
    expect(locate(lib.tree(patchKey(STONE, 'act/use', h))!, no)?.leaf).toEqual({ do: [{ op: 'log', text: 's' }] })
    // a save restored without the root drops what grew below it, and says so
    const dropped: string[] = []
    const back = restoreLibrary(BASE, { ...lib.toJSON(), rules: lib.toJSON().rules.filter((r) => r.id !== 'r2') }, onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(back.rules.has('s')).toBe(false)
    expect(dropped.join()).toMatch(/^s: /)
  })

  it('a boss offered a handful of grass is not lashed down', () => {
    const scene = (target: string): Scenario => ({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: 'item/material/grass', x: 2, y: 2, heldBy: 'actor' }, { key: 'it', type: target, x: 2, y: 1 }], event: {} })
    const king = buildSandbox(scene('actor/creature/slime/king_slime'), onto, new RuleLibrary(BASE))
    new ModPort(king)
    king.act('use', 'actor', { e: 'it' })
    expect(king.world.hasStatus({ e: 'it' }, 'frozen')).toBe(false)
    const green = buildSandbox(scene('actor/creature/slime/green_slime'), onto, new RuleLibrary(BASE))
    green.act('use', 'actor', { e: 'it' })
    expect(green.world.hasStatus({ e: 'it' }, 'frozen')).toBe(true)
  })
})
