// Firstlight Village (docs/release-1.md §3), redrawn to the showcase's standard on 2026-10-26 (docs/showcase.md): the
// village's own buildings (tools/src/art/arch/buildings/firstlight.ts) on the cells its story keeps — the chapel's door
// on the step above Astra's altar, the square with its well, its fire and its boards where every scene and every test
// finds them — the ground laid in code round them, the woods, the roads, the lanes to each door, the yards with what
// the village lives by, and every front piled with what a house uses (stamped pictures, never things). Behind each door
// a house of rooms drawn as the showcase's halls are, on its own plan (plans.ts `fl*`), each household's beds, anchors
// and things where its people's days find them.
//
// The village grew east along the road from the Ford and south down the forest trail: the elder's, Marta's, the watch
// house and the woodcutter's round the square's north and west; the east road's trades — the general store (Greta
// behind its counter) and the smithy (Haldor at the forge and anvil inside); Sister Ilse's chapel behind Astra's altar
// and the flame (docs/chapter-1.md §7), Brother Anselm keeping the bookstand of skill books in it; Joss's house in the
// south lane and Edda's hut. The shops' offers: content village.ts.

import { CHAPEL_SIGN, FIRSTLIGHT } from '@openworld-game/content'
import { MapBuilder, rng, type Cell } from './builder.ts'
import { L } from './kit.ts'
import { planHall } from './showcase/halls.ts'
import type { Place } from './continent/generate.ts'
import { decor, festoons, piles, strew, unshut } from './showcase/dress.ts'

/** The village's buildings: the building, its footprint's top-left, its door's name (the house behind it, villageInteriors). */
export const TOWN: { door: string; building: string; at: Cell }[] = [
  { door: 'house.cook', building: 'fl_cook', at: [2, 4] },
  { door: 'house.elder', building: 'fl_elder', at: [14, 6] },
  // (its door, the second cell of its front, on the step above Astra's altar: quest/chapter1.ts)
  { door: 'church', building: 'fl_chapel', at: [23, 7] },
  { door: 'house.guards', building: 'fl_watch', at: [31, 6] },
  { door: 'house.wood', building: 'fl_wood', at: [2, 12] },
  { door: 'store', building: 'fl_store', at: [39, 13] },
  { door: 'smithy', building: 'fl_smithy', at: [48, 13] },
  { door: 'house.lane', building: 'fl_lane', at: [10, 30] },
  { door: 'house.cabin', building: 'fl_hut', at: [29, 31] },
]

/**
 * The village's ground: the woods round it (pines on the north side, broadleaf to the south, thickest in the corners),
 * the roads — west to Millbrook, east to the Ford, north to Dawn Hill, south to the grassland — on the cells the
 * neighbouring maps meet, the square of cobble before the chapel, the pond and its banks, the lanes.
 */
export function firstlightGround(m: MapBuilder): void {
  const W = m.w
  const H = m.h
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y)
      const corner = Math.min(Math.hypot(x, y), Math.hypot(W - 1 - x, y), Math.hypot(x, H - 1 - y), Math.hypot(W - 1 - x, H - 1 - y))
      const band = 2 + (rng.next() < 0.4 ? 1 : 0) + (corner < 9 ? 2 : 0)
      if (edge < band) m.set(x, y, y < H / 2 ? (rng.chance(0.7) ? 'pine' : 'tree') : rng.chance(0.75) ? 'tree' : 'pine')
    }
  // the roads: west, east (a cell wider where it meets the Ford), north and south
  m.rect(0, 17, 18, 3, 'path')
  m.rect(31, 17, W - 31, 3, 'path')
  m.rect(W - 6, 18, 6, 3, 'path')
  m.rect(24, 0, 3, 4, 'path')
  m.rect(24, 3, 7, 2, 'path')
  m.rect(29, 3, 2, 10, 'path')
  m.rect(22, 21, 3, H - 21, 'path')
  // the square before the chapel, its corners worn round
  m.rect(17, 13, 14, 8, 'cobble')
  for (const [x, y] of [[17, 13], [30, 13], [17, 20], [30, 20]] as Cell[]) m.set(x, y, 'path')
  // the pond south-west of the square (its reeds: villageLife), the meadow's damp corner by it
  m.organic(16.5, 22.5, 2.7, 1.7, 'water', { rough: 0.25 })
  // (the pond's eastern edge, where one stands at it: the anchor pond.edge)
  m.set(19, 21, 'grass')
}

