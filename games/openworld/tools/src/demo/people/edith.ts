// Edith, a widow of Fairweight (docs/chapter-3.md §6, beat 3): weighed on the day the pilgrim comes and found light. From
// then on she works the dead fields beside Corwin, smiling. When Ele falls she is the first on the square, hungry.

import { line, type PersonDef } from '../person.ts'

export const edith: PersonDef = {
  id: 'npc.edith',
  role: 'villager',
  tags: ['storybound'],
  name: { en: 'Edith', zh: '伊迪丝' },
  gender: 'female',
  look: { parts: { hair: 'hair.tied', face: 'face.soft', outfit: 'outfit.dress', hat: 'hat.kerchief' }, colors: { hair: 'chestnut', eyes: 'bark', skin: 'light', 'outfit.1': 'charcoal', 'hat.1': 'charcoal' } },
  age: 41,
  favourite: 'item/food/bread',
  temperament: { personality: 'gentle', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.corwin': 'works beside him' },
  purse: 1,
  trade: { stock: [['item/material/cloth', 1]] },
  schedules: {
    'fact:ch3.scale': [
      [21, 6, 'fairweight.poorhouse:poor.table', 'sleep'],
      [6, 21, 'fairweight:edith.field', 'clear the dead field'],
    ],
    default: [
      [6, 18, 'fairweight:edith.field', 'work the dead field'],
      [18, 6, 'fairweight:edith.field', 'work the dead field by lantern'],
    ],
  },
  lines: [
    line('chat', 'My husband died in the winter. I was so hungry afterward that I could not think about him. Now I can think about him all day.', '我丈夫冬天死了。后来我饿得厉害，连想他都想不了。现在，我能一整天都想着他。'),
    line('chat', 'The field is all salt. I clear it anyway. It is good to have something to do with one\'s hands.', '这片地全是盐。我还是照样清。手上有点活干，总是好的。'),
    line('default', 'I am not hungry. Isn\'t it wonderful? I feel so light.', '我不饿了。是不是很好？我觉得好轻啊。', { mood: 'happy' }),
    line('topic:edith_weighed', 'Everyone was so kind. They said "light", and I stepped down, and I was not hungry any more.', '大家都对我很好。他们说“轻”，我就走下来了，然后就再也不饿了。', { mood: 'happy' }),
    line('topic:scale_tipped', 'I am hungry. I am so hungry. I had forgotten what it was like. How could I forget?', '我饿。我好饿。我都忘了是什么滋味了。我怎么会忘了呢？', { mood: 'sad' }),
    line('fact:ch3.end', 'I cried all through supper. I was thinking about him, and I was hungry, and both of them hurt. ...I think that is right.', '吃晚饭的时候我一直在哭。我想着他，我又饿，两样都疼。……我想，就该是这样的。', { mood: 'sad' }),
    line('given:item/food/bread', 'Thank you. You are kind.', '谢谢你。你真好。', { mood: 'happy' }),
  ],
}
