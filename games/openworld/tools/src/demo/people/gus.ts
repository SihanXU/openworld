// Gus, the village's woodcutter. Mornings he fells trees in the forest with his axe and gathers the
// logs; afternoons he carries them home and stacks them on the wood pile, for anyone who needs
// them. His back is not what it was, and the fire wants feeding every day. His day is real work
// (world-model.md §6.10): his own acts, the rules answering them, the stumps growing back.

import type { WorkDef } from '@openworld/engine'
import { line, type PersonDef } from '../person.ts'

const LOG = { type: 'item/material/log' }
/** He carries no more than six logs at a time. */
const ROOM = { count: { role: 'host' as const, in: 'contents' as const, match: LOG, cmp: { lt: 6 } } }
const FELL: WorkDef[] = [
  // what lies about is gathered first, then another tree is felled
  { verb: 'take', target: LOG, radius: 6, when: ROOM },
  { verb: 'use', target: { type: 'tile/tree' }, holding: { tags: ['tool:axe'] }, radius: 5, when: ROOM },
]
const STACK: WorkDef[] = [{ verb: 'put', target: { type: 'fixture/container/woodpile', status: ['open'] }, holding: LOG, radius: 2 }]

export const gus: PersonDef = {
  id: 'npc.gus',
  role: 'farmer',
  essential: true,
  name: { en: 'Gus', zh: '格斯' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.weary', outfit: 'outfit.workshirt', beard: 'beard.stubble', hat: 'hat.straw' }, colors: { hair: 'steelgrey', eyes: 'bark', skin: 'tan', 'outfit.1': 'linen', 'outfit.2': 'umber' } },
  age: 51,
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'hopeful' },
  ties: {},
  tags: ['skill:woodcutter'],
  items: [{ form: 'item/weapon/blade/axe', material: 'iron', quality: 'common', element: null }],
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/material/plank', 6], ['item/material/stick', 6], ['item/weapon/blade/axe', 1]] },
  purse: 20,
  schedules: {
    default: [
      [21, 6, 'meadow.woodhouse:bed.0', 'sleep'],
      [6, 12, 'forest:woods.clearing', 'fell trees', { work: FELL }],
      [12, 21, 'meadow:wood.pile', 'stack the wood', { work: STACK }],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Pine splits with one blow. Oak takes three, and twists the axe. I leave the birches; they burn too fast.', '松木一斧子就劈开了。橡木得砍三下，还别斧头。桦木我不砍，烧得太快。'),
    line('chat', 'Cass says I talk to the trees. I do, a bit. I\'m out there on my own all morning.', '卡丝说我跟树说话。是会说几句。一上午就我一个人在林子里。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:flame_stolen', "The fire at the shrine is out. Mine isn't, and I won't let it go out.", "神龛那边的火灭了。我家的火还烧着，我不会让它灭。"),
    line('default', 'The fire eats every day, so I cut every day. My back isn\'t what it was. The wood I stack by the square is for anyone who needs it.', '火每天都要烧，我就每天都得砍。腰不比从前了。劈好的柴我都码在广场边上，谁要用就自己拿。'),
  ],
}
