// The North Gate's fortress (docs/showcase.md §4.3): Krak des Chevaliers' and Beaumaris's concentric plan, Carcassonne's
// towers under their cones — the barbican before the moat, the great gatehouse with its portcullis, the towers of the
// curtain, the keep with its forebuilding, the barracks, the stables, the smithy's forge, the chapel and the well.

import type { Model } from '../oblique.ts'
import { box, drum, gable, type Solid } from '../shapes.ts'
import { gatehouse, hall, keep, S, tower } from '../kit.ts'

/** The well-house in the inner ward: a round curb, two posts, a little roof, the windlass. */
function wellhouse(): Model {
  const W = 2 * S
  const c = W / 2
  const solids: Solid[] = [
    drum(c, c, 12, 0, 10, 'granite'),
    drum(c, c, 9, 6, 9, 'dark'),
    box(c - 13, c - 2, 0, c - 10, c + 2, 40, 'timber'),
    box(c + 10, c - 2, 0, c + 13, c + 2, 40, 'timber'),
    box(c - 12, c - 1, 26, c + 12, c + 1, 29, 'timber'),
    gable(c - 16, c - 9, c + 16, c + 9, 38, 12, 'x', 'slate', 'timber'),
  ]
  return { name: 'fort_well', footprint: ['##', '##'], solids, voids: [], ornaments: [] }
}

export const FORT: Record<string, () => Model> = {
  fort_gatehouse: () => gatehouse({ name: 'fort_gatehouse', span: 5, towerR: 2, height: 160, wall: 'granite', roofs: true, banner: 'U' }),
  fort_barbican: () => gatehouse({ name: 'fort_barbican', span: 3, towerR: 2, height: 112, wall: 'granite', roofs: false, banner: 'U' }),
  fort_tower_round: () => tower({ name: 'fort_tower_round', size: 6, round: true, height: 150, wall: 'granite', top: 'cone', roof: 'slate', slits: true }),
  fort_tower_crenel: () => tower({ name: 'fort_tower_crenel', size: 5, round: true, height: 128, wall: 'granite', top: 'crenel', slits: true, banner: 'U' }),
  fort_tower_square: () => tower({ name: 'fort_tower_square', size: 5, round: false, height: 136, wall: 'granite', top: 'crenel', slits: true, door: true }),
  fort_keep: () => keep({ name: 'fort_keep', w: 12, d: 10, height: 230, wall: 'granite', banner: 'U' }),
  fort_barracks: () => hall({ name: 'fort_barracks', w: 14, d: 5, wall: 'granite', roof: 'slate', storeys: 2, storeyH: 34, ridge: 'x', doors: [3, 10], windows: 'rect', chimneys: [6], seed: 21 }),
  fort_stables: () => hall({ name: 'fort_stables', w: 10, d: 5, wall: 'timber', roof: 'tile', storeys: 1, storeyH: 40, ridge: 'x', doors: [5], windows: 'none', plinth: 'granite', seed: 22 }),
  fort_armoury: () => hall({ name: 'fort_armoury', w: 7, d: 5, wall: 'granite', roof: 'slate', storeys: 2, storeyH: 34, ridge: 'y', doors: [3], windows: 'rect', crenel: false, sign: 'anvil', chimneys: [1], seed: 23 }),
  fort_chapel: () => hall({ name: 'fort_chapel', w: 6, d: 8, wall: 'granite', roof: 'slate', storeys: 1, storeyH: 58, ridge: 'y', doors: [3], doorKind: 'pointed', windows: 'lancet', glass: 'red', buttresses: true, bell: true, seed: 24 }),
  fort_well: wellhouse,
  // a gate tower in a curtain: a square tower with a passage through it, crenellated (the inner ward's gate, the postern north)
  fort_gate_tower: () => tower({ name: 'fort_gate_tower', size: 5, round: false, height: 128, wall: 'granite', top: 'crenel', passage: true, banner: 'U' }),
  // a merlon of the parapet along a wall-walk's outer edge (the walk itself is raised ground, its face the masonry terrace)
  fort_merlon: () => ({ name: 'fort_merlon', footprint: ['#'], solids: [box(1, 8, 0, S - 1, S, 14, 'granite')], voids: [], ornaments: [] }),
  // a stretch of the parapet a merlon wide, low (the crenel between two merlons): walked past, not over
  fort_crenel: () => ({ name: 'fort_crenel', footprint: ['#'], solids: [box(0, 10, 0, S, S, 5, 'granite')], voids: [], ornaments: [] }),
}

