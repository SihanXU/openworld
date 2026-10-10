import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, cellId, type Engine, type Key } from '@openworld/engine'
import { BASE_RULES, FORMS, SKILLS, buildOntology } from '../src/index.ts'

const onto = buildOntology()

/** A meadow with the player at (3,3), facing up, holding a weapon if given. */
function fresh(held?: string): Engine {
  const eng = buildSandbox({
    terrain: Array.from({ length: 7 }, () => Array(7).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }, ...(held ? [{ key: 'held', type: held, x: 3, y: 3, heldBy: 'actor' }] : [])],
    event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  eng.world.player.facing = 'up'
  // a profession's weapon fights only for its own (engine/src/profession.ts): the player follows it
  const own: [string, string][] = [['item/weapon/ranged/bow', 'ranger'], ['item/weapon/magic/staff', 'mage'], ['item/weapon/blade/dagger', 'assassin'], ['item/weapon/blade/sword', 'warrior']]
  const profession = own.find(([t]) => held?.startsWith(t))?.[1]
  if (profession) (eng.world.player.props ??= {}).profession = profession
  eng.controls.sync()
  return eng
}

/** Supported floors above the meadow, with the player on them. */
function upstairs(eng: Engine): void {
  const w = eng.world
  eng.author(() => {
    for (const y of [0, 1, 2, 3]) {
      w.create('structure/wall', { on: 'tile', map: 'sandbox', x: 2, y })
      w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 3, y, z: 1 }, { id: `floor${y}` })
    }
    w.place(w.player, { on: 'tile', map: 'sandbox', x: 3, y: 3, z: 1 })
  })
  eng.seedRelations('sandbox')
}

const strikes = (eng: Engine) => eng.trace.filter((t) => t.ev.kind === 'impulse/strike').map((t) => t.ev.host.e)

