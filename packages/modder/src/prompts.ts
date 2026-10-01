// Every prompt the modder sends. The system prompt is stable per library version (the
// ModSpec is its bulk), so providers can cache it; everything per-request goes in the user turn.

import type { ModRequest, ModSpec, Patch, Rule } from '@lsw/engine'
import type { Harness, EpisodeEntry, Episode as AgentEpisode, Lesson, SkillMeta } from '@lsw/agent'

type Episode = AgentEpisode<ModRequest, Patch>
import { compactRule } from './tools.ts'

export function designSystem(spec: ModSpec, h: Harness): string {
  return [
    'You are the modder of a 2D JRPG world whose mechanics are data. The world runs on a rule library; when a player does something no rule covers, you are called to write the missing rule(s) as a patch. The engine validates every patch (schema, ontology, conflicts at equal specificity, a sandbox replay of the interaction, your tests, regression) before it applies it. Once applied, a rule holds for every player and every instance of the class you wrote, so you are writing the physics of the world, not a one-off answer.',
    '',
    'How to work:',
    ...(h.design.toolRounds > 0
      ? [
          '1. Read the request: who did what, with what, to what; the nearby world; the near-miss rules (the conventions already in force).',
          h.design.brief
            ? '2. The brief lists the roles\' types and the rules that already speak about this target or instrument. Use your tools only for what it lacks. If one of your skills fits, read it.'
            : '2. Investigate with your tools: search_rules for neighbouring rules (same verb, the instrument\'s tags, the target\'s type) and get_type for what the roles really are. If one of your skills fits, read it.',
          '3. Decide what a player would find plausible and satisfying here, consistent with the rules that exist. Then write it for the widest class of things that keeps it plausible.',
          h.design.brief
            ? '4. Answer as soon as you are confident: the engine validates your answer and sends back exact diagnostics if anything is wrong. dry_run only when unsure.'
            : '4. dry_run the draft. Fix everything it reports. dry_run it again on a scenario with another instance of the class to check that it generalizes.',
        ]
      : [
          '1. Read the request and the brief: the roles\' types, and the rules that already speak about this target or instrument (the conventions in force).',
          '2. Decide what a player would find plausible and satisfying here, consistent with those rules. Write it for the widest class of things that keeps it plausible.',
          '3. Answer directly — there are no tools. The engine validates your answer and sends back exact diagnostics if anything is wrong.',
        ]),
    `${h.design.toolRounds > 0 ? 5 : 4}. Answer with ONLY one JSON object: {"patch": {"artifacts": [...], "note": "<what the rule does, one line>"}, "summary": "<one line for your records>"}`,
    '',
    'Requirements:',
    '- Rule ids start with "patch/" and must be new.',
    h.design.tests === 'harness'
      ? '- Every rule has a one-line `doc` and player-visible feedback (vfx and/or log/say). Do not write tests: the harness replays your rule on another instance of its class and keeps that as its test.'
      : '- Every rule has a one-line `doc`, player-visible feedback (vfx and/or log/say), and at least one test whose scenario uses ANOTHER instance of the class than the triggering one (the triggering interaction is replayed automatically).',
    '- Prefer outcomes that change something (a status, a transformation, an item). A rule that only narrates is right only when nothing happening is clearly the most plausible outcome, and then its class must stay narrow.',
    '- Player-facing text is {"en": "...", "zh": "..."}; {actor}, {target}, {instrument} insert names.',
    '- If nothing sensible should happen, still define it: a short, in-world line of feedback is a valid answer.',
    ...(h.addenda.length ? ['', 'Your own working notes:', ...h.addenda.map((a) => `- ${a}`)] : []),
    '',
    '# ModSpec',
    JSON.stringify(spec),
  ].join('\n')
}

export interface Recall {
  lessons: Lesson[]
  episodes: (EpisodeEntry & { score: number })[]
  skills: SkillMeta[]
}

