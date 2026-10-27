import { describe, expect, it } from 'vitest'
import { LUMI_ID, QUESTS } from '../src/index.ts'

// A quest done for someone is a kindness (docs/quests.md): the stage that pays for it also tells the people it names
// what they make of the one who did it (`regard`), which weighs on that one's karma too (+3 unless the reward says how
// much). A quest that names no one but the fairy (waking, the way down, the Crown carried home) and her lessons pay
// only what they pay.

describe('quest rewards', () => {
  it('every paid ending of a quest that names someone warms them, or at least weighs as a good deed', () => {
    const missing: string[] = []
    for (const q of QUESTS) {
      if (q.kind === 'guide') continue
      const people = Object.values(q.aliases ?? {}).some((a) => ('id' in a && a.id !== LUMI_ID) || 'from' in a || ('find' in a && String(a.find?.type ?? '').startsWith('actor/person')))
      if (!people) continue
      for (const s of q.stages) {
        const r = s.reward
        const paid = !!r && (!!r.xp || !!r.items?.length)
        if (!s.complete || !paid) continue
        const kind = Object.values(r.regard ?? {}).some((d) => d > 0) || (r.karma ?? 0) > 0
        if (!kind) missing.push(`${q.id}@${s.n}`)
      }
    }
    expect(missing).toEqual([])
  })
})
