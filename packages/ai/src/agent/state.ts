// The agent's self-state (docs/rsi.md §4): memory, skills, harness. Plain files in one
// directory, so every part can be read, diffed, versioned, ablated and rolled back:
//
//   memory/episodes/<id>.json   every task: attempts, diagnostics, tools used, outcome
//   memory/index.jsonl          one line per episode (what retrieval reads)
//   memory/lessons.json         distilled rules of thumb, each linked to its episodes
//   memory/lessons.md           the same, for people
//   skills/<name>/SKILL.md      procedural skills the agent wrote for itself (+ scripts beside it)
//   skills/index.json           usage, outcomes, provenance per skill
//   harness/pipeline.json       the shape of its working loop
//   harness/hooks/<stage>/*.mjs code it wrote for its own loop (run in the task sandbox)
//   harness/CHANGELOG.md        every harness change and why
//   journal.jsonl               append-only log of every write above
//   snapshots/<label>/          frozen copies (benchmark checkpoints, ablations, rollback)
//
// The files are reached through `Files` (files.ts): a directory on disk under Node, or files in memory in a
// browser's worker (the player's own modder, docs/byok.md), which keeps them where it likes.

import { defaultFiles, type Files } from './files.ts'
import type { CallRecord, ChatOptions } from '../models/model.ts'
import { similarity } from '../util.ts'

// ---------------------------------------------------------------- records

export type Outcome = 'accepted' | 'covered' | 'failed'

export interface Attempt<P = unknown> {
  /** design: a fresh draft; repair: after validator diagnostics; review: after a reviewer's notes; audit: after the auditor broke it; find, create: the router's later layers. */
  phase: 'design' | 'repair' | 'review' | 'audit' | 'find' | 'create'
  patch?: P
  errors: string[]
  warnings: string[]
  /** Deterministic repairs the harness applied before validating (fixes.ts). */
  fixes?: string[]
  /** The harness-derived generalization test, or why there is none (derive.ts). */
  derived?: string[]
  /** Reviewer verdict on a valid draft, when the review stage ran. */
  review?: { verdict: string; notes: string[] }
  /** What the auditor broke in the sandbox (confirmed), and how many of its claims did not hold. */
  audit?: { confirmed: string[]; unconfirmed: number }
  /** The answer as the model gave it, when no patch could be read from it (clipped). */
  raw?: string
}

/**
 * One task the agent worked: a world interaction (Req = the ModRequest, P = a Patch), a world task
 * in repo form, an engine issue, a SWE task (Req = the task spec, P = a diff).
 */
export interface Episode<Req = unknown, P = unknown> {
  id: string
  at: string
  /** world (the patch pipeline) | world-repo | engine | swe | …: what kind of task */
  kind?: string
  summary: string
  /** live: a player was waiting; offline: curriculum, escalation or revision */
  profile?: Profile
  /** escalated from this failed live episode */
  escalatedFrom?: string
  /** a revision of this episode's rules, after a late review */
  revises?: string
  /** the layers of the router the episode went through (world episodes): local, then find, then create */
  route?: ('local' | 'find' | 'create')[]
  /** the things the design asked for beyond the request, by name, and the types it created */
  needed?: string[]
  created?: string[]
  /** what the answer judged its host affords for the act (world episodes, design.md §5.17): use, words or none */
  affords?: string
  /** the AI setting the request was asked at (world episodes; the engine's quality.ts): the tier its answer is kept in, and how far it could go in making new kinds */
  quality?: { tier: string; create: string }
  request: Req
  key: string
  terms: string[]
  outcome: Outcome
  attempts: Attempt<P>[]
  tools: { name: string; args: unknown; ms: number }[]
  /** Rules that now answer the interaction (new ones when accepted). */
  rules: string[]
  patch?: P
  /** What was put in front of the agent: retrieval is part of the record. */
  shown: { lessons: string[]; episodes: string[]; skills: string[] }
  skillsRead: string[]
  harness: number
  model?: string
  /** cost in USD, when the provider reports it */
  usage: { calls: number; input: number; output: number; cost?: number }
  /** one record per model call: where the time went */
  calls?: CallRecord[]
  ms: number
  error?: string
  /** Where an error the program threw came from (its stack's first lines): a failure no model output explains. */
  stack?: string
  /** the agent's own one-line summary when it submitted (repo-form tasks) */
  submission?: string
}