describe('inputs on a storey', () => {
  it.each([
    ['hands', 'fixture/container/chest'],
    ['take', 'item/material/stick'],
    ['put', 'actor/person/farmer'],
  ] as [Key, string][])('%s chooses and acts on its own storey', (key, type) => {
    const eng = fresh(key === 'put' ? 'item/food/bread' : undefined)
    const w = eng.world
    upstairs(eng)
    eng.author(() => {
      for (const z of [0, 1]) w.create(type, { on: 'tile', map: 'sandbox', x: 3, y: 2, z }, { id: `target${z}` })
    })
    const plan = eng.controls.plan(key)!
    expect(plan).toMatchObject({ at: { z: 1 }, target: { e: 'target1' } })
    eng.controls.run(plan)
    if (key === 'hands') {
      expect(w.hasStatus({ e: 'target1' }, 'open')).toBe(true)
      expect(w.hasStatus({ e: 'target0' }, 'open')).toBe(false)
    } else if (key === 'take') {
      expect(w.get('target1')!.place).toMatchObject({ holder: 'actor' })
      expect(w.get('target0')!.place.on).toBe('tile')
    } else expect(w.get('held')!.place).toMatchObject({ holder: 'target1' })
  })

  it('pointer layers, the chooser and a distant aim retain the storey', () => {
    const eng = fresh()
    upstairs(eng)
    eng.author(() => {
      for (const z of [0, 1]) eng.world.create('item/material/stick', { on: 'tile', map: 'sandbox', x: 3, y: 2, z }, { id: `stick${z}` })
    })
    const aim = { x: 3, y: 2, stack: [{ e: 'floor2' }, { e: 'stick0' }, { e: 'stick1' }] }
    expect(eng.controls.layers({ map: 'sandbox', x: 3, y: 2, z: 1 }, aim.stack).map((r) => r.e)).toEqual(['stick1', 'floor2'])
    // the floor the stick lies on stays until the stick is taken (docs/building.md R5)
    expect(eng.controls.choices('take', aim).map((c) => c.plan!.target.e)).toEqual(['stick1'])
    expect(eng.controls.plan('take', aim)?.target.e).toBe('stick1')
    expect(eng.controls.aim({ x: 3, y: -10 })?.at).toMatchObject({ x: 3, y: 2, z: 1 })
  })

  it.each([undefined, 'item/weapon/ranged/bow'])('Space and aimed blows stay on the storey with %s', (held) => {
    for (const pointed of [false, true]) {
      const eng = fresh(held)
      const w = eng.world
      upstairs(eng)
      eng.author(() => {
        for (const z of [0, 1]) w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 2, z }, { id: `hen${z}`, props: { hp: 100, maxHp: 100 } })
      })
      if (pointed) eng.controls.run(eng.controls.plan('use', { x: 3, y: 2 })!)
      else eng.controls.strike()
      expect(strikes(eng)).toEqual(['hen1'])
      expect(w.num(w.get('hen0')!, 'hp')).toBe(100)
      expect(w.num(w.get('hen1')!, 'hp')).toBeLessThan(100)
    }
  })

  it('the ray ends on its own floor, and a sweep stays on its own storey', () => {
    const ray = fresh('item/weapon/ranged/bow')
    upstairs(ray)
    ray.controls.strike()
    expect(strikes(ray)).toEqual(['floor0'])
    const eng = fresh()
    upstairs(eng)
    eng.author(() => {
      eng.world.addTag(eng.world.player, 'skill:sweep')
      for (const z of [0, 1]) for (const x of [3, 4]) eng.world.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x, y: 2, z }, { id: `hen${x}.${z}`, props: { hp: 100, maxHp: 100 } })
    })
    eng.controls.strike()
    expect(strikes(eng)).toEqual(['hen3.1', 'hen4.1'])
  })

  it('reach rejects other storeys, including a carried target there', () => {
    const eng = fresh('item/weapon/ranged/bow')
    const w = eng.world
    upstairs(eng)
    eng.author(() => {
      w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 2 }, { id: 'hen' })
      w.create('item/material/stick', { on: 'inside', holder: 'hen' }, { id: 'stick' })
    })
    expect(w.front(w.player)).toEqual({ map: 'sandbox', x: 3, y: 2, z: 1 })
    for (const id of ['hen', 'stick']) {
      expect(w.distance(w.posOf(w.player)!, w.get(id)!)).toBeUndefined()
      for (const verb of ['hands', 'take', 'put', 'use'] as const) expect(eng.inReach(verb, w.player, { e: id }, { e: 'held' })).toBe(false)
    }
    eng.playerAttack({ e: 'hen' })
    expect(strikes(eng)).toEqual([])
  })

  it('the magnet takes only drops on its own storey', () => {
    const eng = fresh()
    const w = eng.world
    upstairs(eng)
    eng.author(() => {
      for (const z of [0, 1]) w.create('item/material/stick', { on: 'tile', map: 'sandbox', x: 3, y: 3, z }, { id: `loot${z}`, dropped: true })
    })
    eng.controls.magnetic = true
    eng.controls.magnet()
    expect(w.get('loot1')!.place).toMatchObject({ holder: 'actor' })
    expect(w.get('loot0')!.place).toMatchObject({ on: 'tile', z: 0 })
  })

  it('the menu drops onto the floor in front on its own storey', () => {
    const eng = fresh('item/material/stick')
    upstairs(eng)
    eng.controls.drop(eng.world.player.selected!, true)
    expect(eng.world.get('held')!.place).toMatchObject({ on: 'tile', x: 3, y: 2, z: 1 })
  })
})

describe('Big Pack', () => {
  it.each([30, 31, 40])('organizes %i stacks without losing capacity or items', (count) => {
    const eng = fresh()
    const w = eng.world
    eng.author(() => {
      w.addTag(w.player, 'skill:woodcutter')
      w.setProp(w.player, 'skillPoints', 1)
    })
    expect(eng.controls.learn(SKILLS.find((s) => s.id === 'big-pack')!)).toBe(true)
    eng.author(() => {
      for (const form of FORMS.slice(0, count)) w.create(form.id, { on: 'inside', holder: w.player.id })
    })
    eng.controls.sync()
    const carried = () => [...(w.player.contents ?? []), ...(w.player.held ? [w.player.held] : [])].sort()
    const before = carried()
    eng.controls.organize()
    expect(w.player.slots).toHaveLength(40)
    expect(w.player.slots!.filter(Boolean)).toHaveLength(count)
    expect(carried()).toEqual(before)
  })
})

