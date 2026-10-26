// The middle loop for repo-form tasks: after an episode, what is worth keeping — lessons, and
// skills (a procedure, optionally with scripts the agent runs through its run tool).

import { BACKEND_DOWN, Meter, parseJson, type Model } from '../models/model.ts'
import type { Episode, Harness, SelfState } from './state.ts'
import { safeName } from './state.ts'
import { clip } from '../util.ts'

export const AGENT_REFLECT_SYSTEM = `You keep your own memory as a software engineer who works tasks in repositories. After every task you decide what is worth keeping, so that the next task goes better. Your memory is read only by you.

Respond with JSON only:
{
  "lessons": { "add": [{"text": "...", "terms": ["..."], "general": false}], "revise": [{"id": "L3", "text": "..."}], "support": ["L2"], "drop": ["L5"] },
  "skill": null
}

Lessons:
- A lesson is a reusable rule of thumb about working in this kind of codebase, or about engineering in general. One sentence. Never a retelling of this task.
- The most valuable lessons come from what went wrong: failing test runs, wasted steps, a submission that did not pass.
- Add at most two; often none is right. "support" lessons this task confirmed; "revise" or "drop" lessons it contradicted.
- "terms": words under which the lesson applies (e.g. "kind:engine", "w:validator").
- "general": true for a lesson about engineering in any repository (how to find code, test, read a failure, scope a change), not about this codebase: it is shown on every task, whatever its kind. Keep the codebase's own facts out of a general lesson.

Skills:
- A skill is a procedure you will follow again: when to use it, the steps, the checks. It may come with scripts (files) that you run with your run tool from .agent/skills/<name>/ — for example a script that finds the code related to a symbol, or one that runs only the relevant tests.
- Set "skill" to {"name": "kebab-case", "description": "when to use it, one line", "triggers": ["terms"], "general": false, "body": "markdown", "files": {"script.mjs": "…"}} ("general": true for a procedure that holds in any repository; it is listed on every task) only when this kind of work has recurred at least {N} times (see similar tasks) and no skill of yours covers it, or to improve a skill you used (same name). Otherwise null.`

export async function reflectAgent(ep: Episode, o: { model: Model; state: SelfState; harness?: Harness }): Promise<void> {
  const { state } = o
  const h = o.harness ?? state.harness()
  if (!h.reflect.enabled) return
  const model = new Meter(o.model)
  const similar = state.similarEpisodes(ep.terms, 8, ep.id).filter((e) => e.kind === ep.kind)
  const tools: Record<string, number> = {}
  for (const t of ep.tools) tools[t.name] = (tools[t.name] ?? 0) + 1
  const user = [
    `# Task ${ep.id} (${ep.kind}): ${ep.summary}`,
    `outcome: ${ep.outcome} after ${ep.usage.calls} model calls${ep.error ? ` — ${ep.error}` : ''}`,
    `terms: ${ep.terms.slice(0, 20).join(', ')}`,
    '',
    '## Test runs and verdict',
    ...(ep.attempts.length ? ep.attempts.map((a, i) => `${i + 1}. ${a.errors.length ? `failed: ${clip(a.errors[0], 600)}` : 'passed'}`) : ['(no test runs)']),
    '',
    '## Tools used',
    Object.entries(tools).map(([k, v]) => `${k}×${v}`).join(', ') || '(none)',
    `skills read: ${ep.skillsRead.join(', ') || '(none)'}`,
    '',
    '## Your lessons on file (relevant)',
    ...state.relevantLessons(ep.terms, 20).map((l) => `- [${l.id}] ${l.text}`),
    '',
    '## Your skills',
    ...state.skills().map((s) => `- ${s.name}: ${s.description} (used ${s.uses}×, ${s.accepted} accepted)`),
    '',
    `## Similar past tasks (${similar.length})`,
    ...similar.map((e) => `- ${e.summary} → ${e.outcome}`),
  ].join('\n')
  const r = await model.chat(
    [
      { role: 'system', content: AGENT_REFLECT_SYSTEM.replace('{N}', String(h.reflect.skillMinRecurrence)) },
      { role: 'user', content: user },
    ],
    { json: true, temperature: 0.2, purpose: 'reflect', reasoning: h.reflect.reasoning, provider: h.agent.provider },
  )
  const j = parseJson(r.content) as { lessons?: Parameters<SelfState['applyLessons']>[0]; skill?: { name?: unknown; description?: unknown; triggers?: unknown; general?: unknown; body?: unknown; files?: unknown } | null } | undefined
  const touched = j?.lessons && typeof j.lessons === 'object' ? state.applyLessons(j.lessons, ep.id, [`kind:${ep.kind}`]) : []
  let skill: string | undefined
  const s = j?.skill
  if (s && typeof s.name === 'string' && typeof s.body === 'string' && s.body.trim()) {
    const name = safeName(s.name)
    if (state.skill(name) || similar.length >= h.reflect.skillMinRecurrence) {
      const files = s.files && typeof s.files === 'object' ? Object.fromEntries(Object.entries(s.files as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string> : undefined
      state.writeSkill({ name, description: String(s.description ?? name), triggers: s.general === true ? [] : Array.isArray(s.triggers) && s.triggers.length ? s.triggers.map(String) : [`kind:${ep.kind}`], body: s.body, files }, ep.id)
      skill = name
    }
  }
  state.note('reflect', { episode: ep.id, kind: ep.kind, lessons: touched, skill, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
}

/**
 * Reflect after a task an unattended agent worked and recorded (a world task, an engine task, a task from the
 * history, an upstream proposal): every recorded task feeds the middle loop. A failure that is the backend's is
 * no lesson.
 */
export async function reflectAfter(ep: Episode, o: { model: Model; state: SelfState; harness?: Harness }): Promise<void> {
  if (ep.outcome === 'failed' && BACKEND_DOWN.test(ep.error ?? '')) return
  await reflectAgent(ep, o)
}
