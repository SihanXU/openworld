// Every prompt the modder sends. The design system prefix is the same for every request, every
// client and every library version (the ModSpec of the base ontology is its bulk), so providers
// serve it from their prompt cache; working notes follow it. Each request goes in the user turn, and only what
// the model can use: the brief replaces the rules the request carries, and the scenario (the
// harness replays it) is left out.

import type { DraftContext } from './drafts.ts'
import type { ModRequest, ModSpec, Patch, Rule, StatusDef, TypeDef } from '@openworld/engine'
import type { Harness, EpisodeEntry, Episode as AgentEpisode, Lesson, SkillMeta } from '../agent/state.ts'
type Episode = AgentEpisode<ModRequest, Patch>
import { compactRule } from './tools.ts'

/**
 * The router (pipeline.ts): the design sees only the request's own types; what lies beyond them it
 * asks for by name, and the harness finds it in the catalogue or has it created.
 */
export const ROUTER_RULES = [
  '',
  'Things beyond this request:',
  '- The ModSpec lists no types. You know the types of the request (its roles, their parents and the directories they sit in, in the brief) and those named by the rules shown. Name no other type id from memory.',
  '- If the most plausible outcome needs a thing you were not shown (a product, a material, a creature: what smelting, cooking, breaking or mixing makes), do not write a patch yet. Answer with ONLY: {"need": [{"name": "<the thing, in plain English>", "why": "<one line>"}]}. The harness looks it up in the world\'s full catalogue, and has it created if the world has no such thing.',
  '- Most outcomes need nothing beyond the request: then answer with the patch at once.',
].join('\n')

