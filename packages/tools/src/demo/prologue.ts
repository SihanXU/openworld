// The prologue's maps (docs/prologue.md), north of the Ford and stacked down the mountain:
// Cloudtop (the summit plateau), Pinewind Slope, and the Mountain Foot, whose trail comes out
// at the top of the Ford's cliff. Each teaches by its shape first: the shelter opens onto
// berries, the only way off the plateau is a cut with a pine grown across it, slimes sit on the
// switchbacks, an old seal stone nobody can read stands where the trail levels out.

import type { AiData, AppearDef } from '@lsw/engine'
import { MapBuilder, rng } from './builder.ts'
import { L, GROUND_YIELD, appears, lay } from './kit.ts'

/** Edge openings: each map's way in from above and out below (columns), and the Ford's cliff stair. */
export const PROLOGUE = {
  summitSouth: [19, 20, 21],
  slopeNorth: [19, 20, 21],
  slopeSouth: [19, 20, 21],
  footNorth: [19, 20, 21],
  footSouth: [17, 18],
  fordNorth: [17, 18],
} as const

/** Where things are on the mountain (the prologue test reads these). */
export const PAT = {
  spawn: [10, 5],
  summitStone: [25, 7],
  /** the pine grown across the cut, the plateau's only way down */
  pine: [20, 20],
  slopeStone: [27, 13],
  slopeFire: [30, 13],
  /** the rune-cut seal stone at the foot: nothing in the world defines it */
  relic: [20, 12],
  footStone: [24, 20],
} as const satisfies Record<string, readonly [number, number]>

const SLIME: Omit<AiData, 'home'> = { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 6 }

/** Pines and rock round a map's edge, open where `open(x, y)` says. */
function rim(m: MapBuilder, open: (x: number, y: number) => boolean, t: () => string): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (open(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 3 && rng.chance(0.45))) m.set(x, y, t())
    }
}

const gap = (cols: readonly number[], x: number) => cols.includes(x)

// =================================================================== Cloudtop: the summit

