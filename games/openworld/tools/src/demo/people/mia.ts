// Mia, the cook's daughter. She followed the foragers as far as the thorns and lost her
// grandmother's ring there.

import { line, type PersonDef } from '../person.ts'

export const mia: PersonDef = {
  id: 'npc.mia',
  role: 'villager',
  essential: true,
  name: { en: 'Mia', zh: '米娅' },
  gender: 'female',
  look: { parts: { hair: 'hair.pigtails', face: 'face.child', outfit: 'outfit.pinafore', mark: 'mark.freckles' }, colors: { hair: 'honey', eyes: 'sky', skin: 'light', 'outfit.1': 'rose' } },
  age: 9,
  temperament: { personality: 'bright', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/food/berries', 4], ['item/food/egg/boiled', 2]] },
  purse: 5,
  schedules: {
    default: [
      [20, 7, 'meadow:cook.home', 'sleep'],
      [7, 20, 'meadow:pond.edge', 'skip stones'],
    ],
  },
  lines: [
    line('default', "I'm not supposed to go past the forest. I didn't. Much.", '我不该跑到森林那边去的。我没去。也就……去了一点点。'),
    line('default', "Do frogs sleep? This one doesn't.", '青蛙睡觉吗？这只不睡。'),
  ],
}
