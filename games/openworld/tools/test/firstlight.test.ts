import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Game, RuleLibrary, tickAt, type Entity } from '@openworld/engine'
import { BASE_RULES, FIRSTLIGHT, FIRSTLIGHT_HOUSES, FIRSTLIGHT_LAYOUT, FIRSTLIGHT_ROOMS, PART_ONE_LAYOUT, PART_ONE_MAPS, PROLOGUE_LAYOUT, PROLOGUE_MAPS, STORY_RULES, buildOntology, decodeChunk, migrateFirstlight, migrateFirstlightHouses, migratePartOneMaps, migratePrologueMaps } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { CANOPIES, reachingPlots } from '../src/demo/garden.ts'

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
  // (a mark of progress the migration must keep: any prop of the player's)
  Object.assign(w.player.props!, { quest: 4, xp: 42 })
  w.author(() => w.setFact('seen.arrival', true))
  w.author(() => w.setFact('mq.smith', 3))
  // (a save from before keeps every thing whole: docs/continent.md §9)
  const resume = () => Game.load(structuredClone(game.save({ whole: true })), index, buildOntology(), lib())
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

describe('Firstlight Village garden', () => {
  it('has no tree whose canopy hides a plot or the supplies crate (the pointer there would meet the tree)', () => {
    const { chunks } = buildFord()
    const village = decodeChunk(chunks.find((c) => c.map.id === FIRSTLIGHT.map)!)
    const at = (x: number, y: number) => village.map.terrain[y * village.map.width + x]
    expect(reachingPlots().map(([x, y]) => at(x, y)).filter((t) => CANOPIES.has(t))).toEqual([])
  })
})

describe("Firstlight's houses redrawn (2026-10-26)", () => {
  it('moves what an older save left where a wall now stands, in the village and in its houses, and keeps it whole', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const w = game.engine.world
    const maps = [FIRSTLIGHT.map, ...FIRSTLIGHT_ROOMS].map((id) => decodeChunk(chunks.find((c) => c.map.id === id)!))
    for (const c of maps) game.loadChunk(c)
    // a wall of the village and the dark outside a house's rooms, as an older save might have left things there
    const wallAt = (map: string) => {
      const m = w.map(map)!
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (w.isSolidTerrain(w.terrainAt(map, x, y)) && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => w.walkable(map, x + dx, y + dy))) return { x, y }
      throw new Error(`no wall on ${map}`)
    }
    const out = wallAt(FIRSTLIGHT.map)
    const inn = wallAt('meadow.cook')
    w.author(() => {
      w.place(w.player, { on: 'tile', map: FIRSTLIGHT.map, ...out })
      w.add({ id: 'old.stone', type: 'item/material/stone', place: { on: 'tile', map: 'meadow.cook', ...inn } })
      w.setFact(FIRSTLIGHT_HOUSES, false)
    })
    Object.assign(w.player.props!, { xp: 42 })
    game.engine.author(() => migrateFirstlightHouses(game, maps))
    for (const id of [w.player.id, 'old.stone']) {
      const p = w.get(id)!.place as { map: string; x: number; y: number }
      expect([id, w.isSolidTerrain(w.terrainAt(p.map, p.x, p.y))]).toEqual([id, false])
    }
    expect(w.player.props?.xp).toBe(42)
    expect(w.fact(FIRSTLIGHT_HOUSES)).toBe(true)
  })
})

