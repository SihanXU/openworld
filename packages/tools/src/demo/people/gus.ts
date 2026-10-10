// Gus, the village's woodcutter. Mornings he fells trees in the forest with his axe and gathers the
// logs; afternoons he carries them home and stacks them on the wood pile, for anyone who needs
// them. His back is not what it was, and the fire wants feeding every day. His day is real work
// (world-model.md §6.10): his own acts, the rules answering them, the stumps growing back.

import type { WorkDef } from '@lsw/engine'
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
  schedules: {
    default: [
      [21, 6, 'meadow:wood.home', 'sleep'],
      [6, 12, 'forest:woods.clearing', 'fell trees', { work: FELL }],
      [12, 21, 'meadow:wood.pile', 'stack the wood', { work: STACK }],
    ],
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:flame_stolen', "The fire is out at the shrine. Mine is not. I will keep it so.", "神龛那边的火灭了。我这儿的没灭。我会让它一直烧着。"),
    line('default', 'Every day the fire eats. Every day I feed it. My back has opinions about this.', '火天天都要吃，我天天都得喂。我的腰对此很有意见。'),
  ],
}
