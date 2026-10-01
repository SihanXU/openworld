// Engine tasks: the world's own code as SWE tasks. Some interactions cannot be answered with a
// rule — they need a new primitive, condition or expectation in the engine — and those are
// ordinary software engineering: an issue, a repository, tests. Each task in tasks/engine/<id>/
// has an ISSUE.md and a hidden test (fail-to-pass, as in SWE-bench) that decides it.
//
// The workspace is a copy of the engine and content packages as a git repository of its own, with
// the dependencies linked in, so the agent's change is a diff and the tests run as they do here.
//
//   npm run engine-task -- <id> --state <dir> [--preset naive|tuned]

import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalEnv, SelfState, applyPreset, modelFromEnv, runAgent, type AgentTask, type Preset, type TaskSource } from '@lsw/agent'

export const REPO = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const TASKS = join(REPO, 'packages/tools/tasks/engine')
const PACKAGES = ['engine', 'content']
const HIDDEN = 'packages/content/test/hidden.test.ts'

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

/** The engine and content packages as a repository of their own. */
export function engineWorkspace(): { dir: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-engine-'))
  for (const f of ['package.json', 'tsconfig.base.json', 'vitest.config.ts']) copyFileSync(join(REPO, f), join(dir, f))
  // the workspace list names only what is there
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lsw-engine-task', private: true, type: 'module', workspaces: PACKAGES.map((p) => `packages/${p}`), scripts: { test: 'vitest run' }, devDependencies: pkg.devDependencies }, null, 2))
  for (const p of PACKAGES) cpSync(join(REPO, 'packages', p), join(dir, 'packages', p), { recursive: true, filter: (s) => !s.includes('node_modules') })
  // LF everywhere: a Windows checkout has CRLF, and an agent writing whole files with LF would turn its diff into a rewrite
  const lf = (d: string): void => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, n.name)
      if (n.isDirectory()) lf(p)
      else if (/\.(ts|json|md|mjs|js)$/.test(n.name)) writeFileSync(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'))
    }
  }
  lf(join(dir, 'packages'))
  // dependencies: links into the real node_modules, except our own packages, which point at the copies
  mkdirSync(join(dir, 'node_modules', '@lsw'), { recursive: true })
  for (const n of readdirSync(join(REPO, 'node_modules'))) if (n !== '@lsw') symlinkSync(join(REPO, 'node_modules', n), join(dir, 'node_modules', n), 'junction')
  for (const p of PACKAGES) symlinkSync(join(dir, 'packages', p), join(dir, 'node_modules', '@lsw', p), 'junction')
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n')
  execSync('git init -q && git config core.autocrlf false && git add -A && git -c user.email=lsw@local -c user.name=lsw commit -qm base', { cwd: dir })
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

export function engineTask(def: EngineTaskDef): { task: AgentTask; dispose: () => void } {
  const ws = engineWorkspace()
  const tests = 'npx vitest run packages/engine packages/content'
  return {
    dispose: ws.dispose,
    task: {
      id: def.id,
      kind: 'engine',
      statement: def.statement,
      env: new LocalEnv(ws.dir),
      tests: { command: tests, timeoutMs: 300_000 },
      request: { id: def.id },
      notes: 'This repository is the engine (packages/engine) and content (packages/content) of a rule-based game world. The tests are vitest; content tests exercise the engine through the base rule library.',
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

export function engineSource(): TaskSource {
  const open = new Map<AgentTask, () => void>()
  return {
    kinds: ['engine'],
    replay: async (ep) => {
      const def = engineTaskDefs().find((d) => d.id === (ep.request as { id?: string })?.id)
      if (!def) return undefined
      const t = engineTask(def)
      open.set(t.task, t.dispose)
      return t.task
    },
    cleanup: async (task) => {
      open.get(task)?.()
      open.delete(task)
    },
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined)
  if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))
  const id = argv[0]
  const def = engineTaskDefs().find((d) => d.id === id)
  if (!def) throw new Error(`tasks: ${engineTaskDefs().map((d) => d.id).join(', ')}`)
  const model = modelFromEnv()
  if (!model) throw new Error('no model (LSW_MODEL_KEY, LSW_MODEL)')
  const state = SelfState.open(resolve(flag('state') ?? join(REPO, 'var', 'agent-state')))
  if (flag('preset')) applyPreset(state, flag('preset') as Preset)
  const t = engineTask(def)
  try {
    const r = await runAgent(t.task, { model, state, log: (l) => console.log(l) })
    console.log(r.diff)
    console.log(`${def.id}: ${r.outcome} · ${r.episode.usage.calls} steps · ${(r.episode.ms / 1000).toFixed(0)} s · $${(r.episode.usage.cost ?? 0).toFixed(3)}${r.verdict ? `\n${r.verdict.output.slice(-800)}` : ''}`)
  } finally {
    t.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
