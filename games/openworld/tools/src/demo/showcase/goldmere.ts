// Goldmere Tower (docs/showcase.md §4d): a mage's tower on its knoll in the Vale, and the hamlet that serves it, after
// the towers of every old tale — Orthanc in its ring, the astrologers' towers of Prague, the Tower of the Winds. The
// tower rises on its knoll within a ring of standing stones; the annex where the apprentices sleep; the physic garden of
// strange plants, the crystals pushing out of the ground where the mage's work has soaked into it; below, the hamlet's
// farms and its well, the road to the tower's foot. Within, floor by floor: the library, the laboratory, the observatory
// under the spire, the cellar beneath.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { alchemyHall, observatoryHall, towerCellar, towerHall } from './regionhalls.ts'
import { clearDoorsteps, houseRow, pave } from './street.ts'
import { FARM_HOUSES } from '../../art/arch/buildings/works.ts'
import { busyRow, decor, frontage, piles, strew, unshut } from './dress.ts'
import { glowAt, stair, standAnchors } from './ground.ts'

const W = 60
const H = 64
const KNOLL = 4
const VALE = 2

export function goldmere(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  b.raise(0, 0, W, H, VALE)
  // ------------------------------------------------------------------ the knoll: the tower, the ring of stones, the annex, the physic garden, the crystals
  b.raise(12, 4, 36, 26, KNOLL)
  stair(b, 29, 30, 3, KNOLL, VALE, 'path')
  b.organic(30, 20, 10, 6, 'flagstone', { rough: 0.2 })
  b.building('mage_tower', 28, 18, ['tower'], true)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    b.fixture('fixture/nature/boulder', Math.round(30 + Math.cos(a) * 11), Math.round(20 + Math.sin(a) * 7))
  }
  b.building('mage_annex', 15, 22, ['annex'], true)
  doors.push({ door: 'annex', prefab: 'mage_annex', role: 'home' })
  // the physic garden east of the tower: beds of strange plants, mushrooms in rings, the bee skeps, a bench
  for (let y = 10; y < 27; y += 3) for (let x = 40; x < 47; x++) b.set(x, y, 'farmland')
  for (let y = 10; y < 27; y += 3) for (let x = 40; x < 47; x += 2) b.fixture(x % 4 === 0 ? 'fixture/nature/plant' : 'fixture/nature/mushroom_ring', x, y)
  for (const [x, y] of [[44, 8], [46, 8]] as Cell[]) b.fixture('fixture/nature/beehive', x, y)
  b.fixture('fixture/garden/bench', 41, 28)
  // the crystals pushing out of the ground where the work has soaked into it, their glow by night
  for (const [k, x, y] of [[0, 22, 14], [1, 37, 13], [2, 24, 27], [0, 38, 26], [1, 19, 18], [2, 35, 9]] as [number, number, number][]) {
    decor(b, `decor_crystals_${k}`, x, y)
    glowAt(b, x, y, 'always', 0.35, '#c9a2f2')
  }
  for (const [x, y] of [[14, 8], [20, 6], [46, 20], [16, 28], [44, 29]] as Cell[]) b.set(x, y, 'tree')

  // ------------------------------------------------------------------ the hamlet below: its farms on the lane, the well, the fields, the road
  b.rect(29, 31, 3, H - 31, 'path')
  const h1 = houseRow(b, 2, 27, 42, FARM_HOUSES, 'h', 0.4, { yards: ['garden', 'garden', 'bare'] })
  const h2 = houseRow(b, 33, 58, 42, FARM_HOUSES, 'h2', 0.4, { yards: ['garden', 'garden', 'bare'] })
  doors.push(...h1.doors, ...h2.doors)
  pave(b, 0, 43, W, 2, 'path')
  b.fixture('fixture/water/well', 26, 46)
  b.fixture('fixture/sign/noticeboard', 33, 46)
  for (let k = 0; k < 4; k++) {
    const x0 = 2 + k * 7
    b.rect(x0, 50, 5, 12, 'farmland')
    for (let y = 51; y < 62; y += 2) for (let x = x0; x < x0 + 5; x += 2) b.fixture(k % 2 ? 'fixture/crop/wheat/young' : 'fixture/crop/wheat/ripe', x, y)
  }
  b.yard(36, 50, 20, 11, 'rail', [[36, 55]])
  for (const [x, y] of [[40, 53], [46, 56], [51, 52]] as Cell[]) b.creature('animal/cow', x, y, { behaviour: 'passive', temper: 'wary', sight: 4, leash: 4 })
  for (const [x, y] of [[44, 58], [52, 58]] as Cell[]) b.fixture('fixture/nature/haystack', x, y)
  b.fixture('fixture/scarecrow', 16, 56)
  b.sprinkle('fixture/nature/flowers', 0.03, (_x, _y, t) => t === 'grass')
  b.sprinkle('fixture/nature/tuft', 0.04, (_x, _y, t) => t === 'grass')
  for (const r of [h1, h2]) {
    frontage(b, r, true)
    busyRow(b, r, 0, W, 'poor')
  }
  piles(b, 0, 30, W, H - 30, 'poor', 0.35)
  strew(b, 0, 0, W, H, 0.05, 'poor')
  b.vistas.push({ at: [22, 28, 16, 10], zoom: 0.6, focus: [30, 8], share: 0.45 })
  b.anchors = { door: [30, 23], ring: [30, 28], garden: [43, 18], annex: [19, 26], lane: [20, 44], well: [27, 47], fields: [12, 55], pasture: [45, 54], road: [30, 58] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ within, floor by floor: the library, the laboratory, the observatory; the cellar
  const hall = towerHall(p)
  linkDoors(b, [b.doors.tower], hall, [hall.doors.out])
  const lab = alchemyHall(p)
  linkStair(hall, hall.anchors.up, lab, lab.anchors.down, false)
  const obs = observatoryHall(p)
  linkStair(lab, lab.anchors.up, obs, obs.anchors.down, false)
  const cellar = towerCellar(p)
  linkStair(hall, hall.anchors.down, cellar, cellar.anchors.up, true)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the tower's people and the hamlet's
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const home = (n: number) => rooms[n % rooms.length].id
  const eat = (n: number) => at(rooms[n % rooms.length], [5, 3], 12, 13, 'eat', 2)
  const annex = rooms[0].id
  const cast: Cast[] = []
  cast.push({ role: 'mage', age: [55, 80], home: obs.id, day: [at(obs, obs.anchors.gaze, 0, 4, 'work', 1), at(lab, lab.anchors.work, 9, 13, 'work', 2), at(hall, hall.anchors.desk, 13, 18, 'read', 2), at(b, A.garden, 18, 20, 'walk', 3), at(obs, obs.anchors.gaze, 20, 24, 'work', 1)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'mage', age: [16, 26], home: annex, day: [at(hall, hall.anchors.desk, 7, 12, 'read', 3), at(b, A.annex, 12, 13, 'eat', 3), at(n % 2 ? lab : b, n % 2 ? lab.anchors.work : A.garden, 13, 18, 'work', 3), at(b, A.ring, 18, 21, 'walk', 4)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'villager', sex: 'female', home: annex, day: [at(cellar, cellar.anchors.cage, 6, 9, 'work', 2), at(b, A.annex, 9, 18, 'work', 3)] })
  for (const c of [A.door, A.ring]) cast.push({ role: 'guard', home: annex, day: [at(b, c, 6, 20, 'watch', 2)] })
  for (let n = 0; n < 5; n++) cast.push({ role: 'farmer', home: home(n + 1), day: [at(b, n % 2 ? A.fields : A.pasture, 6, 12, 'work', 5), eat(n + 1), at(b, A.fields, 13, 18, 'work', 5), at(b, A.well, 18, 20, 'rest', 3)] })
  for (let n = 0; n < 4; n++) cast.push({ role: 'villager', sex: n % 2 ? 'female' : undefined, home: home(n + 6), day: [at(b, A.lane, 7, 12, 'work', 5), eat(n + 6), at(b, A.well, 13, 18, 'walk', 4)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'child', home: home(n + 2), day: [at(b, A.well, 8, 12, 'play', 5), eat(n + 2), at(b, A.ring, 13, 17, 'play', 4)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'traveler', home: home(n + 9), day: [at(b, A.road, 8, 12, 'walk', 4), at(b, A.door, 12, 17, 'sit', 3)] })
  cast.push({ role: 'elder', home: home(11), day: [at(b, A.well, 8, 18, 'sit', 2)] })
  CASTS.set(p.id, cast)
  return [b, hall, lab, obs, cellar, ...rooms]
}
