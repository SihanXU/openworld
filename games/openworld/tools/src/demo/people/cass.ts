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
    line('chat', 'I can hear a thread go slack before I see it. The loom sounds duller.', '线一松，我不用看就听得出来，织机的声音会发闷。'),
    line('chat', 'Gus snores like the kiln. We\'ve been married thirty years, and I sleep right through it.', '格斯打呼噜跟窑炉似的。我们成亲三十年了，我早听惯了，倒头就睡。'),
    line('greeting:first', "You're new here. I'm Cass, Gus's wife. He's out in the wood most days, and I'm at my loom by the square.", '你是新来的吧。我叫卡丝，格斯是我男人。他白天多半在林子里砍柴，我就在广场边上织布。', { once: true }),
    line('default', 'The wool comes off the grassland, and I boil the dye from herbs. Winter\'s coming, and every yard of cloth will be wanted.', '羊毛是草原上来的，染料是拿草药煮的。冬天快到了，织多少布都不嫌多。'),
    line('default', 'Gus is out at the wood all day and comes home too tired to eat. I keep the house, and I see that he eats.', '格斯成天在林子里砍柴，回到家累得饭都不想吃。家里的事我管着，饭也得看着他吃下去。'),
    line('hour:evening', 'There\'s a fire on the square and Marta has something in the pot. Come and sit, if you like.', '广场上生着火，玛尔塔锅里还煮着东西。你想坐就过来坐吧。'),
    line('topic:death', "Someone died, and nobody here will say how. With everyone keeping their mouths shut like that, I can't sleep at night.", '有人死了，可村里谁也不肯说是怎么死的。大家都闭着嘴，我夜里睡不安稳。', { mood: 'sad' }),
    line('given:item/food', 'Oh, thank you. I\'ll save half for Gus.', '哎呀，谢谢你。我留一半给格斯。', { mood: 'happy' }),
    line('given', 'For me? Well... thank you.', '给我的？哎……谢谢你。', { mood: 'shy' }),
  ],
}
