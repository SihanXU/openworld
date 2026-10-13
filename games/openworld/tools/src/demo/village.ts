// Firstlight Village's houses one walks into (2026-10-11): the village grew east along the road from the Ford and
// south down the forest trail. Every house has a door and a room behind it — the elder's, three families', two new
// homes in the south lane — and the east road has the village's trades: the general store (Greta behind its
// counter), the smithy (Haldor at the forge and anvil inside) and the church (Brother Anselm, who keeps the
// bookstand of skill books). The shops' offers: content village.ts.

import { MapBuilder } from './builder.ts'
import { L } from './kit.ts'

/** A building on the village map: its prefab, top left, and the door's name (its interior links there). */
export interface TownHouse {
  door: string
  prefab: string
  at: [number, number]
}

/** The houses that were there (now with doors), and the east road's and the south lane's new ones. */
export const TOWN: TownHouse[] = [
  { door: 'house.cook', prefab: 'house_plaster', at: [8, 5] },
  { door: 'house.elder', prefab: 'house_wood', at: [19, 5] },
  { door: 'house.guards', prefab: 'house_thatch', at: [28, 5] },
  { door: 'house.wood', prefab: 'house_red', at: [7, 13] },
  { door: 'store', prefab: 'store', at: [41, 14] },
  { door: 'smithy', prefab: 'smithy', at: [47, 15] },
  { door: 'church', prefab: 'temple', at: [52, 15] },
  { door: 'house.lane', prefab: 'house_orange', at: [12, 31] },
  { door: 'house.cabin', prefab: 'cabin', at: [30, 31] },
]

/** Stamp the village's houses with their doors, and the new streets: the east road's frontage, the south lane. */
export function villageTown(m: MapBuilder): void {
  for (const h of TOWN) {
    // a house in a wood must stand on open ground
    const def = { w: 4, h: 4 }
    for (let y = h.at[1] - 1; y < h.at[1] + def.h + 1; y++) for (let x = h.at[0] - 1; x < h.at[0] + def.w + 1; x++) if (m.in(x, y) && ['tree', 'pine'].includes(m.get(x, y))) m.set(x, y, 'grass')
    m.scenery(h.prefab, h.at[0], h.at[1], h.door)
  }
  // the east road's frontage: a short path from each door down to the road
  for (const d of ['store', 'smithy', 'church']) {
    const [x, y] = m.doors[d]
    m.path([[x, y + 1], [x, 18]], 'path', 1)
  }
  m.fixture('fixture/sign', 40, 17, { id: 'village.store.sign', props: { text: "GENERAL STORE — Greta's. Lamps, rope, bread, potions; she buys herbs, hides and eggs.", text_zh: '杂货铺——葛瑞塔的店。灯、绳子、面包、药水；也收草药、皮子和鸡蛋。' } })
  m.fixture('fixture/sign', 46, 17, { id: 'village.smithy.sign', props: { text: 'SMITHY — the forge smelts ore with coal; the anvil, with a hammer in hand, makes gear. Haldor sells hammers.', text_zh: '铁匠铺——熔炉用煤把矿石炼成锭；手里拿着锻锤，在铁砧上打造装备。锻锤找哈尔多买。' } })
  m.fixture('fixture/sign', 51, 17, { id: 'village.church.sign', props: { text: 'CHURCH OF THE FIRST DAWN — skill books at the stand inside, from Brother Anselm.', text_zh: '初晓教堂——里面的书架上有技能书，找安塞姆修士。' } })
  for (const [x, y] of [[45, 20], [56, 20]] as const) m.fixture('fixture/light/lamppost', x, y, { id: `village.lamp.${x}`, statuses: { lit: -1 } })
  // the south lane: from the forest trail, west and east to the two new homes
  const lane = m.doors['house.lane']
  const cabin = m.doors['house.cabin']
  m.path([[lane[0], lane[1] + 1], [lane[0], 35], [23, 35], [cabin[0], 35], [cabin[0], cabin[1] + 1]], 'path', 1)
}

/** A furnished room behind a door: its map, what stands in it. */
export interface Interior {
  door: string
  map: MapBuilder
}

/** A plain room: walls, a floor, a door in its bottom wall (MapBuilder.room). */
export function room(id: string, en: string, zh: string, w: number, h: number, style: string, floor: string, music = 'interior'): MapBuilder {
  const m = new MapBuilder(id, L(en, zh), 'interior', w, h, floor, music, 'indoor', 'frostfang')
  m.room(style, floor)
  return m
}

/** A family's home: beds along the top wall, a table and chairs, a hearth, a chest. */
export function home(id: string, en: string, zh: string, beds: number, style: string): MapBuilder {
  const m = room(id, en, zh, 11, 8, style, 'floor_wood')
  for (let i = 0; i < beds; i++) m.fixture('fixture/furniture/bed', 1 + i * 2, 1)
  m.fixture('fixture/light/fireplace', 8, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 5, 4)
  for (const x of [4, 6]) m.fixture('fixture/furniture/chair', x, 4)
  m.fixture('fixture/container/chest', 9, 5)
  m.fixture('fixture/container/barrel', 1, 5)
  return m
}

