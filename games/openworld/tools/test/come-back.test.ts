// A minor monster placed on a map comes back to it in time, as many as were placed and no more,
// so what it alone drops can still be had once it has been put down.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, appear } from '@openworld/engine'
import { BASE_RULES, CREATURE_ROLES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { COME_BACK_EVERY } from '../src/demo/kit.ts'

const { index, chunks } = buildFord()
const maps = chunks.filter((c) => !c.map.backdrop)
const minor = (type: string) => CREATURE_ROLES[type] && CREATURE_ROLES[type] !== 'elite'

describe('placed minor monsters come back', () => {
  it('every minor kind placed on a map comes back to it, up to as many as were placed', () => {
    for (const { map, entities } of maps) {
      const placed = new Map<string, number>()
      for (const e of entities) if (minor(e.type) && e.place.on === 'tile') placed.set(e.type, (placed.get(e.type) ?? 0) + 1)
      for (const [type, n] of placed) {
        const back = (map.appear ?? []).filter((a) => a.types[type])
        expect(back.length, `${map.id}: ${type}`).toBeGreaterThan(0)
        if (back.every((a) => a.every === COME_BACK_EVERY)) expect(back[0].max, `${map.id}: ${type}`).toBe(n)
      }
    }
  })

  it('a frost wolf put down on the pass comes back, as it was, while the player is there', () => {
    const g = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) g.loadChunk(decodeChunk(c))
    const eng = g.engine
    const w = eng.world
    const wolf = 'actor/creature/beast/frost_wolf'
    const was = w.ofType(wolf).find((e) => w.posOf(e)?.map === 'pass')!
    const def = w.map('pass')!.appear!.find((a) => a.types[wolf])!
    const map = w.map('pass')!
    eng.author(() => {
      w.place(w.player, { on: 'tile', map: 'pass', x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) })
      for (const e of w.ofType(wolf)) if (w.posOf(e)?.map === 'pass') w.destroy(e)
    })
    for (let i = 0; i < 10; i++) eng.author(() => appear(eng, def))
    const back = w.ofType(wolf).filter((e) => w.posOf(e)?.map === 'pass')
    expect(back.length).toBe(def.max)
    for (const e of back) {
      expect(w.terrainAt('pass', w.posOf(e)!.x, w.posOf(e)!.y)).toBe('snow')
      expect({ ...e.ai, home: undefined, state: undefined }).toMatchObject({ ...was.ai, home: undefined, state: undefined })
    }
  })
})
