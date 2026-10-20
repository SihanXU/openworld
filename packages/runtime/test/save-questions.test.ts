// A save made while a question is open keeps its holders held; loaded, nobody will answer it (the question is not
// saved), so its holders are let go and its hole's default runs, as after a time-out.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, decodeRawChunk, type Rule } from '@openworld/engine'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { settleOpenQuestions, withOpenQuestions } from '../src/saves.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)

/** The starter with a table whose handling is a hole, its default the table gone; the player's hands on one, the question open. */
function asking(ask = true) {
  const c = compile(readProject(STARTER))
  const hole = { id: 'test/table-handle', host: { type: 'fixture/furniture/table' }, on: 'impulse/handle', tree: { undefined: true, default: [{ op: 'destroy' }] } } as unknown as Rule
  const rules = [...c.bundle.rules, hole]
  const game = Game.create(c.index, structuredClone(c.bundle.ontology), new RuleLibrary(rules))
  for (const ch of c.chunks) game.loadChunk(decodeRawChunk(structuredClone(ch), c.bundle.terrainChars))
  const eng = game.engine
  const w = eng.world
  const at = w.posOf(w.player)!
  let table = ''
  eng.author(() => (table = w.create('fixture/furniture/table', { on: 'tile', map: at.map, x: at.x, y: at.y - 1 }).id))
  // a service that never answers
  game.mods.provider = { resolve: () => new Promise(() => undefined) }
  if (ask) eng.act('hands', w.player.id, { e: table })
  const load = (save: ReturnType<Game['save']>) => Game.load(structuredClone(save), c.index, structuredClone(c.bundle.ontology), new RuleLibrary(rules))
  return { game, table, load }
}

describe.skipIf(!here)('a save made while a question is open', () => {
  it("runs the hole's default once loaded, as a time-out would", () => {
    const { game, table, load } = asking()
    expect(game.engine.world.get(table)?.frozenBy).toBeDefined()
    const save = withOpenQuestions(game.save(), game.mods)
    const loaded = load(save)
    settleOpenQuestions(loaded.engine, save)
    expect(loaded.engine.world.get(table)).toBeUndefined()
    // as the time-out does in the game that goes on
    game.mods.fallback(game.mods.records[0].id)
    expect(game.engine.world.get(table)).toBeUndefined()
  })

  it('is as before when no question is open', () => {
    const { game, table, load } = asking(false)
    const save = withOpenQuestions(game.save(), game.mods)
    expect('open' in save).toBe(false)
    const loaded = load(save)
    settleOpenQuestions(loaded.engine, save)
    expect(loaded.engine.world.get(table)).toBeDefined()
  })
})
