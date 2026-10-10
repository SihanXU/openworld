// Authored-content migration for the companion: Pip was a bird and is a fairy now (2026-10-05).
// An older save's companion is brought up to the world as it is now. It is the author's, run on
// loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'

/** Saves marked with it hold the fairy. */
export const COMPANION_LAYOUT = 'content.fairy-v1'

/** The bird becomes the fairy: same id, place, boons and memory; only its type changes. */
export function migrateCompanion(game: Game): void {
  const w = game.engine.world
  if (w.fact(COMPANION_LAYOUT)) return
  for (const e of Object.values(w.state.entities)) if (e.type === 'actor/companion/bird' && w.get(e.id)) w.transform(e, 'actor/companion/fairy')
  w.setFact(COMPANION_LAYOUT, true)
}
