// A terrain's look at a cell picked by other cells' terrains (Catalog.terrainObjectLooks, TerrainLook.when): a bridge
// drawn whole once its gap is laid, its torn ends and a stump in each cell of the gap before.

import { describe, expect, it } from 'vitest'
import { groundBeneath, lookCellsWithWhen, objectAt } from '../src/assets/ground.ts'
import type { Catalog, SpriteDef } from '../src/assets/types.ts'

const pic = (x: number): SpriteDef => ({ img: 'p.png', x, y: 0, w: 4, h: 4, ax: 2, ay: 4 })
const catalog = {
  terrainObjects: { tree: [pic(99)] },
  terrainObjectLooks: {
    m: {
      '0,0': [{ terrain: 'bridge', sprite: pic(1), when: { '1,0': 'bridge' } }, { terrain: 'bridge', sprite: pic(2) }],
      '1,0': [{ terrain: 'water', sprite: pic(3) }, { terrain: 'bridge', when: { '1,0': 'bridge' } }],
      '2,0': { terrain: 'tree', sprite: pic(4) },
    },
  },
} as unknown as Catalog

describe('terrain looks', () => {
  it('the first look whose terrain and `when` hold is drawn; one with no picture draws nothing; none holding, the terrain\'s own', () => {
    const row = (...t: string[]) => (x: number) => t[x] ?? 'grass'
    const at = (t: (x: number) => string, x: number) => objectAt(catalog, (x) => t(x), () => 'grass', x, 0, 'm')?.def.x
    const gap = row('bridge', 'water', 'tree')
    const laid = row('bridge', 'bridge', 'tree')
    expect([at(gap, 0), at(gap, 1), at(gap, 2)]).toEqual([2, 3, 4])
    expect([at(laid, 0), at(laid, 1)]).toEqual([1, undefined])
    // another map, or a terrain no look names: the terrain's own object
    expect(objectAt(catalog, () => 'tree', () => 'grass', 0, 0, 'other')?.def.x).toBe(99)
    expect(objectAt(catalog, () => 'tree', () => 'grass', 0, 0, 'm')?.def.x).toBe(99)
  })

  it('names the cells whose look reads other cells, to be drawn again when a terrain changes', () => {
    expect(lookCellsWithWhen(catalog, 'm')).toEqual([[0, 0], [1, 0]])
    expect(lookCellsWithWhen(catalog, 'other')).toEqual([])
  })

  it('a ground drawn as another while it is its terrain and `when` holds: a trunk felled across the river, the river under it', () => {
    const cat = { ...catalog, blobs: {}, plain: {}, groundLooks: { m: { '1,0': { terrain: 'bridge', as: 'water', when: { '0,0': 'stump' } } } } } as unknown as Catalog
    const ground = (t: string[]) => groundBeneath(cat, undefined, (x) => t[x] ?? 'grass', 'm')
    expect(ground(['stump', 'bridge'])(1, 0)).toBe('water')
    // (planks laid there with the tree standing are planks)
    expect(ground(['tree', 'bridge'])(1, 0)).toBe('bridge')
    expect(groundBeneath(cat, undefined, (x) => ['stump', 'bridge'][x] ?? 'grass', 'other')(1, 0)).toBe('bridge')
  })
})
