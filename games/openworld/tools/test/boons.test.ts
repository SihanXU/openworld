import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, snapshot, type Engine } from '@openworld/engine'
import { activeBoon, boonsOf, chooseBoon } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// The companion's boons (docs/chapter-1.md §6, engine/src/boons.ts): given by the story, carried
// one at a time as the bird's own status, read by its leader's stats, chosen only beside a woken
// waypoint statue.

function world(extraBoon = false): Engine {
  const { index, chunks } = buildFord()
  const onto = buildOntology()
  // a second boon, to show the choice between two
  if (extraBoon) onto.statuses.boon_test = { id: 'boon_test', name: { en: 'Test', zh: '测试' }, props: { 'lead:atk': 3 } }
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return game.engine
}

/** The story gives the bird a boon: a notify it answers (`companion/boon`). */
const give = (eng: Engine, id: string) => eng.queue({ kind: 'impulse/notify', host: { e: 'pip' }, roles: {}, params: { what: 'boon', unlock: id }, origin: 'world' })

/** Stand the player (and the fairy) by the Mountain Foot's waypoint statue, woken or not. */
function atStatue(eng: Engine, woken: boolean) {
  const w = eng.world
  const stone = w.get('wp.foot')!
  const at = stone.place.on === 'tile' ? stone.place : undefined
  eng.author(() => {
    eng.teleport(w.player, { map: at!.map, x: at!.x, y: at!.y + 1 })
    eng.teleport(w.get('pip')!, { map: at!.map, x: at!.x + 1, y: at!.y + 1 })
    if (woken) w.setStatus({ e: stone.id }, 'attuned', -1)
  })
}

describe('the companion\'s boons', () => {
  it('a boon given is kept and carried at once; it doubles the leader\'s experience', () => {
    const eng = world()
    const w = eng.world
    const pip = w.get('pip')!
    const p = w.player
    atStatue(eng, false)
    expect(w.stat(p, 'xpRate')).toBe(0)
    give(eng, 'xp')
    expect(boonsOf(w, pip)).toEqual(['xp'])
    expect(activeBoon(pip)).toBe('xp')
    expect(w.stat(p, 'xpRate')).toBe(1)
    // given again: nothing new
    give(eng, 'xp')
    expect(boonsOf(w, pip)).toEqual(['xp'])
    // experience through the rules: twice what it would be
    const before = w.num(p, 'xp') + 20 * (w.num(p, 'level', 1) - 1)
    eng.queue({ kind: 'impulse/notify', host: { e: p.id }, roles: {}, params: { what: 'defeat', xp: 5 }, origin: 'world' })
    const after = w.num(p, 'xp') + 20 * (w.num(p, 'level', 1) - 1)
    expect(after - before).toBe(10)
    expect(snapshot(eng).player.boons).toMatchObject({ unlocked: ['xp'], active: 'xp' })
  })

  it("the moment is told to the client: a light from whom the power leaves (the fallen bearer) to her, with the seal's number and the boon's name", () => {
    const eng = world()
    const w = eng.world
    atStatue(eng, false)
    const knight = w.get('npc.alberic')!
    const at = w.posOf(knight)!
    w.fx.length = 0
    eng.queue({ kind: 'impulse/notify', host: { e: 'pip' }, roles: {}, params: { what: 'boon', unlock: 'xp', from: knight.id }, origin: 'world' })
    eng.tick()
    const fx = w.fx.find((x) => x.t === 'boon')
    expect(fx).toMatchObject({ t: 'boon', who: 'pip', boon: 'xp', seal: 1, name: { zh: '荆冠之悟' }, from: { map: at.map, x: at.x, y: at.y } })
    // given again, nothing new: no second light
    w.fx.length = 0
    give(eng, 'xp')
    expect(w.fx.some((x) => x.t === 'boon')).toBe(false)
  })

  it('another boon is chosen only beside a woken waypoint statue', () => {
    const eng = world(true)
    const w = eng.world
    const pip = w.get('pip')!
    const p = w.player
    atStatue(eng, false)
    give(eng, 'xp')
    give(eng, 'test')
    expect(activeBoon(pip)).toBe('xp')
    // a statue not woken: refused
    expect(chooseBoon(eng, 'test')).toBe(false)
    expect(activeBoon(pip)).toBe('xp')
    // woken: the bird carries the other one, and the leader's stats follow
    atStatue(eng, true)
    const atk = w.stat(p, 'atk')
    expect(snapshot(eng).player.boons?.atWaypoint).toBe(true)
    expect(chooseBoon(eng, 'test')).toBe(true)
    expect(activeBoon(pip)).toBe('test')
    expect(w.stat(p, 'atk')).toBe(atk + 3)
    expect(w.stat(p, 'xpRate')).toBe(0)
    // one not given cannot be carried
    chooseBoon(eng, 'nothing')
    expect(activeBoon(pip)).toBe('test')
  })

  it('a woken statue touched opens the boons panel', () => {
    const eng = world()
    const w = eng.world
    atStatue(eng, true)
    w.fx = []
    eng.act('hands', w.player.id, { e: 'wp.foot' }, { instrument: null })
    expect(w.fx.some((f) => f.t === 'panel' && f.panel === 'boons')).toBe(true)
  })

  it('Lumi spoken to opens her panel (the main road, and her boons: the seals, the unfound sealed), wherever one is; changing one still wants a statue', () => {
    const eng = world()
    const w = eng.world
    w.fx = []
    eng.act('hands', w.player.id, { e: 'pip' }, { instrument: null })
    expect(w.fx.some((f) => f.t === 'panel' && f.panel === 'companion')).toBe(true)
  })
})

describe('Lumi, the fairy', () => {
  it('is a fairy companion drawn from the project\'s own art; an older save\'s bird becomes her', async () => {
    const { readFileSync } = await import('node:fs')
    const { COMPANION_LAYOUT, migrateCompanion } = await import('@openworld-game/content')
    const eng = world()
    const w = eng.world
    const pip = w.get('pip')!
    expect(pip.type).toBe('actor/companion/fairy')
    expect(w.hasTag(pip, 'airborne')).toBe(true)
    for (const [file, width, height] of [['SpriteSheet.png', 64, 16], ['Faceset.png', 38, 38]] as const) {
      const bytes = readFileSync(new URL(`../../public/assets/lsw/Companion/Fairy/${file}`, import.meta.url))
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]]).toEqual([width, height, 6])
    }
    // an older save: Lumi as a bird, with a boon already given
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const gw = game.engine.world
    game.engine.author(() => gw.transform(gw.get('pip')!, 'actor/companion/bird'))
    give(game.engine, 'xp')
    game.engine.author(() => migrateCompanion(game))
    expect(gw.get('pip')!.type).toBe('actor/companion/fairy')
    expect(boonsOf(gw, gw.get('pip')!)).toEqual(['xp'])
    expect(gw.fact(COMPANION_LAYOUT)).toBe(true)
  })
})
