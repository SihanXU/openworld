// The Lower Town (docs/showcase.md §4.6): the poor quarter on the canal — the quay's masonry dropping to the water
// (the relief's limestone), boats moored along it, the treadwheel crane, nets and fish hung to dry,
// barrels and crates; crooked timber houses under thatch leaning over mud lanes, washing strung between them; the
// tavern where the quarter drinks; a wooden footbridge over the water. Dubrovnik's and Venice's lesser quays, the poor
// parts of every old port.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { tavernHall } from './halls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { HOVEL_NAMES } from '../../art/arch/buildings/town.ts'
import { busyRow, decor, frontage, piles, strew, unshut } from './dress.ts'

const W = 56
const H = 67
/** The rows added over the quarter (MapBuilder.grow). */
const ABOVE = 2
/** The street's rows on the east edge (to the Lamp Ward), after the rows added over the quarter. */
export const LOWER_EAST: [number, number] = [49 + ABOVE, 52 + ABOVE]
const HOVELS = HOVEL_NAMES

export function lowerTown(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the canal, a level under the town, its quays: a narrow one north, a wide one south
  b.raise(0, 0, W, H, 2)
  b.rect(0, 28, W, 5, 'water')
  b.raise(0, 28, W, 5, 0)
  b.rect(0, 25, W, 3, 'cobble')
  b.rect(0, 33, W, 6, 'cobble')
  // the footbridge across (the planks over the water, a level up)
  b.rect(30, 28, 3, 5, 'bridge')
  b.raise(30, 28, 3, 5, 2)
  for (const [x, y] of [[5, 30], [13, 29], [22, 31], [40, 30], [48, 29], [53, 31]]) b.fixture('fixture/boat', x, y)
  b.building('town_crane', 12, 33)
  for (const [x, y] of [[4, 35], [20, 35], [38, 35], [46, 35]]) b.fixture('fixture/furniture/rack/nets', x, y)
  for (const [x, y] of [[8, 26], [26, 26], [46, 26], [24, 37], [50, 37]]) b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[17, 34], [18, 34], [17, 35], [40, 26], [41, 26], [52, 34]]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[16, 36], [36, 37], [37, 37], [50, 26], [8, 37]]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[28, 36], [44, 38]]) b.fixture('fixture/container/sack', x, y)
  for (const x of [6, 22, 37, 52]) b.fixture('fixture/light/lantern', x, 25)
  for (const x of [10, 34, 54]) b.fixture('fixture/light/lantern', x, 38)
  for (const [x, y] of [[6, 26], [22, 26], [37, 26], [52, 26], [10, 38], [34, 38], [54, 38]]) b.lights.push({ x: x + 0.5, y: y + 0.5, w: 3, h: 2, color: '#ff9a4a', shape: 'glow', when: 'night', strength: 0.3 })
  // ------------------------------------------------------------------ the north bank: hovels on the lane over the quarter, the tavern and hovels along the quay
  const n1 = houseRow(b, 0, 55, 10, HOVELS, 'n', 0.4)
  doors.push(...n1.doors)
  b.rect(0, 11, W, 2, 'dirt')
  b.building('town_tavern', 33, 21, ['tavern'], true)
  const q1 = houseRow(b, 0, 31, 24, HOVELS, 'q', 0.3)
  const q2 = houseRow(b, 43, 55, 24, HOVELS, 'q2', 0.3)
  doors.push(...q1.doors, ...q2.doors)
  b.rect(31, 11, 2, 14, 'dirt')
  for (const r of [n1, q1, q2]) frontage(b, r, true)
  // ------------------------------------------------------------------ the south bank: hovels whose thatch closes the quay, the street east to the Lamp Ward, the yards
  const s1 = houseRow(b, 0, 29, 48, HOVELS, 's', 0.3)
  const s1b = houseRow(b, 33, 55, 48, HOVELS, 'sb', 0.3)
  doors.push(...s1.doors, ...s1b.doors)
  b.rect(30, 39, 3, 10, 'cobble')
  pave(b, 0, 49, W, 4, 'cobble')
  const s2 = houseRow(b, 0, 55, 63, HOVELS, 's2', 0.35)
  doors.push(...s2.doors)
  for (const r of [s1, s1b, s2]) frontage(b, r, true)
  pave(b, 0, 64, W, 3, 'dirt')
  // the yards: cabbages and beans in the gaps, a few trees, chickens' straw, tufts and flowers in the grass
  for (const [x, y, w, h] of [[2, 14, 6, 3], [14, 15, 5, 2], [44, 14, 6, 3], [8, 54, 6, 2], [40, 54, 7, 2]]) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (b.get(i, j) === 'grass') b.set(i, j, 'farmland')
  for (const [x, y] of [[3, 2], [11, 3], [25, 1], [38, 3], [49, 2], [54, 16], [22, 15], [52, 55], [26, 55]] as Cell[]) if (b.get(x, y) === 'grass') b.set(x, y, 'tree')
  b.sprinkle('fixture/nature/tuft', 0.05, (_x, _y, t) => t === 'grass')
  b.sprinkle('fixture/nature/flowers', 0.03, (_x, _y, t) => t === 'grass')
  // mud where the lanes are wettest (soft patches, not a speckle), washing strung across, a well, a fire where the poor warm themselves
  for (const [x, y, rx, ry] of [[12, 51, 4, 1.5], [44, 51, 5, 1.5], [24, 65, 6, 1.5], [46, 65, 4, 1], [10, 12, 4, 1], [44, 12, 5, 1]]) b.organic(x, y, rx, ry, 'mud', { rough: 0.4, only: (c) => c === 'dirt' || c === 'cobble' || c === 'grass' })
  for (const [x, y] of [[8, 50], [26, 51], [46, 50], [8, 65], [36, 65]]) b.fixture('fixture/furniture/washing_line', x, y)
  b.fixture('fixture/water/well', 20, 51)
  b.fixture('fixture/light/campfire', 46, 36)
  for (const [x, y] of [[44, 37], [48, 37]]) b.fixture('fixture/furniture/bench/log', x, y)
  b.vistas.push({ at: [0, 33, W, 16], zoom: 0.75, focus: [37, 20], share: 0.4 })
  b.anchors = { quayN: [20, 26], quayS: [26, 36], crane: [13, 37], lane: [20, 50], fire: [46, 35], bridge: [31, 30], street: [40, 50], tavernDoor: [36, 25] }
  // ------------------------------------------------------------------ the clutter: casks and crates on the quays, firewood and hay at the walls, washing, mud and straw
  for (const r of [n1, q1, q2, s1, s1b, s2]) busyRow(b, r, 0, W, 'poor')
  for (let x = 1; x < W - 1; x++) for (const y of [27, 33]) if ((x < 28 || x > 34) && rng.chance(0.25)) decor(b, rng.pick(['decor_casks', 'decor_crates', 'decor_sacks', 'decor_casks_row', 'decor_crates_row']), x, y)
  piles(b, 0, 0, W, H, 'poor', 0.45)
  strew(b, 0, 0, W, H, 0.14, 'poor')
  clearDoorsteps(b)
  unshut(b)
  // the lane over the quarter
  b.grow(ABOVE, 'grass')
  b.raise(0, 0, W, ABOVE, 2)

  // ------------------------------------------------------------------ the tavern within
  const tavern = tavernHall(p)
  linkDoors(b, [b.doors.tavern], tavern, [tavern.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the quarter's folk
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const cast: Cast[] = []
  for (let n = 0; n < 6; n++) cast.push({ role: 'fisher', home: home(n), day: [at(b, n % 2 ? A.quayN : A.quayS, 5, 12, 'work', 6), at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, n % 2 ? A.quayN : A.quayS, 13, 17, 'work', 6), at(tavern, tavern.anchors.rest, 17, 22, 'rest', 4)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'villager', home: home(n + 6), day: [at(b, A.crane, 6, 12, 'work', 3), at(b, A.lane, 12, 13, 'eat', 4), at(b, A.crane, 13, 18, 'work', 3), at(tavern, tavern.anchors.eat, 18, 22, 'rest', 4)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'villager', sex: 'female', home: home(n + 11), day: [at(b, A.lane, 7, 12, 'work', 6), at(rooms[(n + 11) % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, A.lane, 13, 18, 'work', 6), at(b, A.fire, 18, 21, 'rest', 3)] })
  for (let n = 0; n < 6; n++) cast.push({ role: 'child', home: home(n + 2), day: [at(b, A.lane, 8, 12, 'play', 8), at(rooms[(n + 2) % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, n % 2 ? A.quayS : A.bridge, 13, 18, 'play', 6)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'beggar', home: home(n + 20), day: [at(b, A.fire, 6, 22, 'sit', 3)] })
  cast.push({ role: 'elder', home: home(30), day: [at(b, A.quayN, 8, 18, 'sit', 2)] })
  cast.push({ role: 'innkeeper', home: tavern.id, day: [at(tavern, tavern.anchors.bar, 10, 24, 'work', 2)] })
  cast.push({ role: 'bard', home: tavern.id, day: [at(tavern, tavern.anchors.bard, 18, 24, 'work', 1), at(b, A.street, 12, 17, 'work', 4)] })
  cast.push({ role: 'herbalist', home: home(33), stock: [['item/material/herb', 4], ['item/potion/antidote', 1]], day: [at(b, A.street, 8, 18, 'work', 3)] })
  cast.push({ role: 'guard', home: home(35), day: [at(b, A.street, 8, 20, 'watch', 10)] })
  CASTS.set(p.id, cast)
  return [b, tavern, ...rooms]
}
