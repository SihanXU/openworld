// The Ford (docs/game-design.md): one crossing at the edge of the map, and one goal — the far
// bank. The goal is a state, not a path: the ending plays when the player stands on the far
// bank, however they got there. Three ways are taught by the place itself (ice on the river,
// the dead tree felled across it, the ferry mended and asked for); anything else the world
// learns that carries the player over counts the same. Story state is facts (`ford.*`) and the
// player's `quest` prop, changed only by these rules and the scenes; the world's own patches may
// not touch them (design.md §5.8).

import type { Effect, Invariant, Rule, Selector, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** Objective shown in the HUD for each value of the player's `quest` prop. */
export const OBJECTIVES: Record<number, { title: Text; hint: Text }> = {
  0: {
    title: L('Wake by the fire', '在火堆旁醒来'),
    hint: L('', ''),
  },
  1: {
    title: L('Get across the river', '过河去'),
    hint: L(
      'The ferry rope snapped in last night\'s storm. Look around the ford: E handles things, F takes, left click uses what you hold, right click puts it. Hold any of them to choose what on a tile.',
      '昨夜的风暴扯断了渡绳。在渡口四处看看：E 空手摆弄，F 拿取，左键用手里的东西，右键放下或交出。按住不放可以选这一格上的哪样东西。',
    ),
  },
  2: {
    title: L('The road east', '往东的路'),
    hint: L('You crossed. Past the ford the world is not written yet. What you taught it is in the Threadbook (J).', '你过了河。渡口以东，世界还没写成。你教会它的事都记在织线簿里（J）。'),
  },
}

/** Fact prefixes only the story's rules and scenes may change. */
export const PROTECTED_FACTS = ['ford.', 'seen.', 'invalid.']

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: { en, zh } })
const say = (who: 'actor' | 'target', en: string, zh: string): Effect => ({ op: 'say', who, text: { en, zh } })
const fact = (key: string, value: number): Effect => ({ op: 'setFact', key, value })
const EMPTY: Selector = { none: true }
const ROPE = 'item/tool/rope'
const WINCH = 'fixture/ferry/winch'
const DEAD_TREE = 'fixture/nature/dead_tree'
const WAND = 'item/weapon/magic/wand'

