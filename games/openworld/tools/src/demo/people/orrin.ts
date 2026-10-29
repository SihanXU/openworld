// Orrin, the charcoal burner of the Charcoal Dell west of the forest (docs/chapter-1.md §15). He has burned charcoal
// for Firstlight's smithies and hearths for forty years, sleeping beside his kilns while they smoulder. His back is
// going, boars root up his coppice, and since the night the bridge came down every bird in the forest roosts in his
// old oak at dusk and does not sing. He keeps a tally of the days.

import { line, type PersonDef } from '../person.ts'

export const orrin: PersonDef = {
  id: 'npc.orrin',
  role: 'charcoal burner',
  essential: true,
  name: { en: 'Orrin', zh: '奥林' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.apron', beard: 'beard.full', hat: 'hat.cap' }, colors: { hair: 'silver', eyes: 'bark', skin: 'tan', 'outfit.1': 'umber', 'outfit.2': 'slate', 'hat.1': 'slate' } },
  age: 58,
  temperament: { personality: 'steady', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.gus': 'the woodcutter he trades with' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { level: 2, stock: [['item/material/coal', 6], ['item/light/torch', 3], ['item/material/log', 4]] },
  purse: 15,
  schedules: {
    default: [
      [21, 6, 'charcoal.hut:orrin.bed', 'sleep'],
      [6, 21, 'charcoal:orrin.kilns', 'tend the kilns'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Once a clamp is sealed you leave it be, but you still get up every hour to look at the smoke. Yellow smoke is good. Black means it wants more earth on it.', '炭窑封上以后就别去动它，可每个钟头还是得起来看一眼烟。冒黄烟是好的，冒黑烟就得往上补土。'),
    line('chat', "Forty years of charcoal, and the smoke won't wash out of me. When my wife was alive she made me shake my clothes out at the door before I came in.", '烧了四十年炭，身上的烟味是洗不掉了。我老婆在的时候，总要我在门外把衣服抖干净了才准进屋。'),
    line('greeting:first', 'Orrin. I burn charcoal. A clamp takes four days and you sleep next to it or you lose it, so I sleep next to it. You want coal, I have coal.', '我叫奥林，烧炭的。一窑炭要烧四天，不睡在旁边就得废掉，所以我就睡在旁边。你要炭，我这儿有炭。'),
    line('default', 'Gus brings me logs when his back lets him. His back lets him less and less. Mine too.', '格斯腰还行的时候会给我送木头来。他的腰越来越不行了。我的也是。'),
    line('default', 'The birds came the night the bridge went. Every one in Hushwood, into my oak, and not a note out of them since. I cut a notch for every day. The board is getting full.', '桥没了的那天晚上，鸟就来了。整座林子的鸟，全落在我那棵橡树上，从那以后一声都没叫过。我每天刻一道痕。板子快刻满了。'),
    line('default', 'Boars. They root up the coppice stools and the young shoots never come. Six years of growing, gone in a night.', '野猪。它们把矮林的树桩拱翻，新芽就再也发不出来了。六年的功夫，一夜就没了。'),
    line('fact:ch1.roost', "You saw them too. Every one of them facing east, like they're waiting for something to come down that road. I still cut a notch every day. When the board's full I'll find another.", '你也看见了。它们全都朝着东边，像是在等什么东西从那条路上过来。我还是每天刻一道痕。板子刻满了，我就再找一块。', { mood: 'sad', once: true }),
    line('given', 'For the clamp? Good. It all burns.', '给窑里的？好。什么都能烧。'),
  ],
}
