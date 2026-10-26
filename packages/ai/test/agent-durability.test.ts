// The agent's machinery under crashes, races and deadlines: a command stops at its deadline with everything it
// started; a torn line in a JSON-lines file costs only itself; forks go when they are done; instances of one
// repository share one clone; the outer loop's bounds reject what they promise to, without a crash; a failed
// look for the sandbox image is asked again.

import { execSync, spawnSync } from 'node:child_process'
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  LocalEnv,
  RELATED_CODE_HOOK,
  ScriptedModel,
  SelfState,
  TESTS_PASS_HOOK,
  checkProposal,
  improve,
  nodeFiles,
  runInstances,
  sandboxImage,
  solve,
  type ChatMessage,
  type Episode,
  type Files,
  type TaskSource,
} from '../src/index.ts'

const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs')

function bugRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-durable-repo-'))
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src', 'add.mjs'), 'export const add = (a, b) => a - b\n')
  execSync('git init -q && git config core.autocrlf false && git add -A && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: dir })
  return dir
}

const freshState = () => SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-durable-state-')))
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
