// The Church's courier (docs/chapter-1.md §6, the Letter): a rider from the Holy City who brings the
// proclamation of the pilgrimage, stares at the fairy, and rides on. In the story's scenes only.

import { line, type PersonDef } from '../person.ts'

export const courier: PersonDef = {
  id: 'npc.courier',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound', 'devout'],
  role: 'priest',
  essential: true,
  name: { en: 'Church Courier', zh: '圣教信使' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.keen', outfit: 'outfit.vestment', beard: null, hat: null }, colors: { hair: 'honey', eyes: 'sky', skin: 'fair', 'outfit.1': 'ivory', 'outfit.2': 'indigo' } },
  age: 27,
  temperament: { personality: 'formal', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/document/map', 1], ['item/vessel/waterskin/full', 1], ['item/food/bread', 2]] },
  purse: 30,
  schedules: {
    default: [[0, 24, 'offstage:courier.hide', 'ride the roads']],
  },
  lines: [
    line('default', 'Suffering is not God\'s abandonment.', '苦难并非神的遗弃。'),
  ],
}
