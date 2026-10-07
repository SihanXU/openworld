// The modder: one undefined outcome in, one validated patch out, and a self-state that
// is a little different afterwards (docs/rsi.md §3).
//
//   comprehend  signature of the request; the shared library may already answer it (no model)
//   recall      lessons, similar episodes and skills from the self-state; the brief (brief.ts)
//   design      the model's answer: one call from the brief (live), or a tool-using conversation
//   fix         mechanical repairs and the derived generalization test, without the model (fixes.ts, derive.ts)
//   verify      the engine's validator; its diagnostics go back into the conversation (repair)
//   review      before shipping (offline), or after it (live), when it may send the rule back
//   commit      append to the shared library (re-validated against it as it is now)
//   record      the episode, every attempt and diagnostic in it, skill bookkeeping
//   reflect     after replying: distil lessons, write or revise a skill
//
// Two profiles of one harness (state.ts): LIVE while a player waits, OFFLINE for everything
// nobody waits on — curriculum, a failed live request worked again, a revision after review.

import { artProblems, buildModSpec, closestTypes, type ModProgress, type ModRequest, type ModWorkspace, type Patch, type PixelArt, type ResolveBody, type ResolveReply, type TypeDef } from '@lsw/engine'
import { briefOf, relatedRules } from './brief.ts'
import { changesNothing, deriveTests } from './derive.ts'
import { narrowKinds, normalizePatch, qualifyTerrains } from './fixes.ts'
import type { WorldLibrary } from './library.ts'
import { Meter, parseJson, reflectAgent, runAgent, type AgentTask, type ChatMessage, type ChatOptions, type Model, type TaskSource } from '@lsw/agent'
import { materializeWorld } from './repo.ts'
import { ART_SYSTEM, AUDIT_SYSTEM, FINALIZE, NO_JSON, REFLECT_SYSTEM, REVIEW_SYSTEM, artUser, auditNotes, auditRepairUser, auditUser, catalogueOf, createUser, designSystem, designUser, findUser, reflectUser, repairUser, reviewUser, reviseUser, revisionUser, type Creation, type Need } from './prompts.ts'
import { coarseTerms, signatureOf, type Signature } from './signature.ts'
import { auditOf, profileOf, safeName, type Attempt as AgentAttempt, type Episode as AgentEpisode, type Harness, type Profile, type SelfState } from '@lsw/agent'

/** A backend that is out of quota or throttling says so in its error (claude-code's session limit, an HTTP 429, a provider's quota). */
const BACKEND_DOWN = /session limit|usage limit|rate.?limit|quota|\b429\b|overloaded|insufficient_quota/i
/** How long the service makes no calls after the backend said it is out (a request meanwhile gets `unavailable`). */
const BACKEND_PAUSE_MS = 5 * 60_000

/** An episode of the patch pipeline: the request is the world's, the result a Patch. */
export type WorldEpisode = AgentEpisode<ModRequest, Patch>
type Episode = WorldEpisode
type Attempt = AgentAttempt<Patch>
import { buildTools, describeOutcome, type Tool, type ToolContext } from './tools.ts'
import { audit, type AuditResult } from './audit.ts'

export interface ModderOptions {
  library: WorldLibrary
  state: SelfState
  /** Absent: the modder still answers from the shared library, and reports `unavailable` otherwise. */
  model?: Model
  /** Profile for resolve() calls that do not name one (default live). */
  profile?: Profile
  clock?: () => Date
  log?: (line: string) => void
}

interface EpisodeOptions {
  profile: Profile
  escalatedFrom?: string
  revise?: { episode: Episode; notes: string[] }
}

const TOOL_OUTPUT_CAP = 12_000

/** Turns to do one kind of work, a few at a time; the lower priority goes first (live before offline). */
class Gate {
  private running = 0
  private queue: { priority: number; go: () => void }[] = []
  constructor(private limit: () => number) {}
  async acquire(priority: number): Promise<() => void> {
    if (this.running >= this.limit()) {
      await new Promise<void>((go) => {
        this.queue.push({ priority, go })
        this.queue.sort((a, b) => a.priority - b.priority)
      })
    }
    this.running++
    let done = false
    return () => {
      if (done) return
      done = true
      this.running--
      this.queue.shift()?.go()
    }
  }
}

export class Modder {
  private inflight = new Map<string, Promise<ResolveReply>>()
  /**
   * Designs run in parallel (harness concurrency.design at once, live first): each is worked and
   * validated in its own sandbox, and the commit re-validates against the library as it is then.
   * Requests whose patches would be written in the same place queue in one lane (laneOf), so the
   * later one sees what the earlier committed and is often answered by it.
   */
  private design = new Gate(() => this.opts.state.harness().concurrency?.design ?? 4)
  private lanes = new Map<string, Promise<void>>()
  /** Work after the reply: reflections, late reviews, escalations, revisions (harness concurrency.background at once). */
  private jobs: { what: string; job: () => Promise<void> }[] = []
  private running = 0
  private idle: (() => void)[] = []
  /** Where each class of request is (GET /progress), and the class of each request id. */
  private progress = new Map<string, ModProgress>()
  private requestKey = new Map<string, string>()
  /** Live episodes that went cleanly, waiting to be reflected on together (harness reflect.batch). */
  private clean: { ep: Episode; sig: Signature }[] = []