type Reasoning = ChatOptions['reasoning']

export interface EpisodeEntry {
  id: string
  at: string
  kind?: string
  key: string
  terms: string[]
  summary: string
  outcome: Outcome
  rules: string[]
  attempts: number
  calls: number
  cost?: number
  ms: number
}

export interface Lesson {
  id: string
  text: string
  /** Signature terms it applies to; empty = always relevant. */
  terms: string[]
  episodes: string[]
  status: 'active' | 'dropped'
  created: string
  updated: string
}

export interface SkillMeta {
  name: string
  description: string
  /** Signature terms that suggest the skill. */
  triggers: string[]
  version: number
  status: 'active' | 'retired'
  created: string
  updated: string
  /** The episode it was written after. */
  origin?: string
  uses: number
  accepted: number
  failed: number
  recent: string[]
}

export interface DesignConfig {
  /** json: the patch pipeline (one call or a tool conversation); repo: the agent works the task as a repository */
  mode?: 'json' | 'repo'
  /** 0 = one call, no tools: answer from the brief */
  toolRounds: number
  temperature: number
  /** prepare the roles and related rules up front (brief.ts) */
  brief?: boolean
  reasoning?: Reasoning
  /** who writes the generalization test: the model, or the harness (derive.ts) */
  tests?: 'model' | 'harness'
  /**
   * The deterministic repairs of an answer's mechanical slips (fixes.ts: its shape, bare terrains, a recipe's station;
   * brackets): on unless false. Off (an ablation, paper §7.1), an answer that needed one is an invalid attempt.
   */
  fixes?: boolean
  /** The router (one call: the catalogue found, a new kind made, on request): on unless false. Off (an ablation), local only. */
  router?: boolean
  /** tail guard per call (ms; 0 = off): second request after hedgeMs, give up a try after deadlineMs */
  hedgeMs?: number
  deadlineMs?: number
  retries?: number
  /** provider preferences (OpenRouter): unset = the pinned order from the environment (fastest, by measurement) */
  provider?: Record<string, unknown>
}

export type Profile = 'live' | 'offline'

/**
 * The SWE-style agent loop (loop.ts): the part of the harness that transfers. The same loop works
 * a world task in repo form, an engine issue, and a benchmark repository.
 */
export interface AgentConfig {
  maxSteps: number
  temperature: number
  reasoning?: Reasoning
  /** characters of one tool result kept in the conversation */
  maxToolOutput: number
  /** ask for a short plan before the first tool call */
  planFirst: boolean
  /** memory put in front of the agent */
  recall: { lessons: number; episodes: number }
  /** scripts the agent wrote for its own loop: harness/hooks/<stage>/<name>.mjs, run in the task sandbox */
  hooks: { start: string[]; presubmit: string[] }
  provider?: Record<string, unknown>
  hedgeMs?: number
  deadlineMs?: number
  retries?: number
}

