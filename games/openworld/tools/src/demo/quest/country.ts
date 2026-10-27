// The ground of Part One's road east, laid in code for what each place is (docs/release-1.md §7, the redo of 2026-10-27,
// as Firstlight's was: village.ts `firstlightGround`): soft noise for where the heath and the woods swell, woods round a
// map laid as a belt that thickens in the corners and where the noise says, never on a road; and every edge cell one
// could walk off onto the world map closed but the ways' own (release.test.ts: east of the river nothing leaves a map
// but by its ways).

import { rng, type Cell, type MapBuilder } from '../builder.ts'

/** A lattice value for three integers, in [0, 1). */
function lattice(i: number, j: number, seed: number): number {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth noise in [0, 1): a lattice every `scale` cells, eased between, so what it lays comes in soft patches. */
export function noise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale
  const fy = y / scale
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const ease = (t: number) => t * t * (3 - 2 * t)
  const u = ease(fx - i)
  const v = ease(fy - j)
  const a = lattice(i, j, seed)
  const b = lattice(i + 1, j, seed)
  const c = lattice(i, j + 1, seed)
  const d = lattice(i + 1, j + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/**
 * Woods round a map: a belt `depth` cells deep, swelling by `swell` where the noise rises and thicker in the corners,
 * a single tree now and then just inside it; pines by `pines` (a share, in patches), broadleaf elsewhere. Never on a
 * cell `keep` holds (a road, a yard, a building's ground).
 */
export function woods(m: MapBuilder, keep: (x: number, y: number) => boolean, o: { depth?: number; swell?: number; pines?: number; seed?: number; tree?: string } = {}): void {
  const depth = o.depth ?? 3
  const swell = o.swell ?? 2.5
  const seed = o.seed ?? 1
  const pines = o.pines ?? 0.3
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      const corner = Math.min(Math.hypot(x, y), Math.hypot(m.w - 1 - x, y), Math.hypot(x, m.h - 1 - y), Math.hypot(m.w - 1 - x, m.h - 1 - y))
      const thick = depth + (noise(x, y, 5, seed) - 0.35) * swell * 2 + Math.max(0, 7 - corner) * 0.6
      const fringe = edge >= thick && edge < thick + 2 && rng.chance(0.07)
      if (edge < thick || fringe) m.set(x, y, o.tree ?? (noise(x, y, 4, seed + 7) < pines ? 'pine' : 'tree'))
    }
}

/** The cells a map's ways leave by, from the rows and columns its edges are linked on. */
export function ways(m: MapBuilder, e: { west?: readonly number[]; east?: readonly number[]; north?: readonly number[]; south?: readonly number[] }): Cell[] {
  return [
    ...(e.west ?? []).map((y): Cell => [0, y]),
    ...(e.east ?? []).map((y): Cell => [m.w - 1, y]),
    ...(e.north ?? []).map((x): Cell => [x, 0]),
    ...(e.south ?? []).map((x): Cell => [x, m.h - 1]),
  ]
}

/** Every edge cell one could stand on that is no way's: a tree (nothing walks off this map but by its ways). */
export function seal(m: MapBuilder, open: Cell[], tree = 'tree'): void {
  const way = new Set(open.map(([x, y]) => `${x},${y}`))
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (x !== 0 && y !== 0 && x !== m.w - 1 && y !== m.h - 1) continue
      if (way.has(`${x},${y}`) || !m.passable(x, y)) continue
      m.set(x, y, tree)
    }
  // (a way's own cells stay walkable, whatever was laid on them)
  for (const [x, y] of open) if (!m.passable(x, y)) m.set(x, y, 'path')
}

/** Whether (x, y) lies within `r` cells (Chebyshev) of a cell of terrain `t`. */
export const nearT = (m: MapBuilder, x: number, y: number, t: (u: string) => boolean, r = 1) => m.near(x, y, (u) => t(u), r)
