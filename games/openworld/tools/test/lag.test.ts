// What made the worker stall as a player's things grew (a big bag, a pile on the ground, crafting all at once):
// each is read without going through every thing in the world, or spread over the ticks.
import { describe, expect, it } from 'vitest'
import { Game, MAGNET_PER_TICK, RuleLibrary, snapshot, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { peopleViews } from '@openworld/modules'
import { AT, buildFord } from '../src/demo/world.ts'

function ford() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    eng.teleport(w.player, { map: 'ford', x: AT.spawn[0], y: AT.spawn[1] })
  })
  eng.controls.sync()
  return { game, eng, w }
}
const scan = (entities: Record<string, Entity>) => Object.values(entities).filter((e) => e.place.on === 'resident').map((e) => e.id).sort()

describe('the things on no map are kept in an index', () => {
  it('as they come, go and are loaded again: the quests read them without going through every thing', () => {
    const { game, eng, w } = ford()
    expect(w.residents().map((e) => e.id).sort()).toEqual(scan(w.state.entities))
    // a quest taken on (a resident thing), a resident destroyed
    const q = eng.author(() => w.add({ id: 'quest.test', type: 'resident/quest', place: { on: 'resident' }, props: { quest: 'test', state: 'active' } }))
    expect(w.residents().map((e) => e.id)).toContain(q.id)
    expect(eng.quests.all().map((e) => e.id)).toContain(q.id)
    eng.author(() => w.destroy(q))
    expect(w.residents().map((e) => e.id)).not.toContain(q.id)
    expect(eng.quests.all().map((e) => e.id)).not.toContain(q.id)
    // a thing set on no map, and back on a map
    const stone = eng.author(() => w.create('item/material/stone', { on: 'resident' }))
    expect(w.residents().map((e) => e.id)).toContain(stone.id)
    eng.author(() => w.place(stone, { on: 'tile', map: 'ford', x: AT.spawn[0], y: AT.spawn[1] }))
    expect(w.residents().map((e) => e.id)).not.toContain(stone.id)
    // loaded again from a save
    const again = Game.load(game.save(), buildFord().index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    expect(again.engine.world.residents().map((e) => e.id).sort()).toEqual(scan(again.engine.world.state.entities))
  })
})

describe('the magnet, on a big pile', () => {
  it('pulls a pile in over a few ticks, a share each tick, and loses nothing', () => {
    const { eng, w } = ford()
    const at = w.posOf(w.player)!
    const N = 120
    eng.author(() => {
      for (let i = 0; i < N; i++) {
        const e = w.create('item/material/stone', { on: 'tile', map: at.map, x: at.x + 1, y: at.y })
        e.dropped = true
      }
    })
    const stones = () => eng.controls.count('item/material/stone')
    const seen: number[] = []
    for (let t = 0; t < 40 && stones() < N; t++) {
      const before = stones()
      eng.tick()
      seen.push(stones() - before)
    }
    expect(stones()).toBe(N)
    expect(Math.max(...seen)).toBeLessThanOrEqual(MAGNET_PER_TICK)
    expect(seen.filter((n) => n > 0).length).toBeGreaterThan(1)
  })
})

describe('a big bag in the frame', () => {
  it('goes to the page as stacks: two thousand coins are one entry with its count and its ids', () => {
    const { eng, w } = ford()
    const p = w.player
    const coins = eng.author(() => Array.from({ length: 2000 }, () => w.create('item/misc/thornmark', { on: 'inside', holder: p.id })))
    eng.author(() => w.create('item/material/stone', { on: 'inside', holder: p.id }))
    eng.controls.sync()
    const inv = snapshot(eng).player.inventory
    const purse = inv.filter((i) => i.type === 'item/misc/thornmark')
    expect(purse).toHaveLength(1)
    // (the hand may hold one of them: the bag is what is not in hand)
    const inHand = coins.filter((c) => c.id === p.held).map((c) => c.id)
    expect(purse[0].count).toBe(2000 - inHand.length)
    expect(new Set([...purse[0].ids, ...inHand])).toEqual(new Set(coins.map((c) => c.id)))
    expect(inv.find((i) => i.type === 'item/material/stone')).toMatchObject({ count: 1 })
    // the whole frame stays small (it was over half a megabyte, ten times a second)
    expect(JSON.stringify(snapshot(eng)).length).toBeLessThan(150_000)
  })
})

describe('a big bag in the trade panel', () => {
  it('offers things alike at one price as one row with how many, not a row each', () => {
    const { eng, w } = ford()
    const p = w.player
    const merchant = Object.values(w.state.entities).find((e) => e.npc)!
    eng.author(() => { for (let i = 0; i < 500; i++) w.create('item/food/bread', { on: 'inside', holder: p.id }) })
    const trade = peopleViews(eng, { trade: merchant.id }).trade!
    const bread = trade.offers.filter((o) => o.item.type === 'item/food/bread')
    expect(bread).toHaveLength(1)
    expect(bread[0].count).toBe(500)
    expect(JSON.stringify(trade).length).toBeLessThan(20_000)
  })
})
