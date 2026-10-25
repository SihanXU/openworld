// Firstlight Village's houses one walks into (2026-10-11): the village grew east along the road from the Ford and
// south down the forest trail. Every house has a door and a room behind it — the elder's, three families', two new
// homes in the south lane — and the east road has the village's trades: the general store (Greta behind its
// counter) and the smithy (Haldor at the forge and anvil inside). Sister Ilse's chapel stands on the square behind
// Astra's altar and the flame (docs/chapter-1.md §7); inside, Brother Anselm keeps the bookstand of skill books. (It was
// a church of its own on the east road until 2026-10-12.) The shops' offers: content village.ts.
//
// Drawn by hand for release 1 (2026-10-21, docs/release-1.md): the ground is the layout file (maps/meadow.txt); the
// houses stand in yards, the village keeps what it lives by about them — Marta's kitchen patch, the woodcutter's yard,
// the drill yard by the watch house, the fields and their scarecrow, the hay meadow, the orchard and its hives, a washing
// line in the lane, a trough for the drovers' beasts on the road — and every household sleeps in its own beds.

import { CHAPEL_SIGN } from '@openworld-game/content'
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
  { door: 'house.cook', prefab: 'house_orange', at: [8, 5] },
  { door: 'house.elder', prefab: 'house_wood', at: [19, 5] },
  { door: 'house.guards', prefab: 'house_thatch', at: [28, 5] },
  { door: 'house.wood', prefab: 'house_red', at: [7, 13] },
  { door: 'store', prefab: 'store', at: [41, 14] },
  { door: 'smithy', prefab: 'smithy', at: [47, 15] },
  // Sister Ilse's chapel, behind Astra's altar on the square (its door one step above the altar: quest/chapter1.ts)
  { door: 'church', prefab: 'temple', at: [23, 10] },
  { door: 'house.lane', prefab: 'cabin', at: [12, 31] },
  { door: 'house.cabin', prefab: 'hut_straw', at: [30, 32] },
]

/** Stamp the village's houses with their doors, the trades' signs, the road's lamps and the village's banners. */
export function villageTown(m: MapBuilder): void {
  for (const h of TOWN) m.scenery(h.prefab, h.at[0], h.at[1], h.door)
  m.fixture('fixture/sign', 40, 17, { id: 'village.store.sign', props: { text: "GENERAL STORE — Greta's. Lamps, rope, bread, potions; she buys herbs, hides and eggs.", text_zh: '杂货铺——葛瑞塔的店。灯、绳子、面包、药水；也收草药、皮子和鸡蛋。' } })
  m.fixture('fixture/sign', 46, 17, { id: 'village.smithy.sign', props: { text: 'SMITHY — the forge smelts ore with coal; the anvil, with a hammer in hand, makes gear. Haldor sells hammers.', text_zh: '铁匠铺——熔炉用煤把矿石炼成锭；手里拿着锻锤，在铁砧上打造装备。锻锤找哈尔多买。' } })
  m.fixture('fixture/sign', ...CHAPEL_SIGN.at, { id: CHAPEL_SIGN.id, props: { text: CHAPEL_SIGN.text, text_zh: CHAPEL_SIGN.text_zh } })
  // the road's lamps, from the square out to where the road comes in from the Ford
  for (const [x, y] of [[45, 20], [56, 16]] as const) m.fixture('fixture/light/lamppost', x, y, { id: `village.lamp.${x}`, statuses: { lit: -1 } })
  // the way in from the Ford: the village's green banners either side of the road, and its name
  for (const [x, y] of [[53, 16], [53, 21]] as const) m.scenery('banner_green', x, y)
  m.fixture('fixture/sign', 55, 21, { id: 'village.gate.sign', props: { text: 'FIRSTLIGHT VILLAGE. West, the square and the chapel; the Ford behind you.', text_zh: '初原村。往西是广场和礼拜堂；身后是渡口。' } })
}

/**
 * What the village lives by, in its yards, fields and orchard, and the small things on its ground: each where it is
 * used, never strewn. The yards are rail fences with a gate on their path.
 */
