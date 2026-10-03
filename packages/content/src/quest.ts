// The main quest past the Ford (docs/main-quest.md): Emberfall, the old mine, fire and frost,
// Cinder Pass and the dragon. Its state is facts under `mq.` (protected like the Ford's: only
// these rules and the scenes change them) and the player's `quest` prop. Each stage's goal is a
// state; the rules here are the turn-ins and rewards the people of Emberfall make, and the
// dragon's phases.

import type { Effect, Rule, Selector, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** Objectives for the stages after the Ford's (the Ford's are 0–2, in ford.ts). */
export const QUEST_OBJECTIVES: Record<number, { title: Text; hint: Text; progress?: { fact: string; need: number; label: Text }[] }> = {
  3: {
    title: L('Emberfall', '余烬镇'),
    hint: L('Find Mara, the elder of Emberfall. She will know what burns the hills.', '找到余烬镇的长老玛拉。她会知道是什么在烧山。'),
  },
  4: {
    title: L('Arm for the dragon', '为屠龙做准备'),
    hint: L(
      'Garrick the smith will forge a blade for 5 iron ore and 3 coal — the old mine north of the village has the veins (a pickaxe breaks them; the richest lie past the cyclops). Wren the herbalist will brew a fireproof draught for 3 fireweed (the meadow) and 3 frostcap (the forest). Give them what they ask (right click), then talk to them (E).',
      '铁匠加里克要 5 块铁矿石和 3 块煤来锻一把剑——镇北的旧矿坑里有矿脉（用镐敲开）。草药师雷恩要 3 株火焰草（草原）和 3 朵霜盖菇（森林）来熬防火药剂。把东西交给他们（右键），再和他们说话（E）。',
    ),
    progress: [
      { fact: 'mq.ore', need: 5, label: L('Iron ore', '铁矿石') },
      { fact: 'mq.coal', need: 3, label: L('Coal', '煤') },
      { fact: 'mq.fireweed', need: 3, label: L('Fireweed', '火焰草') },
      { fact: 'mq.frostcap', need: 3, label: L('Frostcap', '霜盖菇') },
      { fact: 'mq.blade', need: 1, label: L('Dragonsbane', '屠龙剑') },
      { fact: 'mq.draught', need: 1, label: L('Fireproof draught', '防火药剂') },
    ],
  },
  5: {
    title: L('Cinder Pass', '烬岭山道'),
    hint: L('Climb the pass east of Emberfall to the dragon\'s lair. Drink the fireproof draught before you go in.', '翻过余烬镇东边的山道，去魔龙的巢穴。进去之前喝下防火药剂。'),
  },
  6: {
    title: L('The dragon of Cinder Peak', '烬峰魔龙'),
    hint: L('Defeat the dragon. Space strikes; keep out of its line of fire, and mind its whelps.', '打倒魔龙。空格键攻击；别站在它喷火的直线上，小心它的幼龙。'),
  },
  7: {
    title: L('The end', '终章'),
    hint: L('The dragon is dead. Emberfall can sleep. What you taught the world is in the Threadbook (J).', '魔龙死了，余烬镇可以安睡了。你教会这个世界的事都记在织线簿里（J）。'),
  },
}

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })
const say = (who: 'actor' | 'target', en: string, zh: string): Effect => ({ op: 'say', who, text: { en, zh } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: { en, zh } })
const add = (key: string): Effect => ({ op: 'addFact', key, delta: 1 })
const fact = (key: string, value: number): Effect => ({ op: 'setFact', key, value })
const EMPTY: Selector = { none: true }
const PLAYER: Selector = { type: 'actor/person' }

export const ELDER = 'actor/person/elder'
export const SMITH = 'actor/person/smith'
export const HERBALIST = 'actor/person/herbalist'
export const DRAGON = 'actor/creature/dragon'
export const BLADE = 'item/weapon/blade/dragonsbane'
export const DRAUGHT = 'item/potion/fire_resist'

/** What the smith and the herbalist ask for: the item, the fact that counts it, how many. */
export const ASKS = {
  ore: { type: 'item/material/iron_ore', fact: 'mq.ore', need: 5, of: SMITH },
  coal: { type: 'item/material/coal', fact: 'mq.coal', need: 3, of: SMITH },
  fireweed: { type: 'item/material/fireweed', fact: 'mq.fireweed', need: 3, of: HERBALIST },
  frostcap: { type: 'item/material/frostcap', fact: 'mq.frostcap', need: 3, of: HERBALIST },
} as const

/** A turn-in: the item put on the person counts toward what they asked, until it is enough. */
function turnIn(id: string, ask: (typeof ASKS)[keyof typeof ASKS], thanks: [string, string], enough: [string, string]): Rule[] {
  return [
    story({
      id: `mq/${id}`,
      doc: `${ask.of.split('/').pop()} takes ${ask.type.split('/').pop()} toward the ${ask.need} asked for.`,
      on: 'interaction',
      priority: 2,
      when: { verb: ['put'], actor: PLAYER, target: { type: ask.of }, instrument: { type: ask.type } },
      guard: { all: [{ fact: { key: 'mq.council', cmp: 1 } }, { fact: { key: ask.fact, cmp: { lt: ask.need } } }] },
      do: [{ op: 'destroy', of: 'instrument' }, add(ask.fact), say('target', ...thanks), { op: 'emote', who: 'target', mood: 'happy' }],
    }),
    story({
      id: `mq/${id}-enough`,
      doc: `${ask.of.split('/').pop()} has all the ${ask.type.split('/').pop()} asked for.`,
      on: 'interaction',
      priority: 1,
      when: { verb: ['put'], actor: PLAYER, target: { type: ask.of }, instrument: { type: ask.type } },
      guard: { fact: { key: ask.fact, cmp: { gte: ask.need } } },
      do: [say('target', ...enough)],
    }),
  ]
}

