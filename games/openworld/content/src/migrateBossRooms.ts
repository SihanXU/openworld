// Authored-content migration (docs/boss-rooms.md): the bosses moved into arenas of their own behind their fogs — the White
// Knight off the East Road into the Kingdom, Prior Wendel out of the crypt's vault into the priors' tomb; the warden kept
// its sanctum, a fog now at its stair. On loading, once, for each boss whose old ground the save had been to:
// - fallen there (gone from its map, or from the state of a save older than that): the story is told of its fall (its
//   room's fogs lift; the warden's and the prior's are newly kept), and the arena's fresh copy of it is not had;
// - else it goes to its post in its arena (one still on a map put away: the arena takes it now, before that map is back);
// - of what lay in its ring, and what it carried, the save's own is kept and laid where the arena keeps it, the arena's
//   fresh copy gone, so nothing is had twice.

import type { Entity, Game, MapChunk } from '@openworld/engine'
import { BOSS_ROOMS } from './bossrooms.ts'

export const BOSS_ROOMS_LAYOUT = 'content.boss-rooms-v1'

/** Where each boss stood before its arena was a map of its own. */
const BEFORE: Record<string, string> = { kingdom: 'eastroad', 'abbey.tomb': 'abbey.crypt', sanctum: 'sanctum' }

const same = (a: Entity, b: Entity) => a.type === b.type && JSON.stringify(a.name ?? null) === JSON.stringify(b.name ?? null)

export function migrateBossRooms(game: Game, arenas: MapChunk[]): void {
  const eng = game.engine
  const w = eng.world
  if (w.fact(BOSS_ROOMS_LAYOUT)) return
  for (const r of BOSS_ROOMS) {
    const was = BEFORE[r.arena]
    const arena = arenas.find((c) => c.map.id === r.arena)
    // (never been where it stood: its arena comes as its file has it, when first entered)
    if (!arena || !was || !w.state.loadedMaps.includes(was)) continue
    const kept = w.state.chunks?.[was]
    const boss = w.get(r.who)
    const fell = kept ? !!kept.gone?.includes(r.who) : !boss
    if (fell && !w.fact(r.fact)) w.setFact(r.fact, 1)
    if (was === r.arena) continue
    const before = new Set(Object.keys(w.state.entities))
    if (!w.map(arena.map.id)) game.loadChunk(arena)
    const now = w.get(r.who)
    if (fell) {
      // (the arena's copy, made as it came: the boss is not had again, nor what it carried)
      if (now && !before.has(now.id)) w.destroy(now)
    } else {
      const post = arena.entities.find((e) => e.id === r.who)?.place
      if (now && post?.on === 'tile' && (now.place.on !== 'tile' || now.place.map !== r.arena)) eng.teleport(now, { map: post.map, x: post.x, y: post.y })
    }
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
