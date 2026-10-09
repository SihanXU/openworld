// Marta keeps the village fire and its pot. Everyone eats at her fire, and since the storm
// there is too little to put in the pot.

import { line, type PersonDef } from '../person.ts'

export const marta: PersonDef = {
  id: 'npc.marta',
  role: 'innkeeper',
  name: { en: 'Marta', zh: '玛尔塔' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.soft', outfit: 'outfit.workdress', hat: null }, colors: { hair: 'chestnut', eyes: 'hazel', skin: 'warm', 'outfit.1': 'madder', 'outfit.2': 'linen' } },
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
    line('default', 'A pot with nothing in it is just a hat for the fire.', '锅里没东西，就只是给火戴的帽子。'),
    line('hour:evening', "Sit, eat. It isn't much, but it's hot.", '坐下吃吧。东西不多，但是热乎。'),
    line('default', 'Pell and his grey man. Stories, stories. He got that from his father, who went east and did not write.', '佩尔和他的灰衣人。故事，全是故事。他这毛病是跟他爹学的——他爹往东去了，再没来过信。'),
  ],
}
