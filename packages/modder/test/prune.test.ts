import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, type Cond, type Patch } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
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
  it('of two learned things by one name, forgets the later (the other name), keeping the one learned first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (id: string) => ({ id, name: { en: id.endsWith('glass_bead') ? 'Glass Bead' : 'Glassy Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    // the second came in under an older validator that did not compare Chinese names
    const log = [
      { seq: 1, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glass_bead') }] }, rules: [] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glassy_bead') }] }, rules: [] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id)).toEqual(['item/material/glass_bead'])
  })

  it('keeps a revised thing made of something learned after it was first brought', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (made: string) => ({ id: 'item/material/glass_bead', name: { en: 'Glass Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: made, count: 1 }] })
    const grit = { id: 'item/material/grit', name: { en: 'Grit', zh: '砂砾' }, tags: [], props: { material: 'stone' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const log = [
      { seq: 1, at, patch: answer('patch/stone-bead', bead('item/material/stone')), rules: ['patch/stone-bead'] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: grit }] }, rules: [] },
      { seq: 3, at, patch: answer('patch/stone-bead-2', bead('item/material/grit')), rules: ['patch/stone-bead-2'], replaces: ['patch/stone-bead'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id).sort()).toEqual(['item/material/glass_bead', 'item/material/grit'])
  })

  it('takes learned first by when it was first brought, not by a revision\'s redefinition; a kind of a forgotten thing goes with it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (id: string, en: string, tags: string[] = []) => ({ id, name: { en, zh: '玻璃珠' }, tags, props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    const blue = { id: 'item/material/glassy_bead/blue', name: { en: 'Blue Bead', zh: '蓝珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const log = [
      { seq: 1, at, patch: answer('patch/stone-bead', bead('item/material/glass_bead', 'Glass Bead')), rules: ['patch/stone-bead'] },
      // under an older validator: the same Chinese name, and a kind of it in the same patch
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glassy_bead', 'Glassy Bead') }, { kind: 'type', type: blue }] }, rules: [] },
      // the first bead's answer revised, the bead defined again (it moves to the end of the library's types)
      { seq: 3, at, patch: answer('patch/stone-bead-2', bead('item/material/glass_bead', 'Glass Bead', ['shiny'])), rules: ['patch/stone-bead-2'], replaces: ['patch/stone-bead'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id)).toEqual(['item/material/glass_bead'])
  })

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

  it('takes the types a rolled-back patch brought with it, so no later answer makes them and a corrected one can be defined', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    // a food the validator has since learned to refuse: nothing can eat it (no edible)
    const jam = (tags: string[]) => ({ id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags, props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: answer('patch/stone-jam', jam(['sweet'])), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.lib.types.map((t) => t.id)).toContain('item/food/stone_jam')
    expect(library.prune().map((g) => g.rules)).toEqual([['patch/stone-jam']])
    expect(library.lib.rules.has('patch/stone-jam')).toBe(false)
    expect(library.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(library.since(1)).toEqual([expect.objectContaining({ remove: 'patch/stone-jam' }), expect.objectContaining({ removeType: 'item/food/stone_jam' })])
    // a client that still holds the forgotten thing (something of it in its world) does not bring it back in its workspace
    const stale = library.workspace({ patches: { types: [jam(['sweet']) as never], rules: [{ ...(answer('patch/stone-jam', jam(['sweet'])).artifacts[1] as { rule: object }).rule, source: { origin: 'patch' } } as never], statuses: [] } })
    expect(stale.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(stale.rules.has('patch/stone-jam')).toBe(false)
    // the corrected thing takes the id again
    expect(library.validate(answer('patch/stone-jam-2', jam(['edible', 'sweet']))).errors).toEqual([])
    // and the log, read again from its file, comes back to the same library
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
  })

  it('forgets a refused type a rule rolled back before still left behind, and the later answer that made it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = { id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags: ['sweet'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const makes = answer('patch/stone-makes-jam')
    ;(makes.artifacts[0] as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor', into: 'hand' }, { op: 'destroy' }] }, else: { undefined: true } }
    const log = [
      { seq: 1, at, patch: answer('patch/stone-jam', jam), rules: ['patch/stone-jam'] },
      // rolled back by an earlier prune, which left the type in the library
      { seq: 2, at, remove: 'patch/stone-jam' },
      { seq: 3, at, patch: makes, rules: ['patch/stone-makes-jam'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.lib.rules.has('patch/stone-makes-jam')).toBe(true)
    const gone = library.prune()
    expect(library.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(gone.map((g) => g.rules)).toEqual([['patch/stone-makes-jam']])
    expect(gone[0].reason).toMatch(/stone_jam/)
  })

  it('lets a revision define again what the patch it replaces made (a food made without its tag), and keeps it in the library', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = (tags: string[]) => ({ id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags, props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    const makes = (id: string, type: object) => {
      const p = answer(id, type)
      ;(p.artifacts[1] as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor' }, { op: 'destroy' }] }, else: { undefined: true } }
      return p
    }
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: makes('patch/stone-jam', jam(['sweet'])), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const revised = makes('patch/stone-jam-2', jam(['edible', 'sweet']))
    // as a new answer the id is taken; in place of the old one it is the revision's to define again
    expect(library.validate(revised).errors.join()).toMatch(/exists already/)
    expect(library.validate(revised, undefined, undefined, ['patch/stone-jam']).errors).toEqual([])
    library.commit(revised, undefined, undefined, ['patch/stone-jam'])
    expect(library.lib.types.find((t) => t.id === 'item/food/stone_jam')?.tags).toContain('edible')
    // and it holds when the library is pruned again (as every start of the service does), read back from its file too
    expect(library.prune()).toEqual([])
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.prune()).toEqual([])
    expect(again.lib.rules.has('patch/stone-jam-2')).toBe(true)
    expect(again.lib.types.find((t) => t.id === 'item/food/stone_jam')?.tags).toContain('edible')
  })

  it('a revision that goes on making the same thing need not define it again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = { id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags: ['edible'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const makes = (id: string, type?: object) => {
      const p = answer(id, type)
      ;(p.artifacts.at(-1) as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor' }, { op: 'destroy' }] }, else: { undefined: true } }
      return p
    }
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: makes('patch/stone-jam', jam), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.validate(makes('patch/stone-jam-2'), undefined, undefined, ['patch/stone-jam']).errors).toEqual([])
  })
})

