// Waypoint stones (docs/prologue.md): a stone the player has touched (status `attuned`) is a place
// the world map can take them to. Travel is refused while the player cannot act (a scene, a
// question, an act the world is working out).

import type { Engine } from './engine.ts'
import type { Entity, Id } from './types.ts'

export const WAYPOINT_TYPE = 'fixture/sacred/waypoint'

/** Every waypoint stone the world has loaded, and whether it is attuned. */
export function waypoints(eng: Engine): { e: Entity; attuned: boolean }[] {
  const w = eng.world
  return Object.values(w.state.entities)
    .filter((e) => e.type === WAYPOINT_TYPE && e.place.on === 'tile')
    .map((e) => ({ e, attuned: w.hasStatus({ e: e.id }, 'attuned') }))
}

/** Take the player to an attuned stone: an act of moving to the free tile below it (or the nearest). */
export function travelToWaypoint(eng: Engine, id: Id): boolean {
  const w = eng.world
  const p = w.player
  const stone = w.get(id)
  if (!stone || stone.type !== WAYPOINT_TYPE || stone.place.on !== 'tile' || !w.hasStatus({ e: id }, 'attuned')) return false
  if (eng.busy(p) || w.scene || w.state.question) return false
  const { map, x, y } = stone.place
  const from = w.posOf(p)!
  eng.act('move', p.id, { e: p.id }, { instrument: null, params: { map, x, y: y + 1 } })
  const to = w.posOf(p)
  if (!eng.pendingTransition && to?.map === from.map && to.x === from.x && to.y === from.y) return false
  w.fx.push({ t: 'vfx', fx: 'poof', ...from })
  p.facing = 'up'
  return true
}
