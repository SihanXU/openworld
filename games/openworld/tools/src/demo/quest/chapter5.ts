// Chapter 5, the Fifth Seal (docs/chapter-5.md; content chapter5.ts): the White Altar Heights up the road west from
// Nailgate — its maps, the places its people keep, and the chapter's scenes. The White Stair, three shelves of chalk climbed
// by switchbacks, a white robe hung on a pole over every grave beside it; Whiteveil Abbey on the summit, its church, its
// robing house where the roll is kept and a robe is being sewn to the pilgrim's measure; the catacombs under the church,
// the white-robed in their niches, Cassian's niche empty, the oldest niche the second's; and beneath the altar, behind
// the fog, the Witnesses round the Lance.

import type { AiData, StepDef } from '@openworld/engine'
import { CH5, FINALE, HOLY_LANCE, LANCE_ALTAR, NICHE, NICHE_EMPTY, ROAD_PASS, ROBED_KNEELING, ROBED_SLEEPER, ROBE_POLE, SEWING_FRAME, WITNESSES_CAMPAIGN, WITNESSES_ID, createBoss } from '@openworld-game/content'
import { MapBuilder, rng, type Cell } from '../builder.ts'
import { L, levelCreatures } from '../kit.ts'
import { home } from '../village.ts'
import type { Place } from '../continent/generate.ts'
import { planHall, glow, lit } from '../showcase/halls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { parterre, unshut } from '../showcase/dress.ts'
import { glowAt, stair } from '../showcase/ground.ts'
import { linkStair } from '../showcase/rooms.ts'
import { pave } from '../showcase/street.ts'
import { noise, seal, ways } from './country.ts'
import { spot } from './chapter2.ts'

/** Edge openings: the road in from Nailgate (east, at the foot), up to the abbey (the stair's north edge, the abbey's south). */
export const HEIGHTS = {
  stair: { w: 40, h: 40, east: [33, 34], north: [18, 19] },
  abbey: { w: 46, h: 36, south: [22, 23], east: [20, 21] },
  floor: { w: 30, h: 30 },
} as const

/** Where the scenes stage their people. */
export const CH5_AT = {
  arrival: { severin: [36, 32] as Cell },
  hermit: { ysolde: [9, 24] as Cell, severin: [12, 24] as Cell },
  roll: { severin: [12, 6] as Cell, agathe: [22, 5] as Cell },
  niches: { severin: [12, 4] as Cell },
  // (one comes in out of the Witnesses' sight)
  floor: { arrive: [14, 26] as Cell, witnesses: [14, 15] as Cell, altar: [14, 5] as Cell, severin: [9, 7] as Cell, gate: [[14, 28], [15, 28]] as Cell[] },
  bells: { severin: [24, 19] as Cell, benedek: [21, 18] as Cell },
} as const

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })
const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })
/** The Heights as a place, for the halls on a plan. */
const ALTAR_PLACE = { id: 'whiteveil', name: L('Whiteveil Abbey', '白纱修道院'), region: 'altar', kind: 'temple', x: 12, y: 26, seed: 4501 } as unknown as Place

function altarHall(key: Parameters<typeof planHall>[1], id: string, en: string, zh: string, floor: string, opts: Parameters<typeof planHall>[5] = {}) {
  const { m, P } = planHall(ALTAR_PLACE, key, id, L(en, zh), floor, opts)
  m.backdrop = false
  return { m, P }
}

/** A grave beside the way, a white robe on a pole over it. */
function robedGrave(m: MapBuilder, x: number, y: number, name: [string, string]): void {
  const at = spot(m, x, y)
  m.fixture(ROBE_POLE, ...at)
  const below = spot(m, at[0], at[1] + 1)
  m.fixture('fixture/sacred/gravestone', ...below, { props: { text: `${name[0]}, PILGRIM. FELL ON THE STAIR. CARRIED UP.`, text_zh: `${name[1]}，朝圣者。倒于石阶。已抬上山。` } })
}

// =================================================================== the White Stair

/** The shelves of chalk (half levels): the foot where the road comes in, the heath, the top under the abbey. */
const FOOT = 0
const MID = 4
const TOP = 8

/**
 * The White Stair: the road up out of the fens into the Heights, three shelves of white chalk climbed by switchbacks. The
 * road comes in at the foot from the east, runs west under the first face, climbs, runs back east along the heath where a
 * hermit keeps her cell against the cliff, climbs again, and goes up north to the abbey's gate. Beside the way, every few
 * steps, a white robe hung on a pole over a grave: the pilgrims who died climbing it.
 */
