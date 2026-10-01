import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LocalEnv,
  ScriptedModel,
  SelfState,
  agentTools,
  applyPreset,
  better,
  checkProposal,
  improve,
  runAgent,
  solve,
  type AgentTask,
  type ChatMessage,
  type Episode,
  type TaskSource,
} from '../src/index.ts'

/** A small git repository with a bug and a test that shows it. */
function bugRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-repo-'))
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src', 'add.mjs'), 'export const add = (a, b) => a - b\n')
  writeFileSync(join(dir, 'test.mjs'), "import { add } from './src/add.mjs'\nif (add(2, 3) !== 5) { console.error('add(2, 3) should be 5, got ' + add(2, 3)); process.exit(1) }\nconsole.log('ok')\n")
  execSync('git init -q && git config core.autocrlf false && git add -A && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: dir })
  return dir
}

const ISSUE = 'add() returns the wrong result: `add(2, 3)` gives -1 instead of 5.'
const task = (dir: string, extra: Partial<AgentTask> = {}): AgentTask => ({ id: 'add-bug', kind: 'mini', statement: ISSUE, env: new LocalEnv(dir), tests: { command: 'node test.mjs' }, ...extra })

const call = (name: string, args: Record<string, unknown>, id = name) => ({ content: '', toolCalls: [{ id, name, args }] })

/**
 * An engineer in script form: (optionally) looks around, reads the file, fixes it, runs the
 * tests, submits. With "wander", it lists directories first — unless a start hook already told
 * it where to look.
 */
function engineer(o: { wander?: number; fix?: boolean; submitEarly?: boolean; latencyMs?: number } = {}) {
  return new ScriptedModel(async (messages: ChatMessage[]) => {
    // a real model takes seconds per call; the outer loop's comparison of time needs some of that
    if (o.latencyMs) await new Promise((r) => setTimeout(r, o.latencyMs))
    const intro = messages[1].content
    const done = messages.filter((m) => m.role === 'tool').map((m) => (m as { name: string }).name)
    const hinted = intro.includes('src/add.mjs: add')
    const wander = hinted ? 0 : (o.wander ?? 0)
    if (done.filter((n) => n === 'list_dir').length < wander) return call('list_dir', { path: '.' }, `l${done.length}`)
    if (o.submitEarly && !done.includes('submit')) return call('submit', { summary: 'done' })
    if (!done.includes('read_file')) return call('read_file', { path: 'src/add.mjs' })
    if (!done.includes('edit_file') && o.fix !== false) return call('edit_file', { path: 'src/add.mjs', old_string: 'a - b', new_string: 'a + b' })
    if (!done.includes('run_tests')) return call('run_tests', {})
    return call('submit', { summary: 'fix add' }, `s${done.length}`)
  })
}

const freshState = () => SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-agent-state-')))

describe('the environment and tools', () => {
  it('runs commands in the workspace without the model key, and stops them at the deadline', async () => {
    const dir = bugRepo()
    process.env.LSW_MODEL_KEY = 'secret-key'
    const env = new LocalEnv(dir)
    const r = await env.exec('echo "key=[$LSW_MODEL_KEY]"; node test.mjs')
    expect(r.stdout).toContain('key=[]')
    expect(r.code).toBe(1)
    const slow = await env.exec('sleep 5', { timeoutMs: 500 })
    expect(slow.timedOut).toBe(true)
    delete process.env.LSW_MODEL_KEY
  })

  it('keeps file tools inside the workspace and edits exactly', async () => {
    const dir = bugRepo()
    const tools = agentTools(new LocalEnv(dir))
    const t = (n: string) => tools.find((x) => x.name === n)!
    await expect(async () => t('read_file').run({ path: '../outside.txt' })).rejects.toThrow(/outside the workspace/)
    expect(await t('edit_file').run({ path: 'src/add.mjs', old_string: 'a', new_string: 'x' })).toMatch(/occurs \d+ times/)
    expect(await t('edit_file').run({ path: 'src/add.mjs', old_string: 'a - b', new_string: 'a + b' })).toMatch(/edited/)
    expect(await t('search').run({ pattern: 'a \\+ b' })).toMatch(/add\.mjs:1:/)
    expect(await t('read_file').run({ path: 'src/add.mjs' })).toMatch(/1 {2}export const add = \(a, b\) => a \+ b/)
  })
})

describe('the agent loop', () => {
  it('works a task to a passing verdict and records the episode with its diff', { timeout: 30_000 }, async () => {
    const dir = bugRepo()
    const state = freshState()
    const r = await runAgent(task(dir), { model: engineer(), state })
    expect(r.outcome).toBe('accepted')
    expect(r.diff).toMatch(/-export const add = \(a, b\) => a - b\n\+export const add = \(a, b\) => a \+ b/)
    expect(r.diff).not.toContain('.agent')
    const ep = state.episode(r.episode.id)!
    expect(ep.kind).toBe('mini')
    expect(ep.attempts.map((a) => a.errors.length)).toEqual([0]) // one test run, passing
    expect(ep.tools.map((t) => t.name)).toEqual(['read_file', 'edit_file', 'run_tests', 'submit'])
  })

  it('fails a task whose tests still fail after submission', async () => {
    const r = await runAgent(task(bugRepo()), { model: engineer({ fix: false }), state: freshState() })
    expect(r.submitted).toBe(true)
    expect(r.outcome).toBe('failed')
    expect(r.episode.attempts.at(-1)!.errors[0]).toMatch(/should be 5/)
  })

  it('runs the tuned hooks: the start hook points at the code, the presubmit hook blocks a failing submission', { timeout: 60_000 }, async () => {
    const state = freshState()
    applyPreset(state, 'tuned')
    let intro = ''
    let blocked = ''
    const base = engineer({ submitEarly: true })
    const model = new ScriptedModel(async (messages, opts, n) => {
      intro = messages[1].content
      const last = messages.at(-1)!
      if (last.role === 'tool' && last.content.includes('blocked')) blocked = last.content
      return base.chat(messages, opts).then((r) => (void n, r))
    })
    const r = await runAgent(task(bugRepo()), { model, state })
    expect(intro).toContain('# From your start hooks')
    expect(intro).toMatch(/src\/add\.mjs: add/)
    expect(intro).toContain('Begin with a short plan')
    expect(blocked).toMatch(/BLOCK: the tests fail/)
    expect(r.outcome).toBe('accepted') // it fixed the code after the block, then submitted
  })
})

