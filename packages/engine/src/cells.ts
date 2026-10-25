// A map's cells as things (world-model.md §4.6, §5.2). A map is authored as one terrain per cell,
// the thing on top of it; here that becomes the cell's own things, one per space: the floor one
// stands on, and what roots in the soil (a stump) or fills the volume (a tree, rock, a wall). The
// ground under a tree or a rock is not authored, so it is taken from the nearest floors around
// it. These things live in the map's static data until one changes; then the world keeps it under
// the same id (materialised), so rules and the AI see one thing with one id either way.

import type { MapData } from './types.ts'

/** The spaces a map's static layers fill, bottom to top. */
export type CellSpace = 'floor' | 'soil' | 'volume'
export const CELL_SPACES: CellSpace[] = ['floor', 'soil', 'volume']

/** A cell thing's id: its map, cell and space (`ford:12,8,0:volume`). */
export const cellId = (map: string, x: number, y: number, space: CellSpace, z = 0): string => `${map}:${x},${y},${z}:${space}`

const CELL_ID = /^(.+):(-?\d+),(-?\d+),(-?\d+):(floor|soil|volume)$/

/** The cell and space an id was derived from, if it is a cell thing's. */
export function parseCellId(id: string): { map: string; x: number; y: number; z: number; space: CellSpace } | undefined {
  const m = CELL_ID.exec(id)
  return m ? { map: m[1], x: +m[2], y: +m[3], z: +m[4], space: m[5] as CellSpace } : undefined
}

/** A map's static cell things: the terrain id in each space of each cell (undefined: empty). */
export interface Layers {
  floor: (string | undefined)[]
  soil: (string | undefined)[]
  volume: (string | undefined)[]
}

/**
 * What one stands on that is a way through, never the ground under a filled cell: a wall broken beside a house's
 * door leaves the ground of the street, not a second door (the kernel's tags `door` and `stairs`).
 */
export const WAY_TAGS = ['door', 'stairs']

/** How far around a filled cell the ground under it is looked for. */
const GROUND_REACH = 8
/** The ground under a filled cell nothing around tells. */
const DEFAULT_GROUND = 'dirt'

/**
 * Split a map's authored terrain into its layers. A cell whose terrain fills the volume or roots
 * in the soil gets the floor most common among the nearest cells that show one can stand on
 * (else any floor; ties: the first met, scanning outward row by row) — deterministic, from the
 * map alone.
 */
export function splitLayers(m: MapData, spaceOf: (terrain: string) => CellSpace, standable: (terrain: string) => boolean): Layers {
  const n = m.width * m.height
  const floor: (string | undefined)[] = new Array(n)
  const soil: (string | undefined)[] = new Array(n)
  const volume: (string | undefined)[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const t = m.terrain[i]
    const s = spaceOf(t)
    if (s === 'floor') floor[i] = t
    else if (s === 'soil') soil[i] = t
    else volume[i] = t
  }
  for (let i = 0; i < n; i++) {
    if (floor[i] !== undefined) continue
    const x0 = i % m.width
    const y0 = Math.floor(i / m.width)
    let found: string | undefined
    for (const ok of [standable, () => true])
    for (let r = 1; r <= GROUND_REACH && found === undefined; r++) {
      const count = new Map<string, number>()
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = x0 + dx
          const y = y0 + dy
          if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue
          const t = m.terrain[y * m.width + x]
          if (spaceOf(t) === 'floor' && ok(t)) count.set(t, (count.get(t) ?? 0) + 1)
        }
      let best = 0
      for (const [t, c] of count) if (c > best) [found, best] = [t, c]
    }
    floor[i] = found ?? DEFAULT_GROUND
  }
  return { floor, soil, volume }
}
