// The map's tools as the author meets them (mapTools.ts): a strip of tools a layer, each with its own choices; keys
// that choose a tool; the ground's palette by kind; and the header's modes in their groups (nav.ts).

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { LAYERS, groupOf, terrainGroup, terrainPalette, toolForKey } from '../src/app/mapTools.ts'
import { navGroups } from '../src/app/nav.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe('the map\'s tools', () => {
  it('a brush paints in four shapes, apart from what lays a whole piece', () => {
    const ground = LAYERS.find((l) => l.id === 'ground')!
    expect(ground.groups.map((g) => g.id)).toEqual(['select', 'brush', 'eyedrop', 'stamp'])
    expect(groupOf('ground', 'ellipse').tools.map((x) => x.id)).toEqual(['pencil', 'rect', 'ellipse', 'fill'])
    expect(groupOf('ground', 'building').tools.map((x) => x.id)).toEqual(['building', 'room', 'path', 'organic'])
    expect(groupOf('things', 'yard').tools.map((x) => x.id)).toEqual(['quick', 'scatter', 'yard'])
    // every tool is in one group of its layer, once
    for (const l of LAYERS) {
      const ids = l.groups.flatMap((g) => g.tools.map((x) => x.id))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('a group\'s key gives back the tool last used in it; a shape\'s own key chooses it', () => {
    expect(toolForKey('ground', 'b')).toBe('pencil')
    expect(toolForKey('ground', 'B', { 'ground:brush': 'ellipse' })).toBe('ellipse')
    expect(toolForKey('ground', 'r')).toBe('rect')
    expect(toolForKey('ground', 'i')).toBe('eyedrop')
    expect(toolForKey('marks', 't')).toBe('portal')
    expect(toolForKey('ground', 'z')).toBeUndefined()
    // no two groups of a layer share a key, nor a group's key a tool's of another group
    for (const l of LAYERS) {
      const keys = l.groups.map((g) => g.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const g of l.groups) for (const x of g.tools) if (x.key && keys.includes(x.key)) expect(l.groups.find((y) => y.key === x.key)).toBe(g)
    }
  })
})

describe('the ground\'s palette', () => {
  it('groups a terrain by what it is', () => {
    expect(terrainGroup({ id: 'grass', tags: ['ground', 'plant'] })).toBe('ground')
    expect(terrainGroup({ id: 'water', tags: ['water'], liquid: true, solid: true })).toBe('water')
    expect(terrainGroup({ id: 'tree', tags: ['tree', 'solid'], space: 'volume' })).toBe('nature')
    expect(terrainGroup({ id: 'woodwall', tags: ['wooden', 'wall', 'solid'], space: 'volume' })).toBe('building')
    expect(terrainGroup({ id: 'door', tags: ['door', 'wooden'] })).toBe('building')
    expect(terrainGroup({ id: 'ow_sea', tags: ['water', 'overworld'], liquid: true })).toBe('overworld')
  })

  it('shows the world map\'s own only on an overworld map, or where a map already holds them', () => {
    const terrains = { grass: { id: 'grass', tags: ['ground'] }, water: { id: 'water', liquid: true }, ow_plain: { id: 'ow_plain', tags: ['ground', 'overworld'] } }
    const chars: [string, string][] = [['.', 'grass'], ['~', 'water'], ['p', 'ow_plain']]
    expect(terrainPalette(chars, terrains, { kind: 'village', rows: ['..~'] }).map((g) => g.group)).toEqual(['ground', 'water'])
    expect(terrainPalette(chars, terrains, { kind: 'village', rows: ['.p'] }).map((g) => g.group)).toEqual(['overworld', 'ground', 'water'])
    expect(terrainPalette(chars, terrains, { kind: 'overworld', rows: ['pp'] }).map((g) => g.group)).toEqual(['overworld', 'water'])
  })

  it('the starter\'s ground falls into its groups, every terrain once', () => {
    const c = compile(readProject(STARTER))
    const chars = Object.entries(c.bundle.terrainChars)
    const groups = terrainPalette(chars, c.bundle.ontology.terrains, { kind: 'village', rows: [] })
    expect(Object.fromEntries(groups.map((g) => [g.group, g.chars.map(([, id]) => id)]))).toMatchObject({ water: ['water'], nature: expect.arrayContaining(['tree']), building: expect.arrayContaining(['wall', 'door']) })
    expect(groups.flatMap((g) => g.chars).length).toBe(chars.length)
  })
})

describe('the header', () => {
  it('shows the modes in the groups an author works in, the rest under More', () => {
    const ids = ['map', 'people', 'game', 'database', 'assets', 'rules', 'story', 'quests', 'locales', 'find', 'holes']
    expect(navGroups(ids)).toEqual({ groups: [['map', 'people'], ['database', 'assets', 'rules'], ['story', 'quests'], ['holes']], more: ['game', 'locales', 'find'] })
  })
})
