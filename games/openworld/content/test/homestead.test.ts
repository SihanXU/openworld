import { describe, expect, it, vi } from 'vitest'
import { RuleLibrary, buildSandbox, tickAt } from '@openworld/engine'
import { BASE_RULES, RECIPE_BY_ID, SHOP_RECIPES, buildOntology } from '../src/index.ts'

function pond(deep = false) {
  const eng = buildSandbox({
    terrain: [['grass', deep ? 'deepwater' : 'water', 'grass'], ['grass', 'grass', 'grass']],
    entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 1 }, { key: 'rod', type: 'item/tool/fishing_rod', x: 1, y: 1, heldBy: 'actor', props: { bait: 3 } }],
    event: {},
  }, buildOntology(), new RuleLibrary(BASE_RULES))
  eng.author(() => { eng.world.state.tick = tickAt(1, 12) })
  eng.controls.sync()
  return eng
}

describe('the homestead shelves', () => {
  it('offers a hoe, sickle and empty bucket on the farming shelf without duplicate recipe ids', () => {
    for (const type of ['item/tool/hoe', 'item/tool/sickle', 'item/vessel/bucket/empty']) {
      expect(SHOP_RECIPES.some((r) => r.group === 'farm' && r.make.type === type), type).toBe(true)
    }
    expect(new Set(SHOP_RECIPES.map((r) => r.id)).size).toBe(SHOP_RECIPES.length)
    expect(SHOP_RECIPES.some((r) => r.group === 'ranch' && r.make.type === 'item/vessel/bucket/empty')).toBe(true)
  })

  it('a first sowing fits the thirty-coin welcome budget', () => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 2 }, { key: 'stall', type: 'fixture/furniture/stall/trade', x: 1, y: 1 }], event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.author(() => { for (let i = 0; i < 30; i++) eng.world.create('item/misc/thornmark', { on: 'inside', holder: 'actor' }) })
    eng.controls.sync()
    expect(eng.controls.craft(RECIPE_BY_ID['shop/buy/seed-turnip'])).toBe(true)
    expect(eng.controls.craft(RECIPE_BY_ID['shop/buy/farm-bucket'])).toBe(true)
    expect(eng.controls.count('item/misc/thornmark')).toBe(16)
    expect(eng.controls.count('item/seed/turnip')).toBe(5)
  })
})

