// The backdrop's maps (docs/continent.md §3): a map for every place of the gazetteer, made from its kind, its region and
// the ground it stands on — the ground's own wild (content wild.ts) cleared where the place is built, then what the
// kind is: houses round a street, a fort's walls, a graveyard's stones, a cave's mouth and the dark below it. Nobody
// lives in them yet and no tale is told there; they are walked through, and a played map may take one's place later.

import type { MapMeta, Text } from '@openworld/engine'
import { TERRAIN_CHARS, wildChunk, type RawChunk } from '@openworld-game/content'
import { CATALOG } from '../../../../client/src/catalog.ts'
import { MapBuilder, reseed, rng, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import type { Continent, Place } from './generate.ts'
import { stockPlace } from './stock.ts'

/** A kind's map size. */
const SIZE: Record<string, [number, number]> = {
  village: [40, 30], town: [48, 36], city: [48, 36], farm: [40, 30], mill: [40, 30], camp: [32, 24], ruin: [36, 28], shrine: [30, 24], cave: [36, 28], mine: [36, 28],
  tower: [32, 24], graveyard: [36, 28], fort: [44, 32], battlefield: [44, 32], cathedral: [44, 32], seat: [40, 30],
}
/** The engine's word for what a map is (MapData.kind). */
const MAP_KIND: Record<string, string> = { village: 'village', town: 'town', city: 'town' }
/** Places where night brings nothing (MapData.zone). */
const PEACEFUL = new Set(['village', 'town', 'city', 'farm', 'mill', 'camp', 'shrine', 'cathedral'])

/** Each region's buildings, streets and walls. */
const STYLE: Record<string, { houses: string[]; street: string; wall: string; yard: 'rail' | 'fence' | 'stonewall' }> = {
  frostfang: { houses: ['house_wood', 'cabin', 'house_thatch'], street: 'path', wall: 'woodwall', yard: 'fence' },
  redmarch: { houses: ['house_red', 'smithy', 'house_orange', 'house_wood'], street: 'dirt', wall: 'burnt_wall', yard: 'stonewall' },
  tithe: { houses: ['house_thatch', 'hut_straw', 'store', 'shop'], street: 'dirt', wall: 'woodwall', yard: 'rail' },
  palefen: { houses: ['hut_straw', 'house_wood', 'cabin'], street: 'path', wall: 'woodwall', yard: 'fence' },
  altar: { houses: ['house_plaster', 'temple', 'house_orange'], street: 'cobble', wall: 'wall', yard: 'stonewall' },
  holy: { houses: ['house_plaster', 'house_orange', 'shop', 'teahouse', 'store'], street: 'cobble', wall: 'wall', yard: 'stonewall' },
}
/** What prowls each kind of wild place, by region. */
const HAUNTS: Record<string, string[]> = {
  frostfang: ['beast/wolf', 'slime/frost_slime'],
  redmarch: ['undead/skeleton', 'imp/fire_imp'],
  tithe: ['spider', 'undead/zombie'],
  palefen: ['undead/zombie', 'undead/ghost'],
  altar: ['undead/ghost', 'golem/stone_golem'],
  holy: ['undead/skeleton', 'wisp/storm_wisp'],
}

const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'burnt_wall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'stump', 'void', 'door'])
const GROUND_OF: Record<string, string> = Object.fromEntries(Object.values(TERRAIN_CHARS).map((t) => [t, t]))

/** The map for a place: its ground's wild, then its kind built on it; a cave's or a mine's depths beside it. */
function placeMaps(p: Place, ground: string): MapBuilder[] {
  reseed(p.seed)
  const [w, h] = SIZE[p.kind] ?? [40, 30]
  const b = new MapBuilder(p.id, p.name, MAP_KIND[p.kind] ?? 'field', w, h, 'grass', undefined, 'outdoor', p.region)
  b.backdrop = true
  b.zone = PEACEFUL.has(p.kind) ? 'peaceful' : 'combat'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  // the ground's own wild, as wide as the place (without its beasts: the kind says what is about)
  const wild = wildChunk(p.seed, p.x, p.y, ground, undefined, p.region, { w, h })
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, GROUND_OF[wild.map.terrain[y * w + x]] ?? 'grass')
  for (const e of wild.entities) if (e.type.startsWith('item/') && e.place.on === 'tile') b.item(e.type, e.place.x, e.place.y)
  const style = STYLE[p.region] ?? STYLE.frostfang
  const out = [b]
  const build = KINDS[p.kind] ?? KINDS.ruin
  build(b, p, style, out)
  // what is kept there (stock.ts): the households', the shops', the dark's
  for (const m of out) stockPlace(m, p, m !== b)
  return out
}

