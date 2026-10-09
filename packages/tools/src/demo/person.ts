// The record of one person at the Ford (docs/game-design.md §5), as the authors write it.
// world.ts resolves anchors to map positions and turns each record into an NPC entity with
// `npc.person` (PersonData) for the engine.

import type { LineDef, Mood, Selector, Text, WorkDef } from '@lsw/engine'
import type { LookPins } from '@lsw/content'
import type { ItemSpec } from './builder.ts'

/**
 * [fromHour, toHour, anchor, activity, needs?]: hours 0..24, may wrap past midnight (21 → 5).
 * `needs` names the thing the activity uses (an entity id) and what it must be (a selector):
 * the fire she tends must be lit; if not, she is blocked. `work` is the work the activity is: real
 * acts on what is about (world-model.md §6.10).
 */
export type Slot = [number, number, string, string, { uses?: string; need?: Selector; work?: WorkDef[] }?]

export interface PersonDef {
  id: string
  role: string
  name: Text
  /** Their sex as their body shows it (docs/looks.md): the looks generator weighs parts by it. */
  gender: 'female' | 'male'
  /** What the author chose of their look (docs/looks.md): a body, parts and colours; the rest is drawn from their id. */
  look?: LookPins
  age: number
  temperament: { personality: string; manner: 'polite' | 'plain' | 'rough'; social: 'outgoing' | 'reserved'; outlook: 'hopeful' | 'wary' }
  /** npc id → relation, from this person's side. */
  ties: Record<string, string>
  /** Schedule variants by key (most specific wins): 'fact:<key>', 'storm', 'rain', 'default'. Each covers the whole 24 hours. */
  schedules: Record<string, Slot[]>
  lines: LineDef[]
  /** What the person carries (a woodcutter's axe). */
  items?: ItemSpec[]
  /** What the person is, beyond their role (the woodcutter's skill). */
  tags?: string[]
}

/** A line: key, English, Chinese, and options (mood, once). */
export function line(key: string, en: string, zh: string, opts: { mood?: Mood; once?: boolean } = {}): LineDef {
  return { key, text: { en, zh }, ...opts }
}
