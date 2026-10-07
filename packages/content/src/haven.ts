// The Held Ground (誓守之地, docs/chapter-1.md §12): the White Knight's kingdom, kept in a single thorn. Felled, freed of
// the crown, Alberic keeps his vow another way — "I will hold until I am relieved": he gives the one who relieved him the
// Oath-Thorn, and holds for them a place they carry. Used on oneself it takes one there and back. It is the player's camp:
// build a home, farm, keep animals. At first a small field ringed in mist; Alberic, its steward, widens it for what is
// brought him (his errands below): each widening sets the story's `haven.size`, and the banks of mist of that ring lift
// by themselves (each looks now and then whether the ground has grown past it).

import type { QuestDef, Rule, Text } from '@lsw/engine'

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
    doc: 'The Oath-Thorn used on oneself: one steps into the Held Ground (or, in it, back out where one stood) — told so, one goes oneself.',
    host: { type: 'item/relic/oath_thorn' },
    on: 'act/use',
    tree: { if: { same: ['actor', 'target'] }, then: { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'pocket', map: HAVEN.map, x: HAVEN.arrive[0], y: HAVEN.arrive[1] } }], label: L('Enter / leave the Held Ground', '进入 / 离开誓守之地') }, else: 'inherit' },
  }),
  story({
    id: 'haven/mist-lifts',
    doc: 'A bank of mist at the Held Ground\'s edge looks now and then (its period) whether the ground has grown past it: when the story\'s haven.size reaches its ring, it lifts.',
    host: { type: 'fixture/nature/mist' },
    on: 'time/period',
    tree: { if: { prop: { role: 'story', key: 'haven.size', bounds: { gte: { prop: 'ring', of: 'host' } }, default: 0 } }, then: { do: [{ op: 'vfx', fx: 'poof' }, { op: 'destroy' }] }, else: { do: [] } },
  }),
]

/** One widening: what Alberic asks for it, and the Held Ground's size after. */
const widen = (n: 1 | 2 | 3, needs: [string, number, Text][], offer: Text, done: Text): QuestDef => ({
  id: `haven${n}`,
  kind: 'side',
  title: L(`Widen the Held Ground ${'I'.repeat(n)}`, `扩建誓守之地 ${'I'.repeat(n)}`),
  summary: L('Alberic, steward of the Held Ground, can push the mist back further — with what it takes to hold more ground.', '誓守之地的管家阿尔贝里克可以把迷雾再推远一些——只要有守住更多土地所需的东西。'),
  giver: 'npc.alberic',
  requires: n === 1 ? { facts: { 'haven.met': { ne: 0 } } } : { quests: [`haven${n - 1}`] },
  offer,
  waiting: L('Bring what I asked, and I will hold more ground for you.', '把我要的东西带来，我就为你守住更多的土地。'),
  done,
  goals: needs.map(([type, count, label], i) => ({ id: `n${i}`, kind: 'carry' as const, type, count, consume: true, label })),
  reward: { xp: 30 * n, facts: { 'haven.size': n } },
})

export const HAVEN_QUESTS: QuestDef[] = [
  widen(1, [['item/material/log', 10, L('Logs', '原木')], ['item/material/stone', 10, L('Stones', '石头')]],
    L('The ground holds as far as I can hold it. Bring me ten logs and ten stones, and I will set a fence of them in the mist — and the mist will keep behind it.', '这片土地，我能守多远就有多远。给我十根原木、十块石头，我把它们在迷雾里立成一道篱笆——迷雾就会退到篱笆后面。'),
    L('There. Do you see how far it goes now? A knight is only as wide as what he holds.', '好了。看见它现在延伸到多远了吗？一个骑士的分量，就是他守住的那片土地。')),
  widen(2, [['item/material/plank', 20, L('Planks', '木板')], ['item/material/iron_ore', 5, L('Iron ore', '铁矿石')]],
    L('Twenty planks and five iron ore. Iron for the posts, planks for the walls — a hall needs room round it.', '二十块木板、五块铁矿石。铁做桩，木板做墙——一座厅堂周围要留出地方。'),
    L('More ground. I remember fields like this, once. Whose they were, I do not.', '又多了一片地。我记得从前也有过这样的田野。是谁的，我想不起来了。')),
  widen(3, [['item/material/plank', 30, L('Planks', '木板')], ['item/material/stone', 30, L('Stones', '石头')], ['item/material/gold_ore', 3, L('Gold ore', '金矿石')]],
    L('The last of it: thirty planks, thirty stones, three gold. Gold for the boundary stones — they are what a kingdom is.', '最后一次了：三十块木板、三十块石头、三块金矿石。金子用来做界石——一个王国就是由界石圈出来的。'),
    L('That is all the ground there is. ...It is more than I held before. And nobody kneels here.', '这就是全部的土地了。……比我从前守的还要多。而且在这里，没有人下跪。')),
]
