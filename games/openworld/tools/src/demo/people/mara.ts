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
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "I've buried two husbands, and I've watched the dragon burn a whole season's wheat to ash. I am not leaving this town.", '我送走过两个丈夫，也眼看着那条龙把一整季的麦子烧成了灰。这个镇子，我不会丢下。'),
    line('chat', 'This well is forty-one buckets deep. I counted them one by one the year it nearly ran dry.', '这口井有四十一桶深。差点干掉的那年，我一桶一桶数过。'),
    line('default', "Every house keeps two full buckets at the door, day and night. When the dragon's fire comes down, there is no time to run to the well.", '镇上每家门口都要摆两桶水，白天黑夜都不许空着。龙火落下来的时候，再跑去井边就来不及了。'),
    line('default', 'The dragon nests up on Cinder Peak. We used to go up there for wood and to graze the sheep. Nobody goes that way now.', '那条龙的巢在烬峰上。以前我们上山砍柴、放羊，现在没人敢往那边走了。'),
    line('fact:mq.blade', 'Garrick has finished the blade, then. I heard his hammer all night.', '加里克把剑打好了吧。我听了一整夜的锤子声。', { once: true }),
    line('fact:mq.draught', "Wren's draught. Drink it at the mouth of the lair, not before. It doesn't last long.", '雷恩的药。到了巢穴门口再喝，别喝早了，药劲撑不了多久。', { once: true }),
    line('fact:mq.dragon', 'You did it. I will have your name cut into the well. Do not argue.', '你做到了。我要把你的名字刻在井上。别跟我争。', { once: true, mood: 'happy' }),
    line('given', 'For the town? Thank you.', '给镇上的？谢谢你。'),
  ],
}
