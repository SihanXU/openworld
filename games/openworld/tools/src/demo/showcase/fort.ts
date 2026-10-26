// The North Gate (docs/showcase.md §4.3): the Holy City's citadel over its north gate — the showcase of a fortress, on
// the concentric plan of Krak des Chevaliers and Beaumaris. From the city's street one comes to the barbican, crosses
// the moat on the drawbridge, and passes under the great gatehouse's portcullis into the outer ward: the barracks, the
// smithy, the armoury, the stables, the yard where the garrison drills. The inner curtain stands higher; through its gate
// tower, the inner ward — the keep on its forebuilding's stair, the chapel, the well. The walls' walks are raised ground
// one climbs to by stairs (the relief's limestone is their face, client catalog `relief.holy`), crenellated on their outer
// edge, and the watch walks them by day and by night. Within the keep: the great hall, and over it the castellan's floor.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { greatHall, solarHall } from './halls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { LOW_HOUSES } from '../../art/arch/buildings/town.ts'
import { busyRow, frontage, lamp, lampRow, panels, parterre, pavement, piles, strew, unshut } from './dress.ts'

const W = 64
const H = 92
/** The street before the barbican, where the city's way in from the Bell Ward comes (the east edge's rows). */
export const FORT_EAST: [number, number] = [64 + 16, 67 + 16]
const ABOVE = 16

/** A run of curtain wall from (x, y) `len` cells along `axis`, laid in the longest stretches the art has. */
function wall(b: MapBuilder, axis: 'x' | 'y', x: number, y: number, len: number) {
  const LEN = [12, 10, 8, 6, 5, 4, 3, 2]
  let k = 0
  while (k < len) {
    const n = LEN.find((l) => l <= len - k) ?? 2
    b.building(`fort_wall_${axis}${n}`, axis === 'x' ? x + k : x, axis === 'x' ? y : y + k)
    k += n
  }
}

