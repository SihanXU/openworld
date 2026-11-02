// Liese of Nailgate (docs/chapter-4.md §7): Piet's wife, dead eleven years and kept. She keeps house, grey and quiet; some
// days she does not know his name. She neither eats nor sleeps. When Nacht lets go she says his name twice, and lies down.

import { line, type PersonDef } from '../person.ts'

export const liese: PersonDef = {
  id: 'npc.liese',
  role: 'villager',
  tags: ['storybound'],
  name: { en: 'Liese', zh: '莉泽' },
  gender: 'female',
  look: { parts: { hair: 'hair.braid', face: 'face.soft', outfit: 'outfit.dress', hat: null }, colors: { hair: 'ash', eyes: 'storm', skin: 'porcelain', 'outfit.1': 'slate' } },
  age: 44,
  favourite: 'item/material/herb',
  temperament: { personality: 'quiet', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.piet': 'her husband' },
  purse: 0,
  trade: { stock: [['item/material/herb', 1]] },
  schedules: {
    // gone, once she lies down (the scene `ferry`)
    'fact:ch4.end': [[0, 24, 'offstage:liese.gone', 'rest']],
    default: [
      [6, 22, 'nailgate.piet:liese.hearth', 'keep the house'],
      [22, 6, 'nailgate.piet:liese.hearth', 'stand at the window'],
    ],
  },
  lines: [
    line('chat', 'Supper is laid. Will you stay? There is always a place.', '晚饭摆好了。你留下吗？总有你的位子。'),
    line('chat', 'I set out the bowls every evening. Piet eats. I sit. I do not remember when I stopped being hungry.', '每天傍晚我都把碗摆好。皮特吃。我坐着。我不记得自己是从什么时候起不饿的。'),
    line('default', 'Have we met? You must forgive me. I am a little cold today. I am always a little cold.', '我们见过吗？请别见怪。我今天有点冷。我一直都有点冷。'),
    line('default', 'Piet. That is his name. Piet. I say it in the mornings, so I have it for the day.', '皮特。他叫皮特。皮特。我每天早上都念一遍，这样一整天都记得。'),
    line('topic:liese_forgot', 'There was a man at the door with Piet. A sexton. He hammered something. I do not know why it frightened me.', '门口有个人跟皮特在一起。一个司事。他敲了些什么。我不知道为什么那让我害怕。', { mood: 'sad' }),
    line('topic:reins_let_go', 'Piet. Piet. ...I am tired. I think I can sleep now. Piet.', '皮特。皮特。……我累了。我想我现在能睡了。皮特。', { mood: 'sad' }),
  ],
}
