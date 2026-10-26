// The North Gate (docs/showcase.md §4.3): the Holy City's citadel over its north gate — the showcase of a fortress, on
// the concentric plan of Krak des Chevaliers and Beaumaris. From the city's street one comes to the barbican, crosses
// the moat on the drawbridge, and passes under the great gatehouse's portcullis into the outer ward: the barracks, the
// smithy, the armoury, the stables, the yard where the garrison drills. The inner curtain stands higher; through its gate
// tower, the inner ward — the keep on its forebuilding's stair, the chapel, the well. The walls' walks are raised ground
// one climbs to by stairs (the masonry under them is their face, tools/src/art/rampart.ts), crenellated on their outer
// edge, and the watch walks them by day and by night. Within the keep: the great hall, and over it the castellan's floor.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { floorTop, hallRoom, linkDoors, linkStair } from './rooms.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { LOW_HOUSES } from '../../art/arch/buildings/town.ts'
import { busyRow, frontage, lamp, lampRow, panels, parterre, pavement, piles, strew, unshut } from './dress.ts'

const W = 64
const H = 92
/** The street before the barbican, where the city's way in from the Bell Ward comes (the east edge's rows). */
export const FORT_EAST: [number, number] = [64 + 16, 67 + 16]
const ABOVE = 16

/** A stretch of curtain: raised to `half` half levels, its top the wall-walk's flags. */
function curtain(b: MapBuilder, x: number, y: number, w: number, h: number, half: number) {
  b.raise(x, y, w, h, half)
  b.rect(x, y, w, h, 'rampart')
}

/** A run of the parapet along a walk's outer edge: merlon, crenel, merlon … (each a cell, solid). */
function parapet(b: MapBuilder, cells: Cell[]) {
  cells.forEach(([x, y], i) => b.building(i % 2 ? 'fort_crenel' : 'fort_merlon', x, y))
}