describe('ranged blows', () => {
  it.each([1, 2])('a wall %i tiles ahead stops Space and a chosen shot', (distance) => {
    for (const pointed of [false, true]) {
      const eng = fresh('item/weapon/ranged/bow')
      const w = eng.world
      eng.author(() => {
        w.setTerrain('sandbox', 3, 3 - distance, 'wall')
        w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 0 }, { id: 'hen', props: { hp: 100, maxHp: 100 } })
      })
      if (pointed) eng.controls.run(eng.controls.plan('use', { x: 3, y: 0 })!)
      else eng.controls.strike()
      expect(w.num(w.get('hen')!, 'hp')).toBe(100)
      expect(strikes(eng)).not.toContain('hen')
      if (!pointed) expect(strikes(eng)).toEqual([w.cellRef('sandbox', 3, 3 - distance).e])
    }
  })

  it('an open ray still hits the body ahead', () => {
    const eng = fresh('item/weapon/ranged/bow')
    const hen = eng.author(() => eng.world.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 0 }, { id: 'hen', props: { hp: 100, maxHp: 100 } }))
    eng.controls.strike()
    expect(strikes(eng)).toEqual(['hen'])
    expect(eng.world.num(hen, 'hp')).toBeLessThan(100)
  })

  it.each(['item/weapon/ranged/bow', 'item/weapon/magic/wand', 'item/weapon/magic/staff'])('%s used on a bag item keeps the announced target', (held) => {
    const eng = fresh(held)
    const w = eng.world
    eng.author(() => {
      w.create('item/material/stick', { on: 'inside', holder: 'actor' }, { id: 'stick' })
      w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 2 }, { id: 'hen', props: { hp: 100, maxHp: 100 } })
    })
    const plan = eng.controls.planOnItem('use', 'stick')!
    expect(plan).toMatchObject({ attack: true, target: { e: 'stick' } })
    eng.controls.run(plan)
    expect(strikes(eng)).toEqual([plan.target.e])
    expect(w.num(w.get('hen')!, 'hp')).toBe(100)
  })

  it('a chosen target off the ray is refused without striking a bystander', () => {
    const eng = fresh('item/weapon/ranged/bow')
    eng.author(() => {
      for (const [id, x, y] of [['chosen', 4, 2], ['hen', 3, 2]] as const) eng.world.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x, y }, { id, props: { hp: 100, maxHp: 100 } })
    })
    eng.playerAttack({ e: 'chosen' })
    expect(strikes(eng)).toEqual([])
    expect(eng.world.num(eng.world.get('hen')!, 'hp')).toBe(100)
  })

  it('a closer body cannot replace the target announced by a plan', () => {
    const eng = fresh('item/weapon/ranged/bow')
    eng.author(() => {
      for (const [id, y] of [['chosen', 0], ['hen', 2]] as const) eng.world.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y }, { id, props: { hp: 100, maxHp: 100 } })
    })
    const plan = eng.controls.plan('use', { x: 3, y: 0 })!
    expect(plan.target.e).toBe('chosen')
    eng.controls.run(plan)
    expect(strikes(eng)).toEqual([])
    expect(eng.world.num(eng.world.get('hen')!, 'hp')).toBe(100)
  })
})

describe('a canopy over the tree in front', () => {
  it("the tree beside you is the one an axe meets, though a farther tree's canopy is drawn over it", () => {
    // a tree beside the player (2,3) and one behind it (1,4) whose crown is drawn over the first
    const eng = buildSandbox({
      terrain: Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => ((x === 2 && y === 3) || (x === 1 && y === 4) ? 'tree' : 'grass'))),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }, { key: 'held', type: 'item/weapon/blade/axe', x: 3, y: 3, heldBy: 'actor' }],
      event: {},
    }, onto, new RuleLibrary(BASE_RULES))
    eng.world.player.facing = 'left'
    eng.controls.sync()
    // what the view draws at the point, top first: the farther tree's crown, then the tree there
    const stack = [{ e: cellId('sandbox', 1, 4, 'volume') }, { e: cellId('sandbox', 2, 3, 'volume') }]
    const plan = eng.controls.plan('use', { x: 2, y: 3, stack })
    expect(plan?.at).toMatchObject({ x: 2, y: 3 })
    expect(eng.world.get(plan!.target.e)?.type).toBe('tile/tree')
    expect(eng.world.posOf(eng.world.get(plan!.target.e))).toMatchObject({ x: 2, y: 3 })
  })
})