export function villageInteriors(): Interior[] {
  // the elder's house: his desk and the village's books
  const elder = room('meadow.elder', "The Elder's House", '村长的家', 12, 9, 'plaster', 'floor_wood')
  elder.fixture('fixture/furniture/bed', 1, 1)
  elder.fixture('fixture/container/bookshelf', 4, 1)
  elder.fixture('fixture/container/bookshelf', 5, 1)
  elder.fixture('fixture/light/fireplace', 9, 1, { statuses: { lit: -1 } })
  elder.fixture('fixture/furniture/table', 6, 4, { name: L("The elder's desk", '村长的书桌'), tags: ['readable'], props: { text: 'A ledger of the village: who came, who went, who was owed what. The last pages are about the storms.', text_zh: '村子的账簿：谁来了，谁走了，谁欠谁什么。最后几页写的都是风暴。' } })
  elder.fixture('fixture/furniture/chair', 6, 5)
  elder.fixture('fixture/container/chest', 10, 6)
  // the families'
  const cook = home('meadow.cook', "Marta's House", '玛尔塔家', 3, 'plaster')
  cook.fixture('fixture/container/pot', 9, 3)
  const guards = home('meadow.guards', 'The Watch House', '守卫之家', 2, 'stone')
  guards.fixture('fixture/furniture/rack', 9, 3, { name: L('Weapon rack', '兵器架') })
  const wood = home('meadow.woodhouse', "The Woodcutter's House", '樵夫之家', 2, 'wood')
  wood.fixture('fixture/container/woodpile', 9, 3, { statuses: { open: -1 } })
  const lane = home('meadow.lane', 'The House in the Lane', '小巷人家', 2, 'plaster')
  const cabin = home('meadow.cabin', 'The Little Cabin', '小木屋', 1, 'wood')
  // the general store: shelves along the wall, the counter, Greta behind it
  const store = room('meadow.store', 'General Store', '杂货铺', 12, 9, 'wood', 'floor_wood', 'shop')
  for (const x of [1, 2, 3, 8, 9, 10]) store.fixture('fixture/container/shelf', x, 1)
  store.fixture('fixture/furniture/counter/store', 5, 3, { id: 'store.counter', name: L("Greta's counter", '葛瑞塔的柜台'), statuses: { fireproof: -1 } })
  store.fixture('fixture/furniture/counter', 6, 3)
  store.anchor('keeper.counter', 5, 2)
  for (const [x, y] of [[1, 5], [10, 5]] as const) store.fixture('fixture/container/barrel', x, y)
  store.fixture('fixture/container/crate', 2, 6)
  store.fixture('fixture/furniture/bed', 10, 3)
  store.anchor('keeper.bed', 9, 3)
  // the smithy: the forge and the anvil (anyone's to use, a hammer carried), Haldor at them
  const smithy = room('meadow.smithy', 'The Smithy', '铁匠铺', 12, 9, 'stone', 'floor_stone')
  smithy.fixture('fixture/craft/forge', 3, 2, { id: 'smithy.forge', name: L("Haldor's forge", '哈尔多的熔炉'), statuses: { lit: -1, fireproof: -1 } })
  smithy.fixture('fixture/craft/anvil', 6, 3, { id: 'smithy.anvil', name: L("Haldor's anvil", '哈尔多的铁砧') })
  smithy.anchor('smith.anvil', 7, 4)
  smithy.fixture('fixture/container/barrel', 1, 5, { name: L('Quench barrel', '淬火桶') })
  smithy.fixture('fixture/container/crate', 10, 5, { name: L('Coal crate', '煤箱') })
  smithy.fixture('fixture/furniture/rack', 9, 1, { name: L('Tool rack', '工具架') })
  smithy.fixture('fixture/furniture/bed', 10, 3)
  smithy.anchor('smith.bed', 9, 3)
  // the church: an altar, candles, benches, the bookstand of skill books, Brother Anselm beside it
  const church = room('meadow.church', 'Church of the First Dawn', '初晓教堂', 14, 11, 'stone', 'floor_stone', 'temple')
  church.fixture('fixture/sacred/altar', 7, 2, { name: L('The dawn altar', '晨光祭坛'), tags: ['readable'], props: { text: 'A flame painted on the stone behind the altar, and five small marks under it.', text_zh: '祭坛后的石壁上画着一团火，下面有五道小刻痕。' } })
  for (const [x, y] of [[5, 2], [9, 2]] as const) church.fixture('fixture/light/candles', x, y, { statuses: { lit: -1 } })
  for (const [x, y] of [[3, 6], [10, 6], [3, 8], [10, 8]] as const) church.fixture('fixture/furniture/bench', x, y)
  church.fixture('fixture/furniture/bookstand', 11, 3, { id: 'church.books', name: L('The bookstand', '技能书架'), statuses: { fireproof: -1 } })
  church.anchor('priest.stand', 11, 4)
  church.fixture('fixture/furniture/bed', 1, 1)
  church.anchor('priest.bed', 2, 2)
  return [
    { door: 'house.cook', map: cook },
    { door: 'house.elder', map: elder },
    { door: 'house.guards', map: guards },
    { door: 'house.wood', map: wood },
    { door: 'store', map: store },
    { door: 'smithy', map: smithy },
    { door: 'church', map: church },
    { door: 'house.lane', map: lane },
    { door: 'house.cabin', map: cabin },
  ]
}
