// SWE-bench-style tasks: an instance (repository, base commit, problem statement) in, a diff out
// (predictions.jsonl, the format SWE-bench evaluation reads). The self-state under evaluation is
// used read-only — a fork, nothing recorded — so the benchmark never becomes training data.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DockerEnv, LocalEnv, hostUser, sh, type DockerCli, type Env } from './env.ts'
import { BASE_REF, gitDiff, runAgent } from './loop.ts'
import { PIN_BREACH, type Model } from '../models/model.ts'
import type { Harness, SelfState } from './state.ts'

export interface SweInstance {
  instance_id: string
  /** "owner/name" on GitHub, or a local path / git URL */
  repo: string
  base_commit: string
  problem_statement: string
  hints_text?: string
  /** a test command the agent may run (not the hidden evaluation tests) */
  test_cmd?: string
  /** the instance's own image, as its dataset names it (else the template's) */
  image?: string
  /** where the image holds the repository (default /testbed) */
  workdir?: string
}

export interface SwePrediction {
  instance_id: string
  model_name_or_path: string
  model_patch: string
}

/** What one instance cost and how it went: a row beside predictions.jsonl. */
export interface SweRecord {
  instance_id: string
  outcome: string
  submitted: boolean
  steps: number
  input: number
  output: number
  cost: number
  ms: number
  /** who served the calls (OpenRouter's providers): a frozen model is served by the pinned one only */
  providers: string[]
  diffLines: number
  model: string
  harness: number
  ablated: string[]
  error?: string
}

export interface SweOptions {
  model: Model
  state: SelfState
  harness?: Harness
  /** local processes, or a container per instance (image from a template: {id}, {id1776}) */
  env?: 'local' | 'docker'
  image?: string
  /** where repositories are mirrored and checked out */
  cache: string
  work: string
  hints?: boolean
  label?: string
  log?: (line: string) => void
  /** the docker CLI (tests drive a stand-in) */
  docker?: DockerCli
  /** a node for the agent's hooks in the container (default: LSW_HOOK_NODE, else this node on Linux); null: none */
  hookNode?: string | null
  /** uid:gid the workspace is given back to (default: this process's, on Linux) */
  owner?: string
}

export const IMAGE_TEMPLATE = 'swebench/sweb.eval.x86_64.{id1776}:latest'

/**
 * The SWE-bench images' environment, before every command: their /root/.bashrc activates it, and a
 * login shell reads that only through /root/.profile, which an image need not have.
 */
export const IMAGE_INIT = 'if [ -f /opt/miniconda3/etc/profile.d/conda.sh ]; then . /opt/miniconda3/etc/profile.d/conda.sh && conda activate testbed >/dev/null 2>&1; fi'

/**
 * Once per container: the workspace belongs to the host's user and the commands run as the image's
 * (root), and git refuses a repository owned by someone else unless told — the diff would be empty.
 */
export const CONTAINER_SETUP = "git config --global --add safe.directory '*'"

async function git(args: string, cwd: string): Promise<void> {
  const r = await new LocalEnv(cwd).exec(`git ${args}`, { timeoutMs: 900_000 })
  if (r.code !== 0) throw new Error(`git ${args}: ${r.stderr.trim() || r.stdout.trim()}`)
}

const dirName = (id: string) => id.replace(/[^A-Za-z0-9._-]+/g, '_')

/** A fresh checkout of the instance's repository at its base commit. */
export async function checkout(inst: SweInstance, cache: string, work: string): Promise<string> {
  mkdirSync(cache, { recursive: true })
  mkdirSync(work, { recursive: true })
  const local = existsSync(inst.repo) ? resolve(inst.repo) : undefined
  const url = local ?? (/^(https?|git|ssh):|@/.test(inst.repo) ? inst.repo : `https://github.com/${inst.repo}.git`)
  const mirror = join(cache, `${inst.repo.replace(/[^A-Za-z0-9._-]+/g, '__')}.git`)
  if (!existsSync(mirror)) await git(`clone --mirror ${sh(url)} ${sh(mirror)}`, cache)
  const dir = join(work, dirName(inst.instance_id))
  rmSync(dir, { recursive: true, force: true })
  await git(`clone --quiet ${sh(mirror)} ${sh(dir)}`, work)
  await git(`-c advice.detachedHead=false checkout --quiet ${sh(inst.base_commit)}`, dir)
  return dir
}

