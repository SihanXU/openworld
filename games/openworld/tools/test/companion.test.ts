import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Dir } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
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
    // the foot's open ground below its high ground, from west to east and back, zig-zagging
    eng.author(() => eng.teleport(p, { map: 'foot', x: 8, y: 8 }))
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

  it('struck down, it cannot follow: its behaviour reports stuck, and the base answers (it lies where it fell); it comes to and follows again', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const p = w.player
    eng.author(() => eng.teleport(p, { map: 'foot', x: 8, y: 8 }))
    for (let i = 0; i < 20; i++) eng.tick()
    const pip = w.get('pip')!
    // the player strikes the bird it can point at (blows along the facing pass under a flyer)
    eng.author(() => w.setProp(p, 'atk', 50))
    const at = w.posOf(pip)!
    const me = w.posOf(p)!
    p.facing = at.x > me.x ? 'right' : at.x < me.x ? 'left' : at.y > me.y ? 'down' : 'up'
    eng.playerAttack({ e: pip.id })
    // essential: it goes down, it is not gone
    expect(w.hasStatus({ e: pip.id }, 'down')).toBe(true)
    // a companion that is down is the base's to answer (companion/stuck): nothing is asked of the AI
    eng.trace.length = 0
    eng.author(() => eng.teleport(p, { map: 'foot', x: 14, y: 8 }))
    for (let i = 0; i < 5; i++) eng.tick()
    const stuck = eng.trace.find((t) => t.ev.kind === 'stuck' && 'e' in t.ev.host && t.ev.host.e === pip.id)
    expect(stuck?.defined).toBe(true)
    expect(stuck?.rule).toBe('companion/stuck')
    expect(game.mods.records).toEqual([])
    expect(stuck?.ev.params).toMatchObject({ activity: 'follow' })
    expect(stuck?.ev.roles.target).toEqual({ e: p.id })
    // it stays where it fell, and says so once an hour, not every tick
    expect(eng.trace.filter((t) => t.ev.kind === 'stuck').length).toBe(1)
    expect(w.posOf(pip)).toEqual(at)
    // it comes to (the essential's timer) and flies after its leader again
    for (let i = 0; i < 320; i++) eng.tick()
    expect(w.hasStatus({ e: pip.id }, 'down')).toBe(false)
    const back = w.posOf(pip)!
    expect(Math.max(Math.abs(back.x - 14), Math.abs(back.y - 8))).toBeLessThanOrEqual(3)
  })
})

describe('waypoint statues', () => {
  it('look like nothing else: no other sprite in the catalogue draws the waypoint statue', async () => {
    const { CATALOG } = await import('../../client/src/catalog.ts')
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    const art = CATALOG.fixtures['fixture:waypoint'].base
    const others = Object.entries(CATALOG.fixtures).filter(([k, f]) => k !== 'fixture:waypoint' && [f.base, f.open, f.lit, ...(f.variants ?? [])].some((d) => d && same(d, art)))
    expect(others.map(([k]) => k)).toEqual([])
    // and no map places a statue for show
    const { chunks } = buildFord()
    expect(chunks.flatMap((c) => c.entities).filter((e) => e.type === 'fixture/sacred/statue').map((e) => e.id)).toEqual([])
  })
})
