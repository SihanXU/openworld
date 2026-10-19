// Brin, the village's herder (docs/chapter-1.md §11): she keeps Firstlight's cows and hens on the
// grassland south of it. The night-born take more of the herd every week, and at dusk the cows kneel,
// all facing east, toward the White Knight's kingdom.

import { line, type PersonDef } from '../person.ts'

export const brin: PersonDef = {
  id: 'npc.brin',
  role: 'herder',
  essential: true,
  name: { en: 'Brin', zh: '布琳' },
  gender: 'female',
  look: { parts: { hair: 'hair.ponytail', face: 'face.bright', outfit: 'outfit.workdress', hat: 'hat.straw', mark: 'mark.freckles' }, colors: { hair: 'honey', eyes: 'leaf', skin: 'light', 'outfit.1': 'ochre' } },
  age: 24,
  temperament: { personality: 'steady', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/food/egg/raw', 6], ['item/vessel/bucket/milk', 1], ['item/material/feather', 4], ['item/material/wool', 3]] },
  purse: 25,
  schedules: {
    default: [
      [21, 6, 'meadow:market.shelter', 'sleep'],
      [6, 21, 'pasture:herd.watch', 'watch the herd'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'A hen knows the weather before the sky does. Watch the hens, not the clouds.', '母鸡比天空先知道天气。看鸡，别看云。'),
    line('chat', 'The calves like their ears scratched. Don\'t tell Holt I said anything that soft.', '小牛喜欢被挠耳朵。别告诉霍尔特我说过这么软的话。'),
    line('greeting:first', 'Mind the hens. And don\'t run — the cows spook. Brin. I keep the herd.', '小心鸡。也别跑——牛会受惊的。我叫布琳，管牛群的。'),
    line('default', 'Every dusk they go down on their knees, the whole herd, all facing east. My gran never saw a cow kneel in her life.', '每到黄昏，整群牛都会跪下来，全都朝着东边。我奶奶活了一辈子都没见过牛下跪。'),
    line('default', 'The grass is thin this year. Short days, short grass. That\'s all it is. That\'s what I tell them.', '今年的草很稀。白天短，草也短。就这么回事。我是这么跟它们说的。'),
    line('hour:evening', 'Here it comes — watch them. ...There. Down they go. East.', '来了——你看它们。……看。跪下了。朝东。'),
    line('fact:ch1.crown', 'They stopped kneeling. The day you came back with that crown, they stopped. ...They just stand there now and look east.', '它们不跪了。你带着那顶冠回来的那天，就不跪了。……现在它们只是站着，朝东看。', { once: true }),
  ],
}
