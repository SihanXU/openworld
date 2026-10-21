// The real Held Ground, with its thirty-coin welcome: no injected funds, forced harvest or reset fishing cooldown.
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, astar, type Dir, type Key } from '@openworld/engine'
import { BASE_RULES, GAME, HAVEN, RECIPE_BY_ID, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { completeFishing } from './fishing-helper.ts'

function homestead() {
  const { index, chunks } = buildFord()
  const onto = buildOntology()
  const library = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
  const game = Game.create(index, onto, library())
  for (const chunk of chunks) game.loadChunk(decodeChunk(chunk))
  const eng = game.engine, w = eng.world, c = eng.controls
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) {
      if (w.scene?.waiting === 'advance') eng.story.advance()
      eng.tick()
    }
  }
  // Only the campaign's starting situation is authored. The welcome and all production use the game itself.
  eng.author(() => {
    eng.quests.put('descent', 'done')
    eng.quests.put('rescue', 'done')
    eng.quests.put('vigil', 'done')
    eng.quests.put('first_seal', 30)
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    w.setFact('sins.defeated.alberic', 1)
    eng.teleport(w.player, { map: 'haven', x: HAVEN.arrive[0], y: HAVEN.arrive[1] })
  })
  for (let i = 0; i < 1200 && (!w.fact('haven.met') || w.scene); i++) tick(1)
  expect(w.fact('haven.met')).toBe(1)
  expect(c.count('item/misc/thornmark')).toBe(30)

  const walk = (x: number, y: number) => {
    const p = w.posOf(w.player)!
    const path = astar(HAVEN.w, HAVEN.h, (a, b) => w.passable('haven', a, b), p.x, p.y, x, y)
    expect(path, `path to ${x},${y}`).toBeDefined()
    for (const [nx, ny] of path!) {
      for (let tries = 0; tries < 50; tries++) {
        const at = w.posOf(w.player)!
        if (at.x === nx && at.y === ny) break
        const dir: Dir = nx > at.x ? 'right' : nx < at.x ? 'left' : ny > at.y ? 'down' : 'up'
        eng.movePlayer(dir)
        tick(1)
      }
      expect(w.posOf(w.player)).toMatchObject({ x: nx, y: ny })
    }
    tick(10)
  }
  const owned = (type: string) => Object.values(w.state.entities).find((e) => e.type === type && (e.place.on === 'inside' || e.place.on === 'hand') && e.place.holder === w.player.id)!
  const hold = (type: string) => {
    c.sync()
    const item = owned(type)
    expect(item, type).toBeDefined()
    c.select(w.player.slots!.indexOf(c.key(item)))
    expect(w.get(w.player.held)?.type).toBe(type)
  }
  const act = (key: Key, x: number, y: number) => {
    const plan = c.plan(key, { x, y })
    expect(plan, `${key} at ${x},${y}`).toBeDefined()
    c.run(plan!, true)
    tick(3)
  }
  const stall = () => walk(HAVEN.heart[0] + 3, HAVEN.heart[1] + 2)
  const bank = (() => {
    const p = w.posOf(w.player)!
    for (let y = 8; y < 17; y++) for (let x = 20; x < 30; x++) {
      if (w.terrainAt('haven', x, y) !== 'water') continue
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const bx = x + dx, by = y + dy
        if (w.passable('haven', bx, by) && astar(HAVEN.w, HAVEN.h, (a, b) => w.passable('haven', a, b), p.x, p.y, bx, by)) return { x, y, bx, by }
      }
    }
    throw new Error('no reachable bank beside the initial pond')
  })()
  return { game, eng, w, c, tick, walk, hold, owned, act, stall, bank, index, chunks, onto, library }
}

