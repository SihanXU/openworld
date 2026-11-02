// Chapter 3, the Third Seal (docs/chapter-3.md, docs/lore.md §4, §6, §9, §12): the story's facts and things of the chapter.
// The grain road runs south and east from the Red Host's camp into the Vale of Scales: the Chaff Road, the market town of
// Fairweight with its great scale and the Church's black weight, the White Pans where the Lightened stand until the wind
// takes them, the Black Balance and its counting room, and behind its fog the Scale Floor, where Ele, the Priest of the
// Black Scales, the Third Seal-bearer, weighs the Vale. The maps, people and scenes are the demo's
// (tools/src/demo/quest/chapter3.ts); the boss is bosses.ts, the room bossrooms.ts, Lumi's third boon boons.ts.
//
// Its quests are in quests/: the main line's `grain_road`, `third_seal`, `granary`, and the Vale's errands. The story's
// facts are `ch3.*`; `night.shift` 3 once Ele falls (calendar.ts).

import type { Rule, TypeDef } from '@openworld/engine'
import { DO } from './afflictions.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** The story's facts of the chapter, in the order they come. */
export const CH3 = {
  /** First onto the Chaff Road (the scene `vale_arrival`). */
  road: 'ch3.road',
  /** The weighing seen in Fairweight (the scene `weighing`). */
  weighing: 'ch3.weighing',
  /** Sister Maud spoken to (`third_seal`'s stage). */
  maud: 'ch3.maud',
  /** The Standing seen on the White Pans (the scene `standing`). */
  pans: 'ch3.pans',
  /** Into the Black Balance (the beat `balance_court`). */
  balance: 'ch3.balance',
  /** The ledger seen in the counting room, and Severin there (the scene `ledger`). */
  ledger: 'ch3.ledger',
  /** Ele down (their sin's own fact, bosses.ts). */
  ele: 'sins.defeated.ele',
  /** The Scale of Hunger given (the scene `scale`). */
  scale: 'ch3.scale',
  /** The Lightened hungry again, seen in Fairweight (the scene `hunger`). */
  hunger: 'ch3.hunger',
  /** The Grain Guild's granary open, by its key or its door broken (ch3/granary rules). */
  granary: 'ch3.granary',
  /** The supper in Fairweight: the chapter's end. */
  end: 'ch3.end',
} as const

/** Ele on the Scale Floor (the campaign's body; the Boss Studio stages its own). */
export const ELE_ID = 'scalefloor.ele'
/** Ele as Chapter 3 sets them: softer than in the Boss Studio and the challenge (bosses.ts), for a pilgrim of about level 12. */
export const ELE_CAMPAIGN = { hp: 760, maxHp: 760, def: 2, atk: 16 }

/** The third of the five instruments (items.ts), and what the Vale's people keep. */
export const SCALE_OF_HUNGER = 'item/relic/scale_of_hunger'
export const BLUE_SCARF = 'item/valuable/blue_scarf'
export const GRANARY_KEY = 'item/key/granary'

/** The town's great scale, the Church's black weight, the wayside scale; the Standing on the salt; the Scale Floor's pans. */
export const GREAT_SCALE = 'fixture/scale/great'
export const WAYSIDE_SCALE = 'fixture/scale/wayside'
export const WEIGHT_OF_SIN = 'fixture/sacred/weight_of_sin'
export const HANGING_PAN = 'fixture/sacred/hanging_pan'
export const LEDGER = 'fixture/furniture/ledger'
export const SALT_PAN = 'fixture/nature/salt_pan'
export const DUST_HEAP = 'fixture/remains/dust'
/** The Vale's wheat, dead on the stalk: grey, the ears empty. */
export const DEAD_WHEAT = 'fixture/nature/dead_wheat'
/** The Standing: the Lightened who walked out onto the salt, three shapes of them (a type each, for its picture). */
export const STANDING = 'fixture/remains/standing'
export const STANDING_KINDS = [`${STANDING}/a`, `${STANDING}/b`, `${STANDING}/c`] as const
/** The Grain Guild's granary doors, barred: the guild's key opens them, an axe breaks them (ch3/granary rules). */
export const GRANARY_DOORS = 'fixture/door/granary'

