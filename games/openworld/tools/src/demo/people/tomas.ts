// Brother Tomas of Whiteveil (docs/chapter-5.md §7): twenty-four, a novice. He carries the dead pilgrims down to the
// catacombs and lays them in their niches, and they whisper at him. He wants to go home.

import { line, type PersonDef } from '../person.ts'

export const tomas: PersonDef = {
  id: 'npc.tomas',
  role: 'priest',
  tags: ['storybound'],
  name: { en: 'Brother Tomas', zh: '托马斯修士' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.bright', outfit: 'outfit.vestment', hat: null }, colors: { hair: 'chestnut', eyes: 'bark', skin: 'tan', 'outfit.1': 'linen', 'outfit.2': 'undyed', 'outfit.3': 'undyed' } },
  age: 24,
  favourite: 'item/food/apple',
  temperament: { personality: 'restless', manner: 'polite', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.benedek': 'his abbot' },
  purse: 2,
  trade: { stock: [['item/light/candle', 2]] },
  schedules: {
    default: [
      [21, 5, 'whiteveil.cells:bed.2', 'sleep'],
      [5, 21, 'whiteveil:tomas.graves', 'keep the graves'],
    ],
  },
  lines: [
    line('chat', 'I came up for the bread and the quiet. There is plenty of bread.', '我上山来，是为了面包和清静。面包倒是管够。'),
    line('chat', 'They whisper when I lay them down. Brother Abbot says it is the wind in the galleries. There is no wind down there.', '我把他们放下的时候，他们会低声说话。院长说那是回廊里的风。下面没有风。'),
    line('greeting:first', 'Brother Tomas. A novice still. Are you the pilgrim? ...I am sorry.', '我是托马斯修士，还是见习的。你就是那个朝圣者？……对不起。', { once: true }),
    line('default', 'I carry them down. They are light, all of them, lighter than they should be. They whisper when I lay them in. How long, they say. I do not know.', '我负责把他们抬下去。他们都很轻，比该有的轻。放进去的时候，他们会低声说话。还要多久，他们说。我不知道。'),
    line('topic:it_is_enough', 'I went down with the abbot. Nothing. Not a word. ...I think I could stay, now. I do not know if I want to.', '我跟院长下去了一趟。什么声音都没有，一个字都没有。……我想我现在也许能留下了。我不知道自己想不想。'),
    line('given:item/food/apple', 'An apple. From down there. Thank you.', '苹果。山下来的。谢谢你。', { mood: 'happy' }),
  ],
}
