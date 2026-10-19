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
    line('chat', 'The road teaches the feet before it teaches the heart. My feet have learnt a great deal.', '路先教会脚，再教会心。我的脚已经学了很多。'),
    line('chat', 'At the Rest they give you bread. On the road you give it away. That is the whole pilgrimage, if you ask me.', '在驿站他们给你面包。在路上你把它送出去。要我说，这就是整个朝圣。'),
    line('greeting:first', 'Ezra. A penitent. I walk the road east a little further every year, and kneel at the shrines.', '我叫以斯拉，一个苦修者。我每年都往东多走一小段，在圣龛前跪拜。'),
    line('default', 'The shrines want what their suffering asks. The crown, something for the head. The scourge, a cord. I have given them all my cords.', '圣龛要的是它那一苦要的东西。荆冠要头上戴的东西，鞭刑要一根绳。我的绳子都已经给它们了。'),
    line('default', 'Every stroke I take is one Astra need not. That is what they taught me at the Rest. It helps, to think it helps.', '我每挨一下，阿斯特拉就少挨一下。驿站里是这么教我的。能让人觉得有用，本身就有用。'),
    line('default', 'The abbey up the hill is where they made him a knight. I won\'t go in. The dead there still keep the hours.', '山上那座修道院，是他受封为骑士的地方。我不会进去。那里的死人还在按时辰守祷。'),
    line('fact:ch1.shrines', 'All five burning. I have walked this road eleven years and never seen them all lit at once. Go up to the abbey, pilgrim.', '五座全亮了。我在这条路上走了十一年，从没见过它们同时亮起。去山上的修道院吧，朝圣者。', { once: true, mood: 'happy' }),
    line('fact:sins.defeated.alberic', 'He knelt at the last, they say. To you. I think he had been waiting three hundred years for someone he could kneel to.', '听说他最后跪下了。向你。我想他等了三百年，就是在等一个他能向之下跪的人。', { mood: 'sad' }),
  ],
}
