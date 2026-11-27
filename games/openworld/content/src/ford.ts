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
import { CH3_RULES } from './chapter3.ts'
import { CH4_RULES } from './chapter4.ts'
import { CH5_RULES } from './chapter5.ts'
import { FIN_RULES } from './finale.ts'

const L = (en: string, zh: string): Text => ({ en, zh })


/**
 * The ferrykeeper's camp at the Ford as it is drawn (the camp pack, tools/src/art/ferry-camp.py; the client's catalogue
 * draws each of these with its piece of the pack while it stands on its cell): every thing of the camp the pack pictures,
 * its id and cell, each named as its piece is (the lantern by the pond is drawn with the lantern post's). The camp stands
 * round its fire: the tent to the west with her lantern post, potted flowers and chest; the bench, the small table and
 * the stool round the fire under its rack; to the east the stall where she keeps what mends the crossing, under its
 * awning, with its barrel, flowers, crate, planks and rope, and the block she splits wood on, her old axe still in it.
 * Three of the pack's groups are drawn whole by their things together: each thing of a group stands where the group's
 * picture has it, counted from its first (the tent's, the fire's, the stall's), as client/src/ferry-camp.json says.
 * The plain ids are the map's own, as it gives them (a test holds each to its thing).
 */
export const FORD_CAMP = {
  map: 'ford',
  tent: { id: 'ford.tent', x: 10, y: 14 },
  lantern: { id: 'ford.camp.lantern', x: 8, y: 14 },
  chest: { id: 'ford.chest', x: 12, y: 14 },
  planter: { id: 'ford.camp.planter', x: 9, y: 15 },
  fire: { id: 'ford.campfire', x: 14, y: 16 },
  rack: { id: 'ford~g', x: 14, y: 15 },
  seat: { id: 'ford.camp.seat', x: 16, y: 16 },
  bench: { id: 'ford~f', x: 14, y: 18 },
  table: { id: 'ford.camp.table', x: 11, y: 16 },
  stall: { id: 'ford.camp.stall', x: 20, y: 14 },
  pot: { id: 'ford.camp.pot', x: 18, y: 14 },
  barrel: { id: 'ford.camp.barrel', x: 19, y: 14 },
  crate: { id: 'ford.camp.crate', x: 21, y: 14 },
  planks: { id: 'ford.camp.planks', x: 21, y: 15 },
  rope: { id: 'ford.camp.rope', x: 22, y: 15 },
  block: { id: 'ford~i', x: 17, y: 17 },
  axe: { id: 'ford~ij', x: 17, y: 17 },
  logs: { id: 'ford~h', x: 7, y: 15 },
  crates: { id: 'ford.camp.crates', x: 7, y: 13 },
  sacks: { id: 'ford.camp.sacks', x: 18, y: 15 },
  sign: { id: 'ford.camp.sign', x: 15, y: 12 },
  pondLantern: { id: 'ford~l', x: 16, y: 21 },
} as const

/** Fact prefixes only the story's rules and scenes may change. */
export const PROTECTED_FACTS = ['ford.', 'mq.', 'seen.', 'sins.', 'game.', 'ch1.', 'ch2.', 'ch3.', 'ch4.', 'ch5.', 'fin.', 'night.', 'legend.', 'rescue.', 'village.', 'haven.', 'waypoints.', 'lesson.', 'step.', 'world.']

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
  story({
    id: 'ford/far-post',
    label: L('Pull the line at {target}', '拉{target}的渡绳'),
    doc: "The line's far end, a post on the far bank (a post's `ferry` prop: `far`). The ferry goes one way: she takes one over once, and a pull on the far post calls nobody back; before the line is mended it hangs slack.",
    host: { type: WINCH, notStatus: ['broken'] },
    on: 'impulse/handle',
    tree: {
      if: { all: [{ prop: { role: 'host', key: 'ferry', cmp: 'far', default: '' } }, { none: 'instrument' }] },
      then: {
        if: fact('ford.winch', 1),
        then: { do: [log('The line runs taut across the water. You pull on it a few times. Nothing stirs across the river.', '渡绳绷得紧紧的，横过水面。你拉了几下，河那边没有动静。')] },
        else: { do: [log('The line runs from the post into the water and hangs slack. It has parted somewhere across the river.', '渡绳从木桩上垂进水里，松松地漂着。是在河那边什么地方断的。')] },
      },
      else: 'inherit',
    },
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
            log('The dead tree creaks, leans, and comes down with a crash.', '枯树嘎吱作响，慢慢歪向一边，轰的一声倒了下去。'),
            { op: 'emit', impulse: 'receive', to: { line: { from: 'host', away: 'actor', length: 8, over: ['water'] } }, params: { what: 'trunk' } },
            notify('tree'),
            // what stands is its stump
            { op: 'transform', into: 'tile/stump' },
          ],
        },
        else: { do: [{ op: 'addProp', key: 'cuts', delta: 1 }, { op: 'vfx', fx: 'dust' }, log('The axe bites into the dead wood. The trunk creaks.', '斧头砍进枯木，树身嘎吱响了一声。')] },
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
          say("Bless you, friend. The wand on my cart, the blue one, it's yours. Point it right and frost comes off the tip.", '谢天谢地，朋友。我车上那根魔杖，蓝的那根，归你了。指准了，杖尖就会冒出寒气来。'),
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
      then: { do: [say("That one's yours now. Mind the cold, though. It gets into the hand that holds it.", '那根现在是你的了。不过小心点，那股寒气连握着它的手都会冻着。'), { op: 'emit', impulse: 'notify', to: 'target', params: { what: 'yours' } }] },
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
export const STORY_RULES: Rule[] = [...FORD_RULES, ...QUEST_RULES, ...BOSS_RULES, ...CH1_RULES, ...PILGRIMAGE_RULES, ...HAVEN_RULES, ...BOSS_ROOM_RULES, ...CH3_RULES, ...CH4_RULES, ...CH5_RULES, ...FIN_RULES]

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
      sayAs("That was my last good rope. ...No, wait. There's the old one off the raft. It's frayed, but it'll splice.", '那是我最后一根好绳子。……不对，筏子上还拆下来一根旧的。磨毛了，接一接还能用。'),
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
    fallback: [sayAs("The water's going down. Come on, I'll pole you over on the raft myself, line or no line.", '水退下去了。来吧，有没有渡绳都一样，我自己撑筏子送你过去。'), RIVER_CROSSED],
  },
]
