// The backdrop's stock (docs/continent.md §10): what every place of the continent keeps, by its region and what it
// is — a household's chest and larder beside its door, a shop's shelf and crate, a smithy's arms, an inn's barrels, a
// temple's candles and books, a tent's crate, the stalls of a market, a chest in the dark of a ruin or a cave. The
// region's own goods (content goods.ts) are kept there twice as often as the things kept everywhere; nothing is kept
// past what its container holds (a slot a kind, content ontology `capacity`). Nobody owns any of it yet: the people
// who will live there come later (phase C).
//
// It runs after a place's map is built (backdrop.ts) and fills whatever stands there; a room built behind a door
// later is stocked by `stockMap` the same way, and a door that leads somewhere keeps its store inside, not by it.

import { ELEMENT_NAMES, buildOntology, stockFor, type Context, type Form } from '@openworld-game/content'
import { OntologyIndex, Rng, type Entity } from '@openworld/engine'
import { CATALOG } from '../../../../client/src/catalog.ts'
import { MapBuilder, type Cell, type ItemSpec } from '../builder.ts'
import type { Place } from './generate.ts'
import type { Role } from './rooms.ts'

/** What a building is for, by its prefab. */
const USE_OF: Record<string, Use> = {
  house_wood: 'home', house_thatch: 'home', house_red: 'home', house_orange: 'home', house_plaster: 'home', cabin: 'home', hut_straw: 'home',
  shop: 'shop', store: 'shop', smithy: 'smithy', teahouse: 'inn', temple: 'temple', tent: 'camp', tent_patched: 'camp', tent_torn: 'camp',
}
export type Use = 'home' | 'shop' | 'smithy' | 'inn' | 'temple' | 'camp' | 'farm' | 'dungeon' | 'library'

/** What a place keeps where nothing says otherwise: its loose barrels and crates, its chests. */
const USE_OF_PLACE: Record<string, Use> = {
  village: 'home', town: 'home', city: 'home', farm: 'farm', mill: 'farm', camp: 'camp', shrine: 'temple', cathedral: 'temple', seat: 'temple',
  fort: 'smithy', ruin: 'dungeon', cave: 'dungeon', mine: 'dungeon', tower: 'dungeon', graveyard: 'dungeon', battlefield: 'dungeon',
}
/** And the buildings a place's kind makes something else of: a fort's barracks are its armoury, a cathedral's cloisters its sacristy. */
const BUILDINGS_OF_PLACE: Record<string, Use> = { fort: 'smithy', cathedral: 'temple', seat: 'temple' }

/** Each use's stores beside a building's door: what kind of container, and whether it keeps wares or the larder. */
const STORES: Record<Use, { type: string; keep: Keep }[]> = {
  home: [{ type: 'fixture/container/chest', keep: 'wares' }, { type: 'larder', keep: 'larder' }],
  shop: [{ type: 'fixture/container/shelf', keep: 'wares' }, { type: 'fixture/container/crate', keep: 'larder' }],
  smithy: [{ type: 'fixture/container/chest', keep: 'wares' }, { type: 'fixture/container/crate', keep: 'larder' }],
  inn: [{ type: 'fixture/container/barrel', keep: 'larder' }, { type: 'fixture/container/crate', keep: 'larder' }, { type: 'fixture/container/shelf', keep: 'wares' }],
  temple: [{ type: 'fixture/container/chest', keep: 'wares' }, { type: 'fixture/container/bookshelf', keep: 'books' }],
  camp: [{ type: 'fixture/container/crate', keep: 'any' }],
  farm: [{ type: 'fixture/container/sack', keep: 'larder' }],
  dungeon: [{ type: 'fixture/container/chest', keep: 'wares' }],
  library: [{ type: 'fixture/container/bookshelf', keep: 'books' }],
}
type Keep = 'wares' | 'larder' | 'books' | 'any'

/** The contexts of the item catalogue (content items.ts `where`) a use draws on. */
const CONTEXTS: Record<Use, Context[]> = {
  home: ['home'], shop: ['shop'], smithy: ['smithy'], inn: ['inn'], temple: ['temple'], camp: ['npc', 'home'], farm: ['farm'], dungeon: ['dungeon'], library: ['library'],
}
/** A region's larder: the container it keeps its food in. */
const LARDER: Record<string, string> = {
  frostfang: 'fixture/container/barrel', redmarch: 'fixture/container/crate', tithe: 'fixture/container/sack', palefen: 'fixture/container/barrel', altar: 'fixture/container/crate', holy: 'fixture/container/crate',
}
/** What a container is filled with when it stood there before (a barrel by a door, a ruin's chest); a market's stall keeps a trade's wares. */
const KEEP_OF: Record<string, Keep> = {
  'fixture/container/chest': 'wares', 'fixture/container/wardrobe': 'wares', 'fixture/container/shelf': 'wares', 'fixture/container/storehouse': 'any',
  'fixture/container/bookshelf': 'books', 'fixture/container/barrel': 'larder', 'fixture/container/crate': 'larder', 'fixture/container/sack': 'larder',
  'fixture/furniture/stall': 'any',
}
/** How many kinds a thing with no capacity (a market stall's board) keeps. */
const BOARD = 8

