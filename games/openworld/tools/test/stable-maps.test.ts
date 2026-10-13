// The maps are the same whatever gear rolls (content items.ts makeItem, tools builder.ts itemOf): a piece laid on a map
// rolls its extras from a stream of its own (its id), never from the map's, so a change to the affix table moves no
// ground and no thing. Older saves keep their things and take the terrain fresh: a map that came out otherwise would
// put the old things on new ground.

import { describe, expect, it } from 'vitest'
import { AFFIX_TABLE, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

/** Each map's terrain and every thing on it (where it is), and apart, what each thing rolled. */
function build() {
  const maps: Record<string, { terrain: string[]; things: string[] }> = {}
  const rolled: Record<string, string> = {}
  for (const raw of buildFord().chunks) {
    const c = decodeChunk(raw)
    maps[c.map.id] = { terrain: c.map.terrain, things: c.entities.map((e) => `${e.id} ${e.type} ${JSON.stringify(e.place)}`) }
    for (const e of c.entities) {
      const subs = Object.entries(e.props ?? {}).filter(([k]) => k.startsWith('sub:'))
      if (subs.length) rolled[e.id] = JSON.stringify(subs)
    }
  }
  return { maps, rolled }
}

describe('the maps do not depend on the affix table', () => {
  it('another table (fewer extras, another pool, other weights) rolls other extras and leaves every map\'s ground and things where they were', () => {
    const before = build()
    const kept = structuredClone(AFFIX_TABLE)
    try {
      AFFIX_TABLE.count = 2
      AFFIX_TABLE.pool.push({ key: 'luck', min: 1, max: 5, step: 1, weight: 3 })
      for (const a of AFFIX_TABLE.pool) a.weight = (a.weight ?? 1) * 2 + 0.5
      const after = build()
      expect(Object.keys(after.maps)).toEqual(Object.keys(before.maps))
      for (const id of Object.keys(before.maps)) expect([id, after.maps[id]]).toEqual([id, before.maps[id]])
      // the table did change what was rolled (the test is not vacuous)
      expect(Object.keys(before.rolled).length).toBeGreaterThan(0)
      expect(after.rolled).not.toEqual(before.rolled)
    } finally {
      Object.assign(AFFIX_TABLE, kept)
    }
  })
})
