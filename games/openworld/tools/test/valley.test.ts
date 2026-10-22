import { describe, expect, it } from 'vitest'
import { TERRAIN_CHARS, VALLEY, WILD_H, WILD_W, buildOntology, wildChunk } from '@openworld-game/content'
import { inPocket, readContinentRows } from './valley-helper.ts'

// The valley's wild cells (docs/release-1.md §2, content valley.ts): every wild cell left walkable on the west bank is
// a place with a name and a scene of its own, its scene on its map, what stands there of kinds the game has.

const onto = buildOntology()

describe('the valley (release 1)', () => {
  it('every walkable wild cell of the west bank is one of the valley\'s places, and every place is such a cell', () => {
    const rows = readContinentRows()
    const handmade = new Set(['5,4', '6,4', '7,4', '7,3', '5,5', '6,5', '7,5', '6,6', '5,7', '6,7', '7,7', '6,8', '6,9'])
    const wild: string[] = []
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const g = TERRAIN_CHARS[rows[y][x]]
        if (inPocket(x, y) && !handmade.has(`${x},${y}`) && !['ow_sea', 'ow_mountain', 'ow_river'].includes(g)) wild.push(`${x},${y}`)
      }
    expect(wild.sort()).toEqual(Object.keys(VALLEY).sort())
  })

  it('each place\'s scene lies on its map, drawn in the map format\'s characters or its own things, of kinds the game has', () => {
    for (const [cell, place] of Object.entries(VALLEY)) {
      const [cx, cy] = cell.split(',').map(Number)
      for (const row of place.scene) for (const c of row) expect([cell, c, c === ' ' || !!TERRAIN_CHARS[c] || !!place.things[c]]).toEqual([cell, c, true])
      expect(place.at[0] >= 0 && place.at[1] >= 0 && place.at[1] + place.scene.length <= WILD_H && Math.max(...place.scene.map((r) => r.length)) + place.at[0] <= WILD_W).toBe(true)
      for (const t of Object.values(place.things)) expect([cell, t.type, !!onto.types[t.type]]).toEqual([cell, t.type, true])
      // made, the map is the place: its name, every thing of the scene on it once
      const chunk = wildChunk(1517, cx, cy, 'ow_plain', { map: 'overworld', x: cx, y: cy, size: 1 }, 'frostfang')
      expect(chunk.map.name).toEqual(place.name)
      const things = place.scene.join('').split('').filter((c) => place.things[c]).length
      expect(chunk.entities.filter((e) => e.id.startsWith(`${chunk.map.id}~v`) && e.place.on === 'tile')).toHaveLength(things)
    }
  })
})
