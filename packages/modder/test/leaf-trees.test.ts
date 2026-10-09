// Learned rules take one leaf (design.md §5.16): one tree per (type, kind, hole), grown by answers
// in order; a second answer fills an open leaf of the first; sibling types are not reached; an
// answer set aside at runtime opens its leaves again; the request says where the next answer goes.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, compose, holeKey, locate, patchKey, placePatch, validatePatch, type Cond, type Patch, type Rule, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
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
})
