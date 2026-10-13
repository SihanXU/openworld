// Garrick, the smith of Emberfall, twelfth of a line of smiths who kept a pattern for a
// dragon-blade and never had the ore to forge it. Loud at the anvil, quiet everywhere else.

import { line, type PersonDef } from '../person.ts'

const FORGE = { uses: 'emberfall.forge', need: { status: ['lit'] } }

export const garrick: PersonDef = {
  id: 'npc.garrick',
  role: 'smith',
  essential: true,
  name: { en: 'Garrick', zh: '加里克' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.stern', outfit: 'outfit.apron', beard: 'beard.full', mark: 'mark.scar', hat: null }, colors: { hair: 'black', eyes: 'bark', skin: 'tan' } },
  age: 46,
  temperament: { personality: 'gruff', manner: 'rough', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.mara': 'the elder who pays for his coal' },
  // he sells what he makes, and a smith struck strikes back
  fights: true,
  // a mark over his head (tag smith)
  tags: ['smith', 'storybound'],
  trade: { stock: [['item/tool/pickaxe', 1], ['item/tool/hoe', 1], ['item/weapon/blade/dagger', 1], ['item/weapon/blade/sword', 1], ['item/armor/helmet', 1], ['item/material/iron_ingot', 3]] },
  purse: 60,
  schedules: {
    default: [
      [21, 6, 'emberfall:smith.home', 'sleep'],
      [6, 21, 'emberfall:smith.anvil', 'work the anvil', FORGE],
    ],
  },
  lines: [
    line('greeting:first', 'Smith. Garrick. If you are here about the dragon, everyone is. If you are here about a horseshoe, you are the first this month.', '铁匠，加里克。要是为了魔龙来的——大家都是。要是为了马掌来的，你是这个月头一个。', { once: true }),
    line('default', 'Five iron ore and three coal. The old mine north of the square has both, and things that bite.', '五块铁矿石，三块煤。广场北边的旧矿坑两样都有，还有会咬人的东西。'),
    line('default', 'A pickaxe breaks a vein in two blows. Do not let the cyclops see you do it.', '镐子敲两下就能敲开矿脉。别让独眼巨人看见你在敲。'),
    line('fact:mq.blade', 'Swing it like you mean it. It was made to mean it.', '挥剑要用真力气。它生来就是干这个的。', { once: true }),
    line('given', 'Hm. I will find a use for it.', '嗯。我会给它找个用处的。'),
  ],
}
