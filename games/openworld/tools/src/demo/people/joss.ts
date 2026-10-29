// Joss, the bridgewright (docs/chapter-1.md §7): he built the footbridge with Aldo twenty years ago,
// and someone took it apart neatly. He teaches the plank route, and knows who paid for the bridge: a brother of the Ashen
// Watch, with a boy at his heel (the grey man at ten).

import { line, type PersonDef } from '../person.ts'

export const joss: PersonDef = {
  id: 'npc.joss',
  role: 'villager',
  essential: true,
  name: { en: 'Joss', zh: '乔斯' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.keen', outfit: 'outfit.workshirt', beard: 'beard.moustache', hat: null }, colors: { hair: 'steelgrey', eyes: 'sky', skin: 'light', 'outfit.1': 'woad', 'outfit.2': 'slate' } },
  age: 58,
  temperament: { personality: 'precise', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.hesper': 'friend of her husband' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/material/plank', 8], ['item/tool/shovel', 1], ['item/tool/broom', 1], ['item/tool/hoe', 1]] },
  purse: 25,
  schedules: {
    default: [
      [21, 6, 'meadow.lane:bed.0', 'sleep'],
      [6, 21, 'meadow:joss.bench', 'plane boards at the workbench'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Green wood moves as it dries. I cut every board a finger long and plane it to size a week later.', '新木头晾干的时候会走形。我裁木板总多留一指长，过一个礼拜再刨到尺寸。'),
    line('chat', 'Aldo could hold a plank level with one hand and argue with the other. I miss arguing with him.', '阿尔多能一只手把木板端得平平的，另一只手指着人吵架。我挺怀念跟他吵架的那些日子。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "The dragon's dead, I hear. Emberfall will want beams and roofs mended, then. I might go over.", "听说龙死了。那余烬镇的房梁屋顶得修不少。说不定我会过去一趟。"),
    line('greeting:first', 'Joss. I build things: bridges, fences, benches. The footbridge at the Ford was mine and Aldo\'s.', '乔斯。我是做木工的，桥、篱笆、长凳都做。渡口那座小桥，是我跟阿尔多搭的。'),
    line('default', 'An axe fells a tree, and an axe on a log gives you planks. Three planks and the footbridge is whole again.', '用斧头把树砍倒，再拿斧头劈木头，就有木板了。有三块木板，小桥就能补好。'),
    line('default', 'Nails pulled straight and laid in a row. No storm pulls nails. Someone wanted that bridge gone, and wanted us to know it.', '钉子拔得直直的，一排摆好。哪有风暴会拔钉子？是有人想拆了那座桥，还想让我们知道。'),
    line('fact:ford.crossed', 'You crossed. Good. Aldo would have laughed to see it. He always said that bridge would outlive us both.', '你过去了。好。阿尔多要是看见，准会笑出声来。他以前总说，那座桥会比我们俩活得都长。', { once: true }),
    line('fact:ch1.end', 'A man in grey paid for that bridge, twenty years back, and a boy at his heel carried the purse. Old coin, no king on it. "A road out of here a cart could take in a hurry," he said. I never knew what he meant.', '二十年前，出钱造那座桥的是个穿灰衣的人，身边跟着个男孩，钱袋是男孩拿着的。给的都是旧钱，上面没有国王的头像。他说：“要一条路，马车急着走的时候能从这里出去。”他是什么意思，我到今天也没想明白。', { once: true }),
  ],
}