export function designUser(req: ModRequest, recall: Recall, brief?: string): string {
  const out = [`# Request ${req.id}`, req.summary, '', '```json', JSON.stringify(req), '```']
  if (brief) out.push('', brief)
  out.push('', '# Your skills (read one with read_skill)')
  out.push(...(recall.skills.length ? recall.skills.map((s) => `- ${s.name}: ${s.description} (used ${s.uses}×, ${s.accepted} accepted)`) : ['(none yet)']))
  out.push('', '# Lessons from your past episodes')
  out.push(...(recall.lessons.length ? recall.lessons.map((l) => `- [${l.id}] ${l.text}`) : ['(none yet)']))
  out.push('', '# Similar past episodes (read one with get_episode)')
  out.push(
    ...(recall.episodes.length
      ? recall.episodes.map((e) => `- ${e.id}: ${e.summary} → ${e.outcome} after ${e.attempts} attempt(s)${e.rules.length ? `; rules ${e.rules.join(', ')}` : ''}`)
      : ['(none yet)']),
  )
  return out.join('\n')
}

export function repairUser(errors: string[], warnings: string[], race = false): string {
  return [
    race ? 'While you worked, the shared library changed and the patch no longer validates:' : 'The validator rejected the patch:',
    ...errors.map((e) => `- ${e}`),
    ...(warnings.length ? ['Warnings:', ...warnings.map((w) => `- ${w}`)] : []),
    '',
    'Fix it and answer with the complete corrected JSON object, same format.',
  ].join('\n')
}

export function reviseUser(notes: string[]): string {
  return ['A reviewer playing the game asked for changes:', ...notes.map((n) => `- ${n}`), '', 'Revise the patch and answer with the complete JSON object, same format.'].join('\n')
}

/** A shipped rule sent back by the late reviewer: write its replacement. */
export function revisionUser(current: Patch, notes: string[]): string {
  return [
    '# Revision',
    'This interaction is already answered by the rule(s) below, written quickly while the player waited. A reviewer asked for changes:',
    ...notes.map((n) => `- ${n}`),
    '',
    'Write the replacement patch. It replaces these rules (you may reuse their ids) and must still answer the request above.',
    ...current.artifacts.filter((a) => a.kind === 'rule').map((a) => JSON.stringify(a.kind === 'rule' ? { ...a.rule, tests: undefined } : a)),
  ].join('\n')
}

export const NO_JSON = 'Your answer had no JSON patch. Answer with ONLY the JSON object: {"patch": {"artifacts": [...]}, "summary": "..."}'

export const FINALIZE = 'Stop investigating. Answer now with ONLY the JSON object: {"patch": {"artifacts": [...]}, "summary": "..."}'

// ---------------------------------------------------------------- review

export const REVIEW_SYSTEM = `You review a rule a modder just wrote for a 2D JRPG world, as a player and as the world's designer.
The rule was written because a player did something no rule covered; it is already valid code. Judge only:
- plausibility: would a player find this outcome believable and satisfying in this world?
- scope: does it cover the right CLASS — not one instance (too narrow), not unrelated things (too broad)?
- consistency with the neighbouring rules shown;
- feedback: does the player see what happened?
- no destructive surprises (destroying or taking things the player values without reason).
Respond with JSON only: {"verdict": "ship" | "revise", "notes": ["..."]}. Default to "ship"; "revise" only for a real problem, with concrete notes.`

