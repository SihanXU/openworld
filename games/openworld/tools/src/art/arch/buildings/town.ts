// The Holy City's streets (docs/showcase.md §4.2, §4.5, §4.6): its townhouses — tall, narrow, stone below and washed
// or timbered above, gables to the street like Bruges's and Rothenburg's, eaves like Prague's — the Bell Ward's hall
// with its belfry (Bruges's Belfort over the Markt), the tower gate at the fork (Rothenburg's Plönlein), the guild hall,
// the Lamp Ward's great inn and the Lower Town's crooked houses, its tavern and its crane on the quay.

import type { Model } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, gable, merlons, octagon, recess, spire, type Solid } from '../shapes.ts'
import { banner, clock, cross, door, opening } from '../ornaments.ts'
import { hall, house, rows, S, solidFootprint, tower, type HouseOpts2, type HousePlan } from '../kit.ts'
import { hash } from '../materials.ts'

const WASHES = ['plaster', 'plasterRose', 'plasterOchre', 'plasterBlue', 'plasterWhite']

/** The trade each townhouse keeps on its ground floor, by its index (none: a home); street.ts reads it for the rooms. */
type Trade = NonNullable<HouseOpts2['shop']>['sign']
export const HOUSE_SHOPS: (Trade | undefined)[] = ['bread', 'cup', 'key', 'boot', 'cloth', 'book', 'scale', undefined, undefined, 'fish', undefined, 'anvil', 'bread', 'cloth', 'cup', 'scale', 'boot', undefined, 'book', 'fish', undefined, 'key', 'cloth', undefined, 'bread', 'anvil', undefined, 'cup']

/** What each trade sets out in its open arch, rows of the goods' keys (kit.ts GOODS_KEYS). */
const WARES: Record<string, string[]> = {
  bread: [' bb  bb  bb  bb ', 'bBbbbBbbbBbbbBbb', 'oyoyoyoyoyoyoyoy'],
  cup: ['  pp  pp  pp  pp', ' pPPppPPppPPppPP', 'kpppkpppkpppkppp'],
  key: [' f  F  f  F  f ', 'fFf FfF fFf FfF', ' F  f  F  f  F '],
  boot: [' BB   BB   BB ', ' BB   BB   BB ', 'BBBB BBBB BBBB'],
  cloth: ['cccCCCwwwcccCCC', 'cccCCCwwwcccCCC', 'cccCCCwwwcccCCC'],
  book: ['CcBCcbCuBcCbuCB', 'CcBCcbCuBcCbuCB', 'kkkkkkkkkkkkkkk'],
  scale: ['   y      y   ', '  yyy    yyy  ', 'yyyyyyyyyyyyyy', 'gGrRoygGrRoygG'],
  fish: [' ff  FF  ff  F ', 'fffFFFffffFFFff', 'sssssssssssssss'],
  anvil: [' FFFF    fff  ', 'FFFFFF  fffff ', '  FF     FFF  '],
}
const CANVAS = ['canvasRed', 'canvasBlue', 'canvasYellow', 'canvasGreen'] as const
const SHUTTERS = ['cg', 'cb', 'cr', 'cy'] as const
const BLOOMS = ['cr0', 'cy0', 'cw0', 'pk1', 'cb0']

/**
 * The townhouses of the streets (kit.ts `house`): as wide as a shop and its door, two or three storeys of a man's height
 * and a head, each its own width, wash, roof, trade and face from its seed — Bruges's and Colmar's fronts of shops
 * under awnings, flowers at their windows, balconies, gablets and dormers.
 */
/** How many storeys over its ground floor a townhouse has: two or one. */
const upperOf = (i: number) => (hash(i, 3, 77) < 0.4 ? 2 : 1)
const HOUSES = HOUSE_SHOPS.length
const HOVELS = 12
/** The townhouses by height: the low ones' roofs hide less of the street behind them (docs/showcase.md §4). */
export const LOW_HOUSES = Array.from({ length: HOUSES }, (_, i) => i).filter((i) => upperOf(i) === 1).map((i) => `town_house_${i}`)
export const TALL_HOUSES = Array.from({ length: HOUSES }, (_, i) => i).filter((i) => upperOf(i) === 2).map((i) => `town_house_${i}`)
export const HOVEL_NAMES = Array.from({ length: HOVELS }, (_, i) => `town_hovel_${i}`)

