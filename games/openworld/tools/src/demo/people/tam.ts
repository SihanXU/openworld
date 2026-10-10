// Tam, the miller of Millbrook (docs/chapter-1.md §13): his wheel turns slower every week (the brook is fed by the hills,
// and the hills by the days), and something has got into his cellar where the village's lamp oil is kept.

import { line, type PersonDef } from '../person.ts'

export const tam: PersonDef = {
  id: 'npc.tam',
  role: 'miller',
  name: { en: 'Tam', zh: '塔姆' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.weary', outfit: 'outfit.workshirt', beard: 'beard.stubble', hat: 'hat.cap' }, colors: { hair: 'steelgrey', eyes: 'hazel', skin: 'light', 'outfit.1': 'undyed', 'outfit.2': 'slate', 'hat.1': 'linen' } },
  age: 52,
  temperament: { personality: 'steady', manner: 'plain', social: 'outgoing', outlook: 'wary' },
  ties: {},
  schedules: {
    default: [
      [21, 6, 'mill:mill.bed', 'sleep'],
      [6, 21, 'mill:mill.yard', 'mind the wheel'],
    ],
  },
  lines: [
    line('greeting:first', 'Tam. I grind for Firstlight and press its lamp oil. Mind the brook, it bites in the cold.', '我叫塔姆。给初原村磨面、榨灯油。小心那条溪，天冷的时候它咬人。'),
    line('default', 'The wheel turns slower every week. The brook comes off the hills, and the hills get less sun. That is all it is.', '水车一周比一周转得慢。溪水是从山上下来的，山上晒的太阳越来越少。就这么回事。'),
    line('default', 'Something got into the cellar after dark. Slimes, and worse. The vigil oil is down there. I am not going down.', '天黑以后有东西钻进了地窖。史莱姆，还有更糟的。守夜用的灯油就在下面。我可不下去。'),
    line('fact:ch1.vigil', 'You brought the oil up? The lamps will burn tonight, then. My grandmother said the vigil lamps were lit from the first dawn. I believe her more than I used to.', '你把油拿上来了？那今晚的灯能点起来了。我奶奶说守夜灯是用最初的晨光点着的。比起从前，我现在更信她的话了。', { once: true }),
  ],
}
