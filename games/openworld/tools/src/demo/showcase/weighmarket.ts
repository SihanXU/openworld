// Weighmarket (docs/showcase.md §4b.3): the Vale of Scales' granary city, where the Black Steward's tithe is weighed
// (lore.md), after the grain towns of the old plains — Siena's Campo, the Hanse's grain halls, the market of every
// tithe barn. The mills turn on their rise over the dry fields; the granaries and the counting house close the north
// of the great square, where the city's scales stand in the middle of the stalls; the guild houses on the south side
// are washed in ochre and rose. Behind them is the other city: the hovels under their thatch, the mud lanes, the
// poorhouse, and east of them the salt pans glittering in their dykes.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { countingHall, granaryHall, poorHall } from './regionhalls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { VALE_HOUSES, VALE_HOVELS } from '../../art/arch/buildings/regions.ts'
import { busyRow, decor, festoons, frontage, lamp, lampRow, panels, pavement, piles, strew, unshut } from './dress.ts'
import { glowAt, stair, standAnchors } from './ground.ts'

const W = 80
const H = 90
const PLAIN = 2
const RISE = 6
const LIT = { statuses: { lit: -1 } }

const TRADES: [string, [string, number][]][] = [
  ['bread', [['item/food/bread', 5], ['item/food/pie', 1]]],
  ['fruit', [['item/food/apple', 4], ['item/food/berries', 3]]],
  ['meat', [['item/food/meat/raw', 3], ['item/food/cheese', 3]]],
  ['cloth', [['item/material/cloth', 3], ['item/material/wool', 3]]],
  ['pots', [['item/vessel/pot', 2], ['item/vessel/cup', 3]]],
  ['herbs', [['item/material/herb', 4], ['item/potion/healing', 1]]],
]

