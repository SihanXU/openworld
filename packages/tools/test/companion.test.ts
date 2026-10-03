import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Dir } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

// Pip keeps up (docs/prologue.md): however the player runs — straight or diagonally, changing
// direction every step — the bird glides one tile at a time and never falls far behind (so it
// never has to jump back to them).

describe('the companion', () => {
  it('keeps up with a diagonal run, a tile at a time', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const p = w.player
    // the slope's open middle row, from west to east and back, zig-zagging
    eng.teleport(p, { map: 'slope', x: 8, y: 12 })
    for (let i = 0; i < 10; i++) eng.tick()
    const pip = w.get('pip')!
    let prev = w.posOf(pip)!
    let worst = 0
    for (let i = 0; i < 300; i++) {
      const dir: Dir = i % 2 ? 'right' : i % 4 === 0 ? 'down' : 'up'
      eng.movePlayer(i < 150 ? dir : dir === 'right' ? 'left' : dir)
      eng.tick()
      const at = w.posOf(pip)!
      const me = w.posOf(p)!
      expect(at.map).toBe(me.map)
      expect(Math.max(Math.abs(at.x - prev.x), Math.abs(at.y - prev.y)), `tick ${i}: a jump`).toBeLessThanOrEqual(1)
      worst = Math.max(worst, Math.max(Math.abs(at.x - me.x), Math.abs(at.y - me.y)))
      prev = at
    }
    expect(worst).toBeLessThanOrEqual(4)
    // the leader stops: the bird drifts in to a tile beside them
    for (let i = 0; i < 60; i++) eng.tick()
    const at = w.posOf(pip)!
    const me = w.posOf(p)!
    expect(Math.max(Math.abs(at.x - me.x), Math.abs(at.y - me.y))).toBe(1)
  })
})

describe('waypoint statues', () => {
  it('look like nothing else: no other sprite in the catalogue draws the waypoint statue', async () => {
    const { CATALOG } = await import('../../client/src/assets/catalog.ts')
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    const art = CATALOG.fixtures['fixture:waypoint'].base
    const others = Object.entries(CATALOG.fixtures).filter(([k, f]) => k !== 'fixture:waypoint' && [f.base, f.open, f.lit, ...(f.variants ?? [])].some((d) => d && same(d, art)))
    expect(others.map(([k]) => k)).toEqual([])
    // and no map places a statue for show
    const { chunks } = buildFord()
    expect(chunks.flatMap((c) => c.entities).filter((e) => e.type === 'fixture/sacred/statue').map((e) => e.id)).toEqual([])
  })
})
