// M1: hands, surfaces and storage, played through the same entry point as the player's keys.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, validatePatch, type Engine, type Scenario, type ScenarioEntity } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

/** The player at (2,2) facing up, at whatever stands at (2,1). */
function play(front: Omit<ScenarioEntity, 'x' | 'y'>[], held?: string, terrain?: string): Engine {
  const rows = Array.from({ length: 5 }, () => Array(5).fill('grass'))
  if (terrain) rows[1][2] = terrain
  const sc: Scenario = {
    terrain: rows,
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...(held ? [{ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' }] : []),
      ...front.map((e) => ({ ...e, x: 2, y: 1 })),
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE_RULES))
  eng.world.get('actor')!.facing = 'up'
  return eng
}

const heldBy = (eng: Engine) => eng.world.get('actor')!.held

describe('surfaces', () => {
  it.each(['table', 'counter', 'stall', 'bench'].map((t) => `fixture/furniture/${t}`).concat('fixture/sacred/altar', 'fixture/craft/anvil'))(
    'puts an item on a %s and takes it back',
    (type) => {
      const eng = play([{ key: 'surface', type }], 'item/food/apple')
      expect(eng.playerVerb('put')?.rule?.id).toBe('core/put-on-surface')
      expect(heldBy(eng)).toBeUndefined()
      expect(eng.world.get('held')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
      expect(eng.playerVerb('take')?.rule?.id).toBe('core/take-item')
      expect(heldBy(eng)).toBe('held')
    },
  )

  it('takes the top item first, then the table refuses', () => {
    const eng = play([{ key: 'table', type: 'fixture/furniture/table' }, { key: 'cup', type: 'item/vessel/cup' }], 'item/food/apple')
    eng.playerVerb('put')
    eng.playerVerb('take')
    expect(heldBy(eng)).toBe('held')
    eng.hold('actor') // stow the apple
    eng.playerVerb('take')
    expect(heldBy(eng)).toBe('cup')
    eng.hold('actor')
    expect(eng.playerVerb('take')?.rule?.id).toBe('core/take-fixed')
  })
})

describe('containers', () => {
  const chestOf = (n: number, statuses = ['open']) => [
    { key: 'chest', type: 'fixture/container/chest', statuses },
    ...Array.from({ length: n }, (_, i) => ({ key: `i${i}`, type: 'item/material/stone', inside: 'chest' })),
  ]

  it('takes any chosen item from a chest of twelve', () => {
    for (let pick = 0; pick < 12; pick++) {
      const eng = play(chestOf(12))
      eng.playerVerb('take', false, `i${pick}`)
      expect(heldBy(eng)).toBe(`i${pick}`)
      expect(eng.world.get('chest')!.contents).toHaveLength(11)
    }
  })

  it('shows what the faced open container holds, and nothing when it is closed', () => {
    const open = play(chestOf(3))
    const box = open.facingContainer()
    expect(box?.id).toBe('chest')
    expect(open.world.get('chest')!.contents).toHaveLength(3)
    expect(play(chestOf(3, [])).facingContainer()).toBeUndefined()
  })

  it('refuses when full, and the item stays in hand', () => {
    const eng = play(chestOf(12), 'item/food/apple')
    expect(eng.playerVerb('put')?.rule?.id).toBe('core/store-full')
    expect(heldBy(eng)).toBe('held')
    const pot = play([{ key: 'pot', type: 'fixture/container/pot', statuses: ['open'] }], 'item/food/apple')
    expect(pot.playerVerb('put')?.rule?.id).toBe('core/store')
  })

  it('locks a closed chest with a key, and the key opens it again', () => {
    const eng = play([{ key: 'chest', type: 'fixture/container/chest' }], 'item/key')
    expect(eng.playerVerb('interact')?.rule?.id).toBe('core/lock')
    expect(eng.world.view({ e: 'chest' })!.tags.has('locked')).toBe(true)
    expect(eng.playerVerb('interact')?.rule?.id).toBe('core/unlock')
    expect(eng.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
  })
})

describe('the ground', () => {
  it('water refuses what is put in it, but still fills an empty vessel', () => {
    const eng = play([], 'item/food/apple', 'water')
    expect(eng.playerVerb('put')?.rule?.id).toBe('core/put-in-water')
    expect(heldBy(eng)).toBe('held')
    expect(play([], 'item/vessel/bucket/empty', 'water').playerVerb('put')?.rule?.id).toBe('core/fill-water')
  })

  it('lava burns up what is flammable and refuses the rest', () => {
    const torch = play([], 'item/light/torch', 'lava')
    expect(torch.playerVerb('put')?.rule?.id).toBe('core/put-in-lava')
    expect(torch.world.get('held')).toBeUndefined()
    const stone = play([], 'item/material/stone', 'lava')
    expect(stone.playerVerb('put')?.rule?.id).toBe('core/put-blocked')
    expect(heldBy(stone)).toBe('held')
  })

  it('a wall has no room', () => {
    const eng = play([], 'item/material/stone', 'wall')
    expect(eng.playerVerb('put')?.rule?.id).toBe('core/put-blocked')
    expect(heldBy(eng)).toBe('held')
  })
})

describe('the count condition', () => {
  const rule = (cmp: object) => ({
    id: 'test/count',
    on: 'interaction' as const,
    when: { verb: ['interact' as const], target: { kind: 'fixture' as const, tags: ['surface'] } },
    guard: { count: { role: 'target' as const, in: 'tile' as const, cmp } },
    do: [{ op: 'log' as const, text: 'crowded' }],
  })

  it('counts what lies on a role\'s tile, besides the role itself', () => {
    const lib = new RuleLibrary([...BASE_RULES, rule({ gte: 2 })])
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 },
        { key: 'a', type: 'item/food/apple', x: 2, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, lib)
    const ev = { kind: 'interaction' as const, verb: 'interact' as const, roles: { actor: { e: 'actor' }, target: { e: 'table' } } }
    expect(eng.resolve(ev).rule?.id).not.toBe('test/count')
    eng.world.create('item/food/apple', { on: 'tile', map: 'sandbox', x: 2, y: 1 })
    expect(eng.resolve(ev).rule?.id).toBe('test/count')
  })

  it('is validated like any other condition', () => {
    const lib = new RuleLibrary(BASE_RULES)
    const ok = validatePatch({ artifacts: [{ kind: 'rule', rule: rule({ gte: { prop: 'capacity', of: 'target' } }) }] }, { ontology: onto, library: lib })
    expect(ok.errors).toEqual([])
    const bad = validatePatch({ artifacts: [{ kind: 'rule', rule: rule({ most: 3 }) }] }, { ontology: onto, library: lib })
    expect(bad.errors.some((e) => e.includes('count.cmp.most'))).toBe(true)
  })
})
