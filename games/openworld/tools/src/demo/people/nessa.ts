// Nessa Quill, an almanac-maker stranded by the bridge (docs/chapter-1.md §7): she measures the sky
// for the Church's almanacs; every month the sun sets earlier, on a curve an old almanac also drew.

import { line, type PersonDef } from '../person.ts'

export const nessa: PersonDef = {
  id: 'npc.nessa',
  role: 'scholar',
  essential: true,
  name: { en: 'Nessa Quill', zh: '奈莎·奎尔' },
  gender: 'female',
  look: { parts: { hair: 'hair.bob', face: 'face.keen', outfit: 'outfit.coat', glasses: 'glasses.round', hat: null }, colors: { hair: 'raven', eyes: 'violet', skin: 'porcelain', 'outfit.1': 'indigo' } },
  age: 31,
  temperament: { personality: 'restless', manner: 'polite', social: 'outgoing', outlook: 'wary' },
  ties: {},
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/document/map', 1], ['item/document/scroll', 2], ['item/misc/ink', 2], ['item/misc/feather_quill', 1]] },
  purse: 30,
  schedules: {
    default: [
      [23, 6, 'meadow:market.shelter', 'sleep'],
      [6, 17, 'meadow:nessa.desk', 'copy her tables'],
      [17, 23, 'meadow:nessa.watch', 'measure the sunset'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I have four pens and I lose them in the same order every week. There is a pattern. I have not found it.', '我有四支笔，每周都按同样的顺序弄丢。这里面有规律。我还没找到。'),
    line('chat', 'The stars do not care what the Church prints about them. That is rather restful, after a day of almanacs.', '星星不在乎教会印了它们什么。编了一天历书之后，这一点倒挺让人歇心。'),
    line('greeting:first', 'Nessa Quill, almanacs for the Holy City. Stranded since the bridge went. Do you know what time it is? Exactly?', '奈莎·奎尔，给圣城编历书的。桥断了以后就困在这里。你知道现在几点吗？精确地？'),
    line('default', 'Every month the sun sets earlier. Four minutes, five, six. I write it all down. The numbers make a curve, and I do not like where it goes.', '太阳每个月都落得更早。四分钟、五分钟、六分钟。我全都记下来了。这些数字连成一条曲线，我不喜欢它的去向。'),
    line('default', 'Tobin sold me an almanac from before the First Night. Its curve matches mine. Exactly.', '托宾卖给我一本初夜之前的旧历书。它的曲线和我的一模一样。分毫不差。'),
    line('hour:evening', 'Hush — the sun is touching the trees. Fourteen. Fifteen. There.', '嘘——太阳碰到树梢了。十四。十五。好了。'),
    line('fact:ch1.crown', 'Four minutes. The sun set four minutes early tonight. On the day the first seal fell. I am sure it means nothing.', '四分钟。今晚太阳早落了四分钟。偏偏是第一道印倒下的那天。我相信这什么都不代表。', { once: true }),
  ],
}
