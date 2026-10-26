// The rest of Sunwell Abbey's close (docs/showcase.md §4.1): the cloister against the church's flank, its galleries
// round a green garth, the north gallery's arcade open to the south (one sees the brothers walk in it); the library
// and scriptorium over the chapter house, the refectory, the dormitory, the abbot's lodging, the almonry and the gate
// into the close.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, box, leanTo, type Solid } from '../shapes.ts'
import { hall, rows, S, solidFootprint, tower } from '../kit.ts'
import { lancet } from '../ornaments.ts'

/**
 * The cloister: four galleries round a garth, each a walk under a lean-to roof against the outer wall, an arcade of
 * pointed arches on paired colonnettes between it and the garth, an opening in the middle of each side.
 */
export function cloister(): Model {
  const w = 16
  const d = 14
  const W = w * S
  const D = d * S
  const fp = solidFootprint(w, d)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const OUT = 6 // the outer wall's thickness
  const ARC = 4 // the arcade's
  const WALL = 52
  const ARCH = 34
  // the outer wall, all round
  solids.push(box(0, 0, 0, W, OUT, WALL, 'stone'), box(0, D - OUT, 0, W, D, WALL, 'stone'), box(0, 0, 0, OUT, D, WALL, 'stone'), box(W - OUT, 0, 0, W, D, WALL, 'stone'))
  // the galleries' roofs, falling from the outer wall to the arcade
  const g = 2 * S
  solids.push(leanTo(0, 0, W, g + 2, ARCH + 2, WALL - ARCH, 'n', 'slate'))
  solids.push(leanTo(0, D - g - 2, W, D, ARCH + 2, WALL - ARCH, 's', 'slate'))
  solids.push(leanTo(0, g, g + 2, D - g, ARCH + 2, WALL - ARCH, 'w', 'slate'))
  solids.push(leanTo(W - g - 2, g, W, D - g, ARCH + 2, WALL - ARCH, 'e', 'slate'))
  // the arcades along the garth: the north one faces south, its arches seen; the others' tops seen over the walks
  solids.push(box(g, g - ARC, 0, W - g, g, ARCH + 2, 'stone'))
  solids.push(box(g, D - g, 0, W - g, D - g + ARC, ARCH + 2, 'stone'))
  solids.push(box(g - ARC, g, 0, g, D - g, ARCH + 2, 'stone'))
  solids.push(box(W - g, g, 0, W - g + ARC, D - g, ARCH + 2, 'stone'))
  for (let x = g + 6; x < W - g - 4; x += 12) voids.push(archNS(x + 3, g - ARC - 1, g + 1, 8, 9, ARCH - 10, 'pointed'))
  for (let x = g + 6; x < W - g - 4; x += 12) voids.push(archNS(x + 3, D - g - 1, D - g + ARC + 1, 8, 9, ARCH - 10, 'pointed'))
  // the openings into the garth, one a side
  voids.push(archNS(W / 2, g - ARC - 1, g + 1, 0, 14, ARCH - 4, 'pointed'))
  voids.push(archNS(W / 2, D - g - 1, D - g + ARC + 1, 0, 14, ARCH - 4, 'pointed'))
  // the doors in the outer wall: into the church (north-west) and out to the close (south)
  voids.push(archNS(W / 2, D - OUT - 1, D + 1, 0, 14, 28, 'round'))
  // the footprint: the walls solid, the walks walked under, the garth open
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === d - 1
      const walk = x < 2 || y < 2 || x >= w - 2 || y >= d - 2
      fp[y][x] = edge ? '#' : walk ? '.' : ' '
    }
  // the arcade's own cells are walls but for the openings
  for (let x = 2; x < w - 2; x++) {
    fp[1][x] = x === w / 2 || x === w / 2 - 1 ? '.' : '#'
    fp[d - 2][x] = x === w / 2 || x === w / 2 - 1 ? '.' : '#'
  }
  for (let y = 2; y < d - 2; y++) (fp[y][1] = '#'), (fp[y][w - 2] = '#')
  fp[d - 1][w / 2 - 1] = '.'
  fp[d - 1][w / 2] = '.'
  // the north walk's back wall: the church's flank, its lancets over the cloister roof
  for (let x = S; x < W - S; x += 2 * S) orn.push(lancet(6, 14, 'blue').at(x + 5, OUT, WALL - 16))
  return { name: 'abbey_cloister', footprint: rows(fp), solids, voids, ornaments: orn }
}

/** The library: the scriptorium's long room over the chapter house, tall lancets in the upper storey, a stair turret. */
export function library(): Model {
  const m = hall({ name: 'abbey_library', w: 14, d: 7, wall: 'stone', roof: 'slate', storeys: 2, storeyH: 46, ridge: 'x', doors: [4], doorKind: 'pointed', windows: 'lancet', glass: 'gold', buttresses: true, seed: 11 })
  // the stair turret at its west end, an octagon under a spire
  const t = tower({ name: 'x', size: 3, round: true, height: 120, wall: 'stone', top: 'cone', roof: 'slate', slits: true })
  for (const s of t.solids) m.solids.push({ ...s, b: [s.b[0] + 11 * S, s.b[1] + 4 * S, s.b[2], s.b[3] + 11 * S, s.b[4] + 4 * S, s.b[5]], inside: (x, y, z) => s.inside(x - 11 * S, y - 4 * S, z) })
  return m
}

export const CLOSE: Record<string, () => Model> = {
  abbey_cloister: cloister,
  abbey_library: library,
  abbey_refectory: () => hall({ name: 'abbey_refectory', w: 12, d: 6, wall: 'stone', roof: 'slate', storeys: 1, storeyH: 64, ridge: 'x', doors: [6], doorKind: 'pointed', windows: 'lancet', glass: 'blue', buttresses: true, chimneys: [2], seed: 12 }),
  abbey_dorter: () => hall({ name: 'abbey_dorter', w: 12, d: 6, wall: 'stone', roof: 'slate', storeys: 2, storeyH: 36, ridge: 'x', doors: [3], windows: 'round', chimneys: [8], seed: 13 }),
  abbey_lodge: () => hall({ name: 'abbey_lodge', w: 7, d: 6, wall: 'stone', roof: 'slate', storeys: 2, storeyH: 36, ridge: 'y', doors: [3], windows: 'rect', chimneys: [1, 5], seed: 14 }),
  abbey_almonry: () => hall({ name: 'abbey_almonry', w: 6, d: 5, wall: 'plaster', roof: 'tile', storeys: 2, storeyH: 32, ridge: 'x', doors: [2], windows: 'rect', timber: true, plinth: 'stone', chimneys: [4], seed: 15 }),
  abbey_gate: () => tower({ name: 'abbey_gate', size: 5, round: false, height: 96, wall: 'stone', top: 'pyramid', roof: 'slate', passage: true }),
}