export function designSystem(spec: ModSpec, h: Harness, router = false): string {
  return [
    'You are the modder of a 2D JRPG world whose mechanics are data. Every happening is an event with one outcome, given by the rules of its host. When an event reaches an outcome the rules leave undefined (request.hole), you are called to write the missing rule as a patch: the host type\'s own rule for that event at that hole. The harness places it (host, on, hole, at: from the request, never from you); you write its tree. The engine validates every patch (schema, ontology, its place, a sandbox replay of the event, your tests) before it applies it. Once applied, the rule holds for every instance of the host\'s type at that place, so write its nature, not a one-off answer.',
    '',
    'How to work:',
    ...(h.design.toolRounds > 0
      ? [
          '1. Read the request: the event, its host (whose nature your rule describes), the other roles, where the outcome was undefined; the nearby world; the rules already consulted (the conventions in force).',
          h.design.brief
            ? '2. The brief lists the roles\' types and the rules that already speak about this host or this event. Use your tools only for what it lacks. If one of your skills fits, read it.'
            : '2. Investigate with your tools: search_rules for neighbouring rules (same kind, the host\'s type, the other roles\' tags) and get_type for what the roles really are. If one of your skills fits, read it.',
          '3. Decide what a player would find plausible and satisfying here, consistent with the rules that exist. Then write it for this type: branch on what varies among its instances (material, quality, element, statuses) and on the other roles\' classes.',
          h.design.brief
            ? '4. Answer as soon as you are confident: the engine validates your answer and sends back exact diagnostics if anything is wrong. dry_run only when unsure.'
            : '4. dry_run the draft. Fix everything it reports.',
        ]
      : [
          '1. Read the request and the brief: the host and the roles, where the outcome was undefined, and the rules that already speak about this host or event (the conventions in force).',
          '2. Decide what a player would find plausible and satisfying here, consistent with those rules. Write it for this type: branch on what varies among its instances (material, quality, element, statuses) and on the other roles\' classes.',
          '3. Answer directly — there are no tools. The engine validates your answer and sends back exact diagnostics if anything is wrong.',
        ]),
    `${h.design.toolRounds > 0 ? 5 : 4}. Answer with ONLY one JSON object, minified: {"affords": "use" | "words" | "none", "patch": {"artifacts": [...], "note": "<what the rule does, one line>"}}`,
    '',
    'What the host affords (judge it first, and say it in "affords"): be faithful to what this thing is for under this act, and to what a player would reasonably expect here — neither shrug nor invent.',
    '- "use": the thing has a common use for this act (a chair or a stool: sit on it; a bed or hay: lie on it; an altar: kneel; a well: draw water into a vessel; a bell: ring it, and people near hear it). Make the use real: state that lasts on the host, or an impulse its receiver answers (a posture: emit settle to the actor with {"pose": "sit" | "lie" | "kneel" | "lean"}). Never a line alone, and never a stand-in for the use (a heal is not sitting).',
    '- A posture is a use only where it is what the thing is for (a seat, a bed, a kneeler): that one could lean on or sit against almost anything does not make it the use of a rock, a fence, a post or a statue.',
    '- "words": the thing has no use for this act (a bare hand on a wall, a rock, a fence): a short in-world line of what one feels or sees, true to the thing, and no invented mechanics.',
    '- "none": nothing at all is the right outcome: {"do": []}.',
    '- Weigh the context (context.whose: whose the thing is, where it stands, who is near): knocking on a stranger\'s door or house wall may matter to them; on a cliff it does not.',
    '',
    'Requirements:',
    '- Rule ids start with "patch/" and must be new.',
    h.design.tests === 'harness'
      ? '- Every rule has a one-line `doc` and player-visible feedback (vfx and/or log/say). Do not write tests: the harness keeps the scene that asked as the rule\'s test.'
      : '- Every rule has a one-line `doc`, player-visible feedback (vfx and/or log/say), and at least one test (the triggering event is replayed automatically).',
    '- Answer the case that was asked (the target\'s class, the params given); a case you do not answer ends in {"undefined": true} so it stays open and is asked later. Never write `inherit`; give every `if` an `else`.',
    '- Nothing for nothing: if the outcome makes something (a stick shaken from a tree, food), let it cost or run out — use the instrument up, or change or spend the host (a status that clears with time, a prop that counts down) — so it is not a faucet pressed forever.',
    '- Your rule writes only its host; to affect anything else, emit an impulse to it and its receiver answers. Player-facing text is {"en": "...", "zh": "..."}; {host}, {actor}, {target}, {instrument}, {item} insert names.',
    '- Give a rule the player reaches a `label`: what their input does there, as the game shows it before the press ("label": {"en": "Tame {target}", "zh": "驯服{target}"}), naming {target}, {instrument} or {actor}; when its branches do different things, put a label on each {"do"} leaf instead. Without one the player sees a generic line.',
    ...(router ? [ROUTER_RULES] : []),
    '',
    '# ModSpec',
    JSON.stringify(spec),
    ...(h.addenda.length ? ['', 'Your own working notes:', ...h.addenda.map((a) => `- ${a}`)] : []),
  ].join('\n')
}

export interface Recall {
  lessons: Lesson[]
  episodes: (EpisodeEntry & { score: number })[]
  skills: SkillMeta[]
}

/** The request as the model reads it: no scenario (the harness replays it), no setting (the harness works it); with a brief, no rules (the brief has them). */
export function requestView(req: ModRequest, brief: boolean): Omit<ModRequest, 'scenario'> {
  const { scenario: _s, tier: _t, create: _c, ...rest } = req
  return brief ? { ...rest, context: { ...rest.context, rules: [] } } : rest
}

