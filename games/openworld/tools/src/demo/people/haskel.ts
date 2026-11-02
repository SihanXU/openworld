// Weighmaster Haskel of Fairweight (docs/chapter-3.md §7): exact, gentle, sure he is merciful. He keeps the great scale and
// the Church's black weight, and the Register of everyone he has weighed. He weighed his own son, who was found light and
// walked out onto the salt two winters ago; he says only that he remembers every name.

import { line, type PersonDef } from '../person.ts'

export const haskel: PersonDef = {
  id: 'npc.haskel',
  role: 'scholar',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Weighmaster Haskel', zh: '称量官哈斯克尔' },
  gender: 'male',
  look: { parts: { hair: 'hair.cropped', face: 'face.stern', outfit: 'outfit.coat', beard: 'beard.moustache', glasses: 'glasses.round', hat: null }, colors: { hair: 'ash', eyes: 'storm', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'linen' } },
  age: 56,
  favourite: 'item/misc/ink',
  temperament: { personality: 'exact', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.ottilie': 'the Guild he weighs for', 'npc.berthe': 'disapproves of him' },
  purse: 40,
  trade: { stock: [['item/document/scroll', 2], ['item/misc/ink', 1], ['item/food/bread', 1]] },
  schedules: {
    default: [
      [22, 6, 'fairweight.weighhouse:haskel.bed', 'sleep'],
      [6, 12, 'fairweight:haskel.scale', 'keep the scale'],
      [12, 14, 'fairweight.weighhouse:haskel.desk', 'write the Register'],
      [14, 18, 'fairweight:haskel.scale', 'keep the scale'],
      [18, 22, 'fairweight.weighhouse:haskel.desk', 'write the Register'],
    ],
  },
  lines: [
    line('chat', 'A scale does not lie and does not pity. That is why it can be trusted with what pity would get wrong.', '秤不撒谎，也不怜悯。所以怜悯会弄错的事，可以交给秤。'),
    line('chat', 'The black weight came from the Holy City with the first Weighmaster. It has never been moved off that plinth but to weigh.', '那块黑秤砣是第一任称量官从圣城带来的。除了过秤，它从没离开过那个石座。'),
    line('greeting:first', 'A pilgrim of the Five. Welcome to Fairweight. I am Haskel, the Weighmaster. If you are hungry, you may be weighed; there is no charge.', '五苦的朝圣者。欢迎来到公秤镇。我是称量官哈斯克尔。你要是饿了，可以来过秤，不收钱。', { once: true }),
    line('default', 'No one in Fairweight starves. Those the scale finds light are relieved of hunger, and the rest share what is left. It balances.', '公秤镇没有人饿死。秤称出来轻的人，就不再受饿；剩下的人，分剩下的粮。两相平衡。'),
    line('default', 'I remember every one I have weighed. I do not need the Register. I keep it because the Church asks.', '每一个过过秤的人我都记得，用不着名录。我记着它，是因为教会要。'),
    line('hour:evening', 'The light is going earlier. I weigh by daylight; the Measure does not like candles.', '天黑得越来越早了。我只在白天过秤，衡砣不喜欢烛光。'),
    line('fact:ch3.ledger', 'You went to the Black Balance? ...I have sent its tithe there every season for thirty years. I have never been inside.', '你去过黑衡殿了？……三十年来，我每季都把什一税送到那里。我从来没进去过。'),
    line('topic:scale_tipped', 'The beam split in the night. I heard it from my bed. It sounded like a door.', '秤杆是夜里裂开的。我躺在床上听见了。那声音像是一扇门。', { mood: 'sad' }),
    line('fact:ch3.end', 'Aldric. My son. He was found light two winters ago, and walked out on the salt in the spring. I weighed him myself. ...I wanted you to know his name.', '奥德里克。我儿子。两年前的冬天，他被称轻了，开春就走到了盐滩上。是我亲手称的他。……我想让你知道他的名字。', { once: true, mood: 'sad' }),
    line('given:item/misc/ink', 'Ink. Thank you. The Register uses more than you would think.', '墨水。谢谢你。名录用的墨，比你想的要多。', { mood: 'happy' }),
  ],
}
