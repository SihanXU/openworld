// Saves taken mid-play: whatever the world was waiting on when the game was saved, a loaded game
// plays on.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

describe('a save taken while the modder works', () => {
  it('lets the held go on load: the request is not saved, so nobody would ever answer it', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, onto, lib())
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // a modder still at work: the participants are held until it answers
    game.mods.provider = { resolve: () => new Promise(() => {}) }
    const p = w.player
    const rope = eng.author(() => w.create('item/tool/rope', { on: 'hand', holder: p.id }))
    const at = w.posOf(p)!
    for (const e of w.entitiesOnMap(at.map)) {
      if (e.id === p.id || e.place.on !== 'tile') continue
      eng.act('use', p.id, { e: e.id }, { instrument: { e: rope.id } })
      if (p.frozenBy) break
    }
    expect(eng.busy(p)).toBe(true)

    const loaded = Game.load(structuredClone(game.save()), index, onto, lib())
    for (const c of chunks) loaded.loadChunk(decodeChunk(c))
    const p2 = loaded.engine.world.player
    expect(Object.values(loaded.engine.world.state.entities).filter((e) => e.frozenBy)).toEqual([])
    expect(loaded.engine.busy(p2)).toBe(false)
  })
})

describe('an older save (cells as tile overrides, before world-model.md §4.6)', () => {
  it('keeps the changed cells of a map not entered yet through the next save, and applies them when it is', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, onto, lib())
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const meadow = game.engine.world.map('meadow')!
    const i = meadow.terrain.findIndex((t) => t === 'tree')
    const [x, y] = [i % meadow.width, Math.floor(i / meadow.width)]
    // a tree felled on the meadow, kept the old way; the player is elsewhere
    const old = structuredClone(game.save()) as ReturnType<Game['save']> & { state: { tiles?: unknown } }
    old.state.tiles = { [`meadow:${x}:${y}`]: { terrain: 'stump' } }
    const first = Game.load(old, index, onto, lib())
    const here = first.engine.world.posOf(first.engine.world.player)!.map
    expect(here).not.toBe('meadow')
    first.loadMapData(decodeChunk(chunks.find((c) => c.map.id === here)!).map)
    // saved again before the meadow is ever entered
    const again = Game.load(JSON.parse(JSON.stringify(first.save())), index, onto, lib())
    again.loadMapData(decodeChunk(chunks.find((c) => c.map.id === 'meadow')!).map)
    expect(again.engine.world.terrainAt('meadow', x, y)).toBe('stump')
    expect(again.engine.world.state.legacyTiles?.meadow).toBeUndefined()
  })
})

describe('one game\'s learning', () => {
  it('stays in that game: a second game made from the same world does not have its learned things', () => {
    const world = buildOntology()
    const { index } = buildFord()
    const learned = { id: 'item/material/bone_ash', name: { en: 'Bone Ash', zh: '骨灰' }, tags: ['powder'], props: { material: 'bone' }, makeup: [{ type: 'item/material/bone', count: 1 }] }
    const first = Game.create(index, world, lib())
    first.engine.lib.addType(learned as never)
    first.engine.world.onto.addType(learned as never)
    expect(first.engine.world.onto.hasType('item/material/bone_ash')).toBe(true)
    // the world's own definitions are left as they were, and the next game (a new one, another save) starts from them
    expect('item/material/bone_ash' in world.types).toBe(false)
    expect(Game.create(index, world, lib()).engine.world.onto.hasType('item/material/bone_ash')).toBe(false)
  })
})
