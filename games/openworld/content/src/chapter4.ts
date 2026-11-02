// Chapter 4, the Fourth Seal (docs/chapter-4.md, docs/lore.md §4, §6, §9, §12): the story's facts and things of the chapter.
// The fen road runs south from Fairweight into the Pale Fens, where the dusk hardly lifts and no one has died for forty
// years: the Long Causeway, its graves nailed; Nailgate on its piles, every doorpost bristling with nails for the dead kept
// inside; the Drowned Graves, where those who have forgotten everything wander as the Pale; the Ossuary of the Holy Wood
// on its island, where the Shroud that carried Astra's body lies black under glass; and behind its fog the Ford of the
// Dead, where Nacht, Reinholder of Death, the Fourth Seal-bearer, holds the reins and will not let Death ride. The maps,
// people and scenes are the demo's (tools/src/demo/quest/chapter4.ts); the boss is bosses.ts, the room bossrooms.ts,
// Lumi's fourth boon boons.ts.
//
// Its quests are in quests/: the main line's `fen_road`, `fourth_seal`, `ferry`, and the Fens' errands. The story's facts
// are `ch4.*`; `night.shift` 4 once Nacht falls (calendar.ts).

import type { Rule, TypeDef } from '@openworld/engine'
import { DO } from './afflictions.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

/** The story's facts of the chapter, in the order they come. */
export const CH4 = {
  /** First onto the Long Causeway (the scene `fen_arrival`). */
  road: 'ch4.road',
  /** The Kept seen in Nailgate: the sexton's nail, Liese at Piet's door (the scene `kept`). */
  kept: 'ch4.kept',
  /** Nessa's two columns seen in the chapel (the scene `quickening`). */
  nessa: 'ch4.nessa',
  /** The Pale Rider seen at dusk over the Drowned Graves (the scene `rider`). */
  rider: 'ch4.rider',
  /** The Shroud seen, and Severin there: the pilgrim comes to his belief (the scene `shroud`). */
  shroud: 'ch4.shroud',
  /** Nacht down (his sin's own fact, bosses.ts). */
  nacht: 'sins.defeated.nacht',
  /** The Holy Wood given (the scene `reins`). */
  wood: 'ch4.wood',
  /** The ferry at Nailgate: the chapter's end. */
  end: 'ch4.end',
} as const

/** Nacht at the Ford of the Dead (the campaign's body; the Boss Studio stages its own). */
export const NACHT_ID = 'deadford.nacht'
/** Nacht as Chapter 4 sets him: softer than in the Boss Studio and the challenge (bosses.ts), for a pilgrim of about level 15. */
export const NACHT_CAMPAIGN = { hp: 900, maxHp: 900, def: 3, atk: 18 }

/** The fourth of the five instruments (items.ts), and what the Fens' people keep. */
export const HOLY_WOOD = 'item/relic/holy_wood'
export const FERRY_COIN = 'item/valuable/ferry_coin'
export const JORY_KITE = 'item/valuable/kite'

/** A doorpost of Nailgate, a nail in it for each of the dead kept inside; the causeway's grave-posts; the Shroud; the Holy Wood. */
export const NAIL_POST = 'fixture/sacred/nail_post'
export const GRAVE_POST = 'fixture/sacred/grave_post'
export const SHROUD = 'fixture/sacred/shroud'
export const HOLY_WOOD_TREE = 'fixture/sacred/holy_wood'
/** What the Reinholder leaves when he pulls the reins: the dead's hands up out of the ford, holding whoever wades in. */
export const GRAVE_HANDS = 'fixture/hazard/grave_hands'

