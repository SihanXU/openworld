// Chapter 2, the Second Seal (docs/chapter-2.md, docs/lore.md §4, §6, §12): the story's facts and things of the chapter.
// Its first half is the Dragon Road (quest.ts, quests/main.ts `dragon_road`): Emberfall, the dragon of Cinder Peak, whose
// fall opens the way down off the pass into the Scarred March. Its second half is the March: the Red Host's camp, the
// Scourging House of the Red Order and its undercroft, the War-Giver's Bastion and the Pillar Yard, where Matthias, the
// Second Seal-bearer, stands chained to the broken Scourging Post. The maps, people and scenes are the demo's
// (tools/src/demo/quest/chapter2.ts); the boss is bosses.ts, his room bossrooms.ts, Lumi's second boon boons.ts.
//
// Its quests are in quests/ (docs/quests.md): the main line's `dragon_road`, `second_seal`, `march_quiet`, and the
// March's errands. The story's facts are `ch2.*`; `night.shift` 2 once Matthias falls (calendar.ts).

import type { TypeDef } from '@openworld/engine'

const L = (en: string, zh: string) => ({ en, zh })

/** The story's facts of the chapter, in the order they come. */
export const CH2 = {
  /** The dragon of Cinder Peak is dead: the way down off the pass into the March opens (quest.ts sets it). */
  dragon: 'mq.dragon',
  /** First down into the Scarred March (the scene `march_descent`). */
  march: 'ch2.march',
  /** Captain Brannoc has told the pilgrim where the Rider is (the camp's council). */
  camp: 'ch2.camp',
  /** The dusk's battle seen on the Lashmarks. */
  dusk: 'ch2.dusk',
  /** Prior Lucan of the Red Order spoken to. */
  house: 'ch2.house',
  /** The channels under the Scourging House seen, and Severin there. */
  channels: 'ch2.channels',
  /** Into the War-Giver's Bastion. */
  bastion: 'ch2.bastion',
  /** Matthias down (his sin's own fact, bosses.ts). */
  matthias: 'sins.defeated.matthias',
  /** The Chain of the Scourging Post given (the scene `chain`). */
  chain: 'ch2.chain',
  /** The quiet dusk at the camp: the chapter's end. */
  end: 'ch2.end',
} as const

/** Matthias in the Pillar Yard (the campaign's body; the Boss Studio stages its own). */
export const MATTHIAS_ID = 'pillaryard.matthias'
/** Matthias as Chapter 2 sets him: softer than in the Boss Studio and the challenge (bosses.ts), for a pilgrim of about level 9. */
export const MATTHIAS_CAMPAIGN = { hp: 640, maxHp: 640, def: 2, atk: 14 }

/** The second of the five instruments (items.ts), and what the March's people keep. */
export const POST_CHAIN = 'item/relic/post_chain'
export const WAR_DRUM = 'item/valuable/war_drum'
export const NOVICE_SCOURGE = 'item/valuable/novice_scourge'
export const LEFT_BANNER = 'item/valuable/left_banner'

/** The broken Scourging Post in the Pillar Yard; the Red Order's posts in their court; the channels under their hall. */
export const SCOURGING_POST = 'fixture/sacred/scourging_post'
export const WHIPPING_POST = 'fixture/sacred/whipping_post'
export const RED_CHANNEL = 'fixture/sacred/red_channel'
/** The Red Host's banner: a white pillar on red, the same for both its companies but for a row of stitches. */
export const RED_STANDARD = 'fixture/standard/red'

export const CH2_TYPES: TypeDef[] = [
  { id: RED_STANDARD, name: L('standard of the Red Host', '赤军军旗'), tags: ['readable'], sprite: 'fixture:red_standard' },
  {
    id: SCOURGING_POST,
    name: L('The Scourging Post', '鞭刑柱'),
    tags: ['holy', 'stone', 'readable'],
    solid: true,
    sprite: 'fixture:scourging_post',
    props: {
      material: 'stone',
      maxHp: 400,
      hp: 400,
      text: 'A pillar of grey stone as thick as a man, broken off at the height of his head. Two iron rings are set in it, worn bright on the inside. Below them the stone is dark, and the dark goes down into the ground.',
      text_zh: '一根有人那么粗的灰石柱子，在齐头高的地方断了。柱身上嵌着两只铁环，环的内侧磨得发亮。铁环下面的石头颜色发暗，一直暗到地底下。',
    },
    makeup: [{ type: 'item/material/stone', count: 6 }],
  },
  {
    id: WHIPPING_POST,
    name: L('whipping post', '鞭笞柱'),
    tags: ['wooden', 'flammable', 'readable'],
    solid: true,
    sprite: 'fixture:post',
    props: {
      material: 'wood',
      maxHp: 20,
      hp: 20,
      text: 'A post of oak, its bark long gone, set in the court of the Scourging House. A brother of the Red Order stands at it at dusk with his scourge. The wood is worn smooth at the height of a man\'s hands.',
      text_zh: '一根橡木桩，树皮早就没了，立在鞭笞院的院子里。每到黄昏，红衣修会的修士就拿着鞭子站到它跟前。木桩在齐手高的地方磨得光溜溜的。',
    },
    makeup: [{ type: 'item/material/stick', count: 2 }],
  },
  {
    id: RED_CHANNEL,
    name: L('red channel', '红色沟槽'),
    tags: ['stone', 'readable'],
    solid: false,
    sprite: 'fixture:red_channel',
    props: {
      material: 'stone',
      text: 'A gutter a hand wide, cut into the floor, a little dark red water standing in it. It runs from the foot of the altar to the west wall and goes under it.',
      text_zh: '地上凿出的一道沟，一掌宽，里面积着一点暗红色的水。它从祭坛脚下一直通到西墙，从墙根底下穿过去。',
    },
  },
]
