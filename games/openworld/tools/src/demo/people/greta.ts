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
  purse: 60,
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/light/torch', 5], ['item/food/bread', 4], ['item/potion/healing', 2]] },
  schedules: {
    default: [
      [21, 7, 'meadow.store:keeper.bed', 'sleep'],
      [7, 21, 'meadow.store:keeper.counter', 'keep the store'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I keep a book behind the counter of what each house buys. When a house that always comes stops coming, I go and knock on the door.', '柜台后面我记着一本账，哪家常买什么都写着。哪家平常总来、忽然不来了，我就去敲敲他家的门。'),
    line('chat', 'The drovers used to bring the news along with the cattle. Since the storms cut the road they don\'t come, and I\'m the last to hear anything.', '以前赶牲口的人路过，会把外头的消息一起捎来。自从风暴把路截断，他们就不来了，外头出了什么事，我总是最后一个知道。'),
    line('greeting:first', "Come in out of the wind. Lamps, rope, bread, a potion for the road — it's all on the shelves; pay at the counter. And if you have herbs or hides, bring them to me. I pay fair.", '快进来，外头风大。灯、绳子、面包、路上喝的药水，都在架子上，挑好了到柜台结账。你要是有草药和皮子，也拿来卖给我，我给公道价。', { once: true }),
    line('default', 'Take a torch before you go into the woods. Two, if you\'re going to the barrow.', '进林子前带一支火把。要是去古墓，带两支。'),
    line('default', 'Marta bakes the bread and I sell it. She says I charge too little. I don\'t want anyone here going without.', '面包是玛尔塔烤的，我只管卖。她嫌我卖得太便宜。便宜就便宜吧，我不想村里有人买不起。'),
    line('hour:evening', 'I\'m closing soon. If you need anything, buy it now; otherwise I open again at seven.', '快打烊了。要买什么趁现在，不然就明早七点再来。'),
    line('weather:rain', 'Rain brings customers. Nobody wants to be out in it.', '一下雨，店里人就多了。谁也不想在外头淋着。'),
    line('given', 'For me? I\'ll put it in the window.', '给我的？那我把它摆在窗台上。'),
  ],
}
