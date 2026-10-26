// The rooms behind the backdrop's doors (docs/continent.md §9 B): a room for every house, shop, smithy, chapel, inn,
// tent, barracks and cloister cell the backdrop's places are built with, furnished plainly by what the building is and
// where it stands — a home's beds, table and hearth and the things of the trade kept there, a smithy's forge, a
// chapel's benches — in its region's walls and floors. Nobody lives in them yet; they are walked into through the door
// and out by it again (MapBuilder.linkInterior), and a played place may take one's map later.

import type { Entity, Text } from '@openworld/engine'
import { MapBuilder, rng } from '../builder.ts'
import type { Place } from './generate.ts'

/** What a building is, inside. */
export type Role = 'home' | 'farmhouse' | 'mill' | 'smithy' | 'shop' | 'teahouse' | 'inn' | 'chapel' | 'tent' | 'barracks' | 'cell'

/** A building's door on a backdrop map (its name in `MapBuilder.doors`), its prefab and what it is. */
export interface DoorNote {
  door: string
  prefab: string
  role: Role
}

/** What a prefab is when its place says nothing more. */
export function roleOf(prefab: string): Role {
  if (prefab === 'smithy') return 'smithy'
  if (prefab === 'store' || prefab === 'shop') return 'shop'
  if (prefab === 'teahouse') return 'teahouse'
  if (prefab === 'inn') return 'inn'
  if (prefab === 'temple') return 'chapel'
  if (prefab.startsWith('tent')) return 'tent'
  return 'home'
}

/** A name in both languages. */
type Words = { en: string; zh: string }

const ROLE_NAME: Record<Role, Words> = {
  home: { en: 'A House', zh: '民居' },
  farmhouse: { en: 'The Farmhouse', zh: '农舍' },
  mill: { en: 'The Mill House', zh: '磨坊屋' },
  smithy: { en: 'The Smithy', zh: '铁匠铺' },
  shop: { en: 'A Shop', zh: '店铺' },
  teahouse: { en: 'The Teahouse', zh: '茶馆' },
  inn: { en: 'The Inn', zh: '客栈' },
  chapel: { en: 'The Chapel', zh: '礼拜堂' },
  tent: { en: 'A Tent', zh: '帐篷' },
  barracks: { en: 'The Barracks', zh: '营房' },
  cell: { en: 'A Cloister Cell', zh: '修士小室' },
}

/** A trade a home is kept by: its name, and what it keeps in the room. */
interface Trade {
  name: Words
  keeps: string[]
}
const trade = (en: string, zh: string, ...keeps: string[]): Trade => ({ name: { en: `The ${en}'s House`, zh: `${zh}之家` }, keeps })

/** Each region's walls and floors indoors, and the trades of its homes. */
const INDOORS: Record<string, { style: string; floor: string; trades: Trade[] }> = {
  frostfang: {
    style: 'wood',
    floor: 'floor_wood',
    trades: [trade('Woodcutter', '樵夫', 'fixture/container/woodpile'), trade('Fisher', '渔夫', 'fixture/container/barrel', 'fixture/container/crate'), trade('Trapper', '猎户', 'fixture/furniture/rack'), trade('Weaver', '织工', 'fixture/craft/loom')],
  },
  redmarch: {
    style: 'stone',
    floor: 'floor_stone',
    trades: [trade('Tanner', '皮匠', 'fixture/furniture/rack', 'fixture/container/barrel'), trade('Herder', '牧人', 'fixture/container/sack'), trade('Fletcher', '箭匠', 'fixture/craft/workbench'), trade('Veteran', '老兵', 'fixture/furniture/rack', 'fixture/container/chest')],
  },
  tithe: {
    style: 'plaster',
    floor: 'floor_wood',
    trades: [trade('Reaper', '割麦人', 'fixture/container/sack', 'fixture/container/sack'), trade('Weigher', '过秤人', 'fixture/furniture/counter', 'fixture/container/shelf'), trade('Baker', '面包师', 'fixture/container/pot', 'fixture/container/sack'), trade('Gleaner', '拾穗人', 'fixture/container/sack')],
  },
  palefen: {
    style: 'moss',
    floor: 'floor_wood',
    trades: [trade('Eel-catcher', '捕鳗人', 'fixture/container/barrel'), trade('Reed-cutter', '割苇人', 'fixture/container/crate'), trade('Gravedigger', '掘墓人', 'fixture/furniture/rack'), trade('Candlemaker', '制烛人', 'fixture/light/candles', 'fixture/container/shelf')],
  },
  altar: {
    style: 'plaster',
    floor: 'floor_stone',
    trades: [trade('Stonemason', '石匠', 'fixture/craft/workbench'), trade('Shepherd', '牧羊人', 'fixture/container/sack'), trade('Acolyte', '侍僧', 'fixture/container/bookshelf', 'fixture/light/candles'), trade('Copyist', '抄经人', 'fixture/container/bookshelf')],
  },
  holy: {
    style: 'plaster',
    floor: 'floor_stone',
    trades: [trade('Chandler', '蜡烛商', 'fixture/container/shelf', 'fixture/light/candles'), trade('Scribe', '书记', 'fixture/container/bookshelf'), trade('Pilgrim-host', '朝圣接待人', 'fixture/furniture/bed'), trade('Glazier', '玻璃匠', 'fixture/craft/workbench')],
  },
}

