// The ladder (docs/rsi-experiments.md §5): this repository's own commits as SWE-style tasks. A commit that
// changes code and its tests is a task at its parent: the issue says what the commit did, the commit's test
// changes are the hidden tests, and it is solved when the tests that went from failing to passing pass and
// those that passed still do — fail-to-pass, as SWE-bench builds its instances from pull requests, with the
// same method as the fresh pool's miner (docs/fresh-pool.md, S3): three runs with the test changes alone,
// three with the whole commit; a test that passes only sometimes is in neither list.
//
// The collaborators' work keeps adding commits, so the ladder grows with the world (§5.5): a milestone's
// window is the commits since the last one.
//
//   npm run ladder -- candidates                      the commits with code and tests, by rung → var/ladder/candidates.jsonl
//   npm run ladder -- validate [--limit n] [--sha a,b]
//                                                     fail-to-pass, at each parent → var/ladder/validated.jsonl
//   npm run ladder -- issues [--limit n] [--rewrite]  each validated commit's issue, by a model, kept only if it does not
//                                                     give the change away → games/openworld/ai/tasks/history/<sha>/
//   npm run ladder -- review [--n 20]                 a sample of the issues for a person to read before the first run
//   npm run ladder -- status                          what there is
//
// Our own code, so its tests run here; the agent that later works these tasks runs only in a container
// (CLAUDE.md). Dependencies are installed once per lockfile (var/ladder/deps/<lock>), and each workspace
// links them in, its own packages to its own copies, as the engine tasks' workspace does.

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DockerEnv, LocalEnv, SANDBOX_LIMITS, chooseIsolation, hostUser, modelFromEnv, sandboxImage, type AgentTask, type Env, type Isolation, type TaskSource } from '@openworld/ai'
import { REPO } from './engine-tasks.ts'

export const DATA = join(REPO, 'var', 'ladder')
const RUNS = 3
/** one run of a commit's test files; a task whose tests take longer is dropped as slow (a task, not a soak test) */
const RUN_TIMEOUT = 300_000
/** what a task's workspace holds: the code and its tests, not the docs, the wiki or the served assets */
const KEEP = ['packages', 'games', 'package.json', 'package-lock.json', 'tsconfig.base.json', 'tsconfig.json', 'vitest.config.ts']
const EXCLUDE = [':(exclude,glob)games/*/public/**', ':(exclude,glob)packages/*/public/**', ':(exclude)games/openworld/tools/tasks', ':(exclude)packages/editor/desktop']

export type Rung = 'R1' | 'R2' | 'R3' | 'R4'

export interface Candidate {
  sha: string
  parent: string
  author: string
  date: string
  subject: string
  tests: string[]
  code: string[]
  lines: number
  areas: string[]
  rung: Rung
  /** the parent's package-lock.json blob: the dependencies its tests run with */
  lock: string
}

// ------------------------------------------------------------------ the commits

export const isTest = (p: string): boolean => /(^|\/)test\/|\.test\.ts$/.test(p) && !/baseline\.json$/.test(p)
export const isCode = (p: string): boolean => /\.(ts|mjs|js|json)$/.test(p) && !isTest(p) && !/^docs\/|^wiki\/|public\/|package-lock|\.baseline\.json$|\/locales\/|probes\.json$/.test(p)

