// Edda, the farmstead's survivor on the East Road (docs/chapter-1.md §7): the short days killed her
// crops, the night things came, and the grey man pulled her out. After the knight falls she moves to
// Firstlight (her schedule follows the story).

import { line, type PersonDef } from '../person.ts'

export const edda: PersonDef = {
  id: 'npc.edda',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'farmer',
  essential: true,
  name: { en: 'Edda', zh: '艾达' },
  gender: 'female',
  look: { parts: { hair: 'hair.ponytail', face: 'face.weary', outfit: 'outfit.workdress', hat: 'hat.kerchief' }, colors: { hair: 'umber', eyes: 'bark', skin: 'tan', 'outfit.1': 'moss', 'hat.1': 'russet' } },
  age: 44,
  temperament: { personality: 'stubborn', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/food/potato', 4], ['item/food/carrot', 4], ['item/food/egg/raw', 4], ['item/seed/wheat', 5]] },
  purse: 20,
  schedules: {
    default: [
      [0, 24, 'eastroad:edda.barn', 'hide in the barn'],
    ],
    'fact:sins.defeated.alberic': [
      [21, 7, 'meadow.cabin:bed.0', 'sleep'],
      [7, 21, 'meadow:edda.garden', 'work the village garden'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I still wake at the hour the rooster used to crow. There is no rooster. I wake anyway.', '我还是在公鸡以前打鸣的那个钟点醒来。鸡没了。我照样醒。'),
    line('chat', 'A house is just walls until you\'ve lost one. Then it is everything.', '房子只是几面墙，直到你失去过一座。然后它就是一切。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:crown', "The crown is in the village now. I went to look at it. Only thorns. I thought it would look like more.", "荆棘冠现在在村里了。我去看过。就是一圈荆棘。我还以为它会更像样些。"),
    line('greeting:first', 'Stay back! ...You\'re not one of them. Sorry. I don\'t see many living faces out here any more.', '别过来！……你不是那些东西。抱歉。这一带我很久没见过活人的脸了。'),
    line('default', 'The days got too short for the wheat. Then the night things came for what was left. The house is all I kept.', '白天短得麦子都长不成。后来夜里的东西把剩下的也夺走了。我只保住了这栋房子。'),
    line('default', 'There\'s a knight up the road, in white. He took my husband\'s ring off the gatepost. Took everything that shone.', '路那头有个白衣骑士。他从门柱上取走了我丈夫的戒指。凡是会发光的东西他都拿走了。'),
    line('fact:ch1.flame_stolen', 'A grey man came through, the night of the fire. He pulled me out of the smoke. Don\'t tell anyone in the village I said so.', '着火那天夜里，有个灰衣人路过。是他把我从烟里拉出来的。别跟村里人说是我讲的。'),
    line('fact:sins.defeated.alberic', 'The road is quiet again. I\'ll go to Firstlight — there\'s nothing to keep me here but ash.', '路上又安静了。我去初原村——这里除了灰烬，什么都留不住我了。', { once: true }),
  ],
}
