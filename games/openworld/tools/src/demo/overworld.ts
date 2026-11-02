// The overworld (world-model.md §5.1, docs/continent.md): the continent, every cell of it a local map — the
// hand-made ones where their edge links put them, the backdrop's places where the gazetteer puts them, the wild
// everywhere else. One cell, one tile: the world map is a map of places, drawn in its own inked style
// (tools/src/art/worldmap.ts), never another stretch of ground. The continent itself is data (continent/continent.json,
// made by continent/generate.ts): its grounds, its regions and its places. The river and a mountain range carry the
// Ford's barrier to the sea, and the Ford's own cell is the river's (a crossing one goes into from either bank), so
// only the Ford crosses it (D22).

import { readFileSync } from 'node:fs'
import type { Entity, Text } from '@openworld/engine'
import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_THREE, CHAPTER_TWO, FINALE, PART_TWO, TERRAINS, TERRAIN_CHARS, UNTOLD, VALLEY, wildId, type RawChunk } from '@openworld-game/content'
import { MapBuilder } from './builder.ts'
import { L } from './kit.ts'
import { CONTINENT_FILE, FORD, HEIGHT, WIDTH, type Continent } from './continent/generate.ts'

export const OVERWORLD = 'overworld'
/** Tiles to a side of a cell: one, a place to a tile. */
export const BLOCK = 1
/** Cells across and down the continent and its sea. */
export const CELLS = { w: WIDTH, h: HEIGHT }
/** The Ford's cell. */
export const FORD_CELL = FORD
/** Minutes an overworld step lasts on plain ground (world-model.md §5.6): a cell crossed. */
export const OVERWORLD_STEP = 30

/**
 * Each hand-made map's cell on the world map: its ground, what it is drawn as (its site's kind), the story's fact
 * that opens it (content SITE_GATES; unset, it is sealed: the way the East Road's portal is), and the one that opens
 * its edges (`edgesWhen`, MapData: east of the river the continent is Part Two's, so until then no edge of the
 * Pilgrim's Road leads onto it, whatever woods are felled there; docs/release-1.md §1).
 */
const PLACES: Record<string, { ground: string; kind: string; opensWhen?: string; edgesWhen?: string; asIs?: true; replaces?: string; cell?: [number, number] }> = {
  ford: { ground: 'ow_river', kind: 'crossing' },
  meadow: { ground: 'ow_plain', kind: 'village' },
  pasture: { ground: 'ow_plain', kind: 'farm' },
  forest: { ground: 'ow_plain', kind: 'woods' },
  hollow: { ground: 'ow_plain', kind: 'hollow' },
  charcoal: { ground: 'ow_forest', kind: 'woods' },
  // the river's own cell (the barrier's, D22): a camp on the near bank, reached through the forest alone
  reedbend: { ground: 'ow_river', kind: 'camp' },
  barrow: { ground: 'ow_plain', kind: 'barrow' },
  // east of the Ford, the Pilgrim's Road to the White Knight: Part One's, as the west bank is
  waystation: { ground: 'ow_road', kind: 'camp', edgesWhen: PART_TWO },
  pilgrimway: { ground: 'ow_road', kind: 'waystone', edgesWhen: PART_TWO },
  abbey: { ground: 'ow_forest', kind: 'shrine', edgesWhen: PART_TWO },
  kneelfield: { ground: 'ow_plain', kind: 'barrow', edgesWhen: PART_TWO },
  eastroad: { ground: 'ow_road', kind: 'waystone', edgesWhen: PART_TWO },
  // past the knight: Chapter 2's, opened by the Crown home (docs/chapter-2.md §12); their edges, the continent's
  emberfall: { ground: 'ow_plain', kind: 'town', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO },
  mine: { ground: 'ow_plain', kind: 'mine', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO },
  pass: { ground: 'ow_plain', kind: 'pass', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO },
  lair: { ground: 'ow_plain', kind: 'lair', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO },
  // over the pass, the Scarred March's west end, along the pilgrims' road as the continent made it (`asIs`): Chapter 2's
  // (docs/chapter-2.md §11); the Bastion stands for the continent's own seat of the March, sealed far to the east
  lashmarks: { ground: 'ow_road', kind: 'battlefield', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO, asIs: true },
  redcamp: { ground: 'ow_road', kind: 'camp', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO, asIs: true },
  scourgehouse: { ground: 'ow_road', kind: 'shrine', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO, asIs: true },
  bastion: { ground: 'ow_road', kind: 'seat', opensWhen: CHAPTER_TWO, edgesWhen: PART_TWO, asIs: true, replaces: 'redmarch.the-war-giver-s-bastion' },
  // the Vale of Scales, down the grain road from the camp (docs/chapter-3.md §11): a chain on the continent's road west of
  // Weighmarket, its first map's cell fixed (the long road from the camp is a portal, not a step); the Black Balance stands
  // for the Vale's own sealed seat far to the south
  chaffroad: { ground: 'ow_road', kind: 'waystone', opensWhen: CHAPTER_THREE, edgesWhen: PART_TWO, asIs: true, cell: [45, 24] },
  fairweight: { ground: 'ow_road', kind: 'town', opensWhen: CHAPTER_THREE, edgesWhen: PART_TWO, asIs: true },
  saltpans: { ground: 'ow_road', kind: 'camp', opensWhen: CHAPTER_THREE, edgesWhen: PART_TWO, asIs: true },
  blackbalance: { ground: 'ow_road', kind: 'seat', opensWhen: CHAPTER_THREE, edgesWhen: PART_TWO, asIs: true, replaces: 'tithe.the-black-balance' },
  // the Pale Fens, down the fen road from Fairweight (docs/chapter-4.md §11): a chain down the continent's causeway road, its
  // first map's cell fixed; the Ossuary stands for the Fens' own sealed seat
  causeway: { ground: 'ow_road', kind: 'waystone', opensWhen: CHAPTER_FOUR, edgesWhen: PART_TWO, asIs: true, cell: [42, 33] },
  nailgate: { ground: 'ow_road', kind: 'village', opensWhen: CHAPTER_FOUR, edgesWhen: PART_TWO, asIs: true },
  drowned: { ground: 'ow_road', kind: 'graveyard', opensWhen: CHAPTER_FOUR, edgesWhen: PART_TWO, asIs: true },
  boneisle: { ground: 'ow_forest', kind: 'seat', opensWhen: CHAPTER_FOUR, edgesWhen: PART_TWO, asIs: true, replaces: 'palefen.the-pale-rider-s-ossuary' },
  // the White Altar Heights, up the road west from Nailgate (docs/chapter-5.md §11): the stair on the continent's road, the
  // abbey above it standing for the Heights' own sealed seat
  whitestair: { ground: 'ow_road', kind: 'shrine', opensWhen: CHAPTER_FIVE, edgesWhen: PART_TWO, asIs: true, cell: [12, 27] },
  whiteveil: { ground: 'ow_road', kind: 'seat', opensWhen: CHAPTER_FIVE, edgesWhen: PART_TWO, asIs: true, replaces: 'altar.the-altar-beneath' },
  // the Most Holy Hall, at the heart of the Holy City (docs/finale.md §10): the hand-made close on the Hall's own cell,
  // standing for the continent's sealed Hall among the city's quarters
  holyhall: { ground: 'ow_city', kind: 'cathedral', opensWhen: FINALE, edgesWhen: PART_TWO, asIs: true, replaces: 'holy.hall', cell: [31, 23] },
  summit: { ground: 'ow_snow', kind: 'summit' },
  mill: { ground: 'ow_plain', kind: 'watermill' },
  dawnhill: { ground: 'ow_plain', kind: 'shrine' },
  foot: { ground: 'ow_plain', kind: 'camp' },
  hillmine: { ground: 'ow_hills', kind: 'mine' },
}

