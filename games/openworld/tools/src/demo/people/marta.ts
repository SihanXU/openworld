// Marta keeps the village fire and its pot. Everyone eats at her fire, and since the storm
// there is too little to put in the pot.

import { line, type PersonDef } from '../person.ts'

export const marta: PersonDef = {
  id: 'npc.marta',
  role: 'innkeeper',
  essential: true,
  name: { en: 'Marta', zh: '玛尔塔' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.soft', outfit: 'outfit.workdress', hat: null }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'warm', 'outfit.1': 'madder', 'outfit.2': 'linen' } },
  age: 44,
  temperament: { personality: 'warm', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
  // the village's meals are hers to sell (the hungry come to her)
  trade: { stock: [['item/food/bread', 6], ['item/food/pie', 2], ['item/food/meat/cooked', 2], ['item/food/ale', 3]] },
  purse: 30,
  schedules: {
    default: [
      [22, 6, 'meadow.cook:bed.0', 'sleep'],
      [6, 22, 'meadow:cook.fire', 'mind the pot'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Salt goes in last. Put it in at the start and the beans never go soft, however long you cook them.', '盐要最后放。一开始就放的话，豆子怎么煮都煮不烂。'),
    line('chat', 'Mia eats the crust and leaves the middle. Her father used to do the same. I never told her that.', '米娅吃面包只吃皮，把芯剩下。她爹以前也是这样。这个我没跟她说过。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "You killed a dragon, and you still come back for my stew! Sit down. Today you get two bowls.", '杀了一条龙，还记得回来喝我的汤！坐，今天给你盛两碗。'),
    line('topic:crossed', "You've been across the river already? Eat first, then. Nobody over there will cook for you.", '你已经过了河了？那先吃饭。对岸可没人给你做饭。'),
    line('topic:flame_stolen', "The Firstlight's gone. I still lit my fire this morning and cooked like always, but I've felt uneasy all day.", '圣火没了。我早上照样生火做饭，可这一整天心里都不踏实。'),
    line('default', "Since the storm nothing's come in from the fields or up the road. The stew gets thinner every day.", '起了风暴以后，地里的东西收不上来，路上的货也进不来。我这锅汤一天比一天稀。'),
    line('hour:evening', "Sit, eat. It isn't much, but it's hot.", '坐下吃吧。东西不多，但是热乎。'),
    line('default', 'Pell and his grey man again. Stories all day long. He gets that from his father, who went east and never wrote.', '佩尔又在说他那个灰衣人，整天编故事。这毛病随他爹——他爹往东去了，一封信也没寄回来过。'),
  ],
}
