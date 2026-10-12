// Authored-content migration for the Held Ground's widenings (2026-10-11): they were Alberic's errands (quests haven1–3)
// and are the planted sword's own now, its materials laid at it in its panel (haven.ts). An older save's widening
// errands go — how far the ground goes (`haven.size`) stays, and what was carried toward one is still carried. It is
// the author's, run on loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'

/** Saves marked with it widen the Held Ground at its heart. */
export const HAVEN_LAYOUT = 'content.haven-heart-v1'
const ERRANDS = ['haven1', 'haven2', 'haven3']

/** The heart was drawn as an altar; it is the planted sword it always was. */
export function migrateHavenHeart(game: Game): void {
  const heart = game.engine.world.get('haven.heart')
  if (heart?.type === 'fixture/sacred/altar') game.engine.world.transform(heart, 'fixture/sacred/sword')
}

export function migrateHaven(game: Game): void {
  const w = game.engine.world
  if (w.fact(HAVEN_LAYOUT)) return
  for (const q of ERRANDS) {
    const e = w.get(`quest.${q}`)
    if (e) w.destroy(e)
    // the story's record of them (q.<id>, q.<id>.by …)
    const story = w.story
    if (story?.props) for (const k of Object.keys(story.props)) if (k === `q.${q}` || k.startsWith(`q.${q}.`)) w.setProp(story, k, undefined)
    if (w.player.props?.track === `quest.${q}`) w.setProp(w.player, 'track', undefined)
  }
  w.setFact(HAVEN_LAYOUT, true)
}

/** Saves marked with it have the residents' tents' plots staked out (2026-10-12). */
export const LODGES_LAYOUT = 'content.haven-lodges-v1'

/** A Held Ground already in a save gets the plots its residents' tents will stand on (a fresh one is built with them). */
export function migrateLodges(game: Game, plots: { id: string; at: readonly [number, number] }[]): void {
  const w = game.engine.world
  if (w.fact(LODGES_LAYOUT)) return
  if (w.get('haven.heart'))
    for (const p of plots) if (!w.get(`haven.plot.${p.id}`)) w.create(`fixture/build/plot/${p.id}`, { on: 'tile', map: 'haven', x: p.at[0], y: p.at[1] }, { id: `haven.plot.${p.id}` })
  w.setFact(LODGES_LAYOUT, true)
}
