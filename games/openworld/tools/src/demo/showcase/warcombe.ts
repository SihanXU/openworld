// Warcombe (docs/showcase.md §4b.2): the Scarred March's fort town in its red canyon, after the frontier towns that live
// by a war — the Roman limes' forts, the Alamo's mission, the Spanish presidios of the badlands. Four steps of red rock
// down from the north: the mesa where the watch and the trebuchet keep the pass; the ledge where the war hall stands
// over its court; the town behind its palisade — flat-roofed houses of sandstone and red plaster, the square with its
// well, the armoury; and outside the gate the camp of the levies, the field hospital, and beyond them the field of the
// last battle, still not cleared: ash and craters, broken carts, torn tents, swords left where they fell.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { armouryHall, hospitalHall, warHall } from './regionhalls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { MARCH_HOUSES } from '../../art/arch/buildings/regions.ts'
import { busyRow, frontage, piles, strew, unshut } from './dress.ts'
import { glowAt, palisade, regrass, stair, standAnchors } from './ground.ts'

const W = 72
const H = 90
/** The steps of rock (half levels): the mesa, the ledge, the town inside the palisade, the ground outside the gate. */
const MESA = 8
const LEDGE = 4
const TOWN = 2
const LOW = 0
const LIT = { statuses: { lit: -1 } }

