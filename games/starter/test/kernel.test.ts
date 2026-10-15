// The kernel with no module (docs/engine-split.md S6, P2's proof): the starter, a whole game of data on the
// engine and the standard library alone, plays from its files. Nothing here imports a module or a game's code;
// were anything of the kernel still to need one, these would fail.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_HOUR, buildModSpec, decodeRawChunk, registeredModule, snapshot, type Engine, type Entity, type QualityDef, type Recipe } from '@openworld/engine'
import { compileProject } from '@openworld/format/src/node.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const compiled = compileProject(ROOT)
const { bundle, index } = compiled

function newGame(ontology = bundle.ontology): Game {
  const game = Game.create(index, structuredClone(ontology), new RuleLibrary(bundle.rules))
  for (const c of compiled.chunks) game.loadChunk(decodeRawChunk(c, bundle.terrainChars))
  game.engine.controls.sync()
  return game
}

/** A new game, its opening watched to the end (each line advanced, as the player would): it has set its fact. */
function played(ontology = bundle.ontology): Game {
  const game = newGame(ontology)
  const eng = game.engine
  for (let i = 0; i < 200 && (eng.world.scene || eng.world.fact('glade.arrived') !== 1); i++) {
    eng.tick()
    if (eng.world.scene?.waiting === 'advance') eng.story.advance()
  }
  return game
}

/** Put someone at a cell (the author's hand: a test's setting, never the game's). */
const put = (eng: Engine, e: Entity, map: string, x: number, y: number) => eng.author(() => eng.teleport(e, { map, x, y }))
const ticks = (eng: Engine, n: number) => { for (let i = 0; i < n; i++) eng.tick() }
/** Set the clock to an hour of today (the author's). */
const at = (eng: Engine, hour: number) => {
  const w = eng.world
  const now = w.hour()
  eng.author(() => (w.state.tick += Math.round((((hour - now) % 24) + 24) % 24 * TICKS_PER_HOUR)))
}

describe('the starter, on the kernel alone', () => {
  it('compiles without a problem', () => {
    expect(compiled.problems).toEqual([])
    expect(index.stats).toMatchObject({ maps: 2, npcs: 1, creatures: 1 })
  })

  it('loads no module, and the kernel needs none', () => {
    expect(bundle.game.modules).toEqual([])
    for (const m of ['classes', 'waypoints', 'boons', 'needs', 'society', 'loot', 'kits']) expect(registeredModule(m)).toBeUndefined()
    const game = newGame()
    expect(game.engine.modules).toEqual([])
    // the AI is told only of what this game has: the kernel's primitives, none of a module's
    const spec = buildModSpec(game.engine.world.onto.data)
    const ops = Object.keys(spec.primitives)
    expect(ops).toContain('hurt')
    for (const op of ['feed', 'boon', 'talk', 'pay', 'arrest', 'unleash', 'trophy']) expect(ops).not.toContain(op)
  })

  it('a new game begins at its start, at its hour, and the story opens', () => {
    const game = newGame()
    const eng = game.engine
    const w = eng.world
    expect(w.posOf(w.player)).toMatchObject(index.start)
    expect(Math.floor(w.hour())).toBe(8)
    ticks(eng, 5)
    expect(snapshot(eng).scene?.id).toBe('arrive')
    expect(eng.busy(w.player)).toBe(true)
  })

  it('the axe is in the chest: opened, taken, it fells a tree into a stump and two logs', () => {
    const eng = played().engine
    const w = eng.world
    const p = w.player
    put(eng, p, 'glade', 14, 5)
    eng.act('hands', p.id, { e: 'glade.chest' })
    expect(w.hasStatus({ e: 'glade.chest' }, 'open')).toBe(true)
    eng.controls.transfer('glade.chest', 'chest', 'glade.axe', false)
    expect(w.get('glade.axe')?.place).toMatchObject({ holder: p.id })
    // the tree north of (6,3)
    put(eng, p, 'glade', 6, 3)
    const tree = () => w.cellTop('glade', 6, 2)!
    expect(tree().type).toBe('tile/tree')
    for (let i = 0; i < 4 && tree().type === 'tile/tree'; i++) {
      eng.act('use', p.id, { e: tree().id }, { instrument: { e: 'glade.axe' } })
      ticks(eng, 1)
    }
    expect(tree().type).toBe('tile/stump')
    // where they fell, or flown into the bag (the magnet)
    expect(w.entitiesAt('glade', 6, 2).filter((e) => e.type === 'item/material/log').length + eng.controls.count('item/material/log')).toBe(2)
  })

  it('Mira keeps her day: the garden in the morning, the pond in the afternoon, her bed at night', () => {
    const eng = played().engine
    const w = eng.world
    const mira = w.get('npc.mira')!
    expect(mira.npc?.schedule.find((s) => s.activity === 'sleep')).toMatchObject({ map: 'cottage', x: 5, y: 2 })
    at(eng, 13)
    ticks(eng, 400)
    const here = w.posOf(mira)!
    expect(here.map).toBe('glade')
    expect(Math.abs(here.x - 5) + Math.abs(here.y - 9)).toBeLessThanOrEqual(1)
  })

  it('the favour: spoken to, Mira asks for three logs; brought, they are handed in and rewarded', () => {
    const game = played()
    const eng = game.engine
    const w = eng.world
    const p = w.player
    const mira = w.get('npc.mira')!
    const by = w.posOf(mira)!
    put(eng, p, by.map, by.x, by.y + 1)
    eng.act('hands', p.id, { e: mira.id })
    ticks(eng, 1)
    const journal = () => snapshot(eng).quests.journal.find((q) => q.quest === 'firewood')
    expect(journal()?.state).toBe('active')
    eng.author(() => { for (let i = 0; i < 3; i++) w.create('item/material/log', { on: 'inside', holder: p.id }) })
    ticks(eng, 1)
    expect(journal()?.objectives.find((o) => o.id === 'logs')?.state).toBe('done')
    // experience (twenty is a level at the first: xpToNext)
    const xp = () => w.num(p, 'level', 1) * 1000 + w.num(p, 'xp')
    const before = xp()
    const now = w.posOf(mira)!
    put(eng, p, now.map, now.x, now.y + 1)
    eng.act('hands', p.id, { e: mira.id })
    ticks(eng, 1)
    expect(journal()?.state).toBe('done')
    expect(eng.controls.count('item/material/log')).toBe(0)
    expect(xp()).toBeGreaterThan(before)
  })

  it('the slime: the kernel\'s plain combat — it bites the folk, a blow is the striker\'s attack, felled it is gone', () => {
    const eng = played().engine
    const w = eng.world
    const p = w.player
    const slime = w.get('glade.slime')!
    expect(eng.combat.strike(p, slime, 2, 1, undefined, true)).toEqual({ power: 2 })
    expect(eng.hostileTo(slime, p)).toBe(true)
    put(eng, p, 'glade', 19, 10)
    const hp = w.num(p, 'hp')
    ticks(eng, 60)
    expect(w.num(p, 'hp')).toBeLessThan(hp)
    for (let i = 0; i < 10 && w.get(slime.id); i++) {
      eng.act('use', p.id, { e: slime.id }, { instrument: null })
      ticks(eng, 1)
    }
    expect(w.get(slime.id)).toBeUndefined()
  })

  it('a bed taken hold of at night: one sleeps until it is time to rise', () => {
    const eng = played().engine
    const w = eng.world
    const p = w.player
    at(eng, 22)
    // a bed is taken hold of standing on it (its handsRange is 0)
    put(eng, p, 'cottage', 5, 1)
    eng.act('hands', p.id, { e: 'cottage.bed' })
    ticks(eng, 1)
    expect(Math.floor(w.hour())).toBe(6)
    expect(w.calendar().day).toBe(2)
  })

  it('a save loads into the same world', () => {
    const game = played()
    const eng = game.engine
    ticks(eng, 30)
    const save = game.save()
    const back = Game.load(structuredClone(save), index, structuredClone(bundle.ontology))
    expect(back.engine.world.state.tick).toBe(eng.world.state.tick)
    expect(back.engine.world.posOf(back.engine.world.player)).toEqual(eng.world.posOf(eng.world.player))
    expect(Object.keys(back.engine.world.state.entities).sort()).toEqual(Object.keys(eng.world.state.entities).sort())
  })
})

