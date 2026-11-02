// The finale (docs/finale.md, docs/lore.md §10, §11, §14–§17): the story's facts and things of the main line's end. The road
// comes down from the Heights into the Holy City: the close of the Most Holy Hall, its avenue of the five bearers' statues;
// the nave, where the Primate tells the pilgrim the truth and is not believed, and opens the floor; the Confluence below,
// where the channels of the five lands run into one and Severin waits; and the Holiest, where Astra lies on his bier. The
// maps, people and scenes are the demo's (tools/src/demo/quest/finale.ts); the boss is bosses.ts, the room bossrooms.ts.
//
// Its quest is quests/main.ts `great_rite`. The story's facts are `fin.*`; once the Five are taken up the night's shift is
// nought again (the sun rises whole) and the way up out of the Holiest is the Night's (`fin.way` back to nought).

import type { Rule, TypeDef } from '@openworld/engine'
import { DO } from './afflictions.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** The story's facts of the finale, in the order they come. */
export const FIN = {
  /** Into the close of the Most Holy Hall (the scene `holy_arrival`). */
  road: 'fin.road',
  /** The Primate heard in the nave; the floor opened (the scene `primate`). */
  primate: 'fin.primate',
  /** The Confluence reached, Severin there (the scene `confluence`). */
  confluence: 'fin.confluence',
  /** The Rite: the five go to the body, and Astra opens his eyes (the scene `rite`). */
  rite: 'fin.rite',
  /** Astra down (his sin's own fact, bosses.ts). */
  astra: 'sins.defeated.astra',
  /** The Night out of him (the scene `the_night`). */
  night: 'fin.night',
  /** The Five taken up, at the bier (fin/bier rules). */
  five: 'fin.five',
  /** The ending played (the scene `dawn`). */
  end: 'fin.end',
  /** The way up out of the Holiest: open once one is in it (the Rite), the Night's once Astra is dead (`fin.way` 0). */
  way: 'fin.way',
} as const

/** Astra in the Holiest (the campaign's body; the Boss Studio stages its own). */
export const ASTRA_ID = 'holiest.astra'
/** Astra as the finale sets him: softer than in the Boss Studio and the challenge (bosses.ts), for a pilgrim of about level 20. */
export const ASTRA_CAMPAIGN = { hp: 1400, maxHp: 1400, def: 4, atk: 24 }

/** The five instruments (items.ts), as the finale names them. */
export const THE_FIVE = ['item/relic/crown_of_thorns', 'item/relic/post_chain', 'item/relic/scale_of_hunger', 'item/relic/holy_wood', 'item/weapon/polearm/spear/holy_lance'] as const

/** Astra's bier; the five niches of the Holiest; the channels of the four other lands (the March's is Chapter 2's); the bearers' statues; the Night left on the floor. */
export const BIER = 'fixture/sacred/bier'
export const INSTRUMENT_NICHE = 'fixture/sacred/instrument_niche'
export const CHANNELS = {
  dust: 'fixture/sacred/red_channel/dust',
  black: 'fixture/sacred/red_channel/black',
  white: 'fixture/sacred/red_channel/white',
  thorn: 'fixture/sacred/red_channel/thorn',
} as const
export const BEARER_STATUE = 'fixture/sacred/bearer_statue'
export const NIGHT_POOL = 'fixture/hazard/night_pool'

const channel = (id: string, sprite: string, en: string, zh: string, text: string, textZh: string): TypeDef => ({ id, name: L(en, zh), sprite, props: { text, text_zh: textZh } })

