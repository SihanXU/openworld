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
  trade: { level: 4, stock: [['item/tool/pickaxe', 1], ['item/tool/hoe', 1], ['item/weapon/blade/dagger', 1], ['item/weapon/blade/sword', 1], ['item/armor/helmet', 1], ['item/material/iron_ingot', 3]] },
  purse: 60,
  schedules: {
    default: [
      [21, 6, 'emberfall:smith.home', 'sleep'],
      [6, 21, 'emberfall:smith.anvil', 'work the anvil', FORGE],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'MIND THE SPARKS! ...Sorry. I shout when I\'m at the iron. My father did too.', '当心火星子！……对不住，我一打铁嗓门就大。我爹也是这样。'),
    line('chat', 'Twelve smiths before me kept that pattern, father to son. Not one of them ever had the ore. I never thought I would be the one to forge it.', '我前面十二代铁匠，一代传一代守着那张图样，谁也没弄到过那种矿石。我从没想过，会轮到我来打。'),
    line('greeting:first', 'Garrick. I\'m the smith. If you\'ve come about the dragon, so has everyone else this month. Nobody has brought me a horseshoe in weeks.', '我是加里克，这里的铁匠。你要是为了魔龙来的——这个月来的人都是为这个。已经好几个礼拜没人找我钉马掌了。', { once: true }),
    line('default', 'Five iron ore and three coal. The old mine north of the square has both, and things that bite.', '五块铁矿石，三块煤。广场北边的旧矿坑里两样都有，里头也有咬人的东西。'),
    line('default', 'A pickaxe opens a vein in two blows. Don\'t let the cyclops see you at it.', '用镐子敲两下，矿脉就开了。敲的时候别让独眼巨人看见。'),
    line('fact:mq.blade', 'There. Twelve of us kept the pattern, and I\'m the one who forged it. Swing it hard. It was made for that dragon.', '好了。十二代人守着这张图样，到我手上总算打出来了。用力挥，它就是为那条龙打的。', { once: true }),
    line('given', 'Hm. I\'ll find a use for it.', '嗯。我找个地方用上。'),
  ],
}
