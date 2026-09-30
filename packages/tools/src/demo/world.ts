// The hand-crafted Hearthvale demo: a village with five buildings (each with an interior),
// Whisperwood to the south, and Slime Hollow beyond it. Writes the default web world.
//
//   npx tsx packages/tools/src/demo/world.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Entity, MapMeta, Pos, ScheduleEntry, Text, WorldIndex } from '@lsw/engine'
import { CATALOG } from '../../../client/src/assets/catalog.ts'
import type { PrefabDef } from '../../../client/src/assets/types.ts'
import { MapBuilder, linkEdge, rng, type ItemSpec } from './builder.ts'
import { PEOPLE } from './people.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../client/public/world')
const VERSION = 'hearthvale-1'
const L = (en: string, zh: string): Text => ({ en, zh })

/** Prefab keys used by the village (resolved against the asset catalogue). */
const PF = {
  home: 'house_orange',
  maren: 'house_plaster',
  inn: 'inn',
  shop: 'store',
  smithy: 'smithy',
  tent: 'tent',
}
function prefab(key: keyof typeof PF): PrefabDef {
  const def = CATALOG.prefabs[PF[key]]
  if (!def) throw new Error(`prefab "${PF[key]}" not in catalog; available: ${Object.keys(CATALOG.prefabs).join(', ')}`)
  return def
}

const grassy = (c: string) => c === 'grass' || c === 'flowers'
const anchors: Record<string, Pos> = {}
const anchor = (name: string, m: MapBuilder, x: number, y: number) => (anchors[name] = { map: m.id, x, y })

// =================================================================== Hearthvale village