/**
 * Each map's cell, from the edge links (a portal on a map's east edge puts the map it leads to in
 * the cell east of it): relative to the origin's cell. Maps reached only through doors have none. A chain whose first map
 * has its cell fixed (PLACES `cell`, on the continent: a later chapter's, its long road a portal) is laid from there.
 */
export function placeCells(builders: MapBuilder[], origin: MapBuilder): Map<string, { x: number; y: number }> {
  const by = new Map(builders.map((b) => [b.id, b]))
  const out = new Map([[origin.id, { x: 0, y: 0 }]])
  // (the fixed are kept from the first spread, which reaches them only by their long roads, and spread from after it)
  const fixed = builders.filter((b) => PLACES[b.id]?.cell)
  for (const b of fixed) {
    const c = PLACES[b.id].cell!
    out.set(b.id, { x: c[0] - FORD_CELL.x, y: c[1] - FORD_CELL.y })
  }
  const spread = (queue: MapBuilder[]) => {
    while (queue.length) {
      const a = queue.shift()!
      const pa = out.get(a.id)!
      for (const p of a.portals) {
        const b = by.get(p.to)
        if (!b || out.has(b.id)) continue
        const d = p.x === a.w - 1 ? [1, 0] : p.x === 0 ? [-1, 0] : p.y === a.h - 1 ? [0, 1] : p.y === 0 ? [0, -1] : undefined
        if (!d) continue
        out.set(b.id, { x: pa.x + d[0], y: pa.y + d[1] })
        queue.push(b)
      }
    }
  }
  spread([origin])
  spread(fixed)
  return out
}

/** A wild place is named by its ground, as it is drawn: "The wild forest", 森林荒野. */
const wildName = (ground: string): Text => {
  const t = TERRAINS.find((x) => x.id === ground)
  const n = t?.name && typeof t.name === 'object' ? t.name : { en: ground, zh: ground }
  return { en: `The wild ${n.en}`, zh: `${n.zh ?? n.en}荒野` }
}


/** The fact that opens a hand-made map's edges (PLACES), where the story keeps them shut. */
export const edgesWhen = (map: string): string | undefined => PLACES[map]?.edgesWhen