export function northGate(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  const note = (door: string, prefab: string, role: DoorNote['role']) => doors.push({ door, prefab, role })

  // ------------------------------------------------------------------ the wards' ground: roads of grey flags, the inner ward's court, yards of beaten earth
  b.rect(30, 4, 4, 40, 'flagstone')
  b.rect(3, 30, 58, 2, 'flagstone')
  b.rect(3, 4, 2, 36, 'flagstone')
  b.rect(59, 4, 2, 36, 'flagstone')
  b.rect(14, 4, 36, 18, 'flags')
  b.rect(4, 32, 22, 7, 'dirt')
  b.rect(39, 32, 20, 7, 'dirt')
  // ------------------------------------------------------------------ the outer curtain: its corner drums, the postern north, the curtain between
  for (const [x, y] of [[0, 0], [57, 0], [0, 40], [57, 40]] as Cell[]) b.building('fort_tower_round', x, y)
  b.building('fort_gate_tower', 30, 0)
  wall(b, 'x', 7, 2, 23)
  wall(b, 'x', 35, 2, 22)
  wall(b, 'y', 1, 7, 33)
  wall(b, 'y', 61, 7, 33)
  // the south curtain: the great gatehouse in its middle, a drum either side of it
  b.building('fort_gatehouse', 25, 40)
  for (const x of [13, 45]) b.building('fort_tower_crenel', x, 41)
  wall(b, 'x', 7, 44, 6)
  wall(b, 'x', 19, 44, 6)
  wall(b, 'x', 39, 44, 6)
  wall(b, 'x', 51, 44, 6)
  // ------------------------------------------------------------------ the inner ward behind its own wall: the keep, the chapel, the well, the castellan's garden
  wall(b, 'y', 12, 4, 18)
  wall(b, 'y', 50, 4, 18)
  wall(b, 'x', 12, 22, 18)
  wall(b, 'x', 35, 22, 17)
  b.building('fort_gate_tower', 30, 19)
  b.building('fort_keep', 26, 5, ['keep', 'keep2'])
  b.building('fort_chapel', 41, 6, ['chapel'])
  note('chapel', 'fort_chapel', 'chapel')
  b.building('fort_well', 20, 15)
  for (const [x, y] of [[29, 17], [34, 17]] as Cell[]) b.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  // the castellan's garden west of the keep: a parterre, box, a bench under a tree
  parterre(b, 15, 6, 9, 6)
  b.fixture('fixture/garden/bench', 16, 13)
  b.set(23, 13, 'tree')
  // the chapel's yard: graves of the garrison, a cross
  for (let x = 42; x < 49; x += 2) for (const y of [16, 18]) b.fixture('fixture/sacred/gravestone', x, y)
  b.fixture('fixture/sacred/cross', 47, 15)
  // ------------------------------------------------------------------ the outer ward west: the barracks and the drill yard before it
  b.building('fort_barracks', 4, 25, ['barracks1'])
  note('barracks1', 'fort_barracks', 'barracks')
  for (const x of [6, 9, 12, 15]) b.fixture('fixture/dummy', x, 34)
  for (const x of [19, 22]) b.fixture('fixture/furniture/rack/arms', x, 33)
  for (const x of [6, 10, 14]) b.fixture('fixture/furniture/bench/log', x, 37)
  b.fixture('fixture/light/brazier', 24, 36, { statuses: { lit: -1 } })
  // the lists north of it, under the west wall: the archery butts, the stores
  for (const y of [8, 12, 16]) b.fixture('fixture/dummy', 9, y)
  b.rect(5, 6, 6, 16, 'dirt')
  for (const [x, y] of [[6, 20], [7, 20], [6, 19]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[10, 20], [10, 19]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  // ------------------------------------------------------------------ the outer ward east: the armourer's forge and its yard, the stables and the paddock
  b.building('fort_armoury', 39, 25, ['armoury'])
  note('armoury', 'fort_armoury', 'smithy')
  b.fixture('fixture/craft/anvil', 42, 33)
  b.fixture('fixture/craft/forge', 45, 33)
  for (const [x, y] of [[39, 33], [40, 33]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  b.building('fort_stables', 48, 25, ['stable1'])
  note('stable1', 'fort_stables', 'farmhouse')
  b.yard(48, 32, 12, 7, 'rail', [[48, 35]])
  for (const [x, y] of [[50, 34], [52, 37], [57, 33]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  for (const [x, y] of [[55, 36], [56, 36]] as Cell[]) b.fixture('fixture/water/trough', x, y)
  // the kitchen garden and the hives east of the inner ward
  for (let y = 5; y < 21; y++) for (let x = 52; x < 58; x++) b.set(x, y, y % 3 === 0 ? 'path' : 'farmland')
  for (const y of [6, 10, 14]) b.fixture('fixture/nature/beehive', 58, y)
  // trees along the inner side of the curtain, braziers by the gates
  for (const [x, y] of [[26, 26], [37, 26], [26, 37], [37, 37], [5, 23], [58, 23]] as Cell[]) b.set(x, y, 'tree')
  for (const [x, y] of [[29, 38], [34, 38], [29, 24], [34, 24]] as Cell[]) b.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  // ------------------------------------------------------------------ the moat: its banks, the water winding, reeds, the drawbridge, the barbican
  b.rect(0, 47, W, 9, 'grass')
  for (let x = 0; x < W; x++) {
    const y0 = 49 + Math.round(Math.sin(x / 7) * 0.8)
    for (let y = y0; y < y0 + 4; y++) b.set(x, y, 'water')
  }
  b.rect(30, 47, 4, 8, 'bridge')
  for (let x = 2; x < W - 2; x += 3) if (Math.abs(x - 31) > 3) b.set(x, 47 + (x % 2), 'bush')
  b.building('fort_barbican', 26, 54)
  b.rect(31, 55, 2, 6, 'flagstone')
  // ------------------------------------------------------------------ the city before it: the square, the street east
  // (the square before the barbican: flags, an inlay on the gate's axis, parterres either side, lamps and the city's standards)
  pave(b, 0, 60, W, 20, 'flags')
  b.rect(2, 61, 60, 16, 'paving')
  for (let y = 60; y < 77; y++) for (let x = 29; x < 34; x++) b.set(x, y, 'plaza')
  for (const [x, y] of [[8, 58], [16, 58], [24, 58], [40, 58], [48, 58], [56, 58]]) b.set(x, y, 'tree')
  panels(b, 2, 61, 60, 16, 6)
  parterre(b, 8, 64, 12, 6)
  parterre(b, 44, 64, 12, 6)
  b.building('town_fountain', 22, 70)
  b.fixture('fixture/sacred/statue/martyr', 41, 71)
  for (const [x, y] of [[27, 62], [35, 62], [3, 62], [60, 62], [3, 75], [60, 75]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[25, 66], [37, 66], [25, 73], [37, 73]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  lampRow(b, 6, 58, 61, 8, (x) => x > 25 && x < 38)
  for (const [x, y] of [[28, 68], [34, 68], [28, 75], [34, 75]] as Cell[]) lamp(b, x, y)
  b.fixture('fixture/sign/noticeboard', 36, 61)
  // the houses whose roofs close the square, their street at the map's foot
  const south = houseRow(b, 2, 29, 90, LOW_HOUSES, 's')
  const southE = houseRow(b, 34, 62, 90, LOW_HOUSES, 'se')
  doors.push(...south.doors, ...southE.doors)
  b.rect(30, 77, 4, 15, 'flagstone')
  pave(b, 0, 91, W, 1, 'flagstone')
  frontage(b, south)
  frontage(b, southE)
  pavement(b, 0, W - 1, 78, 2)
  // ------------------------------------------------------------------ views: the gate from the street, the keep from the outer ward
  b.vistas.push({ at: [14, 56, 36, 20], zoom: 0.6, focus: [31, 38], share: 0.45 })
  b.vistas.push({ at: [4, 26, 56, 17], zoom: 0.6, focus: [31, 6], share: 0.45 })
  b.anchors = { gate: [31, 48], barbican: [31, 61], yard: [20, 35], innerGate: [32, 25], keepDoor: [31, 17], chapel: [43, 15], garden: [54, 10], stables: [52, 30], forge: [43, 31], square: [32, 64] }
  // ------------------------------------------------------------------ the clutter: the garrison's stores at the wards' walls, the city's fronts, the square strewn
  for (const r of [south, southE]) busyRow(b, r, 0, W, 'city')
  piles(b, 3, 24, 58, 16, 'market', 0.35)
  piles(b, 0, 56, W, H - 56, 'city', 0.4)
  strew(b, 0, 56, W, H - 56, 0.1)
  strew(b, 3, 4, 58, 36, 0.06, 'poor')
  clearDoorsteps(b)
  unshut(b)
  b.grow(ABOVE, 'grass')
  // the road out north from the postern, the fields and the trees beyond the walls
  b.rect(32, 0, 1, ABOVE + 1, 'path')
  for (let y = 2; y < ABOVE - 2; y += 4) for (let x = 3; x < W - 3; x += 7) if (Math.abs(x - 32) > 3) b.set(x + (y % 3), y, 'tree')
  b.scatter(0, 0, W, ABOVE - 1, 'flowers', 0.04)

  // ------------------------------------------------------------------ within the keep: the great hall, the castellan's floor over it
  const hall = greatHall(p)
  linkDoors(b, [b.doors.keep, b.doors.keep2], hall, HALLS.greathall.doors)
  const upper = solarHall(p)
  // the stair up from the great hall's east bay to the castellan's floor
  linkStair(hall, [HALLS.greathall.parts.bayE.x, HALLS.greathall.parts.bayE.y + 2], upper, upper.anchors.stair, false)

  // ------------------------------------------------------------------ the rooms behind the other doors
  const rooms = roomsBehind(b, p, doors)
  const room = (role: string) => rooms.filter((r) => r.id.includes(`.${role}-`))
  const barracks = room('barracks')

  // ------------------------------------------------------------------ the garrison, the castellan, the city's folk at the gate
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const cast: Cast[] = []
  // the watch round the wards under the walls: by day two to each round, by night one, walking between its ends
  const walls: [Cell, Cell][] = ([[[8, 39], [24, 39]], [[39, 39], [56, 39]], [[4, 8], [4, 36]], [[59, 8], [59, 36]], [[5, 5], [10, 22]], [[53, 4], [58, 22]]] as [Cell, Cell][]).map(([a, c]) => [[a[0], a[1] + ABOVE], [c[0], c[1] + ABOVE]])
  walls.forEach(([a, c], i) => {
    cast.push({ role: 'guard', home: barracks[i % barracks.length].id, day: [at(b, a, 6, 10, 'watch', 1), at(b, c, 10, 14, 'watch', 1), at(b, A.yard, 14, 16, 'work', 4), at(b, a, 16, 19, 'watch', 1), at(barracks[i % barracks.length], [5, 3], 19, 22, 'eat', 2)] })
    cast.push({ role: 'guard', home: barracks[(i + 1) % barracks.length].id, day: [at(b, c, 22, 2, 'watch', 1), at(b, a, 2, 6, 'watch', 1), at(barracks[(i + 1) % barracks.length], [5, 3], 14, 16, 'eat', 2), at(b, A.yard, 16, 19, 'work', 4)] })
  })
  // the gate's own: two at the barbican, two under the gatehouse, one at the inner gate
  for (const [c, n] of [[A.barbican, 2], [A.gate, 2], [A.innerGate, 1]] as [Cell, number][])
    for (let k = 0; k < n; k++) cast.push({ role: 'guard', home: barracks[k % barracks.length].id, day: [at(b, c, 6, 18, 'watch', 1), at(b, A.yard, 18, 21, 'rest', 4)] })
  // the drill in the yard by day, the barracks by night
  for (let k = 0; k < 8; k++) cast.push({ role: 'soldier', home: barracks[k % barracks.length].id, day: [at(b, A.yard, 6, 12, 'work', 3), at(barracks[k % barracks.length], [4 + (k % 4), 4], 12, 13, 'eat', 2), at(b, A.yard, 13, 18, 'work', 3), at(b, A.square, 18, 21, 'rest', 6)] })
  // the castellan and the steward in the hall, the chaplain, the grooms
  cast.push({ role: 'noble', home: upper.id, bed: upper.anchors.bed, day: [at(hall, hall.anchors.throne, 8, 12, 'sit', 0), at(upper, upper.anchors.eat, 12, 13, 'eat', 1), at(b, A.yard, 13, 15, 'walk', 4), at(hall, hall.anchors.throne, 15, 21, 'sit', 0)] })
  cast.push({ role: 'scholar', home: upper.id, day: [at(upper, upper.anchors.work, 7, 12, 'work', 1), at(hall, hall.anchors.eat, 12, 13, 'eat', 1), at(hall, hall.anchors.work, 13, 20, 'work', 2)] })
  cast.push({ role: 'smith', home: room('smithy')[0].id, day: [at(b, A.forge, 6, 18, 'work', 2), at(b, A.yard, 18, 21, 'rest', 4)] })
  for (let k = 0; k < 2; k++) cast.push({ role: 'farmer', home: room('farmhouse')[0].id, day: [at(b, A.stables, 6, 18, 'work', 4), at(b, A.yard, 18, 21, 'rest', 4)] })
  cast.push({ role: 'priest', home: room('chapel')[0].id, day: [at(b, A.chapel, 6, 20, 'pray', 2)] })
  for (let k = 0; k < 2; k++) cast.push({ role: 'farmer', home: room('farmhouse')[0].id, day: [at(b, A.garden, 6, 18, 'work', 3), at(b, A.yard, 18, 21, 'rest', 4)] })
  // townsfolk in the street before the barbican, a crier at the noticeboard
  for (let k = 0; k < 6; k++) cast.push({ role: 'villager', home: rooms[rooms.length - 1 - k].id, day: [at(b, A.square, 8, 12, 'walk', 10), at(rooms[rooms.length - 1 - k], [5, 3], 12, 13, 'eat', 2), at(b, A.square, 13, 19, 'walk', 10)] })
  cast.push({ role: 'bard', home: rooms[rooms.length - 7].id, day: [at(b, [35, 62], 9, 18, 'work', 1)] })
  CASTS.set(p.id, cast)
  return [b, hall, upper, ...rooms]
}
