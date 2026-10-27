// The Ford (docs/game-design.md), the main quest's first chapter (docs/main-quest.md): one
// crossing at the edge of the map, and one goal — the far bank. The goal is a state, not a path:
// the chapter ends when the player stands on the far bank, however they got there. The ways are
// taught by the place itself (the footbridge mended with three planks, ice on the river, the dead
// tree felled across it, the ferry mended and asked for); anything else the world learns that
// carries the player over counts the same. Story state is facts (`ford.*`), and the main line's quest
// (`first_seal`, docs/quests.md) answers them: the story's rules keep the facts (others notify it), and the world's own patches
// may not touch them (design.md §5.11).

import { PILGRIMAGE_RULES } from './pilgrimage.ts'
import type { Cond, Effect, Invariant, RoleName, Rule, Selector, Text } from '@openworld/engine'
import { QUEST_RULES } from './quest.ts'
import { BOSS_RULES } from './bosses.ts'
import { CH1_RULES } from './chapter1.ts'
import { HAVEN_RULES } from './haven.ts'
import { BOSS_ROOM_RULES } from './bossrooms.ts'

const L = (en: string, zh: string): Text => ({ en, zh })


/** Fact prefixes only the story's rules and scenes may change. */
export const PROTECTED_FACTS = ['ford.', 'mq.', 'seen.', 'sins.', 'game.', 'ch1.', 'night.', 'legend.', 'rescue.', 'village.', 'haven.', 'waypoints.', 'lesson.', 'step.', 'world.']

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: { en, zh } })
const say = (en: string, zh: string): Effect => ({ op: 'say', text: { en, zh } })
const notify = (what: string): Effect => ({ op: 'emit', impulse: 'notify', to: 'story', params: { what } })
const fact = (key: string, value: number): Cond => ({ prop: { role: 'story', key, cmp: value, default: 0 } })
const is = (role: RoleName, sel: Selector): Cond => ({ is: { role, sel } })
const what = (w: string): Cond => ({ param: { key: 'what', cmp: w } })
const ROPE = 'item/tool/rope'
const WINCH = 'fixture/ferry/winch'
const DEAD_TREE = 'fixture/nature/dead_tree'
const WAND = 'item/weapon/magic/wand'

const FORD_RULES: Rule[] = [
  // ---------------------------------------------------------------- the ferry
  story({
    id: 'ford/winch-look',
    label: L('Look at {target}', '查看{target}'),
    doc: 'The snapped ferry rope says what it needs.',
    host: { type: WINCH, status: ['broken'] },
    on: 'impulse/handle',
    tree: { if: { none: 'instrument' }, then: { do: [log('The ferry rope snapped at the drum; the frayed end trails in the water. A good length of rope would mend it.', '渡绳在绞盘上断了，磨烂的一头拖在水里。有一段结实的绳子就能接上。')] } },
  }),
  story({
    id: 'ford/mend-winch',
    label: L('Mend {target} with {instrument}', '用{instrument}修好{target}'),
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
    label: L('Ask {target} for the crossing', '请{target}送你过河'),
    doc: 'With the line mended, the ferrykeeper takes you across.',
    host: { type: 'actor/person/ferrykeeper' },
    on: 'impulse/handle',
    tree: { if: { all: [fact('ford.winch', 1), fact('ford.crossed', 0), is('actor', { type: 'actor/person' }), { none: 'instrument' }, { not: { param: { key: 'say', cmp: { ne: '' } } } }] }, then: { do: [notify('ferry')] }, else: 'inherit' },
  }),
  // ---------------------------------------------------------------- the dead tree
  story({
    id: 'ford/chop-dead-tree',
    label: L('Chop {target}', '砍{target}'),
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
            notify('tree'),
            // what stands is its stump
            { op: 'transform', into: 'tile/stump' },
          ],
        },
        else: { do: [{ op: 'addProp', key: 'cuts', delta: 1 }, { op: 'vfx', fx: 'dust' }, log('The axe bites into the dead wood. It creaks.', '斧头砍进了枯木。它嘎吱作响。')] },
      },
    },
  }),
  // ---------------------------------------------------------------- the peddler
  story({
    id: 'ford/feed-peddler',
    label: L('Give {instrument} to {target}', '把{instrument}送给{target}'),
    doc: 'The hungry peddler trades his frost wand for a meal.',
    host: { type: 'actor/person/peddler' },
    on: 'impulse/offered',
    tree: {
      if: { all: [is('item', { tags: ['edible'] }), fact('ford.charm', 0), is('actor', { type: 'actor/person' })] },
      then: {
        do: [
          { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
          notify('charm'),
          { op: 'emit', impulse: 'notify', to: { named: 'tobin.wand' }, params: { what: 'yours' } },
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
      then: { do: [say('That one is yours now. Mind the cold: it bites the hand that holds it.', '那根现在是你的了。小心寒气，它咬拿着它的手。'), { op: 'emit', impulse: 'notify', to: 'target', params: { what: 'yours' } }] },
      else: 'inherit',
    },
  }),
  story({
    id: 'ford/wand-given',
    doc: 'The wand the peddler gave away is no longer his: told so, it is nobody\'s (and so the one who holds it may keep it, and no one cries thief).',
    host: { type: WAND },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'yours' } }, then: { do: [{ op: 'setProp', key: 'owner', value: '' }] }, else: 'inherit' },
  }),
  // ---------------------------------------------------------------- the story keeps its own facts
  story({
    id: 'ford/story',
    doc: 'The story hears what happened at the ford and keeps it: the line mended, the tree felled, the wand traded; asked for the crossing, it plays the ferry.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: {
      if: what('winch'),
      then: { do: [{ op: 'setProp', key: 'ford.winch', value: 1 }, { op: 'topic', id: 'winch_mended', days: 6 }] },
      else: {
        if: what('tree'),
        then: { do: [{ op: 'setProp', key: 'ford.tree', value: 1 }, { op: 'topic', id: 'tree_felled', days: 6 }] },
        else: {
          if: what('charm'),
          then: { do: [{ op: 'setProp', key: 'ford.charm', value: 1 }] },
          else: { if: { all: [what('ferry'), fact('ford.crossed', 0)] }, then: { do: [{ op: 'scene', id: 'ferry' }] }, else: 'inherit' },
        },
      },
    },
  }),
]

/** The story's rules: the Ford's, then the main quest's (quest.ts). */
export const STORY_RULES: Rule[] = [...FORD_RULES, ...QUEST_RULES, ...BOSS_RULES, ...CH1_RULES, ...PILGRIMAGE_RULES, ...HAVEN_RULES, ...BOSS_ROOM_RULES]

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
    when: { prop: { role: 'story', key: 'ford.crossed', cmp: 0, default: 0 } },
    holds: {
      any: [
        { exists: { type: ROPE } },
        { exists: { type: DEAD_TREE } },
        { exists: { type: WAND, tags: ['element:ice'] } },
        { prop: { role: 'story', key: 'ford.winch', cmp: 1, default: 0 } },
        { prop: { role: 'story', key: 'ford.tree', cmp: 1, default: 0 } },
      ],
    },
    fallback: [sayAs('The water is dropping. Come, I will take you over on the raft myself, line or no line.', '水在退了。来，不管有没有渡绳，我亲自撑筏送你过去。'), RIVER_CROSSED],
  },
]
