// Godwin, the miller of Fairweight (docs/chapter-3.md §7): forty-one, gruff, ashamed. His windmill has ground nothing but
// salt for two years.

import { line, type PersonDef } from '../person.ts'

export const godwin: PersonDef = {
  id: 'npc.godwin',
  role: 'miller',
  tags: ['storybound'],
  name: { en: 'Godwin', zh: '戈德温' },
  gender: 'male',
  look: { parts: { hair: 'hair.messy', face: 'face.stern', outfit: 'outfit.apron', beard: 'beard.full', hat: null }, colors: { hair: 'auburn', eyes: 'bark', skin: 'light', 'outfit.1': 'linen', 'outfit.2': 'leather' } },
  age: 41,
  favourite: 'item/material/wheat',
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.berthe': 'owes her' },
  purse: 12,
  trade: { stock: [['item/material/stone', 2], ['item/food/bread', 1]] },
  schedules: {
    default: [
      [21, 5, 'fairweight.miller:bed.0', 'sleep'],
      [5, 19, 'fairweight:godwin.mill', 'grind salt'],
      [19, 21, 'fairweight.miller:bed.0', 'sit alone'],
    ],
  },
  lines: [
    line('chat', 'Salt. I grind salt. The Guild sells it to the March. A mill that grinds salt, in the Vale of Scales. My father would have spat.', '盐。我磨盐。行会把盐卖到边境去。衡谷平原的磨坊，磨的是盐。我爹要是知道，非得啐一口不可。'),
    line('chat', 'My wife baked the last loaf of real wheat in this town. We ate it standing up, in the mill, so no one would see.', '这个镇上最后一个真麦子做的面包，是我老婆烤的。我们站在磨坊里把它吃了，免得被人看见。'),
    line('greeting:first', 'Miller. Godwin. Don\'t ask me for flour.', '磨坊主。戈德温。别找我要面粉。', { once: true }),
    line('default', 'The stones are going smooth on salt. Another year and they will be good for nothing.', '磨盘磨盐磨得都快光了。再过一年，就什么都磨不了了。'),
    line('topic:scale_tipped', 'Half the town came to my door this morning, hungry. As if I had anything. As if I had ever had anything.', '今天早上半个镇子的人都饿着跑到我门口。好像我有什么似的。好像我什么时候有过似的。', { mood: 'angry' }),
    line('fact:ch3.end', 'Tomorrow I grind the Guild\'s wheat for the poorhouse. Ottilie says I may. ...I had my doubts about that woman.', '明天我就给济贫院磨行会的麦子。奥蒂莉说可以。……我以前还看不上那个女人。'),
    line('given:item/material/wheat', 'Wheat. Real wheat. Huh.', '麦子。真麦子。哼。', { mood: 'happy' }),
  ],
}
