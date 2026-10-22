// Authored-content migration for the tents (2026-10-11): each has a room behind its flap now (its `interior` props). An
// older save's tents, standing where the maps have them, take those props. It is the author's, run on loading (the
// caller holds the author's hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@openworld/engine'

export function migrateTents(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  for (const c of chunks)
    for (const t of c.entities) {
      if (t.type !== 'fixture/tent' || typeof t.props?.interior !== 'string' || t.place.on !== 'tile') continue
      const { x, y } = t.place
      const saved = Object.values(w.state.entities).find((e) => e.type.startsWith('fixture/tent') && e.place.on === 'tile' && e.place.map === c.map.id && e.place.x === x && e.place.y === y)
      if (!saved || saved.props?.interior) continue
      for (const k of ['interior', 'interiorX', 'interiorY']) w.setProp(saved, k, t.props[k])
    }
}
