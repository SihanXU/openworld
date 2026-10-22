// Cass, the village weaver, Gus's wife. She fetches the morning's water, works her loom in the light by the
// square, and sits at Marta's fire in the evening. No quest asks for her and no scene needs her: an ordinary
// life (docs/npc-sandbox.md) — she can be befriended, robbed, asked to come along, or killed, and the village
// will remember what was done to her.

import { line, type PersonDef } from '../person.ts'

export const cass: PersonDef = {
  id: 'npc.cass',
  role: 'villager',
  name: { en: 'Cass', zh: '卡丝' },
  gender: 'female',
  age: 47,
  temperament: { personality: 'kind', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.gus': 'husband', 'npc.marta': 'friend' },
  purse: 25,
  items: [{ form: 'item/food/bread' }],
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/material/cloth', 4], ['item/clothing/cloak', 1], ['item/clothing/gloves', 1], ['item/clothing/hat', 1]] },
  schedules: {
    default: [
      [21, 6, 'meadow.woodhouse:bed.1', 'sleep'],
      [6, 9, 'meadow:square.well', 'fetch water'],
      [9, 17, 'meadow:cass.loom', 'weave'],
      [17, 21, 'meadow:square.warm', 'sit by the fire'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'The loom talks if you listen. A dropped thread sounds different from a tight one.', '织机会说话，只要你听。断了的线和绷紧的线声音不一样。'),
    line('chat', 'Gus snores like the kiln. Thirty years, and I still sleep through it. Mostly.', '格斯打呼像窑炉一样。三十年了，我照样睡得着。多半时候。'),
    line('greeting:first', "You're new. I'm Cass — Gus's wife, though most days I'd say he's the wood's husband.", '你是新来的吧。我叫卡丝——格斯的老婆，不过多数时候我觉得他是那片林子的丈夫。', { once: true }),
    line('default', 'Wool from the grassland, dye from the herbs, and a winter coming that wants every inch of it.', '羊毛来自草原，染料来自草药，冬天要来了，每一寸布都用得上。'),
    line('default', "Gus says the fire eats every day. So does Gus. So do I. Somebody has to keep the house while they're both eating.", '格斯说火天天都要吃。格斯也天天要吃。我也是。总得有人在他们吃的时候看着家。'),
    line('hour:evening', 'The square is warm and Marta has something in the pot. Sit, if you like.', '广场上暖和，玛尔塔锅里也有吃的。想坐就坐吧。'),
    line('topic:death', "Someone died, and nobody here will say how. I don't sleep well in a village that keeps that kind of quiet.", '有人死了，可这里没人肯说是怎么死的。村子要是这么安静，我睡不踏实。', { mood: 'sad' }),
    line('given:item/food', 'Oh, that is kind. I will save half for Gus.', '哎呀，你真好心。我留一半给格斯。', { mood: 'happy' }),
    line('given', 'For me? Well. Thank you.', '给我的？哎。谢谢你。', { mood: 'shy' }),
  ],
}
