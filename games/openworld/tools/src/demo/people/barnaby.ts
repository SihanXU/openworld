// Barnaby, the sexton of Nailgate (docs/chapter-4.md §7): fifty-eight. He drives a nail into a doorpost for each of the dead a
// house keeps, and believes it mercy: none of theirs goes into the dark.

import { line, type PersonDef } from '../person.ts'

export const barnaby: PersonDef = {
  id: 'npc.barnaby',
  role: 'priest',
  essential: true,
  tags: ['storybound', 'devout'],
  name: { en: 'Barnaby the Sexton', zh: '司事巴纳比' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.stern', outfit: 'outfit.coat', beard: 'beard.full', hat: null }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'darkleather' } },
  age: 58,
  favourite: 'item/material/iron_ingot',
  temperament: { personality: 'dutiful', manner: 'plain', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.piet': 'nails his doorpost' },
  purse: 15,
  trade: { stock: [['item/light/candle', 3], ['item/material/iron_ingot', 1]] },
  schedules: {
    default: [
      [21, 5, 'nailgate.chapel:barnaby.bed', 'sleep'],
      [5, 12, 'nailgate.chapel:barnaby.altar', 'keep the chapel'],
      [12, 18, 'nailgate:barnaby.walk', 'nail the doorposts'],
      [18, 21, 'nailgate.chapel:barnaby.altar', 'draw nails'],
    ],
  },
  lines: [
    line('chat', 'I draw the nails myself, from what iron I can get. A bought nail would not be right.', '钉子是我自己拿铁打的，有什么铁就打什么。买来的钉子不合适。'),
    line('chat', 'There are three hundred and forty nails in Nailgate. I know every post. I could walk the village at night by them.', '钉门村里一共有三百四十颗钉子。每根门柱我都认得。夜里我摸着它们就能走遍全村。'),
    line('greeting:first', 'Peace on you. I am Barnaby, sexton of Nailgate. If you have dead of your own, the Keeper will find them; you need not ask.', '愿你平安。我是钉门村的司事巴纳比。你要是有自己的亡人，守护者会找到他们的，不必去求。', { once: true }),
    line('default', 'A nail for each one kept. None of ours goes into the dark. That is the whole of my office.', '留一个，钉一颗。我们的人，一个也不进黑暗。我的职分就这么多。'),
    line('default', 'He accepted death, and death did not take him. So it is with ours. It is written over the altar.', '他接受了死亡，死亡却没有带走他。我们的人也是一样。祭坛上就是这么写的。'),
    line('fact:ch4.nessa', 'The almanac woman reads our chronicle as if it were a ledger of debts. It is a record of grace.', '那个编历书的女人读我们的纪事，像是在读一本欠债的账。那是恩典的记录。'),
    line('topic:reins_let_go', 'The bells have stopped. ...I do not know what my office is now.', '铃铛停了。……我不知道我现在还有什么职分。', { mood: 'sad' }),
    line('fact:ch4.end', 'I have taken the nails out of Piet\'s post. Eleven. I did not know there would be so much light behind them.', '我把皮特门柱上的钉子拔出来了。十一颗。我没想到它们后面会有那么多光。'),
    line('given:item/material/iron_ingot', 'Iron. Good iron. Thank you.', '铁。好铁。谢谢你。', { mood: 'happy' }),
  ],
}
