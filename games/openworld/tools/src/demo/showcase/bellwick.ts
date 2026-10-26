// Bellwick (docs/showcase.md §4d): a manor of the White Altar Heights and its home farm, after the country houses of the
// old gentry — Castle Howard's forecourt, Het Loo's parterres, Hampton Court's maze. The house stands on its terrace
// between two parterres, a portico on its door; below the balustrade the carriage sweep turns round its fountain, the
// gardens lie in their beds either side, the avenue runs south between its trees to the lodge at the gate. West the
// orangery and the stables with their paddock; east the hedge maze with the gazebo at its heart; the canal by the gate.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { galleryHall, manorCellar, manorHall } from './regionhalls.ts'
import { clearDoorsteps, pave } from './street.ts'
import { decor, lamp, parterre, strew, terrace, unshut } from './dress.ts'
import { glowAt, standAnchors } from './ground.ts'

const W = 72
const H = 84
const UP = 4
const LOW = 2

/** A hedge maze of `cw` by `ch` cells (each two cells of path and wall), its paths gravel, a room at its heart. */
function maze(b: MapBuilder, x0: number, y0: number, cw: number, ch: number): Cell {
  for (let y = 0; y < ch * 2 + 1; y++) for (let x = 0; x < cw * 2 + 1; x++) b.set(x0 + x, y0 + y, 'bush')
  const seen = new Set<string>()
  const stack: Cell[] = [[0, 0]]
  seen.add('0,0')
  b.set(x0 + 1, y0 + 1, 'gravel')
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]).map(([dx, dy]) => [cx + dx, cy + dy] as Cell).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen.has(`${nx},${ny}`))
    if (!next.length) {
      stack.pop()
      continue
    }
    const [nx, ny] = rng.pick(next)
    seen.add(`${nx},${ny}`)
    b.set(x0 + 1 + cx + nx, y0 + 1 + cy + ny, 'gravel')
    b.set(x0 + 1 + nx * 2, y0 + 1 + ny * 2, 'gravel')
    stack.push([nx, ny])
  }
  // the heart: a room of gravel for the gazebo; the ways in, north and west
  const mx = x0 + cw - 2
  const my = y0 + ch - 2
  b.rect(mx - 1, my - 1, 7, 7, 'gravel')
  b.set(x0 + 1, y0, 'gravel')
  b.set(x0, y0 + ch * 2 - 1, 'gravel')
  return [mx, my]
}

