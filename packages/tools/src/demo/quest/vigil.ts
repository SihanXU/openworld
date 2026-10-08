// Firstlight's own country (docs/chapter-1.md §13): what the village's vigil asks for, after the rescue and before the
// night of thanks — Millbrook to the west (the miller's press, its cellar, where the vigil oil is kept) and Dawn Hill to
// the north (where the first dawn after the First Night was seen: dawnbloom on its slopes, the ruined Chapel of the
// First Dawn on its top, and the bell that was rung that morning).

import type { AiData } from '@lsw/engine'
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
  rim(m, (x, y) => y >= m.h - 3 && (VIGIL.hillSouth as readonly number[]).includes(x))
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
  m.fixture('fixture/sacred/waypoint', 17, 9, { id: 'wp.dawnhill', name: L('Dawn Hill', '晨光丘') })
  for (const [x, y] of [[8, 20], [32, 18]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  m.appear = [...GROUND_YIELD, appears('item/material/herb', ['flowers', 'grass'], 3, 1200)]
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
