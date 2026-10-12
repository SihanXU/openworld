// Joss, the bridgewright (docs/chapter-1.md §7): he built the footbridge with Aldo twenty years ago,
// and someone took it apart neatly. He teaches the plank route, and knows who paid for the bridge.

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
      [21, 6, 'meadow:joss.home', 'sleep'],
      [6, 21, 'meadow:joss.bench', 'plane boards at the workbench'],
    ],
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "Dragon is dead, I hear. I hope it fell on something I did not build.", "听说龙死了。但愿它没砸在我造的东西上。"),
    line('greeting:first', 'Joss. I build things that stay built. Mostly.', '乔斯。我造的东西都结实。大部分是。'),
    line('default', 'An axe fells a tree, an axe on a log gives planks. Three planks and the footbridge is whole. That is the whole secret.', '斧头砍树，斧头劈木头出木板。三块木板，小桥就完整了。秘诀就这么多。'),
    line('default', 'Nails pulled straight and laid in a row. No storm pulls nails. Someone wanted that bridge gone, and wanted us to know it.', '钉子拔得笔直，摆成一排。哪场风暴会拔钉子？有人就是想让那座桥没了，还想让我们知道。'),
    line('fact:ford.crossed', 'You crossed. Good. Aldo would have laughed to see it — he said that bridge would outlive us both.', '你过去了。好。阿尔多要是看见了准会笑——他说过那座桥会比我们俩都活得长。', { once: true }),
    line('fact:ch1.end', 'A grey young man paid for that bridge, twenty years back. Old coin, no king on it. "A road out of here a cart could take in a hurry," he said. I never knew what he meant.', '二十年前，是个穿灰衣服的年轻人出钱造的那座桥。旧钱币，上面没有国王的头像。他说："要一条能让马车赶紧离开这里的路。"我一直不明白他是什么意思。', { once: true }),
  ],
}
