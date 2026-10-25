// The frame says when the player is in a fight (snapshot.ts `player.fighting`, for the music: docs/music.md): from
// the moment something comes at them or they strike someone (`combat.fightTick`) until FIGHT_TICKS have passed.

import { describe, expect, it } from 'vitest'
import { FIGHT_TICKS, RuleLibrary, buildSandbox, snapshot } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

function play() {
  return buildSandbox({ terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')), entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }], event: {} }, buildOntology(), new RuleLibrary(BASE_RULES))
}

describe('the fight flag', () => {
  it('is up from the last moment of a fight until FIGHT_TICKS have passed, and down before any', () => {
    const eng = play()
    const w = eng.world
    expect(snapshot(eng).player.fighting).toBeUndefined()
    eng.author(() => ((w.player.combat ??= {}).fightTick = w.state.tick))
    expect(snapshot(eng).player.fighting).toBe(true)
    for (let i = 0; i < FIGHT_TICKS - 1; i++) eng.tick()
    expect(snapshot(eng).player.fighting).toBe(true)
    eng.tick()
    expect(snapshot(eng).player.fighting).toBeUndefined()
  })
})
