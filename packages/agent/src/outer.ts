// The outer loop (docs/rsi.md §3, §5): the agent reads its own record, proposes ONE change to how
// it works — a loop setting, a note to itself, a skill (with scripts), or a hook (code run at a
// fixed point of its loop) — and the change is kept only if it holds up on recorded tasks.
//
// Meta-validation: the same recorded tasks are replayed with the current self-state and with the
// candidate (both forks; the world rolled back to before each task was answered). A selection set
// decides; a separate confirmation set guards against fitting the selection set over many
// proposals. The judges — the tasks' tests, the validator, the replay sets — are outside the
// self-state: the agent cannot change what it is measured by.

import { runAgent, type AgentTask } from './loop.ts'
import { Meter, parseJson, type Model } from './model.ts'
import { safeName, type Episode, type EpisodeEntry, type Harness, type HookStage, type SelfState } from './state.ts'
import { clip } from './util.ts'

export interface TaskSource {
  /** the episode kinds this source can rebuild */
  kinds: string[]
  /** a fresh task for a recorded episode, the world as it was before; undefined = not replayable now */
  replay(ep: Episode): Promise<AgentTask | undefined>
  cleanup?(task: AgentTask): Promise<void>
}

export type Proposal =
  | { kind: 'setting'; path: string; value: unknown; rationale: string }
  | { kind: 'note'; text: string; rationale: string }
  | { kind: 'skill'; skill: { name: string; description: string; triggers: string[]; body: string; files?: Record<string, string> }; rationale: string }
  | { kind: 'hook'; stage: HookStage; name: string; code: string; rationale: string }
  | { kind: 'none'; rationale: string }

export interface ArmStats {
  tasks: number
  accepted: number
  cost: number
  calls: number
  ms: number
}

export interface ImproveResult {
  proposal: Proposal
  accepted: boolean
  reason: string
  selection?: { base: ArmStats; cand: ArmStats }
  confirmation?: { base: ArmStats; cand: ArmStats }
  cost: number
}

export interface ImproveOptions {
  model: Model
  state: SelfState
  sources: TaskSource[]
  /** tasks in the selection and confirmation sets */
  select?: number
  confirm?: number
  /** relative tolerance and required gain (0.1 = 10 %) */
  margin?: number
  log?: (line: string) => void
}

