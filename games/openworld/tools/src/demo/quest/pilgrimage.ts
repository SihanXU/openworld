// The Pilgrim's Road (docs/chapter-1.md §14; content pilgrimage.ts): the maps between the Ford and the White Knight, and
// their scenes. East of the river: the Pilgrims' Rest, where the Church's priest takes the pilgrim's oath at the five
// wounds; the Pilgrim's Road, its five wayside shrines lit one by one, and a penitent who scourges himself on it; north
// of the road, the ruined Abbey of the Thorn where Alberic was made a knight — his Order's roll, his cell and his
// journal, the writ of relief that never went out, and in the crypt the Order's last keeper, who holds its seal; and the
// Kneeling Field, where the pilgrims before you knelt to him and stayed. Then the East Road and the knight.

import type { AiData, StepDef } from '@openworld/engine'
import { ABBOT_ID, ALBERIC_ID, CH1, CHURCH, FAITH, ORDER_SEAL, PILGRIMAGE, WAYSHRINES, WRIT, shrineFact } from '@openworld-game/content'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears, clump, lay } from '../kit.ts'
import { room } from '../village.ts'

/** Edge openings: the Ford's east edge into the Rest, the Rest into the road, the road into the field and to the abbey. */
export const PILGRIM = {
  rest: { w: 36, h: 26, west: [12, 13, 14], east: [11, 12, 13] },
  way: { w: 56, h: 24, west: [11, 12, 13], east: [11, 12, 13], north: [26, 27, 28] },
  abbey: { w: 40, h: 30, south: [19, 20, 21] },
  field: { w: 44, h: 24, west: [11, 12, 13], east: [11, 12, 13] },
  /** where the shrines stand along the road */
  shrines: [[7, 9], [17, 15], [30, 8], [40, 15], [50, 9]] as const,
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Woods round a map's edge, open where `open(x, y)` says. */
function rim(m: MapBuilder, open: (x: number, y: number) => boolean, deep = 3): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (open(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < deep && rng.chance(0.45))) m.set(x, y, rng.chance(0.35) ? 'pine' : 'tree')
    }
}

/** The nearest free tile to (x, y). */
function spot(m: MapBuilder, x: number, y: number, walk = false): [number, number] {
  for (let r = 0; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (walk ? m.walkable(x + dx, y + dy) : m.free(x + dx, y + dy)) return [x + dx, y + dy]
      }
  throw new Error(`no open tile near ${m.id}:${x},${y}`)
}
const has = (xs: readonly number[], v: number) => xs.includes(v)

// =================================================================== the Pilgrims' Rest

