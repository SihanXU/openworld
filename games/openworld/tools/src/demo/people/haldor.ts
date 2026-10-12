// Haldor, the smith of Firstlight Village: once Garrick's apprentice in Emberfall, he came west when the storms cut
// the road, to shoe the drovers' horses and mend the villagers' tools. He keeps the smithy on the east road (its forge and anvil inside)
// and sells what a beginner at the anvil needs; the forge and the anvil are anyone's to use (docs: wiki 锻造).

import { line, type PersonDef } from '../person.ts'

const FORGE = { uses: 'smithy.forge', need: { status: ['lit'] } }

export const haldor: PersonDef = {
  id: 'npc.haldor',
  role: 'smith',
  essential: true,
  name: { en: 'Haldor', zh: '哈尔多' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.keen', outfit: 'outfit.apron', beard: 'beard.stubble', hat: null, mark: null }, colors: { hair: 'copper', eyes: 'hazel', skin: 'warm', 'outfit.1': 'darkleather' } },
  age: 29,
  temperament: { personality: 'steady', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.garrick': 'the master who taught him, in Emberfall' },
  // a smith struck strikes back; a mark over his head (tag smith) so he is easy to find
  fights: true,
  tags: ['smith'],
  trade: { stock: [['item/tool/smith_hammer', 2], ['item/material/coal', 8], ['item/material/iron_ore', 4], ['item/material/iron_ingot', 4]] },
  purse: 40,
  schedules: {
    default: [
      [21, 6, 'meadow.smithy:smith.bed', 'sleep'],
      [6, 21, 'meadow.smithy:smith.anvil', 'work the anvil', FORGE],
    ],
  },
  lines: [
    line('greeting:first', 'A new face! Haldor, the smith. The forge is lit and the anvil is free — bring ore and coal, carry a hammer, and you can make your own. I sell the hammer.', '新面孔！我是哈尔多，铁匠。炉子点着，铁砧空着——带上矿石和煤，手里拿着锻锤，你自己就能打。锻锤我这儿有卖。', { once: true }),
    line('default', 'Two ore and a lump of coal in the forge make two bars. Then the anvil: a dagger, a spear, a helmet — start small.', '两块矿石加一块煤，放进炉子能炼出两块锭。然后上铁砧：匕首、长矛、头盔——先从小的打起。'),
    line('default', 'The better you know the craft, the better what you make. Masterwork does not come on the first day.', '手艺越熟，打出来的东西越好。杰作可不是第一天就能出的。'),
    line('default', 'Garrick taught me in Emberfall. He would say my welds are lazy. He would be right.', '加里克在余烬镇教过我。他会说我的焊缝偷懒。他说得对。'),
    line('hour:evening', 'Last heat of the day. Then supper.', '今天最后一火。然后吃饭。'),
    line('weather:rain', 'Rain on hot iron. Listen to it hiss.', '雨落在热铁上。听，滋滋响。'),
    line('given', 'Thanks. It will go in the scrap pile — that is a compliment, here.', '谢了。它会进废料堆——在这儿，这是夸奖。'),
  ],
}
