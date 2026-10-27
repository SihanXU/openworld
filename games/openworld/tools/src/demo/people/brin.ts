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
    line('chat', 'When rain is coming the hens go in early. I trust them more than I trust the sky.', '要下雨了，鸡会早早钻回窝里。比起看天，我更信它们。'),
    line('chat', 'The calves like having their ears scratched. Don\'t tell Holt I told you that.', '小牛喜欢让人挠耳朵。这话你别跟霍尔特说是我讲的。'),
    line('greeting:first', 'Mind the hens. And don\'t run, the cows spook easily. I\'m Brin; I keep the herd.', '当心脚下的鸡。也别跑，牛容易受惊。我叫布琳，这群牛归我管。'),
    line('default', 'Every dusk the whole herd goes down on its knees, all facing east. My gran kept cows all her life and never once saw one kneel.', '每天天一黑，整群牛就跪下来，全都朝着东边。我奶奶养了一辈子牛，从没见过牛下跪。'),
    line('default', 'The grass is thin this year. The days are short, so the grass is short. I tell myself that\'s all it is.', '今年的草长得稀。白天短了，草也就长不高。我跟自己说，就是这么回事。'),
    line('hour:evening', 'Here it comes — watch them. ...There. Down they go. East.', '来了，你看着它们。……看，跪下去了。朝着东边。'),
    line('fact:ch1.crown', 'They stopped kneeling. The day you came back with that crown, they stopped. ...Now they just stand there and look east.', '它们不跪了。你带着那顶冠回来的那天就不跪了。……现在它们只是站在那儿，朝东边看。', { once: true }),
  ],
}