/**
 * The level a region's gear is of (world-model.md §6.8: twenty, the first the Ford's): the seals in the order the
 * pilgrimage reaches them, the Holy City last. Provisional, until each chapter's own maps set theirs.
 */
export const REGION_LEVEL: Record<string, number> = { frostfang: 2, redmarch: 5, tithe: 8, palefen: 11, altar: 14, holy: 16 }

/** The qualities stock comes in, by use (content QUALITIES' ids): the dark keeps the finest, a household the plainest. */
const QUALITY_W: Record<string, [string, number][]> = {
  home: [['crude', 3], ['common', 8], ['fine', 1]],
  trade: [['crude', 2], ['common', 8], ['fine', 3], ['masterwork', 0.7]],
  dungeon: [['crude', 2], ['common', 6], ['fine', 3], ['masterwork', 1.2], ['vowed', 0.15]],
}

const isLarder = (f: Form) => /^item\/(food|material|seed)\//.test(f.id)
const isBook = (f: Form) => f.id.startsWith('item/document/') || f.id.startsWith('item/armor/tome') || f.id.startsWith('item/misc/ink') || f.id.startsWith('item/misc/feather_quill')
const GEAR = /^item\/(weapon|armor|clothing|tool|valuable)\//

function weighted<T>(rng: Rng, xs: [T, number][]): T {
  let r = rng.next() * xs.reduce((a, [, w]) => a + w, 0)
  for (const [x, w] of xs) if ((r -= w) < 0) return x
  return xs[xs.length - 1][0]
}

/** What a container of `keep` kept for `use` in `region` may hold. */
function pool(region: string, use: Use, keep: Keep): [Form, number][] {
  const all = CONTEXTS[use].flatMap((c) => stockFor(region, c))
  const fit = (f: Form) => (keep === 'larder' ? isLarder(f) : keep === 'books' ? isBook(f) : keep === 'wares' ? !isLarder(f) : true)
  const out = all.filter(([f]) => fit(f))
  // (a use with nothing of a keep — an inn's books — keeps what it has)
  return out.length ? out : all
}

/** An item as stock: its material, quality, element and level rolled from the stock's own randomness. */
function specOf(rng: Rng, f: Form, region: string, use: Use): ItemSpec {
  const gear = GEAR.test(f.id)
  const own = f.tags?.some((t) => t.startsWith('quality:'))
  const level = Math.max(1, REGION_LEVEL[region] ?? 1) + rng.int(-1, 1)
  const qw = QUALITY_W[use === 'dungeon' ? 'dungeon' : use === 'home' || use === 'camp' || use === 'farm' ? 'home' : 'trade']
  return {
    form: f.id,
    ...(f.materials && { material: rng.pick(f.materials) }),
    ...(gear && !own && { quality: weighted(rng, qw) }),
    element: f.elemental && (use === 'dungeon' || use === 'smithy' || use === 'temple') && rng.chance(0.15) ? rng.pick(Object.keys(ELEMENT_NAMES)) : null,
    level,
  }
}

const stackKey = (e: Omit<Entity, 'id' | 'place'>) => `${e.type}|${JSON.stringify(e.name ?? '')}|${[...(e.tags ?? [])].sort().join(',')}`

/** Fill one container: as many kinds as it has slots for (most of them), a piece of gear one each, food and goods a few. */
export function fill(b: MapBuilder, rng: Rng, box: Entity, region: string, use: Use, keep: Keep): number {
  const capacity = Number(box.props?.capacity ?? capacityOf(box.type)) || 0
  const choices = pool(region, use, keep)
  if (!choices.length) return 0
  const kinds = capacity ? rng.int(Math.ceil(capacity * 0.6), capacity) : rng.int(BOARD - 3, BOARD)
  const keys = new Set<string>()
  let made = 0
  for (let k = 0, tries = 0; k < kinds && tries < kinds * 4; tries++) {
    const f = weighted(rng, choices)
    const spec = specOf(rng, f, region, use)
    const n = GEAR.test(f.id) ? 1 : rng.int(1, isLarder(f) ? 6 : 2)
    let first = true
    for (let i = 0; i < n; i++) {
      const it = b.makeItem(spec, { on: 'inside', holder: box.id })
      const key = stackKey(it)
      // (a kind already in it is the same slot; a new one needs a slot of its own)
      if (!keys.has(key)) {
        if (!first || keys.size >= (capacity || BOARD)) break
        keys.add(key)
        k++
      }
      first = false
      b.entities.push(it)
      made++
    }
  }
  return made
}

/** A container type's slots (content ontology `capacity`; a stall's board has none and keeps BOARD kinds). */
let onto: OntologyIndex | undefined
function capacityOf(type: string): number {
  onto ??= new OntologyIndex(buildOntology())
  return Number(onto.resolve(type).props.capacity ?? 0)
}

