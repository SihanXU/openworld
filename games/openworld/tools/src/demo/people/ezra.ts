// Brother Ezra, a penitent on the Pilgrim's Road (docs/chapter-1.md §14): he scourges himself to take a little of the
// Seal-bearers' pain, as the Church teaches the faithful may. He once reached the Kneeling Field, and the knight there
// was mending a flag. He has never told anyone that the knight looked at him as if he had forgotten what hands were for.

import { line, type PersonDef } from '../person.ts'

export const ezra: PersonDef = {
  id: 'npc.ezra',
  role: 'traveler',
  // of the Church: speak against the gods and they take it ill (content social.ts unbelief)
  tags: ['devout'],
  name: { en: 'Brother Ezra', zh: '以斯拉修士' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.travel', beard: 'beard.stubble' }, colors: { hair: 'umber', eyes: 'hazel', skin: 'warm', 'outfit.1': 'undyed', 'outfit.2': 'linen', 'outfit.3': 'leather' } },
  age: 37,
  temperament: { personality: 'earnest', manner: 'plain', social: 'reserved', outlook: 'hopeful' },
  ties: {},
  // (no rope: he has given the shrines all his cords)
  trade: { stock: [['item/material/herb', 2], ['item/food/bread', 1], ['item/light/candle', 1]] },
  purse: 3,
  schedules: {
    default: [
      [20, 6, 'pilgrimway:ezra.camp', 'sleep'],
      [6, 20, 'pilgrimway:ezra.road', 'kneel by the road'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'My feet are bad this year. I wrap them in rags each morning and walk until the rags wear through. Then I stop for the day.', '今年我的脚不大好。每天早上拿布条缠上，走到布条磨穿了，这一天就不走了。'),
    line('chat', 'At the Rest they give you bread when you set out. I gave mine to a family on the road in the first week. Since then I eat what people give me.', '出发的时候，驿站会给每人发面包。头一个礼拜，我就把我那份给了路边的一家人。从那以后，别人给什么我就吃什么。'),
    line('greeting:first', 'I\'m Ezra, a penitent. Every year I walk a little further east along this road, and kneel at the shrines.', '我叫以斯拉，是个苦修的人。我每年都沿着这条路往东多走一段，在圣龛前跪拜。'),
    line('default', 'Each shrine wants what its suffering asks. The crown wants something for the head; the scourge wants a cord. I have given them all my cords.', '每座圣龛要的，是它那一苦的东西。荆冠那座要戴在头上的，鞭刑那座要一根绳。我的绳子全都给出去了。'),
    line('default', 'At the Rest they taught me that every stroke I take is one Astra need not. So every evening I take a few.', '驿站里教我，我每挨一鞭，阿斯特拉就能少挨一鞭。所以每天晚上，我都抽自己几下。'),
    line('default', 'The abbey up the hill is where they made him a knight. I won\'t go in. The dead there still keep the hours.', '山上那座修道院，是他受封骑士的地方。我不进去。里面的死人，到现在还按着时辰念祷文。'),
    line('fact:ch1.shrines', 'All five burning. I have walked this road eleven years and never seen them all lit at once. Go up to the abbey, pilgrim.', '五座都点亮了。我在这条路上走了十一年，从没见过五座同时亮着。上山去修道院吧，朝圣者。', { once: true, mood: 'happy' }),
    line('fact:sins.defeated.alberic', 'They say he knelt at the end. To you. I saw him once, years ago, sitting in the field mending a flag. I did not think then that he wanted to fight anyone.', '听说他最后跪下了，是向你跪的。我早些年见过他一回，他坐在田里补一面旗子。那时候我就觉得，他并不想跟谁打。', { mood: 'sad' }),
  ],
}
