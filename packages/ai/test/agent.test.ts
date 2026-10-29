// The SWE-style agent (agent/): its environment and tools, the loop, the outer loop, SWE-bench instances and a
// frozen model; then its machinery under crashes, races and deadlines.

import { execSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_HARNESS, keepReflection, nodeStand } from '../src/agent/state.ts'
import { CONTAINER_SETUP, HOOK_NODE, IMAGE_INIT, LocalEnv, OpenAICompatModel, PIN_BREACH, ScriptedModel, SelfState, agentTools, applyPreset, better, checkProposal, improve, AGENT_REFLECT_SYSTEM, nodeSkillName, reflectAfter, reflectAgent, inside, jsSearch, manifestOf, modelFromEnv, pinFromEnv, recordsOf, repositoryIn, runAgent, runInstances, solve, RELATED_CODE_HOOK, TESTS_PASS_HOOK, nodeFiles, sandboxImage, REPO, type AgentTask, type ChatMessage, type Episode, type TaskSource, type Files } from '../src/index.ts'

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
  it('takes a name that begins with two dots for a name, and searches one file as it searches a folder', () => {
    const dir = bugRepo()
    expect(inside(dir, '..config')).toBe(join(dir, '..config'))
    expect(() => inside(dir, '..')).toThrow(/outside the workspace/)
    expect(() => inside(dir, '../x')).toThrow(/outside the workspace/)
    mkdirSync(join(dir, 'deep'))
    writeFileSync(join(dir, 'deep', 'a.txt'), 'needle\n')
    expect(jsSearch(dir, join(dir, 'deep', 'a.txt'), 'needle')).toBe('deep/a.txt:1:needle')
    // a file past the size cap is skipped when it is named, as when the walk finds it
    writeFileSync(join(dir, 'big.txt'), `needle\n${'x'.repeat(1_000_000)}`)
    expect(jsSearch(dir, join(dir, 'big.txt'), 'needle')).toBe('(no match)')
    expect(jsSearch(dir, dir, 'needle')).toBe('deep/a.txt:1:needle')
  })

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

