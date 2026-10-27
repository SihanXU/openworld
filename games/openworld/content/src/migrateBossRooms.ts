// Authored-content migration (docs/boss-rooms.md): the bosses moved into arenas of their own behind their fogs — the White
// Knight off the East Road into the Kingdom, Prior Wendel out of the crypt's vault into the priors' tomb. A save that held
// one alive where it stood before sends it to its post in its arena, once, on loading; of what lay in its ring the save's
// own is kept and laid where the arena keeps it, the arena's fresh copy gone, so nothing is had twice.

import type { Entity, Game, MapChunk } from '@openworld/engine'
import { BOSS_ROOMS } from './bossrooms.ts'

export const BOSS_ROOMS_LAYOUT = 'content.boss-rooms-v1'

const same = (a: Entity, b: Entity) => a.type === b.type && JSON.stringify(a.name ?? null) === JSON.stringify(b.name ?? null)

export function migrateBossRooms(game: Game, arenas: MapChunk[]): void {
  const eng = game.engine
  const w = eng.world
  if (w.fact(BOSS_ROOMS_LAYOUT)) return
  for (const r of BOSS_ROOMS) {
    const arena = arenas.find((c) => c.map.id === r.arena)
    const boss = w.get(r.who)
    // (a boss the save holds alive outside its arena: a map of its own now, behind its fog)
    if (!arena || !boss || boss.place.on !== 'tile' || boss.place.map === r.arena || w.num(boss, 'hp') <= 0) continue
    const before = new Set(Object.keys(w.state.entities))
    const was = boss.place.map
    if (!w.map(arena.map.id)) game.loadChunk(arena)
    const post = arena.entities.find((e) => e.id === r.who)?.place
    if (post?.on === 'tile') eng.teleport(boss, { map: post.map, x: post.x, y: post.y })
    // of what lay in its ring before, the save's own is kept and laid where the arena keeps it, the arena's fresh copy gone
    for (const e of arena.entities) {
      if (!e.type.startsWith('item/')) continue
      const fresh = w.get(e.id)
      const old = Object.values(w.state.entities).find((o) => o.id !== e.id && before.has(o.id) && same(o, e))
      if (!fresh || !old) continue
      if (old.place.on === 'tile' && old.place.map === was && fresh.place.on === 'tile') w.place(old, { ...fresh.place })
      w.destroy(fresh)
    }
  }
  eng.npcs.invalidate()
  w.setFact(BOSS_ROOMS_LAYOUT, true)
}
