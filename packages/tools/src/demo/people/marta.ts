// Marta keeps the village fire and its pot. Everyone eats at her fire, and since the storm
// there is too little to put in the pot.

import { line, type PersonDef } from '../person.ts'

export const marta: PersonDef = {
  id: 'npc.marta',
  role: 'innkeeper',
  name: { en: 'Marta', zh: '玛尔塔' },
  look: 'Woman',
  age: 44,
  temperament: { personality: 'warm', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: {},
  schedules: {
    default: [
      [22, 6, 'meadow:cook.home', 'sleep'],
      [6, 22, 'meadow:cook.fire', 'mind the pot'],
    ],
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "A dragon! And you still come back for my stew. Sit. You have earned a second bowl.", "一条龙！你倒还记得回来喝我的汤。坐吧，你配得上第二碗。"),
    line('topic:crossed', "Across the river already? Eat first. The far bank has no kitchens.", "已经过河了？先吃饭。对岸可没有厨房。"),
    line('topic:flame_stolen', "The Firstlight is gone and the hearths still burn. Somehow that is worse.", "初火没了，家家的灶火却还在烧。不知怎的，这更叫人难受。"),
    line('default', 'A pot with nothing in it is just a hat for the fire.', '锅里没东西，就只是给火戴的帽子。'),
    line('hour:evening', "Sit, eat. It isn't much, but it's hot.", '坐下吃吧。东西不多，但是热乎。'),
    line('default', 'Pell and his grey man. Stories, stories. He got that from his father, who went east and did not write.', '佩尔和他的灰衣人。故事，全是故事。他这毛病是跟他爹学的——他爹往东去了，再没来过信。'),
  ],
}
