import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Patch } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { WorldLibrary } from '../src/index.ts'

// The shared library holds only what the validator, as it is now, takes: a patch it grew stricter
// than (or whose hole the content came to answer) is rolled back before any client syncs it.

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const ROPE = 'item/tool/rope'

const answer = (id: string, type?: object): Patch => ({
  artifacts: [
    ...(type ? [{ kind: 'type' as const, type: type as never }] : []),
    { kind: 'rule', rule: { id, host: { type: ROPE }, on: 'act/use', label: { en: 'Use {instrument}', zh: '使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: 'actor/creature' } } }, then: { do: [{ op: 'log', text: 'You wave the rope.' }] }, else: 'inherit' } } },
  ],
})

describe('library prune', () => {
  it('rolls back what no longer holds, and keeps what does: the types a patch brought are its own, not "a type that exists already"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    // a new kind of bead, named and made of what it is made of: valid now
    const bead = { id: 'item/material/glass_bead', name: { en: 'Glass Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    // an older one with no material: the validator has since grown stricter
    const old = { id: 'item/material/clay_bead', name: { en: 'Clay Bead', zh: '陶珠' }, tags: [], props: {} }
    const log = [
      { seq: 1, at, patch: answer('patch/rope-bead', bead), rules: ['patch/rope-bead'] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: old }] }, rules: [] },
      { seq: 3, at, patch: answer('patch/rope-clay', old), rules: ['patch/rope-clay'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const gone = library.prune()
    expect(gone.map((g) => g.rules)).toEqual([['patch/rope-clay']])
    expect(gone[0].reason).toMatch(/material/)
    expect(library.lib.rules.has('patch/rope-bead')).toBe(true)
    expect(library.lib.rules.has('patch/rope-clay')).toBe(false)
    // and once is enough: nothing more to roll back
    expect(library.prune()).toEqual([])
  })
})
