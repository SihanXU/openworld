// Northmoor Cave (docs/showcase.md §4d): a cave of ice under Frostfang's moor, and the winter camp at its mouth, after the
// ice caves of the north — Eisriesenwelt's halls, Skaftafell's blue ice, the trappers' and ice-cutters' camps of every
// frozen shore. A wall of rock four levels high across the north, the cave's mouth in it hung with icicles; the frozen
// stream out of it; the ice-cutters' sledges and their blocks; the trappers' furs on their racks, the trading hut, the
// tents round the fire; pines and boulders in the snow. Within (regionhalls.ts): the ice caves and the lake beneath.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { iceCaveHall, iceLakeHall } from './regionhalls.ts'
import { clearDoorsteps } from './street.ts'
import { decor, piles, strew, unshut } from './dress.ts'
import { bedsNear, glowAt, snowOver, standAnchors } from './ground.ts'

const W = 60
const H = 64
const CRAG = 8
const MOOR = 0
const LIT = { statuses: { lit: -1 } }

export function northmoor(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'snow', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the crag four levels high, its faces of ice-glazed rock; the moor below
  b.raise(0, 0, W, 16, CRAG)
  b.raise(0, 16, W, H - 16, MOOR)
  for (let y = 0; y < 16; y++) for (let x = 0; x < W; x++) if (rng.chance(y < 8 ? 0.3 : 0.12)) b.set(x, y, 'pine')
  for (const [x, y, rx, ry] of [[10, 6, 3, 2], [48, 4, 4, 2], [30, 3, 2, 1.5]]) b.organic(x, y, rx, ry, 'rock', { rough: 0.5 })
  // the cave's mouth at the crag's foot, icicles over it, the frozen stream out of it
  b.building('cave_mouth', 26, 20, ['cave'], true)
  b.path([[28, 22], [30, 30], [27, 40], [31, 52], [29, H - 1]], 'ice', 2)
  for (const [x, y] of [[25, 22], [31, 22]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
  }
  b.fixture('fixture/sacred/waypoint', 34, 23)

  // ------------------------------------------------------------------ the ice-cutters: their sledges, the blocks sawn from the stream, the saws and the ropes
  for (const [x, y] of [[20, 27], [36, 28], [22, 34]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[33, 32], [34, 32], [33, 33], [24, 29], [25, 29], [35, 38], [36, 38]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[18, 30], [38, 34]] as Cell[]) b.fixture('fixture/furniture/rack', x, y)
  // ------------------------------------------------------------------ the trappers' camp: the trading hut, the furs, the tents round the fire
  b.building('north_house_1', 6, 30, ['trade'], true)
  doors.push({ door: 'trade', prefab: 'north_house_1', role: 'shop' })
  const TENTS: [number, number, string][] = [[42, 40, 'a'], [48, 43, 'c'], [40, 47, 'c'], [50, 50, 'a'], [8, 44, 'a'], [14, 47, 'c']]
  for (const [x, y, k] of TENTS) b.building(`march_tent_${k}`, x, y)
  for (const [x, y] of [[45, 46], [11, 41]] as Cell[]) {
    b.fixture('fixture/light/campfire', x, y, LIT)
    glowAt(b, x, y, 'always', 0.5)
    b.fixture('fixture/furniture/bench/log', x + 1, y)
    b.fixture('fixture/furniture/bench/log', x - 1, y)
  }
  for (const [x, y] of [[4, 36], [8, 37], [16, 36], [54, 41], [38, 42], [53, 46]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[13, 34], [17, 40]] as Cell[]) b.fixture('fixture/nature/logpile/stack', x, y)
  for (const [x, y] of [[47, 38], [5, 48]] as Cell[]) decor(b, 'decor_firewood', x, y)
  for (const [x, y] of [[10, 35], [52, 39]] as Cell[]) decor(b, 'decor_sacks', x, y)
  // the moor: pines in their stands, boulders, a cairn on the rise, the road south
  for (const [x, y, rx, ry] of [[4, 56, 4, 3], [56, 30, 3, 4], [20, 58, 3, 2], [52, 60, 4, 3], [2, 22, 2, 3]]) b.organic(x, y, rx, ry, 'pine', { rough: 0.4, only: (c) => c === 'snow' })
  for (const [x, y] of [[24, 44], [12, 54], [46, 56], [56, 24], [38, 60], [18, 24]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  b.path([[30, 34], [24, 44], [22, 54], [23, H - 1]], 'gravel', 2, { over: (c) => c === 'snow' })
  snowOver(b)
  piles(b, 0, 16, W, H - 16, 'poor', 0.4)
  strew(b, 0, 16, W, H - 16, 0.04, 'poor')
  b.anchors = { mouth: [28, 24], cutters: [30, 32], sledges: [21, 31], trade: [9, 35], campE: [45, 44], campW: [11, 43], moor: [24, 50], cairn: [34, 25] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the ice caves, and the lake beneath them
  const cave = iceCaveHall(p)
  linkDoors(b, [b.doors.cave], cave, [cave.doors.out])
  const lake = iceLakeHall(p)
  linkStair(cave, cave.anchors.down, lake, lake.anchors.stair, true)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the camp's people: the ice-cutters, the trappers, the trader, the cook, the children
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const cast: Cast[] = []
  for (let n = 0; n < 6; n++) cast.push({ role: 'villager', sex: n % 3 ? undefined : 'female', home: b.id, day: [at(b, n % 2 ? A.cutters : A.sledges, 6, 12, 'work', 4), at(b, A.campW, 12, 13, 'eat', 3), at(n < 2 ? cave : b, n < 2 ? cave.anchors.entry : A.cutters, 13, 18, 'work', 3), at(b, A.campE, 18, 22, 'rest', 4)] })
  for (let n = 0; n < 6; n++) cast.push({ role: 'hunter', home: b.id, day: [at(b, n % 2 ? A.moor : A.cairn, 6, 12, 'watch', 6), at(b, A.campE, 12, 13, 'eat', 3), at(b, n % 2 ? A.campW : A.campE, 13, 18, 'work', 4), at(b, A.campE, 18, 22, 'rest', 4)] })
  cast.push({ role: 'merchant', home: rooms[0].id, stock: [['item/material/leather', 3], ['item/food/meat/raw', 3], ['item/light/torch', 4]], day: [at(b, A.trade, 7, 19, 'work', 1)] })
  cast.push({ role: 'villager', sex: 'female', home: b.id, day: [at(b, A.campW, 5, 21, 'work', 3)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'child', home: b.id, day: [at(b, A.campE, 8, 12, 'play', 5), at(b, A.mouth, 12, 17, 'play', 4)] })
  cast.push({ role: 'elder', home: b.id, day: [at(b, A.cairn, 7, 18, 'pray', 2)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'guard', home: b.id, day: [at(b, A.mouth, 6, 20, 'watch', 3)] })
  cast.push({ role: 'traveler', home: b.id, day: [at(b, A.moor, 8, 15, 'walk', 6), at(b, A.campW, 15, 21, 'rest', 3)] })
  const beds = bedsNear(b, [...TENTS.map(([x, y]) => [x + 1, y + 3] as Cell), [45, 47], [11, 42]], cast.length)
  cast.forEach((c, i) => c.home === b.id && (c.bed = beds[i]))
  CASTS.set(p.id, cast)
  return [b, cave, lake, ...rooms]
}
