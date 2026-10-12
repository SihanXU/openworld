// Wren, the herbalist. Young, quick, and the only one in Emberfall who has read about dragons
// rather than only feared them. Her cauldron is always on.

import { line, type PersonDef } from '../person.ts'

const CAULDRON = { uses: 'emberfall.cauldron', need: { status: ['lit'] } }

export const wren: PersonDef = {
  id: 'npc.wren',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'herbalist',
  essential: true,
  name: { en: 'Wren', zh: '雷恩' },
  gender: 'female',
  look: { parts: { hair: 'hair.wavy', face: 'face.bright', outfit: 'outfit.robe', hat: null, glasses: null }, colors: { hair: 'auburn', eyes: 'leaf', skin: 'fair', 'outfit.1': 'forest' } },
  age: 23,
  temperament: { personality: 'curious', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.mara': 'the elder who taught her letters' },
  // her draughts are for sale
  trade: { stock: [['item/potion/healing', 3], ['item/potion/antidote', 2], ['item/potion/fire_resist', 1], ['item/material/herb', 4]] },
  purse: 40,
  schedules: {
    default: [
      [22, 6, 'emberfall:herb.home', 'sleep'],
      [6, 22, 'emberfall:herb.cauldron', 'tend the cauldron', CAULDRON],
    ],
  },
  lines: [
    line('greeting:first', 'Oh! A traveller. Wren — herbs, salves, the occasional explosion. Mind the cauldron.', '哦！一位旅人。我叫雷恩——草药、药膏，偶尔炸个锅。小心别碰到锅。', { once: true }),
    line('default', 'Fireweed grows in open meadow; frostcap in the shade of the forest. Three of each, and I can brew against fire.', '火焰草长在开阔的草原上，霜盖菇长在森林的阴凉处。各三份，我就能熬出防火的药。'),
    line('default', 'The books say dragons call their young when they are hurt. The books do not say what to do about it.', '书上说，龙受了伤会召唤幼龙。书上没说该怎么办。'),
    line('fact:mq.draught', 'One at the lair\'s mouth, one when the first wears thin. And come back.', '巢穴门口喝一瓶，第一瓶快没效了再喝第二瓶。还有——要回来。', { once: true }),
    line('given', 'For my shelves? Thank you!', '给我的架子添货？谢谢！'),
  ],
}
