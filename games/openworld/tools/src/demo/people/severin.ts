// Severin, the Greyvowed (docs/chapter-1.md §5): last of the Ashen Watch. He believes Astra is the
// monster and works against the pilgrimage; he never harms anyone and never fights the player. He
// appears only in the story's scenes (placed, then gone): he lives nowhere the player can visit yet.

import { line, type PersonDef } from '../person.ts'

export const severin: PersonDef = {
  id: 'npc.severin',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'stranger',
  essential: true,
  name: { en: 'The Grey Man', zh: '灰衣人' },
  gender: 'male',
  look: { parts: { face: 'face.keen', outfit: 'outfit.cloak', hat: 'hat.hood', beard: 'beard.stubble', hair: 'hair.short' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'slate', 'hat.1': 'charcoal' } },
  age: 40,
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
    line('chat', 'You keep talking to me. Most do not. I am not sure it is wise, but I find I do not mind.', '你一直在跟我说话。多数人不会。我不确定这明智，但我发现我并不介意。'),
    line('chat', 'Ash keeps. Everything else burns. That is the whole creed of the Watch, if you want it short.', '灰烬留得住。别的都会烧掉。要是你想要个短的，这就是守望者全部的信条。'),
    line('default', '...', '……'),
  ],
}
