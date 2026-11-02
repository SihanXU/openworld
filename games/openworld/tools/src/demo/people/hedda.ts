// Old Hedda of Nailgate (docs/chapter-4.md §7): a hundred and nine, bedridden, and unable to die. She wants to: "Ask him to
// let go of me." When Nacht lets go of the reins she dies in her bed, a ferry coin in her hand, and laughs first.

import { line, type PersonDef } from '../person.ts'

export const hedda: PersonDef = {
  id: 'npc.hedda',
  role: 'elder',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Old Hedda', zh: '老海达' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.shawl', hat: 'hat.kerchief' }, colors: { hair: 'snow', eyes: 'hazel', skin: 'fair', 'outfit.1': 'slate', 'hat.1': 'linen' } },
  age: 109,
  favourite: 'item/food/apple',
  temperament: { personality: 'blunt', manner: 'rough', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.klaas': 'paid him her fare once' },
  purse: 2,
  trade: { stock: [['item/material/cloth', 1]] },
  schedules: {
    // gone, once she lies down (the scene `ferry`)
    'fact:ch4.end': [[0, 24, 'offstage:hedda.gone', 'rest']],
    default: [
      [20, 8, 'nailgate.hedda:bed.0', 'sleep'],
      [8, 20, 'nailgate.hedda:bed.0', 'lie awake and watch the landing'],
    ],
  },
  lines: [
    line('chat', 'My son died at eighty. He came home and sat at my table and asked me what was for supper. I told him he was dead. He did not believe me either.', '我儿子八十岁死的。他回了家，坐在我桌边，问我晚饭吃什么。我跟他说他已经死了。他也不信。'),
    line('chat', 'I was a girl when the Keeper came to the fens. Before that, we buried people. I remember the singing.', '守夜人来到泽地的时候，我还是个小姑娘。在那以前，我们是会埋人的。我还记得那些歌。'),
    line('greeting:first', 'Come closer. I am Hedda. I have been a hundred and nine for some years now; I stopped counting the birthdays when they stopped meaning anything.', '过来点。我叫海达。我一百零九岁有好几年了；生日不顶用了以后，我就不数了。', { once: true }),
    line('default', 'Everyone thinks the Keeper is kind. Ask him to let go of me. Go on. Ask him.', '人人都说守护者心善。你去叫他放了我。去啊。去问他。', { mood: 'angry' }),
    line('default', 'Forty years ago I was dying, properly, the way you are meant to. I had said my goodbyes. Then I woke up.', '四十年前我正在死，好好地死，就像人该死的那样。告别的话我都说完了。然后我醒了。'),
    line('topic:liese_forgot', 'Liese forgets Piet\'s name now. In a year she will forget her own. Then she will walk out to the graves. That is what keeping does.', '莉泽现在已经忘了皮特的名字。再过一年，她会忘了自己的名字。然后她就会走到坟地去。留下来，就是这么个下场。'),
    line('topic:reins_let_go', 'Oh. Oh, I can feel it. Sit with me a moment. Not long.', '啊。啊，我感觉到了。陪我坐一会儿。不用太久。', { mood: 'happy' }),
    line('given:item/food/apple', 'An apple. I have no teeth for it. Leave it by me; I like the smell.', '苹果。我没牙啃了。放在我旁边吧，我喜欢闻这个味。', { mood: 'happy' }),
  ],
}
