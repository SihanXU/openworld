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
