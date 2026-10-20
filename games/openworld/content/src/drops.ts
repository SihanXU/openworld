// What the minor monsters leave (docs/creatures.md §7): each hostile kind is made of something, so a felling breaks it
// down into it (the base rule combat/defeat: `breakdown`, its makeup × the world's recovery rate, lying still to be taken
// with F). Most of it is what the world already has (hides, meat, bone, stone, coal); three things only monsters give:
// a slime's gel, a spider's venom sac and a spectre's ectoplasm. What each is for: the venom sac makes the antidote, which
// clears a spider's poison; all three sell at one's stall.

import type { Recipe, Rule, Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

export const GEL = 'item/material/slime_gel'
export const VENOM = 'item/material/venom_sac'
export const ECTO = 'item/material/ectoplasm'

const M = {
  leather: 'item/material/leather',
  meat: 'item/food/meat/raw',
  fish: 'item/food/fish/raw',
  bone: 'item/material/bone',
  cloth: 'item/material/cloth',
  stone: 'item/material/stone',
  ore: 'item/material/iron_ore',
  coal: 'item/material/coal',
  fireweed: 'item/material/fireweed',
  frostcap: 'item/material/frostcap',
  fertilizer: 'item/material/fertilizer',
}

const of = (...parts: [string, number][]) => parts.map(([type, count]) => ({ type, count }))
const C = 'actor/creature'

/**
 * Each kind's makeup, by type (counts before the recovery rate: half of each comes back, at least one). A kind not named
 * here takes its parent's (a type's makeup is inherited).
 */
export const CREATURE_DROPS: Record<string, { type: string; count: number }[]> = {
  // gel from every slime; the Slime King a heap of it
  [`${C}/slime`]: of([GEL, 2]),
  [`${C}/slime/king_slime`]: of([GEL, 8]),
  // the beasts: hides and meat; a bat its droppings (guano: the farm's fertilizer)
  [`${C}/beast/wolf`]: of([M.leather, 2], [M.meat, 2]),
  [`${C}/beast/frost_wolf`]: of([M.leather, 2], [M.meat, 2]),
  [`${C}/beast/boar`]: of([M.meat, 4], [M.leather, 2]),
  [`${C}/beast/bat`]: of([M.fertilizer, 2]),
  // the dead: bones and rags; a spectre what it is made of
  [`${C}/undead/zombie`]: of([M.bone, 2], [M.cloth, 2]),
  [`${C}/undead/skeleton`]: of([M.bone, 4]),
  [`${C}/undead/ghost`]: of([ECTO, 2]),
  [`${C}/undead/warden`]: of([M.bone, 6], [M.ore, 4]),
  // the night's things: stone and ore, frost, fire, the stuff of a spectre
  [`${C}/golem/stone_golem`]: of([M.stone, 6], [M.ore, 2]),
  [`${C}/golem/ice_golem`]: of([M.stone, 4], [M.frostcap, 2]),
  [`${C}/imp/fire_imp`]: of([M.coal, 2], [M.fireweed, 2]),
  [`${C}/wisp/storm_wisp`]: of([ECTO, 2]),
  // the rest
  [`${C}/spider`]: of([VENOM, 2]),
  [`${C}/fungus/sporecap`]: of(['item/material/herb', 2]),
  [`${C}/whelp`]: of([M.leather, 2], [M.coal, 2]),
  [`${C}/crab`]: of([M.fish, 4]),
  [`${C}/cyclops`]: of([M.leather, 6], [M.meat, 6]),
}

const formName = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : type
}

/** What one's stall pays for what only monsters give (Recipe `group: 'sell'`, as the homestead's own goods). */
const sell = (type: string, price: number): Recipe => ({
  id: `shop/sell/${type.split('/').slice(1).join('-')}`, group: 'sell', name: formName(type), sprite: FORM_BY_ID[type]?.sprite ?? 'item:bag',
  needs: [{ type, count: 1 }], make: { type: 'item/misc/thornmark' }, station: 'stall', count: price,
})

export const DROP_SELLS: Recipe[] = [sell(GEL, 2), sell(VENOM, 4), sell(ECTO, 6)]

export const DROP_RULES: Rule[] = [
  rule({
    id: 'use/drink-antidote',
    doc: 'The antidote, drunk — by oneself, or by another it is given to: it clears poison and mends a little.',
    host: { type: 'item/potion/antidote' },
    on: 'act/use',
    tree: {
      if: { same: ['actor', 'target'] },
      // asked first and told after, as every drink is (use/drink, use/drink-fireproof)
      then: { label: L('Drink {instrument}', '喝掉{instrument}'), confirm: L('Drink {instrument}?', '要喝掉{instrument}吗？'), do: [{ op: 'emit', impulse: 'coat', to: 'actor', params: { substance: 'antidote' } }, { op: 'log', text: L('You drink {host}.', '你喝下了{host}。') }, { op: 'destroy' }] },
      else: {
        if: { is: { role: 'target', sel: { type: 'actor' } } },
        then: { label: L('Give {instrument} to {target} to drink', '给{target}喝{instrument}'), do: [{ op: 'emit', impulse: 'coat', to: 'target', params: { substance: 'antidote' } }, { op: 'log', text: L('You give {target} {host}.', '你给{target}喝下了{host}。') }, { op: 'destroy' }] },
        else: 'inherit',
      },
    },
  }),
  rule({
    id: 'body/antidote',
    doc: 'The antidote\'s coat: poison is gone, and the body mends 4.',
    host: { type: 'actor' },
    on: 'impulse/coat',
    tree: {
      if: { param: { key: 'substance', cmp: 'antidote' } },
      then: { do: [{ op: 'removeStatus', status: 'poisoned' }, { op: 'heal', amount: 4 }, { op: 'vfx', fx: 'heal' }] },
      else: 'inherit',
    },
  }),
]