export function villageLife(m: MapBuilder): void {
  const grass = (t: string) => t === 'grass'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const water = (t: string) => t === 'water'
  const wall = (t: string) => t === 'wall' || t === 'woodwall' || t === 'door'
  const road = (t: string) => t === 'path' || t === 'dirt' || t === 'cobble'
  // Marta's kitchen patch west of her house, behind its rail
  m.yard(3, 9, 5, 5, 'rail', [[7, 11]])
  // the woodcutter's yard east of his house: the chopping stump and a stack of split logs by the wood pile
  m.fixture('fixture/nature/stump', 11, 13)
  m.fixture('fixture/nature/logpile/stack', 14, 13)
  // the watch's lookout beside the watch house, over the hay meadow towards the road from the Ford
  m.scenery('watchtower', 38, 2)
  // the drill yard by the watch house (Bram's): a straw man to strike and the weapon rack
  m.yard(31, 8, 7, 6, 'rail', [[31, 10], [31, 11]])
  m.fixture('fixture/dummy', 35, 10, { name: L("Training dummy", "训练假人") })
  m.fixture('fixture/furniture/rack/arms', 36, 12)
  // the store's and the smithy's frontage: barrels and a crate by the doors
  m.fixture('fixture/container/barrel', 39, 16)
  m.fixture('fixture/container/crate', 45, 16)
  // the trough on the road by the square, for the drovers' beasts
  m.fixture('fixture/water/trough', 35, 20, { id: 'village.trough' })
  // the hay meadow north of the road: the summer's hay in stacks
  for (const [x, y] of [[44, 6], [48, 9], [42, 11], [50, 6]] as const) m.fixture('fixture/nature/haystack', x, y)
  m.sprinkle('fixture/nature/tuft', 0.22, (x, y, t) => grass(t) && !m.near(x, y, tree, 1), [41, 4, 12, 9])
  // the fields south of the road, behind their fence, and the scarecrow over them
  m.yard(33, 25, 12, 9, 'rail', [[33, 27]])
  m.fixture('fixture/scarecrow', 39, 28)
  // the churchyard in its clearing in the south-west woods: a stone wall, the village's dead, the gate on the path
  m.yard(3, 25, 8, 7, 'stonewall', [[10, 28]])
  for (const [x, y] of [[5, 27], [7, 27], [9, 27], [5, 29], [7, 29]] as const) m.fixture('fixture/sacred/gravestone', x, y)
  // the orchard's hives
  for (const [x, y] of [[48, 29], [51, 32]] as const) m.fixture('fixture/nature/beehive', x, y)
  // the house in the lane: its garden behind a rail, the washing line by its west wall
  m.yard(16, 28, 5, 4, 'rail', [[16, 30]])
  m.fixture('fixture/furniture/washing_line', 10, 33, { id: 'village.washing' })
  // the pond's reeds
  m.sprinkle('fixture/nature/reeds', 0.45, (x, y, t) => grass(t) && m.near(x, y, water) && y >= 20 && y <= 25 && x >= 12 && x <= 21)
  // flowers under the windows and along the lanes; tufts in the open; leaves under the woods' edge
  m.sprinkle('fixture/nature/flowers', 0.3, (x, y, t) => grass(t) && m.near(x, y, wall, 1) && !m.near(x, y, (c) => c === 'door', 1))
  m.sprinkle('fixture/nature/flowers', 0.08, (x, y, t) => grass(t) && m.near(x, y, road, 1) && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.04, (x, y, t) => grass(t) && !m.near(x, y, tree, 1) && !m.near(x, y, road, 1))
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => grass(t) && m.near(x, y, tree))
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

/**
 * A family's home: a bed for each who sleeps there along the top wall (each with its anchor `bed.<n>` before it, where
 * its sleeper lies down), a table and chairs, a hearth, a chest, a barrel.
 */
export function home(id: string, en: string, zh: string, beds: number, style: string): MapBuilder {
  const m = room(id, en, zh, 11, 8, style, 'floor_wood')
  for (let i = 0; i < beds; i++) {
    m.fixture('fixture/furniture/bed', 1 + i * 2, 1)
    m.anchor(`bed.${i}`, 1 + i * 2, 2)
  }
  m.fixture('fixture/light/fireplace', 9, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 5, 4)
  for (const x of [4, 6]) m.fixture('fixture/furniture/chair', x, 4)
  m.fixture('fixture/container/chest', 9, 5)
  m.fixture('fixture/container/barrel', 1, 5)
  return m
}

/** A room of a house: its frame [x, y, w, h] (walls round it), and the style its walls are drawn in. */
type Rect = [number, number, number, number]

/**
 * A house of rooms (docs/release-1.md, after Stardew's homes): each room has walls of its own, so two rooms side by
 * side are parted by a wall two thick (the pack's way of joining rooms); a doorway between them is floor through both
 * walls, and the way out is a door in the bottom wall of the first room. Outside the rooms is nothing (void).
 */
