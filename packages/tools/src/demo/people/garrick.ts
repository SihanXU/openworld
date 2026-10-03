// Garrick, the smith of Emberfall, twelfth of a line of smiths who kept a pattern for a
// dragon-blade and never had the ore to forge it. Loud at the anvil, quiet everywhere else.

import { line, type PersonDef } from '../person.ts'

const FORGE = { uses: 'emberfall.forge', need: { status: ['lit'] } }

export const garrick: PersonDef = {
  id: 'npc.garrick',
  role: 'smith',
  name: { en: 'Garrick', zh: '加里克' },
  look: 'Hunter',
  age: 46,
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.mara': 'the elder who pays for his coal' },
  schedules: {
    default: [
      [21, 6, 'emberfall:smith.home', 'sleep'],
      [6, 21, 'emberfall:smith.anvil', 'work the anvil', FORGE],
    ],
  },
  lines: [
    line('greeting:first', 'Smith. Garrick. If you are here about the dragon, everyone is. If you are here about a horseshoe, you are the first this month.', '铁匠，加里克。要是为了魔龙来的——大家都是。要是为了马掌来的，你是这个月头一个。', { once: true }),
    line('default', 'Three iron ore and two coal. The old mine north of the square has both, and things that bite.', '三块铁矿石，两块煤。广场北边的旧矿坑两样都有，还有会咬人的东西。'),
    line('default', 'A pickaxe breaks a vein in three blows. Do not let the cyclops see you do it.', '镐子敲三下就能敲开矿脉。别让独眼巨人看见你在敲。'),
    line('fact:mq.blade', 'Swing it like you mean it. It was made to mean it.', '挥剑要用真力气。它生来就是干这个的。', { once: true }),
    line('given', 'Hm. I will find a use for it.', '嗯。我会给它找个用处的。'),
  ],
}
