// Father Caius, the Holy See's priest at the Pilgrims' Rest (docs/chapter-1.md §14): kind, tired, certain. He takes the
// pilgrim's oath at the five wounds and sends them on. He knows the First Seal-bearer was due relief, and that it never
// went: he was told it was not a pilgrim's concern, and has decided to believe it.

import { line, type PersonDef } from '../person.ts'

export const caius: PersonDef = {
  id: 'npc.caius',
  role: 'priest',
  essential: true,
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  name: { en: 'Father Caius', zh: '凯乌斯司铎' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.weary', outfit: 'outfit.vestment' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'light', 'outfit.1': 'ivory', 'outfit.2': 'indigo', 'outfit.3': 'gold' } },
  age: 61,
  temperament: { personality: 'devout', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.ilse': 'old correspondent' },
  trade: { stock: [['item/light/candle', 6], ['item/vessel/flask/holy_water', 2], ['item/food/bread', 3]] },
  purse: 25,
  schedules: {
    default: [
      [21, 6, 'waystation.chapel:caius.bed', 'sleep'],
      [6, 12, 'waystation.chapel:caius.altar', 'keep the five wounds'],
      [12, 21, 'waystation:caius.porch', 'watch the road for pilgrims'],
    ],
  },
  lines: [
    // (a first meeting may come before the knight falls or after: it says nothing of him either way — `rest_after` and
    // his line on the knight's fall are what he says once the road is open)
    line('greeting:first', 'Peace on your road, pilgrim. I am Father Caius; the Holy See keeps me at this Rest to bless the pilgrims it sends east, and to keep the five wounds.', '愿你一路平安，朝圣者。我是凯乌斯司铎；圣座派我驻守这座驿站，为它派往东边的朝圣者祝福，也守着五道圣伤。'),
    line('default', 'Suffering is not God\'s abandonment. Say it until you believe it; that is what I do.', '苦难并非神的遗弃。一遍遍地念，念到你相信为止；我就是这么做的。'),
    line('default', 'Five shrines on the road. Lay at each what its suffering asks: a thing for the head, a cord, a meal, metal, a light.', '路上有五座圣龛。在每座龛上放下它那一苦要的东西：一样戴在头上的、一根绳、一顿饭、一块金属、一盏光。'),
    line('default', 'The Seal-bearer on the East Road was a gentle man, they say. The Crown asks a great deal of the gentle.', '据说东大路上那位持印者，曾经是个温和的人。荆冠对温和的人索取得格外多。'),
    line('hour:evening', 'Another evening come early. I write the hour in the book. Sister Ilse writes it in hers. Neither of us writes what it means.', '又一个提前到来的黄昏。我把时辰记进册子。伊尔丝修女也记在她的册子里。我们谁都没写它意味着什么。'),
    line(`fact:ch1.writ`, 'You found the writ. ...Yes. I knew. I was told it was not a pilgrim\'s concern, and I decided to believe it. Go on. Don\'t look at me like that.', '你找到那份文书了。……是的。我知道。有人告诉我那不是朝圣者该操心的事，我就决定相信了。走吧。别那样看着我。', { once: true, mood: 'sad' }),
    line('fact:sins.defeated.alberic', 'Three hundred years, and it took one pilgrim and a fairy. God forgive us for how long we let him hold.', '三百年，最后只用了一个朝圣者和一个精灵。愿神宽恕我们，让他守了那么久。', { mood: 'sad' }),
    line('fact:sins.defeated.alberic', 'The road east is open. Go on when you are ready, pilgrim: four more Seal-bearers wait, and the Crown is only the first of the five.', '往东的路通了。准备好了就继续上路吧，朝圣者：还有四位持印者在等着，荆棘冠只是五件中的第一件。'),
  ],
}
