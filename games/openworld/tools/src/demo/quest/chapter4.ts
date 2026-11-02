// Chapter 4, the Fourth Seal (docs/chapter-4.md; content chapter4.ts): the Pale Fens down the fen road from Fairweight —
// its maps, the places its people keep, and the chapter's scenes. The Long Causeway over the black water, its graves nailed
// shut from the inside; Nailgate on its piles, every doorpost bristling with nails for the dead kept within, its chapel
// where Nessa lays out her proof, its landing where the ferryman has waited forty years; the Drowned Graves, where those
// who have forgotten everything wander as the Pale; the Ossuary of the Holy Wood on its island, the Shroud in its
// reliquary; and behind its fog the Ford of the Dead, where Nacht holds the reins.

import type { AiData, StepDef } from '@openworld/engine'
import { CH4, CHAPTER_FIVE, GRAVE_POST, HOLY_WOOD, HOLY_WOOD_TREE, JORY_KITE, NACHT_CAMPAIGN, NACHT_ID, NAIL_POST, SHROUD, createBoss } from '@openworld-game/content'
import { MapBuilder, rng, type Cell } from '../builder.ts'
import { L, appears, levelCreatures } from '../kit.ts'
import { home } from '../village.ts'
import type { Place } from '../continent/generate.ts'
import { roomsBehind } from '../continent/rooms.ts'
import { planHall, glow, lit } from '../showcase/halls.ts'
import { decor, unshut } from '../showcase/dress.ts'
import { glowAt } from '../showcase/ground.ts'
import { houseRow } from '../showcase/street.ts'
import { FEN_HOUSES } from '../../art/arch/buildings/regions.ts'
import { noise, seal, ways } from './country.ts'
import { spot } from './chapter2.ts'

/** Edge openings: the fen road in from Fairweight (north), then south to Nailgate and the Drowned Graves, east to the isle. */
export const FEN = {
  road: { w: 36, h: 44, north: [16, 17], south: [17, 18] },
  village: { w: 46, h: 36, north: [22, 23], south: [22, 23], west: [11, 12] },
  graves: { w: 46, h: 34, north: [22, 23], east: [16, 17] },
  isle: { w: 40, h: 32, west: [16, 17] },
  ford: { w: 30, h: 30 },
} as const

/** Where the scenes stage their people. */
export const CH4_AT = {
  kept: { barnaby: [7, 12] as Cell, piet: [5, 12] as Cell, liese: [6, 11] as Cell },
  quickening: { nessa: [9, 6] as Cell },
  shroud: { severin: [10, 5] as Cell },
  // (one comes in out of Nacht's sight)
  ford: { arrive: [14, 26] as Cell, nacht: [14, 13] as Cell, wood: [15, 4] as Cell, severin: [9, 8] as Cell, gate: [[14, 28], [15, 28]] as Cell[] },
  ferry: { klaas: [41, 24] as Cell, hedda: [16, 12] as Cell, piet: [6, 12] as Cell, sanne: [7, 24] as Cell, severin: [24, 18] as Cell },
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })
/** The Fens as a place, for the halls on a plan and the rooms behind their doors. */
const FEN_PLACE = { id: 'nailgate', name: L('Nailgate', '钉门村'), region: 'palefen', kind: 'village', x: 42, y: 34, seed: 4401 } as unknown as Place
/** The fog lamps' light: pale and greenish, burning day and night. */
const FOG = '#d8e8a8'

/** A hall of the Fens on its plan, walked into. */
function fenHall(key: Parameters<typeof planHall>[1], id: string, en: string, zh: string, floor: string, opts: Parameters<typeof planHall>[5] = {}) {
  const { m, P } = planHall(FEN_PLACE, key, id, L(en, zh), floor, opts)
  m.backdrop = false
  return { m, P }
}

/** A way laid along a line of points whatever is under it (open water too: path() keeps to the ground), `w` cells wide. */
function causewayLine(m: MapBuilder, pts: Cell[], w: number, terrain: string): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i], pts[i + 1]]
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1)
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n)
      const y = Math.round(ay + ((by - ay) * k) / n)
      for (let dy = -Math.floor((w - 1) / 2); dy <= Math.floor(w / 2); dy++) for (let dx = -Math.floor((w - 1) / 2); dx <= Math.floor(w / 2); dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < m.w && y + dy < m.h) m.set(x + dx, y + dy, terrain)
    }
  }
}

/** A fog lamp on its pole, lit day and night. */
function fogLamp(m: MapBuilder, x: number, y: number): void {
  if (!m.free(x, y)) return
  m.fixture('fixture/light/lantern', x, y, lit)
  glowAt(m, x, y, 'always', 0.3, FOG)
}

/** The fen's own life over open water: reeds where the mud is near, the mist, a dead tree here and there. */
function fenLife(m: MapBuilder, trees: Cell[]): void {
  for (const [i, [x, y]] of trees.entries()) if (m.free(x, y) && m.free(x + 1, y) && m.free(x + 2, y)) m.building(`fen_deadtree_${(i % 3) + 1}`, x, y)
  m.sprinkle('fixture/nature/reeds', 0.07, (x, y, t) => (t === 'water' || t === 'mud') && m.near(x, y, (n) => n === 'mud', 2) && !m.near(x, y, (n) => n === 'bridge' || n === 'flags', 1))
  m.sprinkle('fixture/nature/mist', 0.014, (x, y, t) => t === 'water' && !m.near(x, y, (n) => n === 'bridge' || n === 'flags', 1))
}

// =================================================================== the Long Causeway

/**
 * The Long Causeway: the fen road where it goes down out of the Vale into the Pale Fens, a raised way of old stone over
 * black water and mud, winding south between dead trees. Grave-posts lean on the mud beside it, every one nailed, the
 * earth at their feet dug up and filled in again from the inside. Fog lamps burn on poles all day.
 */
