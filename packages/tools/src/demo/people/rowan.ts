// Rowan, the elder of Firstlight Village. Two of his foragers went down to the old barrow
// for shelter from the storm and did not come back; he asks anyone who can hold a weapon.

import { line, type PersonDef } from '../person.ts'

export const rowan: PersonDef = {
  id: 'npc.rowan',
  role: 'villager',
  name: { en: 'Rowan', zh: '罗万' },
  look: 'OldMan2',
  age: 67,
  temperament: { personality: 'grave', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [21, 7, 'meadow:elder.home', 'sleep'],
      [7, 21, 'meadow:elder.porch', 'keep watch over the square'],
    ],
  },
  lines: [
    line('default', 'The storm took more than the bridge. Two of ours went into the barrow and the dead keep them there.', '风暴带走的不止那座桥。我们有两个人躲进了古墓，被那里的亡灵困住了。'),
    line('default', 'Firstlight looks after its own. Today, that means asking you.', '初原村向来自己照顾自己。可今天，只能拜托你了。'),
  ],
}
