// Brother Anselm, who serves in Sister Ilse's chapel at Astra's altar (docs/chapter-1.md §7) and keeps its bookstand:
// skill books copied in the monastery over the pass before the storms, sold for what they cost to bring down (content
// village.ts). He has read every one and can do none of it, and says so.

import { line, type PersonDef } from '../person.ts'

export const anselm: PersonDef = {
  id: 'npc.anselm',
  role: 'priest',
  // of the Church: speak against the gods and they take it ill (content social.ts unbelief)
  tags: ['devout'],
  essential: true,
  name: { en: 'Brother Anselm', zh: '安塞姆修士' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.vestment', beard: null, hat: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'light' } },
  age: 68,
  temperament: { personality: 'gentle', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.ilse': 'the sister whose chapel he serves' },
  purse: 30,
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/vessel/flask/holy_water', 2], ['item/light/candle', 6], ['item/document/book', 1], ['item/misc/feather_quill', 1]] },
  schedules: {
    default: [
      [21, 6, 'meadow.church:priest.bed', 'sleep'],
      [6, 21, 'meadow.church:priest.stand', 'keep the bookstand'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'These books were copied at the monastery over the pass, before the storms, and carried down. I ask only what the carrying cost. Whether any more will come, I do not know.', '这些书都是起风暴以前，山口那边的修道院抄好送下山来的。我卖的价钱，只够抵运下来的路费。往后还有没有新的，我也不知道。'),
    line('chat', 'The monastery copied by candlelight. The winter books have drops of wax on their pages; you can tell them at a glance.', '修道院是点着蜡烛抄书的。冬天抄的那几本，书页上落着蜡点，一翻就认得出来。'),
    line('greeting:first', 'Welcome to Firstlight\'s chapel. Sister Ilse keeps the flame; I keep the books. They teach what the hands can learn: a strike, a step, a word of fire. Take one to the light and read it through, and it will stay with you.', '欢迎来到初原村的礼拜堂。圣火由伊尔丝修女照看，书由我照看。这些书教的都是手上的功夫：怎么出一击，怎么走一步，怎么念一句火焰的咒语。拿一本到亮处读完，学到的就是你的了。', { once: true }),
    line('default', 'The common books are for anyone. The ones for a road — dagger, shield, bow or staff — cost more, and teach only those who walk it.', '普通的书谁都能学。专讲一条路的——匕首、盾、弓、法杖——要贵一些，也只有走那条路的人学得会。'),
    line('default', 'I have read every book on that stand, and I cannot do a single thing that is in them. My hands were slow when I was young, and they are slower now.', '架子上的书，我每一本都读过，可书里的本事，我一样也使不出来。年轻时手脚就慢，现在更慢了。'),
    line('hour:evening', 'I light the candles at dusk. Sit a while if you like; the chapel is not locked at night.', '黄昏了，我去把蜡烛点上。你想坐就坐一会儿吧，礼拜堂夜里也不锁门。'),
    line('given', 'Thank you. The chapel will put it to use.', '谢谢你。礼拜堂用得着它。'),
  ],
}
