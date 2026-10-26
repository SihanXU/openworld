// Highheath Abbey (docs/showcase.md §4b.5): the White Altar's monastery on its chalk cliffs, after the houses of God built
// where only the devout would climb — the Meteora on their pillars, Mont-Saint-Michel's stair of terraces, the lavra
// cells of Cappadocia and Athos. Five shelves of white rock: at the foot the gatehouse where the road comes in; above
// it the heath with the hermits' cells cut against the cliff; a stair of switchbacks; the chasm with the torrent at its
// bottom and the one bridge over it; the brothers' gardens and hives; and on the summit the chapel of the martyrs (the
// catacombs under it), the hall, the cells, the cloister garth, and the brothers' graves at the edge of the sky.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { altarChapel, catacombHall } from './regionhalls.ts'
import { HALLS } from '../../art/arch/plans.ts'
import { clearDoorsteps, pave } from './street.ts'
import { decor, parterre, strew, unshut } from './dress.ts'
import { glowAt, stair, standAnchors } from './ground.ts'

const W = 70
const H = 92
/** The shelves (half levels): the summit, the gardens, the chasm's floor, the shrine's shelf, the heath, the foot. */
const SUMMIT = 8
const GARDEN = 4
const SHRINE = 4
const HEATH = 2
const FOOT = 0
const LIT = { statuses: { lit: -1 } }

