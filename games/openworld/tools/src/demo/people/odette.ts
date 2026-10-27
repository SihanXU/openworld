// Odette, Firstlight's dresser: hair, faces and the colours of a coat, done on the square beside her standing mirror
// (content dresser.ts, docs/looks.md §5). She came up from the Holy City with a peddler's train and stayed for the
// light; she pays in flowers and takes them in payment. No quest asks for her: an ordinary life (docs/npc-sandbox.md).

import { line, type PersonDef } from '../person.ts'

export const odette: PersonDef = {
  id: 'npc.odette',
  role: 'villager',
  // the dresser: asked, or a hand on her mirror, opens the restyle panel (content dresser.ts)
  tags: ['dresser'],
  name: { en: 'Odette', zh: '奥黛特' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.bright', outfit: 'outfit.workdress', hat: null }, colors: { hair: 'copper', eyes: 'leaf', skin: 'fair', 'outfit.1': 'plum', 'outfit.2': 'linen' } },
  age: 34,
  favourite: 'item/material/flower',
  temperament: { personality: 'warm', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.cass': 'buys her cloth', 'npc.greta': 'friend' },
  purse: 30,
  items: [{ form: 'item/misc/bouquet' }],
  trade: { stock: [['item/misc/bouquet', 1], ['item/material/flower', 4]] },
  schedules: {
    default: [
      // she came with a peddler's train and sleeps as the travellers do, under the market shelter
      [21, 7, 'meadow:market.shelter', 'sleep'],
      [7, 9, 'meadow:square.well', 'fetch water'],
      [9, 18, 'meadow:dresser.stand', 'dress hair'],
      [18, 21, 'meadow:square.warm', 'sit by the fire'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "Don't laugh at my hair. I do everyone else's all day and never get round to my own.", '我自己的头发乱成这样，你可别笑。一整天都在给别人弄，轮不到我自己。'),
    line('chat', 'In the Holy City the ladies wanted gold on everything. Here a sprig of wildflowers looks lovely, and honestly, I like it better.', '在圣城，太太们什么都要镶金。到了这儿，别一枝野花就很好看了。说实话，我更喜欢这样。'),
    line('greeting:first', "New face! Sit, sit. I'm Odette — I do hair, and anything else about you that wants doing. Bring me wildflowers if you find any; I'm always short.", '生面孔！坐，坐。我叫奥黛特，做头发的——你身上还有哪儿想改改，也可以找我。看见野花的话给我带点来，我总是不够用。', { once: true }),
    line('default', "It's ten marks and three wildflowers a time. Hair, face, the colour of your coat — I can change any of it.", '做一次是十枚晨辉币，外加三枝野花。头发、脸、衣服的颜色，哪样都能换。'),
    line('default', "Greta always says I talk too much with scissors in my hand. I've cut her hair every month since I came, and I've never nicked her once.", '葛瑞塔总说我拿着剪刀还说个不停。我来了以后每个月都给她剪头发，一回都没剪着过她。'),
    line('hour:evening', 'The light goes and so does my work. Come back when I can see your face.', '天一黑，我的活儿也就停了。等我能看清你的脸再来吧。'),
    line('weather:rain', 'Rain. Everyone will come in with their hair flat and blame me.', '下雨了。待会儿人人都会顶着塌下来的头发进来，然后怪我。'),
    line('given:item/material/flower', 'Oh — wildflowers! You remembered. These go in the window today.', '哎呀，野花！你还记着呢。今天就摆到窗边去。', { mood: 'happy' }),
    line('given', 'For me? You are sweet. Thank you.', '给我的？你真好。谢谢。', { mood: 'shy' }),
  ],
}
