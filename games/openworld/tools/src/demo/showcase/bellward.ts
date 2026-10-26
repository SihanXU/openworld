// The Bell Ward (docs/showcase.md §4.2): the grand city — the Holy City's great square under its belfry, on the model of
// Bruges's Markt and Siena's Campo, read through Kevin Lynch's elements: a landmark seen from every street (the
// belfry), a node (the square and its fountain), a path (the Processional Way from the North Gate east across the canal),
// an edge (the canal and its quays), a district's own fabric (its tall washed and timbered houses). South of the way
// the street forks round a tower gate (Rothenburg's Plönlein), one branch through it south to the Market, the other east
// along the canal. The hall under the belfry is the council's; its chamber within.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { councilHall } from './halls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { clearDoorsteps, houseRow, pave, type Row } from './street.ts'
import { LOW_HOUSES, NARROW_HOUSES, TALL_HOUSES } from '../../art/arch/buildings/town.ts'
import { busyRow, decor, frontage, lamp, lampRow, panels, parterre, pavement, piles, strew, terrace, unshut } from './dress.ts'

const W = 66
const H = 96
/** The rows added over the ward (MapBuilder.grow), a lane behind its highest roofs. */
const ABOVE = 4
/** The Processional Way's rows as the ward is laid out (before the rows added over it). */
const WAY: [number, number] = [63, 66]
export const BELL_WEST: [number, number] = [WAY[0] + ABOVE, WAY[1] + ABOVE]
export const BELL_SOUTH: [number, number] = [41, 42]
/** The ground's heights in half levels: the upper town on its terrace, the square and the streets, the canal. */
const UP = 4
const LOW = 2

