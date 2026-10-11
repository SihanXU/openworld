// Brother Anselm, who keeps Firstlight's church of the First Dawn and its bookstand: skill books copied in the
// monastery over the pass before the storms, sold for what they cost to bring down (content village.ts). He has read
// every one and can do none of it, and says so.

import { line, type PersonDef } from '../person.ts'

export const anselm: PersonDef = {
  id: 'npc.anselm',
  role: 'priest',
  essential: true,
  name: { en: 'Brother Anselm', zh: '安塞姆修士' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.vestment', beard: null, hat: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'light' } },
  age: 68,
  temperament: { personality: 'gentle', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.ilse': 'the sister who keeps the Firstlight' },
  purse: 10,
  schedules: {
    default: [
      [21, 6, 'meadow.church:priest.bed', 'sleep'],
      [6, 21, 'meadow.church:priest.stand', 'keep the bookstand'],
    ],
  },
  lines: [
    line('greeting:first', 'Welcome to the church of the First Dawn. The books on the stand teach what the hands can learn: a strike, a step, a word of fire. Take one to the light and read it — it will stay with you.', '欢迎来到初晓教堂。书架上的书教的是手能学会的东西：一击、一步、一句火焰的咒语。拿一本到光下读，它就会留在你身上。', { once: true }),
    line('default', 'The common books are for anyone. The ones for a road — dagger, shield, bow or staff — are dearer, and teach only those who walk it.', '普通的书谁都能学。走某条路的书——匕首、盾、弓或法杖——贵一些，也只教走那条路的人。'),
    line('default', 'I have read every book on that stand. I cannot do a single thing in them. Reading is not the same as learning; remember that.', '那个书架上的书我每一本都读过。书里的东西我一样也做不到。读了不等于学会，记住这一点。'),
    line('hour:evening', 'The candles are lit at dusk. Sit, if you like. The benches do not ask why you came.', '黄昏时点上蜡烛。想坐就坐吧。长椅不会问你为什么来。'),
    line('given', 'Thank you. The church will put it to use.', '谢谢你。教堂会派上用场的。'),
  ],
}
