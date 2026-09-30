// Bilingual name and dialogue generation for thousands of NPCs.

import type { Rng, Text } from '@lsw/engine'

const SYL: [string, string][] = [
  ['al', '阿'], ['bran', '布兰'], ['cor', '科'], ['da', '达'], ['el', '艾'], ['fen', '芬'], ['gar', '加'], ['hal', '哈'],
  ['is', '伊'], ['jor', '约'], ['kel', '凯'], ['lin', '林'], ['mar', '马'], ['nes', '内'], ['or', '奥'], ['per', '佩'],
  ['quin', '昆'], ['ros', '罗'], ['sel', '塞'], ['tor', '托'], ['ul', '乌'], ['ven', '文'], ['wen', '温'], ['yr', '伊尔'],
  ['ber', '贝'], ['dra', '德拉'], ['eth', '埃斯'], ['gwen', '格温'], ['hild', '希尔'], ['ka', '卡'], ['lor', '洛'], ['mira', '米拉'],
  ['nor', '诺'], ['ril', '里尔'], ['sten', '斯坦'], ['thal', '萨尔'], ['val', '瓦尔'], ['wyn', '温'], ['ash', '艾什'], ['bryn', '布琳'],
]
const END: [string, string][] = [
  ['', ''], ['a', '娅'], ['ric', '里克'], ['wyn', '温'], ['en', '恩'], ['is', '丝'], ['or', '尔'], ['ette', '特'], ['us', '斯'], ['ia', '娅'],
  ['mund', '蒙德'], ['ard', '德'], ['elle', '艾尔'], ['o', '奥'], ['ren', '伦'],
]
const SURNAME: [string, string][] = [
  ['Frost', '霜'], ['Ashford', '灰津'], ['Millbrook', '磨溪'], ['Saltwind', '盐风'], ['Greenleaf', '青叶'], ['Stone', '石'],
  ['Hollow', '空谷'], ['Ember', '余烬'], ['Ringborn', '环生'], ['Tidewell', '潮井'], ['Oakheart', '橡心'], ['Crowe', '鸦'],
  ['Silver', '银'], ['Hearth', '炉'], ['Wolfe', '狼'], ['Brightwater', '明水'], ['Thorne', '荆'], ['Reed', '芦'],
]

export function personName(rng: Rng): Text {
  const n = rng.int(1, 2)
  let en = ''
  let zh = ''
  for (let i = 0; i < n; i++) {
    const [e, z] = rng.pick(SYL)
    en += e
    zh += z
  }
  const [e2, z2] = rng.pick(END)
  en = (en + e2).replace(/^./, (c) => c.toUpperCase())
  zh += z2
  if (rng.chance(0.55)) {
    const [se, sz] = rng.pick(SURNAME)
    return { en: `${en} ${se}`, zh: `${sz}·${zh}` }
  }
  return { en, zh }
}

const L = (en: string, zh: string): Text => ({ en, zh })

