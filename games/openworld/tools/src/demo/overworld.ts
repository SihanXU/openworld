// The overworld (world-model.md §5.1): a continent ringed by sea, every cell of it a local map —
// the hand-made ones where their edge links put them, the wild everywhere else. Each cell is a
// block of BLOCK × BLOCK tiles, so a map split by a barrier shows its parts side by side with the
// barrier between (the Ford: the west bank, the river, the far bank); the river and a mountain
// range carry the Ford's barrier across the continent, so only the Ford crosses it (D22).

import { OntologyIndex, World, type Entity, type MapData, type Text, type WorldState } from '@lsw/engine'
import { TERRAINS, buildOntology, decodeMap, wildId, type RawChunk } from '@lsw/content'
import { MapBuilder, rng } from './builder.ts'
import { L } from './kit.ts'

export const OVERWORLD = 'overworld'
/** Tiles to a side of a cell's block. */
export const BLOCK = 3
/** Cells across and down the continent and its sea. */
export const CELLS = { w: 16, h: 12 }
/** The Ford's cell. */
export const FORD_CELL = { x: 7, y: 5 }
/** Minutes an overworld step lasts on plain ground (world-model.md §5.6). */
export const OVERWORLD_STEP = 30

/** The ground of each hand-made map's cell. */
const GROUND: Record<string, string> = {
  ford: 'ow_plain',
  meadow: 'ow_plain',
  pasture: 'ow_plain',
  forest: 'ow_forest',
  hollow: 'ow_forest',
  barrow: 'ow_hills',
  eastroad: 'ow_road',
  emberfall: 'ow_plain',
  mine: 'ow_hills',
  pass: 'ow_hills',
  lair: 'ow_hills',
  summit: 'ow_snow',
  mill: 'ow_plain',
  dawnhill: 'ow_hills',
  foot: 'ow_hills',
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

/** Where a hand-made map lies on the overworld: the top left of its cell's block. */
export const siteOf = (cell: { x: number; y: number }) => ({ map: OVERWORLD, x: (FORD_CELL.x + cell.x) * BLOCK, y: (FORD_CELL.y + cell.y) * BLOCK, size: BLOCK })

/** A world holding the hand-made maps' data, to read their parts as the engine does. */
function partsWorld(chunks: RawChunk[]): World {
  const maps: Record<string, MapData> = Object.fromEntries(chunks.map((c) => [c.map.id, decodeMap(c.map)]))
  const state = { tick: 0, seed: 1, rng: 1, player: 'p', entities: {}, maps, loadedMaps: [], counter: 0, spawn: { map: 'ford', x: 0, y: 0 } } as WorldState
  return new World(state, new OntologyIndex(buildOntology()))
}

/**
 * The overworld map, with a site on each cell of land. `chunks` are the hand-made maps (their
 * `site` set), `cells` where each lies (relative to the Ford's cell).
 */
export function buildOverworld(chunks: RawChunk[], cells: Map<string, { x: number; y: number }>): RawChunk {
  const m = new MapBuilder(OVERWORLD, L('The Frostfang Coast', '霜牙海岸'), 'overworld', CELLS.w * BLOCK, CELLS.h * BLOCK, 'ow_sea', 'field', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  const handmade = new Map<string, string>()
  for (const [id, c] of cells) handmade.set(`${FORD_CELL.x + c.x},${FORD_CELL.y + c.y}`, id)
  // the barrier the Ford crosses: a mountain range north of it, the river south of it, sea to sea
  const barrier = new Map<string, string>()
  for (let y = 1; y < FORD_CELL.y; y++) barrier.set(`${FORD_CELL.x + 1},${y}`, 'ow_mountain')
  for (let y = FORD_CELL.y + 1; y < CELLS.h - 1; y++) barrier.set(`${FORD_CELL.x},${y}`, 'ow_river')
  // the land: an island of the cells round the middle, roughly round, with every hand-made cell on it
  const land = (cx: number, cy: number) => {
    if (handmade.has(`${cx},${cy}`)) return true
    if (cx < 1 || cy < 1 || cx >= CELLS.w - 1 || cy >= CELLS.h - 1) return false
    const d = Math.hypot((cx - (CELLS.w - 1) / 2) / 7, (cy - (CELLS.h - 1) / 2) / 5)
    return d < 0.95 + (rng.next() - 0.5) * 0.25
  }
  const grounds = ['ow_plain', 'ow_plain', 'ow_forest', 'ow_forest', 'ow_hills']
  const block = (cx: number, cy: number, t: string) => m.rect(cx * BLOCK, cy * BLOCK, BLOCK, BLOCK, t)
  const kept: { cx: number; cy: number; ground: string; map?: string }[] = []
  for (let cy = 0; cy < CELLS.h; cy++)
    for (let cx = 0; cx < CELLS.w; cx++) {
      const k = `${cx},${cy}`
      const id = handmade.get(k)
      if (!id && barrier.has(k) && land(cx, cy)) {
        block(cx, cy, barrier.get(k)!)
        continue
      }
      if (!land(cx, cy)) continue
      const ground = id ? (GROUND[id] ?? 'ow_plain') : cy <= 2 ? (rng.chance(0.6) ? 'ow_snow' : 'ow_hills') : rng.pick(grounds)
      block(cx, cy, ground)
      kept.push({ cx, cy, ground, map: id })
    }
  // each hand-made block shows its map's parts: a tile of no part, or one that would touch
  // another part's tile, is the barrier between them (water: the river)
  const w = partsWorld(chunks)
  for (const k of kept) {
    if (!k.map) continue
    const parts = w.partsOf(k.map)!
    const data = w.map(k.map)!
    const tile: { part: number; count: number }[][] = []
    for (let j = 0; j < BLOCK; j++) {
      tile.push([])
      for (let i = 0; i < BLOCK; i++) {
        const part = w.regionPart(k.map, i, j, BLOCK)
        let count = 0
        for (let y = Math.floor((j * data.height) / BLOCK); y < Math.floor(((j + 1) * data.height) / BLOCK); y++)
          for (let x = Math.floor((i * data.width) / BLOCK); x < Math.floor(((i + 1) * data.width) / BLOCK); x++) if (parts[y * data.width + x] === part) count++
        tile[j].push({ part, count })
      }
    }
    for (let j = 0; j < BLOCK; j++)
      for (let i = 0; i < BLOCK; i++)
        for (const [di, dj] of [[1, 0], [0, 1]]) {
          const a = tile[j][i]
          const b = tile[j + dj]?.[i + di]
          if (!b || a.part < 0 || b.part < 0 || a.part === b.part) continue
          if (a.count <= b.count) a.part = -1
          else b.part = -1
        }
    for (let j = 0; j < BLOCK; j++) for (let i = 0; i < BLOCK; i++) if (tile[j][i].part < 0) m.set(k.cx * BLOCK + i, k.cy * BLOCK + j, 'ow_river')
  }
  // the mountain trail's foot meets the Ford's west bank only: the corner above the far bank is rock
  const foot = cells.get('foot')
  if (foot) m.set((FORD_CELL.x + foot.x) * BLOCK + BLOCK - 1, (FORD_CELL.y + foot.y) * BLOCK + BLOCK - 1, 'ow_mountain')
  // a site on each cell of land: the place it stands for
  const names = new Map(chunks.map((c) => [c.map.id, c.map.name]))
  const entities: Entity[] = []
  for (const k of kept) {
    const place = { on: 'tile' as const, map: OVERWORLD, x: k.cx * BLOCK + 1, y: k.cy * BLOCK + BLOCK - 1 }
    if (k.map) entities.push({ id: `site.${k.map}`, type: 'site/place', name: names.get(k.map), place, props: { map: k.map } })
    else entities.push({ id: `site.${k.cx}.${k.cy}`, type: 'site/wild', name: wildName(k.ground), place, props: { map: wildId(k.cx, k.cy), ground: k.ground } })
  }
  const chunk = m.chunk()
  chunk.map.scale = OVERWORLD_STEP
  chunk.entities.push(...entities)
  return chunk
}
