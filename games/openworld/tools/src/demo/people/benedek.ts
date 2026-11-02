// Abbot Benedek of Whiteveil (docs/chapter-5.md §7): seventy-two. He robes the dead pilgrims and keeps the roll; he knows the
// selection and calls it holy, terribly calm: "The road chooses, and it has chosen you."

import { line, type PersonDef } from '../person.ts'

export const benedek: PersonDef = {
  id: 'npc.benedek',
  role: 'priest',
  essential: true,
  tags: ['storybound', 'devout'],
  name: { en: 'Abbot Benedek', zh: '本尼德克院长' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.soft', outfit: 'outfit.vestment', beard: 'beard.full', hat: null }, colors: { hair: 'snow', eyes: 'sky', skin: 'fair', 'outfit.1': 'snow', 'outfit.2': 'indigo', 'outfit.3': 'gold' } },
  age: 72,
  favourite: 'item/light/candle',
  temperament: { personality: 'serene', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.agathe': 'a sister of his house', 'npc.tomas': 'his novice' },
  purse: 20,
  trade: { stock: [['item/light/candle', 3], ['item/vessel/flask/holy_water', 2], ['item/material/cloth', 2]] },
  schedules: {
    default: [
      [21, 5, 'whiteveil.robing:benedek.bed', 'sleep'],
      [5, 10, 'whiteveil.church:benedek.altar', 'keep the altar'],
      [10, 15, 'whiteveil:benedek.garth', 'walk the garth'],
      [15, 21, 'whiteveil.robing:benedek.desk', 'write in the roll'],
    ],
  },
  lines: [
    line('chat', 'Every pilgrim the road gives us, I write into the roll myself. Four hundred years, and the hand has never changed but for the abbot\'s.', '道路送来的每一个朝圣者，我都亲手写进名册。四百年了，字迹从没变过，变的只是院长。'),
    line('chat', 'The white robe is the last thing the abbey gives a pilgrim. It is the finest cloth on the mountain. We do not stint.', '白袍是修道院给朝圣者的最后一样东西。那是山上最好的布。我们从不吝惜。'),
    line('greeting:first', 'Peace on you, pilgrim. I am Benedek, abbot of Whiteveil. We keep the ones who did not finish the road.', '愿你平安，朝圣者。我是白纱修道院的院长本尼德克。我们守着那些没有走完这条路的人。', { once: true }),
    line('default', 'They were told to rest yet a little while, until the number of their fellows should be fulfilled. We do not know the number. We robe them, and we wait.', '他们被吩咐再安息片时，等他们同伴的数目满足。我们不知道那个数目。我们给他们穿上白袍，然后等。'),
    line('default', 'Every one of them was chosen. The road chooses. It has chosen you, I think.', '他们每一个都是被拣选的。是道路在拣选。我想，它拣选了你。'),
    line('fact:ch5.roll', 'You read it. Then you know what you are walking. Few do, until the end. It is a kindness the Church gives them, not knowing.', '你读过了。那你就知道自己走的是什么路了。很少有人知道，直到最后。不知道，是教会给他们的慈悲。'),
    line('topic:it_is_enough', 'They are quiet. I went down this evening and there was no sound at all. I did not know there could be so much silence under one church.', '他们安静了。今晚我下去了一趟，一点声音都没有。我从来不知道一座教堂底下，能有这么多的寂静。', { mood: 'sad' }),
    line('given:item/light/candle', 'A candle for the catacombs. They will not need it now. I will light it anyway.', '给墓窟的一支蜡烛。如今他们用不着了。我还是会点上。', { mood: 'happy' }),
  ],
}