export function highheath(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'temple', W, H, 'grass', 'temple', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the shelves of chalk, the chasm and its torrent, the bridge
  b.raise(0, 0, W, 22, SUMMIT)
  b.raise(0, 22, W, 16, GARDEN)
  b.rect(0, 38, W, 8, 'water')
  b.raise(0, 38, W, 8, 0)
  b.raise(0, 46, W, 16, SHRINE)
  b.raise(0, 62, W, 12, HEATH)
  b.raise(0, 74, W, H - 74, FOOT)
  for (const [x, y, rx, ry] of [[10, 30, 7, 3], [58, 52, 8, 3], [12, 66, 9, 3], [52, 70, 7, 2], [60, 84, 8, 4], [8, 86, 6, 3], [62, 4, 5, 3]]) b.organic(x, y, rx, ry, 'drygrass', { rough: 0.5, only: (c) => c === 'grass' })
  for (const [x, y, rx, ry] of [[24, 58, 4, 2], [44, 66, 5, 2], [20, 82, 4, 2], [6, 54, 3, 2]]) b.organic(x, y, rx, ry, 'flowers', { rough: 0.5, only: (c) => c === 'grass' || c === 'drygrass' })
  b.rect(33, 38, 3, 8, 'bridge')
  b.raise(33, 38, 3, 8, GARDEN)
  b.fence('rail', [32, 38], [32, 45])
  b.fence('rail', [36, 38], [36, 45])
  // the stairs between the shelves, each turn of the way up a switchback
  stair(b, 12, 22, 2, SUMMIT, GARDEN, 'path')
  stair(b, 50, 62, 2, SHRINE, HEATH, 'path')
  stair(b, 20, 74, 2, HEATH, FOOT, 'path')
  b.path([[33, H - 1], [30, 84], [24, 79], [21, 75]], 'path', 2)
  b.path([[21, 73], [30, 69], [42, 66], [51, 63]], 'path', 2)
  b.path([[51, 61], [46, 55], [38, 50], [34, 47]], 'path', 2)
  b.path([[34, 37], [26, 32], [17, 27], [13, 23]], 'path', 2)
  b.path([[13, 21], [18, 17], [26, 14], [34, 13]], 'path', 2)
  // the mist off the torrent, the boulders fallen into it
  b.sprinkle('fixture/nature/mist', 0.05, (_x, y, t) => t === 'water' && y > 41)
  for (const [x, y] of [[8, 44], [22, 43], [48, 44], [61, 43]] as Cell[]) b.set(x, y, 'rock')

  // ------------------------------------------------------------------ the summit: the chapel, the hall, the cells, the cloister garth, the graves
  b.building('altar_chapel', 29, 6, ['chapel'], true)
  b.building('altar_hall', 46, 9, ['hall'], true)
  b.building('altar_cells', 6, 10, ['cells'], true)
  doors.push({ door: 'hall', prefab: 'altar_hall', role: 'inn' }, { door: 'cells', prefab: 'altar_cells', role: 'cell' })
  pave(b, 26, 12, 20, 2, 'flagstone')
  // the garth: four beds round the well, the walks between, the herb plots and hives beyond
  b.rect(26, 14, 20, 7, 'flagstone')
  parterre(b, 27, 15, 7, 3)
  parterre(b, 38, 15, 7, 3)
  b.fixture('fixture/water/well', 35, 17)
  for (const [x, y] of [[27, 19], [44, 19]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  b.rect(4, 14, 18, 5, 'farmland')
  for (let x = 5; x < 21; x += 2) b.fixture(x % 4 === 1 ? 'fixture/crop/wheat/young' : 'fixture/nature/plant', x, 16)
  for (const [x, y] of [[5, 19], [8, 19], [11, 19]] as Cell[]) b.fixture('fixture/nature/beehive', x, y)
  // the graves at the edge of the cliff, the calvary over them
  for (let k = 0; k < 14; k++) b.fixture('fixture/sacred/gravestone', 52 + (k % 7) * 2, 15 + Math.floor(k / 7) * 3, { props: { text: 'A brother of Highheath. He climbed, and stayed.', text_zh: '高坡的一位修士。他攀上来，便留下了。' } })
  b.fixture('fixture/sacred/cross', 59, 13)
  for (const [x, y] of [[50, 3], [56, 2], [64, 5], [20, 3], [3, 4], [24, 8]] as Cell[]) b.set(x, y, 'tree')
  for (const [x, y] of [[28, 11], [42, 11]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'night', 0.4)
  }

  // ------------------------------------------------------------------ the gardens' shelf: terraced plots, the hives, the cells against the summit's face
  for (const [x, y, w] of [[40, 25, 26], [40, 29, 26], [40, 33, 26]] as [number, number, number][]) {
    b.rect(x, y, w, 2, 'farmland')
    for (let i = x; i < x + w; i += 2) if (rng.chance(0.8)) b.fixture(rng.chance(0.5) ? 'fixture/crop/wheat/ripe' : 'fixture/nature/plant', i, y)
  }
  b.fixture('fixture/scarecrow', 52, 31)
  for (const [x, y] of [[4, 26], [7, 26], [4, 29]] as Cell[]) b.fixture('fixture/nature/beehive', x, y)
  for (const x of [22, 30, 60]) {
    b.building(`altar_cell_${1 + (x % 2)}`, x, 24, [`gc${x}`], true)
    doors.push({ door: `gc${x}`, prefab: 'altar_cell_1', role: 'cell' })
  }
  for (const [x, y] of [[2, 33], [26, 36], [68, 26]] as Cell[]) b.set(x, y, 'tree')

  // ------------------------------------------------------------------ the shrine's shelf: the martyrs in their ring round the altar, the pilgrims' benches
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    b.fixture('fixture/sacred/statue/martyr', Math.round(20 + Math.cos(a) * 5), Math.round(53 + Math.sin(a) * 3.5))
  }
  b.fixture('fixture/sacred/altar', 20, 53)
  for (const [x, y] of [[18, 53], [22, 53]] as Cell[]) {
    b.fixture('fixture/light/candles', x, y, LIT)
    glowAt(b, x, y, 'always', 0.35, '#ffd27a')
  }
  b.rect(15, 49, 11, 9, 'flagstone')
  for (const [x, y] of [[44, 58], [40, 51], [56, 57]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  b.fixture('fixture/sacred/waypoint', 38, 48)
  for (const [x, y] of [[4, 48], [62, 49], [66, 58], [8, 60]] as Cell[]) b.set(x, y, 'tree')
  for (const [x, y] of [[30, 55], [62, 54], [10, 51]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)

  // ------------------------------------------------------------------ the heath: the hermits' cells cut against the shrine's face, juniper, stones
  for (const x of [5, 12, 28, 38, 60]) {
    b.building(`altar_cell_${1 + (x % 2)}`, x, 63, [`hc${x}`], true)
    doors.push({ door: `hc${x}`, prefab: 'altar_cell_1', role: 'cell' })
  }
  for (const [x, y] of [[8, 68], [16, 70], [34, 71], [57, 67], [64, 71], [3, 72], [46, 72]] as Cell[]) b.set(x, y, 'bush')
  for (const [x, y] of [[24, 66], [62, 68], [44, 69]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  b.fixture('fixture/light/campfire', 14, 67, LIT)
  glowAt(b, 14, 67, 'always', 0.35)

  // ------------------------------------------------------------------ the foot: the gatehouse by the road, the pilgrims' camp, the well
  b.building('altar_gate', 36, 83, [], true)
  for (const x of [5, 48, 56, 63]) {
    b.building(`altar_cell_${1 + (x % 2)}`, x, 75, [`fc${x}`], true)
    doors.push({ door: `fc${x}`, prefab: 'altar_cell_1', role: 'cell' })
  }
  b.fixture('fixture/water/well', 27, 86)
  for (const [x, y] of [[10, 82], [15, 86], [48, 84]] as Cell[]) b.fixture('fixture/tent', x, y)
  for (const [x, y] of [[13, 84], [46, 86]] as Cell[]) {
    b.fixture('fixture/light/campfire', x, y, LIT)
    glowAt(b, x, y, 'always', 0.4)
  }
  b.fixture('fixture/sacred/waypoint', 30, 89)
  for (const [x, y] of [[2, 80], [66, 78], [68, 90], [1, 90], [60, 88]] as Cell[]) b.set(x, y, 'tree')
  for (const [x, y] of [[42, 80], [20, 90]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[8, 84], [50, 82]] as Cell[]) decor(b, 'decor_sacks', x, y)

  // ------------------------------------------------------------------ the heath's own life: field walls and the sheepfold, juniper, the orchard, crosses by the way
  for (const [a, c, gates] of [[[2, 70], [18, 70], [[10, 70]]], [[40, 66], [40, 73], [[40, 69]]], [[4, 88], [24, 88], [[14, 88]]], [[44, 79], [62, 79], [[52, 79]]], [[58, 48], [68, 48], []]] as [[number, number], [number, number], [number, number][]][]) b.fence('stonewall', a, c, gates)
  b.yard(51, 66, 9, 5, 'stonewall', [[55, 70]])
  b.fixture('fixture/nature/haystack', 53, 67)
  b.fixture('fixture/water/trough', 57, 68)
  for (const [x, y, rx, ry] of [[6, 50, 2, 1.5], [62, 58, 2, 1], [28, 70, 2, 1], [8, 78, 2, 1.5], [64, 88, 2, 1.5], [46, 60, 1.5, 1]]) b.organic(x, y, rx, ry, 'bush', { rough: 0.5, only: (c) => c === 'grass' || c === 'drygrass' })
  for (let y = 27; y < 37; y += 4) for (let x = 3; x < 28; x += 4) if (b.get(x, y) === 'grass' || b.get(x, y) === 'drygrass') b.set(x, y, 'tree')
  for (const [x, y] of [[24, 79], [44, 65], [46, 56], [20, 30], [30, 89]] as Cell[]) b.fixture('fixture/sacred/cross', x, y)
  b.organic(28, 50, 1.5, 1, 'spring', { rough: 0.2 })
  for (const [x, y] of [[4, 64], [33, 58], [66, 70], [2, 52], [52, 89], [10, 90], [64, 26]] as Cell[]) b.fixture('fixture/nature/boulder', x, y)
  b.sprinkle('fixture/nature/flowers', 0.025, (_x, y, t) => (t === 'grass' || t === 'drygrass') && y > 22)
  b.sprinkle('fixture/nature/tuft', 0.04, (_x, _y, t) => t === 'grass' || t === 'drygrass')
  b.fixture('fixture/furniture/stall', 36, 79)
  strew(b, 0, 0, W, 22, 0.08, 'city')
  b.vistas.push({ at: [26, 38, 18, 12], zoom: 0.65, focus: [34, 20], share: 0.4 })
  b.anchors = { chapel: [34, 13], garth: [33, 18], graves: [58, 18], gardens: [48, 27], bridge: [34, 42], shrine: [20, 57], heath: [30, 68], gate: [33, 86], camp: [14, 86], stall: [37, 80] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within: the chapel and the catacombs under it
  const chapel = altarChapel(p)
  linkDoors(b, [b.doors.chapel], chapel, [chapel.doors.out])
  const cata = catacombHall(p)
  const CW = HALLS.chapel.parts.chapelW
  linkStair(chapel, [CW.x + 1, CW.y + 1], cata, cata.anchors.stair, true)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: the brothers at their hours, the abbot, the lay brothers in the gardens, pilgrims
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const cast: Cast[] = []
  for (let n = 0; n < 10; n++)
    cast.push({ role: 'priest', sex: 'male', home: home(n), day: [at(chapel, chapel.anchors.pews, 5, 8, 'pray', 3), at(b, n % 3 === 0 ? A.garth : n % 3 === 1 ? A.gardens : A.graves, 8, 12, 'work', 5), at(b, A.garth, 12, 13, 'eat', 4), at(n % 2 ? cata : chapel, n % 2 ? cata.anchors.tombW : chapel.anchors.choir, 13, 17, 'pray', 2), at(chapel, chapel.anchors.pews, 18, 21, 'pray', 3)] })
  cast.push({ role: 'priest', sex: 'male', age: [60, 80], home: home(10), day: [at(chapel, chapel.anchors.altar, 6, 12, 'pray', 1), at(b, A.chapel, 12, 15, 'walk', 4), at(chapel, chapel.anchors.altar, 15, 21, 'pray', 1)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'farmer', home: home(n + 11), day: [at(b, A.gardens, 6, 12, 'work', 8), at(b, A.garth, 12, 13, 'eat', 3), at(b, n % 2 ? A.gardens : A.heath, 13, 18, 'work', 8)] })
  for (let n = 0; n < 6; n++) cast.push({ role: 'traveler', home: home(n + 15), day: [at(b, A.camp, 6, 10, 'rest', 4), at(b, n % 2 ? A.shrine : A.bridge, 10, 14, 'pray', 4), at(chapel, chapel.anchors.pews, 14, 17, 'pray', 3), at(b, A.camp, 18, 22, 'rest', 4)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'guard', home: home(n + 21), day: [at(b, A.gate, 6, 20, 'watch', 3)] })
  cast.push({ role: 'elder', home: home(23), day: [at(b, A.heath, 6, 20, 'sit', 3)] })
  cast.push({ role: 'herbalist', home: home(24), stock: [['item/material/herb', 4], ['item/potion/healing', 2]], day: [at(b, A.garth, 7, 18, 'work', 4)] })
  cast.push({ role: 'merchant', home: home(25), stock: [['item/light/candle', 6], ['item/food/bread', 3]], day: [at(b, A.stall, 7, 19, 'work', 0)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'beggar', home: home(n + 26), day: [at(b, A.gate, 7, 20, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, chapel, cata, ...rooms]
}