const village = new MapBuilder('hearthvale', L('Hearthvale', '炉谷'), 'village', 48, 34, 'grass', 'village')
{
  const v = village
  v.border('tree', 2, [[22, 32, 4, 2]])
  // flowers and a few trees for texture
  v.scatter(2, 2, 44, 30, 'flowers', 0.05)
  // main roads
  v.road(23, 3, 23, 33, 'path', 2)
  v.road(3, 16, 44, 16, 'path', 2)
  // village square
  v.rect(18, 13, 12, 7, 'cobble')
  anchor('square.well', v, 22, 15)
  anchor('square.board', v, 20, 14)
  anchor('square.market', v, 26, 18)
  anchor('square.bench', v, 27, 14)
  // buildings (prefab top-left); paths from doors to the roads
  v.prefab(PF.home, prefab('home'), 6, 5, 'home')
  v.prefab(PF.maren, prefab('maren'), 26, 4, 'maren')
  v.prefab(PF.inn, prefab('inn'), 34, 3, 'inn')
  v.prefab(PF.shop, prefab('shop'), 6, 10, 'shop')
  v.prefab(PF.smithy, prefab('smithy'), 35, 10, 'smithy')
  for (const d of ['home', 'maren', 'inn', 'shop', 'smithy']) {
    const [dx, dy] = v.doors[d]
    v.road(dx, dy + 1, dx, 16, 'path', 1, (c) => c !== 'wall' && c !== 'door')
  }
  // farm (south-west): tilled rows behind a fence
  v.rect(4, 22, 12, 7, 'farmland')
  for (let x = 3; x <= 16; x++) v.fixture('fixture/fence', x, 21)
  v.fixture('fixture/nature/haystack', 15, 28)
  v.fixture('fixture/dummy', 9, 25, { name: L('Scarecrow', '稻草人') })
  // Hollis's crops at mixed stages (a few rows bare, ready to sow)
  for (let y = 22; y < 29; y++)
    for (let x = 4; x < 16; x++) {
      if ((x === 15 && y === 28) || (x === 9 && y === 25)) continue
      const plant = x < 8 ? 'wheat' : x < 12 ? 'herb' : 'berry'
      const stage = rng.pick(['sprout', 'young', 'young', 'ripe', 'ripe', 'bare'])
      if (stage !== 'bare') v.fixture(`fixture/crop/${plant}/${stage}`, x, y)
    }
  // a small plot south of the square, ready to sow, with a farming and building kit
  v.rect(19, 20, 3, 2, 'farmland')
  for (const [s, x, y] of [
    [{ form: 'item/tool/hoe', material: 'iron' }, 18, 20],
    [{ form: 'item/tool/sickle', material: 'iron' }, 18, 21],
    ['item/seed/wheat', 17, 21],
    ['item/seed/wheat', 17, 21],
    ['item/seed/herb', 17, 20],
    [{ form: 'item/weapon/blade/axe', material: 'iron' }, 30, 17],
    [{ form: 'item/tool/pickaxe', material: 'iron' }, 31, 17],
    [{ form: 'item/tool/smith_hammer', material: 'iron' }, 30, 18],
  ] as [ItemSpec, number, number][])
    v.item(s, x, y)
  anchor('farm.rows', v, 8, 24)
  anchor('farm.edge', v, 12, 20)
  // dry hay field (south-east): the fire lesson
  v.rect(31, 24, 12, 6, 'drygrass')
  for (let x = 30; x <= 43; x++) if (x !== 36) v.fixture('fixture/fence', x, 23)
  v.fixture('fixture/nature/haystack', 33, 25)
  v.fixture('fixture/nature/haystack', 40, 28)
  v.fixture('fixture/nature/haystack', 37, 26)
  // pond with a little dock (east)
  v.blob(41, 19, 3.6, 2.6, 'water')
  v.blob(41.5, 19.2, 1.6, 1, 'deepwater')
  v.set(37, 19, 'bridge')
  v.set(38, 19, 'bridge')
  anchor('pond.dock', v, 38, 19)
  anchor('pond.shore', v, 40, 22)
  // trees, bushes and rocks
  for (const [x, y] of [[3, 9], [15, 4], [18, 8], [31, 9], [44, 13], [16, 12], [30, 21], [5, 30], [19, 28], [28, 29], [44, 30]]) v.set(x, y, 'tree')
  for (const [x, y] of [[12, 8], [13, 8], [29, 10], [17, 21], [2, 20], [45, 22], [26, 22]]) v.set(x, y, 'bush')
  for (const [x, y] of [[18, 3], [44, 8], [3, 13]]) v.set(x, y, 'rock')
  // the south gate
  anchor('gate.south', v, 21, 30)
  v.fixture('fixture/sign', 21, 31, { props: { text: 'South: Whisperwood · 南：低语森林' } })
  // square furniture and the starter kit
  v.fixture('fixture/water/well', 23, 15)
  v.fixture('fixture/sign/noticeboard', 19, 13, { props: { text: 'NOTICE — Slimes in the fields again. Keep fire away from the hay. Rumbling heard from Whisperwood. — Elder Maren' } })
  v.fixture('fixture/furniture/bench', 27, 13)
  v.fixture('fixture/light/campfire', 28, 18)
  v.fixture('fixture/nature/logpile', 29, 18)
  v.fixture('fixture/light/lamppost', 18, 17, { statuses: { lit: -1 } })
  v.fixture('fixture/light/lamppost', 29, 13, { statuses: { lit: -1 } })
  v.fixture('fixture/container/barrel', 21, 19, {}, ['item/food/apple', 'item/food/apple'])
  v.fixture('fixture/container/crate', 30, 15, {}, ['item/tool/rope', 'item/material/log'])
  const kit: [ItemSpec, number, number][] = [
    [{ form: 'item/weapon/magic/wand', element: 'fire', material: 'wood', name: L('Ember Wand', '余烬魔杖') }, 21, 16],
    [{ form: 'item/weapon/magic/wand', element: 'ice', material: 'bone', name: L('Frost Wand', '寒霜魔杖') }, 21, 17],
    [{ form: 'item/weapon/magic/staff', element: 'wind', material: 'wood', name: L('Gale Staff', '疾风法杖') }, 25, 17],
    ['item/vessel/bucket/empty', 24, 16],
    ['item/light/torch', 25, 16],
  ]
  for (const [s, x, y] of kit) v.item(s, x, y)
  v.item({ form: 'item/weapon/blade/sword', material: 'iron' }, 20, 18)
  v.item('item/vessel/flask/oil', 31, 16)
  // slimes in the farm (they only fight back when hit)
  for (const [x, y] of [[6, 26], [11, 23], [13, 27], [8, 28]]) v.creature('slime/green_slime', x, y, { hostile: false, sight: 4 })
  v.creature('slime/water_slime', 43, 22, { hostile: false })
}

// =================================================================== interiors

