// Prior Lucan of the Red Order (docs/chapter-2.md §7): devout, measured, the Church's register. He was a novice with
// Odran fifty years ago and has stood at the posts every evening since. He believes the painless war is the Kingdom come,
// and that the offering carried west is how the Church keeps the Five; he has never asked how.

import { line, type PersonDef } from '../person.ts'

export const lucan: PersonDef = {
  id: 'npc.lucan',
  role: 'priest',
  essential: true,
  tags: ['storybound', 'devout'],
  name: { en: 'Prior Lucan', zh: '卢坎院长' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.stern', outfit: 'outfit.vestment', hat: null }, colors: { hair: 'steelgrey', eyes: 'bark', skin: 'light', 'outfit.1': 'madder', 'outfit.2': 'charcoal', 'outfit.3': 'gold' } },
  age: 60,
  favourite: 'item/light/candle',
  temperament: { personality: 'devout', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.odran': 'novice with him long ago', 'npc.ivo': 'a brother of his house' },
  purse: 20,
  trade: { stock: [['item/light/candle', 4], ['item/vessel/flask/holy_water', 1], ['item/food/bread', 2]] },
  schedules: {
    default: [
      [21, 5, 'scourgehouse.cells:bed.0', 'sleep'],
      [5, 12, 'scourgehouse.hall:lucan.altar', 'keep the altar of the Post'],
      [12, 17, 'scourgehouse:lucan.court', 'keep the court'],
      [17, 19, 'scourgehouse:lucan.post', 'take strokes at the post'],
      [19, 21, 'scourgehouse.hall:lucan.altar', 'write the register'],
    ],
  },
  lines: [
    line('chat', 'I came here a novice fifty years ago. I have stood at the posts every evening since, but two, when I had the fever.', '五十年前，我来这里做见习修士。从那以后，每个黄昏我都站到柱子前面，只有两个晚上没去，那时我在发烧。'),
    line('chat', 'Our register goes back to the first year of the Pillar: every evening, every stroke. The Holy See asks for the count each spring.', '我们的献祭簿一直记到刑柱元年：每一个黄昏，每一鞭。圣座每年开春都要来要这个数。'),
    line('greeting:first', 'Peace on you, pilgrim of the Five. I am Lucan, Prior of the Red Order. This house has kept the Rider\'s strokes for three hundred years.', '愿你平安，五苦的朝圣者。我是红衣修会的院长卢坎。三百年来，这座院子一直替骑者受鞭。', { once: true }),
    line('default', 'At dusk the brothers stand at the posts and take strokes for the Rider, so that he carries a little less. It is our whole rule.', '每到黄昏，修士们站到柱子前面，替骑者受鞭，好让他少担一点。这就是我们全部的戒律。'),
    line('default', 'Under the Rider no one in the March suffers. The soldiers do not, and the farmers do not. That is a grace the rest of the world has not been given.', '在骑者治下，边境上没有人受苦。士兵不受，农人也不受。这是世上别处都没有得到的恩典。'),
    line('hour:evening', 'Dusk. Forgive me; it is the hour of the posts.', '黄昏了。请原谅，到站柱的时辰了。'),
    line('fact:ch2.channels', 'You went down. ...The offering is carried west, to the Holy City, as it always has been. The Church keeps the Five with it. I have never asked how.', '你下去过了。……献祭往西送，送到圣城，一向如此。教会靠它维系五苦。怎么维系的，我从来没有问过。'),
    line('topic:quiet_dusk', 'The brothers stood at the posts this evening and wept at the first stroke. Some could not go on. I could not either.', '今天黄昏，修士们站到柱前，第一鞭落下就哭了。有人没能再站下去。我也没能。', { mood: 'sad' }),
    line('given:item/light/candle', 'A candle for the altar. The Order thanks you.', '一支给祭坛的蜡烛。修会感谢你。', { mood: 'happy' }),
  ],
}
