// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, textOf, type Dir } from '@openworld/engine'
import { BASE_RULES, PART_TWO, SITE_GATES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// Lumi keeps up (docs/prologue.md): however the player runs — straight or diagonally, changing
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
    // the leader stops: the bird settles two tiles off them (not right behind: turning to it would send it round)
    for (let i = 0; i < 60; i++) eng.tick()
    const at = w.posOf(pip)!
    const me = w.posOf(p)!
    expect(Math.max(Math.abs(at.x - me.x), Math.abs(at.y - me.y))).toBe(2)
    // turned to face it, it stays where it is, and is within reach of a word (its handsRange)
    p.facing = at.x > me.x ? 'right' : at.x < me.x ? 'left' : at.y > me.y ? 'down' : 'up'
    for (let i = 0; i < 60; i++) eng.tick()
    expect(w.posOf(pip)).toEqual(at)
    expect(w.num(pip, 'handsRange')).toBe(2)
    // and E there means her, not the grass she hovers over: the hands meet a companion first
    eng.controls.sync()
    const talk = eng.controls.plan('hands', { x: at.x, y: at.y })
    expect(talk?.target).toEqual({ e: pip.id })
    // but over a person within reach, E is for the person (she hovers by; one speaks to whom she hovers over)
    const someone = Object.values(w.state.entities).find((e) => e.type.startsWith('actor/person/') && e.id !== p.id && e.npc)!
    const near = { x: me.x + Math.sign(at.x - me.x), y: me.y + (at.x === me.x ? Math.sign(at.y - me.y) : 0) }
    eng.author(() => (w.place(someone, { on: 'tile', map: at.map, ...near }), w.place(pip, { on: 'tile', map: at.map, ...near })))
    eng.controls.sync()
    expect(eng.controls.plan('hands', near)?.target).toEqual({ e: someone.id })
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
    // the player strikes the bird it can point at (blows along the facing pass under a flyer), once it is beside them
    eng.author(() => w.setProp(p, 'atk', 50))
    const me = w.posOf(p)!
    eng.author(() => w.place(pip, { on: 'tile', map: me.map, x: me.x + 1, y: me.y }))
    const at = w.posOf(pip)!
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

  it("a way the story has not opened, run off: Lumi says so in its gate's words, once a minute, shorter the next time; alone, the message line says it", () => {
    const made = () => {
      const { index, chunks } = buildFord()
      const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
      for (const c of chunks) game.loadChunk(decodeChunk(c))
      return game.engine
    }
    const gate = SITE_GATES.find((g) => g.fact === PART_TWO)!
    // the Ford's road east, sealed until Part Two (docs/release-1.md): its way off the map's east edge
    const off = (eng: ReturnType<typeof made>) => {
      const w = eng.world
      const m = Object.values(w.state.maps).find((m) => m.portals.some((p) => p.opensWhen === PART_TWO))!
      const way = m.portals.find((p) => p.opensWhen === PART_TWO)!
      const dir: Dir = way.x === m.width - 1 ? 'right' : way.x === 0 ? 'left' : way.y === 0 ? 'up' : 'down'
      eng.author(() => eng.teleport(w.player, { map: m.id, x: way.x, y: way.y }))
      // (what the story plays on arriving there, played through)
      for (let i = 0; i < 400 && (i < 20 || w.scene); i++) (eng.tick(), w.scene?.waiting === 'advance' && eng.story.advance())
      return { m, dir }
    }
    const step = (eng: ReturnType<typeof made>, dir: Dir) => {
      eng.world.fx = []
      eng.setCooldown(eng.world.player.id, 0)
      eng.movePlayer(dir)
      for (let i = 0; i < 3; i++) eng.tick()
      return eng.world.fx
    }
    const lines = (fx: { t: string; who?: string; text?: unknown }[], t: string) => fx.filter((x) => x.t === t).map((x) => [x.who, (x.text as { zh: string } | undefined)?.zh])
    const eng = made()
    const w = eng.world
    const { m, dir } = off(eng)
    expect(w.get('pip')!.props!.companion).toBe(w.player.id)
    expect(lines(step(eng, dir), 'say')).toContainEqual(['pip', textOf(gate.remark, 'zh')])
    expect(w.posOf(w.player)!.map).toBe(m.id)
    // walked into on and on: nothing more for a minute
    expect(lines(step(eng, dir), 'say')).not.toContainEqual(['pip', textOf(gate.remark, 'zh')])
    expect(lines(step(eng, dir), 'say')).not.toContainEqual(['pip', textOf(gate.again, 'zh')])
    for (let i = 0; i < 600; i++) eng.tick()
    expect(lines(step(eng, dir), 'say')).toContainEqual(['pip', textOf(gate.again, 'zh')])
    // an edge that is only an edge (the way open): nothing is said, one goes on
    eng.author(() => w.setFact(PART_TWO, 1))
    for (let i = 0; i < 600; i++) eng.tick()
    expect(lines(step(eng, dir), 'say')).toEqual([])
    // with no companion at hand, the gate's own words in the message line — off any cell of the far bank's edge, whose
    // ways all lead to places not open yet, not only off the way itself
    const lone = made()
    const lw = lone.world
    const at = off(lone)
    lone.author(() => lw.place(lw.get('pip')!, { on: 'none' }))
    const way = at.m.portals.find((p) => p.opensWhen === PART_TWO)!
    const x = way.x
    const y = Array.from({ length: at.m.height }, (_, y) => y).find((y) => !at.m.portals.some((p) => p.x === x && p.y === y) && lw.partAt(at.m.id, x, y) === lw.partAt(at.m.id, x, way.y) && lw.walkable(at.m.id, x, y, lw.player.id))!
    expect(y).toBeDefined()
    lone.author(() => lw.place(lw.player, { on: 'tile', map: at.m.id, x, y }))
    const fx = step(lone, at.dir)
    expect(lw.posOf(lw.player)).toEqual({ map: at.m.id, x, y })
    expect(lines(fx, 'say')).toEqual([])
    expect(lines(fx, 'log')).toContainEqual([undefined, textOf(gate.say, 'zh')])
  })
})
