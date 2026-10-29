// Maud, a pilgrim at the Rest with her daughter (docs/chapter-1.md §14): she set out for the Holy City to pray the days
// long again, and got as far as the Rest before she heard what lies east. She is waiting for someone to go first.

import { line, type PersonDef } from '../person.ts'

export const maud: PersonDef = {
  id: 'npc.maud',
  role: 'traveler',
  // of the Church: speak against the gods and they take it ill (content social.ts unbelief)
  tags: ['devout'],
  name: { en: 'Maud', zh: '莫德' },
  gender: 'female',
  look: { parts: { hair: 'hair.tied', face: 'face.soft', outfit: 'outfit.travel', hat: 'hat.kerchief' }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'light', 'outfit.1': 'russet', 'outfit.2': 'linen', 'outfit.3': 'leather', 'hat.1': 'linen' } },
  age: 34,
  temperament: { personality: 'warm', manner: 'plain', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.wynn': 'daughter' },
  trade: { stock: [['item/food/bread', 2], ['item/food/apple', 3], ['item/light/torch', 2]] },
  purse: 12,
  schedules: {
    default: [
      [21, 7, 'waystation.hostel:maud.bed', 'sleep'],
      [7, 21, 'waystation:maud.fire', 'sit by the pilgrims\' fire'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "Wynn asked me if the sun is tired. I told her no. But it really does get dark earlier every day, and I don't know what to tell her.", '温问我，太阳是不是累了。我跟她说没有。可天确实一天比一天黑得早，我也不知道该怎么跟她说。'),
    line('chat', 'We only packed enough food to reach the Holy City. Every day we stay here is a day of it gone.', '我们带的干粮只够走到圣城。在这儿多住一天，就少一天的口粮。'),
    line('greeting:first', "Are you a pilgrim too? I'm Maud, and this is my daughter, Wynn. We were meant to go all the way to the Holy City. When we got here, we heard there's a knight on the road east who lets no one past. So we stopped.", '你也是朝圣的吧？我叫莫德，这是我女儿温。我们本来要一路走到圣城去的。到了这儿才听说，东边的路上有个骑士拦着，谁也过不去。我们就停下来了。'),
    line('default', "Wynn's grandmother taught her a rhyme about the White Knight. It used to be sung to get children to sleep. Now when she sings it, the grown-ups go quiet.", '温的奶奶教过她一首白骑士的童谣。那首歌以前是哄孩子睡觉唱的。现在她一唱，旁边的大人就都不说话了。'),
    line('default', "The hostel book has a page of the names of people who went east. I read it every night. I know I shouldn't.", '客舍的名册里有一页，记的都是往东去的人。我每天晚上都去翻。我知道不该翻。', { mood: 'sad' }),
    line('fact:sins.defeated.alberic', "The road's open? Then we can go on. ...Thank you. Now I can teach Wynn the last verse of that rhyme. The one where he kneels.", '路通了？那我们可以接着走了。……谢谢你。现在我可以教温那首童谣的最后一段了，就是他跪下的那段。', { mood: 'happy' }),
  ],
}
