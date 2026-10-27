// Severin, the Greyvowed (docs/chapter-1.md §5): last of the Ashen Watch, the youngest of the brothers the Church named
// heretics ten years ago; a foundling Sister Ilse raised. He believes Astra is the monster and works against the
// pilgrimage; he never harms anyone and never fights the player. He appears only in the story's scenes (placed, then
// gone): he lives nowhere the player can visit yet. His portrait (docs/cast/severin.md): dark hair, gold eyes, the hood up,
// the lantern.

import { line, type PersonDef } from '../person.ts'

export const severin: PersonDef = {
  id: 'npc.severin',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'stranger',
  essential: true,
  name: { en: 'The Grey Man', zh: '灰衣人' },
  gender: 'male',
  look: { parts: { face: 'face.keen', outfit: 'outfit.cloak', hat: 'hat.hood', beard: 'beard.stubble', hair: 'hair.short' }, colors: { hair: 'black', eyes: '#d4a84a', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'slate', 'hat.1': 'charcoal' } },
  age: 30,
  temperament: { personality: 'grim', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.ilse': 'raised by her' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/potion/mystery', 2], ['item/vessel/flask/oil', 2], ['item/misc/bomb', 1], ['item/light/lantern', 1]] },
  purse: 30,
  schedules: {
    // off the map until a scene places him (the story's `place`)
    default: [[0, 24, 'offstage:severin.hide', 'keep out of sight']],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Do not follow me. What I am doing has nothing to do with you.', '别跟着我。我做的事，跟你没有关系。'),
    line('chat', 'The ash on my hands does not wash off. It never did, for any of us who kept the flames.', '我手上的灰洗不掉。以前守火的人，都是这样。'),
    line('default', '...', '……'),
  ],
}
