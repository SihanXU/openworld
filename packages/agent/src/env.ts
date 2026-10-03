// Where a task's commands run. Files are always read and written on the host, under the
// workspace root; commands run either as local processes (our own world and engine tasks) or
// inside a container that has the workspace mounted (benchmark repositories: the isolation
// boundary). Neither ever sees the model key.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  /** commands cannot reach past the workspace (a container): only then may an agent run any command it likes */
  readonly isolated: boolean
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
  readonly isolated = false
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
  readonly isolated = true
  private constructor(
    readonly root: string,
    readonly cwd: string,
    private id: string,
    private docker: string,
  ) {}

  /**
   * `mounts`: more host paths the commands may see, read-only unless said (code the tests need —
   * never secrets). `user`: run as this uid:gid, so what the task writes stays the host user's.
   * `limits`: memory and process caps, so a runaway command cannot take the host down.
   */
  static async start(o: {
    image: string
    root: string
    mount?: string
    mounts?: { host: string; container: string; writable?: boolean }[]
    network?: boolean
    user?: string
    limits?: { memory?: string; cpus?: string; pids?: number }
    docker?: string
  }): Promise<DockerEnv> {
    const docker = o.docker ?? 'docker'
    const mount = o.mount ?? '/testbed'
    const extra = (o.mounts ?? []).flatMap((m) => ['-v', `${m.host}:${m.container}${m.writable ? '' : ':ro'}`])
    const limits = [
      ...(o.limits?.memory ? ['--memory', o.limits.memory] : []),
      ...(o.limits?.cpus ? ['--cpus', o.limits.cpus] : []),
      ...(o.limits?.pids ? ['--pids-limit', String(o.limits.pids)] : []),
    ]
    const args = ['run', '-d', '--rm', ...(o.network ? [] : ['--network', 'none']), ...(o.user ? ['--user', o.user] : []), ...limits, '-v', `${o.root}:${mount}`, ...extra, '-w', mount, o.image, 'sleep', 'infinity']
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

let dockerAnswer: Promise<boolean> | undefined
/** Is there a Docker daemon this user can reach? Asked once per process. */
export function dockerAvailable(docker = 'docker'): Promise<boolean> {
  dockerAnswer ??= run(docker, ['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15_000, env: process.env as Record<string, string> }).then((r) => r.code === 0 && !!r.stdout.trim())
  return dockerAnswer
}

/**
 * Where an unattended agent's commands run. `docker`: a container that sees only what the task
 * mounts, with no network — the agent may run any command there. `none`: this machine — the agent
 * gets no shell and its hooks do not run. Default: docker when a daemon answers;
 * LSW_ISOLATION=docker|none overrides.
 */
export type Isolation = 'docker' | 'none'

export async function chooseIsolation(): Promise<Isolation> {
  const v = process.env.LSW_ISOLATION
  if (v === 'docker' || v === 'none') return v
  return (await dockerAvailable()) ? 'docker' : 'none'
}

const SANDBOX_DIR = fileURLToPath(new URL('../sandbox', import.meta.url))
let imageAnswer: Promise<string> | undefined
/** The sandbox image (LSW_SANDBOX_IMAGE, default `lsw-sandbox`, built from packages/agent/sandbox when missing). */
export function sandboxImage(docker = 'docker'): Promise<string> {
  imageAnswer ??= (async () => {
    const name = process.env.LSW_SANDBOX_IMAGE ?? 'lsw-sandbox'
    const env = process.env as Record<string, string>
    if ((await run(docker, ['image', 'inspect', name], { timeoutMs: 30_000, env })).code === 0) return name
    if (name !== 'lsw-sandbox') throw new Error(`sandbox image ${name} not found`)
    const b = await run(docker, ['build', '-t', name, SANDBOX_DIR], { timeoutMs: 900_000, env })
    if (b.code !== 0) throw new Error(`could not build the sandbox image: ${b.stderr.slice(-800)}`)
    return name
  })()
  return imageAnswer
}

/** This process's uid:gid, so files a container writes into a mounted workspace stay the host user's. */
export const hostUser = (): string | undefined => (typeof process.getuid === 'function' && typeof process.getgid === 'function' ? `${process.getuid()}:${process.getgid()}` : undefined)

/** The caps every sandbox gets: a runaway command cannot take the host down. */
export const SANDBOX_LIMITS = { memory: '1g', cpus: '1', pids: 256 }

/** Quote a string for a POSIX shell. */
export function sh(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}