const STANDING_TEXT = {
  text: 'Someone stands here on the salt, facing south-east, very still. Their clothes are grey with dust, and so is their face. They do not turn when you speak. When the wind blows, a little of them goes with it.',
  text_zh: '有个人站在盐滩上，脸朝东南，一动不动。衣服被尘土染成了灰色，脸也是。你跟他说话，他不回头。风一吹，他身上就有一点被带走了。',
}

export const CH3_TYPES: TypeDef[] = [
  {
    id: GREAT_SCALE,
    name: L('the great scale of Fairweight', '公秤镇的大秤'),
    tags: ['wooden', 'readable'],
    solid: true,
    footprint: [3, 1],
    sprite: 'fixture:great_scale',
    props: { material: 'wood', maxHp: 60, hp: 60, text: 'A beam of black oak on a post as tall as two men, a pan of beaten bronze hanging from each end on chains. One pan is big enough for a grown man to stand in. The other is small, and worn bright in the middle where the weight sits.', text_zh: '一根黑橡木横梁架在两人高的立柱上，两头各用铁链吊着一只铜盘。一只盘大得能站进一个成年人，另一只很小，正中被秤砣压得发亮。' },
    makeup: [{ type: 'item/material/plank', count: 6 }],
  },
  {
    id: WAYSIDE_SCALE,
    name: L('a wayside scale', '路边的秤'),
    tags: ['wooden', 'readable'],
    solid: true,
    sprite: 'fixture:wayside_scale',
    props: { material: 'wood', maxHp: 20, hp: 20, text: 'A scale on a post at the crossroads, like a gibbet, with one pan. Carved on the post: ALL THAT COMES INTO THE VALE IS WEIGHED.', text_zh: '十字路口立着一杆秤，像一座绞架，只挂着一只秤盘。柱子上刻着：凡入衡谷者，皆须过秤。' },
    makeup: [{ type: 'item/material/plank', count: 3 }],
  },
  {
    id: WEIGHT_OF_SIN,
    name: L('the Weight of Sin', '罪之衡砣'),
    tags: ['holy', 'metal', 'iron', 'readable'],
    solid: true,
    sprite: 'fixture:weight_of_sin',
    props: { material: 'iron', text: 'A weight of black iron the size of a loaf, stamped with the third seal. Round its edge: THE FLESH AT LAST WAS LIGHTER THAN SIN. You try to lift it. It is about as heavy as a child of nine.', text_zh: '一块面包大小的黑铁秤砣，上面打着第三印的印记。边上一圈字：其肉身终轻于罪。你试着把它抬起来。它大约有一个九岁孩子那么重。' },
  },
  {
    id: HANGING_PAN,
    name: L('a pan of the Black Balance', '黑衡的秤盘'),
    tags: ['holy', 'metal', 'readable'],
    solid: true,
    footprint: [2, 1],
    sprite: 'fixture:hanging_pan',
    props: { material: 'bronze', text: 'A pan of blackened bronze as wide as a cart, hung on chains from somewhere far overhead. Grain trickles over its lip and hisses on the floor. It never runs out.', text_zh: '一只发黑的铜秤盘，有一辆大车那么宽，用铁链从头顶很高的地方吊下来。谷粒从盘沿上细细地漏下来，落在地上沙沙作响，怎么也漏不完。' },
  },
  {
    id: LEDGER,
    name: L('a ledger', '账簿'),
    tags: ['paper', 'readable', 'flammable'],
    solid: true,
    sprite: 'fixture:ledger',
    props: { material: 'paper' },
  },
  { id: DEAD_WHEAT, name: L('dead wheat', '枯死的麦子'), tags: ['plant', 'flammable', 'dry', 'readable'], solid: false, sprite: 'fixture:dead_wheat', props: { maxHp: 1, hp: 1, text: 'Wheat that came up and never ripened. The stalks are grey and the ears are empty; it breaks if you touch it.', text_zh: '出了苗却没灌浆的麦子。秆子是灰的，穗子是空的，一碰就断。' }, makeup: [{ type: 'item/material/grass', count: 1 }] },
  { id: SALT_PAN, name: L('salt pan', '盐田'), tags: ['readable'], solid: false, sprite: 'fixture:salt_pan', props: { text: 'A shallow square of crusted salt, a hand deep. Nobody has raked it in a long while.', text_zh: '一方浅浅的盐田，结着一掌厚的盐壳。很久没人来耙过了。' } },
  { id: DUST_HEAP, name: L('a heap of grey dust', '一小堆灰土'), tags: ['readable'], solid: false, sprite: 'fixture:dust_heap', props: { text: 'A low heap of fine grey dust, the shape of someone who sat down. The wind is taking it.', text_zh: '一小堆细细的灰土，像是有个人坐下来的样子。风正在把它吹散。' } },
  { id: STANDING, name: L('one of the Standing', '站在盐滩上的人'), tags: ['readable'], solid: true, sprite: 'fixture:standing_a', props: { ...STANDING_TEXT, maxHp: 1, hp: 1 } },
  { id: STANDING_KINDS[0], name: L('one of the Standing', '站在盐滩上的人'), sprite: 'fixture:standing_a' },
  { id: STANDING_KINDS[1], name: L('one of the Standing', '站在盐滩上的人'), sprite: 'fixture:standing_b' },
  { id: STANDING_KINDS[2], name: L('one of the Standing', '站在盐滩上的人'), sprite: 'fixture:standing_c' },
  {
    id: GRANARY_DOORS,
    name: L('the granary doors', '粮仓大门'),
    tags: ['wooden', 'flammable', 'readable'],
    solid: true,
    sprite: 'structure:door',
    props: { material: 'wood', maxHp: 30, hp: 30, text: 'The Grain Guild\'s granary doors, barred across with iron and locked. A board nailed beside them: SEALED FOR THE TITHE OF THE HOLY CITY. BY ORDER OF THE GUILD.', text_zh: '谷物行会的粮仓大门，横着上了铁闩，锁着。旁边钉着一块木牌：此仓封存，供圣城什一税。行会令。' },
  },
]