describe('fishing choices', () => {
  it('right-clicking open ground with the held rod opens bait choices without spending bait', () => {
    const eng = buildSandbox({
      terrain: [['grass', 'grass'], ['grass', 'grass']],
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
        { key: 'rod', type: 'item/tool/fishing_rod', x: 0, y: 0, heldBy: 'actor' },
        { key: 'bait', type: 'item/misc/bait', x: 0, y: 0, inside: 'actor' },
      ],
      event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.controls.sync()

    const plan = eng.controls.plan('action', { x: 0, y: 0 })
    expect(plan).toMatchObject({ key: 'self', verb: 'use', target: { e: 'actor' }, instrument: { e: 'rod' }, rule: 'home/rod-panel' })
    eng.controls.run(plan!)

    expect(eng.world.get('rod')?.place).toMatchObject({ on: 'hand', holder: 'actor' })
    expect(eng.world.num(eng.world.get('rod')!, 'bait')).toBe(0)
    expect(eng.controls.count('item/misc/bait')).toBe(1)
    expect(eng.world.fx).toContainEqual(expect.objectContaining({ t: 'panel', panel: 'bait', by: 'rod' }))
  })

  it('uses exactly one chosen carried bait through its host rule on the held rod', () => {
    const eng = buildSandbox({
      terrain: [['grass', 'grass'], ['grass', 'grass']],
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
        { key: 'bait-1', type: 'item/misc/bait', x: 0, y: 0, inside: 'actor' },
        { key: 'bait-2', type: 'item/misc/bait', x: 0, y: 0, inside: 'actor' },
        { key: 'rod', type: 'item/tool/fishing_rod', x: 0, y: 0, heldBy: 'actor', props: { bait: 2 } },
      ],
      event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.controls.sync()

    expect(eng.controls.useItemOnHeldItem('bait-1', 'rod')).toBe(true)
    expect(eng.controls.useItemOnHeldItem('bait-1', 'rod')).toBe(false)
    expect(eng.world.get('rod')?.place).toMatchObject({ on: 'hand', holder: 'actor' })
    expect(eng.world.num(eng.world.get('rod')!, 'bait')).toBe(7)
    expect(eng.controls.count('item/misc/bait')).toBe(1)
  })

  it('does not spend mismatched bait or apply a stale confirmation after changing rods', () => {
    const eng = buildSandbox({
      terrain: [['grass', 'grass'], ['grass', 'grass']],
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
        { key: 'plain-bait', type: 'item/misc/bait', x: 0, y: 0, inside: 'actor' },
        { key: 'masterwork-bait', type: 'item/misc/bait', x: 0, y: 0, inside: 'actor', tags: ['quality:masterwork'] },
        { key: 'old-rod', type: 'item/tool/fishing_rod', x: 0, y: 0, heldBy: 'actor', props: { bait: 2, baitKey: '["item/misc/bait",null,["quality:masterwork"],[]]' } },
        { key: 'new-rod', type: 'item/tool/fishing_rod', x: 0, y: 0, inside: 'actor' },
      ],
      event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.controls.sync()

    expect(eng.controls.useItemOnHeldItem('plain-bait', 'old-rod')).toBe(true)
    expect(eng.world.get('plain-bait')).toBeDefined()
    expect(eng.world.num(eng.world.get('old-rod')!, 'bait')).toBe(2)

    expect(eng.controls.useItemOnHeldItem('masterwork-bait', 'old-rod')).toBe(true)
    expect(eng.world.get('masterwork-bait')).toBeUndefined()
    expect(eng.world.num(eng.world.get('old-rod')!, 'bait')).toBe(7)

    eng.author(() => {
      eng.world.place(eng.world.get('old-rod')!, { on: 'inside', holder: 'actor' })
      eng.world.place(eng.world.get('new-rod')!, { on: 'hand', holder: 'actor' })
      eng.world.create('item/misc/bait', { on: 'inside', holder: 'actor' }, { id: 'stale-bait', tags: ['quality:masterwork'] })
    })
    eng.controls.sync()
    expect(eng.controls.useItemOnHeldItem('stale-bait', 'old-rod')).toBe(false)
    expect(eng.world.get('stale-bait')).toBeDefined()
    expect(eng.world.num(eng.world.get('old-rod')!, 'bait')).toBe(7)
  })

  it('uses one held bait on the fishing rod from the bag context action', () => {
    const eng = buildSandbox({
      terrain: [['grass', 'grass'], ['grass', 'grass']],
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
        { key: 'bait', type: 'item/misc/bait', x: 0, y: 0, heldBy: 'actor' },
        { key: 'rod', type: 'item/tool/fishing_rod', x: 0, y: 0, inside: 'actor' },
      ],
      event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.controls.sync()

    const plan = eng.controls.planOnItem('use', 'rod')!
    expect(plan).toMatchObject({ verb: 'use', target: { e: 'rod' }, instrument: { e: 'bait' } })
    eng.controls.run(plan)

    expect(eng.world.num(eng.world.get('rod')!, 'bait')).toBe(5)
    expect(eng.controls.count('item/misc/bait')).toBe(0)
  })

  it.each([
    ['dawnscale', 6, 'sun', false, 0.01],
    ['eel', 22, 'sun', false, 0.3],
    ['catfish', 12, 'rain', false, 0.3],
    ['pike', 12, 'sun', true, 0.3],
  ] as const)('keeps the %s condition with deterministic rolls', (fish, hour, weather, deep, roll) => {
    const eng = pond(deep)
    eng.world.weather = [{ day: 1, weather }]
    eng.author(() => { eng.world.state.tick = tickAt(1, hour) })
    vi.spyOn(eng.world, 'rand').mockReturnValue(roll)
    eng.controls.run(eng.controls.plan('use', { x: 1, y: 0 })!, true)
    expect(eng.controls.count(`item/food/fish/${fish}`)).toBe(1)
    expect(eng.world.get('rod')?.props?.bait).toBe(2)
  })

  it('the same roll finds a golden carp in deep water but ordinary fish in the shallows', () => {
    for (const deep of [false, true]) {
      const eng = pond(deep)
      vi.spyOn(eng.world, 'rand').mockReturnValue(0.08)
      const plan = eng.controls.plan('use', { x: 1, y: 0 })!
      eng.controls.run(plan, true)
      expect(eng.controls.count('item/food/fish/carp'), String(deep)).toBe(deep ? 1 : 0)
      expect(eng.world.get('rod')?.props?.bait).toBe(2)
    }
  })

  it('a stirred cell spends no bait until it settles naturally', () => {
    const eng = pond()
    vi.spyOn(eng.world, 'rand').mockReturnValue(0.08)
    const cast = () => eng.controls.run(eng.controls.plan('use', { x: 1, y: 0 })!, true)
    cast()
    cast()
    expect(eng.world.get('rod')?.props?.bait).toBe(2)
    for (let i = 0; i < 101; i++) eng.tick()
    cast()
    expect(eng.world.get('rod')?.props?.bait).toBe(1)
  })
})
