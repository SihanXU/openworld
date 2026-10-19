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
    line('chat', 'A kiln is like a sleeping dog. Leave it be, and check it every hour anyway.', '炭窑像一条睡着的狗。别去打扰它，但每个钟头还是要看一眼。'),
    line('chat', 'Forty years of smoke. My wife said I smelt of autumn. She was being kind.', '四十年的烟。我妻子说我身上是秋天的味道。她是在客气。'),
    line('greeting:first', 'Orrin. I burn charcoal. A clamp takes four days and you sleep next to it or you lose it, so I sleep next to it. You want coal, I have coal.', '我叫奥林，烧炭的。一窑炭要烧四天，不睡在旁边就得废掉，所以我就睡在旁边。你要炭，我这儿有炭。'),
    line('default', 'Gus brings me logs when his back lets him. His back lets him less and less. Mine too.', '格斯腰还行的时候会给我送木头来。他的腰越来越不行了。我的也是。'),
    line('default', 'The birds came the night the bridge went. Every one in the forest, into my oak, and not a note out of them since. I cut a notch for every day. The board is getting full.', '桥没了的那天晚上，鸟就来了。整座林子的鸟，全落在我那棵橡树上，从那以后一声都没叫过。我每天刻一道痕。板子快刻满了。'),
    line('default', 'Boars. They root up the coppice stools and the young shoots never come. Six years of growing, gone in a night.', '野猪。它们把矮林的树桩拱翻，新芽就再也发不出来了。六年的功夫，一夜就没了。'),
    line('fact:ch1.roost', 'You saw them. Facing east, all of them, like they\'re waiting for something to come down that road. ...I don\'t cut notches for the birds any more. I cut them for whatever they\'re waiting for.', '你看到它们了。全朝着东边，像是在等什么东西从那条路上过来。……我现在刻痕不是为了鸟了。是为了它们等的那个东西。', { mood: 'sad', once: true }),
    line('given', 'For the clamp? Good. It all burns.', '给窑里的？好。什么都能烧。'),
  ],
}
