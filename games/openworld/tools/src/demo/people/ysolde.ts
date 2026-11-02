// Ysolde, the hermit of the White Stair (docs/chapter-5.md §7): sixty-eight. Named pilgrim forty years ago, she turned
// back after the third seal, feeling it take her, and has lived in a cell against the cliff since.

import { line, type PersonDef } from '../person.ts'

export const ysolde: PersonDef = {
  id: 'npc.ysolde',
  role: 'traveler',
  tags: ['storybound'],
  name: { en: 'Ysolde', zh: '伊索尔德' },
  gender: 'female',
  look: { parts: { hair: 'hair.long', face: 'face.weary', outfit: 'outfit.travel', hat: 'hat.hood' }, colors: { hair: 'silver', eyes: 'storm', skin: 'tan', 'outfit.1': 'umber', 'hat.1': 'linen' } },
  age: 68,
  favourite: 'item/food/bread',
  temperament: { personality: 'blunt', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  purse: 4,
  trade: { stock: [['item/material/herb', 2], ['item/food/bread', 1]] },
  schedules: {
    default: [
      [20, 6, 'whitestair:ysolde.cell', 'sleep'],
      [6, 20, 'whitestair:ysolde.cell', 'sit at her cell'],
    ],
  },
  lines: [
    line('chat', 'The brothers bring me bread on feast days. I do not tell them which day it is. They like to guess.', '逢节日修士们会给我送面包。我不告诉他们是哪一天。他们喜欢猜。'),
    line('chat', 'I walked as far as the third seal. I felt it begin to take me, like a hand on the back of my neck. So I turned round.', '我走到了第三道印。我觉得它开始要我了，像有只手按在后颈上。所以我转身回来了。'),
    line('greeting:first', 'Ysolde. I was a pilgrim once, the way you are. Then I stopped.', '伊索尔德。我也当过朝圣者，跟你一样。后来我不走了。', { once: true }),
    line('default', 'At the Scale I could not taste my bread. I could not remember my mother\'s face. I knew if I went on there would be nothing of me left to go home. So I did not go home either.', '到了秤那儿，我尝不出面包的味道了，也想不起母亲的脸。我知道再往前走，我就剩不下什么可以回家了。所以，我也没有回家。'),
    line('topic:it_is_enough', 'The wind is quiet tonight. Even the robes are hanging still.', '今晚风停了。连那些袍子都一动不动地挂着。'),
    line('given:item/food/bread', 'Bread. On no feast day at all. Ha.', '面包。又不是什么节日。哈。', { mood: 'happy' }),
  ],
}
