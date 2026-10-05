import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, validatePatch, replay, type ModWorkspace, type Patch, type Rule } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { WorldLibrary } from '../src/library.ts'

vi.mock('@lsw/engine', async (original) => {
  const engine = await original<typeof import('@lsw/engine')>()
  return { ...engine, validatePatch: vi.fn(engine.validatePatch), replay: vi.fn(engine.replay) }
})

function fresh() {
  const ontology = buildOntology(), base = [...BASE_RULES, ...STORY_RULES]
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
  ], event: {} }, ontology, new RuleLibrary(base))
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'it' })
  const req = port.records[0].request
  const rule: Rule = { id: 'patch/cache-rope', host: { type: 'item/tool/rope' }, on: 'act/use', tree: { do: [{ op: 'setProp', key: 'used', value: 1 }] } }
  const patch: Patch = { artifacts: [{ kind: 'rule', rule }] }
  return { library: new WorldLibrary(ontology, base), ontology, patch, req, rule }
}

beforeEach(() => vi.clearAllMocks())

describe('validation proofs', () => {
  it('reuses an exact proof at commit, independent of patch record metadata', () => {
    const { library, patch, req } = fresh()
    const first = library.validate(patch, req)
    expect(first.ok).toBe(true)
    first.errors.push('caller changed its copy')
    expect(library.commit({ ...patch, trigger: 'player' }, req).result.errors).toEqual([])
    expect(validatePatch).toHaveBeenCalledTimes(1)
  })

  it('replays only added tests and keeps the same diagnostics as full validation', () => {
    const { library, patch, req, rule, ontology } = fresh()
    expect(library.validate(patch, req).ok).toBe(true)
    rule.tests = [{ name: 'another rope', given: req.scenario, expect: [{ key: req.scenario.event.host!, propGt: ['used', 0] }] }]
    const result = library.validate(patch, req)
    expect(result.ok).toBe(true)
    expect(validatePatch).toHaveBeenCalledTimes(1)
    expect(replay).toHaveBeenCalledTimes(1)
    const full = validatePatch(patch, { ontology, library: library.workspace(), scenario: req.scenario })
    expect(result).toEqual(full)
    rule.tests!.push({ name: 'wrong expectation', given: req.scenario, expect: [{ key: 'actor', destroyed: true }] })
    expect(library.validate(patch, req).errors).toEqual(validatePatch(patch, { ontology, library: library.workspace(), scenario: req.scenario }).errors)
  })

  it.each(['library', 'ontology', 'regression', 'scenario', 'workspace', 'artifacts', 'status', 'type', 'replaces'] as const)('invalidates on %s changes', (change) => {
    const { library, patch, req, ontology } = fresh()
    let ws: ModWorkspace | undefined
    let replaces: string[] = []
    expect(library.validate(patch, req).ok).toBe(true)
    if (change === 'library') library.lib.add({ id: 'patch/other', host: { type: 'item/material/stick' }, on: 'act/use', tree: { do: [] }, source: { origin: 'patch' } })
    if (change === 'ontology') ontology.types['item/tool/rope'].props = { used: false }
    if (change === 'regression') library.regression.push({ scenario: structuredClone(req.scenario), rule: 'old' })
    if (change === 'scenario') req.scenario.entities[0].props = { test: 1 }
    if (change === 'workspace') ws = { patches: { types: [], statuses: [], rules: [] }, regression: [] }
    if (change === 'artifacts' && patch.artifacts[0].kind === 'rule') patch.artifacts[0].rule.doc = 'Changed content'
    if (change === 'status') library.lib.addStatus({ id: 'cache-status', duration: 1 })
    if (change === 'type') library.lib.addType({ id: 'item/cache' })
    if (change === 'replaces') replaces = ['patch/old']
    library.validate(patch, req, ws, replaces)
    expect(validatePatch).toHaveBeenCalledTimes(2)
    library.validate(patch, req, ws, replaces)
    expect(validatePatch).toHaveBeenCalledTimes(2)
  })

  it('rechecks when another commit, removal or revision changed the shared library', () => {
    const { library, patch, req } = fresh()
    expect(library.validate(patch, req).ok).toBe(true)
    const other: Patch = { artifacts: [{ kind: 'rule', rule: { id: 'patch/other', host: { type: 'item/material/stick' }, on: 'act/use', tree: { do: [] } } }] }
    expect(library.commit(other).ok).toBe(true)
    expect(library.commit(patch, req).ok).toBe(true)
    expect(validatePatch).toHaveBeenCalledTimes(3)
    expect(library.remove('patch/cache-rope')).toBe(true)
    expect(library.validate(patch, req).ok).toBe(true)
    expect(library.commit(patch, req).ok).toBe(true)
    expect(validatePatch).toHaveBeenCalledTimes(4)
    expect(library.commit(patch, req, new Date(), ['patch/cache-rope']).ok).toBe(true)
    expect(validatePatch).toHaveBeenCalledTimes(5)
  })

  it('does not use a client workspace proof for a shared commit', () => {
    const { library, patch, req } = fresh()
    expect(library.validate(patch, req, { patches: { types: [], statuses: [], rules: [] } }).ok).toBe(true)
    expect(library.commit(patch, req).ok).toBe(true)
    expect(validatePatch).toHaveBeenCalledTimes(2)
  })
})
