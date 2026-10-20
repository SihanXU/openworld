// A new thing in a game (the editor's AI plan, M1): it can be had, it is good for something, its numbers sit among its
// kind's. Checked on the starter, whose things are had from a chest, a tree's rule and a slime's loot.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Patch, TypeDef } from '@openworld/engine'
import { checkThings, compile, obtainable } from '../src/index.ts'
import { readProject } from '../src/node.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)
const draft = (...types: TypeDef[]): Patch => ({ artifacts: types.map((type) => ({ kind: 'type' as const, type })) })
const stoneAxe: TypeDef = { id: 'item/tool/stone_axe', name: { en: 'Stone Axe', zh: '石斧' }, tags: ['tool:axe', 'portable'], props: { power: 2 }, makeup: [{ type: 'item/material/stone', count: 1 }, { type: 'item/material/log', count: 1 }], station: 'hands' }

describe.skipIf(!here)('a new thing', () => {
  it('is had the ways a player has things: from a chest, from what a rule makes, from loot, and by a recipe of those', () => {
    const c = compile(readProject(STARTER))
    const have = obtainable(c, [stoneAxe])
    expect(have.get('item/tool/axe')).toMatch(/on the map glade/)
    expect(have.get('item/material/gel')).toMatch(/on the map glade/)
    expect(have.get('item/material/log')).toMatch(/rule|map/)
    expect(have.get('item/tool/stone_axe')).toBe('made by hand from 1 item/material/stone + 1 item/material/log')
  })

  it('is had by the game\'s own recipes too (its crafting table, where a shop\'s wares are recipes at a stall)', () => {
    const c = compile(readProject(STARTER))
    const ore: TypeDef = { id: 'item/material/iron_ore', name: { en: 'Iron Ore', zh: '铁矿' }, tags: ['ore'], props: {} }
    expect(obtainable(c, [ore]).has(ore.id)).toBe(false)
    c.bundle.client = { ...c.bundle.client, crafting: { recipes: [{ id: 'dig-ore', name: { en: 'Iron Ore', zh: '铁矿' }, sprite: 'item:ore', needs: [{ type: 'item/material/stone', count: 3 }], make: { type: ore.id }, station: 'hands' }] } }
    expect(obtainable(c, [ore]).get(ore.id)).toBe('made by hand from 3 item/material/stone')
  })

  it('is had as a quest\'s reward', () => {
    const c = compile(readProject(STARTER))
    const ore: TypeDef = { id: 'item/material/iron_ore', name: { en: 'Iron Ore', zh: '铁矿' }, tags: ['ore'], props: {} }
    const q = c.index.quests!.find((x) => x.id === 'firewood')!
    q.stages.find((st) => st.reward)!.reward!.items!.push({ type: ore.id, count: 1 })
    expect(obtainable(c, [ore]).get(ore.id)).toBe('a reward of the quest firewood')
  })

  it('a thing made of what cannot be had cannot be had, and the check says which part', () => {
    const c = compile(readProject(STARTER))
    const ore: TypeDef = { id: 'item/material/iron_ore', name: { en: 'Iron Ore', zh: '铁矿' }, tags: ['ore'], props: {} }
    const pick: TypeDef = { id: 'item/tool/iron_pick', name: { en: 'Iron Pick', zh: '铁镐' }, tags: ['tool:pick'], props: { power: 3 }, makeup: [{ type: 'item/material/iron_ore', count: 2 }], station: 'hands' }
    const [o, p] = checkThings(c, draft(ore, pick))
    expect(o.checks.find((x) => x.id === 'obtainable')).toMatchObject({ ok: false, detail: ['no recipe makes it, no rule makes it, and no map holds it'] })
    expect(p.checks.find((x) => x.id === 'obtainable')).toMatchObject({ ok: false, detail: ['its part item/material/iron_ore cannot be had'] })
  })

  it('holds as a whole: valid, had, good for something, its numbers among its kind\'s; one far past them is said', () => {
    const c = compile(readProject(STARTER))
    const [r] = checkThings(c, draft(stoneAxe))
    expect(r.checks.map((x) => [x.id, x.ok, x.ok ? '' : x.detail.join('; ')])).toEqual([['valid', true, ''], ['obtainable', true, ''], ['useful', true, ''], ['numbers', true, '']])
    expect(r.acts.checked).toBeGreaterThan(r.acts.holes)
    const [big] = checkThings(c, draft({ ...stoneAxe, props: { ...stoneAxe.props, power: 30 } }))
    expect(big.checks.find((x) => x.id === 'numbers')).toMatchObject({ ok: false, detail: ['power 30 (its kind: 3–3): far outside'] })
  })
})
