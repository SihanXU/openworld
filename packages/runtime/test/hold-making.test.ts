// The modder making new things holds the player's own act past its time-out (the world stands still for it, the
// host bounds the wait). A question of the world's own is not held: its holders are let go at its time-out and its
// default runs, not when the request's fetch is given up minutes later.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, decodeRawChunk, type Rule } from '@openworld/engine'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { holdForMaking } from '../src/learned.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)

/** The starter with a table whose handling is a hole (its default: the table gone), asked of a service that never answers. */
function world() {
  const c = compile(readProject(STARTER))
  const hole = { id: 'test/table-handle', host: { type: 'fixture/furniture/table' }, on: 'impulse/handle', tree: { undefined: true, default: [{ op: 'destroy' }] } } as unknown as Rule
  const game = Game.create(c.index, structuredClone(c.bundle.ontology), new RuleLibrary([...c.bundle.rules, hole]))
  for (const ch of c.chunks) game.loadChunk(decodeRawChunk(structuredClone(ch), c.bundle.terrainChars))
  const eng = game.engine
  const w = eng.world
  const at = w.posOf(w.player)!
  let table = ''
  eng.author(() => (table = w.create('fixture/furniture/table', { on: 'tile', map: at.map, x: at.x, y: at.y - 1 }).id))
  game.mods.provider = { resolve: () => new Promise(() => undefined) }
  return { game, eng, w, table }
}

describe.skipIf(!here)('a question whose answer is making new things', () => {
  it("of the world's own keeps its time-out: its holders are let go and its default runs", () => {
    const { game, eng, w, table } = world()
    eng.queue({ kind: 'impulse/handle', host: { e: table }, roles: {}, origin: 'world' })
    eng.tick()
    const rec = game.mods.records.find((r) => r.status === 'pending')!
    expect(rec.origin).toBe('world')
    // the modder says it is making things
    holdForMaking(game.mods, rec.id)
    for (let i = 0; i <= game.mods.timeoutTicks; i++) eng.tick()
    expect(rec.status).toBe('fallback')
    expect(w.get(table)).toBeUndefined()
  })

  it("of the player's own act is held past its time-out", () => {
    const { game, eng, w, table } = world()
    eng.act('hands', w.player.id, { e: table })
    const rec = game.mods.asking!
    expect(holdForMaking(game.mods, rec.id)).toBe(true)
    expect(rec.deadline).toBe(Number.POSITIVE_INFINITY)
  })
})
