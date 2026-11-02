// Wil, the Left Company's drummer (docs/chapter-2.md §7): eleven, born in the camp. He has never felt pain and does not
// know what it is; he burns his hand at the pot and keeps talking. When Matthias falls, he feels it for the first time.

import { line, type PersonDef } from '../person.ts'

export const wil: PersonDef = {
  id: 'npc.wil',
  role: 'child',
  tags: ['storybound'],
  name: { en: 'Wil', zh: '威尔' },
  gender: 'male',
  look: { parts: { hair: 'hair.tuft', face: 'face.child', outfit: 'outfit.smock', hat: null }, colors: { hair: 'chestnut', eyes: 'bark', skin: 'light', 'outfit.1': 'madder' } },
  age: 11,
  favourite: 'item/food/apple',
  temperament: { personality: 'eager', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.brannoc': 'his captain', 'npc.vera': 'looks after him' },
  purse: 3,
  trade: { stock: [['item/material/stick', 3]] },
  schedules: {
    default: [
      [21, 6, 'redcamp:wil.bed', 'sleep'],
      [6, 21, 'redcamp:wil.fire', 'mind the pot'],
    ],
  },
  lines: [
    line('chat', 'I burned my hand on the pot this morning. Look, it went all white. Vera made a face.', '我今天早上被锅烫了手。你看，都发白了。薇拉看了直皱眉头。'),
    line('chat', 'What is hurt like? Vera says it is like the drum, only inside you. I don\'t think that\'s right.', '疼是什么样的？薇拉说，就像打鼓，只不过是在身子里面打。我觉得不对。'),
    line('default', 'I beat the advance for the Left. Brrrum, brum brum. Like that, only louder.', '左营冲锋的鼓是我打的。咚咚，咚咚咚。就像这样，只是更响。'),
    line('topic:dunn', 'Dunn used to give me the burnt bits so the captain wouldn\'t see. ...He isn\'t coming back, is he.', '邓恩以前把烧糊的那些替我吃掉，不让队长看见。……他不会回来了，对吧。', { mood: 'sad' }),
    line('topic:quiet_dusk', 'My hand still hurts. Vera says it will stop. ...I don\'t like it much.', '我的手还在疼。薇拉说会好的。……我不太喜欢这样。', { mood: 'sad' }),
    line('given:item/food/apple', 'An apple! A whole one! Thank you!', '苹果！一整个！谢谢你！', { mood: 'happy' }),
  ],
}