export const STORY_RULES: Rule[] = [
  // ---------------------------------------------------------------- the ferry
  story({
    id: 'ford/winch-look',
    doc: 'The snapped ferry rope says what it needs.',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: WINCH, status: ['broken'] }, instrument: EMPTY },
    do: [log('The ferry rope snapped at the drum; the frayed end trails in the water. A good length of rope would mend it.', '渡绳在绞盘上断了，磨烂的一头拖在水里。有一段结实的绳子就能接上。')],
  }),
  story({
    id: 'ford/mend-winch',
    doc: 'Rope on the broken winch mends the ferry line.',
    on: 'interaction',
    when: { verb: ['put', 'interact'], target: { type: WINCH, status: ['broken'] }, instrument: { type: ROPE } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'broken' },
      { op: 'destroy', of: 'instrument' },
      fact('ford.winch', 1),
      { op: 'topic', id: 'winch_mended', days: 6 },
      { op: 'vfx', at: 'target', fx: 'sparkle' },
      log('You splice the rope onto the drum. The line runs taut across the water again.', '你把绳子接在绞盘上。渡绳又绷直了，横过水面。'),
    ],
  }),
  story({
    id: 'ford/ask-crossing',
    doc: 'With the line mended, the ferrykeeper takes you across.',
    on: 'interaction',
    priority: 1,
    when: { verb: ['interact'], actor: { type: 'actor/person' }, target: { type: 'actor/person/ferrykeeper' }, instrument: EMPTY },
    guard: { all: [{ fact: { key: 'ford.winch', cmp: 1 } }, { fact: { key: 'ford.crossed', cmp: 0 } }] },
    do: [{ op: 'scene', id: 'ferry' }],
  }),
  // ---------------------------------------------------------------- the dead tree
  story({
    id: 'ford/chop-dead-tree',
    doc: 'An axe bites into the dead tree at the narrows (it takes three blows).',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: DEAD_TREE, notStatus: ['burning'] }, instrument: { tags: ['tool:axe'] } },
    guard: { prop: { role: 'target', key: 'cuts', cmp: { lt: 2 } } },
    do: [{ op: 'addProp', of: 'target', key: 'cuts', delta: 1 }, { op: 'vfx', at: 'target', fx: 'dust' }, log('The axe bites into the dead wood. It creaks.', '斧头砍进了枯木。它嘎吱作响。')],
  }),
  story({
    id: 'ford/fell-dead-tree',
    doc: 'The third blow fells the dead tree away from the axe — across the river, if the river lies that way.',
    on: 'interaction',
    priority: 1,
    when: { verb: ['interact'], target: { type: DEAD_TREE, notStatus: ['burning'] }, instrument: { tags: ['tool:axe'] } },
    guard: { prop: { role: 'target', key: 'cuts', cmp: { gte: 2 } } },
    do: [
      { op: 'vfx', at: 'target', fx: 'dust' },
      log('The dead tree groans, leans… and falls with a crash.', '枯树呻吟着，倾斜……轰然倒下。'),
      { op: 'layLine', from: 'target', away: 'actor', terrain: 'bridge', length: 8, over: ['water'] },
      { op: 'setTerrain', of: 'tileOf:target', terrain: 'stump' },
      { op: 'destroy', of: 'target' },
      fact('ford.tree', 1),
      { op: 'topic', id: 'tree_felled', days: 6 },
    ],
  }),
  // ---------------------------------------------------------------- the peddler
  story({
    id: 'ford/feed-peddler',
    doc: 'The hungry peddler trades his frost wand for a meal.',
    on: 'interaction',
    when: { verb: ['put'], actor: { type: 'actor/person' }, target: { type: 'actor/person/peddler' }, instrument: { tags: ['edible'] } },
    guard: { fact: { key: 'ford.charm', cmp: 0 } },
    do: [
      { op: 'give', to: 'target', item: 'instrument' },
      fact('ford.charm', 1),
      say('target', 'Bless you. The wand on my cart — the blue one — it is yours. Frost from the tip, if you point it right.', '谢天谢地。我车上那根魔杖——蓝的那根——归你了。指准了，杖尖会冒寒气。'),
      { op: 'emote', who: 'target', mood: 'happy' },
    ],
  }),
  story({
    id: 'ford/wand-is-yours',
    doc: 'Once traded, the peddler does not mind the wand being taken.',
    on: 'witness',
    when: { about: ['take:owner'], actor: { type: 'actor/person/peddler' }, instrument: { type: WAND } },
    guard: { fact: { key: 'ford.charm', cmp: 1 } },
    do: [say('actor', 'That one is yours now. Mind the cold: it bites the hand that holds it.', '那根现在是你的了。小心寒气，它咬拿着它的手。')],
  }),
]

const RIVER_CROSSED: Effect = { op: 'scene', id: 'ferry' }

/**
 * Content the world must keep playable. If fire takes the rope she asked for, or every way
 * across is gone, the world raises `invalid` for the modder; with no answer, the fallback keeps
 * the Ford winnable.
 */
export const INVARIANTS: Invariant[] = [
  {
    id: 'ford.rope',
    giver: 'npc.hesper',
    text: L(
      "Hesper's ferry is mended with a rope: while the winch is broken, a rope must exist somewhere at the ford.",
      '赫斯珀的渡船要靠一根绳子来修：绞盘没修好之前，渡口总得有一根绳子。',
    ),
    when: { exists: { type: WINCH, status: ['broken'] } },
    holds: { exists: { type: ROPE } },
    fallback: [
      { op: 'spawn', type: ROPE, at: 'tileOf:actor' },
      say('actor', 'That was my last good rope. … No — there is the old one off the raft. Frayed, but it will splice.', '那是我最后一根好绳子。……不对——筏子上还拆下来一根旧的。磨毛了，但还能接。'),
    ],
  },
  {
    id: 'ford.crossing',
    giver: 'npc.hesper',
    text: L(
      'There must always be some way across the river: rope for the ferry, the dead tree to fell, or frost to freeze the water.',
      '过河总得有条路：修渡船的绳子、能砍倒的枯树，或者能冻住河水的寒气。',
    ),
    when: { fact: { key: 'ford.crossed', cmp: 0 } },
    holds: {
      any: [
        { exists: { type: ROPE } },
        { exists: { type: DEAD_TREE } },
        { exists: { type: WAND, tags: ['element:ice'] } },
        { fact: { key: 'ford.winch', cmp: 1 } },
        { fact: { key: 'ford.tree', cmp: 1 } },
      ],
    },
    fallback: [say('actor', 'The water is dropping. Come, I will take you over on the raft myself, line or no line.', '水在退了。来，不管有没有渡绳，我亲自撑筏送你过去。'), RIVER_CROSSED],
  },
]
