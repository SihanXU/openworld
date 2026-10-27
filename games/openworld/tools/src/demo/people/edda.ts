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
    line('chat', 'I still wake at the hour the rooster used to crow. There is no rooster now. I wake anyway.', '我每天还是在公鸡打鸣的时辰醒过来。公鸡早就没了，可我还是会醒。'),
    line('chat', 'Sorry — I jump at every sound. Since the night they came, I can\'t sleep unless my back is to a wall.', '对不起，一点动静我就吓一跳。自从那天夜里它们来过，我不背靠着墙就睡不着。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:crown', "The crown is in the village now. I went to look at it. It's only thorns. I thought it would look like... more.", "荆棘冠现在放在村里了。我去看过一眼，就是一圈荆棘。我还以为它会更……更了不得一点。"),
    line('greeting:first', 'Stay back! ...You\'re not one of them. Sorry. I haven\'t seen a living face out here in a long while.', '别过来！……你不是那些东西。对不起。这一带我好久没见过活人了。'),
    line('default', 'The days got too short for the wheat to ripen. Then the night things came for what was left. The house is all I kept.', '白天短得麦子都熟不了。后来夜里那些东西来了，把剩下的也糟蹋了。我就只保住了这间屋子。'),
    line('default', 'There\'s a knight up the road, all in white. He took my husband\'s ring off the gatepost. He took everything that shone.', '路那头有个骑士，一身白。他把我丈夫的戒指从门柱上拿走了。凡是会发亮的东西，他都拿走了。'),
    line('fact:ch1.flame_stolen', 'A man in grey came through, the night of the fire. He pulled me out of the smoke. Don\'t tell anyone in the village I said so.', '起火那天夜里，有个穿灰衣服的人路过，是他把我从烟里拖出来的。你别跟村里人说是我讲的。'),
    line('fact:sins.defeated.alberic', 'The road\'s gone quiet again. I\'ll go to Firstlight. There\'s nothing left for me here but ash.', '路上又安静下来了。我要去初原村。这里除了一地灰，什么也不剩了。', { once: true }),
  ],
}
