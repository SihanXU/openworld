// South of the forest, before the bridge chapter (docs/quests.md, docs/chapter-1.md): Thornwood Hollow, a
// thorny dell full of small things to fight, and under it the Old Barrow, where the storm-lost foragers of
// Firstlight Village are held by the dead — three floors down: the barrow (Lina's cell), the Ossuary of the
// Order of the Thorn (Oskar's cell, the Order's roll), and the Warden's Sanctum (the warden, Alberic's vow).
// All are combat zones; the barrow's floors are dark.

import type { AiData, AppearDef, Entity } from '@openworld/engine'
import { MapBuilder, rng, litterChance } from './builder.ts'
import { L, GROUND_YIELD, appears, lay } from './kit.ts'

/** The forest's new southern gap (columns), the hollow's way in from it, and the hollow's way down to the barrow. */
export const HOLLOW = { forestSouth: [12, 13, 14], north: [12, 13, 14], south: [26, 27, 28] } as const
export const BARROW = { w: 30, h: 24, north: [13, 14, 15], down: [24, 21] } as const
/** The second floor: the Order of the Thorn's ossuary — its stair up (from the barrow), its stair down (to the sanctum). */
export const OSSUARY = { w: 32, h: 24, up: [3, 2], down: [28, 3] } as const
/** The third floor: the warden's sanctum — its stair up. */
export const SANCTUM = { w: 24, h: 18, up: [12, 1] } as const
/** The floors under the barrow: reached by its stairs, not by an edge, they lie under the barrow's cell, not on one of their own. */
export const UNDER_BARROW = ['ossuary', 'sanctum'] as const

/** Where things are (the quest test reads these). */
export const HAT = {
  ring: [31, 12],
  warden: [12, 11],
  lina: [6, 19],
  oskar: [27, 19],
  roll: [15, 12],
  vow: [12, 15],
} as const satisfies Record<string, readonly [number, number]>

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 7 })
const hunters = (type: string, max: number, every: number, on: string[]): AppearDef => appears(type, on, max, every, { ai: HUNT() })

// =================================================================== Thornwood Hollow

/**
 * Set dressing with ids of its own (`<map>.<what>.<n>`): placed after a map's other things, it leaves the ids those are
 * given as they were.
 */
function dresser(m: MapBuilder) {
  const n: Record<string, number> = {}
  const put = (type: string, x: number, y: number, extra: Partial<Entity> = {}): Entity => {
    const k = type.split('/').pop()!
    n[k] = (n[k] ?? 0) + 1
    return m.fixture(type, x, y, { id: `${m.id}.${k}.${n[k]}`, ...extra })
  }
  /** Small things by mask, as MapBuilder.sprinkle, under ids of their own. */
  const strew = (type: string, p: number, where: (x: number, y: number, t: string) => boolean, [rx, ry, rw, rh]: [number, number, number, number] = [0, 0, m.w, m.h]) => {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (m.free(x, y) && where(x, y, m.get(x, y)) && rng.chance(litterChance(type, p))) put(type, x, y)
  }
  return { put, strew }
}

/**
 * Thornwood Hollow, drawn by hand (release 1, docs/release-1.md): its ground `maps/hollow.txt`, its heights
 * `maps/hollow.heights.txt`. A dell sunk a level below the forest: the forest's footpath comes in along the ledge under
 * the trees and goes down a ramp into the bottom, between the thorn thickets, past the bog, to the barrow at the far
 * end — a mound of brambles ringed with kerb stones, an arch of grey stone over the passage cut into it, two carved
 * stones before it on the trodden earth.
 */
