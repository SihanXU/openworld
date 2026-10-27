// Alberic, freed of the crown (docs/chapter-1.md §12): the White Knight's human form, steward of the Held Ground. The
// crown took most of him; what is left keeps his vow another way — he holds the ground for the one who relieved him,
// and widens it for what they bring. He does not remember names. He asks yours.

import { line, type PersonDef } from '../person.ts'

export const alberic: PersonDef = {
  id: 'npc.alberic',
  role: 'steward',
  essential: true,
  name: { en: 'Alberic', zh: '阿尔贝里克' },
  gender: 'male',
  look: { parts: { hair: 'hair.tied', face: 'face.weary', outfit: 'outfit.coat', mark: 'mark.scar', beard: null, hat: null, age: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'porcelain', 'outfit.1': 'ivory', 'outfit.2': 'slate', 'outfit.3': 'gold' } },
  age: 341,
  temperament: { personality: 'steadfast', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.fennick': 'squire' },
  // the Held Ground's smith too: a mark over his head (tag smith); he sells what the anvil needs
  tags: ['smith', 'haven-steward', 'storybound'],
  trade: { stock: [['item/tool/smith_hammer', 1], ['item/material/coal', 6], ['item/material/iron_ingot', 4], ['item/material/steel_bar', 2]] },
  purse: 30,
  schedules: {
    // out of the world until he falls; then in the Held Ground he keeps
    default: [[0, 24, 'offstage:alberic.hide', 'hold']],
    'fact:sins.defeated.alberic': [
      [22, 6, 'haven:alberic.bed', 'sleep'],
      [6, 14, 'haven:alberic.anvil', 'work the anvil', { uses: 'haven.forge', need: { status: ['lit'] } }],
      [14, 22, 'haven:alberic.post', 'keep the held ground'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'The mist moves in the night. Each morning I walk its edge and count the tent pegs. None has gone yet.', '夜里迷雾会挪动。每天早上，我都沿着它的边走一圈，把帐篷桩数一遍。到今天，一根也没少。'),
    line('chat', 'I asked thy name once, and I have lost it again. Forgive me. Tell it me once more, and I will try to keep it this time.', '你的名字，我问过一次，又忘了。原谅我。请再告诉我一遍，这一回我会尽力记住。'),
    line('greeting:first', 'You have come back. Good. While you are away the ground stays quiet; I see to it.', '你回来了。很好。你不在的时候，这片地一直很安静，我守着它。'),
    line('default', 'I swore to hold until I was relieved. It was you who relieved me. So now I hold this ground for you. It is the same vow.', '我立过誓，要守到有人来接替我为止。来接替我的是你。所以如今，我替你守着这片地。誓言还是那一个。'),
    line('default', 'Plant what you will, and build what you will. No one need kneel here.', '想种什么就种什么，想盖什么就盖什么。在这里，谁也不必下跪。'),
    line('default', 'The mist marks how far I can hold. Bring me what a wider ground needs, and I will push it further back.', '迷雾在哪里，我能守住的地方就到哪里。把扩地要用的东西带来给我，我就把迷雾再往外推一些。'),
    line('default', 'Before I was a knight, my father was a smith. The forge is lit; whenever you carry a hammer, the anvil is yours. If you lack bars or coal, I keep some.', '我做骑士以前，父亲是个铁匠。炉火一直生着，你只要带着锻锤，铁砧随时可以用。缺铁锭、缺煤，就跟我说，我这里备着。'),
    line('hour:evening', 'The sun sets early now, earlier than it did. I am sorry for it. I cannot say why I am sorry, but I am.', '如今太阳落得早，比从前早。我很抱歉。为什么抱歉，我说不上来，可我心里确实抱歉。'),
    line('fact:q.templar', 'There was a squire once, who carried my lance. I cannot see his face any more. If you meet him, tell him I am sorry. One morning I asked him his name.', '从前有个侍从，替我扛长枪。他的脸，我已经想不起来了。你要是遇见他，替我跟他说声对不起。有一天早上，我问了他叫什么名字。', { once: true, mood: 'sad' }),
  ],
}
