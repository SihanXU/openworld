import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, buildScenario, holeKey, scenarioEvent, validatePatch, type GameEvent, type Rule } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function fresh() {
  return buildSandbox({
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'feather', type: 'item/material/feather', x: 2, y: 2, heldBy: 'actor' },
      { key: 'pot', type: 'fixture/container/pot', x: 2, y: 1 },
    ],
    event: {},
  }, onto, lib())
}

const use: GameEvent = { kind: 'act/use', host: { e: 'feather' }, roles: { actor: { e: 'actor' }, instrument: { e: 'feather' }, target: { e: 'pot' } }, params: {} }

describe('a request replays the state its rules read', () => {
  it('keeps the participants holding closure, including a non-role hand and nested contents', () => {
    const eng = fresh()
    eng.author(() => {
      eng.world.add({ id: 'bag', type: 'fixture/container/pot', place: { on: 'inside', holder: 'actor' } })
      for (let i = 0; i < 14; i++) eng.world.add({ id: `stone${i}`, type: 'item/material/stone', place: { on: 'inside', holder: 'bag' } })
    })
    const ev: GameEvent = { kind: 'impulse/offered', host: { e: 'actor' }, roles: { item: { e: 'pot' } }, params: {} }
    const sc = buildScenario(eng, ev)
    sc.entities.reverse()
    const sb = buildSandbox(sc, onto, lib())
    const actor = sb.world.get(scenarioEvent(sc, sb).host.e)!
    expect(sb.world.get(actor.held)?.type).toBe('item/material/feather')
    const bag = actor.contents?.map((id) => sb.world.get(id)!).find((e) => e.type === 'fixture/container/pot')!
    expect(bag.contents).toHaveLength(14)
    expect(bag.contents?.every((id) => sb.world.get(id)?.place.on === 'inside')).toBe(true)
  })

  it('resolves a rule reading the bag and story and world props just as it does live', () => {
    const eng = fresh()
    eng.author(() => {
      eng.world.add({ id: 'stone', type: 'item/material/stone', place: { on: 'inside', holder: 'actor' } })
      eng.world.setProp(eng.world.get('story')!, 'learned', true)
      eng.world.setProp(eng.world.get('world')!, 'ready', true)
    })
    // the feather's own answer at the hole the act falls into (design.md §5.16)
    const open = eng.resolveEvent(use)
    const rule: Rule = { id: 'patch/bag-and-residents', host: { type: 'item/material/feather' }, on: 'act/use', hole: holeKey(open.hole!.rule.id, open.hole!.path), at: open.open!.path, tree: {
      if: { all: [
        { count: { role: 'actor', in: 'contents', match: { type: 'item/material/stone' }, cmp: { gte: 1 } } },
        { prop: { role: 'story', key: 'learned', cmp: true } },
        { prop: { role: 'world', key: 'ready', cmp: true } },
      ] }, then: { do: [{ op: 'log', text: 'Recognized.' }] }, else: { undefined: true },
    } }
    const sc = buildScenario(eng, use)
    eng.lib.add({ ...rule, source: { origin: 'patch' } })
    expect(eng.resolveEvent(use).rule?.id).toBe(rule.id)
    const res = validatePatch({ artifacts: [{ kind: 'rule', rule }] }, { ontology: onto, library: lib(), scenario: sc })
    expect(res.errors).toEqual([])
  })

  it('keeps an elevated participant and its roof even among many ground neighbours', () => {
    const eng = fresh()
    eng.author(() => {
      eng.world.place(eng.world.get('pot')!, { on: 'tile', map: 'sandbox', x: 2, y: 1, z: 1 })
      eng.world.add({ id: 'roof', type: 'structure/floor', place: { on: 'tile', map: 'sandbox', x: 2, y: 1, z: 2 } })
      for (let i = 0; i < 14; i++) eng.world.add({ id: `neighbour${i}`, type: 'item/material/stone', place: { on: 'tile', map: 'sandbox', x: 0, y: 0 } })
    })
    const ev: GameEvent = { kind: 'impulse/coat', host: { e: 'pot' }, roles: use.roles, params: { substance: 'fibre' } }
    const sc = buildScenario(eng, ev)
    const sb = buildSandbox(sc, onto, lib())
    const p = sb.world.refPos(scenarioEvent(sc, sb).host)!
    expect(p.z).toBe(1)
    expect(sb.world.covered(p.map, p.x, p.y, p.z)).toBe(true)
    expect(sc.entities.some((e) => e.type === 'structure/floor')).toBe(true)
  })

  it('keeps the actual floor type and state under a tree', () => {
    const eng = fresh()
    eng.author(() => {
      eng.world.transform(eng.world.cellTop('sandbox', 1, 1)!, 'tile/water')
      eng.world.setStatus(eng.world.cellRef('sandbox', 1, 1), 'wet', -1)
      eng.world.add({ id: 'tree', type: 'tile/tree', place: { on: 'tile', map: 'sandbox', x: 1, y: 1 } })
    })
    const floor = eng.world.occupant('sandbox', 1, 1, 'floor')!
    const ev: GameEvent = { kind: 'impulse/handle', host: { e: floor.id }, roles: { actor: { e: 'actor' } }, params: {} }
    const sc = buildScenario(eng, ev)
    const sb = buildSandbox(sc, onto, lib())
    const host = scenarioEvent(sc, sb).host
    expect(sb.world.get(host.e)?.type).toBe('tile/water')
    expect(sb.world.hasStatus(host, 'wet')).toBe(true)
  })

  it('addresses a cell on its own storey', () => {
    const eng = fresh()
    const floor = eng.author(() => eng.world.create('tile/water', { on: 'tile', map: 'sandbox', x: 1, y: 1, z: 1 }))
    const ev: GameEvent = { kind: 'impulse/handle', host: { e: floor.id }, roles: { actor: { e: 'actor' } }, params: {} }
    const sc = buildScenario(eng, ev)
    const sb = buildSandbox(sc, onto, lib())
    const host = scenarioEvent(sc, sb).host
    expect(sb.world.get(host.e)?.type).toBe('tile/water')
    expect(sb.world.refPos(host)?.z).toBe(1)
  })
})