type Style = (typeof STYLE)[string]
type Build = (b: MapBuilder, p: Place, s: Style, out: MapBuilder[]) => void

/** Clear a rect to `ground` (what a place is built on): what grew or stood there goes. */
function clear(b: MapBuilder, x: number, y: number, w: number, h: number, ground: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (b.in(i, j)) b.set(i, j, ground)
  b.entities = b.entities.filter((e) => !(e.place.on === 'tile' && e.place.x >= x && e.place.x < x + w && e.place.y >= y && e.place.y < y + h))
}

/** A building's size (its prefab's grid). */
const sizeOf = (key: string): [number, number] => {
  const g = CATALOG.prefabs[key]!.grid
  return [g[0].length, g.length]
}

/** Houses in a row facing a street (its row `street`) between x0 and x1, a step of path from each door to it. */
function row(b: MapBuilder, s: Style, x0: number, x1: number, street: number): void {
  let x = x0 + rng.int(0, 1)
  while (true) {
    const key = rng.pick(s.houses)
    const [w, h] = sizeOf(key)
    if (x + w > x1) break
    const door = b.house(key, x, street - 1 - h, `${b.id}.door${b.stamps.length}`)
    b.set(door[0], street - 1, s.street)
    x += w + rng.int(2, 3)
  }
}

/** A settlement: a cleared green, its lanes across it a house deep apart, a street down its middle, a square with a well. */
function settlement(b: MapBuilder, s: Style, lanes: number, square: string): void {
  clear(b, 2, 2, b.w - 4, b.h - 4, 'grass')
  const mid = Math.floor(b.h / 2)
  const cx = Math.floor(b.w / 2)
  // the lanes: the main street through the square, the others seven rows apart, above and below it in turn
  const ys = [mid, mid + 7, mid - 7, mid + 14].slice(0, lanes).filter((y) => y - 5 >= 2 && y + 1 < b.h - 2)
  for (const y of ys) b.path([[y === mid ? 0 : 3, y], [Math.floor(b.w / 3), y], [Math.floor((2 * b.w) / 3), y], [y === mid ? b.w - 1 : b.w - 4, y]], s.street, y === mid ? 2 : 1)
  b.path([[cx, 0], [cx, b.h - 1]], s.street, 2)
  const sq = { x: cx - 3, y: mid - 2 }
  for (const y of ys) {
    row(b, s, 3, cx - 4, y)
    row(b, s, cx + 5, b.w - 3, y)
  }
  b.rect(sq.x, sq.y, 8, 5, square)
  b.fixture('fixture/water/well', cx, mid + 1)
  b.fixture('fixture/light/lamppost', sq.x, sq.y)
  b.fixture('fixture/light/lamppost', sq.x + 7, sq.y + 4)
  b.sprinkle('fixture/container/barrel', 0.03, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'door', 1), [2, 2, b.w - 4, b.h - 4])
  b.sprinkle('fixture/container/crate', 0.02, (x, y, t) => t === 'grass' && b.near(x, y, (n) => n === 'door', 2), [2, 2, b.w - 4, b.h - 4])
  b.sprinkle('fixture/nature/flowers', 0.02, (_x, _y, t) => t === 'grass', [2, 2, b.w - 4, b.h - 4])
}

