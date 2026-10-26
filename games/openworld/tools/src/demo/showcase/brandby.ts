// Brandby Mine (docs/showcase.md §4c): the Scarred March's copper and iron mine and what it broke into, after the old
// mining camps of every red country — Rio Tinto's adits, the headframes of the Harz, the camps of the gold rushes. Under
// the mesa's face the adit's timbered mouth, the rails out of it to the spoil heaps, the headframe over the shaft, the
// sheds, the forge, the timber yard; below them the camp on its lower ground. Underground (regionhalls.ts) the workings
// — drifts on their rails, stopes with the ore in the walls, the flooded sump — and past the breakthrough in the east
// stope the old works: a pillared hall before a sealed gate, a forge still burning, tombs, a vault, the dead that keep it.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind, type DoorNote } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { linkDoors, linkStair } from './rooms.ts'
import { oldWorksHall, workingsHall } from './regionhalls.ts'
import { clearDoorsteps } from './street.ts'
import { decor, piles, strew, unshut } from './dress.ts'
import { glowAt, regrass, stair, standAnchors } from './ground.ts'

const W = 60
const H = 64
const MESA = 8
const YARD = 2
const CAMP = 0
const LIT = { statuses: { lit: -1 } }

export function brandby(p: Place): MapBuilder[] {
  reseed(p.seed)
  const b = new MapBuilder(p.id, p.name, 'town', W, H, 'dirt', 'village', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const doors: DoorNote[] = []
  // ------------------------------------------------------------------ the mesa, the yard under its face, the camp's lower ground
  b.raise(0, 0, W, 14, MESA)
  b.raise(0, 14, W, 28, YARD)
  b.raise(0, 42, W, H - 42, CAMP)
  stair(b, 54, 14, 2, MESA, YARD, 'path')
  // the mesa's crags: outcrops of the red rock, the scrub in their lee
  for (const [x, y, rx, ry] of [[18, 3, 2, 1.5], [36, 9, 1.5, 1], [50, 3, 2.5, 1.5], [26, 7, 1, 1], [6, 2, 1.5, 1]]) b.organic(x, y, rx, ry, 'rock', { rough: 0.5, only: (c) => c === 'dirt' || c === 'sand' })
  stair(b, 28, 42, 3, YARD, CAMP, 'path')
  for (const [x, y, rx, ry] of [[12, 5, 7, 3], [40, 4, 9, 3], [6, 54, 6, 3], [52, 58, 7, 3], [50, 36, 6, 2]]) b.organic(x, y, rx, ry, 'sand', { rough: 0.5, only: (c) => c === 'dirt' })
  for (const [x, y] of [[3, 2], [4, 2], [3, 3], [30, 1], [31, 2], [47, 9], [58, 4], [57, 5], [20, 10], [25, 3]] as Cell[]) b.set(x, y, 'rock')
  // the watch on the mesa, the path up to it
  b.building('march_watchtower', 8, 9)
  b.fixture('fixture/standard', 13, 11)
  b.path([[55, 13], [44, 10], [20, 11], [11, 12]], 'path', 1)

  // ------------------------------------------------------------------ the yard: the adit, its rails to the spoil, the headframe over the shaft
  b.building('mine_adit', 26, 16, ['adit'], true)
  for (const [x, y] of [[24, 18], [30, 18]] as Cell[]) {
    b.fixture('fixture/light/brazier', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
  }
  b.rect(26, 18, 3, 10, 'gravel')
  for (let y = 18; y < 28; y++) decor(b, 'decor_rails_v', 27, y)
  b.rect(28, 26, 18, 3, 'gravel')
  for (let x = 28; x < 46; x++) decor(b, 'decor_rails_h', x, 27)
  b.building('mine_spoil_a', 46, 26)
  b.building('mine_spoil_b', 52, 30)
  b.building('mine_spoil_b', 47, 33)
  for (const [x, y] of [[27, 22], [38, 27]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[22, 19], [31, 19], [23, 22], [32, 23]] as Cell[]) decor(b, 'decor_ore', x, y)
  b.building('mine_headframe', 40, 18)
  b.fixture('fixture/ferry/winch', 45, 21)
  // the sheds: the smith's under its sign, the bunkhouse, the forge in the open, the timber yard
  b.building('mine_shed', 3, 19, ['shed'], true)
  doors.push({ door: 'shed', prefab: 'mine_shed', role: 'smithy' })
  b.building('mine_bunkhouse', 4, 30, ['bunk'], true)
  doors.push({ door: 'bunk', prefab: 'mine_bunkhouse', role: 'barracks' })
  b.rect(12, 21, 6, 4, 'gravel')
  b.fixture('fixture/craft/forge', 13, 22, LIT)
  b.fixture('fixture/craft/anvil', 15, 23)
  b.fixture('fixture/water/trough', 17, 22)
  glowAt(b, 13, 22, 'always', 0.5, '#ff7a2a')
  for (const [x, y] of [[17, 30], [18, 30], [19, 30], [17, 31], [18, 31]] as Cell[]) b.fixture('fixture/nature/logpile/stack', x, y)
  for (const [x, y] of [[33, 33], [34, 33], [20, 35]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[35, 33], [21, 35], [36, 21]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[24, 34], [40, 36]] as Cell[]) decor(b, 'decor_firewood', x, y)
  b.fixture('fixture/sign/noticeboard', 32, 18)
  // the smelter's hearths by the spoil, the ore waiting for them, a second line of carts
  for (const [x, y] of [[50, 20], [53, 20]] as Cell[]) {
    b.fixture('fixture/craft/forge', x, y, LIT)
    glowAt(b, x, y, 'always', 0.5, '#ff7a2a')
  }
  for (const [x, y] of [[49, 22], [52, 23], [55, 22], [36, 30], [33, 37]] as Cell[]) decor(b, 'decor_ore', x, y)
  for (const [x, y] of [[56, 20], [44, 31]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[8, 25], [9, 25], [56, 37], [57, 37]] as Cell[]) b.fixture('fixture/container/crate', x, y)
  b.fixture('fixture/water/well', 25, 37)
  // the shaft: the cage's landing at the headframe's foot goes down to the winze
  b.set(42, 22, 'gravel')

  // ------------------------------------------------------------------ the camp: tents, the cook fire, the ore buyer's stall, the road out
  b.path([[29, 44], [27, 52], [30, 58], [29, H - 1]], 'path', 3)
  const TENTS: [number, number, string][] = [[4, 45, 'a'], [9, 47, 'b'], [15, 45, 'c'], [20, 49, 'a'], [5, 52, 'c'], [12, 54, 'b'], [19, 56, 'a'], [36, 46, 'b'], [42, 45, 'a'], [48, 47, 'c'], [38, 53, 'c'], [45, 55, 'b'], [52, 51, 'a']]
  for (const [x, y, k] of TENTS) b.building(`march_tent_${k}`, x, y)
  for (const [x, y] of [[16, 51], [42, 51], [8, 59]] as Cell[]) {
    b.fixture('fixture/light/campfire', x, y, LIT)
    glowAt(b, x, y, 'always', 0.45)
    b.fixture('fixture/furniture/bench/log', x + 1, y)
  }
  b.fixture('fixture/furniture/stall', 33, 47)
  for (const [x, y] of [[24, 46], [34, 57], [50, 44]] as Cell[]) b.fixture('fixture/furniture/washing_line', x, y)
  for (const [x, y] of [[2, 58], [56, 46], [33, 60]] as Cell[]) b.fixture('fixture/furniture/cart', x, y)
  for (const [x, y] of [[23, 52], [11, 61], [47, 60]] as Cell[]) b.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[14, 60], [40, 59]] as Cell[]) b.fixture('fixture/standard', x, y)

  // ------------------------------------------------------------------ the dust and scrub, the life heaped at every wall
  regrass(b, ['grass', 'flowerbed', 'flowers'], 'dirt')
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.get(x, y) === 'dirt' && !b.near(x, y, (t) => t === 'path' || t === 'gravel' || t === 'wall' || t === 'door', 1) && rng.chance(0.015)) b.set(x, y, 'bush')
  b.sprinkle('fixture/nature/pebbles', 0.03, (_x, _y, t) => t === 'dirt' || t === 'sand' || t === 'gravel')
  piles(b, 0, 14, W, H - 14, 'poor', 0.45)
  strew(b, 0, 14, W, H - 14, 0.06, 'poor')
  b.anchors = { adit: [28, 20], spoil: [42, 29], forge: [14, 24], yard: [30, 31], timber: [20, 32], camp: [16, 50], cook: [42, 50], stall: [33, 48], mesa: [40, 8] }
  clearDoorsteps(b)
  unshut(b)
  standAnchors(b)

  // ------------------------------------------------------------------ below: the workings by the adit and by the shaft, the old works past the breakthrough
  const work = workingsHall(p)
  linkDoors(b, [b.doors.adit], work, [work.doors.out])
  linkStair(b, [42, 22], work, work.anchors.shaft, true)
  const old = oldWorksHall(p)
  linkStair(work, work.anchors.down, old, old.anchors.stair, true)
  const rooms = roomsBehind(b, p, doors)

  // ------------------------------------------------------------------ the folk: the miners on their shifts, the overseers, the smith, the cooks, the buyer
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const WA = work.anchors
  const faces = [WA.face, WA.stopeW, WA.stopeE, WA.entry]
  const cast: Cast[] = []
  const bunk = rooms[1]?.id ?? rooms[0].id
  for (let n = 0; n < 10; n++)
    cast.push({ role: 'miner', home: bunk, day: [at(work, faces[n % 4], 6, 12, 'work', 3), at(b, A.yard, 12, 13, 'eat', 5), at(work, faces[(n + 1) % 4], 13, 18, 'work', 3), at(b, n % 2 ? A.camp : A.cook, 18, 22, 'rest', 4)] })
  for (const c of [A.adit, A.spoil]) cast.push({ role: 'guard', home: bunk, day: [at(b, c, 6, 19, 'watch', 3), at(b, A.camp, 19, 22, 'rest', 4)] })
  cast.push({ role: 'smith', home: rooms[0].id, day: [at(b, A.forge, 6, 18, 'work', 1), at(b, A.cook, 18, 21, 'rest', 3)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'villager', sex: 'female', home: bunk, day: [at(b, A.cook, 6, 20, 'work', 3)] })
  cast.push({ role: 'merchant', home: rooms[0].id, stock: [['item/material/stone', 4], ['item/light/torch', 4], ['item/food/bread', 3]], day: [at(b, A.stall, 7, 19, 'work', 0)] })
  for (let n = 0; n < 2; n++) cast.push({ role: 'child', home: bunk, day: [at(b, A.camp, 8, 18, 'play', 6)] })
  cast.push({ role: 'traveler', home: bunk, day: [at(b, A.mesa, 9, 15, 'walk', 6), at(b, A.camp, 15, 21, 'rest', 4)] })
  CASTS.set(p.id, cast)
  return [b, work, old, ...rooms]
}
