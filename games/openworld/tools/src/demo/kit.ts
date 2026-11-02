// Shared tools of map composition for the demo's maps (the Ford, the meadow, the forest, and
// the main quest's maps under quest/).

import { APPEAR_EVERY, type AppearDef, type Text } from '@openworld/engine'
import { CREATURE_ROLES, ROLES, creatureStats } from '@openworld-game/content'
import { MapBuilder, rng } from './builder.ts'

export const L = (en: string, zh: string): Text => ({ en, zh })

/** One type that appears on a map by itself, now and then, up to `max` (MapData.appear, world-model.md §6.9). */
export const appears = (type: string, on: string[], max: number, every = APPEAR_EVERY, more: Partial<AppearDef> = {}): AppearDef => ({ types: { [type]: 1 }, on, max, every, ...more })

/** Sticks, stones and grass: every outdoor map's ground yields them, up to a handful of each. */
export const GROUND_YIELD: AppearDef[] = [
  appears('item/material/stick', ['grass'], 6),
  appears('item/material/stone', ['grass'], 5),
  appears('item/material/grass', ['grass', 'drygrass'], 6),
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

/**
 * The minor monsters of a map met later in the story, at the map's own level (its `gearLevel`): a kind's numbers are its
 * trophy's level everywhere else (content levels.ts), but a wolf on the White Stair is not a wolf of Hushwood. Its role
 * keeps how it plays; the curve gives its health, attack and defence at the level.
 */
export function levelCreatures(m: MapBuilder): void {
  for (const e of m.entities) {
    const role = CREATURE_ROLES[e.type]
    if (role && e.type.startsWith('actor/creature/') && !e.type.startsWith('actor/creature/sin/')) e.props = { ...e.props, ...creatureStats(m.gearLevel, ROLES[role]) }
  }
}
