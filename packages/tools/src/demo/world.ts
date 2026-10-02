// The hand-crafted Hearthvale demo (docs/game-design.md §4): the town around the Great
// Hearth, the player's homestead, the interiors, Whisperwood to the south and Slime Hollow
// beyond it; the twelve people (people/*.ts), the arrival scene, letters and the first week's
// weather. Writes the default web world.
//
//   npx tsx packages/tools/src/demo/world.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Entity, LetterDef, MapMeta, Pos, SceneDef, ScheduleEntry, ScheduleVariant, Text, WorldIndex } from '@lsw/engine'
import { CATALOG } from '../../../client/src/assets/catalog.ts'
import { MapBuilder, linkEdge, rng, type Cell, type ItemSpec } from './builder.ts'
import type { PersonDef, Slot } from './person.ts'
import { PEOPLE } from './people.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../client/public/world')
const VERSION = 'hearthvale-2'
const L = (en: string, zh: string): Text => ({ en, zh })

const grassy = (c: string) => c === 'grass' || c === 'flowers'
const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'])

/**
 * A forest edge, not a ruler line: each border cell is wooded when its distance to the map edge
 * is under a wandering depth (2–4 tiles), except in the openings.
 */
function forestEdge(m: MapBuilder, depth = 2, gaps: [number, number, number, number][] = [], pines = 0.2) {
  const wave = (i: number, s: number) => depth + 0.6 * (0.5 + 0.5 * Math.sin(i / 3.1 + s)) + 0.4 * (0.5 + 0.5 * Math.sin(i / 1.7 + s * 2))
  const s = rng.next() * 6
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh)) continue
      const d = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      const along = d === x || d === m.w - 1 - x ? y : x
      if (d < depth || d < wave(along, s + (d === y ? 0 : 3))) m.set(x, y, rng.chance(pines) ? 'pine' : 'tree')
    }
}

/** The nearest open cell to (x,y): walkable ground with nothing on it. */
function spot(m: MapBuilder, x: number, y: number): Cell {
  for (let r = 0; r <= 8; r++)
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r && m.free(x + i, y + j) && m.get(x + i, y + j) !== 'bridge') return [x + i, y + j]
  throw new Error(`${m.id}: no open cell near ${x},${y}`)
}

/** A clump of trees around a point (a copse), leaving free what is already built. */
function copse(m: MapBuilder, cx: number, cy: number, r: number, p = 0.6) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x - cx, y - cy) <= r && grassy(m.get(x, y)) && m.free(x, y) && rng.chance(p)) m.set(x, y, rng.chance(0.15) ? 'bush' : 'tree')
}

/** Ground detail by masks: tufts and clover in the grass, flowers by paths, leaves under trees, pebbles by rocks and water. */
function detail(m: MapBuilder, density = 1) {
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const road = (t: string) => t === 'path' || t === 'cobble'
  const wet = (t: string) => t === 'water' || t === 'deepwater'
  m.sprinkle('leaves', 0.12 * density, (x, y, t) => grassy(t) && m.near(x, y, tree))
  m.sprinkle('pebbles', 0.14 * density, (x, y, t) => !wet(t) && m.near(x, y, (n) => n === 'rock' || wet(n)))
  m.sprinkle('flowers', 0.08 * density, (x, y, t) => grassy(t) && m.near(x, y, road) && !m.near(x, y, tree))
  m.sprinkle('tufts', 0.03 * density, (x, y, t) => grassy(t) && !m.near(x, y, road))
  m.sprinkle('clover', 0.015 * density, (_x, _y, t) => grassy(t))
  m.sprinkle('twigs', 0.02 * density, (x, y, t) => grassy(t) && m.near(x, y, tree))
}

// =================================================================== Hearthvale (town)

