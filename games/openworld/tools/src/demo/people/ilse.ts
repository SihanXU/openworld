// Sister Ilse, keeper of Firstlight's flame (docs/chapter-1.md §7): a nun of the Five Sufferings, calm
// and dry. She raised a foundling who became the grey man; she knows his walk, and tells no one.

import { line, type PersonDef } from '../person.ts'

export const ilse: PersonDef = {
  id: 'npc.ilse',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound', 'devout'],
  role: 'priest',
  essential: true,
  name: { en: 'Sister Ilse', zh: '伊尔丝修女' },
  gender: 'female',
  look: { parts: { face: 'face.soft', outfit: 'outfit.vestment', hat: 'hat.hood' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'fair', 'outfit.1': 'ivory', 'outfit.2': 'madder', 'hat.1': 'ivory' } },
  age: 56,
  temperament: { personality: 'serene', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.rowan': 'old friend', 'npc.severin': 'raised him' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/light/candle', 6], ['item/vessel/flask/holy_water', 1], ['item/food/bread', 2]] },
  purse: 15,
  schedules: {
    default: [
      [22, 6, 'meadow:ilse.home', 'sleep'],
      [6, 22, 'meadow:shrine.tend', 'tend the Firstlight'],
    ],
    'fact:ch1.flame_stolen': [
      [22, 6, 'meadow:ilse.home', 'sleep'],
      [6, 22, 'meadow:shrine.tend', 'sweep the cold altar'],
    ],
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:crown', "We set the crown under the altar. Nessa says it hums at night. I tell her it is the wind.", "我们把荆棘冠放在祭坛底下了。奈莎说它夜里会嗡嗡响。我告诉她那是风。"),
    line('greeting:first', 'Welcome to Firstlight, traveller. The flame you see was lit from the first dawn after the First Night. We keep it company.', '欢迎来到初原村，旅人。你看到的这团火，取自初夜之后的第一道晨光。我们陪着它。'),
    line('default', 'Suffering is not God\'s abandonment. It is the proof the debt is being paid. That is what the Five teach.', '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。五苦是这样教导的。'),
    line('default', 'The flame is older than the houses. The houses were built to keep it company.', '火比房子还老。房子是为了陪它才盖起来的。'),
    line('hour:evening', 'The evenings come sooner. I light the lamps a little earlier every week, and I write it down.', '黄昏来得越来越早。我每周都要早一点点灯，我都记着。'),
    line('fact:village.rescued', 'Lina and Oskar home. Tonight the village gives thanks at the flame. You will come.', '莉娜和奥斯卡回来了。今晚全村在火前感恩。你会来的。', { once: true }),
    line('fact:ch1.flame_stolen', 'Some people take a thing to keep it.', '有些人拿走一样东西，是为了守住它。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', 'I sweep the altar every morning. Habit. It is cold under my hand.', '我每天早上都扫一遍祭坛。习惯了。它在我手底下是凉的。'),
    line('fact:ch1.letter', 'Astra bore five sufferings so the sun would rise. The Seal-bearers carry them still. Go to the first of them, pilgrim.', '阿斯特拉承受了五苦，太阳才重新升起。持印者至今仍背负着它们。去找第一位吧，朝圣者。'),
    line('fact:ch1.crown', 'The Crown of Thorns, in our village. I never thought to see it. Keep it close to you, and far from your heart.', '荆棘冠，竟然到了我们村里。我从没想过能亲眼见到它。把它贴身收好——但别让它靠近你的心。', { once: true }),
    line('fact:ch1.end', 'He always did carry things that were too heavy for him.', '他从小就总是背着对他来说太重的东西。', { mood: 'sad' }),
  ],
}
