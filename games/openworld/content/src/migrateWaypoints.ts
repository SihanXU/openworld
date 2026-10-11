// Authored-content migration for the waypoint statues: Cloudtop's was removed (2026-10-11); an older save's goes
// with it (one who made it home rises where the world began). It is the author's, run on loading (the caller
// holds the author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'

/** Saves marked with it hold no statue on Cloudtop. */
export const WAYPOINTS_LAYOUT = 'content.waypoints-v2'
const REMOVED = ['wp.summit']

export function migrateWaypoints(game: Game): void {
  const w = game.engine.world
  if (w.fact(WAYPOINTS_LAYOUT)) return
  for (const id of REMOVED) {
    const e = w.get(id)
    if (e) w.destroy(e)
  }
  w.setFact(WAYPOINTS_LAYOUT, true)
}
