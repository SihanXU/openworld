// Saves taken mid-play: whatever the world was waiting on when the game was saved, a loaded game
// plays on.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

describe('a save taken while the modder works', () => {
  it('lets the held go on load: the request is not saved, so nobody would ever answer it', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, onto, lib())
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // a modder still at work: the participants are held until it answers
    game.mods.provider = { resolve: () => new Promise(() => {}) }
    const p = w.player
    const rope = eng.author(() => w.create('item/tool/rope', { on: 'hand', holder: p.id }))
    const at = w.posOf(p)!
    for (const e of w.entitiesOnMap(at.map)) {
      if (e.id === p.id || e.place.on !== 'tile') continue
      eng.act('use', p.id, { e: e.id }, { instrument: { e: rope.id } })
      if (p.frozenBy) break
    }
    expect(eng.busy(p)).toBe(true)

    const loaded = Game.load(structuredClone(game.save()), index, onto, lib())
    for (const c of chunks) loaded.loadChunk(decodeChunk(c))
    const p2 = loaded.engine.world.player
    expect(Object.values(loaded.engine.world.state.entities).filter((e) => e.frozenBy)).toEqual([])
    expect(loaded.engine.busy(p2)).toBe(false)
  })
})
