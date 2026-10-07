// Edda, the farmstead's survivor on the East Road (docs/chapter-1.md §7): the short days killed her
// crops, the night things came, and the grey man pulled her out. After the knight falls she moves to
// Firstlight (her schedule follows the story).

import { line, type PersonDef } from '../person.ts'

export const edda: PersonDef = {
  id: 'npc.edda',
  role: 'farmer',
  name: { en: 'Edda', zh: '艾达' },
  look: 'Villager5',
  age: 44,
  temperament: { personality: 'stubborn', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [0, 24, 'eastroad:edda.barn', 'hide in the barn'],
    ],
    'fact:sins.defeated.alberic': [
      [21, 7, 'meadow:edda.home', 'sleep'],
      [7, 21, 'meadow:edda.garden', 'work the village garden'],
    ],
  },
  lines: [
    line('greeting:first', 'Stay back! ...You\'re not one of them. Sorry. I don\'t see many living faces out here any more.', '别过来！……你不是那些东西。抱歉。这一带我很久没见过活人的脸了。'),
    line('default', 'The days got too short for the wheat. Then the night things came for what was left. The house is all I kept.', '白天短得麦子都长不成。后来夜里的东西把剩下的也夺走了。我只保住了这栋房子。'),
    line('default', 'There\'s a knight up the road, in white. He took my husband\'s ring off the gatepost. Took everything that shone.', '路那头有个白衣骑士。他从门柱上取走了我丈夫的戒指。凡是会发光的东西他都拿走了。'),
    line('fact:ch1.flame_stolen', 'A grey man came through, the night of the fire. He pulled me out of the smoke. Don\'t tell anyone in the village I said so.', '着火那天夜里，有个灰衣人路过。是他把我从烟里拉出来的。别跟村里人说是我讲的。'),
    line('fact:sins.defeated.alberic', 'The road is quiet again. I\'ll go to Firstlight — there\'s nothing to keep me here but ash.', '路上又安静了。我去初原村——这里除了灰烬，什么都留不住我了。', { once: true }),
  ],
}
