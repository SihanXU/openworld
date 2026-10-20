import type { Cond, Selector } from '@openworld/engine'

/** The people protected by the game's minor-specific social rules. */
export const MINOR_SUBJECTS: Selector[] = [
  { type: 'actor/person', tags: ['minor'] },
  { type: 'actor/person', props: { age: { gte: 0, lt: 18 } } },
]

/** A person's explicit minor tag or recorded age protects them across old and new saves. */
export const MINOR: Cond = {
  any: MINOR_SUBJECTS.map((sel): Cond => ({ is: { role: 'host', sel } })),
}