describe('a made thing\'s quality, as the game\'s data says it', () => {
  // qualities of the test's own, none of them OpenWorld's: three a maker's level reaches, one beyond any maker's reach
  const QUALITIES: QualityDef[] = [
    { id: 'rough', tag: 'quality:rough', factor: 0.8, from: -99 },
    { id: 'plain', factor: 1, from: 0 },
    { id: 'good', tag: 'quality:good', factor: 1.2, from: 5 },
    { id: 'mythic', tag: 'quality:mythic', factor: 2 },
  ]
  const RECIPE: Recipe = { id: 'test/stone', name: 'a stone', sprite: 'item:stone', needs: [{ type: 'item/material/log', count: 1 }], make: { type: 'item/material/stone' } }
  /** Make the stone by hand once, the maker's hand at the bench as `stats` say: the quality tags of what is made. */
  const make = (stats: Record<string, number>): string[] => {
    const eng = played({ ...bundle.ontology, qualities: QUALITIES }).engine
    const w = eng.world
    eng.recipes.set(RECIPE.id, RECIPE)
    eng.author(() => {
      for (const [k, v] of Object.entries(stats)) w.setProp(w.player, k, v)
      w.create('item/material/log', { on: 'inside', holder: w.player.id })
    })
    const before = new Set(Object.keys(w.state.entities))
    expect(eng.controls.craft(RECIPE)).toBe(true)
    const made = Object.values(w.state.entities).find((e) => !before.has(e.id) && e.type === 'item/material/stone')!
    return (made.tags ?? []).filter((t) => t.startsWith('quality:'))
  }

  it('is the tier the maker\'s level reaches; the hand\'s lift takes it one tier up the game\'s own; a quality beyond reach comes by its own chance', () => {
    expect(make({})).toEqual([])
    expect(make({ 'hands:lift': 1 })).toEqual(['quality:good'])
    expect(make({ 'hands:mythic': 1 })).toEqual(['quality:mythic'])
    // the level's reach and the craft's (`craft:<station>`): good already, and no tier above it to lift to
    expect(make({ 'craft:hands': 5, 'hands:lift': 1 })).toEqual(['quality:good'])
  })
})
