// A recipe's parts and tools are things one carries (the engine crafts from the bag and the hand only): a fixture on
// the maps (a table, a chest) is had as a station at most, and the modder is told only the things one can carry.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Recipe, TypeDef } from '@openworld/engine'
import { checkThings, compile, makingStock, obtainable } from '../src/index.ts'
import { readProject } from '../src/node.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)
const plank = (part: string): TypeDef => ({ id: 'item/material/plank', name: { en: 'Plank', zh: '木板' }, tags: ['wooden', 'portable'], props: { material: 'wood' }, makeup: [{ type: part, count: 1 }], station: 'hands' })
const recipes = (...r: Recipe[]) => ({ crafting: { recipes: r } })

describe.skipIf(!here)('what a new thing is made of', () => {
  it('is never a fixture: a plank of a table cannot be had', () => {
    const c = compile(readProject(STARTER))
    for (const part of ['fixture/furniture/table', 'fixture/container/chest', 'fixture/sign']) {
      expect(obtainable(c, [plank(part)]).has('item/material/plank')).toBe(false)
      const obtain = checkThings(c, { artifacts: [{ kind: 'type', type: plank(part) }] })[0].checks.find((x) => x.id === 'obtainable')!
      expect(obtain.ok).toBe(false)
      expect(obtain.detail.join(' ')).toMatch(/cannot be carried/)
    }
    // what one carries still makes it
    expect(obtainable(c, [plank('item/material/log')]).get('item/material/plank')).toBe('made by hand from 1 item/material/log')
  })

  it("takes as a recipe's tool only a thing one carries", () => {
    const c = compile(readProject(STARTER))
    const ore: TypeDef = { id: 'item/material/iron_ore', name: { en: 'Iron Ore', zh: '铁矿' }, tags: ['ore'], props: {} }
    // a tool tag only the table has
    c.bundle.client = { ...c.bundle.client, ...recipes({ id: 'dig-ore', name: { en: 'Iron Ore', zh: '铁矿' }, sprite: 'item:ore', needs: [{ type: 'item/material/stone', count: 1 }], tools: ['surface'], make: { type: ore.id }, station: 'hands' } as Recipe) }
    expect(obtainable(c, [ore]).has(ore.id)).toBe(false)
  })

  it('counts a fixture one has as a station, and tells the modder only the things one carries', () => {
    const c = compile(readProject(STARTER))
    const bench: TypeDef = { id: 'fixture/furniture/workbench', name: { en: 'Workbench', zh: '工作台' }, tags: ['station:workbench'] }
    c.bundle.ontology.types[bench.id] = bench
    c.bundle.client = { ...c.bundle.client, ...recipes({ id: 'bench', name: { en: 'Workbench', zh: '工作台' }, sprite: 'fixture:table', needs: [{ type: 'item/material/log', count: 2 }], make: { type: bench.id }, station: 'hands' } as Recipe) }
    const atBench = { ...plank('item/material/log'), station: 'workbench' }
    expect(obtainable(c, [atBench]).get('item/material/plank')).toBe('made at a workbench from 1 item/material/log')
    const stock = makingStock(c)
    expect(stock.stations).toEqual(['workbench'])
    expect(stock.had).toEqual(expect.arrayContaining(['item/tool/axe', 'item/material/log']))
    expect(stock.had.filter((id) => id.startsWith('fixture/'))).toEqual([])
  })
})
