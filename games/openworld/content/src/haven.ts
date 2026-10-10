// The Held Ground (誓守之地, docs/chapter-1.md §12): the White Knight's kingdom, kept in a single thorn. Felled, freed of
// the crown, Alberic keeps his vow another way — "I will hold until I am relieved": he gives the one who relieved him the
// Oath-Thorn, and holds for them a place they carry. Used on oneself it takes one there and back. It is the player's camp:
// build a home, farm, keep animals. At first a small field ringed in mist; Alberic, its steward, widens it for what is
// brought him (his errands, quests/side.ts): each widening sets the story's `haven.size`, and the banks of mist of that ring lift
// by themselves (each looks now and then whether the ground has grown past it).

import type { Rule, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The Held Ground's map and its places. */
export const HAVEN = {
  map: 'haven',
  w: 48,
  h: 40,
  /** the planted sword at its heart, and where one arrives (just below it) */
  heart: [24, 19] as const,
  arrive: [24, 22] as const,
  /** the rings of mist round the heart (cells from it): the first widening lifts the first, and so on */
  rings: [8.5, 12.5, 16.5] as const,
} as const

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

export const HAVEN_RULES: Rule[] = [
  story({
    id: 'haven/oath-thorn',
    label: L('Enter the Held Ground', '进入誓守之地'),
    doc: 'The Oath-Thorn used on oneself: one steps into the Held Ground (or, in it, back out where one stood) — told so, one goes oneself. Not in the middle of a fight: the thorn does not open while something is after one, nor take the fight in with one.',
    host: { type: 'item/relic/oath_thorn' },
    on: 'act/use',
    tree: {
      if: { same: ['actor', 'target'] },
      then: {
        if: { fighting: 'actor' },
        then: { do: [{ op: 'say', text: L('Not now — not with a fight on me.', '现在不行——还在战斗中。'), who: 'actor' }], label: L('Enter / leave the Held Ground', '进入 / 离开誓守之地') },
        else: { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'pocket', map: HAVEN.map, x: HAVEN.arrive[0], y: HAVEN.arrive[1] } }], label: L('Enter / leave the Held Ground', '进入 / 离开誓守之地') },
      },
      else: 'inherit',
    },
  }),
  story({
    id: 'haven/mist-lifts',
    doc: 'A bank of mist at the Held Ground\'s edge looks now and then (its period) whether the ground has grown past it: when the story\'s haven.size reaches its ring, it lifts.',
    host: { type: 'fixture/nature/mist' },
    on: 'time/period',
    tree: { if: { prop: { role: 'story', key: 'haven.size', bounds: { gte: { prop: 'ring', of: 'host' } }, default: 0 } }, then: { do: [{ op: 'vfx', fx: 'poof' }, { op: 'destroy' }] }, else: { do: [] } },
  }),
]
