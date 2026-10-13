// Authored-content migration for the companion: Lumi was a bird and is a fairy now (2026-10-05).
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

/** Saves marked with it call the fairy by her name now: Lumi (2026-10-12; she was Pip). */
export const COMPANION_NAME = 'content.lumi-v1'

/** The fairy renamed: a save's companion keeps everything but the name it was given. */
export function migrateCompanionName(game: Game): void {
  const w = game.engine.world
  if (w.fact(COMPANION_NAME)) return
  for (const e of Object.values(w.state.entities)) if (e.type === 'actor/companion/fairy') e.name = { en: 'Lumi', zh: '露米' }
  w.setFact(COMPANION_NAME, true)
}