/** Stamp the village's buildings with their doors, the trades' signs, the road's lamps and the village's banners. */
export function villageTown(m: MapBuilder): void {
  for (const h of TOWN) m.building(h.building, h.at[0], h.at[1], [h.door], true)
  m.building('march_watchtower', 47, 6)
  // the footpaths to every door, four-connected
  for (const pts of [[[6, 8], [6, 11], [12, 11], [17, 12]], [[17, 10], [17, 13]], [[34, 10], [34, 12], [30, 13]], [[12, 33], [12, 34], [22, 34]], [[31, 34], [24, 34]], [[5, 16], [5, 17]]] as Cell[][]) m.path(pts, 'path', 1, { over: (c) => c === 'grass' })
  m.fixture('fixture/sign', 40, 17, { id: 'village.store.sign', props: { text: "GENERAL STORE — Greta's. Lamps, rope, bread, potions; she buys herbs, hides and eggs.", text_zh: '杂货铺——葛瑞塔的店。灯、绳子、面包、药水；也收草药、皮子和鸡蛋。' } })
  m.fixture('fixture/sign', 49, 17, { id: 'village.smithy.sign', props: { text: 'SMITHY — the forge smelts ore with coal; the anvil, with a hammer in hand, makes gear. Haldor sells hammers.', text_zh: '铁匠铺——熔炉用煤把矿石炼成锭；手里拿着锻锤，在铁砧上打造装备。锻锤找哈尔多买。' } })
  m.fixture('fixture/sign', ...CHAPEL_SIGN.at, { id: CHAPEL_SIGN.id, props: { text: CHAPEL_SIGN.text, text_zh: CHAPEL_SIGN.text_zh } })
  // the road's lamps, from the square out to where the road comes in from the Ford
  for (const [x, y] of [[45, 20], [56, 16]] as const) m.fixture('fixture/light/lamppost', x, y, { id: `village.lamp.${x}`, statuses: { lit: -1 } })
  // the way in from the Ford: the village's green banners either side of the road, and its name
  for (const [x, y] of [[57, 16], [57, 21]] as const) m.scenery('banner_green', x, y)
  m.fixture('fixture/sign', 55, 21, { id: 'village.gate.sign', props: { text: 'FIRSTLIGHT VILLAGE. West, the square and the chapel; the Ford behind you.', text_zh: '初原村。往西是广场和礼拜堂；身后是渡口。' } })
}

/** The cells the village keeps open whatever is piled about: the square, the roads' crowns, every door's step. */
const OPEN: [number, number, number, number][] = [[16, 9, 16, 13], [0, 17, 60, 4], [21, 20, 5, 20], [23, 0, 9, 13]]
const open = (x: number, y: number) => OPEN.some(([ox, oy, w, h]) => x >= ox && y >= oy && x < ox + w && y < oy + h)

/**
 * What the village lives by, in its yards, fields and orchard, and the small things on its ground: each where it is
 * used, never strewn. The yards are rail fences with a gate on their path. Then every front piled with what a house
 * uses — casks, crates, sacks, firewood, hay — washing strung in the lanes, and the ground's own small things: petals,
 * puddles, straw (stamped pictures, never things: nothing here is a thing the village's story does not ask for).
 */