export function weighmarket(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'drygrass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  b.raise(0, 0, W, H, PLAIN)
  // ------------------------------------------------------------------ the mills' rise and the dry fields west of it
  b.raise(46, 0, W - 46, 18, RISE)
  stair(b, 76, 18, 2, RISE, PLAIN, 'path')
  b.rect(76, 19, 2, 7, 'path')
  b.path([[77, 17], [70, 15], [58, 13], [52, 11]], 'path', 1)
  b.building('vale_windmill_a', 48, 5)
  b.building('vale_windmill_b', 62, 8)
  for (const [x, y] of [[57, 11], [58, 11], [70, 12]] as Cell[]) b.fixture('fixture/container/sack', x, y)
  for (const [x, y] of [[56, 13], [71, 4], [74, 9]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[73, 2], [66, 2], [47, 15]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  // the fields in their strips, wheat standing and cut, a scarecrow, the stooks; the earth cracked where the rain forgot it
  for (let k = 0; k < 6; k++) {
    const x0 = 1 + k * 7 + rng.int(0, 1)
    b.rect(x0, 1, 5, 14, 'farmland')
    for (let y = 2; y < 14; y += 2) for (let x = x0; x < x0 + 5; x += 2) if (rng.chance(0.7)) b.fixture(k % 3 === 2 ? 'fixture/crop/wheat/young' : 'fixture/crop/wheat/ripe', x, y)
  }
  b.path([[0, 16], [20, 15], [44, 16]], 'path', 1)
  for (const [x, y] of [[8, 15], [29, 15], [43, 3]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/scarecrow', 22, 8)
  for (const [x, y] of [[44, 9], [45, 12]] as Cell[]) b.set(x, y, 'tree')

  // ------------------------------------------------------------------ the north of the square: the granaries, the counting house, the merchants' houses
  b.building('vale_granary_a', 2, 22, ['granary'], true)
  b.building('vale_granary_b', 12, 22, ['gr2'], true)
  const n1 = houseRow(b, 20, 33, 25, VALE_HOUSES, 'n', 0.2, { setback: 1 })
  b.building('vale_counting', 34, 22, ['counting'], true)
  const n2 = houseRow(b, 47, 55, 25, VALE_HOUSES, 'n2', 0, { setback: 1 })
  b.building('vale_granary_a', 56, 22, ['gr3'], true)
  b.building('vale_granary_b', 66, 22, ['gr4'], true)
  doors.push({ door: 'gr2', prefab: 'vale_granary_b', role: 'mill' }, { door: 'gr3', prefab: 'vale_granary_a', role: 'mill' }, { door: 'gr4', prefab: 'vale_granary_b', role: 'mill' })
  doors.push(...n1.doors, ...n2.doors)
  pave(b, 0, 26, W, 3, 'paving')
  pavement(b, 0, W - 1, 26)
  lampRow(b, 6, 74, 28, 9, (x) => x >= 38 && x <= 42)

  // ------------------------------------------------------------------ the great square: the scales in the middle, the stalls in their runs, the cross-ways
  b.rect(14, 29, 52, 26, 'flags')
  b.rect(16, 31, 48, 22, 'paving')
  panels(b, 16, 31, 48, 22, 8)
  for (let y = 31; y < 53; y++) for (let x = 16; x < 64; x++) if (Math.hypot(x + 0.5 - 40, y + 0.5 - 42) < 5.5) b.set(x, y, 'plaza')
  b.building('vale_scales', 38, 38)
  const stalls: { keeper: Cell; trade: number }[] = []
  let k = 0
  for (const [y, xs] of [[34, [17, 21, 25, 51, 55, 59]], [50, [17, 21, 25, 51, 55, 59]]] as [number, number[]][])
    for (const x of xs) {
      const trade = k++ % TRADES.length
      b.building(`market_stall_${TRADES[trade][0]}`, x, y - 1)
      stalls.push({ keeper: [x + 1, y - 1], trade })
    }
  for (const [x, y] of [[33, 37], [47, 37], [33, 47], [47, 47]] as Cell[]) lamp(b, x, y, 0.28)
  for (const [x, y] of [[31, 42], [49, 42]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  b.fixture('fixture/water/well/square', 22, 42)
  b.fixture('fixture/sign/noticeboard', 58, 41)
  for (const [x, y] of [[29, 32], [52, 45], [20, 46], [62, 38]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[16, 39], [63, 46], [36, 52], [44, 31]] as Cell[]) b.fixture('fixture/container/sack', x, y)
  for (const [x, y] of [[16, 32], [63, 32], [16, 52], [63, 52]] as Cell[]) b.fixture('fixture/standard', x, y)
  // the side streets west and east of the square: a house each side (its roofs hide the ground behind it), the
  // gardens north of them with their trees and a well
  const w1 = houseRow(b, 1, 13, 47, VALE_HOUSES, 'w', 0)
  const e1 = houseRow(b, 66, 79, 47, VALE_HOUSES, 'e', 0)
  doors.push(...w1.doors, ...e1.doors)
  pave(b, 0, 48, 14, 2, 'paving')
  pave(b, 66, 48, 14, 2, 'paving')
  for (const [x, y] of [[3, 31], [10, 32], [70, 31], [76, 32]] as Cell[]) b.set(x, y, 'tree')
  b.fixture('fixture/water/well', 6, 31)
  b.fixture('fixture/water/well', 73, 31)
  b.rect(0, 29, 14, 1, 'paving')
  b.rect(66, 29, 14, 1, 'paving')

  // ------------------------------------------------------------------ the south side: the guild houses, the road in from the south
  b.rect(14, 55, 52, 13, 'flags')
  for (const [x, y] of [[20, 58], [60, 58], [28, 62], [52, 62]] as Cell[]) b.set(x, y, 'tree')
  for (const [x, y] of [[24, 57], [56, 57]] as Cell[]) b.fixture('fixture/water/fountain', x, y)
  const s1 = houseRow(b, 2, 37, 68, VALE_HOUSES, 's', 0.2)
  const s2 = houseRow(b, 43, 78, 68, VALE_HOUSES, 's2', 0.2)
  doors.push(...s1.doors, ...s2.doors)
  pave(b, 0, 69, W, 3, 'paving')
  pavement(b, 0, W - 1, 69)
  b.rect(38, 55, 5, H - 55, 'paving')
  lampRow(b, 5, 76, 71, 9, (x) => x >= 37 && x <= 43)

  // ------------------------------------------------------------------ the other city: hovels and the poorhouse, mud lanes, washing between
  b.building('vale_poorhouse', 1, 76, ['poorhouse'], true)
  const h1 = houseRow(b, 12, 37, 79, VALE_HOVELS, 'h', 0.4, { yards: ['bare'] })
  const h2 = houseRow(b, 1, 37, 87, VALE_HOVELS, 'h2', 0.4, { yards: ['bare'] })
  doors.push(...h1.doors, ...h2.doors)
  pave(b, 0, 80, 38, 3, 'dirt')
  pave(b, 0, 88, 38, 2, 'dirt')
  for (const [x, y, rx, ry] of [[8, 81, 4, 1.2], [26, 81, 5, 1.2], [16, 89, 6, 1], [31, 88, 3, 1]]) b.organic(x, y, rx, ry, 'mud', { rough: 0.4, only: (c) => c === 'dirt' })
  for (const [x, y] of [[6, 82], [20, 81], [30, 82]] as Cell[]) b.fixture('fixture/furniture/washing_line', x, y)
  b.fixture('fixture/water/well', 24, 82)
  b.fixture('fixture/light/campfire', 14, 82, LIT)
  glowAt(b, 14, 82, 'always', 0.4)

  // ------------------------------------------------------------------ the salt pans east of the road: shallow pans in their dykes, the salt raked into heaps
  b.rect(44, 73, W - 44, H - 73, 'sand')
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 6; i++) {
      const x = 46 + i * 6
      const y = 74 + j * 4
      b.rect(x, y, 4, 2, rng.chance(0.25) ? 'ice' : 'water')
    }
  for (const [x, y] of [[45, 77], [57, 81], [69, 77], [63, 85], [75, 81], [51, 89]] as Cell[]) decor(b, 'decor_sacks', x, y)
  for (const [x, y] of [[50, 76], [62, 80], [74, 84], [56, 88]] as Cell[]) b.fixture('fixture/furniture/rack', x, y)
  for (const [x, y] of [[44, 73], [79, 73]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)

  // ------------------------------------------------------------------ the clutter: every front piled, the square's festoons, the paving strewn
  for (const r of [n1, n2, w1, e1, s1, s2]) {
    frontage(b, r)
    busyRow(b, r, 0, W, 'market')
  }
  for (const r of [h1, h2]) {
    frontage(b, r, true)
    busyRow(b, r, 0, W, 'poor')
  }
  festoons(b, 16, 63, 30, ['flags'], 0.9)
  festoons(b, 16, 63, 53, ['flags', 'lanterns'], 0.9)
  piles(b, 0, 18, W, H - 18, 'market', 0.4)
  strew(b, 0, 18, W, 55, 0.1)
  strew(b, 0, 73, 44, 17, 0.14, 'poor')
  b.anchors = { square: [40, 46], scales: [40, 44], north: [40, 27], fields: [20, 16], mills: [58, 14], south: [40, 70], lane: [20, 81], pans: [60, 78], well: [23, 44] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the counting house, the granary, the poorhouse
  const counting = countingHall(p)
  linkDoors(b, [b.doors.counting], counting, [counting.doors.out])
  const granary = granaryHall(p)
  linkDoors(b, [b.doors.granary], granary, [granary.doors.out])
  const poor = poorHall(p)
  linkDoors(b, [b.doors.poorhouse], poor, [poor.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: the stallkeepers, the Steward's clerks, the millers, the salt rakers, the poor
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const cast: Cast[] = []
  stalls.forEach((st, n) => cast.push({ role: 'merchant', home: home(n), stock: TRADES[st.trade][1], day: [at(b, st.keeper, 6, 12, 'work', 0), eat(n), at(b, st.keeper, 13, 18, 'work', 0), at(b, A.well, 18, 21, 'rest', 5)] }))
  for (let n = 0; n < 3; n++) cast.push({ role: 'scholar', home: home(n + 12), day: [at(counting, n ? counting.anchors.clerk : counting.anchors.counter, 7, 18, 'work', 1), at(b, A.square, 18, 20, 'walk', 6)] })
  cast.push({ role: 'noble', home: counting.id, age: [50, 70], day: [at(counting, counting.anchors.strong, 8, 12, 'work', 1), at(b, A.scales, 12, 16, 'watch', 2), at(counting, counting.anchors.counter, 16, 20, 'work', 2)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'farmer', home: home(n + 16), day: [at(granary, granary.anchors.floor, 6, 12, 'work', 4), eat(n + 16), at(b, n ? A.fields : A.mills, 13, 19, 'work', 6)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'farmer', home: home(n + 20), day: [at(b, A.fields, 5, 12, 'work', 10), eat(n + 20), at(b, A.fields, 13, 18, 'work', 10)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'villager', sex: n % 2 ? 'female' : undefined, home: home(n + 24), day: [at(b, A.pans, 6, 12, 'work', 8), eat(n + 24), at(b, A.pans, 13, 18, 'work', 8), at(b, A.lane, 18, 21, 'rest', 4)] })
  for (let n = 0; n < 12; n++) cast.push({ role: n % 5 === 0 ? 'noble' : 'villager', home: home(n + 30), day: [at(b, A.square, 8, 12, 'walk', 11), eat(n + 30), at(b, n % 2 ? A.square : A.north, 13, 18, 'walk', 10), at(b, A.south, 18, 21, 'walk', 6)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'beggar', home: poor.id, day: [at(b, n % 2 ? A.scales : A.lane, 7, 18, 'sit', 4), at(poor, poor.anchors.eat, 18, 22, 'eat', 3)] })
  cast.push({ role: 'priest', home: poor.id, day: [at(poor, poor.anchors.beds, 6, 12, 'work', 3), at(b, A.lane, 12, 18, 'walk', 6)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'child', home: home(n + 40), day: [at(b, A.lane, 8, 12, 'play', 6), eat(n + 40), at(b, n % 2 ? A.well : A.square, 13, 18, 'play', 6)] })
  for (const c of [A.scales, A.north, A.south]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 6, 18, 'watch', 3), at(b, A.square, 18, 22, 'watch', 8)] })
  cast.push({ role: 'bard', home: home(cast.length), day: [at(b, A.scales, 15, 22, 'work', 3)] })
  CASTS.set(p.id, cast)
  return [b, counting, granary, poor, ...rooms]
}
