// The agent's tools: the ordinary ones of a software engineer in a repository. File tools work
// on the host under the workspace root (paths cannot leave it); commands go through the Env.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Env } from './env.ts'
import { sh } from './env.ts'
import type { ToolSpec } from '../models/model.ts'

export interface AgentTool extends ToolSpec {
  run(args: Record<string, unknown>): Promise<string> | string
}

export interface ToolHooks {
  /**
   * Allow `run` although commands are not isolated (the env is local): only for a task a person
   * started by hand on their own machine. Unattended work gets `run` only in a container.
   */
  localRun?: boolean
  testCommand?: string
  testTimeoutMs?: number
  /** called by run_tests with each result (the loop records them as attempts) */
  onTests?: (ok: boolean, output: string) => void
  onSkillRead?: (name: string) => void
  /** called by submit; a string return blocks the submission with that message */
  onSubmit?: (summary: string) => Promise<string | undefined>
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', '__pycache__', 'dist', '.tox', '.mypy_cache'])
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : v === undefined || v === null ? d : String(v))

export function inside(root: string, p: string): string {
  const abs = resolve(root, p || '.')
  if (outside(relative(resolve(root), abs))) throw new Error(`path outside the workspace: ${p}`)
  return abs
}

/** A relative path that leaves its root: up a level, or onto another drive (a name like `..config` stays). */
const outside = (rel: string): boolean => rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)

/**
 * A path to write: inside the workspace by its name AND by where it really is — a symlink in the
 * workspace (node_modules linked to the host's) must not carry a write out of it.
 */
export function insideForWrite(root: string, p: string): string {
  const abs = inside(root, p)
  let probe = abs
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe)
  const real = realpathSync(probe)
  if (outside(relative(realpathSync(root), real))) throw new Error(`path outside the workspace (through a link): ${p}`)
  return abs
}

function listDir(root: string, start: string, depth: number, limit = 400): string {
  const out: string[] = []
  const walk = (dir: string, d: number) => {
    if (out.length >= limit) return
    let entries: string[]
    try {
      entries = readdirSync(dir).sort()
    } catch {
      return
    }
    for (const name of entries) {
      if (out.length >= limit) return
      const abs = join(dir, name)
      const isDir = statSync(abs, { throwIfNoEntry: false })?.isDirectory()
      const rel = relative(root, abs).split(sep).join('/')
      out.push(isDir ? `${rel}/` : rel)
      if (isDir && d > 1 && !SKIP_DIRS.has(name)) walk(abs, d - 1)
    }
  }
  walk(start, depth)
  return out.length ? out.join('\n') + (out.length >= limit ? '\n… (more: list a subdirectory)' : '') : '(empty)'
}

/** Plain JS search when ripgrep is not there. */
export function jsSearch(root: string, start: string, pattern: string, limit = 80): string {
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }
  const out: string[] = []
  // one file, named or found by the walk: the same size cap, the path with / on every system
  const scan = (abs: string, size: number) => {
    if (size >= 1_000_000) return
    const lines = readFileSync(abs, 'utf8').split('\n')
    lines.forEach((l, i) => out.length < limit && re.test(l) && out.push(`${relative(root, abs).split(sep).join('/')}:${i + 1}:${l.slice(0, 300)}`))
  }
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (out.length >= limit || SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      const st = statSync(abs, { throwIfNoEntry: false })
      if (!st) continue
      if (st.isDirectory()) walk(abs)
      else scan(abs, st.size)
    }
  }
  const st = statSync(start, { throwIfNoEntry: false })
  if (st?.isFile()) scan(start, st.size)
  else if (st) walk(start)
  return out.length ? out.join('\n') : '(no match)'
}

