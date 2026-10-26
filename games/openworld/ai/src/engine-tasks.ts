// Engine tasks: the world's own code as SWE tasks. Some interactions cannot be answered with a
// rule — they need a new primitive, condition or expectation in the engine — and those are
// ordinary software engineering: an issue, a repository, tests. Each task in tasks/engine/<id>/
// has an ISSUE.md and a hidden test (fail-to-pass, as in SWE-bench) that decides it.
//
// The workspace is a copy of the engine and content packages as a git repository of its own, with
// the dependencies linked in, so the agent's change is a diff and the tests run as they do here.
//
//   npm run engine-task -- <id> --state <dir> [--preset naive|tuned]

import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO, SelfState, applyPreset, commitBase, modelFromEnv, runAgent, sandboxEnv, flags, taskIsolation } from '@openworld/ai'
import type { AgentTask, Env, Isolation, Preset, TaskSource } from '@openworld/ai'

const TASKS = join(REPO, 'games/openworld/ai/tasks/engine')
/** what the workspace copies, at the same paths as here, and the names they are imported by */
const PACKAGES = [
  { dir: 'packages/engine', name: '@openworld/engine' },
  { dir: 'packages/modules', name: '@openworld/modules' },
  // the standard library and the format: the content's tests check its rules with the compiler's own checks
  { dir: 'packages/stdlib', name: '@openworld/stdlib' },
  { dir: 'packages/format', name: '@openworld/format' },
  { dir: 'games/openworld/content', name: '@openworld-game/content' },
]
const SCOPES = new Set(PACKAGES.map((p) => p.name.split('/')[0]))
const HIDDEN = 'games/openworld/content/test/hidden.test.ts'

/** A task in a workspace of its own, which `dispose` removes. */
export interface WorkspaceTask {
  task: AgentTask
  dispose: () => Promise<void>
}

export interface EngineTaskDef {
  id: string
  statement: string
  hidden: string
}

export function engineTaskDefs(): EngineTaskDef[] {
  if (!existsSync(TASKS)) return []
  return readdirSync(TASKS)
    .filter((id) => existsSync(join(TASKS, id, 'ISSUE.md')))
    .map((id) => ({ id, statement: readFileSync(join(TASKS, id, 'ISSUE.md'), 'utf8'), hidden: join(TASKS, id, 'hidden.test.ts') }))
}

export const walk = (dir: string, f: (p: string) => void): void => {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name)
    if (n.isDirectory()) walk(p, f)
    else f(p)
  }
}

/** LF everywhere: a Windows checkout has CRLF, and an agent writing whole files with LF would turn its diff into a rewrite. */
export const toLF = (dir: string): void =>
  walk(dir, (p) => {
    if (!/\.(ts|json|md|mjs|js)$/.test(p)) return
    const t = readFileSync(p, 'utf8')
    if (t.includes('\r\n')) writeFileSync(p, t.replace(/\r\n/g, '\n'))
  })

/**
 * A task's commands run in a container (the workspace, and `deps` at the same path, so the workspace's links
 * resolve; no network) or on this machine; `cleanup` when the container does not start.
 */
export async function taskEnv(iso: Isolation, ws: string, deps: string, cleanup: () => void): Promise<Env> {
  try {
    return await sandboxEnv(iso, ws, { mounts: [{ host: deps, container: deps }] })
  } catch (err) {
    cleanup()
    throw err
  }
}

/** Tasks for the outer loop's replays, by the recorded episode's id (unattended: only where they can run in a container). */
export function taskSource<D extends { id: string }>(kind: string, defs: () => D[], task: (def: D) => Promise<WorkspaceTask | undefined>): TaskSource {
  return {
    kinds: [kind],
    replay: async (ep) => {
      const def = defs().find((d) => d.id === (ep.request as { id?: string })?.id)
      if (!def) return undefined
      const t = await task(def)
      if (!t) return undefined // no container here: an unattended agent does not run its code on this machine
      return { ...t.task, dispose: t.dispose }
    },
    cleanup: async (task: AgentTask) => task.dispose?.(),
  }
}

