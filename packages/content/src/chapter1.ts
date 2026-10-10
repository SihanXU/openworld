// Chapter 1, the First Seal (docs/chapter-1.md, docs/lore.md): the story's facts and rules of the chapter. Its scenes (the night of the flame, the letter, the kingdom, the crown, the return) are in
// tools/src/demo/quest/chapter1.ts, where the maps are.
//
// Its quests are in quests/ (docs/quests.md): the main line's `rescue`, `vigil`, `first_seal`, `crown_home`, and
// the villagers' errands. The story's facts are `ch1.*`; `night.shift` is how much longer the night has grown
// (calendar.ts).

import type { Rule } from '@lsw/engine'

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

/** Pell's drawings: the chalk fixtures and the facts reading each sets. */
export const DRAWINGS = ['stone', 'door', 'bridge', 'man'] as const

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** Reading a chalk drawing tells the story which one (`drawing.<id>`), and the story keeps it. */
export const CH1_RULES: Rule[] = [
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
