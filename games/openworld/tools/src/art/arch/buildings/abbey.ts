// The church of Sunwell Abbey (docs/showcase.md §4.1): a cathedral on the plan of the great French ones — Reims,
// Amiens, Cologne — turned to the game's view, its west front facing south toward the one who comes. Twin towers with
// open spires, three portals (the middle one under a gabled porch, its door the way in), a rose over them and a
// gallery of kings across; a nave of five bays and aisles, flying buttresses on piers crowned with pinnacles; a
// transept with a rose in each arm; a lantern tower over the crossing with a spire; a choir of three bays and a chevet
// — the apse, the ambulatory round it and five chapels radiating from it, each under its own cone.

import type { Model, Ornament } from '../oblique.ts'
import { backOf, box, doorSlab, drum, flyer, gable, halfCone, leanTo, merlons, octagon, recess, spire, type Solid } from '../shapes.ts'
import { crockets, cross, lancet, opening, portal, rose, statue, type Glass } from '../ornaments.ts'

const S = 16
/** The church's width in cells (the transept's span) and its middle. */
const W = 26
const C = 13 * S
/** Rows: the chevet 0–8, the choir 8–17, the transept 17–23, the nave 23–38, the towers 38–43, the porch 43. */
const CHOIR = 8
const TRANSEPT = 17
const NAVE = 23
const FRONT = 38
const FACE = 43
const D = 44

// heights
const AISLE = 56
const AISLE_TOP = 84
const EAVE = 128
const RIDGE = 56
const PIER = 100
const TOWER = 262
const SPIRE = 104