export function area(p: string): string {
  const m = /^packages\/(engine|modules|stdlib|format|editor|runtime|client|modder|agent|ai)\//.exec(p)
  if (m) return m[1] === 'client' ? 'runtime' : m[1]
  if (/^(games\/[^/]+|packages)\/content\//.test(p)) return 'content'
  if (/^(games\/[^/]+|packages)\/tools\//.test(p) || /^games\/[^/]+\/ai\//.test(p)) return 'tools'
  if (/^games\/[^/]+\/client\//.test(p)) return 'runtime'
  return 'other'
}

/** The rung (§5.2): R1 a rule's worth of content, R2 a mechanic or a small kernel fix, R3 an engine change, R4 a system; undefined beyond 3,000 lines. */
export function rungOf(lines: number, areas: Set<string>): Rung | undefined {
  const ui = areas.has('editor') || areas.has('runtime')
  const kernel = ['engine', 'modules', 'format', 'stdlib'].some((a) => areas.has(a))
  if (lines > 3000) return undefined
  if (lines > 800 || areas.size >= 4) return 'R4'
  if (kernel || areas.has('modder') || areas.has('agent') || areas.has('ai')) return lines <= 40 && !ui ? 'R2' : 'R3'
  if (areas.has('content') || areas.has('tools')) return lines <= 80 ? 'R1' : 'R2'
  return lines <= 300 ? 'R2' : 'R3'
}

function git(args: string[], o: { cwd?: string; input?: string | Buffer; binary?: boolean } = {}): string {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: o.cwd ?? REPO, input: o.input, maxBuffer: 1 << 30, encoding: o.binary ? 'buffer' : 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.slice(0, 3).join(' ')}: ${String(r.stderr).slice(0, 400)}`)
  return String(r.stdout)
}

/** The non-merge commits of `ref` that change code and tests, with their rungs (the largest left out). */
export function candidates(ref = 'origin/main'): Candidate[] {
  const out: Candidate[] = []
  const log = git(['log', '--no-merges', '--format=@@%H|%P|%an|%aI|%s', '--numstat', ref])
  for (const block of log.split('@@').filter(Boolean)) {
    const [head, ...lines] = block.split('\n')
    const [sha, parents, author, date, ...subject] = head.split('|')
    const parent = parents.split(' ')[0]
    if (!parent) continue
    const files = lines.map((l) => /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => ({ add: Number(m[1]) || 0, del: Number(m[2]) || 0, path: m[3] }))
    const tests = files.filter((f) => isTest(f.path) && f.path.endsWith('.test.ts'))
    const code = files.filter((f) => isCode(f.path))
    if (!tests.length || !code.length) continue
    const n = code.reduce((a, f) => a + f.add + f.del, 0)
    const areas = new Set(code.map((f) => area(f.path)))
    const rung = rungOf(n, areas)
    if (!rung) continue
    let lock = ''
    try {
      lock = git(['rev-parse', `${parent}:package-lock.json`]).trim()
    } catch {
      continue // no lockfile at the parent: no environment to run it in
    }
    out.push({ sha, parent, author, date, subject: subject.join('|'), tests: tests.map((f) => f.path), code: code.map((f) => f.path), lines: n, areas: [...areas].sort(), rung, lock })
  }
  return out
}

// ------------------------------------------------------------------ the workspace at a parent

/** The parent's code and tests as a repository of its own, LF throughout, committed as `base`. */
export function workspace(parent: string, dir: string): void {
  const top = new Set(git(['ls-tree', '--name-only', parent]).split('\n').filter(Boolean))
  const keep = KEEP.filter((k) => top.has(k))
  const tar = spawnSync('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar', parent, '--', ...keep, ...EXCLUDE], { cwd: REPO, maxBuffer: 2 ** 31 })
  if (tar.status !== 0) throw new Error(`git archive ${parent}: ${String(tar.stderr).slice(0, 300)}`)
  mkdirSync(dir, { recursive: true })
  const x = spawnSync('tar', ['-xf', '-', '-C', dir], { input: tar.stdout, maxBuffer: 1 << 20 })
  if (x.status !== 0) throw new Error(`tar: ${String(x.stderr).slice(0, 300)}`)
  const lf = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) lf(p)
      else if (/\.(ts|json|md|mjs|js)$/.test(e.name)) {
        const t = readFileSync(p, 'utf8')
        if (t.includes('\r\n')) writeFileSync(p, t.replace(/\r\n/g, '\n'))
      }
    }
  }
  lf(dir)
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n')
  git(['init', '-q'], { cwd: dir })
  git(['add', '-A'], { cwd: dir })
  git(['-c', 'user.email=lsw@local', '-c', 'user.name=lsw', 'commit', '-qm', 'base'], { cwd: dir })
}

/** The workspace directories of a commit's package.json ("packages/*", "games/*\/*"). */
export function workspaceDirs(parent: string): string[] {
  const pkg = JSON.parse(git(['show', `${parent}:package.json`])) as { workspaces?: string[] }
  const globs = (pkg.workspaces ?? []).map((g) => new RegExp(`^${g.replace(/\*/g, '[^/]+')}/package\\.json$`))
  return git(['ls-tree', '-r', '--name-only', parent])
    .split('\n')
    .filter((p) => globs.some((g) => g.test(p)))
    .map((p) => p.slice(0, -'/package.json'.length))
}

/** The dependencies of a lockfile, installed once: its package.json, its lock, and its workspaces' package.json. */
export function deps(c: Pick<Candidate, 'parent' | 'lock'>): string {
  const dir = join(DATA, 'deps', c.lock)
  if (existsSync(join(dir, 'node_modules', '.package-lock.json'))) return dir
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const f of ['package.json', 'package-lock.json']) writeFileSync(join(dir, f), git(['show', `${c.parent}:${f}`]))
  for (const w of workspaceDirs(c.parent)) {
    mkdirSync(join(dir, w), { recursive: true })
    writeFileSync(join(dir, w, 'package.json'), git(['show', `${c.parent}:${w}/package.json`]))
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const r = spawnSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, shell: process.platform === 'win32', encoding: 'utf8', timeout: 1_800_000 })
  if (r.status !== 0) throw new Error(`npm ci for ${c.lock}: ${String(r.stderr).slice(-600)}`)
  return dir
}

/**
 * The lockfile's dependencies linked into a workspace: every package to the installed copy, except the
 * workspace's own packages, which point at the workspace's own directories (npm links them to its stubs).
 */
export function linkDeps(ws: string, depsDir: string, workspaces: string[]): void {
  const nm = join(depsDir, 'node_modules')
  const own = (p: string): string | undefined => {
    if (!lstatSync(p).isSymbolicLink()) return undefined
    const target = resolve(join(p, '..'), readlinkSync(p))
    const rel = relative(depsDir, target)
    return rel.startsWith('..') ? undefined : rel
  }
  const link = (from: string, to: string) => symlinkSync(from, to, 'junction')
  mkdirSync(join(ws, 'node_modules'), { recursive: true })
  for (const e of readdirSync(nm)) {
    const p = join(nm, e)
    if (e.startsWith('@') && lstatSync(p).isDirectory() && !lstatSync(p).isSymbolicLink()) {
      mkdirSync(join(ws, 'node_modules', e), { recursive: true })
      for (const s of readdirSync(p)) {
        const rel = own(join(p, s))
        link(rel ? join(ws, rel) : join(p, s), join(ws, 'node_modules', e, s))
      }
    } else {
      const rel = own(p)
      link(rel ? join(ws, rel) : p, join(ws, 'node_modules', e))
    }
  }
  // what npm installed under a workspace (a version the root could not hold)
  for (const w of workspaces) {
    const inner = join(depsDir, w, 'node_modules')
    if (existsSync(inner) && existsSync(join(ws, w)) && !existsSync(join(ws, w, 'node_modules'))) link(inner, join(ws, w, 'node_modules'))
  }
}

/** A commit's changes to some paths, applied to a workspace (only the paths a workspace holds). */
function apply(ws: string, c: Candidate, paths: string[]): void {
  const kept = paths.filter((p) => KEEP.some((k) => p === k || p.startsWith(`${k}/`)) && !/^games\/[^/]+\/public\//.test(p))
  if (!kept.length) return
  const diff = git(['diff', '--binary', c.parent, c.sha, '--', ...kept])
  if (diff.trim()) git(['apply', '--whitespace=nowarn', '-'], { cwd: ws, input: diff })
}

// ------------------------------------------------------------------ the runs and the verdict

export type Statuses = Record<string, string>

/** vitest's JSON report as test → status, the test named by its file and its full name. */
export function statuses(report: { testResults?: { name: string; assertionResults?: { fullName: string; status: string }[] }[] } | undefined, ws: string): Statuses {
  const out: Statuses = {}
  for (const f of report?.testResults ?? []) {
    const file = relative(ws, f.name).split(sep).join('/')
    for (const a of f.assertionResults ?? []) out[`${file}::${a.fullName}`] = a.status
  }
  return out
}

/** One run of the test files: their statuses, or undefined when it took longer than RUN_TIMEOUT. */
function runTests(ws: string, files: string[]): Statuses | undefined {
  const out = join(ws, '.ladder-report.json')
  rmSync(out, { force: true })
  const r = spawnSync(process.execPath, [join(ws, 'node_modules', 'vitest', 'vitest.mjs'), 'run', ...files, '--reporter=json', `--outputFile=${out}`], { cwd: ws, timeout: RUN_TIMEOUT, encoding: 'utf8', env: { ...process.env, CI: '1', NO_COLOR: '1' } })
  if (r.error || r.signal) return undefined
  if (!existsSync(out)) return {}
  try {
    return statuses(JSON.parse(readFileSync(out, 'utf8')), ws)
  } catch {
    return {}
  }
}

/** FAIL_TO_PASS, PASS_TO_PASS and the regressions over the runs before and after (the fresh pool's rule). */
export function classify(before: Statuses[], after: Statuses[]): { f2p: string[]; p2p: string[]; regressions: string[] } {
  const passes = (runs: Statuses[], t: string) => runs.map((r) => r[t] === 'passed')
  const tests = [...new Set([...before, ...after].flatMap((r) => Object.keys(r)))].sort()
  return {
    f2p: tests.filter((t) => !passes(before, t).some(Boolean) && passes(after, t).every(Boolean)),
    p2p: tests.filter((t) => passes(before, t).every(Boolean) && passes(after, t).every(Boolean)),
    regressions: tests.filter((t) => passes(before, t).every(Boolean) && !passes(after, t).every(Boolean)),
  }
}

export interface Validated extends Candidate {
  ok: boolean
  why?: string
  FAIL_TO_PASS: string[]
  PASS_TO_PASS: string[]
  secs: number
}

export function validate(c: Candidate): Validated {
  const t0 = Date.now()
  const ws = mkdtempSync(join(tmpdir(), 'lsw-ladder-'))
  try {
    workspace(c.parent, ws)
    linkDeps(ws, deps(c), workspaceDirs(c.parent))
    apply(ws, c, c.tests)
    const files = c.tests.filter((f) => existsSync(join(ws, f)))
    const runs = (): Statuses[] | undefined => {
      const out: Statuses[] = []
      for (let k = 0; k < RUNS; k++) {
        const r = runTests(ws, files)
        if (!r) return undefined // the first run past the limit ends the task
        out.push(r)
      }
      return out
    }
    const before = runs()
    if (!before) return { ...c, ok: false, why: 'slow', FAIL_TO_PASS: [], PASS_TO_PASS: [], secs: Math.round((Date.now() - t0) / 1000) }
    apply(ws, c, c.code)
    const after = runs()
    if (!after) return { ...c, ok: false, why: 'slow', FAIL_TO_PASS: [], PASS_TO_PASS: [], secs: Math.round((Date.now() - t0) / 1000) }
    const { f2p, p2p, regressions } = classify(before, after)
    const why = !Object.keys(after[0]).length ? 'tests-do-not-run' : !f2p.length ? 'no-fail-to-pass' : regressions.length ? 'regression' : undefined
    return { ...c, ok: !why, ...(why ? { why } : {}), FAIL_TO_PASS: f2p, PASS_TO_PASS: p2p, secs: Math.round((Date.now() - t0) / 1000) }
  } catch (err) {
    return { ...c, ok: false, why: `error: ${(err as Error).message.slice(0, 300)}`, FAIL_TO_PASS: [], PASS_TO_PASS: [], secs: Math.round((Date.now() - t0) / 1000) }
  } finally {
    rmSync(ws, { recursive: true, force: true })
  }
}

// ------------------------------------------------------------------ the tasks

/** Where the ladder's tasks are kept: an issue, the task's facts, its hidden test changes (never in a workspace). */
export const HISTORY = join(REPO, 'games/openworld/ai/tasks/history')

export interface HistoryDef extends Validated {
  id: string
  statement: string
  hidden: string
}

export function historyDefs(): HistoryDef[] {
  if (!existsSync(HISTORY)) return []
  return readdirSync(HISTORY)
    .filter((id) => existsSync(join(HISTORY, id, 'ISSUE.md')))
    .map((id) => ({ ...(JSON.parse(readFileSync(join(HISTORY, id, 'meta.json'), 'utf8')) as Validated), id, statement: readFileSync(join(HISTORY, id, 'ISSUE.md'), 'utf8'), hidden: join(HISTORY, id, 'hidden.patch') }))
}

/** A validated commit as a task: its issue, its facts, its test changes as the hidden patch. */
export function writeTask(v: Validated, issue: string, writer?: string): string {
  const id = v.sha.slice(0, 10)
  const dir = join(HISTORY, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'ISSUE.md'), issue.trim() + '\n')
  writeFileSync(join(dir, 'hidden.patch'), git(['diff', '--binary', v.parent, v.sha, '--', ...v.tests]))
  const { sha, parent, date, rung, lock, tests, code, lines, areas, FAIL_TO_PASS, PASS_TO_PASS } = v
  // the issue's writer is kept: the pool's issues are one writer's, and a task written by another is redone (issues --rewrite)
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ sha, parent, date, rung, lock, tests, code, lines, areas, FAIL_TO_PASS, PASS_TO_PASS, writer }, null, 1) + '\n')
  return dir
}

/** n consecutive non-empty added lines of the gold diff appear in the text: the issue gives the fix away. */
export function leaks(gold: string, text: string, n = 6): boolean {
  const added = gold.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim()).filter(Boolean)
  const body = text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
  for (let i = 0; i + n <= added.length; i++) if (body.includes(added.slice(i, i + n).join('\n'))) return true
  return false
}

export const ISSUE_SYSTEM = `You write the issue a software engineer is given before a change is made to a repository: a rule-based game engine and its content, in TypeScript, tested with vitest. You are shown the change that was in fact made, its commit message and its pull request, so that the issue asks for exactly that — but the engineer must not be handed the change.

Write the issue in Markdown, in English:
# <a title>
## What is wrong (for a fix) or What is wanted (for a feature)
## Expected behaviour — concrete: inputs, outcomes, the cases that matter
## Requirements — the conditions a correct change meets, as a list
## Interface — every new name the tests will use (functions, types, fields, options, files), with its signature and where it lives; "None" when the change adds no name

Do not quote or paraphrase the change's code beyond names and signatures. Do not name the tests or say how they are written. Do not say how to implement it unless the requirement itself is about the implementation. Reply with the issue only.`

interface IssueModel {
  readonly name: string
  chat(m: { role: 'system' | 'user'; content: string }[], o?: { reasoning?: 'low' | 'medium' | 'high'; purpose?: string }): Promise<{ content: string }>
}

/** The issue for a validated commit, by a model shown the change; kept only if it does not give the change away. */
export async function writeIssue(v: Validated, model: IssueModel): Promise<string | undefined> {
  const message = git(['log', '-1', '--format=%B', v.sha])
  const r = spawnSync('gh', ['api', `repos/{owner}/{repo}/commits/${v.sha}/pulls`, '--jq', '.[0].body // ""'], { cwd: REPO, encoding: 'utf8' })
  const pr = r.status === 0 ? r.stdout.trim() : ''
  const gold = git(['diff', v.parent, v.sha, '--', ...v.code])
  const tests = git(['diff', v.parent, v.sha, '--', ...v.tests])
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}\n… (cut)` : t)
  const user = [
    `# The commit\n${message.trim()}`,
    pr ? `# Its pull request\n${clip(pr, 6000)}` : '',
    `# The change (not to be given away)\n\`\`\`diff\n${clip(gold, 40_000)}\n\`\`\``,
    `# The tests that will judge it (only for the Interface section)\n\`\`\`diff\n${clip(tests, 20_000)}\n\`\`\``,
  ]
    .filter(Boolean)
    .join('\n\n')
  let again = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await model.chat([{ role: 'system', content: ISSUE_SYSTEM }, { role: 'user', content: user + again }], { reasoning: 'medium', purpose: 'ladder-issue' })
    const issue = reply.content.trim()
    // the hidden tests stay hidden: an issue that names one of their files is asked again, then dropped
    const named = v.tests.filter((t) => issue.includes(t) || issue.includes(t.split('/').pop()!))
    if (issue && !leaks(gold, issue) && !named.length) return issue
    again = named.length ? `\n\nYour last issue named the test files (${named.join(', ')}). Write it again without naming any test.` : "\n\nYour last issue quoted the change's code. Write it again with names and signatures only."
  }
  return undefined
}

