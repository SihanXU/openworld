// Captain Brannoc of the Red Host's Left Company (docs/chapter-2.md §7): curt, proud, a soldier's sentences. He has not
// felt a wound in thirty years and is proud that no man of his falls back. The Right stole the Left's banner sixty-one
// years ago, he says; that is how it started, his sergeant told him, and the Left will have it back.

import { line, type PersonDef } from '../person.ts'

export const brannoc: PersonDef = {
  id: 'npc.brannoc',
  role: 'soldier',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Captain Brannoc', zh: '布兰诺克队长' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.stern', outfit: 'outfit.plate', beard: 'beard.stubble', hat: null }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'tan', 'outfit.1': 'madder', 'outfit.2': 'bronze', 'outfit.3': 'iron' } },
  age: 52,
  favourite: 'item/food/meat/cooked',
  temperament: { personality: 'proud', manner: 'rough', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.kell': 'his sergeant', 'npc.vera': 'his surgeon', 'npc.wil': 'his drummer' },
  fights: true,
  purse: 40,
  trade: { stock: [['item/weapon/polearm/spear', 2], ['item/armor/helmet', 1], ['item/potion/healing', 1]] },
  schedules: {
    default: [
      [22, 6, 'redcamp.warhall:brannoc.bed', 'sleep'],
      [6, 12, 'redcamp.warhall:brannoc.table', 'study the map of the Lashmarks'],
      [12, 20, 'redcamp:brannoc.yard', 'keep the camp'],
      [20, 22, 'redcamp.warhall:brannoc.table', 'move the flags on the map'],
    ],
  },
  lines: [
    line('chat', 'I have not felt a wound in thirty years. I have taken plenty. My men are the same. Nobody here falls back.', '我三十年没觉得过疼了。伤倒是挨了不少。我手下的人都一样。在这儿，没人往后退。'),
    line('chat', 'The pot is Wil\'s job now. The boy burns everything and never notices. We eat it anyway.', '煮饭现在归威尔管。那孩子什么都煮糊，自己还不知道。我们照吃不误。'),
    line('fact:world.ch3', 'The grain road leaves by the south gate. The Vale of Scales sent us bread up it once a season, sixty years and more. Three seasons ago the carts stopped. Nobody has come up it since.', '运粮路从南门出去。六十多年来，衡谷平原每季都顺着这条路给我们送粮。三季以前，车就不来了。从那以后，再没人从那条路上来过。', { once: true }),
    line('greeting:first', 'You came over the pass? Then the dragon is dead, and the iron will come again. Good. I am Brannoc, captain of the Left Company.', '你是翻山过来的？那魔龙是死了，铁又能运过来了。好。我是布兰诺克，左营的队长。', { once: true }),
    line('default', 'The Left has not given up a foot of the Lashmarks in thirty years. Not since I have had it.', '三十年来，左营在鞭痕原上一步都没让过。从我接手那天起就没让过。'),
    line('default', 'The Rider is in the Bastion, east, past the Scourging House. He sees those who have fought at his dusk.', '骑者在堡垒里，往东，过了鞭笞院就是。打过他那场黄昏的人，他才见。'),
    line('hour:evening', 'Dusk is coming. The Left forms on the Lashmarks at six.', '天快黑了。六点钟，左营在鞭痕原上列队。'),
    line('fact:ch2.dusk', 'Dunn was a good man on the line. Vera will have written him down. She writes everyone down.', '邓恩在队列里是把好手。薇拉肯定已经把他记下了。谁她都记。'),
    line('topic:dunn', 'Dunn held the bridge end for nine years. I will put someone else there tomorrow.', '邓恩守了九年桥头。明天我得换个人站过去。'),
    line('topic:quiet_dusk', 'My shoulder. My knee. The cut over my eye from the spring before last. I feel every one of them tonight. I had forgotten I had them.', '我的肩膀，我的膝盖，前年春天眉骨上挨的那一刀。今晚每一处我都觉得到。我都忘了自己身上还有这些。', { mood: 'sad' }),
    line('given:item/food/meat/cooked', 'Meat that Wil did not cook. Thank you.', '不是威尔煮的肉。谢谢。', { mood: 'happy' }),
  ],
}
