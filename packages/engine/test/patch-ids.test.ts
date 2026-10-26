// A learned rule's, type's or status's id is a path too: a world repository writes each to a file of its id (the AI's
// repo.ts), so the validator refuses an id with an empty, `.` or `..` segment, a backslash, or a leading `/`.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, idProblem, validatePatch, type Ontology, type Patch } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'

const onto = STDLIB_ONTOLOGY as Ontology
const check = (p: Patch) => validatePatch(p, { ontology: onto, library: new RuleLibrary(STDLIB_RULES) })
const BAD = ['patch/../../../escape', 'patch/./x', 'patch//x', 'patch/x/', '/patch/x', 'patch\\x', '..']
const REFUSED = /has an empty, "\." or "\.\." segment|holds a backslash|starts with \//

describe('an id that is not a path inside its folder is refused', () => {
  it('for a rule, a type and a status', () => {
    for (const id of BAD) {
      const rule = check({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'item' }, on: 'act/use', hole: 'core/use', at: [], tree: { do: [] } } }] })
      expect(rule.errors.join('\n')).toMatch(REFUSED)
      const type = check({ artifacts: [{ kind: 'type', type: { id, name: { en: 'a thing', zh: '东西' } } }] })
      expect(type.errors.join('\n')).toMatch(REFUSED)
      const status = check({ artifacts: [{ kind: 'status', status: { id, name: { en: 'a state', zh: '状态' } } }] })
      expect(status.errors.join('\n')).toMatch(REFUSED)
    }
  })

  it('an ordinary id is a path, whatever its case', () => {
    for (const id of ['patch/stone-stills-creature', 'item/food/jam', 'Patch/Upper_Case', 'wet']) expect(idProblem(id)).toBeUndefined()
    for (const id of BAD) expect(idProblem(id)).toBeDefined()
  })
})
