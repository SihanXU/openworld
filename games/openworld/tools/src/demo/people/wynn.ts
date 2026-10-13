// Wynn, Maud's daughter (docs/chapter-1.md §14): eight, and sure of everything. She knows a rhyme about the White Knight
// her grandmother sang, from when he still knelt to children.

import { line, type PersonDef } from '../person.ts'

export const wynn: PersonDef = {
  id: 'npc.wynn',
  role: 'child',
  name: { en: 'Wynn', zh: '温' },
  gender: 'female',
  look: { parts: { hair: 'hair.pigtails', face: 'face.child', outfit: 'outfit.pinafore' }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'light', 'outfit.1': 'woad', 'outfit.2': 'ivory' } },
  age: 8,
  temperament: { personality: 'bold', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.maud': 'mother' },
  trade: { stock: [['item/material/stick', 3], ['item/food/berries', 2]] },
  purse: 1,
  schedules: {
    default: [
      [20, 7, 'waystation.hostel:wynn.bed', 'sleep'],
      [7, 20, 'waystation:wynn.play', 'play by the well'],
    ],
  },
  lines: [
    line('greeting:first', 'Is that a FAIRY? Can she do magic? Can she do the White Knight\'s rhyme? I can.', '那是精灵吗？她会魔法吗？她会唱白骑士的童谣吗？我会。'),
    line('default', '"The White Knight rides, the White Knight bends, / he mends your kite and he minds your friends, / he kneels to the small and he stands for the weak—" ...Gran never finished it. She said the end went wrong.', '"白骑士骑马来，白骑士弯下腰，/ 帮你补风筝，替你看朋友，/ 他向小孩子下跪，替弱者站着——"……奶奶从来没唱完。她说结尾变了。'),
    line('default', 'Mama says we\'re not going east. I think the knight just forgot the end of his rhyme.', '妈妈说我们不往东走了。我觉得那个骑士只是忘了他那首童谣的结尾。'),
    line('fact:sins.defeated.alberic', 'You saw him? Did he kneel? I KNEW he would. That\'s the end of the rhyme: "and when they come, he kneels again."', '你见到他了？他跪下了吗？我就知道他会的。那就是童谣的结尾："等他们来了，他又会跪下。"', { mood: 'happy' }),
  ],
}
