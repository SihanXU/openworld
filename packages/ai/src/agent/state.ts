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
import { BACKEND_DOWN, Meter, parseJson, type CallRecord, type ChatOptions, type Model } from '../models/model.ts'
import { clip, similarity } from '../util.ts'

// ---------------------------------------------------------------- records

export type Outcome = 'accepted' | 'covered' | 'failed'

export interface Attempt<P = unknown> {
  /** design: a fresh draft; repair: after validator diagnostics; review: after a reviewer's notes; audit: after the auditor broke it; find, create: the router's later layers. */
  phase: 'design' | 'repair' | 'review' | 'audit' | 'find' | 'create'
  patch?: P
  errors: string[]
  warnings: string[]
  /** Deterministic repairs the harness applied before validating (answer.ts). */
  fixes?: string[]
  /** The harness-derived generalization test, or why there is none (answer.ts). */
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
  /** The kind of task it is, for its skill: one skill a node (a world request's, request.ts `skillNodeOf`; else `kind:<kind>`). */
  node?: string
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
  node?: string
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
  /** Signature terms that suggest the skill (a skill of a node has none: its node says where it applies). */
  triggers: string[]
  /** The kind of task it is the skill of (one a node); none: an older skill, shown by its triggers. */
  node?: string
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
  /** prepare the roles and related rules up front (request.ts) */
  brief?: boolean
  reasoning?: Reasoning
  /** who writes the generalization test: the model, or the harness (answer.ts) */
  tests?: 'model' | 'harness'
  /**
   * The deterministic repairs of an answer's mechanical slips (answer.ts: its shape, bare terrains, a recipe's station;
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
/** Notes kept on a kind of task with no skill yet (the latest). */
const PENDING_MAX = 10
/** A skill is rewritten whole each time: at most this many lines (merged, not appended to). */
export const SKILL_MAX_LINES = 40

/** A note on a kind of task with no skill yet. */
export interface PendingNote {
  text: string
  episode: string
  at: string
}

/** The name of a node's skill: the node as a file name, with a hash of it (names are cut short: two nodes never share one). */
export function nodeSkillName(node: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < node.length; i++) h = Math.imul(h ^ node.charCodeAt(i), 0x01000193) >>> 0
  return `${safeName(node.replace(/[|/:]+/g, '-')).slice(0, 39).replace(/-+$/, '')}-${h.toString(36).padStart(7, '0').slice(-7)}`
}
const RETIRE_MARGIN = 0.2

// ---------------------------------------------------------------- the store

