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
    line('chat', 'A face is a story the hair tells first. Mine says: came a long way, still fixing it.', '脸是头发先讲的一个故事。我的头发说：走了很远，还在收拾。'),
    line('chat', 'In the Holy City they wanted gold in everything. Here a pin of wildflowers does, and does better.', '在圣城他们什么都要镶金。在这儿别一枝野花就够了，还更好看。'),
    line('greeting:first', "New face! Sit, sit. I'm Odette — I do hair, and anything else about you that wants doing. Bring me wildflowers; I'm always short.", '生面孔！坐，坐。我叫奥黛特——我做头发，你身上想改的别的地方也行。给我带些野花来，我总是不够用。', { once: true }),
    line('default', 'Ten marks and three flowers, and you walk off a different person. Cheaper than a pilgrimage.', '十枚晨辉币加三枝野花，走出去就是另一个人。比去朝圣便宜。'),
    line('default', "Greta says I talk too much for someone holding scissors. Greta hasn't lost an ear yet.", '葛瑞塔说拿着剪刀的人话太多。葛瑞塔的耳朵一只也没少。'),
    line('hour:evening', 'The light goes and so does my work. Come back when I can see your face.', '光一走，我的活儿也就停了。等我能看清你的脸再来。'),
    line('weather:rain', 'Rain. Everyone will come in with their hair flat and blame me.', '下雨了。人人都会顶着塌头发进来，然后怪我。'),
    line('given:item/material/flower', 'Oh — wildflowers! You remembered. These go in the window today.', '哎呀——野花！你记着呢。今天就摆到窗边去。', { mood: 'happy' }),
    line('given', 'For me? You are sweet. Thank you.', '给我的？你真好。谢谢。', { mood: 'shy' }),
  ],
}