/** A line of .git/info/exclude that matches exactly this path (from the repository's root). */
function excludeLine(path: string): string {
  return '/' + path.replace(/[\\*?[]/g, (c) => `\\${c}`).replace(/ $/, '\\ ')
}

/**
 * The repository as the image left it is where the agent begins. What the image's install left
 * untracked (its build) stays out of every diff; what it changed in tracked files is committed, so
 * the diff (against BASE_REF) is the agent's alone and applies where the evaluation's image is.
 */
export async function freezeBaseline(dir: string): Promise<void> {
  const env = new LocalEnv(dir)
  const g = async (args: string) => {
    const r = await env.exec(`git -c core.autocrlf=false ${args}`, { timeoutMs: 300_000 })
    if (r.code !== 0) throw new Error(`git ${args}: ${r.stderr.trim() || r.stdout.trim()}`)
    return r.stdout
  }
  const untracked = (await g('ls-files --others --exclude-standard --directory -z')).split('\0').filter(Boolean)
  if (untracked.length) {
    mkdirSync(join(dir, '.git', 'info'), { recursive: true })
    appendFileSync(join(dir, '.git', 'info', 'exclude'), `\n# the image's own build (swe.ts)\n${untracked.map(excludeLine).join('\n')}\n`)
  }
  if ((await g('status --porcelain --untracked-files=no')).trim()) await g("-c user.email=lsw@local -c user.name=lsw commit -qam 'lsw: the repository as the image left it'")
  await g(`update-ref ${BASE_REF} HEAD`)
}

/**
 * Where the repository is under a copied-out workdir: the workdir itself, or the first directory two levels
 * down at most that holds `.git` (as SWE-bench-Live's evaluation looks for it); undefined when none does.
 */
export function repositoryIn(dir: string): string | undefined {
  if (existsSync(join(dir, '.git'))) return ''
  for (const a of readdirSync(dir, { withFileTypes: true })) {
    if (!a.isDirectory() || a.name.startsWith('.')) continue
    if (existsSync(join(dir, a.name, '.git'))) return a.name
    for (const b of readdirSync(join(dir, a.name), { withFileTypes: true })) if (b.isDirectory() && existsSync(join(dir, a.name, b.name, '.git'))) return `${a.name}/${b.name}`
  }
  return undefined
}

/** The node the agent's hooks run with in a container: one built for Linux (this one, on a Linux host). */
export function defaultHookNode(): string | undefined {
  return process.env.LSW_HOOK_NODE || (process.platform === 'linux' ? process.execPath : undefined)
}

export async function solve(inst: SweInstance, o: SweOptions): Promise<SwePrediction & { outcome: string; cost: number; record: SweRecord }> {
  let env: Env
  if (o.env === 'docker') {
    const image = inst.image ?? (o.image ?? IMAGE_TEMPLATE).replace('{id1776}', inst.instance_id.replace(/__/g, '_1776_')).replace('{id}', inst.instance_id)
    const workdir = inst.workdir ?? '/testbed'
    // the image's repository, with the environment's in-place build (compiled extensions): a fresh
    // checkout mounted over it would hide that build, and the repository's tests could not run
    mkdirSync(o.work, { recursive: true })
    const dir = join(resolve(o.work), dirName(inst.instance_id))
    rmSync(dir, { recursive: true, force: true })
    await DockerEnv.copyOut({ image, path: workdir, to: dir, docker: o.docker })
    const sub = repositoryIn(dir)
    if (sub === undefined) throw new Error(`${inst.instance_id}: no git repository in the image's ${workdir}`)
    await freezeBaseline(join(dir, sub))
    const node = o.hookNode === undefined ? defaultHookNode() : (o.hookNode ?? undefined)
    if (!node) o.log?.(`${inst.instance_id}: no Linux node to mount, so the agent's hooks cannot run in the container`)
    env = await DockerEnv.start({ image, root: dir, mount: workdir, sub, node, init: IMAGE_INIT, setup: [CONTAINER_SETUP], owner: o.owner ?? hostUser(), docker: o.docker })
  } else env = new LocalEnv(await checkout(inst, o.cache, o.work))
  try {
    const statement = [inst.problem_statement.trim(), ...(o.hints && inst.hints_text ? ['', '## Hints', inst.hints_text.trim()] : [])].join('\n')
    const state = o.state.fork()
    const r = await runAgent(
      { id: inst.instance_id, kind: 'swe', statement, env, localRun: !env.isolated, tests: inst.test_cmd ? { command: inst.test_cmd } : undefined, request: { instance_id: inst.instance_id, repo: inst.repo } },
      { model: o.model, state, harness: o.harness, record: false, log: o.log },
    )
    const patch = r.diff ?? (await gitDiff(env))
    const ep = r.episode
    const record: SweRecord = {
      instance_id: inst.instance_id,
      outcome: r.outcome,
      submitted: r.submitted,
      steps: ep.usage.calls,
      input: ep.usage.input,
      output: ep.usage.output,
      cost: ep.usage.cost ?? 0,
      ms: ep.ms,
      providers: [...new Set((ep.calls ?? []).map((c) => c.provider).filter((p): p is string => !!p))],
      diffLines: patch ? patch.split('\n').length : 0,
      model: o.model.name,
      harness: (o.harness ?? state.harness()).version,
      ablated: [...o.state.ablated],
      ...(ep.error ? { error: ep.error } : {}),
    }
    return { instance_id: inst.instance_id, model_name_or_path: o.label ?? `lsw-agent/${o.model.name}`, model_patch: patch, outcome: r.outcome, cost: record.cost, record }
  } finally {
    await env.dispose?.()
  }
}

export interface SweRunOptions extends SweOptions {
  /** predictions.jsonl; its records go to <out>.runs.jsonl, its manifest to <out>.manifest.json */
  out: string
  /** instances at once, one container each */
  workers?: number
  /** continue a run: skip the instances already in `out` (its manifest must match) */
  resume?: boolean
  /**
   * What ties the run to its model and self-state (model, provider pin, state, harness, ablations,
   * instances…). A resumed run whose manifest differs is refused: its predictions would mix two runs.
   */
  manifest: Record<string, unknown>
}

export const recordsOf = (out: string) => `${out}.runs.jsonl`
export const manifestOf = (out: string) => `${out}.manifest.json`

/** The hash a manifest records of an instances file. */
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** Instances in, predictions and records out, `workers` at a time, resumable. */
export async function runInstances(items: SweInstance[], o: SweRunOptions): Promise<{ done: number; skipped: number; failed: number; cost: number }> {
  const mf = manifestOf(o.out)
  const done = new Set<string>()
  if (existsSync(o.out)) {
    if (!o.resume) throw new Error(`${o.out} exists: --resume continues that run`)
    for (const line of readFileSync(o.out, 'utf8').split('\n')) if (line.trim()) done.add((JSON.parse(line) as SwePrediction).instance_id)
  }
  if (existsSync(mf)) {
    const was = JSON.parse(readFileSync(mf, 'utf8')) as Record<string, unknown>
    const differ = [...new Set([...Object.keys(was), ...Object.keys(o.manifest)])].filter((k) => k !== 'started' && JSON.stringify(was[k]) !== JSON.stringify(o.manifest[k]))
    if (differ.length) throw new Error(`${mf} differs in ${differ.join(', ')}: a resumed run must be the same run`)
  } else writeFileSync(mf, JSON.stringify(o.manifest, null, 1) + '\n')
  const todo = items.filter((i) => !done.has(i.instance_id))
  let next = 0
  let cost = 0
  let failed = 0
  const worker = async () => {
    while (next < todo.length) {
      const inst = todo[next++]
      try {
        const p = await solve(inst, o)
        cost += p.cost
        // a call served from outside the pin voids the instance: it is retried on resume, never scored
        if (p.record.error?.includes(PIN_BREACH)) throw new Error(p.record.error)
        appendFileSync(o.out, JSON.stringify({ instance_id: p.instance_id, model_name_or_path: p.model_name_or_path, model_patch: p.model_patch }) + '\n')
        appendFileSync(recordsOf(o.out), JSON.stringify(p.record) + '\n')
        o.log?.(`${inst.instance_id}: ${p.outcome}, ${p.record.steps} steps, ${p.record.diffLines} diff lines, $${p.cost.toFixed(3)}`)
      } catch (err) {
        failed++
        appendFileSync(recordsOf(o.out), JSON.stringify({ instance_id: inst.instance_id, outcome: 'error', error: (err as Error).message }) + '\n')
        o.log?.(`${inst.instance_id}: error — ${(err as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.workers ?? 1, todo.length)) }, worker))
  return { done: todo.length - failed, skipped: done.size, failed, cost }
}
