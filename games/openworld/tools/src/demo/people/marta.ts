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
      [22, 6, 'meadow:cook.home', 'sleep'],
      [6, 22, 'meadow:cook.fire', 'mind the pot'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Salt last, never first. Half the cooks in the world have it backwards.', '盐最后放，别一开始就放。世上一半的厨子都弄反了。'),
    line('chat', 'Mia eats the crust and leaves the middle. Her father did the same. I never told her that.', '米娅只吃面包皮，不吃芯。她爸爸也这样。我从没告诉过她。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "A dragon! And you still come back for my stew. Sit. You have earned a second bowl.", "一条龙！你倒还记得回来喝我的汤。坐吧，你配得上第二碗。"),
    line('topic:crossed', "Across the river already? Eat first. The far bank has no kitchens.", "已经过河了？先吃饭。对岸可没有厨房。"),
    line('topic:flame_stolen', "The Firstlight is gone and the hearths still burn. Somehow that is worse.", "初火没了，家家的灶火却还在烧。不知怎的，这更叫人难受。"),
    line('default', 'A pot with nothing in it is just a hat for the fire.', '锅里没东西，就只是给火戴的帽子。'),
    line('hour:evening', "Sit, eat. It isn't much, but it's hot.", '坐下吃吧。东西不多，但是热乎。'),
    line('default', 'Pell and his grey man. Stories, stories. He got that from his father, who went east and did not write.', '佩尔和他的灰衣人。故事，全是故事。他这毛病是跟他爹学的——他爹往东去了，再没来过信。'),
  ],
}
