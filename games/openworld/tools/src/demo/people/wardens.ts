// The wardens of the Most Holy Hall (docs/finale.md §5): two who keep its porch, in white over mail. They have opened the
// door to pilgrims before.

import { line, type PersonDef } from '../person.ts'

const warden = (id: string, side: 'w' | 'e', name: [string, string], gender: 'male' | 'female', hair: string, lines: PersonDef['lines']): PersonDef => ({
  id,
  role: 'guard',
  tags: ['storybound'],
  name: { en: name[0], zh: name[1] },
  gender,
  look: { parts: { hair, face: 'face.stern', outfit: gender === 'male' ? 'outfit.gambeson' : 'outfit.cloak', hat: 'hat.helm' }, colors: { hair: 'umber', eyes: 'bark', skin: 'light', 'outfit.1': 'ivory', 'hat.1': 'steel' } },
  age: 40,
  temperament: { personality: 'dutiful', manner: 'polite', social: 'reserved', outlook: 'wary' },
  ties: {},
  purse: 12,
  trade: { stock: [['item/light/candle', 1]] },
  schedules: {
    default: [
      [6, 22, `holyhall:warden.porch.${side}`, 'keep the porch'],
      [22, 6, `holyhall:warden.porch.${side}`, 'keep the porch by night'],
    ],
  },
  lines,
})

export const wardenW = warden('npc.warden_w', 'w', ['Warden of the Porch', '大殿门廊守卫'], 'male', 'hair.cropped', [
  line('chat', 'We keep the porch a day at a time. Nothing comes up the avenue that is not expected.', '我们一班守一整天。凡是走上大道来的，没有一个是没人等着的。'),
  line('chat', 'My father kept this porch, and his father. None of us has been past the nave.', '我父亲守过这道门廊，他父亲也守过。我们没有一个人进过中殿后面。'),
  line('default', 'The door is open to you, bearer. It has been open to others. You are the first to come with five.', '门为你开着，承担者。它也为别人开过。你是头一个带着五件来的。'),
  line('fact:fin.end', 'We heard the bell from under the floor, and then nothing. The Primate says we are to keep the porch. So we keep it.', '我们听见地底下传来钟声，后来就什么也没有了。首席司祭说，我们要守着门廊。那就守着。'),
])
export const wardenE = warden('npc.warden_e', 'e', ['Warden of the Porch', '大殿门廊守卫'], 'female', 'hair.bun', [
  line('chat', 'The statues are washed once a year, on the night of the Night. We are told not to look at their faces. There are no faces left, but we do not look.', '雕像一年洗一回，就在原夜那一夜。上面吩咐我们不许看它们的脸。脸早就没有了，可我们还是不看。'),
  line('chat', 'Pilgrims leave their staffs at the foot of the stair. There are hundreds. Nobody comes back for them.', '朝圣者们把手杖留在台阶下面。有好几百根。没有人回来取。'),
  line('default', 'Pilgrims used to come up this avenue singing. You are the first in my time who came up it quiet.', '从前的朝圣者都是唱着歌走上这条大道的。在我当差的年头里，你是头一个不出声走上来的。'),
  line('fact:fin.end', 'The sun came up this morning, all of it. I had forgotten how long a morning is.', '今天早上太阳完完整整地升起来了。我都忘了，一个早晨原来有这么长。'),
])
