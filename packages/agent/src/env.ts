// Where a task's commands run. Files are always read and written on the host, under the
// workspace root; commands run either as local processes (our own world and engine tasks) or
// inside a container that has the workspace mounted (benchmark repositories: the isolation
// boundary). Neither ever sees the model key.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
  ms: number
  timedOut: boolean
}

export interface ExecOptions {
  timeoutMs?: number
  input?: string
  env?: Record<string, string>
}

export interface Env {
  /** host path of the workspace: file tools work here */
  readonly root: string
  /** how the workspace is called where commands run (the same path locally, a mount in a container) */
  readonly cwd: string
  exec(cmd: string, o?: ExecOptions): Promise<ExecResult>
  dispose?(): Promise<void>
}

const OUTPUT_CAP = 400_000
const DEFAULT_TIMEOUT = 120_000

/** Variables a task process may see: enough to run tools, nothing secret. */
const PASS = /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|LANG|LC_ALL|TERM|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE|OS)$/i

export function taskEnvironment(extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && PASS.test(k)) out[k] = v
  return { ...out, CI: '1', NO_COLOR: '1', ...extra }
}

/** A POSIX shell: Git Bash on Windows (not WSL's bash.exe, which would run elsewhere), bash elsewhere. */
export function defaultShell(): string {
  if (process.platform !== 'win32') return 'bash'
  for (const p of ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe']) if (existsSync(p)) return p
  return 'bash'
}

function run(file: string, args: string[], o: ExecOptions & { cwd?: string; env?: Record<string, string> }): Promise<ExecResult> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const child = spawn(file, args, { cwd: o.cwd, env: o.env, windowsHide: true })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', (d: Buffer) => stdout.length < OUTPUT_CAP && (stdout += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => stderr.length < OUTPUT_CAP && (stderr += d.toString('utf8')))
    const timer = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      else child.kill('SIGKILL')
    }, o.timeoutMs ?? DEFAULT_TIMEOUT)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 127, stdout, stderr: stderr + String(err.message), ms: Date.now() - t0, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: timedOut ? 124 : (code ?? 1), stdout, stderr, ms: Date.now() - t0, timedOut })
    })
    if (o.input !== undefined) child.stdin.end(o.input)
    else child.stdin.end()
  })
}

/**
 * Commands as local processes in the workspace, with a scrubbed environment and a time limit.
 * Not an isolation boundary: for tasks whose code we wrote (world, engine). Untrusted repositories
 * go in a container (DockerEnv).
 */
export class LocalEnv implements Env {
  readonly cwd: string
  constructor(
    readonly root: string,
    private o: { shell?: string; env?: Record<string, string> } = {},
  ) {
    this.cwd = root
  }
  exec(cmd: string, o: ExecOptions = {}): Promise<ExecResult> {
    return run(this.o.shell ?? defaultShell(), ['-c', cmd], { ...o, cwd: this.root, env: taskEnvironment({ ...this.o.env, ...o.env }) })
  }
}

/**
 * Commands inside a container with the workspace bind-mounted (SWE-bench style images). No
 * network by default. Needs a docker CLI on the host.
 */
export class DockerEnv implements Env {
  private constructor(
    readonly root: string,
    readonly cwd: string,
    private id: string,
    private docker: string,
  ) {}

  static async start(o: { image: string; root: string; mount?: string; network?: boolean; docker?: string }): Promise<DockerEnv> {
    const docker = o.docker ?? 'docker'
    const mount = o.mount ?? '/testbed'
    const args = ['run', '-d', '--rm', ...(o.network ? [] : ['--network', 'none']), '-v', `${o.root}:${mount}`, '-w', mount, o.image, 'sleep', 'infinity']
    const r = await run(docker, args, { timeoutMs: 300_000, env: process.env as Record<string, string> })
    if (r.code !== 0) throw new Error(`docker run failed: ${r.stderr.trim() || r.stdout.trim()}`)
    return new DockerEnv(o.root, mount, r.stdout.trim(), docker)
  }

  exec(cmd: string, o: ExecOptions = {}): Promise<ExecResult> {
    const secs = Math.ceil((o.timeoutMs ?? DEFAULT_TIMEOUT) / 1000)
    const envArgs = Object.entries(o.env ?? {}).flatMap(([k, v]) => ['-e', `${k}=${v}`])
    return run(this.docker, ['exec', '-i', ...envArgs, '-w', this.cwd, this.id, 'timeout', String(secs), 'bash', '-lc', cmd], { ...o, timeoutMs: (secs + 15) * 1000, env: process.env as Record<string, string> })
  }

  async dispose(): Promise<void> {
    await run(this.docker, ['rm', '-f', this.id], { timeoutMs: 60_000, env: process.env as Record<string, string> })
  }
}

/** Quote a string for a POSIX shell. */
export function sh(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}