export function buildWhiteStair(): MapBuilder {
  const P = HEIGHTS.stair
  const m = new MapBuilder('whitestair', L('The White Stair', '白阶'), 'wild', P.w, P.h, 'grass', 'field', 'outdoor', 'altar')
  m.gearLevel = 17
  m.raise(0, 0, P.w, 14, TOP)
  m.raise(0, 14, P.w, 13, MID)
  m.raise(0, 27, P.w, P.h - 27, FOOT)
  for (let y = 0; y < P.h; y++)
    for (let x = 0; x < P.w; x++) {
      const n = noise(x, y, 5, 951)
      if (n > 0.55) m.set(x, y, 'drygrass')
      else if (n < 0.05) m.set(x, y, 'flowers')
    }
  // the switchbacks: in at the foot from the east, west under the first face, up; east along the heath, up; north to the gate
  stair(m, 5, 27, 2, MID, FOOT, 'path')
  stair(m, 32, 14, 2, TOP, MID, 'path')
  m.path([[P.w - 1, 33], [24, 34], [12, 33], [6, 31]], 'path', 2)
  m.path([[6, 25], [14, 22], [24, 20], [33, 18]], 'path', 2)
  m.path([[33, 12], [26, 9], [20, 5], [18, 0]], 'path', 2)
  // the robes over the graves beside the way
  const NAMES: [string, string][] = [['ALDA OF RIME', '霜港的阿尔达'], ['HUGH THE TANNER', '皮匠休'], ['MARTEN', '马滕'], ['A WOMAN OF THE VALE', '衡谷的一个女人'], ['BROTHER OSWIN', '奥斯温修士'], ['IDA', '伊达'], ['NO NAME GIVEN', '未留姓名'], ['GARRET OF THE MARCH', '边境的加雷特'], ['TWO SISTERS', '两姐妹'], ['WULF', '伍尔夫']]
  const GRAVES: Cell[] = [[30, 31], [20, 32], [14, 31], [9, 23], [18, 20], [27, 18], [30, 10], [23, 7], [16, 3], [36, 36]]
  GRAVES.forEach(([x, y], i) => robedGrave(m, x, y, NAMES[i]))
  // the hermit's cell against the summit's face, on the heath
  m.building('altar_cell_1', 8, 14)
  m.fixture('fixture/light/candles', ...spot(m, 11, 15), lit)
  // chalk boulders, a few trees bent by the wind
  for (const [x, y] of [[3, 36], [26, 37], [36, 22], [4, 17], [37, 4], [8, 6]] as Cell[]) m.fixture('fixture/nature/boulder', ...spot(m, x, y))
  for (const [x, y] of [[2, 30], [38, 28], [2, 8], [28, 2], [37, 15]] as Cell[]) if (m.free(x, y)) m.set(x, y, 'tree')
  // a statue where the road comes in at the foot
  m.fixture('fixture/sacred/waypoint', ...spot(m, 34, 31), { id: 'wp.whitestair', name: L('White Stair statue', '白阶传送雕像') })
  // the people's places (people/ysolde.ts)
  m.anchor('ysolde.cell', ...spot(m, 9, 16, true))
  m.regions.arrival = [28, 28, 12, 12]
  m.regions.heath = [4, 15, 14, 11]
  // what keeps the stair: white wolves, and a restless one by night
  m.creature('beast/frost_wolf', ...spot(m, 22, 36, true), HUNT())
  m.creature('beast/frost_wolf', ...spot(m, 30, 24, true), HUNT())
  m.creature('beast/frost_wolf', ...spot(m, 10, 6, true), HUNT())
  m.creature('undead/ghost', ...spot(m, 35, 8, true), HUNT(4))
  seal(m, ways(m, { east: P.east, north: P.north }), 'rock')
  levelCreatures(m)
  return m
}

// =================================================================== Whiteveil Abbey

/** The abbey's buildings (their footprints' top-left). */
const ABBEY = { church: [17, 3] as Cell, robing: [31, 6] as Cell, cells: [3, 6] as Cell, garth: [14, 12, 18, 8] as const }

/**
 * Whiteveil Abbey: the summit's monastery, white chalk walls and slate. The way comes up from the stair at the south into a
 * walled close: the church at its head (its altar over the catacombs), the robing house east where the brothers keep the
 * roll and Sister Agathe sews, the cells west; the garth in the middle round its well; the brothers' own graves on the
 * east edge, where the robes of those carried up hang on their poles.
 */