export function agentTools(env: Env, hooks: ToolHooks = {}): AgentTool[] {
  const root = env.root
  const tools: AgentTool[] = [
    {
      name: 'list_dir',
      description: 'List files and directories (recursively, to a depth). Directories end with "/".',
      parameters: { type: 'object', properties: { path: { type: 'string' }, depth: { type: 'number' } } },
      run: (a) => listDir(root, inside(root, str(a.path, '.')), Math.min(4, Math.max(1, Number(a.depth) || 2))),
    },
    {
      name: 'read_file',
      description: 'Read a file with line numbers. Use start/end (1-based, inclusive) for long files.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['path'] },
      run: (a) => {
        const p = inside(root, str(a.path))
        if (!existsSync(p)) return `(no file ${str(a.path)})`
        const lines = readFileSync(p, 'utf8').split('\n')
        const s = Math.max(1, Number(a.start) || 1)
        const e = Math.min(lines.length, Number(a.end) || s + 399)
        return lines.slice(s - 1, e).map((l, i) => `${String(s + i).padStart(5)}  ${l}`).join('\n') + (e < lines.length ? `\n… (${lines.length} lines; read on with start=${e + 1})` : '')
      },
    },
    {
      name: 'search',
      description: 'Search file contents with a regular expression (ripgrep). Optional path and glob (e.g. "*.py").',
      parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string' } }, required: ['pattern'] },
      run: async (a) => {
        const pattern = str(a.pattern)
        const path = str(a.path, '.')
        inside(root, path)
        const glob = str(a.glob)
        const r = await env.exec(`rg -n --no-heading --max-columns 300 -m 20 ${glob ? `-g ${sh(glob)} ` : ''}-e ${sh(pattern)} ${sh(path)} | head -n 120`, { timeoutMs: 30_000 })
        if (r.code === 127 || /rg: (command )?not found|not recognized/.test(r.stderr)) return jsSearch(root, inside(root, path), pattern)
        return r.stdout.trim() || (r.stderr.trim() ? `(error) ${r.stderr.trim()}` : '(no match)')
      },
    },
    {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      run: (a) => {
        const p = insideForWrite(root, str(a.path))
        mkdirSync(dirname(p), { recursive: true })
        writeFileSync(p, str(a.content))
        return `wrote ${str(a.path)} (${str(a.content).split('\n').length} lines)`
      },
    },
    {
      name: 'edit_file',
      description: 'Replace an exact string in a file. old_string must occur exactly once (or set replace_all). Read the file first.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'] },
      run: (a) => {
        const p = insideForWrite(root, str(a.path))
        if (!existsSync(p)) return `(no file ${str(a.path)})`
        const s = readFileSync(p, 'utf8')
        const from = str(a.old_string)
        const n = from ? s.split(from).length - 1 : 0
        if (!n) return 'old_string not found (it must match exactly, whitespace included)'
        if (n > 1 && !a.replace_all) return `old_string occurs ${n} times: add context to make it unique, or set replace_all`
        writeFileSync(p, a.replace_all ? s.split(from).join(str(a.new_string)) : s.replace(from, () => str(a.new_string)))
        return `edited ${str(a.path)} (${a.replace_all ? n : 1} replacement${n > 1 && a.replace_all ? 's' : ''})`
      },
    },
    {
      name: 'run',
      description: 'Run a shell command in the workspace (bash). Returns exit code, stdout and stderr.',
      parameters: { type: 'object', properties: { command: { type: 'string' }, timeout_sec: { type: 'number' } }, required: ['command'] },
      run: async (a) => {
        const r = await env.exec(str(a.command), { timeoutMs: Math.min(600, Number(a.timeout_sec) || 120) * 1000 })
        return `exit ${r.code}${r.timedOut ? ' (timed out)' : ''}\n${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}`
      },
    },
  ]
  // a shell that is not in a container reaches the whole machine: no `run` there, unless a person asked for it
  if (!env.isolated && !hooks.localRun) tools.splice(tools.findIndex((t) => t.name === 'run'), 1)
  if (hooks.testCommand)
    tools.push({
      name: 'run_tests',
      description: `Run the task's tests (${hooks.testCommand}). Exit 0 means they pass.`,
      parameters: { type: 'object', properties: {} },
      run: async () => {
        const r = await env.exec(hooks.testCommand!, { timeoutMs: hooks.testTimeoutMs ?? 300_000 })
        const out = `${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}`
        hooks.onTests?.(r.code === 0, out)
        return `exit ${r.code}${r.timedOut ? ' (timed out)' : ''}\n${out}`
      },
    })
  tools.push(
    {
      name: 'read_skill',
      description: 'Read one of your skills (listed in the task) in full; its scripts are in .agent/skills/<name>/.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      run: (a) => {
        const p = inside(root, `.agent/skills/${str(a.name)}/SKILL.md`)
        if (!existsSync(p)) return `(no skill "${str(a.name)}")`
        hooks.onSkillRead?.(str(a.name))
        const files = readdirSync(dirname(p)).filter((f) => f !== 'SKILL.md')
        return readFileSync(p, 'utf8') + (files.length ? `\n\nScripts: ${files.map((f) => `.agent/skills/${str(a.name)}/${f}`).join(', ')}` : '')
      },
    },
    {
      name: 'submit',
      description: 'Finish the task. Give a one-line summary of the change.',
      parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
      run: async (a) => (await hooks.onSubmit?.(str(a.summary))) ?? 'submitted',
    },
  )
  return tools
}
