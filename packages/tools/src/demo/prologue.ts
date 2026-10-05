// The prologue's map (docs/prologue.md): the Mountain Foot, north of the Ford, where the game
// proper begins — whether one comes down from the tutorial or skips it. The trail comes down off
// the high ground by a ramp, levels out where an old seal stone nobody can read stands in a ring
// of flowers, and runs out of the map's south edge at the top of the Ford's cliff.

import { MapBuilder, rng } from './builder.ts'
import { L, GROUND_YIELD } from './kit.ts'

/** Edge openings: the foot's way in from the north (the tutorial's road comes out there), its way out below, the Ford's cliff stair. */
export const PROLOGUE = {
  footNorth: [19, 20, 21],
  footSouth: [17, 18],
  fordNorth: [17, 18],
} as const

/** Where things are at the foot (the tests read these). */
export const PAT = {
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

// =================================================================== the Mountain Foot

export function buildFoot(): MapBuilder {
  const m = new MapBuilder('foot', L('Mountain Foot', '山脚'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
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
  m.fixture('fixture/sacred/waypoint', ...PAT.footStone, { id: 'wp.foot', name: L('Mountain Foot', '山脚') })
  // a hunter's hut, long left: wooden walls on a wooden floor, its door gone
  m.rect(4, 12, 6, 5, 'woodwall')
  m.rect(5, 13, 4, 3, 'floor_wood')
  m.set(6, 16, 'floor_wood')
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
  skip: [20, 1],
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