export const CH4_TYPES: TypeDef[] = [
  {
    id: NAIL_POST,
    name: L('a nailed doorpost', '钉满钉子的门柱'),
    tags: ['wooden', 'readable'],
    solid: true,
    sprite: 'fixture:nail_post',
    props: { material: 'wood', maxHp: 20, hp: 20, text: 'A doorpost of grey wood, driven full of iron nails: dozens of heads, rusted brown, and a few new and bright at the top. In Nailgate a nail is driven for each of the dead a house keeps.', text_zh: '一根灰木门柱，上面钉满了铁钉：几十个钉帽，锈成了褐色，顶上还有几颗是新的，亮闪闪的。在钉门村，一户人家留住一个死人，就钉一颗钉子。' },
    makeup: [{ type: 'item/material/plank', count: 1 }, { type: 'item/material/iron_ingot', count: 1 }],
  },
  {
    id: GRAVE_POST,
    name: L('a grave-post', '墓桩'),
    tags: ['wooden', 'readable'],
    solid: true,
    sprite: 'fixture:grave_post',
    props: { material: 'wood', maxHp: 12, hp: 12, text: 'A black post by the causeway where someone was buried, leaning. There are nails in it too, and a strip of grey cloth tied round it. The ground at its foot has been dug, and filled in again from the inside.', text_zh: '堤边一根歪斜的黑木桩，下面埋过人。桩上也钉着钉子，还系着一条灰布。桩脚的土被刨开过，又从里面填了回去。' },
    makeup: [{ type: 'item/material/stick', count: 2 }],
  },
  {
    id: SHROUD,
    name: L('The Shroud of the Translation', '移灵裹尸布'),
    tags: ['holy', 'readable'],
    solid: true,
    sprite: 'fixture:shroud',
    props: { text: 'Under glass, a folded cloth. A card beside it in old letters: THE SHROUD IN WHICH THE BODY OF THE FIRST MARTYR WAS CARRIED TO THE HOLY CITY. IT WAS WHITE. The cloth is black, and the black moves under the glass like water under ice.', text_zh: '玻璃罩下面叠着一块布。旁边一张卡片，字体很古老：初殉者遗体移往圣城时所用之裹尸布。此布原为白色。可那块布是黑的，而且那片黑在玻璃底下动，像冰面下的水。' },
  },
  {
    id: HOLY_WOOD_TREE,
    name: L('The Holy Wood', '钉刑圣木'),
    tags: ['holy', 'wooden', 'readable'],
    solid: true,
    sprite: 'fixture:holy_wood_tree',
    props: { material: 'wood', text: 'A dead black tree standing in the ford, no taller than a house. Three iron nails as long as a forearm are driven through its trunk at the height of a man\'s hands and feet. The water round its roots does not move.', text_zh: '一棵枯死的黑树立在渡口里，不比一座房子高。三根小臂那么长的铁钉，钉穿了它的树干，高度正是一个人的手和脚。树根周围的水一动也不动。' },
  },
  { id: GRAVE_HANDS, name: L('the dead\'s hands', '亡者之手'), tags: ['cold'], sprite: 'fixture:grave_hands', stage: { lasts: 300 } },
]

/** The dead's hands hold whoever wades into them (a flyer never touches them; the Reinholder rides through his own), and sink back in a while. */
export const CH4_RULES: Rule[] = [
  rule({
    id: 'ch4/hands-hold',
    doc: 'The dead\'s hands up out of the ford hold whoever wades into them: a chill, and they are made to kneel a moment (a boss wades through its own).',
    host: { type: GRAVE_HANDS },
    on: 'contact/begin',
    tree: {
      if: { all: [{ param: { key: 'how', cmp: 'under' } }, { is: { role: 'other', sel: { type: 'actor', notTags: ['boss'] } } }] },
      then: DO({ op: 'emit', impulse: 'strike', to: 'other', params: { power: 1, edge: 'magic' } }, { op: 'emit', impulse: 'coat', to: 'other', params: { substance: 'knelt' } }),
      else: 'inherit',
    },
  }),
  rule({
    id: 'ch4/hands-sink',
    doc: 'The dead\'s hands sink back into the ford when their while is out.',
    host: { type: GRAVE_HANDS },
    on: 'time/timer',
    tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx: 'splash', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' },
  }),
]
