// The twelve people of Hearthvale: hand-written, each with a routine and a voice.

import type { Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

export interface Person {
  id: string
  role: string
  name: Text
  /** Character look key (catalog.characters). */
  look: string
  lines: Text[]
  /** [fromHour, toHour, place, activity] — place names resolve to map anchors in world.ts. */
  day: [number, number, string, string][]
  items?: string[]
}

export const PEOPLE: Person[] = [
  {
    id: 'npc.maren',
    role: 'elder',
    name: L('Elder Maren', '玛伦村长'),
    look: 'OldWoman',
    lines: [
      L('Hearthvale has stood two hundred winters. It will stand two hundred more.', '炉谷挺过了两百个冬天，还会再挺两百个。'),
      L('Mind the hay field. One careless spark and the whole harvest is gone.', '当心干草田。一个火星子，整季的收成就没了。'),
      L('The old folk say the world keeps its own rules — and writes new ones when it must.', '老人们说，这个世界有它自己的规矩——必要的时候，它还会给自己写新规矩。'),
    ],
    day: [
      [22, 6, 'maren.bed', 'sleep'],
      [6, 8, 'maren.table', 'breakfast'],
      [8, 12, 'square.well', 'watching the square'],
      [12, 13, 'inn.table', 'lunch'],
      [13, 18, 'square.board', 'village business'],
      [18, 22, 'maren.table', 'reading'],
    ],
  },
  {
    id: 'npc.brann',
    role: 'smith',
    name: L('Brann', '布兰'),
    look: 'Knight',
    lines: [
      L('Steel remembers every strike.', '钢铁记得每一次锤击。'),
      L('Keep a bucket by the forge. Always.', '熔炉边永远要备一桶水。'),
      L('Bring me ore and I will make it honest.', '带矿石来，我给你打件实在的。'),
    ],
    day: [
      [22, 6, 'smithy.bed', 'sleep'],
      [6, 12, 'smithy.anvil', 'forging'],
      [12, 13, 'inn.table', 'lunch'],
      [13, 19, 'smithy.anvil', 'forging'],
      [19, 22, 'inn.bar', 'ale'],
    ],
  },
  {
    id: 'npc.lio',
    role: 'innkeeper',
    name: L('Lio', '里奥'),
    look: 'Villager2',
    lines: [
      L('Warm bed, warmer stew.', '床是暖的，炖菜更暖。'),
      L('Travellers bring the best rumours — and the worst manners.', '旅人带来最好的传闻——还有最差的规矩。'),
      L('The fireplace spits. Don\'t stand too close with oil on you.', '壁炉会迸火星。身上沾了油就别凑太近。'),
    ],
    day: [
      [23, 7, 'inn.bed1', 'sleep'],
      [7, 23, 'inn.bar', 'keeping the inn'],
    ],
  },
  {
    id: 'npc.tamsin',
    role: 'villager',
    name: L('Tamsin', '塔姆辛'),
    look: 'Woman',
    lines: [
      L('Fresh bread at dawn, if the oven behaves.', '烤炉听话的话，天亮就有新鲜面包。'),
      L('Fish on the fire, not in the fire!', '鱼要架在火上，不是扔进火里！'),
      L('Wren, Pip — stay away from the pond!', '雷恩、皮普——离池塘远点！'),
    ],
    day: [
      [22, 6, 'inn.bed2', 'sleep'],
      [6, 9, 'square.market', 'market'],
      [9, 22, 'inn.kitchen', 'cooking'],
    ],
  },
  {
    id: 'npc.oda',
    role: 'merchant',
    name: L('Oda', '奥妲'),
    look: 'Noble',
    lines: [
      L('Everything has a price, friend.', '朋友，万物皆有价。'),
      L('Lamp oil sells well. People keep setting things on fire.', '灯油卖得好。大家总是把东西点着。'),
      L('Browse all you like — break it and you bought it.', '随便看——打碎了就算你买了。'),
    ],
    day: [
      [22, 7, 'shop.bed', 'sleep'],
      [7, 19, 'shop.counter', 'trading'],
      [19, 22, 'square.bench', 'evening air'],
    ],
  },
  {
    id: 'npc.hollis',
    role: 'farmer',
    name: L('Hollis', '霍利斯'),
    look: 'Villager',
    lines: [
      L('Slimes in the turnips again. Every spring.', '史莱姆又钻进萝卜地了。年年春天都这样。'),
      L('Dry season. Keep your torch away from my hay.', '旱季。你的火把离我的干草远点。'),
      L('A wet slime and a frost wand — now that\'s farming.', '湿史莱姆加一根冰杖——这才叫种地。'),
    ],
    day: [
      [21, 5, 'inn.bed3', 'sleep'],
      [5, 12, 'farm.rows', 'farming'],
      [12, 13, 'inn.table', 'lunch'],
      [13, 18, 'farm.rows', 'farming'],
      [18, 21, 'inn.bar', 'ale'],
    ],
  },
  {
    id: 'npc.wren',
    role: 'child',
    name: L('Wren', '雷恩'),
    look: 'Child',
    lines: [
      L('Bet you can\'t freeze the pond!', '我打赌你冻不住池塘！'),
      L('Pip says slimes taste like honey. Gross.', '皮普说史莱姆尝起来像蜂蜜。好恶心。'),
      L('Tag! You\'re it!', '抓到你了！换你来抓！'),
    ],
    day: [
      [20, 7, 'inn.bed4', 'sleep'],
      [7, 12, 'pond.shore', 'playing'],
      [12, 13, 'inn.table', 'lunch'],
      [13, 20, 'square.market', 'playing'],
    ],
  },
  {
    id: 'npc.pip',
    role: 'child',
    name: L('Pip', '皮普'),
    look: 'Boy',
    lines: [
      L('Slimes are squishy. I like them.', '史莱姆软乎乎的，我喜欢。'),
      L('If you pour oil on a slime and light it — no, Mama says no.', '要是往史莱姆身上倒油再点火——不行，妈妈说不行。'),
      L('I found a key once. Then I lost it.', '我捡到过一把钥匙，后来又弄丢了。'),
    ],
    day: [
      [20, 7, 'inn.bed4', 'sleep'],
      [7, 12, 'farm.edge', 'watching slimes'],
      [12, 13, 'inn.table', 'lunch'],
      [13, 20, 'square.well', 'playing'],
    ],
  },
  {
    id: 'npc.sera',
    role: 'herbalist',
    name: L('Sera', '塞拉'),
    look: 'Cavegirl',
    lines: [
      L('Herbs mend what steel breaks.', '钢铁打伤的，草药来医。'),
      L('Never eat a mushroom you cannot name.', '叫不出名字的蘑菇千万别吃。'),
      L('The frost slimes by the lake are gentle — until you splash them.', '湖边的冰霜史莱姆挺温顺的——除非你往它们身上泼水。'),
    ],
    day: [
      [22, 7, 'inn.bed5', 'sleep'],
      [7, 9, 'square.market', 'selling herbs'],
      [9, 16, 'wood.herbs', 'gathering'],
      [16, 22, 'inn.table', 'resting'],
    ],
  },
  {
    id: 'npc.garrick',
    role: 'guard',
    name: L('Garrick', '加里克'),
    look: 'Samurai',
    lines: [
      L('The road south goes to Whisperwood. Stay on the path.', '往南的路通向低语森林。别离开小路。'),
      L('Boars in the woods this year. Big ones.', '今年森林里有野猪，个头不小。'),
      L('Quiet night so far.', '今晚到目前为止还算太平。'),
    ],
    day: [
      [23, 7, 'inn.bed6', 'sleep'],
      [7, 19, 'gate.south', 'on watch'],
      [19, 23, 'inn.bar', 'ale'],
    ],
  },
  {
    id: 'npc.fenn',
    role: 'fisher',
    name: L('Old Fenn', '老芬'),
    look: 'OldMan',
    lines: [
      L('The fish bite best at dawn.', '黎明时鱼最爱咬钩。'),
      L('Froze the pond once, back in my day. Walked right across.', '我年轻时冻住过这池塘，直接走过去了。'),
      L('Salt and patience, that\'s all fishing is.', '钓鱼嘛，就是盐和耐心。'),
    ],
    day: [
      [21, 5, 'inn.bed7', 'sleep'],
      [5, 18, 'pond.dock', 'fishing'],
      [18, 21, 'inn.bar', 'stories'],
    ],
    items: ['item/tool/fishing_rod', 'item/food/fish/raw'],
  },
  {
    id: 'npc.mira',
    role: 'mage',
    name: L('Mira', '米拉'),
    look: 'SorcererOrange',
    lines: [
      L('Fire, water, ice, storm — everything here obeys rules. Mostly.', '火、水、冰、雷——这里的一切都守规矩。大体上。'),
      L('When you do something the world has never seen, it pauses… and then it learns.', '当你做了世界从没见过的事，它会停顿一下……然后学会它。'),
      L('Water conducts. Remember that and you\'ll live longer.', '水会导电。记住这一点，你能活得久些。'),
      L('I keep notes on every new rule the world writes. There are more every day.', '世界每写下一条新规则，我都记下来。每天都在变多。'),
    ],
    day: [
      [22, 7, 'maren.bed2', 'sleep'],
      [7, 12, 'square.board', 'studying'],
      [12, 14, 'pond.shore', 'experiments'],
      [14, 22, 'maren.shelf', 'reading'],
    ],
  },
]
