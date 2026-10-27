// Authored-content migration for release 1's end (2026-10-26, docs/release-1.md §1): Part One runs to the White Knight
// and the Held Ground, and the road on east to Emberfall waits for Part Two. A save that began the Dragon Road before
// Part Two was sealed behind the knight has it put back, unbegun: it begins again (quests/main.ts) once Part Two opens.
// It is the author's, run on loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'
import { PART_TWO } from './regions.ts'

/** The quests that belong to Part Two: begun in a save where it is not open, they are put back. */
const PART_TWO_QUESTS = ['dragon_road']

export function migratePartTwo(game: Game): void {
  const w = game.engine.world
  if (w.fact(PART_TWO)) return
  for (const q of PART_TWO_QUESTS) {
    const e = w.get(`quest.${q}`)
    if (!e) continue
    w.destroy(e)
    // the story's record of it (q.<id>, q.<id>.by …)
    const story = w.story
    if (story?.props) for (const k of Object.keys(story.props)) if (k === `q.${q}` || k.startsWith(`q.${q}.`)) w.setProp(story, k, undefined)
    if (w.player.props?.track === `quest.${q}`) w.setProp(w.player, 'track', undefined)
  }
}
