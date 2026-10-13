// The overworld (world-model.md §5.1): a continent ringed by sea, every cell of it a local map —
// the hand-made ones where their edge links put them, the wild everywhere else. One cell, one tile:
// the world map is a map of places, drawn in its own inked style (tools/src/art/worldmap.ts), never
// another stretch of ground. The river and a mountain range carry the Ford's barrier across the
// continent, and the Ford's own cell is the river's (a crossing one goes into from either bank), so
// only the Ford crosses it (D22).

import type { Entity, Text } from '@openworld/engine'
import { CH1, TERRAINS, wildId, type RawChunk } from '@openworld-game/content'
import { MapBuilder, rng } from './builder.ts'
import { L } from './kit.ts'

export const OVERWORLD = 'overworld'
/** Tiles to a side of a cell: one, a place to a tile. */
export const BLOCK = 1
/** Cells across and down the continent and its sea. */
export const CELLS = { w: 16, h: 12 }
/** The Ford's cell. */
export const FORD_CELL = { x: 7, y: 5 }
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
  const kept: { cx: number; cy: number; ground: string; map?: string }[] = []
  for (let cy = 0; cy < CELLS.h; cy++)
    for (let cx = 0; cx < CELLS.w; cx++) {
      const k = `${cx},${cy}`
      const id = handmade.get(k)
      if (!id && barrier.has(k) && land(cx, cy)) {
        m.set(cx, cy, barrier.get(k)!)
        continue
      }
      if (!land(cx, cy)) continue
      const ground = id ? (PLACES[id]?.ground ?? 'ow_plain') : cy <= 2 ? (rng.chance(0.6) ? 'ow_snow' : 'ow_hills') : rng.pick(grounds)
      m.set(cx, cy, ground)
      kept.push({ cx, cy, ground, map: id })
    }
  // a site on each cell of land: the place it stands for
  const names = new Map(chunks.map((c) => [c.map.id, c.map.name]))
  const entities: Entity[] = []
  for (const k of kept) {
    const place = { on: 'tile' as const, map: OVERWORLD, x: k.cx, y: k.cy }
    if (k.map) entities.push({ id: `site.${k.map}`, type: `site/place/${PLACES[k.map]?.kind ?? 'village'}`, name: names.get(k.map), place, props: { map: k.map, ...(PLACES[k.map]?.opensWhen && { opensWhen: PLACES[k.map].opensWhen! }) } })
    else entities.push({ id: `site.${k.cx}.${k.cy}`, type: 'site/wild', name: wildName(k.ground), place, props: { map: wildId(k.cx, k.cy), ground: k.ground } })
  }
  const chunk = m.chunk()
  chunk.map.scale = OVERWORLD_STEP
  chunk.entities.push(...entities)
  return chunk
}