export function bellwick(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  b.raise(0, 0, W, H, LOW)
  // ------------------------------------------------------------------ the terrace: the house on it between its parterres, the park behind
  terrace(b, 14, 0, 44, 24, UP, 'flags', [[33, 6]], LOW)
  b.rect(14, 0, 44, 11, 'grass')
  for (let y = 1; y < 10; y += 3) for (let x = 16 + (y % 2) * 2; x < 57; x += 5) b.set(x, y, 'tree')
  for (const x of [20, 30, 42, 52]) b.fixture('fixture/sacred/statue', x, 10)
  b.building('manor_house', 28, 12, ['manor'], true)
  parterre(b, 16, 13, 10, 7)
  parterre(b, 46, 13, 10, 7)
  for (const [x, y] of [[17, 21], [24, 21], [47, 21], [54, 21]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  for (const [x, y] of [[30, 19], [42, 19]] as Cell[]) {
    lamp(b, x, y, 0.3)
  }

  // ------------------------------------------------------------------ the carriage sweep round its fountain, the gardens either side
  for (let y = 25; y < 41; y++)
    for (let x = 24; x < 49; x++) {
      const d = Math.hypot((x + 0.5 - 36) / 11, (y + 0.5 - 33) / 7)
      if (d < 1 && d > 0.62) b.set(x, y, 'gravel')
      else if (d <= 0.62) b.set(x, y, d < 0.25 ? 'plaza' : 'grass')
    }
  b.fixture('fixture/water/fountain', 36, 33)
  for (const [x, y] of [[32, 31], [40, 31], [32, 35], [40, 35]] as Cell[]) b.fixture('fixture/garden/topiary', x, y)
  b.rect(34, 24, 5, 3, 'gravel')
  for (const [x0, sign] of [[2, 1], [48, -1]] as [number, number][]) {
    b.rect(x0, 26, 22, 19, 'gravel')
    for (const [dx, dy] of [[1, 1], [12, 1], [1, 10], [12, 10]] as Cell[]) parterre(b, x0 + dx, 26 + dy, 10, 8)
    b.fixture('fixture/sacred/statue', x0 + 11, 35)
    for (const y of [27, 43]) b.fixture('fixture/garden/urn', x0 + (sign > 0 ? 21 : 0), y)
  }

  // ------------------------------------------------------------------ the avenue south to the lodge, its trees, its lamps, the gate
  b.rect(35, 41, 3, H - 41, 'gravel')
  for (let y = 43; y < H - 2; y += 3) for (const x of [33, 39]) b.set(x, y, 'tree')
  for (let y = 46; y < H - 4; y += 9) lamp(b, 34, y, 0.28)
  b.building('manor_lodge', 41, 75, ['lodge'], true)
  doors.push({ door: 'lodge', prefab: 'manor_lodge', role: 'home' })
  for (const x of [34, 38]) decor(b, 'decor_column', x, 80)
  b.rect(6, 77, 22, 3, 'water')
  for (const x of [5, 28]) b.fixture('fixture/garden/urn', x, 78)
  for (let x = 6; x < 28; x += 3) b.fixture('fixture/garden/balustrade', x, 76)

  // ------------------------------------------------------------------ the orangery and its citrus walk; the stables and their paddock
  b.building('manor_orangery', 6, 48, ['orangery'], true)
  doors.push({ door: 'orangery', prefab: 'manor_orangery', role: 'home' })
  pave(b, 4, 51, 14, 2, 'gravel')
  for (const x of [4, 7, 14, 17]) decor(b, 'decor_orange', x, 53)
  b.building('manor_stable', 4, 58, ['stable'], true)
  doors.push({ door: 'stable', prefab: 'manor_stable', role: 'farmhouse' })
  b.yard(3, 64, 17, 9, 'rail', [[11, 64]])
  for (const [x, y] of [[5, 66], [16, 70], [8, 70]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/water/trough', 13, 67)
  for (const [x, y] of [[7, 68], [14, 66]] as Cell[]) b.creature('animal/cow', x, y, { behaviour: 'passive', temper: 'wary', sight: 4, leash: 4 })
  b.fixture('fixture/furniture/cart', 18, 62)
  b.path([[17, 51], [26, 47], [34, 44]], 'gravel', 1)
  b.path([[15, 62], [26, 58], [34, 56]], 'gravel', 1)

  // ------------------------------------------------------------------ the maze and its gazebo; the kitchen garden behind it
  const [mx, my] = maze(b, 44, 47, 12, 12)
  b.building('manor_gazebo', mx, my)
  b.path([[38, 47], [44, 47]], 'gravel', 1)
  for (let y = 74; y < 82; y++) for (let x = 50; x < 70; x++) b.set(x, y, y % 3 === 0 ? 'path' : 'farmland')
  for (let x = 51; x < 70; x += 2) for (const y of [75, 78, 81]) if (rng.chance(0.7)) b.fixture(x % 4 === 1 ? 'fixture/nature/plant' : 'fixture/crop/wheat/young', x, y)
  for (const y of [75, 79]) b.fixture('fixture/nature/beehive', 70, y)
  // the park's trees, the lawns' flowers
  for (const [x, y] of [[3, 3], [8, 8], [62, 4], [67, 10], [4, 18], [66, 20], [2, 56], [26, 66], [28, 52], [68, 46], [22, 76], [62, 71]] as Cell[]) if (b.get(x, y) === 'grass') b.set(x, y, 'tree')
  b.sprinkle('fixture/nature/flowers', 0.03, (_x, _y, t) => t === 'grass')
  strew(b, 0, 0, W, H, 0.05, 'city')
  b.anchors = { door: [36, 18], terrace: [26, 21], sweep: [36, 38], gardenW: [13, 35], gardenE: [59, 35], maze: [mx + 1, my + 4], orangery: [10, 52], stable: [10, 63], paddock: [11, 68], kitchen: [58, 77], avenue: [36, 60], gate: [36, 81] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)
  for (const [x, y] of [[10, 51], [9, 62]] as Cell[]) glowAt(b, x, y, 'night')

  // ------------------------------------------------------------------ within: the hall, the gallery over it, the kitchens and cellar under it
  const hall = manorHall(p)
  linkDoors(b, [b.doors.manor], hall, [hall.doors.out])
  const gallery = galleryHall(p)
  linkStair(hall, hall.anchors.up, gallery, gallery.anchors.stair, false)
  const cellar = manorCellar(p)
  linkStair(hall, hall.anchors.down, cellar, cellar.anchors.stair, true)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the household: the lord and lady, the steward, the servants, the gardeners, the grooms
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const cast: Cast[] = []
  cast.push({ role: 'noble', sex: 'male', age: [45, 65], home: gallery.id, day: [at(hall, hall.anchors.lord, 8, 11, 'sit', 1), at(b, A.terrace, 11, 13, 'walk', 4), at(hall, hall.anchors.table, 13, 14, 'eat', 2), at(b, A.gardenE, 14, 17, 'walk', 6), at(gallery, gallery.anchors.walk, 17, 22, 'walk', 6)] })
  cast.push({ role: 'noble', sex: 'female', age: [40, 60], home: gallery.id, day: [at(gallery, gallery.anchors.walk, 8, 11, 'walk', 6), at(b, A.orangery, 11, 13, 'walk', 3), at(hall, hall.anchors.table, 13, 14, 'eat', 2), at(b, A.maze, 14, 17, 'walk', 3), at(hall, hall.anchors.hall, 17, 22, 'sit', 3)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'child', home: gallery.id, day: [at(b, n ? A.maze : A.sweep, 8, 12, 'play', 5), at(cellar, cellar.anchors.cook, 12, 13, 'eat', 2), at(b, A.gardenW, 13, 18, 'play', 6)] })
  cast.push({ role: 'scholar', home: cellar.id, day: [at(hall, hall.anchors.hall, 7, 12, 'work', 3), at(b, A.stable, 12, 14, 'walk', 4), at(gallery, gallery.anchors.walk, 14, 19, 'work', 4)] })
  cast.push({ role: 'innkeeper', sex: 'female', home: cellar.id, day: [at(cellar, cellar.anchors.cook, 5, 19, 'work', 2), at(hall, hall.anchors.table, 19, 21, 'work', 3)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'villager', sex: 'female', home: cellar.id, day: [at(hall, n ? hall.anchors.table : hall.anchors.hall, 6, 12, 'work', 4), at(cellar, cellar.anchors.cook, 12, 13, 'eat', 2), at(n === 2 ? cellar : gallery, n === 2 ? cellar.anchors.cellar : gallery.anchors.walk, 13, 20, 'work', 4)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'farmer', home: home(n), day: [at(b, [A.gardenW, A.gardenE, A.maze, A.kitchen, A.terrace][n], 6, 12, 'work', 6), at(b, A.kitchen, 12, 13, 'eat', 3), at(b, [A.gardenE, A.maze, A.gardenW, A.terrace, A.kitchen][n], 13, 18, 'work', 6)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'farmer', home: home(n + 5), day: [at(b, A.paddock, 5, 12, 'work', 4), at(b, A.stable, 12, 18, 'work', 3)] })
  for (const c of [A.gate, A.door]) cast.push({ role: 'guard', home: home(cast.length), day: [at(b, c, 6, 20, 'watch', 2)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'noble', home: gallery.id, day: [at(b, n ? A.gardenE : A.gardenW, 9, 12, 'walk', 6), at(hall, hall.anchors.table, 12, 14, 'eat', 3), at(b, A.maze, 14, 17, 'walk', 4), at(gallery, gallery.anchors.walk, 17, 21, 'walk', 6)] })
  cast.push({ role: 'villager', home: home(8), day: [at(b, A.avenue, 7, 18, 'walk', 6)] })
  cast.push({ role: 'peddler', home: home(9), stock: [['item/food/apple', 4], ['item/light/candle', 4]], day: [at(b, A.gate, 8, 17, 'work', 2)] })
  CASTS.set(p.id, cast)
  return [b, hall, gallery, cellar, ...rooms]
}
