// Rowan, the elder of Firstlight Village. Two of his foragers went down to the old barrow
// for shelter from the storm and did not come back; he asks anyone who can hold a weapon.

import { line, type PersonDef } from '../person.ts'

export const rowan: PersonDef = {
  id: 'npc.rowan',
  role: 'villager',
  name: { en: 'Rowan', zh: '罗万' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.weary', outfit: 'outfit.tunic', beard: 'beard.full', hat: null }, colors: { hair: 'silver', eyes: 'hazel', skin: 'light', 'outfit.1': 'umber', 'outfit.2': 'slate' } },
  age: 67,
  temperament: { personality: 'grave', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [21, 7, 'meadow:elder.home', 'sleep'],
      [7, 21, 'meadow:elder.porch', 'keep watch over the square'],
    ],
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "Word came up the east road: the dragon of Emberfall is dead, and you were the one. The Five teach us to endure. Today we may also be glad.", "东边的路上传来消息：余烬镇的龙死了，杀它的是你。五苦教我们忍耐。今天，我们也可以高兴一回。"),
    line('default', 'A rider took the bridge and the storm took the rest. Two of ours went into the barrow and the dead keep them there — the dead do not lie down any more.', '骑手拆了桥，风暴带走了其余的。我们有两个人躲进了古墓，被那里的亡灵困住了——死人如今都不肯安息了。'),
    line('fact:ch1.flame_stolen', 'The Firstlight has burned since before the houses. A heretic walked in and carried it off, and we let him. We let him.', '初火比这些房子烧得还久。一个异端走进来就把它拿走了，而我们就让他拿走了。就让他拿走了。', { mood: 'angry' }),
    line('fact:ch1.letter', 'The Church has called you. Go with our blessing — and if you see that grey thief on the road, remember what he took.', '教会召唤了你。带着我们的祝福去吧——要是在路上遇见那个灰衣贼，别忘了他拿走了什么。'),
    line('fact:ch1.end', 'A crown of thorns in our village and a cold altar under it. The Five teach patience. I find I have very little.', '我们村里有了荆棘冠，祭坛却是冷的。五苦教人忍耐。我发现我的耐心所剩无几。'),
    line('default', 'Firstlight looks after its own. Today, that means asking you.', '初原村向来自己照顾自己。可今天，只能拜托你了。'),
  ],
}