export function house(id: string, en: string, zh: string, w: number, h: number, style: string, rooms: Rect[], doorways: [number, number][], out: [number, number], opts: { floor?: string; music?: string } = {}): MapBuilder {
  const floor = opts.floor ?? 'floor_wood'
  const m = new MapBuilder(id, L(en, zh), 'interior', w, h, 'void', opts.music ?? 'interior', 'indoor', 'frostfang')
  for (const [x, y, rw, rh] of rooms) {
    m.rect(x, y, rw, rh, 'wall')
    m.rect(x + 1, y + 1, rw - 2, rh - 2, floor)
    m.rooms.push({ style, x, y, w: rw, h: rh })
  }
  for (const [x, y] of doorways) m.set(x, y, floor)
  m.set(out[0], out[1], 'door')
  m.doors.out = out
  return m
}

/** A rug: the floor laid with carpet under a table or before a hearth. */
const rug = (m: MapBuilder, x: number, y: number, w: number, h: number) => m.rect(x, y, w, h, 'carpet')
/** A bed (drawn its head a cell up, against the wall) and the anchor beside it where its sleeper lies down. */
const bed = (m: MapBuilder, x: number, y: number, anchor: string, at: [number, number]) => {
  m.fixture('fixture/furniture/bed', x, y)
  m.anchor(anchor, ...at)
}
const hearth = (m: MapBuilder, x: number, y: number) => m.fixture('fixture/light/fireplace', x, y, { statuses: { lit: -1 } })

