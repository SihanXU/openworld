// Sister Agathe of Whiteveil (docs/chapter-5.md §7): fifty. She has sewn two thousand robes for the white-robed, and is
// sewing one now to the pilgrim's measure, and will not say for whom.

import { line, type PersonDef } from '../person.ts'

export const agathe: PersonDef = {
  id: 'npc.agathe',
  role: 'priest',
  tags: ['storybound', 'devout'],
  name: { en: 'Sister Agathe', zh: '阿加特修女' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.keen', outfit: 'outfit.robe', hat: 'hat.kerchief' }, colors: { hair: 'steelgrey', eyes: 'hazel', skin: 'light', 'outfit.1': 'ivory', 'hat.1': 'ivory' } },
  age: 50,
  favourite: 'item/material/cloth',
  temperament: { personality: 'exact', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.benedek': 'her abbot' },
  purse: 6,
  trade: { stock: [['item/material/cloth', 3], ['item/material/wool', 2]] },
  schedules: {
    default: [
      [21, 5, 'whiteveil.cells:bed.1', 'sleep'],
      [5, 21, 'whiteveil.robing:agathe.frame', 'sew a robe'],
    ],
  },
  lines: [
    line('chat', 'Two thousand and eleven. I count them on the frame. I have never sewn one twice.', '两千零十一件。我在架子上数着。我从没给同一个人缝过两次。'),
    line('chat', 'The measure is taken by eye. I have never needed to touch a pilgrim to know their size.', '尺寸是用眼睛量的。我从来不用碰朝圣者，就知道他们的身量。'),
    line('greeting:first', 'Agathe. I sew. Stand still a moment. ...Thank you.', '阿加特。我缝衣服。站着别动。……谢谢。', { once: true }),
    line('default', 'Every one who comes up the stair, I look at once. A tailor\'s eye. You learn to measure a body in a glance.', '每个爬上石阶的人，我都看一眼。裁缝的眼睛。一眼就能量出一个人的身量。'),
    line('fact:ch5.roll', 'It will be ready. I sew them before, so no one has to wait.', '会缝好的。我都提前缝，免得有人要等。'),
    line('topic:it_is_enough', 'I have stopped. I sat at the frame this evening and could not make the needle go in. ...I do not think I will finish this one.', '我停下了。今晚我坐在架子前，针怎么也扎不进去。……我想这一件我缝不完了。', { mood: 'sad' }),
    line('given:item/material/cloth', 'Linen. Good. I will save it for something that is not a robe.', '麻布。好。我留着做件不是袍子的东西。', { mood: 'happy' }),
  ],
}
