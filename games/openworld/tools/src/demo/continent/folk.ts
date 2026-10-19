// The backdrop's people, in words (docs/continent.md §11): their names in both languages, by region; what they say,
// by what they do and where they live. No tale is told in what they say — the regions' sufferings are in the weather,
// the work and the prices, never in a quest or a secret.

import type { LineDef } from '@openworld/engine'
import type { Name } from './names.ts'

type Pair = [string, string]

/** Given names by region and sex: each English with its Chinese (transliterated, as the Ford's people are). */
export const GIVEN: Record<string, { female: Pair[]; male: Pair[] }> = {
  frostfang: {
    female: [['Astrid', '阿斯特丽德'], ['Sigrun', '西格伦'], ['Ingrid', '英格丽'], ['Solveig', '索尔薇格'], ['Thora', '索拉'], ['Ylva', '伊尔娃'], ['Ragna', '拉格娜'], ['Hedda', '海达'], ['Liv', '莉芙'], ['Brynja', '布琳娅'], ['Gudrun', '古德伦'], ['Embla', '恩布拉'], ['Runa', '鲁娜'], ['Kari', '卡莉'], ['Saga', '萨迦'], ['Frida', '弗丽达']],
    male: [['Bjorn', '比约恩'], ['Halvar', '哈尔瓦'], ['Sigurd', '西古尔德'], ['Leif', '雷夫'], ['Torvald', '托尔瓦德'], ['Arne', '阿尔内'], ['Eirik', '埃里克'], ['Gunnar', '贡纳尔'], ['Ivar', '伊瓦尔'], ['Knut', '克努特'], ['Rolf', '罗尔夫'], ['Sten', '斯滕'], ['Ulric', '乌尔里克'], ['Vidar', '维达'], ['Orm', '奥姆'], ['Hakon', '哈康']],
  },
  redmarch: {
    female: [['Brunhild', '布伦希尔德'], ['Katrin', '卡特琳'], ['Mirka', '米尔卡'], ['Radka', '拉德卡'], ['Zora', '佐拉'], ['Vesna', '韦斯娜'], ['Dragana', '德拉加娜'], ['Jelka', '耶尔卡'], ['Branka', '布兰卡'], ['Ilka', '伊尔卡'], ['Marta', '玛尔塔'], ['Oksana', '奥克萨娜'], ['Ludmila', '柳德米拉'], ['Teodora', '特奥多拉'], ['Svetla', '斯韦特拉'], ['Hedwig', '黑德维希']],
    male: [['Radomir', '拉多米尔'], ['Bogdan', '博格丹'], ['Dragan', '德拉甘'], ['Kazimir', '卡济米尔'], ['Milos', '米洛什'], ['Stanko', '斯坦科'], ['Vuk', '武克'], ['Zoran', '佐兰'], ['Borislav', '博里斯拉夫'], ['Gerhard', '格哈德'], ['Ottokar', '奥托卡'], ['Wenzel', '文策尔'], ['Lothar', '洛塔尔'], ['Dietmar', '迪特马尔'], ['Jaromir', '雅罗米尔'], ['Ratko', '拉特科']],
  },
  tithe: {
    female: [['Agnes', '艾格尼丝'], ['Maud', '莫德'], ['Joan', '琼'], ['Alys', '艾丽丝'], ['Edith', '伊迪丝'], ['Beatrix', '比阿特丽克丝'], ['Isolde', '伊索尔德'], ['Rose', '萝丝'], ['Cecily', '塞西莉'], ['Ellen', '艾伦'], ['Margery', '玛杰丽'], ['Nan', '南'], ['Tilda', '蒂尔达'], ['Wenna', '温娜'], ['Hawise', '霍伊丝'], ['Bettris', '贝特丽丝']],
    male: [['Walter', '沃尔特'], ['Hugh', '休'], ['Roger', '罗杰'], ['Simon', '西蒙'], ['Giles', '贾尔斯'], ['Ralph', '拉尔夫'], ['Osbert', '奥斯伯特'], ['Martin', '马丁'], ['Geoffrey', '杰弗里'], ['Hamo', '哈莫'], ['Piers', '皮尔斯'], ['Robin', '罗宾'], ['Thurstan', '瑟斯坦'], ['Wat', '瓦特'], ['Adam', '亚当'], ['Ivo', '伊沃']],
  },
  palefen: {
    female: [['Aine', '艾妮'], ['Brigid', '布丽吉德'], ['Ciara', '基娅拉'], ['Deirdre', '迪尔德丽'], ['Eithne', '埃斯妮'], ['Fiona', '菲奥娜'], ['Grainne', '格兰妮'], ['Isla', '艾拉'], ['Maeve', '梅芙'], ['Niamh', '妮芙'], ['Orla', '奥拉'], ['Roisin', '萝欣'], ['Saoirse', '瑟莎'], ['Una', '乌娜'], ['Moira', '莫伊拉'], ['Sorcha', '索尔卡']],
    male: [['Aidan', '艾丹'], ['Bran', '布兰'], ['Cian', '基安'], ['Declan', '德克兰'], ['Eamon', '埃蒙'], ['Fergus', '弗格斯'], ['Lorcan', '洛肯'], ['Niall', '尼尔'], ['Oisin', '奥辛'], ['Ronan', '罗南'], ['Tadhg', '泰格'], ['Cormac', '科马克'], ['Diarmuid', '迪尔穆德'], ['Fintan', '芬坦'], ['Colm', '科尔姆'], ['Kieran', '基兰']],
  },
  altar: {
    female: [['Clara', '克拉拉'], ['Agatha', '阿加莎'], ['Lucia', '露西娅'], ['Benedicta', '本笃塔'], ['Cecilia', '塞西莉亚'], ['Hilda', '希尔达'], ['Monica', '莫妮卡'], ['Scholastica', '思嘉'], ['Ursula', '乌尔苏拉'], ['Odile', '奥迪尔'], ['Paula', '保拉'], ['Regina', '雷吉娜'], ['Sabina', '萨宾娜'], ['Thecla', '特克拉'], ['Verena', '维蕾娜'], ['Adela', '阿德拉']],
    male: [['Anselm', '安瑟伦'], ['Benedict', '本笃'], ['Clement', '克莱门特'], ['Dominic', '多明我'], ['Gregory', '格里高利'], ['Jerome', '哲罗姆'], ['Lucius', '卢修斯'], ['Paulus', '保卢斯'], ['Silvan', '西尔万'], ['Urban', '乌尔班'], ['Vincent', '文森特'], ['Bernard', '伯纳德'], ['Aldric', '奥尔德里克'], ['Basil', '巴西尔'], ['Cyprian', '居普良'], ['Hilary', '希拉里']],
  },
  holy: {
    female: [['Aurelia', '奥蕾莉娅'], ['Celestine', '塞莱斯廷'], ['Dorothea', '多萝西娅'], ['Helena', '海伦娜'], ['Irene', '艾琳'], ['Junia', '尤尼娅'], ['Livia', '莉薇娅'], ['Marina', '玛丽娜'], ['Octavia', '屋大薇'], ['Phoebe', '菲比'], ['Seraphina', '塞拉菲娜'], ['Theodora', '狄奥多拉'], ['Valeria', '瓦莱丽娅'], ['Zenobia', '芝诺比娅'], ['Lydia', '莉迪娅'], ['Flavia', '弗拉维娅']],
    male: [['Aurelian', '奥勒良'], ['Cassian', '卡西安'], ['Demetrius', '德米特里'], ['Eusebius', '优西比乌'], ['Felix', '费利克斯'], ['Gaius', '盖乌斯'], ['Ignatius', '依纳爵'], ['Julian', '尤利安'], ['Marcus', '马库斯'], ['Nicanor', '尼卡诺尔'], ['Octavian', '屋大维'], ['Quintus', '昆图斯'], ['Severus', '塞维鲁'], ['Tiberius', '提比略'], ['Valens', '瓦伦斯'], ['Lucian', '卢锡安']],
  },
}