/** A wall ring of `t` with a door in its south side and `floor` inside: a tower, a keep, a hall. */
function hall(b: MapBuilder, x: number, y: number, w: number, h: number, t: string, floor: string): Cell {
  b.rect(x, y, w, h, t)
  b.rect(x + 1, y + 1, w - 2, h - 2, floor)
  const door: Cell = [x + Math.floor(w / 2), y + h - 1]
  b.set(door[0], door[1], 'door')
  return door
}

/** Broken walls: rings of `t` with gaps, rubble about them. */
function ruins(b: MapBuilder, t: string, n: number): void {
  for (let k = 0; k < n; k++) {
    const w = rng.int(5, 9)
    const h = rng.int(4, 7)
    const x = rng.int(3, b.w - w - 3)
    const y = rng.int(3, b.h - h - 3)
    if (Math.abs(x + w / 2 - b.w / 2) < w / 2 + 3 && Math.abs(y + h / 2 - b.h / 2) < h / 2 + 3) continue
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const edge = i === x || j === y || i === x + w - 1 || j === y + h - 1
        if (edge && rng.chance(0.65)) b.set(i, j, t)
        else if (!edge && b.get(i, j) !== 'water') b.set(i, j, rng.chance(0.2) ? 'gravel' : 'floor_stone')
      }
  }
  b.sprinkle('fixture/remains/bones', 0.01, (_x, _y, t) => t === 'floor_stone' || t === 'gravel')
  b.sprinkle('fixture/nature/pebbles', 0.02, (_x, _y, t) => t === 'gravel' || t === 'grass')
}

/** What prowls a wild place: `n` of the region's haunts, away from the middle where one comes in. */
function haunt(b: MapBuilder, p: Place, n: number): void {
  const kinds = HAUNTS[p.region] ?? HAUNTS.frostfang
  for (let k = 0; k < n; k++)
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.int(3, b.w - 4)
      const y = rng.int(3, b.h - 4)
      if (!b.walkable(x, y) || Math.hypot(x - b.w / 2, y - b.h / 2) < 8 || b.get(x, y) === 'door') continue
      b.creature(rng.pick(kinds), x, y, { leash: 6 })
      break
    }
}

/**
 * What a place keeps holy: a statue (never one of the Pilgrim's Road's wayshrines, which tell the story when an
 * offering is laid on them).
 */
const shrineOf = (_region: string) => 'fixture/sacred/statue'

/** A cave's mouth in a face of rock across the north, and its depths below, dark, with what lives and lies there. */
function cave(b: MapBuilder, p: Place, out: MapBuilder[], veins: number): void {
  const face = 7
  for (let y = 0; y < face; y++) for (let x = 0; x < b.w; x++) b.set(x, y, y < face - 1 || rng.chance(0.6) ? 'cave_wall' : 'rock')
  const mx = Math.floor(b.w / 2) + rng.int(-4, 4)
  b.rect(mx - 1, face - 2, 3, 3, 'cave_floor')
  b.set(mx, face - 2, 'stairs_down')
  clear(b, mx - 3, face + 1, 7, 4, 'gravel')
  b.fixture('fixture/light/brazier', mx - 2, face + 1)
  const below = new MapBuilder(`${p.id}.depths`, { en: `${p.name.en} — Depths`, zh: `${p.name.zh}·深处` } as Text, 'dungeon', 40, 30, 'cave_wall', undefined, 'dark', p.region)
  below.backdrop = true
  // a winding hollow: a walk that carves the rock from the stairs up
  let [x, y] = [20, 26]
  below.rect(19, 22, 3, 5, 'cave_floor')
  for (let step = 0; step < 900; step++) {
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, -1], [0, 1], [0, -1]] as const)
    x = Math.max(2, Math.min(37, x + dx))
    y = Math.max(2, Math.min(26, y + dy))
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) if (below.get(x + ox, y + oy) === 'cave_wall') below.set(x + ox, y + oy, 'cave_floor')
  }
  below.set(20, 26, 'stairs_up')
  b.portal(mx, face - 2, below.id, 20, 25, below.name)
  below.portal(20, 26, b.id, mx, face - 1, b.name)
  // ore in the walls beside the floor, torches, and what lives in the dark
  below.sprinkle(veins > 1 ? 'fixture/nature/vein/iron' : 'fixture/nature/vein/coal', 0.02 * veins, (x, y, t) => t === 'cave_floor' && below.near(x, y, (n) => n === 'cave_wall'))
  below.sprinkle('fixture/light/brazier', 0.004, (_x, _y, t) => t === 'cave_floor')
  below.sprinkle('fixture/remains/bones', 0.006, (_x, _y, t) => t === 'cave_floor')
  for (let k = 0; k < 4; k++)
    for (let tries = 0; tries < 40; tries++) {
      const cx = rng.int(2, 37)
      const cy = rng.int(2, 22)
      if (!below.walkable(cx, cy)) continue
      below.creature(rng.pick(['beast/bat', 'spider', 'undead/skeleton']), cx, cy, { leash: 8 })
      break
    }
  out.push(below)
}