  constructor(readonly opts: ModderOptions) {}

  get model(): Model | undefined {
    return this.opts.model
  }

  private now(): Date {
    return this.opts.clock?.() ?? new Date()
  }

  private log(line: string): void {
    this.opts.log?.(line)
  }

  /** Resolves when all background work started so far (and what it started) is done. */
  async settled(): Promise<void> {
    if (!this.running && !this.jobs.length) return
    await new Promise<void>((done) => this.idle.push(done))
  }

  private later(what: string, job: () => Promise<void>): void {
    this.jobs.push({ what, job })
    this.pump()
  }

  private pump(): void {
    const limit = this.opts.state.harness().concurrency?.background ?? 3
    while (this.running < limit && this.jobs.length) {
      const { what, job } = this.jobs.shift()!
      this.running++
      job()
        .catch((err) => this.log(`${what}: ${(err as Error).message}`))
        .finally(() => {
          this.running--
          this.pump()
        })
    }
    if (!this.running && !this.jobs.length) for (const done of this.idle.splice(0)) done()
  }

  /** Where a request is: waiting its turn, designing, finding, creating (undefined: not here, or done). */
  progressOf(requestId: string): ModProgress | undefined {
    const key = this.requestKey.get(requestId)
    return key ? this.progress.get(key) : undefined
  }

  async resolve(body: ResolveBody, profile: Profile = this.opts.profile ?? 'live'): Promise<ResolveReply> {
    const req = body?.request
    if (!req?.event || !req.scenario || !req.context) return { patch: null, outcome: 'failed', diagnostics: ['malformed request'] }
    const sig = signatureOf(req)
    this.requestKey.set(req.id, sig.key)
    try {
      return await this.resolveClass(req, body, sig, profile)
    } finally {
      this.requestKey.delete(req.id)
    }
  }

  private async resolveClass(req: ModRequest, body: ResolveBody, sig: Signature, profile: Profile): Promise<ResolveReply> {
    const hit = this.cover(req, sig)
    if (hit) return hit
    // the same class already being worked on: wait for it, then see whether it answers this one too
    const running = this.inflight.get(sig.key)
    if (running) {
      await running.catch(() => undefined)
      const again = this.cover(req, sig)
      if (again) return again
    }
    const base = this.opts.library.answeredByBase(req)
    if (base) return { patch: null, outcome: 'failed', diagnostics: [`answered by the base rule "${base}" here: the client's base rules are older than the service's`] }
    if (!this.opts.model) return { patch: null, outcome: 'unavailable' }
    // the backend said it is out of quota (or throttling): no calls until the pause is over
    if (Date.now() < this.downUntil) return { patch: null, outcome: 'unavailable', diagnostics: [`model unavailable: ${this.downWhy}`] }
    return this.track(sig.key, this.episode(req, body.workspace, sig, { profile }))
  }

  /** When the backend may be called again after it said it is out of quota, and what it said. */
  private downUntil = 0
  private downWhy = ''

  private async track(key: string, p: Promise<ResolveReply>): Promise<ResolveReply> {
    this.inflight.set(key, p)
    try {
      return await p
    } finally {
      if (this.inflight.get(key) === p) this.inflight.delete(key)
    }
  }

  /** The shared library already answers it: reply with the patch that does, and book the reuse. */
  private cover(req: ModRequest, sig: Signature): ResolveReply | undefined {
    const c = this.opts.library.covering(req)
    if (!c) return undefined
    const { state } = this.opts
    const ep = this.blank(state.newEpisodeId(), req, sig, state.harness())
    ep.outcome = 'covered'
    ep.rules = [c.rule]
    ep.patch = c.patch
    state.recordEpisode(ep)
    this.log(`${ep.id} covered by ${c.rule}: ${req.summary}`)
    return { patch: c.patch, outcome: 'covered', episode: ep.id }
  }

  private blank(id: string, req: ModRequest, sig: Signature, h: Harness): Episode {
    return {
      id,
      at: this.now().toISOString(),
      kind: 'world',
      summary: req.summary,
      request: req,
      key: sig.key,
      terms: sig.terms,
      outcome: 'failed',
      attempts: [],
      tools: [],
      rules: [],
      shown: { lessons: [], episodes: [], skills: [] },
      skillsRead: [],
      harness: h.version,
      model: this.opts.model?.name,
      usage: { calls: 0, input: 0, output: 0 },
      ms: 0,
    }
  }

  /** A design in its lane, then in a slot (live first); one that waited is answered by what was committed meanwhile, if it can be. */
  private async episode(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, eo: EpisodeOptions): Promise<ResolveReply> {
    if (!this.progress.has(sig.key)) this.progress.set(sig.key, { stage: 'queued' })
    const leave = await this.enterLane(laneOf(req))
    const release = await this.design.acquire(eo.profile === 'live' ? 0 : 1)
    try {
      if (!eo.revise) {
        const hit = this.cover(req, sig)
        if (hit) return hit
      }
      return await this.work(req, ws, sig, eo)
    } finally {
      release()
      leave()
      this.progress.delete(sig.key)
    }
  }

