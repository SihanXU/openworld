// A street's houses (docs/showcase.md §4.2): townhouses side by side along a street, their fronts on one line, each its
// own width and height and wash (tools/src/art/arch/buildings/town.ts), an alley now and then; behind each door a room
// (continent/rooms.ts): a shop where the house hangs a sign, a home else.

import { MapBuilder, rng, type Cell } from '../builder.ts'
import { BUILDINGS } from '../../../../client/src/catalog.ts'
import type { DoorNote } from '../continent/rooms.ts'
import { HOUSE_SHOPS } from '../../art/arch/buildings/town.ts'


export interface Row {
  /** The doors laid, for the rooms behind them. */
  doors: DoorNote[]
  /** The cells in front of each door (the street, or the house's own yard). */
  fronts: Cell[]
  /** Each house's cells along the street and the row its front stands on (its wing's, if it brings one forward). */
  spans: { x0: number; x1: number; y: number }[]
  /** The street's line: the row the fronts stand on at most. */
  line: number
}

export interface RowOpts {
  /** How far a house may stand back from the street's line (cells, each its own), and the chance it does. */
  setback?: number
  /** The widest gap left between two houses (a side yard, a tree, a passage). */
  gap?: number
  /** What a house's own ground before it is: a garden (grass, a bed along the street, a hedge), a paved court, or bare. */
  yards?: ('garden' | 'court' | 'bare')[]
}

/**
 * Houses along a street from x0 to x1, the line of their fronts on row `y` (the street runs on the row below): models
 * from `pool` (town_house_<n>, town_hovel_<n>) in a shuffled order, no two alike side by side; each standing back from
 * the line a cell or two or not at all, gaps between them now and then — a side yard with a tree, a hedge, a passage —
 * and the ground a house leaves before it (its setback, or the corner its wing makes) its own: a garden behind a bed of
 * flowers, a paved court, bare earth. Not a wall of fronts but the irregular street of a town that grew (the user's ask
 * of 2026-10-25: "不规律的美"). Each door named `<prefix><n>` and noted for its room.
 */
export function houseRow(b: MapBuilder, x0: number, x1: number, y: number, pool: string[], prefix: string, alley = 0.3, opts: RowOpts = {}): Row {
  const out: Row = { doors: [], fronts: [], spans: [], line: y }
  const setback = opts.setback ?? 2
  const gapMax = opts.gap ?? 3
  const yards = opts.yards ?? ['garden', 'court', 'garden', 'bare']
  let x = x0
  let n = 0
  const order = [...pool].sort(() => rng.next() - 0.5)
  let i = 0
  let last = ''
  while (x < x1) {
    let name = order[i++ % order.length]
    if (name === last && order.length > 1) name = order[i++ % order.length]
    if (x + BUILDINGS[name].w > x1) {
      // the last gap: a narrower house if one fits, else the street's corner left open
      const fit = order.find((k) => BUILDINGS[k].w <= x1 - x && k !== last)
      if (!fit) break
      name = fit
    }
    place(name)
    last = name
    // a gap: a passage, a side yard with its tree
    if (rng.chance(alley)) {
      const g = Math.min(rng.int(1, gapMax), x1 - x)
      sideYard(x, g)
      x += g
    }
  }
  return out

  function place(name: string): void {
    const m = BUILDINGS[name]
    const door = `${prefix}${n++}`
    const back = setback && rng.chance(0.55) ? rng.int(1, setback) : 0
    const top = y - m.d + 1 - back
    const [cell] = b.building(name, x, top, [door], true)
    if (cell) {
      const idx = Number(/(\d+)$/.exec(name)?.[1] ?? 7)
      const shop = name.startsWith('town_house') && !!HOUSE_SHOPS[idx]
      out.doors.push({ door, prefab: name, role: shop ? 'shop' : 'home' })
      out.fronts.push([cell[0], cell[1] + 1])
    }
    // the house's own ground before it, column by column down to the street's line
    const kind = rng.pick(yards)
    const frontOf = (c: number) => {
      for (let r = m.d - 1; r >= 0; r--) if (m.slices.some((s) => s.row === r && s.grid[s.grid.length - 1][c - s.col] && s.grid[s.grid.length - 1][c - s.col] !== ' ')) return top + r
      return top - 1
    }
    let lowest = y
    for (let c = 0; c < m.w; c++) {
      const f = frontOf(c)
      lowest = Math.min(lowest, f)
      for (let yy = f + 1; yy <= y; yy++) {
        const doorPath = cell && x + c === cell[0]
        if (doorPath) b.set(x + c, yy, 'flags')
        else if (kind === 'garden') b.set(x + c, yy, yy === y && c > 0 && c < m.w - 1 ? 'flowerbed' : 'grass')
        else if (kind === 'court') b.set(x + c, yy, 'paving')
        else b.set(x + c, yy, 'dirt')
      }
    }
    // a garden's hedge at its ends, the court's corners each a pot
    if (kind === 'garden' && lowest < y)
      for (const c of [0, m.w - 1]) if (!(cell && x + c === cell[0]) && frontOf(c) < y) b.set(x + c, y, 'bush')
    out.spans.push({ x0: x, x1: x + m.w, y: Math.min(...Array.from({ length: m.w }, (_, c) => frontOf(c))) + 1 })
    x += m.w
  }

  /** A gap between two houses: grass, a tree at the back, a hedge or a passage of flags at the front. */
  function sideYard(gx: number, g: number): void {
    for (let c = gx; c < gx + g; c++) for (let yy = y - 6; yy <= y; yy++) if (b.in(c, yy) && b.get(c, yy) !== 'wall' && b.get(c, yy) !== 'door') b.set(c, yy, g === 1 && rng.chance(0.5) ? 'flags' : 'grass')
    if (g >= 2) b.set(gx + rng.int(0, g - 1), y - 4, 'tree')
    if (g >= 2 && rng.chance(0.5)) for (let c = gx; c < gx + g; c++) b.set(c, y, 'bush')
  }
}

/**
 * The step before every door of the map kept clear: whatever was set there (a lamp, a crate, a rack) taken away, and its
 * ground made one walks on. Laid last, so a street's furniture never shuts a house in.
 */
export function clearDoorsteps(b: MapBuilder): void {
  const steps = new Set<string>()
  for (let y = 0; y < b.h - 1; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === 'door') steps.add(`${x},${y + 1}`)
  b.entities = b.entities.filter((e) => !(e.place.on === 'tile' && steps.has(`${e.place.x},${e.place.y}`)))
  for (const k of steps) {
    const [x, y] = k.split(',').map(Number)
    if (['water', 'tree', 'bush', 'pine'].includes(b.get(x, y))) b.set(x, y, 'cobble')
  }
}

/** Every cell of a rect of a terrain, where nothing stands yet (a street's paving under its houses' fronts). */
export function pave(b: MapBuilder, x: number, y: number, w: number, h: number, t: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (b.in(i, j) && b.get(i, j) !== 'wall' && b.get(i, j) !== 'door') b.set(i, j, t)
}
