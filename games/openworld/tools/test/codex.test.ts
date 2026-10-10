import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// The codex (engine codex.ts): every item kind, person and creature kind the world holds is an
// entry; what the player carries and who and what comes near is marked; the save keeps it.

function fresh() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return { index, game, w: game.engine.world }
}

describe('the codex', () => {
  it('lists every concrete item kind, every person, every creature kind with a place in the story', () => {
    const { index, game, w } = fresh()
    const v = game.codex.view(w, index)
    expect(v.items.length).toBeGreaterThan(100)
    expect(v.items.some((e) => e.id === 'item/food/berries')).toBe(true)
    expect(v.people.map((e) => e.id)).toEqual([...(index.companions ?? []), ...index.npcs].map((n) => n.id))
    expect(v.creatures.some((e) => e.id === 'actor/creature/sin/alberic')).toBe(true)
    expect(v.creatures.some((e) => e.id === 'actor/creature/sin/pride')).toBe(false)
    expect([...v.items, ...v.creatures].every((e) => !e.known)).toBe(true)
  })

  it('marks what is carried and who comes near, and the save keeps it', () => {
    const { index, game, w } = fresh()
    const p = w.player
    const pos = w.posOf(p)!
    game.engine.author(() => {
      w.create('item/food/berries', { on: 'inside', holder: p.id }, { id: 'cx.berries' })
      w.create('actor/creature/slime/green_slime', { on: 'tile', map: pos.map, x: pos.x + 2, y: pos.y + 2 }, { id: 'cx.slime' })
      w.create('actor/creature/beast/bat', { on: 'tile', map: pos.map, x: pos.x + 15, y: pos.y + 15 }, { id: 'cx.bat' })
    })
    game.codex.record(w)
    const v = game.codex.view(w, index)
    const known = (l: { id: string; known: boolean }[]) => l.filter((e) => e.known).map((e) => e.id)
    expect(known(v.items)).toEqual(['item/food/berries'])
    expect(known(v.creatures)).toEqual(['actor/creature/slime/green_slime'])
    expect(known(v.people)).toEqual(['pip'])
    const loaded = Game.load(structuredClone(game.save()), index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    expect(loaded.codex.toJSON()).toEqual(game.codex.toJSON())
  })
})
