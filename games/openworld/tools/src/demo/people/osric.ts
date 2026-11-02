// Osric, a soldier of the Right Company: young and quick, across the ravine. The scenes bring him on at dusk.

import { line, type PersonDef } from '../person.ts'

export const osric: PersonDef = {
  id: 'npc.osric',
  role: 'soldier',
  name: { en: 'Osric', zh: '奥斯里克' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.keen', outfit: 'outfit.gambeson', hat: null, beard: null }, colors: { hair: 'auburn', eyes: 'leaf', skin: 'warm', 'outfit.1': 'madder', 'outfit.2': 'undyed', 'outfit.3': 'iron' } },
  age: 30,
  favourite: 'item/food/meat/cooked',
  temperament: { personality: 'quick', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.roderick': 'his sergeant' },
  fights: true,
  purse: 5,
  trade: { stock: [['item/food/bread', 1]] },
  schedules: { default: [[0, 24, 'offstage:osric.hide', 'wait for dusk']] },
  lines: [
    line('chat', 'My mother was in the Right, and her father. We hold the far side.', '我娘是右营的，她爹也是。我们守着沟那边。'),
    line('chat', 'A spear went right through my hand last spring. I can still hold one.', '去年春天，一支矛扎穿了我的手。我照样握得住矛。'),
    line('default', 'Dusk is at six. Not before.', '六点才开打，早一点都不行。'),
  ],
}