export function buildWhiteveil(): MapBuilder {
  const P = HEIGHTS.abbey
  const m = new MapBuilder('whiteveil', L('Whiteveil Abbey', '白纱修道院'), 'village', P.w, P.h, 'grass', 'temple', 'outdoor', 'altar')
  m.zone = 'peaceful'
  m.raise(0, 0, P.w, P.h, 8)
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (noise(x, y, 5, 961) > 0.74) m.set(x, y, 'drygrass')
  const [cx, cy] = ABBEY.church
  m.building('altar_chapel', cx, cy, ['church'], true)
  const [rx, ry] = ABBEY.robing
  m.building('altar_hall', rx, ry, ['robing'], true)
  const [lx, ly] = ABBEY.cells
  m.building('altar_cells', lx, ly, ['cells'], true)
  // the garth: four beds round the well, the walks between
  const [gx, gy, gw, gh] = ABBEY.garth
  m.rect(gx, gy, gw, gh, 'flagstone')
  parterre(m, gx + 1, gy + 1, 7, 3)
  parterre(m, gx + 10, gy + 1, 7, 3)
  m.fixture('fixture/water/well', gx + 8, gy + 5)
  for (const [x, y] of [[gx + 1, gy + 6], [gx + 16, gy + 6]] as Cell[]) m.fixture('fixture/garden/bench', x, y)
  for (const d of ['church', 'robing', 'cells']) {
    const [x, y] = m.doors[d]
    m.path([[x, y + 1], [x, gy]], 'flagstone', 1)
  }
  pave(m, HEIGHTS.abbey.south[0], gy + gh, 2, P.h - gy - gh, 'flagstone')
  // the road down to the Holy City, out of the close's east side (opened by the chapter's end)
  pave(m, gx + gw, HEIGHTS.abbey.east[0], P.w - gx - gw, 2, 'flagstone')
  // the brothers' graves, and the robes over the pilgrims' who were carried up
  for (let k = 0; k < 10; k++) m.fixture('fixture/sacred/gravestone', 35 + (k % 5) * 2, 18 + Math.floor(k / 5) * 3, { props: { text: 'A brother of Whiteveil. He carried them down, and was carried.', text_zh: '白纱修道院的一位修士。他抬过他们下去，后来也被人抬了下去。' } })
  for (const [x, y] of [[36, 25], [40, 25], [44, 22], [34, 28]] as Cell[]) m.fixture(ROBE_POLE, ...spot(m, x, y))
  m.fixture('fixture/sacred/cross', 39, 16)
  for (const [x, y] of [[gx - 1, gy], [gx + gw, gy]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'night', 0.4)
  }
  // the close's wall round it, open at the gate
  for (const [x, y] of [[2, 30], [10, 32], [36, 32], [43, 30]] as Cell[]) m.fixture('fixture/nature/boulder', ...spot(m, x, y))
  for (const [x, y] of [[2, 2], [43, 3], [4, 20], [42, 12], [8, 28]] as Cell[]) if (m.free(x, y)) m.set(x, y, 'tree')
  // the people's places (people/benedek.ts, agathe.ts, tomas.ts, severin.ts)
  m.anchor('benedek.garth', ...spot(m, gx + 8, gy + 7, true))
  m.anchor('tomas.graves', ...spot(m, 38, 22, true))
  m.anchor('severin.garth', ...spot(m, gx + 14, gy + 7, true))
  m.regions.close = [0, 0, P.w, P.h]
  unshut(m)
  seal(m, ways(m, { south: P.south, east: P.east }), 'rock')
  return m
}

/** The church: the altar over the catacombs, the pews, the statues of the martyrs, the stair down in the east chapel. */
export function buildAbbeyChurch(): MapBuilder {
  const { m, P } = altarHall('chapel', 'whiteveil.church', 'The Church of Whiteveil', '白纱修道院教堂', 'marble', { music: 'temple', floors: [['apse', 'floor_stone']] })
  const N = P.nave
  const A = P.apse
  m.rect(N.x + 9, A.y, 2, N.y + N.h - A.y + 3, 'carpet_royal')
  m.fixture('fixture/sacred/altar/high', A.x + 3, A.y, { name: L('The altar of Whiteveil', '白纱修道院的祭坛'), tags: ['readable'], props: { text: 'A high altar of white stone. Carved round its foot, many figures in robes lie side by side with their faces covered. Over them: THEY WERE TOLD TO REST YET A LITTLE WHILE.', text_zh: '一座白石砌的高祭坛。坛脚四周刻着许多穿袍子的人，脸盖着，并排躺着。他们上方刻着：他们被吩咐再安息片时。' } })
  for (const [x, y] of [[A.x + 1, A.y], [A.x + 6, A.y]] as Cell[]) m.fixture('fixture/light/candelabrum', x, y, lit)
  for (const [x, y] of [[A.x, A.y + 1], [A.x + 7, A.y + 1]] as Cell[]) m.fixture('fixture/sacred/statue/martyr', x, y)
  for (const y of [N.y + 2, N.y + 5, N.y + 8]) for (const x of [N.x + 2, N.x + 13]) m.fixture('fixture/furniture/pew', x, y)
  m.fixture('fixture/light/candles', P.chapelW.x + 1, P.chapelW.y, lit)
  const E = P.chapelE
  m.doors.down = [E.x + 1, E.y + 1]
  glow(m, A.x + 4, A.y + 1.5, 10, 4, '#ffe2a0', 0.45)
  m.anchor('benedek.altar', ...spot(m, N.x + 10, A.y + 2, true))
  return m
}

