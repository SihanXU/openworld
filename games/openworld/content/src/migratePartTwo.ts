// Authored-content migration for Chapter 2's road (2026-10-30, docs/chapter-2.md §12): the road on east to Emberfall
// opens when the Crown is home (CHAPTER_TWO, set by the homecoming). A save whose Crown came home before the homecoming
// set it gets it now; a save that began the Dragon Road while the road was still shut (release 1 sealed it behind the
// knight, docs/release-1.md §1) has it put back, unbegun: it begins again (quests/main.ts) once the road opens.
// It is the author's, run on loading (the caller holds the author's hand: `engine.author`), never game code.
import type { Game } from '@openworld/engine'
import { CH1 } from './chapter1.ts'
import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_THREE, CHAPTER_TWO, FINALE } from './regions.ts'

/** The quests that belong to Chapter 2's road: begun in a save where it is not open, they are put back. */
const CHAPTER_TWO_QUESTS = ['dragon_road', 'second_seal', 'march_quiet']

/** Each later chapter's road and the chapter end that opens it (docs/chapter-3.md §2.4): a save whose chapter ended before its end set the road gets it. */
const LATER_ROADS: [string, string][] = [['ch2.end', CHAPTER_THREE], ['ch3.end', CHAPTER_FOUR], ['ch4.end', CHAPTER_FIVE], ['ch5.end', FINALE]]

export function migratePartTwo(game: Game): void {
  const w = game.engine.world
  for (const [end, road] of LATER_ROADS) if (w.fact(end) && !w.fact(road)) w.setFact(road, 1)
  if (!w.fact(CHAPTER_TWO) && w.fact(CH1.end)) w.setFact(CHAPTER_TWO, 1)
  if (w.fact(CHAPTER_TWO)) return
  for (const q of CHAPTER_TWO_QUESTS) {
    const e = w.get(`quest.${q}`)
    if (!e) continue
    w.destroy(e)
    // the story's record of it (q.<id>, q.<id>.by …)
    const story = w.story
    if (story?.props) for (const k of Object.keys(story.props)) if (k === `q.${q}` || k.startsWith(`q.${q}.`)) w.setProp(story, k, undefined)
    if (w.player.props?.track === `quest.${q}`) w.setProp(w.player, 'track', undefined)
  }
}