/** Family names: a region's first halves (as its places', names.ts) and a root a household is known by. */
const FAMILY_PRE: Record<string, Pair[]> = {
  frostfang: [['Frost', '霜'], ['Pine', '松'], ['Grey', '灰'], ['Wolf', '狼'], ['Thorn', '棘'], ['North', '北'], ['Fir', '杉'], ['Gull', '鸥'], ['Snow', '雪'], ['Elk', '麋'], ['Birch', '桦'], ['Raven', '渡鸦']],
  redmarch: [['Red', '赤'], ['Iron', '铁'], ['Spear', '矛'], ['Rust', '锈'], ['Ember', '烬'], ['Shield', '盾'], ['Hawk', '鹰'], ['Flint', '燧'], ['Ash', '灰'], ['Crag', '崖'], ['Boar', '猪'], ['Steel', '钢']],
  tithe: [['Salt', '盐'], ['Grain', '谷'], ['Dust', '尘'], ['Copper', '铜'], ['Barley', '麦'], ['Millet', '粟'], ['Hay', '草'], ['Straw', '秸'], ['Mill', '磨'], ['Oat', '燕麦'], ['Sheaf', '捆'], ['Flax', '麻']],
  palefen: [['Pale', '苍'], ['Mire', '泥'], ['Reed', '苇'], ['Still', '寂'], ['Fog', '雾'], ['Crow', '鸦'], ['Moth', '蛾'], ['Rush', '灯芯'], ['Sedge', '莎'], ['Heron', '鹭'], ['Willow', '柳'], ['Eel', '鳗']],
  altar: [['White', '白'], ['Chalk', '垩'], ['Bell', '钟'], ['Candle', '烛'], ['High', '高'], ['Lily', '百合'], ['Dove', '鸽'], ['Choir', '咏'], ['Cloister', '院'], ['Vigil', '守'], ['Rose', '玫瑰'], ['Marble', '石'] ],
  holy: [['Sun', '日'], ['Dawn', '曙'], ['Gold', '金'], ['Lamb', '羔'], ['Halo', '环'], ['Grace', '恩'], ['Light', '光'], ['Myrrh', '没药'], ['Laurel', '桂'], ['Olive', '橄榄'], ['Palm', '棕'], ['Amber', '琥珀']],
}
const FAMILY_ROOT: Pair[] = [['wood', '林'], ['brook', '溪'], ['field', '田'], ['stone', '石'], ['ford', '渡'], ['hill', '丘'], ['well', '井'], ['dale', '谷'], ['croft', '园'], ['ward', '守'], ['wright', '匠'], ['man', '人'], ['hold', '堡'], ['mere', '湖'], ['row', '巷']]

