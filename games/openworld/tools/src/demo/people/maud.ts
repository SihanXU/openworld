// Maud, a pilgrim at the Rest with her daughter (docs/chapter-1.md §14): she set out for the Holy City to pray the days
// long again, and got as far as the Rest before she heard what lies east. She is waiting for someone to go first.

import { line, type PersonDef } from '../person.ts'

export const maud: PersonDef = {
  id: 'npc.maud',
  role: 'traveler',
  name: { en: 'Maud', zh: '莫德' },
  gender: 'female',
  look: { parts: { hair: 'hair.tied', face: 'face.soft', outfit: 'outfit.travel', hat: 'hat.kerchief' }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'light', 'outfit.1': 'russet', 'outfit.2': 'linen', 'outfit.3': 'leather', 'hat.1': 'linen' } },
  age: 34,
  temperament: { personality: 'warm', manner: 'plain', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.wynn': 'daughter' },
  trade: { stock: [['item/food/bread', 2], ['item/food/apple', 3], ['item/light/torch', 2]] },
  purse: 12,
  schedules: {
    default: [
      [21, 7, 'waystation.hostel:maud.bed', 'sleep'],
      [7, 21, 'waystation:maud.fire', 'sit by the pilgrims\' fire'],
    ],
  },
  lines: [
    line('greeting:first', 'Another pilgrim? You\'re braver than me. We were meant to go on to the Holy City. Then we heard about the knight.', '又一个朝圣者？你比我勇敢。我们本来要去圣城的。后来听说了那个骑士的事。'),
    line('default', 'Wynn\'s grandmother taught her a rhyme about the White Knight. It used to be a nice rhyme.', '温的奶奶教过她一首关于白骑士的童谣。以前那是首好听的童谣。'),
    line('default', 'The hostel book has a page of names that went east. I read it every night. I shouldn\'t.', '客舍的名册里有一页，全是往东去了的人名。我每晚都翻。我不该翻的。', { mood: 'sad' }),
    line('fact:sins.defeated.alberic', 'The road\'s open? Then we can go on. ...Thank you. I\'ll teach Wynn the last verse of that rhyme now. The one about him kneeling.', '路通了？那我们可以继续上路了。……谢谢你。现在我可以教温那首童谣的最后一段了。讲他下跪的那段。', { mood: 'happy' }),
  ],
}
