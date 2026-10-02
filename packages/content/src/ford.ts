// The Ford (docs/game-design.md): one crossing at the edge of the map, and one goal — the far
// bank. The goal is a state, not a path: the ending plays when the player stands on the far
// bank, however they got there. Three ways are taught by the place itself (ice on the river,
// the dead tree felled across it, the ferry mended and asked for); anything else the world
// learns that carries the player over counts the same. Story state is facts (`ford.*`) and the
// player's `quest` prop: the story's rules keep the facts (others notify it), and the world's own
// patches may not touch them (design.md §5.11).

import type { Cond, Effect, Invariant, RoleName, Rule, Selector, Text } from '@lsw/engine'

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
const say = (en: string, zh: string): Effect => ({ op: 'say', text: { en, zh } })
const notify = (what: string): Effect => ({ op: 'emit', impulse: 'notify', to: 'story', params: { what } })
const fact = (key: string, value: number): Cond => ({ fact: { key, cmp: value } })
const is = (role: RoleName, sel: Selector): Cond => ({ is: { role, sel } })
const what = (w: string): Cond => ({ param: { key: 'what', cmp: w } })
const ROPE = 'item/tool/rope'
const WINCH = 'fixture/ferry/winch'
const DEAD_TREE = 'fixture/nature/dead_tree'
const WAND = 'item/weapon/magic/wand'

export const STORY_RULES: Rule[] = [
  // ---------------------------------------------------------------- the ferry
  story({
    id: 'ford/winch-look',
    doc: 'The snapped ferry rope says what it needs.',
    host: { type: WINCH, status: ['broken'] },
    on: 'impulse/handle',
    tree: { if: { none: 'instrument' }, then: { do: [log('The ferry rope snapped at the drum; the frayed end trails in the water. A good length of rope would mend it.', '渡绳在绞盘上断了，磨烂的一头拖在水里。有一段结实的绳子就能接上。')] } },
  }),
  story({
    id: 'ford/mend-winch',
    doc: 'A rope given to the broken winch is spliced onto its drum: the ferry line runs again.',
    host: { type: WINCH, status: ['broken'] },
    on: 'impulse/receive',
    tree: {
      if: is('item', { type: ROPE }),
      then: {
        do: [
          { op: 'removeStatus', status: 'broken' },
          { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
          notify('winch'),
          { op: 'vfx', fx: 'sparkle' },
          log('You splice the rope onto the drum. The line runs taut across the water again.', '你把绳子接在绞盘上。渡绳又绷直了，横过水面。'),
        ],
      },
    },
  }),
  story({
    id: 'ford/ask-crossing',
    doc: 'With the line mended, the ferrykeeper takes you across.',
    host: { type: 'actor/person/ferrykeeper' },
    on: 'impulse/handle',
    tree: { if: { all: [fact('ford.winch', 1), fact('ford.crossed', 0), is('actor', { type: 'actor/person' }), { none: 'instrument' }] }, then: { do: [notify('ferry')] }, else: 'inherit' },
  }),
  // ---------------------------------------------------------------- the dead tree
  story({
    id: 'ford/chop-dead-tree',
    doc: 'An axe bites into the dead tree at the narrows; the third blow fells it away from the axe — across the river, if the river lies that way.',
    host: { type: DEAD_TREE, notStatus: ['burning'] },
    on: 'impulse/strike',
    tree: {
      if: { has: { role: 'instrument', tag: 'tool:axe' } },
      then: {
        if: { prop: { role: 'host', key: 'cuts', cmp: { gte: 2 } } },
        then: {
          do: [
            { op: 'vfx', fx: 'dust' },
            log('The dead tree groans, leans… and falls with a crash.', '枯树呻吟着，倾斜……轰然倒下。'),
            { op: 'emit', impulse: 'receive', to: { line: { from: 'host', away: 'actor', length: 8, over: ['water'] } }, params: { what: 'trunk' } },
            { op: 'emit', impulse: 'receive', to: 'tileOf:host', params: { what: 'stump' } },
            notify('tree'),
            { op: 'destroy' },
          ],
        },
        else: { do: [{ op: 'addProp', key: 'cuts', delta: 1 }, { op: 'vfx', fx: 'dust' }, log('The axe bites into the dead wood. It creaks.', '斧头砍进了枯木。它嘎吱作响。')] },
      },
    },
  }),
  // ---------------------------------------------------------------- the peddler
  story({
    id: 'ford/feed-peddler',
    doc: 'The hungry peddler trades his frost wand for a meal.',
    host: { type: 'actor/person/peddler' },
    on: 'impulse/offered',
    tree: {
      if: { all: [is('item', { tags: ['edible'] }), fact('ford.charm', 0), is('actor', { type: 'actor/person' })] },
      then: {
        do: [
          { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
          notify('charm'),
          say('Bless you. The wand on my cart — the blue one — it is yours. Frost from the tip, if you point it right.', '谢天谢地。我车上那根魔杖——蓝的那根——归你了。指准了，杖尖会冒寒气。'),
          { op: 'emote', mood: 'happy' },
        ],
      },
      else: 'inherit',
    },
  }),
  story({
    id: 'ford/wand-is-yours',
    doc: 'Once traded, the peddler does not mind the wand being taken.',
    host: { type: 'actor/person/peddler' },
    on: 'seen',
    tree: {
      if: { all: [{ param: { key: 'act', cmp: 'take' } }, { param: { key: 'owner', cmp: 'mine' } }, is('target', { type: WAND }), fact('ford.charm', 1)] },
      then: { do: [say('That one is yours now. Mind the cold: it bites the hand that holds it.', '那根现在是你的了。小心寒气，它咬拿着它的手。')] },
      else: 'inherit',
    },
  }),
  // ---------------------------------------------------------------- the story keeps its own facts
  story({
    id: 'ford/story',
    doc: 'The story hears what happened at the ford and keeps it: the line mended, the tree felled, the wand traded; asked for the crossing, it plays the ferry.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: {
      if: what('winch'),
      then: { do: [{ op: 'setFact', key: 'ford.winch', value: 1 }, { op: 'topic', id: 'winch_mended', days: 6 }] },
      else: {
        if: what('tree'),
        then: { do: [{ op: 'setFact', key: 'ford.tree', value: 1 }, { op: 'topic', id: 'tree_felled', days: 6 }] },
        else: {
          if: what('charm'),
          then: { do: [{ op: 'setFact', key: 'ford.charm', value: 1 }] },
          else: { if: { all: [what('ferry'), fact('ford.crossed', 0)] }, then: { do: [{ op: 'scene', id: 'ferry' }] }, else: 'inherit' },
        },
      },
    },
  }),
]

const RIVER_CROSSED: Effect = { op: 'scene', id: 'ferry' }
/** The story speaks through the person the content belongs to. */
const sayAs = (en: string, zh: string): Effect => ({ op: 'say', text: { en, zh }, who: 'target' })

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
      { op: 'spawn', type: ROPE, at: 'tileOf:target' },
      sayAs( 'That was my last good rope. … No — there is the old one off the raft. Frayed, but it will splice.', '那是我最后一根好绳子。……不对——筏子上还拆下来一根旧的。磨毛了，但还能接。'),
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
    fallback: [sayAs('The water is dropping. Come, I will take you over on the raft myself, line or no line.', '水在退了。来，不管有没有渡绳，我亲自撑筏送你过去。'), RIVER_CROSSED],
  },
]
