// Severin, the Greyvowed (docs/chapter-1.md §5): last of the Ashen Watch. He believes Astra is the
// monster and works against the pilgrimage; he never harms anyone and never fights the player. He
// appears only in the story's scenes (placed, then gone): he lives nowhere the player can visit yet.

import { line, type PersonDef } from '../person.ts'

export const severin: PersonDef = {
  id: 'npc.severin',
  role: 'stranger',
  name: { en: 'The Grey Man', zh: '灰衣人' },
  gender: 'male',
  look: { parts: { face: 'face.keen', outfit: 'outfit.cloak', hat: 'hat.hood', beard: 'beard.stubble', hair: 'hair.short' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'slate', 'hat.1': 'charcoal' } },
  age: 40,
  temperament: { personality: 'grim', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.ilse': 'raised by her' },
  schedules: {
    // off the map until a scene places him (the story's `place`)
    default: [[0, 24, 'offstage:severin.hide', 'keep out of sight']],
  },
  lines: [
    line('default', '...', '……'),
  ],
}
