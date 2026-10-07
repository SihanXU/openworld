// Oskar, the oldest forager of Firstlight. He followed Lina into the barrow to bring her out,
// and was shut in with her.

import { line, type PersonDef } from '../person.ts'

export const oskar: PersonDef = {
  id: 'npc.oskar',
  role: 'villager',
  name: { en: 'Oskar', zh: '奥斯卡' },
  look: 'OldMan',
  age: 63,
  temperament: { personality: 'stubborn', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [0, 24, 'barrow:cell.oskar', 'wait to be found'],
    ],
    'fact:rescue.oskar': [
      [21, 7, 'meadow:oskar.home', 'sleep'],
      [7, 21, 'meadow:oskar.bench', 'mend baskets'],
    ],
  },
  lines: [
    line('default', 'Took you long enough. Well — thank you.', '来得够慢的。好吧——谢谢你。'),
    line('fact:rescue.oskar', "Baskets don't mend themselves, and neither do old men. Both take time.", '篮子不会自己补好，老头子也一样。都得慢慢来。'),
    line('fact:rescue.oskar', 'The dead in there would not lie down. I have buried my share. They always lay down before.', '那里面的死人不肯躺下。我也埋过不少人了。以前他们总是会躺下的。'),
  ],
}
