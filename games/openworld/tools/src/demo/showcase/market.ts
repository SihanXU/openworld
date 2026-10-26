// The Market (docs/showcase.md §4.4): a market square on the model of Bruges's Markt and the halls of Ypres, its life
// from Marrakech's Jemaa el-Fnaa (a square that is one thing by day and another by night): four rows of stalls under
// striped canvas, each a trade's, with lanes between them; the market hall on the north side, its arcade open to the
// square, its guild room over it; the weigh-house where the city's great balance hangs (the Black Steward's scales,
// lore.md §6) and the market cross; the cloth arcade along the west, a covered street of shops. By day the keepers
// cry their wares and the city shops; at dusk the stalls close and the square is the evening's.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { marketHall } from './halls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { LOW_HOUSES, TALL_HOUSES } from '../../art/arch/buildings/town.ts'
import { busyRow, decor, festoons, frontage, lamp, lampRow, pavement, piles, strew, unshut } from './dress.ts'

const W = 64
const H = 96
/** The rows added over the market (MapBuilder.grow), behind its highest roofs. */
const ABOVE = 4
/** The cells of the way in from the Bell Ward (north edge) and out to the Lamp Ward (south edge). */
export const MARKET_NORTH: [number, number] = [20, 21]
export const MARKET_SOUTH: [number, number] = [40, 41]

const TRADES: [string, [string, number][]][] = [
  ['fruit', [['item/food/apple', 4], ['item/food/berries', 3], ['item/food/apple/holy_candied_apple', 2]]],
  ['bread', [['item/food/bread', 4], ['item/food/bread/holy_saffron_bun', 3], ['item/food/pie/holy_feast_day_pie', 1]]],
  ['fish', [['item/food/fish/raw', 4], ['item/food/fish/cooked', 2]]],
  ['cloth', [['item/material/cloth', 3], ['item/material/cloth/holy_vestment_silk', 1], ['item/material/wool', 2]]],
  ['pots', [['item/vessel/pot', 2], ['item/vessel/cup', 3], ['item/vessel/plate', 3]]],
  ['candles', [['item/light/candle', 4], ['item/light/candle/holy_votive_candle', 4]]],
  ['herbs', [['item/material/herb', 4], ['item/material/herb/holy_myrrh_resin', 2], ['item/potion/healing', 1]]],
  ['meat', [['item/food/meat/raw', 3], ['item/food/chicken/cooked/holy_roast_capon', 2], ['item/food/cheese/holy_pilgrim_s_cheese', 2]]],
]

