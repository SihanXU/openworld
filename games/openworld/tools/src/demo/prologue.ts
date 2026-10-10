// The prologue's maps (docs/prologue.md), north of the Ford and stacked down the mountain:
// Cloudtop (the summit plateau, where a new game begins) and the Mountain Foot. Cloudtop's only
// way down is a cut through the rock of its south rim; the foot's trail comes down off the high
// ground by a ramp, levels out where an old seal stone nobody can read stands in a ring of
// flowers, and runs out of the map's south edge at the top of the Ford's cliff.

import { MapBuilder, rng } from './builder.ts'
import { TUTORIAL_DUMMY, TUTORIAL_OPEN } from '@lsw/content'
import { L, GROUND_YIELD, appears } from './kit.ts'

/** Edge openings: the foot's way in from the north (the tutorial's road comes out there), its way out below, the Ford's cliff stair. */
export const PROLOGUE = {
  summitSouth: [19, 20, 21],
  footNorth: [19, 20, 21],
  footSouth: [17, 18],
  fordNorth: [17, 18],
} as const

/** Where things are at the foot (the tests read these). */
export const PAT = {
  /** where a new game begins: in the ruined watch shelter on Cloudtop */
  spawn: [10, 5],
  summitStone: [25, 7],
  /** the gap in the cut, Cloudtop's only way down */
  cut: [20, 20],
  /** the rune-cut seal stone: nothing in the world defines it */
  relic: [20, 12],
  footStone: [24, 20],
  /** the ramp down off the high ground (two columns wide), from its top */
  ramp: [20, 3],
} as const satisfies Record<string, readonly [number, number]>

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
  const m = new MapBuilder('summit', L('Cloudtop', '云顶台地'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  // the plateau's rim: bare rock, the south edge open only where the trail goes down
  rim(m, (x, y) => y >= m.h - 3 && gap(PROLOGUE.summitSouth, x), () => 'rock')
  // the high ground is snow, with rock standing out of it and a few pines
  m.organic(20, 4.5, 17, 4, 'snow', { only: (t) => t === 'grass', rough: 0.3 })
  m.organic(31, 9, 5, 3, 'snow', { only: (t) => t === 'grass', rough: 0.3 })
  for (const [x, y] of [[4, 3], [17, 3], [30, 3], [34, 6], [33, 12], [5, 16], [35, 17]] as const) m.set(x, y, 'rock')
  for (const [x, y] of [[15, 6], [28, 4], [36, 9], [3, 11], [31, 15], [8, 18], [26, 17]] as const) m.set(x, y, 'pine')
  // the ruined watch shelter one wakes in: its walls stand, its door faces the berries
  m.rect(6, 3, 9, 6, 'woodwall')
  m.rect(7, 4, 7, 4, 'floor_wood')
  m.set(10, 8, 'floor_wood')
  // the yard before the door: berries, and what an axe is made of
  for (const [x, y] of [[8, 11], [12, 12], [14, 10]] as const) m.item('item/food/berries', x, y)
  for (const [x, y] of [[6, 13], [16, 12]] as const) m.item('item/material/stick', x, y)
  for (const [x, y] of [[12, 14], [18, 13]] as const) m.item('item/material/stone', x, y)
  for (const [x, y] of [[9, 14], [15, 14]] as const) m.item('item/material/grass', x, y)
  m.fixture('fixture/sacred/waypoint', ...PAT.summitStone, { id: 'wp.summit', name: L('Cloudtop statue', '云顶台地传送雕像') })
  // the cut: a wall of rock across the plateau, one gap where the trail goes down; the plateau
  // stands two levels above the land below it, a ramp through the gap (each row half a level lower)
  const [cx, cy] = PAT.cut
  for (let x = 2; x < m.w - 2; x++) for (const y of [cy, cy + 1]) if (x !== cx) m.set(x, y, 'rock')
  m.raise(0, 0, m.w, cy + 2, 4)
  for (const [dy, h] of [[0, 3], [1, 2], [2, 1]] as const) m.raise(cx, cy + dy, 1, 1, h)
  m.path([[10, 9], [13, 13], [18, 16], [20, 19]], 'path', 1)
  m.path([[20, 22], [20, 25], [20, 29]], 'path', 2)
  m.anchor('spawn', ...PAT.spawn)
  m.appear = GROUND_YIELD
  return m
}

// =================================================================== the Mountain Foot

export function buildFoot(): MapBuilder {
  const m = new MapBuilder('foot', L('Mountain Foot', '山脚'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  rim(m, (x, y) => (y < 3 && gap(PROLOGUE.footNorth, x)) || (y >= m.h - 3 && gap(PROLOGUE.footSouth, x)), () => (rng.chance(0.6) ? 'tree' : 'pine'))
  // the high ground the trail comes down from stands two levels above the rest, its edge a face of
  // rock: a ramp runs down where the trail does (each row half a level lower), a drop anywhere else hurts
  const [rx, ry] = PAT.ramp
  m.raise(0, 0, m.w, ry + 3, 4)
  for (let x = 2; x < m.w - 2; x++) if (x !== rx && x !== rx + 1) m.set(x, ry + 2, 'rock')
  for (const [dy, h] of [[1, 3], [2, 2], [3, 1]] as const) m.raise(rx, ry + dy, 2, 1, h)
  // where the trail levels out: a ring of flowers round an old seal stone nobody can read
  m.organic(20, 12, 6, 4, 'flowers', { only: (t) => t === 'grass', rough: 0.25 })
  m.fixture('fixture/sacred/seal_stone', ...PAT.relic)
  m.regions.relic = [14, 7, 13, 10]
  m.fixture('fixture/sacred/waypoint', ...PAT.footStone, { id: 'wp.foot', name: L('Mountain Foot statue', '山脚传送雕像') })
  // a hunter's hut, long left: wooden walls on a wooden floor, its door gone
  m.rect(4, 12, 6, 5, 'woodwall')
  m.rect(5, 13, 4, 3, 'floor_wood')
  m.set(6, 16, 'floor_wood')
  m.path([[20, 0], [20, 7], [24, 12], [21, 17], [18, 22], [17, 29]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  m.fixture('fixture/sign', 19, 25, { props: { text: 'The Ford ↓', text_zh: '渡口 ↓' } })
  m.appear = GROUND_YIELD
  return m
}

// =================================================================== the tutorial

/** The tutorial clearing: where a new game begins unless the player skips it (then: the Mountain Foot). */
export const TUTORIAL = {
  size: [36, 26],
  /** where one comes round */
  spawn: [12, 12],
  /** the path out, south, two columns wide: open once the story says so */
  exit: [17, 18],
  /** where one comes out at the foot: the top of its trail */
  arrive: [20, 1],
  /** what lies about the clearing to begin with */
  berries: [[11, 10], [14, 11], [13, 14], [9, 11], [15, 13], [12, 16]],
  sticks: [[8, 13], [16, 9], [9, 16]],
  stones: [[7, 10], [15, 15], [10, 17], [17, 12]],
  grass: [[6, 12], [13, 8], [11, 15], [16, 14], [8, 9]],
  /** the grove on the clearing's east side: the wood a house is made of */
  grove: [[25, 9], [28, 8], [27, 12], [30, 11], [26, 15], [29, 16], [31, 13]],
} as const

/**
 * The tutorial (docs/prologue.md): a clearing ringed by forest where one comes round, finds food,
 * gathers, makes an axe, cuts wood, lights a fire, builds a house and gets through a night. It lies
 * on no cell of the overworld and nothing leads back into it: a scene played once. Its one way out,
 * the path south to the Mountain Foot, opens on the first morning after the house stands. It is a
 * combat zone: the night's walkers come.
 */
export function buildTutorial(): MapBuilder {
  const [w, h] = TUTORIAL.size
  const m = new MapBuilder('tutorial', L('The Clearing', '林间空地'), 'wild', w, h, 'grass', 'forest', 'outdoor', 'frostfang')
  const exit = TUTORIAL.exit as readonly number[]
  rim(m, (x, y) => y >= h - 3 && exit.includes(x), () => (rng.chance(0.6) ? 'tree' : 'pine'))
  for (const [x, y] of TUTORIAL.grove) m.set(x, y, 'tree')
  m.organic(21, 6, 3, 2, 'flowers', { only: (t) => t === 'grass', rough: 0.3 })
  m.path([[exit[0], 18], [exit[0], h - 1]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  for (const [x, y] of TUTORIAL.berries) m.item('item/food/berries', x, y)
  for (const [x, y] of TUTORIAL.sticks) m.item('item/material/stick', x, y)
  for (const [x, y] of TUTORIAL.stones) m.item('item/material/stone', x, y)
  for (const [x, y] of TUTORIAL.grass) m.item('item/material/grass', x, y)
  // a training dummy beside where the house goes: the tutorial's blow lesson (it stands up again)
  m.fixture('fixture/dummy', TUTORIAL_DUMMY[0], TUTORIAL_DUMMY[1])
  m.regions.exit = [exit[0] - 3, h - 5, 8, 5]
  // the way out: only once the story has opened it
  for (const [i, x] of exit.entries()) m.portals.push({ x, y: h - 1, to: 'foot', tx: TUTORIAL.arrive[0] + i, ty: TUTORIAL.arrive[1], label: L('Mountain Foot', '山脚'), opensWhen: TUTORIAL_OPEN })
  m.anchors.spawn = [TUTORIAL.spawn[0], TUTORIAL.spawn[1]]
  // the clearing's own: berries keep turning up, enough to eat one's fill before the night
  m.appear = [...GROUND_YIELD, appears('item/food/berries', ['grass'], 6)]
  return m
}
