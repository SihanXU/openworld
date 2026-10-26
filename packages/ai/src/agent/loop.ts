// The agent loop: one task, worked in a repository through tools, until it submits or runs out
// of steps. Everything the outer loop may change lives in the self-state — the loop settings,
// the notes the agent wrote for itself, its skills (with scripts) and its hooks (code run at
// fixed points of this loop) — and none of it is in this file.

import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Env } from './env.ts'
import { Meter, type ChatMessage, type Model } from '../models/model.ts'
import type { Episode, Harness, HookStage, SelfState } from './state.ts'
import { agentTools, type AgentTool } from './tools.ts'
import { clip, wordsOf } from '../util.ts'

export interface AgentTask {
  id: string
  /** world-repo | engine | swe | …: kept with the episode; retrieval and the outer loop group by it */
  kind: string
  /** the issue, as the agent reads it */
  statement: string
  env: Env
  /** tests the agent may run (run_tests) */
  tests?: { command: string; timeoutMs?: number }
  /** the task's own verdict after submission (hidden tests, a validator…); default: the tests pass */
  verdict?: (env: Env) => Promise<{ ok: boolean; output: string }>
  /** retrieval terms; default: the words of the statement */
  terms?: string[]
  /** recorded with the episode (what a replay needs to rebuild the task) */
  request?: unknown
  /** notes about this family of tasks, shown after the statement */
  notes?: string
  /**
   * A person started this task by hand and lets the agent run commands on this machine though
   * the env is not isolated. Unattended work (curriculum, escalations, revisions, the outer loop)
   * never sets it: there, the agent's own commands and hooks run only in a container.
   */
  localRun?: boolean
  /** Release what the task holds (its workspace, its container); whoever made the task calls it when done. */
  dispose?: () => Promise<void>
}

export interface AgentResult {
  outcome: 'accepted' | 'failed'
  submitted: boolean
  verdict?: { ok: boolean; output: string }
  /** the change as a diff, when the workspace is a git repository */
  diff?: string
  episode: Episode
}

export interface AgentOptions {
  model: Model
  state: SelfState
  /** the harness to run with (default: the state's) */
  harness?: Harness
  /** write the episode to the state (default true) */
  record?: boolean
  log?: (line: string) => void
}

export const AGENT_SYSTEM = `You are a software engineer working on a task in a repository, through tools.
Work like a careful engineer: find out how the code is organized before changing it, make the smallest change that solves the task properly, run the tests, read failures closely and fix the cause.
Your tools: list_dir, read_file, search, write_file, edit_file, run (a shell command), run_tests (when the task has tests), read_skill (your own skills), submit (when you are done).
Call submit only when the task is solved and the tests you can run pass. You have a limited number of steps.`

const NUDGE = 'Continue with your tools; call submit when the task is done.'

/** Write the agent's own material into the workspace: the issue, its skills, its hooks. */
function prepare(task: AgentTask, state: SelfState, h: Harness): string[] {
  const root = task.env.root
  const dir = join(root, '.agent')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'skills'), { recursive: true })
  writeFileSync(join(dir, 'ISSUE.md'), task.statement)
  const skills = state.skills().map((s) => s.name)
  for (const name of skills) {
    mkdirSync(join(dir, 'skills', name), { recursive: true })
    for (const [f, body] of Object.entries(state.skillFiles(name))) writeFileSync(join(dir, 'skills', name, f), body)
  }
  for (const stage of ['start', 'presubmit'] as HookStage[])
    for (const name of h.agent.hooks[stage] ?? []) {
      const code = state.hookCode(stage, name)
      if (!code) continue
      mkdirSync(join(dir, 'hooks', stage), { recursive: true })
      writeFileSync(join(dir, 'hooks', stage, `${name}.mjs`), code)
    }
  // keep the agent's own files out of the change
  const exclude = join(root, '.git', 'info', 'exclude')
  if (existsSync(join(root, '.git'))) {
    mkdirSync(join(root, '.git', 'info'), { recursive: true })
    appendFileSync(exclude, '\n.agent/\n')
  }
  return skills
}