describe("the Pilgrim's Road and the Held Ground redrawn (2026-10-27)", () => {
  it('keeps the ids their things had (a save keeps a map by id: the writ, a wolf felled, a tent)', () => {
    const kept = JSON.parse(readFileSync(new URL('../src/demo/quest/kept-ids.json', import.meta.url), 'utf8')) as Record<string, [string, string, string][]>
    const now = new Map(buildFord().chunks.flatMap((c) => c.entities.map((e) => [e.id, e] as const)))
    const name = (e: Entity) => (typeof e.name === 'string' ? e.name : (e.name as { en?: string } | undefined)?.en ?? '')
    const moved = Object.entries(kept)
      .filter(([k]) => k !== '$comment')
      .flatMap(([, rows]) => rows.filter(([id, type, n]) => { const e = now.get(id); return e && !((e.type === type || e.type.startsWith(`${type}/`)) && name(e) === n) }).map(([id, type, n]) => `${id}: ${type} ${n} → ${now.get(id)!.type} ${name(now.get(id)!)}`))
    expect(moved).toEqual([])
    for (const id of ['abbey.hall~if', 'eastroad~c3', 'pilgrimway~ch', 'haven~8']) expect(now.has(id), id).toBe(true)
  })

  it('moves what an older save left where a wall now stands, on the road east, in its rooms and in the Held Ground', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const w = game.engine.world
    const maps = PART_ONE_MAPS.map((id) => decodeChunk(chunks.find((c) => c.map.id === id)!))
    for (const c of maps) game.loadChunk(c)
    const wallAt = (map: string) => {
      const m = w.map(map)!
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (w.isSolidTerrain(w.terrainAt(map, x, y)) && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => w.walkable(map, x + dx, y + dy))) return { x, y }
      throw new Error(`no wall on ${map}`)
    }
    w.author(() => {
      w.place(w.player, { on: 'tile', map: 'abbey', ...wallAt('abbey') })
      w.add({ id: 'old.stone', type: 'item/material/stone', place: { on: 'tile', map: 'waystation.hostel', ...wallAt('waystation.hostel') } })
      w.add({ id: 'old.log', type: 'item/material/log', place: { on: 'tile', map: 'haven', ...wallAt('haven') } })
      // Alberic's tent as the save kept it, before it was a pavilion
      w.transform(w.get('haven~8')!, 'fixture/tent')
      w.setFact(PART_ONE_LAYOUT, false)
    })
    game.engine.author(() => migratePartOneMaps(game, maps))
    expect(w.get('haven~8')?.type).toBe('fixture/tent/pavilion')
    for (const id of [w.player.id, 'old.stone', 'old.log']) {
      const p = w.get(id)!.place as { map: string; x: number; y: number }
      expect([id, w.isSolidTerrain(w.terrainAt(p.map, p.x, p.y))]).toEqual([id, false])
    }
    expect(w.fact(PART_ONE_LAYOUT)).toBe(true)
  })
})

describe('the way down the mountain dressed in its ruins (2026-10-27)', () => {
  it('moves what an older save left where a ruin now stands, on Cloudtop, at the Mountain Foot and at the Ford', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const w = game.engine.world
    const maps = PROLOGUE_MAPS.map((id) => decodeChunk(chunks.find((c) => c.map.id === id)!))
    for (const c of maps) game.loadChunk(c)
    // the cairn on Cloudtop, the tower's stump at the foot, the tower on the Ford's far bank
    const ruins = [['summit', 17, 6], ['foot', 29, 11], ['ford', 38, 3]] as const
    for (const [map, x, y] of ruins) expect([map, w.isSolidTerrain(w.terrainAt(map, x, y))]).toEqual([map, true])
    w.author(() => {
      w.place(w.player, { on: 'tile', map: 'summit', x: 17, y: 6 })
      w.add({ id: 'old.stone', type: 'item/material/stone', place: { on: 'tile', map: 'foot', x: 29, y: 11 } })
      w.add({ id: 'old.log', type: 'item/material/log', place: { on: 'tile', map: 'ford', x: 38, y: 3 } })
      w.setFact(PROLOGUE_LAYOUT, false)
    })
    game.engine.author(() => migratePrologueMaps(game, maps))
    for (const id of [w.player.id, 'old.stone', 'old.log']) {
      const p = w.get(id)!.place as { map: string; x: number; y: number }
      expect([id, w.isSolidTerrain(w.terrainAt(p.map, p.x, p.y))]).toEqual([id, false])
    }
    expect(w.fact(PROLOGUE_LAYOUT)).toBe(true)
  })
})