export function buildHollow(): MapBuilder {
  const m = new MapBuilder('hollow', L('Thornwood Hollow', '荆棘谷'), 'wild', 40, 30, 'grass', 'hollow', 'outdoor', 'frostfang')
  m.gearLevel = 2
  m.paint('hollow')
  m.stumpsAsThings()
  m.lift('hollow.heights')
  // a child's ring, lost where the thorns are thickest (Mia's errand)
  m.item({ form: 'item/valuable/ring', material: 'silver', name: L("Mia's Ring", '米娅的戒指'), tags: ['keepsake'] }, ...HAT.ring).id = 'quest.mia.ring'
  // what lives here: slimes in the open bottom, spiders at the thickets, wolves on the ledge
  for (const [x, y] of [[18, 16], [15, 11], [28, 19]] as const) m.creature('slime/green_slime', x, y, HUNT(4))
  for (const [x, y] of [[12, 13], [28, 13], [19, 20]] as const) m.creature('spider', x, y, HUNT(4))
  for (const [x, y] of [[30, 7], [7, 9]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  // where the thorns grow thickest, mushrooms the First Night has woken: sporecaps (docs/creatures.md §12)
  for (const [x, y] of [[15, 21], [30, 15]] as const) m.creature('fungus/sporecap', x, y, HUNT(3))
  lay(m, 'item/material/stick', 2, [15, 3, 8, 5])
  hollowDressing(m)
  m.appear = [
    ...GROUND_YIELD,
    hunters('actor/creature/slime/green_slime', 3, 900, ['grass', 'drygrass']),
    hunters('actor/creature/spider', 3, 1200, ['grass', 'drygrass']),
  ]
  return m
}

/** What the hollow's ground holds besides its creatures: the barrow's stones, the thorns, what lies about. */
function hollowDressing(m: MapBuilder): void {
  const { put, strew } = dresser(m)
  const is = (...ts: string[]) => (t: string) => ts.includes(t)
  const wood = is('tree', 'pine')
  const low = (x: number, y: number) => m.heights[y]?.[x] === 0
  // the barrow's mouth: an arch of the Order's grey stone over its passage
  m.scenery('arch', 26, 25)
  // briars: grown over the mound, round the thickets, along the lip of the ledge
  strew('fixture/nature/briar', 0.3, (x, y, t) => is('grass', 'drygrass')(t) && !low(x, y) && y >= 26)
  const ring = (x: number, y: number) => x === HAT.ring[0] && y > HAT.ring[1] && y <= HAT.ring[1] + 2
  strew('fixture/nature/briar', 0.35, (x, y, t) => is('grass', 'drygrass')(t) && low(x, y) && m.near(x, y, is('bush')) && !m.near(x, y, is('path', 'dirt'), 1) && !ring(x, y))
  strew('fixture/nature/briar', 0.25, (x, y, t) => is('grass', 'drygrass')(t) && !low(x, y) && y > 8 && y < 26 && m.near(x, y, is('bush'), 1) && !m.near(x, y, wood, 1))
  // what lies about the bottom: stones under the rocks, leaves and ferns where the woods hang over
  strew('fixture/nature/pebbles', 0.5, (x, y, t) => is('grass', 'drygrass', 'dirt')(t) && m.near(x, y, is('rock')))
  strew('fixture/nature/reeds', 0.6, (x, y, t) => t === 'grass' && m.near(x, y, is('water')))
  strew('fixture/nature/leaves', 0.25, (x, y, t) => is('grass', 'drygrass')(t) && m.near(x, y, wood))
  strew('fixture/nature/ferns', 0.12, (x, y, t) => t === 'grass' && m.near(x, y, wood) && !low(x, y))
  put('fixture/nature/mushroom_ring', 22, 19)
  // what the wolves and the thorns have left at the thickets' feet
  for (const [x, y] of [[10, 14], [29, 14], [15, 20], [8, 15]] as const) if (m.free(x, y)) put('fixture/remains/bones', x, y)
}

// =================================================================== the Old Barrow

/** A lit brazier. */
const brazier = (m: MapBuilder, x: number, y: number) => m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })

/**
 * The Old Barrow, the first floor, drawn by hand (`maps/barrow.txt`): the passage down from the arch into an antechamber
 * of dressed stone and its columns; the gallery south, the barrow's spine; off it the west chamber, where the barrow's own
 * dead lie in niches round the walls, and the east passage, fallen in; at its end the inner hall and the Order's knight in
 * stone, and the two cells either side — Lina's, rough-cut (west), and the one with the stair cut down (east).
 */
