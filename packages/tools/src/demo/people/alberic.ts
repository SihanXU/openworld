// Alberic, freed of the crown (docs/chapter-1.md §12): the White Knight's human form, steward of the Held Ground. The
// crown took most of him; what is left keeps his vow another way — he holds the ground for the one who relieved him,
// and widens it for what they bring. He does not remember names. He asks yours.

import { line, type PersonDef } from '../person.ts'

export const alberic: PersonDef = {
  id: 'npc.alberic',
  role: 'steward',
  name: { en: 'Alberic', zh: '阿尔贝里克' },
  gender: 'male',
  look: { parts: { hair: 'hair.tied', face: 'face.weary', outfit: 'outfit.coat', mark: 'mark.scar', beard: null, hat: null, age: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'porcelain', 'outfit.1': 'ivory', 'outfit.2': 'slate', 'outfit.3': 'gold' } },
  age: 341,
  temperament: { personality: 'steadfast', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.fennick': 'squire' },
  schedules: {
    // out of the world until he falls; then in the Held Ground he keeps
    default: [[0, 24, 'offstage:alberic.hide', 'hold']],
    'fact:sins.defeated.alberic': [
      [22, 6, 'haven:alberic.bed', 'sleep'],
      [6, 22, 'haven:alberic.post', 'keep the held ground'],
    ],
  },
  lines: [
    line('greeting:first', 'You came back. Good. The ground is quiet while you are away; I keep it so.', '你回来了。很好。你不在的时候，这片土地很安静；我让它保持安静。'),
    line('default', 'I will hold until I am relieved. You relieved me — so now I hold for you. It is the same vow, turned round.', '我将坚守，直到有人来接替我。你接替了我——所以现在我为你坚守。还是同一个誓言，只是转了个方向。'),
    line('default', 'Plant what you like. Build what you like. Nothing here needs to kneel.', '想种什么就种什么。想建什么就建什么。这里没有什么需要下跪。'),
    line('default', 'The mist is only the edge of what I can hold. Bring me what a wider ground needs, and I will push it back.', '迷雾只是我能守住的边界。把扩建所需的东西带给我，我就把它推远一些。'),
    line('hour:evening', 'The sun goes down early. Earlier than it used to. I am sorry for that. I think I am.', '太阳落得早。比从前早。我很抱歉。我想我是抱歉的。'),
    line('fact:q.templar', 'There was a squire, once. He carried my lance. I cannot see his face any more. If you meet him — tell him I am sorry I asked his name.', '从前有个侍从。他给我扛长枪。我已经想不起他的脸了。如果你遇见他——告诉他，我很抱歉问了他的名字。', { once: true, mood: 'sad' }),
  ],
}