/** Where a building's door is (its prefab's `D`). */
function doorOf(key: string, x: number, y: number): Cell | undefined {
  const g = CATALOG.prefabs[key]?.grid
  if (!g) return undefined
  for (let j = 0; j < g.length; j++) {
    const i = g[j].indexOf('D')
    if (i >= 0) return [x + i, y + j]
  }
  return undefined
}

/** Free cells in front of a door, beside its step (never the step itself, nor the way to it). */
function besideDoor(b: MapBuilder, [dx, dy]: Cell): Cell[] {
  const near: Cell[] = [[-1, 1], [1, 1], [-2, 1], [2, 1], [-1, 2], [1, 2]]
  return near.map(([i, j]): Cell => [dx + i, dy + j]).filter(([x, y]) => b.free(x, y) && b.walkable(x, y) && b.get(x, y) !== 'door')
}

/** A free cell for a chest in a place that has none: off the paths, as near its middle as there is. */
function hideaway(b: MapBuilder, rng: Rng): Cell | undefined {
  const ways = new Set(['path', 'cobble', 'dirt', 'stairs_up', 'stairs_down', 'door'])
  const cells: Cell[] = []
  for (let y = 2; y < b.h - 2; y++) for (let x = 2; x < b.w - 2; x++) if (b.free(x, y) && b.walkable(x, y) && !ways.has(b.get(x, y)) && !b.portals.some((p) => p.x === x && p.y === y)) cells.push([x, y])
  if (!cells.length) return undefined
  cells.sort((a, c) => Math.hypot(a[0] - b.w / 2, a[1] - b.h / 2) - Math.hypot(c[0] - b.w / 2, c[1] - b.h / 2))
  return cells[rng.int(0, Math.min(cells.length - 1, 40))]
}

/**
 * Stock a map of `region`: every container already on it filled for `use`, and each building stamped on it given its
 * stores beside its door (unless the door leads somewhere: its room keeps them). `own` is the stock's randomness.
 */
export function stockMap(b: MapBuilder, region: string, use: Use, own: Rng, buildings?: Use): number {
  let made = 0
  const before = b.entities.filter((e) => e.place.on === 'tile' && KEEP_OF[e.type])
  for (const box of before) {
    if (b.entities.some((e) => e.place.on === 'inside' && e.place.holder === box.id)) continue
    const stall = box.type === 'fixture/furniture/stall'
    made += fill(b, own, box, region, stall ? own.pick(['shop', 'smithy', 'inn', 'temple', 'library'] as Use[]) : use, KEEP_OF[box.type])
  }
  for (const s of b.stamps) {
    const kind = USE_OF[s.key]
    const door = kind && doorOf(s.key, s.x, s.y)
    if (!kind || !door || b.portals.some((p) => p.x === door[0] && p.y === door[1])) continue
    const u = buildings ?? kind
    const cells = besideDoor(b, door)
    for (const store of STORES[u]) {
      const cell = cells.shift()
      if (!cell) break
      const type = store.type === 'larder' ? LARDER[region] ?? 'fixture/container/barrel' : store.type
      made += fill(b, own, b.fixture(type, cell[0], cell[1]), region, u, store.keep)
    }
  }
  return made
}

/** Stock a backdrop place's map (and its depths): by its kind and region (docs/continent.md §10). */
export function stockPlace(b: MapBuilder, p: Place, depths = false): number {
  const own = new Rng((p.seed ^ (depths ? 0x5f3759df : 0x2545f491)) | 0)
  const use: Use = depths ? 'dungeon' : USE_OF_PLACE[p.kind] ?? 'home'
  // a place of the dark keeps a chest of what was left there, if it has none
  if (use === 'dungeon' && !b.entities.some((e) => e.type === 'fixture/container/chest')) {
    const at = hideaway(b, own)
    if (at) b.fixture('fixture/container/chest', at[0], at[1])
  }
  return stockMap(b, p.region, use, own, depths ? undefined : BUILDINGS_OF_PLACE[p.kind])
}

/** What a room behind a backdrop door keeps (rooms.ts): by what it is — a home's, a farmhouse's, a shop's, a smithy's, an inn's, a chapel's, a cell's books. */
const USE_OF_ROOM: Record<Role, Use> = { home: 'home', farmhouse: 'farm', mill: 'farm', smithy: 'smithy', shop: 'shop', teahouse: 'inn', inn: 'inn', chapel: 'temple', tent: 'camp', barracks: 'smithy', cell: 'library' }

/** Stock a room behind a backdrop place's door, by what it is (its id's `<role>-<n>`) and the place's region. */
export function stockRoom(m: MapBuilder, p: Place): number {
  const role = m.id.slice(p.id.length + 1).replace(/-\d+$/, '') as Role
  const own = new Rng((p.seed ^ [...m.id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193), 0x811c9dc5)) | 0)
  return stockMap(m, p.region, USE_OF_ROOM[role] ?? 'home', own)
}
