// Bram, the old drillmaster of Firstlight Village. He trained the road wardens before the
// storms came, and now trains whoever walks down from the mountain and lasts long enough to
// be worth it (level 5). Blade, mace, bow or wand: he sets you on one, and lets you change
// your mind — at the cost of starting that road again. He keeps the yard day and night and
// never leaves his spot, a mark over his head, so he is easy to find.

import { line, type PersonDef } from '../person.ts'

export const bram: PersonDef = {
  id: 'npc.bram',
  role: 'trainer',
  essential: true,
  name: { en: 'Bram', zh: '布拉姆' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.stern', outfit: 'outfit.gi', beard: 'beard.moustache', hat: null }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'warm', 'outfit.1': 'undyed', 'outfit.2': 'umber' } },
  age: 61,
  temperament: { personality: 'stern', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.tobin': 'the peddler who talks through his drills' },
  // a trainer struck strikes back
  fights: true,
  purse: 60,
  // he keeps the drill yard day and night, standing where anyone can find him (tag stationary)
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/weapon/blade/dagger', 1], ['item/weapon/blade/sword', 1], ['item/weapon/ranged/bow', 1], ['item/weapon/magic/staff', 1]] },
  schedules: {
    default: [[0, 24, 'meadow:drill.yard', 'keep the drill yard']],
  },
  tags: ['stationary'],
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I was quicker than you once. Then I was quicker than nobody. That is how it goes.', '我曾经比你快。后来谁都比我快。事情就是这样。'),
    line('chat', 'Rest is a drill too. The young never believe me.', '休息也是一种训练。年轻人从来不信。'),
    line('favourite', 'The one thing that still makes an old man smile is {favourite}. Tobin knows it. Tobin charges accordingly.', '还能让老头子笑的只有{favourite}一样东西。托宾知道。托宾收钱也按这个来。'),
    // said once, at whatever level one first comes by: the road opens at level five
    line('greeting:first', 'Off the mountain, are you. Once you have a few fights in you — level five — I set people on a road: dagger, sword and shield, bow or staff. Pick when you are ready.', '从山上下来的？打过几场像样的仗、到了五级，我就给人指条路：匕首、剑盾、弓，还是法杖。准备好了就选。', { once: true }),
    line('default', 'Pick a road and walk it. Change your mind if you must — but you start that road again from the first step.', '选一条路，就走下去。真要改也行——只是新路得从头走起。'),
    line('default', 'A dagger from behind. A sword and a shield from the front. An arrow from afar. A spell from wherever you stand. Which are you?', '匕首从背后，剑盾从正面，箭从远处，法术从你站着的地方。你是哪一种？'),
    line('default', 'Tobin talks through every drill. I have stopped telling him.', '托宾每次操练都在旁边说个不停。我已经懒得说他了。'),
    line('hour:evening', 'Light is going. Practise your footwork; it does not need light.', '天要黑了。练练步法吧，步法不用看。'),
    line('weather:rain', 'Rain makes the grip slip. Learn to hold on anyway.', '下雨手会打滑。照样得学会握紧。'),
    line('given', 'Keep it. Gifts do not make a fighter.', '留着吧。礼物成就不了战士。'),
  ],
}
