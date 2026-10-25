// A building's shell is whose its inside is (docs/building.md §10, docs/npc-sandbox.md §2.1). A building stamped on a
// map is a block of walls drawn as one picture, its rooms a map of their own behind its door; the household that owns
// those rooms owns the walls one sees from the street too. So a wall of someone's house broken is a deed against them
// (the society module's vandalism, judged by who saw it), and one standing in the hole by night is where they should
// not be — the same regions with an owner the rooms behind the doors already are.

import type { Portal, PropValue } from '@openworld/engine'
import type { PrefabDef } from '@openworld/runtime/src/assets/types.ts'

/** What of a map the shells are read from and written to: a map builder, or a map file's map. */
export interface ShellMap {
  id: string
  stamps?: { key: string; x: number; y: number }[]
  portals: Portal[]
  regions?: Record<string, [number, number, number, number]>
  regionProps?: Record<string, Record<string, PropValue>>
}

/** The owner of a map's cell: the first region over it that names one. */
function ownerAt(m: ShellMap, x: number, y: number): string | undefined {
  for (const [name, [rx, ry, rw, rh]] of Object.entries(m.regions ?? {})) {
    const o = m.regionProps?.[name]?.owner
    if (typeof o === 'string' && o && x >= rx && y >= ry && x < rx + rw && y < ry + rh) return o
  }
  return undefined
}

/**
 * Give every stamped building whose door leads into an owned room an owned shell: a region over each row's run of its
 * solid cells (`shell.<x>.<y>.<row>.<col>`, never the door, never the cells it draws with nothing in the way), owned
 * as the room it leads into is. Returns how many buildings got one.
 */
export function ownShells(maps: ShellMap[], prefabs: Record<string, PrefabDef>): number {
  const byId = new Map(maps.map((m) => [m.id, m]))
  let n = 0
  for (const m of maps)
    for (const s of m.stamps ?? []) {
      const p = prefabs[s.key]
      if (!p || p.ground) continue
      let owner: string | undefined
      p.grid.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (c !== 'D' || owner) return
          const way = m.portals.find((q) => q.x === s.x + i && q.y === s.y + j)
          const inside = way && byId.get(way.to)
          owner = inside && ownerAt(inside, way.tx, way.ty)
        }),
      )
      if (!owner) continue
      p.grid.forEach((row, j) => {
        for (let i = 0; i < row.length; ) {
          if (row[i] !== '#') {
            i++
            continue
          }
          const i0 = i
          while (row[i] === '#') i++
          const name = `shell.${s.x}.${s.y}.${j}.${i0}`
          m.regions = { ...(m.regions ?? {}), [name]: [s.x + i0, s.y + j, i - i0, 1] }
          m.regionProps = { ...(m.regionProps ?? {}), [name]: { owner: owner! } }
        }
      })
      n++
    }
  return n
}
