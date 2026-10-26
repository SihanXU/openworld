// Frostbarrow (docs/showcase.md §4d): Frostfang's border fort on the pass, the North Gate's castle snowed over, after the
// march forts of every cold frontier — Hadrian's milecastles, the Varangian posts, the Night's Watch of every story. The
// mountain at its back; four drum towers and the curtain between them, the gatehouse on the road; within, the keep
// with its hall, the garrison's longhouse, the stables, the forge, the drill yard trodden into the snow, the well; outside
// the gate the road down the pass, the waystation, the cairns of those the winter took.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { garrisonHall } from './regionhalls.ts'
import { greatHall } from './halls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { clearDoorsteps, pave } from './street.ts'
import { decor, piles, strew, unshut } from './dress.ts'
import { glowAt, snowOver, standAnchors } from './ground.ts'

const W = 64
const H = 76
const MOUNTAIN = 8
const PASS = 0
const LIT = { statuses: { lit: -1 } }

/** A run of the snowed curtain from (x, y) `len` cells along `axis`, in the longest stretches the art has. */
function wall(b: MapBuilder, axis: 'x' | 'y', x: number, y: number, len: number) {
  const LEN = [12, 10, 8, 6, 5, 4, 3, 2]
  let k = 0
  while (k < len) {
    const n = LEN.find((l) => l <= len - k) ?? 2
    b.building(`snow_fort_wall_${axis}${n}`, axis === 'x' ? x + k : x, axis === 'x' ? y : y + k)
    k += n
  }
}

