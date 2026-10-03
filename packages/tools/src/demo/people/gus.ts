// Gus splits the village's wood. His back is not what it was, and the fire wants feeding every day.

import { line, type PersonDef } from '../person.ts'

export const gus: PersonDef = {
  id: 'npc.gus',
  role: 'farmer',
  name: { en: 'Gus', zh: '格斯' },
  look: 'Villager4',
  age: 51,
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'hopeful' },
  ties: {},
  schedules: {
    default: [
      [21, 6, 'meadow:wood.home', 'sleep'],
      [6, 21, 'meadow:wood.pile', 'split wood'],
    ],
  },
  lines: [
    line('default', 'Every day the fire eats. Every day I feed it. My back has opinions about this.', '火天天都要吃，我天天都得喂。我的腰对此很有意见。'),
  ],
}
