// Piet of Nailgate (docs/chapter-4.md §7): fifty-two, a fisherman. His wife Liese died eleven years ago and came home, and
// he is grateful to the Keeper for every day of her, though some days she does not know his name.

import { line, type PersonDef } from '../person.ts'

export const piet: PersonDef = {
  id: 'npc.piet',
  role: 'fisher',
  tags: ['storybound'],
  name: { en: 'Piet', zh: '皮特' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.soft', outfit: 'outfit.oilcloth', beard: 'beard.stubble', hat: 'hat.cap' }, colors: { hair: 'umber', eyes: 'bark', skin: 'light', 'outfit.1': 'moss', 'hat.1': 'slate' } },
  age: 52,
  favourite: 'item/food/fish/raw',
  temperament: { personality: 'gentle', manner: 'plain', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.liese': 'his wife' },
  purse: 10,
  trade: { stock: [['item/food/fish/raw', 3], ['item/food/fish/eel', 1]] },
  schedules: {
    default: [
      [21, 5, 'nailgate.piet:bed.0', 'sleep'],
      [5, 18, 'nailgate:piet.walk', 'mend nets on the walk'],
      [18, 21, 'nailgate.piet:liese.hearth', 'sit with his wife'],
    ],
  },
  lines: [
    line('chat', 'Eels this morning. Liese used to smoke them. She still lights the fire for it, out of habit, and then forgets what it was for.', '今天早上捉了鳗鱼。莉泽以前会把它们熏了。她现在还是会去生火，是习惯，生完了又忘了是干什么用的。'),
    line('chat', 'Liese and I were married out on the causeway. Everyone is, here. It is the only dry ground long enough to walk in a line.', '我和莉泽是在长堤上成的亲。这里人人都是。只有那条路又干又长，走得开一队人。'),
    line('greeting:first', 'A pilgrim, in Nailgate. Welcome. I am Piet. My wife is inside; she will lay a place for you. Do not mind if she asks your name twice.', '一个朝圣者，来了钉门村。欢迎。我叫皮特。我妻子在屋里，她会给你摆副碗筷。她要是问了你两遍名字，你别在意。', { once: true }),
    line('default', 'The Keeper brought her home the night she drowned. I had already started digging. He set her down on the walk, and she got up and went in.', '她淹死的那天夜里，守护者把她送回了家。我都已经开始挖坑了。他把她放在栈道上，她就站起来，走进屋里去了。'),
    line('default', 'Eleven nails. One a year. I would drive a hundred.', '十一颗钉子了，一年一颗。叫我钉一百颗我也愿意。'),
    line('topic:reins_let_go', 'She is standing at the window. She is saying my name, over and over, as if she is afraid to lose it.', '她站在窗边。她一遍又一遍地喊我的名字，像是怕把它弄丢了。', { mood: 'sad' }),
    line('fact:ch4.end', 'I will dig the grave myself, tomorrow, and I will not put a nail in the post. ...It is the right thing. I know it is.', '明天我亲手挖坟，不往桩上钉钉子。……这样做是对的。我知道是对的。', { mood: 'sad' }),
    line('given:item/food/fish/raw', 'Fish. Ha. You have come to the wrong man for that, but thank you.', '鱼。哈。送鱼给我，你可找错人了。不过谢谢你。', { mood: 'happy' }),
  ],
}
