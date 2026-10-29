// The player's pace (engine movePlayer): a step every `speed` ticks walking, a tick more held to a slow walk, and half
// again as quick running (params.run), the fraction of a tick carried from step to step.
import { describe, expect, it } from 'vitest'
import { buildSandbox, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
/** How many tiles the player covers east in so many ticks, at a pace. */
function covered(ticks: number, walk = false, run = false): number {
  const eng = buildSandbox({
    terrain: Array.from({ length: 3 }, () => Array(80).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 1 }], event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  const p = eng.world.player
  const x0 = eng.world.posOf(p)!.x
  for (let i = 0; i < ticks; i++) {
    eng.movePlayer('right', walk, run)
    eng.tick()
  }
  return eng.world.posOf(p)!.x - x0
}

describe('the player\'s pace', () => {
  it('runs half again as far as it walks, and walks slow held to a walk', () => {
    const walked = covered(60)
    expect(walked).toBe(30)
    expect(covered(60, false, true)).toBe(45)
    expect(covered(60, true)).toBe(20)
  })
})
