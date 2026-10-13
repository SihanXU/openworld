// The Held Ground's stock against its widenings (src/ui/stock.ts): one pile every open widening draws on. A card
// shows the whole stock beside what it needs, and can be built when the stock alone covers it; what all the open
// widenings lack of a kind together is what they ask less the stock — once, not each card's shortfall summed against
// the whole pile (the panel used to count one pile toward every card, and to hand over too little).

import { describe, expect, it } from 'vitest'
import { HAVEN_UPGRADES } from '@openworld-game/content'
import { stockView, type Widening } from '../src/ui/stock.ts'

const LOG = 'item/material/log'
const STONE = 'item/material/stone'
const keys = { size: 'haven.size', stock: 'haven.stock.' }
const up = (id: string, track: Widening['track'], land: number, needs: [string, number][], value = 1): Widening => ({ id, track, land, needs: needs.map(([type, count]) => ({ type, count })), fact: `haven.${id}`, value })

/** Two buildings that each ask ten logs, a ground that asks stones, and the land's second ring (not open yet). */
const UPGRADES = [up('land1', 'land', 0, [[LOG, 4]], 1), up('land2', 'land', 1, [[LOG, 30]], 2), up('workshop', 'building', 1, [[LOG, 10]]), up('storehouse', 'building', 1, [[LOG, 10], [STONE, 2]]), up('quarry', 'zone', 3, [[STONE, 50]])]

describe("the Held Ground's stock", () => {
  it('every open card sees the same pile, and each can be built when the pile alone covers it', () => {
    const v = stockView(UPGRADES, { 'haven.size': 1, 'haven.land1': 1, [`haven.stock.${LOG}`]: 10, [`haven.stock.${STONE}`]: 2 }, keys)
    const row = (id: string) => v.rows.find((r) => r.u.id === id)!
    expect(row('land1').state).toBe('done')
    expect(row('land2').state).toBe('open')
    expect(row('quarry').state).toBe('locked')
    // the pile is shown whole on each card, never a share of its own
    expect(row('workshop').needs).toMatchObject([{ type: LOG, count: 10, stock: 10, lack: 0 }])
    expect(row('storehouse').needs).toMatchObject([{ type: LOG, count: 10, stock: 10, lack: 0 }, { type: STONE, count: 2, stock: 2, lack: 0 }])
    expect(row('workshop').buildable).toBe(true)
    expect(row('storehouse').buildable).toBe(true)
    expect(row('land2').buildable).toBe(false)
    expect(row('land2').needs[0].lack).toBe(20)
  })

  it('what the open widenings lack together is what they ask less the pile, once', () => {
    const facts = { 'haven.size': 1, 'haven.land1': 1, [`haven.stock.${LOG}`]: 10, [`haven.stock.${STONE}`]: 2 }
    const v = stockView(UPGRADES, facts, keys)
    // asked: the second ring 30, the workshop 10, the storehouse 10 — 50 logs against a pile of 10
    expect(v.lacking(LOG)).toBe(40)
    expect(v.lacking(STONE)).toBe(0)
    // the old reckoning, each card's shortfall against the whole pile, summed: 20 + 0 + 0 — too little to build them all
    const old = v.rows.filter((r) => r.state === 'open').reduce((n, r) => n + r.needs.filter((x) => x.type === LOG).reduce((m, x) => m + Math.max(0, x.count - Math.min(x.count, x.stock)), 0), 0)
    expect(old).toBe(20)
    expect(v.lacking(LOG)).not.toBe(old)
    // nothing done or locked is asked for; a pile that covers everything leaves nothing lacking
    expect(stockView(UPGRADES, { ...facts, [`haven.stock.${LOG}`]: 60 }, keys).lacking(LOG)).toBe(0)
    expect(stockView(UPGRADES, { ...facts, 'haven.size': 3, [`haven.stock.${STONE}`]: 0 }, keys).lacking(STONE)).toBe(52)
  })

  it("reads the game's own widenings", () => {
    const v = stockView(HAVEN_UPGRADES, {}, keys)
    expect(v.size).toBe(0)
    expect(v.rows.length).toBe(HAVEN_UPGRADES.length)
    // a new ground: the first ring of the land is open, nothing in stock, so nothing can be built yet
    const first = v.rows.find((r) => r.u.track === 'land')!
    expect(first.state).toBe('open')
    expect(first.buildable).toBe(false)
    for (const n of first.needs) expect(v.lacking(n.type)).toBeGreaterThanOrEqual(n.count)
  })
})
