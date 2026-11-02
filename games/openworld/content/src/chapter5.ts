// Chapter 5, the Fifth Seal (docs/chapter-5.md, docs/lore.md §4, §6, §12, §13): the story's facts and things of the chapter.
// West of the Holy City the road climbs out of the fens into the White Altar Heights, and Severin walks with the pilgrim
// now: the White Stair, its robes hung over the graves of the pilgrims who died on it; Whiteveil Abbey on the summit, its
// robing house and the roll of every pilgrim named in four hundred years; the catacombs under its church, the white-robed
// in their niches murmuring "How long?", Cassian's niche empty, the oldest niche the second vessel's; and beneath the altar
// the Witnesses, the Fifth Seal-bearer, round the Lance. The maps, people and scenes are the demo's
// (tools/src/demo/quest/chapter5.ts); the boss is bosses.ts, the room bossrooms.ts, Lumi's fifth boon boons.ts.
//
// Its quests are in quests/: the main line's `white_stair`, `fifth_seal`, `bells`, and the Heights' errands. The story's
// facts are `ch5.*`; `night.shift` 5 once the Witnesses fall (calendar.ts).

import type { Rule, TypeDef } from '@openworld/engine'
import { DO } from './afflictions.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** The story's facts of the chapter, in the order they come. */
export const CH5 = {
  /** First onto the White Stair (the scene `stair_arrival`). */
  road: 'ch5.road',
  /** Abbot Benedek spoken to (`white_stair`'s stage). */
  abbot: 'ch5.abbot',
  /** The roll read in the robing house (the scene `roll`). */
  roll: 'ch5.roll',
  /** The niches seen: Cassian's, the second's (the scene `niches`). */
  niches: 'ch5.niches',
  /** The Witnesses down (their sin's own fact, bosses.ts). */
  witnesses: 'sins.defeated.witnesses',
  /** The Lance come free of the altar (the scene `enough`). */
  lance: 'ch5.lance',
  /** The bells at four: the chapter's end. */
  end: 'ch5.end',
  /** Cassian's scallop laid in his niche (ch5/scallop rules). */
  cassian: 'ch5.cassian',
} as const

/** The Witnesses beneath the altar (the campaign's body; the Boss Studio stages its own). */
export const WITNESSES_ID = 'beneathaltar.witnesses'
/** The Witnesses as Chapter 5 sets them: softer than in the Boss Studio and the challenge (bosses.ts), for a pilgrim of about level 18. */
export const WITNESSES_CAMPAIGN = { hp: 1000, maxHp: 1000, def: 3, atk: 20 }

/** The last of the five instruments (items.ts); the abbot's road pass Brother Tomas wants. */
export const HOLY_LANCE = 'item/weapon/polearm/spear/holy_lance'
export const ROAD_PASS = 'item/document/road_pass'
/** The scallop a pilgrim is given when named: Cassian's, from Hushwood (Chapter 1's errand), not the one sworn at the Rest. */
export const SCALLOP = 'item/valuable/scallop'

/** The robes over the stair's graves; the niches of the catacombs, filled and empty; the altar and its Lance; the sleepers round it; Agathe's frame. */
export const ROBE_POLE = 'fixture/sacred/robe_pole'
export const NICHE = 'fixture/sacred/niche'
export const NICHE_EMPTY = 'fixture/sacred/niche/empty'
export const LANCE_ALTAR = 'fixture/sacred/lance_altar'
export const ROBED_SLEEPER = 'fixture/remains/robed'
export const ROBED_KNEELING = 'fixture/remains/robed/kneeling'
export const SEWING_FRAME = 'fixture/craft/sewing_frame'

