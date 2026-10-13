// Authored-content migration for the world map. It was a block of 3 x 3 tiles to a place and is one tile to a place
// (2026-10-11); the Pilgrim's Road put four places between the Ford and the East Road and moved the east along
// (2026-10-12). An older save's places on it are the map's as it is now, and whatever stood on it stands on the cell its
// old block was (or the nearest open one) — and so does where one will come back to out of the Held Ground (the
// Oath-Thorn's `pocket.return`, kept as "map,x,y"). It is the author's, run on loading (the caller holds the author's
// hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@openworld/engine'

/** Saves marked with it lay the world map out a place to a tile, its places as the map has them now (v3: the Pilgrim's Road). */
export const OVERWORLD_LAYOUT = 'content.overworld-cells-v3'
/** A place to a tile before the Pilgrim's Road: the scale is the same, only the places are made again. */
const CELLS_V2 = 'content.overworld-cells-v2'
const OLD_BLOCK = 3

export function migrateOverworld(game: Game, overworld: MapChunk): void {
  const w = game.engine.world
  if (w.fact(OVERWORLD_LAYOUT)) return
  const map = overworld.map
  const on = Object.values(w.state.entities).filter((e) => e.place.on === 'tile' && e.place.map === map.id)
  for (const e of on) if (e.type.startsWith('site')) w.destroy(e)
  for (const e of overworld.entities) if (e.type.startsWith('site') && !w.get(e.id)) w.add(structuredClone(e))
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height
  const open = (x: number, y: number) => inside(x, y) && !w.isSolidTerrain(map.terrain[y * map.width + x])
  /** Where a cell of the save's world map is now: a block's own cell (`scaled`), else the cell itself if one may stand there; the nearest open cell to it. */
  const cellOf = (x: number, y: number, scaled: boolean): { x: number; y: number } | undefined => {
    const px = scaled ? (x + 0.5) / OLD_BLOCK : x + 0.5
    const py = scaled ? (y + 0.5) / OLD_BLOCK : y + 0.5
    if (open(Math.floor(px), Math.floor(py))) return { x: Math.floor(px), y: Math.floor(py) }
    let best: { x: number; y: number; d: number } | undefined
    for (let cy = 0; cy < map.height; cy++)
      for (let cx = 0; cx < map.width; cx++) {
        const d = Math.hypot(cx + 0.5 - px, cy + 0.5 - py)
        if (open(cx, cy) && (!best || d < best.d)) best = { x: cx, y: cy, d }
      }
    return best && { x: best.x, y: best.y }
  }
  // a save laid out a place to a tile already kept its cells; one of 3 x 3 tiles to a place scales them down
  const blocks = !w.fact(CELLS_V2)
  for (const e of on) {
    if (e.type.startsWith('site') || e.place.on !== 'tile') continue
    const c = cellOf(e.place.x, e.place.y, blocks)
    if (c && (c.x !== e.place.x || c.y !== e.place.y)) w.place(e, { ...e.place, x: c.x, y: c.y })
  }
  // where one comes back to out of the Held Ground: the same (a cell off the map is the old scale's, left unmoved by
  // the first layout's own migration)
  for (const e of Object.values(w.state.entities)) {
    const back = e.props?.['pocket.return']
    if (typeof back !== 'string') continue
    const [m, sx, sy] = back.split(',')
    const [x, y] = [Number(sx), Number(sy)]
    if (m !== map.id || !Number.isFinite(x) || !Number.isFinite(y)) continue
    const c = cellOf(x, y, blocks || !inside(x, y))
    if (c) w.setProp(e, 'pocket.return', `${m},${c.x},${c.y}`)
  }
  if (w.story) w.setProp(w.story, CELLS_V2, undefined)
  w.setFact(OVERWORLD_LAYOUT, true)
}