/** The vitest command a ladder workspace runs a commit's test files with. */
const vitestCmd = (files: string[], report?: string) => `node node_modules/vitest/vitest.mjs run ${files.join(' ')}${report ? ` --reporter=json --outputFile=${report}` : ''}`

/**
 * A ladder task as the agent works it: the parent's workspace with its dependencies, the tests the agent may run
 * (the commit's test files as they were), and the verdict: the hidden test changes applied, every
 * FAIL_TO_PASS and PASS_TO_PASS test passing. Unattended, it runs only in a container (the engine tasks' rule).
 */
export async function historyTask(def: HistoryDef, o: { isolation?: Isolation; localRun?: boolean } = {}): Promise<{ task: AgentTask; dispose: () => Promise<void> } | undefined> {
  const iso = o.isolation ?? (await chooseIsolation())
  if (iso === 'none' && !o.localRun) return undefined
  const ws = mkdtempSync(join(tmpdir(), 'lsw-history-'))
  const depsDir = deps(def)
  workspace(def.parent, ws)
  linkDeps(ws, depsDir, workspaceDirs(def.parent))
  const visible = def.tests.filter((f) => existsSync(join(ws, f)))
  let env: Env
  try {
    env =
      iso === 'docker'
        ? await DockerEnv.start({ image: await sandboxImage(), root: ws, mount: ws, mounts: [{ host: depsDir, container: depsDir }], user: hostUser(), limits: SANDBOX_LIMITS })
        : new LocalEnv(ws)
  } catch (err) {
    rmSync(ws, { recursive: true, force: true })
    throw err
  }
  const dispose = async () => {
    await env.dispose?.()
    rmSync(ws, { recursive: true, force: true })
  }
  return {
    dispose,
    task: {
      id: def.id,
      kind: 'history',
      statement: def.statement,
      env,
      localRun: iso === 'none' && o.localRun,
      tests: visible.length ? { command: vitestCmd(visible), timeoutMs: RUN_TIMEOUT } : undefined,
      request: { id: def.id },
      notes: 'This repository is a rule-based game world: the engine (packages/engine), its modules and libraries (packages/*) and a game (games/*). The tests are vitest.',
      verdict: async (env) => {
        writeFileSync(join(ws, '.ladder-hidden.patch'), readFileSync(def.hidden))
        const r0 = await env.exec('git apply --whitespace=nowarn .ladder-hidden.patch', { timeoutMs: 60_000 })
        if (r0.code !== 0) return { ok: false, output: `the hidden tests do not apply over this change:\n${r0.stderr.slice(-1500)}` }
        const report = '.ladder-verdict.json'
        await env.exec(vitestCmd(def.tests, report), { timeoutMs: RUN_TIMEOUT })
        let got: Statuses = {}
        try {
          got = statuses(JSON.parse(readFileSync(join(ws, report), 'utf8')), ws)
        } catch {
          return { ok: false, output: 'the tests did not run' }
        }
        const failing = [...def.FAIL_TO_PASS, ...def.PASS_TO_PASS].filter((t) => got[t] !== 'passed')
        return { ok: !failing.length, output: failing.length ? `not passing:\n${failing.slice(0, 20).join('\n')}` : 'every hidden test passes' }
      },
    },
  }
}

