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
    line('chat', "I still count the days. I got into the habit in the barrow, and I can't seem to stop.", '我到现在还在数日子。在长眠冢里养成的习惯，改不掉了。'),
    line('chat', "There are mushrooms by the north stones that nobody picks. I pick them. If you tell Oskar, I'll know.", '北边那几块石头旁边有蘑菇，没人去采，我采。你要是告诉奥斯卡，我会知道的。'),
    line('chat', "I'll sell you anything, and we can talk about the price. No credit, though. Nobody who said they'd pay me later ever did.", '东西我都可以卖你，价钱好商量。赊账免谈。说过几天再给钱的人，没一个给过。'),
    line('chat', 'So the sister forgets things. What of it? Anyone who laughs at her in front of me can buy their herbs somewhere else.', '修女是忘性大，那又怎样。谁当着我的面笑话她，就别想再从我这儿买东西。'),
    line('default', "I wasn't counting the days. ...Two days and a night, if you want to know.", '我才没数日子。……两天一夜，你要是想知道的话。', { mood: 'shy' }),
    line('fact:rescue.lina', 'I still dream about that barrow at night. In the day I water the herbs and try not to think about it.', '我晚上还会梦见那座长眠冢。白天就浇浇草药，尽量不去想。'),
    line('fact:rescue.lina', 'A man in grey shut the inner door from outside. Then he left bread by it, with an ash mark pressed into it. Nobody gives anything for free. So what did he want?', '有个穿灰衣服的人从外面把里面那道门关上了，后来又在门边放了面包，面包上按着一个灰印。没人会白给东西。他到底想要什么？'),
    line('fact:rescue.lina', "That old almanac the scholar carries everywhere? ...Tobin sells a lot of things. Don't ask him where he gets them.", '那个学者走到哪儿都带着的旧历书？……托宾卖的东西多了。他从哪儿弄来的，你别问。'),
    line('fact:rescue.lina', "If you see mushrooms on Pell's doorstep, the wind left them there. The wind's been very generous this year.", '你要是在佩尔家门口看见蘑菇，那是风吹过去的。今年的风挺大方。', { mood: 'happy' }),
    line('fact:rescue.lina', "This? It was on a woman's hand, in a barrow. Nobody ever went to see her either. ...Don't tell Oskar.", '这个？长眠冢里一个女人手上的。也从来没人去看过她。……别告诉奥斯卡。', { mood: 'sad' }),
    line('fact:rescue.lina', "I ate at Marta's again. I pay her in mushrooms. It doesn't cover it, and we both know that.", '又去玛尔塔那儿吃饭了。我拿蘑菇抵饭钱。根本抵不够，她知道，我也知道。'),
    line('fact:rescue.lina', "The sister never latches the chapel door at night. She says it's for the wind. A few times in winter I slept by the flame, and every time I woke up under a blanket.", '修女晚上从来不闩礼拜堂的门，说是给风留的。冬天我在圣火边睡过几回，每回醒来身上都盖着毯子。'),
    line('fact:rescue.lina', "It was the Church that sent my father east, not her. All she did was pray he'd come back. ...She still prays every morning. I've heard her.", '把我爹派到东边去的是教会，不是她。她只是为他祷告，求他能回来。……她到现在每天早上还在祷告，我听见过。', { mood: 'sad' }),
    line('fact:rescue.lina', "Don't tell the sister where I go at night. She wouldn't scold me. She'd just be sad, and I can't stand that.", '我晚上去哪儿，别告诉修女。她不会骂我，只会难过。我受不了那个。'),
    line('fact:ch1.flame_stolen', "She's still sweeping that cold altar. ...The dawnbloom on it is mine. Don't look at me like that. I picked too many, that's all.", '她还在扫那座冷掉的祭坛。……上面的晨光花是我放的。别那样看我，采多了而已。', { mood: 'shy' }),
    line('fact:ch1.flame_stolen', 'If anything happened to the sister... Nothing will happen to her. Forget I said it.', '要是修女出了什么事……她不会出事的。当我没说。', { once: true, mood: 'sad' }),
    line('given', "For me? ...What do you want for it?", '给我的？……你想要什么回报？', { mood: 'surprised' }),
  ],
}
