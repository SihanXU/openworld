// The action (E, the right click) held to its table (src/action.ts, design.md §5.2): which act it is for what the
// keys would do at the spot, what is in hand, and the inputs a lesson lets work.

import { describe, expect, it } from 'vitest'
import type { Frame, KeyView } from '@openworld/engine'
import { actionOf } from '../src/action.ts'

type Keys = NonNullable<Frame['keys']>
const v = (o: Partial<KeyView> = {}): KeyView => ({ label: { en: 'x' }, x: 1, y: 0, ...o })

describe('the action', () => {
  const rows: [string, Keys | undefined, string | undefined, readonly string[] | undefined, string | undefined][] = [
    // what it is aimed at, the keys there, what is held, a lesson's inputs, the act
    ['nothing to act on', undefined, undefined, undefined, undefined],
    ['someone: a word', { hands: v({ person: true }), put: v({ person: true }) }, undefined, undefined, 'hands'],
    ['someone, an axe in hand: still a word (handing over is G’s)', { hands: v({ person: true }), put: v({ person: true }) }, 'item/weapon/blade/axe', undefined, 'hands'],
    ['a chest: open it', { hands: v(), take: undefined }, undefined, undefined, 'hands'],
    ['a stone, its hands unknown: pick it up', { hands: v({ unknown: true }), take: v() }, undefined, undefined, 'take'],
    ['another’s loaf: never a theft (an experiment instead)', { hands: v({ unknown: true }), take: v({ steal: true }) }, undefined, undefined, 'hands'],
    ['the bare ground, nothing in hand: nothing', { hands: v({ ground: true }), use: v({ ground: true, unknown: true }) }, undefined, undefined, undefined],
    ['the open ground, a bed in hand: set it down', { hands: v({ ground: true }), put: v({ ground: true }) }, 'fixture/furniture/bed', undefined, 'put'],
    ['rock, a bed in hand: it cannot rest there, nothing', { hands: v({ ground: true }), use: v({ ground: true }) }, 'fixture/furniture/bed', undefined, undefined],
    ['a thing the hands could try, a bed in hand: the experiment, not the bed', { hands: v({ unknown: true }), put: v() }, 'fixture/furniture/bed', undefined, 'hands'],
    ['the open ground, bread in hand: eat it', { hands: v({ ground: true }), self: v() }, 'item/food/bread', undefined, 'self'],
    ['a carrot sprout (hands unknown), bread in hand: the experiment, not eating', { hands: v({ unknown: true }), self: v() }, 'item/food/bread', undefined, 'hands'],
    ['oneself, a feather in hand, its use unknown: the modder’s', { hands: v({ ground: true }), self: v({ unknown: true }) }, 'item/material/feather', undefined, 'self'],
    ['the tutorial’s meal (only move, select, self), no meal among the keys: nothing', { hands: v({ unknown: true }), take: v() }, 'item/food/berries', ['move', 'select', 'self'], undefined],
    ['the tutorial’s meal, with the meal among the keys', { hands: v({ unknown: true }), take: v(), self: v() }, 'item/food/berries', ['move', 'select', 'self'], 'self'],
    ['a lesson that only takes: the take, not the word', { hands: v({ unknown: true }), take: v() }, undefined, ['move', 'take'], 'take'],
  ]
  it.each(rows)('%s', (_, keys, held, allow, act) => {
    expect(actionOf(keys, held, allow)).toBe(act)
  })
})
