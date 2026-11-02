// Dunn, a soldier of the Left Company: cheerful, twenty-four, nine years at the bridge end. He walks about with an arrow
// in his shoulder and a spear wound under his ribs, and dies on his feet at the dusk the pilgrim sees (docs/chapter-2.md §6).

import { line, type PersonDef } from '../person.ts'

export const dunn: PersonDef = {
  id: 'npc.dunn',
  role: 'soldier',
  name: { en: 'Dunn', zh: '邓恩' },
  gender: 'male',
  look: { parts: { hair: 'hair.messy', face: 'face.bright', outfit: 'outfit.gambeson', hat: null, beard: null }, colors: { hair: 'honey', eyes: 'sky', skin: 'fair', 'outfit.1': 'madder', 'outfit.2': 'undyed', 'outfit.3': 'iron' } },
  age: 24,
  favourite: 'item/food/bread',
  temperament: { personality: 'cheerful', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.wil': 'gives him the burnt bits' },
  fights: true,
  purse: 6,
  trade: { stock: [['item/food/bread', 1]] },
  schedules: {
    default: [
      [22, 6, 'redcamp:dunn.bed', 'sleep'],
      [6, 22, 'redcamp:dunn.fire', 'sit by the pot'],
    ],
    // (killed on his feet at the dusk the pilgrim sees)
    'fact:ch2.dusk': [[0, 24, 'offstage:dunn.gone', 'gone']],
  },
  lines: [
    line('chat', 'Vera wants this arrow out. I keep forgetting it is there.', '薇拉说要把这支箭拔掉。我老是忘了它还在那儿。'),
    line('chat', 'I have been in the Left since I was fifteen. Nine years of dusks.', '我十五岁就进了左营。打了九年的黄昏。'),
    line('default', 'Supper is at the pot. Wil burns it, but it is hot.', '吃的在锅里。威尔煮糊了，不过是热的。'),
    line('given:item/food/bread', 'Bread that isn\'t burnt! You\'re a friend.', '没烧糊的面包！你够朋友。', { mood: 'happy' }),
  ],
}