/** Where a hand-made map lies on the overworld: its cell. */
export const siteOf = (cell: { x: number; y: number }) => ({ map: OVERWORLD, x: (FORD_CELL.x + cell.x) * BLOCK, y: (FORD_CELL.y + cell.y) * BLOCK, size: BLOCK })

let continent: Continent | undefined
/** The continent as kept (continent/continent.json). */
export function readContinent(): Continent {
  return (continent ??= JSON.parse(readFileSync(CONTINENT_FILE, 'utf8')) as Continent)
}

/** The continent's places a hand-made place stands for (drawn as the wild on the world map). */
export const REPLACED = new Set(Object.values(PLACES).flatMap((p) => (p.replaces ? [p.replaces] : [])))

/**
 * The hand-made places' cells and grounds, for the continent's generator (`fixed`: "x,y" → ground), and the cell
 * the pilgrims' road goes on east from (the pass beyond Emberfall). A place laid on a cell as the continent made it
 * (`asIs`: the March's along the road) is not the generator's: its ground must be the cell's own (buildOverworld).
 */
export function handmadeGrounds(cells: Map<string, { x: number; y: number }>): { fixed: Map<string, string>; east: [number, number] } {
  const fixed = new Map<string, string>()
  for (const [id, c] of cells) if (!PLACES[id]?.asIs) fixed.set(`${FORD_CELL.x + c.x},${FORD_CELL.y + c.y}`, PLACES[id]?.ground ?? 'ow_plain')
  const pass = cells.get('pass') ?? { x: 0, y: 0 }
  return { fixed, east: [FORD_CELL.x + pass.x, FORD_CELL.y + pass.y] }
}

const SOLID = new Set(['ow_sea', 'ow_mountain', 'ow_river'])

/**
 * The overworld map, with a site on each cell of land: the hand-made maps' (`chunks`, lying at `cells`, relative to the
 * Ford's), the gazetteer's places, the wild. The continent must have been made for these cells (`npm run continent`).
 */
export function buildOverworld(chunks: RawChunk[], cells: Map<string, { x: number; y: number }>): RawChunk {
  const c = readContinent()
  const m = new MapBuilder(OVERWORLD, L('The Lands of the Five Seals', '五印之地'), 'overworld', c.width * BLOCK, c.height * BLOCK, 'ow_sea', 'worldmap', 'outdoor', 'world')
  m.zone = 'peaceful'
  const ground = (x: number, y: number) => TERRAIN_CHARS[c.rows[y][x]]
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) m.set(x, y, ground(x, y))
  const regionOf = (x: number, y: number): string | undefined => c.keys[c.regions[y][x]]
  const handmade = new Map<string, string>()
  const stale: string[] = []
  for (const [id, cell] of cells) {
    const [x, y] = [FORD_CELL.x + cell.x, FORD_CELL.y + cell.y]
    handmade.set(`${x},${y}`, id)
    if (ground(x, y) !== (PLACES[id]?.ground ?? 'ow_plain')) stale.push(`${id} at ${x},${y}`)
  }
  // (a continent's place a hand-made one stands for is drawn as the wild there: the March's seat, the Bastion's)
  const shown = c.places.filter((p) => !REPLACED.has(p.id))
  const places = new Map(shown.map((p) => [`${p.x},${p.y}`, p]))
  for (const p of shown) if (handmade.has(`${p.x},${p.y}`)) stale.push(`${p.id} on ${handmade.get(`${p.x},${p.y}`)}'s cell`)
  if (stale.length) throw new Error(`the continent is not made for the hand-made places (npm run continent): ${stale.join('; ')}`)
  // a site on each cell of land one can stand on, and on the Ford's (the crossing): the place it stands for
  const names = new Map(chunks.map((ch) => [ch.map.id, ch.map.name]))
  const entities: Entity[] = []
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const g = ground(x, y)
      const id = handmade.get(`${x},${y}`)
      const p = places.get(`${x},${y}`)
      if (SOLID.has(g) && !id) continue
      const place = { on: 'tile' as const, map: OVERWORLD, x, y }
      const region = regionOf(x, y)
      if (id) entities.push({ id: `site.${id}`, type: `site/place/${PLACES[id]?.kind ?? 'village'}`, name: names.get(id), place, props: { map: id, ...(region && { region }), ...(PLACES[id]?.opensWhen && { opensWhen: PLACES[id].opensWhen! }) } })
      else if (p) entities.push({ id: `site.${p.id}`, type: `site/place/${p.kind}`, name: p.name, place, props: { map: p.id, region: p.region, ground: g, backdrop: true, ...(p.capital && { capital: true }), ...(p.sealed && { opensWhen: UNTOLD }) } })
      else entities.push({ id: `site.${x}.${y}`, type: 'site/wild', name: VALLEY[`${x},${y}`]?.name ?? wildName(g), place, props: { map: wildId(x, y), ground: g, ...(region && { region }) } })
    }
  const chunk = m.chunk()
  chunk.map.scale = OVERWORLD_STEP
  chunk.entities.push(...entities)
  return chunk
}