/** Run the hooks of a stage; each prints text for the agent (start) or a verdict (presubmit). */
async function hooks(task: AgentTask, h: Harness, stage: HookStage): Promise<{ name: string; ok: boolean; out: string }[]> {
  const out: { name: string; ok: boolean; out: string }[] = []
  // hooks are code the agent wrote for itself: they run where its commands may run, nowhere else
  if (!task.env.isolated && !task.localRun) return out
  for (const name of h.agent.hooks[stage] ?? []) {
    if (!existsSync(join(task.env.root, '.agent', 'hooks', stage, `${name}.mjs`))) continue
    const r = await task.env.exec(`${task.env.node ?? 'node'} .agent/hooks/${stage}/${name}.mjs`, {
      timeoutMs: 120_000,
      env: { TASK_TESTS: task.tests?.command ?? '', TASK_ISSUE: '.agent/ISSUE.md', TASK_KIND: task.kind },
    })
    const text = (r.stdout + (r.stderr ? `\n${r.stderr}` : '')).trim()
    out.push({ name, ok: r.code === 0 && !/^BLOCK\b/m.test(r.stdout), out: clip(text, 4000) })
  }
  return out
}

export async function runAgent(task: AgentTask, o: AgentOptions): Promise<AgentResult> {
  const t0 = Date.now()
  const { state } = o
  const h = o.harness ?? state.harness()
  const cfg = h.agent
  const model = new Meter(o.model)
  const terms = task.terms ?? [`kind:${task.kind}`, ...wordsOf(task.statement)]
  const ep: Episode = {
    id: state.newEpisodeId(),
    at: new Date().toISOString(),
    kind: task.kind,
    summary: task.statement.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 160) ?? task.id,
    request: task.request ?? { id: task.id, statement: task.statement },
    key: `${task.kind}|${task.id}`,
    terms,
    outcome: 'failed',
    attempts: [],
    tools: [],
    rules: [],
    shown: { lessons: [], episodes: [], skills: [] },
    skillsRead: [],
    harness: h.version,
    model: o.model.name,
    usage: { calls: 0, input: 0, output: 0 },
    ms: 0,
  }
  const skills = prepare(task, state, h)
  const lessons = state.relevantLessons(terms, cfg.recall.lessons)
  const similar = state.similarEpisodes(terms, cfg.recall.episodes, ep.id)
  ep.shown = { lessons: lessons.map((l) => l.id), episodes: similar.map((e) => e.id), skills }

  const started = await hooks(task, h, 'start')
  let submitted = false
  const tools: AgentTool[] = agentTools(task.env, {
    localRun: task.localRun,
    testCommand: task.tests?.command,
    testTimeoutMs: task.tests?.timeoutMs,
    onTests: (ok, output) => ep.attempts.push({ phase: ep.attempts.length ? 'repair' : 'design', errors: ok ? [] : [clip(output.trim(), 1500)], warnings: [] }),
    onSkillRead: (n) => !ep.skillsRead.includes(n) && ep.skillsRead.push(n),
    onSubmit: async (summary) => {
      const checks = await hooks(task, h, 'presubmit')
      const blocked = checks.filter((c) => !c.ok)
      if (blocked.length) return `Submission blocked by your presubmit hook(s):\n${blocked.map((b) => `- ${b.name}: ${b.out}`).join('\n')}`
      submitted = true
      ep.submission = summary
      return 'submitted'
    },
  })
  const specs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))

  const intro = [
    `# Task ${task.id}`,
    task.statement,
    ...(task.notes ? ['', task.notes] : []),
    ...(task.tests ? ['', `Tests: \`${task.tests.command}\` (run_tests).`] : []),
    '',
    '# Your skills (read_skill)',
    ...(skills.length ? state.skills().map((s) => `- ${s.name}: ${s.description}`) : ['(none yet)']),
    '',
    '# Lessons from your past work',
    ...(lessons.length ? lessons.map((l) => `- ${l.text}`) : ['(none yet)']),
    ...(similar.length ? ['', '# Similar past tasks', ...similar.map((e) => `- ${e.summary} → ${e.outcome}`)] : []),
    ...(started.length ? ['', '# From your start hooks', ...started.map((s) => `## ${s.name}\n${s.out}`)] : []),
    ...(cfg.planFirst ? ['', 'Begin with a short plan, then work through it.'] : []),
  ].join('\n')
  const messages: ChatMessage[] = [
    { role: 'system', content: [AGENT_SYSTEM, ...(h.addenda.length ? ['', 'Your own working notes:', ...h.addenda.map((a) => `- ${a}`)] : [])].join('\n') },
    { role: 'user', content: intro },
  ]

  let nudges = 0
  let empties = 0
  let silent = '' // what the model said when it answered without a tool call
  try {
    for (let step = 0; step < cfg.maxSteps && !submitted; step++) {
      const r = await model.chat(messages, {
        tools: specs,
        temperature: cfg.temperature,
        reasoning: cfg.reasoning,
        purpose: 'agent',
        provider: cfg.provider,
        hedgeMs: cfg.hedgeMs,
        deadlineMs: cfg.deadlineMs,
        retries: cfg.retries,
      })
      // an empty turn is a provider failure, not an answer: ask again (a few times per task)
      if (!r.toolCalls.length && !r.content.trim() && empties++ < 3) continue
      if (!r.toolCalls.length) {
        messages.push({ role: 'assistant', content: r.content })
        silent = `${r.provider ?? '?'}: ${clip(r.content.replace(/\s+/g, ' ').trim(), 300)}`
        if (++nudges > 3) break
        messages.push({ role: 'user', content: NUDGE })
        continue
      }
      messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls })
      for (const c of r.toolCalls) {
        const tool = tools.find((t) => t.name === c.name)
        const t1 = Date.now()
        let out: string
        try {
          out = tool ? await tool.run((c.args ?? {}) as Record<string, unknown>) : `unknown tool "${c.name}"`
        } catch (err) {
          out = `error: ${(err as Error).message}`
        }
        ep.tools.push({ name: c.name, args: compactArgs(c.args), ms: Date.now() - t1 })
        messages.push({ role: 'tool', toolCallId: c.id, name: c.name, content: clip(out, cfg.maxToolOutput) })
        if (submitted) break
      }
      trim(messages)
    }
    if (!submitted) ep.error = nudges > 3 ? `stopped: answered without a tool call ${nudges} times (last, via ${silent})` : `no submission within ${cfg.maxSteps} steps`
  } catch (err) {
    ep.error = (err as Error).message
  }

  // the verdict: the task's own (hidden tests, the validator), else its tests
  let verdict: AgentResult['verdict']
  if (submitted) {
    if (task.verdict) verdict = await task.verdict(task.env)
    else if (task.tests) {
      const r = await task.env.exec(task.tests.command, { timeoutMs: task.tests.timeoutMs ?? 300_000 })
      verdict = { ok: r.code === 0, output: clip(`${r.stdout}\n${r.stderr}`.trim(), 3000) }
    } else verdict = { ok: true, output: 'no tests' }
  }
  ep.outcome = submitted && verdict?.ok ? 'accepted' : 'failed'
  if (submitted && verdict && !verdict.ok) ep.attempts.push({ phase: 'repair', errors: [`verdict: ${clip(verdict.output, 1500)}`], warnings: [] })
  const diff = existsSync(join(task.env.root, '.git')) ? await gitDiff(task.env) : undefined
  if (diff !== undefined) ep.patch = diff
  ep.usage = { calls: model.calls, input: model.input, output: model.output, cost: model.cost }
  ep.calls = model.log
  ep.ms = Date.now() - t0
  if (o.record !== false) {
    state.recordEpisode(ep)
    state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
  }
  o.log?.(`${ep.id} ${task.kind} ${ep.outcome} in ${model.calls} calls, ${ep.ms} ms: ${ep.summary}${ep.error ? ` (${ep.error})` : ''}`)
  return { outcome: ep.outcome as 'accepted' | 'failed', submitted, verdict, diff, episode: ep }
}

