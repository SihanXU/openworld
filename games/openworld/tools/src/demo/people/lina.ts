// Lina, a forager of Firstlight. She ran into the old barrow out of the storm and the dead shut
// the way behind her. Freed, she goes home to the village.

import { line, type PersonDef } from '../person.ts'

export const lina: PersonDef = {
  id: 'npc.lina',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'villager',
  essential: true,
  name: { en: 'Lina', zh: '莉娜' },
  gender: 'female',
  look: { parts: { hair: 'hair.braid', face: 'face.soft', outfit: 'outfit.dress', hat: null, mark: null }, colors: { hair: 'chestnut', eyes: 'leaf', skin: 'fair', 'outfit.1': 'moss' } },
  age: 24,
  temperament: { personality: 'brave', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/material/herb', 4], ['item/food/berries', 6], ['item/food/mushroom/raw', 4], ['item/material/fireweed', 2]] },
  purse: 15,
  schedules: {
    default: [
      [0, 24, 'barrow:cell.lina', 'wait to be found'],
    ],
    'fact:rescue.lina': [
      [22, 7, 'meadow:lina.home', 'sleep'],
      [7, 22, 'meadow:lina.garden', 'tend the herbs'],
    ],
  },
  lines: [
    line('default', "Thank you for coming. I'd almost stopped counting the days.", '谢谢你来找我。我都快不数日子了。'),
    line('fact:rescue.lina', "I still dream of that barrow. But the herbs don't tend themselves.", '我还会梦见那座古墓。可草药不会自己长好。'),
    line('fact:rescue.lina', 'Someone shut the inner door on us. A grey man. But he left bread by the door with an ash mark on it. I don\'t understand.', '有人从外面把里面那道门关上了。是个灰衣人。可他在门边留了面包，上面有个灰印。我想不明白。'),
  ],
}