/** The settings a proposal may change, with their bounds. */
export const SETTINGS: Record<string, (v: unknown) => boolean> = {
  'agent.maxSteps': (v) => Number.isInteger(v) && (v as number) >= 5 && (v as number) <= 80,
  'agent.temperature': (v) => typeof v === 'number' && v >= 0 && v <= 1,
  'agent.reasoning': (v) => ['none', 'minimal', 'low', 'medium', 'high'].includes(v as string),
  'agent.maxToolOutput': (v) => Number.isInteger(v) && (v as number) >= 1000 && (v as number) <= 20000,
  'agent.planFirst': (v) => typeof v === 'boolean',
  'agent.recall.lessons': (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 30,
  'agent.recall.episodes': (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10,
}

const MAX_NOTES = 12
const MAX_HOOK_BYTES = 20_000

export const OUTER_SYSTEM = `You maintain your own way of working. You are a software engineer agent: you work tasks in repositories through tools (list_dir, read_file, search, write_file, edit_file, run, run_tests, read_skill, submit). What you have learned so far is in your self-state, and you may change ONE thing about it now. The change is kept only if, replayed on recorded tasks, it does not lower the pass rate and makes cost, steps or time better by at least 10 % without making another of them worse by more than 10 %.

You may propose exactly one of:
- {"kind": "setting", "path": "<one of the settings below>", "value": …}
- {"kind": "note", "text": "…"} — a working note added to your system prompt (one or two sentences)
- {"kind": "skill", "skill": {"name": "kebab-case", "description": "when to use it", "triggers": ["…"], "body": "markdown procedure", "files": {"name.mjs": "…"}}} — scripts are run by you with the run tool from .agent/skills/<name>/
- {"kind": "hook", "stage": "start" | "presubmit", "name": "kebab-case", "code": "…"} — an ES module run with node at that point of every task: cwd is the repository root; env TASK_ISSUE (path of the issue file), TASK_TESTS (the test command, may be empty), TASK_KIND; it may use node:fs, node:child_process (git, rg, the test command). A start hook prints text that is shown to you with the task. A presubmit hook runs when you call submit: exit non-zero, or print a line starting with BLOCK, to stop the submission (you then see its output). Hooks time out after 120 s and must not use the network.
- {"kind": "none"} — if nothing in the evidence suggests a change worth testing.

Prefer changes that remove a recurring failure or recurring wasted work in the evidence. Do not repeat a proposal that was already rejected. Respond with JSON only: {…the proposal…, "rationale": "the evidence it addresses, and the effect you expect"}`

function get(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o)
}

function set<T>(o: T, path: string, v: unknown): T {
  const c = structuredClone(o) as Record<string, unknown>
  const ks = path.split('.')
  let x = c
  for (const k of ks.slice(0, -1)) x = (x[k] ??= {}) as Record<string, unknown>
  x[ks.at(-1)!] = v
  return c as T
}

/** What the agent sees about its own recent work. */
export function evidenceOf(state: SelfState, kinds: string[], recent = 30): string {
  const eps = state
    .episodes()
    .filter((e) => kinds.includes(e.kind ?? '') && e.outcome !== 'covered')
    .slice(-recent)
  const full = eps.map((e) => state.episode(e.id)).filter((e): e is Episode => !!e)
  const pass = full.filter((e) => e.outcome === 'accepted').length
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const tools: Record<string, number> = {}
  for (const e of full) for (const t of e.tools) tools[t.name] = (tools[t.name] ?? 0) + 1
  const h = state.harness()
  const past = state.journalOf('proposal').slice(-10)
  return [
    `## Recent tasks (${full.length}): ${pass} passed · ${avg(full.map((e) => e.usage.calls)).toFixed(1)} steps · ${(avg(full.map((e) => e.ms)) / 1000).toFixed(0)} s · $${avg(full.map((e) => e.usage.cost ?? 0)).toFixed(3)} on average`,
    `tool use: ${Object.entries(tools).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ')}`,
    '',
    ...full.map((e) => {
      const fails = e.attempts.filter((a) => a.errors.length)
      return `- [${e.outcome}] ${e.kind}: ${clip(e.summary, 120)} — ${e.usage.calls} steps, ${fails.length} failing test runs${e.error ? `; stopped: ${clip(e.error, 160)}` : ''}${fails.length ? `\n  last failure: ${clip(fails.at(-1)!.errors[0].replace(/\s+/g, ' '), 300)}` : ''}`
    }),
    '',
    '## Your loop settings',
    JSON.stringify(Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, get(h, k)]))),
    `hooks: start [${h.agent.hooks.start.join(', ')}] · presubmit [${h.agent.hooks.presubmit.join(', ')}]`,
    '',
    '## Your working notes',
    ...(h.addenda.length ? h.addenda.map((a) => `- ${a}`) : ['(none)']),
    '',
    '## Your skills',
    ...(state.skills().length ? state.skills().map((s) => `- ${s.name}: ${s.description} (used ${s.uses}×, ${s.accepted} passed)`) : ['(none)']),
    '',
    '## Your lessons',
    ...(state.lessons().length ? state.lessons().slice(-15).map((l) => `- ${l.text}`) : ['(none)']),
    '',
    '## Earlier proposals',
    ...(past.length ? past.map((p) => `- ${p.accepted ? 'kept' : 'rejected'}: ${JSON.stringify(p.proposal).slice(0, 200)} — ${String(p.reason ?? '').slice(0, 160)}`) : ['(none)']),
  ].join('\n')
}

