// Sergeant Kell of the Left Company: gruff, few words. He keeps the camp's west gate; his sergeant told him the Right took
// the Left's banner, and he will tell the next one. He drills the Company's recruits, and is a trainer as Bram is: the
// second and third advancements are made with him too (docs/advancement.md).

import { line, type PersonDef } from '../person.ts'

export const kell: PersonDef = {
  id: 'npc.kell',
  role: 'trainer',
  name: { en: 'Sergeant Kell', zh: '凯尔军士' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.keen', outfit: 'outfit.gambeson', beard: 'beard.full', hat: 'hat.helm' }, colors: { hair: 'chestnut', eyes: 'bark', skin: 'warm', 'outfit.1': 'madder', 'outfit.2': 'undyed', 'outfit.3': 'iron', 'hat.1': 'iron' } },
  age: 45,
  favourite: 'item/food/ale',
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.brannoc': 'his captain' },
  fights: true,
  purse: 15,
  trade: { stock: [['item/weapon/polearm/spear', 1], ['item/light/torch', 2]] },
  schedules: {
    default: [
      [22, 6, 'redcamp:kell.bed', 'sleep'],
      [6, 22, 'redcamp:kell.gate', 'keep the west gate'],
    ],
  },
  lines: [
    line('chat', 'I keep the gate. Nothing comes through it but the iron carts and pilgrims, and the carts stopped when the dragon came.', '我守这道门。进出的只有运铁的大车和朝圣者，魔龙来了以后，大车也不来了。'),
    line('chat', 'My sergeant told me the Right took our banner. His sergeant told him. I will tell the next one.', '我的军士跟我说，右营抢了我们的旗。他的军士也是这么跟他说的。我也会这么跟下一个说。'),
    line('default', 'The captain is by the war hall. Big building, north of the road.', '队长在军议厅那边。路北边那座大房子。'),
    line('default', 'I drill the Left Company\'s recruits. Learn your weapon, then come to me, and I will show you the roads it goes down.', '我给左营的新兵操练。先把你的家伙学会了，再来找我，我告诉你它能走哪几条路。'),
    line('topic:dunn', 'Dunn. Nine years at the bridge end. ...Go on, then.', '邓恩。在桥头守了九年。……行了，走吧。'),
    line('topic:quiet_dusk', 'Both my knees. Thirty years of falling on them.', '两个膝盖都疼。摔了三十年了。', { mood: 'sad' }),
    line('given:item/food/ale', 'Ale. You are welcome at my gate.', '麦酒。我这道门随时欢迎你。', { mood: 'happy' }),
  ],
}
