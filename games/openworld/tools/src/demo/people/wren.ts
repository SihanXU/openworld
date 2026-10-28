// Wren, the herbalist. Young, quick, and the only one in Emberfall who has read about dragons
// rather than only feared them. Her cauldron is always on.

import { line, type PersonDef } from '../person.ts'

const CAULDRON = { uses: 'emberfall.cauldron', need: { status: ['lit'] } }

export const wren: PersonDef = {
  id: 'npc.wren',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'herbalist',
  essential: true,
  name: { en: 'Wren', zh: '雷恩' },
  gender: 'female',
  look: { parts: { hair: 'hair.wavy', face: 'face.bright', outfit: 'outfit.robe', hat: null, glasses: null }, colors: { hair: 'auburn', eyes: 'leaf', skin: 'fair', 'outfit.1': 'forest' } },
  age: 23,
  temperament: { personality: 'curious', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.mara': 'the elder who taught her letters' },
  // her draughts are for sale
  trade: { stock: [['item/potion/healing', 3], ['item/potion/antidote', 2], ['item/potion/fire_resist', 1], ['item/material/herb', 4]] },
  purse: 40,
  schedules: {
    default: [
      [22, 6, 'emberfall:herb.home', 'sleep'],
      [6, 22, 'emberfall:herb.cauldron', 'tend the cauldron', CAULDRON],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "Fresh fireweed stings — that's what these red spots on my hands are. It only works while it still stings. Once it's dried it stops, and it's not half as strong.", '新鲜的火焰草会蜇手，我手上这些红点就是这么来的。蜇手的才有药性，晒干了就不蜇了，药性也差了一大半。'),
    line('chat', "When Mara taught me my letters, the first book I finished was about dragons. It's the only one in town, and I've read it more times than I can count.", '玛拉教我认字的时候，我读完的第一本书就是讲龙的。镇上就那么一本，我翻了不知道多少遍。'),
    line('greeting:first', "Oh! A visitor. I'm Wren; I make herbal remedies and salves. Mind the cauldron — now and then it goes off.", '哦！来客人了。我叫雷恩，在这儿配草药、熬药膏。小心那口锅，它有时候会炸。', { once: true }),
    line('default', 'Fireweed grows in open meadow; frostcap in the shade of Hushwood. Bring me three of each, and I can brew something against fire.', '火焰草长在开阔的草原上，霜盖菇长在噤声林的阴凉处。各给我带三份来，我就能熬出防火的药。'),
    line('default', "The book says a dragon calls its young when it's hurt. It doesn't say what to do when that happens. Be careful.", '书上说，龙受了伤就会把幼龙叫来。真到了那时候该怎么办，书上没写。你要当心。'),
    line('fact:mq.draught', "One at the mouth of the lair, and one when the first wears thin. And come back.", '到了巢穴门口喝一瓶，第一瓶快没效了再喝第二瓶。还有——一定要回来。', { once: true }),
    line('given', 'For my shelves? Thank you!', '给我的架子添货？谢谢！'),
  ],
}