/**
 * How a house stands to its street, by its seed (kit.ts HousePlan): its eaves along it, its gable to it, a wing brought
 * forward at an end or a bay in the middle — never two alike in a row, so a street's roofs run every way (the user's ask
 * of 2026-10-25: "不规律的美"). A gable front is a narrower house; a bay takes the door, so a shop keeps to the others.
 */
function planOf(r: (k: number) => number, w: number, shop: boolean): { plan: HousePlan; w: number; wing?: [number, number] } {
  const t = r(40)
  if (t < 0.24) return { plan: 'eaves', w }
  if (t < 0.44) return { plan: 'gable', w: Math.min(w, 6 + Math.floor(r(41) * 3)) }
  if (t < 0.78 || shop) {
    const ww = Math.min(3 + Math.floor(r(42) * 3), w - (shop ? 6 : 4))
    if (ww < 3) return { plan: 'eaves', w }
    return { plan: r(43) < 0.5 ? 'wingW' : 'wingE', w, wing: [ww, 1 + Math.floor(r(44) * 2)] }
  }
  return { plan: 'bay', w, wing: [3 + Math.floor(r(45) * 2), 1 + Math.floor(r(46) * 2)] }
}

/** A townhouse's shape by its index, as houses() makes it. */
const shapeOf = (i: number) => planOf((k: number) => hash(i, k, 77), 7 + Math.floor(hash(i, 1, 77) * 5), !!HOUSE_SHOPS[i])
/** The low townhouses no wider than seven cells, for the narrow plots (a quay's, the ends of a square). */
export const NARROW_HOUSES = LOW_HOUSES.filter((n) => shapeOf(Number(n.slice('town_house_'.length))).w <= 7)

function houses(): Record<string, () => Model> {
  const out: Record<string, () => Model> = {}
  for (let i = 0; i < HOUSES; i++) {
    const r = (k: number) => hash(i, k, 77)
    const name = `town_house_${i}`
    const trade = HOUSE_SHOPS[i]
    const upper = upperOf(i)
    const wall = WASHES[Math.floor(r(4) * WASHES.length)]
    const gablet = r(6) < 0.5
    const shape = shapeOf(i)
    const o: HouseOpts2 = {
      name,
      ...shape,
      d: r(47) < 0.4 ? 4 : 3,
      upper,
      wall,
      roof: r(5) < 0.6 ? 'tile' : 'slate',
      timber: r(7) < 0.45,
      seed: i * 13 + 5,
      shop: trade ? { sign: trade, goods: WARES[trade], canvas: CANVAS[Math.floor(r(8) * 4)] } : undefined,
      balcony: r(9) < 0.45 && (upper === 2 || !gablet),
      gablet,
      stoneBelow: r(10) < 0.65,
      shutters: SHUTTERS[Math.floor(r(11) * 4)],
      bloom: r(12) < 0.75 ? BLOOMS[Math.floor(r(13) * BLOOMS.length)] : undefined,
      ivy: r(14) < 0.25,
      banner: !trade && r(15) < 0.5 ? (r(16) < 0.5 ? 'U' : 'E') : undefined,
    }
    out[name] = () => house(o)
  }
  // the Lower Town's: lower, poorer, timber and thatch, a lean-to against one end
  for (let i = 0; i < HOVELS; i++) {
    const r = (k: number) => hash(i, k, 91)
    const name = `town_hovel_${i}`
    out[name] = () =>
      house({ name, ...planOf(r, 6 + Math.floor(r(1) * 3), false), d: r(47) < 0.3 ? 4 : 3, upper: r(6) < 0.5 ? 1 : 0, wall: r(2) < 0.5 ? 'plaster' : 'plasterOchre', roof: r(3) < 0.6 ? 'thatch' : 'tile', timber: true, seed: 300 + i, poor: true, shutters: 'cg', ivy: r(4) < 0.4 })
  }
  return out
}

