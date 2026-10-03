// Mia, the cook's daughter. She followed the foragers as far as the thorns and lost her
// grandmother's ring there.

import { line, type PersonDef } from '../person.ts'

export const mia: PersonDef = {
  id: 'npc.mia',
  role: 'villager',
  name: { en: 'Mia', zh: '米娅' },
  look: 'Child',
  age: 9,
  temperament: { personality: 'bright', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
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
