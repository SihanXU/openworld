// The overworld (world-model.md §5.1, docs/continent.md): the continent, every cell of it a local map — the
// hand-made ones where their edge links put them, the backdrop's places where the gazetteer puts them, the wild
// everywhere else. One cell, one tile: the world map is a map of places, drawn in its own inked style
// (tools/src/art/worldmap.ts), never another stretch of ground. The continent itself is data (continent/continent.json,
// made by continent/generate.ts): its grounds, its regions and its places. The river and a mountain range carry the
// Ford's barrier to the sea, and the Ford's own cell is the river's (a crossing one goes into from either bank), so
// only the Ford crosses it (D22).

import { readFileSync } from 'node:fs'
import type { Entity, Text } from '@openworld/engine'
import { CH1, TERRAINS, TERRAIN_CHARS, UNTOLD, wildId, type RawChunk } from '@openworld-game/content'
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
 * Each hand-made map's cell on the world map: its ground, what it is drawn as (its site's kind), and the story's
 * fact that opens it (content SITE_GATES; unset, it is sealed: the way the East Road's portal is).
 */
const PLACES: Record<string, { ground: string; kind: string; opensWhen?: string }> = {
  ford: { ground: 'ow_river', kind: 'crossing' },
  meadow: { ground: 'ow_plain', kind: 'village' },
  pasture: { ground: 'ow_plain', kind: 'farm' },
  forest: { ground: 'ow_plain', kind: 'woods' },
  hollow: { ground: 'ow_plain', kind: 'hollow' },
  charcoal: { ground: 'ow_forest', kind: 'woods' },
  // the river's own cell (the barrier's, D22): a camp on the near bank, reached through the forest alone
  reedbend: { ground: 'ow_river', kind: 'camp' },
  barrow: { ground: 'ow_plain', kind: 'barrow' },
  waystation: { ground: 'ow_road', kind: 'camp' },
  pilgrimway: { ground: 'ow_road', kind: 'waystone' },
  abbey: { ground: 'ow_forest', kind: 'shrine' },
  kneelfield: { ground: 'ow_plain', kind: 'barrow' },
  eastroad: { ground: 'ow_road', kind: 'waystone' },
  emberfall: { ground: 'ow_plain', kind: 'town', opensWhen: CH1.knight },
  mine: { ground: 'ow_plain', kind: 'mine', opensWhen: CH1.knight },
  pass: { ground: 'ow_plain', kind: 'pass', opensWhen: CH1.knight },
  lair: { ground: 'ow_plain', kind: 'lair', opensWhen: CH1.knight },
  summit: { ground: 'ow_snow', kind: 'summit' },
  mill: { ground: 'ow_plain', kind: 'mill' },
  dawnhill: { ground: 'ow_plain', kind: 'shrine' },
  foot: { ground: 'ow_plain', kind: 'camp' },
  hillmine: { ground: 'ow_hills', kind: 'mine' },
}

/**
 * Each map's cell, from the edge links (a portal on a map's east edge puts the map it leads to in
 * the cell east of it): relative to the origin's cell. Maps reached only through doors have none.
 */
export function placeCells(builders: MapBuilder[], origin: MapBuilder): Map<string, { x: number; y: number }> {
  const by = new Map(builders.map((b) => [b.id, b]))
  const out = new Map([[origin.id, { x: 0, y: 0 }]])
  const queue = [origin]
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
  return out
}

/** A wild place is named by its ground, as it is drawn: "The wild forest", 森林荒野. */
const wildName = (ground: string): Text => {
  const t = TERRAINS.find((x) => x.id === ground)
  const n = t?.name && typeof t.name === 'object' ? t.name : { en: ground, zh: ground }
  return { en: `The wild ${n.en}`, zh: `${n.zh ?? n.en}荒野` }
}


/** Where a hand-made map lies on the overworld: its cell. */
export const siteOf = (cell: { x: number; y: number }) => ({ map: OVERWORLD, x: (FORD_CELL.x + cell.x) * BLOCK, y: (FORD_CELL.y + cell.y) * BLOCK, size: BLOCK })

let continent: Continent | undefined
/** The continent as kept (continent/continent.json). */
export function readContinent(): Continent {
  return (continent ??= JSON.parse(readFileSync(CONTINENT_FILE, 'utf8')) as Continent)
}

/**
 * The hand-made places' cells and grounds, for the continent's generator (`fixed`: "x,y" → ground), and the cell
 * the pilgrims' road goes on east from (the pass beyond Emberfall).
 */
export function handmadeGrounds(cells: Map<string, { x: number; y: number }>): { fixed: Map<string, string>; east: [number, number] } {
  const fixed = new Map<string, string>()
  for (const [id, c] of cells) fixed.set(`${FORD_CELL.x + c.x},${FORD_CELL.y + c.y}`, PLACES[id]?.ground ?? 'ow_plain')
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
  const m = new MapBuilder(OVERWORLD, L('The Lands of the Five Seals', '五印之地'), 'overworld', c.width * BLOCK, c.height * BLOCK, 'ow_sea', 'field', 'outdoor', 'world')
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
  const places = new Map(c.places.map((p) => [`${p.x},${p.y}`, p]))
  for (const p of c.places) if (handmade.has(`${p.x},${p.y}`)) stale.push(`${p.id} on ${handmade.get(`${p.x},${p.y}`)}'s cell`)
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
      else entities.push({ id: `site.${x}.${y}`, type: 'site/wild', name: wildName(g), place, props: { map: wildId(x, y), ground: g, ...(region && { region }) } })
    }
  const chunk = m.chunk()
  chunk.map.scale = OVERWORLD_STEP
  chunk.entities.push(...entities)
  return chunk
}
