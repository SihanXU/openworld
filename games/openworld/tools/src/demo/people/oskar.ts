// Oskar, the oldest forager of Firstlight. He followed Lina into the barrow to bring her out,
// and was shut in with her.

import { line, type PersonDef } from '../person.ts'

export const oskar: PersonDef = {
  id: 'npc.oskar',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'villager',
  essential: true,
  name: { en: 'Oskar', zh: '奥斯卡' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.tunic', beard: 'beard.full', hat: null }, colors: { hair: 'snow', eyes: 'hazel', skin: 'warm', 'outfit.1': 'moss', 'outfit.2': 'umber' } },
  age: 63,
  temperament: { personality: 'stubborn', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/food/mushroom/raw', 4], ['item/material/herb', 3], ['item/material/feather', 3]] },
  purse: 15,
  schedules: {
    default: [
      [0, 24, 'ossuary:cell.oskar', 'wait to be found'],
    ],
    'fact:rescue.oskar': [
      [21, 7, 'meadow.guards:bed.2', 'sleep'],
      [7, 21, 'meadow:oskar.bench', 'mend baskets'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'My knees are finished, and those barrow steps nearly finished the rest of me. Next time someone crawls into a barrow, they can crawl back out on their own.', '我这膝盖早就不中用了，长眠冢那些台阶差点要了我的老命。下回谁再往长眠冢里钻，让他自己爬出来。'),
    line('chat', 'I taught Lina which mushrooms you can eat, back when she was small. Now she finds them before I do. Cheeky girl.', '哪些蘑菇能吃，是我在莉娜很小的时候教她的。现在倒好，她总比我先找到。这丫头。'),
    line('default', 'Took you long enough. Well — thank you.', '来得够慢的。好吧——谢谢你。'),
    line('fact:rescue.oskar', 'Mending baskets. I lost two down in the barrow and the rest got crushed. My hands still shake, so it goes slow.', '在补篮子呢。在长眠冢里丢了两个，剩下的也压坏了。手还在抖，补得慢。'),
    line('fact:rescue.oskar', "The dead down there wouldn't stay lying down. I've buried my share of people, and they always stayed down before.", '下面那些死人不肯躺着。我这辈子也埋过不少人，以前埋下去的，从来都老老实实躺着。'),
    line('fact:rescue.oskar', "She says she was sheltering from the storm. Who shelters from a storm three floors down? ...Never mind. She came back.", '她说是躲风暴。谁躲风暴会往下钻三层？……算了。人回来就行。'),
  ],
}
