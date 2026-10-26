// The Lamp Ward (docs/showcase.md §4.5): where the Holy City's pilgrims lodge and its evenings are spent — the great inn
// of the Pilgrims' Rest on its little square, the teahouses, a lamp at every few steps so the ward is the brightest of
// the city by night (a lamp's glow and a hearth's spill across the paving); the street west down to the Lower Town.
// Within the inn: the common room, its long counter, its tables, its hearth, the alcoves where its lodgers sleep.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { innHall } from './halls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { LOW_HOUSES, NARROW_HOUSES, TALL_HOUSES } from '../../art/arch/buildings/town.ts'
import { busyRow, decor, festoons, frontage, lamp, lampRow, panels, parterre, pavement, piles, strew, unshut } from './dress.ts'

const W = 56
const H = 68
/** The rows added over the ward (MapBuilder.grow), behind its highest roofs. */
const ABOVE = 6
export const LAMP_NORTH: [number, number] = [26, 27]
/** The street's rows on the west edge (to the Lower Town), after the rows added over the ward. */
export const LAMP_WEST: [number, number] = [49 + ABOVE, 52 + ABOVE]

export function lampWard(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'flags', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the north: the way in from the Market, the street of houses over the square
  const nw = houseRow(b, 2, 25, 12, TALL_HOUSES, 'nw', 0.1)
  const ne = houseRow(b, 29, 55, 12, TALL_HOUSES, 'ne', 0.1)
  doors.push(...nw.doors, ...ne.doors)
  pave(b, 0, 13, W, 3, 'flagstone')
  pavement(b, 0, W - 1, 13)
  b.rect(LAMP_NORTH[0], 0, 2, 16, 'flagstone')
  // a lamp at every sixth step of the street: the ward is the brightest of the city by night
  lampRow(b, 3, 54, 14, 6, (x) => x === 26 || x === 27)
  frontage(b, nw)
  frontage(b, ne)
  // ------------------------------------------------------------------ the square's head: the inn, a teahouse either side, houses at the ends
  b.building('town_inn', 21, 28, ['inn'], true)
  b.building('town_teahouse_0', 12, 29, ['tea1'], true)
  b.building('town_teahouse_1', 36, 29, ['tea2'], true)
  doors.push({ door: 'tea1', prefab: 'town_teahouse_0', role: 'teahouse' }, { door: 'tea2', prefab: 'town_teahouse_1', role: 'teahouse' })
  const wq = houseRow(b, 2, 10, 31, NARROW_HOUSES, 'wq', 0, { setback: 0 })
  const eq = houseRow(b, 46, 55, 31, NARROW_HOUSES, 'eq', 0, { setback: 0 })
  doors.push(...wq.doors, ...eq.doors)
  b.rect(10, 16, 2, 16, 'flagstone')
  b.rect(44, 16, 2, 16, 'flagstone')
  // ------------------------------------------------------------------ the square: flags round paving, the well head in its parterres, the teahouses' tables out on it
  b.rect(0, 32, W, 17, 'flags')
  b.rect(3, 33, 50, 15, 'paving')
  for (let y = 33; y < 48; y++) for (let x = 3; x < 53; x++) if (Math.hypot(x + 0.5 - 28, (y + 0.5 - 41) * 1.4) < 5.2) b.set(x, y, 'plaza')
  panels(b, 3, 33, 50, 15, 5)
  b.fixture('fixture/water/well/square', 27, 40)
  parterre(b, 6, 38, 8, 6)
  parterre(b, 42, 38, 8, 6)
  for (const [x, y] of [[13, 34], [16, 34], [37, 34], [40, 34]] as Cell[]) {
    b.fixture('fixture/furniture/table', x, y)
    for (const dx of [-1, 1]) b.fixture('fixture/furniture/chair', x + dx, y)
  }
  for (const [x, y] of [[21, 44], [33, 44], [21, 37], [33, 37]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  for (const [x, y] of [[19, 40], [36, 40]] as Cell[]) b.fixture('fixture/furniture/cart/flowers', x, y)
  // the lamps round the square, four round the well, and the lantern posts at the inn's door
  lampRow(b, 4, 52, 33, 6, (x) => (x > 11 && x < 19) || (x > 35 && x < 42) || (x > 24 && x < 31))
  for (const [x, y] of [[24, 38], [31, 38], [24, 43], [31, 43]] as Cell[]) lamp(b, x, y, 0.36)
  for (const x of [25, 29]) b.fixture('fixture/light/lantern', x, 33)
  // the inn's and the teahouses' windows spilling their light on the square after dark
  for (const [x, y, w] of [[27.5, 33, 8], [15.5, 33, 5], [39.5, 33, 5]]) b.lights.push({ x, y, w, h: 3, color: '#ff9a4a', shape: 'glow', when: 'night', strength: 0.42 })
  // ------------------------------------------------------------------ the street west to the Lower Town; the houses whose roofs close the square; their lane
  pave(b, 0, 49, W, 4, 'flagstone')
  lampRow(b, 3, 54, 49, 7)
  const s = houseRow(b, 0, 55, 64, LOW_HOUSES, 's', 0.15)
  doors.push(...s.doors)
  pave(b, 0, 65, W, 3, 'flagstone')
  pavement(b, 0, W - 1, 65)
  frontage(b, s)
  lampRow(b, 6, 54, 66, 8)
  b.vistas.push({ at: [3, 32, 50, 17], zoom: 0.7, focus: [27, 20], share: 0.4 })
  b.anchors = { square: [28, 45], well: [28, 42], street: [26, 50], innDoor: [27, 32], north: [26, 14] }
  // ------------------------------------------------------------------ the clutter: lanterns strung along every front, cafés, the paving strewn
  for (const r of [nw, ne, wq, eq, s]) busyRow(b, r, 0, W, 'city')
  for (const r of [nw, ne, s]) festoons(b, 0, W, r.line + 1, ['lanterns'], 0.9)
  for (const [x, y] of [[3, 41], [50, 41], [3, 45], [50, 45], [17, 45], [37, 45]] as Cell[]) decor(b, 'decor_cafe', x, y)
  piles(b, 0, 0, W, H, 'city', 0.4)
  strew(b, 0, 0, W, H, 0.1)
  clearDoorsteps(b)
  unshut(b)
  b.grow(ABOVE, 'flagstone')

  // ------------------------------------------------------------------ the inn within: the common room, the counter, the hearth, the alcoves
  const inn = innHall(p)
  linkDoors(b, [b.doors.inn], inn, [inn.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the inn's folk, its lodgers, the ward's evenings
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const cast: Cast[] = []
  for (let n = 0; n < 3; n++) cast.push({ role: 'innkeeper', home: inn.id, day: [at(inn, inn.anchors.bar, 6, 23, 'work', 2)] })
  for (let n = 0; n < 6; n++) cast.push({ role: 'traveler', home: inn.id, day: [at(b, A.square, 8, 12, 'walk', 8), at(inn, inn.anchors.eat, 12, 13, 'eat', 4), at(b, A.street, 13, 18, 'walk', 12), at(inn, inn.anchors.rest, 18, 22, 'rest', 5)] })
  cast.push({ role: 'bard', home: inn.id, day: [at(inn, inn.anchors.bard, 17, 23, 'work', 1), at(b, A.square, 11, 16, 'work', 4)] })
  for (let n = 0; n < 10; n++) cast.push({ role: n % 4 === 0 ? 'noble' : 'villager', home: home(n), day: [at(b, n % 2 ? A.street : A.square, 9, 12, 'walk', 10), at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, A.street, 13, 18, 'walk', 12), at(n % 3 ? b : inn, n % 3 ? A.well : inn.anchors.eat, 18, 22, 'rest', 5)] })
  for (const c of [A.north, A.street]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 16, 4, 'watch', 6), at(b, A.square, 4, 6, 'watch', 6)] })
  cast.push({ role: 'beggar', home: home(cast.length), day: [at(b, A.innDoor, 8, 22, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, inn, ...rooms]
}
