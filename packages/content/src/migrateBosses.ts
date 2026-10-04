// Authored-content migration for the seven sins, kept outside the generic engine: an older save is
// brought up to the world as it is now. It is the author's, run on loading (the caller holds the
// author's hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@lsw/engine'
import { BOSS_BY_ID, BOSS_LAYOUT, FIRST_BOSS } from './bosses.ts'

/** Add the new encounter to an already visited East Road, without recreating a defeated boss. */
export function migrateBosses(game: Game, road?: MapChunk): void {
  const w = game.engine.world
  if (w.fact(BOSS_LAYOUT)) return
  if (road && w.state.loadedMaps.includes(FIRST_BOSS.map)) {
    game.loadMapData(road.map)
    const boss = road.entities.find((e) => e.id === FIRST_BOSS.id)
    const existing = w.get(FIRST_BOSS.id)
    if (existing && w.num(existing, 'hp') > 0) {
      // Preserve the proportion of health lost in v1, not its obsolete absolute HP.
      if (w.fact('content.seven-sins-v1') && existing.props?.maxHp !== BOSS_BY_ID.greed.hp) {
        const ratio = Math.min(1, w.num(existing, 'hp') / Number(existing.props?.maxHp ?? 120))
        Object.assign(existing.props ??= {}, { hp: Math.max(1, Math.round(BOSS_BY_ID.greed.hp * ratio)), maxHp: BOSS_BY_ID.greed.hp })
        delete existing.boss!.pending
      }
      const at = w.posOf(existing)!
      if (!w.fits(existing, at.map, at.x, at.y)) {
        const free = game.engine.nearestFree(at, existing)
        if (!free) return
        w.place(existing, { on: 'tile', ...free }); existing.ai!.home = free
      }
    }
    if (boss && !w.get(boss.id) && !w.fact('sins.defeated.greed')) {
      const added = w.add(structuredClone(boss)), at = w.posOf(added)!
      if (!w.fits(added, at.map, at.x, at.y)) {
        const free = game.engine.nearestFree(at, added)
        if (free) { w.place(added, { on: 'tile', ...free }); added.ai!.home = free }
        else {
          // A heavily built-up encounter site is retried on a later load; never overlap
          // the player's structures or consume the migration marker without a safe spawn.
          w.destroy(added)
          return
        }
      }
    }
  }
  w.setFact(BOSS_LAYOUT, true)
}