export function abbeyChurch(): Model {
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const fp: string[][] = Array.from({ length: D }, () => Array(W).fill(' '))
  const block = (x0: number, y0: number, x1: number, y1: number, c = '#') => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (y >= 0 && y < D && x >= 0 && x < W) fp[y][x] = c
  }

  // ------------------------------------------------------------------ the body: nave and choir, their aisles
  for (const [y0, y1] of [[CHOIR, TRANSEPT], [NAVE, FRONT]] as const) {
    solids.push(box(10 * S, y0 * S, 0, 16 * S, y1 * S, EAVE, 'stone'))
    solids.push(gable(10 * S - 3, y0 * S, 16 * S + 3, y1 * S, EAVE, RIDGE, 'y', 'slate', 'stone'))
    solids.push(box(7 * S, y0 * S, 0, 10 * S, y1 * S, AISLE, 'stone'))
    solids.push(box(16 * S, y0 * S, 0, 19 * S, y1 * S, AISLE, 'stone'))
    solids.push(leanTo(7 * S - 2, y0 * S, 10 * S, y1 * S, AISLE, AISLE_TOP - AISLE, 'e', 'slate'))
    solids.push(leanTo(16 * S, y0 * S, 19 * S + 2, y1 * S, AISLE, AISLE_TOP - AISLE, 'w', 'slate'))
    // a cresting of small merlons along the nave's ridge, the lead's gilt
    solids.push(merlons(C - 1, y0 * S, C + 1, y1 * S, EAVE + RIDGE - 1, 4, 3, 5, 'y', 'gold'))
    block(7, y0, 19, y1)
    // the bays: a pier outside each aisle at every bay line, a flyer from it over the aisle to the clerestory, a
    // pinnacle on it
    for (let y: number = y0; y <= y1; y += 3) {
      if (y === y1 && (y1 as number) === FRONT) continue
      const cy = y * S
      for (const side of [-1, 1]) {
        const px0 = side < 0 ? 5 * S + 2 : 20 * S - 2 - 12
        const pcx = px0 + 6
        const wall = side < 0 ? 10 * S : 16 * S
        solids.push(box(px0, cy - 6, 0, px0 + 12, cy + 6, PIER, 'stone'))
        solids.push(spire(pcx, cy, 7, PIER, 34, 4, 'stone'))
        solids.push(flyer(side < 0 ? px0 + 12 : px0, wall, cy, 6, PIER - 8, EAVE - 14, 8, 'stone'))
        // a second, higher flyer, as Amiens has
        solids.push(flyer(side < 0 ? px0 + 12 : px0, wall, cy, 4, PIER + 6, EAVE + 6, 5, 'stone'))
        const fx = side < 0 ? 5 : 20
        block(fx, Math.max(0, y - 1), fx + 1, Math.min(D, y + 1))
        block(side < 0 ? 6 : 19, Math.max(0, y - 1), side < 0 ? 7 : 20, Math.min(D, y + 1))
      }
    }
  }

  // ------------------------------------------------------------------ the transept, a rose and a portal in each arm
  solids.push(box(0, TRANSEPT * S, 0, W * S, NAVE * S, EAVE, 'stone'))
  solids.push(gable(0, TRANSEPT * S - 3, W * S, NAVE * S + 3, EAVE, RIDGE - 8, 'x', 'slate', 'stone'))
  block(0, TRANSEPT, W, NAVE)
  for (const ax of [3.5 * S, (W - 3.5) * S]) {
    const fy = NAVE * S
    // buttresses either side of the arm's face
    for (const bx of [ax - 3 * S, ax + 3 * S - 8]) {
      solids.push(box(bx, fy - 4, 0, bx + 8, fy + 6, EAVE - 8, 'stone'))
      solids.push(spire(bx + 4, fy + 1, 5, EAVE - 8, 30, 4, 'stone'))
    }
    voids.push(...recess(ax, fy, 62, 42, 42, 6, 'circle', 2, 3))
    orn.push(rose(17).at(ax - 17, backOf(fy, 6), 66))
    voids.push(...recess(ax, fy, 0, 30, 54, 10, 'pointed', 3, 3))
    solids.push(doorSlab(ax, backOf(fy, 10), 0, 18, 44, 'pointed'))
    orn.push(portal(18, 44, 0).at(ax - 9, backOf(fy, 10) - 1, 0))
    for (const k of [-1, 1]) {
      voids.push(...recess(ax + k * 24, fy, 16, 12, 38, 4, 'pointed'))
      orn.push(lancet(8, 34, 'blue').at(ax + k * 24 - 4, backOf(fy, 4), 16))
    }
    voids.push(...recess(ax, fy, 108, 10, 22, 4, 'pointed'))
    orn.push(statue(7, 18).at(ax - 3, backOf(fy, 4), 110))
  }

  // ------------------------------------------------------------------ the crossing's lantern and its spire
  solids.push(box(10 * S - 4, TRANSEPT * S - 4, 0, 16 * S + 4, NAVE * S + 4, EAVE + RIDGE + 30, 'stone'))
  solids.push(octagon(C, (TRANSEPT + 3) * S, 40, EAVE + RIDGE + 30, EAVE + RIDGE + 34, 'stone'))
  solids.push(spire(C, (TRANSEPT + 3) * S, 36, EAVE + RIDGE + 34, 110, 8, 'slate'))
  for (const k of [-1, 0, 1]) orn.push(lancet(10, 26, 'gold').at(C + k * 18 - 5, NAVE * S + 4, EAVE + RIDGE + 2))
  orn.push(cross(11).at(C - 2, (TRANSEPT + 3) * S, EAVE + RIDGE + 34 + 108, true))

  // ------------------------------------------------------------------ the chevet: apse, ambulatory, five chapels
  const ay = CHOIR * S
  solids.push(drum(C, ay, 96, 0, AISLE, 'stone', 'n'))
  solids.push(halfCone(C, ay, 100, AISLE, 52, 'n', 'slate'))
  solids.push(drum(C, ay, 48, 0, EAVE, 'stone', 'n'))
  solids.push(halfCone(C, ay, 52, EAVE, RIDGE, 'n', 'slate'))
  for (const deg of [-80, -40, 0, 40, 80]) {
    const a = (deg * Math.PI) / 180
    const cx = C + Math.sin(a) * 102
    const cy = ay - Math.cos(a) * 102
    solids.push(drum(cx, cy, 24, 0, AISLE - 4, 'stone'))
    solids.push(spire(cx, cy, 27, AISLE - 4, 30, 0, 'slate'))
  }
  for (let y = 0; y < CHOIR + 1; y++)
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5) * S
      const py = (y + 0.5) * S
      const r = Math.hypot(px - C, py - ay)
      const chapel = [-80, -40, 0, 40, 80].some((deg) => {
        const a = (deg * Math.PI) / 180
        return Math.hypot(px - (C + Math.sin(a) * 102), py - (ay - Math.cos(a) * 102)) < 24
      })
      if ((py <= ay && r < 96) || chapel) fp[y][x] = '#'
    }
  // the chevet's flyers, a pier between each two chapels
  for (const deg of [-60, -20, 20, 60]) {
    const a = (deg * Math.PI) / 180
    const px = C + Math.sin(a) * 104
    const py = ay - Math.cos(a) * 104
    solids.push(box(px - 6, py - 6, 0, px + 6, py + 6, PIER - 10, 'stone'))
    solids.push(spire(px, py, 7, PIER - 10, 30, 4, 'stone'))
  }

  // ------------------------------------------------------------------ the west front, turned south: towers, porch
  // Reims and Amiens: three tall bays between four great buttresses, each bay a portal deep in its archivolts, a band of
  // statues (the gallery of kings) across all three, the rose over the middle in its own deep ring, the towers' belfries
  // with their paired louvred lancets, open spires crocketed up their edges.
  const fy = FACE * S
  const MID = 200
  solids.push(box(10 * S, FRONT * S, 0, 16 * S, fy, MID, 'stone'))
  // its gable before the nave's roof, a statue in a niche in it, a cross on its point
  solids.push(gable(10 * S, fy - 12, 16 * S, fy, MID, 54, 'y', 'stone', 'stone'))
  voids.push(...recess(C, fy, MID + 6, 12, 26, 4, 'pointed'))
  orn.push(statue(7, 20, true).at(C - 3, backOf(fy, 4), MID + 8))
  orn.push(cross(11).at(C - 2, fy - 2, MID + 52, true))
  // the string courses that run across the whole front: under the gallery, over it, at the belfries' sills
  for (const z of [116, 150]) solids.push(box(5 * S - 4, fy - 2, z, 21 * S + 4, fy + 1, z + 4, 'stone'))
  for (const x0 of [5 * S - 4, 16 * S - 2]) solids.push(box(x0, fy - 2, TOWER - 84, x0 + 5 * S + 6, fy + 1, TOWER - 80, 'stone'))
  for (const tx of [5, 16]) {
    const x0 = tx * S
    const x1 = (tx + 5) * S
    const mx = (x0 + x1) / 2
    const cy = (FRONT + 2.5) * S
    solids.push(box(x0, FRONT * S, 0, x1, fy, TOWER, 'stone'))
    // the great buttresses at the tower's corners, stepping back twice as they rise, a pinnacle on each
    for (const bx of [x0 - 4, x1 - 12]) {
      solids.push(box(bx, fy - 6, 0, bx + 16, fy + 14, 96, 'stone'))
      solids.push(leanTo(bx, fy + 2, bx + 16, fy + 14, 96, 10, 'n', 'stone'))
      solids.push(box(bx + 2, fy - 6, 96, bx + 14, fy + 8, 170, 'stone'))
      solids.push(leanTo(bx + 2, fy, bx + 14, fy + 8, 170, 8, 'n', 'stone'))
      solids.push(box(bx + 4, fy - 6, 170, bx + 12, fy + 3, TOWER - 10, 'stone'))
      solids.push(spire(bx + 8, fy - 1, 6, TOWER - 10, 44, 4, 'spireStone'))
      orn.push(...crockets(bx + 8, fy - 1, 6, TOWER - 10, 44, 8))
    }
    // the open balustrade round the tower's top, a pinnacle at each corner, the spire's octagon and the spire
    solids.push(merlons(x0, fy - 6, x1, fy, TOWER, 6, 4, 4, 'x', 'stone'))
    for (const px of [x0 + 7, x1 - 7]) solids.push(spire(px, FRONT * S + 7, 6, TOWER, 30, 4, 'spireStone'))
    solids.push(octagon(mx, cy, 28, TOWER, TOWER + 22, 'stone'))
    voids.push(...[-12, 0, 12].flatMap((dx) => recess(mx + dx, cy + 26, TOWER + 4, 6, 15, 4, 'pointed')))
    solids.push(spire(mx, cy, 28, TOWER + 22, SPIRE, 8, 'spireStone'))
    orn.push(...crockets(mx, cy, 28, TOWER + 22, SPIRE, 9))
    orn.push(cross(11).at(mx - 2, cy, TOWER + 22 + SPIRE - 2, true))
    // the belfry: two tall lancets, open, louvred, in their deep reveals
    for (const k of [-1, 1]) {
      voids.push(...recess(mx + k * 12, fy, TOWER - 76, 16, 56, 8, 'pointed', 2, 2))
      orn.push(opening(10, 52, 'pointed', true).at(mx + k * 12 - 5, backOf(fy, 8), TOWER - 76))
    }
    // a window over the side portal, then the portal itself, deep in three rings of archivolts
    voids.push(...recess(mx, fy, 140, 18, 40, 5, 'pointed', 2, 2))
    orn.push(lancet(14, 38, 'violet', 2).at(mx - 7, backOf(fy, 5), 140))
    voids.push(...recess(mx, fy, 0, 40, 84, 14, 'pointed', 4, 4))
    solids.push(doorSlab(mx, backOf(fy, 14), 0, 24, 72, 'pointed'))
    orn.push(portal(24, 72, 0).at(mx - 12, backOf(fy, 14) - 1, 0))
  }
  block(5, FRONT, 21, FACE)
  // the gallery of kings: a row of niches, a king in each, the two in the middle gilt
  for (let k = 0; k < 7; k++) {
    const nx = 10 * S + 8 + k * 13.3
    voids.push(...recess(nx, fy, 122, 9, 25, 4, 'pointed'))
    orn.push(statue(7, 20, k === 3).at(nx - 3, backOf(fy, 4), 123))
  }
  // the rose in its deep ring
  voids.push(...recess(C, fy, 156, 66, 66, 3, 'circle'))
  orn.push(rose(30).at(C - 30, backOf(fy, 3), 159))
  // the porch: a gabled projection before the great door, its pinnacles either side, the portal deep in four rings
  const px0 = 11 * S - 6
  const px1 = 15 * S + 6
  solids.push(box(px0, fy, 0, px1, fy + S, 80, 'stone'))
  solids.push(gable(px0, fy, px1, fy + S, 80, 32, 'y', 'stone', 'stone'))
  for (const bx of [px0 - 6, px1 - 6]) {
    solids.push(box(bx, fy + 2, 0, bx + 12, fy + S, 92, 'stone'))
    solids.push(spire(bx + 6, fy + 9, 6, 92, 26, 4, 'spireStone'))
    orn.push(...crockets(bx + 6, fy + 9, 6, 92, 26, 8))
  }
  voids.push(...recess(C, fy + S, 0, 54, 78, 20, 'pointed', 5, 3))
  solids.push(doorSlab(C, backOf(fy + S, 20), 0, 34, 66, 'pointed'))
  orn.push(portal(34, 66, 0).at(C - 17, backOf(fy + S, 20) - 1, 0))
  orn.push(cross(9).at(C - 2, fy + S - 2, 80 + 30, true))
  for (let x = 11; x < 15; x++) fp[FACE][x] = '#'
  fp[FACE][12] = 'D'
  fp[FACE][13] = 'D'

  return { name: 'abbey_church', footprint: fp.map((r) => r.join('')), solids, voids, ornaments: orn }
}

export type { Glass }
