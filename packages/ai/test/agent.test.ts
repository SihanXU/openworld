import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CONTAINER_SETUP,
  HOOK_NODE,
  IMAGE_INIT,
  LocalEnv,
  OpenAICompatModel,
  PIN_BREACH,
  ScriptedModel,
  SelfState,
  agentTools,
  applyPreset,
  better,
  checkProposal,
  improve,
  manifestOf,
  modelFromEnv,
  pinFromEnv,
  recordsOf,
  repositoryIn,
  runAgent,
  runInstances,
  solve,
  type AgentTask,
  type ChatMessage,
  type Episode,
  type TaskSource,
} from '../src/index.ts'

/** A stand-in for the docker CLI (an image is a directory; exec runs here): the container path without Docker. */
const FAKE_DOCKER = fileURLToPath(new URL('./fake-docker.mjs', import.meta.url))

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
/** A task a person runs on their own machine (commands allowed locally); `localRun: false` is the unattended case. */
const task = (dir: string, extra: Partial<AgentTask> = {}): AgentTask => ({ id: 'add-bug', kind: 'mini', statement: ISSUE, env: new LocalEnv(dir), tests: { command: 'node test.mjs' }, localRun: true, ...extra })

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

  it('gives no shell where commands are not isolated, unless a person allowed it', () => {
    const dir = bugRepo()
    const names = (o: Parameters<typeof agentTools>[1] = {}) => agentTools(new LocalEnv(dir), { testCommand: 'node test.mjs', ...o }).map((t) => t.name)
    expect(names()).not.toContain('run')
    expect(names()).toContain('run_tests')
    expect(names({ localRun: true })).toContain('run')
  })

  it('does not write through a link out of the workspace', async () => {
    const dir = bugRepo()
    const outside = mkdtempSync(join(tmpdir(), 'lsw-outside-'))
    symlinkSync(outside, join(dir, 'linked'), 'junction')
    const t = agentTools(new LocalEnv(dir)).find((x) => x.name === 'write_file')!
    await expect(async () => t.run({ path: 'linked/escaped.txt', content: 'x' })).rejects.toThrow(/outside the workspace/)
    expect(existsSync(join(outside, 'escaped.txt'))).toBe(false)
    expect(await t.run({ path: 'src/new.mjs', content: 'x' })).toMatch(/wrote/)
  })

  it('runs no hook the agent wrote for itself when its commands are not isolated', { timeout: 60_000 }, async () => {
    const state = freshState()
    applyPreset(state, 'tuned') // a start hook and a presubmit hook
    let intro = ''
    const base = engineer()
    const model = new ScriptedModel(async (messages, opts) => ((intro = messages[1].content), base.chat(messages, opts)))
    const r = await runAgent(task(bugRepo(), { localRun: false }), { model, state })
    expect(intro).not.toContain('# From your start hooks')
    expect(r.episode.tools.map((x) => x.name)).not.toContain('run')
    expect(r.outcome).toBe('accepted')
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
    const { RELATED_CODE_HOOK } = await import('../src/agent/presets.ts')
    const proposal = { kind: 'hook', stage: 'start', name: 'related-code', code: RELATED_CODE_HOOK, rationale: 'every task starts with three list_dir calls' }
    const work = engineer({ wander: 3, latencyMs: 300 })
    const model = new ScriptedModel((messages, opts) => (opts.purpose === 'propose' ? proposal : work.chat(messages, opts)))
    // (the clock is noise here, beside the calls judged: under a full parallel run the start hook's process may start
    // slowly; time may be worse by as much again)
    const r = await improve({ model, state, sources: [source], select: 2, confirm: 2, timeMargin: 1 })
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
    // the clock judged with its own margin: worse time within it is no reason to refuse; a gain in it still needs the margin
    const t = (calls: number, ms: number) => ({ tasks: 4, accepted: 3, cost: 0, calls, ms })
    expect(better(t(40, 1000), t(30, 1500), 0.1)).toMatchObject({ ok: false, why: 'ms worse by more than 10 %' })
    expect(better(t(40, 1000), t(30, 1500), 0.1, 1)).toMatchObject({ ok: true, why: 'better: calls' })
    expect(better(t(40, 1000), t(40, 950), 0.1, 1)).toMatchObject({ ok: false, why: 'no gain beyond noise' })
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

  it("works a benchmark image's own repository: its build stays out of the diff, the hooks run with a mounted node, git trusts the workspace", { timeout: 60_000 }, async () => {
    // the "image": its filesystem as a directory, the repository in /testbed as the environment's install left it
    const img = mkdtempSync(join(tmpdir(), 'lsw-image-'))
    cpSync(bugRepo(), join(img, 'testbed'), { recursive: true })
    mkdirSync(join(img, 'testbed', 'build'))
    writeFileSync(join(img, 'testbed', 'build', 'ext.so'), 'compiled in place\n') // untracked: the in-place build
    writeFileSync(join(img, 'testbed', 'test.mjs'), readFileSync(join(img, 'testbed', 'test.mjs'), 'utf8') + '// rewritten by the install\n') // a tracked file the install changed
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-swe-docker-'))
    process.env.FAKE_DOCKER_STATE = join(tmp, 'docker')
    const state = freshState()
    applyPreset(state, 'tuned') // a start hook and a presubmit hook: they need node, which a benchmark image lacks
    try {
      const p = await solve(
        { instance_id: 'local__add-2', repo: 'local/add', base_commit: 'image', problem_statement: ISSUE, test_cmd: 'node test.mjs', image: img },
        { model: engineer(), state, env: 'docker', docker: [process.execPath, FAKE_DOCKER], hookNode: process.execPath, owner: '4242:4242', cache: join(tmp, 'cache'), work: join(tmp, 'work') },
      )
      expect(p.outcome).toBe('accepted') // the presubmit hook ran (with the mounted node) and let it submit
      expect(p.record).toMatchObject({ instance_id: 'local__add-2', submitted: true, ablated: [], providers: [] })
      expect(p.record.steps).toBeGreaterThan(0)
      expect(p.model_patch).toMatch(/\+export const add = \(a, b\) => a \+ b/)
      expect(p.model_patch).not.toMatch(/ext\.so|build\//) // the image's build is not the answer
      expect(p.model_patch).not.toContain('rewritten by the install') // nor is what the install changed
      const calls = readFileSync(join(tmp, 'docker', 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[])
      const scripts = calls.filter((c) => c[0] === 'exec').map((c) => c.at(-1)!)
      expect(calls.some((c) => c[0] === 'cp' && /:\/testbed$/.test(c[1]))).toBe(true)
      const run = calls.find((c) => c[0] === 'run')!
      expect(run).toEqual(expect.arrayContaining(['--network', 'none', `${process.execPath}:${HOOK_NODE}:ro`]))
      expect(scripts.some((s) => s.includes(CONTAINER_SETUP))).toBe(true)
      expect(scripts.some((s) => s.includes(`${HOOK_NODE} .agent/hooks/presubmit/tests-pass.mjs`))).toBe(true)
      expect(scripts.every((s) => s.startsWith(IMAGE_INIT))).toBe(true)
      expect(scripts.some((s) => s.includes("chown -R '4242:4242' '/testbed'"))).toBe(true)
    } finally {
      delete process.env.FAKE_DOCKER_STATE
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('finds the repository where an image keeps it below /testbed (as some of SWE-bench-Live do)', { timeout: 60_000 }, async () => {
    const img = mkdtempSync(join(tmpdir(), 'lsw-image-sub-'))
    mkdirSync(join(img, 'testbed'))
    writeFileSync(join(img, 'testbed', 'build.log'), 'the image builder left this beside the repository\n')
    cpSync(bugRepo(), join(img, 'testbed', 'project'), { recursive: true })
    expect(repositoryIn(join(img, 'testbed'))).toBe('project')
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-swe-docker-sub-'))
    process.env.FAKE_DOCKER_STATE = join(tmp, 'docker')
    try {
      const p = await solve(
        { instance_id: 'local__add-3', repo: 'local/add', base_commit: 'image', problem_statement: ISSUE, test_cmd: 'node test.mjs', image: img },
        { model: engineer(), state: freshState(), env: 'docker', docker: [process.execPath, FAKE_DOCKER], hookNode: null, cache: join(tmp, 'cache'), work: join(tmp, 'work') },
      )
      expect(p.outcome).toBe('accepted')
      expect(p.model_patch).toMatch(/\+export const add = \(a, b\) => a \+ b/)
      const calls = readFileSync(join(tmp, 'docker', 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[])
      expect(calls.filter((c) => c[0] === 'exec').every((c) => c.includes('/testbed/project'))).toBe(true) // the commands run in the repository
    } finally {
      delete process.env.FAKE_DOCKER_STATE
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('runs instances several at a time, records each, resumes, and refuses to mix two runs', { timeout: 60_000 }, async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-swe-run-'))
    const inst = (n: number) => {
      const repo = bugRepo()
      return { instance_id: `local__add-${n}`, repo, base_commit: execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim(), problem_statement: ISSUE, test_cmd: 'node test.mjs' }
    }
    const items = [inst(1), inst(2)]
    const out = join(tmp, 'preds.jsonl')
    const manifest = { model: 'scripted', ablated: [] }
    const o = { model: engineer(), state: freshState(), cache: join(tmp, 'cache'), work: join(tmp, 'work'), out, workers: 2, manifest }
    expect(await runInstances(items, o)).toMatchObject({ done: 2, failed: 0, skipped: 0 })
    expect(readFileSync(out, 'utf8').trim().split('\n')).toHaveLength(2)
    const records = readFileSync(recordsOf(out), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(records.map((r) => r.outcome)).toEqual(['accepted', 'accepted'])
    expect(records.every((r) => r.steps > 0 && typeof r.ms === 'number')).toBe(true)
    expect(JSON.parse(readFileSync(manifestOf(out), 'utf8'))).toEqual(manifest)
    await expect(runInstances(items, o)).rejects.toThrow(/exists: --resume/)
    expect(await runInstances(items, { ...o, resume: true })).toMatchObject({ done: 0, skipped: 2 })
    await expect(runInstances(items, { ...o, resume: true, manifest: { ...manifest, ablated: ['skills'] } })).rejects.toThrow(/differs in ablated/)
    // a call served from outside the provider pin voids the instance: no prediction, retried on resume
    const breach = new ScriptedModel(async () => {
      throw new Error(`model: served by Parasail, ${PIN_BREACH} (moonshotai)`)
    })
    const out2 = join(tmp, 'void.jsonl')
    expect(await runInstances(items, { ...o, model: breach, out: out2 })).toMatchObject({ done: 0, failed: 2 })
    expect(existsSync(out2)).toBe(false)
    expect(readFileSync(recordsOf(out2), 'utf8')).toContain(PIN_BREACH)
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe('a frozen model', () => {
  it('asks only the pinned providers, whatever a call prefers, and refuses an answer from another', async () => {
    const bodies: Record<string, unknown>[] = []
    const served = ['Moonshot AI', 'Parasail']
    const server = createServer((req, res) => {
      let b = ''
      req.on('data', (d) => (b += d))
      req.on('end', () => {
        bodies.push(JSON.parse(b))
        res.setHeader('Content-Type', 'application/json')
        // (a connection a call, never kept: under a full parallel run a kept one can be closed as it is taken up again)
        res.setHeader('Connection', 'close')
        res.end(JSON.stringify({ provider: served.shift(), choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }))
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    try {
      const port = (server.address() as { port: number }).port
      // the path names OpenRouter, so the model treats this endpoint as OpenRouter
      const m = new OpenAICompatModel({ baseUrl: `http://127.0.0.1:${port}/openrouter.ai/api/v1`, apiKey: 'k', model: 'moonshotai/kimi-k3', pin: { providers: ['moonshotai'], quantizations: ['fp8'] } })
      const r = await m.chat([{ role: 'user', content: 'hi' }], { provider: { order: ['parasail'], allow_fallbacks: true } })
      expect(r.content).toBe('ok')
      expect(bodies[0].provider).toEqual({ only: ['moonshotai'], order: ['moonshotai'], allow_fallbacks: false, quantizations: ['fp8'] })
      await expect(m.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(PIN_BREACH)
    } finally {
      server.close()
    }
    expect(pinFromEnv({ LSW_MODEL_PIN: 'moonshotai', LSW_MODEL_QUANT: 'fp8' })).toEqual({ providers: ['moonshotai'], quantizations: ['fp8'] })
    expect(pinFromEnv({})).toBeUndefined()
    expect(() => modelFromEnv({ LSW_MODEL_PIN: 'moonshotai', LSW_MODEL_BACKEND: 'claude-code' })).toThrow(/openrouter backend only/)
    expect(() => modelFromEnv({ LSW_MODEL_PIN: 'moonshotai', LSW_MODEL_KEY: 'k', LSW_MODEL: 'm', LSW_MODEL_PROVIDERS: 'parasail' })).toThrow(/cannot be set with it/)
  })

  it('calls no Anthropic model on a machine that says so (LSW_NO_ANTHROPIC=1)', () => {
    expect(() => modelFromEnv({ LSW_NO_ANTHROPIC: '1', LSW_MODEL_BACKEND: 'claude-code' })).toThrow(/refused on this machine/)
    expect(() => modelFromEnv({ LSW_NO_ANTHROPIC: '1', LSW_MODEL_KEY: 'k', LSW_MODEL: 'anthropic/claude-sonnet-5.5' })).toThrow(/refused on this machine/)
    expect(modelFromEnv({ LSW_NO_ANTHROPIC: '1', LSW_MODEL_KEY: 'k', LSW_MODEL: 'moonshotai/kimi-k3' })?.name).toBe('moonshotai/kimi-k3')
  })
})

// keep the Episode type in use for readers of this file
export type { Episode }