export function frostbarrow(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'snow', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  const note = (door: string, prefab: string, role: DoorNote['role']) => doors.push({ door, prefab, role })
  // ------------------------------------------------------------------ the mountain at the fort's back, its pines and crags
  b.raise(0, 0, W, 10, MOUNTAIN)
  b.raise(0, 10, W, H - 10, PASS)
  for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) if (rng.chance(0.35)) b.set(x, y, 'pine')
  for (const [x, y, rx, ry] of [[14, 4, 3, 2], [46, 5, 4, 2]]) b.organic(x, y, rx, ry, 'rock', { rough: 0.5 })
  // ------------------------------------------------------------------ the curtain: four drums, the walls between, the gatehouse on the road
  b.rect(8, 18, 47, 34, 'gravel')
  for (const [x, y] of [[4, 14], [53, 14], [4, 47], [53, 47]] as Cell[]) b.building('snow_fort_tower_round', x, y)
  wall(b, 'x', 11, 16, 42)
  wall(b, 'y', 6, 21, 26)
  wall(b, 'y', 56, 21, 26)
  b.building('snow_fort_gatehouse', 25, 48)
  wall(b, 'x', 11, 51, 14)
  wall(b, 'x', 39, 51, 14)
  // ------------------------------------------------------------------ within: the keep and its hall, the garrison's longhouse, the stables, the forge, the yard
  b.building('snow_fort_keep', 26, 19, ['keep', 'keep2'])
  b.building('north_longhouse_b', 10, 22, ['garrison'], true)
  b.building('north_warehouse_a', 45, 22, ['stables'], true)
  note('stables', 'north_warehouse_a', 'farmhouse')
  b.building('north_house_4', 10, 36, ['store'], true)
  note('store', 'north_house_4', 'shop')
  pave(b, 26, 30, 12, 3, 'flagstone')
  for (const [x, y] of [[28, 31], [35, 31]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
  }
  b.building('fort_well', 31, 38)
  for (const x of [20, 23, 40, 43]) b.fixture('fixture/dummy', x, 42)
  for (const x of [19, 44]) b.fixture('fixture/furniture/rack/arms', x, 40)
  b.fixture('fixture/craft/forge', 46, 34, LIT)
  b.fixture('fixture/craft/anvil', 48, 35)
  glowAt(b, 46, 34, 'always', 0.5, '#ff7a2a')
  for (const [x, y] of [[50, 33], [51, 33], [52, 34]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[46, 28], [48, 29], [52, 28]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/water/trough', 50, 30)
  for (const [x, y] of [[9, 44], [10, 44], [9, 45], [53, 42], [53, 43]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[16, 46], [42, 46]] as Cell[]) decor(b, 'decor_firewood', x, y)
  for (const [x, y] of [[22, 33], [40, 36]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[9, 20], [54, 20]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[29, 47], [34, 47]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
  }
  // ------------------------------------------------------------------ outside the gate: the road down the pass, the waystation, the cairns, the pines
  b.path([[31, 56], [30, 63], [33, 70], [32, H - 1]], 'gravel', 3)
  b.building('north_house_10', 42, 60, ['way'], true)
  note('way', 'north_house_10', 'inn')
  b.fixture('fixture/light/campfire', 24, 62, LIT)
  glowAt(b, 24, 62, 'always', 0.45)
  b.fixture('fixture/sign', 35, 58)
  for (let k = 0; k < 7; k++) b.fixture('fixture/sacred/gravestone', 8 + k * 2, 64 + (k % 2), { props: { text: 'Taken by the winter on the pass.', text_zh: '在山口被冬天带走。' } })
  for (const [x, y, rx, ry] of [[4, 70, 4, 3], [58, 68, 4, 4], [52, 74, 4, 2], [12, 74, 3, 2]]) b.organic(x, y, rx, ry, 'pine', { rough: 0.4, only: (c) => c === 'snow' })
  b.organic(50, 70, 4, 2, 'ice', { rough: 0.4, only: (c) => c === 'snow' })
  for (const [x, y] of [[20, 58], [54, 58], [2, 58], [61, 62]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  snowOver(b)
  piles(b, 8, 18, 47, 34, 'poor', 0.35)
  strew(b, 0, 10, W, H - 10, 0.04, 'poor')
  b.vistas.push({ at: [22, 54, 20, 12], zoom: 0.6, focus: [31, 34], share: 0.4 })
  b.anchors = { gate: [31, 57], yard: [31, 43], keep: [31, 33], wallW: [10, 30], wallE: [52, 38], forge: [47, 36], stables: [48, 27], road: [31, 66], way: [44, 64], cairns: [14, 66] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the keep's hall, the garrison
  const hall = greatHall(p)
  linkDoors(b, [b.doors.keep, b.doors.keep2], hall, HALLS.greathall.doors)
  const garrison = garrisonHall(p)
  linkDoors(b, [b.doors.garrison], garrison, [garrison.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the garrison: the captain, the watch on the gate and the walls, the drill, the smith
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const G = garrison.anchors
  const cast: Cast[] = []
  cast.push({ role: 'noble', sex: 'male', age: [40, 60], home: hall.id, day: [at(hall, hall.anchors.throne, 7, 12, 'sit', 1), at(b, A.yard, 12, 15, 'watch', 4), at(hall, hall.anchors.eat, 15, 21, 'sit', 2)] })
  for (let n = 0; n < 12; n++) {
    const post = [A.gate, A.wallW, A.wallE, A.yard, A.keep, A.road][n % 6]
    cast.push({ role: n % 3 ? 'soldier' : 'guard', home: garrison.id, day: n % 4 === 3 ? [at(b, post, 18, 6, 'watch', 3), at(garrison, G.mess, 6, 8, 'eat', 3)] : [at(b, post, 6, 12, 'watch', 3), at(garrison, G.mess, 12, 13, 'eat', 3), at(b, n % 2 ? A.yard : post, 13, 18, 'work', 4), at(garrison, G.mess, 18, 21, 'rest', 3)] })
  }
  cast.push({ role: 'smith', home: garrison.id, day: [at(b, A.forge, 6, 18, 'work', 1), at(garrison, G.mess, 18, 21, 'rest', 3)] })
  cast.push({ role: 'villager', sex: 'female', home: garrison.id, day: [at(garrison, G.mess, 5, 20, 'work', 3)] })
  cast.push({ role: 'merchant', home: rooms.find((r) => r.id.includes('shop'))?.id ?? rooms[0].id, stock: [['item/light/torch', 4], ['item/food/bread', 3], ['item/material/leather', 2]], day: [at(b, [13, 40], 7, 18, 'work', 2)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'farmer', home: rooms[0].id, day: [at(b, A.stables, 6, 18, 'work', 3)] })
  cast.push({ role: 'priest', home: hall.id, day: [at(b, A.cairns, 7, 12, 'pray', 2), at(hall, hall.anchors.work, 12, 19, 'pray', 2)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'traveler', home: rooms[rooms.length - 1].id, day: [at(b, A.way, 7, 11, 'rest', 3), at(b, A.gate, 11, 16, 'walk', 4), at(b, A.road, 16, 20, 'walk', 5)] })
  CASTS.set(p.id, cast)
  return [b, hall, garrison, ...rooms]
}