  /** Wait for the designs ahead in this lane; the returned function lets the next one in. */
  private async enterLane(lane: string): Promise<() => void> {
    const ahead = this.lanes.get(lane) ?? Promise.resolve()
    let done!: () => void
    const mine = new Promise<void>((r) => (done = r))
    const tail = ahead.then(() => mine)
    this.lanes.set(lane, tail)
    await ahead
    return () => {
      done()
      if (this.lanes.get(lane) === tail) this.lanes.delete(lane)
    }
  }

  private async work(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, eo: EpisodeOptions): Promise<ResolveReply> {
    const t0 = Date.now()
    const { state, library } = this.opts
    const h = profileOf(state.harness(), eo.profile)
    if (h.design.mode === 'repo') return this.repoEpisode(req, ws, sig, eo, h)
    const model = new Meter(this.opts.model!)
    const ep = this.blank(state.newEpisodeId(), req, sig, h)
    ep.profile = eo.profile
    if (eo.escalatedFrom) ep.escalatedFrom = eo.escalatedFrom
    if (eo.revise) ep.revises = eo.revise.episode.id
    const replaces = eo.revise?.episode.rules ?? []

    // recall
    const lib = library.workspace(ws, replaces)
    const recall = { lessons: state.relevantLessons(sig.terms, h.recall.lessons), episodes: state.similarEpisodes(sig.terms, h.recall.episodes), skills: state.skills() }
    ep.shown = { lessons: recall.lessons.map((l) => l.id), episodes: recall.episodes.map((e) => e.id), skills: recall.skills.map((s) => s.name) }

    const validate = (p: Patch) => library.validate(p, req, ws, replaces)
    const ctx: ToolContext = { library: lib, ontology: library.fullOntology(lib), request: req, state, validate, skillsRead: ep.skillsRead }
    const tools = h.design.toolRounds > 0 ? buildTools(ctx, h.tools) : []
    // the system prefix is the same for every request and every client (the base ontology), so
    // it is served from the provider's prompt cache; what patches added goes in the user turn.
    // The router (one call, no tools: live): the design sees the request's own types and asks for
    // the rest by name; the harness finds them in the catalogue, or has them created.
    const router = h.design.toolRounds === 0
    let stage: 'local' | 'find' | 'create' = 'local'
    let creations: Creation[] = []
    const at = (p: ModProgress) => this.progress.set(sig.key, p)
    at({ stage: 'local' })
    if (router) ep.route = ['local']
    const added = { types: lib.types.filter((t) => !(t.id in library.ontology.types)), statuses: lib.statuses.filter((s) => !(s.id in library.ontology.statuses)) }
    const messages: ChatMessage[] = [
      { role: 'system', content: designSystem(buildModSpec(library.ontology, undefined, { types: !router }), h, router) },
      { role: 'user', content: designUser(req, recall, h.design.brief ? briefOf(req, lib, ctx.ontology, !router) : undefined, added, !router) + (eo.revise ? `\n\n${revisionUser(eo.revise.episode.patch!, eo.revise.notes)}` : '') },
    ]

    let repairs = 0
    let reviews = 0
    let phase: Attempt['phase'] = 'design'
    let reviewed: Patch | undefined // a valid draft a reviewer sent back: shipped if the revision never validates
    const retry = (content: string, next: Attempt['phase']) => {
      messages.push({ role: 'user', content })
      phase = next
    }
    try {
      for (;;) {
        const answer = await this.converse(model, messages, tools, h, ep, stage === 'local' ? undefined : SLOW_MS)
        let bracketsRepaired = false
        const parsed = parseJson(answer, () => (bracketsRepaired = true))
        const ask = router ? routeOf(parsed) : undefined
        // create only what the world lacks: a creation asked for at once, whose name is close to
        // things the catalogue has, goes through find first (the router is local, find, create)
        if (ask?.create && stage === 'local') {
          const close = new Map(ask.create.map((c) => [c.name.en, closestTypes(c.name.en || c.id, ctx.ontology, 6, c.name.zh)]))
          if ([...close.values()].some((ids) => ids.length)) {
            stage = 'find'
            ep.route!.push('find')
            ep.needed = ask.create.map((c) => c.name.en)
            at({ stage: 'find' })
            ep.attempts.push({ phase, errors: [], warnings: [], raw: answer.slice(0, 2000) })
            retry(findUser(ask.create.map((c) => ({ name: c.name.en, why: c.why })), close, catalogueOf(Object.values(ctx.ontology.types))), 'find')
            continue
          }
        }
        if (ask?.need && stage === 'local') {
          // find: what the design needs beyond the request, in the whole catalogue
          stage = 'find'
          ep.route!.push('find')
          ep.needed = ask.need.map((n) => n.name)
          at({ stage: 'find' })
          ep.attempts.push({ phase, errors: [], warnings: [], raw: answer.slice(0, 2000) })
          const candidates = new Map(ask.need.map((n) => [n.name, closestTypes(n.name, ctx.ontology)]))
          retry(findUser(ask.need, candidates, catalogueOf(Object.values(ctx.ontology.types))), 'find')
          continue
        }
        if (ask?.create && stage !== 'create') {
          // create: the world has no such thing; the player is told, and waits for it
          stage = 'create'
          ep.route!.push('create')
          creations = ask.create
          at({ stage: 'create', creating: creations.map((c) => c.name) })
          ep.attempts.push({ phase, errors: [], warnings: [], raw: answer.slice(0, 2000) })
          retry(createUser(creations, Object.keys(ctx.ontology.materials ?? {})), 'create')
          continue
        }
        if (ask) {
          ep.attempts.push({ phase, errors: [ask.need ? 'asked for more things after the catalogue: write the patch now' : 'asked to create again: write the patch now'], warnings: [], raw: answer.slice(0, 2000) })
          if (repairs++ >= h.repair.maxRounds) break
          retry(`${ask.need ? 'You have the catalogue.' : 'Creating is already under way.'} Answer now with ONLY the JSON object {"patch": {"artifacts": [...]}, "summary": "..."}.`, 'repair')
          continue
        }
        const { patch: draft, fixes } = normalizePatch(parsed)
        if (bracketsRepaired) fixes.unshift('repaired the JSON brackets (one closed too early, or missing at the end)')
        if (!draft) {
          // say what was wrong: no JSON at all, JSON that does not parse (and where), or JSON with no patch in it
          const why = unreadable(answer)
          ep.attempts.push({ phase, errors: [why], warnings: [], raw: answer.slice(0, 2000) })
          if (repairs++ >= h.repair.maxRounds) break
          retry(why === NO_PATCH ? NO_JSON : `${why}\n\n${NO_JSON}`, 'repair')
          continue
        }
        let patch: Patch = { ...draft, author: 'modder' }
        const qualified = qualifyTerrains(patch, ctx.ontology)
        if (qualified.fixes.length) ((patch = qualified.patch), fixes.push(...qualified.fixes))
        let res = validate(patch)
        // mechanical conflicts are fixed here, not with another model turn
        const narrowed = res.ok ? undefined : narrowKinds(patch, req, res)
        if (narrowed) {
          const again = validate(narrowed.patch)
          if (again.ok || again.errors.length < res.errors.length) ((patch = narrowed.patch), (res = again), fixes.push(...narrowed.fixes))
        }
        // the generalization test, written by the harness (only for a draft that already holds)
        let derived: string[] | undefined
        if (res.ok && h.design.tests === 'harness') {
          const d = deriveTests(patch, req, lib, ctx.ontology)
          derived = d.notes
          const withTests = validate(d.patch)
          if (withTests.ok) ((patch = d.patch), (res = withTests))
          else derived.push(`derived test dropped: ${withTests.errors[0]}`)
        }
        // the new things' pictures, drawn once the patch holds (a thing with no picture shows its parent's)
        if (res.ok && patch.artifacts.some((a) => a.kind === 'type' && !a.type.art)) {
          at({ stage: 'art', creating: patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type.name as { en: string; zh: string }] : [])) })
          const drawn = await this.drawAll(model, patch, creations)
          const again = validate(drawn)
          if (again.ok) ((patch = drawn), (res = again))
          else fixes.push(`pictures dropped: ${again.errors[0]}`)
        }
        if (res.ok) ep.created = patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type.id] : []))
        const attempt: Attempt = { phase, patch, errors: res.errors, warnings: res.warnings, ...(fixes.length ? { fixes } : {}), ...(derived?.length ? { derived } : {}) }
        ep.attempts.push(attempt)
        if (!res.ok) {
          const meanwhile = eo.revise ? undefined : library.covering(req)
          if (meanwhile) {
            ep.outcome = 'covered'
            ep.rules = [meanwhile.rule]
            ep.patch = meanwhile.patch
            break
          }
          if (repairs++ >= h.repair.maxRounds) break
          retry(repairUser(res.errors, res.warnings), 'repair')
          continue
        }
        // the auditor, before shipping: what it breaks in the sandbox goes back to the designer
        if (auditOf(h).enabled && auditOf(h).blocking) {
          const found = await this.audit(model, req, patch, ctx, h)
          attempt.audit = { confirmed: found.confirmed.map((f) => `${f.kind}: ${f.title}`), unconfirmed: found.unconfirmed.length }
          if (found.confirmed.length) {
            attempt.errors = auditNotes(found.confirmed)
            if (repairs++ >= h.repair.maxRounds) break
            retry(auditRepairUser(attempt.errors), 'audit')
            continue
          }
        }
        if (h.review.enabled && h.review.blocking !== false && reviews < h.review.maxRounds) {
          attempt.review = await this.review(model, req, patch, ctx, h, flagsOf(patch, derived))
          if (attempt.review.verdict === 'revise' && attempt.review.notes.length) {
            reviews++
            reviewed = patch
            retry(reviseUser(attempt.review.notes), 'review')
            continue
          }
        }
        if (this.commit(ep, patch, req, replaces)) break
        // the library moved under us: someone else's patch may already answer this
        const meanwhile = eo.revise ? undefined : library.covering(req)
        if (meanwhile) {
          ep.outcome = 'covered'
          ep.rules = [meanwhile.rule]
          ep.patch = meanwhile.patch
          break
        }
        if (repairs++ >= h.repair.maxRounds) break
        retry(repairUser(ep.attempts.at(-1)!.errors, [], true), 'repair')
      }
      if (ep.outcome === 'failed' && reviewed && this.commit(ep, reviewed, req, replaces)) ep.error = 'the revision never validated; shipped the reviewed draft'
    } catch (err) {
      ep.error = (err as Error).message
      if (reviewed && ep.outcome === 'failed' && this.commit(ep, reviewed, req, replaces)) ep.error += '; shipped the reviewed draft'
    }

    ep.usage = { calls: model.calls, input: model.input, output: model.output, cost: model.cost }
    ep.calls = model.log
    ep.ms = Date.now() - t0
    state.recordEpisode(ep)
    const retired = state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
    this.log(
      `${ep.id} ${eo.profile}${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} after ${ep.attempts.length} attempt(s), ${ep.usage.calls} call(s), ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}${retired.length ? `; retired skill ${retired.join(', ')}` : ''}`,
    )
    this.afterwards(ep, req, ws, sig, h, ctx, eo)
    const last = ep.attempts.at(-1)
    return {
      patch: ep.outcome === 'failed' ? null : (ep.patch ?? null),
      outcome: ep.outcome,
      episode: ep.id,
      diagnostics: ep.outcome === 'failed' ? [...(last?.errors ?? []), ...(ep.error ? [ep.error] : [])] : undefined,
    }
  }

  /**
   * The request as a repository task, worked by the SWE-style agent (offline: curriculum,
   * escalations, revisions). The agent's tests are the validator; the patch it leaves is
   * committed to the shared library like any other.
   */
  private async repoEpisode(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, eo: EpisodeOptions, h: Harness): Promise<ResolveReply> {
    const { state, library } = this.opts
    const replaces = eo.revise?.episode.rules ?? []
    const lib = library.workspace(ws, replaces)
    const repo = await materializeWorld({
      request: req,
      library: lib,
      ontology: library.fullOntology(lib),
      spec: buildModSpec(library.ontology, lib),
      regression: [...library.regression, ...(ws?.regression ?? [])].filter((r) => !replaces.includes(r.rule)),
      revise: eo.revise ? { rules: replaces, notes: eo.revise.notes } : undefined,
    })
    try {
      const run = await runAgent({ ...repo.task, terms: sig.terms }, { model: this.opts.model!, state, harness: h, record: false, log: this.opts.log })
      const ep = run.episode as unknown as Episode
      ep.request = req
      ep.summary = req.summary
      ep.key = sig.key
      ep.profile = eo.profile
      if (eo.escalatedFrom) ep.escalatedFrom = eo.escalatedFrom
      if (eo.revise) ep.revises = eo.revise.episode.id
      const { patch, problems } = repo.collect()
      ep.patch = undefined
      // the auditor, before shipping: a patch it breaks in the sandbox is not committed
      const found = run.submitted && patch && !problems.length && auditOf(h).enabled && auditOf(h).blocking ? await this.audit(new Meter(this.opts.model!), req, patch, { library: lib, ontology: library.fullOntology(lib) }, h) : undefined
      if (found?.confirmed.length) ep.attempts.push({ phase: 'audit', patch, errors: auditNotes(found.confirmed), warnings: [], audit: { confirmed: found.confirmed.map((f) => `${f.kind}: ${f.title}`), unconfirmed: found.unconfirmed.length } })
      else if (run.submitted && patch && !problems.length) this.commit(ep, { ...patch, author: 'modder' }, req, replaces)
      else if (problems.length) ep.attempts.push({ phase: 'repair', errors: problems, warnings: [] })
      if (ep.outcome !== 'accepted') ep.outcome = 'failed'
      state.recordEpisode(ep)
      state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
      this.log(`${ep.id} ${eo.profile} repo${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} in ${ep.usage.calls} steps, ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}`)
      this.later(`reflect ${ep.id}`, () => reflectAgent(ep as never, { model: this.opts.model!, state, harness: h }))
      const last = ep.attempts.at(-1)
      return { patch: ep.outcome === 'accepted' ? (ep.patch ?? null) : null, outcome: ep.outcome, episode: ep.id, diagnostics: ep.outcome === 'failed' ? [...(last?.errors ?? []), ...(ep.error ? [ep.error] : [])] : undefined }
    } finally {
      await repo.dispose()
    }
  }

  /**
   * World tasks for the outer loop's replays: a recorded request rebuilt as a repository against
   * the library as it was before that request was answered.
   */
  taskSource(): TaskSource {
    return {
      kinds: ['world-repo'],
      replay: async (ep) => {
        const req = ep.request as ModRequest
        if (!req?.scenario) return undefined
        const before = this.opts.library.fork((e) => !('patch' in e && e.request === req.id))
        if (before.covering(req)) return undefined // something else answers it now: no test of the harness
        const repo = await materializeWorld({ request: req, library: before.lib, ontology: before.fullOntology(), spec: buildModSpec(before.ontology, before.lib), regression: before.regression })
        // the task carries its own release: its workspace and its container go with it, whoever cleans up
        return { ...repo.task, terms: ep.terms, dispose: repo.dispose }
      },
      cleanup: async (task: AgentTask) => task.dispose?.(),
    }
  }

  /** What follows an episode once the player has their answer. */
  private afterwards(ep: Episode, req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, h: Harness, ctx: ToolContext, eo: EpisodeOptions): void {
    // a failure that is the backend's (out of quota, throttled) is no lesson and no reason to work the
    // request again: nothing follows, and no call goes out for a while
    if (ep.outcome === 'failed' && BACKEND_DOWN.test(ep.error ?? '')) {
      this.downUntil = Date.now() + BACKEND_PAUSE_MS
      this.downWhy = ep.error!
      this.log(`model unavailable (${ep.error}): no calls for ${BACKEND_PAUSE_MS / 60000} min`)
      return
    }
    const shipped = ep.attempts.at(-1)
    const flags = ep.patch ? flagsOf(ep.patch, shipped?.derived) : []
    // a review after the fact: for a rule that narrates only or did not generalize (and for every
    // live rule when the harness says review.unflagged)
    if (ep.outcome === 'accepted' && !eo.revise && h.review.enabled && (flags.length || (h.review.blocking === false && h.review.unflagged)) && !shipped?.review)
      this.later(`review ${ep.id}`, async () => {
        const model = new Meter(this.opts.model!)
        const v = await this.review(model, req, ep.patch!, ctx, h, flags)
        this.opts.state.note('review', { episode: ep.id, rules: ep.rules, flags, ...v, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
        if (v.verdict === 'revise' && v.notes.length && h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: ep, notes: v.notes } })
      })
    // the auditor, after shipping: what it breaks in the sandbox leaves the library at once (clients drop
    // it on their next sync), and goes back for a revision
    if (ep.outcome === 'accepted' && !eo.revise && auditOf(h).enabled && !auditOf(h).blocking && ep.patch)
      this.later(`audit ${ep.id}`, async () => {
        const model = new Meter(this.opts.model!)
        const found = await this.audit(model, req, ep.patch!, ctx, h)
        this.opts.state.note('audit', { episode: ep.id, rules: ep.rules, confirmed: found.confirmed.map(({ evidence: _, ...f }) => f), unconfirmed: found.unconfirmed.map((u) => `${u.finding.title}: ${u.why}`), usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
        if (!found.confirmed.length) return
        for (const id of ep.rules) this.opts.library.remove(id, this.now())
        this.log(`${ep.id} audit: ${found.confirmed.map((f) => `${f.kind}: ${f.title}`).join('; ')} → removed ${ep.rules.join(', ')}`)
        if (h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: ep, notes: auditNotes(found.confirmed) } })
      })
    // a live request that failed is worked again with the offline profile: the world still learns it
    if (ep.outcome === 'failed' && eo.profile === 'live' && h.escalate && !this.inflight.has(`${sig.key}#offline`))
      this.later(`escalate ${ep.id}`, async () => {
        if (this.opts.library.covering(req)) return
        await this.track(`${sig.key}#offline`, this.episode(req, ws, sig, { profile: 'offline', escalatedFrom: ep.id }))
      })
    // what went wrong is reflected on at once; live episodes that went cleanly, a batch at a time
    const clean = eo.profile === 'live' && !eo.revise && !eo.escalatedFrom && ep.outcome === 'accepted' && !flags.length && ep.attempts.every((a) => !a.errors.length && !a.fixes?.length && !a.review && ['design', 'find', 'create'].includes(a.phase))
    if (clean && (h.reflect.batch ?? 1) > 1) {
      this.clean.push({ ep, sig })
      if (this.clean.length < h.reflect.batch!) return
      const due = this.clean.splice(0)
      this.later(`reflect ${due.map((d) => d.ep.id).join(', ')}`, () => this.reflect(due))
    } else this.later(`reflect ${ep.id}`, () => this.reflect([{ ep, sig }]))
  }

  /** Append to the shared library; on failure the diagnostics land on the last attempt. */
  private commit(ep: Episode, patch: Patch, req: ModRequest, replaces: string[] = []): boolean {
    // the Threadbook says whose act taught the world this: the player's, or the world's own
    patch = { ...patch, trigger: req.origin ?? 'player' }
    const c = this.opts.library.commit(patch, req, this.now(), replaces)
    if (!c.ok) {
      ep.attempts.push({ phase: 'repair', patch, errors: c.result.errors, warnings: c.result.warnings })
      return false
    }
    ep.outcome = 'accepted'
    ep.patch = patch
    ep.rules = c.rules
    return true
  }

  /** The design conversation: tool calls until the model answers, or the round budget runs out. */
  /** Each new type of the patch gets a picture (two tries each); one that cannot be drawn keeps its parent's. */
  private async drawAll(model: Model, patch: Patch, creations: Creation[]): Promise<Patch> {
    const artifacts = []
    for (const a of patch.artifacts) {
      if (a.kind !== 'type' || a.type.art) {
        artifacts.push(a)
        continue
      }
      const why = creations.find((c) => c.id === a.type.id)?.why ?? `a new kind of ${a.type.id.split('/').slice(-2, -1)[0] ?? 'thing'}`
      const art = await this.draw(model, a.type, why)
      artifacts.push(art ? { ...a, type: { ...a.type, art, sprite: `art:${a.type.id}` } } : a)
    }
    return { ...patch, artifacts }
  }

  private async draw(model: Model, t: TypeDef, why: string): Promise<PixelArt | undefined> {
    const name = typeof t.name === 'object' && t.name ? (t.name as { en: string; zh: string }) : { en: String(t.name ?? t.id), zh: String(t.name ?? t.id) }
    const messages: ChatMessage[] = [
      { role: 'system', content: ART_SYSTEM },
      { role: 'user', content: artUser({ id: t.id, name }, why) },
    ]
    for (let i = 0; i < 2; i++) {
      const r = await model.chat(messages, { json: true, temperature: 0.4, purpose: 'art', reasoning: 'medium', deadlineMs: SLOW_MS })
      const j = parseJson(r.content) as Partial<PixelArt> | undefined
      const art = { grid: j?.grid ?? [], palette: j?.palette ?? {} } as PixelArt
      const problems = artProblems(art)
      if (!problems.length) return art
      messages.push({ role: 'assistant', content: r.content }, { role: 'user', content: `Fix this and answer with the whole JSON again: ${problems.join('; ')}` })
    }
    return undefined
  }

  private async converse(model: Model, messages: ChatMessage[], tools: Tool[], h: Harness, ep: Episode, deadlineMs?: number): Promise<string> {
    const specs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
    const call: ChatOptions = { temperature: h.design.temperature, purpose: 'design', reasoning: h.design.reasoning, hedgeMs: h.design.hedgeMs, deadlineMs: deadlineMs ?? h.design.deadlineMs, retries: h.design.retries, provider: h.design.provider }
    for (let round = 0; round < h.design.toolRounds; round++) {
      const r = await model.chat(messages, { ...call, tools: specs })
      if (!r.toolCalls.length) {
        messages.push({ role: 'assistant', content: r.content })
        return r.content
      }
      messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls })
      for (const c of r.toolCalls) {
        const tool = tools.find((t) => t.name === c.name)
        const t0 = Date.now()
        let out: string
        try {
          out = tool ? tool.run((c.args ?? {}) as Record<string, unknown>) : `unknown tool "${c.name}"`
        } catch (err) {
          out = `tool error: ${(err as Error).message}`
        }
        ep.tools.push({ name: c.name, args: clipJson(c.args), ms: Date.now() - t0 })
        messages.push({ role: 'tool', toolCallId: c.id, name: c.name, content: out.length > TOOL_OUTPUT_CAP ? out.slice(0, TOOL_OUTPUT_CAP) + '\n… (truncated)' : out })
      }
    }
    // single-shot (toolRounds 0) answers straight from the brief; otherwise the tool budget ran out
    if (h.design.toolRounds > 0) messages.push({ role: 'user', content: FINALIZE })
    const r = await model.chat(messages, { ...call, json: true })
    messages.push({ role: 'assistant', content: r.content })
    return r.content
  }

  /** The auditor on a patch (audit.ts): only what it broke in the sandbox, with the patch and not without it. */
  private async audit(model: Model, req: ModRequest, patch: Patch, ctx: Pick<ToolContext, 'library' | 'ontology'>, h: Harness): Promise<AuditResult> {
    const a = auditOf(h)
    try {
      return await audit(model, AUDIT_SYSTEM, auditUser(req, patch, describeOutcome(req.scenario, patch, ctx)), req, ctx.ontology, ctx.library, patch, { rounds: a.rounds, reasoning: a.reasoning, provider: profileOf(h, 'offline').design.provider })
    } catch (err) {
      // an auditor that fails finds nothing: the deterministic checks already passed
      this.log(`audit failed: ${(err as Error).message}`)
      return { confirmed: [], unconfirmed: [] }
    }
  }

  private async review(model: Model, req: ModRequest, patch: Patch, ctx: ToolContext, h: Harness, flags: string[] = []): Promise<{ verdict: string; notes: string[] }> {
    const outcome = describeOutcome(req.scenario, patch, ctx)
    const messages: ChatMessage[] = [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: reviewUser(req, patch, outcome, relatedRules(req, ctx.library), flags) },
    ]
    // a reply that says no verdict is no review: asked once more, then recorded as an error (never as "ship")
    for (let attempt = 0; attempt < 2; attempt++) {
      // nobody waits on a review: the cheap providers
      const r = await model.chat(messages, { json: true, temperature: 0.2, purpose: 'review', reasoning: h.review.reasoning, provider: profileOf(h, 'offline').design.provider })
      const j = parseJson(r.content) as { verdict?: unknown; notes?: unknown } | undefined
      const verdict = typeof j?.verdict === 'string' ? j.verdict.trim().toLowerCase() : undefined
      if (verdict !== 'ship' && verdict !== 'revise') continue
      const notes = Array.isArray(j?.notes) ? j!.notes.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 5) : []
      return { verdict, notes }
    }
    return { verdict: 'error', notes: [] }
  }

  /** The middle loop: what is worth keeping from this episode. */
  /** One reflection call: on one episode, or on a batch of clean ones (each cited by what it teaches). */
  private async reflect(items: { ep: Episode; sig: Signature }[]): Promise<void> {
    const { state } = this.opts
    const h = state.harness()
    const done = items.filter((i) => i.ep.outcome !== 'covered')
    if (!h.reflect.enabled || !this.opts.model || !done.length) return
    const model = new Meter(this.opts.model)
    const last = done[done.length - 1]
    const ids = done.map((i) => i.ep.id)
    const coarse = [...new Set(done.flatMap((i) => coarseTerms(i.sig)))]
    const terms = [...new Set(done.flatMap((i) => i.sig.terms))]
    const similar = state.similarEpisodes(last.sig.terms, 8, last.ep.id)
    const r = await model.chat(
      [
        { role: 'system', content: REFLECT_SYSTEM.replace('{N}', String(h.reflect.skillMinRecurrence)) },
        { role: 'user', content: reflectUser(done.length === 1 ? last.ep : done.map((i) => i.ep), coarse, state.relevantLessons(terms, 20), state.skills(), similar) },
      ],
      { json: true, temperature: 0.2, purpose: 'reflect', reasoning: h.reflect.reasoning, provider: profileOf(h, 'offline').design.provider },
    )
    const j = parseJson(r.content) as { lessons?: Parameters<SelfState['applyLessons']>[0]; skill?: { name?: unknown; description?: unknown; triggers?: unknown; body?: unknown } | null } | undefined
    const touched = j?.lessons && typeof j.lessons === 'object' ? state.applyLessons(j.lessons, done.length === 1 ? last.ep.id : ids, coarse) : []
    let skill: string | undefined
    const s = j?.skill
    if (s && typeof s.name === 'string' && typeof s.body === 'string' && s.body.trim()) {
      const name = safeName(s.name)
      if (state.skill(name) || similar.length >= h.reflect.skillMinRecurrence) {
        const triggers = Array.isArray(s.triggers) ? s.triggers.map(String) : coarse
        state.writeSkill({ name, description: String(s.description ?? name), triggers, body: s.body }, last.ep.id)
        skill = name
      }
    }
    state.note('reflect', { episode: done.length === 1 ? last.ep.id : ids, lessons: touched, skill, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
  }
}

/** What the reviewer should look at first: rules that change nothing, rules that did not generalize. */
function flagsOf(patch: Patch, derived?: string[]): string[] {
  const flags: string[] = []
  for (const a of patch.artifacts)
    if (a.kind === 'rule' && changesNothing(a.rule))
      flags.push(`"${a.rule.id}" changes nothing in the world (it only narrates). Revise unless doing nothing is clearly the most plausible and interesting outcome — and then its class must be narrow.`)
  for (const d of derived ?? []) if (d.includes('did not generalize')) flags.push(d)
  return flags
}

function clipJson(x: unknown): unknown {
  const s = JSON.stringify(x ?? {})
  return s.length > 2000 ? `${s.slice(0, 2000)}…` : x
}

const NO_PATCH = 'no JSON patch in the answer'

/** Why no patch could be read from an answer, precisely enough to fix it (and to learn the right lesson). */
function unreadable(answer: string): string {
  const a = answer.indexOf('{')
  const b = answer.lastIndexOf('}')
  if (a < 0 || b <= a) return NO_PATCH
  const text = answer.slice(a, b + 1)
  try {
    JSON.parse(text)
    return 'the answer is JSON but holds no patch: answer {"patch": {"artifacts": [...]}, "summary": "..."}'
  } catch (err) {
    const msg = (err as Error).message
    const at = Number(/position (\d+)/.exec(msg)?.[1] ?? -1)
    const near = at >= 0 ? ` near …${text.slice(Math.max(0, at - 60), at)}⟨here⟩${text.slice(at, at + 20)}…` : ''
    return `the answer's JSON does not parse (${msg.replace(/ in JSON at position \d+.*$/, '')})${near} — count the brackets of the tree`
  }
}

/** Finding and creating take longer than a design (a long catalogue, a picture): their calls may. */
const SLOW_MS = 60_000

/** The router's two answers besides a patch: things needed beyond the request, or things to create. */
function routeOf(j: unknown): { need?: Need[]; create?: Creation[] } | undefined {
  if (!j || typeof j !== 'object' || 'patch' in j) return undefined
  const o = j as { need?: unknown; create?: unknown }
  const need = Array.isArray(o.need) ? o.need.filter((n): n is Need => !!n && typeof (n as Need).name === 'string' && !!(n as Need).name.trim()) : []
  if (need.length) return { need }
  const create = Array.isArray(o.create)
    ? o.create.filter((c): c is Creation => !!c && typeof (c as Creation).id === 'string' && typeof (c as Creation).name?.en === 'string' && typeof (c as Creation).name?.zh === 'string')
    : []
  return create.length ? { create } : undefined
}

/**
 * Where a request's patch is written: its rule belongs to the host, and answers one kind of event.
 * Patches are usually written for a class (all creatures, every material), so the lane is the
 * event kind and the host type's first two segments: two requests in one lane would likely write
 * the same rule, and queue; any others are designed side by side.
 */
export function laneOf(req: ModRequest): string {
  const host = req.event.host?.type.split('/').slice(0, 2).join('/') ?? '-'
  return `${req.event.kind}|${host}`
}
