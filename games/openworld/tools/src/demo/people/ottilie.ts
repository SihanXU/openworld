// Guildmistress Ottilie of the Grain Guild (docs/chapter-3.md §7): fifty, frightened, exact. The guild's granary is full
// and sealed for the Holy City's tithe-carts, which have not come in three seasons. She holds its key.

import { line, type PersonDef } from '../person.ts'

export const ottilie: PersonDef = {
  id: 'npc.ottilie',
  role: 'merchant',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Guildmistress Ottilie', zh: '奥蒂莉会长' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.keen', outfit: 'outfit.coat', hat: null }, colors: { hair: 'silver', eyes: 'amber', skin: 'warm', 'outfit.1': 'ochre', 'outfit.2': 'darkleather' } },
  age: 50,
  favourite: 'item/document/scroll',
  temperament: { personality: 'careful', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.haskel': 'weighs for the Guild' },
  purse: 120,
  trade: { stock: [['item/material/wheat', 2], ['item/food/bread', 3], ['item/document/scroll', 1]] },
  schedules: {
    default: [
      [22, 6, 'fairweight.guild:ottilie.bed', 'sleep'],
      [6, 12, 'fairweight.guild:ottilie.desk', 'keep the Guild\'s books'],
      [12, 16, 'fairweight:ottilie.square', 'watch the weighing'],
      [16, 22, 'fairweight.guild:ottilie.desk', 'keep the Guild\'s books'],
    ],
  },
  lines: [
    line('chat', 'Every measure in the granary is entered. Every one is owed. A ledger is a promise you keep in ink.', '粮仓里每一斗都记了账，每一斗都是欠着的。账簿就是用墨水守的承诺。'),
    line('chat', 'The tithe-carts were due in the spring before last. I have written four times. The Holy City has not answered.', '什一税的车前年春天就该来了。我写了四封信，圣城一封也没回。'),
    line('greeting:first', 'You are the pilgrim. I am Ottilie; I keep the Grain Guild. If you have come about the granary, the answer is no, and I am sorry.', '你就是那个朝圣者。我是奥蒂莉，管着谷物行会。你要是为粮仓来的，答案是不行，对不起。', { once: true }),
    line('default', 'It is weighed and owed. It is not ours to give. If the carts come and the granary is short, it is the Guild that answers for it. It is I who answer for it.', '那些粮过了秤，是欠下的，不是我们能送人的。要是车来了粮仓却短了，是行会担罪。是我担罪。'),
    line('fact:ch3.hunger', 'I can hear them on the square from my desk. ...Speak to me again. Ask me properly.', '我坐在桌前，都听得见广场上的声音。……再来跟我说一遍。正经地问我。', { once: true, mood: 'sad' }),
    line('fact:ch3.end', 'I wrote to the Holy City tonight. The fifth letter. I do not suppose it will be answered either.', '今晚我又给圣城写了一封信。第五封了。我想，这封大概也不会有回音。'),
    line('given:item/document/scroll', 'Paper. Thank you. I have a great deal to write down.', '纸。谢谢你。我有好多东西要记下来。', { mood: 'happy' }),
  ],
}
