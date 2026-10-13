// Authored-content migration for the Held Ground's widenings (2026-10-11): they were Alberic's errands (quests haven1–3)
// and are the steward's panel now, what each asks handed to him into the ground's stock (haven.ts). An older save's
// widening errands go — how far the ground goes (`haven.size`) stays, and what was carried toward one is still carried.
// It is the author's, run on loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game, MapChunk } from '@openworld/engine'
import { HAVEN_UPGRADES } from './haven.ts'

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

/**
 * Saves marked with it have the plots staked out at the Held Ground's heart (its buildings, 2026-10-11; the residents'
 * tents, 2026-10-12) and Cass's loom on Firstlight's square (2026-10-11), Firstlight's waypoint statue moved aside for it.
 */
export const PLOTS_LAYOUT = 'content.haven-plots-v1'
/** What the Held Ground and Firstlight put on maps an older save has seen: each plot (it becomes its building once built), the loom. */
const ADDED = [...HAVEN_UPGRADES.filter((u) => u.plot).map((u) => `haven.plot.${u.id}`), 'village.loom']
/** What moved to make room: Firstlight's waypoint statue stood where the loom stands. */
const MOVED = ['wp.village']

/**
 * A Held Ground or a Firstlight already in a save gets the plots and the loom the maps have now (a map not yet visited
 * gets them when it is first loaded). A plot comes as it is staked out; a building its steward has already been given
 * the materials for (`haven.build.<id>`) rises on it at its next look (haven.ts, the plot's rule).
 */
export function migratePlots(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  if (w.fact(PLOTS_LAYOUT)) return
  for (const c of chunks) {
    if (!w.state.loadedMaps.includes(c.map.id)) continue
    for (const e of c.entities) {
      if (ADDED.includes(e.id) && !w.get(e.id)) w.add(structuredClone(e))
      const moved = MOVED.includes(e.id) ? w.get(e.id) : undefined
      if (moved?.place.on === 'tile' && e.place.on === 'tile' && (moved.place.x !== e.place.x || moved.place.y !== e.place.y)) w.place(moved, structuredClone(e.place))
    }
  }
  w.setFact(PLOTS_LAYOUT, true)
}