/** A family name for a household: the region's, and not one taken in this place already. */
export function familyName(region: string, pick: <T>(xs: T[]) => T, taken: Set<string>): Name {
  const pre = FAMILY_PRE[region] ?? FAMILY_PRE.frostfang
  for (let tries = 0; tries < 200; tries++) {
    const [pe, pz] = pick(pre)
    const [re, rz] = pick(FAMILY_ROOT)
    const en = `${pe}${re}`
    if (taken.has(en) && tries < 150) continue
    taken.add(en)
    return { en, zh: `${pz}${rz}` }
  }
  throw new Error(`no family name left in ${region}`)
}

// ------------------------------------------------------------------ what they say

const L = (key: string, en: string, zh: string): LineDef => ({ key, text: { en, zh } })

/** By what they do. */
const BY_ROLE: Record<string, LineDef[]> = {
  villager: [
    L('default', 'Mind the ruts in the lane. Everybody trips on the same one.', '小心巷子里的车辙。大家都在同一个坑里绊倒过。'),
    L('default', 'Water from the well is cold this year. Colder than I remember.', '今年井里的水很凉。比我记得的还要凉。'),
    L('default', 'You are not from here. That is all right. Most people are not from anywhere, these days.', '你不是本地人。没关系。如今大多数人哪儿的人也不算。'),
    L('hour:morning', 'Up already? The bread is not even out yet.', '这么早就起了？面包还没出炉呢。'),
    L('hour:evening', 'Day is done. Feet are sore. That is how you know it was a day.', '一天结束了。脚也酸了。这样才算过了一天。'),
  ],
  farmer: [
    L('default', 'The soil gives what it gives. You cannot shout at it.', '地里长什么就是什么。冲它喊也没用。'),
    L('default', 'Turned the east rows twice this week. They will thank me in autumn. Or they will not.', '这周东边那几垄翻了两遍。秋天它们会谢我的。也可能不会。'),
    L('hour:morning', 'Best hour of the day for a hoe. The ground is soft and nobody talks to you.', '一天里最适合锄地的时候。地是软的，也没人跟你说话。'),
    L('weather:rain', 'Rain! Good. Do not stand in my furrows.', '下雨了！好。别站在我的垄沟里。'),
  ],
  merchant: [
    L('default', 'Fair prices, honest weights. Ask anyone. Well — ask most people.', '价钱公道，秤准。随便问谁。好吧——问大多数人。'),
    L('default', 'Coin moves slow this season. Everything else moves slower.', '这一季钱流得慢。别的东西流得更慢。'),
    L('hour:evening', 'Closing soon. Buy now or dream about it.', '快收摊了。现在买，或者回去做梦。'),
  ],
  smith: [
    L('default', 'Iron does not lie. It bends where you were lazy.', '铁不会骗人。你在哪儿偷了懒，它就在哪儿弯。'),
    L('default', 'Bring me something broken and I will make it ugly and strong.', '把坏东西拿来，我把它打得又丑又结实。'),
  ],
  innkeeper: [
    L('default', 'Bed is a coin, soup is two, and the stories are free if you are not boring.', '床一枚钱，汤两枚，故事免费——只要你不无聊。'),
    L('hour:evening', 'Evening crowd is the thirsty crowd. Stay clear of the corner table.', '晚上来的都是口渴的人。离角落那张桌子远点。'),
  ],
  priest: [
    L('default', 'Sit a while if you need to. The quiet is free.', '需要的话就坐一会儿吧。安静是不收钱的。'),
    L('default', 'People pray more for rain than for mercy. I do not blame them.', '人们为雨祈祷的比为怜悯祈祷的多。我不怪他们。'),
    L('hour:morning', 'Morning prayers are short. The day is long enough already.', '晨祷很短。白天已经够长了。'),
  ],
  guard: [
    L('default', 'Keep your blade in its sheath and we will get along.', '刀留在鞘里，我们就能相安无事。'),
    L('default', 'Quiet watch so far. I like quiet watches.', '到现在为止都很太平。我喜欢太平的班。'),
    L('hour:night', 'Late to be walking. Go home, or go somewhere lit.', '这么晚还在走。回家去，或者去有灯的地方。'),
  ],
  soldier: [
    L('default', 'Drill at dawn, drill at dusk, and in between we wait.', '黎明操练，黄昏操练，中间就是等。'),
    L('default', 'Nobody tells us what we are guarding against. So we guard against everything.', '没人告诉我们在防什么。所以我们什么都防。'),
  ],
  child: [
    L('default', 'Bet you cannot hop to the well and back on one foot.', '打赌你没法单脚跳到井边再跳回来。'),
    L('default', 'My mother says not to talk to travellers. You do not look like a traveller.', '我娘说别跟过路人说话。你看起来不像过路人。'),
    L('hour:evening', 'I have to go in soon. I am not tired. I am not.', '我马上得回去了。我不困。真的不困。'),
  ],
  elder: [
    L('default', 'When I was young the winters were shorter. Or I was quicker.', '我年轻的时候冬天短一些。要么就是我腿脚快一些。'),
    L('default', 'Sit, sit. Standing is for people with somewhere to be.', '坐，坐。站着是给那些有地方要去的人的。'),
  ],
  fisher: [
    L('default', 'The fish bite when they please. So do I.', '鱼想咬钩的时候才咬。我也一样。'),
    L('weather:rain', 'Rain on the water is good luck. Rain down my collar is not.', '雨打在水上是好兆头。雨灌进领子里可不是。'),
  ],
  hunter: [
    L('default', 'Tracks everywhere and nothing at the end of them. Odd year.', '到处是脚印，尽头却什么都没有。怪年景。'),
    L('default', 'Walk softer. The woods hear you before they see you.', '脚步轻点。林子先听见你，然后才看见你。'),
  ],
  miner: [
    L('default', 'Down there you count by lamps, not hours.', '在下面，你按灯算时间，不按钟点。'),
  ],
  herbalist: [
    L('default', 'Feverfew for the head, yarrow for the cut, patience for everything else.', '小白菊治头疼，蓍草止血，其他的都靠耐心。'),
  ],
  scholar: [
    L('default', 'I am copying a book about copying books. It is going slowly.', '我在抄一本讲怎么抄书的书。进展很慢。'),
  ],
  noble: [
    L('default', 'One does not loiter. One surveys.', '本人不是闲逛。本人是在巡视。'),
  ],
  bard: [
    L('default', 'I know a song for every road. Most of them are about feet.', '每条路我都会一首歌。大多数是讲脚的。'),
  ],
  beggar: [
    L('default', 'A coin, a crust, a kind word. Any of the three.', '一枚钱，一块面包皮，一句好话。三样哪样都行。'),
  ],
  traveler: [
    L('default', 'Just passing through. Everybody is, if you think about it.', '只是路过。仔细想想，谁不是呢。'),
    L('default', 'The road east was empty for half a day. I sang to keep myself company.', '往东的路有半天一个人都没有。我唱歌给自己作伴。'),
  ],
  peddler: [
    L('default', 'Needles, buttons, a little lamp oil. Small things keep a house together.', '针、扣子、一点灯油。小东西才撑得起一个家。'),
  ],
}

