// Holt, the village's one guard. He watches the trail south, where the things of the hollow
// come up the way the storm left open.

import { line, type PersonDef } from '../person.ts'

export const holt: PersonDef = {
  id: 'npc.holt',
  role: 'guard',
  essential: true,
  name: { en: 'Holt', zh: '霍尔特' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.keen', outfit: 'outfit.gambeson', hat: null, beard: null }, colors: { hair: 'umber', eyes: 'storm', skin: 'light', 'outfit.1': 'madder' } },
  age: 38,
  temperament: { personality: 'dutiful', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  // he keeps the village's watch (docs/npc-sandbox.md §2.7): he stops the wanted, and fights back
  watch: 'firstlight',
  fights: true,
  purse: 15,
  schedules: {
    default: [
      [23, 6, 'meadow:guard.home', 'sleep'],
      [6, 23, 'meadow:guard.post', 'watch the south trail'],
    ],
  },
  lines: [
    line('default', 'Peace inside the fence. Past the grassland, keep your blade out — and after dark, keep it out everywhere.', '围栏里是太平的。过了草原就把刀拔出来——天黑以后，哪儿都得拔着。'),
    line('hour:night', 'Hear that shuffling? The dead walk the wild at night. Not here, though. Never here.', '听见那拖着脚的声音没？夜里荒野上有亡灵游荡。不过不会进村，从来不会。'),
    line('fact:ch1.flame_stolen', 'I had him. I had him at the length of my spear, and he looked at me like I was a child, and walked away on the water.', '我差点就抓住他了。他就在我长矛够得着的地方，他看我的眼神像在看个孩子，然后踩着水走了。', { mood: 'angry' }),
    line('fact:ch1.end', 'When you go on east, I want to come. Someone has to catch that thief.', '你接着往东走的时候，我想跟着去。总得有人抓住那个贼。'),
  ],
}