/** The engine and content packages as a repository of their own. */
export function engineWorkspace(o: { prefix?: string } = {}): { dir: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), o.prefix ?? 'lsw-engine-'))
  for (const f of ['package.json', 'tsconfig.base.json', 'vitest.config.ts']) copyFileSync(join(REPO, f), join(dir, f))
  // the workspace list names only what is there
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lsw-engine-task', private: true, type: 'module', workspaces: PACKAGES.map((p) => p.dir), scripts: { test: 'vitest run' }, devDependencies: pkg.devDependencies }, null, 2))
  for (const p of PACKAGES) cpSync(join(REPO, p.dir), join(dir, p.dir), { recursive: true, filter: (s) => !s.includes('node_modules') })
  for (const top of new Set(PACKAGES.map((p) => p.dir.split('/')[0]))) toLF(join(dir, top))
  // dependencies: links into the real node_modules, except our own packages, which point at the copies
  for (const scope of SCOPES) mkdirSync(join(dir, 'node_modules', scope), { recursive: true })
  // (not the tools' caches: each workspace keeps its own, and a container sees the host's read-only)
  const CACHES = new Set(['.vite', '.vite-temp', '.cache'])
  for (const n of readdirSync(join(REPO, 'node_modules'))) if (!SCOPES.has(n) && !CACHES.has(n)) symlinkSync(join(REPO, 'node_modules', n), join(dir, 'node_modules', n), 'junction')
  for (const p of PACKAGES) symlinkSync(join(dir, p.dir), join(dir, 'node_modules', p.name), 'junction')
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n')
  commitBase(dir)
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

/**
 * An engine task runs the agent's own code (its change, and the tests over it), so unattended it
 * runs only in a container: the workspace and the host's node_modules (read-only, at the same
 * paths, so the workspace's links resolve), no network. `localRun`: a person started it by hand
 * and lets it run on this machine. Without either there is no task (undefined).
 */
export async function engineTask(def: EngineTaskDef, o: { isolation?: Isolation; localRun?: boolean } = {}): Promise<WorkspaceTask | undefined> {
  const iso = await taskIsolation(o)
  if (!iso) return undefined
  const ws = engineWorkspace()
  const tests = 'npx vitest run packages/engine games/openworld/content'
  const env = await taskEnv(iso, ws.dir, join(REPO, 'node_modules'), ws.dispose)
  return {
    dispose: async () => {
      await env.dispose?.()
      ws.dispose()
    },
    task: {
      id: def.id,
      kind: 'engine',
      statement: def.statement,
      env,
      localRun: iso === 'none' && o.localRun,
      tests: { command: tests, timeoutMs: 300_000 },
      request: { id: def.id },
      notes: 'This repository is the engine (packages/engine), its modules (packages/modules) and content (games/openworld/content) of a rule-based game world. The tests are vitest; content tests exercise the engine through the base rule library.',
      // fail-to-pass: the hidden test must pass, and so must everything that passed before
      verdict: async (env) => {
        const target = join(ws.dir, HIDDEN)
        copyFileSync(def.hidden, target)
        try {
          const r = await env.exec(tests, { timeoutMs: 300_000 })
          return { ok: r.code === 0, output: `${r.stdout}\n${r.stderr}`.slice(-3000) }
        } finally {
          rmSync(target, { force: true })
        }
      },
    },
  }
}

/** Engine tasks for the outer loop (unattended): only where they can run in a container. */
export const engineSource = (): TaskSource => taskSource('engine', engineTaskDefs, engineTask)

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = flags(argv)
  const id = argv[0]
  const def = engineTaskDefs().find((d) => d.id === id)
  if (!def) throw new Error(`tasks: ${engineTaskDefs().map((d) => d.id).join(', ')}`)
  const model = modelFromEnv()
  if (!model) throw new Error('no model (LSW_MODEL_KEY, LSW_MODEL)')
  const state = SelfState.open(resolve(flag('state') ?? join(REPO, 'var', 'agent-state')))
  if (flag('preset')) applyPreset(state, flag('preset') as Preset)
  // a person runs this by hand: on this machine if there is no container (they see the warning)
  const t = (await engineTask(def, { localRun: true }))!
  if (!t.task.env.isolated) console.log('warning: no container here — the commands and tests of the agent run on this machine')
  try {
    const r = await runAgent(t.task, { model, state, log: (l) => console.log(l) })
    console.log(r.diff)
    console.log(`${def.id}: ${r.outcome} · ${r.episode.usage.calls} steps · ${(r.episode.ms / 1000).toFixed(0)} s · $${(r.episode.usage.cost ?? 0).toFixed(3)}${r.verdict ? `\n${r.verdict.output.slice(-800)}` : ''}`)
  } finally {
    await t.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