export const QUEST_RULES: Rule[] = [
  // ---------------------------------------------------------------- Emberfall: the elder's council
  story({
    id: 'mq/elder-council',
    doc: 'The elder tells of the dragon and what it will take (once).',
    on: 'interaction',
    priority: 2,
    when: { verb: ['interact'], actor: PLAYER, target: { type: ELDER }, instrument: EMPTY },
    guard: { fact: { key: 'mq.council', cmp: 0 } },
    do: [{ op: 'scene', id: 'council' }],
  }),
  // ---------------------------------------------------------------- the smith: three ore, two coal, a blade
  ...turnIn('smith-ore', ASKS.ore, ['Good iron. Five ore and three coal, and you will have your blade.', '好铁。五块矿石、三块煤，你的剑就有了。'], ['That is iron enough. Coal, now — if you have not brought it.', '铁够了。还差煤——如果你还没带来的话。']),
  ...turnIn('smith-coal', ASKS.coal, ['Coal for the forge. It will burn hot enough for dragon-steel.', '炉子用的煤。烧得够旺，能炼屠龙的钢。'], ['That is coal enough.', '煤够了。']),
  story({
    id: 'mq/smith-forge',
    doc: 'With five ore and three coal, the smith forges Dragonsbane.',
    on: 'interaction',
    priority: 3,
    when: { verb: ['interact'], actor: PLAYER, target: { type: SMITH }, instrument: EMPTY },
    guard: { all: [{ fact: { key: 'mq.ore', cmp: { gte: ASKS.ore.need } } }, { fact: { key: 'mq.coal', cmp: { gte: ASKS.coal.need } } }, { fact: { key: 'mq.blade', cmp: 0 } }] },
    do: [
      { op: 'spawn', type: BLADE, at: 'actor', into: 'contents' },
      fact('mq.blade', 1),
      { op: 'vfx', at: 'target', fx: 'sparkle' },
      say('target', 'There. Dragonsbane. Twelve generations of my family have waited to forge that one. Bring it back red.', '拿着。屠龙剑。我家十二代人都在等着锻这一把。带着它沾满龙血回来。'),
      log('Garrick hands you Dragonsbane.', '加里克把屠龙剑交到你手里。'),
    ],
  }),
  // ---------------------------------------------------------------- the herbalist: two fireweed, two frostcap, a draught
  ...turnIn('herbalist-fireweed', ASKS.fireweed, ['Fireweed — it drinks the heat. Three of these, and three frostcap.', '火焰草——它能吸走热气。要三株，再加三朵霜盖菇。'], ['Fireweed enough.', '火焰草够了。']),
  ...turnIn('herbalist-frostcap', ASKS.frostcap, ['Frostcap, from the cold side of the forest. Good.', '霜盖菇，长在森林背阴那边的。很好。'], ['Frostcap enough.', '霜盖菇够了。']),
  story({
    id: 'mq/herbalist-brew',
    doc: 'With three fireweed and three frostcap, the herbalist brews two fireproof draughts.',
    on: 'interaction',
    priority: 3,
    when: { verb: ['interact'], actor: PLAYER, target: { type: HERBALIST }, instrument: EMPTY },
    guard: { all: [{ fact: { key: 'mq.fireweed', cmp: { gte: ASKS.fireweed.need } } }, { fact: { key: 'mq.frostcap', cmp: { gte: ASKS.frostcap.need } } }, { fact: { key: 'mq.draught', cmp: 0 } }] },
    do: [
      { op: 'spawn', type: DRAUGHT, at: 'actor', into: 'contents', count: 2 },
      fact('mq.draught', 1),
      { op: 'vfx', at: 'target', fx: 'sparkle' },
      say('target', 'Two draughts. Drink one at the lair\'s mouth: for a few minutes the fire will barely warm you. The other is for when the first runs out.', '两瓶药剂。在巢穴门口喝一瓶：接下来几分钟，火只会让你觉得有点暖。另一瓶留着第一瓶失效时喝。'),
      log('Wren gives you two fireproof draughts.', '雷恩给了你两瓶防火药剂。'),
    ],
  }),
  // ---------------------------------------------------------------- the dragon
  story({
    id: 'mq/dragon-whelps',
    doc: 'Wounded again once below half, the dragon shrieks and its whelps pour out of the dark (once).',
    on: 'hit',
    compose: true,
    when: { target: { type: DRAGON } },
    guard: { all: [{ prop: { role: 'target', key: 'hp', cmp: { lt: 350 } } }, { fact: { key: 'mq.whelps', cmp: 0 } }] },
    do: [
      fact('mq.whelps', 1),
      { op: 'spawn', type: 'actor/creature/whelp', at: 'tileOf:target', count: 3 },
      { op: 'vfx', at: 'target', fx: 'fire_burst' },
      log('The dragon shrieks. Its whelps pour out of the dark!', '魔龙一声尖啸，幼龙从黑暗里涌了出来！'),
    ],
  }),
  story({
    id: 'mq/dragon-slain',
    doc: 'The dragon falls: the end of the main quest.',
    on: 'defeat',
    compose: true,
    when: { target: { type: DRAGON } },
    do: [fact('mq.dragon', 1), { op: 'scene', id: 'victory' }],
  }),
]
