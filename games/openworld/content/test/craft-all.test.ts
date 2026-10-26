import { describe, expect, it } from 'vitest'
import { buildSandbox, RuleLibrary, type Recipe } from '@openworld/engine'
import { BASE_RULES, buildOntology, RECIPE_BY_ID } from '../src/index.ts'

const onto = buildOntology()
function scene(type: string, count: number) {
  const eng = buildSandbox({
    terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'stall', type: 'fixture/furniture/stall/trade', x: 2, y: 1 },
      { key: 'axe', type: 'item/weapon/blade/axe', inside: 'actor', x: 2, y: 2 },
      ...Array.from({ length: count }, (_, i) => ({ key: `input${i}`, type, inside: 'actor', x: 2, y: 2 })),
    ], event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  eng.controls.sync()
  return eng
}

describe('making and selling all carried materials', () => {
  it('makes all 666 logs into 1332 planks, keeping the required axe', () => {
    const eng = scene('item/material/log', 666)
    expect(eng.controls.craftAll(RECIPE_BY_ID['item/material/plank'])).toBe(666)
    expect(eng.controls.count('item/material/log')).toBe(0)
    expect(eng.controls.count('item/material/plank')).toBe(1332)
    expect(eng.controls.count('item/weapon/blade/axe')).toBe(1)
  })

  it('sells all 1678 sunfish for exactly 10068 coins', () => {
    const eng = scene('item/food/fish/sunfish', 1678)
    expect(eng.controls.craftAll(RECIPE_BY_ID['shop/sell/food-fish-sunfish'])).toBe(1678)
    expect(eng.controls.count('item/food/fish/sunfish')).toBe(0)
    expect(eng.controls.count('item/misc/thornmark')).toBe(10068)
    const payouts = eng.world.fx.filter((fx) => fx.t === 'pickup')
    expect(payouts.reduce((n, fx) => n + (fx.count ?? 1), 0)).toBe(10068)
  })

  it('can stop between sales and resume without losing fish or money', () => {
    const eng = scene('item/food/fish/sunfish', 150)
    const recipe = RECIPE_BY_ID['shop/sell/food-fish-sunfish']
    const batch = eng.controls.craftSteps(recipe)
    expect(batch.next().value).toEqual({ done: 0, total: 150 })
    for (let done = 1; done <= 37; done++) expect(batch.next().value).toEqual({ done, total: 150 })
    batch.return()
    expect(eng.controls.count('item/food/fish/sunfish')).toBe(113)
    expect(eng.controls.count('item/misc/thornmark')).toBe(222)
    expect(eng.controls.craftAll(recipe)).toBe(113)
    expect(eng.controls.count('item/misc/thornmark')).toBe(900)
  })

  it('still honors an explicit batch limit', () => {
    const eng = scene('item/material/log', 150)
    expect(eng.controls.craftAll(RECIPE_BY_ID['item/material/plank'], 7)).toBe(7)
    expect(eng.controls.count('item/material/log')).toBe(143)
  })

  it('bounds a recipe that returns its ingredient to the initial stock', () => {
    const eng = scene('item/material/log', 3)
    const recipe: Recipe = { ...RECIPE_BY_ID['item/material/plank'], make: { type: 'item/material/log' }, count: 2 }
    expect(eng.controls.craftAll(recipe)).toBe(3)
    expect(eng.controls.count('item/material/log')).toBe(6)
    expect(eng.controls.craftAll({ ...recipe, needs: [] })).toBe(1)
  })

  it('does not count refused sales when the station is gone', () => {
    const eng = scene('item/food/fish/sunfish', 150)
    const batch = eng.controls.craftSteps(RECIPE_BY_ID['shop/sell/food-fish-sunfish'])
    batch.next()
    batch.next()
    eng.author(() => eng.world.destroy(eng.world.get('stall')!))
    expect(batch.next().done).toBe(true)
    expect(eng.controls.count('item/food/fish/sunfish')).toBe(149)
    expect(eng.controls.count('item/misc/thornmark')).toBe(6)
  })

  it('stops when a required tool is no longer carried', () => {
    const eng = scene('item/material/log', 150)
    const batch = eng.controls.craftSteps(RECIPE_BY_ID['item/material/plank'])
    batch.next()
    batch.next()
    eng.author(() => eng.world.destroy(eng.world.get('axe')!))
    expect(batch.next().done).toBe(true)
    expect(eng.controls.count('item/material/log')).toBe(149)
    expect(eng.controls.count('item/material/plank')).toBe(2)
  })
})