/**
 * The Bell Ward's hall and its belfry (Bruges's Belfort): a long hall of three storeys under a steep roof, its parapet
 * crenellated with corner turrets; the belfry rising from its front's middle — square to the hall's roof, square again
 * with its great clock, then the octagon of the bells, a gilt spire over them; the gate through its foot into the hall.
 */
function townHall(): Model {
  const w = 18
  const d = 7
  const W = w * S
  const D = d * S
  const fp = solidFootprint(w, d + 1)
  const solids: Solid[] = []
  const voids: import('../shapes.ts').Solid[] = []
  const orn: import('../oblique.ts').Ornament[] = []
  const H = 112
  solids.push(box(0, 0, 0, W, D, H, 'stone'))
  solids.push(gable(-2, -2, W + 2, D + 2, H, 64, 'x', 'slate', 'stone'))
  solids.push(merlons(-2, D - 2, W + 2, D + 3, H, 6, 5, 4, 'x', 'stone'))
  for (const tx of [6, W - 6]) {
    solids.push(octagon(tx, D - 4, 8, H - 20, H + 30, 'stone'))
    solids.push(spire(tx, D - 4, 9, H + 30, 34, 8, 'slate'))
  }
  // the hall's windows: tall lancets in pairs on the upper floor, rect below; the arcade of its market floor
  for (let c = 1; c < w - 1; c++) {
    if (c >= 6 && c < 12) continue
    const cx = c * S + S / 2
    voids.push(...recess(cx, D, 58, 9, 40, 3, 'pointed'))
    solids.push(doorSlab(cx, backOf(D, 3), 58, 7, 38, 'pointed', 'dark'))
    voids.push(archNS(cx, D - 3, D + 1, 0, 12, 32, 'pointed'))
  }
  // the belfry: its foot over the gate, projecting a cell before the hall
  const bx0 = 6 * S
  const bx1 = 12 * S
  const by0 = D - 4 * S
  const by1 = D + S
  solids.push(box(bx0, by0, 0, bx1, by1, 196, 'stone'))
  solids.push(merlons(bx0 - 2, by1 - 3, bx1 + 2, by1 + 2, 196, 7, 5, 4, 'x', 'stone'))
  for (const [x, y] of [[bx0 + 6, by1 - 6], [bx1 - 6, by1 - 6]]) {
    solids.push(octagon(x, y, 7, 160, 214, 'stone'))
    solids.push(spire(x, y, 8, 214, 30, 8, 'slate'))
  }
  // the octagon of the bells, its openings, the spire and its gilt
  const ox = (bx0 + bx1) / 2
  const oy = (by0 + by1) / 2
  solids.push(octagon(ox, oy, 38, 196, 276, 'stone'))
  for (const dx of [-18, 0, 18]) voids.push(...recess(ox + dx, oy + 36, 214, 10, 40, 4, 'pointed'))
  for (const dx of [-18, 0, 18]) orn.push(opening(8, 38, 'pointed', true).at(ox + dx - 4, oy + 32, 214))
  solids.push(octagon(ox, oy, 41, 272, 280, 'stone'))
  solids.push(spire(ox, oy, 34, 280, 86, 8, 'lead'))
  orn.push(cross(11).at(ox - 2, oy, 280 + 84, true))
  orn.push(clock(15).at(ox - 15, by1, 132))
  // the gate through the belfry's foot, the great door into the hall at its back
  voids.push(...recess(ox, by1, 0, 50, 72, 16, 'pointed', 4, 4))
  solids.push(doorSlab(ox, backOf(by1, 16), 0, 34, 58, 'pointed'))
  orn.push(door(34, 58, 'pointed').at(ox - 17, backOf(by1, 16) - 1, 0))
  for (const dx of [-28, 28]) orn.push(banner(10, 30, 'U').at(ox + dx - 5, by1, 80))
  for (let x = 0; x < w; x++) fp[d][x] = x >= 6 && x < 12 ? '#' : ' '
  fp[d][8] = 'D'
  fp[d][9] = 'D'
  return { name: 'town_hall', footprint: rows(fp), solids, voids, ornaments: orn }
}