export function villageInteriors(): Interior[] {
  // Marta's house, the village's biggest family: the kitchen and the family's long table by the door; above it her room
  // (Lina's bed by hers) and the children's, each through its own doorway
  const cook = house('meadow.cook', "Marta's House", '玛尔塔家', 14, 13, 'plaster', [[0, 5, 12, 8], [0, 0, 7, 5], [7, 0, 7, 5]], [[3, 4], [3, 5], [9, 4], [9, 5]], [6, 12])
  hearth(cook, 2, 6)
  cook.fixture('fixture/container/cupboard', 4, 6, { name: L("Marta's cupboard", '玛尔塔的橱柜') })
  cook.fixture('fixture/container/pot', 7, 6)
  cook.fixture('fixture/container/barrel', 10, 6)
  cook.fixture('fixture/container/sack', 10, 7)
  rug(cook, 3, 8, 5, 3)
  cook.fixture('fixture/furniture/table/long', 5, 9)
  for (const [x, y] of [[3, 9], [7, 9], [4, 10], [6, 10]] as const) cook.fixture('fixture/furniture/chair', x, y)
  cook.fixture('fixture/container/chest', 10, 11)
  cook.fixture('fixture/nature/plant', 1, 11)
  bed(cook, 1, 2, 'bed.0', [1, 3])
  cook.fixture('fixture/container/drawers', 3, 2)
  bed(cook, 5, 2, 'bed.3', [5, 3])
  bed(cook, 8, 2, 'bed.1', [8, 3])
  bed(cook, 12, 2, 'bed.2', [12, 3])
  cook.fixture('fixture/container/chest', 10, 2)
  // the watch house: the guard room by the door — the long table, the weapons, the hearth — and the bunks behind it
  const guards = house('meadow.guards', 'The Watch House', '守卫之家', 16, 8, 'stone', [[0, 0, 9, 8], [9, 0, 7, 8]], [[8, 4], [9, 4]], [4, 7], { floor: 'floor_stone' })
  guards.fixture('fixture/furniture/rack/arms', 2, 2)
  hearth(guards, 6, 1)
  guards.fixture('fixture/furniture/table/long', 4, 4)
  for (const [x, y] of [[2, 4], [6, 4]] as const) guards.fixture('fixture/furniture/chair', x, y)
  guards.fixture('fixture/container/barrel', 1, 6)
  guards.fixture('fixture/container/crate', 7, 6)
  bed(guards, 10, 2, 'bed.0', [10, 3])
  bed(guards, 12, 2, 'bed.1', [12, 3])
  bed(guards, 14, 2, 'bed.2', [14, 3])
  for (const x of [10, 14]) guards.fixture('fixture/container/chest', x, 6)
  guards.fixture('fixture/container/drawers', 12, 6)
  // the elder's house: his study (the village's books, his desk and its ledger) and his bedroom through the side
  const elder = house('meadow.elder', "The Elder's House", '村长的家', 16, 9, 'plaster', [[0, 0, 10, 9], [10, 0, 6, 6]], [[9, 3], [10, 3]], [5, 8])
  for (const x of [1, 2, 3]) elder.fixture('fixture/container/bookshelf', x, 2)
  hearth(elder, 7, 1)
  rug(elder, 3, 4, 5, 3)
  elder.fixture('fixture/furniture/table', 5, 5, { name: L("The elder's desk", '村长的书桌'), tags: ['readable'], props: { text: 'A ledger of the village: who came, who went, who was owed what. The last pages are about the storms.', text_zh: '村子的账簿：谁来了，谁走了，谁欠谁什么。最后几页写的都是风暴。' } })
  elder.fixture('fixture/furniture/chair', 5, 6)
  elder.fixture('fixture/nature/plant', 8, 7)
  elder.fixture('fixture/nature/plant', 1, 7)
  bed(elder, 11, 2, 'bed.0', [11, 3])
  elder.fixture('fixture/container/drawers', 13, 2)
  elder.fixture('fixture/container/chest', 14, 4)
  // the woodcutter's house: the hearth room with the wood stacked by the fire and Cass's own loom, the bedroom east
  const wood = house('meadow.woodhouse', "The Woodcutter's House", '樵夫之家', 16, 8, 'wood', [[0, 0, 10, 8], [10, 2, 6, 6]], [[9, 4], [10, 4]], [4, 7])
  hearth(wood, 2, 1)
  wood.fixture('fixture/container/woodpile', 4, 1, { statuses: { open: -1 } })
  wood.fixture('fixture/craft/loom', 7, 2, { name: L("Cass's loom", '卡丝的织布机'), props: { owner: 'npc.cass' } })
  wood.fixture('fixture/furniture/table', 3, 4)
  for (const x of [2, 4]) wood.fixture('fixture/furniture/chair', x, 4)
  wood.fixture('fixture/container/sack', 1, 6)
  wood.fixture('fixture/container/barrel', 8, 6)
  bed(wood, 12, 4, 'bed.0', [12, 5])
  bed(wood, 14, 4, 'bed.1', [14, 5])
  wood.fixture('fixture/container/drawers', 13, 4)
  // Joss the bridgewright's, in the lane: his workshop (the bench, the planks and the timber) and a narrow room to sleep
  const lane = house('meadow.lane', 'The House in the Lane', '小巷人家', 9, 11, 'plaster', [[0, 4, 9, 7], [0, 0, 6, 4]], [[3, 3], [3, 4]], [4, 10])
  lane.fixture('fixture/craft/workbench', 6, 6, { name: L("Joss's bench", '乔斯的木工台') })
  lane.fixture('fixture/container/crate', 7, 8, { name: L('Planks', '木板') }, ['item/material/plank', 'item/material/plank'])
  lane.fixture('fixture/nature/logpile/stack', 1, 6)
  lane.fixture('fixture/furniture/table', 3, 7)
  lane.fixture('fixture/furniture/chair', 2, 7)
  lane.fixture('fixture/container/barrel', 1, 9)
  bed(lane, 1, 2, 'bed.0', [2, 2])
  lane.fixture('fixture/container/drawers', 4, 2)
  // the little cabin (Edda's, after the knight): one warm room, its pantry through the side
  const cabin = house('meadow.cabin', 'The Little Cabin', '小木屋', 14, 8, 'wood', [[0, 0, 9, 8], [9, 2, 5, 5]], [[8, 4], [9, 4]], [4, 7])
  bed(cabin, 1, 2, 'bed.0', [2, 2])
  rug(cabin, 1, 3, 3, 2)
  hearth(cabin, 6, 1)
  cabin.fixture('fixture/furniture/table', 4, 4)
  cabin.fixture('fixture/furniture/chair', 5, 4)
  cabin.fixture('fixture/nature/plant', 7, 6)
  cabin.fixture('fixture/container/chest', 1, 6)
  for (const [x, y] of [[10, 3], [12, 3]] as const) cabin.fixture('fixture/container/barrel', x, y)
  cabin.fixture('fixture/container/sack', 12, 5)
  // the general store: the shop (shelves, the counter, Greta behind it), the storeroom behind it, her room
  const store = house('meadow.store', 'General Store', '杂货铺', 18, 9, 'wood', [[0, 0, 12, 9], [12, 0, 6, 5], [12, 5, 6, 4]], [[11, 2], [12, 2], [14, 4], [14, 5]], [6, 8], { music: 'shop' })
  // (the shelves stop a step short of the doorway into the storeroom: the cell before it is the way through)
  for (const x of [1, 2, 3, 7, 8, 9]) store.fixture('fixture/container/shelf', x, 2)
  store.fixture('fixture/furniture/counter/store', 5, 4, { id: 'store.counter', name: L("Greta's counter", '葛瑞塔的柜台'), statuses: { fireproof: -1 } })
  store.fixture('fixture/furniture/counter', 6, 4)
  store.anchor('keeper.counter', 5, 3)
  for (const [x, y] of [[1, 6], [10, 6]] as const) store.fixture('fixture/container/barrel', x, y)
  store.fixture('fixture/nature/plant', 1, 7)
  for (const [x, y] of [[13, 1], [16, 1], [16, 3]] as const) store.fixture('fixture/container/crate', x, y)
  store.fixture('fixture/container/sack', 13, 3)
  bed(store, 16, 7, 'keeper.bed', [15, 7])
  store.fixture('fixture/container/drawers', 13, 7)
  // the smithy: the forge and the anvil (anyone's to use, a hammer carried), Haldor at them; his room behind
  const smithy = house('meadow.smithy', 'The Smithy', '铁匠铺', 17, 9, 'stone', [[0, 0, 12, 9], [12, 3, 5, 6]], [[11, 5], [12, 5]], [6, 8], { floor: 'floor_stone' })
  smithy.fixture('fixture/craft/forge', 3, 2, { id: 'smithy.forge', name: L("Haldor's forge", '哈尔多的熔炉'), statuses: { lit: -1, fireproof: -1 } })
  smithy.fixture('fixture/craft/anvil', 6, 3, { id: 'smithy.anvil', name: L("Haldor's anvil", '哈尔多的铁砧') })
  smithy.anchor('smith.anvil', 7, 4)
  smithy.fixture('fixture/container/barrel', 1, 5, { name: L('Quench barrel', '淬火桶') })
  smithy.fixture('fixture/container/crate', 10, 6, { name: L('Coal crate', '煤箱') })
  smithy.fixture('fixture/furniture/rack/arms', 9, 2, { name: L("Haldor's finished blades", '哈尔多打好的兵器') })
  bed(smithy, 15, 5, 'smith.bed', [14, 6])
  smithy.fixture('fixture/container/chest', 15, 7)
  // Sister Ilse's chapel: the nave (the five wounds round Astra, candles, the pews, the bookstand of skill books and
  // Brother Anselm beside it), and the two cells either side of the altar where the sister and the brother sleep
  const church = house('meadow.church', 'Firstlight Chapel', '初原村礼拜堂', 22, 11, 'stone', [[4, 0, 14, 11], [0, 1, 4, 5], [18, 1, 4, 5]], [[3, 3], [4, 3], [17, 3], [18, 3]], [11, 10], { floor: 'floor_stone', music: 'temple' })
  church.fixture('fixture/sacred/altar', 11, 2, { name: L('The five wounds', '五道圣伤'), tags: ['readable'], props: { text: 'Five wounds carved in the stone round a figure of Astra, the First Martyr: the crown, the scourge, the scales, the nails, the lance. Here the village kneels to give thanks for the flame outside.', text_zh: '石壁上围着初殉者阿斯特拉的像，刻着五道圣伤：荆棘冠、鞭刑、天平、圣钉、圣枪。村里人就在这里跪下，为门外的圣火感恩。' } })
  for (const [x, y] of [[9, 2], [13, 2]] as const) church.fixture('fixture/light/candles', x, y, { statuses: { lit: -1 } })
  rug(church, 10, 3, 3, 7)
  for (const [x, y] of [[7, 5], [15, 5], [7, 7], [15, 7]] as const) church.fixture('fixture/furniture/bench/log', x, y)
  church.fixture('fixture/furniture/bookstand', 16, 2, { id: 'church.books', name: L('The bookstand', '技能书架'), statuses: { fireproof: -1 } })
  church.anchor('priest.stand', 16, 3)
  for (const x of [5, 16]) church.fixture('fixture/nature/plant', x, 9)
  bed(church, 1, 3, 'bed.1', [2, 3])
  bed(church, 20, 3, 'priest.bed', [19, 3])
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