export function warcombe(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'dirt', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the steps of red rock
  b.raise(0, 0, W, 10, MESA)
  b.raise(0, 10, W, 18, LEDGE)
  b.raise(0, 28, W, 35, TOWN)
  b.raise(0, 63, W, H - 63, LOW)
  // the canyon floor's own ground: drifted sand in its hollows, sand where the wash runs, scree under the faces
  for (const [x, y, rx, ry] of [[10, 4, 6, 3], [40, 3, 8, 2], [64, 5, 5, 3], [8, 16, 6, 3], [62, 14, 7, 3], [6, 86, 7, 3], [60, 64, 8, 2]]) b.organic(x, y, rx, ry, 'sand', { rough: 0.5, only: (c) => c === 'dirt' })
  b.path([[0, 78], [18, 76], [30, 79], [44, 77], [58, 80], [W - 1, 78]], 'sand', 3)
  for (const [x, y] of [[2, 2], [3, 2], [2, 3], [33, 1], [34, 1], [46, 6], [68, 2], [69, 3], [69, 2], [16, 8], [26, 1]] as Cell[]) b.set(x, y, 'rock')
  stair(b, 62, 10, 3, MESA, LEDGE, 'path')
  stair(b, 34, 28, 3, LEDGE, TOWN, 'path')
  stair(b, 33, 63, 6, TOWN, LOW, 'path')

  // ------------------------------------------------------------------ the mesa: the watchtower, the trebuchet and its stones, the lookouts' tents
  b.building('march_watchtower', 6, 7)
  b.building('march_trebuchet', 52, 4)
  b.building('march_tent_a', 20, 3)
  b.building('march_tent_c', 27, 4)
  b.fixture('fixture/light/campfire', 24, 8, LIT)
  glowAt(b, 24, 8, 'always', 0.4)
  for (const [x, y] of [[50, 8], [57, 8], [58, 8], [57, 7]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  for (const [x, y] of [[10, 8], [44, 8]] as Cell[]) b.fixture('fixture/standard', x, y)
  b.path([[63, 9], [56, 7], [30, 8], [12, 7]], 'path', 1)

  // ------------------------------------------------------------------ the ledge: the war hall over its court, the captains' houses, the palisade on the edge
  b.building('march_warhall', 29, 13, ['warhall'], true)
  pave(b, 27, 18, 18, 4, 'flagstone')
  for (const [x, y] of [[28, 18], [43, 18], [28, 21], [43, 21]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[31, 19], [40, 19]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'night', 0.4)
  }
  const l1 = houseRow(b, 2, 25, 22, MARCH_HOUSES, 'l', 0.3, { yards: ['court', 'bare'] })
  const l2 = houseRow(b, 46, 70, 22, MARCH_HOUSES, 'l2', 0.3, { yards: ['court', 'bare'] })
  doors.push(...l1.doors, ...l2.doors)
  pave(b, 0, 23, W, 2, 'path')
  b.rect(62, 11, 2, 12, 'path')
  palisade(b, 0, 31, 27)
  palisade(b, 39, W - 1, 27)

  // ------------------------------------------------------------------ the town: two streets of flat roofs, the square, the armoury, the yards by the wall
  b.rect(34, 29, 4, 34, 'path')
  const t1 = houseRow(b, 2, 31, 38, MARCH_HOUSES, 't', 0.35)
  const t2 = houseRow(b, 40, 70, 38, MARCH_HOUSES, 't2', 0.35)
  pave(b, 0, 39, W, 3, 'path')
  b.rect(24, 42, 24, 6, 'paving')
  b.fixture('fixture/water/well', 29, 44)
  const stalls: Cell[] = []
  for (const x of [40, 43, 46]) {
    b.fixture('fixture/furniture/stall', x, 43)
    stalls.push([x, 44])
  }
  b.fixture('fixture/sign/noticeboard', 25, 42)
  for (const [x, y] of [[26, 46], [31, 46]] as Cell[]) b.fixture('fixture/furniture/bench', x, y)
  for (const [x, y] of [[24, 45], [47, 46]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  b.building('march_house_6', 26, 49, ['armoury'], true)
  const t3 = houseRow(b, 2, 24, 51, MARCH_HOUSES, 't3', 0.35)
  const t4 = houseRow(b, 40, 70, 51, MARCH_HOUSES, 't4', 0.35)
  doors.push(...t1.doors, ...t2.doors, ...t3.doors, ...t4.doors)
  pave(b, 0, 52, W, 3, 'path')
  // the horse lines west of the square: a fenced corral, its hay and troughs, a cart unharnessed
  b.yard(3, 43, 12, 5, 'fence', [[9, 47]])
  for (const [x, y] of [[5, 44], [12, 45]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/water/trough', 8, 44)
  b.fixture('fixture/furniture/cart', 17, 45)
  // the yards inside the wall: hay and troughs for the horses, the training ground's dummies and butts
  for (const [x, y] of [[4, 56], [8, 57], [14, 56]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  for (const [x, y] of [[6, 58], [18, 57]] as Cell[]) b.fixture('fixture/water/trough', x, y)
  b.rect(44, 55, 20, 5, 'sand')
  for (const x of [46, 50, 54, 58, 62]) b.fixture('fixture/dummy', x, 56)
  b.fixture('fixture/furniture/rack/arms', 44, 58)
  b.fixture('fixture/furniture/rack/arms', 63, 58)
  // the gate: two towers and the road between them, the palisade either side
  b.building('march_watchtower', 30, 60)
  b.building('march_watchtower', 39, 60)
  palisade(b, 0, 29, 62)
  palisade(b, 42, W - 1, 62)
  for (const [x, y] of [[33, 61], [38, 61]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'night', 0.45)
  }

  // ------------------------------------------------------------------ outside the gate: the road south, the camp of the levies, the field hospital
  b.path([[35, 64], [34, 72], [37, 80], [36, H - 1]], 'path', 4)
  b.building('march_hospital', 2, 66, ['hospital'], true)
  const TENTS: [number, number, string][] = [[15, 66, 'a'], [20, 67, 'b'], [26, 66, 'c'], [14, 72, 'b'], [20, 73, 'a'], [26, 72, 'c'], [3, 75, 'c'], [8, 76, 'a'], [16, 81, 'b'], [23, 82, 'c'], [4, 82, 'a'], [10, 85, 'b'], [27, 85, 'a']]
  for (const [x, y, k] of TENTS) b.building(`march_tent_${k}`, x, y)
  for (const [x, y] of [[19, 71], [8, 80], [24, 79], [13, 88]] as Cell[]) {
    b.fixture('fixture/light/campfire', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
    b.fixture('fixture/furniture/bench/log', x + 1, y)
  }
  for (const [x, y] of [[13, 66], [29, 70], [2, 79], [30, 84]] as Cell[]) b.fixture('fixture/furniture/rack/arms', x, y)
  for (const [x, y] of [[12, 70], [29, 76], [20, 86]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[18, 77], [19, 77], [6, 73], [28, 81]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[10, 79], [26, 75], [2, 87]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[29, 66], [1, 72]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[13, 70], [6, 71]] as Cell[]) b.fixture('fixture/container/sack', x, y)

  // ------------------------------------------------------------------ the field of the last battle: ash, craters, the wreck of an army, the crows
  for (const [x, y, rx, ry] of [[50, 70, 6, 3], [62, 76, 5, 3], [48, 84, 7, 3], [66, 87, 4, 2], [57, 66, 3, 2]]) b.organic(x, y, rx, ry, 'ash', { rough: 0.6, only: (c) => c === 'dirt' || c === 'drygrass' || c === 'sand' })
  for (const [x, y, r] of [[54, 73, 1.6], [45, 79, 1.4], [64, 82, 1.8], [58, 88, 1.2], [69, 70, 1.3]]) b.organic(x, y, r, r * 0.8, 'mud', { rough: 0.3 })
  for (const [x, y] of [[44, 67], [60, 70], [70, 76], [52, 87], [67, 84], [43, 86]] as Cell[]) b.set(x, y, 'charred_tree')
  for (const [x, y] of [[47, 69], [56, 75], [61, 80], [50, 82], [66, 73], [55, 85], [69, 88], [44, 74]] as Cell[]) b.fixture('fixture/remains/bones', x, y)
  for (const [x, y] of [[52, 72], [63, 85], [46, 88]] as Cell[]) b.fixture('fixture/remains/body', x, y)
  for (const [x, y] of [[57, 71], [49, 77], [65, 79], [59, 86], [53, 80], [70, 82]] as Cell[]) b.fixture('fixture/sacred/sword', x, y)
  for (const [x, y] of [[61, 67], [47, 81]] as Cell[]) b.fixture('fixture/tent/torn', x, y)
  for (const [x, y] of [[55, 78], [68, 68], [42, 83]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[51, 76], [63, 72], [58, 82]] as Cell[]) b.fixture('fixture/nature/soot', x, y)
  for (const [x, y] of [[60, 75], [48, 72], [67, 80]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  b.fixture('fixture/standard', 56, 77)

  // ------------------------------------------------------------------ the dust over it all, the life piled at every wall
  regrass(b, ['grass', 'flowerbed', 'flowers'], 'dirt')
  regrass(b, ['tree'], 'bush')
  // the canyon's scrub and stones: a bush in the lee of a rock, pebbles, the scree under the faces
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.get(x, y) === 'dirt' && !b.near(x, y, (t) => t === 'path' || t === 'wall' || t === 'door', 1) && rng.chance(0.012)) b.set(x, y, 'bush')
  b.sprinkle('fixture/nature/pebbles', 0.025, (_x, _y, t) => t === 'dirt' || t === 'sand')
  for (const r of [l1, l2, t1, t2, t3, t4]) {
    frontage(b, r, true)
    busyRow(b, r, 0, W, 'market')
  }
  piles(b, 0, 0, W, 63, 'poor', 0.4)
  strew(b, 0, 0, W, H, 0.06, 'poor')
  b.anchors = { mesa: [40, 7], court: [36, 20], ledge: [12, 24], square: [36, 44], street: [20, 40], yard: [54, 58], gate: [36, 64], camp: [18, 70], camp2: [12, 79], field: [56, 76], hospital: [7, 71] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the war hall, the armoury, the field hospital
  const hall = warHall(p)
  linkDoors(b, [b.doors.warhall], hall, [hall.doors.out])
  const armoury = armouryHall(p)
  linkDoors(b, [b.doors.armoury], armoury, [armoury.doors.out])
  const hospital = hospitalHall(p)
  linkDoors(b, [b.doors.hospital], hospital, [hospital.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: the garrison and the levies, the captains, the smith, the sisters at the cots
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const cast: Cast[] = []
  for (let n = 0; n < 10; n++) cast.push({ role: 'soldier', home: home(n), day: [at(b, n % 3 === 0 ? A.yard : n % 3 === 1 ? A.camp : A.camp2, 6, 12, 'work', 5), eat(n), at(b, n % 2 ? A.yard : A.gate, 13, 18, 'watch', 5), at(b, n % 2 ? A.camp : A.camp2, 18, 23, 'rest', 4)] })
  for (const c of [A.gate, A.gate, A.mesa, A.court]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 6, 18, 'watch', 3), at(b, A.square, 18, 22, 'watch', 6)] })
  cast.push({ role: 'noble', home: hall.id, age: [40, 60], sex: 'male', day: [at(hall, hall.anchors.table, 7, 12, 'work', 2), at(hall, hall.anchors.dais, 12, 14, 'sit', 1), at(b, A.court, 14, 17, 'walk', 4), at(hall, hall.anchors.table, 17, 22, 'work', 2)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'soldier', home: hall.id, day: [at(hall, hall.anchors.table, 8, 18, 'work', 3), at(hall, hall.anchors.rest, 18, 22, 'rest', 3)] })
  cast.push({ role: 'smith', home: armoury.id, day: [at(armoury, armoury.anchors.forge, 6, 18, 'work', 1), at(b, A.square, 18, 21, 'rest', 4)] })
  cast.push({ role: 'herbalist', sex: 'female', home: hospital.id, stock: [['item/material/herb', 4], ['item/potion/healing', 2]], day: [at(hospital, hospital.anchors.ward, 6, 20, 'work', 4)] })
  cast.push({ role: 'priest', home: hospital.id, day: [at(hospital, hospital.anchors.shrine, 6, 12, 'pray', 1), at(hospital, hospital.anchors.ward, 12, 20, 'work', 4)] })
  stalls.forEach((c, n) => cast.push({ role: 'merchant', home: home(n + 12), stock: n === 0 ? [['item/food/bread', 4], ['item/food/meat/raw', 2]] : n === 1 ? [['item/light/torch', 3], ['item/material/cloth', 2]] : [['item/potion/healing', 1], ['item/food/cheese', 2]], day: [at(b, c, 7, 18, 'work', 0), at(b, A.square, 18, 21, 'rest', 4)] }))
  for (let n = 0; n < 5; n++) cast.push({ role: 'villager', sex: n % 2 ? 'female' : undefined, home: home(n + 16), day: [at(b, n % 2 ? A.street : A.square, 7, 12, 'work', 6), eat(n + 16), at(b, A.square, 13, 19, 'walk', 6)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'child', home: home(n + 22), day: [at(b, A.square, 8, 12, 'play', 6), eat(n + 22), at(b, A.yard, 13, 18, 'play', 6)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'traveler', home: home(n + 26), day: [at(b, A.field, 8, 16, 'walk', 6), at(b, A.camp, 16, 22, 'rest', 3)] })
  cast.push({ role: 'beggar', home: home(30), day: [at(b, A.gate, 6, 22, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, hall, armoury, hospital, ...rooms]
}