export function villageLife(m: MapBuilder): void {
  const grass = (t: string) => t === 'grass'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const water = (t: string) => t === 'water'
  const wall = (t: string) => t === 'wall' || t === 'woodwall' || t === 'door'
  const road = (t: string) => t === 'path' || t === 'dirt' || t === 'cobble'
  // Marta's kitchen patch west of her door, behind its rail
  m.yard(1, 9, 5, 3, 'rail', [[4, 11]])
  m.rect(2, 10, 3, 1, 'farmland')
  // the woodcutter's yard east of his house: the chopping stump, a stack of split logs, the wood pile, the bench
  m.fixture('fixture/nature/stump', 11, 13)
  m.fixture('fixture/nature/logpile/stack', 14, 13)
  // the drill yard by the watch house (Bram's): a straw man to strike and the weapon rack
  m.yard(39, 4, 8, 6, 'rail', [[39, 7]])
  m.fixture('fixture/dummy', 42, 6, { name: L('Training dummy', '训练假人') })
  m.fixture('fixture/furniture/rack/arms', 45, 8)
  // the store's and the smithy's frontage: barrels and a crate by the doors
  m.fixture('fixture/container/barrel', 38, 16)
  m.fixture('fixture/container/crate', 56, 15)
  // the trough on the road by the square, for the drovers' beasts
  m.fixture('fixture/water/trough', 35, 20, { id: 'village.trough' })
  // the hay meadow north-east, over the road: the summer's hay in stacks
  for (const [x, y] of [[51, 5], [54, 8], [51, 10], [55, 4]] as const) m.fixture('fixture/nature/haystack', x, y)
  m.sprinkle('fixture/nature/tuft', 0.22, (x, y, t) => grass(t) && !m.near(x, y, tree, 1), [50, 3, 7, 9])
  // the fields south of the road behind their fence, in their strips, the scarecrow over them
  m.yard(33, 24, 12, 9, 'rail', [[33, 27]])
  for (const y of [25, 26, 28, 29, 31]) m.rect(34, y, 10, 1, 'farmland')
  m.fixture('fixture/scarecrow', 39, 28)
  // the churchyard in its clearing in the south-west: a stone wall, the village's dead, the gate on the path
  m.yard(2, 25, 8, 6, 'stonewall', [[9, 27]])
  for (const [x, y] of [[4, 26], [6, 26], [8, 26], [4, 28], [6, 28]] as const) m.fixture('fixture/sacred/gravestone', x, y)
  // the orchard south-east: its trees in rows, the hives under them
  for (let y = 23; y < 35; y += 3) for (let x = 47 + (y % 2); x < 56; x += 3) if (grass(m.get(x, y))) m.set(x, y, 'tree')
  for (const [x, y] of [[49, 29], [52, 32]] as const) m.fixture('fixture/nature/beehive', x, y)
  // the house in the lane: its garden behind a rail, the washing line by its west wall
  m.yard(17, 29, 5, 4, 'rail', [[17, 31]])
  m.rect(18, 30, 3, 2, 'farmland')
  m.fixture('fixture/furniture/washing_line', 8, 33, { id: 'village.washing' })
  // the pond's reeds
  m.sprinkle('fixture/nature/reeds', 0.45, (x, y, t) => grass(t) && m.near(x, y, water) && y >= 20 && y <= 25 && x >= 12 && x <= 21)
  // flowers grown wild in the grass, trees standing in the open, hedges along the fields and the churchyard
  for (const [x, y, rx, ry] of [[28, 29, 3, 2], [6, 35, 3, 1.5], [45, 22, 3, 1.5], [14, 27, 2, 1.5], [37, 35, 3, 1], [52, 22, 2, 1], [3, 21, 2, 1.5]] as const) m.organic(x, y, rx, ry, 'flowers', { rough: 0.5, only: grass })
  for (const [x, y] of [[26, 31], [13, 28], [46, 23], [36, 22], [2, 23], [20, 27], [32, 28], [42, 35], [8, 23], [56, 23]] as Cell[]) if (grass(m.get(x, y)) && !m.near(x, y, (t) => t === 'path' || t === 'door', 1)) m.set(x, y, 'tree')
  for (let x = 33; x < 45; x += 2) if (grass(m.get(x, 33))) m.set(x, 33, 'bush')
  for (let y = 25; y < 31; y += 2) if (grass(m.get(1, y))) m.set(1, y, 'bush')
  // the piles at every wall's foot off the square, washing over the lanes, the ground's small things
  piles(m, 0, 0, 16, 40, 'poor', 0.4)
  piles(m, 31, 0, 29, 17, 'poor', 0.45)
  piles(m, 25, 21, 35, 19, 'poor', 0.4)
  for (const [name, x, y] of [['decor_firewood', 10, 15], ['decor_firewood', 2, 16], ['decor_hay', 47, 12], ['decor_casks', 36, 15], ['decor_crates', 47, 15], ['decor_sacks', 56, 13], ['decor_cart', 52, 20], ['decor_flowerstand', 18, 10], ['decor_birdbath', 21, 9], ['decor_planter', 11, 8], ['decor_hay', 14, 15], ['decor_amphorae', 33, 30], ['decor_cart', 10, 22], ['decor_hay', 45, 26], ['decor_cart', 45, 30], ['decor_firewood', 35, 32], ['decor_signpost', 52, 21], ['decor_sacks', 28, 33], ['decor_hay', 46, 13], ['decor_planter', 22, 9], ['decor_flowerstand', 37, 13]] as [string, number, number][])
    if (!open(x, y)) decor(m, name, x, y)
  festoons(m, 2, 9, 34, ['washing'], 0.8)
  festoons(m, 26, 36, 35, ['washing'], 0.8)
  strew(m, 0, 0, m.w, m.h, 0.1, 'poor')
  // flowers under the windows and along the lanes; tufts in the open; leaves under the woods' edge
  m.sprinkle('fixture/nature/flowers', 0.3, (x, y, t) => grass(t) && m.near(x, y, wall, 1) && !m.near(x, y, (c) => c === 'door', 1))
  m.sprinkle('fixture/nature/flowers', 0.08, (x, y, t) => grass(t) && m.near(x, y, road, 1) && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.04, (x, y, t) => grass(t) && !m.near(x, y, tree, 1) && !m.near(x, y, road, 1))
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => grass(t) && m.near(x, y, tree))
  unshut(m)
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
/** A bed and the anchor beside it where its sleeper lies down. */
const bed = (m: MapBuilder, x: number, y: number, anchor: string, at: [number, number]) => {
  m.fixture('fixture/furniture/bed', x, y)
  m.anchor(anchor, ...at)
}
const hearth = (m: MapBuilder, x: number, y: number) => m.fixture('fixture/light/fireplace', x, y, { statuses: { lit: -1 } })

