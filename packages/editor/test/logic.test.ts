// The database and the rules as the editor writes them: an ontology entry written where the project writes it
// (or over the library's), and a rule's tree in words.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { OntologyPart } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { entryFile, removeEntry, setEntry } from '../src/app/ontologyFiles.ts'
import { outline } from '../src/app/rulesMode.ts'
import { Store } from '../src/app/store.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe.skipIf(!existsSync(STARTER))('the database', () => {
  const fresh = () => new Store('starter', readProject(STARTER))

  it('writes a type where the project writes it, a new one beside its kind, a library one over the library\'s', () => {
    const s = fresh()
    expect(entryFile(s, 'types', 'item/tool/axe')).toBe('ontology/types.json')
    setEntry(s, 'types', { id: 'item/tool/axe', name: 'Hatchet' } as never, 'rename')
    expect(s.compiled().bundle.ontology.types['item/tool/axe'].name).toBe('Hatchet')
    setEntry(s, 'types', { id: 'item/food', name: 'food' } as never, 'new')
    expect(s.get<OntologyPart>('ontology/types.json')!.types).toContainEqual({ id: 'item/food', name: 'food' })
    // the standard library's: the project's own goes over it, in the project's file
    expect(entryFile(s, 'statuses', 'wet')).toBeUndefined()
    setEntry(s, 'statuses', { id: 'wet', name: 'soaked', duration: 100 } as never, 'over the library')
    expect(entryFile(s, 'statuses', 'wet')).toBe('ontology/statuses.json')
    expect(s.compiled().bundle.ontology.statuses.wet.duration).toBe(100)
    removeEntry(s, 'statuses', 'wet', 'back to the library')
    expect(s.compiled().bundle.ontology.statuses.wet.duration).toBe(400)
  })
})

describe('a rule\'s tree in words', () => {
  it('says its branches, its leaves and its holes', () => {
    const text = outline({ if: { same: ['actor', 'target'] }, then: { do: [{ op: 'log', text: 'Crunch.' }], label: 'Eat' }, else: { undefined: true, default: [{ op: 'destroy' }] } }).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    expect(text).toContain('IF {"same":["actor","target"]}')
    expect(text).toContain('DO “Eat” log')
    expect(text).toContain('UNDEFINED — the AI answers; meanwhile destroy')
  })
})
