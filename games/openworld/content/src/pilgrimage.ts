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
    id: 'crown', name: L('Shrine of the Crown', '荆棘冠之龛'), takes: offering({ tags: ['wearable'], props: { slot: 'head' } }), asks: L('something worn on the head: pride laid down', '一件戴在头上的东西：放下骄傲'),
    text: L('THE FIRST SUFFERING: THE CROWN. He let them press the thorns into his brow, and did not lift his hand. — Lay down what you wear on your head, and be lowly.', '第一苦：戴冠。他任由荆棘刺进额头，没有抬手。——放下你头上戴的东西，谦卑下来。'),
  },
  {
    id: 'scourge', name: L('Shrine of the Pillar', '鞭刑柱之龛'), takes: offering({ tags: ['fiber'] }), asks: L('a rope or a cord: the scourge', '一根绳索：鞭子'),
    text: L('THE SECOND SUFFERING: THE SCOURGE. Bound to the pillar, he bled for every one of us. — Lay down a cord, the scourge you were spared.', '第二苦：受鞭。他被绑在刑柱上，为我们每一个人流血。——放下一根绳，那是你被免去的鞭子。'),
  },
  {
    id: 'scales', name: L('Shrine of the Scales', '饥刑之秤之龛'), takes: offering({ tags: ['edible'] }), asks: L('something to eat: a meal fasted', '一样吃的：斋戒一餐'),
    text: L('THE THIRD SUFFERING: HUNGER. Upon the scales his flesh grew lighter than sin. — Lay down a meal you will not eat.', '第三苦：受饥。在天平上，他的肉身变得比罪还轻。——放下一顿你不吃的饭。'),
  },
  {
    id: 'nails', name: L('Shrine of the Nails', '钉刑圣木之龛'), takes: offering({ tags: ['metal'] }), asks: L('something of iron or metal: the nails', '一件铁器或金属：圣钉'),
    text: L('THE FOURTH SUFFERING: THE NAILS. Nailed to the holy wood, he accepted death. — Lay down metal, as he laid down his life.', '第四苦：受钉。他被钉在圣木上，接受了死亡。——放下金属，如同他放下了生命。'),
  },
  {
    id: 'lance', name: L('Shrine of the Lance', '穿心圣枪之龛'), takes: offering({ tags: ['light'] }), asks: L('a light — a torch or a candle: the dawn', '一盏光——火把或蜡烛：黎明'),
    text: L('THE FIFTH SUFFERING: THE LANCE. When it pierced his heart, the sun rose. — Lay down a light, and the dawn will remember you.', '第五苦：受枪。圣枪刺穿他心口的那一刻，太阳升起了。——放下一盏光，黎明会记得你。'),
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
  then: { do: [{ op: 'log', text: L('{host} already burns.', '{host}已经亮着了。') }] },
  else: {
    if: { any: KEPT.map((tag) => ({ has: { role: 'item' as const, tag } })) },
    then: { do: [{ op: 'log', text: L('{host} stays dark. {item} is not a thing to give away.', '{host}没有亮起来。{item}不是能献出去的东西。') }] },
    else: {
      if: { is: { role: 'item', sel: s.takes } },
      then: {
        do: [
          { op: 'emit', impulse: 'notify', to: 'item', params: { what: 'consumed' } },
          { op: 'addStatus', status: lit },
          { op: 'vfx', fx: 'sparkle' },
          { op: 'log', text: L(`{item} is laid on {host}. A light kindles in the carving.`, `{item}被放在{host}上。刻痕里亮起了一点光。`) },
          { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'facts', [`fact.${shrineFact(s.id)}`]: 1 } },
        ] as Effect[],
      },
      else: { do: [{ op: 'log', text: L(`Nothing kindles. {host} asks for ${s.asks.en}.`, `什么也没亮起来。{host}要的是${s.asks.zh}。`) }] },
    },
  },
})

export const PILGRIMAGE_RULES: Rule[] = WAYSHRINES.map((s) =>
  story({
    id: `pilgrim/shrine-${s.id}`,
    doc: `The ${s.id} shrine on the Pilgrim's Road: laid ${s.asks.en} (G), it takes it, lights (lit) and tells the story (${shrineFact(s.id)}); laid a relic, something important or bound, or a keepsake, it refuses it and does not take it; laid anything else, it says what it asks; lit, it stays lit.`,
    host: { type: `fixture/sacred/wayshrine/${s.id}` },
    on: 'impulse/receive',
    tree: OFFERED(s),
  }),
)