export function buildCauseway(): MapBuilder {
  const P = FEN.road
  const m = new MapBuilder('causeway', L('The Long Causeway', '长堤'), 'wild', P.w, P.h, 'water', 'field', 'outdoor', 'palefen')
  m.gearLevel = 14
  // the mud banks either side, deep channels between
  for (const [x, y, rx, ry] of [[8, 8, 6, 4], [27, 12, 6, 5], [7, 24, 6, 5], [28, 30, 6, 4], [10, 38, 7, 3], [26, 40, 5, 3], [17, 20, 3, 2]]) m.organic(x, y, rx, ry, 'mud', { rough: 0.5 })
  for (const [x, y, rx, ry] of [[3, 16, 3, 5], [32, 22, 3, 4], [3, 34, 3, 3]]) m.organic(x, y, rx, ry, 'deepwater', { rough: 0.4 })
  // the causeway, three wide, winding south
  causewayLine(m, [[17, 0], [17, 6], [14, 12], [15, 18], [20, 24], [21, 30], [17, 36], [18, 43]], 3, 'flags')
  // the grave-posts on the mud beside it, and the graves themselves
  const posts: Cell[] = [[12, 7], [21, 10], [11, 15], [19, 17], [24, 23], [16, 27], [25, 31], [13, 35], [22, 38]]
  for (const [x, y] of posts) {
    const at = spot(m, x, y)
    if (m.get(...at) === 'water') m.set(...at, 'mud')
    m.fixture(GRAVE_POST, ...at)
  }
  for (const [x, y] of [[8, 9], [28, 13], [7, 25], [29, 31]] as Cell[]) m.fixture('fixture/sacred/gravestone', ...spot(m, x, y), { props: { text: 'The name is worn away. Under it, newer: KEPT.', text_zh: '名字已经磨掉了。下面刻着一行新些的字：留之。' } })
  // the fog lamps along the way
  for (const [x, y] of [[19, 3], [12, 11], [17, 19], [23, 26], [19, 33], [20, 40]] as Cell[]) fogLamp(m, ...spot(m, x, y))
  // a statue where the causeway comes down out of the Vale
  m.fixture('fixture/sacred/waypoint', ...spot(m, 20, 5), { id: 'wp.causeway', name: L('Causeway statue', '长堤传送雕像') })
  m.regions.arrival = [11, 0, 14, 9]
  fenLife(m, [[5, 4], [28, 7], [4, 20], [29, 25], [6, 30], [27, 36], [9, 41]])
  // what moves on the fen: lights over the water, and at night the Pale come up out of the mud
  m.creature('wisp', ...spot(m, 8, 22, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  m.creature('wisp', ...spot(m, 28, 29, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  m.creature('undead/zombie', ...spot(m, 27, 12, true), HUNT(4))
  m.creature('undead/zombie', ...spot(m, 9, 38, true), HUNT(4))
  m.appear = [appears('actor/creature/undead/zombie', ['mud'], 3, 2400, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 }, night: true })]
  seal(m, ways(m, { north: P.north, south: P.south }), 'deepwater')
  levelCreatures(m)
  return m
}

// =================================================================== Nailgate

/** Nailgate's walks and the houses the story goes into (their footprints' top-left). */
const VILLAGE = { spine: 22, north: 11, south: 23, piet: [4, 8] as Cell, hedda: [13, 8] as Cell, sanne: [4, 20] as Cell, chapel: [25, 20] as Cell, klaas: [34, 20] as Cell }

/**
 * Nailgate: a village on piles over the black water. The causeway comes in from the north as a boardwalk and runs on south
 * through it; two walks cross it, a row of houses on posts over the water above each. Beside every door a post of grey
 * wood bristles with nails, one for each of the dead the house keeps. The sexton's chapel stands on the south walk; at its
 * east end the ferryman's landing, his boat tarred and empty.
 */
export function buildNailgate(): MapBuilder[] {
  const P = FEN.village
  const m = new MapBuilder('nailgate', L('Nailgate', '钉门村'), 'village', P.w, P.h, 'water', 'village', 'outdoor', 'palefen')
  m.zone = 'peaceful'
  const walk = (x: number, y: number, w: number, h: number) => m.rect(x, y, w, h, 'bridge')
  for (const [x, y, rx, ry] of [[40, 4, 5, 3], [3, 30, 6, 3], [38, 31, 5, 3], [12, 3, 4, 2]]) m.organic(x, y, rx, ry, 'mud', { rough: 0.5 })
  walk(VILLAGE.spine, 0, 2, P.h)
  walk(0, VILLAGE.north, 43, 2)
  walk(3, VILLAGE.south, 40, 2)
  // the houses the story goes into, and the rest of each row
  const doorNail = (door: string) => {
    const [x, y] = m.doors[door]
    m.fixture(NAIL_POST, x + 1, y + 1, { id: `nailgate.post.${door}` })
  }
  for (const [name, at, prefab] of [['piet', VILLAGE.piet, 'fen_house_2'], ['hedda', VILLAGE.hedda, 'fen_house_6'], ['sanne', VILLAGE.sanne, 'fen_house_4'], ['klaas', VILLAGE.klaas, 'fen_house_3']] as [string, Cell, string][]) {
    m.building(prefab, at[0], at[1], [name], true)
    doorNail(name)
  }
  m.building('fen_healer', VILLAGE.chapel[0], VILLAGE.chapel[1], ['chapel'], true)
  const northE = houseRow(m, 25, 42, VILLAGE.north - 1, FEN_HOUSES, 'nn', 0.35, { setback: 0, gap: 2, yards: ['bare'] })
  const southW = houseRow(m, 12, 20, VILLAGE.south - 1, FEN_HOUSES, 'ns', 0.35, { setback: 0, gap: 2, yards: ['bare'] })
  for (const d of [...northE.doors, ...southW.doors]) {
    const [x, y] = m.doors[d.door]
    if (m.free(x + 1, y + 1)) m.fixture(NAIL_POST, x + 1, y + 1)
  }
  // what the rows left as ground under and between them is water again (the houses stand over it)
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (['grass', 'dirt', 'flags', 'flowerbed', 'bush', 'tree', 'paving', 'drygrass'].includes(m.get(x, y))) m.set(x, y, 'water')
  // the landing: a jetty off the south walk's east end, the ferry tied at it, the box of coins the dead used to bring
  walk(43, VILLAGE.south - 1, 2, 4)
  m.fixture('fixture/boat', 44, VILLAGE.south + 3, { name: L("The ferryman's boat", '渡人的船'), props: { text: 'A long black boat, freshly tarred, an oar laid in it. It has not left the landing in forty years.', text_zh: '一条黑色的长船，刚上过焦油，船里搁着一支桨。四十年来，它没离开过渡口。' } })
  m.fixture('fixture/container/chest', 43, VILLAGE.south - 1, { name: L("The ferryman's coin box", '渡人的钱箱') })
  m.regions.landing = [38, VILLAGE.south - 2, 8, 7]
  // the fog lamps along the walks
  for (let x = 6; x < 42; x += 7) for (const y of [VILLAGE.north + 2, VILLAGE.south + 2]) fogLamp(m, x, y)
  for (let y = 4; y < P.h; y += 8) fogLamp(m, VILLAGE.spine + 2, y)
  fenLife(m, [[38, 3], [2, 2], [8, 29], [36, 30], [14, 32], [28, 3]])
  for (const [x, y] of [[30, 12], [10, 24], [40, 12]] as Cell[]) decor(m, rng.pick(['decor_casks', 'decor_crates', 'decor_sacks']), x, y)
  decor(m, 'decor_cat', 18, 12)
  // the people's places (people/klaas.ts, barnaby.ts, piet.ts, sanne.ts, jory.ts)
  m.anchor('klaas.landing', ...spot(m, 42, VILLAGE.south + 1, true))
  m.anchor('barnaby.walk', ...spot(m, 10, VILLAGE.north + 1, true))
  m.anchor('piet.walk', ...spot(m, 3, VILLAGE.north + 1, true))
  m.anchor('sanne.walk', ...spot(m, 9, VILLAGE.south + 1, true))
  m.anchor('jory.walk', ...spot(m, 11, VILLAGE.south + 1, true))
  m.anchor('severin.landing', ...spot(m, 40, VILLAGE.south + 1, true))
  m.regions.gate = [VILLAGE.spine - 4, 0, 10, VILLAGE.north + 3]
  m.regions.village = [0, 0, P.w, P.h]
  unshut(m)
  seal(m, ways(m, { north: P.north, south: P.south, west: P.west }), 'deepwater')
  // within: the houses of the rows (the story's own are fenInteriors')
  const rooms = roomsBehind(m, FEN_PLACE, [...northE.doors, ...southW.doors])
  for (const r of rooms) r.backdrop = false
  return [m, ...rooms]
}

/** Piet's house: the table laid for two, the bed made for one, the hearth kept by someone who does not feel the cold. */
export function buildPietHouse(): MapBuilder {
  const m = home('nailgate.piet', "Piet's House", '皮特的家', 1, 'wood')
  m.anchor('liese.hearth', 8, 2)
  return m
}

/** Old Hedda's house: her bed, and the window she looks at the landing through. */
export function buildHeddaHouse(): MapBuilder {
  return home('nailgate.hedda', "Hedda's House", '海达的家', 1, 'wood')
}

/** Sanne's house: her bed, and the little one beside it Jory sits on and does not sleep in. */
export function buildSanneHouse(): MapBuilder {
  return home('nailgate.sanne', "Sanne's House", '桑娜的家', 2, 'wood')
}

/** The ferryman's house: one bed, the oars on the wall. */
export function buildKlaasHouse(): MapBuilder {
  return home('nailgate.klaas', "The Ferryman's House", '渡人的家', 1, 'wood')
}

/** The sexton's chapel: the altar of the Nail, the nails in their box, and on the stand the Church's chronicle of the Holy Body. */
export function buildFenChapel(): MapBuilder {
  const { m, P } = fenHall('healer', 'nailgate.chapel', 'Chapel of the Nail', '圣钉礼拜堂', 'floor_wood', { music: 'temple' })
  const H = P.hut
  m.fixture('fixture/sacred/altar', H.x + 7, H.y, {
    name: L('The altar of the Nail', '圣钉祭坛'),
    tags: ['readable'],
    props: { text: 'An altar of black wood. Carved on its face, a man nailed to a tree, his eyes open. Under it: HE ACCEPTED DEATH, AND DEATH DID NOT TAKE HIM.', text_zh: '一座黑木祭坛。正面刻着一个钉在树上的人，眼睛睁着。底下刻着：他接受了死亡，死亡却没有带走他。' },
  })
  for (const x of [H.x + 5, H.x + 9]) m.fixture('fixture/light/candles', x, H.y, lit)
  m.fixture('fixture/furniture/bookstand', H.x + 1, H.y + 1, {
    id: 'nailgate.chronicle',
    name: L('The Chronicle of the Holy Body', '圣尸纪事'),
    tags: ['readable'],
    props: { text: 'A copy of the Church\'s chronicle, sent to every chapel of the Five: what the keepers of the Most Holy Hall see of the First Martyr\'s body, by the day. For three hundred years: "The Body unchanged." This last year: "The Body\'s colour returned." "The Body warm to the hand." "The Body\'s eyelids moved." In the margin someone has written: THE QUICKENING.', text_zh: '教会纪事的抄本，发给五苦的每一座礼拜堂：至圣大殿的守护者逐日记下他们所见的初殉者遗体。三百年来都是：“圣尸如故。”最近这一年：“圣尸复有血色。”“圣尸触手生温。”“圣尸眼睑微动。”页边上有人写了两个字：复苏。' },
  })
  m.fixture('fixture/furniture/desk', H.x + 11, H.y + 2, { name: L("Nessa's tables", '奈莎的表'), tags: ['readable'], props: { text: 'Sheets of figures weighted down with stones: every sunset since Firstlight, to the minute. Beside the days the sun set early, in red ink, a seal\'s name. Beside some of them, in black, a line from the chronicle.', text_zh: '一张张写满数字的纸，用石头压着：从初原村起的每一次日落，精确到分钟。太阳早落的那些日子旁边，用红墨水写着一道印的名字。其中几天旁边，又用黑墨水抄着纪事里的一句话。' } })
  m.fixture('fixture/container/chest', H.x + 13, H.y, { name: L('A box of nails', '一箱钉子') })
  m.fixture('fixture/furniture/bed', H.x, H.y + 5, { name: L("The sexton's cot", '司事的小床') })
  m.fixture('fixture/furniture/bed', H.x + 13, H.y + 5, { name: L('A cot for travellers', '给过路人的小床') })
  glow(m, H.x + 7.5, H.y + 1.5, 8, 4, '#ffd27a', 0.35)
  m.anchor('barnaby.altar', ...spot(m, H.x + 7, H.y + 2, true))
  m.anchor('barnaby.bed', ...spot(m, H.x, H.y + 4, true))
  m.anchor('nessa.desk', ...spot(m, H.x + 11, H.y + 3, true))
  m.anchor('nessa.cot', ...spot(m, H.x + 13, H.y + 4, true))
  return m
}

// =================================================================== the Drowned Graves

/** Where the kite hangs. */
const GRAVES = { kite: [9, 25] as Cell }

/**
 * The Drowned Graves: Nailgate's old graveyard, sinking into the fen. Stones lean in the mud and stand in the water; stone
 * boxes lie half under; crosses, dead trees. A boardwalk runs down from the village and away east toward the Ossuary's
 * island. At dusk those who have forgotten everything wander here, the Pale; far off on the causeway the Rider gathers them.
 */
export function buildDrownedGraves(): MapBuilder {
  const P = FEN.graves
  const m = new MapBuilder('drowned', L('The Drowned Graves', '沉墓地'), 'wild', P.w, P.h, 'mud', 'field', 'outdoor', 'palefen')
  m.gearLevel = 15
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (noise(x, y, 5, 921) < 0.32) m.set(x, y, 'water')
  for (const [x, y, rx, ry] of [[36, 28, 5, 3], [5, 6, 4, 3], [40, 5, 4, 2]]) m.organic(x, y, rx, ry, 'deepwater', { rough: 0.4 })
  causewayLine(m, [[22, 0], [22, 10], [26, 16], [45, 16]], 2, 'bridge')
  // the stones in their old rows, sinking: some in the mud, some standing in the water
  let n = 0
  for (let gy = 3; gy < P.h - 3; gy += 3)
    for (let gx = 3; gx < P.w - 3; gx += 3) {
      let [x, y] = [gx, gy]
      const [jx, jy] = [x + rng.int(-1, 1), y + rng.int(-1, 1)]
      if (m.near(jx, jy, (t) => t === 'bridge', 1) || noise(jx, jy, 4, 923) > 0.7 || !m.free(jx, jy)) continue
      const t = m.get(jx, jy)
      if (t !== 'mud' && t !== 'water') continue
      x = jx
      y = jy
      if (n % 11 === 10) m.fixture('fixture/sacred/sarcophagus', x, y, { name: L('A stone box, half sunk', '一具半沉的石棺') })
      else if (n % 6 === 5) m.fixture('fixture/sacred/cross', x, y)
      else m.fixture('fixture/sacred/gravestone', x, y, { props: { text: n % 2 ? 'KEPT FORTY YEARS. NOW SLEEPS.' : 'The stone leans so far its face is in the water.', text_zh: n % 2 ? '留了四十年。如今安睡。' : '墓碑歪得厉害，碑面都浸到水里去了。' } })
      n++
    }
  // the dead tree out past the leaning stones, Jory's kite caught in it
  const [kx, ky] = GRAVES.kite
  m.building('fen_deadtree_2', kx - 1, ky - 1)
  m.item({ form: JORY_KITE }, ...spot(m, kx, ky + 1, true)).id = 'quest.sanne.kite'
  m.regions.kite = [kx - 3, ky - 2, 7, 6]
  fenLife(m, [[30, 4], [12, 18], [38, 22], [4, 28], [20, 29]])
  for (const [x, y] of [[24, 6], [28, 15], [38, 15]] as Cell[]) fogLamp(m, ...spot(m, x, y))
  // the Pale: the dead who have forgotten everything
  for (const [x, y] of [[10, 10], [33, 8], [15, 28], [40, 26]] as Cell[]) m.creature('undead/zombie', ...spot(m, x, y, true), HUNT(5))
  m.creature('wisp', ...spot(m, 30, 24, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  m.appear = [appears('actor/creature/undead/zombie', ['mud'], 5, 1800, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 8 }, night: true })]
  m.regions.graves = [0, 0, P.w, P.h]
  seal(m, ways(m, { north: P.north, east: P.east }), 'deepwater')
  levelCreatures(m)
  return m
}

// =================================================================== the Ossuary of the Holy Wood

/** The reliquary on the island, the arch at its east end whose way is the fog into the ford. */
const ISLE = { reliquary: [16, 8] as Cell, arch: [33, 15] as Cell }

/**
 * The Ossuary of the Holy Wood: Nacht's seat, a low island in the fen. The boardwalk comes over from the west to a chapel of
 * bones, its reliquary under the altar; round it the graves of three hundred years, crosses, the bones of the dead who keep
 * it standing at their posts. At the island's east end an old arch stands alone on the shore, and under it the fog.
 */
export function buildBoneIsle(): MapBuilder {
  const P = FEN.isle
  const m = new MapBuilder('boneisle', L('The Ossuary of the Holy Wood', '圣木骨堂'), 'dungeon', P.w, P.h, 'water', 'ruins', 'outdoor', 'palefen')
  m.gearLevel = 15
  m.organic(20, 16, 15, 11, 'mud', { rough: 0.3 })
  m.organic(20, 15, 11, 7, 'grass', { rough: 0.3 })
  m.rect(0, 16, 7, 2, 'bridge')
  // the reliquary chapel and the path to it
  const [rx, ry] = ISLE.reliquary
  m.building('fen_ossuary', rx, ry, ['reliquary'], true)
  const [dx, dy] = m.doors.reliquary
  m.path([[6, 16], [dx, 16], [dx, dy + 1]], 'flags', 2)
  // the arch on the east shore, the fog under it
  const [ax, ay] = ISLE.arch
  m.path([[dx, 17], [ax + 1, 17], [ax + 1, ay + 1]], 'flags', 2)
  m.building('ruin_arch', ax, ay)
  const fogs: Cell[] = [[ax + 1, ay + 1], [ax + 1, ay + 2]]
  fogs.forEach(([x, y], i) => {
    m.set(x, y, 'flags')
    const [ix, iy] = CH4_AT.ford.gate[i]
    m.portal(x, y, 'deadford', ix, iy - 2, L('The Ford of the Dead', '亡者渡'))
    m.fixture('fixture/fog', x, y, { name: L("The Reinholder's fog", '执辔者的雾门'), props: { boss: 'nacht', interior: 'deadford', interiorX: ix, interiorY: iy - 2 } })
  })
  for (const [x, y] of [[ax - 1, ay + 1], [ax - 1, ay + 3]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.45)
  }
  m.regions.arch = [ax - 3, ay - 1, 7, 6]
  // the graves of three hundred years round the chapel
  for (const [x, y] of [[10, 10], [12, 12], [10, 20], [13, 22], [26, 10], [28, 12], [25, 21], [28, 23], [15, 24], [22, 25]] as Cell[]) m.fixture('fixture/sacred/gravestone', ...spot(m, x, y), { props: { text: 'A name, and under it a nail driven into the stone.', text_zh: '一个名字，名字下面的石头里钉着一颗钉子。' } })
  for (const [x, y] of [[9, 15], [30, 19]] as Cell[]) m.fixture('fixture/sacred/cross', ...spot(m, x, y))
  for (const [x, y] of [[12, 17], [27, 14], [20, 23]] as Cell[]) decor(m, 'decor_bones', ...spot(m, x, y))
  // the dead who keep it, at their posts
  for (const [x, y] of [[11, 14], [27, 18], [14, 21], [30, 15]] as Cell[]) m.creature('undead/skeleton', ...spot(m, x, y, true), { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 3 })
  m.creature('wisp', ...spot(m, 34, 8, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  m.fixture('fixture/sacred/waypoint', ...spot(m, 8, 14), { id: 'wp.boneisle', name: L('Ossuary statue', '骨堂传送雕像') })
  fenLife(m, [[3, 4], [34, 4], [4, 26], [33, 27]])
  seal(m, ways(m, { west: P.west }), 'deepwater')
  levelCreatures(m)
  return m
}

/** The reliquary: niches of skulls, the dead in their stone boxes, and on the altar under glass the Shroud. */
export function buildReliquary(): MapBuilder {
  const { m, P } = fenHall('ossuary', 'boneisle.reliquary', 'The Reliquary', '圣髑室', 'floor_stone', { music: 'crypt', light: 'dark', floors: [['apse', 'marble']] })
  const N = P.nave
  const A = P.apse
  m.rect(N.x + 7, N.y, 2, N.h, 'runner')
  m.fixture('fixture/sacred/altar', A.x + 2, A.y)
  m.fixture(SHROUD, A.x + 3, A.y, { id: 'boneisle.shroud' })
  for (const [x, y] of [[A.x, A.y], [A.x + 5, A.y]] as Cell[]) m.fixture('fixture/light/candelabrum', x, y, lit)
  for (const [x, y] of [[N.x + 2, N.y + 2], [N.x + 2, N.y + 5], [N.x + 13, N.y + 2], [N.x + 13, N.y + 5]] as Cell[]) m.fixture('fixture/sacred/sarcophagus', x, y)
  for (const [x, y] of [[N.x, N.y], [N.x + 15, N.y], [N.x, N.y + 9], [N.x + 15, N.y + 9]] as Cell[]) m.fixture('fixture/remains/bones', x, y)
  for (const [x, y] of [[N.x + 4, N.y + 3], [N.x + 11, N.y + 3]] as Cell[]) m.fixture('fixture/light/candles', x, y, lit)
  glow(m, A.x + 3, A.y + 1.5, 8, 4, '#b8a0ff', 0.35)
  m.regions.reliquary = [N.x, N.y, N.w, N.h]
  return m
}

// =================================================================== the Ford of the Dead

/**
 * The Ford of the Dead (docs/boss-rooms.md): where the dead of the Fens should cross a black river and cannot. A sandbar
 * of grey mud in the middle of the black water, the Holy Wood standing at its north end with its three nails, the water
 * round its roots still. The Reinholder on his pale horse. Rock all round; the fog behind one, sealed while he stands.
 */
export function buildDeadFord(): MapBuilder {
  const P = FEN.ford
  const m = new MapBuilder('deadford', L('The Ford of the Dead', '亡者渡'), 'field', P.w, P.h, 'water', 'ruins', 'dark', 'palefen')
  m.gearLevel = 15
  for (let y = 0; y < P.h; y++)
    for (let x = 0; x < P.w; x++) {
      const d = Math.hypot(x + 0.5 - 15, (y + 0.5 - 14) * 0.95)
      if (d < 11.5) m.set(x, y, noise(x, y, 3, 931) > 0.8 ? 'sand' : 'mud')
      if (x < 1 || y < 1 || x >= P.w - 1 || y >= P.h - 1) m.set(x, y, 'rock')
    }
  m.rect(13, 24, 4, P.h - 24, 'mud')
  const [tx, ty] = CH4_AT.ford.wood
  m.fixture(HOLY_WOOD_TREE, tx, ty, { id: 'deadford.wood' })
  for (const [x, y] of [[tx - 1, ty + 1], [tx + 1, ty + 1]] as Cell[]) m.set(x, y, 'water')
  for (const [x, y] of [[6, 8], [24, 9], [6, 20], [24, 20]] as Cell[]) m.fixture('fixture/sacred/gravestone', x, y, { props: { text: 'Leaning in the shallows: a stone with no name.', text_zh: '斜插在浅水里：一块没有名字的碑。' } })
  for (const [x, y] of [[5, 13], [25, 14]] as Cell[]) {
    m.fixture('fixture/light/lantern', x, y, lit)
    glowAt(m, x, y, 'always', 0.4, FOG)
  }
  // the Reinholder on his pale horse (the campaign's body: content chapter4.ts)
  const [nx, ny] = CH4_AT.ford.nacht
  const k = createBoss('nacht', { map: m.id, x: nx, y: ny }, NACHT_ID)
  k.props = { ...k.props, ...NACHT_CAMPAIGN }
  m.entities.push(k)
  CH4_AT.ford.gate.forEach(([x, y], i) => {
    m.set(x, y, 'mud')
    m.set(x, y + 1, 'mud')
    m.portal(x, y, 'boneisle', ISLE.arch[0] + 1, ISLE.arch[1] + 1 + i, L('The Ossuary of the Holy Wood', '圣木骨堂'))
    m.fixture('fixture/fog', x, y, { name: L("The Reinholder's fog", '执辔者的雾门'), props: { boss: 'nacht' } })
  })
  m.anchors.arrive = [CH4_AT.ford.arrive[0], CH4_AT.ford.arrive[1]]
  m.regions.ford = [2, 2, P.w - 4, P.h - 3]
  m.vistas.push({ at: [2, 2, P.w - 4, P.h - 4], zoom: 0.75, focus: [15, 11], share: 0.35 })
  return m
}

// =================================================================== the scenes

const K = CH4_AT.kept
const FD = CH4_AT.ford
const FR = CH4_AT.ferry

/** The chapter's card at its end. */
const CHAPTER_END = {
  en: 'CHAPTER FOUR · THE FOURTH SEAL\n\nThe Reinholder let go of the reins.\nThe dead of the Fens lay down, and the ferry went out full.\nThe grey man and the pilgrim went west together.\nAnd the night came sooner again.',
  zh: '第四章 · 第四印\n\n执辔者松开了缰绳。\n林沼的死者躺下了，渡船满载着出发。\n灰衣人和朝圣者一起往西去了。\n夜晚又来得更早了。',
}

export const CHAPTER4_STORY: StepDef[] = [
  {
    // Down the fen road: five days, the last two without a sunrise; the graves along the causeway nailed.
    id: 'fen_arrival',
    when: { map: 'causeway', region: 'arrival' },
    script: [
      { card: L('The road went down into the fens for five days.\nOn the last two the sun did not come up.', '路往下走进林沼，走了五天。\n最后两天，太阳没有升起来。') },
      say('player', '(A causeway of old stone runs south over black water. The dusk does not lift. Lamps burn on poles beside the way, though it is noon.)', '（一条老石砌的长堤往南伸进黑水里。黄昏一直不散。明明是正午，路边杆子上的灯却都点着。）'),
      say('player', '(Grave-posts lean on the mud beside the causeway. Each one is driven full of nails. The earth at their feet has been dug open, and filled in again from the inside.)', '（长堤边的泥地上斜插着一根根墓桩，每根上面都钉满了钉子。桩脚的土被刨开过，又从里面填了回去。）'),
      say('pip', 'Why would anyone nail a grave shut?', '为什么要把坟钉死？', 'sad'),
      say('pip', '...To keep someone in. Or to keep them from going somewhere.', '……是为了把谁关在里面吧。或者，是不让谁到别的地方去。', 'sad'),
      { fact: CH4.road, value: 1 },
    ],
  },
  {
    // Nailgate: the sexton drives a nail into Piet's doorpost; his wife, eleven years dead, does not know his name.
    id: 'kept',
    when: { map: 'nailgate', region: 'gate' },
    script: [
      say('player', '(Houses on posts over the black water, boardwalks between them. Beside every door a grey post bristles with nails.)', '（黑水上立着一座座高脚屋，屋与屋之间架着栈道。每扇门边都立着一根灰木桩，上面钉满了钉子。）'),
      { place: 'npc.barnaby', map: 'nailgate', x: K.barnaby[0], y: K.barnaby[1] },
      { place: 'npc.piet', map: 'nailgate', x: K.piet[0], y: K.piet[1] },
      say('player', '(A man in a black coat sets a nail to a doorpost and drives it home with three blows. The man of the house watches him with his cap in his hands.)', '（一个穿黑外套的人把一颗钉子抵在门柱上，三锤钉了进去。这家的男主人捏着帽子，在一旁看着。）'),
      say('npc.barnaby', 'One more for Liese. That is eleven years.', '又给莉泽钉一颗。十一年了。'),
      say('npc.piet', 'Thank you, sexton. And thank the Keeper for me, when he rides by tonight.', '谢谢你，司事。今晚守护者骑马经过的时候，也替我谢谢他。'),
      { place: 'npc.liese', map: 'nailgate', x: K.liese[0], y: K.liese[1] },
      say('player', '(A woman comes to the door. Her face is grey, and very still. She looks at you, and then at the man with the cap, for a long time.)', '（一个女人走到门口。她的脸是灰的，一动不动。她看了看你，又看了看那个捏着帽子的男人，看了很久。）'),
      say('npc.liese', 'Piet. ...It is Piet. Supper is laid. There is a place for your friend.', '皮特。……是皮特。晚饭摆好了。你朋友也有位子。'),
      say('pip', 'She forgot him. Just for a moment. ...Didn\'t she?', '她忘了他。就一下子。……是吧？', 'sad'),
      say('npc.piet', 'She comes back to it. She always comes back to it. That is what the nails are for.', '她会想起来的。她总会想起来的。钉子就是干这个用的。'),
      { place: 'npc.barnaby', map: 'nailgate.chapel', x: 9, y: 6 },
      { place: 'npc.liese', map: 'nailgate.piet', x: 8, y: 2 },
      { fact: CH4.kept, value: 1 },
      { topic: 'liese_forgot', days: 10 },
    ],
  },
  {
    // The chapel: Nessa's sunset table beside the Church's own chronicle of the Holy Body — the same days.
    id: 'quickening',
    when: { map: 'nailgate.chapel', facts: { [CH4.kept]: 1 } },
    script: [
      { place: 'npc.nessa', map: 'nailgate.chapel', x: CH4_AT.quickening.nessa[0], y: CH4_AT.quickening.nessa[1] },
      say('npc.nessa', 'Pilgrim. Sit down. I want you to look at something, and then I want you to tell me I am wrong.', '朝圣者。坐下。我想让你看一样东西，看完了，我想听你跟我说，是我弄错了。'),
      say('npc.nessa', 'This is my table. Every sunset since the bridge at Firstlight. Here: four minutes early, the day the Crown came down. Here, the Chain. Here, the Scale.', '这是我的表。从初原村那座桥起的每一次日落。这里：早了四分钟，荆棘冠倒下的那天。这里，锁链。这里，秤。'),
      say('npc.nessa', 'And this is the Church\'s own chronicle of the Holy Body. Every chapel of the Five keeps a copy. Three hundred years of "the Body unchanged". And this last year...', '这是教会自己记的圣尸纪事。五苦的每座礼拜堂都有一份抄本。三百年来，一直是“圣尸如故”。可是最近这一年……'),
      say('npc.nessa', '"The Body\'s colour returned." "The Body warm to the hand." "The Body\'s eyelids moved."', '“圣尸复有血色。”“圣尸触手生温。”“圣尸眼睑微动。”'),
      say('npc.nessa', 'The days are the same. Every one of them. To the day.', '日子是一样的。每一天都对得上。一天都不差。'),
      say('pip', 'What does it mean?', '这是什么意思？', 'surprised'),
      say('npc.nessa', 'It means that every time the night grows, something in the Holy City grows with it. And they knew. They have been writing it down.', '意思是，夜晚每长一分，圣城里就有个东西跟着长一分。而且他们知道。他们一直在往下记。'),
      say('npc.nessa', 'Tell me I am wrong.', '跟我说，是我弄错了。'),
      say('player', '(You do not.)', '（你没有说。）'),
      { fact: CH4.nessa, value: 1 },
      { topic: 'quickening', days: 30 },
    ],
  },
  {
    // The ferryman at the landing, forty years with no passenger (a beat).
    id: 'landing',
    when: { map: 'nailgate', region: 'landing' },
    say: L("That boat's freshly tarred. ...But it looks like it hasn't moved in years.", '那条船刚上过焦油。……可看上去好多年没动过了。'),
  },
  {
    // The Drowned Graves at dusk: the Pale wander; far off the Rider gathers them.
    id: 'rider',
    when: { map: 'drowned', hour: { from: 17, to: 20 }, facts: { [CH4.nessa]: 1 } },
    script: [
      { music: 'crypt' },
      say('player', '(The dusk thickens. Among the leaning stones figures are walking, slowly, with nowhere to go. They are grey, and they do not look at you.)', '（暮色更浓了。歪斜的墓碑之间有人影在走，慢慢地，哪儿也不去。他们是灰色的，也不看你。）'),
      say('player', '(Far off on the eastern causeway a rider on a pale horse moves through the fog, a scythe on his shoulder. Bells ring on the horse\'s harness.)', '（远处东边的长堤上，一个骑着苍白马的人穿过雾气走来，肩上扛着一把镰刀。马具上的铃铛在响。）'),
      say('player', '(Where he passes, the grey figures stop, and turn, and walk after him toward the village.)', '（他走过的地方，那些灰色的人影停下来，转过身，跟在他后面朝村子走去。）'),
      say('pip', 'He\'s taking them home. ...He\'s so gentle with them.', '他在带他们回家。……他对他们好温柔。', 'sad'),
      { music: '' },
      { fact: CH4.rider, value: 1 },
    ],
  },
  {
    // The reliquary: the Shroud under glass, black and moving; the grey man on his knees. The pilgrim believes him.
    id: 'shroud',
    when: { map: 'boneisle.reliquary' },
    script: [
      say('player', '(A chapel of bones. The walls are skulls, row on row. At the altar a man in grey kneels with his lantern on the floor beside him. Its flame is blue, and very low.)', '（一座骨头砌成的礼拜堂。四壁是一排排头骨。祭坛前跪着一个穿灰衣的人，提灯放在他身边的地上。灯焰是蓝色的，低得几乎看不见。）'),
      { place: 'npc.severin', map: 'boneisle.reliquary', x: CH4_AT.shroud.severin[0], y: CH4_AT.shroud.severin[1] },
      { music: 'severin' },
      say('npc.severin', 'You came. ...No. Leave me. Look at the altar first.', '你来了。……别扶我。先看祭坛。'),
      say('player', '(On the altar, under glass, lies a folded cloth. It is black, and the black moves under the glass, slowly, like water under ice.)', '（祭坛上，玻璃罩下面叠着一块布。那块布是黑的，而且那片黑在玻璃底下动，慢慢地，像冰面下的水。）'),
      say('npc.severin', 'The Shroud of the Translation. It wrapped him when they carried him to the Holy City. It was white.', '移灵裹尸布。当年他们把他抬到圣城，就是用它裹的。它原本是白的。'),
      say('npc.severin', 'Your almanac-maker showed you the dates. The nights grow, and he grows warm.', '你的历书匠给你看过那些日子了。夜晚变长，他就变暖。'),
      say('npc.severin', 'He is waking. And you are carrying him his limbs.', '他正在醒来。而你，是在给他送去他的四肢。'),
      say('player', '(You think of the Crown, the Chain and the Scale in your pack. You do not argue.)', '（你想起包里的荆棘冠、锁链和秤。你没有反驳。）'),
      say('pip', '...I don\'t want to give them to him.', '……我不想把它们交给他。', 'sad'),
      say('npc.severin', 'Then do not. Take the fourth from the Rider before the Church can. Then we will see about the fifth. Together, if you will have me.', '那就别交。抢在教会前面，从骑者手里拿下第四件。然后再说第五件。我们一起，如果你愿意的话。'),
      say('player', '(He gets to his feet, and coughs, and what he coughs is ash.)', '（他站起来，咳嗽，咳出来的是灰。）'),
      say('npc.severin', 'I cannot carry another one alone. The ford is through the arch on the east shore. I will be there.', '再来一道，我一个人担不住了。渡口在东岸那座拱门后面。我会在那儿。'),
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { music: '' },
      { fact: CH4.shroud, value: 1 },
    ],
  },
  {
    // The Ford of the Dead: the Reinholder on his pale horse.
    id: 'dead_ford',
    when: { map: 'deadford', region: 'ford', facts: { [CH4.nacht]: 0 } },
    script: [
      say('player', '(A bar of grey mud in the middle of a black river. At its far end a dead tree stands in the water, three great nails through its trunk. Before it, on a pale horse hung with bells, a rider in white rags, a scythe across his saddle.)', '（黑河中央有一道灰泥滩。滩的那头，一棵枯树立在水里，树干上穿着三根大钉。树前，一匹挂满铃铛的苍白马上，坐着一个裹着白色破布的骑者，镰刀横在鞍上。）'),
      say(NACHT_ID, 'Another one, come to take them from me.', '又来了一个，要把他们从我身边带走。'),
      say(NACHT_ID, 'Do you know what is past this water now? Neither do they. None of mine go into the dark. Not while I hold the reins.', '你知道这条水那边如今是什么吗？他们也不知道。我的人，一个也不进黑暗。只要缰绳还在我手里。'),
    ],
  },
  {
    // The Reins: he lets go; the bells stop; the Holy Wood given; the dead know Lumi; the grey man, and the pilgrim's hand on the lantern.
    id: 'reins',
    when: { map: 'deadford', facts: { [CH4.nacht]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(Nacht falls from the horse into the shallows. The reins are still wound round his hand. He looks at them a long time.)', '（纳赫特从马上摔进浅水里。缰绳还缠在他手上。他盯着它们看了很久。）'),
      say('player', '("Then go. All of you.")', '（“那就走吧。你们所有人。”）', 'sad'),
      say('player', '("I cannot see where.")', '（“我看不见是哪里。”）', 'sad'),
      say('player', '(He opens his hand. The bells on the horse stop. Across the fen, all at once, everything is very quiet.)', '（他松开了手。马身上的铃铛停了。整片林沼，一下子安静得出奇。）'),
      say('player', '(He pulls a board of black wood from his saddle, three nails through it, and holds it out to you. Then he is still. The pale horse walks into the river and does not come back.)', '（他从马鞍上取下一块黑木板，上面穿着三颗钉子，递给了你。然后他就不动了。那匹苍白的马走进河里，再也没有回来。）'),
      { give: HOLY_WOOD },
      say('player', '(Something comes loose from the wood, a cold light, and runs to Lumi. More of it than ever before.)', '（木板上有什么东西散了出来，是一道冷光，流向了露米。比以往任何一次都多。）'),
      { tell: 'pip', params: { what: 'boon', unlock: 'hold', from: NACHT_ID } },
      { wait: 32 },
      say('pip', 'It came to me again. ...So much of it.', '又到我这儿来了。……好多啊。', 'surprised'),
      say('pip', 'Pilgrim, the dead in the water are looking at me. All of them. Why are they looking at me like they know me?', '朝圣者，水里的死人都在看我。所有人都在看。他们为什么像认识我一样看着我？', 'sad'),
      { place: 'npc.severin', map: 'deadford', x: FD.severin[0], y: FD.severin[1] },
      { music: 'severin' },
      say('player', '(The grey man comes out of the fog with his lantern open. The rest of the light goes toward it, and the flame bends almost flat, and he cannot hold it.)', '（灰衣人打开提灯，从雾里走出来。剩下的光朝灯流去，火苗被压得几乎贴平，他稳不住了。）'),
      say('player', '(You put your hand on the lantern beside his. The flame steadies.)', '（你把手放在灯上，和他的手并在一起。火苗稳住了。）'),
      say('npc.severin', 'Four.', '第四道了。'),
      say('npc.severin', '...We go on together.', '……我们一起往前走。'),
      { place: 'npc.severin', map: 'nailgate', x: FR.severin[0], y: FR.severin[1] },
      { fact: CH4.wood, value: 1 },
      // the fourth seal down: the night longer again (calendar.ts nightHours: dusk at five, dawn at seven)
      { fact: 'night.shift', value: 4 },
      { topic: 'reins_let_go', days: 30 },
    ],
  },
  {
    // The ferry: the dead lie down; Klaas's boat goes out full; Hedda dies glad. The chapter ends.
    id: 'the_ferry',
    when: { map: 'nailgate', facts: { [CH4.wood]: 1 }, hour: { from: 16, to: 23 } },
    script: [
      say('player', '(The walks are full of people, and the dead are lying down on them, where they stood. Their families kneel beside them. Nobody is shouting.)', '（栈道上挤满了人，死去的人就在原地躺了下来。他们的家人跪在旁边。没有人大喊大叫。）'),
      { place: 'npc.piet', map: 'nailgate', x: FR.piet[0], y: FR.piet[1] },
      say('npc.piet', 'She knew my name at the end. She said it twice, and then she lay down.', '最后她认出我了。她喊了两遍我的名字，然后就躺下了。', 'sad'),
      { place: 'npc.sanne', map: 'nailgate', x: FR.sanne[0], y: FR.sanne[1] },
      say('npc.sanne', 'Jory asked if he could go to sleep now. I said yes.', '乔里问我，他现在可不可以睡了。我说可以。', 'sad'),
      { place: 'npc.klaas', map: 'nailgate', x: FR.klaas[0], y: FR.klaas[1] },
      say('player', '(At the landing the families lay their dead in the boats, wrapped in grey. The ferryman has untied his.)', '（渡口那边，人们把裹着灰布的亲人放进船里。渡人已经解开了他的船。）'),
      say('npc.klaas', 'Forty years I kept her tarred. I thought I had forgotten the way across. I have not.', '四十年来，我一直给它上焦油。我以为我早忘了怎么过河了。我没忘。'),
      say('npc.klaas', 'Hedda went an hour ago, in her bed, with a coin in her hand. She laughed first.', '海达一个钟头前走了，在她自己的床上，手里攥着一枚钱。走之前，她还笑了一声。'),
      say('player', '(The boat goes out into the fog, low in the water, and the lamps on the walks go out one by one behind it.)', '（船驶进雾里，吃水很深。它身后，栈道上的灯一盏接一盏地灭了。）'),
      { place: 'npc.severin', map: 'nailgate', x: FR.severin[0], y: FR.severin[1] },
      say('npc.severin', 'West, then. The Heights. The fifth is under an altar there.', '那就往西。去高地。第五件在那里的一座祭坛底下。'),
      say('player', '(The sun, if there was one, has gone down. It went down at five.)', '（太阳——如果还有太阳的话——已经落下去了。五点就落了。）'),
      { place: 'npc.liese', map: 'offstage', x: 4, y: 6 },
      { place: 'npc.jory', map: 'offstage', x: 6, y: 6 },
      { place: 'npc.hedda', map: 'offstage', x: 8, y: 6 },
      { fact: CH4.end, value: 1 },
      { fact: CHAPTER_FIVE, value: 1 },
      { music: 'ending' },
    ],
  },
  {
    // The chapter's card.
    id: 'chapter4_end',
    when: { after: 'the_ferry' },
    script: [{ card: L(`${CHAPTER_END.en}\n\nThe road west into the White Altar Heights is open.`, `${CHAPTER_END.zh}\n\n往西去白坛高地的路通了。`) }],
  },
]

/** The Fens' halls and houses, linked to their doors (world.ts). */
export function fenInteriors(village: MapBuilder, isle: MapBuilder): MapBuilder[] {
  const piet = buildPietHouse()
  const hedda = buildHeddaHouse()
  const sanne = buildSanneHouse()
  const klaas = buildKlaasHouse()
  const chapel = buildFenChapel()
  const reliquary = buildReliquary()
  village.linkInterior('piet', piet)
  village.linkInterior('hedda', hedda)
  village.linkInterior('sanne', sanne)
  village.linkInterior('klaas', klaas)
  village.linkInterior('chapel', chapel)
  isle.linkInterior('reliquary', reliquary)
  return [piet, hedda, sanne, klaas, chapel, reliquary]
}

/** The scenes' people who end up nowhere a map shows: the Fens' dead, once they lie down. */
export function chapter4Offstage(m: MapBuilder): void {
  for (const [name, x, y] of [['liese.gone', 4, 6], ['jory.gone', 6, 6], ['hedda.gone', 8, 6]] as [string, number, number][]) m.anchor(name, ...spot(m, x, y, true))
}