/** The ladder's tasks for the outer loop's replays (unattended: only where they can run in a container). */
export function historySource(): TaskSource {
  return {
    kinds: ['history'],
    replay: async (ep) => {
      const def = historyDefs().find((d) => d.id === (ep.request as { id?: string })?.id)
      if (!def) return undefined
      const t = await historyTask(def)
      if (!t) return undefined
      return { ...t.task, dispose: t.dispose }
    },
    cleanup: async (task: AgentTask) => task.dispose?.(),
  }
}

// ------------------------------------------------------------------ the command line

const readJsonl = <T>(f: string): T[] => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : [])

/** results.jsonl or validated.jsonl and their shards' (validate --shard i/n), each commit once. */
export function shards(name: 'results' | 'validated'): Validated[] {
  const own = (f: string) => f === `${name}.jsonl` || (f.startsWith(`${name}.`) && /\.\d+of\d+\.jsonl$/.test(f))
  const seen = new Map<string, Validated>()
  for (const f of (existsSync(DATA) ? readdirSync(DATA) : []).filter(own).sort()) for (const v of readJsonl<Validated>(join(DATA, f))) if (!seen.has(v.sha)) seen.set(v.sha, v)
  return [...seen.values()]
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined)
  mkdirSync(DATA, { recursive: true })
  const cmd = argv[0]
  if (cmd === 'candidates') {
    const cs = candidates(flag('ref') ?? 'origin/main')
    writeFileSync(join(DATA, 'candidates.jsonl'), cs.map((c) => JSON.stringify(c)).join('\n') + '\n')
    const by = (k: (c: Candidate) => string) => Object.fromEntries([...cs.reduce((m, c) => m.set(k(c), (m.get(k(c)) ?? 0) + 1), new Map<string, number>())].sort())
    console.log(`${cs.length} candidates → ${join(DATA, 'candidates.jsonl')}`, by((c) => c.rung), `${new Set(cs.map((c) => c.lock)).size} lockfiles`)
    return
  }
  if (cmd === 'validate') {
    // --shard i/n: this process takes every n-th candidate from the i-th, and writes files of its own
    const [si, sn] = (flag('shard') ?? '0/1').split('/').map(Number)
    const suffix = sn > 1 ? `.${si}of${sn}` : ''
    const cs = readJsonl<Candidate>(join(DATA, 'candidates.jsonl'))
    const done = new Set(shards('results').map((r) => r.sha))
    const only = flag('sha')?.split(',')
    let todo = cs.filter((c, k) => k % sn === si && !done.has(c.sha) && (!only || only.some((s) => c.sha.startsWith(s))))
    if (flag('limit')) todo = todo.slice(0, Number(flag('limit')))
    console.log(`${done.size} validated before, ${todo.length} to go`)
    for (const [i, c] of todo.entries()) {
      const v = validate(c)
      appendFileSync(join(DATA, `results${suffix}.jsonl`), JSON.stringify(v) + '\n')
      if (v.ok) appendFileSync(join(DATA, `validated${suffix}.jsonl`), JSON.stringify(v) + '\n')
      console.log(`[${i + 1}/${todo.length}] ${c.sha.slice(0, 7)} ${c.rung} ${v.ok ? `${v.FAIL_TO_PASS.length} fail-to-pass, ${v.PASS_TO_PASS.length} pass-to-pass` : v.why} (${v.secs} s) ${c.subject.slice(0, 60)}`)
    }
    return
  }
  if (cmd === 'issues') {
    if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))
    const model = modelFromEnv()
    if (!model) throw new Error('no model (LSW_MODEL_BACKEND=claude-code, or LSW_MODEL_KEY + LSW_MODEL)')
    const rewrite = argv.includes('--rewrite')
    const have = new Set(historyDefs().filter((d) => !rewrite || (d as HistoryDef & { writer?: string }).writer === model.name).map((d) => d.sha))
    let todo = shards('validated').filter((v) => !have.has(v.sha))
    if (flag('limit')) todo = todo.slice(0, Number(flag('limit')))
    console.log(`${have.size} tasks written before, ${todo.length} to go, with ${model.name}`)
    await (async () => {
      for (const [i, v] of todo.entries()) {
        const issue = await writeIssue(v, model as unknown as IssueModel)
        console.log(`[${i + 1}/${todo.length}] ${v.sha.slice(0, 7)} ${v.rung}: ${issue ? writeTask(v, issue, model.name) : 'no issue that keeps the change to itself: skipped'}`)
      }
    })()
    return
  }
  if (cmd === 'review') {
    // a person reads 20 issues at random before the first run (§5.3, 5): enough to know what was asked, nothing given away?
    const defs = historyDefs()
    let seed = Number(flag('seed') ?? 1)
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const sample = [...defs].sort(() => rnd() - 0.5).slice(0, Number(flag('n') ?? 20))
    const md = ['# The ladder: issues to read', '', 'For each: does the issue say what a correct change must do, and does it keep the change (and the tests) to itself? Note any that fail in review.csv (id, ok, note).', '']
    for (const d of sample) md.push(`## ${d.id} · ${d.rung} · ${d.date.slice(0, 10)}`, '', `The commit: \`${git(['log', '-1', '--format=%s', d.sha])}\` (${d.lines} lines in ${d.code.length} files)`, '', d.statement.trim(), '')
    writeFileSync(join(DATA, 'review.md'), md.join('\n'))
    writeFileSync(join(DATA, 'review.csv'), 'id,ok,note\n' + sample.map((d) => `${d.id},,`).join('\n') + '\n')
    console.log(`${sample.length} issues to read: ${join(DATA, 'review.md')}, verdicts in ${join(DATA, 'review.csv')}`)
    return
  }
  if (cmd === 'status') {
    const rs = shards('results')
    const tally = (xs: Validated[], k: (v: Validated) => string) => Object.fromEntries([...xs.reduce((m, v) => m.set(k(v), (m.get(k(v)) ?? 0) + 1), new Map<string, number>())].sort())
    console.log(JSON.stringify({ results: rs.length, validated: tally(rs.filter((r) => r.ok), (r) => r.rung), dropped: tally(rs.filter((r) => !r.ok), (r) => (r.why ?? '').replace(/:.*/, '')) }, null, 1))
    return
  }
  throw new Error('npm run ladder -- candidates | validate [--limit n] [--sha a,b] | issues [--limit n] | review [--n 20] | status')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
