// A first meeting is a meeting, whatever was talked over: one who first spoke to the player about a quest
// does not greet them as a stranger after it.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

describe('first meetings', () => {
  it('a quest talked over first is the meeting: no first-meeting line after it', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const fennick = w.get('npc.fennick')!
    const at = w.posOf(fennick)!
    eng.author(() => {
      Object.assign(w.player.props!, { level: 5 })
      w.setFact('ch1.letter', 1)
      w.place(w.player, { on: 'tile', map: at.map, x: at.x, y: at.y + 1 })
    })
    w.state.tick = tickAt(2, 12)
    const said = () => w.drainFx().flatMap((f) => (f.t === 'say' || f.t === 'log' ? [JSON.stringify(f)] : []))
    const firstLine = fennick.npc!.person!.lines!.find((l) => l.key === 'greeting:first')!
    const first = typeof firstLine.text === 'string' ? firstLine.text : firstLine.text.en
    w.drainFx()
    eng.act('hands', w.player.id, { e: fennick.id }, { instrument: null })
    const offered = said().join('\n')
    expect(offered).not.toContain(first.slice(0, 30))
    // the quest is over and done with: the next word is not a stranger's greeting
    eng.author(() => eng.quests.put('templar', 'done'))
    eng.act('hands', w.player.id, { e: fennick.id }, { instrument: null })
    expect(said().join('\n')).not.toContain(first.slice(0, 30))
  })
})

describe('the journal keeps what is done', () => {
  it('a finished quest leaves the tab under way and stays in the done tab, by title', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    eng.author(() => eng.quests.put('templar', 'done'))
    const j = eng.quests.journal()
    expect(j.filter((q) => q.state === 'active').map((q) => q.quest)).not.toContain('templar')
    expect(j).toContainEqual(expect.objectContaining({ quest: 'templar', state: 'done', kind: 'side', title: expect.objectContaining({ zh: '老骑士' }) }))
  })
})