export interface Harness {
  version: number
  /** the agent loop (repo-form tasks): what the outer loop improves */
  agent: AgentConfig
  design: DesignConfig
  repair: { maxRounds: number }
  /**
   * blocking: the reviewer runs before the patch ships (else after it, and may trigger a revision).
   * unflagged: a review after the fact also for rules the harness flagged nothing in (else only
   * for flagged ones: rules that only narrate, or did not generalize).
   */
  review: { enabled: boolean; maxRounds: number; blocking?: boolean; unflagged?: boolean; reasoning?: Reasoning }
  /**
   * The auditor (design.md §13): an agent that tries to break a patch in the sandbox; only what the
   * sandbox shows, with the patch and not without it, counts. blocking: before the patch ships (a
   * finding goes back to the designer); else after it (a finding takes the patch out of the library
   * and sends it back for a revision). rounds: its tool calls. Absent in an older harness: the default.
   */
  audit?: { enabled: boolean; blocking?: boolean; rounds: number; reasoning?: Reasoning }
  recall: { episodes: number; lessons: number }
  /**
   * batch: live episodes that went cleanly (accepted at the first answer, nothing flagged) are
   * reflected on together, this many to a call; every other episode is reflected on at once.
   */
  reflect: { enabled: boolean; skillMinRecurrence: number; batch?: number; reasoning?: Reasoning }
  /** Tools the design stage may call. */
  tools: string[]
  /** Instructions the modder has added to its own system prompt. */
  addenda: string[]
  offline: { design?: Partial<DesignConfig>; repair?: Partial<Harness['repair']>; review?: Partial<Harness['review']>; audit?: Partial<AuditConfig> }
  /** a live request that fails is worked again offline, in the background: the world still learns it */
  escalate: boolean
  /** a late review asking for changes sends the rule back for one offline revision */
  revise: boolean
  /** design: episodes worked at once, one per lane (live requests first); background: reviews, reflections, escalations at once */
  concurrency?: { design: number; background: number }
  /** remove: a learned rule set aside at run time by this many clients leaves the shared library (and is revised offline) */
  faults?: { remove: number }
}

/** The naive agent loop: the starting point of a self-improvement run (no hooks, no notes, no skills). */
export const NAIVE_AGENT: AgentConfig = {
  maxSteps: 40,
  temperature: 0.2,
  reasoning: 'medium',
  maxToolOutput: 6000,
  planFirst: false,
  recall: { lessons: 8, episodes: 3 },
  hooks: { start: [], presubmit: [] },
  // the agent lives on tool calls: providers by reliability (the cheapest returned empty turns), not price
  provider: { order: ['moonshotai', 'parasail', 'together'], allow_fallbacks: true },
}

/**
 * The base settings are the LIVE profile: a player is waiting, so one call from a prepared
 * brief, little reasoning, review after the fact. `offline` overrides them for work nobody
 * waits on — the curriculum, escalations of failed live requests, revisions — where quality
 * comes first.
 */
export const DEFAULT_HARNESS: Harness = {
  version: 1,
  agent: NAIVE_AGENT,
  design: { toolRounds: 0, temperature: 0.3, brief: true, reasoning: 'low', tests: 'harness', hedgeMs: 7000, deadlineMs: 15000, retries: 1 },
  repair: { maxRounds: 1 },
  review: { enabled: true, maxRounds: 1, blocking: false, unflagged: false, reasoning: 'low' },
  audit: { enabled: true, blocking: false, rounds: 6, reasoning: 'low' },
  recall: { episodes: 4, lessons: 12 },
  reflect: { enabled: true, skillMinRecurrence: 3, batch: 8, reasoning: 'low' },
  tools: ['search_rules', 'get_rule', 'find_types', 'get_type', 'dry_run', 'read_skill', 'get_episode'],
  addenda: [],
  offline: {
    design: { mode: 'repo', toolRounds: 10, brief: true, reasoning: 'medium', tests: 'model', hedgeMs: 0, deadlineMs: 0, provider: { sort: 'price' } },
    repair: { maxRounds: 3 },
    review: { blocking: true, reasoning: 'medium' },
    audit: { blocking: true, reasoning: 'medium' },
  },
  escalate: true,
  revise: true,
  concurrency: { design: 4, background: 3 },
  faults: { remove: 2 },
}

/** The harness as one profile sees it. */
export function profileOf(h: Harness, p: Profile): Harness {
  if (p === 'live') return h
  const o = h.offline ?? {}
  return { ...h, design: { ...h.design, ...o.design }, repair: { ...h.repair, ...o.repair }, review: { ...h.review, ...o.review }, audit: { ...auditOf(h), ...o.audit } }
}

export type AuditConfig = NonNullable<Harness['audit']>

/** The auditor's settings, an older harness's filled from the default. */
export function auditOf(h: Harness): AuditConfig {
  return { ...DEFAULT_HARNESS.audit!, ...h.audit }
}

