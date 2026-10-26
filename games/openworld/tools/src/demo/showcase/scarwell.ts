// Scarwell (docs/showcase.md §4d): a bandits' hold in a red ravine of the Scarred March, after the robbers' roosts of the
// old roads — the Sierra Morena's bandit camps, the outlaws' stockades of the frontier. Under the ravine's north wall the
// mouth of the burrow where the takings go; before it the stockade and its two towers, the chief's lodge, the huts and
// tents, the cages where the captives wait for their ransom, the loot heaped by the fire, the butts they shoot at; south
// of the gate the road through the ravine they watch.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { burrowHall, chiefLodge } from './regionhalls.ts'
import { clearDoorsteps } from './street.ts'
import { decor, piles, strew, unshut } from './dress.ts'
import { bedsNear, glowAt, palisade, regrass, standAnchors } from './ground.ts'

const W = 60
const H = 64
const RIM = 8
const FLOOR = 0
const LIT = { statuses: { lit: -1 } }

export function scarwell(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'dirt', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the ravine: its north wall four levels high, its floor, the sand where the wash runs
  b.raise(0, 0, W, 14, RIM)
  b.raise(0, 14, W, H - 14, FLOOR)
  for (const [x, y, rx, ry] of [[12, 5, 4, 2], [44, 6, 5, 2], [28, 3, 3, 1.5]]) b.organic(x, y, rx, ry, 'rock', { rough: 0.5 })
  b.path([[0, 56], [16, 58], [30, 55], [44, 59], [W - 1, 57]], 'sand', 3)
  // the burrow's mouth under the wall, its lanterns
  b.building('mine_adit', 28, 18, ['burrow'], true)
  for (const [x, y] of [[27, 20], [32, 20]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
  }
  // ------------------------------------------------------------------ the stockade: its runs, its two towers by the gate, the gate
  palisade(b, 4, 25, 46)
  palisade(b, 34, 55, 46)
  b.building('march_watchtower', 26, 44)
  b.building('march_watchtower', 31, 44)
  for (const x of [3, 56]) for (const y of [22, 30, 38]) b.building('march_palisade_y8', x, y)
  // ------------------------------------------------------------------ within the stockade: the chief's lodge, the huts, the tents, the fire, the cages, the loot
  b.building('bandit_hut_2', 8, 24, ['lodge'], true)
  b.building('bandit_hut_0', 40, 23, ['hut0'], true)
  b.building('bandit_hut_1', 48, 30, ['hut1'], true)
  doors.push({ door: 'hut0', prefab: 'bandit_hut_0', role: 'home' }, { door: 'hut1', prefab: 'bandit_hut_1', role: 'home' })
  const TENTS: [number, number, string][] = [[8, 34, 'b'], [15, 38, 'c'], [38, 37, 'a'], [44, 40, 'c']]
  for (const [x, y, k] of TENTS) b.building(`march_tent_${k}`, x, y)
  b.fixture('fixture/light/campfire', 29, 32, LIT)
  glowAt(b, 29, 32, 'always', 0.55)
  for (const [x, y] of [[27, 31], [31, 31], [27, 34], [31, 34]] as Cell[]) b.fixture('fixture/furniture/bench/log', x, y)
  for (const x of [18, 20, 22]) decor(b, 'decor_cage', x, 27)
  for (const [x, y] of [[33, 27], [24, 36], [36, 31]] as Cell[]) decor(b, 'decor_loot', x, y)
  for (const [x, y] of [[20, 40], [22, 40], [24, 40]] as Cell[]) b.fixture('fixture/dummy', x, y)
  for (const [x, y] of [[17, 24], [52, 24]] as Cell[]) b.fixture('fixture/furniture/rack/arms', x, y)
  for (const [x, y] of [[50, 37], [51, 37], [6, 30], [35, 25]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[49, 38], [7, 31]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  b.fixture('fixture/furniture/cart', 44, 33)
  for (const [x, y] of [[12, 30], [36, 42]] as Cell[]) b.fixture('fixture/standard', x, y)
  b.fixture('fixture/furniture/washing_line', 46, 27)
  b.fixture('fixture/light/campfire', 46, 44, LIT)
  glowAt(b, 46, 44, 'always', 0.4)
  // ------------------------------------------------------------------ outside: the road through the ravine, the lookout's rock, scrub and stones
  b.path([[29, 47], [29, 52], [30, 55]], 'path', 2)
  for (const [x, y] of [[10, 52], [50, 50], [6, 62], [56, 62]] as Cell[]) b.set(x, y, 'rock')
  for (const [x, y] of [[20, 60], [40, 62], [52, 53]] as Cell[]) b.fixture('fixture/remains/bones', x, y)
  b.fixture('fixture/furniture/cart', 42, 52)
  regrass(b, ['grass', 'flowerbed', 'flowers'], 'dirt')
  for (let y = 14; y < H; y++) for (let x = 0; x < W; x++) if (b.get(x, y) === 'dirt' && !b.near(x, y, (t) => t === 'path' || t === 'wall' || t === 'door' || t === 'sand', 1) && rng.chance(0.012)) b.set(x, y, 'bush')
  b.sprinkle('fixture/nature/pebbles', 0.03, (_x, _y, t) => t === 'dirt' || t === 'sand')
  piles(b, 0, 14, W, H - 14, 'poor', 0.45)
  strew(b, 0, 14, W, H - 14, 0.06, 'poor')
  b.anchors = { burrow: [30, 22], fire: [29, 33], cages: [21, 29], butts: [22, 42], gate: [29, 48], road: [30, 57], lodge: [11, 28], huts: [45, 28], camp: [46, 46] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the chief's lodge, the burrow
  const lodge = chiefLodge(p)
  linkDoors(b, [b.doors.lodge], lodge, [lodge.doors.out])
  const burrow = burrowHall(p)
  linkDoors(b, [b.doors.burrow], burrow, [burrow.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the band: the chief, his men at their posts and their games, the captives, the fence
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const cast: Cast[] = []
  cast.push({ role: 'soldier', sex: 'male', age: [35, 55], home: lodge.id, fights: true, day: [at(lodge, lodge.anchors.chief, 8, 12, 'sit', 1), at(b, A.fire, 12, 14, 'eat', 2), at(burrow, burrow.anchors.hoard, 14, 17, 'work', 2), at(lodge, lodge.anchors.eat, 17, 23, 'rest', 2)] })
  for (let n = 0; n < 12; n++)
    cast.push({ role: n % 3 ? 'hunter' : 'soldier', home: n < 4 ? rooms[n % rooms.length].id : b.id, fights: true, day: [at(b, [A.gate, A.butts, A.road, A.huts, A.camp, A.burrow][n % 6], 6, 12, n % 2 ? 'watch' : 'work', 4), at(b, A.fire, 12, 13, 'eat', 4), at(n % 4 === 0 ? burrow : b, n % 4 === 0 ? burrow.anchors.den : [A.butts, A.gate, A.cages, A.road][n % 4], 13, 19, 'watch', 4), at(b, A.fire, 19, 23, 'rest', 4)] })
  for (let n = 0; n < 3; n++) cast.push({ role: ['merchant', 'villager', 'noble'][n], home: b.id, day: [at(b, A.cages, 6, 22, 'sit', 2)] })
  cast.push({ role: 'villager', sex: 'female', home: b.id, day: [at(b, A.fire, 5, 21, 'work', 3)] })
  cast.push({ role: 'peddler', home: b.id, stock: [['item/light/torch', 3], ['item/food/bread', 3], ['item/material/cloth', 2]], day: [at(b, A.camp, 8, 18, 'work', 2)] })
  cast.push({ role: 'traveler', home: b.id, day: [at(b, A.road, 7, 17, 'walk', 6), at(b, A.camp, 17, 22, 'rest', 3)] })
  const beds = bedsNear(b, [...TENTS.map(([x, y]) => [x + 1, y + 3] as Cell), [29, 35], [46, 46]], cast.length)
  cast.forEach((c, i) => c.home === b.id && (c.bed = beds[i]))
  CASTS.set(p.id, cast)
  return [b, lodge, burrow, ...rooms]
}
