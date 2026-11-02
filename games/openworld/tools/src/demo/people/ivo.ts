// Brother Ivo of the Red Order: young, earnest, quiet. He keeps the Order's graves, one of which is for a novice who is
// not dead, and stands at the posts at dusk with the Prior.

import { line, type PersonDef } from '../person.ts'

export const ivo: PersonDef = {
  id: 'npc.ivo',
  role: 'priest',
  tags: ['storybound', 'devout'],
  name: { en: 'Brother Ivo', zh: '伊沃修士' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.soft', outfit: 'outfit.cloak', hat: null }, colors: { hair: 'umber', eyes: 'hazel', skin: 'fair', 'outfit.1': 'madder' } },
  age: 28,
  favourite: 'item/light/candle',
  temperament: { personality: 'earnest', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.lucan': 'his prior' },
  purse: 8,
  trade: { stock: [['item/light/candle', 2], ['item/material/cloth', 1]] },
  schedules: {
    default: [
      [21, 5, 'scourgehouse.cells:bed.1', 'sleep'],
      [5, 17, 'scourgehouse:ivo.graves', 'keep the graves'],
      [17, 19, 'scourgehouse:ivo.post', 'take strokes at the post'],
      [19, 21, 'scourgehouse:ivo.graves', 'light the grave lamps'],
    ],
  },
  lines: [
    line('chat', 'I keep the graves. There is a stone here for a novice who left. The Prior says that is how the Order remembers those who go.', '我看守墓地。这里有一块碑，是给一个离开修会的见习修士立的。院长说，修会就是这样记住走掉的人。'),
    line('chat', 'My back is all scars, and I have never felt one of them. The Prior says that is the Rider\'s grace.', '我的背上全是疤，可没有一道疼过。院长说，那是骑者的恩典。'),
    line('default', 'The Prior is in the chapel in the mornings and in the court in the afternoons.', '院长上午在礼拜堂，下午在院子里。'),
    line('topic:quiet_dusk', 'I stood at my post tonight, and the first stroke... I did not know. I did not know it was like that.', '今晚我站到柱子前面，第一鞭下来……我不知道。我不知道原来是这样的。', { mood: 'sad' }),
    line('given:item/light/candle', 'For the grave lamps. Thank you, pilgrim.', '给墓前的灯用。谢谢你，朝圣者。', { mood: 'happy' }),
  ],
}
