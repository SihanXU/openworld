// Rimeholm (docs/showcase.md §4b.1): Frostfang's harbour on its fjord, after the stave-built ports of the north —
// Bergen's Bryggen wharf, Lofoten's fishing villages, the Hanse's cogs. Three shelves of ground stepping down to the
// water: on the highest the jarl's longhall behind its yard and the houses under their snow, the old north gate where
// the thorns have grown through the wall; on the middle the houses, the tavern and the green with its well; on the quay
// the warehouses and the boathouse, the fish market's stalls and racks, three piers with the cogs moored at them, the
// lighthouse on its spit of shingle, ice floes beyond. The shore runs south along the beach to the road.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { boathouseHall, longHall, seaTavern } from './regionhalls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { NORTH_HOUSES } from '../../art/arch/buildings/regions.ts'
import { busyRow, decor, frontage, piles, strew, unshut } from './dress.ts'
import { glowAt, snowOver, stair, standAnchors } from './ground.ts'

const W = 72
const H = 88
/** The shelves' heights (half levels): the upper town, the middle, the quay and the shore; the sea is 0. */
const UP = 8
const MID = 6
const QUAY = 4
const LIT = { statuses: { lit: -1 } }

export function rimeholm(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'snow', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the shelves of ground and the sea below them
  // (each row of houses far enough below the one above for its roofs not to hide that one's street)
  b.raise(0, 0, W, 24, UP)
  b.raise(0, 24, W, 28, MID)
  b.raise(0, 52, W, H - 52, QUAY)
  b.rect(18, 64, W - 18, H - 64, 'water')
  b.raise(18, 64, W - 18, H - 64, 0)
  // the fjord's deep water beyond the piers, its edge ragged
  for (let x = 18; x < W; x++) b.rect(x, 74 + Math.round(Math.sin(x / 3) * 1.5 + rng.next() * 2), 1, H, 'deepwater')
  for (const [x, y, rx, ry] of [[30, 85, 6, 2], [50, 83, 5, 1.5], [62, 87, 6, 1.5], [24, 87, 4, 1]]) b.organic(x, y, rx, ry, 'ice', { rough: 0.5, only: (c) => c === 'water' || c === 'deepwater' })
  // the stairs between the shelves (half a level a step)
  stair(b, 35, 24, 3, UP, MID, 'flagstone')
  stair(b, 35, 52, 3, MID, QUAY, 'flagstone')
  stair(b, 40, 52, 2, MID, QUAY, 'flagstone')

  // ------------------------------------------------------------------ the upper shelf: the road in by the old gate, the longhall, the houses
  b.path([[6, 0], [6, 7], [9, 13], [11, 20]], 'gravel', 2)
  b.fence('stonewall', [0, 6], [13, 6], [[5, 6], [6, 6], [7, 6]])
  // the thorns through the old wall, the stones it lost
  for (const [x, y] of [[3, 5], [4, 7], [8, 5], [9, 7], [2, 7], [10, 5], [11, 7], [4, 4], [9, 4]] as Cell[]) b.fixture('fixture/nature/briar', x, y)
  for (const [x, y] of [[1, 5], [12, 5], [12, 8]] as Cell[]) b.set(x, y, 'rock')
  b.building('north_longhouse_a', 30, 13, ['longhall'], true)
  pave(b, 28, 17, 16, 2, 'gravel')
  for (const [x, y] of [[29, 17], [42, 17]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[31, 17], [40, 17]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'night')
  }
  for (const [x, y] of [[29, 18], [42, 18]] as Cell[]) b.fixture('fixture/furniture/bench/log', x, y)
  b.fixture('fixture/sacred/waypoint', 37, 17)
  const u1 = houseRow(b, 14, 28, 18, NORTH_HOUSES, 'u', 0.4, { yards: ['court', 'bare'] })
  const u2 = houseRow(b, 44, 70, 18, NORTH_HOUSES, 'u2', 0.4, { yards: ['court', 'bare'] })
  doors.push(...u1.doors, ...u2.doors)
  pave(b, 0, 19, W, 3, 'flagstone')
  b.fence('rail', [0, 23], [33, 23])
  b.fence('rail', [39, 23], [W - 1, 23])
  // behind the houses: the pines of the slope, woodpiles, the hay for the goats
  for (let y = 0; y < 11; y++) for (let x = 14; x < W; x++) if (b.get(x, y) === 'snow' && rng.chance(y < 5 ? 0.35 : 0.12)) b.set(x, y, 'pine')
  for (const [x, y] of [[20, 9], [26, 10], [48, 9], [58, 10], [66, 8]] as Cell[]) b.fixture('fixture/nature/logpile/stack', x, y)
  for (const [x, y] of [[23, 10], [53, 9]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  // the slope west of the road: pines in their stands, boulders the ice left, a cairn
  for (const [x, y, rx, ry] of [[2, 12, 2, 3], [11, 2, 2, 2], [1, 1, 1.5, 2]]) b.organic(x, y, rx, ry, 'pine', { rough: 0.4, only: (c) => c === 'snow' })
  for (const [x, y] of [[3, 17], [12, 15], [0, 9], [13, 11]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  b.fixture('fixture/sacred/waypoint', 4, 10)

  // ------------------------------------------------------------------ the middle shelf: the houses, the tavern, the green with its well
  b.rect(35, 25, 3, 27, 'flagstone')
  // the smith's open forge by the stair, under the upper shelf's face
  b.rect(38, 27, 7, 6, 'gravel')
  b.fixture('fixture/craft/forge', 40, 28, LIT)
  b.fixture('fixture/craft/anvil', 41, 30)
  b.fixture('fixture/water/trough', 43, 28)
  b.fixture('fixture/container/woodpile', 38, 28)
  b.fixture('fixture/furniture/rack/arms', 44, 30)
  glowAt(b, 40, 28, 'always', 0.45, '#ff7a2a')
  for (const [x, y] of [[33, 27], [32, 31], [44, 33]] as Cell[]) b.set(x, y, 'pine')
  // the old stones on the shelf east of the forge, a ring of them round the one still standing
  for (let k = 0; k < 7; k++) b.fixture('fixture/nature/boulder', Math.round(51 + Math.cos((k / 7) * Math.PI * 2) * 3.5), Math.round(30 + Math.sin((k / 7) * Math.PI * 2) * 2.5))
  b.fixture('fixture/sacred/waypoint', 51, 30)
  for (const [x, y] of [[47, 26], [56, 27], [57, 33], [46, 34]] as Cell[]) b.set(x, y, 'pine')
  const m1 = houseRow(b, 2, 30, 40, NORTH_HOUSES, 'm', 0.35, { yards: ['court', 'bare'] })
  b.building('north_tavern', 45, 37, ['tavern'], true)
  const m2 = houseRow(b, 58, 70, 40, NORTH_HOUSES, 'm2', 0.35, { yards: ['court', 'bare'] })
  doors.push(...m1.doors, ...m2.doors)
  pave(b, 0, 41, W, 2, 'flagstone')
  b.rect(24, 43, 24, 7, 'flagstone')
  b.fixture('fixture/water/well', 31, 46)
  for (const [x, y] of [[25, 44], [46, 44], [25, 48], [46, 48]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[29, 47], [42, 45]] as Cell[]) b.fixture('fixture/furniture/bench/log', x, y)
  b.fixture('fixture/sign/noticeboard', 44, 43)
  b.fixture('fixture/light/campfire', 41, 47, LIT)
  glowAt(b, 41, 47, 'always', 0.4)
  for (const [x, y] of [[5, 46], [13, 48], [56, 47], [64, 45]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  // the goats' pen and its shed of hay west of the green; the smokehouse's fire and racks east of it
  b.yard(1, 43, 9, 6, 'rail', [[5, 48]])
  for (const [x, y] of [[3, 44], [7, 45]] as Cell[]) b.fixture('fixture/water/trough', x, y)
  b.rect(52, 43, 10, 6, 'gravel')
  b.fixture('fixture/light/campfire', 55, 45, LIT)
  glowAt(b, 55, 45, 'always', 0.35)
  for (const [x, y] of [[53, 44], [57, 44], [53, 47], [59, 47]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[61, 44], [61, 45]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[11, 44], [20, 48], [50, 49], [69, 44], [70, 49], [21, 44]] as Cell[]) b.set(x, y, 'pine')
  for (const [x, y] of [[14, 44], [68, 47]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  for (const [x, y] of [[17, 45], [60, 49]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[9, 49], [67, 49]] as Cell[]) b.fixture('fixture/nature/logpile/stack', x, y)
  b.fence('rail', [0, 51], [33, 51])
  b.fence('rail', [43, 51], [W - 1, 51])

  // ------------------------------------------------------------------ the quay: warehouses and the boathouse against the shelf, the fish market, the piers
  b.building('north_warehouse_a', 2, 53, ['store'], true)
  const q1 = houseRow(b, 11, 34, 56, NORTH_HOUSES, 'q', 0.3, { setback: 0, yards: ['bare'] })
  b.building('north_warehouse_b', 46, 53, ['boathouse'], true)
  b.building('north_warehouse_a', 54, 53, ['store2'], true)
  doors.push({ door: 'store', prefab: 'north_warehouse_a', role: 'shop' }, { door: 'store2', prefab: 'north_warehouse_a', role: 'shop' })
  const q2 = houseRow(b, 62, 71, 56, NORTH_HOUSES, 'q2', 0, { setback: 0, yards: ['bare'] })
  doors.push(...q1.doors, ...q2.doors)
  pave(b, 0, 57, W, 7, 'flagstone')
  // the market's stalls along the water, the racks of stockfish, nets hung out, the crane, casks and crates
  const stalls: Cell[] = []
  for (const x of [20, 24, 28, 32, 44, 48]) {
    b.fixture('fixture/furniture/stall', x, 61)
    stalls.push([x, 60])
  }
  for (const [x, y] of [[4, 62], [12, 59], [38, 62], [58, 59], [66, 62]] as Cell[]) b.fixture('fixture/furniture/rack/nets', x, y)
  for (const [x, y] of [[8, 59], [16, 62], [60, 62], [68, 59]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  b.building('town_crane', 51, 60)
  for (const [x, y] of [[18, 59], [19, 59], [42, 62], [62, 59], [63, 59]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[26, 59], [50, 63], [65, 59], [6, 60]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const x of [10, 22, 34, 46, 60, 70]) {
    b.fixture('fixture/light/lantern', x, 63, LIT)
    glowAt(b, x, 63, 'night')
  }
  // the piers out over the water, the cogs at them, boats between
  for (const [x, y1] of [[24, 76], [40, 79], [56, 73]] as Cell[]) {
    b.rect(x, 64, 2, y1 - 64, 'bridge')
    b.raise(x, 64, 2, y1 - 64, QUAY)
    b.fixture('fixture/light/lantern', x, y1 - 1, LIT)
    glowAt(b, x, y1 - 1, 'night')
  }
  b.building('north_cog_b', 27, 66)
  b.building('north_cog_c', 43, 69)
  b.building('north_cog_a', 28, 78)
  for (const [x, y] of [[20, 66], [21, 72], [36, 67], [37, 73], [52, 66], [53, 76], [46, 82]] as Cell[]) b.fixture('fixture/boat', x, y)
  // the lighthouse on its spit of shingle
  b.rect(58, 72, 14, 9, 'gravel')
  b.organic(64, 77, 8, 5, 'gravel', { rough: 0.3, only: (c) => c === 'water' })
  for (let y = 66; y < H; y++) for (let x = 56; x < W; x++) if (b.get(x, y) === 'gravel') b.raise(x, y, 1, 1, QUAY)
  b.building('north_lighthouse', 65, 73)
  for (const [x, y] of [[59, 79], [70, 80], [62, 73]] as Cell[]) b.set(x, y, 'rock')
  b.lights.push({ x: 67.5, y: 70, w: 12, h: 9, color: '#ffd27a', shape: 'glow', when: 'night', strength: 0.55 })

  // ------------------------------------------------------------------ the shore: the beach, a fisher's hut, boats drawn up, the road south
  b.rect(14, 64, 4, H - 64, 'gravel')
  b.organic(15, 75, 3, 9, 'sand', { rough: 0.4, only: (c) => c === 'gravel' })
  b.building('north_house_1', 1, 82, ['hut'], true)
  doors.push({ door: 'hut', prefab: 'north_house_1', role: 'home' })
  b.path([[11, 64], [10, 72], [12, 80], [11, H - 1]], 'gravel', 2)
  for (const [x, y] of [[15, 67], [16, 79]] as Cell[]) b.fixture('fixture/boat', x, y)
  for (const [x, y] of [[3, 68], [13, 76], [3, 78]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[7, 68], [14, 84]] as Cell[]) b.fixture('fixture/furniture/rack/nets', x, y)
  b.fixture('fixture/light/campfire', 5, 74, LIT)
  glowAt(b, 5, 74, 'always', 0.4)
  for (const [x, y] of [[4, 75], [7, 75]] as Cell[]) b.fixture('fixture/furniture/bench/log', x, y)
  for (const [x, y] of [[1, 71], [0, 66], [13, 70]] as Cell[]) b.set(x, y, 'pine')

  // ------------------------------------------------------------------ the snow over it all, the life piled at every wall
  snowOver(b)
  for (const r of [u1, u2, m1, m2, q1, q2]) {
    frontage(b, r, true)
    busyRow(b, r, 0, W, 'poor')
  }
  for (let x = 1; x < W - 1; x++) if ((x < 34 || x > 43) && rng.chance(0.22)) decor(b, rng.pick(['decor_casks', 'decor_crates', 'decor_sacks', 'decor_casks_row', 'decor_crates_row']), x, 58)
  piles(b, 0, 0, W, H, 'poor', 0.4)
  strew(b, 0, 0, W, H, 0.08, 'poor')
  b.vistas.push({ at: [18, 57, 54, 31], zoom: 0.7, focus: [44, 72], share: 0.4 })
  b.anchors = { gate: [6, 9], longhall: [35, 18], street: [22, 20], green: [33, 48], quay: [38, 60], pier: [41, 70], shore: [10, 76], lighthouse: [60, 76], fire: [6, 75] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the tavern, the boathouse, the longhall
  const tavern = seaTavern(p)
  linkDoors(b, [b.doors.tavern], tavern, [tavern.doors.out])
  const boat = boathouseHall(p)
  linkDoors(b, [b.doors.boathouse], boat, [boat.doors.out])
  const hall = longHall(p)
  linkDoors(b, [b.doors.longhall], hall, [hall.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: fishers and sailors, the fishwives at their stalls, the jarl and his hall
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const cast: Cast[] = []
  for (let n = 0; n < 8; n++) cast.push({ role: 'fisher', home: home(n), day: [at(b, n % 2 ? A.pier : A.quay, 5, 12, 'work', 6), eat(n), at(b, n % 3 ? A.quay : A.shore, 13, 17, 'work', 6), at(tavern, n % 2 ? tavern.anchors.eat : tavern.anchors.rest, 17, 22, 'rest', 3)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'sailor', home: home(n + 8), day: [at(b, A.pier, 6, 18, 'work', 5), at(tavern, tavern.anchors.bar, 18, 23, 'rest', 3)] })
  stalls.forEach((c, n) => cast.push({ role: 'merchant', sex: 'female', home: home(n + 12), stock: [['item/food/fish/raw', 4], ['item/food/fish/cooked', 2]], day: [at(b, c, 6, 12, 'work', 0), eat(n + 12), at(b, c, 13, 17, 'work', 0), at(b, A.green, 17, 20, 'rest', 4)] }))
  for (let n = 0; n < 5; n++) cast.push({ role: 'villager', sex: n % 2 ? 'female' : undefined, home: home(n + 18), day: [at(b, n % 2 ? A.green : A.street, 7, 12, 'work', 6), eat(n + 18), at(b, A.green, 13, 18, 'walk', 6), at(b, A.fire, 18, 21, 'rest', 3)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'child', home: home(n + 4), day: [at(b, A.green, 8, 12, 'play', 6), eat(n + 4), at(b, n % 2 ? A.shore : A.quay, 13, 18, 'play', 6)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'hunter', home: home(n + 24), day: [at(b, A.gate, 6, 16, 'watch', 4), at(tavern, tavern.anchors.eat, 18, 22, 'rest', 3)] })
  cast.push({ role: 'villager', home: boat.id, day: [at(boat, boat.anchors.hull, 6, 12, 'work', 3), at(boat, boat.anchors.work, 13, 19, 'work', 4)] })
  cast.push({ role: 'villager', home: boat.id, day: [at(boat, boat.anchors.work, 6, 18, 'work', 4)] })
  cast.push({ role: 'noble', home: hall.id, age: [45, 65], sex: 'male', day: [at(hall, hall.anchors.throne, 8, 12, 'sit', 1), at(hall, hall.anchors.eat, 12, 14, 'eat', 2), at(b, A.longhall, 14, 17, 'walk', 4), at(hall, hall.anchors.throne, 17, 22, 'sit', 1)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'guard', home: hall.id, day: [at(b, A.longhall, 6, 20, 'watch', 3), at(hall, hall.anchors.rest, 20, 23, 'rest', 3)] })
  cast.push({ role: 'innkeeper', home: tavern.id, day: [at(tavern, tavern.anchors.bar, 10, 24, 'work', 1)] })
  cast.push({ role: 'bard', home: tavern.id, day: [at(tavern, tavern.anchors.bard, 18, 24, 'work', 1), at(b, A.green, 12, 17, 'work', 3)] })
  cast.push({ role: 'elder', home: home(30), day: [at(b, A.quay, 8, 18, 'sit', 2)] })
  cast.push({ role: 'elder', sex: 'female', home: home(31), day: [at(b, A.lighthouse, 16, 22, 'watch', 1), at(b, A.shore, 8, 15, 'work', 3)] })
  CASTS.set(p.id, cast)
  return [b, tavern, boat, hall, ...rooms]
}