const KINDS: Record<string, Build> = {
  village: (b, _p, s) => settlement(b, s, 2, s.street === 'cobble' ? 'cobble' : 'dirt'),
  town: (b, p, s) => {
    settlement(b, s, 3, 'cobble')
    const mid = Math.floor(b.h / 2)
    b.fixture('fixture/furniture/stall', Math.floor(b.w / 2) - 5, mid + 1)
    b.fixture('fixture/furniture/stall', Math.floor(b.w / 2) + 5, mid + 1)
    b.fixture(shrineOf(p.region), Math.floor(b.w / 2), mid - 1)
  },
  city: (b, p, s) => {
    settlement(b, { ...s, street: 'cobble' }, 4, 'cobble')
    b.fixture('fixture/water/fountain', Math.floor(b.w / 2) - 1, Math.floor(b.h / 2) - 1)
    b.fixture(shrineOf(p.region), Math.floor(b.w / 2) + 2, Math.floor(b.h / 2) - 2)
    b.sprinkle('fixture/light/lamppost', 0.012, (_x, _y, t) => t === 'cobble')
  },
  farm: (b, _p, s) => {
    clear(b, 4, 4, b.w - 8, b.h - 8, 'grass')
    const door = b.house(rng.pick(s.houses), 8, 7, `${b.id}.door`)
    b.road(door[0], door[1] + 1, door[0], Math.floor(b.h / 2), s.street === 'cobble' ? 'path' : s.street)
    b.path([[0, Math.floor(b.h / 2)], [b.w - 1, Math.floor(b.h / 2)]], 'path', 2)
    const fx = 18
    const fy = 5
    b.rect(fx, fy, 14, 8, 'farmland')
    b.yard(fx - 1, fy - 1, 16, 10, 'rail', [[fx + 6, fy + 8]])
    b.fixture('fixture/nature/haystack', 9, 18)
    b.fixture('fixture/nature/haystack', 11, 19)
    b.yard(20, 17, 10, 7, 'rail', [[24, 17]])
    b.creature('animal/cow', 23, 20, { temper: 'wary', behaviour: 'melee' })
    b.creature('animal/chicken', 26, 21, { temper: 'wary', behaviour: 'melee' })
  },
  mill: (b, _p, s) => {
    clear(b, 4, 4, b.w - 8, b.h - 8, 'grass')
    b.path([[0, Math.floor(b.h / 2)], [b.w - 1, Math.floor(b.h / 2)]], 'path', 2)
    const door = b.house(rng.pick(s.houses), 16, 8, `${b.id}.door`)
    b.road(door[0], door[1] + 1, door[0], Math.floor(b.h / 2), 'path')
    b.rect(6, 18, 10, 6, 'farmland')
    b.rect(24, 18, 10, 6, 'farmland')
    b.fixture('fixture/nature/logpile', 21, 9)
    b.fixture('fixture/container/sack', 15, 11)
    b.fixture('fixture/container/sack', 22, 11)
  },
  camp: (b) => {
    clear(b, 8, 6, b.w - 16, b.h - 12, 'dirt')
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2)
    b.fixture('fixture/light/campfire', cx, cy + 2)
    for (const [dx, dy] of [[-7, -4], [3, -4], [-7, 3], [4, 3]]) b.house(rng.pick(['tent', 'tent_patched', 'tent_torn']), cx + dx, cy + dy, `${b.id}.tent${dx}${dy}`)
    b.fixture('fixture/furniture/bench/log', cx - 2, cy + 2)
    b.fixture('fixture/furniture/bench/log', cx + 2, cy + 2)
    b.fixture('fixture/container/crate', cx + 1, cy - 1)
  },
  ruin: (b, p, s) => {
    ruins(b, s.wall === 'woodwall' ? 'wall' : s.wall, 5)
    haunt(b, p, 2)
    b.fixture('fixture/container/chest', Math.floor(b.w / 2) + rng.int(-8, 8), Math.floor(b.h / 2) + rng.int(-6, 6), {}, [rng.pick(['item/material/coal', 'item/material/stone', 'item/material/herb', 'item/tool/rope'])])
  },
  shrine: (b, p) => {
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2) - 3
    clear(b, cx - 5, cy - 3, 11, 9, 'grass')
    b.rect(cx - 3, cy - 2, 7, 5, 'cobble')
    b.path([[cx, cy + 3], [cx, b.h - 1]], 'path', 1)
    b.fixture(shrineOf(p.region), cx, cy)
    b.fixture('fixture/light/candles', cx - 2, cy + 1)
    b.fixture('fixture/light/candles', cx + 2, cy + 1)
    b.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => t === 'grass' && Math.hypot(x - cx, y - cy) < 6)
  },
  cave: (b, p, _s, out) => (cave(b, p, out, 1), haunt(b, p, 1)),
  mine: (b, p, _s, out) => {
    cave(b, p, out, 2)
    b.fixture('fixture/nature/logpile', Math.floor(b.w / 2) + 4, 9)
    b.fixture('fixture/furniture/cart', Math.floor(b.w / 2) - 5, 9)
  },
  tower: (b, p, s) => {
    const cx = Math.floor(b.w / 2)
    const cy = Math.floor(b.h / 2) - 4
    clear(b, cx - 6, cy - 4, 13, 12, 'gravel')
    const door = hall(b, cx - 2, cy - 2, 5, 5, s.wall === 'woodwall' ? 'wall' : s.wall, 'floor_stone')
    b.path([[door[0], door[1] + 1], [door[0], b.h - 1]], 'path', 1)
    b.fixture('fixture/light/brazier', door[0] - 2, door[1] + 1)
    b.fixture('fixture/light/brazier', door[0] + 2, door[1] + 1)
    haunt(b, p, 1)
  },
  graveyard: (b, p) => {
    const x = Math.floor(b.w / 2) - 9
    const y = Math.floor(b.h / 2) - 6
    clear(b, x - 1, y - 1, 20, 14, 'grass')
    b.yard(x, y, 18, 12, 'stonewall', [[x + 9, y + 11]])
    for (let j = y + 2; j < y + 10; j += 2) for (let i = x + 2; i < x + 16; i += 3) if (rng.chance(0.85)) b.fixture('fixture/sacred/gravestone', i, j)
    b.sprinkle('fixture/nature/dead_tree', 0.015, (_x, _y, t) => t === 'grass' || t === 'drygrass' || t === 'mud')
    haunt(b, p, 2)
  },
  fort: (b, _p, s) => {
    const x = 6
    const y = 4
    const w = b.w - 12
    const h = b.h - 9
    clear(b, x, y, w, h, 'dirt')
    b.yard(x, y, w, h, 'stonewall', [[x + Math.floor(w / 2), y + h - 1], [x + Math.floor(w / 2) + 1, y + h - 1]])
    const keep = hall(b, x + Math.floor(w / 2) - 5, y + 2, 11, 7, 'wall', 'floor_stone')
    b.path([[keep[0], keep[1] + 1], [keep[0], b.h - 1]], 'path', 2)
    b.house(rng.pick(s.houses), x + 3, y + h - 7, `${b.id}.barracks1`)
    b.house(rng.pick(s.houses), x + w - 8, y + h - 7, `${b.id}.barracks2`)
    b.fixture('fixture/dummy', x + 4, y + 4)
    b.fixture('fixture/dummy', x + 6, y + 4)
    b.fixture('fixture/furniture/rack', x + w - 6, y + 4)
    b.fixture('fixture/light/brazier', keep[0] - 2, keep[1] + 1)
    b.fixture('fixture/light/brazier', keep[0] + 2, keep[1] + 1)
  },
  battlefield: (b, p) => {
    for (let k = 0; k < 7; k++) b.organic(rng.int(6, b.w - 6), rng.int(5, b.h - 5), rng.int(3, 6), rng.int(2, 4), rng.chance(0.5) ? 'ash' : 'dirt', { only: (t) => !SOLID.has(t) })
    b.sprinkle('fixture/remains/body', 0.008, (_x, _y, t) => t === 'ash' || t === 'dirt')
    b.sprinkle('fixture/remains/bones', 0.015, (_x, _y, t) => !SOLID.has(t))
    b.sprinkle('fixture/nature/dead_tree', 0.006, (_x, _y, t) => t === 'grass' || t === 'drygrass' || t === 'dirt')
    haunt(b, p, 4)
  },
  cathedral: (b, p) => {
    const cx = Math.floor(b.w / 2)
    clear(b, cx - 11, 3, 22, b.h - 6, 'grass')
    const door = hall(b, cx - 6, 4, 13, 9, 'wall', 'floor_stone')
    b.fixture('fixture/sacred/altar', cx, 6)
    b.fixture('fixture/light/candles', cx - 2, 6)
    b.fixture('fixture/light/candles', cx + 2, 6)
    b.rect(cx - 4, door[1] + 1, 9, 5, 'cobble')
    b.path([[cx, door[1] + 6], [cx, b.h - 1]], 'path', 2)
    b.fixture('fixture/sacred/statue', cx - 3, door[1] + 3)
    b.fixture('fixture/sacred/statue', cx + 3, door[1] + 3)
    b.fixture(shrineOf(p.region), cx, door[1] + 4)
    b.house('house_plaster', cx - 10, door[1] + 2, `${b.id}.cloister1`)
    b.house('house_plaster', cx + 7, door[1] + 2, `${b.id}.cloister2`)
    for (let i = cx - 9; i <= cx + 9; i += 3) b.fixture('fixture/sacred/gravestone', i, b.h - 5)
  },
  seat: (b, p) => {
    const cx = Math.floor(b.w / 2)
    clear(b, cx - 9, 4, 18, b.h - 8, 'cobble')
    hall(b, cx - 5, 5, 11, 8, 'wall', 'floor_stone')
    b.fixture('fixture/sacred/statue', cx - 4, 15)
    b.fixture('fixture/sacred/statue', cx + 4, 15)
    b.fixture(shrineOf(p.region), cx, 16)
    b.fixture('fixture/light/brazier', cx - 2, 14)
    b.fixture('fixture/light/brazier', cx + 2, 14)
  },
}

/** Every backdrop map of the continent: its places', and the depths under its caves and mines. */
export function buildBackdrop(c: Continent): RawChunk[] {
  const ground = (x: number, y: number) => TERRAIN_CHARS[c.rows[y][x]] ?? 'ow_plain'
  return c.places.flatMap((p) => placeMaps(p, ground(p.x, p.y)).map((b) => b.chunk()))
}

/** A backdrop map's line in the world's index. */
export const backdropMeta = (c: RawChunk): MapMeta => ({
  id: c.map.id,
  name: c.map.name,
  kind: c.map.kind,
  region: c.map.region,
  width: c.map.width,
  height: c.map.height,
  portals: c.map.portals,
  npcs: 0,
  items: c.entities.filter((e) => e.type.startsWith('item/')).length,
  backdrop: true,
})
