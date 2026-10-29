// The Pilgrim's Road (docs/chapter-1.md §14, 2026-10-12): between the Ford and the White Knight, the pilgrimage begins
// as the Church means it to — the oath at the Pilgrims' Rest, five wayside shrines of the Five Sufferings along the
// road, each lit by what its suffering asks, the ruined Abbey of the Thorn where Alberic was made a knight (his roll,
// his cell, the writ that should have relieved him and never went out, the Order's seal its last keeper guards), and
// the Kneeling Field, where pilgrims knelt to pray before they went on, and the stones of those who would not kneel to
// him. The maps and scenes are the demo's (tools/src/demo/quest/pilgrimage.ts); here are the facts, the shrines, and
// how a shrine takes its offering.

import type { Effect, Rule, Selector, Tree, TypeDef } from '@openworld/engine'

type Words = { en: string; zh: string }
const L = (en: string, zh: string): Words => ({ en, zh })
const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** The road's facts (the story's), in the order they come. */
export const PILGRIMAGE = {
  arrived: 'ch1.rest',
  oath: 'ch1.oath',
  shrines: 'ch1.shrines',
  writ: 'ch1.writ',
  seal: 'ch1.order_seal',
  field: 'ch1.kneelfield',
} as const

/** The Order of the Thorn's last keeper, in the abbey's crypt: he keeps the Order's seal. */
export const ABBOT_ID = 'abbey.abbot'
export const ORDER_SEAL = 'item/valuable/order_seal'
export const WRIT = 'item/document/writ_of_relief'
/** The pilgrim's own scallop, given at the Rest for the oath: not the scallop of the pilgrim before (the errand's). */
export const SWORN_SCALLOP = 'item/valuable/scallop/sworn'

/** One of the five wayside shrines: the suffering it keeps, what it asks to be laid on it, what is cut on it. */
export interface Wayshrine {
  id: string
  name: Words
  /** What lights it: a thing of this kind, laid on it (G) — never what one must not give away (`KEPT`). */
  takes: Selector
  /** What it asks, in a word (its objective, the pilgrims' hints). */
  asks: Words
  text: Words
}

/**
 * What a shrine never takes, whatever it asks: a relic (the Crown of Thorns is worn on the head), what matters most (the
 * Order's seal is metal), what is bound to one, and a keepsake (Mia's ring, a pilgrim's scallop). Laid on a shrine, it is
 * refused and stays the pilgrim's. (Tags a thing carries, never the derived ones a quest gives: the validator knows only
 * what some type carries.)
 */
export const KEPT = ['relic', 'important', 'bound', 'keepsake']
const offering = (sel: Selector): Selector => ({ ...sel, notTags: [...(sel.notTags ?? []), ...KEPT] })

export const WAYSHRINES: Wayshrine[] = [
  {
    id: 'crown', name: L('Shrine of the Crown', '荆棘冠之龛'), takes: offering({ tags: ['wearable'], props: { slot: 'head' } }), asks: L('something worn on the head', '一件戴在头上的东西'),
    text: L('THE FIRST SUFFERING: THE CROWN. They pressed the thorns into his brow, and he did not lift his hand. Pilgrim, lay down what you wear upon your head, and your pride with it.', '第一苦：戴冠。荆棘刺入他的额头，他不曾抬手。朝圣者，卸下你头上所戴之物，一并放下你的骄傲。'),
  },
  {
    id: 'scourge', name: L('Shrine of the Pillar', '鞭刑柱之龛'), takes: offering({ tags: ['fiber'] }), asks: L('a rope or a cord', '一根绳索'),
    text: L('THE SECOND SUFFERING: THE SCOURGE. Bound to the pillar, he bled for every one of us. Pilgrim, lay down a cord: the scourge that was spared you.', '第二苦：受鞭。他缚于刑柱之上，为众人流尽鲜血。朝圣者，献上一根绳索，那是你得以免受的鞭笞。'),
  },
  {
    id: 'scales', name: L('Shrine of the Scales', '饥刑之秤之龛'), takes: offering({ tags: ['edible'] }), asks: L('something to eat', '一样吃的'),
    text: L('THE THIRD SUFFERING: HUNGER. He took no food, and was weighed upon the scales. His flesh at last weighed less than sin. Pilgrim, lay down a meal you will not eat.', '第三苦：受饥。他断绝饮食，置身天平之上。他的肉身最终轻于罪。朝圣者，献上一餐，今日不食。'),
  },
  {
    id: 'nails', name: L('Shrine of the Nails', '钉刑圣木之龛'), takes: offering({ tags: ['metal'] }), asks: L('something made of metal', '一件金属的东西'),
    text: L('THE FOURTH SUFFERING: THE NAILS. Nailed by his hands and feet to the holy wood, he accepted death. Pilgrim, lay down metal, as he laid down his life.', '第四苦：受钉。圣钉贯穿他的手足，将他钉于圣木之上，他接受了死亡。朝圣者，献上金属，如他献上生命。'),
  },
  {
    id: 'lance', name: L('Shrine of the Lance', '穿心圣枪之龛'), takes: offering({ tags: ['light'] }), asks: L('a torch or a candle', '火把或蜡烛'),
    text: L('THE FIFTH SUFFERING: THE LANCE. The lance pierced his heart, and the sun rose. Pilgrim, lay down a light, and the dawn will remember you.', '第五苦：受枪。圣枪穿透他的心，太阳于是升起。朝圣者，献上一点光，黎明将记得你。'),
  },
]

