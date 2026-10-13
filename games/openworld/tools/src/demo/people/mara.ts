// Mara, the elder of Emberfall. She has buried two husbands and one dragon-burned harvest, and
// she will not bury the village. She keeps the square by day and counts the buckets at the well.

import { line, type PersonDef } from '../person.ts'

export const mara: PersonDef = {
  id: 'npc.mara',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'elder',
  essential: true,
  name: { en: 'Mara', zh: '玛拉' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.shawl', hat: null }, colors: { hair: 'snow', eyes: 'bark', skin: 'light', 'outfit.1': 'plum', 'outfit.2': 'undyed' } },
  age: 71,
  temperament: { personality: 'steady', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.garrick': 'the smith she trusts with the village gate', 'npc.wren': 'the herbalist she taught her letters' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/document/map', 1], ['item/food/apple', 4], ['item/vessel/flask/oil', 2]] },
  purse: 40,
  schedules: {
    default: [
      [21, 7, 'emberfall:elder.home', 'sleep'],
      [7, 21, 'emberfall:elder.square', 'keep the square'],
    ],
  },
  lines: [
    line('default', 'Keep the buckets full. That is all the advice I have, and it is not enough.', '把水桶都装满。我能给的忠告就这一句，而且远远不够。'),
    line('default', 'Cinder Peak used to be a name for a mountain. Now it is a name for a fear.', '烬峰以前只是座山的名字。现在成了害怕的代名词。'),
    line('fact:mq.blade', 'Garrick has forged it, then. I heard the hammer all night.', '加里克锻好了。我听了一夜的锤子声。', { once: true }),
    line('fact:mq.draught', 'Wren\'s draught. Drink it at the lair\'s mouth, not before — it does not last.', '雷恩的药剂。到巢穴门口再喝，别早喝——药效不长。', { once: true }),
    line('fact:mq.dragon', 'You did it. I will have your name cut into the well. Do not argue.', '你做到了。我要把你的名字刻在井上。别跟我争。', { once: true, mood: 'happy' }),
    line('given', 'For the village? Thank you.', '给镇子的？谢谢你。'),
  ],
}
