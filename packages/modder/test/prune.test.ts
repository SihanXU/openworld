import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, type Cond, type Patch } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { WorldLibrary } from '../src/index.ts'

// The shared library holds only what the validator, as it is now, takes: a patch it grew stricter
// than (or whose hole the content came to answer) is rolled back before any client syncs it.

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const DEAD_TREE = 'fixture/nature/dead_tree'
/** The stone used on a dead tree: the hole in `core/use` a held thing with a target falls into (read off a real request, never hard-coded). */
const USE_HOLE = (() => {
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: DEAD_TREE, x: 2, y: 1 },
  ], event: {} }, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'it' })
  const { hole } = port.records[0].request
  return holeKey(hole.rule, hole.path)
})()
const ON_DEAD_TREE: Cond = { is: { role: 'target', sel: { type: DEAD_TREE } } }
/** The branch key of a condition not taken (as `locate` reads a path). */
const not = (c: Cond) => `!${JSON.stringify(c)}`

/** A learned rule of the stone's own (design.md §5.16): a first answer, or one placed at the open leaf of the answer before it. */
const answer = (id: string, type?: object, at: string[] = []): Patch => ({
  artifacts: [
    ...(type ? [{ kind: 'type' as const, type: type as never }] : []),
    { kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', hole: USE_HOLE, at, label: { en: 'Use {instrument}', zh: '使用{instrument}' }, tree: { if: ON_DEAD_TREE, then: { do: [{ op: 'log', text: 'You knock the stone on it.' }] }, else: { undefined: true } } } },
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
      { seq: 1, at, patch: answer('patch/stone-bead', bead), rules: ['patch/stone-bead'] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: old }] }, rules: [] },
      { seq: 3, at, patch: answer('patch/stone-clay', old, [not(ON_DEAD_TREE)]), rules: ['patch/stone-clay'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const gone = library.prune()
    expect(gone.map((g) => g.rules)).toEqual([['patch/stone-clay']])
    expect(gone[0].reason).toMatch(/material/)
    expect(library.lib.rules.has('patch/stone-bead')).toBe(true)
    expect(library.lib.rules.has('patch/stone-clay')).toBe(false)
    // and once is enough: nothing more to roll back
    expect(library.prune()).toEqual([])
  })
})