/** Where a workspace began, when it did not begin at HEAD's tree (a benchmark image's own state: swe.ts). */
export const BASE_REF = 'refs/lsw/base'

export async function gitDiff(env: Env): Promise<string> {
  // include new files in the diff without staging their content
  await env.exec('git add -A -N . 2>/dev/null; true', { timeoutMs: 60_000 })
  // against where the workspace began: what the agent changed, committed or not
  const r = await env.exec(`git -c core.autocrlf=false diff --no-color $(git rev-parse -q --verify ${BASE_REF} || true)`, { timeoutMs: 60_000 })
  return r.stdout
}

function compactArgs(x: unknown): unknown {
  const s = JSON.stringify(x ?? {})
  return s.length > 600 ? `${s.slice(0, 600)}…` : x
}

/** Keep the conversation bounded: old tool results are cut first. */
function trim(messages: ChatMessage[], budget = 300_000): void {
  let size = messages.reduce((a, m) => a + m.content.length, 0)
  for (let i = 2; i < messages.length - 6 && size > budget; i++) {
    const m = messages[i]
    if (m.role === 'tool' && m.content.length > 400) {
      size -= m.content.length - 200
      messages[i] = { ...m, content: `${m.content.slice(0, 200)}\n… (older output trimmed)` }
    }
  }
}