/** A room's size by what it is and the building it is behind. */
function sizeOf(role: Role, prefab: string): [number, number] {
  if (role === 'tent' || prefab === 'hut_straw') return [8, 6]
  if (role === 'inn' || prefab === 'longhouse') return [14, 10]
  if (role === 'chapel') return [12, 10]
  if (role === 'barracks') return [12, 8]
  return prefab.startsWith('house_') && prefab !== 'house_wood' ? [11, 8] : [10, 7]
}

const LIT: Partial<Entity> = { statuses: { lit: -1 } }

/**
 * A thing in the room where there is floor and nothing stands, never in the way in from the door, and never where it
 * would wall off a corner of the floor or another thing from the door (MapBuilder.waysOpen).
 */
function put(m: MapBuilder, type: string, x: number, y: number, extra: Partial<Entity> = {}): boolean {
  const [dx, dy] = m.doors.out
  if (x < 1 || y < 1 || x > m.w - 2 || y > m.h - 2 || (x === dx && y >= m.h - 3)) return false
  if (!m.free(x, y)) return false
  m.entities.push({ id: '', type, place: { on: 'tile', map: m.id, x, y } })
  const open = m.waysOpen([dx, dy - 1])
  m.entities.pop()
  if (!open) return false
  m.fixture(type, x, y, extra)
  return true
}

/** A thing against a wall, wherever one is free (the walls taken in a shuffled order). */
function byWall(m: MapBuilder, type: string, extra: Partial<Entity> = {}): void {
  const spots: [number, number][] = []
  for (let x = 1; x < m.w - 1; x++) spots.push([x, 1], [x, m.h - 2])
  for (let y = 2; y < m.h - 2; y++) spots.push([1, y], [m.w - 2, y])
  for (let i = spots.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[spots[i], spots[j]] = [spots[j], spots[i]]
  }
  for (const [x, y] of spots) if (put(m, type, x, y, extra)) return
}

/** A table with a chair either side. */
function table(m: MapBuilder, x: number, y: number): void {
  put(m, 'fixture/furniture/table', x, y)
  put(m, 'fixture/furniture/chair', x - 1, y)
  put(m, 'fixture/furniture/chair', x + 1, y)
}