/** A shrine's own fact: lit. */
export const shrineFact = (id: string) => `${PILGRIMAGE.shrines}.${id}`

/** The wayside shrines as kinds of thing: carved stones of the Five Sufferings (the seal stone's look), each its own. */
export const PILGRIMAGE_TYPES: TypeDef[] = [
  { id: 'fixture/sacred/wayshrine', name: L('wayside shrine', '路边圣龛'), tags: ['holy', 'stone', 'readable', 'wayshrine', 'surface'], sprite: 'fixture:seal_stone', props: { material: 'stone', maxHp: 40, hp: 40, handsRange: 1 }, makeup: [{ type: 'item/material/stone', count: 2 }] },
  ...WAYSHRINES.map((s): TypeDef => ({ id: `fixture/sacred/wayshrine/${s.id}`, name: s.name, tags: [], sprite: 'fixture:seal_stone', props: { text: s.text.en, text_zh: s.text.zh, suffering: s.id }, makeup: [{ type: 'item/material/stone', count: 2 }] })),
]

const lit = 'lit'
/**
 * A shrine given what its suffering asks: the offering is taken (gone), it lights, and the story keeps it. What must not
 * be given away is refused first, whatever the shrine asks (`KEPT`), and is not taken.
 */
const OFFERED = (s: Wayshrine): Tree => ({
  if: { has: { role: 'host', status: lit } },
  then: { do: [{ op: 'log', text: L('{host} is already lit.', '{host}已经亮着了。') }] },
  else: {
    if: { any: KEPT.map((tag) => ({ has: { role: 'item' as const, tag } })) },
    then: { do: [{ op: 'log', text: L('{host} stays dark. {item} is not something to give away.', '{host}没有亮起来。{item}不是能献出去的东西。') }] },
    else: {
      if: { is: { role: 'item', sel: s.takes } },
      then: {
        do: [
          { op: 'emit', impulse: 'notify', to: 'item', params: { what: 'consumed' } },
          { op: 'addStatus', status: lit },
          { op: 'vfx', fx: 'sparkle' },
          { op: 'log', text: L(`You lay {item} on {host}. A light kindles in the carving.`, `你把{item}放在{host}上。刻痕里亮起了一点光。`) },
          { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'facts', [`fact.${shrineFact(s.id)}`]: 1 } },
          // an offering made as the Church asks: the one who made it keeps the faith a little more
          { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'faith', delta: 5 } },
        ] as Effect[],
      },
      else: { do: [{ op: 'log', text: L(`Nothing kindles. {host} asks for ${s.asks.en}.`, `什么也没亮起来。{host}要的是${s.asks.zh}。`) }] },
    },
  },
})

export const PILGRIMAGE_RULES: Rule[] = WAYSHRINES.map((s) =>
  story({
    id: `pilgrim/shrine-${s.id}`,
    doc: `The ${s.id} shrine on the Pilgrim's Road: laid ${s.asks.en} (G), it takes it, lights (lit), tells the story (${shrineFact(s.id)}) and the one who laid it (faith +5); laid a relic, something important or bound, or a keepsake, it refuses it and does not take it; laid anything else, it says what it asks; lit, it stays lit.`,
    host: { type: `fixture/sacred/wayshrine/${s.id}` },
    on: 'impulse/receive',
    tree: OFFERED(s),
  }),
)
