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
    line('chat', 'A book is only paper until a hand that can do the thing holds it. Mine cannot. Yours might.', '书只是纸，直到一双能做成那件事的手拿起它。我的手不行。你的也许行。'),
    line('chat', 'The monastery over the pass copied by candlelight. You can tell the winter books by the wax drops.', '山口那边的修道院是点着蜡烛抄书的。冬天抄的书，从蜡滴就能认出来。'),
    line('greeting:first', 'Welcome to Firstlight\'s chapel. Sister Ilse keeps the flame; I keep the books. They teach what the hands can learn: a strike, a step, a word of fire. Take one to the light and read it — it will stay with you.', '欢迎来到初原村的礼拜堂。伊尔丝修女守着圣火，我守着这些书。书教的是手能学会的东西：一击、一步、一句火焰的咒语。拿一本到光下读，它就会留在你身上。', { once: true }),
    line('default', 'The common books are for anyone. The ones for a road — dagger, shield, bow or staff — are dearer, and teach only those who walk it.', '普通的书谁都能学。走某条路的书——匕首、盾、弓或法杖——贵一些，也只教走那条路的人。'),
    line('default', 'I have read every book on that stand. I cannot do a single thing in them. Reading is not the same as learning; remember that.', '那个书架上的书我每一本都读过。书里的东西我一样也做不到。读了不等于学会，记住这一点。'),
    line('hour:evening', 'The candles are lit at dusk. Sit, if you like. The benches do not ask why you came.', '黄昏时点上蜡烛。想坐就坐吧。长椅不会问你为什么来。'),
    line('given', 'Thank you. The chapel will put it to use.', '谢谢你。礼拜堂会派上用场的。'),
  ],
}
