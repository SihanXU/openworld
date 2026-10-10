// The far bank of the Ford is chapter one's hook only while the story is in chapter one.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { FAR_BANK, buildFord } from '../src/demo/world.ts'

/** Across the river with the main line where the test wants it: in chapter one after the letter, or at the finale. */
function acrossAt(at: 'letter' | 'finale') {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    for (const q of ['descent', 'rescue', 'vigil']) eng.quests.put(q, 'done')
    if (at === 'letter') eng.quests.put('first_seal', 30)
    else for (const q of ['first_seal', 'crown_home', 'dragon_road']) eng.quests.put(q, 'done')
    w.setFact('seen.arrival', 1)
    w.setFact('seen.far_bank_early', 1)
  })
  w.state.tick = tickAt(3, 12)
  let y = 12
  while (!w.walkable('ford', FAR_BANK + 4, y)) y++
  eng.author(() => eng.teleport(w.player, { map: 'ford', x: FAR_BANK + 4, y }))
  for (let i = 0; i < 20; i++) eng.tick()
  return { w, scene: w.scene?.id, hook: !!w.fact('seen.far_bank'), crossed: w.fact('ford.crossed'), done: eng.quests.isDone('dragon_road') }
}

describe('the far bank', () => {
  it('at the finale: no chapter-one hook, the river is only marked crossed', () => {
    const r = acrossAt('finale')
    expect(r.hook).toBe(false)
    expect(r.crossed).toBe(1)
    expect(r.done).toBe(true)
  })

  it('in chapter one, after the letter: the hook plays', () => {
    const r = acrossAt('letter')
    expect(r.hook).toBe(true)
  })
})