/** A skill is retired once it has been used this often and does clearly worse than the average episode. */
const RETIRE_AFTER_USES = 6
const RETIRE_MARGIN = 0.2

// ---------------------------------------------------------------- the store

export class SelfState {
  private index: EpisodeEntry[] = []
  private lessonList: Lesson[] = []
  private skillIndex: Record<string, SkillMeta> = {}
  private harnessData: Harness = structuredClone(DEFAULT_HARNESS)
  /** USD spent after replies: reviews, reflections, the outer loop (episodes carry their own). */
  private backgroundSpend = 0
  /** JSON-lines files this instance has appended to: their tails are whole lines (appendLine). */
  private whole = new Set<string>()
  /** A throwaway copy (fork) whose directory goes when it is disposed. */
  private temporary = false

  private constructor(
    readonly dir: string,
    private clock: () => Date,
    readonly ablated: Set<Ablation>,
    /** Where its files are (Node's disk unless another is given). */
    readonly fs: Files,
  ) {}

  /** A throwaway copy (in a temp directory) to try a different harness or skill set on. */
  fork(): SelfState {
    const to = this.fs.tempDir('lsw-state-fork-')
    for (const d of COPIED) this.fs.copy(this.fs.join(this.dir, d), this.fs.join(to, d))
    const fork = SelfState.open(to, this.clock, [...this.ablated], this.fs)
    fork.temporary = true
    return fork
  }

  /** Remove a fork's directory (whoever forked calls it when done); a state that is not a fork is kept. */
  dispose(): void {
    if (this.temporary) this.fs.remove(this.dir)
  }

  static open(dir: string, clock: () => Date = () => new Date(), ablate: Ablation[] = [], fs: Files = defaultFiles()): SelfState {
    const s = new SelfState(dir, clock, new Set(ablate), fs)
    for (const d of ['memory/episodes', 'skills', 'harness', 'snapshots']) fs.mkdir(fs.join(dir, d))
    s.index = readLines<EpisodeEntry>(fs, fs.join(dir, 'memory/index.jsonl'), (line) => !!line.trim())
    for (const j of readLines<{ usage?: { cost?: number } }>(fs, fs.join(dir, 'journal.jsonl'), (line) => line.includes('"usage"')))
      s.backgroundSpend += j.usage?.cost ?? 0
    s.lessonList = readJson(fs, fs.join(dir, 'memory/lessons.json'), [])
    s.skillIndex = readJson(fs, fs.join(dir, 'skills/index.json'), {})
    const h = fs.join(dir, 'harness/pipeline.json')
    if (fs.exists(h)) s.harnessData = mergeHarness(readJson<Partial<Harness>>(fs, h, {}))
    else {
      writeJson(fs, h, s.harnessData)
      fs.write(fs.join(dir, 'harness/CHANGELOG.md'), `# Harness changelog\n\n- v1 (${s.now()}): the default pipeline.\n`)
    }
    if (!fs.exists(fs.join(dir, 'memory/lessons.md'))) s.renderLessons()
    return s
  }

  private now(): string {
    return this.clock().toISOString()
  }

  /** Append to the journal (every write to the self-state goes through here). */
  note(kind: string, data: Record<string, unknown>): void {
    this.backgroundSpend += (data.usage as { cost?: number } | undefined)?.cost ?? 0
    this.appendLine('journal.jsonl', { at: this.now(), kind, ...data })
  }

  /**
   * One record onto a JSON-lines file. A crash may have left the file's last line torn (no newline):
   * the record starts on a line of its own, so the torn one costs only itself.
   */
  private appendLine(name: string, record: unknown): void {
    const p = this.fs.join(this.dir, name)
    let text = JSON.stringify(record) + '\n'
    if (!this.whole.has(p) && this.fs.exists(p)) {
      const was = this.fs.read(p)
      if (was && !was.endsWith('\n')) text = '\n' + text
    }
    this.fs.append(p, text)
    this.whole.add(p)
  }

  // ---------------------------------------------------------------- harness

  harness(): Harness {
    return structuredClone(this.ablated.has('harness') ? DEFAULT_HARNESS : this.harnessData)
  }