/** By where they live: the land and its weather, never its tale. */
const BY_REGION: Record<string, LineDef[]> = {
  frostfang: [
    L('default', 'Wind off the sea again. It gets into the bread.', '又是海上来的风。连面包里都是。'),
    L('weather:storm', 'Storm off the sea. Stack the wood high and keep the shutters shut.', '海上起风暴了。柴堆高，窗板关好。'),
  ],
  redmarch: [
    L('default', 'Red dust on everything. You stop seeing it after a year.', '什么上面都是红土。过一年你就看不见了。'),
    L('default', 'Fences go up faster than houses here.', '在这儿，篱笆比房子盖得快。'),
  ],
  tithe: [
    L('default', 'Half the grain to the granary, half the rest to the scales. What is left, we eat.', '一半粮食交粮仓，剩下的一半交秤。再剩的，我们吃。'),
    L('default', 'Dry again. The wells taste of salt by midsummer.', '又旱了。到了仲夏，井水都是咸的。'),
  ],
  palefen: [
    L('default', 'The mist comes up at noon some days. You learn the paths by your feet.', '有些日子中午就起雾。路得靠脚去记。'),
    L('default', 'Do not step off the boards. The mud keeps what it takes.', '别走下木板。泥会把吞下去的东西留着。'),
  ],
  altar: [
    L('default', 'Bells at every hour. You stop hearing them, then you miss them.', '每个钟点都有钟声。你会听不见，然后又会想念。'),
    L('default', 'White stone everywhere. Sweep it once and it is white for a day.', '到处都是白石头。扫一遍能白一天。'),
  ],
  holy: [
    L('default', 'Pilgrims every day. Some come to pray, some to sell, some to be seen.', '天天有朝圣的人。有的来祈祷，有的来做买卖，有的来让人看见。'),
    L('default', 'Mind your purse in the crowd by the gate.', '城门边人多，看好你的钱袋。'),
  ],
}

const GREETING: LineDef[] = [
  L('greeting:first', 'Hello there. New face.', '你好啊。生面孔。'),
  L('greeting:first', 'Well met. Not many stop to talk.', '幸会。停下来说话的人不多。'),
  L('greeting:first', 'Oh — hello. Can I help you?', '哦——你好。有什么事吗？'),
]

/** What a person of this role in this region says: a greeting, two of their work's lines and one of their land's. */
export function linesFor(role: string, region: string, pick: <T>(xs: T[]) => T): LineDef[] {
  const own = BY_ROLE[role] ?? BY_ROLE.villager
  const land = BY_REGION[region] ?? BY_REGION.frostfang
  const out: LineDef[] = [pick(GREETING)]
  const a = pick(own)
  out.push(a)
  const b = pick(own)
  if (b !== a) out.push(b)
  out.push(pick(land))
  return out
}