/** The tower gate at the fork (Rothenburg's Plönlein): a tall square tower, a passage through it, a steep roof. */
function gateTower(): Model {
  const m = tower({ name: 'town_gate_tower', size: 4, round: false, height: 150, wall: 'plasterOchre', top: 'pyramid', roof: 'tile', passage: true, clock: true })
  return m
}

/** The guild hall: stone, a stepped gable to the square, an arcade under it, the guild's banner. */
function guildHall(): Model {
  const m = hall({ name: 'town_guild', w: 8, d: 7, wall: 'stone', roof: 'slate', storeys: 3, storeyH: 36, ridge: 'y', doors: [4], doorKind: 'round', windows: 'rect', arcade: true, banners: 'U', seed: 31 })
  // the stepped gable over the front
  const W = 8 * S
  for (let k = 0; k < 5; k++) m.solids.push(box(k * 8, 7 * S - 6, 108, W - k * 8, 7 * S, 108 + 14 + k * 12, 'stone'))
  return m
}

/** The great inn of the Lamp Ward: three storeys over a stone ground floor, galleries to its yard, a lantern at every window. */
function inn(): Model {
  return house({ name: 'town_inn', w: 13, d: 4, upper: 2, wall: 'plasterOchre', roof: 'tile', timber: true, stoneBelow: true, seed: 41, door: 6, sign: 'bed', balcony: true, gablet: true, shutters: 'cr', bloom: 'cr0', banner: 'U' })
}

/** The Lamp Ward's teahouses: a shop of cups open on the square under its awning, rooms over it. */
function teahouse(i: number): Model {
  return house({ name: `town_teahouse_${i}`, w: 8, upper: 1, wall: i ? 'plasterRose' : 'plasterWhite', roof: i ? 'tile' : 'slate', timber: !!i, stoneBelow: true, seed: 61 + i, door: 1, shop: { sign: 'cup', goods: WARES.cup, canvas: i ? 'canvasGreen' : 'canvasRed' }, gablet: !i, shutters: i ? 'cb' : 'cg', bloom: i ? 'cy0' : 'cr0', ivy: !!i })
}

/** The Lower Town's tavern: low and wide, timber, a porch of beams over the door, a barrel sign. */
function tavern(): Model {
  return house({ name: 'town_tavern', w: 9, d: 4, upper: 1, wall: 'plaster', roof: 'thatch', timber: true, stoneBelow: true, seed: 51, door: 3, sign: 'cup', ivy: true, shutters: 'cg', bloom: 'cy0' })
}

/** A treadwheel crane on the quay: a timber housing on a stone base, its jib reaching over the water. */
function crane(): Model {
  const W = 3 * S
  const solids: Solid[] = [
    box(4, 4, 0, W - 4, W - 4, 14, 'stone'),
    box(6, 6, 14, W - 6, W - 6, 50, 'timber'),
    gable(4, 4, W - 4, W - 4, 50, 16, 'y', 'tile', 'timber'),
    box(W / 2 - 2, W - 8, 46, W / 2 + 2, W + 24, 50, 'timber'),
  ]
  return { name: 'town_crane', footprint: ['###', '###', '###'], solids, voids: [], ornaments: [] }
}

export const TOWN: Record<string, () => Model> = {
  ...houses(),
  town_hall: townHall,
  town_gate_tower: gateTower,
  town_guild: guildHall,
  town_inn: inn,
  town_tavern: tavern,
  town_teahouse_0: () => teahouse(0),
  town_teahouse_1: () => teahouse(1),
  town_crane: crane,
}

