// A room's walls as a role-playing game draws a room with its roof off (docs/showcase.md §3.6): from a plan of cells
// (wall, floor, nothing), every wall cell with floor to its south stands tall — its face carved and furnished by the
// room's own decorator (windows of glass, niches and their statues, pilasters, sconces, an organ's case) — and every
// other wall cell beside a floor is the dark of the ceiling over it, a strip with its lit rim. Stepped plans (a nave
// with its transept, its chapels, its apse) so get a face at every step, as a cathedral's walls step in and out.

import type { Model, Ornament } from './oblique.ts'
import { box, type Solid } from './shapes.ts'

export const S = 16

/** A run of wall faces along one row of the plan: its cells x0..x1 (inclusive) on row y, facing south onto the floor. */
export interface Face {
  x0: number
  x1: number
  y: number
}

/** What a face is made of and what is set in and on it. */
export interface Dress {
  /** Its height in pixels (default the room's). */
  h?: number
  solids?: Solid[]
  voids?: Solid[]
  ornaments?: Ornament[]
}

export interface ShellOpts {
  name: string
  /** Rows of the plan: '#' wall, ' ' nothing (the dark beyond), anything else floor. */
  plan: string[]
  /** The walls' height, their material. */
  h: number
  wall: string
  /** What each face carries: by the run of faces it is. */
  dress?: (f: Face) => Dress
  /** The stone of the cornice over the faces, their skirting and the ceiling's lit rim (default 'stone'). */
  trim?: string
}

/** The shell's model: tall faces, the ceiling's strips, what the faces carry. */
export function shell(o: ShellOpts): Model {
  const rows = o.plan
  const H = rows.length
  const W = Math.max(...rows.map((r) => r.length))
  const at = (x: number, y: number) => (y < 0 || y >= H || x < 0 || x >= W ? ' ' : rows[y][x] ?? ' ')
  const wall = (x: number, y: number) => at(x, y) === '#'
  const floor = (x: number, y: number) => !wall(x, y) && at(x, y) !== ' '
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const fp: string[][] = Array.from({ length: H }, () => Array(W).fill(' '))
  // the faces: runs of wall cells with floor to their south
  const faces: Face[] = []
  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      if (wall(x, y) && floor(x, y + 1)) {
        const x0 = x
        while (x + 1 < W && wall(x + 1, y) && floor(x + 1, y + 1)) x++
        faces.push({ x0, x1: x, y })
      }
      x++
    }
  }
  const trim = o.trim ?? 'stone'
  const tall = new Set<string>()
  for (const f of faces) {
    const d = o.dress?.(f) ?? {}
    const h = d.h ?? o.h
    const x0 = f.x0 * S
    const x1 = (f.x1 + 1) * S
    const y1 = (f.y + 1) * S
    solids.push({ ...box(x0, f.y * S, 0, x1, y1, h, o.wall), side: o.wall, mat: 'ceiling' })
    // the cornice along its top and the skirting along its foot, a little proud of the face
    solids.push(box(x0, y1 - 3, h - 4, x1, y1 + 2, h, trim), box(x0, y1 - 2, 0, x1, y1 + 2, 5, trim))
    solids.push(...(d.solids ?? []))
    voids.push(...(d.voids ?? []))
    orn.push(...(d.ornaments ?? []))
    for (let x = f.x0; x <= f.x1; x++) {
      tall.add(`${x},${f.y}`)
      fp[f.y][x] = '#'
    }
  }
  // the ceiling's strips: every other wall cell beside a floor (eight ways), low and dark
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!wall(x, y) || tall.has(`${x},${y}`)) continue
      let near = false
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (floor(x + dx, y + dy)) near = true
      if (!near) continue
      solids.push(box(x * S, y * S, 0, (x + 1) * S, (y + 1) * S, 3, 'ceiling'))
      // the ceiling's lit rim where it meets the floor
      if (floor(x, y + 1)) solids.push(box(x * S, (y + 1) * S - 2, 0, (x + 1) * S, (y + 1) * S, 4, trim))
      if (floor(x, y - 1)) solids.push(box(x * S, y * S, 0, (x + 1) * S, y * S + 2, 4, trim))
      if (floor(x - 1, y)) solids.push(box(x * S, y * S, 0, x * S + 2, (y + 1) * S, 4, trim))
      if (floor(x + 1, y)) solids.push(box((x + 1) * S - 2, y * S, 0, (x + 1) * S, (y + 1) * S, 4, trim))
      fp[y][x] = '#'
    }
  return { name: o.name, footprint: fp.map((r) => r.join('')), solids, voids, ornaments: orn }
}
