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
    line('default', 'A pot with nothing in it is just a hat for the fire.', '锅里没东西，就只是给火戴的帽子。'),
    line('hour:evening', "Sit, eat. It isn't much, but it's hot.", '坐下吃吧。东西不多，但是热乎。'),
  ],
}