export function bellWard(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'flags', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the ground: the canal a level under the city, the square, the upper town a level over it
  b.raise(0, 0, W, H, LOW)
  b.rect(53, 0, 4, H, 'water')
  b.raise(53, 0, 4, H, 0)
  b.rect(0, 34, 53, 29, 'paving')
  // the upper town on its terrace over the square: its balustrade along the edge, the grand stair to the hall, a stair at each end
  terrace(b, 0, 0, 53, 34, UP, 'flags', [[29, 6], [7, 2], [46, 2]], LOW)
  // ------------------------------------------------------------------ the upper town: two rows of houses west of the hall, a lane between, gardens behind the hall
  const n1 = houseRow(b, 2, 21, 14, TALL_HOUSES, 'n', 0.15)
  pavement(b, 0, 22, 15)
  const n2 = houseRow(b, 2, 21, 29, LOW_HOUSES, 'nw', 0.15)
  doors.push(...n1.doors, ...n2.doors)
  for (let x = 24; x < 52; x += 4) b.set(x, 1, 'tree')
  // the hall's garden over the guild: lawn, a parterre, a fountain, limes along its edge
  b.rect(41, 2, 12, 9, 'grass')
  parterre(b, 41, 3, 6, 5)
  b.building('town_fountain', 47, 4)
  for (let y = 3; y < 10; y += 2) b.set(52, y, 'tree')
  // the hall and its belfry at the head of the square, the guild hall's stepped gable beside it
  b.building('town_hall', 23, 22, ['hall', 'hall2'], true)
  b.building('town_guild', 44, 23, ['guild'], true)
  doors.push({ door: 'guild', prefab: 'town_guild', role: 'shop' })
  // the hall's forecourt: flags along the fronts, an inlay before the doors, standards either side of them, the lamps
  pavement(b, 0, 52, 30, 3)
  for (let y = 30; y < 33; y++) for (let x = 27; x < 37; x++) b.set(x, y, 'plaza')
  for (const x of [26, 37]) b.fixture('fixture/standard', x, 31)
  lampRow(b, 3, 51, 31, 6, (x) => x > 24 && x < 39)
  lampRow(b, 4, 20, 16, 8)
  frontage(b, n1)
  frontage(b, n2)
  // ------------------------------------------------------------------ the square: its inlay round the grand fountain, its spokes, four parterres, statues, benches, lamps
  for (let y = 35; y < 63; y++)
    for (let x = 2; x < 53; x++) {
      const d = Math.hypot(x + 0.5 - 28, y + 0.5 - 49)
      if (d < 9.6) b.set(x, y, 'plaza')
      else if (x === 27 || x === 28 || y === 48 || y === 49 || x < 4 || x > 50 || y < 36 || y > 60) b.set(x, y, 'flags')
    }
  panels(b, 2, 35, 51, 28, 6)
  b.building('town_fountain_grand', 25, 46)
  for (const [x, y] of [[5, 37], [41, 37], [5, 54], [41, 54]] as Cell[]) parterre(b, x, y, 10, 7)
  for (const x of [16, 40]) b.fixture('fixture/sacred/statue/martyr', x, 48)
  for (const [x, y] of [[20, 44], [35, 44], [20, 54], [35, 54]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  for (const x of [28, 35]) b.fixture('fixture/standard', x, 35)
  lampRow(b, 4, 51, 36, 10, (x) => x > 26 && x < 37)
  lampRow(b, 4, 51, 61, 10)
  for (const [x, y] of [[21, 42], [35, 42], [21, 56], [35, 56]] as Cell[]) lamp(b, x, y)
  for (const [x, y] of [[17, 40], [38, 58], [3, 52]] as Cell[]) b.fixture('fixture/furniture/cart/flowers', x, y)
  // the quay along the canal: the square's edge, lamps, boats moored below
  for (let y = 41; y < 60; y += 10) lamp(b, 52, y)
  for (const [x, y] of [[54, 20], [55, 44], [54, 76], [54, 88]]) b.fixture('fixture/boat', x, y)
  // ------------------------------------------------------------------ the Processional Way along the square's south, over the canal by its bridge
  pave(b, 0, WAY[0], 53, 4, 'flagstone')
  b.rect(53, WAY[0], 4, 4, 'flagstone')
  b.raise(53, WAY[0], 4, 4, LOW)
  b.fence('stonewall', [53, WAY[0]], [56, WAY[0]])
  b.fence('stonewall', [53, WAY[1]], [56, WAY[1]])
  pave(b, 57, WAY[0], W - 57, 4, 'flagstone')
  lampRow(b, 9, 50, WAY[1], 10)
  // ------------------------------------------------------------------ the east bank: houses along its quay, each looking over its own lane
  const east: Row[] = []
  for (const [k, f] of [18, 31, 45, 59, 80, 94].entries()) east.push(houseRow(b, 58, 65, f, NARROW_HOUSES, `e${k}`, 0, { setback: 0 }))
  for (const r of east) doors.push(...r.doors)
  for (let y = 4; y < H; y += 10) if (b.get(65, y) === 'flags') lamp(b, 65, y)
  // ------------------------------------------------------------------ south of the way: the houses' roofs along it; their street, the tower gate at the fork, more houses
  const s1 = houseRow(b, 2, 38, 80, TALL_HOUSES, 's', 0.2)
  const s2 = houseRow(b, 45, 53, 80, NARROW_HOUSES, 'se', 0)
  pave(b, 0, 81, 53, 3, 'flagstone')
  pavement(b, 0, 52, 81)
  b.rect(39, WAY[1] + 1, 6, 81 - WAY[1] - 1, 'flagstone')
  for (const y of [70, 76]) for (const x of [39, 44]) b.fixture('fixture/garden/cypress', x, y)
  b.building('town_gate_tower', 40, 84)
  const s3 = houseRow(b, 2, 38, 94, LOW_HOUSES, 'sw', 0.2)
  const s4 = houseRow(b, 45, 53, 94, NARROW_HOUSES, 'ss', 0)
  b.rect(41, 88, 2, 8, 'flagstone')
  doors.push(...s1.doors, ...s2.doors, ...s3.doors, ...s4.doors)
  for (const r of [s1, s2]) frontage(b, r)
  lampRow(b, 6, 36, 83, 10)
  // ------------------------------------------------------------------ the views: the belfry over the square, the tower gate at the fork
  b.vistas.push({ at: [2, 35, 51, 28], zoom: 0.55, focus: [31, 12], share: 0.5 })
  b.vistas.push({ at: [36, 74, 14, 10], zoom: 0.7, focus: [41, 80], share: 0.5 })
  b.anchors = { square: [28, 57], hallDoor: [31, 31], fountain: [28, 53], way: [20, 64], bridge: [55, 64], fork: [41, 82], quayN: [51, 40], quayS: [51, 58], upper: [12, 16] }
  // ------------------------------------------------------------------ the clutter: every front piled and hung, the paving strewn, cafés on the square
  for (const r of [n1, n2, s1, s2, s3, s4, ...east]) busyRow(b, r, 0, W, 'city')
  for (const [x, y] of [[43, 45], [47, 45], [43, 51], [47, 51], [8, 45], [12, 51]] as Cell[]) decor(b, 'decor_cafe', x, y)
  piles(b, 0, 0, W, H, 'city', 0.35)
  strew(b, 0, 0, W, H, 0.1)
  clearDoorsteps(b)
  unshut(b)
  // a lane over the ward's back gardens
  b.grow(ABOVE, 'flags')
  b.raise(0, 0, 53, ABOVE, UP)
  b.raise(57, 0, W - 57, ABOVE, LOW)
  b.rect(53, 0, 4, ABOVE, 'water')
  b.raise(53, 0, 4, ABOVE, 0)

  // ------------------------------------------------------------------ the council's chamber in the hall
  const hall = councilHall(p)
  linkDoors(b, [b.doors.hall, b.doors.hall2], hall, HALLS.council.doors)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the city's people on its great square
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const homes = rooms.map((r) => r.id)
  const home = (k: number) => homes[k % homes.length]
  const cast: Cast[] = []
  cast.push({ role: 'noble', home: home(0), day: [at(hall, hall.anchors.seat, 9, 12, 'sit', 0), at(b, A.square, 12, 14, 'walk', 6), at(hall, hall.anchors.seat, 14, 18, 'sit', 0), at(b, A.fountain, 18, 21, 'rest', 5)] })
  for (let k = 0; k < 3; k++) cast.push({ role: 'scholar', home: home(k + 1), day: [at(hall, hall.anchors.clerk, 8, 12, 'work', 3), at(b, A.square, 12, 13, 'walk', 6), at(hall, hall.anchors.bench, 13, 18, 'work', 4), at(b, A.way, 18, 21, 'walk', 8)] })
  for (const c of [A.hallDoor, A.bridge, A.fork]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 6, 18, 'watch', 1), at(b, A.square, 18, 21, 'watch', 10)] })
  cast.push({ role: 'guard', home: home(cast.length), day: [at(b, A.square, 18, 2, 'watch', 8), at(b, A.way, 2, 6, 'watch', 8)] })
  for (const [x, y] of [[17, 40], [38, 58], [3, 52], [10, 15]] as Cell[]) cast.push({ role: 'merchant', home: home(cast.length), stock: [['item/material/herb', 3], ['item/food/honey/holy_honeycomb', 2]], day: [at(b, [x, y + 1 + ABOVE], 7, 12, 'work', 0), at(b, A.fountain, 12, 13, 'eat', 4), at(b, [x, y + 1 + ABOVE], 13, 18, 'work', 0)] })
  for (let k = 0; k < 14; k++) cast.push({ role: k % 5 === 0 ? 'elder' : 'villager', home: home(cast.length), day: [at(b, k % 2 ? A.square : A.way, 8, 12, 'walk', 10), at(rooms[k % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, k % 3 ? A.square : A.fountain, 13, 19, 'walk', 9)] })
  for (let k = 0; k < 5; k++) cast.push({ role: 'child', home: home(cast.length + 2), day: [at(b, A.fountain, 8, 12, 'play', 5), at(rooms[(k + 3) % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, A.square, 13, 18, 'play', 8)] })
  for (let k = 0; k < 2; k++) cast.push({ role: 'fisher', home: home(cast.length), day: [at(b, k ? A.quayN : A.quayS, 6, 18, 'work', 2)] })
  cast.push({ role: 'bard', home: home(cast.length), day: [at(b, A.fountain, 10, 14, 'work', 3), at(b, A.way, 14, 20, 'work', 4)] })
  cast.push({ role: 'beggar', home: home(cast.length), day: [at(b, A.hallDoor, 7, 19, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, hall, ...rooms]
}
