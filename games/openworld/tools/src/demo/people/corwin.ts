// Corwin of Fairweight (docs/chapter-3.md §7): sixty-three, Lightened three years ago. He works the dead fields day and
// night by lantern and does not sleep or eat; cheerful, light as straw. He cannot remember the taste of bread, or his
// wife's name. When Ele falls he is hungry again, and sleeps in the poorhouse.

import { line, type PersonDef } from '../person.ts'

export const corwin: PersonDef = {
  id: 'npc.corwin',
  role: 'farmer',
  tags: ['storybound'],
  name: { en: 'Corwin', zh: '科温' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.bright', outfit: 'outfit.workshirt', beard: 'beard.stubble', hat: 'hat.straw' }, colors: { hair: 'snow', eyes: 'hazel', skin: 'tan', 'outfit.1': 'undyed', 'hat.1': 'linen' } },
  age: 63,
  favourite: 'item/food/bread',
  temperament: { personality: 'cheerful', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
  purse: 2,
  trade: { stock: [['item/material/wheat', 1]] },
  schedules: {
    // (the variants keep their order: hungry again once the scale has tipped; Lightened before, he neither sleeps nor eats)
    'fact:ch3.scale': [
      [21, 6, 'fairweight.poorhouse:poor.table', 'sleep'],
      [6, 21, 'fairweight:corwin.field', 'clear the dead field'],
    ],
    default: [
      [6, 18, 'fairweight:corwin.field', 'work the dead field'],
      [18, 6, 'fairweight:corwin.field', 'work the dead field by lantern'],
    ],
  },
  lines: [
    line('chat', 'I hoe the rows so they are ready when the wheat comes back. It will come back. I have time; I do not sleep.', '我把垄沟锄好，等麦子回来就能种。它会回来的。我有的是时间，我不睡觉。'),
    line('chat', 'People ask if I am tired. I do not think I am. I do not think I remember how.', '大家问我累不累。我觉得不累。我觉得我是忘了怎么累了。'),
    line('greeting:first', 'Good day, pilgrim! I am Corwin. I work this field. Well, I work it whether there is anything in it or not.', '你好啊，朝圣者！我叫科温，种这块地。嗯，地里有没有东西，我都种。', { once: true }),
    line('default', 'Bread? I used to like bread, I think. I cannot remember what it tasted like. Is that strange?', '面包？我以前好像挺爱吃面包的。我想不起它是什么味道了。这奇怪吗？'),
    line('hour:night', 'Lovely night for it. The lantern does well enough.', '这样的夜里干活正好。有这盏灯就够了。'),
    line('topic:scale_tipped', 'I sat down in the field this morning and could not get up. I was hungry. Hungry! I laughed so much I cried.', '今天早上我在地里坐下，就起不来了。我饿了。饿了！我笑得眼泪都出来了。'),
    line('fact:ch3.end', 'I slept last night. All night. I dreamed of my kitchen.', '我昨晚睡着了。睡了一整夜。我梦见了我家的灶房。', { mood: 'happy' }),
    line('given:item/food/bread', 'Is this... bread? Thank you. I will keep it. I am not hungry, but I would like to have it.', '这是……面包？谢谢你。我留着。我不饿，可我想把它留着。', { mood: 'happy' }),
  ],
}
