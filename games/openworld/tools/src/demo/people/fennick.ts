// Fennick, an old templar (docs/chapter-1.md §7): once of the Seal-bearers' escort, squire to the White Knight
// Alberic in the long hold — crowned two and a half centuries before, and still the gentlest man who ever wore armour
// — until the crown took enough of him that one morning he did not know Fennick's name.

import { line, type PersonDef } from '../person.ts'

export const fennick: PersonDef = {
  id: 'npc.fennick',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'guard',
  essential: true,
  name: { en: 'Fennick', zh: '芬尼克' },
  gender: 'male',
  look: { parts: { hair: 'hair.swept', face: 'face.soft', outfit: 'outfit.plate', beard: 'beard.moustache', hat: null }, colors: { hair: 'snow', eyes: 'sky', skin: 'fair', 'outfit.1': 'ivory', 'outfit.2': 'gold', 'outfit.3': 'steel' } },
  age: 62,
  temperament: { personality: 'weary', manner: 'rough', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.severin': 'knew him' },
  // an old templar who still keeps the watch with Holt, and still fights
  watch: 'firstlight',
  fights: true,
  purse: 40,
  // what they sell (fits who they are; content items.ts prices it)
  trade: { level: 2, stock: [['item/armor/helmet', 1], ['item/armor/shield', 1], ['item/clothing/boots', 1], ['item/weapon/polearm/spear', 1]] },
  schedules: {
    default: [
      [22, 7, 'meadow.guards:bed.1', 'sleep'],
      [7, 22, 'meadow:fennick.bench', 'mend harness on the bench'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'The first year, armour is heavy. After that you stop noticing it. I wore mine six years, and when I took it off for good I did not know what to do with my hands.', '头一年穿盔甲，只觉得沉。后来就不觉得了。我穿了六年，等到真脱下来不再穿了，两只手都不知道往哪儿放。'),
    line('chat', 'Every morning for a month he asked me my name, and it took me that long to understand why. I answered him every time. What else could I do?', '他连着一个月，每天早上都问我叫什么名字。过了那么久，我才明白是怎么回事。我每次都答了。不答，又能怎么样呢。'),
    line('greeting:first', 'Sit if you like. I\'m Fennick. Don\'t ask about the armour.', '想坐就坐吧。我叫芬尼克。盔甲的事别问。'),
    line('default', 'I carried a lance in the Seal-bearers\' escort once. A long time ago.', '我年轻时在持印者的护卫队里扛过长枪。很久以前的事了。'),
    line('fact:ch1.letter', 'The White Knight. Alberic. When I served him, he would kneel to talk to children, so his face was level with theirs. Now everyone who passes must kneel to him. The crown did that to him.', '白骑士……阿尔贝里克。我跟着他的那些年，他跟孩子说话，总要单膝跪下来，好跟孩子一样高。现在过路的人，都得向他下跪。是那顶冠把他变成这样的。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', 'A grey cloak, ash on his hands? ...I knew a man like that. He would not rob a chapel. If it was him, he had a reason, and I do not like to think what it was.', '灰斗篷，手上沾着灰？……我认识一个这样的人。他不会去偷礼拜堂。要真是他，那他一定有他的理由。是什么理由，我不敢往下想。'),
    line('fact:seen.barrow_mouth', 'You saw the carving at the barrow mouth? The Order of the Thorn buried its own there, before my time. The warden was one of us. Alberic\'s brothers, all of them, and none of them lying still.', '你看见长眠冢门口的刻纹了？荆棘骑士团的人死了，就葬在那里，比我入团还早。守墓的那位也是我们团里的。他们全是阿尔贝里克的弟兄，没有一个能安安稳稳地躺着。', { once: true, mood: 'sad' }),
    line('fact:ch1.crown', 'You brought him down. Was he — was he himself, at the end? ...Good. Good.', '你把他打倒了。他……到最后，他还是原来的他吗？……那就好。那就好。', { once: true, mood: 'sad' }),
  ],
}
