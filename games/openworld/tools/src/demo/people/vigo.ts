// Vigo, a drifter the storm washed into Firstlight: no house, no coin, little conscience, and hungry. When his
// belly is empty and his purse too, he takes what he can reach — a loaf from Marta's goods, bread in a chest —
// and the village sees what it sees (docs/npc-sandbox.md §2.11): the watch stops him as it would stop anyone.
// For a few coins and a meal he will walk with anyone who asks (a hireling), and he fights when struck.

import { line, type PersonDef } from '../person.ts'

export const vigo: PersonDef = {
  id: 'npc.vigo',
  role: 'traveler',
  name: { en: 'Vigo', zh: '维戈' },
  gender: 'male',
  age: 29,
  temperament: { personality: 'restless', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: {},
  purse: 0,
  honesty: 0.2,
  lawful: false,
  hireling: true,
  fights: true,
  // he came in on an empty stomach
  props: { hunger: 8 },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/misc/old_boot', 1], ['item/misc/dice', 1], ['item/tool/knife', 1]], fence: true },
  schedules: {
    default: [
      [22, 6, 'meadow:vigo.camp', 'sleep'],
      [6, 12, 'meadow:square.well', 'loiter by the well'],
      [12, 18, 'meadow:vigo.camp', 'mend his boots'],
      [18, 22, 'meadow:square.warm', 'warm his hands'],
    ],
  },
  lines: [
    line('greeting:first', "Don't look at me like that. The storm took my road, not my manners. Most of them.", '别那样看着我。风暴冲走的是我的路，不是我的规矩。大部分规矩。', { once: true }),
    line('default', "I'll carry a pack and swing a club for whoever feeds me. Today, that's nobody.", '谁管我饭，我就给谁背包、替谁抡棍子。今天，没人管。'),
    line('default', 'A village fire, a village well, and a village watch that looks at me twice. I know how this goes.', '村里的火，村里的井，还有一个多看我两眼的村卫兵。这套我熟。'),
    line('hour:night', "Cold. Colder than the road. The road at least doesn't watch you sleep.", '冷。比路上还冷。路上起码没人盯着你睡觉。'),
    line('topic:theft', "Don't look at me. …All right, look at me. But I was hungry.", '别看我。……好吧，看吧。可我饿啊。', { mood: 'shy' }),
    line('given:item/food', 'Oh — gods. Thank you. I owe you one. Ask, and I come.', '哦——天哪。谢谢你。我欠你一份。你开口，我就跟你走。', { mood: 'happy' }),
    line('given', "Coin's better, but I won't say no.", '要是钱就更好了，不过我不会拒绝。'),
  ],
}
