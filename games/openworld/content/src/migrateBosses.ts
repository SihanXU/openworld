// Authored-content migration for the boss kits, kept outside the generic engine: an older save is
// brought up to the world as it is now. It is the author's, run on loading (the caller holds the
// author's hand: `engine.author`), never game code.
import type { Game } from '@lsw/engine'
import { BOSS_LAYOUT, REMOVED_BOSSES } from './bosses.ts'

/** Clear the bodies of removed kits (the East Road's Gilt Tollkeeper of older saves): their types are gone. */
export function migrateBosses(game: Game): void {
  const w = game.engine.world
  if (w.fact(BOSS_LAYOUT)) return
  const removed = new Set(REMOVED_BOSSES.map((id) => `actor/creature/sin/${id}`))
  for (const e of Object.values(w.state.entities)) if (removed.has(e.type) && w.get(e.id)) w.destroy(e)
  w.setFact(BOSS_LAYOUT, true)
}