/** The robing house: the roll on its lectern, Sister Agathe's frame and the robe on it, the abbot's desk and his road passes. */
export function buildRobingHouse(): MapBuilder {
  const { m, P } = altarHall('abhall', 'whiteveil.robing', 'The Robing House', '白袍房', 'floor_stone', { floors: [['cell', 'floor_wood'], ['scriptorium', 'floor_wood']] })
  const H = P.hall
  const C = P.cell
  const S = P.scriptorium
  m.fixture('fixture/furniture/bookstand', H.x + 5, H.y + 1, {
    id: 'whiteveil.roll',
    name: L('The Roll of the White-Robed', '白袍名册'),
    tags: ['readable'],
    props: { text: 'A roll as long as the room, wound on two staves. Names, four hundred years of them, each with a year of the Five and where they fell: "the March", "the Vale", "the Fens", "under the knight". Some say "came to the Hall, could not bear it". At its head, in the oldest hand: THE ROAD CHOOSES. WHOEVER BRINGS DOWN THE FIVE AND BEARS THEIR POWER IS THE ONE THE RITE NEEDS: A BEARER NEW. ALL WHO FALL SHALL BE ROBED AND REST YET A LITTLE WHILE.', text_zh: '一卷和屋子一样长的名册，卷在两根轴上。四百年的名字，每个名字后面写着五苦纪年和倒下的地方：“边境”“衡谷”“林沼”“骑士麾下”。有些写着：“至大殿，不能承受。”卷首是最古老的笔迹：道路自会拣选。凡能击倒五者、承其力者，即大礼所需之人：一位新的承担者。凡倒下者，皆着白袍，再安息片时。' },
  })
  m.fixture(SEWING_FRAME, H.x + 9, H.y + 2, { id: 'whiteveil.frame' })
  for (const x of [H.x + 2, H.x + 8]) m.fixture('fixture/furniture/bench', x, H.y + 6)
  for (let x = S.x; x < S.x + S.w; x += 2) m.fixture('fixture/container/bookcase', x, S.y)
  m.fixture('fixture/furniture/desk', C.x + 2, C.y + 1, { name: L("The abbot's desk", '院长的书桌') })
  m.item({ form: ROAD_PASS }, ...spot(m, C.x + 3, C.y + 2, true)).id = 'quest.tomas.pass'
  m.fixture('fixture/furniture/bed', C.x + 4, C.y + 4, { name: L("The abbot's cot", '院长的小床') })
  m.fixture('fixture/container/chest', C.x, C.y + 4, { name: L('A chest of white cloth', '一箱白布') })
  for (const x of [H.x, H.x + H.w - 1]) m.fixture('fixture/light/candelabrum', x, H.y, lit)
  glow(m, H.x + 5.5, H.y + 3, 12, 6, '#ffe8b0', 0.3)
  m.anchor('agathe.frame', ...spot(m, H.x + 9, H.y + 3, true))
  m.anchor('benedek.desk', ...spot(m, C.x + 2, C.y + 2, true))
  m.anchor('benedek.bed', ...spot(m, C.x + 4, C.y + 5, true))
  m.regions.desk = [C.x, C.y, C.w, C.h]
  m.regions.roll = [H.x, H.y, H.w, H.h]
  return m
}

/** The brothers' cells: four cots, Agathe's and Tomas's among them. */
export function buildAbbeyCells(): MapBuilder {
  return home('whiteveil.cells', "The Brothers' Cells", '修士居室', 4, 'stone')
}

// =================================================================== the catacombs

/**
 * The catacombs of the Witnesses under Whiteveil's church: galleries cut in the chalk, the white-robed in their niches on
 * every side, murmuring under their cloths. On the west gallery, an empty niche kept swept for a pilgrim who never came;
 * in the east tomb, the oldest niche of all, empty too. At the head of the north gallery, the fog: beneath the altar.
 */
