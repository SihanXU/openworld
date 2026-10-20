// The AI interface's guards, on the engine and the standard library alone (no game): what a learned
// rule may write, how a library keeps its trees through a copy, a save and a rule set aside, and what
// the validator refuses (design.md §5.11, §5.16).

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, restoreLibrary, type Cond, type Ontology, type Rule, type Scenario } from '@openworld/engine'
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
