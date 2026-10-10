// The main quest's maps (docs/main-quest.md), east of the Ford: the East Road, Emberfall, the
// Old Mine north of it, Cinder Pass east of it, and the Dragon's Lair at the top of the pass.
// Each is built from its own seed (world.ts), linked edge to edge, and every placed thing
// witnesses a requirement in tools/test/demo.test.ts.

import type { AiData, AppearDef } from '@openworld/engine'
import { BOSS_ARENA } from '@openworld-game/content'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears, clump, lay } from '../kit.ts'

const tree = () => (rng.chance(0.3) ? 'pine' : 'tree')
const grassy = (t: string) => t === 'grass'

/** Woods round a map's edge, two to four deep, open where `open(x, y)` says (a road's gap). */
function woods(m: MapBuilder, open: (x: number, y: number) => boolean): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (open(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 4 && rng.chance(0.5 - edge * 0.1))) m.set(x, y, tree())
    }
}

/** Monsters that come back on a map now and then (MapData.appear with a behaviour). */
const hunters = (type: string, max: number, every: number, on: string[], ai: Partial<Omit<AiData, 'home'>> = {}): AppearDef =>
  appears(type, on, max, every, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, ...ai } })

// =================================================================== the East Road (chapter 2)

/** Rows where the road enters from the Ford (its east edge) and leaves for Emberfall. */
export const EAST_ROAD = { w: 48, h: 24, west: [11, 12, 13], east: [10, 11, 12], fordEast: [12, 13, 14] } as const