/**
 * The granary doors: the guild's key opens them; broken, they are gone; either way the story hears the granary is open
 * (docs/chapter-3.md §6, beat 9: the goal is a state, any way to it).
 */
export const CH3_RULES: Rule[] = [
  rule({
    id: 'ch3/granary-key',
    label: L('Unbar {target}', '打开{target}'),
    doc: 'The Grain Guild\'s key, worked at its granary\'s doors, unbars them: they swing open and are gone, and the story hears the granary is open. Any other key does not fit.',
    host: { type: GRANARY_DOORS },
    on: 'impulse/handle',
    tree: {
      if: { is: { role: 'instrument', sel: { type: GRANARY_KEY } } },
      then: DO({ op: 'vfx', fx: 'sparkle', at: 'tileOf:host' }, { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'granary' } }, { op: 'log', text: L('The bar comes free and the doors swing in. The smell of grain comes out.', '铁闩松开，两扇门向里打开。一股粮食的气味涌了出来。') }, { op: 'destroy' }),
      else: 'inherit',
    },
  }),
  rule({
    id: 'ch3/granary-broken',
    doc: 'The granary\'s doors broken down: they are gone, and the story hears the granary is open.',
    host: { type: GRANARY_DOORS },
    on: 'threshold/cross',
    tree: {
      if: { param: { key: 'name', cmp: 'broken' } },
      then: DO({ op: 'vfx', fx: 'dust', at: 'tileOf:host' }, { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'granary' } }, { op: 'log', text: L('The doors give way. Grain spills out over the step.', '大门塌了。粮食从门槛上泻了出来。') }, { op: 'destroy' }),
      else: 'inherit',
    },
  }),
  rule({
    id: 'ch3/standing-crumbles',
    doc: 'One of the Standing, told the wind has come for them (the scene `standing`), goes to dust where they stood.',
    host: { type: STANDING },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'crumble' } }, then: DO({ op: 'vfx', fx: 'dust', at: 'tileOf:host' }, { op: 'transform', into: DUST_HEAP }), else: 'inherit' },
  }),
  rule({
    id: 'ch3/standing-struck',
    doc: 'One of the Standing struck down goes to dust where they stood, as the wind would take them.',
    host: { type: STANDING },
    on: 'threshold/cross',
    tree: { if: { param: { key: 'name', cmp: 'broken' } }, then: DO({ op: 'vfx', fx: 'dust', at: 'tileOf:host' }, { op: 'transform', into: DUST_HEAP }), else: 'inherit' },
  }),
  rule({
    id: 'ch3/story',
    doc: 'The story keeps that the granary is open (docs/chapter-3.md §6).',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'granary' } }, then: DO({ op: 'setProp', key: CH3.granary, value: 1 }), else: 'inherit' },
  }),
]
