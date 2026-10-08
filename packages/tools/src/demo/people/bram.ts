// Bram, the old drillmaster of Firstlight Village. He trained the road wardens before the
// storms came, and now trains whoever walks down from the mountain and lasts long enough to
// be worth it (level 5). Blade, mace, bow or wand: he sets you on one, and lets you change
// your mind — at the cost of starting that road again. He keeps the yard day and night and
// never leaves his spot, a mark over his head, so he is easy to find.

import { line, type PersonDef } from '../person.ts'

export const bram: PersonDef = {
  id: 'npc.bram',
  role: 'trainer',
  name: { en: 'Bram', zh: '布拉姆' },
  look: 'Master',
  age: 61,
  temperament: { personality: 'stern', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.tobin': 'the peddler who talks through his drills' },
  // he keeps the drill yard day and night, standing where anyone can find him (tag stationary)
  schedules: {
    default: [[0, 24, 'meadow:drill.yard', 'keep the drill yard']],
  },
  tags: ['stationary'],
  lines: [
    line('greeting:first', 'Off the mountain, are you. Come back when you have a few fights in you — level five — and I will set you on a road: blade, mace, bow or wand.', '从山上下来的？等你打过几场像样的仗——五级——再来找我，我给你指条路：短刃、重锤、弓，还是法杖。', { once: true }),
    line('default', 'Pick a road and walk it. Change your mind if you must — but you start that road again from the first step.', '选一条路，就走下去。真要改也行——只是新路得从头走起。'),
    line('default', 'A blade from behind. A mace from the front. An arrow from afar. A spell from wherever you stand. Which are you?', '短刃从背后，重锤从正面，箭从远处，法术从你站着的地方。你是哪一种？'),
    line('default', 'Tobin talks through every drill. I have stopped telling him.', '托宾每次操练都在旁边说个不停。我已经懒得说他了。'),
    line('hour:evening', 'Light is going. Practise your footwork; it does not need light.', '天要黑了。练练步法吧，步法不用看。'),
    line('weather:rain', 'Rain makes the grip slip. Learn to hold on anyway.', '下雨手会打滑。照样得学会握紧。'),
    line('given', 'Keep it. Gifts do not make a fighter.', '留着吧。礼物成就不了战士。'),
  ],
}