  setHarness(h: Harness, reason: string, by?: string): void {
    const next = { ...h, version: this.harnessData.version + 1 }
    this.harnessData = next
    writeJson(this.fs, this.fs.join(this.dir, 'harness/pipeline.json'), next)
    this.fs.append(this.fs.join(this.dir, 'harness/CHANGELOG.md'), `- v${next.version} (${this.now()}${by ? `, ${by}` : ''}): ${reason}\n`)
    this.note('harness.set', { version: next.version, reason, by })
  }

  // ---------------------------------------------------------------- episodes

  newEpisodeId(): string {
    const t = this.now().replace(/[-:TZ.]/g, '').slice(0, 14)
    return `ep-${t}-${Math.random().toString(36).slice(2, 6)}`
  }

  recordEpisode(ep: Episode): void {
    writeJson(this.fs, this.fs.join(this.dir, 'memory/episodes', `${ep.id}.json`), ep)
    const entry: EpisodeEntry = {
      id: ep.id,
      at: ep.at,
      key: ep.key,
      terms: ep.terms,
      kind: ep.kind,
      summary: ep.summary,
      outcome: ep.outcome,
      rules: ep.rules,
      attempts: ep.attempts.length,
      calls: ep.usage.calls,
      cost: ep.usage.cost,
      ms: ep.ms,
    }
    this.index.push(entry)
    this.appendLine('memory/index.jsonl', entry)
    this.note('episode', { id: ep.id, outcome: ep.outcome, rules: ep.rules })
  }

  episodes(): EpisodeEntry[] {
    return [...this.index]
  }

  /** Journal entries of one kind (proposals, reviews, reflections…), oldest first. */
  journalOf(kind: string): Record<string, unknown>[] {
    return readLines(this.fs, this.fs.join(this.dir, 'journal.jsonl'), (line) => line.includes(`"kind":"${kind}"`))
  }

  /** A small JSON document kept with the memory (e.g. the outer loop's replay sets). */
  readDoc<T>(name: string, fallback: T): T {
    return readJson(this.fs, this.fs.join(this.dir, 'memory', `${safeName(name)}.json`), fallback)
  }

  writeDoc(name: string, value: unknown): void {
    writeJson(this.fs, this.fs.join(this.dir, 'memory', `${safeName(name)}.json`), value)
  }

  episode(id: string): Episode | undefined {
    const p = this.fs.join(this.dir, 'memory/episodes', `${id.replace(/[^\w.-]/g, '')}.json`)
    return this.fs.exists(p) ? readJson<Episode | undefined>(this.fs, p, undefined) : undefined
  }

  /** Past episodes most like these terms (cache hits excluded: nothing was learned there). */
  similarEpisodes(terms: string[], k: number, exclude?: string): (EpisodeEntry & { score: number })[] {
    if (this.ablated.has('memory')) return []
    return this.index
      .filter((e) => e.outcome !== 'covered' && e.id !== exclude)
      .map((e) => ({ ...e, score: similarity(terms, e.terms) }))
      .filter((e) => e.score > 0.3)
      .sort((a, b) => b.score - a.score || b.at.localeCompare(a.at))
      .slice(0, k)
  }

  // ---------------------------------------------------------------- lessons

  lessons(): Lesson[] {
    return this.lessonList.filter((l) => l.status === 'active')
  }

  relevantLessons(terms: string[], k: number): Lesson[] {
    if (this.ablated.has('memory')) return []
    const set = new Set(terms)
    const score = (l: Lesson) => (l.terms.length ? l.terms.filter((t) => set.has(t)).length / l.terms.length : 0.5) + 0.02 * l.episodes.length
    return this.lessons()
      .filter((l) => !l.terms.length || l.terms.some((t) => set.has(t)))
      .sort((a, b) => score(b) - score(a))
      .slice(0, k)
  }