export function buildBarrow(): MapBuilder {
  const m = new MapBuilder('barrow', L('The Old Barrow', '古墓'), 'dungeon', BARROW.w, BARROW.h, 'cave_wall', 'crypt', 'dark', 'frostfang')
  m.gearLevel = 2
  m.paint('barrow')
  for (const [x, y] of [[9, 4], [20, 4], [11, 16], [18, 16]] as const) brazier(m, x, y)
  // the dead that keep the barrow
  for (const [x, y] of [[14, 6], [15, 12], [23, 19]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  m.creature('beast/bat', 21, 12, HUNT(5))
  m.anchor('cell.lina', ...HAT.lina)
  // by Lina's cell, a helm of the Order rusted through: what lies below begins here
  m.item({ form: 'item/armor/helmet', material: 'iron', quality: 'crude', name: L('Rusted Helm of the Thorn', '生锈的荆棘骑士团头盔') }, 8, 21)
  // the east cell: a stair cut down into the rock, to the Order's ossuary
  const [dx, dy] = BARROW.down
  m.set(dx, dy, 'stairs_down')
  m.portal(dx, dy, 'ossuary', OSSUARY.up[0], OSSUARY.up[1] + 1, L('The Ossuary of the Thorn', '荆棘骸骨堂'))
  m.appear = [hunters('actor/creature/undead/skeleton', 2, 2400, ['floor_stone'])]
  const { put, strew } = dresser(m)
  // the antechamber's columns, and the gallery's
  for (const [x, y] of [[11, 4], [18, 4], [11, 6], [18, 6], [12, 9], [17, 9], [12, 13], [17, 13]] as const) m.scenery('pillar', x, y)
  // the barrow's own dead, in the niches cut round the antechamber and the west chamber
  for (const [x, y] of [[7, 5], [7, 7], [22, 5], [22, 7], [2, 11], [2, 13], [4, 9], [6, 9], [4, 15], [6, 15], [8, 15]] as const) put('fixture/remains/bones', x, y)
  // the inner hall: a knight of the Order in stone at its end, his back to the wall; more light
  m.scenery('statue_knight', 14, 19)
  brazier(m, 26, 18)
  put('fixture/light/candles', 3, 17, { statuses: { lit: -1 } })
  // the east passage, where the roof came down: the boulders it dropped, and the stones
  for (const [x, y] of [[25, 11], [26, 12], [27, 12], [24, 10], [22, 13]] as const) put('fixture/nature/boulder', x, y)
  strew('fixture/nature/pebbles', 0.55, (x, y, t) => (t === 'cave_floor' || t === 'gravel') && m.near(x, y, (_, i, j) => m.entities.some((e) => e.type === 'fixture/nature/boulder' && e.place.on === 'tile' && e.place.x === i && e.place.y === j)), [18, 9, 10, 7])
  return m
}

// =================================================================== the Ossuary of the Thorn

/** The Order of the Thorn's dead, each in a niche: who they were (one niche is empty, and waits). */
const NICHES: [number, number, string, string][] = [
  [9, 7, 'BROTHER ODO OF THE THORN. He held the gate at Varn three days. He did not kneel.', '荆棘修士奥多。他在瓦恩守了三天城门。他没有下跪。'],
  [21, 7, 'SISTER MAREN OF THE THORN, who carried water to both armies.', '荆棘修女玛伦，她给两边的军队都送过水。'],
  [10, 16, 'BROTHER TOMAS OF THE THORN, the Commander\'s brother. Warden of this house until the night comes back.', '荆棘修士托马斯，骑士长的兄弟。看守此墓，直到夜晚归来。'],
  [20, 16, 'Carved, and left empty: FENNICK, SQUIRE TO THE COMMANDER. The stone is clean. Someone keeps it swept.', '刻好了字，却空着：芬尼克，骑士长的侍从。石头很干净。有人一直在打扫。'],
]

/**
 * The Ossuary of the Thorn, the second floor, drawn by hand (`maps/ossuary.txt`): from the stair a passage down past the
 * charnel room, where the bones of the unnamed were stacked, to the hall of niches — the Order's dead in the walls, a niche
 * every other stone, columns down the hall and the roll on its altar in the middle; a gallery north-east to the stair
 * further down, Oskar's cell south-east, and a passage south that has fallen in.
 */
export function buildOssuary(): MapBuilder {
  const m = new MapBuilder('ossuary', L('The Ossuary of the Thorn', '荆棘骸骨堂'), 'dungeon', OSSUARY.w, OSSUARY.h, 'cave_wall', 'crypt', 'dark', 'frostfang')
  m.gearLevel = 3
  m.paint('ossuary')
  const [ux, uy] = OSSUARY.up
  const [dx, dy] = OSSUARY.down
  m.set(ux, uy, 'stairs_up')
  m.portal(ux, uy, 'barrow', BARROW.down[0], BARROW.down[1] - 1, L('The Old Barrow', '古墓'))
  m.set(dx, dy, 'stairs_down')
  m.portal(dx, dy, 'sanctum', SANCTUM.up[0], SANCTUM.up[1] + 1, L("The Warden's Sanctum", '守墓者圣所'))
  for (const [x, y] of [[4, 4], [13, 11], [17, 11], [24, 5], [29, 18]] as const) brazier(m, x, y)
  // the niches of the Order's dead, and the roll of the Order on its altar
  for (const [x, y, en, zh] of NICHES) m.fixture('fixture/sacred/gravestone', x, y, { name: L('A niche of the Order', '骑士团的墓龛'), props: { text: en, text_zh: zh } })
  m.fixture('fixture/sacred/altar', ...HAT.roll, {
    id: 'ossuary.roll',
    name: L('The roll of the Order', '骑士团名册'),
    tags: ['readable'],
    props: {
      text: 'THE ORDER OF THE THORN. Forty-one names, the oldest worn smooth. The last, cut deeper than the rest: ALBERIC, KNIGHT-COMMANDER, WHO KNELT TO CHILDREN. TAKEN UP BY THE HOLY CITY TO BEAR THE CROWN. HE HOLDS.',
      text_zh: '荆棘骑士团。四十一个名字，最老的已经磨平了。最后一个比别的刻得都深：阿尔贝里克，骑士长，曾向孩子们下跪。蒙圣城擢选，承戴荆棘冠。他坚守着。',
    },
  })
  // what the Order's dead were laid down with (Vowbound: theirs, and it remembers): Odo's pauldrons, Maren's ring
  // (their vows, content VOWS — and migrateGear.ts NAMED_VOWS for a save from before: Odo held the gate, Maren gave water)
  m.item({ form: 'item/armor/pauldrons', material: 'steel', quality: 'vowed', name: L("Brother Odo's Pauldrons", '奥多修士的护肩'), vow: 'holdfast' }, 9, 8)
  m.item({ form: 'item/valuable/ring', material: 'silver', quality: 'vowed', name: L("Sister Maren's Ring", '玛伦修女的戒指'), vow: 'mercy', props: { def: 1, lifesteal: 1 } }, 21, 8)
  m.regions.oskar_cell = [24, 17, 7, 5]
  m.regions.niches = [8, 6, 15, 12]
  m.anchor('cell.oskar', ...HAT.oskar)
  // the Order's dead do not lie still
  for (const [x, y] of [[ux, 7], [12, 10], [18, 13], [26, 7]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  m.creature('undead/ghost', 15, 14, HUNT(5))
  m.creature('beast/bat', 25, 20, HUNT(5))
  m.appear = [hunters('actor/creature/undead/skeleton', 3, 2400, ['floor_stone'])]
  const { put, strew } = dresser(m)
  // the hall's columns, two rows of them either side of the roll
  for (const [x, y] of [[11, 8], [19, 8], [11, 13], [19, 13]] as const) m.scenery('pillar', x, y)
  // in every niche but the named ones, the Order's dead; Fennick's, empty, has a candle someone keeps lit
  const named = new Set(NICHES.map(([x, y]) => `${x},${y}`))
  for (let x = 9; x <= 21; x += 2) if (!named.has(`${x},7`)) put('fixture/remains/bones', x, 7)
  for (let x = 14; x <= 18; x += 2) put('fixture/remains/bones', x, 16)
  put('fixture/remains/bones', 22, 11)
  put('fixture/light/candles', 20, 15, { statuses: { lit: -1 } })
  // the charnel room: bones heaped along its walls, in its alcoves
  for (const [x, y] of [[1, 12], [1, 14], [1, 16], [3, 18], [5, 18], [2, 11], [6, 12], [6, 15], [2, 17], [5, 11]] as const) put('fixture/remains/bones', x, y)
  // the gallery to the stair down: two of the Order in stone, keeping it
  for (const x of [23, 28]) m.scenery('statue_knight', x, 7)
  // the fallen passage: the boulders that came down, and the stones
  for (const [x, y] of [[8, 19], [8, 20], [9, 21]] as const) put('fixture/nature/boulder', x, y)
  strew('fixture/nature/pebbles', 0.55, (x, y, t) => (t === 'cave_floor' || t === 'gravel') && m.near(x, y, (_, i, j) => m.entities.some((e) => e.type === 'fixture/nature/boulder' && e.place.on === 'tile' && e.place.x === i && e.place.y === j)), [8, 16, 7, 6])
  return m
}

// =================================================================== the Warden's Sanctum

/**
 * The Warden's Sanctum, the bottom, drawn by hand (`maps/sanctum.txt`): the stair down into one chamber, an octagon round
 * the floor where the warden keeps its post — room to keep out of the ring it strikes when it holds — two knights of the
 * Order in stone in its side bays, and in the apse at its south end the altar of the Commander's vow.
 */
export function buildSanctum(): MapBuilder {
  const m = new MapBuilder('sanctum', L("The Warden's Sanctum", '守墓者圣所'), 'dungeon', SANCTUM.w, SANCTUM.h, 'cave_wall', 'crypt', 'dark', 'frostfang')
  m.gearLevel = 4
  m.paint('sanctum')
  const [ux, uy] = SANCTUM.up
  m.set(ux, uy, 'stairs_up')
  m.portal(ux, uy, 'ossuary', OSSUARY.down[0] - 1, OSSUARY.down[1] + 1, L('The Ossuary of the Thorn', '荆棘骸骨堂'))
  for (const [x, y] of [[6, 6], [17, 6], [6, 13], [17, 13]] as const) brazier(m, x, y)
  m.fixture('fixture/sacred/altar', ...HAT.vow, {
    id: 'sanctum.vow',
    name: L("The Commander's vow", '骑士长的誓言'),
    tags: ['readable'],
    props: {
      text: 'Cut into the altar, in a knight\'s plain hand: "I WILL HOLD UNTIL I AM RELIEVED. — ALBERIC." Below it, newer, pressed into the soot with a thumb: a mark of ash.',
      text_zh: '祭坛上刻着一行朴素的骑士字迹："我将坚守，直到有人来接替我。——阿尔贝里克。"下面是新的痕迹，用拇指按在烟灰里：一个灰印。',
    },
  })
  m.regions.vow = [8, 13, 9, 4]
  // the warden, Brother Tomas: falling, it leaves the belt it kept its vigil in
  const warden = m.creature('undead/warden', ...HAT.warden, { id: 'barrow.warden', ...HUNT(6), leash: 6 })
  m.item({ form: 'item/clothing/belt', material: 'leather', quality: 'vowed', name: L("Tomas's Belt of Vigil", '托马斯的守夜腰带'), vow: 'vigil', props: { 'night:def': 2 } }, ...HAT.warden).place = { on: 'inside', holder: warden.id }
  for (const [x, y] of [[8, 10], [16, 10]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  const { put } = dresser(m)
  // the Order's knights in stone in the side bays; candles either side of the vow; the columns by the way in
  for (const x of [2, 20]) m.scenery('statue_knight', x, 9)
  for (const x of [10, 14]) put('fixture/light/candles', x, 15, { statuses: { lit: -1 } })
  for (const x of [9, 15]) m.scenery('pillar', x, 4)
  return m
}
