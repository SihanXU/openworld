// The classes module's inputs on a second seat (docs/agent-players.md): the skill bar is pressed for the seat's own actor.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type MapData } from '@openworld/engine'
import { skillbar } from '@openworld/modules'
import { BASE_RULES, SKILLS, SKILL_BY_ID, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

function arena() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 30, height: 30, terrain: Array(900).fill('grass'), portals: [] }
  game.loadMapData(map)
  const eng = game.engine
  const w = eng.world
  for (const s of SKILLS) eng.skills.set(s.id, s)
  const mate = eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    eng.teleport(w.player, { map: 'arena', x: 5, y: 5 })
    return w.create('actor/person/player', { on: 'tile', map: 'arena', x: 15, y: 15 }, { props: { hp: 40, maxHp: 40 } })
  })
  return { eng, mate }
}

describe('a second seat casts from its own skill bar', () => {
  it('gale-step hastens the seat\'s actor and not the player', () => {
    const { eng, mate } = arena()
    const w = eng.world
    const def = SKILL_BY_ID['gale-step']
    eng.author(() => {
      if (def.profession) w.setProp(mate, 'profession', def.profession)
      w.addTag(mate, 'skill:gale-step')
      mate.skillbar = ['gale-step']
    })
    expect(skillbar(eng, mate)[0]).toBe('gale-step')
    expect(eng.sit(mate.id).input({ t: 'cast', slot: 0 })).toEqual({ ok: true })
    expect(mate.combat?.hasteUntil).toBeGreaterThan(w.state.tick)
    expect(w.player.combat?.hasteUntil).toBeUndefined()
  })
})
