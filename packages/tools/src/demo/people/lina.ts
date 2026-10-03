// Lina, a forager of Firstlight. She ran into the old barrow out of the storm and the dead shut
// the way behind her. Freed, she goes home to the village.

import { line, type PersonDef } from '../person.ts'

export const lina: PersonDef = {
  id: 'npc.lina',
  role: 'villager',
  name: { en: 'Lina', zh: '莉娜' },
  look: 'Woman',
  age: 24,
  temperament: { personality: 'brave', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
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
  ],
}
