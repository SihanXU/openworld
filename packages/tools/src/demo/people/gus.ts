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
  name: { en: 'Gus', zh: '格斯' },
  look: 'Villager4',
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
    line('default', 'Every day the fire eats. Every day I feed it. My back has opinions about this.', '火天天都要吃，我天天都得喂。我的腰对此很有意见。'),
  ],
}
