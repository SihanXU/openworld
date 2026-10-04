// The map yields by itself (Don't Starve's twigs, flint and grass; Minecraft's cows and
// chickens): each map names what it grows (MapData.forage). The world's `forage` period runs the
// `forage` primitive on the active map (design.md §5.12: dormant maps are frozen), and now and
// then one more of each kind appears on a free tile of the right ground, until `max` of that kind
// are on the map. Items lie there; creatures appear with their behaviour and statuses.

import type { Engine } from './engine.ts'

/** How often (ticks) the ground yields: a quarter game hour, fifteen seconds of play. */
export const FORAGE_EVERY = 150
/** Never under the player's feet or right beside them: things appear, they do not pop up in hand. */
const NEAR = 2
const TRIES = 24

/** What a map yields now: each kind whose time has come appears once, below its cap. */
export function forageMap(eng: Engine, active: string): void {
  const w = eng.world
  const map = w.map(active)
  if (!map?.forage?.length) return
  const due = map.forage.filter((f) => w.state.tick % (f.every ?? FORAGE_EVERY) === 0)
  if (!due.length) return
  const lying = new Map<string, number>()
  for (const e of w.entitiesOnMap(active)) if (e.place.on === 'tile') lying.set(e.type, (lying.get(e.type) ?? 0) + 1)
  const p = w.posOf(w.player)
  for (const f of due) {
    if ((lying.get(f.type) ?? 0) >= f.max) continue
    for (let i = 0; i < TRIES; i++) {
      const x = Math.floor(w.rand() * map.width)
      const y = Math.floor(w.rand() * map.height)
      if (!f.on.includes(w.terrainAt(active, x, y))) continue
      if (p?.map === active && Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= NEAR) continue
      if (!w.walkable(active, x, y) || w.placedAt(active, x, y).length) continue
      const e = w.create(f.type, { on: 'tile', map: active, x, y }, f.ai ? { facing: 'down', ai: { ...structuredClone(f.ai), home: { map: active, x, y } } } : {})
      eng.touch({ e: e.id })
      for (const st of f.statuses ?? []) eng.applyStatus({ e: e.id }, st)
      break
    }
  }
}
