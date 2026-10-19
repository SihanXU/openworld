// Firstlight's own country (docs/chapter-1.md §13): what the village's vigil asks for, after the rescue and before the
// night of thanks — Millbrook to the west (the miller's press, its cellar, where the vigil oil is kept) and Dawn Hill to
// the north (where the first dawn after the First Night was seen: dawnbloom on its slopes, the ruined Chapel of the
// First Dawn on its top, and the bell that was rung that morning) — and, dug into the hill's western flank, the Dawn
// Hill Mine: the first chapter's ore for the smithy, its veins growing back in a day where they were mined.

import type { AiData } from '@openworld/engine'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears } from '../kit.ts'

/** Edge openings: Firstlight's new west gap (rows) and north gap (columns), and where they meet the new maps. */
export const VIGIL = {
  villageWest: [17, 18, 19],
  millEast: [17, 18, 19],
  villageNorth: [24, 25, 26],
  hillSouth: [19, 20, 21],
  /** where the vigil's things are */
  oil: [[4, 3], [11, 3]] as const,
  bloom: [[9, 17], [29, 15], [14, 9], [31, 21]] as const,
  stone: [24, 7] as const,
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })

/** Woods round a map's edge, open where `open(x, y)` says. */
function rim(m: MapBuilder, open: (x: number, y: number) => boolean): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (open(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 3 && rng.chance(0.45))) m.set(x, y, rng.chance(0.3) ? 'pine' : 'tree')
    }
}

// =================================================================== Millbrook