export function buildSummit(): MapBuilder {
  const m = new MapBuilder('summit', L('Cloudtop', '云顶台地'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  // the plateau's rim: bare rock, the south edge open only where the cut comes out
  rim(m, (x, y) => y >= m.h - 3 && gap(PROLOGUE.summitSouth, x), () => 'rock')
  // the high ground is snow, with rock standing out of it and a few pines
  m.organic(20, 4.5, 17, 4, 'snow', { only: (t) => t === 'grass', rough: 0.3 })
  m.organic(31, 9, 5, 3, 'snow', { only: (t) => t === 'grass', rough: 0.3 })
  for (const [x, y] of [[4, 3], [17, 3], [30, 3], [34, 6], [33, 12], [5, 16], [35, 17]] as const) m.set(x, y, 'rock')
  for (const [x, y] of [[15, 6], [28, 4], [36, 9], [3, 11], [31, 15], [8, 18], [26, 17]] as const) m.set(x, y, 'pine')
  // the ruined watch shelter you wake in: its walls stand, its door faces the berries
  m.rect(6, 3, 9, 6, 'woodwall')
  m.rect(7, 4, 7, 4, 'floor_wood')
  m.set(10, 8, 'floor_wood')
  m.regions.shelter = [7, 4, 7, 4]
  // the yard before the door: berries, and what an axe is made of
  m.regions.yard = [5, 9, 13, 6]
  for (const [x, y] of [[8, 11], [12, 12], [14, 10]] as const) m.item('item/food/berries', x, y)
  for (const [x, y] of [[6, 13], [16, 12]] as const) m.item('item/material/stick', x, y)
  for (const [x, y] of [[12, 14], [18, 13]] as const) m.item('item/material/stone', x, y)
  for (const [x, y] of [[9, 14], [15, 14]] as const) m.item('item/material/grass', x, y)
  // the waypoint statue on the snow
  m.fixture('fixture/sacred/waypoint', ...PAT.summitStone, { id: 'wp.summit', name: L('Cloudtop', '云顶台地') })
  // the cut: a wall of rock across the plateau, one gap, and a pine grown into it
  for (let x = 2; x < m.w - 2; x++) for (const y of [20, 21]) m.set(x, y, x === PAT.pine[0] ? 'grass' : 'rock')
  m.set(...PAT.pine, 'pine')
  m.regions.below_cut = [2, 22, m.w - 4, 6]
  // the plateau stands two levels above the land below the cut, the cut its cliff: a ramp runs
  // down through the gap (each column half a level lower), and a drop anywhere else hurts
  m.raise(0, 0, m.w, 22, 4)
  for (const [y, h] of [[20, 3], [21, 2], [22, 1]] as const) m.raise(PAT.pine[0], y, 1, 1, h)
  m.path([[10, 9], [13, 13], [18, 16], [20, 19]], 'path', 1)
  m.path([[20, 22], [20, 25], [20, 29]], 'path', 2)
  m.anchor('spawn', ...PAT.spawn)
  m.appear = GROUND_YIELD
  return m
}

// =================================================================== Pinewind Slope

export function buildSlope(): MapBuilder {
  const m = new MapBuilder('slope', L('Pinewind Slope', '松风坡'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  rim(m, (x, y) => (y < 3 && gap(PROLOGUE.slopeNorth, x)) || (y >= m.h - 3 && gap(PROLOGUE.slopeSouth, x)), () => (rng.chance(0.7) ? 'pine' : 'rock'))
  // switchbacks: ledges of rock across the slope, each open at one end
  for (let x = 2; x < 31; x++) m.set(x, 8, 'rock')
  for (let x = 10; x < m.w - 2; x++) m.set(x, 16, 'rock')
  for (let x = 2; x < 31; x++) m.set(x, 23, 'rock')
  m.path([[20, 0], [20, 5], [34, 6], [34, 11], [6, 12], [6, 19], [34, 20], [34, 25], [20, 26], [20, 29]], 'path', 1, { edge: 'dirt', edgeP: 0.2 })
  // the slimes on the switchbacks (and more come: the slope breeds them)
  for (const [x, y] of [[16, 11], [25, 13], [28, 19], [13, 20]] as const) m.creature('slime/green_slime', x, y, { ...SLIME })
  // half way down: a fire someone keeps, and a waypoint statue beside it
  m.fixture('fixture/light/campfire', ...PAT.slopeFire, { statuses: { lit: -1 } })
  m.fixture('fixture/sacred/waypoint', ...PAT.slopeStone, { id: 'wp.slope', name: L('Pinewind Slope', '松风坡') })
  lay(m, 'item/food/berries', 2, [8, 17, 10, 4])
  const slimes: AppearDef = appears('actor/creature/slime/green_slime', ['grass'], 4, 1200, { ai: { ...SLIME } })
  m.appear = [...GROUND_YIELD, slimes]
  return m
}

// =================================================================== the Mountain Foot

export function buildFoot(): MapBuilder {
  const m = new MapBuilder('foot', L('Mountain Foot', '山脚'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  rim(m, (x, y) => (y < 3 && gap(PROLOGUE.footNorth, x)) || (y >= m.h - 3 && gap(PROLOGUE.footSouth, x)), () => (rng.chance(0.6) ? 'tree' : 'pine'))
  // where the trail levels out: a ring of flowers round an old seal stone nobody can read
  m.organic(20, 12, 6, 4, 'flowers', { only: (t) => t === 'grass', rough: 0.25 })
  m.fixture('fixture/sacred/seal_stone', ...PAT.relic)
  m.regions.relic = [14, 7, 13, 10]
  m.fixture('fixture/sacred/waypoint', ...PAT.footStone, { id: 'wp.foot', name: L('Mountain Foot', '山脚') })
  m.path([[20, 0], [20, 7], [24, 12], [21, 17], [18, 22], [17, 29]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  m.fixture('fixture/sign', 19, 25, { props: { text: 'The Ford ↓' } })
  m.appear = GROUND_YIELD
  return m
}

// =================================================================== the tutorial

/** The tutorial plot: where a new game begins unless the player skips it (then: the Mountain Foot). */
export const TUTORIAL = {
  size: [20, 14],
  spawn: [10, 7],
  /** where a game that skips the tutorial begins: the trail coming down onto the foot */
  skip: [20, 3],
} as const

/**
 * The tutorial: an empty plot of grass and nothing else, with no way out — it lies on no cell of
 * the overworld and has no portal, so its edges are the world's edge. Nothing appears on it and
 * nothing comes out of its dark.
 */
export function buildTutorial(): MapBuilder {
  const [w, h] = TUTORIAL.size
  const m = new MapBuilder('tutorial', L('Tutorial', '新手教程'), 'wild', w, h, 'grass', 'Village', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  m.anchors.spawn = [TUTORIAL.spawn[0], TUTORIAL.spawn[1]]
  return m
}
