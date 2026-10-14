// The action (E, the right click) as Stardew's action button: one input that does what the thing aimed at
// calls for, chosen from what the keys would do there (the frame's keys: worker.ts keyViews). The cursor shows it
// (ui/cursor.ts), a press does it (main.ts). It has no page of its own: test/action.test.ts holds it to its table.

import type { Frame, Key } from '@openworld/engine'

/** A built thing or a fixture, set in a cell as part of a place (the engine's Controls.placeable). */
export const placeable = (type: string) => type.startsWith('structure/') || type.startsWith('fixture/')

/**
 * The action, as Stardew's (design.md §5.2):
 * - to someone, a word (handing them what is held is G's alone: an axe in hand is not given away by a word);
 * - what the bare hands do something with is done (open, read, sleep, pick);
 * - what can be taken is picked up (never what is another's: that is F's alone);
 * - on the open ground or oneself — not on a thing the hands could try — what is held is set down if it is
 *   set in a place (a bed, a workbench: G's act, which offers nothing where it cannot rest), else used on
 *   oneself (eat, drink, put on; pointed at oneself, also what the world has never seen done: the modder's);
 * - on a thing, else the bare hands try it (an experiment);
 * - on the bare ground, nothing (dropping is the bag's: drag a thing out of it).
 * A lesson that lets only some inputs work (docs/prologue.md) is kept: the action is the first of them that
 * answers, and a thing the hands may not try is as the open ground.
 */
export function actionOf(k: Frame['keys'], held: string | undefined, allow?: readonly string[]): Key | undefined {
  if (!k) return undefined
  const may = (key: Key) => !allow || allow.includes(key)
  const h = k.hands
  if (h?.person && may('hands')) return 'hands'
  if (h && !h.unknown && !h.ground && may('hands')) return 'hands'
  if (k.take && !k.take.ground && !k.take.steal && may('take')) return 'take'
  const open = !h || h.ground || !may('hands')
  if (open && held && placeable(held) && k.put?.ground && !k.put.unknown && may('put')) return 'put'
  // (an unknown use on oneself is among the keys only when the pointer is on oneself: worker.ts keyViews)
  if (open && held && k.self && may('self')) return 'self'
  if (h && !h.ground && may('hands')) return 'hands'
  return undefined
}
