// Rowan, the elder of Firstlight Village. Two of his foragers went down to the old barrow
// for shelter from the storm and did not come back; he asks anyone who can hold a weapon.

import { line, type PersonDef } from '../person.ts'

export const rowan: PersonDef = {
  id: 'npc.rowan',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'villager',
  essential: true,
  name: { en: 'Rowan', zh: '罗万' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.weary', outfit: 'outfit.tunic', beard: 'beard.full', hat: null }, colors: { hair: 'silver', eyes: 'hazel', skin: 'light', 'outfit.1': 'umber', 'outfit.2': 'slate' } },
  age: 67,
  temperament: { personality: 'grave', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/document/map', 1], ['item/food/apple', 4], ['item/food/wine', 1]] },
  purse: 40,
  schedules: {
    default: [
      [21, 7, 'meadow.elder:bed.0', 'sleep'],
      [7, 21, 'meadow:elder.porch', 'keep watch over the square'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Every morning I count the chimneys with smoke from the porch. There are a few fewer than last winter.', '我每天早上都在门廊上数一遍冒烟的烟囱。比去年冬天少了几根。'),
    line('chat', "When I was a boy, Firstlight had a hundred souls or so. There are far fewer now. Most of those who left went east, and I've not seen one of them come back.", '我小时候，初原村有一百来口人。如今少多了。走的人大多是往东去的，我没见谁回来过。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "Someone came up the Sunrise Road and said the dragon of Emberfall is dead, and that it was you who killed it. I'm glad. The whole village is glad today.", '东边路上来的人说，余烬镇的那条龙死了，是你杀的。我很高兴。今天全村的人都很高兴。'),
    line('default', "You've come down off the mountain, then. I'm Rowan; I'm elder here, for what that's worth. The day the storm broke, two of ours went into Longsleep Barrow to the south for shelter — Lina and Oskar. They've not come back. The dead lie in that barrow. They used to lie quiet. Not lately. I'm too old to go down there myself, and we've few left who can hold a blade. If you'd go: south through Dusklea and Hushwood to Thornwood Hollow. The barrow mouth is between two standing stones. I'd be grateful.", '你是从山上下来的吧。我叫罗万，是这个村子的长老。起风暴那天，村里有两个人去了南边的长眠冢避雨，一个叫莉娜，一个叫奥斯卡。到今天还没回来。那座长眠冢里埋的都是死人。以前死人是安安静静躺着的，这阵子不是了。我年纪大了，下不去。村里能拿兵器的人，也没剩几个。你要是肯走一趟：往南穿过暮牧原和噤声林，到荆棘谷，两块立石中间就是长眠冢的入口。拜托了。'),
    line('fact:ch1.flame_stolen', 'The flame has burned here longer than these houses have stood. That heretic walked into the chapel and carried it off, and not one of us stopped him. I am the elder. I should have stopped him.', '圣火在这里烧得比这些房子还久。那个异端走进礼拜堂，把它拿走了，我们谁也没拦住。我是长老，我该拦住他的。', { mood: 'angry' }),
    line('fact:ch1.letter', "I've heard about the Church's letter. They want you to go east. Go, then; the whole village will pray for you. And if you meet that thief in grey on the road, remember what he took from us.", '教会的信我听说了，是叫你往东去。去吧，全村的人都会替你祷告。路上要是遇见那个穿灰衣的贼，别忘了他从我们这里拿走了什么。'),
    line('fact:ch1.end', 'The Crown of Thorns is here in our village, and the chapel altar is still cold. The Church tells us to be patient. To be honest, I am running out of patience.', '荆棘冠现在就在我们村里，可礼拜堂的祭坛还是冷的。教会叫我们忍耐。说实话，我快忍不下去了。'),
    line('default', "The barrow is in Thornwood Hollow to the south, between two standing stones. Lina and Oskar — I'm counting on you.", '长眠冢在南边的荆棘谷，两块立石中间。莉娜和奥斯卡，拜托你了。'),
  ],
}
