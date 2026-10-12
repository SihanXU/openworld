// Pell, a boy who draws (docs/chapter-1.md §7): Marta's nephew. He has seen the grey man three times
// and nobody believes him; the stone the man gave him keeps the night-born off his window.

import { line, type PersonDef } from '../person.ts'

export const pell: PersonDef = {
  id: 'npc.pell',
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
      [20, 7, 'meadow:cook.home', 'sleep'],
      [7, 20, 'meadow:pell.play', 'draw on the walls in chalk'],
    ],
  },
  lines: [
    line('greeting:first', 'Are you a knight? You have a fairy! Can I draw her?', '你是骑士吗？你有个精灵！我能画她吗？'),
    line('default', 'I saw the grey man. Three times! Nobody believes me. He gave me a stone that is warm at night.', '我见过那个灰衣人。三次！没人信我。他给了我一块晚上会发热的石头。'),
    line('default', 'Since I got the stone, the night things don\'t come near my window. Auntie says that\'s nonsense.', '自从有了那块石头，夜里的东西就不靠近我的窗户了。姑姑说那是瞎说。'),
    line('fact:ch1.flame_stolen', 'I TOLD them. I told them about the grey man. Now everyone believes me and nobody is happy about it.', '我早就说了。我早就跟他们说过灰衣人。现在大家都信了，可谁都不高兴。', { once: true }),
    line('fact:ch1.end', 'Was he bad? The grey man? He didn\'t look bad. He looked tired.', '他是坏人吗？那个灰衣人？他看起来不像坏人。他看起来很累。'),
  ],
}
