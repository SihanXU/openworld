// Chapter 1, the First Seal (docs/chapter-1.md, docs/lore.md): the story's facts and rules of the chapter. Its scenes (the night of the flame, the letter, the kingdom, the crown, the return) are in
// tools/src/demo/quest/chapter1.ts, where the maps are.
//
// Its quests are in quests/ (docs/quests.md): the main line's `rescue`, `vigil`, `first_seal`, `crown_home`, and
// the villagers' errands. The story's facts are `ch1.*`; `night.shift` is how much longer the night has grown
// (calendar.ts).

import type { Cond, Rule } from '@openworld/engine'

export const WATCH_SHELTER = {
  map: 'summit',
  cloak: { id: 'summit~ij', hook: 'summit.cloak-hook', x: 9, y: 4, lookColor: 'forest' },
  chair: { id: 'summit~2', x: 12, y: 5 },
  barrel: { id: 'summit~3', x: 13, y: 7 },
  log: { id: 'summit.log', x: 12, y: 4 },
} as const

/** The story's facts of the chapter. */
export const CH1 = {
  flameStolen: 'ch1.flame_stolen',
  letter: 'ch1.letter',
  pilgrim: 'ch1.pilgrim',
  knight: 'sins.defeated.alberic',
  crown: 'ch1.crown',
  end: 'ch1.end',
} as const

/** The White Knight on the East Road (the campaign's body; the Boss Studio stages its own). */
export const ALBERIC_ID = 'eastroad.alberic'
/** The White Knight as Chapter 1 sets him: softer than in the Boss Studio and the challenge (bosses.ts), his skills' blows from his attack. */
export const ALBERIC_CAMPAIGN = { hp: 300, maxHp: 300, def: 1, atk: 10 }

/** Pell's drawings: the chalk fixtures and the facts reading each sets. */
export const DRAWINGS = ['stone', 'door', 'bridge', 'man'] as const

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

const cloak = { id: WATCH_SHELTER.cloak.id, type: 'item/clothing/cloak' }
const cloakHook = { id: WATCH_SHELTER.cloak.hook }
const emptyHook: Cond = { count: { role: 'host', in: 'contents', cmp: { eq: 0 } } }

/** Reading a chalk drawing tells the story which one (`drawing.<id>`), and the story keeps it. */
export const CH1_RULES: Rule[] = [
  story({
    id: 'ch1/hang-cloak',
    doc: 'The Cloudtop wall hooks hold one thing: the watchman\'s own cloak.',
    host: cloakHook,
    on: 'impulse/receive',
    tree: {
      if: { all: [{ is: { role: 'item', sel: cloak } }, emptyHook] },
      then: {
        label: { en: "Hang the watchman's cloak back up", zh: '把守夜人的斗篷挂回墙上' },
        do: [
          { op: 'emit', impulse: 'taken', to: 'item', other: 'host', params: { into: 'contents' } },
          { op: 'log', text: { en: 'You hang {item} back on its hooks.', zh: '你把{item}挂回了墙上。' } },
        ],
      },
      else: { do: [{ op: 'log', text: { en: 'The hooks are for the watchman’s cloak.', zh: '这排挂钩是用来挂守夜人的斗篷的。' } }] },
    },
  }),
  story({
    id: 'ch1/unhook-cloak',
    doc: 'Take the cloak from its hooks and wear it if the shoulders are free.',
    host: cloakHook,
    on: 'impulse/handle',
    tree: {
      if: { count: { role: 'host', in: 'contents', match: cloak, cmp: { gt: 0 } } },
      then: {
        if: { prop: { role: 'actor', key: 'wear:shoulders' } },
        then: {
          label: { en: "Take the watchman's cloak off the hooks", zh: '取下守夜人的斗篷' },
          do: [
            { op: 'emit', impulse: 'taken', to: { named: cloak.id }, other: 'actor', params: { into: 'hand', quiet: true } },
            { op: 'log', text: { en: 'You take the cloak off its hooks.', zh: '你从墙上取下了斗篷。' } },
          ],
        },
        else: {
          label: { en: "Take and put on the watchman's cloak", zh: '取下并披上守夜人的斗篷' },
          do: [
            { op: 'emit', impulse: 'taken', to: { named: cloak.id }, other: 'actor', params: { into: 'contents' } },
            { op: 'emit', impulse: 'notify', to: { named: cloak.id }, params: { what: 'unhooked-to-wear' } },
          ],
        },
      },
      else: { do: [{ op: 'log', text: { en: 'The hooks are empty.', zh: '挂钩上空空的。' } }] },
    },
  }),
  story({
    id: 'ch1/wear-unhooked-cloak',
    doc: 'The recovered cloak offers itself for the normal shoulder equipment action.',
    host: cloak,
    on: 'impulse/notify',
    tree: {
      if: { all: [
        { is: { role: 'source', sel: cloakHook } },
        { param: { key: 'what', cmp: 'unhooked-to-wear' } },
      ] },
      then: { do: [{ op: 'emit', impulse: 'offered', to: 'actor', item: 'host', params: { wear: true } }] },
      else: 'inherit',
    },
  }),
  ...DRAWINGS.map((d): Rule => story({
    id: `ch1/drawing-${d}`,
    doc: `Pell's drawing (${d}), read with a hand: what it shows, and the story hears it was found.`,
    host: { type: `fixture/chalk/${d}` },
    on: 'impulse/handle',
    tree: { do: [{ op: 'say', text: '@line' }, { op: 'emit', impulse: 'notify', to: 'story', params: { what: `drawing.${d}` } }] },
  })),
  story({
    id: 'ch1/story',
    doc: 'The story keeps which of Pell\'s drawings have been found.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: DRAWINGS.reduceRight<Rule['tree']>((rest, d) => ({ if: { param: { key: 'what', cmp: `drawing.${d}` } }, then: { do: [{ op: 'setProp', key: `ch1.drawing.${d}`, value: 1 }] }, else: rest }), 'inherit'),
  }),
]
