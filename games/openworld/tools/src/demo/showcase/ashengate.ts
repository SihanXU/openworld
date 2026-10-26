// Ashengate (docs/showcase.md §4d): a ruined abbey sinking into the Pale Fens, and the scholars' dig that has come to
// open it — after Tintern and Rievaulx, roofless in their valleys, and the camps of every old excavation. The church
// stands without its roof, trees grown up its nave; the cloister's walls are fallen to their footings, its arcade a row
// of broken columns; an arch stands alone where the gate was, a tower's stump over the water, saints face down in the
// grass. The fen has come in: pools in the nave's aisles, reeds where the garth was, dead trees, mist. South of it the
// diggers' tents, their trenches and sieves and finds laid out, the cook fire, the cart road out.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkStair } from './rooms.ts'
import { drownedHall, undercroftHall } from './regionhalls.ts'
import { clearDoorsteps } from './street.ts'
import { decor, unshut } from './dress.ts'
import { bedsNear, glowAt, standAnchors } from './ground.ts'

const W = 64
const H = 72
const LIT = { statuses: { lit: -1 } }

export function ashengate(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'village', W, H, 'grass', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the fen coming in: pools, mud, reeds, the mist
  for (const [x, y, rx, ry] of [[6, 10, 6, 4], [56, 8, 7, 5], [52, 34, 6, 4], [8, 40, 5, 3], [58, 52, 5, 4], [4, 60, 5, 4]]) b.organic(x, y, rx, ry, 'water', { rough: 0.5 })
  for (const [x, y, rx, ry] of [[6, 10, 8, 6], [56, 8, 9, 7], [52, 34, 8, 6], [8, 40, 7, 5], [58, 52, 7, 6], [4, 60, 7, 6], [30, 30, 10, 3]]) b.organic(x, y, rx, ry, 'mud', { rough: 0.5, only: (c) => c === 'grass' })
  b.sprinkle('fixture/nature/reeds', 0.25, (x, y, t) => (t === 'mud' || t === 'grass') && b.near(x, y, (n) => n === 'water', 1))

  // ------------------------------------------------------------------ the church: its shell, trees up its nave, the pools in its aisles, the stair down
  b.building('ruin_nave', 24, 8)
  for (const [x, y] of [[27, 10], [31, 12], [29, 9]] as Cell[]) b.set(x, y, 'tree')
  b.organic(30, 12, 2, 1, 'water', { rough: 0.3 })
  b.set(26, 12, 'stairs_down')
  decor(b, 'decor_statue_fallen', 28, 13)
  // the tower's stump over the water, the arch alone where the gate stood
  b.building('ruin_tower', 44, 10)
  b.building('ruin_arch', 30, 52)
  // ------------------------------------------------------------------ the cloister: its walls to their footings, the arcade's columns, the garth gone to reeds
  b.building('ruin_wall_x6', 20, 20)
  b.building('ruin_wall_x4', 30, 20)
  b.building('ruin_wall_x4', 20, 34)
  b.building('ruin_wall_x6', 30, 34)
  b.building('ruin_wall_x3', 38, 34)
  for (const [x, y] of [[19, 22], [19, 26], [19, 30], [41, 22], [41, 27], [41, 31]] as Cell[]) b.building('ruin_column_' + ((x + y) % 3), x, y)
  for (const [x, y] of [[23, 24], [27, 24], [33, 24], [37, 24], [23, 30], [33, 30]] as Cell[]) b.building('ruin_column_' + ((x * y) % 3), x, y)
  b.organic(30, 27, 6, 3, 'mud', { rough: 0.4 })
  b.sprinkle('fixture/nature/reeds', 0.3, (x, y, t) => t === 'mud' && x > 22 && x < 40 && y > 23 && y < 33)
  decor(b, 'decor_column_fallen', 25, 28)
  decor(b, 'decor_column_fallen', 34, 26)
  b.fixture('fixture/sacred/statue', 30, 25)
  // the monks' graves, leaning; the briars; the dead trees in the water
  for (let k = 0; k < 12; k++) b.fixture('fixture/sacred/gravestone', 46 + (k % 6) * 2, 22 + Math.floor(k / 6) * 3, { props: { text: 'A brother of Ashengate. The fen keeps him now.', text_zh: '灰门修道院的一位修士。如今沼泽守着他。' } })
  for (const [x, y] of [[13, 18], [15, 30], [47, 30], [11, 26]] as Cell[]) b.fixture('fixture/nature/briar', x, y)
  for (const [k, x, y] of [[1, 6, 9], [2, 57, 7], [3, 52, 33], [1, 58, 51]] as [number, number, number][]) b.building(`fen_deadtree_${k}`, x - 1, y)
  for (const [x, y] of [[16, 14], [44, 40], [12, 48], [50, 46]] as Cell[]) b.fixture('fixture/nature/mushroom_ring', x, y)
  b.sprinkle('fixture/nature/mist', 0.015, (_x, _y, t) => t === 'water' || t === 'mud')
  b.sprinkle('fixture/nature/ferns', 0.03, (_x, _y, t) => t === 'grass')

  // ------------------------------------------------------------------ the dig: trenches marked out, the sieves, the finds on their tables, the tents, the fire
  for (const [x, y, w, h] of [[10, 44, 8, 2], [44, 42, 6, 3], [20, 40, 3, 6]] as [number, number, number, number][]) {
    b.rect(x, y, w, h, 'dirt')
    b.fence('rail', [x - 1, y - 1], [x + w, y - 1])
  }
  for (const [x, y] of [[12, 47], [46, 46]] as Cell[]) decor(b, 'decor_sacks', x, y)
  for (const [x, y] of [[24, 46], [26, 46], [28, 46]] as Cell[]) b.fixture('fixture/furniture/table', x, y)
  for (const [x, y] of [[24, 47], [28, 47]] as Cell[]) b.fixture('fixture/furniture/rack', x, y)
  const TENTS: [number, number, string][] = [[8, 56, 'a'], [14, 58, 'c'], [40, 57, 'b'], [46, 59, 'a'], [52, 56, 'c'], [20, 62, 'b']]
  for (const [x, y, k] of TENTS) b.building(`march_tent_${k}`, x, y)
  b.fixture('fixture/light/campfire', 32, 60, LIT)
  glowAt(b, 32, 60, 'always', 0.45)
  for (const [x, y] of [[31, 61], [34, 60]] as Cell[]) b.fixture('fixture/furniture/bench/log', x, y)
  for (const [x, y] of [[36, 63], [37, 63]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[28, 64], [26, 58]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  b.fixture('fixture/furniture/cart', 38, 66)
  b.fixture('fixture/furniture/washing_line', 24, 66)
  for (const [x, y] of [[18, 52], [44, 52]] as Cell[]) {
    b.fixture('fixture/light/lantern', x, y, LIT)
    glowAt(b, x, y, 'night')
  }
  b.path([[31, H - 1], [31, 62], [31, 55], [30, 46], [27, 18]], 'path', 2, { over: (c) => c === 'grass' || c === 'mud' })
  b.vistas.push({ at: [20, 15, 24, 10], zoom: 0.7, focus: [29, 6], share: 0.4 })
  b.anchors = { nave: [28, 15], cloister: [30, 31], trenchW: [13, 47], trenchE: [47, 46], trenchN: [21, 47], finds: [26, 48], camp: [32, 62], arch: [31, 55], graves: [50, 26], tower: [45, 15] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ below: the undercroft, and under it the drowned vault
  const crypt = undercroftHall(p)
  linkStair(b, [26, 12], crypt, crypt.anchors.stair, true)
  const vault = drownedHall(p)
  linkStair(crypt, crypt.anchors.down, vault, vault.anchors.stair, true)
  roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the dig's people: the scholars, the diggers, the cook, the guards, a hermit who stayed
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const trenches = [A.trenchW, A.trenchE, A.trenchN, A.cloister, A.nave]
  const cast: Cast[] = []
  for (let n = 0; n < 4; n++) cast.push({ role: 'scholar', home: b.id, day: [at(b, A.finds, 7, 11, 'work', 2), at(b, trenches[n], 11, 12, 'walk', 3), at(b, A.camp, 12, 13, 'eat', 3), at(n % 2 ? crypt : b, n % 2 ? crypt.anchors.altar : A.nave, 13, 18, 'work', 3), at(b, A.camp, 18, 22, 'rest', 4)] })
  for (let n = 0; n < 9; n++) cast.push({ role: 'miner', home: b.id, day: [at(b, trenches[n % 5], 6, 12, 'work', 3), at(b, A.camp, 12, 13, 'eat', 4), at(b, trenches[(n + 2) % 5], 13, 18, 'work', 3), at(b, A.camp, 18, 22, 'rest', 5)] })
  cast.push({ role: 'villager', sex: 'female', home: b.id, day: [at(b, A.camp, 5, 21, 'work', 3)] })
  for (const c of [A.arch, A.camp]) cast.push({ role: 'guard', home: b.id, day: [at(b, c, 6, 20, 'watch', 4)] })
  cast.push({ role: 'elder', home: b.id, day: [at(b, A.tower, 6, 12, 'pray', 2), at(b, A.graves, 12, 18, 'sit', 2)] })
  for (let n = 0; n < 3; n++) cast.push({ role: 'traveler', home: b.id, day: [at(b, A.arch, 8, 12, 'walk', 4), at(b, A.cloister, 12, 16, 'walk', 4), at(b, A.camp, 16, 21, 'rest', 4)] })
  cast.push({ role: 'peddler', home: b.id, stock: [['item/food/bread', 3], ['item/light/torch', 4], ['item/potion/antidote', 1]], day: [at(b, A.camp, 7, 19, 'work', 2)] })
  cast.push({ role: 'herbalist', home: b.id, stock: [['item/material/herb', 4], ['item/potion/healing', 1]], day: [at(b, A.graves, 7, 13, 'work', 4), at(b, A.camp, 13, 19, 'work', 3)] })
  // (they sleep in the tents: a bed by each tent's door and round the fire)
  const beds = bedsNear(b, [...TENTS.map(([x, y]) => [x + 1, y + 3] as Cell), [32, 62]], cast.length)
  cast.forEach((c, i) => (c.bed = beds[i]))
  CASTS.set(p.id, cast)
  return [b, crypt, vault]
}
