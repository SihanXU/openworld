// Fixtures drawn by their map's theme (Catalog.fixtureThemes, assets/themes.ts): the first rule matching the map's id
// gives it; a theme of several is the one the map's id picks, the same every time; a fixture with no look for it, or
// a map no rule names, is drawn as it is.

import { describe, expect, it } from 'vitest'
import { mapTheme, themedFixture } from '../src/assets/themes.ts'
import type { Catalog, SpriteDef } from '../src/assets/types.ts'

const pic = (x: number): SpriteDef => ({ img: 'f.png', x, y: 0, w: 4, h: 4, ax: 2, ay: 4 })
const catalog = {
  fixtureThemes: {
    rules: [{ match: '^keep(\\.|$)', theme: 'own' }, { match: '\\.farmhouse$', theme: 'plain' }, { match: '^city\\.', theme: 'rich' }, { match: '^town\\.', theme: 'plain rich' }],
    looks: {
      'fixture:bed': { plain: { sprite: pic(1), scale: 0.25 }, rich: { sprite: pic(2), scale: 0.25 } },
      'fixture:fireplace': { plain: { sprite: pic(3), lit: pic(4) } },
      // two sets of a table and its chairs, the chair turned west in each
      'fixture:table': { plain: [{ sprite: pic(10) }, { sprite: pic(20) }] },
      'fixture:chair': { plain: [{ sprite: pic(11), left: pic(12) }, { sprite: pic(21), left: pic(22) }] },
    },
  },
} as unknown as Catalog

describe('fixture themes', () => {
  it('a map\'s theme is its first matching rule, a pick of several by its id', () => {
    expect([mapTheme(catalog, 'city.farmhouse'), mapTheme(catalog, 'city.home-1'), mapTheme(catalog, 'keep.hut'), mapTheme(catalog, 'wild')]).toEqual(['plain', 'rich', 'own', undefined])
    const towns = Array.from({ length: 40 }, (_, i) => mapTheme(catalog, `town.home-${i}`))
    expect(new Set(towns)).toEqual(new Set(['plain', 'rich']))
    expect(mapTheme(catalog, 'town.home-3')).toBe(towns[3])
  })

  it('a fixture is drawn with its theme\'s look, lit while lit; with none, as it is', () => {
    expect(themedFixture(catalog, 'fixture:bed', 'city.home-1', false)).toMatchObject({ def: { x: 2 }, scale: 0.25 })
    expect(themedFixture(catalog, 'fixture:fireplace', 'city.farmhouse', true)?.def.x).toBe(4)
    expect(themedFixture(catalog, 'fixture:fireplace', 'city.farmhouse', false)?.def.x).toBe(3)
    expect(themedFixture(catalog, 'fixture:fireplace', 'city.home-1', true)).toBeUndefined()
    expect(themedFixture(catalog, 'fixture:bed', 'keep.hut', false)).toBeUndefined()
    expect(themedFixture(catalog, 'fixture:chair', 'city.home-1', false)).toBeUndefined()
  })

  it('a set of a table and its chairs to a room, the same set for both; a chair facing west shows its picture turned west', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `v${i}.farmhouse`)
    const tables = ids.map((m) => themedFixture(catalog, 'fixture:table', m, false)!.def.x)
    expect(new Set(tables)).toEqual(new Set([10, 20]))
    for (const [i, m] of ids.entries()) {
      expect(themedFixture(catalog, 'fixture:chair', m, false, 'right')!.def.x).toBe(tables[i] + 1)
      expect(themedFixture(catalog, 'fixture:chair', m, false, 'left')!.def.x).toBe(tables[i] + 2)
    }
  })
})
