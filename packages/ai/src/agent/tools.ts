// The agent's tools: the ordinary ones of a software engineer in a repository. File tools work
// on the host under the workspace root (paths cannot leave it); commands go through the Env.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { sh, type Env, type ExecResult } from './env.ts'
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
const exited = (r: ExecResult) => `exit ${r.code}${r.timedOut ? ' (timed out)' : ''}`
const output = (r: ExecResult) => `${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}`
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')
function requiredText(a: Record<string, unknown>, key: string, empty = false): string {
  const value = a[key]
  if (typeof value !== 'string' || !empty && !value.trim()) throw new Error(`${key} must be ${empty ? 'a string (an empty string is allowed)' : 'a non-empty string'}`)
  return value
}

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
      description: 'Read a file. format=text gives code without line-number gutters; format=json gives text, source hash and line range. Text uses LF newlines. Default format=numbered. Use start/end (1-based, inclusive) for long files.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' }, format: { type: 'string', enum: ['numbered', 'text', 'json'] } }, required: ['path'] },
      run: (a) => {
        const path = requiredText(a, 'path'), p = inside(root, path)
        if (!existsSync(p)) return `(no file ${str(a.path)})`
        if (!statSync(p).isFile()) throw new Error(`path is not a file: ${path}`)
        const source = readFileSync(p, 'utf8'), lines = source.replace(/\r\n/g, '\n').split('\n')
        const s = Math.max(1, Number(a.start) || 1)
        const e = Math.min(lines.length, Number(a.end) || s + 399)
        const format = a.format ?? 'numbered'
        if (!['numbered', 'text', 'json'].includes(String(format))) throw new Error('format must be numbered, text or json')
        const text = lines.slice(s - 1, e).join('\n')
        if (format === 'text') return text
        if (format === 'json') return JSON.stringify({ path, start: s, end: e, totalLines: lines.length, sha256: sha256(source), lineEnding: /\r\n/.test(source) ? /(^|[^\r])\n/.test(source) ? 'mixed' : 'CRLF' : source.includes('\n') ? 'LF' : 'none', text })
        return lines.slice(s - 1, e).map((l, i) => `${String(s + i).padStart(5)}  ${l}`).join('\n') + (e < lines.length ? `\n… (${lines.length} lines; read on with start=${e + 1})` : '')
      },
    },
    {
      name: 'search',
      description: 'Search file contents with a regular expression (ripgrep). Optional path and glob (e.g. "*.py").',
      parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string' } }, required: ['pattern'] },
      run: async (a) => {
        const pattern = requiredText(a, 'pattern')
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
        const path = requiredText(a, 'path'), content = requiredText(a, 'content', true)
        const p = insideForWrite(root, path)
        if (existsSync(p) && !statSync(p).isFile()) throw new Error(`path is not a file: ${path}`)
        mkdirSync(dirname(p), { recursive: true })
        writeFileSync(p, content)
        return `wrote ${path} (${content.split('\n').length} lines)`
      },
    },
    {
      name: 'edit_file',
      description: 'Replace exact text after reading the file. LF/CRLF are equivalent in uniform-newline files; the source newline style is preserved. All other whitespace is exact. old_string must occur once (or set replace_all). Optional expected_sha256 rejects edits against stale reads.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' }, expected_sha256: { type: 'string' } }, required: ['path', 'old_string', 'new_string'] },
      run: (a) => {
        const path = requiredText(a, 'path'), old = requiredText(a, 'old_string', true), replacement = requiredText(a, 'new_string', true)
        if (!old.length) throw new Error('old_string must not be empty')
        if (a.replace_all !== undefined && typeof a.replace_all !== 'boolean') throw new Error('replace_all must be a boolean')
        if (a.expected_sha256 !== undefined && (typeof a.expected_sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(a.expected_sha256))) throw new Error('expected_sha256 must be a SHA-256 hex string')
        const p = insideForWrite(root, path)
        if (!existsSync(p)) return `(no file ${str(a.path)})`
        if (!statSync(p).isFile()) throw new Error(`path is not a file: ${path}`)
        const s = readFileSync(p, 'utf8')
        if (a.expected_sha256 && sha256(s) !== a.expected_sha256) return 'File changed since the supplied read hash; read it again before editing'
        const crlf = s.includes('\r\n'), mixed = crlf && /(^|[^\r])\n/.test(s), uniform = s.includes('\n') && !mixed
        const normalize = (value: string) => value.replace(/\r\n/g, '\n')
        const source = uniform ? normalize(s) : s, from = uniform ? normalize(old) : old, to = uniform ? normalize(replacement) : replacement
        const n = source.split(from).length - 1
        if (!n) return 'old_string not found (it must match exactly, whitespace included)'
        if (n > 1 && !a.replace_all) return `old_string occurs ${n} times: add context to make it unique, or set replace_all`
        const edited = a.replace_all ? source.split(from).join(to) : source.replace(from, () => to)
        writeFileSync(p, crlf && !mixed ? edited.replace(/\n/g, '\r\n') : edited)
        return `edited ${str(a.path)} (${a.replace_all ? n : 1} replacement${n > 1 && a.replace_all ? 's' : ''})`
      },
    },
    {
      name: 'run',
      description: 'Run a shell command in the workspace (bash). Returns exit code, stdout and stderr.',
      parameters: { type: 'object', properties: { command: { type: 'string' }, timeout_sec: { type: 'number' } }, required: ['command'] },
      run: async (a) => {
        const r = await env.exec(requiredText(a, 'command'), { timeoutMs: Math.min(600, Number(a.timeout_sec) || 120) * 1000 })
        return `${exited(r)}\n${output(r)}`
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
        const out = output(r)
        hooks.onTests?.(r.code === 0, out)
        return `${exited(r)}\n${out}`
      },
    })
  tools.push(
    {
      name: 'read_skill',
      description: 'Read one of your skills (listed in the task) in full; its scripts are in .agent/skills/<name>/.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      run: (a) => {
        const name = str(a.name)
        const p = inside(root, `.agent/skills/${name}/SKILL.md`)
        if (!existsSync(p)) return `(no skill "${name}")`
        hooks.onSkillRead?.(name)
        const files = readdirSync(dirname(p)).filter((f) => f !== 'SKILL.md')
        return readFileSync(p, 'utf8') + (files.length ? `\n\nScripts: ${files.map((f) => `.agent/skills/${name}/${f}`).join(', ')}` : '')
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