/** What stands in a room, by what the building is (and, a home, the trade it is kept by). */
function furnish(m: MapBuilder, role: Role, kept?: Trade): void {
  const W = m.w
  const H = m.h
  const cx = Math.floor(W / 2)
  const mid = Math.floor(H / 2)
  switch (role) {
    case 'home':
    case 'farmhouse': {
      const beds = rng.int(1, W >= 11 ? 3 : 2)
      for (let i = 0; i < beds; i++) put(m, 'fixture/furniture/bed', 1 + i * 2, 1)
      put(m, 'fixture/light/fireplace', W - 3, 1, LIT)
      table(m, cx, Math.min(mid, H - 4))
      put(m, 'fixture/container/chest', W - 2, H - 3)
      put(m, 'fixture/container/barrel', 1, H - 2)
      for (const k of kept?.keeps ?? []) byWall(m, k)
      if (role === 'farmhouse') for (const k of ['fixture/container/sack', 'fixture/container/sack', 'fixture/container/pot']) byWall(m, k)
      break
    }
    case 'mill':
      put(m, 'fixture/furniture/bed', 1, 1)
      table(m, cx, Math.min(mid, H - 4))
      for (let i = 0; i < 4; i++) byWall(m, 'fixture/container/sack')
      for (const k of ['fixture/container/barrel', 'fixture/container/barrel', 'fixture/container/crate', 'fixture/craft/workbench']) byWall(m, k)
      break
    case 'smithy':
      put(m, 'fixture/craft/forge', 2, 1)
      put(m, 'fixture/craft/anvil', 4, 2)
      put(m, 'fixture/furniture/rack', W - 3, 1)
      put(m, 'fixture/furniture/bed', W - 2, 3)
      put(m, 'fixture/container/barrel', 1, H - 2)
      put(m, 'fixture/container/crate', W - 2, H - 2)
      break
    case 'shop':
      for (const x of [1, 2, 3, W - 4, W - 3, W - 2]) put(m, 'fixture/container/shelf', x, 1)
      put(m, 'fixture/furniture/counter', cx - 1, 3)
      put(m, 'fixture/furniture/counter', cx, 3)
      put(m, 'fixture/furniture/bed', W - 2, 3)
      for (const k of ['fixture/container/barrel', 'fixture/container/crate', 'fixture/container/sack']) byWall(m, k)
      break
    case 'teahouse':
      table(m, 3, 3)
      table(m, W - 4, 3)
      put(m, 'fixture/light/fireplace', cx, 1, LIT)
      put(m, 'fixture/container/shelf', 1, 1)
      put(m, 'fixture/container/pot', W - 2, 1)
      byWall(m, 'fixture/container/barrel')
      break
    case 'inn':
      for (let x = 1; x < W - 4; x += 2) put(m, 'fixture/furniture/bed', x, 1)
      put(m, 'fixture/light/fireplace', W - 3, 1, LIT)
      for (const y of [4, 5, 6]) put(m, 'fixture/furniture/counter', W - 3, y)
      put(m, 'fixture/container/barrel', W - 2, 4)
      put(m, 'fixture/container/barrel', W - 2, 5)
      table(m, 3, 4)
      table(m, 3, 7)
      table(m, cx, 5)
      break
    case 'chapel':
      put(m, 'fixture/sacred/altar', cx, 1)
      put(m, 'fixture/light/candles', cx - 2, 1, LIT)
      put(m, 'fixture/light/candles', cx + 2, 1, LIT)
      for (let y = 3; y < H - 3; y += 2) for (const x of [cx - 3, cx - 2, cx + 2, cx + 3]) put(m, 'fixture/furniture/bench', x, y)
      put(m, 'fixture/furniture/bookstand', W - 2, 2)
      put(m, 'fixture/sacred/statue', 1, 1)
      break
    case 'tent':
      put(m, 'fixture/furniture/bed', 1, 1)
      put(m, 'fixture/container/crate', W - 2, 1)
      put(m, 'fixture/light/lantern', cx - 1, 1, LIT)
      byWall(m, 'fixture/container/sack')
      break
    case 'barracks':
      for (let x = 1; x < W - 2; x += 2) put(m, 'fixture/furniture/bed', x, 1)
      put(m, 'fixture/furniture/rack', W - 2, 3)
      put(m, 'fixture/furniture/rack', W - 2, 4)
      put(m, 'fixture/container/chest', 1, H - 3)
      table(m, cx - 2, 4)
      break
    case 'cell':
      put(m, 'fixture/furniture/bed', 1, 1)
      put(m, 'fixture/container/bookshelf', 3, 1)
      put(m, 'fixture/light/candles', W - 2, 1, LIT)
      put(m, 'fixture/furniture/table', W - 3, 3)
      put(m, 'fixture/furniture/chair', W - 3, 4)
      break
  }
}

/**
 * The rooms behind a backdrop map's doors, each linked to its door (in by the door, out by the room's own at its
 * bottom, in front of the door outside): `<place>.<role>-<n>`, named for its place and what it is.
 */
export function roomsBehind(b: MapBuilder, p: Place, doors: DoorNote[]): MapBuilder[] {
  const count: Partial<Record<Role, number>> = {}
  const indoors = INDOORS[p.region] ?? INDOORS.frostfang
  return doors.map((d) => {
    const n = (count[d.role] = (count[d.role] ?? 0) + 1)
    const kept = d.role === 'home' && rng.chance(0.6) ? rng.pick(indoors.trades) : undefined
    const what = kept?.name ?? ROLE_NAME[d.role]
    const name: Text = { en: `${p.name.en} — ${what.en}`, zh: `${p.name.zh}·${what.zh}` }
    const [w, h] = sizeOf(d.role, d.prefab)
    const stone = d.role === 'smithy' || d.role === 'barracks' || (d.role === 'chapel' && indoors.style !== 'plaster')
    const style = d.role === 'tent' ? 'wood' : stone ? 'stone' : indoors.style
    const floor = d.role === 'tent' ? 'floor_wood' : stone ? 'floor_stone' : indoors.floor
    const music = d.role === 'shop' ? 'shop' : d.role === 'chapel' ? 'temple' : 'interior'
    const m = new MapBuilder(`${p.id}.${d.role}-${n}`, name, 'interior', w, h, floor, music, 'indoor', p.region)
    m.room(style, floor)
    m.backdrop = true
    m.zone = 'peaceful'
    furnish(m, d.role, kept)
    b.linkInterior(d.door, m)
    return m
  })
}