export const CH5_TYPES: TypeDef[] = [
  {
    id: ROBE_POLE,
    name: L('a robe on a pole', '杆上的白袍'),
    tags: ['cloth', 'wooden', 'readable'],
    solid: true,
    sprite: 'fixture:robe_pole',
    props: { material: 'wood', maxHp: 8, hp: 8, text: 'A white robe hung on a pole over a grave beside the stair, its hem stirring. Someone died here on the way up. They are not under it: the brothers carried them on to the abbey.', text_zh: '石阶旁一座坟上，杆子挂着一件白袍，衣摆在风里动。有人在往上爬的路上死在了这里。人并不在底下：修士们把他们抬上去，送进了修道院。' },
    makeup: [{ type: 'item/material/cloth', count: 1 }, { type: 'item/material/stick', count: 1 }],
  },
  {
    id: NICHE,
    name: L('a niche of the white-robed', '白袍者的壁龛'),
    tags: ['holy', 'stone', 'readable'],
    solid: true,
    sprite: 'fixture:niche',
    props: { material: 'stone', text: 'A niche cut in the chalk. In it lies someone in a white robe, face covered, a thin ring of gold at their head. A plate under it gives a name, a year of the Five, and one word: PILGRIM. Under the cloth, something is murmuring.', text_zh: '白垩里凿出的一个壁龛。里面躺着一个穿白袍的人，脸盖着，头边有一圈细细的金环。下面的铭牌上刻着一个名字、一个五苦纪年，还有一个词：朝圣者。布底下，有什么在低声念叨。' },
  },
  {
    id: NICHE_EMPTY,
    name: L('an empty niche', '空着的壁龛'),
    tags: ['holy', 'stone', 'readable'],
    sprite: 'fixture:niche_empty',
    props: { text: 'An empty niche, swept clean, a plate under it.', text_zh: '一个空着的壁龛，扫得干干净净，下面有一块铭牌。' },
  },
  {
    id: LANCE_ALTAR,
    name: L('The altar of the Lance', '圣枪祭坛'),
    tags: ['holy', 'stone', 'readable'],
    solid: true,
    footprint: [2, 1],
    sprite: 'fixture:lance_altar',
    props: { material: 'stone', text: 'A white altar, and standing upright in it a plain spear of old iron, its blade black to the socket. Round its foot the stone is worn into a hollow by four hundred years of hands.', text_zh: '一座白色的祭坛，上面直直地插着一杆普通的老铁矛，矛头一直黑到銎口。四百年来无数只手摸过它的脚下，把石头磨出了一个凹坑。' },
  },
  {
    id: ROBED_SLEEPER,
    name: L('one of the white-robed', '白袍者'),
    tags: ['readable'],
    solid: false,
    sprite: 'fixture:robed_sleeper',
    props: { text: 'Someone in a white robe lies on the floor with their face covered, one of hundreds heaped round the altar. Their lips move under the cloth. "How long?"', text_zh: '一个穿白袍的人盖着脸躺在地上，祭坛四周堆着几百个这样的人。布底下，他们的嘴唇在动。“还要多久？”' },
  },
  { id: ROBED_KNEELING, name: L('one of the white-robed, kneeling', '跪着的白袍者'), sprite: 'fixture:robed_kneeling', props: { text: 'Someone in a white robe kneels with their head bowed, one of hundreds round the altar. Their lips move under the hood. "How long?"', text_zh: '一个穿白袍的人低着头跪着，祭坛四周有几百个这样的人。兜帽底下，他们的嘴唇在动。“还要多久？”' } },
  {
    id: SEWING_FRAME,
    name: L('a sewing frame', '缝衣架'),
    tags: ['wooden', 'cloth', 'readable'],
    solid: true,
    sprite: 'fixture:sewing_frame',
    props: { material: 'wood', maxHp: 10, hp: 10, text: 'A frame with a half-sewn white robe on it. It is cut to a traveller\'s measure. Yours.', text_zh: '架子上绷着一件缝了一半的白袍。是照一个旅人的身量裁的。你的身量。' },
    makeup: [{ type: 'item/material/plank', count: 1 }, { type: 'item/material/cloth', count: 1 }],
  },
]

/**
 * Cassian's niche: his scallop laid in it, the niche keeps it and the story hears he is brought (docs/chapter-5.md §10,
 * *Not Yet Brought*). The scallop's own rule lays it (it is gone from the hand), the niche's keeps it.
 */
export const CH5_RULES: Rule[] = [
  rule({
    id: 'ch5/scallop-laid',
    label: L('Lay {instrument} in {target}', '把{instrument}放进{target}'),
    doc: 'A pilgrim\'s scallop used on the empty niche kept for its pilgrim (Cassian\'s, `for: cassian`): it is laid there and is gone from the hand; anything else it is used on is as before.',
    host: { type: SCALLOP, notTags: ['sworn'] },
    on: 'act/use',
    tree: {
      if: { all: [{ is: { role: 'target', sel: { type: NICHE_EMPTY } } }, { prop: { role: 'target', key: 'for', cmp: 'cassian' } }] },
      then: DO({ op: 'emit', impulse: 'handle', to: 'target' }, { op: 'destroy' }),
      else: 'inherit',
    },
  }),
  rule({
    id: 'ch5/niche-keeps',
    doc: 'The empty niche kept for Cassian, handed his scallop: it keeps it, its plate reads otherwise now, and the story hears he is brought.',
    host: { type: NICHE_EMPTY },
    on: 'impulse/handle',
    tree: {
      if: { all: [{ prop: { role: 'host', key: 'for', cmp: 'cassian' } }, { is: { role: 'instrument', sel: { type: SCALLOP, notTags: ['sworn'] } } }] },
      then: DO(
        { op: 'setProp', key: 'text', value: 'A niche, swept clean. On its floor lies a pilgrim\'s scallop. The plate under it: CASSIAN OF FIRSTLIGHT. THE 380TH YEAR. Someone has scratched out NOT YET and left BROUGHT.' },
        { op: 'setProp', key: 'text_zh', value: '一个扫得干干净净的壁龛。龛底放着一枚朝圣者的扇贝。下面的铭牌：初原村的卡西安。三百八十年。有人把“尚未”两个字刮掉了，只留下“带来”。' },
        { op: 'vfx', fx: 'sparkle', at: 'tileOf:host' },
        { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'cassian' } },
      ),
      else: 'inherit',
    },
  }),
  rule({
    id: 'ch5/story',
    doc: 'The story keeps that Cassian is brought (docs/chapter-5.md §10).',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'cassian' } }, then: DO({ op: 'setProp', key: CH5.cassian, value: 1 }), else: 'inherit' },
  }),
]
