// Authored-content migration for the boss kits, kept outside the generic engine: an older save is
// brought up to the world as it is now. It is the author's, run on loading (the caller holds the
// author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'
import { BOSS_LAYOUT, REMOVED_BOSSES } from './bosses.ts'
import { ALBERIC_CAMPAIGN } from './chapter1.ts'

/**
 * Clear the bodies of removed kits (the East Road's Gilt Tollkeeper of older saves): their types are gone. And the White
 * Knight of a save from before the one skill system (docs/skills.md): his blows were scaled by `skillScale`; now they are
 * multiples of his attack — he takes Chapter 1's numbers, keeping the share of his health he had left.
 */
export function migrateBosses(game: Game): void {
  const w = game.engine.world
  if (w.fact(BOSS_LAYOUT)) return
  const removed = new Set(REMOVED_BOSSES.map((id) => `actor/creature/sin/${id}`))
  for (const e of Object.values(w.state.entities)) {
    if (removed.has(e.type) && w.get(e.id)) w.destroy(e)
    else if (e.type === 'actor/creature/sin/alberic' && e.props?.skillScale !== undefined) {
      const hp = w.num(e, 'hp'), share = Math.max(0, Math.min(1, hp / w.num(e, 'maxHp', 1)))
      for (const [key, value] of Object.entries(ALBERIC_CAMPAIGN)) w.setProp(e, key, value)
      w.setProp(e, 'hp', hp > 0 ? Math.max(1, Math.round(ALBERIC_CAMPAIGN.maxHp * share)) : 0)
      w.setProp(e, 'skillScale', undefined)
    }
  }
  w.setFact(BOSS_LAYOUT, true)
}
