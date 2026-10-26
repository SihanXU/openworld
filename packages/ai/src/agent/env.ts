// Where a task's commands run. Files are always read and written on the host, under the
// workspace root; commands run either as local processes (our own world and engine tasks) or
// inside a container that has the workspace mounted (benchmark repositories: the isolation
// boundary). Neither ever sees the model key.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
  /** the node that runs the agent's hooks where its commands run (default: `node` on the PATH) */
  readonly node?: string
  exec(cmd: string, o?: ExecOptions): Promise<ExecResult>
  /**
   * Stop everything still running where the commands ran (a container: frozen at once), so the workspace holds still
   * while the host reads it; `dispose` still works after. None where nothing can be left running.
   */
  halt?(): void
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

/** Process groups of commands still running, killed if this process exits first (a group outlives its leader). */
const groups = new Set<number>()
let reaper = false

/** Kill a command and everything it started: on POSIX its process group (a child holding its output would keep it open). */
function killTree(pid: number | undefined, fallback: () => void): void {
  if (process.platform === 'win32' && pid) return void spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  try {
    if (!pid) throw new Error('no pid')
    process.kill(-pid, 'SIGKILL')
  } catch {
    fallback()
  }
}

function run(file: string, args: string[], o: ExecOptions & { cwd?: string; env?: Record<string, string> }): Promise<ExecResult> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    // its own process group on POSIX, so the deadline reaches every process the command started
    const group = process.platform !== 'win32'
    const child = spawn(file, args, { cwd: o.cwd, env: o.env, windowsHide: true, detached: group })
    const pid = group ? child.pid : undefined
    if (pid) {
      groups.add(pid)
      if (!reaper) {
        reaper = true
        const reap = () => groups.forEach((g) => killTree(g, () => undefined))
        process.on('exit', reap)
        // a detached group no longer gets the terminal's Ctrl-C: pass it on, then end as the signal would
        for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
          process.once(sig, () => {
            reap()
            if (!process.listenerCount(sig)) process.kill(process.pid, sig)
          })
      }
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', (d: Buffer) => stdout.length < OUTPUT_CAP && (stdout += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => stderr.length < OUTPUT_CAP && (stderr += d.toString('utf8')))
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child.pid, () => child.kill('SIGKILL'))
    }, o.timeoutMs ?? DEFAULT_TIMEOUT)
    child.on('error', (err) => {
      clearTimeout(timer)
      if (pid) groups.delete(pid)
      resolve({ code: 127, stdout, stderr: stderr + String(err.message), ms: Date.now() - t0, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (pid) groups.delete(pid)
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

/** The docker CLI: an executable, or an executable and its first arguments (tests drive a stand-in). */
export type DockerCli = string | string[]

function docker(cli: DockerCli | undefined, args: string[], timeoutMs: number): Promise<ExecResult> {
  const [file, ...pre] = Array.isArray(cli) ? cli : [cli ?? 'docker']
  return run(file, [...pre, ...args], { timeoutMs, env: process.env as Record<string, string> })
}

/** Where a mounted node sits in a container: the agent's hooks run with it, its own commands never see it. */
export const HOOK_NODE = '/opt/lsw/bin/node'

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
    private cli: DockerCli | undefined,
    private init: string | undefined,
    readonly node: string | undefined,
    private owner: string | undefined,
    private mount: string,
  ) {}

  /**
   * `mounts`: more host paths the commands may see, read-only unless said (code the tests need —
   * never secrets). `user`: run as this uid:gid, so what the task writes stays the host user's.
   * `limits`: memory and process caps, so a runaway command cannot take the host down.
   * `node`: a node executable on the host, mounted read-only at HOOK_NODE for the agent's hooks
   * (benchmark images have none; it must be built for the container's system).
   * `init`: shell lines run before every command (the image's environment, e.g. a conda env).
   * `setup`: commands run once, as the container starts.
   * `owner`: uid:gid the workspace is given back to when the container goes (its commands ran as
   * the image's user, often root, and what they wrote must stay removable on the host).
   * `sub`: the repository's directory under the mount, when it is not the mount itself (some of
   * SWE-bench-Live's images): the workspace and the commands' directory are there.
   */
  static async start(o: {
    image: string
    root: string
    mount?: string
    mounts?: { host: string; container: string; writable?: boolean }[]
    network?: boolean
    user?: string
    limits?: { memory?: string; cpus?: string; pids?: number }
    node?: string
    init?: string
    setup?: string[]
    owner?: string
    sub?: string
    docker?: DockerCli
  }): Promise<DockerEnv> {
    const mount = o.mount ?? '/testbed'
    const extra = [...(o.mounts ?? []), ...(o.node ? [{ host: o.node, container: HOOK_NODE }] : [])].flatMap((m) => ['-v', `${m.host}:${m.container}${m.writable ? '' : ':ro'}`])
    const limits = [
      ...(o.limits?.memory ? ['--memory', o.limits.memory] : []),
      ...(o.limits?.cpus ? ['--cpus', o.limits.cpus] : []),
      ...(o.limits?.pids ? ['--pids-limit', String(o.limits.pids)] : []),
    ]
    const args = ['run', '-d', '--rm', ...(o.network ? [] : ['--network', 'none']), ...(o.user ? ['--user', o.user] : []), ...limits, '-v', `${o.root}:${mount}`, ...extra, '-w', mount, o.image, 'sleep', 'infinity']
    const r = await docker(o.docker, args, 300_000)
    if (r.code !== 0) throw new Error(`docker run failed: ${r.stderr.trim() || r.stdout.trim()}`)
    const sub = (o.sub ?? '').replace(/^\/+|\/+$/g, '')
    const env = new DockerEnv(sub ? join(o.root, sub) : o.root, sub ? `${mount}/${sub}` : mount, r.stdout.trim(), o.docker, o.init, o.node ? HOOK_NODE : undefined, o.owner, mount)
    for (const cmd of o.setup ?? []) {
      const s = await env.exec(cmd, { timeoutMs: 60_000 })
      if (s.code !== 0) {
        await env.dispose()
        throw new Error(`container setup failed (${cmd}): ${s.stderr.trim() || s.stdout.trim()}`)
      }
    }
    return env
  }

  /**
   * A path of an image copied to the host (`to` must not exist yet): a benchmark image's
   * repository with the environment's in-place build, which a fresh checkout would not have.
   */
  static async copyOut(o: { image: string; path: string; to: string; docker?: DockerCli }): Promise<void> {
    const c = await docker(o.docker, ['create', o.image], 600_000)
    if (c.code !== 0) throw new Error(`docker create failed: ${c.stderr.trim() || c.stdout.trim()}`)
    const id = c.stdout.trim()
    try {
      const r = await docker(o.docker, ['cp', `${id}:${o.path}`, o.to], 900_000)
      if (r.code !== 0) throw new Error(`docker cp failed: ${r.stderr.trim() || r.stdout.trim()}`)
    } finally {
      await docker(o.docker, ['rm', '-f', id], 60_000)
    }
  }

  exec(cmd: string, o: ExecOptions = {}): Promise<ExecResult> {
    const secs = Math.ceil((o.timeoutMs ?? DEFAULT_TIMEOUT) / 1000)
    const envArgs = Object.entries(o.env ?? {}).flatMap(([k, v]) => ['-e', `${k}=${v}`])
    const script = this.init ? `${this.init}\n${cmd}` : cmd
    const [file, ...pre] = Array.isArray(this.cli) ? this.cli : [this.cli ?? 'docker']
    return run(file, [...pre, 'exec', '-i', ...envArgs, '-w', this.cwd, this.id, 'timeout', String(secs), 'bash', '-lc', script], { ...o, timeoutMs: (secs + 15) * 1000, env: process.env as Record<string, string> })
  }

  private halted = false

  halt(): void {
    if (this.halted) return
    const [file, ...pre] = Array.isArray(this.cli) ? this.cli : [this.cli ?? 'docker']
    const r = spawnSync(file, [...pre, 'pause', this.id], { env: process.env, timeout: 60_000, windowsHide: true })
    if (r.status !== 0) throw new Error(`could not pause the container: ${String(r.stderr ?? r.error ?? '').slice(-300)}`)
    this.halted = true
  }

  async dispose(): Promise<void> {
    // (a halted container is let go again, for the last command; it is removed right after)
    if (this.halted) await docker(this.cli, ['unpause', this.id], 60_000)
    if (this.owner) await this.exec(`chown -R ${sh(this.owner)} ${sh(this.mount)} 2>/dev/null; true`, { timeoutMs: 300_000 })
    await docker(this.cli, ['rm', '-f', this.id], 60_000)
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

const SANDBOX_DIR = fileURLToPath(new URL('../../sandbox', import.meta.url))
let imageAnswer: Promise<string> | undefined
/** The sandbox image (LSW_SANDBOX_IMAGE, default `lsw-sandbox`, built from packages/ai/sandbox when missing). */
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
  // a failure (the daemon restarting) is asked again next time, not kept for the life of the process
  const asked = imageAnswer
  asked.catch(() => imageAnswer === asked && (imageAnswer = undefined))
  return asked
}

/** This process's uid:gid, so files a container writes into a mounted workspace stay the host user's. */
export const hostUser = (): string | undefined => (typeof process.getuid === 'function' && typeof process.getgid === 'function' ? `${process.getuid()}:${process.getgid()}` : undefined)

/** The caps every sandbox gets: a runaway command cannot take the host down. */
export const SANDBOX_LIMITS = { memory: '1g', cpus: '1', pids: 256 }

/** Quote a string for a POSIX shell. */
export function sh(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}
