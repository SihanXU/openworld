// The rooms behind the doors outside Firstlight (2026-10-11: every building can be walked into): Emberfall's houses,
// the elder's teahouse, Garrick's smithy and Wren's hut; the burned farmstead on the East Road; and the tents — the
// ferry camp's at the Ford, the rotted one in the forest, Alberic's in the Held Ground. A building's door is a portal
// (as Firstlight's: village.ts); a tent is a thing that stands in the way, so one goes in with a hand on it (content
// rules.ts tent/enter: its `interior` props), and comes out in front of it.

import type { Entity } from '@openworld/engine'
import { MapBuilder } from './builder.ts'
import { L } from './kit.ts'
import { flHouse, home, room } from './village.ts'

/** A room behind a named door of a map. */
export interface Room {
  door: string
  map: MapBuilder
}

/** Emberfall: four families' houses, the elder's teahouse, the smithy behind the forge, the herbalist's hut. */
export function emberfallRooms(): Room[] {
  const elder = room('emberfall.elder', "Mara's Teahouse", '玛拉的茶屋', 12, 9, 'wood', 'floor_wood')
  elder.fixture('fixture/furniture/bed', 1, 1)
  elder.fixture('fixture/light/fireplace', 9, 1, { statuses: { lit: -1 } })
  elder.fixture('fixture/furniture/table', 5, 4, { name: L('The tea table', '茶桌'), tags: ['readable'], props: { text: 'A kettle, three cups, and a list of the houses the dragon burned, each crossed out as it was rebuilt. Two are not crossed out yet.', text_zh: '一把茶壶，三只杯子，还有一张被龙烧过的房子的名单，重建好一间就划掉一间。还有两间没划掉。' } })
  for (const x of [4, 6]) elder.fixture('fixture/furniture/chair', x, 4)
  elder.fixture('fixture/container/shelf', 3, 1)
  elder.fixture('fixture/container/chest', 10, 6)
  const smithy = room('emberfall.smithy', "Garrick's Smithy", '加里克的铁匠铺', 12, 9, 'stone', 'floor_stone')
  smithy.fixture('fixture/furniture/rack', 2, 1, { name: L('Tool rack', '工具架') })
  smithy.fixture('fixture/furniture/rack/arms', 3, 1)
  smithy.fixture('fixture/furniture/table', 6, 3, { name: L('The dragon-blade pattern', '屠龙剑图样'), tags: ['readable'], props: { text: 'A pattern for a blade, inked and re-inked by twelve smiths. In the margin, in a newer hand: "Five iron ore. Three coal. Then we will see."', text_zh: '一张剑的图样，十二代铁匠一遍遍描过。页边是较新的字迹：“五块铁矿石，三块煤。到时候再说。”' } })
  smithy.fixture('fixture/container/barrel', 1, 5, { name: L('Quench barrel', '淬火桶') })
  smithy.fixture('fixture/container/crate', 10, 5, { name: L('Coal crate', '煤箱') })
  smithy.fixture('fixture/furniture/bed', 10, 1)
  const herbalist = room('emberfall.herbalist', "Wren's Hut", '雷恩的小屋', 10, 8, 'wood', 'floor_wood')
  herbalist.fixture('fixture/container/bookshelf', 1, 1, { name: L('Books on dragons', '关于龙的书') })
  herbalist.fixture('fixture/container/shelf', 2, 1, { name: L('Jars of herbs', '一排草药罐') })
  herbalist.fixture('fixture/craft/cauldron', 5, 2)
  herbalist.fixture('fixture/furniture/table', 7, 3)
  herbalist.fixture('fixture/furniture/bed', 8, 1)
  herbalist.fixture('fixture/container/pot', 1, 5)
  return [
    { door: 'house.west', map: home('emberfall.west', 'A House on the Square', '广场边的人家', 2, 'plaster') },
    { door: 'house.north', map: home('emberfall.north', 'The Rebuilt House', '重建的房子', 2, 'wood') },
    { door: 'house.south', map: home('emberfall.south', 'The Thatched House', '茅草屋', 3, 'wood') },
    { door: 'house.east', map: home('emberfall.east', "The Miners' House", '矿工之家', 3, 'stone') },
    { door: 'elder', map: elder },
    { door: 'smithy', map: smithy },
    { door: 'herbalist', map: herbalist },
  ]
}

/**
 * The burned farmhouse on the East Road (the redo of 2026-10-27: a hall on its plan, plans.ts erfarm): its kitchen, the
 * hearth cold and the table still set for two, and the bedroom beside it; black to the rafters, beams fallen on the floor.
 */
