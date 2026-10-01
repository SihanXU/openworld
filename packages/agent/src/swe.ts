// SWE-bench-style tasks: an instance (repository, base commit, problem statement) in, a diff out
// (predictions.jsonl, the format SWE-bench evaluation reads). The self-state under evaluation is
// used read-only — a fork, nothing recorded — so the benchmark never becomes training data.

import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DockerEnv, LocalEnv, sh, type Env } from './env.ts'
import { gitDiff, runAgent } from './loop.ts'
import type { Model } from './model.ts'
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
}

export interface SwePrediction {
  instance_id: string
  model_name_or_path: string
  model_patch: string
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
}

async function git(args: string, cwd: string): Promise<void> {
  const r = await new LocalEnv(cwd).exec(`git ${args}`, { timeoutMs: 900_000 })
  if (r.code !== 0) throw new Error(`git ${args}: ${r.stderr.trim() || r.stdout.trim()}`)
}

/** A fresh checkout of the instance's repository at its base commit. */
export async function checkout(inst: SweInstance, cache: string, work: string): Promise<string> {
  mkdirSync(cache, { recursive: true })
  mkdirSync(work, { recursive: true })
  const local = existsSync(inst.repo) ? resolve(inst.repo) : undefined
  const url = local ?? (/^(https?|git|ssh):|@/.test(inst.repo) ? inst.repo : `https://github.com/${inst.repo}.git`)
  const mirror = join(cache, `${inst.repo.replace(/[^A-Za-z0-9._-]+/g, '__')}.git`)
  if (!existsSync(mirror)) await git(`clone --mirror ${sh(url)} ${sh(mirror)}`, cache)
  const dir = join(work, inst.instance_id.replace(/[^A-Za-z0-9._-]+/g, '_'))
  rmSync(dir, { recursive: true, force: true })
  await git(`clone --quiet ${sh(mirror)} ${sh(dir)}`, work)
  await git(`-c advice.detachedHead=false checkout --quiet ${sh(inst.base_commit)}`, dir)
  return dir
}

export async function solve(inst: SweInstance, o: SweOptions): Promise<SwePrediction & { outcome: string; cost: number }> {
  const dir = await checkout(inst, o.cache, o.work)
  let env: Env
  if (o.env === 'docker') {
    const image = (o.image ?? 'swebench/sweb.eval.x86_64.{id1776}:latest').replace('{id1776}', inst.instance_id.replace(/__/g, '_1776_')).replace('{id}', inst.instance_id)
    env = await DockerEnv.start({ image, root: dir })
  } else env = new LocalEnv(dir)
  try {
    const statement = [inst.problem_statement.trim(), ...(o.hints && inst.hints_text ? ['', '## Hints', inst.hints_text.trim()] : [])].join('\n')
    const r = await runAgent(
      { id: inst.instance_id, kind: 'swe', statement, env, tests: inst.test_cmd ? { command: inst.test_cmd } : undefined, request: { instance_id: inst.instance_id, repo: inst.repo } },
      { model: o.model, state: o.state.fork(), harness: o.harness, record: false, log: o.log },
    )
    const patch = r.diff ?? (await gitDiff(env))
    return { instance_id: inst.instance_id, model_name_or_path: o.label ?? `lsw-agent/${o.model.name}`, model_patch: patch, outcome: r.outcome, cost: r.episode.usage.cost ?? 0 }
  } finally {
    await env.dispose?.()
  }
}
