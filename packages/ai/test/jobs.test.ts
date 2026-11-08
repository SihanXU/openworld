import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ChangeJobs, jobTools } from '../src/agent/jobs.ts'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const pass = () => ({ ok: true, summary: 'Observed the actual required result.' })
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'creator-job-')); dirs.push(dir)
  return { dir, store: new ChangeJobs(join(dir, 'jobs'), { workspaceRoot: dir }) }
}

describe('persistent autonomous change targets', () => {
  it('resumes tasks, tree and artifacts; host checks control dependency and job completion', async () => {
    const { dir, store } = fixture(), { id } = store.create('A fusion weapon', { id: 'fusion' })
    store.plan(id, { useTree: { uses: ['fuse', 'attack'] }, tasks: [{ id: 'research', title: 'Find existing combat', kind: 'research' }, { id: 'build', title: 'Create candidate', kind: 'item', dependsOn: ['research'] }] })
    expect(() => store.updateTask(id, 'build', { status: 'doing' })).toThrow(/dependency/)
    store.decision(id, 'Reuse the native receiver.', ['research'])
    await store.verify(id, 'research', 'queries', pass)
    writeFileSync(join(dir, 'weapon.json'), '{"power":2}')
    store.artifact(id, { taskId: 'build', kind: 'item', path: 'weapon.json' })
    const resumed = new ChangeJobs(join(dir, 'jobs'), { workspaceRoot: dir })
    expect(resumed.read(id)).toMatchObject({ useTree: { uses: ['fuse', 'attack'] }, decisions: [{ text: 'Reuse the native receiver.' }] })
    await resumed.verify(id, 'build', 'trial', j => ({ ok: JSON.parse(readFileSync(join(dir, j.artifacts[0].path), 'utf8')).power === 2, summary: 'Actual candidate inspected' }))
    await resumed.complete(id, pass)
    expect(resumed.read(id).phase).toBe('complete')
  })
  it('exposes registered verification, records failure and allows self-repair without a done-claim bypass', async () => {
    const { dir, store } = fixture(), { id } = store.create('Output', { id: 'repair' })
    store.plan(id, { tasks: [{ id: 'output', title: 'Produce output', kind: 'verification' }] })
    expect(() => store.updateTask(id, 'output', { status: 'verified' as never })).toThrow(/host verification/)
    expect(() => store.setPhase(id, 'complete' as never)).toThrow(/host verifier/)
    expect(jobTools(store, id).some(t => t.name === 'complete_change_job')).toBe(false)
    writeFileSync(join(dir, 'output.txt'), 'broken')
    const tool = jobTools(store, id, { verifiers: { check: () => ({ ok: readFileSync(join(dir, 'output.txt'), 'utf8') === 'ready', summary: 'Actual output read' }) } }).find(t => t.name === 'verify_change_task')!
    expect(JSON.parse(await tool.run({ taskId: 'output', check: 'check' })).ok).toBe(false)
    expect(store.read(id).tasks[0].status).toBe('blocked')
    await expect(store.complete(id, pass)).rejects.toThrow(/every planned task/)
    writeFileSync(join(dir, 'output.txt'), 'ready')
    expect(JSON.parse(await tool.run({ taskId: 'output', check: 'check' })).ok).toBe(true)
    await store.complete(id, () => ({ ok: false, summary: 'Integration failed' }))
    expect(store.read(id).phase).toBe('verifying')
  })
  it('invalidates changed artifacts and downstream proof and preserves unchanged plans', async () => {
    const { dir, store } = fixture(), { id } = store.create('A package')
    const tasks = [{ id: 'package', title: 'Package', kind: 'item' as const }, { id: 'integration', title: 'Integration', kind: 'integration' as const, dependsOn: ['package'] }]
    store.plan(id, { tasks }); writeFileSync(join(dir, 'package.json'), 'one')
    store.artifact(id, { taskId: 'package', kind: 'package', path: 'package.json' })
    await store.verify(id, 'package', 'trial', pass); await store.verify(id, 'integration', 'integration', pass)
    store.plan(id, { tasks }); expect(store.read(id).tasks.every(t => t.status === 'verified')).toBe(true)
    writeFileSync(join(dir, 'package.json'), 'two')
    await expect(store.complete(id, pass)).rejects.toThrow(/changed since registration/)
    store.artifact(id, { taskId: 'package', kind: 'package', path: 'package.json' })
    expect(store.read(id).tasks.map(t => t.status)).toEqual(['todo', 'todo'])
    store.failure(id, 'Observed gameplay failure', 'package')
    expect(store.read(id)).toMatchObject({ phase: 'implementing', tasks: [{ status: 'blocked' }, { status: 'todo' }] })
  })
  it('validates dependency and parent graphs separately', () => {
    const { store } = fixture(), { id } = store.create('Parent with subtask')
    store.plan(id, { tasks: [{ id: 'whole', title: 'Whole', kind: 'mechanism', dependsOn: ['art'] }, { id: 'art', parentId: 'whole', title: 'Art', kind: 'art' }] })
    expect(() => store.plan(id, { tasks: [{ id: 'art', title: 'Art', kind: 'art', parentId: 'art' }] })).toThrow(/parent cycle/)
    expect(() => store.plan(id, { tasks: [{ id: 'art', title: 'Art', kind: 'art', dependsOn: ['whole'] }] })).toThrow(/cycle/)
    expect(() => store.read('../escape')).toThrow(/stable ID/)
  })
})
