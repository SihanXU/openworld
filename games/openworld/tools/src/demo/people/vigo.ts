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
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "I'll sit by the fire a while and then go. Nobody asked me, I know. But it's bitter out there.", '我在火边坐一会儿就走。没人请我，我知道。可外面实在太冷了。'),
    line('chat', "I've driven wagons for traders and hauled crates on the docks. Then the storm cut the road, and now there's no work at all.", '我给商队赶过车，也在码头上扛过货。风暴把路冲断了，现在什么活儿都没有。'),
    line('greeting:first', "Don't look at me like that. I'm Vigo. The storm left me stranded here; I'm not looking for trouble.", '别那样看我。我叫维戈，是被风暴困在这儿的，不是来惹事的。', { once: true }),
    line('default', "Whoever feeds me, I'll carry their pack and fight for them. A few coins and a meal, that's all. Nobody's asked yet.", '谁管我饭，我就给谁背东西、替谁打架。几个钱加一顿饭就行。到今天还没人找过我。'),
    line('default', "The village watch takes a second look at me every time they pass. I know what they're thinking.", '村里的卫兵每回从我身边过，都要多看我两眼。他们在想什么，我清楚得很。'),
    line('hour:night', "It's bitter at night, colder than sleeping on the road. I'll find a corner out of the wind and make do.", '夜里冷得厉害，比睡在路上还冷。我找个背风的墙角凑合一晚。'),
    line('topic:theft', "Don't look at me. …All right, fine. I was hungry.", '别看我。……好吧，好吧。我是饿了。', { mood: 'shy' }),
    line('given:item/food', "Oh — gods. Thank you. I owe you for this. Ask, and I'll come with you.", '哦，天哪。谢谢你。这份情我记着。你要人帮忙，开口就行，我跟你走。', { mood: 'happy' }),
    line('given', "Coin's better, but I won't say no.", '要是钱就更好了，不过我不会推辞。'),
  ],
}