export function buildMillbrook(): MapBuilder {
  const m = new MapBuilder('mill', L('Millbrook', '水车磨坊'), 'village', 40, 30, 'grass', 'village', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  rim(m, (x, y) => x >= m.w - 3 && (VIGIL.millEast as readonly number[]).includes(y))
  // the brook, north to south, a footbridge over it; the mill on its east bank
  m.path([[10, 0], [9, 8], [11, 16], [9, 24], [10, 29]], 'water', 3)
  m.path([[39, 18], [28, 17], [20, 13], [17, 11]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  m.path([[20, 13], [13, 14], [6, 15]], 'path', 1)
  for (let x = 8; x <= 12; x++) if (m.get(x, 14) === 'water') m.set(x, 14, 'bridge')
  m.house('longhouse', 15, 3, 'mill')
  m.anchor('mill.yard', 18, 12)
  m.anchor('mill.bed', 21, 9)
  // a field of wheat gone thin in the short days
  for (let y = 19; y < 24; y++) for (let x = 20; x < 30; x++) m.set(x, y, 'farmland')
  m.fixture('fixture/sign', 30, 16, { props: { text: 'MILLBROOK — flour and lamp oil for Firstlight.', text_zh: '水车磨坊——为初原村供应面粉和灯油。' } })
  m.sprinkle('fixture/nature/flowers', 0.05, (x, y, t) => t === 'grass')
  m.sprinkle('fixture/nature/reeds', 0.3, (x, y, t) => t === 'grass' && m.near(x, y, (n) => n === 'water', 1))
  m.appear = GROUND_YIELD
  return m
}

/** The mill's cellar, under the press: where the vigil oil is kept, and where something has moved in. */
export function buildMillCellar(): MapBuilder {
  const m = new MapBuilder('millcellar', L('The Mill Cellar', '磨坊地窖'), 'interior', 16, 12, 'floor_stone', 'cave', 'dark', 'frostfang')
  m.gearLevel = 2
  m.room('stone', 'floor_stone')
  for (const [x, y] of [[2, 2], [13, 2], [2, 9], [13, 9]] as const) m.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[6, 2], [9, 2]] as const) m.fixture('fixture/container/crate', x, y)
  m.fixture('fixture/light/candles', 7, 9, { statuses: { lit: -1 } })
  for (const [x, y] of VIGIL.oil) m.item({ form: 'item/vessel/flask/oil', name: L('Vigil Oil', '守夜灯油') }, x, y)
  for (const [x, y] of [[4, 6], [11, 6]] as const) m.creature('slime/green_slime', x, y, HUNT(4))
  m.creature('spider', 8, 4, HUNT(4))
  return m
}

// =================================================================== Dawn Hill

export function buildDawnHill(): MapBuilder {
  const m = new MapBuilder('dawnhill', L('Dawn Hill', '晨光丘'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  m.gearLevel = 2
  rim(m, (x, y) => (y >= m.h - 3 && (VIGIL.hillSouth as readonly number[]).includes(x)) || (x < 3 && (HILL_MINE.hillWest as readonly number[]).includes(y)))
  // the hill rises to the north: its top two levels up, a path winding to the chapel
  m.raise(10, 2, 20, 9, 2)
  for (let x = 10; x < 30; x++) if (x < 19 || x > 21) m.set(x, 11, 'rock')
  for (const [dy, h] of [[0, 1]] as const) m.raise(19, 11 + dy, 3, 1, h)
  m.path([[20, 29], [20, 20], [24, 15], [20, 11], [20, 8]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.house('temple', 19, 4, 'chapel')
  m.organic(20, 16, 9, 4, 'flowers', { only: (t) => t === 'grass', rough: 0.3 })
  // the stone where the first dawn was seen, and dawnbloom where it fell
  m.fixture('fixture/sacred/seal_stone', ...VIGIL.stone, { name: L('The Dawnstone', '晨光石'), tags: ['readable'], props: { text: 'Cut deep, and old: HERE THE SUN ROSE AGAIN. Below, newer: five small wounds, and a flame.', text_zh: '刻得很深，也很古老：太阳在此重新升起。下面是较新的刻痕：五道小伤痕，和一团火。' } })
  for (const [x, y] of VIGIL.bloom) m.item({ form: 'item/material/herb', name: L('Dawnbloom', '晨光花') }, x, y)
  m.fixture('fixture/sacred/waypoint', 17, 9, { id: 'wp.dawnhill', name: L('Dawn Hill statue', '晨光丘传送雕像') })
  for (const [x, y] of [[8, 20], [32, 18]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  // up on the open top, where the storms break first: spark slimes, charged by them (docs/creatures.md §3.4)
  for (const [x, y] of [[13, 6], [26, 7]] as const) m.creature('slime/spark_slime', x, y, HUNT(4))
  // west, into the hill's flank: the track to the mine's adit (buildHillMine), a sign where it leaves the path
  m.path([[0, HILL_MINE.hillWest[0]], [8, HILL_MINE.hillWest[0]], [14, 19], [20, 20]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.fixture('fixture/sign', 5, 16, { props: { text: '← The mine', text_zh: '← 矿洞' } })
  m.appear = [...GROUND_YIELD, appears('item/material/herb', ['flowers', 'grass'], 3, 1200)]
  return m
}

// =================================================================== the Dawn Hill Mine

/** The mine in Dawn Hill's west flank: its size, its adit's rows on its east edge, and the hill's west-edge rows it opens onto. */
export const HILL_MINE = { w: 30, h: 22, east: [11, 12], hillWest: [18, 19] } as const

/**
 * The mine dug into Dawn Hill's western flank (docs/chapter-1.md §13), a field west of the village's smithy: the first
 * chapter's ore. An adit from the east edge runs west into a hall; a gallery climbs north of it, another drops south. Iron in the hall and the north
 * gallery, coal in the south, boulders by the adit; braziers along the way; a worn pickaxe left at the mouth. A vein
 * mined grows back where it was in a day (content ontology.ts, spent veins). Bats roost here and come back; stone lies
 * about and comes back. No gold: that is the Old Mine's and the quarry's.
 */
export function buildHillMine(): MapBuilder {
  const m = new MapBuilder('hillmine', L('Dawn Hill Mine', '晨光丘矿洞'), 'dungeon', HILL_MINE.w, HILL_MINE.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  m.gearLevel = 2
  const open = (t: string) => t === 'cave_wall'
  const [ey] = HILL_MINE.east
  // the adit, the hall, the galleries
  m.path([[m.w - 1, ey + 1], [22, ey + 1], [15, 11], [8, 11]], 'cave_floor', 3)
  m.path([[15, 11], [15, 5], [9, 4]], 'cave_floor', 2)
  m.path([[15, 11], [16, 17], [22, 18]], 'cave_floor', 2)
  for (const [cx, cy, rx, ry] of [[8, 11, 3.2, 2.4], [9, 4, 2.8, 2], [22, 18, 3, 2], [24, 12, 2.4, 2]] as const) m.organic(cx, cy, rx, ry, 'cave_floor', { only: open, rough: 0.2 })
  /** A thing of the mine stands on its floor (the map is checked as it is built). */
  const floor = (x: number, y: number): [number, number] => {
    if (m.get(x, y) !== 'cave_floor') throw new Error(`hillmine: ${x},${y} is ${m.get(x, y)}, not cave floor`)
    return [x, y]
  }
  // veins: iron in the hall and the north gallery, coal in the south gallery; boulders by the adit
  for (const [x, y] of [[6, 10], [9, 9], [9, 2], [12, 5], [20, 19]] as const) m.fixture('fixture/nature/vein/iron', ...floor(x, y))
  for (const [x, y] of [[22, 16], [24, 18], [6, 12], [7, 3]] as const) m.fixture('fixture/nature/vein/coal', ...floor(x, y))
  for (const [x, y] of [[24, 10], [22, 13], [26, 13]] as const) m.fixture('fixture/nature/boulder', ...floor(x, y))
  for (const [x, y] of [[26, 11], [16, 10], [15, 7]] as const) m.fixture('fixture/light/brazier', ...floor(x, y), { statuses: { lit: -1 } })
  // a worn pickaxe at the mouth: whoever walks up from the village can dig at once (one is two stones, two sticks and grass by hand too)
  m.item({ form: 'item/tool/pickaxe', material: 'stone', name: L('Worn Pickaxe', '磨损的镐') }, ...floor(27, ey + 1))
  for (const [x, y] of [[9, 4], [22, 18]] as const) m.creature('beast/bat', ...floor(x, y), { sight: 5 })
  m.appear = [
    appears('item/material/stone', ['cave_floor'], 4),
    appears('actor/creature/beast/bat', ['cave_floor'], 2, 1800, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5 } }),
  ]
  return m
}


/** The Chapel of the First Dawn: roofless, cold, its bell still hanging in the tower. */
export function buildChapel(): MapBuilder {
  const m = new MapBuilder('chapel', L('Chapel of the First Dawn', '初晓礼拜堂'), 'interior', 14, 12, 'floor_stone', 'temple', 'indoor', 'frostfang')
  m.room('stone', 'floor_stone')
  m.fixture('fixture/sacred/altar', 7, 3, { name: L('The first hearth', '最初的火坛'), tags: ['readable'], props: { text: 'A stone hearth, cold for centuries. Soot in the cracks: the Firstlight was kindled here from the dawn, and carried down the hill.', text_zh: '一座石砌的火坛，冷了几百年。裂缝里还有烟灰：初火就是在这里借着晨光点燃，再被带下山去的。' } })
  for (const [x, y] of [[3, 3], [9, 3]] as const) m.fixture('fixture/light/candles', x, y)
  for (const [x, y] of [[3, 7], [10, 7]] as const) m.fixture('fixture/furniture/bench', x, y)
  // the bell tower: its rope in the north-east corner
  m.regions.belfry = [10, 1, 3, 2]
  m.creature('beast/bat', 6, 6, HUNT(4))
  return m
}