/** A stair up to a walk: `n` cells from (x, y) going `dir`, each half a level higher than the last, from `from` up. */
function stair(b: MapBuilder, x: number, y: number, dx: number, dy: number, from: number, n: number) {
  for (let k = 0; k < n; k++) {
    b.heights[y + dy * k][x + dx * k] = from + k + 1
    b.set(x + dx * k, y + dy * k, 'rampart')
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

  // ------------------------------------------------------------------ the wards' ground
  b.rect(4, 4, 56, 40, 'flagstone')
  b.rect(18, 24, 4, 20, 'dirt')
  b.rect(22, 35, 12, 8, 'dirt')
  // ------------------------------------------------------------------ the outer curtain: north, west, east, south
  curtain(b, 2, 2, 60, 2, 4)
  curtain(b, 2, 4, 2, 42, 4)
  curtain(b, 60, 4, 2, 42, 4)
  curtain(b, 4, 44, 56, 2, 4)
  // ------------------------------------------------------------------ the inner curtain, higher, round the inner ward
  curtain(b, 16, 4, 2, 20, 6)
  curtain(b, 46, 4, 2, 20, 6)
  curtain(b, 16, 22, 32, 2, 6)
  // the parapets on the outer edges
  parapet(b, Array.from({ length: 52 }, (_, i) => [6 + i, 45] as Cell).filter(([x]) => !(x >= 13 && x <= 17) && !(x >= 27 && x <= 35) && !(x >= 46 && x <= 50)))
  parapet(b, Array.from({ length: 52 }, (_, i) => [6 + i, 2] as Cell).filter(([x]) => !(x >= 30 && x <= 34)))
  parapet(b, Array.from({ length: 34 }, (_, i) => [2, 6 + i] as Cell))
  parapet(b, Array.from({ length: 34 }, (_, i) => [61, 6 + i] as Cell))
  // stairs up to the walks: two to the south curtain from the outer ward, one to each side curtain
  stair(b, 10, 41, 0, 1, 0, 3)
  stair(b, 53, 41, 0, 1, 0, 3)
  stair(b, 6, 20, -1, 0, 0, 3)
  stair(b, 57, 20, 1, 0, 0, 3)
  // ------------------------------------------------------------------ the towers and gates (their cells not raised)
  const lay = (name: string, x: number, y: number, w: number, d: number, door: string[] = []) => {
    b.raise(x, y, w, d, 0)
    return b.building(name, x, y, door)
  }
  lay('fort_gate_tower', 30, 0, 5, 5)
  lay('fort_gate_tower', 30, 20, 5, 5)
  lay('fort_gatehouse', 27, 42, 9, 5)
  lay('fort_tower_round', 0, 40, 6, 6)
  lay('fort_tower_round', 58, 40, 6, 6)
  lay('fort_tower_round', 0, 0, 6, 6)
  lay('fort_tower_round', 58, 0, 6, 6)
  lay('fort_tower_crenel', 13, 42, 5, 5)
  lay('fort_tower_crenel', 46, 42, 5, 5)
  b.rect(32, 0, 1, 5, 'flagstone')
  b.rect(32, 20, 1, 5, 'flagstone')
  b.rect(30, 42, 3, 5, 'flagstone')
  // ------------------------------------------------------------------ the inner ward: the keep, the chapel, the well
  b.building('fort_keep', 26, 5, ['keep', 'keep2'])
  b.building('fort_chapel', 39, 6, ['chapel'])
  note('chapel', 'fort_chapel', 'chapel')
  b.building('fort_well', 21, 17)
  b.fixture('fixture/light/brazier', 29, 18)
  b.fixture('fixture/light/brazier', 35, 18)
  b.building('market_cross', 22, 8)
  // ------------------------------------------------------------------ the outer ward: barracks, smithy, armoury, stables, the yard
  b.building('fort_barracks', 6, 29, ['barracks1', 'barracks2'])
  note('barracks1', 'fort_barracks', 'barracks')
  note('barracks2', 'fort_barracks', 'barracks')
  b.house('smithy', 23, 30, 'smithy')
  note('smithy', 'smithy', 'smithy')
  b.fixture('fixture/craft/anvil', 26, 33)
  b.fixture('fixture/container/barrel', 22, 33)
  b.building('fort_armoury', 48, 27, ['armoury'])
  note('armoury', 'fort_armoury', 'smithy')
  b.building('fort_stables', 47, 35, ['stable1'])
  note('stable1', 'fort_stables', 'farmhouse')
  b.building('fort_well', 40, 34)
  for (const [x, y] of [[24, 37], [27, 37], [30, 37]]) b.fixture('fixture/dummy', x, y)
  for (const [x, y] of [[23, 41], [31, 41]]) b.fixture('fixture/furniture/rack/arms', x, y)
  for (const [x, y] of [[45, 37], [45, 38]]) b.fixture('fixture/water/trough', x, y)
  for (const [x, y] of [[57, 36], [57, 38]]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/furniture/cart', 41, 40)
  // the lists between the curtains: the archery butts, the stores, a cart, the kitchen garden
  for (const [x, y] of [[7, 8], [10, 8], [13, 8]]) b.fixture('fixture/dummy', x, y)
  for (const [x, y] of [[6, 14], [6, 15], [7, 14]]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[11, 17], [12, 17], [12, 16]]) b.fixture('fixture/container/crate', x, y)
  b.fixture('fixture/nature/logpile', 9, 22)
  b.fixture('fixture/furniture/cart', 13, 12)
  for (let y = 6; y < 20; y += 2) for (let x = 50; x < 57; x++) b.set(x, y, 'farmland')
  b.fixture('fixture/nature/beehive', 57, 8)
  for (const [x, y] of [[8, 38], [12, 38], [16, 26], [44, 26]]) b.fixture('fixture/light/brazier', x, y)
  // ------------------------------------------------------------------ the moat, the drawbridge, the barbican
  b.rect(0, 46, W, 4, 'grass')
  b.rect(0, 50, W, 5, 'water')
  b.rect(30, 46, 3, 9, 'bridge')
  for (let x = 4; x < 60; x += 5) b.set(x, 48, 'bush')
  b.building('fort_barbican', 28, 55)
  b.rect(30, 55, 3, 5, 'cobble')
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
  b.anchors = { gate: [31, 48], barbican: [31, 61], yard: [27, 39], wallS: [20, 44], wallS2: [42, 44], wallW: [3, 14], wallE: [60, 30], innerGate: [32, 26], keepDoor: [31, 18], chapel: [42, 14], square: [32, 64] }
  // ------------------------------------------------------------------ the clutter: the garrison's stores at the wards' walls, the city's fronts, the square strewn
  for (const r of [south, southE]) busyRow(b, r, 0, W, 'city')
  piles(b, 4, 4, 56, 40, 'market', 0.3)
  piles(b, 0, 56, W, H - 56, 'city', 0.4)
  strew(b, 0, 56, W, H - 56, 0.1)
  strew(b, 4, 4, 56, 40, 0.05, 'poor')
  clearDoorsteps(b)
  unshut(b)
  b.grow(ABOVE, 'grass')
  // the road out north from the postern, the fields and the trees beyond the walls
  b.rect(32, 0, 1, ABOVE + 1, 'path')
  for (let y = 2; y < ABOVE - 2; y += 4) for (let x = 3; x < W - 3; x += 7) if (Math.abs(x - 32) > 3) b.set(x + (y % 3), y, 'tree')
  b.scatter(0, 0, W, ABOVE - 1, 'flowers', 0.04)

  // ------------------------------------------------------------------ within the keep: the great hall, the castellan's floor over it
  const hall = hallRoom({ id: `${p.id}.hall`, name: { en: `${p.name.en} — the Great Hall`, zh: `${p.name.zh}·大厅` }, w: 26, h: 18, floor: 'floor_stone', music: 'interior', region: p.region, wall: 'wall_greathall', doors: [12, 13] })
  const h0 = floorTop(hall)
  hall.raise(9, h0, 8, 3, 1)
  hall.fixture('fixture/furniture/throne', 13, h0 + 1)
  hall.fixture('fixture/furniture/table/long', 13, h0 + 4)
  for (let y = h0 + 7; y < h0 + 15; y += 3) for (const x of [7, 19]) {
    hall.fixture('fixture/furniture/table/long', x, y)
    hall.fixture('fixture/furniture/bench/log', x, y + 1)
  }
  for (const [x, y] of [[4, h0 + 5], [22, h0 + 5], [4, h0 + 11], [22, h0 + 11]]) hall.building('hall_pillar', x, y)
  for (const [x, y] of [[2, h0 + 1], [23, h0 + 1]]) hall.fixture('fixture/furniture/rack/arms', x, y)
  hall.rect(12, h0 + 5, 2, hall.h - 1 - (h0 + 5), 'carpet')
  // braziers either side of the dais, the hall's plate in its chests, the ale in its barrels
  for (const x of [7, 19]) hall.fixture('fixture/light/brazier', x, h0 + 2)
  for (const [x, y] of [[2, h0 + 14], [23, h0 + 14]]) hall.fixture('fixture/container/chest', x, y)
  for (const [x, y] of [[2, h0 + 7], [2, h0 + 8], [23, h0 + 7]]) hall.fixture('fixture/container/barrel', x, y)
  for (const y of [h0 + 7, h0 + 10, h0 + 13]) for (const x of [7, 19]) hall.fixture('fixture/light/candles', x - 2, y + 1)
  hall.lights.push({ x: 13, y: h0 + 1, w: 12, h: 6, color: '#ff9a4a', shape: 'glow', when: 'always', strength: 0.4 })
  linkDoors(b, [b.doors.keep, b.doors.keep2], hall, [[12, hall.h - 1], [13, hall.h - 1]])
  const upper = hallRoom({ id: `${p.id}.solar`, name: { en: `${p.name.en} — the Castellan's Floor`, zh: `${p.name.zh}·城主居所` }, w: 22, h: 14, floor: 'floor_wood', music: 'interior', region: p.region, wall: 'wall_keep_upper', frame: 'stone', doors: [] })
  const u0 = floorTop(upper)
  upper.fixture('fixture/furniture/bed', 4, u0 + 2)
  upper.fixture('fixture/container/chest', 5, u0 + 1)
  upper.fixture('fixture/furniture/desk', 15, u0 + 2)
  upper.fixture('fixture/container/bookcase', 17, u0 + 1)
  upper.fixture('fixture/furniture/table', 11, u0 + 6)
  for (const x of [16, 18, 20]) upper.fixture('fixture/furniture/rack/arms', x, u0 + 9)
  upper.fixture('fixture/container/chest', 19, u0 + 7)
  upper.lights.push({ x: 11, y: u0 + 1, w: 10, h: 5, color: '#ff9a4a', shape: 'glow', when: 'night', strength: 0.4 })
  upper.rect(1, upper.h - 1, 20, 1, 'wall')
  linkStair(hall, [24, hall.h - 3], upper, [2, upper.h - 3], false)

  // ------------------------------------------------------------------ the rooms behind the other doors
  const rooms = roomsBehind(b, p, doors)
  const room = (role: string) => rooms.filter((r) => r.id.includes(`.${role}-`))
  const barracks = room('barracks')

  // ------------------------------------------------------------------ the garrison, the castellan, the city's folk at the gate
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const cast: Cast[] = []
  // the watch on the walls: by day two to each stretch, by night one, walking between its ends
  const walls: [Cell, Cell][] = ([[[8, 44], [24, 44]], [[38, 44], [56, 44]], [[3, 8], [3, 38]], [[60, 8], [60, 38]], [[8, 3], [28, 3]], [[36, 3], [56, 3]]] as [Cell, Cell][]).map(([a, c]) => [[a[0], a[1] + ABOVE], [c[0], c[1] + ABOVE]])
  walls.forEach(([a, c], i) => {
    cast.push({ role: 'guard', home: barracks[i % 2].id, day: [at(b, a, 6, 10, 'watch', 1), at(b, c, 10, 14, 'watch', 1), at(b, A.yard, 14, 16, 'work', 4), at(b, a, 16, 19, 'watch', 1), at(barracks[i % 2], [5, 3], 19, 22, 'eat', 2)] })
    cast.push({ role: 'guard', home: barracks[(i + 1) % 2].id, day: [at(b, c, 22, 2, 'watch', 1), at(b, a, 2, 6, 'watch', 1), at(barracks[(i + 1) % 2], [5, 3], 14, 16, 'eat', 2), at(b, A.yard, 16, 19, 'work', 4)] })
  })
  // the gate's own: two at the barbican, two under the gatehouse, one at the inner gate
  for (const [c, n] of [[A.barbican, 2], [A.gate, 2], [A.innerGate, 1]] as [Cell, number][])
    for (let k = 0; k < n; k++) cast.push({ role: 'guard', home: barracks[k % 2].id, day: [at(b, c, 6, 18, 'watch', 1), at(b, A.yard, 18, 21, 'rest', 4)] })
  // the drill in the yard by day, the barracks by night
  for (let k = 0; k < 8; k++) cast.push({ role: 'soldier', home: barracks[k % 2].id, day: [at(b, A.yard, 6, 12, 'work', 3), at(barracks[k % 2], [4 + (k % 4), 4], 12, 13, 'eat', 2), at(b, A.yard, 13, 18, 'work', 3), at(b, A.square, 18, 21, 'rest', 6)] })
  // the castellan and the steward in the hall, the chaplain, the grooms
  cast.push({ role: 'noble', home: upper.id, bed: [4, u0 + 2], day: [at(hall, [13, h0 + 2], 8, 12, 'sit', 0), at(upper, [11, u0 + 7], 12, 13, 'eat', 1), at(b, A.yard, 13, 15, 'walk', 4), at(hall, [13, h0 + 2], 15, 21, 'sit', 0)] })
  cast.push({ role: 'scholar', home: upper.id, day: [at(upper, [15, u0 + 3], 7, 12, 'work', 1), at(hall, [13, h0 + 5], 12, 13, 'eat', 1), at(hall, [10, h0 + 6], 13, 20, 'work', 2)] })
  cast.push({ role: 'priest', home: room('chapel')[0].id, day: [at(b, A.chapel, 6, 20, 'pray', 2)] })
  for (let k = 0; k < 2; k++) cast.push({ role: 'farmer', home: room('farmhouse')[0].id, day: [at(b, [52, 41 + ABOVE], 6, 18, 'work', 3), at(b, A.yard, 18, 21, 'rest', 4)] })
  // townsfolk in the street before the barbican, a crier at the noticeboard
  for (let k = 0; k < 6; k++) cast.push({ role: 'villager', home: rooms[rooms.length - 1 - k].id, day: [at(b, A.square, 8, 12, 'walk', 10), at(rooms[rooms.length - 1 - k], [5, 3], 12, 13, 'eat', 2), at(b, A.square, 13, 19, 'walk', 10)] })
  cast.push({ role: 'bard', home: rooms[rooms.length - 7].id, day: [at(b, [35, 62], 9, 18, 'work', 1)] })
  CASTS.set(p.id, cast)
  return [b, hall, upper, ...rooms]
}
