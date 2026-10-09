// The far bank of the Ford is chapter one's hook only while the story is in chapter one.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt } from '@lsw/engine'
import { BASE_RULES, PROLOGUE_DONE, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { FAR_BANK, buildFord } from '../src/demo/world.ts'

function acrossAt(quest: number) {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    Object.assign(w.player.props!, { prologue: PROLOGUE_DONE, quest })
    w.setFact('seen.arrival', 1)
    w.setFact('seen.far_bank_early', 1)
  })
  w.state.tick = tickAt(3, 12)
  let y = 12
  while (!w.walkable('ford', FAR_BANK + 4, y)) y++
  eng.author(() => eng.teleport(w.player, { map: 'ford', x: FAR_BANK + 4, y }))
  for (let i = 0; i < 20; i++) eng.tick()
  return { w, scene: w.scene?.id, hook: !!w.fact('seen.far_bank'), crossed: w.fact('ford.crossed'), quest: w.num(w.player, 'quest') }
}

describe('the far bank', () => {
  it('at the finale: no chapter-one hook, the river is only marked crossed', () => {
    const r = acrossAt(7)
    expect(r.hook).toBe(false)
    expect(r.crossed).toBe(1)
    expect(r.quest).toBe(7)
  })

  it('in chapter one, after the letter: the hook plays', () => {
    const r = acrossAt(1)
    expect(r.hook).toBe(true)
  })
})