export const FIN_TYPES: TypeDef[] = [
  {
    id: BIER,
    name: L("Astra's bier", '阿斯特拉的灵柩台'),
    tags: ['holy', 'stone', 'readable'],
    solid: true,
    footprint: [3, 1],
    sprite: 'fixture:bier',
    props: { material: 'stone', text: 'A long bier of grey stone. Its top is worn hollow in the shape of a man who has lain on it for four hundred years. Five channels run into its foot.', text_zh: '一座灰石长台。台面被磨出一个人形的凹陷，那个人在上面躺了四百年。五道沟槽通到台脚。' },
  },
  {
    id: INSTRUMENT_NICHE,
    name: L('a niche of the Holiest', '至圣所的壁龛'),
    tags: ['holy', 'stone', 'readable'],
    solid: true,
    sprite: 'fixture:instrument_niche',
    props: { material: 'stone', text: 'An arched niche in gold-veined stone, empty, a hook in its back wall. One of five round the crypt, one for each instrument.', text_zh: '金纹石墙上一个拱形壁龛，空的，后壁上有一只钩子。墓室四周一共五个，一件圣器一个。' },
  },
  channel(CHANNELS.dust, 'fixture:channel_dust', 'grey channel', '灰色沟槽', 'A gutter cut in the floor, grey dust lying in it like water. It comes from the east.', '地上凿出的一道沟，灰土像水一样积在里面。它从东边来。'),
  channel(CHANNELS.black, 'fixture:channel_black', 'black channel', '黑色沟槽', 'A gutter cut in the floor, black water standing in it, very still. It comes from the south.', '地上凿出的一道沟，里面积着黑水，一动不动。它从南边来。'),
  channel(CHANNELS.white, 'fixture:channel_white', 'white channel', '白色沟槽', 'A gutter cut in the floor, something milk-white in it. It comes from the west.', '地上凿出的一道沟，里面有种乳白色的东西。它从西边来。'),
  channel(CHANNELS.thorn, 'fixture:channel_thorn', 'thorn-grown channel', '长满荆棘的沟槽', 'A gutter cut in the floor, grown over with dark thorns. It comes from the north-west, from the coast.', '地上凿出的一道沟，上面长满了黑色的荆棘。它从西北来，从海岸那边来。'),
  {
    id: BEARER_STATUE,
    name: L('a statue of a Seal-bearer', '持印者的雕像'),
    tags: ['stone', 'readable'],
    solid: true,
    sprite: 'fixture:bearer_statue',
    props: { material: 'stone', text: 'A tall statue of a hooded, armoured figure on a plinth, its face worn smooth. The plinth gives a seal, and under it: THEY CARRY IT FOR US.', text_zh: '一尊高大的雕像，戴兜帽、着铠甲，立在石座上，面孔已经磨平了。石座上刻着一道印，下面写着：他们替我们背负。' },
  },
  { id: NIGHT_POOL, name: L('the Night', '原夜'), tags: ['dark'], sprite: 'fixture:night_pool', stage: { lasts: 240 } },
]

/**
 * The bier, once the Night is out of Astra: a hand on it takes up the Five (docs/finale.md §2: the choice is an act; only
 * this ending is made). The Night on the floor burns what steps in it and goes in a while.
 */
export const FIN_RULES: Rule[] = [
  rule({
    id: 'fin/bier',
    doc: 'A hand on Astra\'s bier once the Night is out of him (`fin.night`) takes up the Five: the story hears it. Before, or after, the bier is only stone.',
    host: { type: BIER },
    on: 'impulse/handle',
    tree: {
      if: { all: [{ prop: { role: 'story', key: FIN.night, cmp: 1, default: 0 } }, { prop: { role: 'story', key: FIN.five, cmp: 0, default: 0 } }] },
      then: { label: L('Take up the Five', '继承五苦'), do: [{ op: 'emit', impulse: 'notify', to: 'story', params: { what: 'five' } }] },
      else: 'inherit',
    },
  }),
  rule({
    id: 'fin/story',
    doc: 'The story keeps that the Five are taken up (docs/finale.md §8).',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'five' } }, then: DO({ op: 'setProp', key: FIN.five, value: 1 }), else: 'inherit' },
  }),
  rule({
    id: 'fin/night-burns',
    doc: 'The Night that falls out of Astra\'s wounds burns whoever steps into it (a boss wades through its own).',
    host: { type: NIGHT_POOL },
    on: 'contact/begin',
    tree: {
      if: { all: [{ param: { key: 'how', cmp: 'under' } }, { is: { role: 'other', sel: { type: 'actor', notTags: ['boss'] } } }] },
      then: DO({ op: 'emit', impulse: 'strike', to: 'other', params: { power: 3, edge: 'magic' } }),
      else: 'inherit',
    },
  }),
  rule({
    id: 'fin/night-fades',
    doc: 'The Night on the floor goes back into the dark when its while is out.',
    host: { type: NIGHT_POOL },
    on: 'time/timer',
    tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx: 'smoke', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' },
  }),
]
