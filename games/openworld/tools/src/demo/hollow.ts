// South of the forest, before the bridge chapter (docs/quests.md, docs/chapter-1.md): Thornwood Hollow, a
// thorny dell full of small things to fight, and under it the Old Barrow, where the storm-lost foragers of
// Firstlight Village are held by the dead — three floors down: the barrow (Lina's cell), the Ossuary of the
// Order of the Thorn (Oskar's cell, the Order's roll), and the Warden's Sanctum (the warden, Alberic's vow).
// All are combat zones; the barrow's floors are dark.

import type { AiData, AppearDef } from '@openworld/engine'
import { MapBuilder, rng } from './builder.ts'
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
  ring: [31, 9],
  warden: [12, 11],
  lina: [6, 19],
  oskar: [27, 19],
  roll: [15, 12],
  vow: [12, 15],
} as const satisfies Record<string, readonly [number, number]>

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 7 })
const hunters = (type: string, max: number, every: number, on: string[]): AppearDef => appears(type, on, max, every, { ai: HUNT() })

// =================================================================== Thornwood Hollow

export function buildHollow(): MapBuilder {
  const m = new MapBuilder('hollow', L('Thornwood Hollow', '荆棘谷'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  const gap = (xs: readonly number[], x: number) => xs.includes(x)
  // thick woods and thorn bushes round the dell, open north (the forest) and south (the barrow's mouth)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if ((y < 4 && gap(HOLLOW.north, x)) || (y >= m.h - 4 && gap(HOLLOW.south, x))) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 4 && rng.chance(0.5))) m.set(x, y, rng.chance(0.35) ? 'bush' : rng.chance(0.4) ? 'pine' : 'tree')
    }
  // thorn thickets inside, dry grass where the sun gets in, a muddy bottom
  for (const [cx, cy, rx, ry] of [[9, 12, 3, 2], [30, 14, 3.4, 2.2], [19, 21, 2.6, 1.8]] as const) m.organic(cx, cy, rx, ry, 'bush', { only: (t) => t === 'grass', rough: 0.35 })
  m.organic(22, 9, 5, 3, 'drygrass', { only: (t) => t === 'grass', rough: 0.3 })
  m.organic(14, 24, 3, 1.8, 'mud', { only: (t) => t === 'grass' })
  m.path([[13, 0], [14, 6], [20, 10], [25, 16], [27, 22], [27, 29]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  // the barrow's mouth at the bottom: standing stones either side
  for (const [x, y] of [[25, 26], [29, 26]] as const) m.set(x, y, 'rock')
  // a child's ring, lost where the thorns are thickest (Mia's errand)
  m.item({ form: 'item/valuable/ring', material: 'silver', name: L("Mia's Ring", '米娅的戒指'), tags: ['keepsake'] }, ...HAT.ring).id = 'quest.mia.ring'
  // what lives here: slimes in the open, spiders in the thorns, wolves on the far side
  for (const [x, y] of [[18, 7], [24, 12], [11, 18]] as const) m.creature('slime/green_slime', x, y, HUNT(4))
  for (const [x, y] of [[8, 9], [31, 11], [21, 19]] as const) m.creature('spider', x, y, HUNT(4))
  for (const [x, y] of [[33, 20], [6, 22]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  lay(m, 'item/material/stick', 2, [15, 3, 8, 5])
  m.appear = [
    ...GROUND_YIELD,
    hunters('actor/creature/slime/green_slime', 3, 900, ['grass', 'drygrass']),
    hunters('actor/creature/spider', 3, 1200, ['grass', 'drygrass']),
  ]
  return m
}

// =================================================================== the Old Barrow

export function buildBarrow(): MapBuilder {
  const m = new MapBuilder('barrow', L('The Old Barrow', '古墓'), 'dungeon', BARROW.w, BARROW.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  const open = (t: string) => t === 'cave_wall'
  // the stair down from the hollow (north), a long hall, two side cells: Lina's (west), the stair further down (east)
  m.path([[14, 0], [14, 6], [15, 11], [15, 16]], 'floor_stone', 3)
  m.organic(15, 17, 5, 2.6, 'floor_stone', { only: open, rough: 0.15 })
  m.path([[15, 16], [9, 18], [6, 19]], 'floor_stone', 2)
  m.path([[15, 16], [21, 18], [24, 19]], 'floor_stone', 2)
  for (const [cx, cy] of [[6, 20], [24, 20]] as const) m.organic(cx, cy, 2.2, 1.6, 'floor_stone', { only: open })
  for (const [x, y] of [[13, 3], [16, 9], [12, 15], [18, 15]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  // the dead that keep the barrow
  for (const [x, y] of [[14, 5], [16, 12], [21, 18]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  m.creature('beast/bat', 9, 18, HUNT(5))
  m.anchor('cell.lina', ...HAT.lina)
  // by Lina's cell, a helm of the Order rusted through: what lies below begins here
  m.item({ form: 'item/armor/helmet', material: 'iron', quality: 'crude', name: L('Rusted Helm of the Thorn', '生锈的荆棘骑士团头盔') }, 9, 20)
  // the east cell: a stair cut down into the rock, to the Order's ossuary
  const [dx, dy] = BARROW.down
  m.set(dx, dy, 'stairs_down')
  m.portal(dx, dy, 'ossuary', OSSUARY.up[0], OSSUARY.up[1] + 1, L('The Ossuary of the Thorn', '荆棘骸骨堂'))
  m.appear = [hunters('actor/creature/undead/skeleton', 2, 2400, ['floor_stone'])]
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

export function buildOssuary(): MapBuilder {
  const m = new MapBuilder('ossuary', L('The Ossuary of the Thorn', '荆棘骸骨堂'), 'dungeon', OSSUARY.w, OSSUARY.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  const open = (t: string) => t === 'cave_wall'
  const [ux, uy] = OSSUARY.up
  const [dx, dy] = OSSUARY.down
  // from the stair down a passage to the hall of niches; a gallery north-east to the stair further down; Oskar's cell south-east
  m.path([[ux, uy], [ux, 8], [15, 8], [15, 16], [26, 18]], 'floor_stone', 3)
  m.organic(15, 12, 7, 4, 'floor_stone', { only: open, rough: 0.1 })
  m.path([[15, 8], [22, 5], [dx, dy + 1]], 'floor_stone', 2)
  m.organic(27, 19, 2.6, 2, 'floor_stone', { only: open })
  m.set(ux, uy, 'stairs_up')
  m.portal(ux, uy, 'barrow', BARROW.down[0], BARROW.down[1] - 1, L('The Old Barrow', '古墓'))
  m.set(dx, dy, 'stairs_down')
  m.portal(dx, dy, 'sanctum', SANCTUM.up[0], SANCTUM.up[1] + 1, L("The Warden's Sanctum", '守墓者圣所'))
  for (const [x, y] of [[ux + 1, 6], [11, 10], [19, 10], [15, 17], [25, 17]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
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
  m.item({ form: 'item/armor/pauldrons', material: 'steel', quality: 'vowed', name: L("Brother Odo's Pauldrons", '奥多修士的护肩'), props: { def: 3, holdFast: 0.25 } }, 9, 8)
  m.item({ form: 'item/valuable/ring', material: 'silver', quality: 'vowed', name: L("Sister Maren's Ring", '玛伦修女的戒指'), props: { atk: 1, def: 1, lifesteal: 1 } }, 21, 8)
  m.regions.oskar_cell = [24, 17, 7, 5]
  m.regions.niches = [8, 6, 15, 12]
  m.anchor('cell.oskar', ...HAT.oskar)
  // the Order's dead do not lie still
  for (const [x, y] of [[ux, 7], [13, 12], [18, 13], [22, 5]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  m.creature('undead/ghost', 15, 15, HUNT(5))
  m.creature('beast/bat', 24, 18, HUNT(5))
  m.appear = [hunters('actor/creature/undead/skeleton', 3, 2400, ['floor_stone'])]
  return m
}

// =================================================================== the Warden's Sanctum

export function buildSanctum(): MapBuilder {
  const m = new MapBuilder('sanctum', L("The Warden's Sanctum", '守墓者圣所'), 'dungeon', SANCTUM.w, SANCTUM.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  const open = (t: string) => t === 'cave_wall'
  const [ux, uy] = SANCTUM.up
  // a stair down into one round chamber: the warden before the altar of the Commander's vow
  m.path([[ux, uy], [ux, 6]], 'floor_stone', 3)
  m.organic(12, 11, 7.5, 5, 'floor_stone', { only: open, rough: 0.08 })
  m.set(ux, uy, 'stairs_up')
  m.portal(ux, uy, 'ossuary', OSSUARY.down[0] - 1, OSSUARY.down[1] + 1, L('The Ossuary of the Thorn', '荆棘骸骨堂'))
  for (const [x, y] of [[6, 8], [18, 8], [6, 14], [18, 14]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
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
  m.item({ form: 'item/clothing/belt', material: 'leather', quality: 'vowed', name: L("Tomas's Belt of Vigil", '托马斯的守夜腰带'), props: { def: 2, 'night:def': 2 } }, ...HAT.warden).place = { on: 'inside', holder: warden.id }
  for (const [x, y] of [[8, 10], [16, 10]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  return m
}
