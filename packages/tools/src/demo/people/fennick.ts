// Fennick, an old templar (docs/chapter-1.md §7): once of the Seal-bearers' escort under the White
// Knight Alberic, the gentlest man who ever wore armour, until the crown began to change him.

import { line, type PersonDef } from '../person.ts'

export const fennick: PersonDef = {
  id: 'npc.fennick',
  role: 'guard',
  name: { en: 'Fennick', zh: '芬尼克' },
  look: 'KnightGold',
  age: 62,
  temperament: { personality: 'weary', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.severin': 'knew him' },
  schedules: {
    default: [
      [22, 7, 'meadow:guard.home', 'sleep'],
      [7, 22, 'meadow:fennick.bench', 'mend harness on the bench'],
    ],
  },
  lines: [
    line('greeting:first', 'Sit if you like. Don\'t ask about the armour.', '想坐就坐。别问盔甲的事。'),
    line('default', 'I carried a lance for the Seal-bearers once. Long time ago. Long enough.', '我曾经为持印者扛过长枪。很久以前了。久到够了。'),
    line('fact:ch1.letter', 'The White Knight. Alberic. He used to kneel to children. Now he makes the world kneel to him. That is what the crown does.', '白骑士。阿尔贝里克。他以前会对孩子单膝下跪。现在他要整个世界向他下跪。那顶冠冕就是这样改变人的。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', 'A grey cloak, ash on his hands? ...No. I knew a man like that. He would not. Unless he had a reason, and that scares me more.', '灰斗篷，手上有灰？……不。我认识一个那样的人。他不会的。除非他有理由——那就更让我害怕了。'),
    line('fact:ch1.crown', 'You brought him down. Did he — was he himself, at the end? ...Good. Good.', '你打倒了他。他……最后，他还是他自己吗？……那就好。那就好。', { once: true, mood: 'sad' }),
  ],
}
