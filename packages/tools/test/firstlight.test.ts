import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt, type Entity } from '@lsw/engine'
import { BASE_RULES, FIRSTLIGHT, FIRSTLIGHT_LAYOUT, PROLOGUE_DONE, STORY_RULES, buildOntology, decodeChunk, migrateFirstlight } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

const garden = (e: Entity) => e.id.startsWith('ford.garden.') || (e.place.on === 'inside' && e.place.holder === 'ford.garden.supplies')

/** A legacy layout assembled from real entities, including visited/unvisited chunk state. */
function legacy(visited = true, fordVisited = true) {
  const { index, chunks } = buildFord()
  const ford = decodeChunk(chunks.find((c) => c.map.id === 'ford')!)
  const village = decodeChunk(chunks.find((c) => c.map.id === FIRSTLIGHT.map)!)
  const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
  const game = Game.create(index, buildOntology(), lib())
  const w = game.engine.world
  const goods = structuredClone(village.entities.filter((e) => garden(e) || ['ford.cart', 'tobin.wand', 'tobin.oil'].includes(e.id)))
  for (const e of goods) {
    if (e.place.on === 'inside') e.id = e.id.replace('ford.garden.stock.', 'legacy.stock.')
    if (e.place.on !== 'tile') continue
    if (e.id === 'ford.garden.supplies') e.place = { on: 'tile', map: 'ford', x: 20, y: 12 }
    else if (e.id.startsWith('ford.garden.')) e.place = { on: 'tile', map: 'ford', x: e.place.x - 10, y: e.place.y - 11 }
    else e.place = { on: 'tile', map: 'ford', x: 20, y: 14 }
    if (e.id.startsWith('tobin.')) e.id = e.id.replace('tobin.', 'legacy.')
  }
  const oldFord = structuredClone(ford)
  for (const x of [29, 30, 31]) oldFord.map.terrain[22 * oldFord.map.width + x] = 'water'
  if (fordVisited) game.loadChunk({ ...oldFord, entities: [...ford.entities, ...goods] })
  if (visited) game.loadChunk({ ...village, entities: village.entities.filter((e) => !e.id.startsWith('village.') && !garden(e) && !['ford.cart', 'tobin.wand', 'tobin.oil'].includes(e.id)) })
  const tobin = w.get('npc.tobin')!
  w.author(() => w.place(tobin, { on: 'tile', map: 'ford', x: 20, y: 15 }))
  tobin.npc!.schedule = [{ from: 0, to: 24, map: 'ford', x: 20, y: 15, activity: 'mind the cart' }]
  tobin.npc!.person!.schedules = [{ key: 'default', entries: structuredClone(tobin.npc!.schedule) }]
  w.state.tick = tickAt(1, 13)
  w.author(() => w.place(w.player, { on: 'tile', map: 'ford', x: 14, y: 17 }))
  Object.assign(w.player.props!, { prologue: PROLOGUE_DONE, quest: 4, xp: 42 })
  w.author(() => w.setFact('seen.arrival', true))
  w.author(() => w.setFact('mq.smith', 3))
  const resume = () => Game.load(structuredClone(game.save()), index, buildOntology(), lib())
  const migrate = (saved: Game) => saved.engine.author(() => migrateFirstlight(saved, index, ford, village))
  return { game, w, resume, migrate, ford, village }
}

