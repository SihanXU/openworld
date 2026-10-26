// Barleyridge (docs/showcase.md §4c): a farm village of the Vale of Scales, after the open-field villages of the old
// grain lands — Laxton's strips, the Cotswolds' farmsteads round a green, the mill on its leat. A stream runs down from
// the north under the mill's wheel and away south past the green; the orchard stands on its bank of loess with the hives
// under its trees; four farmsteads keep their yards — farmhouse, barn, hen house, a dovecote, a granary on staddles —
// round the green and its well, a row of cottages over it; the strips of wheat and barley run out between hedges, the
// cows are in the pasture, the ducks on the pond.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { barnHall, farmhouseHall, millHall } from './regionhalls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { FARM_HOUSES } from '../../art/arch/buildings/works.ts'
import { busyRow, decor, frontage, piles, strew, unshut } from './dress.ts'
import { glowAt, stair, standAnchors } from './ground.ts'

const W = 76
const H = 80
const PLAIN = 2
const BANK = 4
const GRAZER = { behaviour: 'passive' as const, temper: 'wary' as const, sight: 4, leash: 5 }

export function barleyridge(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  b.raise(0, 0, W, H, PLAIN)
  // ------------------------------------------------------------------ the orchard's bank, the stream, the lanes and their bridges
  b.raise(0, 0, 31, 18, BANK)
  stair(b, 14, 18, 2, BANK, PLAIN, 'path')
  b.path([[56, 0], [54, 10], [50, 18], [44, 28], [38, 38], [32, 50], [26, 62], [22, H - 1]], 'water', 3)
  const lane = (pts: Cell[]) => {
    const cells = b.path(pts, 'path', 2, { over: (c) => c !== 'water' && c !== 'bridge' && c !== 'wall' && c !== 'door' })
    for (const [x, y] of cells) if (b.get(x, y) === 'water') b.set(x, y, 'bridge')
  }
  lane([[40, H - 1], [42, 66], [46, 54], [47, 44]])
  lane([[47, 44], [46, 30], [45, 21]])
  lane([[46, 30], [56, 24], [61, 22]])
  lane([[44, 48], [34, 42], [24, 34], [12, 27]])
  lane([[42, 62], [30, 60], [16, 64], [8, 64]])
  lane([[44, 58], [56, 64], [60, 63]])
  lane([[15, 19], [14, 24]])

  // ------------------------------------------------------------------ the mill on the stream, its yard
  b.building('farm_watermill', 42, 16, ['mill'], true)
  pave(b, 40, 20, 8, 2, 'path')
  for (const [x, y] of [[40, 20], [41, 21]] as Cell[]) decor(b, 'decor_sacks', x, y)
  b.fixture('fixture/furniture/cart', 38, 21)

  // ------------------------------------------------------------------ the orchard on its bank: trees in rows, hives under them, the path along the edge
  for (let y = 2; y < 17; y += 3) for (let x = 2 + (y % 2); x < 30; x += 4) if (b.get(x, y) === 'grass') b.set(x, y, 'tree')
  for (const [x, y] of [[4, 4], [8, 10], [16, 7], [24, 13], [20, 3]] as Cell[]) b.fixture('fixture/nature/beehive', x, y)
  b.fence('rail', [0, 17], [13, 17])
  b.fence('rail', [16, 17], [30, 17])
  for (const [x, y] of [[10, 13], [27, 8]] as Cell[]) b.fixture('fixture/furniture/cart/flowers', x, y)
  // the wheat north of the green, between the bank and the stream; the barley west of the stream
  strips(b, 32, 2, 16, 12, 3)
  strips(b, 18, 30, 16, 12, 4)

  // ------------------------------------------------------------------ the farmsteads: farmhouse and barn over a yard, a hen house, hay, a cart
  const stead = (name: string, house: string, hx: number, hy: number, barn: string, bx: number, by: number, hall?: string) => {
    b.building(house, hx, hy, [hall === 'farmhouse' ? 'farmhouse' : `${name}h`], true)
    if (hall !== 'farmhouse') doors.push({ door: `${name}h`, prefab: house, role: 'farmhouse' })
    b.building(barn, bx, by, [hall === 'barn' ? 'barn' : `${name}b`], true)
    if (hall !== 'barn') doors.push({ door: `${name}b`, prefab: barn, role: 'farmhouse' })
  }
  // the great farm north-east: its yard fenced to the lane, the coop, the hay, the trough
  stead('ne', 'farm_house_5', 56, 10, 'farm_barn_a', 66, 9, 'farmhouse')
  b.fence('rail', [55, 15], [55, 21])
  b.fence('rail', [55, 21], [W - 1, 21], [[61, 21], [62, 21]])
  b.building('farm_coop', 70, 16)
  b.fixture('fixture/nature/haystack', 66, 17)
  b.fixture('fixture/water/trough', 64, 19)
  b.fixture('fixture/furniture/cart', 58, 18)
  b.building('farm_dovecote', 73, 11)
  // the west farm under the orchard: its staddle granary, its kitchen garden
  stead('w', 'farm_house_1', 4, 21, 'farm_barn_b', 15, 20)
  b.building('farm_staddle', 26, 22)
  b.rect(3, 27, 10, 4, 'farmland')
  for (let x = 3; x < 13; x += 2) for (const y of [28, 30]) b.fixture(x % 4 === 1 ? 'fixture/nature/plant' : 'fixture/crop/wheat/young', x, y)
  b.building('farm_coop', 24, 27)
  // the south-east farm by the pond, its dovecote
  stead('se', 'farm_house_2', 56, 58, 'farm_barn_a', 66, 56, 'barn')
  b.building('farm_dovecote', 52, 61)
  b.building('farm_coop', 66, 63)
  b.organic(62, 71, 5, 3, 'water', { rough: 0.35 })
  b.sprinkle('fixture/nature/reeds', 0.35, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'water', 1) && Math.hypot(x - 62, y - 71) < 8)
  // the south-west farm by the stream
  stead('sw', 'farm_house_3', 3, 58, 'farm_barn_b', 12, 57)
  b.building('farm_staddle', 3, 66)
  b.building('farm_coop', 20, 61)
  for (const [x, y] of [[8, 66], [14, 67], [16, 63]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)

  // ------------------------------------------------------------------ the green: the cottages over it, the well, the maypole, the great oak, the shrine
  const c1 = houseRow(b, 50, 74, 40, FARM_HOUSES, 'c', 0.45, { yards: ['garden', 'garden', 'bare'] })
  const c2 = houseRow(b, 4, 22, 48, FARM_HOUSES, 'c2', 0.45, { yards: ['garden', 'garden', 'bare'] })
  doors.push(...c1.doors, ...c2.doors)
  b.organic(48, 47, 8, 4, 'flowers', { rough: 0.6, only: (c) => c === 'grass' })
  b.fixture('fixture/water/well', 49, 46)
  b.fixture('fixture/standard', 45, 45)
  b.set(54, 45, 'tree')
  for (const [x, y] of [[51, 48], [43, 49]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  b.fixture('fixture/sacred/waypoint', 41, 52)
  b.fixture('fixture/sign/noticeboard', 52, 43)
  b.fixture('fixture/furniture/stall', 55, 49)

  // ------------------------------------------------------------------ the pasture with its cows, the fields in their strips between hedges
  b.yard(58, 24, 18, 12, 'rail', [[60, 24], [66, 35]])
  for (const [x, y] of [[62, 27], [67, 29], [71, 26], [64, 32]] as Cell[]) b.creature('animal/cow', x, y, { ...GRAZER })
  for (const [x, y] of [[69, 32], [72, 30]] as Cell[]) b.creature('animal/calf', x, y, { ...GRAZER })
  b.fixture('fixture/water/trough', 73, 33)
  b.set(70, 25, 'tree')
  strips(b, 1, 33, 22, 13, 4)
  strips(b, 24, 66, 14, 13, 3)
  strips(b, 47, 70, 10, 9, 3)
  for (const [x, y] of [[12, 40], [32, 72], [38, 6]] as Cell[]) b.fixture('fixture/scarecrow', x, y)
  for (const [x, y] of [[20, 44], [28, 70], [44, 12], [52, 76]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  // hens about the yards, ducks... (the pond's own): chickens by every coop
  for (const [x, y] of [[69, 19], [72, 19], [23, 30], [25, 31], [65, 66], [68, 67], [19, 64], [22, 65]] as Cell[]) b.creature(rng.chance(0.25) ? 'animal/chick' : 'animal/chicken', x, y, { ...GRAZER, leash: 3 })
  // trees in the hedgerows, a tuft and a flower in the grass
  for (const [x, y] of [[0, 32], [23, 46], [36, 64], [74, 44], [74, 52], [30, 30], [34, 24], [60, 52], [2, 74], [12, 76]] as Cell[]) if (b.get(x, y) === 'grass') b.set(x, y, 'tree')
  b.sprinkle('fixture/nature/tuft', 0.05, (_x, _y, t) => t === 'grass')
  b.sprinkle('fixture/nature/flowers', 0.025, (_x, _y, t) => t === 'grass')

  // ------------------------------------------------------------------ the life piled at every wall, strewn on the lanes
  for (const r of [c1, c2]) {
    frontage(b, r, true)
    busyRow(b, r, 0, W, 'poor')
  }
  piles(b, 0, 0, W, H, 'poor', 0.35)
  strew(b, 0, 0, W, H, 0.08, 'poor')
  for (const [x, y] of [[61, 19], [60, 62], [10, 62], [8, 25]] as Cell[]) b.fixture('fixture/furniture/washing_line', x, y)
  for (const [x, y] of [[59, 15], [8, 26]] as Cell[]) {
    b.fixture('fixture/light/lantern', x, y, { statuses: { lit: -1 } })
    glowAt(b, x, y, 'night')
  }
  b.vistas.push({ at: [36, 40, 24, 16], zoom: 0.65, focus: [46, 30], share: 0.4 })
  b.anchors = { green: [47, 48], well: [50, 47], mill: [45, 22], orchard: [12, 8], fieldN: [38, 9], fieldW: [10, 40], fieldS: [30, 72], pasture: [65, 30], yardNE: [63, 18], yardSE: [60, 64], pond: [58, 70], road: [41, 72] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the great farm's house and the south-east farm's barn, the mill
  const house = farmhouseHall(p)
  linkDoors(b, [b.doors.farmhouse], house, [house.doors.out])
  const barn = barnHall(p)
  linkDoors(b, [b.doors.barn], barn, [barn.doors.out])
  const mill = millHall(p)
  linkDoors(b, [b.doors.mill], mill, [mill.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: the farmers in their strips, the wives in the yards, the miller, the children
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const fields = [A.fieldN, A.fieldW, A.fieldS, A.pasture, A.orchard]
  const cast: Cast[] = []
  for (let n = 0; n < 9; n++) cast.push({ role: 'farmer', home: home(n), day: [at(b, fields[n % 5], 5, 12, 'work', 6), eat(n), at(b, fields[(n + 2) % 5], 13, 18, 'work', 6), at(b, A.green, 18, 21, 'rest', 5)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'villager', sex: 'female', home: home(n + 9), day: [at(b, n % 2 ? A.yardNE : A.yardSE, 6, 12, 'work', 4), eat(n + 9), at(b, n % 2 ? A.well : A.green, 13, 18, 'walk', 5)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'child', home: home(n + 3), day: [at(b, A.green, 8, 12, 'play', 6), eat(n + 3), at(b, n % 2 ? A.pond : A.orchard, 13, 18, 'play', 5)] })
  cast.push({ role: 'farmer', home: mill.id, age: [40, 65], day: [at(mill, mill.anchors.stones, 6, 12, 'work', 2), at(b, A.mill, 12, 14, 'rest', 3), at(mill, mill.anchors.floor, 14, 19, 'work', 3)] })
  cast.push({ role: 'farmer', home: house.id, age: [45, 65], sex: 'male', day: [at(b, A.pasture, 6, 11, 'work', 5), at(house, house.anchors.eat, 11, 13, 'eat', 2), at(b, A.yardNE, 13, 18, 'work', 4), at(house, house.anchors.hearth, 18, 22, 'rest', 2)] })
  cast.push({ role: 'villager', home: house.id, sex: 'female', day: [at(house, house.anchors.hearth, 6, 12, 'work', 2), at(b, A.yardNE, 12, 16, 'work', 3), at(house, house.anchors.eat, 16, 21, 'work', 2)] })
  cast.push({ role: 'farmer', home: barn.id, day: [at(barn, barn.anchors.pen, 5, 10, 'work', 2), at(b, A.yardSE, 10, 16, 'work', 4), at(barn, barn.anchors.work, 16, 20, 'work', 3)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'elder', home: home(n + 20), day: [at(b, A.green, 8, 19, 'sit', 3)] })
  cast.push({ role: 'peddler', home: home(23), stock: [['item/food/bread', 3], ['item/food/apple', 4], ['item/food/cheese', 2]], day: [at(b, [55, 50], 7, 18, 'work', 1)] })
  cast.push({ role: 'priest', home: home(24), day: [at(b, [41, 53], 7, 18, 'pray', 2)] })
  CASTS.set(p.id, cast)
  return [b, house, barn, mill, ...rooms]
}

/** Strips of a field: `n` of them across the rect, each a run of farmland with its crop, a hedge or a balk between. */
function strips(b: MapBuilder, x0: number, y0: number, w: number, h: number, n: number): void {
  const sw = Math.floor(w / n)
  for (let k = 0; k < n; k++) {
    const x = x0 + k * sw
    const ripe = rng.chance(0.6)
    for (let y = y0; y < y0 + h; y++)
      for (let i = x; i < x + sw - 1; i++) {
        if (!b.in(i, y) || b.get(i, y) !== 'grass') continue
        b.set(i, y, 'farmland')
        if ((y - y0) % 2 === 0 && (i - x) % 2 === 0 && rng.chance(0.8)) b.fixture(ripe ? 'fixture/crop/wheat/ripe' : 'fixture/crop/wheat/young', i, y)
      }
    // the balk between strips: a hedge now and then, else grass
    for (let y = y0; y < y0 + h; y++) if (b.in(x + sw - 1, y) && b.get(x + sw - 1, y) === 'grass' && rng.chance(0.45)) b.set(x + sw - 1, y, 'bush')
  }
}