describe('the Held Ground production cycle', () => {
  it('saves a growing irrigated crop with its exact deadline and retained water', { timeout: 60000 }, () => {
    const f = homestead()
    const { w, eng } = f
    const crop = eng.author(() => {
      w.addTag(w.player, 'skill:irrigation')
      return w.create('fixture/crop/carrot/sprout', { on: 'tile', map: 'haven', x: 18, y: 21 })
    })
    f.stall()
    expect(f.c.craft(RECIPE_BY_ID['shop/buy/farm-bucket'])).toBe(true)
    f.walk(f.bank.bx, f.bank.by)
    f.hold('item/vessel/bucket/empty')
    f.act('use', f.bank.x, f.bank.y)
    f.walk(18, 22)
    f.hold('item/vessel/bucket/water')
    f.act('use', 18, 21)
    f.tick(200)
    const deadline = crop.statuses!.stage
    const resumed = Game.load(structuredClone(f.game.save()), f.index, f.onto, f.library(), GAME.upgradeSave)
    for (const chunk of f.chunks) resumed.loadMapData(decodeChunk(chunk).map)
    const rw = resumed.engine.world
    expect(rw.get(crop.id)?.statuses).toEqual(crop.statuses)
    for (let i = rw.state.tick; i <= deadline; i++) resumed.engine.tick()
    expect(rw.get(crop.id)?.type).toBe('fixture/crop/carrot/young')
    expect(rw.hasStatus({ e: crop.id }, 'watered')).toBe(true)
    for (let i = 0; i < 1200; i++) resumed.engine.tick()
    expect(rw.get(crop.id)?.type).toBe('fixture/crop/carrot/ripe')
  })
  it('grows and sells five turnips from the welcome budget, with five seeds for next time', { timeout: 60000 }, () => {
    const f = homestead()
    const { w, c, tick, walk, hold, act, bank } = f
    f.stall()
    expect(c.craft(RECIPE_BY_ID['shop/buy/seed-turnip'])).toBe(true)
    expect(c.craft(RECIPE_BY_ID['shop/buy/farm-bucket'])).toBe(true)
    expect(c.count('item/misc/thornmark')).toBe(16)
    const plots = [17, 18, 19, 20, 21]
    for (const x of plots) {
      walk(x, 22)
      hold('item/seed/turnip')
      act('use', x, 21)
      expect(w.placedAt('haven', x, 21).some((e) => e.type === 'fixture/crop/turnip/sprout')).toBe(true)
    }
    for (let stage = 0; stage < 2; stage++) {
      for (const x of plots) {
        walk(bank.bx, bank.by)
        hold('item/vessel/bucket/empty')
        act('use', bank.x, bank.y)
        walk(x, 22)
        hold('item/vessel/bucket/water')
        act('use', x, 21)
      }
      tick(601)
    }
    c.select(w.player.slots!.findIndex((key) => !key))
    for (const x of plots) {
      walk(x, 22)
      act('hands', x, 21)
    }
    expect(c.count('item/food/turnip')).toBe(5)
    expect(c.count('item/seed/turnip')).toBe(5)
    f.stall()
    for (let i = 0; i < 5; i++) expect(c.craft(RECIPE_BY_ID['shop/sell/food-turnip'])).toBe(true)
    expect(c.count('item/food/turnip')).toBe(0)
    expect(c.count('item/misc/thornmark')).toBe(36)
    expect(c.count('item/vessel/bucket/empty')).toBe(1)
  })

  it('buys a rod and bait, waits for the pond and sells an actual catch', { timeout: 60000 }, () => {
    const f = homestead()
    const { w, c, hold, act, tick, bank } = f
    f.stall()
    expect(c.craft(RECIPE_BY_ID['shop/buy/tool-fishing_rod'])).toBe(true)
    expect(c.craft(RECIPE_BY_ID['shop/buy/misc-bait'])).toBe(true)
    expect(c.count('item/misc/thornmark')).toBe(0)
    const rod = f.owned('item/tool/fishing_rod')
    hold('item/misc/bait')
    // This is the bag's use-an-item-on-another command.
    f.eng.act('use', w.player.id, { e: rod.id }, { instrument: { e: w.player.held! } })
    expect(w.num(rod, 'bait')).toBe(5)
    expect(c.count('item/misc/bait')).toBe(4)
    f.walk(bank.bx, bank.by)
    hold('item/tool/fishing_rod')
    const catches = () => Object.values(w.state.entities).filter((e) => e.type.startsWith('item/food/fish/') && (e.place.on === 'inside' || e.place.on === 'hand') && e.place.holder === w.player.id)
    let casts = 0
    while (!catches().length && casts < 20) {
      act('use', bank.x, bank.y)
      casts++
      completeFishing(f.eng, { tick: () => tick(1) })
      if (!catches().length) tick(101)
    }
    const fish = catches()[0]
    expect(fish).toBeDefined()
    expect(w.num(rod, 'bait')).toBe(Math.max(0, 5 - casts))
    const sale = Object.values(RECIPE_BY_ID).find((r) => r.group === 'sell' && r.needs[0].type === fish.type)!
    f.stall()
    expect(c.craft(sale)).toBe(true)
    expect(c.count(fish.type)).toBe(0)
    expect(c.count('item/misc/thornmark')).toBe(sale.count)
    // Save/load keeps bait and the unlocked lake.
    f.eng.author(() => w.setFact('haven.zone.lake', 1))
    const save = structuredClone(f.game.save())
    const resumed = Game.load(save, f.index, f.onto, f.library(), GAME.upgradeSave)
    for (const chunk of f.chunks) resumed.loadMapData(decodeChunk(chunk).map)
    expect(resumed.engine.world.num(resumed.engine.world.get(rod.id)!, 'bait')).toBe(w.num(rod, 'bait'))
    expect(resumed.engine.world.fact('haven.zone.lake')).toBe(1)
  })
})