describe('Firstlight Village save compatibility', () => {
  it.each([true, false])('moves residents and remaining garden stock without resetting progress (village visited: %s)', (visited) => {
    const f = legacy(visited)
    const crate = f.w.get('ford.garden.supplies')!
    const before = [...crate.contents!]
    const tool = f.w.get(before[8])!
    f.w.author(() => f.w.place(tool, { on: 'inside', holder: 'player' }))
    const wand = f.w.get('legacy.wand')!
    f.w.author(() => f.w.place(wand, { on: 'hand', holder: 'player' }))
    f.w.author(() => f.w.destroy(f.w.get('ford.garden.carrot.ripe')!))
    f.w.author(() => f.w.setStatus({ e: 'ford.garden.turnip.sprout' }, 'watered', f.w.state.tick + 600))
    f.w.author(() => f.w.setTerrain('ford', 17, 12, 'farmland'))
    f.w.author(() => f.w.setTerrain('ford', 4, 19, 'farmland')) // A user-made plot must not be removed.
    f.w.get('npc.tobin')!.npc!.memory = { talked: 1, said: ['greeting:first'] }
    const saved = f.resume()
    f.migrate(saved)
    const w = saved.engine.world
    expect(w.player.props).toMatchObject({ quest: 4, xp: 42 })
    expect(w.fact('mq.smith')).toBe(3)
    expect(w.get('npc.tobin')!.npc!.memory).toEqual({ talked: 1, said: ['greeting:first'] })
    expect(w.get(tool.id)?.place).toEqual({ on: 'inside', holder: 'player' })
    expect(w.get(wand.id)?.place).toEqual({ on: 'hand', holder: 'player' })
    expect(w.get('tobin.wand')).toBeUndefined()
    expect(w.get('tobin.oil')).toBeUndefined()
    expect(w.get('ford.garden.stock.0')).toBeUndefined()
    expect(w.posOf(w.get('legacy.oil'))).toEqual({ map: FIRSTLIGHT.map, x: 30, y: 15 })
    expect(w.get('ford.garden.supplies')?.contents).toEqual(before.filter((id) => id !== tool.id))
    expect(w.posOf(w.get('ford.garden.supplies'))).toEqual({ map: FIRSTLIGHT.map, x: 31, y: 23 })
    expect(w.get('ford.garden.carrot.ripe')).toBeUndefined()
    expect(w.hasStatus({ e: 'ford.garden.turnip.sprout' }, 'watered')).toBe(true)
    expect(w.terrainAt('ford', 17, 12)).not.toBe('farmland')
    expect(w.terrainAt('ford', 4, 19)).toBe('farmland')
    expect(w.posOf(w.get('npc.hesper'))?.map).toBe('ford')
    expect(w.posOf(w.get('npc.tobin'))?.map).toBe(FIRSTLIGHT.map)
    expect(w.get('npc.tobin')!.npc!.person!.schedules!.every((v) => v.entries.every((s) => s.map === FIRSTLIGHT.map))).toBe(true)
    expect(w.get('village.well')).toBeDefined()
    expect(w.state.loadedMaps).toContain(FIRSTLIGHT.map)
    const migrated = structuredClone(saved.save().state)
    f.migrate(saved)
    expect(saved.save().state).toEqual(migrated)
    expect(w.fact(FIRSTLIGHT_LAYOUT)).toBe(true)
  })

  it('preserves a partially repaired bridge, and relocates a player covered by the wider river', () => {
    const f = legacy()
    f.w.author(() => f.w.setTerrain('ford', 29, 22, 'bridge'))
    f.w.author(() => f.w.setTerrain('ford', 30, 22, 'bridge'))
    f.w.author(() => f.w.place(f.w.player, { on: 'tile', map: 'ford', x: 33, y: 13 }))
    const saved = f.resume()
    f.migrate(saved)
    const w = saved.engine.world
    expect([31, 32, 33].map((x) => w.terrainAt('ford', x, 22))).toEqual(['bridge', 'bridge', 'water'])
    const at = w.posOf(w.player)!
    expect(w.walkable(at.map, at.x, at.y, w.player.id)).toBe(true)
    expect(w.player.props).toMatchObject({ quest: 4, xp: 42 })
  })

  it('does not respawn a destroyed cart, empty garden or taken supply crate', () => {
    const f = legacy(false)
    f.w.author(() => f.w.destroy(f.w.get('ford.cart')!))
    for (const e of Object.values(f.w.state.entities)) if (garden(e)) f.w.author(() => f.w.destroy(e))
    const saved = f.resume()
    f.migrate(saved)
    expect(saved.engine.world.get('ford.cart')).toBeUndefined()
    expect(Object.values(saved.engine.world.state.entities).filter(garden)).toHaveLength(0)
  })

  it.each([true, false])('loads new authored stock if the Ford was never visited (village visited: %s)', (visited) => {
    const f = legacy(visited, false)
    const saved = f.resume()
    f.migrate(saved)
    const w = saved.engine.world
    expect(w.get('ford.garden.supplies')!.contents).toHaveLength(24)
    expect(w.posOf(w.get('tobin.wand'))?.map).toBe(FIRSTLIGHT.map)
    expect(w.posOf(w.get('npc.tobin'))?.map).toBe(FIRSTLIGHT.map)
  })

  it('keeps new builds and inventory when house walls replace open grass', () => {
    const f = legacy()
    const crate = f.w.author(() => f.w.create('fixture/container/crate', { on: 'tile', map: FIRSTLIGHT.map, x: 8, y: 5 }))
    const ore = f.w.author(() => f.w.create('item/material/stone', { on: 'inside', holder: crate.id }))
    const saved = f.resume()
    f.migrate(saved)
    const w = saved.engine.world
    const at = w.posOf(w.get(crate.id))!
    expect(at).not.toEqual({ map: FIRSTLIGHT.map, x: 8, y: 5 })
    expect(w.isSolidTerrain(w.terrainAt(at.map, at.x, at.y))).toBe(false)
    expect(w.get(ore.id)?.place).toEqual({ on: 'inside', holder: crate.id })
  })
})