/** Is the proposal within what the agent may change? Returns why not. */
export function checkProposal(p: Proposal, state: SelfState): string | undefined {
  switch (p.kind) {
    case 'none':
      return undefined
    case 'setting': {
      const ok = SETTINGS[p.path]
      if (!ok) return `not a setting it may change: ${p.path}`
      if (!ok(p.value)) return `value out of bounds for ${p.path}: ${JSON.stringify(p.value)}`
      if (JSON.stringify(get(state.harness(), p.path)) === JSON.stringify(p.value)) return 'no change'
      return undefined
    }
    case 'note':
      if (typeof p.text !== 'string' || !p.text.trim() || p.text.length > 400) return 'a note is one or two sentences'
      if (state.harness().addenda.length >= MAX_NOTES) return `at most ${MAX_NOTES} notes`
      return undefined
    case 'skill':
      if (!p.skill?.name || typeof p.skill.body !== 'string' || !p.skill.body.trim()) return 'a skill needs a name and a body'
      return undefined
    case 'hook':
      if (p.stage !== 'start' && p.stage !== 'presubmit') return 'stage must be start or presubmit'
      if (!p.name || typeof p.code !== 'string' || !p.code.trim()) return 'a hook needs a name and code'
      if (p.code.length > MAX_HOOK_BYTES) return 'hook code too long'
      if (/\bfetch\s*\(|node:https?|node:net|require\(['"]https?/.test(p.code)) return 'hooks must not use the network'
      return undefined
    default:
      return 'unknown proposal kind'
  }
}

/** Apply a proposal to a state (a fork for the trial, the real one when it is kept). */
export function applyProposal(p: Proposal, state: SelfState, reason: string): void {
  const h = state.harness()
  if (p.kind === 'setting') state.setHarness(set(h, p.path, p.value), `${p.path} = ${JSON.stringify(p.value)}: ${reason}`, 'outer-loop')
  if (p.kind === 'note') state.setHarness({ ...h, addenda: [...h.addenda, p.text.trim()] }, `note "${clip(p.text.trim(), 80)}": ${reason}`, 'outer-loop')
  if (p.kind === 'skill') state.writeSkill(p.skill, 'outer-loop')
  if (p.kind === 'hook') {
    const name = safeName(p.name)
    state.writeHook(p.stage, name, p.code, 'outer-loop')
    const hooks = { ...h.agent.hooks, [p.stage]: [...new Set([...h.agent.hooks[p.stage], name])] }
    state.setHarness({ ...h, agent: { ...h.agent, hooks } }, `${p.stage} hook ${name}: ${reason}`, 'outer-loop')
  }
}

/** The fixed replay sets (selection, confirmation), drawn once from replayable episodes and kept. */
export function replaySets(state: SelfState, kinds: string[], select: number, confirm: number): { select: string[]; confirm: string[] } {
  const saved = state.readDoc<{ select: string[]; confirm: string[] }>('replay-sets', { select: [], confirm: [] })
  const used = new Set([...saved.select, ...saved.confirm])
  const pool = state
    .episodes()
    .filter((e: EpisodeEntry) => kinds.includes(e.kind ?? '') && e.outcome !== 'covered' && !used.has(e.id))
    .map((e) => e.id)
  // alternate between the sets so both see the same mix of old and recent work
  for (const id of pool) {
    if (saved.select.length < select && (saved.select.length <= saved.confirm.length || saved.confirm.length >= confirm)) saved.select.push(id)
    else if (saved.confirm.length < confirm) saved.confirm.push(id)
  }
  state.writeDoc('replay-sets', saved)
  return { select: saved.select.slice(0, select), confirm: saved.confirm.slice(0, confirm) }
}

async function arm(ids: string[], state: SelfState, o: ImproveOptions, harness: Harness | undefined): Promise<ArmStats> {
  const s: ArmStats = { tasks: 0, accepted: 0, cost: 0, calls: 0, ms: 0 }
  for (const id of ids) {
    const ep = o.state.episode(id)
    const source = ep && o.sources.find((x) => x.kinds.includes(ep.kind ?? ''))
    const task = ep && source ? await source.replay(ep) : undefined
    if (!task) continue
    try {
      const r = await runAgent(task, { model: o.model, state, harness, record: false })
      s.tasks++
      if (r.outcome === 'accepted') s.accepted++
      s.cost += r.episode.usage.cost ?? 0
      s.calls += r.episode.usage.calls
      s.ms += r.episode.ms
    } finally {
      await source!.cleanup?.(task)
    }
  }
  return s
}

/** Keep the candidate? The pass rate may not drop; something must improve, nothing may get much worse. */
export function better(base: ArmStats, cand: ArmStats, margin: number): { ok: boolean; why: string } {
  if (!base.tasks || !cand.tasks) return { ok: false, why: 'no replayable tasks' }
  const per = (s: ArmStats, k: 'cost' | 'calls' | 'ms') => s[k] / s.tasks
  const rate = (s: ArmStats) => s.accepted / s.tasks
  if (rate(cand) < rate(base)) return { ok: false, why: `pass rate ${rate(cand).toFixed(2)} < ${rate(base).toFixed(2)}` }
  const worse = (['cost', 'calls', 'ms'] as const).filter((k) => per(cand, k) > per(base, k) * (1 + margin))
  if (worse.length) return { ok: false, why: `${worse.join(', ')} worse by more than ${margin * 100} %` }
  const gains = [
    rate(cand) > rate(base) ? 'pass rate' : '',
    ...(['cost', 'calls', 'ms'] as const).map((k) => (per(cand, k) < per(base, k) && per(cand, k) <= per(base, k) * (1 - margin) ? k : '')),
  ].filter(Boolean)
  return gains.length ? { ok: true, why: `better: ${gains.join(', ')}` } : { ok: false, why: 'no gain beyond noise' }
}

export async function improve(o: ImproveOptions): Promise<ImproveResult> {
  const { state } = o
  const margin = o.margin ?? 0.1
  const kinds = o.sources.flatMap((s) => s.kinds)
  const meter = new Meter(o.model)
  const r = await meter.chat(
    [
      { role: 'system', content: OUTER_SYSTEM.replace('<one of the settings below>', Object.keys(SETTINGS).join(' | ')) },
      { role: 'user', content: evidenceOf(state, kinds) },
    ],
    { json: true, temperature: 0.4, purpose: 'propose', reasoning: 'medium', provider: state.harness().agent.provider },
  )
  const proposal = (parseJson(r.content) ?? { kind: 'none', rationale: 'no JSON' }) as Proposal
  const done = (accepted: boolean, reason: string, extra: Partial<ImproveResult> = {}): ImproveResult => {
    const cost = meter.cost + (extra.cost ?? 0)
    state.note('proposal', { proposal, accepted, reason, selection: extra.selection, confirmation: extra.confirmation, usage: { calls: meter.calls, cost } })
    o.log?.(`proposal ${proposal.kind}: ${accepted ? 'KEPT' : 'rejected'} — ${reason}`)
    return { proposal, accepted, reason, cost, ...extra }
  }
  const invalid = checkProposal(proposal, state)
  if (invalid) return done(false, invalid)
  if (proposal.kind === 'none') return done(false, 'nothing proposed')

  const sets = replaySets(state, kinds, o.select ?? 16, o.confirm ?? 16)
  const trial = async (ids: string[]) => {
    const baseState = state.fork()
    const candState = state.fork()
    applyProposal(proposal, candState, 'trial')
    const [base, cand] = await Promise.all([arm(ids, baseState, o, undefined), arm(ids, candState, o, undefined)])
    return { base, cand }
  }
  const selection = await trial(sets.select)
  let spent = selection.base.cost + selection.cand.cost
  const s = better(selection.base, selection.cand, margin)
  if (!s.ok) return done(false, `selection: ${s.why}`, { selection, cost: spent })
  const confirmation = await trial(sets.confirm)
  spent += confirmation.base.cost + confirmation.cand.cost
  const c = better(confirmation.base, confirmation.cand, margin)
  if (!c.ok) return done(false, `confirmation: ${c.why}`, { selection, confirmation, cost: spent })
  const reason = `selection ${s.why}; confirmation ${c.why} (${selection.cand.accepted}/${selection.cand.tasks} + ${confirmation.cand.accepted}/${confirmation.cand.tasks} passed). ${clip(proposal.rationale ?? '', 300)}`
  applyProposal(proposal, state, reason)
  return done(true, reason, { selection, confirmation, cost: spent })
}