describe('the outer loop', () => {
  const source: TaskSource = { kinds: ['mini'], replay: async () => task(bugRepo()) }

  async function withHistory(n: number) {
    const state = freshState()
    for (let i = 0; i < n; i++) await runAgent(task(bugRepo()), { model: engineer({ wander: 3 }), state })
    return state
  }

  it('keeps a hook that removes wasted steps, after selection and confirmation', { timeout: 120_000 }, async () => {
    const state = await withHistory(4)
    const { RELATED_CODE_HOOK } = await import('../src/presets.ts')
    const proposal = { kind: 'hook', stage: 'start', name: 'related-code', code: RELATED_CODE_HOOK, rationale: 'every task starts with three list_dir calls' }
    const work = engineer({ wander: 3, latencyMs: 300 })
    const model = new ScriptedModel((messages, opts) => (opts.purpose === 'propose' ? proposal : work.chat(messages, opts)))
    const r = await improve({ model, state, sources: [source], select: 2, confirm: 2 })
    expect(r.accepted).toBe(true)
    expect(r.reason).toMatch(/better: calls/)
    expect(r.selection!.cand.calls).toBeLessThan(r.selection!.base.calls)
    expect(state.harness().agent.hooks.start).toEqual(['related-code'])
    expect(readFileSync(join(state.dir, 'harness/CHANGELOG.md'), 'utf8')).toMatch(/start hook related-code/)
    expect(state.journalOf('proposal').at(-1)).toMatchObject({ accepted: true })
  })

  it('rejects a change that lowers the pass rate, and leaves the self-state as it was', { timeout: 120_000 }, async () => {
    const state = await withHistory(2)
    const v = state.harness().version
    const proposal = { kind: 'hook', stage: 'presubmit', name: 'always-block', code: "console.log('BLOCK: no')", rationale: 'be careful' }
    const work = engineer()
    const model = new ScriptedModel((messages, opts) => (opts.purpose === 'propose' ? proposal : work.chat(messages, opts)))
    const r = await improve({ model, state, sources: [source], select: 1, confirm: 1 })
    expect(r.accepted).toBe(false)
    expect(r.reason).toMatch(/selection: pass rate/)
    expect(state.harness().version).toBe(v)
    expect(state.hookCode('presubmit', 'always-block')).toBeUndefined()
  })

  it('bounds what may change', () => {
    const state = freshState()
    expect(checkProposal({ kind: 'setting', path: 'review.enabled', value: false, rationale: '' }, state)).toMatch(/not a setting/)
    expect(checkProposal({ kind: 'setting', path: 'agent.maxSteps', value: 500, rationale: '' }, state)).toMatch(/out of bounds/)
    expect(checkProposal({ kind: 'hook', stage: 'start', name: 'x', code: "await fetch('http://x')", rationale: '' }, state)).toMatch(/network/)
    expect(checkProposal({ kind: 'setting', path: 'agent.planFirst', value: true, rationale: '' }, state)).toBeUndefined()
    const s = (tasks: number, accepted: number, calls: number) => ({ tasks, accepted, cost: 0, calls, ms: 1000 })
    expect(better(s(4, 3, 40), s(4, 3, 30), 0.1)).toMatchObject({ ok: true })
    expect(better(s(4, 3, 40), s(4, 3, 39), 0.1)).toMatchObject({ ok: false, why: 'no gain beyond noise' })
  })

  it('leaves out ablated parts of the self-state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-agent-state-'))
    const full = SelfState.open(dir)
    applyPreset(full, 'tuned')
    full.writeSkill({ name: 'fix-it', description: 'd', triggers: [], body: 'b' })
    const ablated = SelfState.open(dir, undefined, ['skills', 'harness'])
    expect(ablated.skills()).toEqual([])
    expect(ablated.harness().agent.hooks.start).toEqual([])
    expect(full.harness().agent.hooks.start).toEqual(['related-code'])
  })
})

describe('SWE-style instances', () => {
  it('checks the repository out at the base commit and returns the diff as a prediction, recording nothing', { timeout: 60_000 }, async () => {
    const repo = bugRepo()
    const base = execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim()
    writeFileSync(join(repo, 'later.txt'), 'a later commit the instance must not see\n')
    execSync('git add -A && git -c user.email=t@t -c user.name=t commit -qm later', { cwd: repo })
    const state = freshState()
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-swe-'))
    const p = await solve(
      { instance_id: 'local__add-1', repo, base_commit: base, problem_statement: ISSUE, test_cmd: 'node test.mjs' },
      { model: engineer(), state, cache: join(tmp, 'cache'), work: join(tmp, 'work') },
    )
    expect(p.outcome).toBe('accepted')
    expect(p.model_patch).toMatch(/\+export const add = \(a, b\) => a \+ b/)
    expect(p.model_patch).not.toContain('later.txt')
    expect(state.episodes()).toHaveLength(0) // the benchmark never becomes training data
    rmSync(tmp, { recursive: true, force: true })
  })
})

// keep the Episode type in use for readers of this file
export type { Episode }
