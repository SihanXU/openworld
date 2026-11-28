// Shared tools of map composition for the demo's maps (the Ford, the meadow, the forest, and
// the main quest's maps under quest/). `fierce`: every minor monster's appearance may bring a fierce one, and about one
// in twelve of those placed is (content levels.ts FIERCE), chosen by where it stands so the maps' other draws stay;
// never one an older save knows by its id (quest/kept-ids.json), which stays as that save had it.

import { APPEAR_EVERY, rarify, type AppearDef, type Text } from '@openworld/engine'
import { CREATURE_ROLES, FIERCE, NIGHT_WALKERS, ROLES, creatureStats } from '@openworld-game/content'
import { MapBuilder, ONTO, rng } from './builder.ts'

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
  const statsOf = (type: string) => CREATURE_ROLES[type] && creatureStats(m.gearLevel, ROLES[CREATURE_ROLES[type]])
  for (const e of m.entities) if (CREATURE_ROLES[e.type]) e.props = { ...e.props, ...statsOf(e.type) }
  for (const type of [...Object.keys(NIGHT_WALKERS), ...m.appear.flatMap((a) => Object.keys(a.types))]) if (CREATURE_ROLES[type]) m.levelled[type] = statsOf(type)
}

const minor = (type: string) => !!CREATURE_ROLES[type] && CREATURE_ROLES[type] !== 'elite'

const share = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 2 ** 32
}

export function fierce(m: MapBuilder, kept: [string, string, string][] = []): void {
  const old = new Set(kept.map(([id]) => id))
  m.appear = m.appear.map((a) => (Object.keys(a.types).length && Object.keys(a.types).every(minor) ? { ...a, rare: FIERCE } : a))
  for (const e of m.entities) {
    if (!minor(e.type) || e.place.on !== 'tile' || old.has(e.id) || share(`${m.id}:${e.type}:${e.place.x},${e.place.y}`) >= FIERCE.chance) continue
    const def = ONTO.resolve(e.type)
    const made = rarify(FIERCE, def.name ?? e.type, { ...def.props, ...e.props })
    e.name = made.name
    e.props = { ...e.props, ...made.props }
    e.statuses = { ...e.statuses, ...Object.fromEntries((FIERCE.statuses ?? []).map((s) => [s, -1])) }
  }
}