  /**
   * Apply a reflection: new lessons, revised ones, dropped ones; each change cites the episode.
   * `episode`: the episode the reflection was on, or the episodes of a batch (each is cited).
   */
  applyLessons(ops: { add?: { text: string; terms?: string[] }[]; revise?: { id: string; text: string }[]; drop?: string[]; support?: string[] }, episode: string | string[], defaultTerms: string[]): string[] {
    const now = this.now()
    const touched: string[] = []
    const eps = Array.isArray(episode) ? episode : [episode]
    const active = (id: unknown) => this.lessonList.find((l) => l.id === id && l.status === 'active')
    const cite = (l: Lesson) => {
      let added = false
      for (const e of eps) if (!l.episodes.includes(e)) (l.episodes.push(e), (added = true))
      return added
    }
    for (const a of ops.add ?? []) {
      const text = String(a?.text ?? '').trim()
      if (!text || this.lessonList.some((l) => l.status === 'active' && l.text === text)) continue
      const id = `L${this.lessonList.length + 1}`
      const terms = Array.isArray(a.terms) && a.terms.length ? a.terms.map(String) : defaultTerms
      this.lessonList.push({ id, text, terms, episodes: [...eps], status: 'active', created: now, updated: now })
      touched.push(id)
      this.note('lesson.add', { id, episode })
    }
    for (const r of ops.revise ?? []) {
      const l = active(r?.id)
      const text = String(r?.text ?? '').trim()
      if (!l || !text) continue
      l.text = text
      l.updated = now
      cite(l)
      touched.push(l.id)
      this.note('lesson.revise', { id: l.id, episode })
    }
    for (const id of ops.support ?? []) {
      const l = active(id)
      if (l && cite(l)) touched.push(l.id)
    }
    for (const id of ops.drop ?? []) {
      const l = active(id)
      if (!l) continue
      l.status = 'dropped'
      l.updated = now
      touched.push(id)
      this.note('lesson.drop', { id, episode })
    }
    if (touched.length) {
      writeJson(this.fs, this.fs.join(this.dir, 'memory/lessons.json'), this.lessonList)
      this.renderLessons()
    }
    return touched
  }

  private renderLessons(): void {
    const lines = ['# Lessons', '', 'Distilled by the modder from its episodes. Each cites the episodes behind it.', '']
    for (const l of this.lessons()) lines.push(`- **${l.id}** ${l.text}  `, `  _terms:_ ${l.terms.join(', ') || '(general)'} · _episodes:_ ${l.episodes.join(', ')}`)
    this.fs.write(this.fs.join(this.dir, 'memory/lessons.md'), lines.join('\n') + '\n')
  }

  // ---------------------------------------------------------------- skills

  skills(all = false): SkillMeta[] {
    if (this.ablated.has('skills')) return []
    return Object.values(this.skillIndex).filter((s) => all || s.status === 'active')
  }

  skill(name: string): SkillMeta | undefined {
    return this.skillIndex[name]
  }

  readSkill(name: string): string | undefined {
    const meta = this.skillIndex[name]
    const p = this.fs.join(this.dir, 'skills', safeName(name), 'SKILL.md')
    if (!meta || meta.status !== 'active' || !this.fs.exists(p) || this.ablated.has('skills')) return undefined
    return this.fs.read(p).replace(/^---[\s\S]*?---\s*/, '')
  }

  /** Write a new skill or a new version of one. */
  writeSkill(s: { name: string; description: string; triggers: string[]; body: string; files?: Record<string, string> }, episode?: string): SkillMeta {
    const name = safeName(s.name)
    const now = this.now()
    const prev = this.skillIndex[name]
    const meta: SkillMeta = prev
      ? { ...prev, description: s.description, triggers: s.triggers, version: prev.version + 1, status: 'active', updated: now }
      : { name, description: s.description, triggers: s.triggers, version: 1, status: 'active', created: now, updated: now, origin: episode, uses: 0, accepted: 0, failed: 0, recent: [] }
    this.skillIndex[name] = meta
    this.fs.mkdir(this.fs.join(this.dir, 'skills', name))
    const front = ['---', `name: ${name}`, `description: ${s.description.replace(/\n/g, ' ')}`, `triggers: ${s.triggers.join(', ')}`, `version: ${meta.version}`, '---', ''].join('\n')
    this.fs.write(this.fs.join(this.dir, 'skills', name, 'SKILL.md'), front + s.body.trim() + '\n')
    // scripts the skill runs (in the task sandbox, through the agent's run tool)
    for (const [file, code] of Object.entries(s.files ?? {}).slice(0, MAX_SKILL_FILES))
      if (typeof code === 'string' && code.length <= MAX_SCRIPT_BYTES && safeFile(file) !== 'SKILL.md') this.fs.write(this.fs.join(this.dir, 'skills', name, safeFile(file)), code)
    this.saveSkills()
    this.note(prev ? 'skill.revise' : 'skill.write', { name, version: meta.version, episode })
    return meta
  }

