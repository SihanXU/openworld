// Sanne of Nailgate (docs/chapter-4.md §7): sixteen. Her brother Jory died eight years ago at eight and came home, and has
// been eight ever since; she grew up and he did not. She minds him.

import { line, type PersonDef } from '../person.ts'

export const sanne: PersonDef = {
  id: 'npc.sanne',
  role: 'villager',
  tags: ['storybound'],
  name: { en: 'Sanne', zh: '桑娜' },
  gender: 'female',
  look: { parts: { hair: 'hair.ponytail', face: 'face.bright', outfit: 'outfit.workdress', hat: null }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'fair', 'outfit.1': 'teal' } },
  age: 16,
  favourite: 'item/food/apple',
  temperament: { personality: 'earnest', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.jory': 'her brother' },
  purse: 3,
  trade: { stock: [['item/material/wool', 1]] },
  schedules: {
    default: [
      [21, 6, 'nailgate.sanne:bed.0', 'sleep'],
      [6, 21, 'nailgate:sanne.walk', 'mind her brother'],
    ],
  },
  lines: [
    line('chat', 'I used to be the little one. Jory taught me to swim. Now I hold his hand on the walks so he does not fall in.', '我以前才是小的那个。是乔里教我游泳的。现在我在栈道上牵着他的手，免得他掉下去。'),
    line('chat', 'Jory asks for his kite every morning. I tell him it blew away. Tomorrow he will ask again.', '乔里每天早上都要他的风筝。我跟他说风筝被风吹走了。明天他还会再问。'),
    line('greeting:first', 'Hello. I am Sanne, and this is Jory. He is my big brother. ...He is eight.', '你好。我叫桑娜，这是乔里。他是我哥哥。……他八岁。', { once: true }),
    line('default', 'He asks me the same things every day. I do not mind. I answer them the same every day too.', '他每天问我一样的事。我不介意。我每天也回答他一样的话。'),
    line('topic:reins_let_go', 'Jory said he was sleepy. He has not been sleepy in eight years.', '乔里说他困了。八年了，他从来没困过。', { mood: 'sad' }),
    line('fact:ch4.end', 'I held his hand on the boat until Klaas said it was time. He was asleep already. He looked eight.', '在船上，我一直牵着他的手，直到克拉斯说时候到了。他已经睡着了。看上去就是八岁的样子。', { mood: 'sad' }),
    line('given:item/food/apple', 'For Jory? He cannot eat it. I will put it by his bed anyway.', '给乔里的？他吃不了。我还是放到他床边去。', { mood: 'happy' }),
  ],
}
