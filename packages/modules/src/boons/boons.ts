// Boons: the powers a companion carries for its leader (docs/chapter-1.md §6). A companion keeps
// the boons it has been given (its `boons` prop: their ids, comma-separated) and carries one of
// them at a time, as its own status `boon_<id>`. What that status gives the leader is its
// `lead:<stat>` props, read by `World.stat` (the leader's experience rate, …): the companion
// writes only itself, the leader only reads. A boon is given by the story (a notify the companion
// answers) and chosen only beside an attuned waypoint stone (the `boon` primitive checks it).

import type { Entity, World } from '@openworld/engine'
import { attunedNear } from '../waypoints/waypoints.ts'

/** A boon's status: `boon_<id>`. */
export const BOON_PREFIX = 'boon_'
/** How near (tiles, on the same map) a leader must stand to an attuned waypoint to choose a boon. */
export const BOON_REACH = 3

/** The boons a companion has been given, in the order it got them. */
export function boonsOf(w: World, e: Entity): string[] {
  const v = w.prop(e, 'boons')
  return typeof v === 'string' && v ? v.split(',') : []
}

/** The boon a companion carries now, if any. */
export function activeBoon(e: Entity): string | undefined {
  const s = Object.keys(e.statuses ?? {}).find((k) => k.startsWith(BOON_PREFIX))
  return s?.slice(BOON_PREFIX.length)
}

/** The leader a companion follows (its `companion` prop), if loaded. */
export function leaderOf(w: World, e: Entity): Entity | undefined {
  const id = w.prop(e, 'companion')
  return typeof id === 'string' ? w.get(id) : undefined
}

/** The companions that follow this actor and are on its map. */
export function companionsOf(w: World, leader: Entity): Entity[] {
  const at = w.posOf(leader)
  if (!at) return []
  return w.entitiesOnMap(at.map).filter((o) => o.id !== leader.id && w.prop(o, 'companion') === leader.id)
}

/** An attuned waypoint stone within reach of the actor, on its map (a boon is chosen there). */
export function nearAttunedWaypoint(w: World, e: Entity, reach = BOON_REACH): boolean {
  return attunedNear(w, e, reach)
}