export function eastRoadRooms(): Room[] {
  const { m, P } = flHouse('erfarm', 'eastroad.farmhouse', 'The Burned Farmhouse', '烧焦的农舍', 'floor_wood', ['kitchen', 'bedroom'])
  m.zone = 'combat'
  const K = P.kitchen
  m.fixture('fixture/light/fireplace', K.x + 4, K.y, { name: L('A cold hearth', '冷掉的灶') })
  m.fixture('fixture/furniture/table', K.x + 4, K.y + 3, { name: L("Edda's table", '艾达的桌子'), tags: ['readable'], props: { text: 'Two plates set out, one never used. Soot on everything but the place where a ring once lay.', text_zh: '摆着两只盘子，其中一只从没用过。处处都是烟灰，只有一枚戒指曾放过的地方是干净的。' } })
  m.fixture('fixture/furniture/chair', K.x + 3, K.y + 3)
  m.fixture('fixture/container/barrel', K.x, K.y + 5)
  m.building('decor_beams', K.x + 6, K.y + 1)
  m.building('decor_beams', K.x + 1, K.y + 2)
  const B = P.bedroom
  m.fixture('fixture/furniture/bed', B.x + 4, B.y + 1, { name: L('A scorched bed', '烧焦的床') })
  m.fixture('fixture/container/chest', B.x + 1, B.y + 4)
  m.building('decor_beams', B.x + 2, B.y + 2)
  return [{ door: 'farmhouse', map: m }]
}

/**
 * A tent's room: in with a hand on the tent (its `interior` props, content rules.ts tent/enter), out by the flap at the
 * room's bottom, in front of the tent. `tent` is the tent as its map placed it.
 */
export function tentRoom(outer: MapBuilder, tent: Entity, id: string, en: string, zh: string, furnish: (m: MapBuilder) => void): MapBuilder {
  const m = new MapBuilder(id, L(en, zh), 'interior', 8, 6, 'floor_wood', 'interior', 'indoor', 'frostfang')
  m.room('wood', 'floor_wood')
  furnish(m)
  const at = tent.place as { x: number; y: number }
  const [ix, iy] = m.doors.out
  m.portal(ix, iy, outer.id, at.x, at.y + 1, outer.name)
  tent.props = { ...tent.props, interior: id, interiorX: ix, interiorY: iy - 1 }
  return m
}

/** The tents of the world as their maps placed them, each with a room: the ferry camp's, the rotted one, Alberic's. */
export function tentRooms(ford: MapBuilder, forest: MapBuilder, haven: MapBuilder): MapBuilder[] {
  const tentOf = (m: MapBuilder) => m.entities.find((e) => e.type.startsWith('fixture/tent'))!
  return [
    tentRoom(ford, tentOf(ford), 'ford.tentroom', 'The Ferry Camp Tent', '渡口营地的帐篷', (m) => {
      m.fixture('fixture/furniture/bed', 1, 1, { name: L('A bedroll', '铺盖卷') })
      m.fixture('fixture/container/crate', 6, 1)
      m.fixture('fixture/light/candles', 4, 1, { statuses: { lit: -1 } })
    }),
    // the pilgrim before you camped here and did not go home (quest/chapter1.ts): bare earth under the canvas, his
    // bedroll against the back, his daybook on a box beside it, his sack and an empty crate; the woods coming in
    tentRoom(forest, tentOf(forest), 'forest.tentroom', 'Inside the Rotted Tent', '朽烂的帐篷里', (m) => {
      m.rect(1, 1, 6, 4, 'dirt')
      m.fixture('fixture/furniture/bed', 1, 2, { name: L('A mouldy bedroll', '发霉的铺盖') })
      m.fixture('fixture/furniture/table', 3, 1, {
        name: L("The pilgrim's daybook", '朝圣者的日记'),
        tags: ['readable'],
        props: {
          text: "A pilgrim's daybook, its pages swollen together with damp. A few lines still read: 'The road east, and him on it.' — 'I knelt. God forgive me, I knelt.' — and on the last page, pressed hard: 'Not home. Not like this.'",
          text_zh: '一本朝圣者的日记，纸页受潮粘在了一起。还能认出几行：“往东的路，他就在路上。”——“我跪下了。愿神宽恕我，我跪下了。”——最后一页，字迹压得很深：“不回家了。不能这样回去。”',
        },
      })
      m.fixture('fixture/container/sack', 6, 2, { name: L("A forager's sack", '采集者的麻袋') })
      m.fixture('fixture/container/crate', 6, 4, { name: L('An empty crate', '空木箱') })
      m.item('item/material/bone', 3, 3)
      for (const [x, y] of [[5, 1], [1, 4]] as const) m.fixture('fixture/nature/leaves', x, y)
      m.fixture('fixture/nature/moss', 5, 3)
    }),
    tentRoom(haven, tentOf(haven), 'haven.tentroom', "Inside Alberic's Tent", '阿尔贝里克的帐篷里', (m) => {
      m.fixture('fixture/furniture/bed', 1, 1, { name: L("Alberic's cot", '阿尔贝里克的行军床') })
      m.fixture('fixture/furniture/rack', 6, 1, { name: L('His old armour, on a stand', '架子上他的旧盔甲'), tags: ['readable'], props: { text: 'White plate, the crown\'s thorns still caught in the joints. He keeps it polished and does not wear it.', text_zh: '白色的板甲，关节里还卡着荆棘冠的刺。他一直把它擦得锃亮，却再没穿过。' } })
      m.fixture('fixture/container/chest', 6, 3)
    }),
  ]
}
