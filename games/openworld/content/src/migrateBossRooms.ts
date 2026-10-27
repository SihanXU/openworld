// Authored-content migration (docs/boss-rooms.md): the White Knight moved into his arena behind his fog. A save that had
// been to the East Road before kept him standing on it, and kept what lay in his ring there; on loading, once, he goes
// to his post in the Kingdom (unless he has fallen), and of what he took and what lay by his stones the save's own is
// kept and laid where the arena keeps it, the arena's fresh copy gone, so nothing is had twice.

import type { Entity, Game, MapChunk } from '@openworld/engine'
import { ALBERIC_ID } from './chapter1.ts'

export const BOSS_ROOMS_LAYOUT = 'content.boss-rooms-v1'

const same = (a: Entity, b: Entity) => a.type === b.type && JSON.stringify(a.name ?? null) === JSON.stringify(b.name ?? null)

export function migrateBossRooms(game: Game, kingdom: MapChunk): void {
  const eng = game.engine
  const w = eng.world
  if (w.fact(BOSS_ROOMS_LAYOUT)) return
  if (w.state.loadedMaps.includes('eastroad')) {
    const before = new Set(Object.keys(w.state.entities))
    if (!w.map(kingdom.map.id)) game.loadChunk(kingdom)
    const post = kingdom.entities.find((e) => e.id === ALBERIC_ID)?.place
    const knight = w.get(ALBERIC_ID)
    if (knight && post?.on === 'tile' && knight.place.on === 'tile' && knight.place.map !== post.map && w.num(knight, 'hp') > 0) eng.teleport(knight, { map: post.map, x: post.x, y: post.y })
    for (const e of kingdom.entities) {
      if (!e.type.startsWith('item/')) continue
      const fresh = w.get(e.id)
      const old = Object.values(w.state.entities).find((o) => o.id !== e.id && before.has(o.id) && same(o, e))
      if (!fresh || !old) continue
      if (old.place.on === 'tile' && old.place.map === 'eastroad' && fresh.place.on === 'tile') w.place(old, { ...fresh.place })
      w.destroy(fresh)
    }
    eng.npcs.invalidate()
  }
  w.setFact(BOSS_ROOMS_LAYOUT, true)
}