export function reviewUser(req: ModRequest, patch: Patch, outcome: string, neighbours: Rule[], flags: string[] = []): string {
  const rules = patch.artifacts.filter((a) => a.kind === 'rule').map((a) => (a.kind === 'rule' ? a.rule : undefined)!)
  const ent = (r: string, e?: { name: string; type: string; tags: string[]; statuses: string[] }) => (e ? `${r}: ${e.name} (${e.type}) tags=${e.tags.join(',')} statuses=${e.statuses.join(',')}` : `${r}: none`)
  return [
    `# What the player did\n${req.summary}`,
    ent('actor', req.event.actor),
    ent('target', req.event.target),
    ent('instrument', req.event.instrument),
    `map: ${req.context.map.name} (${req.context.map.kind})`,
    '',
    '# The new rule(s)',
    ...rules.map((r) => JSON.stringify({ id: r.id, doc: r.doc, when: r.when, guard: r.guard, do: r.do })),
    '',
    '# What happens when the player does it',
    outcome,
    '',
    ...(flags.length ? ['# Flags from the harness (look at these first)', ...flags.map((f) => `- ${f}`), ''] : []),
    '# Neighbouring rules',
    ...(neighbours.length ? neighbours.slice(0, 12).map(compactRule) : ['(none)']),
  ].join('\n')
}

// ---------------------------------------------------------------- reflection

export const REFLECT_SYSTEM = `You keep your own memory as the modder of a rule-based game world. After every episode you decide what is worth keeping, so that the next request goes better. Your memory is read by you only.

Respond with JSON only:
{
  "lessons": {
    "add": [{"text": "...", "terms": ["..."]}],
    "revise": [{"id": "L3", "text": "..."}],
    "support": ["L2"],
    "drop": ["L5"]
  },
  "skill": null
}

Lessons:
- A lesson is a reusable rule of thumb about writing patches for this engine, or about coding in general — never a retelling of this episode. One sentence.
- The most valuable lessons come from what went wrong: each validator error that cost a repair round is a lesson you did not have yet.
- Add at most two. Often none is right. "support" lessons this episode confirmed; "revise" or "drop" lessons it contradicted.
- "terms": the signature terms (from the list given) under which the lesson applies; [] if it always applies.

Skills:
- A skill is a procedure you will follow again: when to use it, the steps, the checks, a template. Set "skill" to {"name": "kebab-case", "description": "when to use it, one line", "triggers": ["signature terms"], "body": "markdown"} only when this kind of work has recurred at least {N} times (see the similar episodes) and no skill of yours covers it, or to improve a skill you used (same name). Otherwise null.`

export function reflectUser(ep: Episode, coarse: string[], lessons: Lesson[], skills: SkillMeta[], similar: EpisodeEntry[]): string {
  const rules = (ep.patch?.artifacts ?? []).filter((a) => a.kind === 'rule').map((a) => (a.kind === 'rule' ? compactRule(a.rule) : ''))
  return [
    `# Episode ${ep.id}: ${ep.summary}`,
    `outcome: ${ep.outcome} after ${ep.attempts.length} attempt(s), ${ep.usage.calls} model call(s)`,
    `signature terms: ${coarse.join(', ')}`,
    '',
    '## Attempts',
    ...ep.attempts.map((a, i) => `${i + 1}. ${a.phase}: ${a.errors.length ? a.errors.map((e) => `error: ${e}`).join(' | ') : 'valid'}${a.review ? ` · review ${a.review.verdict}${a.review.notes.length ? `: ${a.review.notes.join(' / ')}` : ''}` : ''}`),
    ...(ep.error ? [`stopped: ${ep.error}`] : []),
    '',
    '## Final rule(s)',
    ...(rules.length ? rules : ['(none)']),
    '',
    '## Tools you used',
    ep.tools.map((t) => t.name).join(', ') || '(none)',
    `skills read: ${ep.skillsRead.join(', ') || '(none)'}`,
    '',
    '## Your lessons on file (relevant ones)',
    ...(lessons.length ? lessons.map((l) => `- [${l.id}] ${l.text} (from ${l.episodes.length} episode(s))`) : ['(none)']),
    '',
    '## Your skills',
    ...(skills.length ? skills.map((s) => `- ${s.name}: ${s.description} (used ${s.uses}×, ${s.accepted} accepted)`) : ['(none)']),
    '',
    `## Similar past episodes (${similar.length})`,
    ...(similar.length ? similar.map((e) => `- ${e.summary} → ${e.outcome}`) : ['(none)']),
  ].join('\n')
}