const town = new MapBuilder('hearthvale', L('Hearthvale', '炉谷'), 'village', 64, 48, 'grass', 'village')
{
  const m = town
  // the river: from the north-east past the mill, under the (washed-out) east bridge, into the
  // pond, and on south
  m.path([[54, -1], [53, 5], [51, 11], [49, 16], [48, 21], [48, 26], [49, 30]], 'water', 3)
  m.organic(50, 33, 5.5, 4, 'water', { rough: 0.25 })
  m.organic(50.5, 33, 2.6, 1.7, 'deepwater', { rough: 0.2, only: (c) => c === 'water' })
  m.path([[51, 36], [52, 41], [53, 48]], 'water', 2)

  // the forest edge, open to the west road, the north road (blocked), the east and the south gate
  forestEdge(m, 2, [[0, 20, 3, 4], [35, 0, 5, 4], [60, 19, 4, 4], [29, 44, 6, 4], [50, 0, 7, 3], [50, 44, 5, 4]])

  // ---- the rise (north-west): graveyard, shrine, lookout, above a stone wall
  m.fence('stonewall', [2, 9], [20, 9], [[11, 9]])
  m.path([[11, 12], [11, 9], [11, 6]], 'path', 1)
  for (const [x, y] of [[4, 4], [6, 4], [8, 4], [4, 6], [6, 6], [8, 6]]) m.fixture('fixture/sacred/gravestone', x, y, { props: { text: 'Here rests one of the valley. · 此处长眠着山谷之人。' } })
  m.fixture('fixture/sacred/gravestone', 10, 3, { name: L('Old Gravestone', '旧墓碑'), props: { text: 'TOMAS ASHBY — he kept the west field. · 托马斯·阿什比——他守过西边的田。' } })
  m.scenery('shrine_stone', 15, 3)
  m.fixture('fixture/furniture/bench', 19, 6, { name: L('Lookout Bench', '瞭望长椅') })
  m.item({ form: 'item/valuable/ring', material: 'silver', name: L('Lost Ring', '遗落的戒指') }, ...spot(m, 20, 4))
  m.anchor('rise.graveyard', 7, 7)
  m.anchor('rise.shrine', 15, 6)
  m.anchor('rise.lookout', 19, 7)
  m.sprinkle('flowers', 0.35, (x, y, t) => grassy(t) && m.near(x, y, (_n, nx, ny) => m.entities.some((e) => e.type === 'fixture/sacred/gravestone' && e.place.on === 'tile' && e.place.x === nx && e.place.y === ny)), [2, 1, 10, 8])

  // ---- the elder's house and Maren's garden (north)
  const elderDoor = m.house('house_plaster', 23, 4, 'elder')
  m.yard(28, 3, 6, 6, 'rail', [[30, 8]])
  m.rect(29, 4, 4, 4, 'farmland')
  for (let x = 29; x <= 32; x++) for (let y = 4; y <= 7; y++) if ((x + y) % 3) m.fixture(`fixture/crop/herb/${rng.pick(['young', 'ripe', 'young'])}`, x, y)
  m.decor('potted', 27, 6)
  m.decor('bucket', 27, 8)
  m.anchor('elder.garden', 30, 9)

  // ---- the north road, blocked by a rockslide
  m.path([[33, 13], [35, 8], [37, 3], [37, -1]], 'path', 2, { edge: 'dirt', edgeP: 0.3 })
  for (const [x, y] of [[35, 1], [36, 1], [37, 1], [38, 1], [36, 2], [37, 2], [38, 2], [36, 0], [37, 0], [38, 0]]) m.set(x, y, 'rock')
  m.decor('rocks', 35, 3)
  m.decor('rocks', 39, 3)
  m.decor('pebbles', 36, 4)
  m.decor('pebbles', 38, 4)
  m.fixture('fixture/sign', 39, 5, { props: { text: 'North road — closed by the slide. · 北路——塌方封闭。' } })

  // ---- the square and the Great Hearth
  // a rounded plaza, not a blob: the Hearth at its heart
  for (let y = 14; y <= 24; y++)
    for (let x = 25; x <= 39; x++) {
      const cx = Math.max(0, Math.abs(x - 32) - 4.5)
      const cy = Math.max(0, Math.abs(y - 19) - 2.5)
      if (Math.hypot(cx, cy) <= 2.8) m.set(x, y, 'cobble')
    }
  m.fixture('fixture/light/hearth', 32, 19, { id: 'great_hearth', statuses: { lit: -1 } })
  for (const [x, y] of [[31, 18], [32, 18], [33, 18], [31, 19], [33, 19]]) m.block(x, y)
  m.anchor('square.hearth', 32, 21)
  m.fixture('fixture/water/well', 27, 21)
  m.anchor('square.well', 28, 22)
  m.decor('bucket', 26, 21)
  m.fixture('fixture/sign/noticeboard', 36, 15, {
    id: 'noticeboard',
    props: { text: 'HEARTH NIGHT — every Hearthday evening at the Hearth Inn. All welcome. — Lio · 炉火之夜——每逢炉日傍晚，炉火旅店，欢迎所有人。——里奥' },
  })
  m.anchor('square.board', 36, 16)
  m.fixture('fixture/furniture/bench', 28, 16)
  m.fixture('fixture/furniture/bench', 29, 16)
  m.anchor('square.bench', 28, 16)
  // benches facing the Hearth, planters at the plaza's edge
  for (const [x, y] of [[29, 19], [35, 19], [30, 21], [34, 21]]) m.fixture('fixture/furniture/bench', x, y)
  for (const [x, y] of [[25, 18], [39, 20], [27, 24], [37, 15]]) if (m.free(x, y)) m.decor('potted', x, y, true)
  for (const [x, y] of [[25, 16], [39, 17], [26, 24], [38, 23]]) m.fixture('fixture/light/lamppost', x, y, { statuses: { lit: -1 } })
  m.decor('lantern_post', 30, 14)

  // ---- Oda's Goods and her stall (west of the square)
  const shopDoor = m.house('store', 17, 15, 'shop')
  m.fixture('fixture/furniture/stall', 22, 18, { name: L("Oda's Stall", '奥妲的摊位') })
  m.decor('baskets', 21, 18)
  m.decor('produce', 23, 18)
  m.decor('sack', 21, 16)
  m.decor('jar', 22, 16)
  m.anchor('oda.stall', 22, 20)
  m.path([[shopDoor[0], shopDoor[1] + 1], [shopDoor[0], 21]], 'path', 1)

  // ---- the west road to the homestead
  m.path([[25, 20], [19, 21], [11, 22], [3, 22], [-1, 22]], 'path', 2, { edge: 'dirt', edgeP: 0.3 })
  m.anchor('road.west', 6, 22)
  m.fixture('fixture/sign', 4, 20, { props: { text: 'West: the old Ashby homestead · 西：阿什比老宅' } })

  // ---- the Hearth Inn (north-east of the square): tables outside, a stable
  const innDoor = m.house('inn', 39, 8, 'inn')
  m.path([[innDoor[0], innDoor[1] + 1], [39, 15], [37, 17]], 'path', 1)
  m.fixture('fixture/furniture/table', 42, 14, { name: L('Outdoor Table', '室外桌') })
  m.fixture('fixture/furniture/bench', 41, 14)
  m.fixture('fixture/furniture/bench', 43, 14)
  m.anchor('inn.tables', 43, 15)
  m.fixture('fixture/nature/haystack', 44, 10)
  m.decor('sheaf', 45, 11)
  m.decor('tub', 44, 12)
  m.decor('sack', 43, 9)
  m.anchor('inn.stable', 45, 13)
  m.decor('logs', 38, 12, true)
  m.decor('bucket', 43, 12)

  // ---- the smithy (east): a yard of ore and a quench trough by the river
  const smithyDoor = m.house('smithy', 43, 16, 'smithy')
  m.decor('rocks', 46, 15, true)
  m.decor('rocks', 46, 16, true)
  m.decor('pebbles', 46, 17)
  m.fixture('fixture/water/trough', 46, 19, { name: L('Quench Trough', '淬火槽') })
  m.fixture('fixture/dummy', 41, 19, { name: L('Practice Post', '练习木桩') })
  m.decor('workbench', 41, 17, true)
  m.anchor('smithy.yard', 42, 20)
  m.anchor('smithy.trough', 45, 20)

  // ---- the east road and the washed-out bridge; the east meadow beyond
  m.path([[38, 20], [43, 21], [47, 21]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.path([[51, 21], [57, 20], [64, 20]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.decor('planks', 46, 23)
  m.decor('planks', 51, 23)
  m.decor('log', 45, 22)
  m.fixture('fixture/sign', 44, 23, { props: { text: 'East bridge — washed out. · 东桥——被冲垮了。' } })
  m.anchor('road.east', 44, 21)
  // the east meadow beyond the bridge: wildflowers and a few old trees
  m.sprinkle('flowers', 0.35, (_x, _y, t) => grassy(t), [53, 18, 9, 16])
  m.sprinkle('sunflowers', 0.05, (_x, _y, t) => grassy(t), [53, 18, 9, 16])
  for (const [x, y] of [[56, 24], [60, 29], [54, 31]]) m.set(x, y, 'tree')
  m.decor('rocks', 58, 21, true)
  for (let x = 52; x < 62; x++) if (m.get(x, 15) === 'grass') m.set(x, 15, rng.chance(0.3) ? 'bush' : 'tree')
  for (let x = 52; x < 62; x++) if (m.get(x, 16) === 'grass' && rng.chance(0.6)) m.set(x, 16, 'tree')

  // ---- the old mill across the mill bridge (north-east), its wheel stopped
  const millDoor = m.house('longhouse', 56, 3, 'mill')
  for (let x = 48; x <= 56; x++) for (const y of [11, 12]) if (m.get(x, y) === 'water') m.set(x, y, 'bridge')
  m.path([[46, 12], [49, 12]], 'path', 1)
  m.path([[54, 12], [57, 11], [millDoor[0], millDoor[1] + 1]], 'path', 1)
  m.path([[46, 12], [44, 14], [41, 15]], 'path', 1)
  m.decor('sack', 55, 9)
  m.decor('sack', 60, 9)
  m.decor('log_v', 54, 7)
  const deck = [48, 49, 50, 51, 52, 53, 54, 55, 56].filter((x) => m.get(x, 12) === 'bridge')
  m.anchor('mill.bridge', deck[Math.floor(deck.length / 2)], 12)
  m.anchor('mill.wheel', 55, 10)

  // ---- the hay field and the campfire by it (south-east of the square)
  m.organic(38.5, 30, 4.5, 3, 'drygrass', { rough: 0.3, only: grassy })
  m.fixture('fixture/nature/haystack', 37, 29)
  m.fixture('fixture/nature/haystack', 40, 31)
  m.fixture('fixture/nature/haystack', 38, 32)
  m.fixture('fixture/light/campfire', 35, 24, { statuses: { lit: -1 } })
  m.fixture('fixture/nature/logpile', 33, 25)
  m.decor('log', 34, 25)
  m.anchor('inn.campfire', 36, 24)

  // ---- the pond: Fenn's shack and dock
  const shackDoor = m.house('hut_straw', 40, 35, 'shack')
  for (let x = 43; x <= 47; x++) if (m.get(x, 34) === 'water' || m.get(x, 34) === 'deepwater') m.set(x, 34, 'bridge')
  m.anchor('pond.dock', 47, 34)
  m.decor('rope', 38, 36)
  m.decor('tub', ...spot(m, 43, 38))
  m.decor('bucket', 39, 38)
  m.fixture('fixture/container/barrel', 39, 37, { name: L("Fenn's Bait Barrel", '老芬的鱼饵桶') }, ['item/food/fish/raw'])
  m.anchor('fenn.porch', shackDoor[0], shackDoor[1] + 1)
  m.anchor('pond.shore', ...spot(m, 46, 29))
  m.decor('shells', ...spot(m, 45, 30))

  // ---- Hollis's farm (south-west): farmhouse, barn, coop run, fenced fields, scarecrow
  const farmDoor = m.house('house_thatch', 5, 25, 'farmhouse')
  const barnDoor = m.house('house_red', 11, 25, 'barn')
  m.yard(16, 25, 5, 4, 'rail', [[18, 28]])
  m.fixture('fixture/nature/haystack', 17, 26)
  m.decor('sheaf', 19, 26)
  m.decor('tub', 18, 27)
  m.anchor('farm.coop', 18, 29)
  m.yard(4, 30, 15, 9, 'rail', [[11, 30]])
  m.rect(5, 31, 13, 7, 'farmland')
  m.fixture('fixture/scarecrow', 11, 34, { id: 'scarecrow', name: L('Scarecrow', '稻草人') })
  for (let y = 31; y <= 37; y++)
    for (let x = 5; x <= 17; x++) {
      if (y === 34) continue // a walking row
      const plant = x < 9 ? 'wheat' : x < 14 ? 'herb' : 'berry'
      const stage = rng.pick(['sprout', 'young', 'young', 'ripe', 'bare'])
      if (stage !== 'bare') m.fixture(`fixture/crop/${plant}/${stage}`, x, y)
    }
  m.path([[farmDoor[0], farmDoor[1] + 1], [9, 29], [barnDoor[0], barnDoor[1] + 1], [14, 29], [15, 25], [15, 22]], 'path', 1)
  m.decor('tools', 10, 28)
  m.decor('bucket', 9, 27)
  m.decor('logs', 10, 26, true)
  m.anchor('farm.fields', 12, 34)
  m.anchor('farm.barn', barnDoor[0], barnDoor[1] + 1)
  m.anchor('farm.scarecrow', 11, 35)
  for (const [x, y] of [[7, 33], [14, 32], [16, 36]]) m.creature('slime/green_slime', x, y, { hostile: false, sight: 4 })

  // ---- Sera's cottage at the woods' edge (south): herb garden, hives, drying racks
  const seraDoor = m.house('cabin', 22, 39, 'sera')
  m.yard(17, 39, 4, 5, 'rail', [[20, 41]])
  m.rect(18, 40, 2, 3, 'farmland')
  for (const [x, y] of [[18, 40], [19, 40], [18, 41], [19, 42]]) m.fixture(`fixture/crop/herb/${rng.pick(['young', 'ripe'])}`, x, y)
  m.fixture('fixture/nature/beehive', 26, 39)
  m.fixture('fixture/nature/beehive', 27, 40)
  m.decor('sheaf', 25, 42)
  m.decor('sheaf', 26, 42)
  m.decor('potted', 21, 41)
  m.anchor('sera.garden', 21, 43)
  m.anchor('sera.hives', 26, 41)
  m.path([[seraDoor[0], seraDoor[1] + 1], [25, 43], [29, 40]], 'path', 1)

  // ---- the south gate: palisade, gate, gatehouse
  for (let x = 17; x <= 45; x++) m.set(x, 44, 'grass')
  m.fence('fence', [17, 44], [29, 44])
  m.fence('fence', [33, 44], [45, 44])
  m.scenery('gate', 30, 43)
  const gateDoor = m.house('house_wood', 34, 40, 'gatehouse')
  m.anchor('gate.south', 31, 42)
  m.anchor('gate.tower', 37, 43)
  m.fixture('fixture/light/lamppost', 29, 42, { statuses: { lit: -1 } })
  m.decor('logs', 37, 41, true)
  void gateDoor
  m.path([[32, 24], [31, 30], [31, 38], [31, 48]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })

  // paths from doors
  m.path([[elderDoor[0], elderDoor[1] + 1], [26, 10], [30, 13]], 'path', 1)
  m.path([[smithyDoor[0], smithyDoor[1] + 1], [44, 20]], 'path', 1)
  m.path([[shackDoor[0], shackDoor[1] + 1], [38, 38], [32, 36]], 'path', 1)

  // trees that frame and shade
  // ---- homes that show their owners: yards, hedges, an orchard
  // Maren's front path with flowers, a bench by her door
  for (const y of [7, 8]) (m.decor('flowers', elderDoor[0] - 1, y), m.decor('flowers', elderDoor[0] + 1, y))
  m.fixture('fixture/furniture/bench', 22, 7)
  m.fixture('fixture/light/lamppost', 27, 9, { statuses: { lit: -1 } })
  // Hollis's orchard (west), in rows
  for (let y = 12; y <= 16; y += 2) for (let x = 4; x <= 12; x += 3) m.decor('fruit_tree', x + (y % 4 === 0 ? 1 : 0), y, true)
  m.yard(2, 11, 13, 8, 'rail', [[8, 18], [14, 14]])
  m.anchor('orchard', 8, 17)
  // Oda's: crates and barrels stacked by the store, a sign
  m.decor('produce', 16, 18, true)
  m.decor('jar', 16, 17, true)
  m.fixture('fixture/container/barrel', 21, 17, {}, ['item/food/apple', 'item/food/apple'])
  m.fixture('fixture/sign', 20, 20, { props: { text: "ODA'S GOODS — fair prices, mostly. · 奥妲杂货——价格公道，大体上。" } })
  // the inn's terrace: a rail around the tables, lanterns
  m.fence('rail', [40, 13], [40, 13])
  m.fence('rail', [45, 14], [45, 15])
  m.decor('lantern_post', 44, 15)
  m.decor('logs', 42, 12, true)
  // a hedge along the west road's north side, with gaps
  for (let x = 3; x <= 14; x++) if (x % 5 !== 2 && m.free(x, 20)) m.set(x, 20, 'bush')
  // lamps along the roads
  for (const [x, y] of [[13, 23], [24, 26], [44, 22], [31, 33], [8, 28]]) if (m.free(x, y)) m.fixture('fixture/light/lamppost', x, y, { statuses: { lit: -1 } })
  // Brann's yard: firewood
  m.decor('logs', 47, 17, true)
  copse(m, 21.5, 11, 1.8, 0.7)
  copse(m, 8, 41, 2.5, 0.7)
  copse(m, 14, 26, 1.2, 0.6)
  copse(m, 27, 37, 1.8, 0.6)
  copse(m, 49, 41, 2, 0.6)
  copse(m, 47, 6, 2.2, 0.6)
  copse(m, 14, 13, 1.6, 0.6)
  copse(m, 3, 15, 2, 0.7)
  copse(m, 26, 33, 2, 0.55)
  copse(m, 22, 28, 1.5, 0.6)
  copse(m, 44, 40, 1.5, 0.6)
  for (const [x, y] of [[24, 12], [42, 4], [16, 21], [27, 27], [45, 26]]) if (m.free(x, y)) m.set(x, y, 'tree')
  detail(m)
}

// =================================================================== the homestead

const homestead = new MapBuilder('hearthvale.homestead', L('Ashby Homestead', '阿什比老宅'), 'village', 36, 28, 'grass', 'village')
{
  const m = homestead
  forestEdge(m, 2, [[33, 11, 3, 4]], 0.3)
  const door = m.house('house_orange', 6, 4, 'cottage')
  m.path([[door[0], door[1] + 1], [10, 9], [20, 12], [36, 12]], 'path', 2, { edge: 'dirt', edgeP: 0.4 })
  m.fixture('fixture/water/well', 11, 6)
  m.fixture('fixture/container/crate', 10, 7, { name: L('Shipping Crate', '出货箱'), props: { capacity: 12 } })
  m.fixture('fixture/nature/logpile', 4, 8)
  m.decor('stump', 3, 8, true)
  m.fixture('fixture/furniture/washing_line', 14, 5)
  m.decor('bucket', 9, 7)
  // the overgrown plot behind a fallen fence: weeds, stones and stumps to clear
  m.fence('rail', [13, 14], [31, 14], [[15, 14], [16, 14], [21, 14], [22, 14], [23, 14], [28, 14]])
  m.fence('rail', [13, 15], [13, 24], [[18, 15], [13, 19], [13, 20]])
  m.fence('rail', [13, 25], [31, 25], [[17, 25], [18, 25], [24, 25], [25, 25], [26, 25]])
  m.organic(22, 19.5, 7, 4, 'drygrass', { rough: 0.35, only: grassy })
  for (let y = 15; y <= 24; y++)
    for (let x = 14; x <= 30; x++) {
      if (!m.free(x, y)) continue
      const r = rng.next()
      if (r < 0.1) m.set(x, y, 'bush')
      else if (r < 0.15) m.set(x, y, 'rock')
      else if (r < 0.19) m.set(x, y, 'stump')
      else if (r < 0.24) m.item(rng.pick<ItemSpec>(['item/material/stick', 'item/material/stone', 'item/material/stick']), x, y)
    }
  m.organic(5, 21, 2.6, 2, 'water', { rough: 0.2 })
  m.decor('shells', 7, 22)
  m.anchor('homestead.gate', 32, 13)
  m.anchor('homestead.door', door[0], door[1] + 1)
  copse(m, 27, 6, 2.5, 0.6)
  detail(m, 1.2)
}

// =================================================================== interiors

function interior(id: string, name: Text, w: number, h: number, floor = 'floor_wood', style = 'wood', music = 'interior') {
  const m = new MapBuilder(id, name, 'interior', w, h, floor, music, 'indoor')
  m.room(style, floor)
  return m
}

const cottage = interior('hearthvale.cottage', L('Your Cottage', '你的小屋'), 11, 8)
{
  const m = cottage
  m.fixture('fixture/furniture/bed', 1, 1)
  m.fixture('fixture/container/chest', 3, 1, { name: L('Old Chest', '旧箱子') }, [
    'item/food/bread',
    'item/food/apple',
    { form: 'item/tool/hoe', material: 'iron' },
    { form: 'item/weapon/blade/axe', material: 'iron' },
    { form: 'item/tool/pickaxe', material: 'iron' },
    'item/seed/wheat',
    'item/seed/wheat',
    'item/tool/flint',
  ])
  m.fixture('fixture/light/fireplace', 8, 1)
  m.fixture('fixture/furniture/table', 5, 4)
  m.fixture('fixture/furniture/chair', 4, 4)
  m.fixture('fixture/container/shelf', 9, 3, {}, ['item/vessel/cup', 'item/vessel/plate', 'item/light/candle'])
  m.item('item/vessel/bucket/empty', 9, 5)
  m.item('item/tool/broom', 1, 5)
  m.decor('logs', 7, 1)
  m.decor('jar', 9, 1)
  m.anchor('cottage.bed', 1, 1)
}

const elder = interior('hearthvale.elder', L("The Elder's House", '村长家'), 13, 9, 'floor_wood', 'plaster')
{
  const m = elder
  m.rect(4, 4, 5, 3, 'carpet')
  m.fixture('fixture/furniture/bed', 1, 1, { name: L("Maren's Bed", '玛伦的床') })
  m.fixture('fixture/furniture/bed', 1, 5, { name: L("Mira's Bed", '米拉的床') })
  m.fixture('fixture/container/bookshelf', 4, 1, {}, ['item/document/book', 'item/document/book', 'item/document/map'])
  m.fixture('fixture/container/bookshelf', 5, 1, {}, ['item/document/book', { form: 'item/document/scroll', element: 'fire' }])
  m.fixture('fixture/light/fireplace', 11, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 6, 5)
  m.fixture('fixture/furniture/chair', 5, 5)
  m.fixture('fixture/furniture/chair', 7, 5)
  m.fixture('fixture/furniture/chair', 10, 4, { name: L("Maren's Chair", '玛伦的椅子') })
  // Mira's desk: the Threadbook lives here
  m.fixture('fixture/furniture/table', 9, 1, { name: L("Mira's Desk", '米拉的书桌') })
  m.fixture('fixture/furniture/chair', 9, 2)
  m.item({ form: 'item/document/scroll', name: L("Mira's Notes on the Weave", '米拉的织理笔记') }, 9, 1)
  m.item({ form: 'item/weapon/magic/wand', element: 'fire', material: 'wood', name: L('Ember Wand', '余烬魔杖') }, 7, 1)
  m.fixture('fixture/light/candles', 8, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/container/pot', 11, 6, {}, ['item/material/herb', 'item/material/herb'])
  m.decor('potted', 3, 1)
  m.anchor('maren.bed', 1, 1)
  m.anchor('mira.bed', 1, 5)
  m.anchor('mira.desk', 9, 2)
  m.anchor('elder.shelf', 4, 2)
  m.anchor('elder.table', 5, 5)
  m.anchor('maren.chair', 10, 4)
  m.anchor('elder.hearth', 11, 2)
}

const inn = interior('hearthvale.inn', L('The Hearth Inn', '炉火旅店'), 19, 12)
{
  const m = inn
  // family rooms (east): the family upstairs-in-spirit, guests below
  m.partition('wood', 12, 0, 7, 6, [[12, 3]])
  m.partition('wood', 12, 5, 7, 7, [[12, 8]])
  m.fixture('fixture/furniture/bed', 13, 1, { name: L("Lio and Tamsin's Bed", '里奥和塔姆辛的床') })
  m.fixture('fixture/furniture/bed', 14, 1, { name: L("Lio and Tamsin's Bed", '里奥和塔姆辛的床') })
  m.fixture('fixture/furniture/bed', 16, 1, { name: L("Wren's Bed", '雷恩的床') })
  m.fixture('fixture/furniture/bed', 17, 1, { name: L("Pip's Bed", '皮普的床') })
  m.item({ form: 'item/material/stick', name: L("Pip's Sword", '皮普的剑') }, 17, 3)
  m.item('item/misc/doll', 16, 3)
  m.fixture('fixture/furniture/bed', 13, 7, { name: L('Guest Bed', '客床') })
  m.fixture('fixture/furniture/bed', 16, 7, { name: L('Guest Bed', '客床') })
  m.fixture('fixture/container/chest', 17, 10, {}, ['item/material/cloth', 'item/light/candle'])
  // the common room
  m.rect(3, 6, 7, 4, 'carpet')
  for (let x = 2; x <= 5; x++) m.fixture('fixture/furniture/counter', x, 3)
  m.fixture('fixture/container/barrel', 1, 1, {}, ['item/food/ale', 'item/food/ale', 'item/food/wine'])
  m.fixture('fixture/container/barrel', 2, 1, {}, ['item/food/ale', 'item/food/wine'])
  m.fixture('fixture/container/shelf', 4, 1, {}, ['item/food/bread', 'item/food/cheese', 'item/food/pie', 'item/vessel/cup', 'item/vessel/cup'])
  m.fixture('fixture/light/fireplace', 7, 1, { name: L('The Old Oven', '旧烤炉'), statuses: { lit: -1 } })
  m.fixture('fixture/craft/cauldron', 8, 1, { name: L('Stew Pot', '炖锅') })
  m.fixture('fixture/light/fireplace', 10, 1, { name: L('Inn Hearth', '旅店壁炉'), statuses: { lit: -1 } })
  for (const [tx, ty, n] of [[3, 7, 1], [7, 7, 2], [7, 9, 3]] as const) {
    m.fixture('fixture/furniture/table', tx, ty)
    m.fixture('fixture/furniture/chair', tx - 1, ty)
    m.fixture('fixture/furniture/chair', tx + 1, ty)
    m.anchor(`inn.table${n}`, tx - 1, ty)
  }
  m.fixture('fixture/furniture/chair', 1, 10, { name: L('Corner Seat', '角落的座位') })
  m.decor('potted', 11, 10)
  m.decor('jar', 1, 4)
  m.decor('sack', 9, 3)
  m.anchor('inn.bar', 4, 4)
  m.anchor('inn.kitchen', 8, 2)
  m.anchor('inn.hearth', 10, 3)
  m.anchor('inn.corner', 1, 10)
  m.anchor('inn.bed.lio', 13, 1)
  m.anchor('inn.bed.tamsin', 14, 1)
  m.anchor('inn.bed.wren', 16, 1)
  m.anchor('inn.bed.pip', 17, 1)
  m.anchor('inn.guest', 13, 7)
}

const shop = interior('hearthvale.shop', L("Oda's Goods", '奥妲杂货铺'), 13, 9)
{
  const m = shop
  const stock: ItemSpec[][] = [
    ['item/vessel/flask/empty', 'item/vessel/flask/empty', 'item/vessel/flask/oil', 'item/vessel/flask/oil', 'item/vessel/flask/water'],
    ['item/light/torch', 'item/light/torch', 'item/light/lantern', 'item/tool/flint', 'item/light/candle'],
    ['item/tool/rope', 'item/tool/rope', 'item/tool/shovel', 'item/tool/fishing_rod', 'item/vessel/bucket/empty'],
    ['item/food/bread', 'item/food/cheese', 'item/food/honey', 'item/material/salt', 'item/potion/healing'],
  ]
  stock.forEach((s, i) => m.fixture('fixture/container/shelf', 1 + i * 2, 1, {}, s))
  for (let x = 2; x <= 7; x++) m.fixture('fixture/furniture/counter', x, 4)
  m.fixture('fixture/container/crate', 1, 6, {}, ['item/material/log', 'item/material/plank', 'item/material/coal'])
  m.fixture('fixture/container/barrel', 2, 7, {}, ['item/material/iron_ore', 'item/material/iron_ore'])
  m.decor('sack', 7, 7)
  m.decor('baskets', 8, 6)
  // Oda's back room
  m.partition('wood', 9, 0, 4, 9, [[9, 6]])
  m.fixture('fixture/furniture/bed', 11, 1, { name: L("Oda's Bed", '奥妲的床') })
  m.fixture('fixture/furniture/table', 11, 4)
  m.fixture('fixture/furniture/chair', 10, 4)
  m.fixture('fixture/container/chest', 11, 7, { tags: ['locked'], name: L("Oda's Strongbox", '奥妲的钱箱') }, ['item/valuable/coin_pouch', { form: 'item/valuable/amulet', material: 'silver', name: L('A Tarnished Locket', '一枚失色的吊坠') }])
  m.anchor('shop.counter', 5, 3)
  m.anchor('shop.shelves', 3, 2)
  m.anchor('oda.bed', 11, 1)
  m.anchor('oda.table', 10, 4)
}

const smithy = interior('hearthvale.smithy', L("Brann's Smithy", '布兰铁匠铺'), 13, 9, 'floor_stone', 'stone')
{
  const m = smithy
  m.fixture('fixture/craft/forge', 1, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/craft/anvil', 3, 3)
  m.fixture('fixture/water/trough', 1, 4)
  m.fixture('fixture/container/shelf', 5, 1, {}, [{ form: 'item/weapon/blade/sword', material: 'iron', name: L('Practice Blade', '练习剑') }, { form: 'item/weapon/blade/dagger', material: 'iron' }])
  m.fixture('fixture/container/shelf', 7, 1, {}, [{ form: 'item/weapon/blade/axe', material: 'iron' }, { form: 'item/tool/pickaxe', material: 'iron' }, { form: 'item/tool/smith_hammer', material: 'iron' }])
  m.fixture('fixture/container/barrel', 9, 4, {}, ['item/material/coal', 'item/material/coal', 'item/material/iron_ore'])
  // the unfinished blade, on its own rack
  m.fixture('fixture/container/shelf', 9, 1, { name: L('A Covered Rack', '盖着布的架子') }, [{ form: 'item/weapon/blade/sword', material: 'steel', quality: 'fine', name: L('Unfinished Blade', '未完成的剑') }])
  m.fixture('fixture/furniture/bed', 11, 1)
  m.fixture('fixture/furniture/table', 10, 6)
  m.fixture('fixture/furniture/chair', 9, 6)
  m.decor('tools', 6, 4)
  m.decor('logs', 2, 7, true)
  m.anchor('smithy.anvil', 4, 3)
  m.anchor('smithy.forge', 2, 2)
  m.anchor('brann.bed', 11, 1)
  m.anchor('brann.table', 9, 6)
}

const farmhouse = interior('hearthvale.farmhouse', L("Hollis's Farmhouse", '霍利斯的农舍'), 11, 8)
{
  const m = farmhouse
  m.fixture('fixture/furniture/bed', 1, 1, { name: L("Hollis's Bed", '霍利斯的床') })
  m.fixture('fixture/furniture/bed', 1, 4, { name: L('A made bed, long unslept in', '一张铺好的床，很久没人睡了') })
  m.fixture('fixture/light/fireplace', 8, 1, { name: L('Stove', '炉灶'), statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 5, 4)
  m.fixture('fixture/furniture/chair', 4, 4)
  m.fixture('fixture/furniture/chair', 6, 4)
  m.fixture('fixture/container/shelf', 3, 1, {}, ['item/seed/wheat', 'item/seed/herb', 'item/seed/berry', 'item/food/cheese'])
  m.fixture('fixture/container/sack', 9, 5, {}, ['item/material/wheat', 'item/material/wheat'])
  m.decor('tools', 9, 3)
  m.decor('baskets', 5, 1)
  m.anchor('hollis.bed', 1, 1)
  m.anchor('hollis.table', 4, 4)
  m.anchor('hollis.stove', 8, 2)
}

const barn = interior('hearthvale.barn', L("Hollis's Barn", '霍利斯的谷仓'), 11, 7, 'floor_wood', 'wood', 'interior')
{
  const m = barn
  m.fixture('fixture/nature/haystack', 1, 1)
  m.fixture('fixture/nature/haystack', 2, 1)
  m.fixture('fixture/furniture/cart', 8, 2)
  m.fixture('fixture/container/sack', 5, 1, {}, ['item/seed/wheat', 'item/seed/wheat'])
  m.decor('sheaf', 3, 1)
  m.decor('tools', 6, 1)
  m.decor('bucket', 9, 4)
  m.item({ form: 'item/tool/sickle', material: 'iron' }, 4, 3)
}

const mill = interior('hearthvale.mill', L('The Old Mill', '老磨坊'), 11, 9, 'floor_stone', 'stone')
{
  const m = mill
  m.fixture('fixture/craft/workbench', 5, 3, { name: L('The Millstone', '磨盘'), props: { text: 'The stone is still. Flour dust lies thick on it. · 磨盘一动不动，上面积着厚厚的面粉灰。' } })
  m.fixture('fixture/container/sack', 1, 1, {}, ['item/material/wheat'])
  m.fixture('fixture/container/sack', 2, 1)
  m.decor('sack', 9, 1)
  m.decor('planks', 8, 6)
  m.decor('rope', 1, 6)
}

const sera = interior('hearthvale.sera', L("Sera's Cottage", '塞拉的小屋'), 11, 8, 'floor_wood', 'moss')
{
  const m = sera
  m.fixture('fixture/furniture/bed', 9, 1, { name: L("Sera's Bed", '塞拉的床') })
  m.fixture('fixture/craft/cauldron', 1, 1, { name: L('The Still', '蒸馏锅') })
  m.fixture('fixture/furniture/table', 5, 4)
  m.fixture('fixture/furniture/chair', 4, 4)
  m.fixture('fixture/container/bookshelf', 6, 1, {}, [{ form: 'item/document/book', name: L('The Physick of Valleys', '山谷医典') }, 'item/document/book'])
  m.fixture('fixture/container/pot', 3, 1, {}, ['item/material/herb', 'item/material/herb', 'item/material/fireweed'])
  m.fixture('fixture/container/shelf', 9, 5, {}, ['item/potion/healing', 'item/potion/antidote', 'item/vessel/flask/empty'])
  m.decor('sheaf', 7, 1)
  m.decor('potted', 1, 5)
  m.decor('jar', 4, 1)
  m.anchor('sera.bed', 9, 1)
  m.anchor('sera.still', 2, 2)
  m.anchor('sera.table', 4, 4)
}

const shack = interior('hearthvale.shack', L("Fenn's Shack", '老芬的小棚屋'), 9, 7)
{
  const m = shack
  m.fixture('fixture/furniture/bed', 1, 1, { name: L("Fenn's Cot", '老芬的小床') })
  m.fixture('fixture/light/fireplace', 6, 1, { name: L('Stove', '炉子'), statuses: { lit: -1 } })
  m.fixture('fixture/container/barrel', 7, 4, {}, ['item/food/fish/raw', 'item/food/fish/raw', 'item/material/salt'])
  m.fixture('fixture/container/chest', 1, 4, { name: L('A Sea Chest', '旧航海箱') }, [{ form: 'item/document/letter', name: L('An Unsent Letter', '一封没寄出的信') }])
  m.decor('rope', 3, 1)
  m.decor('tub', 4, 4)
  m.anchor('fenn.bed', 1, 1)
  m.anchor('fenn.stove', 6, 2)
}

const gatehouse = interior('hearthvale.gatehouse', L('The Gatehouse', '门房'), 9, 7, 'floor_stone', 'stone')
{
  const m = gatehouse
  m.fixture('fixture/furniture/bed', 1, 1, { name: L("Garrick's Bed", '加里克的床') })
  m.fixture('fixture/furniture/table', 5, 3)
  m.fixture('fixture/furniture/chair', 4, 3)
  m.fixture('fixture/container/shelf', 7, 1, {}, [{ form: 'item/weapon/polearm/spear', material: 'iron' }, { form: 'item/armor/shield', material: 'wood' }])
  m.fixture('fixture/light/candles', 5, 1, { statuses: { lit: -1 } })
  m.decor('bucket', 7, 5)
  m.anchor('garrick.bed', 1, 1)
  m.anchor('garrick.table', 4, 3)
}

// =================================================================== Whisperwood

const wood = new MapBuilder('whisperwood', L('Whisperwood', '低语森林'), 'wild', 56, 40, 'grass', 'forest')
{
  const m = wood
  m.border('tree', 2, [[22, 0, 4, 2]])
  // forest mass in the west and north-east
  for (let y = 2; y < 38; y++)
    for (let x = 2; x < 54; x++) {
      const west = x < 17 && !(y > 24 && x > 4)
      const ne = x > 44 && y < 14
      if ((west || ne) && rng.chance(0.55)) m.set(x, y, rng.chance(0.25) ? 'pine' : 'tree')
      else if ((west || ne) && rng.chance(0.2)) m.set(x, y, 'bush')
    }
  // the road south from the village to the cave
  m.path([[23, 0], [24, 8], [27, 16], [34, 19], [44, 21], [46, 27], [46, 33]], 'path', 2, { edge: 'dirt', edgeP: 0.3 })
  // a stream from the north-east into the lake
  m.path([[38, 1], [35, 5], [36, 10], [34, 15], [35, 20]], 'water', 2)
  m.organic(35, 25, 6.5, 4.5, 'water', { rough: 0.25 })
  m.organic(35, 25.3, 3.5, 2.2, 'deepwater', { rough: 0.2, only: (c) => c === 'water' })
  for (let x = 30; x <= 40; x++) for (const y of [8, 9]) if (m.get(x, y) === 'water') m.set(x, y, 'bridge')
  // the burnt clearing: what fire does to the woods
  m.organic(22, 8, 4, 3, 'ash', { rough: 0.3 })
  for (const [x, y] of [[19, 6], [20, 10], [18, 8], [28, 7]]) m.set(x, y, 'charred_tree')
  m.item('item/material/fireweed', 22, 8)
  m.item('item/material/fireweed', 25, 7)
  // dry meadow with a camp (south-west)
  m.rect(6, 27, 16, 9, 'drygrass')
  m.fixture('fixture/nature/haystack', 9, 29)
  m.fixture('fixture/nature/haystack', 17, 33)
  m.fixture('fixture/light/campfire', 20, 24)
  m.fixture('fixture/nature/logpile', 21, 23)
  m.fixture('fixture/container/sack', 18, 23, {}, ['item/food/bread', { form: 'item/food/meat/raw' }, 'item/tool/flint'])
  m.decor('log', 19, 26)
  // cave mouth (south-east): rocks around stairs down
  m.rect(44, 34, 6, 3, 'rock')
  m.set(46, 35, 'stairs_down')
  m.set(46, 34, 'path')
  for (const [x, y] of [[42, 31], [50, 30], [40, 34], [52, 35]]) m.set(x, y, 'rock')
  // natural things to find
  for (const [x, y] of [[8, 6], [12, 12], [5, 18], [14, 22], [10, 9]]) if (grassy(m.get(x, y))) m.item(rng.pick(['item/food/mushroom/raw', 'item/material/herb', 'item/food/berries']), x, y)
  for (let i = 0; i < 18; i++) {
    const x = rng.int(3, 52)
    const y = rng.int(3, 36)
    if (grassy(m.get(x, y)) && m.free(x, y)) m.item(rng.pick(['item/material/stick', 'item/material/stone', 'item/material/herb', 'item/food/berries', 'item/food/mushroom/raw', 'item/material/fireweed']), x, y)
  }
  m.fixture('fixture/nature/beehive', 18, 5)
  m.fixture('fixture/nature/mushroom_ring', 12, 25)
  m.fixture('fixture/nature/boulder', 28, 12)
  m.fixture('fixture/sign', 25, 3, { props: { text: 'North: Hearthvale · South-east: Slime Hollow · 北：炉谷 · 东南：史莱姆洞窟' } })
  m.anchor('wood.herbs', ...spot(m, 19, 14))
  m.anchor('wood.lake', ...spot(m, 28, 25))
  m.anchor('wood.camp', ...spot(m, 19, 25))
  // creatures
  for (const [x, y] of [[26, 29], [28, 33], [30, 16]]) m.creature('slime/green_slime', x, y, { hostile: false })
  for (const [x, y] of [[14, 30], [11, 33]]) m.creature('slime/fire_slime', x, y, { hostile: false })
  for (const [x, y] of [[41, 23], [30, 29]]) m.creature('slime/frost_slime', x, y, { hostile: false })
  for (const [x, y] of [[37, 6], [33, 13]]) m.creature('slime/spark_slime', x, y, { hostile: false })
  m.creature('slime/water_slime', 39, 29, { hostile: false })
  for (const [x, y] of [[9, 14], [13, 4], [48, 9]]) m.creature('beast/boar', x, y, { sight: 5, loot: ['item/food/meat/raw'] })
  for (const [x, y] of [[43, 31], [49, 32]]) m.creature('beast/bat', x, y, { sight: 5 })
  detail(m, 0.8)
}

// =================================================================== Slime Hollow

const cave = new MapBuilder('slime_hollow', L('Slime Hollow', '史莱姆洞窟'), 'dungeon', 38, 26, 'cave_wall', 'cave', 'dark')
{
  const m = cave
  const room = (x: number, y: number, w: number, h: number) => m.rect(x, y, w, h, 'cave_floor')
  room(3, 2, 8, 7) // entry
  room(15, 2, 11, 8) // hall
  room(3, 13, 10, 9) // pool room
  room(18, 13, 16, 10) // boss den
  m.road(10, 5, 15, 5, 'cave_floor', 2)
  m.road(6, 8, 6, 13, 'cave_floor', 2)
  m.road(25, 9, 25, 13, 'cave_floor', 2)
  m.road(12, 17, 18, 17, 'cave_floor', 2)
  m.set(6, 2, 'stairs_up')
  m.blob(7.5, 17.5, 2.6, 2.2, 'water')
  // entry
  m.fixture('fixture/light/brazier', 4, 3, { statuses: { lit: -1 } })
  m.fixture('fixture/light/brazier', 9, 3, { statuses: { lit: -1 } })
  m.item('item/light/torch', 5, 6)
  // hall
  m.fixture('fixture/container/pot', 16, 3, {}, ['item/key', 'item/material/bone'])
  for (const [x, y] of [[17, 3], [24, 8]]) m.fixture('fixture/container/pot', x, y, {}, [rng.pick<ItemSpec>(['item/valuable/coin_pouch', 'item/potion/healing', 'item/material/bone', 'item/gem'])])
  m.fixture('fixture/container/crate', 22, 3, {}, ['item/vessel/flask/oil', 'item/vessel/flask/oil'])
  m.fixture('fixture/container/barrel', 23, 3, {}, ['item/vessel/bucket/water'])
  m.item('item/misc/skull', 19, 7)
  m.item('item/material/bone', 20, 8)
  m.fixture('fixture/light/brazier', 20, 3, { statuses: { lit: -1 } })
  for (const [x, y] of [[18, 6], [23, 5]]) m.creature('beast/bat', x, y, { sight: 5 })
  m.creature('slime/green_slime', 21, 6)
  // pool room: spark slimes around water — soak them, then shock them
  for (const [x, y] of [[5, 15], [10, 20], [11, 15]]) m.creature('slime/spark_slime', x, y, { sight: 4 })
  m.fixture('fixture/container/chest', 4, 20, { tags: ['locked'], name: L('Old Supply Chest', '旧补给箱') }, [
    { form: 'item/weapon/magic/wand', element: 'lightning', material: 'crystal', quality: 'fine', name: L('Storm Wand', '风暴魔杖') },
    'item/potion/healing',
    'item/potion/healing',
    'item/vessel/bucket/empty',
  ])
  // boss den
  m.creature('slime/king_slime', 26, 18, { sight: 6, id: 'boss.king_slime' })
  for (const [x, y] of [[21, 15], [30, 21], [22, 21]]) m.creature(rng.pick(['slime/green_slime', 'slime/fire_slime', 'slime/frost_slime']), x, y, { sight: 5 })
  m.fixture('fixture/container/chest', 32, 14, { name: L("Slime King's Hoard", '史莱姆王的宝藏') }, [
    { form: 'item/valuable/crown', material: 'gold' },
    'item/valuable/coin_pouch',
    'item/valuable/coin_pouch',
    { form: 'item/gem', element: 'fire' },
  ])
  m.fixture('fixture/light/brazier', 19, 14, { statuses: { lit: -1 } })
  m.fixture('fixture/light/brazier', 32, 21, { statuses: { lit: -1 } })
}

// =================================================================== links

const doorsOf: [string, MapBuilder][] = [
  ['elder', elder],
  ['shop', shop],
  ['inn', inn],
  ['smithy', smithy],
  ['mill', mill],
  ['farmhouse', farmhouse],
  ['barn', barn],
  ['sera', sera],
  ['shack', shack],
  ['gatehouse', gatehouse],
]
for (const [door, room] of doorsOf) town.linkInterior(door, room)
homestead.linkInterior('cottage', cottage)
linkEdge(town, [[0, 22], [0, 23]], [1, 0], homestead, [[35, 12], [35, 13]], [-1, 0])
linkEdge(town, [[31, 47], [32, 47]], [0, -1], wood, [[23, 0], [24, 0]], [0, 1])
wood.portal(46, 35, cave.id, 6, 3, cave.name)
cave.portal(6, 2, wood.id, 46, 34, wood.name)

const maps = [town, homestead, cottage, elder, inn, shop, smithy, farmhouse, barn, mill, sera, shack, gatehouse, wood, cave]

// =================================================================== anchors

const anchors = new Map<string, Pos>()
for (const m of maps)
  for (const [name, [x, y]] of Object.entries(m.anchors)) {
    if (anchors.has(name)) throw new Error(`anchor ${name} defined twice`)
    const t = m.get(x, y)
    if (SOLID.has(t) || m.solid.has(y * m.w + x)) throw new Error(`anchor ${name} at ${m.id} ${x},${y} is not walkable (${t})`)
    anchors.set(name, { map: m.id, x, y })
  }
function at(name: string): Pos {
  const a = anchors.get(name)
  if (!a) throw new Error(`unknown anchor ${name}`)
  return a
}

// =================================================================== people

const START_HOUR = 18

function slots(p: PersonDef, key: string, list: Slot[]): ScheduleEntry[] {
  // the variant must cover the whole day
  const covered = new Array(24).fill(false)
  for (const [from, to] of list) for (let h = from; h !== to; h = (h + 1) % 24) covered[h] = true
  const gap = covered.indexOf(false)
  if (gap >= 0) throw new Error(`${p.id} schedule ${key} leaves hour ${gap} uncovered`)
  return list.map(([from, to, anchor, activity]) => ({ from, to, ...at(anchor), activity }))
}

const npcs: Entity[] = []
for (const p of PEOPLE) {
  const schedule = slots(p, 'default', p.schedules.default)
  const schedules: ScheduleVariant[] = Object.entries(p.schedules).map(([key, list]) => ({ key, entries: slots(p, key, list) }))
  const hourIn = (s: ScheduleEntry, h: number) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)
  const first = schedule.find((s) => hourIn(s, START_HOUR)) ?? schedule[0]
  const e: Entity & { _items?: Entity[] } = {
    id: p.id,
    type: `actor/person/${p.role}`,
    name: p.name,
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    props: { age: p.age },
    npc: {
      role: p.role,
      schedule,
      look: p.look,
      lines: p.lines.filter((l) => l.key === 'default').map((l) => l.text),
      faction: 'hearthvale',
      home: { map: schedule[0].map, x: schedule[0].x, y: schedule[0].y },
      person: { temperament: p.temperament, ties: p.ties, birthday: p.birthday, tastes: p.tastes, lines: p.lines, schedules },
    },
    _items: (p.items ?? []).map((f, i) => ({ ...town.makeItem(f), id: `${p.id}~${i}`, place: { on: 'inside' as const, holder: p.id } })),
  }
  npcs.push(e)
}

// =================================================================== the first week: scenes, letters, weather

const say = (who: string, en: string, zh: string, mood?: 'happy' | 'sad' | 'surprised' | 'angry' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

const scenes: SceneDef[] = [
  {
    // Day 1, dusk: up the south road; the Hearth gutters out as you reach the square.
    id: 'arrival',
    map: 'hearthvale',
    when: { facts: { arrived: { lt: 1 } } },
    script: [
      { place: 'npc.garrick', map: 'hearthvale', x: 31, y: 42 },
      { face: 'npc.garrick', dir: 'down' },
      { wait: 10 },
      say('npc.garrick', "Hold there, traveller. … The Ashby place? Then you're expected. Maren said you'd make it before dark.", '站住，旅人。……阿什比家的？那你是我们等的人。玛伦说你天黑前能到。'),
      say('npc.garrick', 'Straight up the road to the square. You can\'t miss the Hearth.', '顺着路一直走到广场。大炉火你不会错过的。'),
      { move: 'player', x: 31, y: 36 },
      { place: 'npc.maren', map: 'hearthvale', x: 30, y: 22 },
      { move: 'player', x: 32, y: 23 },
      { face: 'player', dir: 'up' },
      { face: 'npc.maren', dir: 'right' },
      say('npc.maren', 'There you are. Welcome to Hearthvale. This is the Great Hearth. It has burned for two hundred winters—', '你来了。欢迎来到炉谷。这是大炉火，它已经烧了两百个冬天——'),
      { status: 'great_hearth', remove: 'lit' },
      { fact: 'hearth.lit', value: 0 },
      { wait: 25 },
      { emote: 'npc.maren', mood: 'surprised' },
      { emote: 'player', mood: 'surprised' },
      { wait: 20 },
      say('npc.maren', '…', '……', 'sad'),
      say('npc.maren', "Well. Not tonight's trouble. Come — your cottage is west, past Oda's. I'll walk you.", '好吧。今晚先不管这个。来——你的小屋在西边，过了奥妲的铺子就是。我送你过去。'),
      { topic: 'hearth_out', days: 6 },
      { fade: 'out' },
      { warp: 'hearthvale.homestead', x: 7, y: 8 },
      { place: 'npc.maren', map: 'hearthvale.homestead', x: 8, y: 8 },
      { face: 'npc.maren', dir: 'left' },
      { fade: 'in' },
      say('npc.maren', "Here. The Ashby homestead. It's been let go, but the roof is sound and the bed is dry.", '到了，阿什比老宅。荒了些，但屋顶结实，床也是干的。'),
      say('npc.maren', "Sleep. In the morning I'll show you the land. … The valley has had worse nights.", '睡吧。明早我带你看看地。……山谷熬过比这更糟的夜晚。'),
      { fact: 'arrived', value: 1 },
    ],
  },
  {
    // Day 2, morning: Maren shows you the land.
    id: 'first_morning',
    map: 'hearthvale.homestead',
    when: { hour: { from: 6, to: 11 }, facts: { arrived: { gte: 1 } } },
    script: [
      { place: 'npc.maren', map: 'hearthvale.homestead', x: 10, y: 9 },
      { face: 'npc.maren', dir: 'left' },
      say('npc.maren', 'Morning. The land was Tomas Ashby\'s. Good soil, under all that.', '早。这块地以前是托马斯·阿什比的。底下是好土，就是被这些盖住了。'),
      say('npc.maren', "There are tools in the chest inside. Clear a little each day; nobody cleared a field in one.", '屋里箱子里有工具。每天清一点就好，没有人一天能开出一块田。'),
      say('npc.maren', 'And go and meet people. They\'ll want to see the newcomer — the Hearth has them worried.', '还有，去见见大家。他们都想看看新来的人——大炉火的事让大家心里不安。'),
      { fact: 'quest.week', value: 1 },
    ],
  },
  {
    // The first Hearth Night: the whole village at the inn, the Hearth cold outside.
    id: 'hearth_night',
    map: 'hearthvale.inn',
    when: { weekday: ['hearthday'], hour: { from: 18, to: 23 }, facts: { 'kindlings.told': { gte: 1 } } },
    script: [
      { wait: 15 },
      say('npc.lio', "Everyone in? Then — welcome to Hearth Night. Same as every week, except one new face, and one cold Hearth. Eat. Nobody pays tonight who can't.", '人都到齐了？那么——欢迎来到炉火之夜。和每周一样，只是多了一张新面孔，少了一堆炉火。吃吧。今晚付不起的人不用付。'),
      say('npc.fenn', 'Did I ever tell you about the pike that took my boot? Fifty years ago, this pond — no, hear me out—', '我讲过那条吞了我靴子的狗鱼没有？五十年前，就这个池塘——不，听我说完——'),
      say('npc.wren', 'Every week. Every single week.', '每周都讲。每、一、周。', 'happy'),
      { emote: 'npc.pip', mood: 'shy' },
      say('npc.maren', "To the Hearth, then. It's been lit two hundred winters by people no better than us. It'll be lit again.", '那就敬大炉火。点着它的人，并不比我们强多少。它会再亮起来的。'),
      say('npc.hollis', 'To the Hearth.', '敬大炉火。'),
      say('npc.sera', 'To the Hearth.', '敬大炉火。'),
      { emote: 'npc.garrick', mood: 'shy' },
      { topic: 'hearth_night', days: 3 },
      { prop: 'quest', value: 11 },
    ],
  },
]

const letters: LetterDef[] = [
  {
    id: 'welcome',
    day: 2,
    from: 'npc.tamsin',
    text: L('Welcome to the valley, neighbour! A loaf to start you off — the oven only smoked a little. Come by the inn for supper. — Tamsin', '欢迎来山谷，邻居！先送你一个面包——烤炉只冒了一点点烟。来旅店吃晚饭呀。——塔姆辛'),
    items: ['item/food/bread'],
  },
  {
    id: 'hollis.seeds',
    fact: 'slimes.driven',
    from: 'npc.hollis',
    text: L("Turnips are safe. You've a good arm. These are spare — plant them before the rain. — Hollis", '萝卜保住了。你手上有劲。这些种子多出来了，趁下雨前种下去。——霍利斯'),
    items: ['item/seed/wheat', 'item/seed/wheat', 'item/seed/herb'],
  },
  {
    id: 'mira.threadbook',
    day: 6,
    from: 'npc.mira',
    text: L("Something odd happened in the valley this week — the kind of odd I write down. Come to the elder's house when you can. — Mira", '这周山谷里发生了点怪事——就是我会记下来的那种怪事。有空来村长家一趟。——米拉'),
  },
  {
    id: 'hearth_night',
    day: 7,
    from: 'npc.lio',
    text: L("Tonight's Hearth Night — the whole village at the inn, from six. First cup's on the house for newcomers. — Lio", '今晚是炉火之夜——全村人都来旅店，六点开始。新来的人第一杯算我的。——里奥'),
  },
]

const weather: Record<number, string> = { 1: 'sun', 2: 'sun', 3: 'cloud', 4: 'sun', 5: 'rain', 6: 'fog', 7: 'sun' }

// =================================================================== write

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'maps'), { recursive: true })
let items = 0
let fixtures = 0
let creatures = 0
const kinds = new Set<string>()
const metas: MapMeta[] = []
for (const m of maps) {
  const c = m.chunk()
  for (const e of c.entities) {
    if (e.type.startsWith('item/')) (items++, kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`))
    else if (e.type.startsWith('fixture/')) fixtures++
    else if (e.type.startsWith('actor/creature')) creatures++
  }
  writeFileSync(join(OUT, 'maps', `${m.id}.json`), JSON.stringify(c))
  metas.push({ id: m.id, name: m.name, kind: m.kind, region: m.region, width: m.w, height: m.h, portals: m.portals, npcs: 0, items: c.entities.filter((e) => e.type.startsWith('item/')).length })
}
for (const n of npcs as (Entity & { _items?: Entity[] })[]) for (const it of n._items ?? []) (items++, kinds.add(`${it.type}|${(it.tags ?? []).join(',')}`))
const lines = PEOPLE.reduce((n, p) => n + p.lines.length, 0)
const index: WorldIndex = {
  name: L('Hearthvale', '炉谷'),
  version: VERSION,
  seed: 4242,
  start: { map: 'hearthvale', x: 31, y: 46 },
  startHour: START_HOUR,
  maps: metas,
  npcs,
  player: {
    id: 'player',
    type: 'actor/person/player',
    name: L('You', '你'),
    place: { on: 'none' },
    facing: 'up',
    look: CATALOG.roles.player?.[0] ?? 'NinjaGreen',
    props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, quest: 0, slimes: 0, energy: 100, maxEnergy: 100 },
  },
  stats: { maps: maps.length, npcs: npcs.length, creatures, items, itemKinds: kinds.size, fixtures },
  scenes,
  letters,
  weather,
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
console.log(`Hearthvale: ${maps.length} maps, ${npcs.length} people (${lines} lines), ${creatures} creatures, ${items} items (${kinds.size} kinds), ${fixtures} fixtures, ${anchors.size} anchors → ${OUT}`)
