// Shared tools of map composition for the demo's maps (the Ford, the meadow, the forest, and
// the main quest's maps under quest/).

import type { Forage, Text } from '@lsw/engine'
import { MapBuilder, rng } from './builder.ts'

export const L = (en: string, zh: string): Text => ({ en, zh })

/** Sticks, stones and grass: every outdoor map's ground yields them, up to a handful of each. */
export const MATERIALS_FORAGE: Forage[] = [
  { type: 'item/material/stick', on: ['grass'], max: 6 },
  { type: 'item/material/stone', on: ['grass'], max: 5 },
  { type: 'item/material/grass', on: ['grass', 'drygrass'], max: 6 },
]

/** Lay up to n of an item on open grass in a rect, spread on a fixed pattern (no randomness: the map's other draws stay as they were). */
export function lay(m: MapBuilder, type: string, n: number, [x0, y0, w, h]: [number, number, number, number]): void {
  for (let y = y0, k = 0; y < y0 + h && k < n; y++)
    for (let x = x0; x < x0 + w && k < n; x++) if ((x * 7 + y * 3) % 5 === 0 && ['grass', 'drygrass'].includes(m.get(x, y)) && m.free(x, y)) (m.item(type, x, y), k++)
}

/** A clump of trees (some pines, a few bushes) around a point, leaving free what is already built. */
export function clump(m: MapBuilder, cx: number, cy: number, r: number, p = 0.7): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x - cx, y - cy) <= r && m.get(x, y) === 'grass' && m.free(x, y) && rng.chance(p)) m.set(x, y, rng.chance(0.12) ? 'bush' : rng.chance(0.25) ? 'pine' : 'tree')
}
