// Primate Aurelian, head of the Church of the Five Sufferings (docs/finale.md §5): eighty-one, old and tired. He keeps the
// deepest doctrine — there must always be an Astra — and tells the pilgrim the truth plainly, and is not believed.

import { line, type PersonDef } from '../person.ts'

export const primate: PersonDef = {
  id: 'npc.primate',
  role: 'priest',
  essential: true,
  tags: ['storybound', 'devout'],
  name: { en: 'Primate Aurelian', zh: '首席司祭奥勒良' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.vestment', beard: 'beard.full', hat: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'fair', 'outfit.1': 'ivory', 'outfit.2': 'gold', 'outfit.3': 'gold' } },
  age: 81,
  favourite: 'item/light/candle',
  temperament: { personality: 'weary', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: {},
  purse: 50,
  trade: { stock: [['item/light/candle', 4], ['item/vessel/flask/holy_water', 2]] },
  schedules: {
    default: [
      [22, 6, 'holyhall.nave:primate.choir', 'sleep in his chair'],
      [6, 22, 'holyhall.nave:primate.altar', 'keep the high altar'],
    ],
  },
  lines: [
    line('chat', 'I lit the candles myself this morning. All of them. I wanted to have done one thing today with my own hands.', '今天早上，蜡烛是我亲手点的。全部。我想在今天，用自己的手做完一件事。'),
    line('chat', 'The Church has had forty-one Primates. Each was told what I was told, on the day he was chosen. Each kept it.', '教会一共有过四十一位首席司祭。每一位在被选中的那天，都听过我听过的话。每一位都守住了。'),
    line('greeting:first', 'Bearer. I am Aurelian, Primate of the Five. I have waited for you, and dreaded you, for a long time.', '承担者。我是奥勒良，五苦的首席司祭。我等了你很久，也怕了你很久。', { once: true }),
    line('default', 'There must always be one who bears it. That is the whole of our doctrine, under all the rest. I am sorry it is so short.', '必须永远有一个人承担它。在所有教义底下，我们的教义就只有这一句。很抱歉，它这么短。'),
    line('fact:fin.primate', 'Go down. I will be here when it is over, whichever way it goes.', '下去吧。等一切结束，不管是哪一种结局，我都会在这里。'),
  ],
}