describe('the middle loop: global rules, and one skill a kind of task', () => {
  /** The prompt each step of a task was given (the intro, where the rules and skills are). */
  const intros = (seen: string[], o: { fix?: boolean } = {}) => {
    const base = engineer(o)
    return new ScriptedModel((messages, opts) => (seen.push(messages[1].content), base.chat(messages, opts)))
  }
  const section = (intro: string, title: string) => intro.split(`# ${title}`)[1].split('\n#')[0]

  it('files a rule under its kind of task, or as general for every task; never one about answering fast', { timeout: 30_000 }, async () => {
    const state = freshState()
    const r = await runAgent(task(bugRepo(), { kind: 'world-repo' }), { model: engineer(), state })
    // one rule a reflection (it is asked for at most one, and the rest are not kept)
    for (const add of [{ text: 'Run the whole test suite before submitting, not only the test you changed.', scope: 'general' }, { text: 'A rule writes only its host.', scope: 'kind' }])
      await reflectAgent(r.episode, { model: new ScriptedModel(() => ({ rules: { add: [add] }, notes: [], skill: null })), state, kindTerm: 'task:world' })
    expect(state.lessons().map((l) => l.terms)).toEqual([[], ['task:world']])
    const seen: string[] = []
    await runAgent(task(bugRepo(), { kind: 'swe' }), { model: intros(seen), state, record: false })
    const shown = section(seen[0], 'Lessons from your past work')
    expect(shown).toContain('Run the whole test suite')
    expect(shown).not.toContain('writes only its host')
    expect(AGENT_REFLECT_SYSTEM).toMatch(/A rule about a time limit, or about answering fast, is never general/)
  })

  it('keeps notes on a kind of task until it has recurred and gone wrong, then writes its one skill from them', { timeout: 60_000 }, async () => {
    const state = freshState()
    const asked: string[] = []
    const model = new ScriptedModel((messages) => (asked.push(messages[1].content), { rules: {}, notes: ['add() lives in src/add.mjs.'], skill: { description: 'arithmetic bugs in src', body: '1. Read src/add.mjs.\n2. Fix the operator.\n3. Run the tests.' } }))
    // a first submission that fails its tests each time: something went wrong to learn from
    for (let i = 0; i < 3; i++) {
      const r = await runAgent(task(bugRepo()), { model: engineer({ submitEarly: true }), state })
      await reflectAgent(r.episode, { model, state })
      if (i < 2) expect(state.skills()).toEqual([]) // fewer than three of its kind: the note waits on the node
    }
    expect(asked[0]).toContain('## This kind of task: kind:mini (1 task(s) so far)')
    expect(asked[2]).toContain('Write its skill now')
    expect(asked[2]).toContain('- add() lives in src/add.mjs.')
    expect(state.skills().map((s) => [s.name, s.node, s.triggers])).toEqual([[nodeSkillName('kind:mini'), 'kind:mini', []]])
    expect(state.pendingAt('kind:mini')).toEqual([])
    // its own kind of task lists it first; another kind does not see it
    const mine: string[] = []
    await runAgent(task(bugRepo()), { model: intros(mine), state, record: false })
    expect(section(mine[0], 'Your skills (read_skill)')).toContain(`${nodeSkillName('kind:mini')} (this kind of task's own: read it first)`)
    const swe: string[] = []
    await runAgent(task(bugRepo(), { kind: 'swe' }), { model: intros(swe), state, record: false })
    expect(section(swe[0], 'Your skills (read_skill)')).not.toContain(nodeSkillName('kind:mini'))
  })

  it('lists a general skill on every task, and an older skill by its triggers', () => {
    const state = freshState()
    state.writeSkill({ name: 'item-on-ground', description: 'a portable item used on a ground tile', triggers: ['kind:act/use', 'target#ground'], body: '1. lay it down' }, 'E1')
    state.writeSkill({ name: 'bisect-a-failure', description: 'narrow a failing test to the change that broke it', triggers: [], body: '1. git bisect' }, 'E2')
    state.writeSkill({ name: nodeSkillName('kind:engine'), node: 'kind:engine', description: 'engine tasks', triggers: [], body: '1. types first' }, 'E3')
    expect(state.relevantSkills(['kind:swe'], 'kind:swe').map((s) => s.name)).toEqual(['bisect-a-failure'])
    expect(state.relevantSkills(['kind:act/use', 'target#ground'], 'x').map((s) => s.name)).toEqual(['item-on-ground', 'bisect-a-failure'])
    expect(state.relevantSkills(['kind:engine'], 'kind:engine').map((s) => s.name)).toEqual([nodeSkillName('kind:engine'), 'bisect-a-failure'])
    expect(nodeSkillName('impulse/strike|core/strike|fixture/furniture|actor/person')).not.toBe(nodeSkillName('impulse/strike|core/strike|fixture/furniture|actor/creature'))
  })

  it("a node's skill written again after it was retired is judged afresh; a reflection read before another wrote the skill keeps none", () => {
    const state = freshState()
    const node = 'kind:mini'
    const name = nodeSkillName(node)
    state.writeSkill({ name, node, description: 'd', triggers: [], body: '1. old' }, 'E1')
    for (let i = 0; i < 8; i++) state.noteSkillUse([name], 'failed', `F${i}`)
    expect(state.skill(name)?.status).toBe('retired')
    // two reflections on the node, both read while it had no skill
    const h = { ...DEFAULT_HARNESS, reflect: { ...DEFAULT_HARNESS.reflect, skillMinRecurrence: 0 } }
    const a = nodeStand(state, node, h, true), b = nodeStand(state, node, h, true)
    const reply = (body: string) => JSON.stringify({ rules: { add: 'not a list' }, skill: { description: 'd', body } })
    expect(keepReflection(state, reply('1. new'), { cited: 'E9', kindTerm: node, stand: a }).skill).toBe(name)
    expect(state.skill(name)).toMatchObject({ status: 'active', uses: 0, accepted: 0, failed: 0 })
    // the second, read before the first wrote, does not write over it
    expect(keepReflection(state, reply('1. stale'), { cited: 'E10', kindTerm: node, stand: b }).skill).toBeUndefined()
    expect(state.readSkill(name)).toContain('1. new')
  })

  it('a run with the skills left out writes none, keeps its notes, and leaves a skill on file unread and unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-agent-state-'))
    const node = 'kind:mini'
    const name = nodeSkillName(node)
    SelfState.open(dir).writeSkill({ name, node, description: 'd', triggers: [], body: '1. the real one' }, 'E1')
    const state = SelfState.open(dir, undefined, ['skills'])
    const ep = (i: number): Episode => ({ id: `E${i}`, node, at: new Date().toISOString(), summary: 's', request: {}, key: `k${i}`, terms: [], outcome: 'failed', attempts: [], tools: [], rules: [], shown: { lessons: [], episodes: [], skills: [] }, skillsRead: [], harness: 1, usage: { calls: 1, input: 0, output: 0 }, ms: 1 })
    // six troubled tasks of one kind, each reflected on with a skill offered and a note
    for (let i = 2; i < 8; i++) {
      state.recordEpisode(ep(i))
      const stand = nodeStand(state, node, DEFAULT_HARNESS, true)
      expect(stand.due).toBe(false)
      const kept = keepReflection(state, JSON.stringify({ notes: [`note ${i}`], skill: { description: 'd', body: `1. version ${i}` } }), { cited: `E${i}`, kindTerm: node, stand })
      expect(kept.skill).toBeUndefined()
    }
    // the notes stay (none are cleared by a skill written in their place)
    expect(state.pendingAt(node).map((n) => n.text)).toEqual(['note 2', 'note 3', 'note 4', 'note 5', 'note 6', 'note 7'].slice(-state.pendingAt(node).length))
    expect(state.pendingAt(node).at(-1)?.text).toBe('note 7')
    expect(state.pendingAt(node).length).toBeGreaterThan(2)
    const real = SelfState.open(dir)
    expect(real.skill(name)?.version).toBe(1)
    expect(real.readSkill(name)).toContain('1. the real one')
  })

  it('a run with the memory left out writes no rules and no notes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-agent-state-'))
    const state = SelfState.open(dir, undefined, ['memory'])
    expect(state.applyLessons({ add: [{ text: 'Read the failing test first.' }] }, 'E1', ['kind:mini'])).toEqual([])
    state.addPending('kind:mini', ['a note'], 'E1')
    const real = SelfState.open(dir)
    expect(real.lessons()).toEqual([])
    expect(real.pendingAt('kind:mini')).toEqual([])
    expect(existsSync(join(dir, 'memory/pending.json'))).toBe(false)
  })

  it('adds one rule from a reflection at most, and none about time as general', () => {
    const state = freshState()
    const added = state.applyLessons({ add: [{ text: 'Answer within the time limit.', general: true }, { text: 'Read the failing test first.' }, { text: 'Run the whole suite.' }] }, 'E1', ['kind:mini'])
    expect(added).toHaveLength(1)
    expect(state.lessons()).toMatchObject([{ text: 'Answer within the time limit.', terms: ['kind:mini'] }])
    state.applyLessons({ add: [{ text: 'Run the whole suite before submitting.', general: true }] }, 'E2', ['kind:mini'])
    expect(state.lessons()[1]).toMatchObject({ terms: [] })
    expect(state.applyLessons({ add: 'not a list' } as never, 'E3', ['kind:mini'])).toEqual([])
  })

  it('reflects after a recorded task, unless the backend failed it', async () => {
    const state = freshState()
    let asked = 0
    const model = new ScriptedModel(() => (asked++, { rules: { add: [{ text: 'Read the failing assertion first.', scope: 'general' }] }, notes: [], skill: null }))
    const r = await runAgent(task(bugRepo()), { model: engineer(), state })
    await reflectAfter({ ...r.episode, outcome: 'failed', error: 'HTTP 429: rate limit' }, { model, state })
    expect(asked).toBe(0)
    await reflectAfter(r.episode, { model, state })
    expect(asked).toBe(1)
    expect(state.lessons().map((l) => l.text)).toEqual(['Read the failing assertion first.'])
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
    const { RELATED_CODE_HOOK } = await import('../src/agent/outer.ts')
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
    // the refusal names the margin each measure crossed: the clock's own, not the others'
    expect(better(t(40, 1000), t(30, 2500), 0.1, 1)).toMatchObject({ ok: false, why: 'ms worse by more than 100 %' })
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

// The agent's machinery under crashes, races and deadlines: a command stops at its deadline with everything it
// started; a torn line in a JSON-lines file costs only itself; forks go when they are done; instances of one
// repository share one clone; the outer loop's bounds reject what they promise to, without a crash; a failed
// look for the sandbox image is asked again.

const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs')

/** Files on disk that remember every temp directory made through them. */
function trackedFiles(): { files: Files; made: string[] } {
  const made: string[] = []
  return { made, files: { ...nodeFiles, tempDir: (p) => (made.push(nodeFiles.tempDir(p)), made.at(-1)!) } }
}
const submitter = () => new ScriptedModel((m: ChatMessage[]) => ({ content: '', toolCalls: [{ id: `s${m.length}`, name: 'submit', args: { summary: 'x' } }] }))
const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('a command at its deadline', () => {
  it('stops with everything it started, though a child holds its output; ordinary commands, input and exit as before', { timeout: 60_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-durable-env-'))
    const env = new LocalEnv(dir)
    // a command, its own process group: output, exit code and input as they were
    expect(await env.exec('echo out; echo err >&2; exit 3')).toMatchObject({ code: 3, stdout: 'out\n', stderr: 'err\n', timedOut: false })
    expect((await env.exec('cat', { input: 'from stdin' })).stdout).toBe('from stdin')
    // a process that ran one ends when it is done (nothing detached keeps it alive)
    const script = join(mkdtempSync(join(tmpdir(), 'lsw-durable-exit-')), 'exit.mts')
    writeFileSync(script, `import { LocalEnv } from ${JSON.stringify(join(REPO, 'packages/ai/src/agent/env.ts'))}\nconsole.log((await new LocalEnv(process.cwd()).exec('echo done')).stdout.trim())\n`)
    const p = spawnSync(process.execPath, [TSX, script], { encoding: 'utf8', timeout: 30_000 })
    expect([p.status, p.stdout.trim()]).toEqual([0, 'done'])
    // the deadline: the shell and the child it left behind both go, at the deadline
    const t0 = Date.now()
    const r = await env.exec('sleep 30 & echo $! > child.pid; wait', { timeoutMs: 500 })
    expect(r.timedOut).toBe(true)
    expect(Date.now() - t0).toBeLessThan(3000)
    const child = Number(readFileSync(join(dir, 'child.pid'), 'utf8'))
    await new Promise((res) => setTimeout(res, 200))
    expect(alive(child)).toBe(false)
  })
})

describe('a line torn by a crash', () => {
  const episode = (id: string): Episode => ({ id, at: new Date().toISOString(), summary: 's', request: {}, key: 'k', terms: [], outcome: 'accepted', attempts: [], tools: [], rules: [], shown: { lessons: [], episodes: [], skills: [] }, skillsRead: [], harness: 1, usage: { calls: 1, input: 0, output: 0 }, ms: 1 })

  it('costs only itself in the episode index and the journal: the next record is kept', () => {
    const dir = freshState().dir
    appendFileSync(join(dir, 'memory/index.jsonl'), '{"id":"ep-torn","at":"2026') // killed mid-append: no newline
    appendFileSync(join(dir, 'journal.jsonl'), '{"at":"2026","kind":"proposal","acc')
    const state = SelfState.open(dir)
    state.recordEpisode(episode('ep-next'))
    state.note('proposal', { accepted: false })
    const again = SelfState.open(dir)
    expect(again.episodes().map((e) => e.id)).toEqual(['ep-next'])
    expect(again.journalOf('proposal')).toMatchObject([{ accepted: false }])
  })

  it('in predictions.jsonl: the run resumes, works the torn instance again, and its new line is whole', { timeout: 60_000 }, async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-durable-swe-'))
    const repo = bugRepo()
    const base = execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim()
    const items = [1, 2].map((n) => ({ instance_id: `local__add-${n}`, repo, base_commit: base, problem_statement: 'x' }))
    const out = join(tmp, 'preds.jsonl')
    const o = { model: submitter(), state: freshState(), cache: join(tmp, 'cache'), work: join(tmp, 'work'), out, manifest: { m: 1 } }
    await runInstances(items.slice(0, 1), o)
    appendFileSync(out, '{"instance_id":"local__add-2","model_name_or_path":"x","model_patch":"diff --git') // killed mid-append
    expect(await runInstances(items, { ...o, resume: true })).toMatchObject({ done: 1, skipped: 1, failed: 0 })
    const whole = readFileSync(out, 'utf8').split('\n').filter((l) => l.startsWith('{') && l.endsWith('}'))
    expect(whole.map((l) => JSON.parse(l).instance_id)).toEqual(['local__add-1', 'local__add-2'])
  })
})

describe('forks', () => {
  it('the outer loop removes the forks its trial made', async () => {
    const { files, made } = trackedFiles()
    const state = SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-durable-state-')), undefined, [], files)
    const model = new ScriptedModel(() => ({ kind: 'note', text: 'Read the tests first.', rationale: 'r' }))
    const source: TaskSource = { kinds: ['mini'], replay: async () => undefined }
    await improve({ model, state, sources: [source], select: 1, confirm: 1 })
    expect(made.length).toBe(2)
    expect(made.filter((d) => existsSync(d))).toEqual([])
    expect(existsSync(state.dir)).toBe(true) // the state itself is no fork: dispose keeps it
    state.dispose()
    expect(existsSync(state.dir)).toBe(true)
  })

  it('a SWE instance removes the fork it worked with', { timeout: 60_000 }, async () => {
    const { files, made } = trackedFiles()
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-durable-swe-'))
    const repo = bugRepo()
    const base = execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim()
    const state = SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-durable-state-')), undefined, [], files)
    await solve({ instance_id: 'local__add-1', repo, base_commit: base, problem_statement: 'x' }, { model: submitter(), state, cache: join(tmp, 'cache'), work: join(tmp, 'work') })
    expect(made.length).toBe(1)
    expect(made.filter((d) => existsSync(d))).toEqual([])
  })
})

describe('instances of one repository at once', () => {
  it('share one clone of its mirror instead of racing to make it', { timeout: 120_000 }, async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-durable-swe-'))
    const repo = bugRepo()
    const base = execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim()
    const items = [1, 2, 3].map((n) => ({ instance_id: `local__add-${n}`, repo, base_commit: base, problem_statement: 'x' }))
    const out = join(tmp, 'preds.jsonl')
    const r = await runInstances(items, { model: submitter(), state: freshState(), cache: join(tmp, 'cache'), work: join(tmp, 'work'), out, workers: 3, manifest: { m: 1 } })
    expect(r).toMatchObject({ done: 3, failed: 0 })
  })
})