export function buildRest(): MapBuilder {
  const P = PILGRIM.rest
  const m = new MapBuilder('waystation', L("The Pilgrims' Rest", '朝圣者驿站'), 'village', P.w, P.h, 'grass', 'village', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  rim(m, (x, y) => (x < 4 && has(P.west, y)) || (x >= m.w - 4 && has(P.east, y)))
  m.path([[0, 13], [8, 13], [16, 12], [26, 12], [35, 12]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  // the chapel of the Five, north of the road; the hostel south of it; the pilgrims' fire between
  m.house('temple', 13, 3, 'chapel')
  m.house('longhouse', 21, 16, 'hostel')
  m.organic(18, 13, 5, 2.4, 'cobble', { only: (t) => t === 'grass' || t === 'path' })
  m.fixture('fixture/water/well', 25, 10)
  m.fixture('fixture/light/campfire', 15, 16, { statuses: { lit: -1 } })
  for (const [x, y] of [[13, 17], [17, 17]] as const) m.fixture('fixture/furniture/bench/log', x, y)
  m.fixture('fixture/sign/noticeboard', 10, 11, {
    name: L('The Holy See\'s notice', '圣座告示'),
    props: {
      text: 'BY THE HOLY SEE OF THE FIVE. The Seal-bearers are saints: they carry what Astra carried. Who kneels to the First Seal-bearer on the East Road passes in his mercy; who does not, he does not suffer to pass. Pilgrims, take the oath at the five wounds before you go on.',
      text_zh: '五苦圣座公告。持印者是圣人：他们背负着阿斯特拉背负过的东西。在东大路上向第一持印者下跪者，蒙其慈悲得以通过；不跪者，他不容通过。朝圣者，先在五道圣伤前立誓，再继续上路。',
    },
  })
  m.fixture('fixture/sign', 31, 10, { props: { text: "THE PILGRIM'S ROAD → five shrines, one road. Light them as you go.", text_zh: '朝圣者之路 → 五座圣龛，一条路。走一路，点一路。' } })
  m.sprinkle('fixture/nature/flowers', 0.05, (x, y, t) => t === 'grass' && m.near(x, y, (u) => u === 'path' || u === 'cobble', 2))
  // the people's places (people/caius.ts, maud.ts, wynn.ts)
  m.anchor('caius.porch', ...spot(m, 15, 9, true))
  m.anchor('maud.fire', ...spot(m, 14, 15, true))
  m.anchor('wynn.play', ...spot(m, 19, 14, true))
  m.regions.square = [8, 8, 20, 10]
  m.appear = GROUND_YIELD
  return m
}

/** The chapel of the Five at the Rest: the five wounds round Astra, and the priest's cot behind the altar. */
export function buildRestChapel(): MapBuilder {
  const m = room('waystation.chapel', 'Chapel of the Five', '五伤礼拜堂', 16, 12, 'stone', 'floor_stone', 'temple')
  m.fixture('fixture/sacred/altar', 8, 2, {
    id: 'waystation.altar',
    name: L('The altar of the five wounds', '五伤祭坛'),
    tags: ['readable'],
    props: { text: 'Astra on the holy wood, carved in white stone: a crown of thorns, the scourge\'s marks, the ribs of the fast, the nails, the lance in the side. Below: WHO BEARS, IS NEAR TO GOD.', text_zh: '白石雕成的阿斯特拉被钉在圣木上：荆棘冠、鞭痕、斋戒后的肋骨、圣钉、肋旁的枪伤。下方刻着：承受者，近于神。' },
  })
  for (const [x, y] of [[5, 2], [11, 2]] as const) m.fixture('fixture/light/candles', x, y, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/bookstand', 4, 5, { name: L('The Litany of the Five', '五苦祷文'), tags: ['readable'], props: { text: 'Suffering is not God\'s abandonment. It is the proof the debt is being paid. As long as one bears the Five, the night shall not return.', text_zh: '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。只要仍有人承担五苦，长夜便不会归来。' } })
  for (const [x, y] of [[5, 8], [10, 8]] as const) m.fixture('fixture/furniture/bench', x, y)
  m.fixture('fixture/furniture/bed', 14, 1, { name: L("The priest's cot", '司铎的小床') })
  m.anchor('caius.altar', 8, 4)
  m.anchor('caius.bed', 13, 2)
  m.regions.altar = [5, 3, 7, 3]
  return m
}

/** The hostel: cots for pilgrims, most of them empty. */
export function buildHostel(): MapBuilder {
  const m = room('waystation.hostel', "The Pilgrims' Hostel", '朝圣者客舍', 14, 9, 'wood', 'floor_wood')
  for (let i = 0; i < 5; i++) m.fixture('fixture/furniture/bed', 1 + i * 2, 1, i < 2 ? {} : { name: L('An empty cot', '一张空床') })
  m.fixture('fixture/light/fireplace', 12, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 6, 5, { name: L('The pilgrims\' book', '朝圣者名册'), tags: ['readable'], props: { text: 'Names, years, a scallop drawn beside each. The oldest pages are brown. Next to many, in the warden\'s hand: "Went east. Did not come back."', text_zh: '一个个名字、年份，每个名字旁边都画着一枚扇贝。最早的几页已经发黄。很多名字旁边，有驿站看守写的一行字："往东去了。没有回来。"' } })
  m.fixture('fixture/container/chest', 12, 6)
  m.anchor('maud.bed', 2, 2)
  m.anchor('wynn.bed', 4, 2)
  return m
}

// =================================================================== the Pilgrim's Road

export function buildWay(): MapBuilder {
  const P = PILGRIM.way
  const m = new MapBuilder('pilgrimway', L("The Pilgrim's Road", '朝圣者之路'), 'wild', P.w, P.h, 'grass', 'field', 'outdoor', 'frostfang')
  m.gearLevel = 3
  rim(m, (x, y) => (x < 4 && has(P.west, y)) || (x >= m.w - 4 && has(P.east, y)) || (y < 4 && has(P.north, x)), 4)
  for (const [cx, cy, r] of [[12, 4.5, 2.4], [22, 19, 2.6], [36, 4, 2.2], [46, 19, 2.6]] as const) clump(m, cx, cy, r, 0.7)
  m.path([[0, 12], [7, 12], [15, 13], [24, 11], [33, 12], [42, 13], [50, 12], [55, 12]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  // the way up to the abbey, north from the middle of the road
  m.path([[27, 11], [27, 6], [27, 0]], 'path', 1, { edge: 'dirt', edgeP: 0.2 })
  // the five wayside shrines, one for each suffering, along the road
  WAYSHRINES.forEach((s, i) => m.fixture(`fixture/sacred/wayshrine/${s.id}`, ...spot(m, PILGRIM.shrines[i][0], PILGRIM.shrines[i][1]), { id: `way.shrine.${s.id}` }))
  // the knight's mark: signposts bound with thorns, and white pennants, more tattered the further east they hang
  for (const [x, y, n] of [[10, 10, 0], [26, 14, 1], [44, 10, 2]] as const) {
    m.fixture('fixture/sign', ...spot(m, x, y), {
      name: L('A thorn-bound signpost', '缠着荆棘的路标'),
      props: {
        text: ['EAST: THE KINGDOM. NONE CROSS THAT DO NOT KNEEL.', 'KNEEL, AND BE SPARED.', 'HE HOLDS. KNEEL.'][n],
        text_zh: ['往东：王国。不跪者，不得过。', '跪下，便得宽恕。', '他守着。跪下。'][n],
      },
    })
    m.fixture('fixture/nature/briar', ...spot(m, x + 1, y), { name: L("The knight's thorns", '骑士的荆棘') })
  }
  for (const [x, y, n] of [[20, 9, 0], [36, 15, 1], [52, 9, 2]] as const)
    m.fixture('fixture/sign', ...spot(m, x, y), {
      name: L('A white pennant', '白色三角旗'),
      props: {
        text: ['A white pennant on a lance-shaft, stitched with a thorn ring. Clean, once; mended many times, by someone patient.', 'The same white pennant, greyer. The mending stops halfway up.', 'Rags on a shaft. Whoever mended them stopped remembering how.'][n],
        text_zh: ['一面挂在枪杆上的白色三角旗，绣着一圈荆棘。曾经很干净；被人耐心地补过许多次。', '同样的白旗，更灰了。补到一半就没再补。', '杆子上只剩几条破布。补旗的人，已经忘了怎么补。'][n],
      },
    })
  // what a pilgrim might lay at each: a fallen pilgrim's hat, a plaited cord by a post, a loaf in a bundle, an old helm, a candle at a cairn
  m.item({ form: 'item/clothing/hat', material: 'cloth', name: L("A pilgrim's hat", '朝圣者的帽子') }, ...spot(m, 9, 16))
  m.item({ form: 'item/material/grass', name: L("A penitent's plaited cord", '苦修者编的草绳') }, ...spot(m, 15, 8))
  m.item({ form: 'item/food/bread' }, ...spot(m, 25, 16))
  m.item({ form: 'item/armor/helmet', material: 'iron', name: L('A dented helm', '一顶凹陷的头盔') }, ...spot(m, 34, 9))
  m.item({ form: 'item/light/candle' }, ...spot(m, 47, 16))
  m.fixture('fixture/furniture/cart', ...spot(m, 38, 17), { name: L("An abandoned pilgrims' cart", '被丢下的朝圣者推车') })
  // the penitent's camp off the road
  m.fixture('fixture/light/campfire', ...spot(m, 33, 17), { statuses: { lit: -1 } })
  m.anchor('ezra.road', ...spot(m, 31, 14, true))
  m.anchor('ezra.camp', ...spot(m, 32, 18, true))
  m.regions.penitent = [27, 12, 9, 8]
  // the road's dangers: wolves, and the dead who walk it at night
  m.creature('beast/wolf', 21, 18, HUNT())
  m.creature('beast/wolf', 46, 6, HUNT())
  lay(m, 'item/material/stick', 2, [4, 14, 10, 6])
  m.appear = [...GROUND_YIELD, appears('actor/creature/undead/zombie', ['grass'], 2, 2400, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5 } })]
  return m
}

// =================================================================== the Abbey of the Thorn

export function buildAbbey(): MapBuilder {
  const P = PILGRIM.abbey
  const m = new MapBuilder('abbey', L('Abbey of the Thorn', '荆棘修道院'), 'wild', P.w, P.h, 'grass', 'forest', 'outdoor', 'frostfang')
  m.gearLevel = 4
  rim(m, (x, y) => y >= m.h - 4 && has(P.south, x), 4)
  m.path([[20, 29], [20, 22], [20, 15]], 'path', 2, { edge: 'dirt', edgeP: 0.3 })
  // the cloister's broken walls round a yard of weeds
  m.organic(20, 12, 13, 8, 'dirt', { only: (t) => t === 'grass', rough: 0.3 })
  m.house('longhouse', 15, 3, 'hall')
  // the abbey church: its crypt under the floor
  m.house('temple', 29, 6, 'crypt')
  for (const [x, y] of [[8, 9], [8, 13], [31, 15], [10, 17]] as const) m.set(x, y, 'rock')
  // the knights' graves, and the statue the Order kept in its yard
  const graves: [string, string][] = [
    ['SER ODO OF THE THORN. He held the gate at Varrow nine days.', '荆棘骑士奥多爵士。他在瓦罗城门坚守了九天。'],
    ['SER MAREN OF THE THORN. She carried water to the enemy wounded.', '荆棘骑士玛伦女爵士。她给敌方的伤兵送过水。'],
    ['SER TOMAS OF THE THORN, brother to the Commander. He keeps the barrow still.', '荆棘骑士托马斯爵士，团长的兄弟。他至今仍守着古墓。'],
    ['BROTHER GILES, gardener. He grew roses in the thorn yard. The roses died with him.', '吉尔斯修士，园丁。他在荆棘院里种过玫瑰。玫瑰随他一同死去。'],
  ]
  graves.forEach(([en, zh], i) => m.fixture('fixture/sacred/gravestone', ...spot(m, 9 + i * 3, 21), { name: L("A knight's grave", '骑士之墓'), props: { text: en, text_zh: zh } }))
  // (an altar's plinth: a statue would look like a waypoint's, and those are the waypoints' alone)
  m.fixture('fixture/sacred/altar', ...spot(m, 20, 11), {
    name: L('The statue in the thorn yard', '荆棘院中的雕像'),
    tags: ['readable'],
    props: { text: 'A young knight on one knee before a child, holding out a wooden horse he has mended. The face is worn smooth by hands. The plinth: ALBERIC, ON THE DAY HE WAS MADE A KNIGHT.', text_zh: '一个年轻骑士单膝跪在一个孩子面前，递出一匹修好的木马。脸已经被人摸得光滑。底座上刻着：阿尔贝里克，受封为骑士之日。' },
  })
  for (const [x, y] of [[12, 8], [27, 13], [18, 18]] as const) m.fixture('fixture/nature/briar', ...spot(m, x, y), { name: L('Thorns in the yard', '院子里的荆棘') })
  // its dead: monks who would not lie down
  m.creature('undead/skeleton', 14, 13, HUNT())
  m.creature('undead/skeleton', 26, 17, HUNT())
  m.creature('undead/ghost', 24, 9, { behaviour: 'ranged', temper: 'aggressive', sight: 6, leash: 6 })
  m.regions.yard = [10, 6, 20, 14]
  m.appear = GROUND_YIELD
  return m
}

/** The chapter hall: the Order's roll, the knights' table, and at the back a knight's narrow cell. */
export function buildAbbeyHall(): MapBuilder {
  const m = room('abbey.hall', 'The Chapter Hall', '骑士团大厅', 22, 14, 'stone', 'floor_stone', 'dungeon')
  m.gearLevel = 4
  m.fixture('fixture/furniture/table', 10, 3, {
    name: L('The Roll of the Order', '骑士团名册'),
    tags: ['readable'],
    props: { text: 'Forty names in forty hands. The last, larger, the ink still black: ALBERIC — BEARER OF THE CROWN. HE HOLDS FOR US ALL. Below it, nothing more was ever written.', text_zh: '四十个名字，四十种笔迹。最后一个写得大一些，墨迹仍旧乌黑：阿尔贝里克——持冠者。他为我们所有人坚守。在那之下，再也没有人写过任何名字。' },
  })
  for (const x of [7, 13]) m.fixture('fixture/furniture/chair', x, 3)
  for (const [x, y] of [[2, 2], [19, 2]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  m.fixture('fixture/container/bookshelf', 2, 6, { name: L("The Order's books", '骑士团的书') })
  m.fixture('fixture/furniture/rack', 5, 6, { name: L('Empty weapon racks', '空了的兵器架') })
  // his cell, in the north-east corner: a cot, a desk, his journal in four leaves
  m.fixture('fixture/furniture/bed', 18, 8, { name: L("Alberic's cot", '阿尔贝里克的小床') })
  m.fixture('fixture/furniture/table', 16, 10, { name: L("Alberic's desk", '阿尔贝里克的书桌') })
  const pages: [string, string][] = [
    ['I. Mended the miller\'s girl\'s kite today. She says knights do not mend kites. I told her this one does. — A.', '一。今天给磨坊主家的小姑娘修好了风筝。她说骑士不修风筝。我告诉她，这个骑士会。——阿'],
    ['II. They have chosen me for the Crown. The Prior says it is an honour. My brother says it is a sentence. They are both right. Forty years, and then relief. I can hold for forty years. — A.', '二。他们选了我戴冠。院长说这是荣耀。我兄弟说这是判决。他们都没说错。四十年，然后就有人来接替。我能守四十年。——阿'],
    ['III. The forty-first year. No one has come. The thorns are into the bone now. I forgot Tomas\'s face today and wept, and could not remember why I wept. — A.', '三。第四十一年。没有人来。荆棘已经扎进了骨头。今天我忘了托马斯的脸，哭了，却想不起来为什么要哭。——阿'],
    ['IV. Hold. Hold. Hold. Hold until relieved. Hold. Hold. Hold. Hold.', '四。守住。守住。守住。守到有人来接替。守住。守住。守住。守住。'],
  ]
  pages.forEach(([en, zh], i) => m.item({ form: 'item/document/letter', name: L(`Alberic's Journal, Leaf ${['I', 'II', 'III', 'IV'][i]}`, `阿尔贝里克的日记·第${['一', '二', '三', '四'][i]}页`), props: { text: en, text_zh: zh } }, ...spot(m, 14 + (i % 2) * 3, 9 + Math.floor(i / 2) * 2)))
  // the scriptorium's desk, west: the writ that should have relieved him, its seal unbroken
  m.fixture('fixture/furniture/table', 4, 10, { name: L('The scriptorium desk', '缮写室书桌') })
  m.item({ form: 'item/document/writ_of_relief' }, ...spot(m, 4, 9))
  m.creature('undead/skeleton', 10, 8, HUNT(4))
  m.regions.cell = [13, 7, 8, 5]
  return m
}

/** The crypt under the abbey's shrine: the Order's dead in their niches, and its last keeper with the seal. */
export function buildAbbeyCrypt(): MapBuilder {
  const m = new MapBuilder('abbey.crypt', L('Crypt of the Order', '骑士团地下墓室'), 'interior', 30, 20, 'cave_wall', 'cave', 'dark', 'frostfang')
  m.gearLevel = 5
  m.room('stone', 'floor_stone')
  for (let x = 1; x < m.w - 1; x++) for (const y of [6, 13]) if (x % 6 !== 3) m.set(x, y, 'wall')
  for (const [x, y] of [[4, 3], [12, 3], [20, 3], [26, 9], [6, 16]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  for (let i = 0; i < 6; i++) m.fixture('fixture/sacred/gravestone', 3 + i * 4, 17, { name: L('A niche of the Order', '骑士团的壁龛'), props: { text: 'A knight\'s niche, a thorn ring carved over it. The name has been chiselled off and cut again, smaller, lower down, as if by someone who kept forgetting.', text_zh: '一个骑士的壁龛，上方刻着一圈荆棘。名字被凿掉过，又在更低处刻了一遍，字更小，像是有人总在忘记。' } })
  m.creature('undead/skeleton', 8, 9, HUNT(4))
  m.creature('undead/ghost', 20, 9, { behaviour: 'ranged', temper: 'aggressive', sight: 5, leash: 5 })
  // the Order's last keeper: Prior Wendel, who sent the Crown east and never sent the relief
  const abbot = m.creature('undead/skeleton', 15, 3, { id: ABBOT_ID, sight: 5, leash: 5, loot: [ORDER_SEAL] })
  abbot.name = L('Prior Wendel, the Last Keeper', '最后的看守·温德尔院长')
  abbot.tags = ['boss']
  abbot.props = { hp: 90, maxHp: 90, atk: 5, def: 2, trophyChance: 0 }
  m.regions.tomb = [10, 1, 10, 5]
  return m
}

// =================================================================== the Kneeling Field

export function buildField(): MapBuilder {
  const P = PILGRIM.field
  const m = new MapBuilder('kneelfield', L('The Kneeling Field', '跪石原'), 'wild', P.w, P.h, 'grass', 'field', 'outdoor', 'frostfang')
  m.gearLevel = 4
  rim(m, (x, y) => (x < 4 && has(P.west, y)) || (x >= m.w - 4 && has(P.east, y)))
  m.path([[0, 12], [10, 12], [22, 11], [34, 12], [43, 12]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.organic(22, 12, 15, 8, 'drygrass', { only: (t) => t === 'grass', rough: 0.3 })
  // the kneeling stones: the pilgrims before you, each with a name and a year; then his "subjects", made of straw
  const names: [string, string][] = [
    ['Aelis of Varrow, pilgrim. Knelt in the 212th year of the Crown.', '瓦罗的艾莉丝，朝圣者。于持冠第二百一十二年跪下。'],
    ['Brother Hal, pilgrim. Knelt in the 240th year.', '哈尔修士，朝圣者。于第二百四十年跪下。'],
    ['Maren of the Salt Coast, pilgrim. Knelt in the 251st year. She would not stop walking.', '盐海岸的玛伦，朝圣者。于第二百五十一年跪下。她一直不肯停下脚步。'],
    ['Unnamed. A scallop and a child\'s shoe.', '无名。一枚扇贝，一只孩子的鞋。'],
    ['Odile the Smith, pilgrim. Knelt in the 263rd year.', '铁匠奥迪尔，朝圣者。于第二百六十三年跪下。'],
    ['Corin, pilgrim. Knelt in the 270th year. Sent with the blessing of the Holy See.', '科林，朝圣者。于第二百七十年跪下。奉圣座祝福而来。'],
    ['Petra and Joan, pilgrims, sisters. Knelt together.', '佩特拉与琼，朝圣者，姐妹。一同跪下。'],
    ['The latest stone. The carving is fresh. The name is not cut yet.', '最新的一块石头。刻痕还很新。名字还没刻上。'],
  ]
  names.forEach(([en, zh], i) => m.fixture('fixture/sacred/gravestone', ...spot(m, 10 + (i % 4) * 7, i < 4 ? 7 : 17), { name: L('A kneeling stone', '跪石'), props: { text: `A stone carved as a pilgrim kneeling. ${en}`, text_zh: `一块雕成朝圣者跪姿的石头。${zh}` } }))
  for (const [x, y] of [[16, 9], [18, 9], [20, 9], [26, 15], [28, 15], [30, 15]] as const)
    m.fixture('fixture/scarecrow', ...spot(m, x, y), { name: L('A kneeling subject', '跪着的"臣民"'), props: { text: 'Straw in a pilgrim\'s coat, bent at the knees and tied there with briar. Someone set them in rows, facing east, and keeps setting them straight.', text_zh: '稻草塞进朝圣者的外衣，膝盖弯着，用荆棘捆住。有人把它们排成一排排，脸朝东，还一直把它们扶正。' } })
  for (const [x, y] of [[36, 8], [37, 16], [12, 15]] as const) m.fixture('fixture/nature/briar', ...spot(m, x, y), { name: L("The knight's thorns", '骑士的荆棘') })
  m.fixture('fixture/sign', ...spot(m, 40, 10), { props: { text: 'THE KINGDOM. KNEEL.', text_zh: '王国。跪下。' } })
  m.regions.field = [6, 4, 32, 16]
  m.appear = [...GROUND_YIELD, appears('actor/creature/undead/ghost', ['drygrass'], 1, 3600, { ai: { behaviour: 'ranged', temper: 'aggressive', sight: 5 } })]
  return m
}

// =================================================================== the scenes

export const PILGRIMAGE_STORY: StepDef[] = [
  {
    // The Rest: the Church's priest has been waiting for the pilgrim the letter named.
    id: 'rest_arrival',
    when: { map: 'waystation', facts: { [CH1.letter]: 1 } },
    script: [
      say('npc.caius', 'A pilgrim, at last — and with a fairy, as the letter said. Welcome to the Rest. I am Father Caius; the Holy See keeps me here to send the pilgrims on.', '终于来了一位朝圣者——还带着精灵，正如信上所说。欢迎来到驿站。我是凯乌斯司铎；圣座派我驻守在这里，送朝圣者上路。', 'happy'),
      say('npc.caius', 'Before the road, the oath. Come to the chapel and kneel at the five wounds. A pilgrim who has not knelt does not reach the First Seal-bearer.', '上路之前，先立誓。到礼拜堂来，在五道圣伤前跪下。没跪过的朝圣者，到不了第一持印者面前。'),
      say('pip', 'Kneel again? Everyone out here wants someone to kneel.', '又要跪？这边的人好像都想让别人跪下。', 'shy'),
      { fact: PILGRIMAGE.arrived, value: 1 },
    ],
  },
  {
    // The oath: at the altar of the five wounds, the priest takes the pilgrim through the Five.
    id: 'pilgrim_oath',
    when: { map: 'waystation.chapel', region: 'altar', after: 'rest_arrival' },
    script: [
      say('npc.caius', 'Kneel. — Say after me. The first suffering: the Crown. He let them press the thorns into his brow, and did not lift his hand.', '跪下。——跟着我念。第一苦：戴冠。他任由荆棘刺进额头，没有抬手。'),
      say('npc.caius', 'The second: the Scourge. Bound to the pillar, he bled for every one of us. The third: Hunger. On the scales his flesh grew lighter than sin.', '第二苦：受鞭。他被绑在刑柱上，为我们每一个人流血。第三苦：受饥。在天平上，他的肉身变得比罪还轻。'),
      say('npc.caius', 'The fourth: the Nails, that he might not leave us. The fifth: the Lance. When it pierced his heart, the sun rose.', '第四苦：受钉，好让他不离开我们。第五苦：受枪。圣枪刺穿他心口的那一刻，太阳升起了。'),
      say('npc.caius', 'Five shrines stand on the road east, one for each. Light them as you go — lay at each what its suffering asks. Then the abbey, then the knight.', '往东的路上有五座圣龛，一苦一座。走一路，点一路——在每座龛上放下它那一苦要的东西。然后是修道院，然后是骑士。'),
      say('npc.caius', 'The Seal-bearer has held that road three hundred years. Kneel to him if you must; he will spare you. ...He was due relief, once. That is not a pilgrim\'s concern.', '那位持印者守着那条路已经三百年了。必要的话就向他下跪，他会放过你的。……他本该有人去接替。那不是朝圣者该操心的事。', 'sad'),
      say('pip', '"Was due relief"? What does that mean? — He went quiet. I don\'t like it when grown-ups go quiet.', '"本该有人接替"？那是什么意思？——他不说话了。我不喜欢大人突然不说话。', 'surprised'),
      { fact: PILGRIMAGE.oath, value: 1 },
    ],
  },
  // ---- the Church's answer to one's faith (content faith.ts): blessed by its priest, or watched by the Grey Man
  {
    // The devout: the priest sees one who prays as if it mattered, and gives what the Church gives its own.
    id: 'caius_blessing',
    when: { map: 'waystation', after: 'pilgrim_oath', props: { faith: { gte: FAITH.devout } } },
    script: [
      say('npc.caius', 'You pray as if someone were listening. Few do, this far east. — Here. Holy water from the See; the dead on the road do not like it.', '你祈祷的样子，像是真有谁在听。到了这么东边，很少有人这样了。——拿着。圣座的圣水；路上那些死人不喜欢它。', 'happy'),
      { give: 'item/vessel/flask/holy_water', count: 2 },
      say('npc.caius', 'And one thing more, since you keep the faith. The abbey kept its letters in the hall. If you find the writ of relief... bring me word of what it says. I was told not to ask.', '还有一件事，既然你守着信仰。修道院的信件都收在大厅里。要是你找到那份替任文书……告诉我上面写了什么。他们叫我别问。', 'sad'),
      { fact: CHURCH.blessed, value: 1 },
    ],
  },
  {
    // The unbeliever: word of it has reached the Rest before them.
    id: 'caius_cold',
    when: { map: 'waystation', after: 'pilgrim_oath', props: { faith: { lte: FAITH.doubter } } },
    script: [
      say('npc.caius', 'They tell me you say there are no gods. On the road to the Seal-bearer, with the Church\'s letter in your bag.', '有人告诉我，你到处说世上没有神。走在去见持印者的路上，包里还揣着教会的信。', 'angry'),
      say('npc.caius', 'Go on, then. But the Rest\'s blessing is for pilgrims, and I will not pretend you are one.', '那你就走吧。但驿站的祝福是给朝圣者的，我不会假装你是其中之一。'),
      say('pip', 'He\'s not wrong that you said it. ...He\'s wrong that it makes you not one, though.', '你确实说过那话，这点他没说错。……但他说你因此就不算朝圣者，这就错了。', 'shy'),
      { fact: CHURCH.shunned, value: 1 },
    ],
  },
  {
    // The Grey Man finds one who has stopped believing the Church: he has things to say to such a pilgrim.
    id: 'grey_man_doubter',
    when: { map: 'pilgrimway', after: 'way_first', props: { faith: { lte: FAITH.doubter } } },
    script: [
      { place: 'npc.severin', map: 'pilgrimway', x: 44, y: 12 },
      say('npc.severin', 'You stopped kneeling. Good. Then you can hear this without your Church\'s hand over your ears.', '你不再下跪了。很好。那你就能不被教会捂着耳朵，听我说完。'),
      say('npc.severin', 'Those shrines are not prayers. They are a cage\'s bars, counted out loud. Five sufferings, five seals, five bearers. Ask who decided the bearers would suffer.', '那些圣龛不是祈祷。那是笼子的栏杆，被一根根念出来。五种苦难，五道印，五位持印者。去问问是谁决定让持印者受苦的。'),
      say('npc.severin', 'When you reach the abbey, read what they kept back. Then decide whose road this is.', '到了修道院，读一读他们扣下的东西。然后再决定这是谁的路。'),
      { move: 'npc.severin', x: 54, y: 12 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: CHURCH.greyman, value: 1 },
    ],
  },
  {
    // First onto the Pilgrim's Road: the knight's mark on every signpost.
    id: 'way_first',
    when: { map: 'pilgrimway' },
    say: L('Thorns tied round the signposts, and white flags. Somebody looked after these flags once. Somebody stopped.', '路标上都缠着荆棘，还挂着白旗。以前有人很用心地照顾这些旗子。后来那个人停下了。'),
  },
  {
    // The penitent on the road: suffering as the Church teaches it, taken on oneself.
    id: 'penitent',
    when: { map: 'pilgrimway', region: 'penitent' },
    script: [
      say('npc.ezra', '(A man kneels by the road, his back bare, a cord in his hand. He strikes himself once, steadily, and looks up.)', '（路边跪着一个人，脊背裸露，手里攥着一根绳。他稳稳地抽了自己一下，抬起头。）'),
      say('npc.ezra', 'Don\'t be frightened, pilgrim. Every stroke I take is one Astra need not. The Seal-bearers bear his pain; we small ones bear a little of theirs.', '别害怕，朝圣者。我每挨一下，阿斯特拉就少挨一下。持印者替他承受痛苦；我们这些小人物，就替他们分一点。'),
      say('npc.ezra', 'I went as far as the field of stones, once. The knight was mending a flag. He saw me and his hands stopped — like he had forgotten what hands were for. Then he told me to kneel.', '我曾经走到过跪石原。那位骑士正在补一面旗子。他看见我，手就停了——像是忘了手是用来做什么的。然后他让我跪下。'),
      say('pip', 'That\'s horrible. ...Not the hitting. The flag.', '好可怕。……不是打自己那件事。是那面旗子。', 'sad'),
    ],
  },
  {
    // The five shrines lit: the road answers, and the way to the abbey shows itself.
    id: 'shrines_lit',
    when: { map: 'pilgrimway', facts: Object.fromEntries(WAYSHRINES.map((s) => [shrineFact(s.id), 1])) },
    script: [
      say('player', '(The fifth carving kindles. All along the road, the five small lights burn at once — and the path north, up to the abbey, is suddenly plain to see.)', '（第五道刻痕亮了起来。整条路上，五点小小的光同时亮起——往北通向修道院的小路一下子清晰了。）'),
      say('pip', 'The crown one is the coldest. I touched it and it touched back. — Up there: the abbey where the knights lived. The priest said that\'s next.', '荆棘冠那座最冷。我碰了它一下，它也"碰"了我一下。——上面那里：骑士们住过的修道院。司铎说下一站就是那儿。', 'shy'),
      { fact: PILGRIMAGE.shrines, value: 1 },
    ],
  },
  {
    // The abbey's yard: the statue of the young knight.
    id: 'abbey_yard',
    when: { map: 'abbey', region: 'yard' },
    say: L('A knight kneeling to a little kid, giving back a toy horse... That\'s HIM? The White Knight? He used to kneel to people?', '一个骑士跪在小孩面前，把木马还给他……那是他？白骑士？他以前会向别人下跪？'),
  },
  {
    // His cell: the journal, leaf by leaf.
    id: 'alberic_cell',
    when: { map: 'abbey.hall', region: 'cell' },
    say: L('His bed is so small. — There are pages on the desk. Read them... no, I\'ll read them with you. I don\'t want to read them alone.', '他的床好小。——书桌上有几页纸。读读看……不，我陪你一起读。我不想一个人读。'),
  },
  {
    // The writ: the relief that was promised, and kept back.
    id: 'writ_found',
    when: { carrying: WRIT },
    script: [
      say('player', '(The writ of relief. Forty years, and a successor sent. The wax is whole: it was never sent. On the back: "No successor could be found who would bear it. Let him hold. He will not know the difference.")', '（替任文书。四十年，另遣继任者。封蜡完好：它从未寄出。背面写着："寻不到愿意承受的继任者。让他继续守着吧。他不会察觉其中分别。"）'),
      say('pip', 'They promised him. Forty years, and then someone would come. And then they just... didn\'t. And he\'s still out there, holding.', '他们答应过他的。四十年，然后会有人来。然后他们就……没来。而他还在那里，守着。', 'sad'),
      say('pip', '"He will not know the difference." He knows. He wrote it in his diary. He knows.', '"他不会察觉其中分别。"他察觉了。他写在日记里了。他知道的。', 'angry'),
      { fact: PILGRIMAGE.writ, value: 1 },
    ],
  },
  {
    // The crypt: the last keeper rises.
    id: 'crypt_keeper',
    when: { map: 'abbey.crypt', region: 'tomb' },
    script: [
      say(ABBOT_ID, 'Who... comes for the seal? The Crown went east. The relief stays here. We hold, that others need not. We HOLD.', '是谁……来取印章？荆冠已经往东去了。替任留在这里。我们坚守，好让别人不必。我们——坚守。', 'angry'),
      say('pip', 'He\'s the one who kept the writ! Careful — he\'s not going to give it up nicely.', '就是他扣下了文书！小心——他不会好好交出来的。', 'angry'),
    ],
  },
  {
    // The Order's seal in hand: the thorns of the kingdom will know it.
    id: 'order_seal',
    when: { carrying: ORDER_SEAL },
    script: [
      say('player', '(A bronze seal: a knight kneeling, not to a lord — to a child. Around the rim: WE HOLD, THAT OTHERS NEED NOT. It is warm, as if someone had held it all this time.)', '（一枚青铜印章：一个骑士单膝跪着——不是对领主，而是对一个孩子。边缘刻着：我们坚守，好让别人不必。它是温的，好像一直有人握着它。）'),
      say('pip', 'Maybe if he sees this, he\'ll remember. Not the holding. The kneeling. The good kind.', '也许他看到这个，就能想起来。不是"守住"。是"跪下"——好的那种跪。', 'shy'),
      { fact: PILGRIMAGE.seal, value: 1 },
    ],
  },
  {
    // The Kneeling Field: the pilgrims before you.
    id: 'kneelfield_arrival',
    when: { map: 'kneelfield' },
    script: [
      say('player', '(Stones carved as kneeling pilgrims, row on row, each with a name and a year. Between them, straw men in pilgrims\' coats, tied on their knees, all facing east.)', '（一排又一排被雕成跪姿的朝圣者石像，每块都刻着名字和年份。石像之间，是穿着朝圣者外衣的稻草人，被捆着跪在地上，全都面朝东方。）'),
      say('pip', 'Aelis. Hal. Maren. Corin — "sent with the blessing of the Holy See"... They sent all of them. Before us. And the newest stone doesn\'t have a name yet.', '艾莉丝。哈尔。玛伦。科林——"奉圣座祝福而来"……他们把这些人都派来过。在我们之前。最新的那块石头，还没有刻名字。', 'sad'),
      say('pip', 'It\'s not for us. ...It\'s not for us, right?', '那不是给我们的。……不是给我们的，对吧？', 'shy'),
      { fact: PILGRIMAGE.field, value: 1 },
    ],
  },
  {
    // The Kneeling Field to the devout: the Church's own blessing on these stones.
    id: 'kneelfield_devout',
    when: { map: 'kneelfield', after: 'kneelfield_arrival', props: { faith: { gte: FAITH.devout } } },
    say: L('"Sent with the blessing of the Holy See." ...You prayed the same prayers they did. Did they think someone was listening, too?', '"奉圣座祝福而来。"……你念的祷词和他们一模一样。他们当时也以为有人在听吗？'),
  },
  {
    // The Kneeling Field to the unbeliever: no god asked this of them.
    id: 'kneelfield_doubter',
    when: { map: 'kneelfield', after: 'kneelfield_arrival', props: { faith: { lte: FAITH.doubter } } },
    say: L('You said there are no gods. Then nobody asked this of them. Somebody just... sent them. That\'s worse. That\'s so much worse.', '你说过世上没有神。那就是说，没有谁要求他们这样做。只是有人……把他们派来了。那更糟。糟糕得多。'),
  },
]
void ALBERIC_ID