  /** The files of a skill (SKILL.md and its scripts), to put into a task workspace. */
  skillFiles(name: string): Record<string, string> {
    const d = this.fs.join(this.dir, 'skills', safeName(name))
    if (!this.fs.exists(d) || this.ablated.has('skills')) return {}
    return Object.fromEntries(this.fs.list(d).map((f) => [f, this.fs.read(this.fs.join(d, f))]))
  }

  // ---------------------------------------------------------------- hooks (code for its own loop)

  writeHook(stage: HookStage, name: string, code: string, by?: string): void {
    const d = this.fs.join(this.dir, 'harness/hooks', stage)
    this.fs.mkdir(d)
    this.fs.write(this.fs.join(d, `${safeName(name)}.mjs`), code)
    this.note('hook.write', { stage, name: safeName(name), by })
  }

  hookCode(stage: HookStage, name: string): string | undefined {
    const p = this.fs.join(this.dir, 'harness/hooks', stage, `${safeName(name)}.mjs`)
    return this.fs.exists(p) ? this.fs.read(p) : undefined
  }

  /** Book an episode's outcome against the skills it read; retire skills that keep doing worse. */
  noteSkillUse(names: string[], outcome: Outcome, episode: string): string[] {
    const retired: string[] = []
    if (!names.length) return retired
    const base = this.passRate()
    for (const n of new Set(names)) {
      const s = this.skillIndex[n]
      if (!s) continue
      s.uses++
      if (outcome === 'accepted') s.accepted++
      if (outcome === 'failed') s.failed++
      s.recent = [...s.recent, episode].slice(-20)
      const rate = s.accepted / Math.max(1, s.accepted + s.failed)
      if (s.status === 'active' && s.uses >= RETIRE_AFTER_USES && rate < base - RETIRE_MARGIN) {
        s.status = 'retired'
        retired.push(n)
        this.note('skill.retire', { name: n, rate, base, episode })
      }
    }
    this.saveSkills()
    return retired
  }

  private saveSkills(): void {
    writeJson(this.fs, this.fs.join(this.dir, 'skills/index.json'), this.skillIndex)
  }

  // ---------------------------------------------------------------- numbers, snapshots, export

  passRate(): number {
    const tried = this.index.filter((e) => e.outcome !== 'covered')
    return tried.length ? tried.filter((e) => e.outcome === 'accepted').length / tried.length : 1
  }

