import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Ontology, WorkshopPackage } from '@openworld/engine'
import { CreatorWorkspace, workspaceTools, type CreatorContext } from '../src/agent/workspace.ts'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'creator-query-')); dirs.push(root)
  const put = (name: string, value: string) => { const file = join(root, name); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, value) }
  put('games/demo/src/items.ts', "export const jam = 'item/food/jam'\n")
  put('games/demo/test/items.test.ts', '// item/food/jam actual use\n')
  const ontology = { types: { 'item/food': { id: 'item/food', tags: ['edible'] }, 'item/food/jam': { id: 'item/food/jam', name: { en: 'Jam', zh: '果酱' } } } } as unknown as Ontology
  const pkg: WorkshopPackage = { id: 'jam-uses', revision: 2, kind: 'uses', typeId: 'item/food/jam', enabled: true, plan: { version: 1, uses: [{ id: 'throw', capability: 'throw-coat', target: 'creature', label: 'Throw jam' }], pending: [{ idea: 'Ferment', reason: 'Needs timed process' }] }, capabilityVersions: { 'throw-coat': 1 }, ruleIds: [], statusIds: [], createdAt: '2026-11-04T00:00:00Z' }
  let context: CreatorContext = { gameId: 'demo', revision: '1', ontology, packages: [pkg], capabilities: [{ id: 'throw-coat', version: 1, label: 'Throw', description: 'A real coating', targets: ['creature'], params: {} }], recipes: [{ id: 'jam-recipe', name: 'Jam', sprite: 'jam', needs: [{ type: 'item/food/berries', count: 1 }], make: { type: 'item/food/jam' } }], entities: { jar: { id: 'jar', type: 'item/food/jam', place: { on: 'inside', holder: 'actor' } } }, maps: { garden: { name: 'Garden', rows: ['...', '.~.'] } }, assets: { items: { jam: { img: 'items.png', w: 16, h: 16 } } } }
  return { root, put, workspace: new CreatorWorkspace({ root, context: () => context }), context: () => context, set: (next: CreatorContext) => { context = next } }
}

describe('active creator semantic queries', () => {
  it('queries actual data, inherited type facts, use tree, resources and implementation/tests without mutation', () => {
    const { workspace, context } = fixture(), before = JSON.stringify(context())
    expect(workspace.search('果酱', ['type'])).toMatchObject({ results: [{ id: 'item/food/jam' }] })
    const inspected = workspace.inspect('item/food/jam') as { parents: { id: string }[]; related: { kind: string }[]; implementation: { path: string; test: boolean }[] }
    expect(inspected.parents[0].id).toBe('item/food')
    expect(inspected.related.map(r => r.kind)).toEqual(expect.arrayContaining(['recipe', 'package']))
    expect(inspected.implementation.some(r => r.test)).toBe(true)
    expect(workspace.useTree('jar')).toMatchObject({ typeId: 'item/food/jam', packages: [{ revision: 2, plan: { pending: [{ idea: 'Ferment' }] } }], capabilities: [{ id: 'throw-coat' }] })
    expect(JSON.stringify(workspace.inspect('garden', 'map'))).toContain('.~.')
    expect(workspace.inspect('items/jam', 'asset')).toMatchObject({ records: [{ data: { img: 'items.png', w: 16, h: 16 } }] })
    expect(JSON.stringify(context())).toBe(before)
  })
  it('refreshes catalogue revisions and actual added/edited source files', () => {
    const { workspace, context, set, put } = fixture()
    expect(workspace.search('new-power')).toMatchObject({ total: 0 })
    set({ ...context(), revision: '2', capabilities: [{ id: 'new-power', version: 1, label: 'Power', description: 'Native capability', targets: ['self'], params: {} }] })
    expect(workspace.search('new-power')).toMatchObject({ results: [{ id: 'new-power' }] })
    const before = workspace.inspectImplementation('games/demo/src/items.ts') as { sha256: string }
    put('games/demo/src/items.ts', "export const power = 'new-power'\n// changed\n")
    expect((workspace.inspectImplementation('games/demo/src/items.ts') as { sha256: string }).sha256).not.toBe(before.sha256)
    put('packages/engine/test/power.test.ts', '// new-power receiver\n')
    expect(workspace.searchImplementation('new-power').some(r => r.path.endsWith('power.test.ts'))).toBe(true)
  })
  it('exposes raw source plus exact coordinates/hash and rejects outside/non-source reads', () => {
    const { workspace, put } = fixture(), tools = workspaceTools(workspace)
    expect(tools.map(t => t.name)).toContain('get_use_tree')
    const read = tools.find(t => t.name === 'inspect_implementation')!
    const result = JSON.parse(String(read.run({ path: 'games/demo/src/items.ts', start: 1, end: 1 })))
    expect(result).toMatchObject({ content: "export const jam = 'item/food/jam'", start: 1, end: 1 })
    expect(result.sha256).toHaveLength(64)
    expect(() => workspace.inspectImplementation('../secret.ts')).toThrow(/inside/)
    put('.env', 'SECRET=not-source'); expect(() => workspace.inspectImplementation('.env')).toThrow(/source/)
  })
})
