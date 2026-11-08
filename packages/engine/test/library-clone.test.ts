import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '../src/rules.ts'

describe('a library restored directly from another library', () => {
  it('keeps each library\'s append-only history independent', () => {
    const original = new RuleLibrary()
    original.addType({ id: 'item/original', name: 'Original' }, 'before')
    const before = JSON.stringify(original.toJSON())
    const trial = RuleLibrary.fromJSON(original.toJSON())
    trial.addType({ id: 'item/trial', name: 'Trial' }, 'trial')
    trial.addStatus({ id: 'trial', name: 'Trial' }, 'trial')
    expect(JSON.stringify(original.toJSON())).toBe(before)
    expect(trial.log).toHaveLength(3)

    const trialBefore = JSON.stringify(trial.toJSON())
    original.addStatus({ id: 'original', name: 'Original' }, 'after')
    expect(JSON.stringify(trial.toJSON())).toBe(trialBefore)
  })
})