export function buildEastRoad(): MapBuilder {
  const m = new MapBuilder('eastroad', L('The East Road', '东大路'), 'wild', EAST_ROAD.w, EAST_ROAD.h, 'grass', 'field', 'outdoor', 'frostfang')
  woods(m, (x, y) => (x < 4 && (EAST_ROAD.west as readonly number[]).includes(y)) || (x >= m.w - 4 && (EAST_ROAD.east as readonly number[]).includes(y)))
  for (const [cx, cy, r] of [[8, 4.5, 2.4], [14, 19, 2.6], [33, 4, 2.2], [41, 19, 2.8], [44, 5, 2]] as const) clump(m, cx, cy, r, 0.7)
  m.path([[0, 12], [6, 12], [12, 10], [20, 11], [28, 13], [36, 11], [42, 11], [47, 11]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  // the burned farmstead north of the road: the house still stands; the yard, the hay and the orchard are ash
  m.organic(24, 6, 6, 3, 'ash', { only: grassy, rough: 0.25 })
  m.scenery('house_wood', 22, 3)
  for (const [x, y] of [[19, 5], [28, 4], [29, 7], [20, 8]] as const) m.set(x, y, 'charred_tree')
  m.fixture('fixture/nature/haystack', 26, 7, { statuses: { lit: -1 } })
  m.regions = { farmstead: [17, 2, 15, 8] }
  m.fixture('fixture/sign', 4, 10, { props: { text: 'Emberfall →', text_zh: '余烬镇 →' } })
  // the road's dangers: a pair of wolves, a boar in the brush
  m.creature('beast/wolf', 33, 15, { sight: 5 })
  m.creature('beast/wolf', 36, 17, { sight: 5 })
  m.creature('beast/boar', 12, 16, { temper: 'wary', sight: 4 })
  lay(m, 'item/material/stick', 2, [6, 14, 8, 5])
  lay(m, 'item/material/stone', 2, [36, 5, 8, 4])
  m.appear = [...GROUND_YIELD, hunters('actor/creature/beast/wolf', 2, 2400, ['grass'])]
  // a trodden clearing off the road (the Boss Studio's and the challenge's stage)
  m.organic(BOSS_ARENA.x, BOSS_ARENA.y, 7, 4, 'dirt', { only: (t) => t === 'grass', rough: 0.12 })
  return m
}

// =================================================================== Emberfall (chapter 3)

/** Emberfall's three ways out: west to the road, north to the mine, east to the pass. */
export const EMBERFALL = { w: 40, h: 30, west: [14, 15, 16], north: [19, 20, 21], east: [8, 9, 10] } as const

export function buildEmberfall(): MapBuilder {
  const m = new MapBuilder('emberfall', L('Emberfall', '余烬镇'), 'village', EMBERFALL.w, EMBERFALL.h, 'grass', 'village', 'outdoor', 'frostfang')
  const has = (xs: readonly number[], v: number) => xs.includes(v)
  // the mountain to the north, its mine mouth; woods west, south and east, with the roads' gaps
  for (let y = 0; y < 4; y++) for (let x = 0; x < m.w; x++) if (!(has(EMBERFALL.north, x) && y < 4)) m.set(x, y, 'cave_wall')
  woods(m, (x, y) => y < 4 || (x < 4 && has(EMBERFALL.west, y)) || (x >= m.w - 4 && has(EMBERFALL.east, y)))
  // roads: in from the west to the square; up to the mine; out east to the pass
  m.path([[0, 15], [10, 15], [16, 14]], 'path', 2, { edge: 'dirt', edgeP: 0.15 })
  m.path([[20, 0], [20, 6], [20, 11]], 'path', 2)
  m.path([[24, 14], [32, 11], [39, 9]], 'path', 2, { edge: 'dirt', edgeP: 0.15 })
  // the square: cobbles round the well
  m.organic(20, 14, 4.6, 3, 'cobble', { only: (t) => t === 'grass' || t === 'path' })
  m.fixture('fixture/water/well', 20, 14)
  m.fixture('fixture/sign/noticeboard', 17, 12, { props: { text: 'DRAGON SEEN OVER CINDER PEAK. KEEP THE BUCKETS FULL.', text_zh: '烬峰上空有龙出没。水桶要一直盛满。' } })
  for (const [x, y] of [[16, 17], [24, 11]] as const) m.fixture('fixture/light/lamppost', x, y, { statuses: { lit: -1 } })
  // houses round the square; some roofs new thatch, the dragon's last visit
  m.scenery('house_orange', 6, 6)
  m.scenery('house_red', 11, 5)
  m.scenery('house_thatch', 6, 21)
  m.scenery('house_plaster', 30, 21)
  m.scenery('teahouse', 18, 20) // the elder's house
  // the smithy: the forge and the anvil out front
  m.scenery('smithy', 27, 5)
  m.fixture('fixture/craft/forge', 31, 7, { id: 'emberfall.forge', statuses: { lit: -1 } })
  m.fixture('fixture/craft/anvil', 29, 9)
  m.fixture('fixture/container/barrel', 26, 8)
  // the herbalist's hut and her cauldron
  m.scenery('hut_straw', 9, 13)
  m.fixture('fixture/craft/cauldron', 12, 16, { id: 'emberfall.cauldron', statuses: { lit: -1 } })
  m.fixture('fixture/container/crate', 8, 16)
  // a few things of a village: hens about, flowers by the doors, a scorched patch where the dragon breathed
  for (const [x, y] of [[14, 9], [25, 17]] as const) m.creature('animal/chicken', x, y, { behaviour: 'passive', temper: 'wary', sight: 4, leash: 5 })
  m.organic(33, 16, 2.4, 1.6, 'ash', { only: grassy })
  m.sprinkle('fixture/nature/flowers', 0.08, (x, y, t) => t === 'grass' && m.near(x, y, (u) => u === 'cobble' || u === 'path', 2))
  m.sprinkle('fixture/nature/tuft', 0.05, (_x, _y, t) => t === 'grass')
  // anchors for the people (people/*.ts): where they work and where they sleep
  m.anchor('elder.square', 21, 16)
  m.anchor('elder.home', 19, 23)
  m.anchor('smith.anvil', 29, 10)
  m.anchor('smith.home', 28, 8)
  m.anchor('herb.cauldron', 12, 17)
  m.anchor('herb.home', 10, 15)
  m.regions = { gate: [0, 12, 6, 7] }
  m.appear = [...GROUND_YIELD]
  return m
}

// =================================================================== the Old Mine (chapter 4)

export const MINE = { w: 40, h: 30, south: [19, 20, 21] } as const
/** The deep vein's chamber, where the cyclops waits. */
export const DEEP = { x: 20, y: 5 } as const

export function buildMine(): MapBuilder {
  const m = new MapBuilder('mine', L('The Old Mine', '旧矿坑'), 'dungeon', MINE.w, MINE.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  const open = (t: string) => t === 'cave_wall'
  // the main shaft from the mouth north to the deep chamber, side galleries east and west
  m.path([[20, 29], [20, 22], [17, 17], [20, 12], [20, 8]], 'cave_floor', 3)
  m.path([[17, 17], [9, 16], [6, 10]], 'cave_floor', 2)
  m.path([[20, 22], [29, 21], [33, 14]], 'cave_floor', 2)
  m.path([[19, 23], [15, 22], [12, 21]], 'cave_floor', 2)
  for (const [cx, cy, rx, ry] of [[20, 26, 3, 2.4], [8, 9, 3.4, 2.6], [32, 12, 3.4, 2.6], [12, 21, 2.6, 2], [20, 5, 5, 3]] as const) m.organic(cx, cy, rx, ry, 'cave_floor', { only: open, rough: 0.2 })
  // veins in the galleries, coal and iron; the richest iron in the deep chamber
  for (const [x, y] of [[6, 8], [10, 10], [33, 11], [12, 20]] as const) m.fixture('fixture/nature/vein/coal', x, y)
  for (const [x, y] of [[31, 14], [9, 8], [18, 4], [22, 4]] as const) m.fixture('fixture/nature/vein/iron', x, y)
  // and gold, only there (the Held Ground's last widening asks for it)
  for (const [x, y] of [[17, 6], [23, 6]] as const) m.fixture('fixture/nature/vein/gold', x, y)
  // braziers along the shaft (a dark mine), an old pickaxe at the mouth
  for (const [x, y] of [[18, 26], [22, 20], [18, 13], [22, 7]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  m.item({ form: 'item/tool/pickaxe', material: 'iron', name: L('Old Pickaxe', '旧镐') }, 21, 27)
  // what lives here: bats, spiders, the dead miners; the cyclops at the deep vein
  for (const [x, y] of [[8, 11], [31, 11]] as const) m.creature('beast/bat', x, y, { sight: 5 })
  for (const [x, y] of [[12, 21], [29, 20], [7, 15]] as const) m.creature('spider', x, y, { sight: 4 })
  m.creature('undead/skeleton', 20, 14, { sight: 5 })
  // it has hoarded ore from the vein: what it carries spills when it falls
  m.creature('cyclops', DEEP.x, DEEP.y, { id: 'mine.cyclops', sight: 5, leash: 6, loot: ['item/material/iron_ore', 'item/material/iron_ore'] })
  m.regions = { deep: [14, 1, 13, 7] }
  // the mine gives back slowly: veins in the galleries, and what hunts there
  m.appear = [
    appears('fixture/nature/vein/iron', ['cave_floor'], 4, 1800),
    appears('fixture/nature/vein/coal', ['cave_floor'], 4, 1800),
    appears('fixture/nature/vein/gold', ['cave_floor'], 2, 3600),
    hunters('actor/creature/spider', 3, 1500, ['cave_floor']),
    hunters('actor/creature/beast/bat', 2, 1800, ['cave_floor']),
  ]
  return m
}

// =================================================================== Cinder Pass (chapter 5)

export const PASS = { w: 30, h: 40, west: [34, 35, 36], north: [14, 15, 16] } as const

export function buildPass(): MapBuilder {
  const m = new MapBuilder('pass', L('Cinder Pass', '烬岭山道'), 'wild', PASS.w, PASS.h, 'snow', 'field', 'outdoor', 'frostfang')
  const has = (xs: readonly number[], v: number) => xs.includes(v)
  // rock walls both sides of a climbing trail; snow below, scorched rock and ash near the top
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const edge = Math.min(x, m.w - 1 - x)
      const gap = (x < 3 && has(PASS.west, y)) || (y < 3 && has(PASS.north, x))
      if (!gap && (edge < 3 || y < 2 || y >= m.h - 2 || (edge < 5 && rng.chance(0.4)))) m.set(x, y, 'rock')
    }
  m.organic(15, 9, 9, 6, 'ash', { only: (t) => t === 'snow', rough: 0.3 })
  m.path([[0, 35], [8, 34], [20, 30], [10, 24], [21, 18], [12, 12], [15, 6], [15, 0]], 'path', 2)
  for (const [x, y] of [[6, 28], [23, 24], [7, 18], [22, 12], [9, 8]] as const) m.set(x, y, 'charred_tree')
  // the last camp below the lair: a fire to cook at and rest by
  m.fixture('fixture/light/campfire', 18, 21, { statuses: { lit: -1 } })
  m.anchor('camp', 17, 21)
  // the pass's guardians: frost wolves below, fire imps and a golem nearer the dragon
  m.creature('beast/frost_wolf', 12, 31, { sight: 5 })
  m.creature('beast/frost_wolf', 22, 27, { sight: 5 })
  m.creature('imp/fire_imp', 9, 15, { sight: 6 })
  m.creature('imp/fire_imp', 20, 9, { sight: 6 })
  m.creature('golem/stone_golem', 14, 4, { sight: 4, leash: 5 })
  lay(m, 'item/material/stone', 2, [10, 28, 10, 6])
  m.appear = [hunters('actor/creature/imp/fire_imp', 2, 2400, ['ash'], { behaviour: 'ranged', sight: 6 })]
  return m
}

// =================================================================== the Dragon's Lair (chapter 6)

export const LAIR = { w: 30, h: 24, south: [14, 15, 16] } as const
export const DRAGON_AT = { x: 15, y: 7 } as const

export function buildLair(): MapBuilder {
  const m = new MapBuilder('lair', L("The Dragon's Lair", '魔龙巢穴'), 'dungeon', LAIR.w, LAIR.h, 'cave_wall', 'battle', 'dark', 'frostfang')
  // an arena of scorched stone, rock pillars along its walls, the mouth in the south
  m.organic(15, 11, 12, 8.5, 'cave_floor', { only: (t) => t === 'cave_wall', rough: 0.15 })
  m.path([[15, 23], [15, 17]], 'cave_floor', 3)
  for (const [cx, cy, rx, ry] of [[5, 6, 1.6, 1.2], [25, 6, 1.6, 1.2], [6, 15, 1.4, 1.1], [24, 15, 1.4, 1.1]] as const) m.organic(cx, cy, rx, ry, 'rock', { only: (t) => t === 'cave_floor' })
  m.organic(15, 8, 5, 3, 'ash', { only: (t) => t === 'cave_floor' })
  for (const [x, y] of [[9, 18], [21, 18], [8, 4], [22, 4]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  m.creature('dragon', DRAGON_AT.x, DRAGON_AT.y, { id: 'lair.dragon', behaviour: 'ranged', temper: 'aggressive', sight: 9, leash: 9 })
  m.regions = { mouth: [11, 17, 9, 6] }
  return m
}