export function buildCatacombs(): MapBuilder {
  const { m, P } = altarHall('catacombs', 'catacombs', 'The Catacombs of the Witnesses', '万证墓窟', 'floor_stone', { music: 'crypt', light: 'dark', outside: false, floors: [['tombW', 'marble'], ['tombE', 'marble']] })
  m.gearLevel = 18
  m.zone = 'combat'
  const No = P.north
  const So = P.south
  const We = P.west
  const Ea = P.east
  // the niches along every gallery, the white-robed in them
  for (let x = No.x; x < No.x + No.w; x++) if (x !== No.x + 11 && x !== No.x + 12) m.fixture(NICHE, x, No.y)
  for (let x = So.x; x < So.x + So.w; x++) if (x < P.entry.x - 1 || x > P.entry.x + P.entry.w) m.fixture(NICHE, x, So.y + So.h - 1)
  for (let y = We.y; y < We.y + We.h; y++) if (y !== We.y + 3) m.fixture(NICHE, We.x, y)
  for (let y = Ea.y; y < Ea.y + Ea.h; y++) m.fixture(NICHE, Ea.x + Ea.w - 1, y)
  // Cassian's, on the west gallery: empty, swept
  m.fixture(NICHE_EMPTY, We.x, We.y + 3, {
    id: 'catacombs.cassian',
    props: { for: 'cassian', text: 'An empty niche, swept clean. The plate under it: CASSIAN OF FIRSTLIGHT. THE 380TH YEAR. NOT YET BROUGHT.', text_zh: '一个空着的壁龛，扫得干干净净。下面的铭牌：初原村的卡西安。三百八十年。尚未带来。' },
  })
  m.regions.cassian = [We.x, We.y, We.w + 1, We.h]
  // the oldest, in the east tomb: empty too
  const T = P.tombE
  m.fixture(NICHE_EMPTY, T.x + 2, T.y, {
    id: 'catacombs.second',
    props: { for: 'second', text: 'The oldest niche, its chalk gone yellow. It is empty. The plate is worn almost smooth: LU—, THE SECOND. SHE TOOK UP THE FIVE IN THE FOURTH YEAR OF THE FIVE AND BORE THEM A NIGHT AND A DAY. THE NIGHT WENT OUT OF HER, AND SHE WENT SMALL.', text_zh: '最古老的一个壁龛，白垩已经发黄。龛里是空的。铭牌几乎磨平了：露——，第二位。她于五苦四年承受五苦，承受了一夜一日。原夜从她身上退去，她变小了。' },
  })
  for (const x of [T.x, T.x + 4]) m.fixture('fixture/light/candles', x, T.y, lit)
  glow(m, T.x + 2.5, T.y + 1.5, 5, 3, '#ffe2a0', 0.45)
  m.fixture('fixture/sacred/tomb', P.tombW.x + 2, P.tombW.y, { props: { text: 'A plain stone box. Carved on it: THE FIRST OF WHITEVEIL, WHO WAS TOLD TO KEEP THEM.', text_zh: '一具素面石棺。上面刻着：白纱修道院的第一人，受命看守他们。' } })
  for (const [x, y] of [[No.x, No.y + 1], [No.x + No.w - 1, No.y + 1], [So.x, So.y], [So.x + So.w - 1, So.y]] as Cell[]) {
    m.fixture('fixture/light/candles', x, y, lit)
    glow(m, x + 0.5, y + 0.5, 4, 3, '#ffb35c', 0.35)
  }
  // the fog at the head of the north gallery: beneath the altar
  const fogs: Cell[] = [[No.x + 11, No.y], [No.x + 12, No.y]]
  fogs.forEach(([x, y], i) => {
    const [ix, iy] = CH5_AT.floor.gate[i]
    m.portal(x, y, 'beneathaltar', ix, iy - 2, L('Beneath the Altar', '坛下'))
    m.fixture('fixture/fog', x, y, { name: L("The altar's fog", '坛下的雾门'), props: { boss: 'witnesses', interior: 'beneathaltar', interiorX: ix, interiorY: iy - 2 } })
  })
  // the restless among them, up and wandering
  for (const [x, y] of [[No.x + 4, No.y + 2], [No.x + 19, No.y + 2], [P.spine.x + 1, P.spine.y + 4], [So.x + 6, So.y + 1]] as Cell[]) m.creature('undead/ghost', ...spot(m, x, y, true), HUNT(4))
  m.fixture('fixture/sacred/waypoint', ...spot(m, P.entry.x + 2, P.entry.y), { id: 'wp.catacombs', name: L('Catacombs statue', '墓窟传送雕像') })
  m.anchors = { stair: [P.entry.x + 1, P.entry.y + 1] }
  m.regions.galleries = [No.x, No.y, No.w, No.h + 1]
  levelCreatures(m)
  return m
}

// =================================================================== Beneath the Altar

/**
 * Beneath the Altar (docs/boss-rooms.md): the vault under Whiteveil's church, behind the catacombs' fog. A floor of white
 * stone; at its head the altar with the Lance standing in it under a faint ring of light; round it, heaped on the floor in
 * their hundreds, the white-robed, their lips moving under their cloths. The Witnesses rise from the heap.
 */
export function buildBeneathAltar(): MapBuilder {
  const P = HEIGHTS.floor
  const m = new MapBuilder('beneathaltar', L('Beneath the Altar', '坛下'), 'field', P.w, P.h, 'marble', 'ruins', 'dark', 'altar')
  m.gearLevel = 18
  for (let y = 0; y < P.h; y++)
    for (let x = 0; x < P.w; x++) {
      if (x < 2 || y < 2 || x >= P.w - 2 || y >= P.h - 1) m.set(x, y, 'cave_wall')
      else if (Math.hypot(x + 0.5 - 15, y + 0.5 - 6) < 3.2) m.set(x, y, 'carpet_royal')
    }
  const [ax, ay] = CH5_AT.floor.altar
  m.fixture(LANCE_ALTAR, ax, ay, { id: 'beneathaltar.altar' })
  for (const [x, y] of [[ax - 2, ay], [ax + 3, ay], [4, 4], [P.w - 5, 4], [4, P.h - 5], [P.w - 5, P.h - 5]] as Cell[]) m.fixture('fixture/light/candelabrum', x, y, lit)
  glow(m, ax + 1, ay + 1, 10, 6, '#fff0c0', 0.5)
  // the white-robed heaped round the walls and the altar, leaving the floor between
  for (let y = 3; y < P.h - 3; y++)
    for (let x = 3; x < P.w - 3; x++) {
      const edge = Math.min(x - 3, y - 3, P.w - 4 - x, P.h - 4 - y)
      const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 6)
      if ((edge <= 1 || (d > 3.2 && d < 6)) && m.free(x, y) && rng.chance(edge === 0 || d < 5 ? 0.9 : 0.55) && !(x >= 12 && x <= 17 && y >= 21)) m.fixture(rng.chance(0.3) ? ROBED_KNEELING : ROBED_SLEEPER, x, y)
    }
  // the Witnesses (the campaign's body: content chapter5.ts)
  const [wx, wy] = CH5_AT.floor.witnesses
  const k = createBoss('witnesses', { map: m.id, x: wx, y: wy }, WITNESSES_ID)
  k.props = { ...k.props, ...WITNESSES_CAMPAIGN }
  m.entities.push(k)
  // back out to the head of the catacombs' north gallery, below its fog (buildCatacombs)
  const No = HALLS.catacombs.parts.north
  CH5_AT.floor.gate.forEach(([x, y], i) => {
    m.set(x, y, 'marble')
    m.set(x, y + 1, 'marble')
    m.portal(x, y, 'catacombs', No.x + 11 + i, No.y + 1, L('The Catacombs of the Witnesses', '万证墓窟'))
    m.fixture('fixture/fog', x, y, { name: L("The altar's fog", '坛下的雾门'), props: { boss: 'witnesses' } })
  })
  m.anchors.arrive = [CH5_AT.floor.arrive[0], CH5_AT.floor.arrive[1]]
  m.regions.floor = [2, 2, P.w - 4, P.h - 3]
  m.vistas.push({ at: [2, 2, P.w - 4, P.h - 4], zoom: 0.75, focus: [15, 10], share: 0.35 })
  return m
}