const ROLE_LINES: Record<string, Text[]> = {
  villager: [L('Fine weather, if the wind holds.', '天气不错，就看风向了。'), L('My cousin swears the old seal-stones hum at night.', '我表哥发誓说，古封印石夜里会嗡嗡作响。'), L('Keep your torch away from the haystacks, stranger.', '外乡人，火把离干草垛远点。')],
  farmer: [L('Dry season. One spark and the whole field goes up.', '旱季啊，一个火星子整片地都得烧光。'), L('Slimes got into the turnips again.', '史莱姆又钻进萝卜地了。'), L('Rain would be a mercy.', '要是下场雨就好了。')],
  merchant: [L('Everything has a price, friend.', '朋友，万物皆有价。'), L('Lamp oil sells well this far north.', '在北边，灯油最好卖。'), L('Browse, but break it and you buy it.', '随便看，打碎了可得赔。')],
  guard: [L('Move along.', '走你的路。'), L('No trouble in my streets.', '我的街上不许闹事。'), L('The Legion is stretched thin these days.', '军团这些年人手吃紧。')],
  smith: [L('Steel remembers every strike.', '钢铁记得每一次锤击。'), L('Bring ore and I will make you something honest.', '带矿石来，我给你打件实在的。'), L('Keep water by the forge. Always.', '熔炉边永远要备着水。')],
  innkeeper: [L('Warm bed, warmer stew.', '床是暖的，炖菜更暖。'), L('Travellers bring the best rumours.', '旅人带来的传闻最有意思。'), L('Mind the fireplace, it spits.', '小心壁炉，它会迸火星。')],
  priest: [L('The Ancients bound the wyrms; we keep the vigil.', '先民封印了古龙，我们守着这份誓约。'), L('Holy water, freely given.', '圣水，无偿奉上。'), L('Light a candle for the seals.', '为封印点一支蜡烛吧。')],
  scholar: [L('The Ring-roads were never meant for carts.', '环道从来不是给马车修的。'), L('Fire and water, ice and storm — all obey rules. Mostly.', '火与水，冰与雷——都守规则。大体上。'), L('Do not touch the manuscripts.', '别碰那些手稿。')],
  noble: [L('Do I know you?', '我认识你吗？'), L('The Crown will endure. It must.', '王冠必将长存。它必须如此。'), L('How quaint.', '真是别致。')],
  child: [L('Wanna see me catch a slime?', '想看我抓史莱姆吗？'), L('Mama says not to play with fire.', '妈妈说不许玩火。'), L('Tag! You are it!', '抓到你了！换你来抓！')],
  fisher: [L('The fish bite best at dawn.', '黎明时鱼最爱咬钩。'), L('Something big moves under the ice.', '冰面下有个大家伙在动。'), L('Salt and patience.', '盐和耐心，缺一不可。')],
  hunter: [L('Wolves come down from the pass when it snows.', '一下雪，狼就从山口下来了。'), L('Frost wolves hate fire.', '霜狼怕火。'), L('Tracks everywhere this morning.', '今早到处是脚印。')],
  miner: [L('The deep tunnels breathe warm air.', '深处的坑道会吐热气。'), L('Found a ring-shard once. Sold it for a song.', '挖到过一块环冠碎片，贱卖了。'), L('Pickaxe, lamp, luck.', '镐、灯、运气。')],
  bard: [L('♪ Three seals to bind the Throat of the World… ♪', '♪ 三道封印，锁住世界之喉…… ♪'), L('A coin for a song?', '赏个铜板听首歌？'), L('Every tavern has a story. Most are lies.', '每家酒馆都有故事，大多是瞎编的。')],
  beggar: [L('Spare a crust?', '能给口吃的吗？'), L('I was a soldier once.', '我曾经也是个兵。'), L('Bless you, bless you.', '好人有好报。')],
  soldier: [L('Frostfang will not rise again. Not on my watch.', '霜牙别想再造反，有我在就不行。'), L('Drills at dawn, drills at dusk.', '清晨操练，黄昏还操练。'), L('Seen any cultists?', '见过断罪教团的人吗？')],
  mage: [L('Water conducts. Remember that and live longer.', '水能导电。记住这点能活得久些。'), L('Oil and fire: a crude but effective spell.', '油加火：粗糙，但有效。'), L('The College is always recruiting.', '学院一直在招人。')],
  herbalist: [L('Herbs mend what steel breaks.', '钢铁打伤的，草药来医。'), L('Frostcap grows where the cold bites.', '霜盖菇长在寒气咬人的地方。'), L('Never eat a mushroom you cannot name.', '叫不出名字的蘑菇千万别吃。')],
  sailor: [L('The drowned isle glows on moonless nights.', '没月亮的夜里，沉岛会发光。'), L('Tides wait for no one.', '潮水不等人。'), L('Ever seen a crab the size of a cart?', '见过马车那么大的螃蟹吗？')],
  traveler: [L('The road from Saltport is long.', '从盐港过来的路可真长。'), L('Stay clear of the Ashen Waste.', '离灰烬荒原远点。'), L('Just passing through.', '只是路过。')],
}

export function linesFor(role: string, rng: Rng, regionLine?: Text): Text[] {
  const pool = ROLE_LINES[role] ?? ROLE_LINES.villager
  const out = rng.shuffle([...pool]).slice(0, 2 + (rng.chance(0.5) ? 1 : 0))
  if (regionLine && rng.chance(0.6)) out.push(regionLine)
  return out
}
