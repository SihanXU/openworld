// The draw order of the things of a frame (the 3/4 view, docs/building.md §9): what is drawn over
// what. Pure, so it is tested without a renderer (packages/client/test/depth.test.ts).
//
// The order of the place, back to front:
// - the ground: tiles −100, heights −90, decals −50; what lies flat on it (moss, leaves) −45;
//   a floor laid on the ground −44, part of the ground, so under all that stands whatever was made first;
//   a room's walls −40;
// - what stands, by the row it stands in: a tree `(y+1)·T − 1`, a building at its last solid row
//   `− 2`, a thing (here) from `(y+1)·T`;
// - over all of it, the focus, the lesson's cells and the ceilings (1e5), effects (1e6), the night (1e7).

import { T } from '../assets/ground.ts'

/** What the order of a thing is read from (a frame's `EntitySnap`). */
export interface Drawn {
  y: number
  z?: number
  tags: string[]
  /** The spaces it takes in its cell (`floor`, `volume`); none for a thing that lies loose. */
  spaces?: string[]
}

export interface DepthOpts {
  /** It lies flat on the ground (moss, leaves): the catalogue's `ground`. */
  ground?: boolean
  /** The depth of a building whose picture covers its cell, if any. */
  roof?: number
  /** Where it stands now, in pixels from the map's top (its cell's bottom edge unless it is moving). */
  foot?: number
}

/**
 * Its depth: by the row it stands in, then its storey (3 a storey), then what it is in its cell — the
 * floor one stands on (a slab) under what stands on it, then a built block or a fixture, then what lies
 * loose on it (on a table too), then a body. One flying over a building (a companion keeps beside its
 * leader over what blocks people) is drawn over its roof.
 */
export function depthOf(e: Drawn, o: DepthOpts = {}): number {
  const agent = e.tags.includes('agent')
  const z = e.z ?? 0
  if (!agent && !e.tags.includes('portable') && o.ground) return -45
  const floor = !!e.spaces?.includes('floor')
  if (floor && !z) return -44
  const base = (o.foot ?? (e.y + 1) * T) + z * 3
  if (floor) return base - 0.5
  if (o.roof !== undefined && o.roof >= base && e.tags.includes('airborne')) return o.roof + 3
  return base + (agent ? 2 : e.tags.includes('portable') && !e.spaces ? 1 : 0)
}

/**
 * Where a body between two cells stands, for its order: where it is drawn (its picture's foot, put back
 * on its storey), kept within a row of the cell it is bound for. Stepping north it passes behind what
 * stands in the row it leaves only as it gets there; a change of storey on the stairs (its lift jumps)
 * never sends it behind the storey it left.
 */
export function footOf(y: number, drawnFoot: number): number {
  return Math.max(y * T, Math.min((y + 2) * T, drawnFoot))
}
