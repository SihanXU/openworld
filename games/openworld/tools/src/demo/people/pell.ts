// Pell, a boy who draws (docs/chapter-1.md §7): Marta's nephew. He has seen the grey man three times
// and nobody believes him; the stone the man gave him keeps the night-born off his window.

import { line, type PersonDef } from '../person.ts'

export const pell: PersonDef = {
  id: 'npc.pell',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'child',
  essential: true,
  name: { en: 'Pell', zh: '佩尔' },
  gender: 'male',
  look: { parts: { hair: 'hair.tuft', face: 'face.child', outfit: 'outfit.smock', mark: 'mark.freckles' }, colors: { hair: 'umber', eyes: 'bark', skin: 'warm', 'outfit.1': 'woad' } },
  age: 9,
  temperament: { personality: 'dreamy', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.marta': 'aunt' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/document/scroll', 2], ['item/misc/dice', 1], ['item/material/feather', 3]] },
  purse: 5,
  schedules: {
    default: [
      [20, 7, 'meadow.cook:bed.2', 'sleep'],
      [7, 20, 'meadow:pell.play', 'draw on the walls in chalk'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I drew the grey man again. Aunt Marta says it looks like a chimney. It does not!', '我又画了灰衣人。玛尔塔姑姑说画得像个烟囱。才不像呢！'),
    line('chat', "If you hold the warm stone up to your ear, it hums. Just a little. You can try — no, wait, I'm keeping it.", '把那块暖石头贴在耳朵上，它会嗡嗡响，就一点点。你可以试试——不行，还是我自己拿着吧。'),
    line('greeting:first', "Are you a knight? You've got a fairy! I'm Pell, I draw things. Can I draw her? Just quickly!", '你是骑士吗？你身边有个精灵！我叫佩尔，我会画画。我能画她吗？就画一下下！'),
    line('default', "I saw the grey man. Three times! Nobody believes me. He gave me a stone that's warm at night.", '我见过那个灰衣人。见过三次！没人信我。他给了我一块晚上会发热的石头。'),
    line('default', "Since I got the stone, the night things don't come near my window. Auntie says that's nonsense.", '自从有了那块石头，夜里的东西就不靠近我的窗户了。姑姑说那是瞎说。'),
    line('fact:ch1.flame_stolen', "I TOLD them! I told everyone there was a grey man! Now they believe me, but nobody will talk to me. The grown-ups are all arguing.", '我早就说了！我早就跟大家说过有个灰衣人！现在他们信了，可是谁都不理我，大人们都在吵架。', { once: true }),
    line('fact:ch1.end', "Was he bad? The grey man? He didn't look bad. He looked tired.", '他是坏人吗？那个灰衣人？他看起来不像坏人。他看起来很累。'),
  ],
}