export function designUser(req: ModRequest, recall: Recall, brief?: string, added?: { types: TypeDef[]; statuses: StatusDef[] }, tools = true): string {
  const out = [`# Request ${req.id}`, req.summary, '', '```json', JSON.stringify(requestView(req, !!brief)), '```']
  if (brief) out.push('', brief)
  if (added && (added.types.length || added.statuses.length)) {
    out.push('', '# Types and statuses added by patches (beyond the ModSpec; use them like any other)')
    for (const t of added.types) out.push(`- type ${JSON.stringify({ id: t.id, tags: t.tags ?? [], name: t.name })}`)
    for (const s of added.statuses) out.push(`- status ${JSON.stringify({ id: s.id, name: s.name, duration: s.duration, immobilize: s.immobilize, moveDelay: s.moveDelay, clears: s.clears })}`)
  }
  out.push('', tools ? '# Your skills (read one with read_skill)' : '# Your skills')
  out.push(...(recall.skills.length ? recall.skills.map((s) => `- ${s.name}: ${s.description} (used ${s.uses}×, ${s.accepted} accepted)`) : ['(none yet)']))
  out.push('', '# Lessons from your past episodes')
  out.push(...(recall.lessons.length ? recall.lessons.map((l) => `- [${l.id}] ${l.text}`) : ['(none yet)']))
  out.push('', tools ? '# Similar past episodes (read one with get_episode)' : '# Similar past episodes')
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

/** A provisional answer (words only) asked again: the player kept trying after it (design.md §5.17). */
export function againUser(again: NonNullable<ModRequest['again']>): string {
  return [
    '# Asked again',
    `This act already has an answer that gives only words${again.said ? `: "${again.said}"` : ''}. The player did it ${again.times} times in a row after it.`,
    'Judge again, on the thing alone, what it affords for this act: trying again is no sign that it has a use (players press on walls and rocks too). If it has a common use the earlier answer missed, make it real now ("affords": "use"). If it has none, keep a line or nothing: a use made up for a thing that has none (leaning on a rock, sitting on a fence) is a worse answer than a line. Your answer replaces the earlier one and is final.',
  ].join('\n')
}

export const NO_JSON ='Your answer had no JSON patch. Answer with ONLY the JSON object: {"patch": {"artifacts": [...]}}'

export const FINALIZE = 'Stop investigating. Answer now with ONLY the JSON object: {"patch": {"artifacts": [...]}}'

// ---------------------------------------------------------------- review

export const REVIEW_SYSTEM = `You review a rule a modder just wrote for a 2D JRPG world, as a player and as the world's designer.
The rule was written because an event reached an outcome no rule defined (a player's act, or the world by itself); it is already valid code. Judge only:
- plausibility: would a player find this outcome believable and satisfying in this world?
- scope: does it answer the right cases of this host type — not one target only (too narrow), not unrelated targets or params (too broad)?
- consistency with the neighbouring rules shown;
- feedback: does the player see what happened?
- no destructive surprises (destroying or taking things the player values without reason);
- no free repeatable gain: an outcome that makes something (a stick, food, a resource) must cost something or run out — the instrument used up, the host changed or spent (a status, a prop) — or the world gains a faucet the player can press forever;
- the lines read right when a name slot is the player ("you"): no "{actor} holds", no "{target}'s".
Respond with JSON only: {"verdict": "ship" | "revise", "notes": ["..."]}. Default to "ship"; "revise" only for a real problem, with concrete notes.`

export const AUDIT_SYSTEM = `You audit a rule a modder just wrote for a 2D JRPG world, as a player out to break the game. The rule is valid code and passed the deterministic checks; your job is what they cannot see.
Look for what a player would call an exploit or a bug, caused by this patch:
- farm: something made again and again for nothing, or for far less than it is worth;
- value: a cheap road to a rare or strong thing (a stick that becomes a legendary sword);
- softlock: the player, or someone the story needs, can no longer act, move, or go on;
- harm: someone hurt, taken or destroyed who should not be;
- runaway: a chain of events that never settles, or a number that grows without end.
What the patch is plainly meant to do is not a finding; nor is anything the world already did without it.
You have tools: look (the scene) and run (play steps in a copy of the scene, with the patch and without it). Prove each finding: run it, then report it with the setup, the steps and the claims that must hold at the end.
Answer with JSON only: {"findings": [{"title": "...", "kind": "farm|value|softlock|harm|runaway|other", "setup": [...], "steps": [...], "expect": [claims]}]}; {"findings": []} when you found nothing.
Claims: {"count": {"type", "in"?: key, "atLeast": n}}, {"prop": {"key", "name", "atLeast"?: n, "atMost"?: n}}, {"status": {"key", "has"}}, {"gone": key}, {"is": {"key", "type"}}, {"events": {"atLeast": n}}.
A finding counts only if the sandbox shows it with the patch and not without it, and the code then sees one of these harms in it (your "kind" is a guess; the code judges):
- farm: what a claim measures (a count, a number) grows further when your repeats are doubled: show a farm with a {repeat} step;
- value: the things made are worth over three times what was used up (by the things' own value);
- harm: an essential thing (the player, a companion, someone the story needs) or a resident is gone or down;
- softlock: the actor still cannot act a minute after your steps;
- runaway: more than 50 events for each act.
Anything else you reproduce is not removed; it goes to a reviewer to read.`

export function auditUser(req: ModRequest, patch: Patch, outcome: string): string {
  return [
    `# What happened (${req.origin === 'player' ? "the player's act" : 'the world by itself'})\n${req.summary}`,
    `event: ${req.event.kind} ${JSON.stringify(req.event.params)}; the scene's keys: ${req.scenario.entities.map((e) => `${e.key} (${e.type})`).join(', ')}`,
    '',
    '# The patch',
    ...patch.artifacts.map((a) => JSON.stringify(a.kind === 'rule' ? { rule: { id: a.rule.id, host: a.rule.host, on: a.rule.on, tree: a.rule.tree } } : a.kind === 'type' ? { type: { ...a.type, art: undefined } } : a)),
    '',
    '# What happens now when it happens',
    outcome,
  ].join('\n')
}

/** Confirmed findings, sent back to the designer (or to a revision). */
export function auditNotes(findings: { title: string; kind: string; evidence: string }[]): string[] {
  return findings.map((f) => `${f.kind}: ${f.title}\n${f.evidence}`)
}

export function auditRepairUser(notes: string[]): string {
  return ['An auditor broke the patch in the sandbox (shown with the patch and not without it):', ...notes.map((n) => `- ${n}`), '', 'Change the patch so this cannot happen (make it cost something, run out, or give less), and answer with the complete JSON object, same format.'].join('\n')
}

export function reviewUser(req: ModRequest, patch: Patch, outcome: string, neighbours: Rule[], flags: string[] = []): string {
  const rules = patch.artifacts.filter((a) => a.kind === 'rule').map((a) => (a.kind === 'rule' ? a.rule : undefined)!)
  const ent = (r: string, e?: { name: string; type: string; tags: string[]; statuses: string[] }) => (e ? `${r}: ${e.name} (${e.type}) tags=${e.tags.join(',')} statuses=${e.statuses.join(',')}` : `${r}: none`)
  return [
    `# What happened (${req.origin === 'player' ? 'the player\'s act' : 'the world by itself'})\n${req.summary}`,
    `event: ${req.event.kind} ${JSON.stringify(req.event.params)}`,
    ent('host', req.event.host),
    ...Object.entries(req.event.roles).map(([k, e]) => ent(k, e)),
    `map: ${req.context.map.name} (${req.context.map.kind})`,
    '',
    '# The new rule(s)',
    ...rules.map((r) => JSON.stringify({ id: r.id, doc: r.doc, host: r.host, on: r.on, tree: r.tree })),
    '',
    '# What happens now when it happens',
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

/** One episode, or several that each went cleanly (reflected on together, to save calls). */
export function reflectUser(eps: Episode | Episode[], coarse: string[], lessons: Lesson[], skills: SkillMeta[], similar: EpisodeEntry[]): string {
  const list = Array.isArray(eps) ? eps : [eps]
  return [
    ...(list.length > 1 ? [`# ${list.length} episodes, each accepted at its first answer (reflect on them together)`, `signature terms: ${coarse.join(', ')}`, ''] : []),
    ...list.flatMap((ep) => [...episodeSection(ep, list.length > 1 ? undefined : coarse), '']),
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

function episodeSection(ep: Episode, coarse?: string[]): string[] {
  const rules = (ep.patch?.artifacts ?? []).filter((a) => a.kind === 'rule').map((a) => (a.kind === 'rule' ? compactRule(a.rule) : ''))
  return [
    `# Episode ${ep.id}: ${ep.summary}`,
    `outcome: ${ep.outcome} after ${ep.attempts.length} attempt(s), ${ep.usage.calls} model call(s)`,
    ...(coarse ? [`signature terms: ${coarse.join(', ')}`] : []),
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
  ]
}

// ---------------------------------------------------------------- the router: find, then create

export interface Need {
  name: string
  why?: string
}
export interface Creation {
  id: string
  name: { en: string; zh: string }
  parent?: string
  why?: string
}

/** The catalogue: every type, grouped under its parent, with its English name where it differs from its id. */
export function catalogueOf(types: TypeDef[]): string {
  const kids = new Map<string, string[]>()
  for (const t of types) {
    const segs = t.id.split('/')
    const parent = segs.slice(0, -1).join('/') || '(root)'
    const leaf = segs.at(-1)!
    const en = typeof t.name === 'string' ? t.name : t.name?.en
    const label = en && en.toLowerCase().replace(/[^a-z0-9]+/g, '_') !== leaf ? `${leaf} (${en})` : leaf
    ;(kids.get(parent) ?? kids.set(parent, []).get(parent)!).push(label)
  }
  return [...kids].map(([p, c]) => `${p}/: ${c.join(', ')}`).join('\n')
}

/** Find: the things the design asked for, the closest matches by name, and the whole catalogue. */
export function findUser(needs: Need[], candidates: Map<string, string[]>, catalogue: string): string {
  return [
    '# What you asked for, and what the world has',
    ...needs.map((n) => `- "${n.name}"${n.why ? ` (${n.why})` : ''}: closest by name: ${candidates.get(n.name)?.join(', ') || '(none)'}`),
    '',
    '# The world\'s catalogue (every type: parent/: children)',
    catalogue,
    '',
    'For each thing: if the catalogue has it, or something that serves just as well, write the patch now with its exact id.',
    'If the world truly has no such thing, answer with ONLY: {"create": [{"id": "<existing parent>/<snake_case>", "name": {"en": "...", "zh": "..."}, "why": "<one line>"}]}. Create only what is missing; reuse everything else.',
  ].join('\n')
}

/** Create: define the new types in the patch, beside the rule that makes them. */
export function createUser(creations: Creation[], materials: string[] = []): string {
  return [
    '# Create',
    `The world is making ${creations.length === 1 ? 'a new thing' : 'new things'}: ${creations.map((c) => `${c.id} (${[c.name.en, c.name.zh].filter(Boolean).join(' / ')})`).join(', ')}.`,
    'Write the patch with, for each, a type artifact beside your rule(s):',
    '{"kind": "type", "type": {"id": "<parent>/<snake_case>", "name": {"en": "...", "zh": "..."}, "tags": ["what the world uses it by"], "props": {"material": "<one of the materials>"}, "makeup": [{"type": "<a type the world has>", "count": 1}], "station": "hands | workbench (optional)"}}',
    '- The parent must exist; the new type inherits its rules and the few tags its parent has, so choose the parent whose behaviour fits (an ingot under item/material, a dish under item/food).',
    '- tags: the world uses a thing by its tags, and a parent carries few of them (item/food has only portable and food): a food that can be eaten has "edible" (and props.food, how much it fills), a drink "drinkable", something that binds "fiber"; give the ones it is used by, as the things beside it have them. A tag some rule turns it by names what it becomes: a "plantable" seed props.cropType, raw "cookable" food props.cookedType, an "empty-vessel" props.waterType, an "ore" props.smelts, a drink in a vessel props.emptyType. Made at hand or a station, a fixture is "portable". Something worn (under item/clothing or item/armor) names where in props.slot (head, body, shoulders, waist, feet, hands, ring, neck, ear, arm).',
    '- Its name is what a player would call it, in both languages; it must not be another name for a thing the world has.',
    `- props.material: what it is made of, one of: ${materials.join(', ') || '(see the ModSpec)'}.`,
    '- makeup: the things it is made of, by type and count (an iron ingot: one iron ore); it is also what it leaves when broken, so it takes no more than the outcome took to make it.',
    '- station (optional): where a player could also make it from its makeup, listed in the crafting panel: "workbench" when your rule makes it by using its makeup on a workbench, "hands" when its makeup alone makes it with no tool or place; leave it out when only your rule makes it somewhere else (smelting in a forge, cooking in a cauldron).',
    '- A new kind of ground (tile/...) cannot be made; make a thing that lies on the cell instead.',
    '- Do not draw it: an artist draws its icon next.',
    'Answer with ONLY the JSON object {"patch": {"artifacts": [...]}}.',
  ].join('\n')
}

// ---------------------------------------------------------------- a new thing, asked by an author

export const THING_SYSTEM = 'You design new things for a 2D JRPG world whose mechanics are data, at the request of the game\'s author. You answer with JSON only.'

/** A thing a player can have: its id, name and own numbers, so a new thing is made of them and sits among them. */
export interface Had {
  id: string
  name?: string
  props?: Record<string, unknown>
}

/**
 * The author asks for a new thing in a sentence (the editor's AI plan, M1): its type, made of what a player can
 * already have, at a place a player can have (the engine checks both, and that its numbers sit among its kind's).
 * What it does with other things is not written here: those are holes, answered act by act.
 */
export function thingUser(intent: string, o: { catalogue: string; materials: string[]; had: Had[]; stations: string[]; elements?: string[] }): string {
  return [
    '# A new thing',
    `The game's author wants a new thing in it: "${intent}"`,
    'Design it as a type artifact (and, only if it cannot be made otherwise, one more new type it is made of):',
    '{"kind": "type", "type": {"id": "<parent>/<snake_case>", "name": {"en": "...", "zh": "..."}, "tags": ["what the world uses it by"], "props": {...}, "makeup": [{"type": "<a type>", "count": 1}], "station": "hands | <a station>"}}',
    '- The parent must exist; the new type inherits its rules and tags, so choose the parent whose behaviour fits (a blade under item/weapon if there is one, a tool under item/tool, a dish under item/food).',
    '- tags: give the ones the things beside it have for the same use (a tool\'s "tool:<kind>", food\'s "edible"); a thing one carries is "portable".',
    '- Something worn (under item/clothing or item/armor) names where in props.slot (head, body, shoulders, waist, feet, hands, ring, neck, ear, arm), as the things of its kind do: without it, it cannot be worn.',
    o.materials.length ? `- props.material: what it is made of, one of: ${o.materials.join(', ')}.` : '- This world has no materials: leave props.material out.',
    ...(o.elements?.length ? [`- props.element: if what it is asked to be is of an element (it burns, freezes, sparks …), that element, one of: ${o.elements.join(', ')}; otherwise leave it out.`] : []),
    '- props: the numbers its kind uses (see the things a player can have, below), at a level that fits what it is: neither far above nor far below its kind.',
    '- makeup: what it is made of, from the things a player can have (below), by type and count, so a player can make it; it is also what it leaves when broken.',
    `- station: where a player makes it: "hands"${o.stations.length ? `, or one of the stations a player can have: ${o.stations.join(', ')}` : ' (this world has no station a player can have)'}.`,
    '- Its name is what a player would call it, in both languages, and not another name for a thing the world has.',
    '- Write no rules: what it does with other things is asked act by act later. Do not draw it: an artist draws its icon next.',
    '',
    'Things a player can have (id, name, own numbers):',
    ...o.had.slice(0, 120).map((h) => `- ${h.id}${h.name ? ` (${h.name})` : ''}${h.props && Object.keys(h.props).length ? ` ${JSON.stringify(h.props)}` : ''}`),
    '',
    'The catalogue (every kind the world has, by parent):',
    o.catalogue,
    '',
    'Answer with ONLY the JSON object {"patch": {"artifacts": [...], "note": "<what it is, one line>"}, "looks": {"<each new type id>": "<what it looks like, one line, for its icon>"}}.',
  ].join('\n')
}

// ---------------------------------------------------------------- a person or a map, asked by an author

export const DRAFT_SYSTEM = 'You draft content for a 2D JRPG world whose state is data, at the request of the game\'s author: one file of the game, in its exact form. You answer with JSON only.'

/** The author asks for a person or a map in a sentence: one file of the game, in the form of the sample, made of what the game has. */
export function draftUser(kind: 'person' | 'map', intent: string, ctx: DraftContext): string {
  const lang = ctx.lang ? `Write its words (names, lines) in ${ctx.lang}.` : ''
  if (kind === 'person')
    return [
      '# A new person',
      `The game's author wants a new person on the map "${ctx.map ?? ''}": "${intent}"`,
      'Write one person file, in the form of the sample: {"id": "npc.<lower_case>", "type", "name", "place": {"on": "tile", "map", "x", "y"}, "facing", "npc": {"role", "schedule": [{"from", "to", "at", "activity"}], "person": {"temperament", "lines": [{"key", "text"}]}}}.',
      '- type: one of the kinds of people below.',
      '- schedule: their whole day, hour by hour (0 to 24, a night may run from 21 to 6), each entry at one of the named spots below ("map:anchor"), what they do there in a few words.',
      '- lines: four to six things they say, in their own voice: one "greeting:first" (once), the rest "default", and one for an hour ("hour:evening") if it fits.',
      `- place: a cell of "${ctx.map ?? ''}" near the first spot of their day.`,
      lang,
      `Kinds of people: ${(ctx.kinds ?? []).map((k) => `${k.id}${k.name ? ` (${k.name})` : ''}`).join(', ')}`,
      `Named spots: ${(ctx.anchors ?? []).slice(0, 80).join(', ')}`,
      `Ids taken: ${(ctx.taken ?? []).slice(0, 200).join(', ')}`,
      'The sample:',
      JSON.stringify(ctx.sample ?? {}),
      'Answer with ONLY the person file\'s JSON object.',
    ].filter(Boolean).join('\n')
  const [w, h] = ctx.maxSize ?? [40, 30]
  return [
    '# A new map',
    `The game's author wants a new map: "${intent}"`,
    'Write one map file: {"map": {"id", "name", "kind", "width", "height", "rows": [...], "anchors": {"<name>": [x, y]}, "light", "zone"}, "entities": [{"id", "type", "place": {"on": "tile", "map", "x", "y"}}]}.',
    `- width and height: what the place needs, at most ${w} by ${h}; "rows" is height strings of width characters each, one character a cell, from the ground's characters below only.`,
    '- Shape it as the place it is: paths that lead somewhere, water and trees in natural shapes (not noise), an edge of trees or rock around a wild place.',
    '- anchors: a few named spots people and scenes can use (a well, a door, a field), on walkable ground.',
    '- entities: the things set down on it (a chest, a sign, a bed, creatures …), of the kinds below, each on a walkable cell; ids "<map id>.<what>N".',
    '- kind: village, town, wild, forest, dungeon, cave or interior; light: outdoor, indoor or dark; zone: peaceful or combat.',
    lang,
    'The ground\'s characters:',
    ...(ctx.chars ?? []).map((c) => `${JSON.stringify(c.char)} ${c.terrain}${c.name ? ` (${c.name})` : ''}`),
    `Kinds of things: ${(ctx.things ?? []).slice(0, 160).map((x) => `${x.id}${x.name ? ` (${x.name})` : ''}`).join(', ')}`,
    `Map ids taken: ${(ctx.taken ?? []).slice(0, 300).join(', ')}`,
    'Answer with ONLY the map file\'s JSON object.',
  ].filter(Boolean).join('\n')
}

/** A revision the author asks for in the chat: the draft before, and what to change; the rest kept. */
export function reviseDraftUser(previous: unknown, feedback: string): string {
  return ['# A revision', 'Your draft before:', JSON.stringify(previous), `The author asks: "${feedback.slice(0, 500)}"`, 'Change what they ask, keep the rest as it was, and answer with the whole JSON object again, in the same form.'].join('\n')
}

// ---------------------------------------------------------------- the artist

export const ART_SYSTEM = 'You are a pixel artist for the 16x16 icon pack of a JRPG. You answer with JSON only.'

/** Two icons of the pack as character grids, for the style: outline, tones, light. */
export const ART_REFERENCES: { name: string; grid: string[]; palette: Record<string, string> }[] = [
  {
    name: 'Stone (item/material/stone)',
    grid: ['.......kk.......', '....kkkaak......', '..kkaabaaakkk...', '.kaaaaababbbbk..', 'kaaaaaaabaabbbk.', 'kaaaaaabaabbcck.', 'kaaaaaabaabccck.', 'kaaaaabcbbcccck.', '.kaaaaccccccck..', '.kaabbbbdccck...', '..kbaaaabdck....', '.kaaaaaabck..kk.', '.kaaaaabcck.kcck', '..kkbbbccck.kcck', '....kkccck...kk.', '......kkk.......'],
    palette: { k: '#141b1b', a: '#b6beb0', b: '#8d977f', c: '#5f7160', d: '#485341' },
  },
  {
    name: 'Red Gem (item/material/gem)',
    grid: ['..kkkkkk........', '.kaaaaaakk......', 'kaaaabbbaakk....', 'kaaaabaabbbbk...', 'kaaaabaaabccbk..', 'kaaaabaabbbbcbk.', 'kaaaababbbbbcbk.', 'kaabbabcbbbbcbk.', 'kbbbbbaaccbbcbk.', 'kcbbbbbbbbcccbk.', 'kbcbbcccbbbbbbk.', 'kbbcddccccbbbbk.', 'kbbbccddcccccck.', 'kbbcccccddccck..', '.kkkkkkkkkkkkk..', '................'],
    palette: { k: '#141b1b', a: '#f2eaf1', b: '#ff8b62', c: '#e66a3a', d: '#a5608b' },
  },
]

export function artUser(t: { id: string; name: { en: string; zh: string } }, what: string): string {
  return [
    `Draw a 16x16 pixel-art inventory icon of: ${t.name.en} (${t.id}) - ${what}.`,
    'Draw it in a 3/4 view where it helps (a lighter top face above a darker front face), as the pack does.',
    'Match the style of the game\'s icon pack exactly, shown here as character grids ("." is transparent, each other character is one palette colour):',
    ...ART_REFERENCES.flatMap((r) => ['', `${r.name}:`, ...r.grid, `palette ${JSON.stringify(r.palette)}`]),
    '',
    'Style rules of the pack: a 1-pixel dark outline "k" = #141b1b around the whole shape; 3-4 tones of the object\'s colour plus a highlight; light from the top-left; flat colours, no dithering noise; the object fills about 12-14 px and is centred; transparent background.',
    'Answer with ONLY a JSON object: {"grid": [16 strings of exactly 16 characters], "palette": {"<char>": "#rrggbb", ...}} using at most 7 colours ("." not counted).',
  ].join('\n')
}
