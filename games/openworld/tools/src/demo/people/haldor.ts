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
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Garrick always kept his forge hotter than I keep mine. He said iron should be worked as hot as it will take. I never could stand at the fire as long as he could.', '加里克的炉子一向烧得比我的旺。他说铁要趁最热的时候打。他能在炉边站多久，我可站不了那么久。'),
    line('chat', 'I came west to shoe the drovers\' horses. There are hardly any drovers now, so mostly I mend hoes and hinges.', '我当初来西边，是给赶牲口的人钉马掌的。现在赶牲口的没几个了，我多半是在修锄头和门轴。'),
    line('greeting:first', 'A new face! I\'m Haldor, the smith. The forge is lit and the anvil is free. Bring ore and coal, carry a hammer, and you can make your own. I sell the hammer.', '新面孔啊！我叫哈尔多，这里的铁匠。炉子生着火，铁砧也空着。你带矿石和煤来，手里拿把锻锤，就能自己打东西。锻锤我这儿有卖。', { once: true }),
    line('default', 'Two ore and a lump of coal in the forge make two bars. Then the anvil: a dagger, a spear, a helmet. Start small.', '炉子里放两块矿石、一块煤，能炼出两块铁锭。然后上铁砧打：匕首、长矛、头盔都行。先从小件打起。'),
    line('default', 'The better you know the craft, the better what you make. Nobody makes masterwork on their first day.', '手艺越熟，打出来的东西越好。没有人头一天就能打出精品。'),
    line('default', 'Garrick taught me in Emberfall. If he saw my welds now he\'d say I\'d got lazy, and he\'d be right.', '我是在余烬镇跟加里克学的手艺。他要是看到我现在的焊口，准说我偷懒了。他说得也没错。'),
    line('hour:evening', 'Last heat of the day. Then supper.', '今天最后一火了。打完就吃饭。'),
    line('weather:rain', 'Rain on hot iron. Listen to it hiss.', '雨点落在热铁上，你听，滋滋地响。'),
    line('given', 'Thanks. If I can\'t use it as it is, I\'ll melt it down. Nothing goes to waste in a smithy.', '谢了。能直接用就用，用不上我就拿去回炉。铁匠铺里没有浪费的东西。'),
  ],
}
