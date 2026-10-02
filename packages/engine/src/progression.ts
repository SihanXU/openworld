// Experience and levels: an actor that defeats another gains experience (the rules decide how
// much, through the `gainXp` primitive); enough of it raises the level, and each level brings a
// skill point. Any actor carries these props, not only the player: `xp` (toward the next
// level), `level` (from 1) and `skillPoints` (unspent; the skill tree spends them later).

import type { Entity } from './types.ts'
import type { World } from './world.ts'

/** Experience needed to go from `level` to the next: 20, 40, 60 … */
export const xpToNext = (level: number): number => 20 * Math.max(1, level)

/** Add experience to an actor; returns how many levels it gained. */
export function gainXp(w: World, e: Entity, amount: number): number {
  const props = (e.props ??= {})
  let level = Math.max(1, Number(props.level ?? 1))
  let xp = Number(props.xp ?? 0) + Math.max(0, Math.round(amount))
  let gained = 0
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
    gained++
  }
  props.xp = xp
  props.level = level
  if (gained) props.skillPoints = Number(props.skillPoints ?? 0) + gained
  return gained
}