export function market(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'flags', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the north street: a row of houses, the way in from the Bell Ward down the lane by them
  const back = houseRow(b, 2, 19, 12, TALL_HOUSES, 'b', 0.2)
  const back2 = houseRow(b, 23, 63, 12, TALL_HOUSES, 'b2', 0.2)
  doors.push(...back.doors, ...back2.doors)
  pave(b, 0, 13, W, 3, 'flagstone')
  pavement(b, 0, W - 1, 13)
  b.rect(MARKET_NORTH[0], 0, 3, 28, 'flagstone')
  lampRow(b, 6, 60, 14, 10, (x) => x >= 19 && x <= 23)
  frontage(b, back)
  frontage(b, back2)
  // ------------------------------------------------------------------ the north side of the square: the market hall, the weigh-house, houses either side
  b.building('market_hall', 24, 20, ['hall', 'hall2'], true)
  b.building('market_weigh', 40, 24, [], true)
  const nw = houseRow(b, 2, 19, 27, LOW_HOUSES, 'nw', 0)
  const ne = houseRow(b, 46, 63, 27, LOW_HOUSES, 'ne', 0)
  doors.push(...nw.doors, ...ne.doors)
  frontage(b, nw)
  frontage(b, ne)
  // ------------------------------------------------------------------ the square: its flags round paving, the ring round the cross, the stalls in runs with lanes between
  b.rect(0, 28, W, 36, 'flags')
  b.rect(3, 30, 58, 32, 'paving')
  for (let y = 30; y < 62; y++)
    for (let x = 3; x < 61; x++) {
      const d = Math.hypot(x + 0.5 - 31, y + 0.5 - 46)
      if (d < 4.6) b.set(x, y, 'plaza')
      else if (y === 37 || y === 44 || y === 52 || y === 59) b.set(x, y, 'flags')
    }
  const stalls: { keeper: Cell; trade: number }[] = []
  let k = 0
  // (rows of stalls broken into runs, a lane up the middle, the ring round the market cross kept open)
  const RUNS: [number, number[]][] = [
    [34, [5, 9, 13, 21, 25, 35, 39, 47, 51, 55]],
    [41, [5, 9, 17, 21, 41, 45, 51, 55]],
    [50, [7, 11, 15, 43, 47, 51, 55]],
    [57, [5, 9, 13, 21, 25, 35, 39, 43, 51, 55]],
  ]
  for (const [y, xs] of RUNS)
    for (const x of xs) {
      const trade = k++ % TRADES.length
      b.building(`market_stall_${TRADES[trade][0]}`, x, y - 1)
      stalls.push({ keeper: [x + 1, y - 1 + ABOVE], trade })
    }
  b.building('market_cross', 30, 45)
  for (const [x, y] of [[26, 41], [34, 41], [26, 50], [34, 50]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  b.fixture('fixture/water/well/square', 13, 61)
  for (const [x, y] of [[29, 31], [37, 38], [3, 46], [59, 46], [30, 60], [19, 38]]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[4, 36], [4, 55], [59, 36], [59, 55], [20, 45], [41, 46], [18, 58], [48, 31]]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[28, 36], [34, 53], [20, 53], [46, 39], [12, 31], [57, 60]]) b.fixture('fixture/container/sack', x, y)
  for (const [x, y] of [[27, 53], [35, 36], [21, 36], [45, 54], [5, 31], [56, 31]]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[3, 30], [60, 30], [3, 61], [60, 61]] as Cell[]) b.fixture('fixture/standard', x, y)
  for (const [x, y] of [[17, 30], [45, 30], [18, 61], [44, 61]] as Cell[]) lamp(b, x, y)
  for (const [x, y] of [[27, 44], [35, 44], [27, 48], [35, 48]] as Cell[]) lamp(b, x, y, 0.25)
  b.fixture('fixture/sign/noticeboard', 38, 29)
  // ------------------------------------------------------------------ the south side: the cloth arcade, the houses whose roofs close the square, the way to the Lamp Ward
  b.building('market_arcade', 4, 69, ['arcade'], true)
  doors.push({ door: 'arcade', prefab: 'market_arcade', role: 'shop' })
  const s = houseRow(b, 19, 39, 74, LOW_HOUSES, 's', 0.2)
  const s2 = houseRow(b, 43, 63, 74, LOW_HOUSES, 's2', 0.2)
  pave(b, 0, 75, W, 3, 'flagstone')
  pavement(b, 0, W - 1, 75)
  const s3 = houseRow(b, 2, 39, 90, LOW_HOUSES, 's3', 0.2)
  const s4 = houseRow(b, 43, 63, 90, LOW_HOUSES, 's4', 0.2)
  doors.push(...s.doors, ...s2.doors, ...s3.doors, ...s4.doors)
  for (const r of [s, s2, s3, s4]) frontage(b, r)
  pave(b, 0, 91, W, 5, 'flagstone')
  pavement(b, 0, W - 1, 91)
  b.rect(MARKET_SOUTH[0], 62, 2, 34, 'flagstone')
  for (const y of [66, 70]) for (const x of [39, 42]) b.fixture('fixture/garden/cypress', x, y)
  lampRow(b, 6, 60, 76, 10, (x) => x >= 39 && x <= 42)
  lampRow(b, 6, 60, 93, 10, (x) => x >= 39 && x <= 42)
  // ------------------------------------------------------------------ the view over the square to the hall
  b.vistas.push({ at: [3, 28, 58, 34], zoom: 0.6, focus: [31, 16], share: 0.4 })
  b.anchors = { square: [31, 49], cross: [31, 48], hallArcade: [31, 29], weigh: [42, 29], arcade: [10, 75], well: [14, 63], north: [20, 15], south: [40, 80] }
  // ------------------------------------------------------------------ the clutter: every front piled and hung, rugs of wares on the lanes, the paving strewn
  for (const r of [back, back2, nw, ne, s, s2, s3, s4]) busyRow(b, r, 0, W, 'market')
  for (const [x, y] of [[9, 37], [47, 37], [13, 52], [53, 44], [17, 59], [23, 44]] as Cell[]) decor(b, 'decor_rug', x, y)
  festoons(b, 3, 61, 29, ['flags'], 0.9)
  festoons(b, 3, 61, 62, ['flags', 'lanterns'], 0.9)
  piles(b, 0, 0, W, H, 'market', 0.4)
  strew(b, 0, 0, W, H, 0.12)
  clearDoorsteps(b)
  unshut(b)
  b.grow(ABOVE, 'flagstone')

  // ------------------------------------------------------------------ the market hall within: its counters along the walls, cloth on the tables
  const hall = marketHall(p)
  linkDoors(b, [b.doors.hall, b.doors.hall2], hall, HALLS.markethall.doors)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the keepers at their stalls, the city shopping, the weighmaster, the watch
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const cast: Cast[] = []
  stalls.forEach((st, n) =>
    cast.push({ role: 'merchant', home: home(n), stock: TRADES[st.trade][1], day: [at(b, st.keeper, 6, 12, 'work', 0), at(b, A.cross, 12, 13, 'eat', 4), at(b, st.keeper, 13, 18, 'work', 0), at(b, A.well, 18, 21, 'rest', 6)] }),
  )
  for (let n = 0; n < 4; n++) cast.push({ role: 'merchant', home: home(n + 20), stock: n % 2 ? [['item/material/cloth/holy_cloth_of_gold', 1], ['item/material/cloth', 4]] : [['item/food/wine/holy_spiced_wine', 2], ['item/food/cheese', 3]], day: [at(hall, n % 2 ? hall.anchors.counters2 : hall.anchors.counters, 7, 18, 'work', 1), at(b, A.square, 18, 21, 'rest', 10)] })
  cast.push({ role: 'scholar', home: home(40), day: [at(b, A.weigh, 7, 18, 'work', 1), at(hall, hall.anchors.rest, 18, 20, 'rest', 3)] })
  for (let n = 0; n < 22; n++) cast.push({ role: n % 7 === 0 ? 'noble' : n % 5 === 0 ? 'elder' : 'villager', home: home(n + 3), day: [at(b, A.square, 8, 12, 'walk', 12), at(rooms[(n + 3) % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, n % 2 ? A.square : A.hallArcade, 13, 18, 'walk', 11), at(b, A.cross, 18, 21, 'rest', 8)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'peddler', home: home(n + 30), stock: [['item/light/torch', 2], ['item/misc/bait', 3]], day: [at(b, n % 2 ? A.north : A.south, 7, 19, 'walk', 6)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'child', home: home(n + 10), day: [at(b, A.well, 8, 12, 'play', 5), at(rooms[(n + 10) % rooms.length], [5, 3], 12, 13, 'eat', 2), at(b, A.cross, 13, 18, 'play', 6)] })
  for (const c of [A.north, A.south, A.cross]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 6, 18, 'watch', 3), at(b, A.square, 18, 22, 'watch', 10)] })
  cast.push({ role: 'bard', home: home(cast.length), day: [at(b, A.cross, 16, 23, 'work', 2)] })
  cast.push({ role: 'beggar', home: home(cast.length), day: [at(b, A.hallArcade, 7, 20, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, hall, ...rooms]
}