function interior(id: string, name: Text, w: number, h: number, floor = 'floor_wood', style = 'wood', music = 'interior') {
  const m = new MapBuilder(id, name, 'interior', w, h, floor, music, 'indoor')
  m.room(style, floor)
  return m
}

const home = interior('hearthvale.home', L('Your Cottage', '你的小屋'), 11, 8)
{
  const m = home
  m.fixture('fixture/furniture/bed', 1, 1)
  m.fixture('fixture/container/chest', 3, 1, {}, ['item/food/bread', 'item/food/apple', { form: 'item/clothing/cloak', material: 'cloth' }])
  m.fixture('fixture/light/fireplace', 8, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 5, 4)
  m.fixture('fixture/furniture/chair', 4, 4)
  m.fixture('fixture/container/shelf', 9, 3, {}, ['item/vessel/cup', 'item/vessel/plate', 'item/light/candle'])
  m.item('item/vessel/bucket/empty', 9, 5)
  m.item('item/tool/broom', 1, 5)
}

const maren = interior('hearthvale.maren', L('Elder Maren\'s House', '玛伦村长家'), 11, 8)
{
  const m = maren
  m.fixture('fixture/furniture/bed', 1, 1)
  m.fixture('fixture/furniture/bed', 1, 3)
  m.fixture('fixture/container/bookshelf', 4, 1, {}, ['item/document/book', 'item/document/book', { form: 'item/document/scroll', element: 'fire' }, 'item/document/map'])
  m.fixture('fixture/container/bookshelf', 5, 1, {}, ['item/document/book', 'item/misc/feather_quill', 'item/misc/ink'])
  m.fixture('fixture/light/candles', 7, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 6, 4)
  m.fixture('fixture/furniture/chair', 7, 4)
  m.fixture('fixture/container/pot', 9, 1, {}, ['item/material/herb', 'item/material/herb'])
  anchor('maren.bed', m, 1, 2)
  anchor('maren.bed2', m, 2, 3)
  anchor('maren.table', m, 6, 5)
  anchor('maren.shelf', m, 4, 2)
}