  stats() {
    const tried = this.index.filter((e) => e.outcome !== 'covered')
    const accepted = tried.filter((e) => e.outcome === 'accepted')
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0)
    const spent = this.index.reduce((a, e) => a + (e.cost ?? 0), 0) + this.backgroundSpend
    return {
      episodes: this.index.length,
      covered: this.index.length - tried.length,
      accepted: accepted.length,
      failed: tried.length - accepted.length,
      passRate: Math.round(this.passRate() * 1000) / 1000,
      attemptsPerAccepted: avg(accepted.map((e) => e.attempts)),
      callsPerEpisode: avg(tried.map((e) => e.calls)),
      msPerEpisode: Math.round(avg(tried.map((e) => e.ms))),
      /** USD: everything the model cost, and per accepted patch (reflection included) */
      spend: Math.round(spent * 10000) / 10000,
      costPerAccepted: accepted.length ? Math.round((spent / accepted.length) * 10000) / 10000 : 0,
      lessons: this.lessons().length,
      skills: this.skills().length,
      retiredSkills: this.skills(true).length - this.skills().length,
      harness: this.harnessData.version,
    }
  }

  /** Freeze the whole self-state under a label (for the benchmark runs, ablations, rollback). */
  snapshot(label: string, extra: Record<string, unknown> = {}): string {
    const name = safeName(label)
    const to = this.fs.join(this.dir, 'snapshots', name)
    if (this.fs.exists(to)) throw new Error(`snapshot "${name}" exists`)
    this.fs.mkdir(to)
    for (const d of COPIED) this.fs.copy(this.fs.join(this.dir, d), this.fs.join(to, d))
    const journal = this.fs.join(this.dir, 'journal.jsonl')
    if (this.fs.exists(journal)) this.fs.copy(journal, this.fs.join(to, 'journal.jsonl'))
    writeJson(this.fs, this.fs.join(to, 'meta.json'), { label: name, at: this.now(), stats: this.stats(), ...extra })
    this.fs.write(this.fs.join(to, 'SELF.md'), this.render())
    this.note('snapshot', { label: name })
    return to
  }

  snapshots(): string[] {
    const d = this.fs.join(this.dir, 'snapshots')
    return this.fs.exists(d) ? this.fs.list(d) : []
  }

  /**
   * The transferable part of the self-state as one document — skills and lessons, nothing
   * world-specific in its form — to put in front of the same model on any coding task.
   */
  render(): string {
    const out = ['# Self-state', '', `Formed over ${this.index.length} episodes of patching a rule-based world (harness v${this.harnessData.version}).`, '']
    out.push('## Skills', '')
    for (const s of this.skills()) out.push(`### ${s.name}`, '', `_${s.description}_`, '', this.readSkill(s.name)?.trim() ?? '', '')
    if (!this.skills().length) out.push('(none yet)', '')
    out.push('## Lessons', '')
    for (const l of this.lessons()) out.push(`- ${l.text}`)
    if (!this.lessons().length) out.push('(none yet)')
    if (this.harnessData.addenda.length) out.push('', '## Working notes', '', ...this.harnessData.addenda.map((a) => `- ${a}`))
    return out.join('\n') + '\n'
  }
}

// ---------------------------------------------------------------- files

/** A harness file over the defaults, section by section (a file written before a setting existed still gets it). */
function mergeHarness(file: Partial<Harness>): Harness {
  const d = structuredClone(DEFAULT_HARNESS) as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(file)) d[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(d[k] as object), ...v } : v
  return d as unknown as Harness
}

/** The parsed lines of a JSON-lines file that `keep` passes (a torn line is skipped). */
function readLines<T = Record<string, unknown>>(fs: Files, path: string, keep: (line: string) => boolean): T[] {
  if (!fs.exists(path)) return []
  const out: T[] = []
  for (const line of fs.read(path).split('\n'))
    if (keep(line))
      try {
        out.push(JSON.parse(line))
      } catch {
        /* torn line */
      }
  return out
}

function readJson<T>(fs: Files, path: string, fallback: T): T {
  try {
    return JSON.parse(fs.read(path)) as T
  } catch {
    return fallback
  }
}

/** Write via a temp file so a crash never leaves half a file. */
function writeJson(fs: Files, path: string, value: unknown): void {
  const tmp = `${path}.tmp`
  fs.write(tmp, JSON.stringify(value, null, 1) + '\n')
  fs.rename(tmp, path)
}

export type HookStage = 'start' | 'presubmit'

/** Parts of the self-state an ablation run leaves out (docs/rsi.md §6). */
export type Ablation = 'memory' | 'skills' | 'harness'

/** What a fork and a snapshot copy. */
const COPIED = ['memory', 'skills', 'harness']
const MAX_SKILL_FILES = 6
const MAX_SCRIPT_BYTES = 40_000

/** A file name inside a skill: no directories, no dot-files. */
export function safeFile(s: string): string {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 64) || 'script.mjs'
}

export function safeName(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'unnamed'
}
