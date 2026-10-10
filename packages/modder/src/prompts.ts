// Every prompt the modder sends. The design system prefix is the same for every request, every
// client and every library version (the ModSpec of the base ontology is its bulk), so providers
// serve it from their prompt cache; working notes follow it. Each request goes in the user turn, and only what
// the model can use: the brief replaces the rules the request carries, and the scenario (the
// harness replays it) is left out.

import type { ModRequest, ModSpec, Patch, Rule, StatusDef, TypeDef } from '@lsw/engine'
import type { Harness, EpisodeEntry, Episode as AgentEpisode, Lesson, SkillMeta } from '@lsw/agent'

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
    `${h.design.toolRounds > 0 ? 5 : 4}. Answer with ONLY one JSON object: {"patch": {"artifacts": [...], "note": "<what the rule does, one line>"}, "summary": "<one line for your records>"}`,
    '',
    'Requirements:',
    '- Rule ids start with "patch/" and must be new.',
    h.design.tests === 'harness'
      ? '- Every rule has a one-line `doc` and player-visible feedback (vfx and/or log/say). Do not write tests: the harness keeps the scene that asked as the rule\'s test.'
      : '- Every rule has a one-line `doc`, player-visible feedback (vfx and/or log/say), and at least one test (the triggering event is replayed automatically).',
    '- Prefer outcomes that change something (a status, a transformation, an item). A rule that only narrates is right only when nothing happening is clearly the most plausible outcome.',
    '- Answer the case that was asked (the target\'s class, the params given); a case you do not answer ends in {"undefined": true} so it stays open and is asked later. Never write `inherit`; give every `if` an `else`.',
    '- Nothing for nothing: if the outcome makes something (a stick shaken from a tree, food), let it cost or run out — use the instrument up, or change or spend the host (a status that clears with time, a prop that counts down) — so it is not a faucet pressed forever.',
    '- Your rule writes only its host; to affect anything else, emit an impulse to it and its receiver answers. Player-facing text is {"en": "...", "zh": "..."}; {host}, {actor}, {target}, {instrument}, {item} insert names.',
    '- If nothing should happen, still define it: {"do": []} (no change) or a short in-world line of feedback is a valid answer.',
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

/** The request as the model reads it: no scenario (the harness replays it); with a brief, no rules (the brief has them). */
export function requestView(req: ModRequest, brief: boolean): Omit<ModRequest, 'scenario'> {
  const { scenario: _s, ...rest } = req
  return brief ? { ...rest, context: { ...rest.context, rules: [] } } : rest
}

export function designUser(req: ModRequest, recall: Recall, brief?: string, added?: { types: TypeDef[]; statuses: StatusDef[] }, tools = true): string {
  const out = [`# Request ${req.id}`, req.summary, '', '```json', JSON.stringify(requestView(req, !!brief)), '```']
  if (brief) out.push('', brief)
  if (added && (added.types.length || added.statuses.length)) {
    out.push('', '# Types and statuses added by patches (beyond the ModSpec; use them like any other)')
    for (const t of added.types) out.push(`- type ${JSON.stringify({ id: t.id, tags: t.tags ?? [], name: t.name })}`)
    for (const s of added.statuses) out.push(`- status ${JSON.stringify({ id: s.id, duration: s.duration, immobilize: s.immobilize, moveDelay: s.moveDelay, clears: s.clears })}`)
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

export const NO_JSON = 'Your answer had no JSON patch. Answer with ONLY the JSON object: {"patch": {"artifacts": [...]}, "summary": "..."}'

export const FINALIZE = 'Stop investigating. Answer now with ONLY the JSON object: {"patch": {"artifacts": [...]}, "summary": "..."}'

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
A finding counts only if the sandbox shows it with the patch and not without it.`

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
    `The world is making ${creations.length === 1 ? 'a new thing' : 'new things'}: ${creations.map((c) => `${c.id} (${c.name.en} / ${c.name.zh})`).join(', ')}.`,
    'Write the patch with, for each, a type artifact beside your rule(s):',
    '{"kind": "type", "type": {"id": "<parent>/<snake_case>", "name": {"en": "...", "zh": "..."}, "tags": ["only what it adds to its parent"], "props": {"material": "<one of the materials>"}, "makeup": [{"type": "<a type the world has>", "count": 1}], "station": "hands | workbench (optional)"}}',
    '- The parent must exist; the new type inherits its tags and its rules, so choose the parent whose behaviour fits (an ingot under item/material, a dish under item/food).',
    '- Its name is what a player would call it, in both languages; it must not be another name for a thing the world has.',
    `- props.material: what it is made of, one of: ${materials.join(', ') || '(see the ModSpec)'}.`,
    '- makeup: the things it is made of, by type and count (an iron ingot: one iron ore); it is also what it leaves when broken, so it takes no more than the outcome took to make it.',
    '- station (optional): "hands" or "workbench" when a player could also make it there from its makeup; leave it out when only your rule makes it (smelting in a forge).',
    '- A new kind of ground (tile/...) cannot be made; make a thing that lies on the cell instead.',
    '- Do not draw it: an artist draws its icon next.',
    'Answer with ONLY the JSON object {"patch": {"artifacts": [...]}, "summary": "..."}.',
  ].join('\n')
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
