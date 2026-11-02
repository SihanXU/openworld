// Sergeant Roderick of the Right Company: across the middle ravine of the Lashmarks, under the same banner. The scenes bring
// him on at dusk; his camp is beyond the far side, where the pilgrim does not go.

import { line, type PersonDef } from '../person.ts'

export const roderick: PersonDef = {
  id: 'npc.roderick',
  role: 'soldier',
  name: { en: 'Sergeant Roderick', zh: '罗德里克军士' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.stern', outfit: 'outfit.gambeson', beard: 'beard.moustache', hat: 'hat.helm' }, colors: { hair: 'raven', eyes: 'storm', skin: 'light', 'outfit.1': 'madder', 'outfit.2': 'undyed', 'outfit.3': 'iron', 'hat.1': 'steel' } },
  age: 49,
  favourite: 'item/food/ale',
  temperament: { personality: 'stubborn', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: {},
  fights: true,
  purse: 12,
  trade: { stock: [['item/weapon/polearm/spear', 1]] },
  schedules: { default: [[0, 24, 'offstage:roderick.hide', "keep the Right Company's line"]] },
  lines: [
    line('chat', 'The Left took our banner. Everyone on our side of the ravine knows it.', '是左营抢了我们的旗。沟这边的人都知道。'),
    line('chat', 'We form up at six. We always have.', '我们六点列队，一向如此。'),
    line('default', 'You are on the wrong side of the ravine, pilgrim.', '朝圣者，你站错了沟的那一边。'),
  ],
}
