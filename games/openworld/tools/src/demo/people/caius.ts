// Father Caius, the Holy See's priest at the Pilgrims' Rest (docs/chapter-1.md §14): kind, tired, certain. He takes the
// pilgrim's oath at the five wounds and sends them on. He knows the First Seal-bearer was due relief, and that it never
// went: he was told it was not a pilgrim's concern, and has decided to believe it.

import { line, type PersonDef } from '../person.ts'

export const caius: PersonDef = {
  id: 'npc.caius',
  role: 'priest',
  essential: true,
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound', 'devout'],
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
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'I set out as a pilgrim myself, when I was young. I got as far as this Rest, and stayed. Someone has to keep the door here.', '我年轻时也是朝圣者。走到这座驿站，就没再往前走，留了下来。这里总得有人守着门。'),
    line('chat', 'Have some tea before you go, if you have the time. The well here is deep and the water is good; pilgrims fill their skins here before they go east.', '有空的话，喝杯茶再走。这里的井打得深，水好，朝圣者往东去之前，都在这里把水囊灌满。'),
    // (a first meeting may come before the knight falls or after: it says nothing of him either way — `rest_after` and
    // his line on the knight's fall are what he says once the road is open)
    line('greeting:first', 'Peace on your road, pilgrim. I am Father Caius. The Holy See keeps me at this Rest to bless the pilgrims it sends east, and to keep the five wounds.', '愿你一路平安，朝圣者。我是凯乌斯司铎。圣座派我驻守这座驿站，为往东去的朝圣者祝福，并看守五道圣伤。'),
    line('default', 'Suffering is not God\'s abandonment. I say it at the altar every morning, and on the hard mornings I say it twice.', '苦难并非神的遗弃。我每天早上都在祭坛前念一遍，日子难熬的时候，就念两遍。'),
    line('default', 'There are five shrines on the road, one for each suffering. Lay at each what it asks: a thing for the head, a cord, a meal, metal, a light.', '路上有五座圣龛，一苦一座。每座龛前放上它要的东西：戴在头上的一样，一根绳，一顿饭，一块金属，一盏灯。'),
    line('default', 'They say the Seal-bearer on the East Road was a gentle man. I never met him; that is how Wynn\'s old rhyme tells it.', '听说东大路上那位持印者，从前是个很温和的人。我没见过他，温唱的那首老童谣里是这么说的。'),
    line('hour:evening', 'Evening has come early again. I write the hour in my book, and Sister Ilse writes it in hers, and we send each other the numbers by the pilgrims.', '黄昏又提早了。我把时辰记进册子，伊尔丝修女也在她那边记，我们托朝圣者把数字捎给对方。'),
    line(`fact:ch1.writ`, 'You found the writ. ...Yes. I knew. I was told it was not a pilgrim\'s concern, and I decided to believe it. Go on. Don\'t look at me like that.', '你找到那份文书了。……是，我知道这件事。上面跟我说，这不是朝圣者该过问的，我就决定信了。走吧。别那样看着我。', { once: true, mood: 'sad' }),
    line('fact:sins.defeated.alberic', 'Three hundred years, and in the end it took one pilgrim and a fairy. God forgive us for letting him hold so long.', '三百年。到头来，只用了一个朝圣者和一个精灵。我们竟让他守了这么久，愿神宽恕我们。', { mood: 'sad' }),
    line('fact:sins.defeated.alberic', 'The road east is open. Go on when you are ready, pilgrim. Four more Seal-bearers wait, and the Crown is only the first of the five.', '往东的路通了。准备好了就上路吧，朝圣者。还有四位持印者在等你，荆棘冠只是五件圣器里的第一件。'),
  ],
}
