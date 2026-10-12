// Authored-content migration for Firstlight's town and the Held Ground's smithy (2026-10-11). The village grew east
// and south (its houses have doors now, and rooms behind them: the store, the smithy, the church, homes); the first
// smithy stood in the open east of the square and moved indoors. An older save that has been to these maps has the
// signs, lamps, forge and anvil the maps have now (`ADDED`);
// the rooms and their people come as they are first loaded and as the world's people do. It is the author's, run on
// loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@openworld/engine'

/** Saves marked with it have the town as it is now. */
export const SMITHY_LAYOUT = 'content.town-v2'
/** The open-air smithy of the first layout: gone indoors (its sign moved to the smithy's door). */
const MOVED = ['village.forge', 'village.anvil', 'village.smithy.sign']
/** What the town and the Held Ground's smithy put on maps an older save has seen. */
const ADDED = ['village.store.sign', 'village.smithy.sign', 'village.church.sign', 'village.lamp.45', 'village.lamp.56', 'haven.forge', 'haven.anvil']

export function migrateSmithy(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  if (w.fact(SMITHY_LAYOUT)) return
  for (const id of MOVED) {
    const e = w.get(id)
    if (e) w.destroy(e)
  }
  for (const c of chunks) {
    // a map not yet visited gets them when it is first loaded
    if (!w.state.loadedMaps.includes(c.map.id)) continue
    for (const e of c.entities) if (ADDED.includes(e.id) && !w.get(e.id)) w.add(structuredClone(e))
  }
  w.setFact(SMITHY_LAYOUT, true)
}
