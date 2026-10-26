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
    line('chat', 'I am too old for barrows and too stubborn to say so. You noticed, I suppose.', '我太老了，不该进古墓；又太犟，不肯承认。你大概看出来了。'),
    line('chat', 'The best mushrooms grow where nobody looks. The second best grow where Lina looks.', '最好的蘑菇长在没人看的地方。第二好的长在莉娜看的地方。'),
    line('default', 'Took you long enough. Well — thank you.', '来得够慢的。好吧——谢谢你。'),
    line('fact:rescue.oskar', "Baskets don't mend themselves, and neither do old men. Both take time.", '篮子不会自己补好，老头子也一样。都得慢慢来。'),
    line('fact:rescue.oskar', 'The dead in there would not lie down. I have buried my share. They always lay down before.', '那里面的死人不肯躺下。我也埋过不少人了。以前他们总是会躺下的。'),
    line('fact:rescue.oskar', "She says she was sheltering from the storm. Who shelters from a storm three floors down? ...Never mind. She came back.", '她说是躲风暴。谁躲风暴会往下钻三层？……算了。人回来就行。'),
  ],
}
