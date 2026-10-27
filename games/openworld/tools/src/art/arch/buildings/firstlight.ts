// Firstlight Village's own buildings (docs/release-1.md §3, the redo of 2026-10-26: the village drawn as the showcase's
// places are): a frontier village on Frostfang's west bank in its short summer — low cottages of timber and wash under
// thatch, the elder's of stone, the watch house of stone under slate with its banner, the store with its awning and
// its goods out, the smithy with its sign, the chapel of grey stone with a bell-cote over its door, Joss's house in the
// lane, Edda's hut. Each is drawn with its door on the cell the village's story keeps it (village.ts), and low enough
// that its roof stays on the map over the woods behind it.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, gable, recess, type Solid } from '../shapes.ts'
import { bird, door, ivy, lancet, lantern, moss, stains } from '../ornaments.ts'
import { house, S, type HouseOpts2 } from '../kit.ts'

/** A Firstlight cottage: one storey under its roof (the north's low houses), its door on the cell given. */
const cottage = (o: Omit<HouseOpts2, 'upper' | 'timber'> & { upper?: number; timber?: boolean }): Model => house({ upper: 0, timber: true, ...o })

/**
 * The chapel: grey stone, a steep slate roof, a bell-cote of two arches over the door at its west end, lancets down its
 * side, a buttress at each bay; its door in the second cell, on the step above Astra's altar.
 */
function chapel(): Model {
  const w = 6
  const d = 6
  const W = w * S
  const D = d * S
  const H = 60
  const solids: Solid[] = [box(0, 0, 0, W, D, H, 'stone'), gable(-3, -3, W + 3, D + 3, H, 34, 'x', 'slate', 'stone')]
  // the bell-cote rising from the front over the door, its two bells
  const dx = 1.5 * S
  solids.push(box(dx - 12, D - 8, 0, dx + 12, D, H + 44, 'stone'), gable(dx - 14, D - 10, dx + 14, D + 1, H + 44, 10, 'y', 'slate', 'stone'))
  const voids: Solid[] = [archNS(dx - 5, D - 9, D + 1, H + 18, 7, 16, 'round'), archNS(dx + 5, D - 9, D + 1, H + 18, 7, 16, 'round')]
  const orn: Ornament[] = []
  for (const k of [-5, 5]) orn.push({ x: dx + k - 3, y: D - 4, z: H + 21, rows: ['  aa  ', ' aaaa ', ' aaaa ', 'aaaaaa'], keys: { a: 'a2' } })
  // the door under the cote, its lanterns; lancets along the nave; buttresses between
  voids.push(...recess(dx, D, 0, 16, 30, 4, 'pointed', 2, 2))
  solids.push(doorSlab(dx, backOf(D, 4), 0, 12, 26, 'pointed'))
  orn.push(door(12, 26, 'pointed', 'g').at(dx - 6, backOf(D, 4) - 1, 0), lantern(false).at(dx + 10, D + 1, 22, true))
  for (const x of [3 * S, 4.5 * S]) {
    voids.push(...recess(x, D, 18, 8, 26, 3, 'pointed'))
    orn.push(lancet(6, 24, 'blue', 1).at(x - 3, backOf(D, 3), 19))
  }
  for (const x of [2.4 * S, 3.8 * S, 5.2 * S]) solids.push(box(x - 3, D, 0, x + 3, D + 4, 36, 'stone'))
  orn.push(stains(W, 22, 'g', 3).at(0, D, 0), moss(14, 4, 2).at(4 * S, D, 0), ivy(18, 40, 6).at(W - 22, D, 0), bird(true, 4).at(W - 20, D / 2, H + 34, true))
  const fp = Array.from({ length: d }, () => '#'.repeat(w).split(''))
  fp[d - 1][1] = 'D'
  return { name: 'fl_chapel', footprint: fp.map((r) => r.join('')), solids, voids, ornaments: orn }
}

export const FIRSTLIGHT_BUILDINGS: Record<string, () => Model> = {
  // Marta's: the biggest family's, a wing to the yard, the kitchen chimney smoking
  fl_cook: () => cottage({ name: 'fl_cook', w: 9, d: 4, wall: 'plasterOchre', roof: 'thatch', seed: 2101, plan: 'wingE', wing: [3, 1], door: 4, shutters: 'cr', stoneBelow: true, bloom: 'cr0' }),
  // the elder's: stone, a bay, the village's ledger in it
  fl_elder: () => cottage({ name: 'fl_elder', w: 8, d: 3, wall: 'stone', roof: 'slate', timber: false, seed: 2102, plan: 'bay', wing: [3, 1], door: 4, shutters: 'cg', ivy: true }),
  // the watch house: stone under slate, the watch's banner
  fl_watch: () => cottage({ name: 'fl_watch', w: 8, d: 4, wall: 'stone', roof: 'slate', timber: false, seed: 2103, plan: 'gable', door: 3, shutters: 'cb', banner: 'V' }),
  // the woodcutter's: dark timber, its lean-to for the logs
  fl_wood: () => cottage({ name: 'fl_wood', w: 8, d: 4, wall: 'darkwood', roof: 'thatch', timber: false, seed: 2104, plan: 'eaves', door: 3, shutters: 'cg', poor: true }),
  // the general store: its goods out under the awning, Greta's sign
  fl_store: () => cottage({ name: 'fl_store', w: 9, d: 4, wall: 'plaster', roof: 'thatch', seed: 2105, plan: 'eaves', door: 3, shutters: 'cy', shop: { sign: 'key', goods: [' bb  bb  bb  bb ', 'bBbbbBbbbBbbbBbb', 'oyoyoyoyoyoyoyoy'], canvas: 'canvasGreen' } }),
  // the smithy: stone below, its sign, the forge's chimney
  fl_smithy: () => cottage({ name: 'fl_smithy', w: 8, d: 4, wall: 'darkwood', roof: 'slate', timber: false, seed: 2106, plan: 'eaves', door: 2, stoneBelow: true, sign: 'anvil', shutters: 'cr' }),
  fl_chapel: chapel,
  // Joss's, in the lane: his workshop's wide door
  fl_lane: () => cottage({ name: 'fl_lane', w: 7, d: 3, wall: 'plasterWhite', roof: 'thatch', seed: 2107, plan: 'gable', door: 2, shutters: 'cb', poor: true }),
  // Edda's hut: one room and its pantry, low thatch
  fl_hut: () => cottage({ name: 'fl_hut', w: 6, d: 3, wall: 'timber', roof: 'thatch', timber: false, seed: 2108, plan: 'eaves', door: 2, poor: true }),
}

/** The village's cottages (the four of F17) and its other homes, by name. */
export const FL_COTTAGES = ['fl_cook', 'fl_elder', 'fl_watch', 'fl_wood']
export const FL_HOMES = ['fl_lane', 'fl_hut']