/** The village as the place its houses' halls are made for (their region, their names). */
const PLACE = { id: FIRSTLIGHT.map, name: FIRSTLIGHT.name, region: 'frostfang' } as unknown as Place

/**
 * A house of Firstlight's: its plan's hall (plans.ts, its walls the plan's shell), the village's own (no backdrop), its
 * rooms recorded as the house's rooms (`shell`: their walls are the shell's picture, not a frame of the pack's).
 */
export function flHouse(key: Parameters<typeof planHall>[1], id: string, en: string, zh: string, floor: string, rooms: string[], opts: Parameters<typeof planHall>[5] = {}) {
  const { m, P } = planHall(PLACE, key, id, L(en, zh), floor, opts)
  m.backdrop = false
  for (const r of rooms) m.rooms.push({ style: 'shell', x: P[r].x - 1, y: P[r].y - 1, w: P[r].w + 2, h: P[r].h + 2 })
  return { m, P }
}

export function villageInteriors(): Interior[] {
  // Marta's house, the village's biggest family: the kitchen and the family's long table by the door; above it her room
  // (Lina's bed by hers) and the children's, each through its own doorway
  const { m: cook, P: CK } = flHouse('flcook', 'meadow.cook', "Marta's House", '玛尔塔家', 'floor_wood', ['kitchen', 'marta', 'kids'])
  {
    const K = CK.kitchen
    hearth(cook, K.x, K.y)
    cook.fixture('fixture/container/cupboard', K.x + 4, K.y, { name: L("Marta's cupboard", '玛尔塔的橱柜') })
    cook.fixture('fixture/container/pot', K.x + 6, K.y)
    cook.fixture('fixture/container/pot', K.x + 7, K.y)
    cook.fixture('fixture/container/barrel', K.x + 10, K.y)
    cook.fixture('fixture/container/sack', K.x + 10, K.y + 2)
    rug(cook, K.x + 3, K.y + 3, 6, 3)
    // (a long table is three cells wide: its chairs off its ends and along its sides)
    cook.fixture('fixture/furniture/table/long', K.x + 6, K.y + 4)
    for (const [x, y] of [[K.x + 4, K.y + 4], [K.x + 8, K.y + 4], [K.x + 5, K.y + 5], [K.x + 7, K.y + 5], [K.x + 6, K.y + 3]] as const) cook.fixture('fixture/furniture/chair', x, y)
    cook.fixture('fixture/container/chest', K.x + 10, K.y + 7)
    cook.fixture('fixture/nature/plant', K.x, K.y + 5)
    cook.building('decor_firewood', K.x + 1, K.y + 5)
    cook.building('decor_sacks', K.x + 8, K.y)
    const R = CK.marta
    bed(cook, R.x, R.y + 1, 'bed.0', [R.x, R.y + 2])
    cook.fixture('fixture/container/drawers', R.x + 2, R.y)
    bed(cook, R.x + 3, R.y + 1, 'bed.3', [R.x + 3, R.y + 2])
    const C = CK.kids
    bed(cook, C.x + 1, C.y + 1, 'bed.1', [C.x + 1, C.y + 2])
    cook.fixture('fixture/container/chest', C.x + 2, C.y)
    bed(cook, C.x + 4, C.y + 1, 'bed.2', [C.x + 4, C.y + 2])
    cook.building('decor_rug', C.x + 1, C.y + 5)
  }
  // the watch house: the guard room by the door — the long table, the weapons, the hearth — and the bunks through the arch
  const { m: guards, P: GD } = flHouse('flwatch', 'meadow.guards', 'The Watch House', '守卫之家', 'floor_stone', ['guard', 'bunks'])
  {
    const G = GD.guard
    guards.fixture('fixture/furniture/rack/arms', G.x, G.y)
    guards.fixture('fixture/furniture/rack/arms', G.x + 1, G.y)
    hearth(guards, G.x + 6, G.y)
    guards.fixture('fixture/furniture/table/long', G.x + 4, G.y + 3)
    for (const [x, y] of [[G.x + 2, G.y + 3], [G.x + 6, G.y + 3]] as const) guards.fixture('fixture/furniture/chair', x, y)
    guards.fixture('fixture/container/barrel', G.x, G.y + 6)
    guards.fixture('fixture/container/crate', G.x + 8, G.y + 6)
    guards.building('decor_casks', G.x + 8, G.y)
    const B = GD.bunks
    bed(guards, B.x, B.y + 1, 'bed.0', [B.x, B.y + 2])
    bed(guards, B.x + 2, B.y + 1, 'bed.1', [B.x + 2, B.y + 2])
    bed(guards, B.x + 4, B.y + 1, 'bed.2', [B.x + 4, B.y + 2])
    for (const x of [B.x + 1, B.x + 5]) guards.fixture('fixture/container/chest', x, B.y + 6)
    guards.fixture('fixture/container/drawers', B.x + 3, B.y + 6)
  }
  // the elder's house: his study (the village's books, his desk and its ledger) and his bedroom through the arch
  const { m: elder, P: EL } = flHouse('flelder', 'meadow.elder', "The Elder's House", '村长的家', 'parquet', ['study', 'bedroom'])
  {
    const S = EL.study
    for (const x of [S.x, S.x + 1, S.x + 2]) elder.fixture('fixture/container/bookshelf', x, S.y)
    hearth(elder, S.x + 7, S.y)
    rug(elder, S.x + 2, S.y + 3, 5, 3)
    elder.fixture('fixture/furniture/table', S.x + 4, S.y + 4, { name: L("The elder's desk", '村长的书桌'), tags: ['readable'], props: { text: 'The village ledger: who came, who went, who was owed what. The last pages are all about the storm.', text_zh: '村里的账簿，记着谁来了、谁走了、谁欠谁什么。最后几页记的全是那场风暴。' } })
    elder.fixture('fixture/furniture/chair', S.x + 4, S.y + 5)
    elder.fixture('fixture/nature/plant', S.x + 9, S.y + 7)
    elder.fixture('fixture/nature/plant', S.x, S.y + 7)
    elder.building('decor_amphorae', S.x + 9, S.y)
    const R = EL.bedroom
    bed(elder, R.x + 1, R.y + 1, 'bed.0', [R.x + 1, R.y + 2])
    elder.fixture('fixture/container/drawers', R.x + 3, R.y)
    elder.fixture('fixture/container/chest', R.x + 5, R.y + 4)
  }
  // the woodcutter's house: the hearth room with the wood stacked by the fire and Cass's own loom, the bedroom east
  const { m: wood, P: WD } = flHouse('flwood', 'meadow.woodhouse', "The Woodcutter's House", '樵夫之家', 'floor_wood', ['hearth', 'bedroom'])
  {
    const Hr = WD.hearth
    hearth(wood, Hr.x, Hr.y)
    wood.fixture('fixture/container/woodpile', Hr.x + 2, Hr.y, { statuses: { open: -1 } })
    wood.fixture('fixture/craft/loom', Hr.x + 6, Hr.y + 1, { name: L("Cass's loom", '卡丝的织布机'), props: { owner: 'npc.cass' } })
    wood.fixture('fixture/furniture/table', Hr.x + 2, Hr.y + 3)
    for (const x of [Hr.x + 1, Hr.x + 3]) wood.fixture('fixture/furniture/chair', x, Hr.y + 3)
    wood.fixture('fixture/container/sack', Hr.x, Hr.y + 6)
    wood.fixture('fixture/container/barrel', Hr.x + 9, Hr.y + 6)
    wood.building('decor_firewood', Hr.x + 8, Hr.y)
    wood.building('decor_rug', Hr.x + 2, Hr.y + 5)
    const R = WD.bedroom
    bed(wood, R.x + 1, R.y + 1, 'bed.0', [R.x + 1, R.y + 2])
    bed(wood, R.x + 4, R.y + 1, 'bed.1', [R.x + 4, R.y + 2])
    wood.fixture('fixture/container/drawers', R.x + 2, R.y)
  }
  // Joss the bridgewright's, in the lane: his workshop (the bench, the planks and the timber) and a narrow room to sleep
  const { m: lane, P: LN } = flHouse('fllane', 'meadow.lane', 'The House in the Lane', '小巷人家', 'floor_wood', ['shop', 'sleep'])
  {
    const S = LN.shop
    lane.fixture('fixture/craft/workbench', S.x + 5, S.y + 1, { name: L("Joss's bench", '乔斯的木工台') })
    lane.fixture('fixture/container/crate', S.x + 7, S.y + 1, { name: L('Planks', '木板') }, ['item/material/plank', 'item/material/plank'])
    lane.fixture('fixture/nature/logpile/stack', S.x, S.y + 1)
    lane.fixture('fixture/furniture/table', S.x + 2, S.y + 4)
    lane.fixture('fixture/furniture/chair', S.x + 1, S.y + 4)
    lane.fixture('fixture/container/barrel', S.x, S.y + 6)
    lane.building('decor_firewood', S.x + 6, S.y + 6)
    const R = LN.sleep
    bed(lane, R.x, R.y + 1, 'bed.0', [R.x + 1, R.y + 1])
    lane.fixture('fixture/container/drawers', R.x + 3, R.y)
  }
  // the little cabin (Edda's, after the knight): one warm room, its pantry through the side
  const { m: cabin, P: CB } = flHouse('flcabin', 'meadow.cabin', 'The Little Cabin', '小木屋', 'floor_wood', ['room', 'pantry'])
  {
    const R = CB.room
    bed(cabin, R.x, R.y + 1, 'bed.0', [R.x + 1, R.y + 1])
    rug(cabin, R.x, R.y + 2, 3, 2)
    hearth(cabin, R.x + 6, R.y)
    cabin.fixture('fixture/furniture/table', R.x + 3, R.y + 4)
    cabin.fixture('fixture/furniture/chair', R.x + 4, R.y + 4)
    cabin.fixture('fixture/nature/plant', R.x + 7, R.y + 7)
    cabin.fixture('fixture/container/chest', R.x, R.y + 6)
    const Pn = CB.pantry
    for (const x of [Pn.x, Pn.x + 2]) cabin.fixture('fixture/container/barrel', x, Pn.y)
    cabin.fixture('fixture/container/sack', Pn.x + 2, Pn.y + 3)
    cabin.building('decor_sacks', Pn.x, Pn.y + 3)
  }
  // the general store: the shop (shelves, the counter, Greta behind it), the storeroom behind it, her room
  const { m: store, P: ST } = flHouse('flstore', 'meadow.store', 'General Store', '杂货铺', 'floor_wood', ['shop', 'store', 'room'], { music: 'shop' })
  {
    const S = ST.shop
    for (const x of [S.x, S.x + 1, S.x + 2, S.x + 6, S.x + 7, S.x + 8]) store.fixture('fixture/container/shelf', x, S.y)
    store.fixture('fixture/furniture/counter/store', S.x + 4, S.y + 3, { id: 'store.counter', name: L("Greta's counter", '葛瑞塔的柜台'), statuses: { fireproof: -1 } })
    store.fixture('fixture/furniture/counter', S.x + 5, S.y + 3)
    store.anchor('keeper.counter', S.x + 4, S.y + 2)
    for (const [x, y] of [[S.x, S.y + 5], [S.x + 10, S.y + 6]] as const) store.fixture('fixture/container/barrel', x, y)
    store.fixture('fixture/nature/plant', S.x, S.y + 7)
    store.building('decor_crates_row', S.x + 8, S.y + 7)
    const R = ST.store
    for (const [x, y] of [[R.x + 1, R.y], [R.x + 4, R.y], [R.x + 4, R.y + 6]] as const) store.fixture('fixture/container/crate', x, y)
    store.fixture('fixture/container/sack', R.x + 1, R.y + 6)
    store.building('decor_sacks', R.x + 2, R.y + 8)
    const G = ST.room
    bed(store, G.x + 4, G.y + 1, 'keeper.bed', [G.x + 3, G.y + 1])
    store.fixture('fixture/container/drawers', G.x + 1, G.y)
  }
  // the smithy: the forge and the anvil (anyone's to use, a hammer carried), Haldor at them; his room through the arch
  const { m: smithy, P: SM } = flHouse('flsmithy', 'meadow.smithy', 'The Smithy', '铁匠铺', 'floor_stone', ['forge', 'room'])
  {
    const F = SM.forge
    smithy.fixture('fixture/craft/forge', F.x + 1, F.y, { id: 'smithy.forge', name: L("Haldor's forge", '哈尔多的熔炉'), statuses: { lit: -1, fireproof: -1 } })
    smithy.fixture('fixture/craft/anvil', F.x + 4, F.y + 1, { id: 'smithy.anvil', name: L("Haldor's anvil", '哈尔多的铁砧') })
    smithy.anchor('smith.anvil', F.x + 5, F.y + 2)
    smithy.fixture('fixture/container/barrel', F.x, F.y + 4, { name: L('Quench barrel', '淬火桶') })
    smithy.fixture('fixture/container/crate', F.x + 10, F.y + 5, { name: L('Coal crate', '煤箱') })
    smithy.fixture('fixture/furniture/rack/arms', F.x + 9, F.y, { name: L("Haldor's finished blades", '哈尔多打好的兵器') })
    smithy.building('decor_sacks', F.x + 10, F.y + 7)
    smithy.building('decor_firewood', F.x, F.y + 7)
    const R = SM.room
    bed(smithy, R.x + 4, R.y + 1, 'smith.bed', [R.x + 3, R.y + 1])
    smithy.fixture('fixture/container/chest', R.x + 4, R.y + 4)
  }
  // Sister Ilse's chapel: the nave (the five wounds round Astra, candles, the pews, the bookstand of skill books and
  // Brother Anselm beside it), and the two cells either side of it where the sister and the brother sleep
  const { m: church, P: CH } = flHouse('flchurch', 'meadow.church', 'Firstlight Chapel', '初原村礼拜堂', 'floor_stone', ['nave', 'cellW', 'cellE'], { music: 'temple' })
  {
    const N = CH.nave
    church.fixture('fixture/sacred/altar', N.x + 6, N.y, { name: L('The five wounds', '五道圣伤'), tags: ['readable'], props: { text: 'A figure of Astra, the First Martyr, carved in the stone, and round it his five wounds: the crown, the scourge, the scales, the nails, the lance. The flags before it are worn hollow where the village kneels to give thanks for the flame outside.', text_zh: '石壁上刻着初殉者阿斯特拉的像，四周是五道圣伤：荆棘冠、鞭刑柱、天平、圣钉、圣枪。像前的石板磨出了浅坑，村里人常跪在这里，为门外的圣火谢恩。' } })
    for (const x of [N.x + 4, N.x + 8]) church.fixture('fixture/light/candles', x, N.y, { statuses: { lit: -1 } })
    rug(church, N.x + 5, N.y + 1, 3, N.h - 1)
    for (const y of [N.y + 4, N.y + 6, N.y + 8]) for (const x of [N.x + 2, N.x + 10]) church.fixture('fixture/furniture/bench/log', x, y)
    church.fixture('fixture/furniture/bookstand', N.x + 11, N.y, { id: 'church.books', name: L('The bookstand', '技能书架'), statuses: { fireproof: -1 } })
    church.anchor('priest.stand', N.x + 11, N.y + 1)
    for (const x of [N.x + 1, N.x + 12]) church.fixture('fixture/nature/plant', x, N.y + N.h - 2)
    bed(church, CH.cellW.x, CH.cellW.y + 1, 'bed.1', [CH.cellW.x + 1, CH.cellW.y + 1])
    bed(church, CH.cellE.x + 2, CH.cellE.y + 1, 'priest.bed', [CH.cellE.x + 1, CH.cellE.y + 1])
  }
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
