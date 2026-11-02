// Vera, the Red Host's surgeon (docs/chapter-2.md §7): dry, exact, tired. Nobody comes to her tent. After every dusk she
// walks the line and writes down the wounds men walk about with, and the names of those who died on their feet.

import { line, type PersonDef } from '../person.ts'

export const vera: PersonDef = {
  id: 'npc.vera',
  role: 'healer',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Vera', zh: '薇拉' },
  gender: 'female',
  look: { parts: { hair: 'hair.tied', face: 'face.weary', outfit: 'outfit.coat', hat: null }, colors: { hair: 'umber', eyes: 'hazel', skin: 'light', 'outfit.1': 'slate', 'outfit.2': 'linen' } },
  age: 38,
  favourite: 'item/material/herb',
  temperament: { personality: 'exact', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.brannoc': 'her captain' },
  purse: 30,
  trade: { stock: [['item/potion/healing', 3], ['item/material/cloth', 2], ['item/potion/antidote', 1]] },
  schedules: {
    default: [
      [22, 6, 'redcamp.hospital:vera.bed', 'sleep'],
      [6, 17, 'redcamp.hospital:vera.ward', 'keep the field hospital'],
      [17, 20, 'redcamp:vera.round', 'walk the line'],
      [20, 22, 'redcamp.hospital:vera.ward', 'write the ledger'],
    ],
  },
  lines: [
    line('chat', 'I trained in the Holy City. They taught me that pain tells a man where he is hurt. I had to come here to see what happens without it.', '我是在圣城学的医。他们教我，疼会告诉一个人伤在哪里。我到了这儿，才看见没有疼会怎么样。'),
    line('chat', 'I roll bandages in the evenings. The shelf is full. Nobody takes them.', '我每天晚上卷绷带。架子都摆满了，没人来拿。'),
    line('greeting:first', 'A visitor who is not bleeding. Or are you? Nobody here would know. I am Vera, the Host\'s surgeon. My tent is the one nobody comes to.', '来了个没在流血的客人。还是说你在流？这里的人谁也不会知道。我叫薇拉，赤军的军医。我的帐篷，就是没人来的那一顶。', { once: true }),
    line('default', 'After every dusk I walk the line and write down what I see. I write a great deal, and I do very little.', '每次黄昏过后，我都沿着队列走一遍，把看见的写下来。我写得很多，做得很少。'),
    line('hour:night', 'Go and sleep. I will be up with the ledger.', '去睡吧。我还要把账簿记完。'),
    line('fact:ch2.dusk', 'Dunn is in my book now, with the others. That makes three this month.', '邓恩现在也记在我的本子上了，跟别人一起。这个月第三个。', { mood: 'sad' }),
    line('topic:dunn', 'He told me it was nothing. They all tell me that.', '他跟我说没什么。他们都这么跟我说。', { mood: 'sad' }),
    line('topic:quiet_dusk', 'I have not slept, and I do not mind. They come to my tent now. All of them.', '我一夜没睡，可我不在乎。现在他们都来我的帐篷了。所有人都来了。'),
    line('given:item/material/herb', 'Herbs. Good. These will be used, now.', '草药。好。现在这些用得上了。', { mood: 'happy' }),
  ],
}
