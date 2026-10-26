// Lina, a forager of Firstlight (docs/cast/lina.md): twenty, an orphan — her father went east with the Church's pilgrims and never
// came back, her mother died of a winter fever when she was eight; no house took her in, so she sleeps in Marta's cookhouse. Foraging
// does not feed her: she robs the old barrows south of the grassland and sells to Tobin, who never asks (the almanac he sold Nessa came
// out of a barrow by her hands). She told the village she sheltered from the storm; she went down on the storm night when no one would
// see, and Oskar followed her to drag her out. A cat of a girl: trusts no one, prices everything, denies every kindness she does.

import { line, type PersonDef } from '../person.ts'

export const lina: PersonDef = {
  id: 'npc.lina',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'villager',
  essential: true,
  name: { en: 'Lina', zh: '莉娜' },
  gender: 'female',
  look: { parts: { hair: 'hair.messy', face: 'face.keen', outfit: 'outfit.cloak', hat: null, mark: null }, colors: { hair: 'umber', eyes: 'amber', skin: 'fair', 'outfit.1': 'moss', 'outfit.2': 'umber' } },
  age: 20,
  temperament: { personality: 'sly', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.ilse': 'fond of her, never says so' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/material/herb', 4], ['item/food/berries', 6], ['item/food/mushroom/raw', 4], ['item/material/fireweed', 2]] },
  purse: 15,
  schedules: {
    default: [
      [0, 24, 'barrow:cell.lina', 'wait to be found'],
    ],
    'fact:rescue.lina': [
      [22, 7, 'meadow.cook:bed.3', 'sleep'],
      [7, 22, 'meadow:lina.garden', 'tend the herbs'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "I still count the days. Habit from the barrow. Don't look at me like that — the number's a good one now.", '我还在数日子。古墓里落下的毛病。别那样看我——现在数到的数字挺好的。'),
    line('chat', "There are mushrooms by the north stones nobody picks. I pick them. Tell Oskar and I'll know.", '北边石头旁有蘑菇没人采。我采。你敢告诉奥斯卡，我会知道的。'),
    line('chat', 'People keep their word about as well as the river keeps a rope. I keep coin. Coin never changes its mind.', '人守诺言，跟河守绳子差不多。我守钱。钱不会变卦。'),
    line('chat', "Call the sister forgetful once, and you'll find out how good my memory is.", '敢说修女一句忘性大，你就知道我记性有多好了。'),
    line('default', "I wasn't counting the days. ...Two days and a night, if you want to know.", '我才没数日子。……两天一夜，你要是想知道的话。', { mood: 'shy' }),
    line('fact:rescue.lina', "I still dream of that barrow. The herbs don't care. They want watering all the same.", '我还会梦见那座古墓。草药可不管这些，照样要浇水。'),
    line('fact:rescue.lina', 'A grey man shut the inner door from outside. Then he left bread by it, with an ash mark on it. Nobody gives anything for free. So what did he want?', '有个灰衣人从外面关上了里面那道门。然后在门边留了面包，上面有个灰印。没人会白给东西。那他图什么？'),
    line('fact:rescue.lina', "That old almanac the scholar keeps waving about? ...Tobin sells a lot of things. Don't ask him where he gets them.", '那个学者天天挥着的旧历书？……托宾卖的东西多了。别问他从哪儿弄来的。'),
    line('fact:rescue.lina', "If you see mushrooms on Pell's doorstep, the wind left them. Very generous wind this year.", '你要是在佩尔家门口看见蘑菇，那是风吹来的。今年的风特别大方。', { mood: 'happy' }),
    line('fact:rescue.lina', "This? Off a woman's hand, in a barrow. Nobody went to see her either. ...Don't tell Oskar.", '这个？古墓里一个女人手上的。也没人去看她。……别告诉奥斯卡。', { mood: 'sad' }),
    line('fact:rescue.lina', "Marta's pot again. I pay in mushrooms. She pretends that's enough.", '又是玛尔塔的锅。我拿蘑菇抵饭钱。她装作这就够了。'),
    line('fact:rescue.lina', "The sister never latches the chapel door at night. Says it's for the wind. ...The wind doesn't need a blanket.", '修女每晚都不闩礼拜堂的门。说是给风留的。……风又不用盖毯子。'),
    line('fact:rescue.lina', "It was the Church that sent my father east. She only prayed he'd come back. ...She still prays every morning. I've heard her.", '是教会把我爹派往东边的。她只是祈祷他能回来。……到现在每天清晨还在祷告。我听见过。', { mood: 'sad' }),
    line('fact:rescue.lina', "Don't tell the sister where I go at night. ...It's not that she'd be angry. It's that she wouldn't be.", '别告诉修女我晚上去哪儿。……不是怕她生气。是怕她不生气。'),
    line('fact:ch1.flame_stolen', "She's still sweeping that cold altar. ...I left dawnbloom on it. Don't look at me like that. I picked too many.", '她还在扫那座冷掉的祭坛。……我在上面放了晨光花。别那样看我。是采多了。', { mood: 'shy' }),
    line('fact:ch1.flame_stolen', 'If anything happened to the sister... Nothing will happen to her. Forget I said it.', '要是修女出了什么事——……她不会出事的。当我没说。', { once: true, mood: 'sad' }),
    line('given', "For me? ...What do you want for it?", '给我的？……你想要什么回报？', { mood: 'surprised' }),
  ],
}
