// Greta, who keeps Firstlight's general store on the east road: lamps, rope, bread and potions over the counter, and
// she buys what the wild gives (herbs, hides, eggs). She was a drover's wife; the drovers stopped coming, the store
// did not. The counter is the shop (content village.ts): she stands behind it by day and sleeps at the back.

import { line, type PersonDef } from '../person.ts'

export const greta: PersonDef = {
  id: 'npc.greta',
  role: 'merchant',
  essential: true,
  name: { en: 'Greta', zh: '葛瑞塔' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.soft', outfit: 'outfit.workdress', hat: null }, colors: { hair: 'ash', eyes: 'hazel', skin: 'warm', 'outfit.1': 'moss', 'outfit.2': 'linen' } },
  age: 52,
  temperament: { personality: 'warm', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.marta': 'buys her bread for the shelf' },
  purse: 30,
  schedules: {
    default: [
      [21, 7, 'meadow.store:keeper.bed', 'sleep'],
      [7, 21, 'meadow.store:keeper.counter', 'keep the store'],
    ],
  },
  lines: [
    line('greeting:first', "Come in out of the wind. Lamps, rope, bread, a potion for the road — it is all on the shelves; the counter does the reckoning. And bring me herbs and hides, I pay fair.", '进来避避风。灯、绳子、面包、路上用的药水——都在架子上，到柜台结账。草药和皮子也拿来，我给公道价。', { once: true }),
    line('default', 'A torch before you go into the woods. Two, if you go to the barrow.', '进林子之前带支火把。要去古墓的话，带两支。'),
    line('default', 'Marta bakes, I sell. She says I sell it too cheap. I say she bakes it too well.', '玛尔塔烤，我卖。她说我卖得太便宜。我说是她烤得太好。'),
    line('hour:evening', 'Closing soon. Buy now or buy tomorrow — the shelf will wait.', '快关门了。现在买还是明天买——架子会等你。'),
    line('weather:rain', 'Rain brings customers. Nobody wants to be outside.', '下雨天客人多。谁都不想待在外头。'),
    line('given', 'For me? I will put it in the window.', '给我的？我把它摆在窗边。'),
  ],
}
