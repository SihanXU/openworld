// Elsie of Fairweight's poorhouse (docs/chapter-3.md §7): nine. Her mother was found light and walked out onto the White
// Pans last spring. She keeps a jar of salt and dust by her pallet, so that her mother is somewhere.

import { line, type PersonDef } from '../person.ts'

export const elsie: PersonDef = {
  id: 'npc.elsie',
  role: 'child',
  tags: ['storybound'],
  name: { en: 'Elsie', zh: '艾尔西' },
  gender: 'female',
  look: { parts: { hair: 'hair.pigtails', face: 'face.child', outfit: 'outfit.smock', hat: null }, colors: { hair: 'honey', eyes: 'sky', skin: 'fair', 'outfit.1': 'undyed' } },
  age: 9,
  favourite: 'item/food/apple',
  temperament: { personality: 'quiet', manner: 'plain', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.berthe': 'looks after her' },
  purse: 0,
  trade: { stock: [['item/material/stick', 2]] },
  schedules: {
    default: [
      [21, 7, 'fairweight.poorhouse:elsie.bed', 'sleep'],
      [7, 12, 'fairweight:elsie.edge', 'look toward the salt'],
      [12, 14, 'fairweight.poorhouse:poor.table', 'eat bran porridge'],
      [14, 19, 'fairweight:elsie.well', 'play by the well'],
      [19, 21, 'fairweight.poorhouse:poor.table', 'eat bran porridge'],
    ],
  },
  lines: [
    line('chat', 'Sister Berthe pulled me out of the line. I wanted to see if I was light like Mama.', '贝尔特修女把我从队伍里拽出来了。我想看看我是不是跟妈妈一样轻。'),
    line('chat', 'I am hungry all the time. Sister says that is good. I don\'t think it\'s very good.', '我老是饿。修女说这样好。我觉得不怎么好。'),
    line('default', 'You can see the salt from the end of the street. It\'s all white. Mama is out there.', '从街那头能看见盐滩。白白的一片。妈妈就在那儿。'),
    line('default', 'I keep the jar by my bed. When the wind blows I put the stopper in so she doesn\'t go anywhere.', '我把罐子放在床边。一刮风，我就把塞子塞上，这样她就哪儿也去不了。'),
    line('topic:scale_tipped', 'Everyone is crying because they\'re hungry. I\'ve been hungry for ages and I didn\'t cry.', '大家都饿哭了。我饿了好久了，我都没哭。'),
    line('fact:ch3.end', 'I had two bowls. Sister said I could. ...Do you think Mama would have come back, if she had stayed hungry?', '我吃了两碗，修女说可以。……你说，要是妈妈一直饿着，她会不会就回来了？', { mood: 'sad' }),
    line('given:item/food/apple', 'An apple! A whole one! Can I keep the seeds?', '苹果！一整个！籽能给我留着吗？', { mood: 'happy' }),
  ],
}
