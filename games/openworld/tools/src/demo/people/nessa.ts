// Nessa Quill, an almanac-maker stranded by the bridge (docs/chapter-1.md §7): she measures the sky
// for the Church's almanacs; every month the sun sets earlier, on a curve an old almanac also drew.

import { line, type PersonDef } from '../person.ts'

export const nessa: PersonDef = {
  id: 'npc.nessa',
  role: 'scholar',
  essential: true,
  name: { en: 'Nessa Quill', zh: '奈莎·奎尔' },
  gender: 'female',
  look: { parts: { hair: 'hair.long', face: 'face.keen', outfit: 'outfit.coat', glasses: 'glasses.round', hat: null }, colors: { hair: 'black', eyes: 'violet', skin: 'porcelain', 'outfit.1': 'indigo' } },
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
    // in the Holy City at the last, on the Hall's parvis with her tables (docs/finale.md §8)
    'fact:world.fin': [
      [22, 5, 'holyhall:nessa.parvis', 'sleep on the parvis'],
      [5, 22, 'holyhall:nessa.parvis', 'measure the sky over the Hall'],
    ],
    // on south to the Fens once the fen road is open, in Nailgate's chapel (docs/chapter-4.md §6, beat 3)
    'fact:world.ch4': [
      [22, 5, 'nailgate.chapel:nessa.cot', 'sleep'],
      [5, 16, 'nailgate.chapel:nessa.desk', 'compare her tables'],
      [16, 22, 'nailgate:klaas.landing', 'measure the dusk'],
    ],
    // south with the almanac once the grain road is open, at a waystone on the Chaff Road (docs/chapter-3.md §6, beat 2)
    'fact:world.ch3': [
      [22, 5, 'chaffroad:nessa.camp', 'sleep'],
      [5, 16, 'chaffroad:nessa.stone', 'copy her tables'],
      [16, 22, 'chaffroad:nessa.stone', 'measure the sunset'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I have four pens and I lose them in the same order every week. There is a pattern. I have not found it.', '我有四支笔，每周都按同样的顺序弄丢。这里面有规律。我还没找到。'),
    line('chat', 'The stars do not care what the Church prints about them. That is rather restful, after a day of almanacs.', '星星不在乎教会印了它们什么。编了一天历书之后，这一点倒挺让人歇心。'),
    line('greeting:first', 'Hello. I am Nessa Quill; I make the almanacs for the Holy City. I have been stuck here since the bridge went. Do you know what time it is? Exactly, I mean. To the minute.', '你好。我叫奈莎·奎尔，给圣城编历书的。桥断了以后，我就困在这里了。你知道现在几点吗？我是说，精确到分钟。'),
    line('default', 'Every month the sun sets earlier. Four minutes, five, six. I write it all down. The numbers make a curve, and I do not like where it goes.', '太阳每个月都落得更早。四分钟、五分钟、六分钟。我全都记下来了。这些数字连成一条曲线，它往哪儿走，我不喜欢。'),
    line('default', 'Tobin sold me an almanac from before the First Night. Its curve matches mine. Exactly.', '托宾卖给我一本初夜之前的旧历书。它的曲线和我的一模一样。分毫不差。'),
    line('hour:evening', 'Hush — the sun is touching the trees. Fourteen. Fifteen. There.', '嘘——太阳碰到树梢了。十四。十五。好了。'),
    line('fact:world.fin', 'I deliver the almanacs here every year. This year I brought the table instead. They took it, and thanked me, and put it in a drawer.', '每年我都把历书送到这里来。今年我带来的是那张表。他们收下了，谢过我，放进了抽屉。'),
    line('fact:fin.end', 'Sunrise at five. Sunset tonight at nine. ...I wrote it down twice. I could not believe it the first time.', '日出，五点。今晚日落，九点。……我记了两遍。头一遍，我自己都不敢信。', { mood: 'happy' }),
    line('fact:fin.end', 'The old almanac\'s last page. "Stop him." I read the rest of the line again this morning, by the new light. It was not a curse. Someone loved him.', '那本旧历书的最后一页。“拦住他。”今天早上，借着新的天光，我把那一行剩下的字又读了一遍。那不是诅咒。是有人爱着他。', { once: true, mood: 'sad' }),
    line('topic:quickening', 'I have written to the Holy City. I asked them, politely, what the Body is doing. I do not expect an answer. I wanted it on paper that someone asked.', '我给圣城写了信。我很客气地问他们，圣尸在做什么。我不指望有回音。我只是想让纸上留下一笔：有人问过。'),
    line('fact:ch4.end', 'Five o\'clock. I measured it from the landing while the boat went out. I will measure the next one too, wherever I am.', '五点。船开出去的时候，我在渡口量的。下一次我也会量，不管我在哪儿。', { once: true }),
    line('fact:world.ch3', 'The flattest horizon in the Five Lands. If the sun is cheating, this is where I will catch it.', '五印之地最平的地平线。太阳要是在耍花样，我就在这儿逮住它。'),
    line('fact:ch3.scale', 'Six o\'clock tonight. Six. I am going south tomorrow, to the Fens. Something there does not let the dusk lift, and I want to see it.', '今晚六点。六点。我明天就往南，去林沼。那边有什么东西不让黄昏散去，我想亲眼看看。', { once: true }),
    line('fact:ch1.crown', 'Four minutes. The sun set four minutes early tonight, on the day the first seal fell. I am sure it means nothing.', '四分钟。今晚太阳早落了四分钟，偏偏是第一道印倒下的那天。我相信这什么都不代表。', { once: true }),
  ],
}