export class SelfState {
  private index: EpisodeEntry[] = []
  private lessonList: Lesson[] = []
  private skillIndex: Record<string, SkillMeta> = {}
  private pending: Record<string, PendingNote[]> = {}
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
    s.pending = readJson(fs, fs.join(dir, 'memory/pending.json'), {})
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
      ...(ep.node && { node: ep.node }),
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
  applyLessons(ops: { add?: { text: string; terms?: string[]; general?: boolean }[]; revise?: { id: string; text: string }[]; drop?: string[]; support?: string[] }, episode: string | string[], defaultTerms: string[]): string[] {
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
      // a general lesson (engineering anywhere, not this codebase) has no terms: every task is shown it
      const terms = a.general === true ? [] : Array.isArray(a.terms) && a.terms.length ? a.terms.map(String) : defaultTerms
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

  /**
   * The active skills a task is shown: its node's (one at most), the general ones (no node, no triggers), and an
   * older skill (no node) whose triggers it has.
   */
  relevantSkills(terms: string[], node?: string): SkillMeta[] {
    const set = new Set(terms)
    return this.skills().filter((s) => (s.node ? s.node === node : !s.triggers?.length || s.triggers.some((t) => set.has(t))))
  }

  /** The skill of a kind of task, if it has one. */
  skillAt(node: string): SkillMeta | undefined {
    return this.skills().find((s) => s.node === node)
  }

  /** The tasks of a node so far (cache hits aside). */
  nodeEpisodes(node: string): number {
    return this.index.filter((e) => e.node === node && e.outcome !== 'covered').length
  }

  // ---------------------------------------------------------------- notes on a kind of task with no skill yet

  /** What was learned about a kind of task before it has a skill: kept on its node, written into the skill when one is made. */
  pendingAt(node: string): PendingNote[] {
    if (this.ablated.has('memory')) return []
    return this.pending[node] ?? []
  }

  addPending(node: string, texts: string[], episode: string): void {
    const now = this.now()
    const kept = this.pending[node] ?? []
    for (const t of texts.map((x) => String(x ?? '').trim()).filter(Boolean)) if (!kept.some((k) => k.text === t)) kept.push({ text: t, episode, at: now })
    this.pending[node] = kept.slice(-PENDING_MAX)
    this.savePending()
  }

  clearPending(node: string): void {
    if (!this.pending[node]) return
    delete this.pending[node]
    this.savePending()
  }

  private savePending(): void {
    writeJson(this.fs, this.fs.join(this.dir, 'memory/pending.json'), this.pending)
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
  writeSkill(s: { name: string; description: string; triggers: string[]; node?: string; body: string; files?: Record<string, string> }, episode?: string): SkillMeta {
    const name = safeName(s.name)
    const now = this.now()
    const prev = this.skillIndex[name]
    // (written again after it was retired: the new text is judged on its own uses, not the retired one's)
    const fresh = prev?.status === 'retired' ? { uses: 0, accepted: 0, failed: 0, recent: [], origin: episode } : {}
    const meta: SkillMeta = prev
      ? { ...prev, ...fresh, description: s.description, triggers: s.triggers, ...(s.node && { node: s.node }), version: prev.version + 1, status: 'active', updated: now }
      : { name, description: s.description, triggers: s.triggers, ...(s.node && { node: s.node }), version: 1, status: 'active', created: now, updated: now, origin: episode, uses: 0, accepted: 0, failed: 0, recent: [] }
    this.skillIndex[name] = meta
    this.fs.mkdir(this.fs.join(this.dir, 'skills', name))
    const front = ['---', `name: ${name}`, `description: ${s.description.replace(/\n/g, ' ')}`, ...(s.node ? [`node: ${s.node}`] : [`triggers: ${s.triggers.join(', ')}`]), `version: ${meta.version}`, '---', ''].join('\n')
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

// ---------------------------------------------------------------- reflection
// The middle loop: after an episode, what is worth keeping. A reflection writes two places only:
// - the global rules (lessons): one sentence that holds for every task of this kind, or for engineering anywhere;
// - this kind of task (its node): its skill, rewritten whole, when it has one; else a note kept on the node, until
//   the node has recurred and gone wrong enough to be worth a skill, which is then written from its notes.
// One node has one skill at most, named from the node, so two reflections at once never write two.

/** What every reflection answers, and how (the agent's and the modder's alike). `general` says what a general rule is about. */
export const reflectFormat = (general: string): string => `Respond with JSON only:
{
  "rules": { "add": [{"text": "...", "scope": "kind"}], "revise": [{"id": "L3", "text": "..."}], "support": ["L2"], "drop": ["L5"] },
  "notes": [],
  "skill": null
}

Rules (yours on file are listed with their ids):
- A rule is one sentence that holds for every task of this kind ("scope": "kind"), or ${general} ("scope": "general"). Never a retelling of this task, never about one kind of thing in it: that goes to the skill or the notes below.
- A rule about a time limit, or about answering fast, is never general.
- The most valuable rules come from what went wrong. Add at most one; often none is right. "support" rules this task confirmed; "revise" or "drop" rules it contradicted.

This kind of task (the last section says which it is, and what you keep on it):
- If it has a skill and this task taught something about this kind of task, rewrite the skill whole in "skill": {"description": "when to use it, one line", "body": "markdown: when it applies, the steps, the checks, the pitfalls"}, at most ${SKILL_MAX_LINES} lines, merging what you learned into it, not appending. Otherwise "skill": null.
- If you are asked to write its skill, write it the same way, from the notes and this task.
- Otherwise put in "notes" what this task taught about this kind of task: at most two one-line pitfalls or patterns, or []. They are kept until its skill is written.`

export const AGENT_REFLECT_SYSTEM = `You keep your own memory as a software engineer who works tasks in repositories. After every task you decide what is worth keeping, so that the next task goes better. Your memory is read only by you.

${reflectFormat('for engineering in any repository: how to find code, test, read a failure, scope a change')}
- A skill may carry scripts in "files": {"script.mjs": "…"}, which you run with your run tool from .agent/skills/<name>/.`

/** Where a kind of task stands when it is reflected on: its skill, or its notes and whether it is due for a skill. */
export interface NodeStand {
  node: string
  skill?: SkillMeta
  body?: string
  notes: PendingNote[]
  /** its tasks so far, this one among them */
  count: number
  /** no skill yet, recurred often enough, and something went wrong (a note on file, or this task) */
  due: boolean
}

export function nodeStand(state: SelfState, node: string, h: Harness, troubled: boolean): NodeStand {
  const skill = state.skillAt(node)
  const notes = state.pendingAt(node)
  const count = state.nodeEpisodes(node)
  return { node, skill, body: skill && state.readSkill(skill.name)?.trim(), notes, count, due: !skill && count >= h.reflect.skillMinRecurrence && (notes.length > 0 || troubled) }
}

/** The prompt's section on this kind of task. */
export function nodeSection(s: NodeStand): string[] {
  const head = `## This kind of task: ${s.node} (${s.count} task(s) so far)`
  if (s.skill) return [head, `Your skill for it (v${s.skill.version}, used ${s.skill.uses}×, ${s.skill.accepted} accepted):`, '', s.body ?? '']
  const notes = s.notes.length ? s.notes.map((n) => `- ${n.text}`) : ['(none)']
  return s.due ? [head, 'No skill yet. It has recurred and gone wrong; your notes on it:', ...notes, '', 'Write its skill now, in "skill".'] : [head, 'No skill yet. Your notes on it:', ...notes]
}

/** An episode's node: the world's, else its kind's. */
export const nodeOf = (ep: Pick<Episode, 'node' | 'kind'>): string => ep.node ?? `kind:${ep.kind ?? 'task'}`

/** Something went wrong in it: a failure, or an attempt sent back. */
export const troubled = (ep: Episode): boolean => ep.outcome === 'failed' || ep.attempts.some((a) => a.errors.length > 0)

export async function reflectAgent(ep: Episode, o: { model: Model; state: SelfState; harness?: Harness; kindTerm?: string }): Promise<void> {
  const { state } = o
  const h = o.harness ?? state.harness()
  if (!h.reflect.enabled) return
  const model = new Meter(o.model)
  const kindTerm = o.kindTerm ?? `kind:${ep.kind}`
  const stand = nodeStand(state, nodeOf(ep), h, troubled(ep))
  const similar = state.similarEpisodes(ep.terms, 8, ep.id).filter((e) => e.kind === ep.kind)
  const tools: Record<string, number> = {}
  for (const t of ep.tools) tools[t.name] = (tools[t.name] ?? 0) + 1
  const user = [
    `# Task ${ep.id} (${ep.kind}): ${ep.summary}`,
    `outcome: ${ep.outcome} after ${ep.usage.calls} model calls${ep.error ? ` — ${ep.error}` : ''}`,
    '',
    '## Test runs and verdict',
    ...(ep.attempts.length ? ep.attempts.map((a, i) => `${i + 1}. ${a.errors.length ? `failed: ${clip(a.errors[0], 600)}` : 'passed'}`) : ['(no test runs)']),
    '',
    '## Tools used',
    Object.entries(tools).map(([k, v]) => `${k}×${v}`).join(', ') || '(none)',
    `skills read: ${ep.skillsRead.join(', ') || '(none)'}`,
    '',
    '## Your rules on file (relevant)',
    ...state.relevantLessons([...ep.terms, kindTerm], 20).map((l) => `- [${l.id}] ${l.text}`),
    '',
    `## Similar past tasks (${similar.length})`,
    ...similar.map((e) => `- ${e.summary} → ${e.outcome}`),
    '',
    ...nodeSection(stand),
  ].join('\n')
  const r = await model.chat(
    [
      { role: 'system', content: AGENT_REFLECT_SYSTEM },
      { role: 'user', content: user },
    ],
    { json: true, temperature: 0.2, purpose: 'reflect', reasoning: h.reflect.reasoning, provider: h.agent.provider },
  )
  const kept = keepReflection(state, r.content, { cited: ep.id, kindTerm, stand, files: true })
  state.note('reflect', { episode: ep.id, kind: ep.kind, node: stand.node, lessons: kept.lessons, skill: kept.skill, notes: kept.notes, usage: model.usage })
}

/**
 * Reflect after a task an unattended agent worked and recorded (a world task, an engine task, a task from the
 * history, an upstream proposal): every recorded task feeds the middle loop. A failure that is the backend's is
 * no lesson.
 */
export async function reflectAfter(ep: Episode, o: { model: Model; state: SelfState; harness?: Harness; kindTerm?: string }): Promise<void> {
  if (ep.outcome === 'failed' && BACKEND_DOWN.test(ep.error ?? '')) return
  await reflectAgent(ep, o)
}

type RuleOps = { add?: { text: string; scope?: unknown; general?: unknown; terms?: string[] }[]; revise?: { id: string; text: string }[]; support?: string[]; drop?: string[] }

/**
 * A reflection's reply kept in the self-state: its rules applied to the lessons (filed under the task's kind,
 * `kindTerm`, or general; citing the episodes), and this kind of task (`stand`; none for a batch of several kinds)
 * to its skill or its notes. Scripts are kept only where the reflection may write them (`files`).
 */
export function keepReflection(state: SelfState, reply: string, o: { cited: string | string[]; kindTerm: string; stand?: NodeStand; files?: boolean }): { lessons: string[]; skill?: string; notes: number } {
  const j = parseJson(reply) as { rules?: RuleOps; lessons?: RuleOps; notes?: unknown; skill?: { description?: unknown; body?: unknown; files?: unknown } | null } | undefined
  const by = Array.isArray(o.cited) ? o.cited[o.cited.length - 1] : o.cited
  // (an older reply's "lessons" keep their own terms)
  const ops = j?.rules && typeof j.rules === 'object' ? { ...j.rules, add: (Array.isArray(j.rules.add) ? j.rules.add : []).map((a) => ({ text: a?.text, general: a?.scope === 'general' || a?.general === true, terms: [o.kindTerm] })) } : j?.lessons && typeof j.lessons === 'object' ? j.lessons : undefined
  const lessons = ops ? state.applyLessons(ops as Parameters<SelfState['applyLessons']>[0], o.cited, [o.kindTerm]) : []
  const s = o.stand
  if (!s) return { lessons, notes: 0 }
  const sk = j?.skill
  // (another reflection on this node wrote its skill since this one read it: that one stands, this one's is not kept)
  if (state.skillAt(s.node)?.version !== s.skill?.version) return { lessons, notes: 0 }
  if (sk && typeof sk.body === 'string' && sk.body.trim() && (s.skill || s.due)) {
    const body = sk.body.trim().split('\n').slice(0, SKILL_MAX_LINES + 10).join('\n')
    const files = o.files && sk.files && typeof sk.files === 'object' ? (Object.fromEntries(Object.entries(sk.files as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string>) : undefined
    const name = s.skill?.name ?? nodeSkillName(s.node)
    state.writeSkill({ name, node: s.node, triggers: [], description: String(sk.description ?? s.skill?.description ?? s.node), body, ...(files && { files }) }, by)
    // what was kept on the node is in the skill now
    if (!s.skill) state.clearPending(s.node)
    return { lessons, skill: name, notes: 0 }
  }
  const notes = !s.skill && Array.isArray(j?.notes) ? j!.notes.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 2) : []
  if (notes.length) state.addPending(s.node, notes, by)
  return { lessons, notes: notes.length }
}