describe("the outer loop's bounds", () => {
  it('reject a skill without a description or triggers, recorded as a rejected proposal, not a crash', async () => {
    const state = freshState()
    expect(checkProposal({ kind: 'skill', skill: { name: 'x', body: 'do it', triggers: [] } as never, rationale: '' }, state)).toMatch(/description/)
    const model = new ScriptedModel(() => ({ kind: 'skill', skill: { name: 'x', body: 'do it', triggers: [] }, rationale: 'r' }))
    const source: TaskSource = { kinds: ['mini'], replay: async () => undefined }
    const r = await improve({ model, state, sources: [source], select: 1, confirm: 1 })
    expect(r).toMatchObject({ accepted: false, reason: expect.stringMatching(/description/) })
    expect(state.journalOf('proposal')).toHaveLength(1)
  })

  it('keep hooks off the network by the ordinary ways to reach it, and pass the hooks the presets ship', () => {
    const state = freshState()
    const hook = (code: string) => checkProposal({ kind: 'hook', stage: 'start', name: 'x', code, rationale: '' }, state)
    for (const code of [
      "import http from 'http'\nhttp.get('http://example.com/x')",
      "import { connect } from 'node:tls'",
      "const net = require('net')",
      "import dgram from 'dgram'",
      "const h = await import('node:' + 'https'); h.get('https://example.com/x')",
      "import { execSync } from 'node:child_process'\nexecSync('curl https://example.com/x')",
      "import { execFileSync } from 'node:child_process'\nexecFileSync('wget', ['https://example.com/x'])",
    ])
      expect(hook(code)).toMatch(/network/)
    expect(hook(RELATED_CODE_HOOK)).toBeUndefined()
    expect(hook(TESTS_PASS_HOOK)).toBeUndefined()
    expect(hook("import { readFileSync } from 'node:fs'\nconst local = await import('./helper.mjs')")).toBeUndefined()
  })
})

describe('the sandbox image', () => {
  it('is looked for again after a failure (the daemon restarting), not refused for the life of the process', async () => {
    delete process.env.LSW_SANDBOX_IMAGE
    const bin = mkdtempSync(join(tmpdir(), 'lsw-durable-docker-'))
    await expect(sandboxImage(join(bin, 'no-docker-here'))).rejects.toThrow(/could not build/)
    const docker = join(bin, 'docker')
    writeFileSync(docker, '#!/bin/sh\nexit 0\n') // the daemon is back: the image is there
    chmodSync(docker, 0o755)
    await expect(sandboxImage(docker)).resolves.toBe('lsw-sandbox')
  })
})
