// Authored-content migration for the world map (2026-10-11): it was a block of 3 x 3 tiles to a place and is
// one tile to a place now. An older save's places on it are the map's as it is now, and whatever stood on it
// stands on the cell its old block was (or the nearest open one). It is the author's, run on loading (the
// caller holds the author's hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@openworld/engine'

/** Saves marked with it lay the world map out a place to a tile, its places as the map has them now (v2: sealed by the story). */
export const OVERWORLD_LAYOUT = 'content.overworld-cells-v2'
/** The first layout of a place to a tile (its places not yet sealed): only the places are made again. */
const CELLS_V1 = 'content.overworld-cells-v1'
const OLD_BLOCK = 3

export function migrateOverworld(game: Game, overworld: MapChunk): void {
  const w = game.engine.world
  if (w.fact(OVERWORLD_LAYOUT)) return
  const map = overworld.map
  const on = Object.values(w.state.entities).filter((e) => e.place.on === 'tile' && e.place.map === map.id)
  for (const e of on) if (e.type.startsWith('site')) w.destroy(e)
  for (const e of overworld.entities) if (e.type.startsWith('site') && !w.get(e.id)) w.add(structuredClone(e))
  if (w.fact(CELLS_V1)) return w.setFact(OVERWORLD_LAYOUT, true)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !w.isSolidTerrain(map.terrain[y * map.width + x])
  for (const e of on) {
    if (e.type.startsWith('site') || e.place.on !== 'tile') continue
    const px = (e.place.x + 0.5) / OLD_BLOCK
    const py = (e.place.y + 0.5) / OLD_BLOCK
    let best: { x: number; y: number; d: number } | undefined
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py)
        if (open(x, y) && (!best || d < best.d)) best = { x, y, d }
      }
    if (best) w.place(e, { ...e.place, x: best.x, y: best.y })
  }
  w.setFact(OVERWORLD_LAYOUT, true)
}
