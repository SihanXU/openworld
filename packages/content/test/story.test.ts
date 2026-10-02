import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, compareSpec, patternsOverlap, specOf } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

describe('the first week in Hearthvale', () => {
  it('the first sleep begins the week', () => {
    const eng = buildSandbox(
      { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { quest: 0 } }, { key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 1 }], event: {} },
      onto,
      lib(),
    )
    eng.interact('interact', 'actor', { e: 'bed' })
    expect(eng.world.num(eng.world.get('actor')!, 'quest')).toBe(1)
  })

  it('Hollis asks about the slimes only from the third day', () => {
    const eng = buildSandbox(
      { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { quest: 1, slimes: 0 } }, { key: 'npc.hollis', type: 'actor/person/farmer', x: 2, y: 1 }], event: {} },
      onto,
      lib(),
    )
    expect(eng.interact('interact', 'actor', { e: 'npc.hollis' }).rule?.id).toBe('core/talk')
    eng.world.state.tick += 2 * 7 * 60 * 24
    expect(eng.interact('interact', 'actor', { e: 'npc.hollis' }).rule?.id).toBe('story/hollis-slimes')
    expect(eng.world.num(eng.world.get('actor')!, 'quest')).toBe(2)
  })

  it('the third slime defeated quiets the field and raises the topic', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { quest: 2, slimes: 0, atk: 50 } },
          { key: 's1', type: 'actor/creature/slime/green_slime', x: 1, y: 2 },
          { key: 's2', type: 'actor/creature/slime/green_slime', x: 2, y: 2 },
          { key: 's3', type: 'actor/creature/slime/green_slime', x: 3, y: 2 },
        ],
        event: {},
      },
      onto,
      lib(),
    )
    for (const k of ['s1', 's2', 's3']) eng.queue({ kind: 'hit', roles: { actor: { e: 'actor' }, target: { e: k } }, power: 50 })
    const p = eng.world.get('actor')!
    expect(eng.world.num(p, 'slimes')).toBe(3)
    expect(eng.world.num(p, 'quest')).toBe(3)
    expect(eng.world.fact('slimes.driven')).toBe(1)
    expect(eng.world.state.topics?.some((t) => t.id === 'slimes_driven')).toBe(true)
  })

  it('a fish for Tamsin: Fenn lends a rod, the fish goes in the pot', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { quest: 4 } },
          { key: 'npc.fenn', type: 'actor/person/fisher', x: 2, y: 1 },
          { key: 'npc.tamsin', type: 'actor/person/villager', x: 3, y: 2 },
        ],
        event: {},
      },
      onto,
      lib(),
    )
    eng.interact('interact', 'actor', { e: 'npc.fenn' })
    const w = eng.world
    expect(w.num(w.get('actor')!, 'quest')).toBe(5)
    expect(Object.values(w.state.entities).some((e) => e.type === 'item/tool/fishing_rod' && e.place.on === 'inside' && e.place.holder === 'actor')).toBe(true)
    eng.hold('actor')
    w.create('item/food/fish/raw', { on: 'hand', holder: 'actor' })
    const r = eng.interact('put', 'actor', { e: 'npc.tamsin' })
    expect(r.rule?.id).toBe('story/tamsin-fish-given-5-raw')
    expect(w.num(w.get('actor')!, 'quest')).toBe(6)
  })

  it('the cold Hearth will not take ordinary fire', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'hearth', type: 'fixture/light/hearth', x: 2, y: 1 },
        ],
        event: {},
      },
      onto,
      lib(),
    )
    const t = eng.world.create('item/light/torch', { on: 'hand', holder: 'actor' })
    eng.world.setStatus({ e: t.id }, 'lit', -1)
    expect(eng.interact('interact', 'actor', { e: 'hearth' }).rule?.id).toBe('village/hearth-cold')
  })

  it('story rules never tie with base rules', () => {
    const all = [...BASE_RULES, ...STORY_RULES]
    const ties: string[] = []
    for (const a of STORY_RULES)
      for (const b of all) {
        if (a === b || a.on !== b.on || a.compose || b.compose) continue
        if (compareSpec(specOf(a), specOf(b)) === 0 && patternsOverlap(a, b, onto)) ties.push(`${a.id} ~ ${b.id}`)
      }
    expect(ties).toEqual([])
  })
})
