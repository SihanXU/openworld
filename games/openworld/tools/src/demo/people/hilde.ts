// Hilde, the fisher of the Reed Bend east of the forest (docs/chapter-1.md §15), where the Ford's river bends south.
// Forty years on the water and she has never seen a god in it; nine winters back the fog took her husband Rolf and
// gave the boat back without him. The boat's bell lies out on the spit where the water slimes are. She fishes from
// her pier from first light to dark, smokes eels, and says what she means.

import { line, type PersonDef } from '../person.ts'

export const hilde: PersonDef = {
  id: 'npc.hilde',
  role: 'fisher',
  essential: true,
  name: { en: 'Hilde', zh: '希尔德' },
  gender: 'female',
  look: { parts: { hair: 'hair.tied', face: 'face.stern', outfit: 'outfit.oilcloth', hat: 'hat.kerchief' }, colors: { hair: 'steelgrey', eyes: 'sky', skin: 'fair', 'outfit.1': 'slate', 'outfit.2': 'undyed', 'hat.1': 'indigo' } },
  age: 47,
  temperament: { personality: 'blunt', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { level: 2, stock: [['item/food/fish/raw', 4], ['item/food/fish/eel', 1], ['item/misc/bait', 5], ['item/tool/fishing_rod', 1]] },
  purse: 18,
  schedules: {
    default: [
      [22, 5, 'reedbend.cabin:hilde.bed', 'sleep'],
      [5, 22, 'reedbend:hilde.pier', 'fish from the pier'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'A fish takes the bait when it is hungry, not when you are patient. People get that backwards.', '鱼饿了才咬钩，不是你有耐心它就咬。人们总把这弄反。'),
    line('chat', 'Fog on the bend means eels in the morning. Rolf taught me that. It is still true.', '河湾起雾，早上就有鳗鱼。罗尔夫教我的。到现在还是对的。'),
    line('greeting:first', 'Hilde. I fish. If it\'s fish you want, I have fish. If it\'s talk, the forest is full of trees.', '我叫希尔德，打鱼的。你要鱼，我有鱼。你要聊天，林子里有的是树。'),
    line('default', 'Forty years on this water and I never once saw a god in it. Saw a great many eels.', '在这条河上四十年，我一次也没在水里看见过神。倒是看见过数不清的鳗鱼。'),
    line('default', 'Eels bite after dark, pike in the deep, sunfish when the sun is on the water. A rod is two sticks and two handfuls of grass. Bait makes them bite twice as fast.', '鳗鱼天黑以后咬钩，狗鱼在深水里，太阳鱼要等太阳照在水面上。两根树枝加两把草就是一根鱼竿。上了饵它们咬得快一倍。'),
    line('default', 'My Rolf went out in the fog nine winters back. The boat came home by itself. The bell\'s still out on the spit, with the slimes. I don\'t go out there.', '九个冬天前，我家罗尔夫在雾里出了船。船自己回来了。船铃现在还在沙洲上，和那些史莱姆在一起。我不去那儿。', { mood: 'sad' }),
    line('fact:ch1.boatbell', 'It rings the same. I thought it would ring different. ...Thank you. I\'ll hang it over the door, so he knows which one is ours.', '它还是那个声音。我以为会变的。……谢谢你。我把它挂在门上，好让他认得哪间是我们家。', { mood: 'sad', once: true }),
    line('fact:ch1.drowned_stone', 'The stone? It was here before the village. Before the Church came and told us what to be sorry for. Whoever cut it thought giving a fish was worth remembering. So do I.', '那块石头？村子还没有的时候它就在了。比教会来教我们该为什么忏悔还早。刻它的人觉得，送一条鱼这件事值得记下来。我也这么觉得。', { once: true }),
    line('given', 'Fish for the smoke? Good. Set it there.', '给熏房的鱼？好。放那儿吧。'),
  ],
}