const inn = interior('hearthvale.inn', L('The Hearth Inn', '炉火旅店'), 17, 11)
{
  const m = inn
  for (let x = 2; x <= 5; x++) m.fixture('fixture/furniture/counter', x, 3)
  m.fixture('fixture/container/barrel', 1, 1, {}, ['item/food/ale', 'item/food/ale', 'item/food/wine'])
  m.fixture('fixture/container/barrel', 2, 1, {}, ['item/food/ale', 'item/food/wine'])
  m.fixture('fixture/container/shelf', 4, 1, {}, ['item/food/bread', 'item/food/cheese', 'item/food/pie', { form: 'item/food/fish/cooked' }])
  m.fixture('fixture/light/fireplace', 7, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/craft/cauldron', 9, 1)
  for (const [tx, ty] of [[4, 6], [8, 6], [4, 8], [8, 8]]) {
    m.fixture('fixture/furniture/table', tx, ty)
    m.fixture('fixture/furniture/chair', tx - 1, ty)
    m.fixture('fixture/furniture/chair', tx + 1, ty)
  }
  for (let i = 0; i < 7; i++) {
    const x = i < 4 ? 12 + (i % 2) * 3 : 12 + ((i - 4) % 2) * 3
    const y = i < 4 ? 1 + Math.floor(i / 2) * 2 : 6 + Math.floor((i - 4) / 2) * 2
    m.fixture('fixture/furniture/bed', x, y)
    anchor(`inn.bed${i + 1}`, m, x + 1, y)
  }
  anchor('inn.bar', m, 4, 4)
  anchor('inn.table', m, 6, 7)
  anchor('inn.kitchen', m, 8, 2)
}

const shop = interior('hearthvale.shop', L('Oda\'s Goods', '奥妲杂货铺'), 13, 9)
{
  const m = shop
  const stock: ItemSpec[][] = [
    ['item/vessel/flask/empty', 'item/vessel/flask/empty', 'item/vessel/flask/oil', 'item/vessel/flask/oil', 'item/vessel/flask/water'],
    ['item/light/torch', 'item/light/torch', 'item/light/lantern', 'item/tool/flint', 'item/light/candle'],
    ['item/tool/rope', 'item/tool/rope', 'item/tool/shovel', 'item/tool/fishing_rod', 'item/vessel/bucket/empty'],
    ['item/food/bread', 'item/food/cheese', 'item/food/honey', 'item/material/salt', 'item/potion/healing'],
    ['item/material/cloth', 'item/material/leather', { form: 'item/clothing/hat', material: 'cloth' }, 'item/misc/soap', 'item/misc/firework'],
  ]
  stock.forEach((s, i) => m.fixture('fixture/container/shelf', 1 + i * 2, 1, {}, s))
  for (let x = 2; x <= 10; x++) if (x !== 6) m.fixture('fixture/furniture/counter', x, 4)
  m.fixture('fixture/container/crate', 11, 6, {}, ['item/material/log', 'item/material/plank', 'item/material/coal'])
  m.fixture('fixture/furniture/bed', 11, 1)
  anchor('shop.counter', m, 6, 3)
  anchor('shop.bed', m, 11, 2)
}

const smithy = interior('hearthvale.smithy', L('Brann\'s Smithy', '布兰铁匠铺'), 13, 9, 'floor_stone', 'stone')
{
  const m = smithy
  m.fixture('fixture/craft/forge', 1, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/craft/anvil', 3, 3)
  m.fixture('fixture/water/trough', 1, 4)
  m.fixture('fixture/container/shelf', 5, 1, {}, [{ form: 'item/weapon/blade/sword', material: 'iron' }, { form: 'item/weapon/blade/sword', material: 'steel' }, { form: 'item/weapon/blade/dagger', material: 'iron' }])
  m.fixture('fixture/container/shelf', 7, 1, {}, [{ form: 'item/weapon/blade/axe', material: 'iron' }, { form: 'item/tool/pickaxe', material: 'iron' }, { form: 'item/weapon/blunt/mace', material: 'bronze' }])
  m.fixture('fixture/container/shelf', 9, 1, {}, [{ form: 'item/armor/shield', material: 'iron' }, { form: 'item/armor/helmet', material: 'iron' }, { form: 'item/tool/smith_hammer', material: 'iron' }])
  m.fixture('fixture/container/barrel', 11, 4, {}, ['item/material/coal', 'item/material/coal', 'item/material/iron_ore'])
  m.fixture('fixture/furniture/bed', 11, 1)
  anchor('smithy.anvil', m, 4, 3)
  anchor('smithy.bed', m, 11, 2)
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
  m.road(23, 0, 23, 20, 'path', 2)
  m.road(23, 20, 46, 20, 'path', 2)
  m.road(46, 20, 46, 33, 'path', 2)
  // a stream from the north-east into the lake
  for (let y = 2; y < 16; y++) {
    const x = 34 + Math.round(Math.sin(y / 3))
    m.set(x, y, 'water')
    m.set(x + 1, y, 'water')
  }
  m.blob(35, 25, 6.5, 4.5, 'water')
  m.blob(35, 25.3, 3.5, 2.2, 'deepwater')
  // bridge where the road crosses the stream? the road stays west of it; add a footbridge north
  m.set(34, 8, 'bridge')
  m.set(35, 8, 'bridge')
  // dry meadow with a camp (south-west)
  m.rect(6, 27, 16, 9, 'drygrass')
  m.fixture('fixture/nature/haystack', 9, 29)
  m.fixture('fixture/nature/haystack', 17, 33)
  m.fixture('fixture/light/campfire', 20, 24)
  m.fixture('fixture/nature/logpile', 21, 23)
  m.fixture('fixture/container/sack', 18, 23, {}, ['item/food/bread', { form: 'item/food/meat/raw' }, 'item/tool/flint'])
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
    if (grassy(m.get(x, y))) m.item(rng.pick(['item/material/stick', 'item/material/stone', 'item/material/herb', 'item/food/berries', 'item/food/mushroom/raw', 'item/material/fireweed']), x, y)
  }
  m.fixture('fixture/nature/beehive', 18, 5)
  m.fixture('fixture/nature/mushroom_ring', 12, 25)
  m.fixture('fixture/nature/boulder', 28, 12)
  m.fixture('fixture/sign', 25, 3, { props: { text: 'North: Hearthvale · South-east: Slime Hollow' } })
  anchor('wood.herbs', m, 19, 14)
  // creatures
  for (const [x, y] of [[26, 29], [28, 33], [30, 16]]) m.creature('slime/green_slime', x, y, { hostile: false })
  for (const [x, y] of [[14, 30], [11, 33]]) m.creature('slime/fire_slime', x, y, { hostile: false })
  for (const [x, y] of [[41, 23], [30, 29]]) m.creature('slime/frost_slime', x, y, { hostile: false })
  for (const [x, y] of [[37, 6], [33, 13]]) m.creature('slime/spark_slime', x, y, { hostile: false })
  m.creature('slime/water_slime', 39, 29, { hostile: false })
  for (const [x, y] of [[9, 14], [13, 4], [48, 9]]) m.creature('beast/boar', x, y, { sight: 5, loot: ['item/food/meat/raw'] })
  for (const [x, y] of [[43, 31], [49, 32]]) m.creature('beast/bat', x, y, { sight: 5 })
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
  for (const [x, y] of [[16, 3], [17, 3], [24, 8]]) m.fixture('fixture/container/pot', x, y, {}, [rng.pick<ItemSpec>(['item/valuable/coin_pouch', 'item/potion/healing', 'item/material/bone', 'item/gem'])])
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
  m.fixture('fixture/container/chest', 32, 14, { name: L('Slime King\'s Hoard', '史莱姆王的宝藏') }, [
    { form: 'item/valuable/crown', material: 'gold' },
    'item/valuable/coin_pouch',
    'item/valuable/coin_pouch',
    { form: 'item/gem', element: 'fire' },
  ])
  m.fixture('fixture/light/brazier', 19, 14, { statuses: { lit: -1 } })
  m.fixture('fixture/light/brazier', 32, 21, { statuses: { lit: -1 } })
}

// =================================================================== links

village.linkInterior('home', home)
village.linkInterior('maren', maren)
village.linkInterior('inn', inn)
village.linkInterior('shop', shop)
village.linkInterior('smithy', smithy)
linkEdge(
  village,
  [[22, 33], [23, 33], [24, 33], [25, 33]],
  [0, -1],
  wood,
  [[22, 0], [23, 0], [24, 0], [25, 0]],
  [0, 1],
)
// stairs: step onto the stairs to change level; arrive beside them
wood.portal(46, 35, cave.id, 6, 3, cave.name)
cave.portal(6, 2, wood.id, 46, 34, wood.name)

// =================================================================== people

const npcs: Entity[] = []
for (const p of PEOPLE) {
  const schedule: ScheduleEntry[] = p.day.map(([from, to, place, activity]) => {
    const a = anchors[place]
    if (!a) throw new Error(`${p.id}: unknown anchor ${place}`)
    return { from, to, map: a.map, x: a.x, y: a.y, activity }
  })
  const first = schedule.find((s) => (s.from <= s.to ? 8 >= s.from && 8 < s.to : 8 >= s.from || 8 < s.to)) ?? schedule[0]
  const e: Entity & { _items?: Entity[] } = {
    id: p.id,
    type: `actor/person/${p.role}`,
    name: p.name,
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    npc: { role: p.role, schedule, look: p.look, lines: p.lines, faction: 'hearthvale', home: schedule[0] },
    _items: (p.items ?? []).map((f, i) => ({ ...village.makeItem(f), id: `${p.id}~${i}`, place: { on: 'inside' as const, holder: p.id } })),
  }
  npcs.push(e)
}

// =================================================================== write

const maps = [village, home, maren, inn, shop, smithy, wood, cave]
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
const index: WorldIndex = {
  name: L('Hearthvale', '炉谷'),
  version: VERSION,
  seed: 4242,
  start: { map: 'hearthvale.home', x: 5, y: 5 },
  maps: metas,
  npcs,
  player: {
    id: 'player',
    type: 'actor/person/player',
    name: L('You', '你'),
    place: { on: 'none' },
    facing: 'down',
    look: CATALOG.roles.player?.[0] ?? 'NinjaGreen',
    props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, quest: 0, slimes: 0 },
  },
  stats: { maps: maps.length, npcs: npcs.length, creatures, items, itemKinds: kinds.size, fixtures },
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
console.log(`Hearthvale demo: ${maps.length} maps, ${npcs.length} NPCs, ${creatures} creatures, ${items} items (${kinds.size} kinds), ${fixtures} fixtures → ${OUT}`)
