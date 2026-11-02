// Jory of Nailgate (docs/chapter-4.md §7): dead eight years, eight years old, kept. He does not understand why his sister
// got tall, and asks for his kite every day because he does not remember asking yesterday.

import { line, type PersonDef } from '../person.ts'

export const jory: PersonDef = {
  id: 'npc.jory',
  role: 'child',
  tags: ['storybound'],
  name: { en: 'Jory', zh: '乔里' },
  gender: 'male',
  look: { parts: { hair: 'hair.childbob', face: 'face.child', outfit: 'outfit.smock', hat: null }, colors: { hair: 'ash', eyes: 'storm', skin: 'porcelain', 'outfit.1': 'slate' } },
  age: 8,
  favourite: 'item/valuable/kite',
  temperament: { personality: 'eager', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.sanne': 'his sister' },
  purse: 0,
  trade: { stock: [['item/material/stick', 1]] },
  schedules: {
    // gone, once he lies down (the scene `ferry`)
    'fact:ch4.end': [[0, 24, 'offstage:jory.gone', 'rest']],
    default: [
      [6, 21, 'nailgate:jory.walk', 'play on the walk'],
      [21, 6, 'nailgate.sanne:bed.1', 'sit by his sister\'s bed'],
    ],
  },
  lines: [
    line('chat', 'Sanne got tall. When did Sanne get tall? I think she is playing a trick.', '桑娜长高了。桑娜什么时候长这么高的？我觉得她在捉弄我。'),
    line('chat', 'Sanne won\'t let me go near the water. I\'m a good swimmer. I taught her.', '桑娜不让我靠近水边。我游得可好了。是我教她的。'),
    line('default', 'Have you seen my kite? I lost it at the graves. It is blue. Is it blue? I think it is blue.', '你看见我的风筝了吗？我把它丢在坟地了。是蓝色的。是蓝色吗？我觉得是蓝色的。'),
    line('topic:reins_let_go', 'I am sleepy. Is it night? It is always night. Can I sleep?', '我困了。是晚上了吗？一直都是晚上。我能睡了吗？', { mood: 'sad' }),
    line('given:item/valuable/kite', 'My kite! Is it new? It feels new.', '我的风筝！是新的吗？摸起来像新的。', { mood: 'happy' }),
  ],
}