// =================================================================== the scenes

const FL = CH5_AT.floor

/** The chapter's card at its end. */
const CHAPTER_END = {
  en: 'CHAPTER FIVE · THE FIFTH SEAL\n\nThe white-robed asked how long, and were told: enough.\nThe Lance came free of the altar.\nThe grey man\'s flame burned white.\nAnd the night came sooner again.',
  zh: '第五章 · 第五印\n\n白袍者问还要多久，得到的回答是：够了。\n圣枪离开了祭坛。\n灰衣人的火焰烧成了白色。\n夜晚又来得更早了。',
}

export const CHAPTER5_STORY: StepDef[] = [
  {
    // Up out of the fens: six days; the robes on their poles beside the stair.
    id: 'stair_arrival',
    when: { map: 'whitestair', region: 'arrival' },
    script: [
      { card: L('West, the land climbed out of the fens into white stone.\nIt took six days.', '往西，地势从林沼里爬升，进了白石山地。\n走了六天。') },
      { place: 'npc.severin', map: 'whitestair', x: CH5_AT.arrival.severin[0], y: CH5_AT.arrival.severin[1] },
      say('player', '(Chalk cliffs, white in a grey light, climb in shelves toward the sky. A stair of switchbacks goes up them. Beside it, every few steps, a white robe hangs on a pole over a grave, its hem moving in the wind.)', '（白垩悬崖在灰白的天光里一层一层地往天上爬，一道之字形的石阶沿着它往上。石阶旁，每隔几步，就有一件白袍挂在杆子上，下面是一座坟，衣摆在风里飘。）'),
      say('pip', 'So many of them. ...Were they all going up?', '这么多。……他们都是要往上去的吗？', 'sad'),
      say('npc.severin', 'Pilgrims. The ones who did not get to the top. The brothers carry them up the rest of the way.', '朝圣者。没走到顶的那些。剩下的路，修士们把他们抬上去。'),
      say('npc.severin', 'Every one of them was sent, the way you were.', '他们每一个都是被派来的，跟你一样。'),
      { fact: CH5.road, value: 1 },
    ],
  },
  {
    // The hermit on the heath: a pilgrim of forty years ago who turned back.
    id: 'hermit',
    when: { map: 'whitestair', region: 'heath', facts: { [CH5.road]: 1 } },
    script: [
      { place: 'npc.ysolde', map: 'whitestair', x: CH5_AT.hermit.ysolde[0], y: CH5_AT.hermit.ysolde[1] },
      say('npc.ysolde', 'Another one. And the grey man with you. That is new.', '又来一个。还带着那个灰衣人。这倒是头一回。'),
      say('npc.ysolde', 'I was named forty years ago. I brought down the Crown\'s knight\'s squire, and the Rider\'s banner, and at the Scale I turned back. I could feel it taking me. I came up here instead, and they let me keep this cell.', '四十年前我也被点了名。我打倒过骑士的侍从，夺过骑者的军旗，到了秤那儿我就回头了。我感觉得到它在把我拿走。我就到这上面来了，他们准我住这间小屋。'),
      say('npc.ysolde', 'You have four. Do you feel it? Lighter, and harder, and further away from your own hands?', '你有四件了。你感觉到了吗？更轻，更硬，离自己的手更远？'),
      say('npc.ysolde', 'Go on up. They will give you a robe either way.', '上去吧。不管怎样，他们都会给你一件袍子的。'),
      { place: 'npc.ysolde', map: 'whitestair', x: 9, y: 16 },
    ],
  },
  {
    // The robing house: the roll of the white-robed, and a robe being sewn to the pilgrim's measure.
    id: 'roll',
    when: { map: 'whiteveil.robing', facts: { [CH5.abbot]: 1 } },
    script: [
      { place: 'npc.agathe', map: 'whiteveil.robing', x: CH5_AT.roll.agathe[0], y: CH5_AT.roll.agathe[1] },
      { place: 'npc.severin', map: 'whiteveil.robing', x: CH5_AT.roll.severin[0], y: CH5_AT.roll.severin[1] },
      say('player', '(A long hall smelling of linen. A roll as long as the room lies open on its lectern. A sister in white works at a frame with a half-sewn robe on it. She looks up at you, once, the way a tailor looks.)', '（一间狭长的厅堂，满是麻布的味道。讲台上摊着一卷和屋子一样长的名册。一个穿白衣的修女在一个架子前做活，架上绷着一件缝了一半的袍子。她抬头看了你一眼，就一眼，像裁缝看人那样。）'),
      say('npc.agathe', 'Go on and read it. Everyone who comes up reads it.', '去读吧。上来的人都会读。'),
      say('player', '(Four hundred years of names. Where each fell: the March, the Vale, the Fens, under the knight. Some: "came to the Hall, could not bear it." At the head, in the oldest hand: the road chooses. Whoever brings down the five and bears their power is the one the Rite needs. A bearer new.)', '（四百年的名字，每个名字后面写着倒下的地方：边境、衡谷、林沼、骑士麾下。有些写着：“至大殿，不能承受。”卷首是最古老的笔迹：道路自会拣选。凡能击倒五者、承其力者，即大礼所需之人。一位新的承担者。）'),
      say('npc.severin', 'They are not renewing a rite.', '他们不是在重行大礼。'),
      say('npc.severin', 'They are making him a new body. You.', '他们是在给他造一副新的身体。就是你。'),
      say('pip', '...', '……', 'sad'),
      say('npc.agathe', 'It will be ready by the time you come back up. Either way.', '等你再上来的时候，它就缝好了。不管怎样。'),
      { place: 'npc.severin', map: 'whiteveil', x: 28, y: 19 },
      { fact: CH5.roll, value: 1 },
    ],
  },
  {
    // The catacombs: the niches, "How long?"; Cassian's empty niche; the oldest, the second's, read aloud by Lumi.
    id: 'the_niches',
    when: { map: 'catacombs', region: 'galleries' },
    script: [
      { place: 'npc.severin', map: 'catacombs', x: CH5_AT.niches.severin[0], y: CH5_AT.niches.severin[1] },
      say('player', '(Galleries cut in the chalk, and in every wall niches, and in every niche someone in a white robe with their face covered. Under the cloths, lips are moving. The sound fills the dark like water: "How long? How long?")', '（白垩里凿出一条条长廊，每面墙上都是壁龛，每个壁龛里躺着一个穿白袍、盖着脸的人。布底下，嘴唇在动。那声音像水一样灌满了黑暗：“还要多久？还要多久？”）'),
      say('player', '(On the west gallery an empty niche is swept clean. Its plate: CASSIAN OF FIRSTLIGHT. THE 380TH YEAR. NOT YET BROUGHT.)', '（西边那条廊上，有个空壁龛扫得干干净净。铭牌上写着：初原村的卡西安。三百八十年。尚未带来。）'),
      say('pip', 'Cassian... that\'s Sister Ilse\'s pilgrim. They told her he got to the Holy City.', '卡西安……是伊尔丝修女说的那个朝圣者。他们告诉她，他走到了圣城。', 'sad'),
      say('player', '(At the end of the east tomb there is one more niche, older than the rest, its chalk gone yellow. It is empty too.)', '（东边那间墓室的尽头还有一个壁龛，比别的都老，白垩已经发黄。它也是空的。）'),
      say('pip', '"Lu... the second. She took up the Five in the fourth year of the Five, and bore them a night and a day. The Night went out of her, and she went small."', '“露……第二位。她于五苦四年承受五苦，承受了一夜一日。原夜从她身上退去，她变小了。”'),
      say('pip', 'That\'s a nice name. I wonder who she was.', '这名字真好听。不知道她是谁。', 'happy'),
      say('player', '(Severin looks at Lumi for a long time, and says nothing.)', '（塞弗林看了露米很久，什么也没说。）'),
      { fact: CH5.niches, value: 1 },
    ],
  },
  {
    // Beneath the Altar: the white-robed rise.
    id: 'beneath_altar',
    when: { map: 'beneathaltar', region: 'floor', facts: { [CH5.witnesses]: 0 } },
    script: [
      say('player', '(A vault of white stone. At its head an altar, and standing in it a plain black spear under a ring of faint light. Round it, heaped on the floor in their hundreds, the white-robed. As you come in, three of them sit up.)', '（一间白石砌的穹室。顶头是一座祭坛，坛里立着一杆普通的黑矛，头顶一圈淡淡的光。祭坛四周，几百个白袍者堆在地上。你一进来，其中三个坐了起来。）'),
      say(WITNESSES_ID, 'Another one has come. Is it fulfilled?', '又来了一个。应验了吗？'),
      say(WITNESSES_ID, 'How long? How long?', '还要多久？还要多久？'),
    ],
  },
  {
    // It Is Enough: they lie down; the Lance comes free; Lumi catches the last; Severin, with the pilgrim's hand on the lantern.
    id: 'enough',
    when: { map: 'beneathaltar', facts: { [CH5.witnesses]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(The three sink back into the heap. All round the vault the murmuring stops.)', '（那三个人沉回人堆里。整间穹室里的念叨声都停了。）'),
      say('player', '("Is it fulfilled?")', '（“应验了吗？”）', 'sad'),
      say('player', '("...It is enough.")', '（“……够了。”）', 'sad'),
      say('player', '(The white-robed lie still. The ring of light over the altar goes out, and the spear leans, and falls into your hands.)', '（白袍者们静静地躺着。祭坛上那圈光灭了，长矛一歪，落进了你手里。）'),
      { give: HOLY_LANCE },
      say('player', '(Something comes loose from the spear, a cold light, and runs to Lumi.)', '（矛上有什么东西散了出来，是一道冷光，流向了露米。）'),
      { tell: 'pip', params: { what: 'boon', unlock: 'pierce', from: WITNESSES_ID } },
      { wait: 32 },
      say('pip', 'It came to me. The last one.', '到我这儿来了。最后一道。', 'surprised'),
      say('pip', 'Pilgrim... one of them said "sister". Just before. Did you hear?', '朝圣者……刚才他们当中有一个人说了声“妹妹”。你听见了吗？', 'sad'),
      { place: 'npc.severin', map: 'beneathaltar', x: FL.severin[0], y: FL.severin[1] },
      { music: 'severin' },
      say('player', '(Severin opens the lantern. You put your hand on it with his. The rest of the light goes in, and the flame stands up straight, and burns white.)', '（塞弗林打开提灯。你把手和他的一起放在灯上。剩下的光流了进去，火苗直直地立起来，烧成了白色。）'),
      say('npc.severin', 'Five.', '第五道了。'),
      say('npc.severin', 'Now we end it.', '现在，我们去了结它。'),
      { place: 'npc.severin', map: 'whiteveil', x: CH5_AT.bells.severin[0], y: CH5_AT.bells.severin[1] },
      { fact: CH5.lance, value: 1 },
      // the fifth seal down: the night longer again (calendar.ts nightHours: dusk at four, dawn at half past seven)
      { fact: 'night.shift', value: 5 },
      { topic: 'it_is_enough', days: 30 },
    ],
  },
  {
    // Bells at four: the bells ring by themselves; the abbot kneels. The chapter ends.
    id: 'bells_at_four',
    when: { map: 'whiteveil', facts: { [CH5.lance]: 1 }, hour: { from: 14, to: 23 } },
    script: [
      say('player', '(As you come up into the close, the bells in the church begin to ring. Nobody is at the ropes.)', '（你刚走进院子，教堂里的钟就响了起来。绳子边一个人也没有。）'),
      { place: 'npc.benedek', map: 'whiteveil', x: CH5_AT.bells.benedek[0], y: CH5_AT.bells.benedek[1] },
      say('npc.benedek', 'They have stopped asking. For four hundred years they have asked, and tonight they are quiet.', '他们不再问了。四百年来他们一直在问，今晚安静了。'),
      say('player', '(The old man goes down on his knees on the flagstones before you.)', '（老人在石板地上朝你跪了下去。）'),
      say('npc.benedek', 'The road has chosen. Go down to the Holy City, bearer. They are waiting for you at the Hall.', '道路已经拣选了。下山去圣城吧，承担者。他们在大殿等你。'),
      { place: 'npc.severin', map: 'whiteveil', x: CH5_AT.bells.severin[0], y: CH5_AT.bells.severin[1] },
      say('npc.severin', 'Tomorrow. They will open the door to you. They will not open it to me. I know another way in.', '明天。他们会给你开门。不会给我开。我知道另一条进去的路。'),
      say('player', '(The sun goes down behind the white hills. It went down at four.)', '（太阳落到白色的群山后面去了。四点就落了。）'),
      { fact: CH5.end, value: 1 },
      { fact: FINALE, value: 1 },
      { music: 'ending' },
    ],
  },
  {
    // The chapter's card.
    id: 'chapter5_end',
    when: { after: 'bells_at_four' },
    script: [{ card: L(`${CHAPTER_END.en}\n\nThe road down to the Holy City is open.`, `${CHAPTER_END.zh}\n\n下到圣城的路通了。`) }],
  },
]

/** The Heights' halls, linked to their doors (world.ts): the church with its stair down to the catacombs. */
export function heightsInteriors(abbey: MapBuilder, catacombs: MapBuilder): MapBuilder[] {
  const church = buildAbbeyChurch()
  const robing = buildRobingHouse()
  const cells = buildAbbeyCells()
  abbey.linkInterior('church', church)
  abbey.linkInterior('robing', robing)
  abbey.linkInterior('cells', cells)
  linkStair(church, church.doors.down, catacombs, catacombs.anchors.stair, true)
  return [church, robing, cells]
}
