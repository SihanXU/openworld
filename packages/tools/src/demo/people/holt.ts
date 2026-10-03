// Holt, the village's one guard. He watches the trail south, where the things of the hollow
// come up the way the storm left open.

import { line, type PersonDef } from '../person.ts'

export const holt: PersonDef = {
  id: 'npc.holt',
  role: 'guard',
  name: { en: 'Holt', zh: '霍尔特' },
  look: 'Knight',
  age: 38,
  temperament: { personality: 'dutiful', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [23, 6, 'meadow:guard.home', 'sleep'],
      [6, 23, 'meadow:guard.post', 'watch the south trail'],
    ],
  },
  lines: [
    line('default', 'Peace inside the fence. Past the grassland, keep your blade out — and after dark, keep it out everywhere.', '围栏里是太平的。过了草原就把刀拔出来——天黑以后，哪儿都得拔着。'),
    line('hour:night', 'Hear that shuffling? The dead walk the wild at night. Not here, though. Never here.', '听见那拖着脚的声音没？夜里荒野上有亡灵游荡。不过不会进村，从来不会。'),
  ],
}
