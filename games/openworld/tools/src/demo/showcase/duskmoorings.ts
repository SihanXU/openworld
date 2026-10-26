// Dusk Moorings (docs/showcase.md §4b.4): the Pale Fens' town on piles over the black water, after the stilt villages of
// every marsh — Ganvie on its lagoon, the Marsh Arabs' reed houses, the fishing villages of the Tonlé Sap. No street is
// ground: boardwalks run out from the causeway in the south, houses stand over the water on their posts either side,
// lanterns burn on poles all day against the fog. The ossuary chapel keeps the only dry island, and round it the
// graveyard is sinking stone by stone into the fen; dead trees stand in the shallows, boats tied under every house.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors } from './rooms.ts'
import { healerHall, ossuaryHall, stiltInn } from './regionhalls.ts'
import { houseRow } from './street.ts'
import { FEN_HOUSES } from '../../art/arch/buildings/regions.ts'
import { decor, unshut } from './dress.ts'
import { glowAt, standAnchors } from './ground.ts'

const W = 72
const H = 84
const LIT = { statuses: { lit: -1 } }
/** The fog lamps' light: pale and greenish, burning day and night. */
const FOG = '#d8e8a8'

export function duskMoorings(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'water', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the fen: deep channels, mud banks and reed beds, the chapel's island
  for (const [x, y, rx, ry] of [[50, 30, 6, 2], [20, 48, 7, 2], [56, 66, 8, 2], [26, 79, 9, 2]]) b.organic(x, y, rx, ry, 'deepwater', { rough: 0.4 })
  for (const [x, y, rx, ry] of [[52, 8, 8, 4], [62, 30, 6, 4], [8, 46, 6, 5], [52, 62, 7, 4], [14, 66, 6, 3], [28, 28, 4, 3], [66, 48, 5, 4], [44, 77, 5, 3]]) b.organic(x, y, rx, ry, 'mud', { rough: 0.5, only: (c) => c === 'water' })
  b.organic(13, 11, 11, 8, 'mud', { rough: 0.35 })
  b.organic(12, 9, 8, 5, 'grass', { rough: 0.3 })
  // the sunken graveyard: the island's southern edge going under, its stones standing in mud and water alike
  for (let y = 12; y < 19; y++) for (let x = 3; x < 24; x++) if (b.get(x, y) === 'mud' && rng.chance(0.18)) b.set(x, y, 'water')
  const graves: Cell[] = [[4, 14], [6, 16], [8, 13], [9, 17], [16, 13], [18, 15], [20, 17], [15, 17], [21, 13], [5, 18], [19, 11], [3, 11]]
  for (const [x, y] of graves) b.fixture('fixture/sacred/gravestone', x, y, { props: { text: 'Taken by the fen. Given back to it.', text_zh: '为沼泽所取，复归于沼泽。' } })
  b.fixture('fixture/sacred/cross', 7, 10)
  b.building('fen_ossuary', 8, 7, ['ossuary'], true)
  b.rect(11, 13, 2, 8, 'bridge')
  for (const [x, y] of [[10, 13], [13, 13]] as Cell[]) {
    b.fixture('fixture/light/lantern', x, y, LIT)
    glowAt(b, x, y, 'always', 0.3, FOG)
  }

  // ------------------------------------------------------------------ the boardwalks: the causeway from the south, the walks east and west off it
  const walk = (x: number, y: number, w: number, h: number) => b.rect(x, y, w, h, 'bridge')
  walk(34, 6, 2, H - 6)
  // (the walks west of the causeway and east of it never quite meet: each side's was built by its own families, a row
  // apart, and runs as far as its houses do)
  const WALKS: [number, number, number][] = [[11, 33, 21], [36, 68, 23], [2, 33, 39], [36, 68, 40], [4, 33, 57], [36, 66, 58], [10, 33, 72], [36, 60, 74]]
  for (const [x0, x1, y] of WALKS) {
    walk(x0, y, x1 - x0 + 1, 2)
    // the fog lamps on their poles beside the walk, a boat tied at every other
    for (let x = x0 + 2; x < x1; x += 7) {
      if (Math.abs(x - 34) < 3) continue
      b.fixture('fixture/light/lantern', x, y + 2, LIT)
      glowAt(b, x, y + 1, 'always', 0.28, FOG)
      if (rng.chance(0.5) && b.get(x + 2, y + 2) === 'water') b.fixture('fixture/boat', x + 2, y + 2)
    }
  }
  // planks out to the islands and the eel weirs
  for (const [x, y, w, h] of [[8, 41, 1, 3], [56, 11, 1, 6], [62, 34, 1, 2], [53, 60, 1, 4], [16, 59, 1, 5], [66, 42, 1, 3], [44, 76, 1, 4], [29, 23, 1, 3]]) walk(x, y, w, h)
  for (let y = 10; y < H; y += 8) {
    b.fixture('fixture/light/lantern', 36, y, LIT)
    glowAt(b, 36, y, 'always', 0.28, FOG)
  }
  // ------------------------------------------------------------------ the houses on their piles, each row over the water above its walk, gaps of water between
  b.building('fen_inn', 37, 37, ['inn'], true)
  b.building('fen_healer', 4, 54, ['healer'], true)
  const row = (x0: number, x1: number, y: number, k: string) => houseRow(b, x0, x1, y, FEN_HOUSES, k, 0.35, { setback: 0, gap: 2, yards: ['bare'] })
  const rows = [row(38, 68, 22, 'a'), row(2, 32, 38, 'b'), row(47, 68, 39, 'c'), row(11, 32, 56, 'd'), row(38, 66, 57, 'e'), row(11, 32, 71, 'f'), row(38, 60, 73, 'g')]
  for (const r of rows) doors.push(...r.doors)
  // what the rows left as ground under and between them is water again (the houses stand over it)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (['grass', 'dirt', 'flags', 'flowerbed', 'bush', 'tree', 'paving'].includes(b.get(x, y)) && !(x < 26 && y < 20)) b.set(x, y, 'water')
  // the floating market: a raft of planks off the causeway, the eel sellers' stalls, the smokers
  walk(39, 42, 14, 5)
  const stalls: Cell[] = []
  for (const x of [41, 45, 49]) {
    b.fixture('fixture/furniture/stall', x, 43)
    stalls.push([x, 44])
  }
  for (const [x, y] of [[41, 46], [50, 46]] as Cell[]) b.fixture('fixture/furniture/rack/fish', x, y)
  b.fixture('fixture/light/campfire', 46, 46, LIT)
  glowAt(b, 46, 46, 'always', 0.4)
  for (const [x, y] of [[44, 46], [48, 46]] as Cell[]) b.fixture('fixture/container/barrel', x, y)

  // ------------------------------------------------------------------ the fen's life: dead trees in the shallows, reeds, the mist, nets and traps, the eel weirs
  for (const [k, x, y] of [[1, 51, 7], [2, 61, 29], [3, 7, 45], [1, 51, 61], [2, 13, 65], [3, 65, 47], [1, 26, 27], [2, 43, 76], [3, 66, 79], [1, 2, 28]] as [number, number, number][]) b.building(`fen_deadtree_${k}`, x - 1, y)
  b.sprinkle('fixture/nature/reeds', 0.07, (x, y, t) => (t === 'water' || t === 'mud') && b.near(x, y, (n) => n === 'mud', 2) && !b.near(x, y, (n) => n === 'bridge', 1))
  b.sprinkle('fixture/nature/mist', 0.012, (x, y, t) => t === 'water' && !b.near(x, y, (n) => n === 'bridge', 1))
  for (const [x, y] of [[56, 10], [60, 31], [9, 48], [55, 63], [16, 67], [67, 50]] as Cell[]) if (b.get(x, y) === 'mud') b.fixture('fixture/furniture/rack/nets', x, y)
  for (const [x, y] of [[48, 9], [64, 32], [5, 47], [50, 64], [12, 68]] as Cell[]) if (b.get(x, y) === 'mud') b.fixture('fixture/furniture/rack/fish', x, y)
  for (const [x, y] of [[24, 4], [30, 14], [62, 16], [4, 30], [22, 32], [68, 62], [6, 78], [64, 75]] as Cell[]) if (b.get(x, y) === 'water') b.fixture('fixture/boat', x, y)
  // decor on the walks: casks and traps, a cat, washing over the water
  for (const [x, y] of [[20, 22], [60, 22], [8, 40], [26, 40], [62, 40], [18, 58], [56, 58], [24, 73], [50, 73]] as Cell[]) decor(b, rng.pick(['decor_casks', 'decor_crates', 'decor_sacks']), x, y)
  for (const [x, y] of [[14, 22], [30, 58], [44, 73]] as Cell[]) decor(b, 'decor_cat', x, y)
  b.anchors = { chapel: [11, 14], crossing: [35, 40], market: [46, 45], walkN: [50, 24], walkW: [14, 40], walkS: [24, 58], walkE: [55, 59], south: [35, 78], graves: [16, 16] }
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the ossuary, the healer's hut, the inn
  const ossuary = ossuaryHall(p)
  linkDoors(b, [b.doors.ossuary], ossuary, [ossuary.doors.out])
  const healer = healerHall(p)
  linkDoors(b, [b.doors.healer], healer, [healer.doors.out])
  const inn = stiltInn(p)
  linkDoors(b, [b.doors.inn], inn, [inn.doors.out])
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: eel fishers and reed cutters, the bone-keeper, the healer, the innkeeper
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const walks = [A.walkN, A.walkW, A.walkS, A.walkE]
  const cast: Cast[] = []
  for (let n = 0; n < 5; n++) cast.push({ role: 'fisher', home: home(n), day: [at(b, walks[n % 4], 5, 12, 'work', 6), eat(n), at(b, walks[(n + 1) % 4], 13, 18, 'work', 6), at(inn, n % 2 ? inn.anchors.eat : inn.anchors.rest, 18, 22, 'rest', 3)] })
  stalls.forEach((c, n) => cast.push({ role: 'merchant', home: home(n + 8), stock: n === 1 ? [['item/material/herb', 3], ['item/potion/antidote', 1]] : [['item/food/fish/raw', 4], ['item/food/fish/cooked', 3]], day: [at(b, c, 6, 18, 'work', 0), at(inn, inn.anchors.eat, 18, 21, 'rest', 3)] }))
  for (let n = 0; n < 4; n++) cast.push({ role: 'villager', sex: n % 2 ? 'female' : undefined, home: home(n + 12), day: [at(b, walks[n % 4], 7, 12, 'work', 6), eat(n + 12), at(b, n % 2 ? A.market : A.crossing, 13, 18, 'walk', 5), at(b, A.crossing, 18, 21, 'rest', 4)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'child', home: home(n + 20), day: [at(b, walks[n % 4], 8, 12, 'play', 5), eat(n + 20), at(b, A.market, 13, 18, 'play', 4)] })
  cast.push({ role: 'priest', age: [50, 75], home: ossuary.id, day: [at(ossuary, ossuary.anchors.altar, 5, 12, 'pray', 2), at(b, A.graves, 12, 17, 'work', 3), at(ossuary, ossuary.anchors.nave, 17, 22, 'pray', 3)] })
  cast.push({ role: 'herbalist', sex: 'female', home: healer.id, stock: [['item/material/herb', 5], ['item/potion/antidote', 2], ['item/potion/healing', 1]], day: [at(healer, healer.anchors.work, 6, 20, 'work', 2)] })
  cast.push({ role: 'innkeeper', home: inn.id, day: [at(inn, inn.anchors.bar, 10, 24, 'work', 1)] })
  cast.push({ role: 'bard', home: inn.id, day: [at(inn, inn.anchors.bard, 18, 24, 'work', 1), at(b, A.market, 12, 17, 'work', 3)] })
  cast.push({ role: 'guard', home: home(26), day: [at(b, A.crossing, 6, 20, 'watch', 4)] })
  cast.push({ role: 'elder', home: home(30), day: [at(b, A.chapel, 8, 18, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, ossuary, healer, inn, ...rooms]
}
