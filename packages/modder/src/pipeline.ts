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

import { artProblems, buildModSpec, buildRequest, buildSandbox, closestTypes, holeKey, isDo, isHole, leaves, patchKey, scenarioEvent, tierOfRequest, type ModProgress, type Ontology, type ModRequest, type ModWorkspace, type Patch, type PixelArt, type ResolveBody, type ResolveReply, type Scenario, type TypeDef, type ValidationResult } from '@openworld/engine'
import { briefOf, relatedRules } from './brief.ts'
import { changesNothing, deriveTests } from './derive.ts'
import { normalizePatch, placePatch, qualifyTerrains, stationFromRules } from './fixes.ts'
import type { CommitResult, WorldLibrary } from './library.ts'
import { Meter, parseJson, reflectAgent, runAgent, type AgentTask, type ChatMessage, type ChatOptions, type Model, type TaskSource } from '@openworld/agent'
import { materializeWorld } from './repo.ts'
import { ART_SYSTEM, AUDIT_SYSTEM, FINALIZE, NO_JSON, REFLECT_SYSTEM, REVIEW_SYSTEM, THING_SYSTEM, artUser, auditNotes, auditRepairUser, auditUser, catalogueOf, createUser, designSystem, designUser, findUser, reflectUser, repairUser, reviewUser, reviseUser, revisionUser, thingUser, type Creation, type Had, type Need } from './prompts.ts'
import { coarseTerms, signatureOf, type Signature } from './signature.ts'
import { auditOf, profileOf, safeName, type Attempt as AgentAttempt, type Episode as AgentEpisode, type Harness, type Profile, type SelfState } from '@openworld/agent'

/**
 * A backend that cannot answer says so in its error: out of quota or throttling (claude-code's session
 * limit, an HTTP 429, a provider's quota), or not signed in (an expired OAuth session, a 401/403, a bad key).
 */
const BACKEND_DOWN = /session limit|usage limit|rate.?limit|quota|\b429\b|overloaded|insufficient_quota|authenticat|oauth|unauthori[sz]ed|\b401\b|\b403\b|invalid.?api.?key|not logged in/i
/** How long the service makes no calls after the backend said it is out (a request meanwhile gets `unavailable`). */
const BACKEND_PAUSE_MS = 5 * 60_000

/** An episode of the patch pipeline: the request is the world's, the result a Patch. */
export type WorldEpisode = AgentEpisode<ModRequest, Patch>
type Episode = WorldEpisode
type Attempt = AgentAttempt<Patch>
import { buildTools, describeOutcome, type Tool, type ToolContext } from './tools.ts'
import { envelope, withoutChains, workloadNote, workloadOf, type Workload } from './quality.ts'
import { audit, probe, withPatch, type AuditResult } from './audit.ts'

export interface ModderOptions {
  library: WorldLibrary
  state: SelfState
  /** Absent: the modder still answers from the shared library, and reports `unavailable` otherwise. */
  model?: Model
  /** Profile for resolve() calls that do not name one (default live). */
  profile?: Profile
  /**
   * A trial run (the detection of what a model carries, detect.ts): answers are designed and validated as
   * ever, but nothing is committed, recorded or followed up — the library and the self-state stay as they were.
   */
  dry?: boolean
  /** The game's questions for detecting what a model carries (GameDef.probes; detect.ts), loaded when one runs. */
  probes?: () => Promise<ModRequest[]>
  /** The service's data directory: where the last detection is kept (quality.json). */
  data?: string
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
  /** What each trial run came to (a dry modder's: detect.ts), by request id. */
  readonly trials = new Map<string, Episode>()
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

  /**
   * The model behind one check, for every call the modder makes (designs, audits, reviews,
   * reflections, the repo agent): none goes out while the backend is out, and an error that says
   * it is out starts the pause.
   */
  private backend?: Model

  constructor(readonly opts: ModderOptions) {
    const inner = opts.model
    if (inner)
      this.backend = {
        name: inner.name,
        chat: async (messages, o) => {
          const why = this.down()
          if (why) throw new Error(`model unavailable: ${why}`)
          try {
            return await inner.chat(messages, o)
          } catch (err) {
            this.pause((err as Error).message)
            throw err
          }
        },
      }
  }

  get model(): Model | undefined {
    return this.opts.model
  }

  /** When the backend may be called again after it said it is out, and what it said. */
  private downUntil = 0
  private downWhy = ''

  /** What the backend said while it is out (no calls until the pause is over); undefined when it may be called. */
  private down(): string | undefined {
    return Date.now() < this.downUntil ? this.downWhy : undefined
  }

  private pause(error: string): void {
    if (!BACKEND_DOWN.test(error)) return
    this.downUntil = Date.now() + BACKEND_PAUSE_MS
    this.downWhy = error
    this.log(`model unavailable (${error}): no calls for ${BACKEND_PAUSE_MS / 60000} min`)
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
      // work queued before the backend went out is dropped, not run against it
      const why = this.down()
      if (why) {
        this.log(`${what}: skipped, model unavailable (${why})`)
        continue
      }
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

  /**
   * Faults clients reported per learned rule, by client (a rule set aside by this many clients leaves the library),
   * for the version of it in force (the log seq that added it): a rule removed, or replaced under its id, starts again from none.
   */
  private faults = new Map<string, { seq: number; clients: Set<string> }>()
  /** The log seq each shipped episode's patch was committed at: what is removed later is that version, not one that replaced it. */
  private shipped = new WeakMap<Episode, number>()

  /**
   * A client set a learned rule aside at run time (a chain that would not end, an effect refused):
   * counted by client; past the harness's bound (`faults.remove`, default 2) the rule leaves the
   * shared library and goes back for an offline revision with the reason. Returns what was done.
   */
  fault(ruleId: string, reason: string, client = 'anon'): { rule: string; counted: number; removed: boolean } {
    const { library, state } = this.opts
    const rule = library.lib.rules.get(ruleId)
    const seq = library.seqOf(ruleId)
    // the counts of versions no longer in force (removed, or replaced under their id) are forgotten
    for (const [id, f] of this.faults) if (library.seqOf(id) !== f.seq) this.faults.delete(id)
    if (!rule || rule.source?.origin !== 'patch' || seq === undefined) return { rule: ruleId, counted: 0, removed: false }
    const counted = this.faults.get(ruleId) ?? { seq, clients: new Set<string>() }
    const set = counted.clients
    set.add(client)
    this.faults.set(ruleId, counted)
    const bound = state.harness().faults?.remove ?? 2
    state.note('fault', { rule: ruleId, reason, client, counted: set.size })
    if (set.size < bound) return { rule: ruleId, counted: set.size, removed: false }
    const asked = library.asked.find((a) => a.rule === ruleId)
    library.remove(ruleId, this.now())
    this.faults.delete(ruleId)
    this.log(`${ruleId} set aside by ${set.size} client(s): ${reason} → removed`)
    if (asked && state.harness().revise && this.backend) {
      // the request as the scene that asked gives it, built the way the port builds it: the revision is placed where
      // the event falls undefined now (its host, hole and context from the scene, the library as it is without the rule)
      const req = this.askedAgain(`fault-${ruleId}`, asked.scenario, rule.source?.trigger)
      if (typeof req === 'string') this.log(`${ruleId}: no revision after the fault: ${req}`)
      else this.later(`revise ${ruleId} after a fault`, () => this.episode(req, undefined, signatureOf(req), { profile: 'offline', revise: { episode: { id: `fault-${ruleId}`, rules: [ruleId], patch: { artifacts: [{ kind: 'rule', rule }] } } as never, notes: [`a client set this rule aside at run time: ${reason}`] } }).then(() => undefined))
    }
    return { rule: ruleId, counted: set.size, removed: true }
  }

  /**
   * The request a scene asks of the shared library as it is now, as the port builds it (buildRequest); a string says why
   * there is none (the scene no longer builds, or something answers it now).
   */
  private askedAgain(id: string, scenario: Scenario, origin?: 'player' | 'world'): ModRequest | string {
    const { library } = this.opts
    try {
      const eng = buildSandbox(scenario, library.fullOntology(), library.lib)
      const ev = scenarioEvent(scenario, eng)
      const res = eng.resolveEvent(ev)
      if (res.defined) return `"${res.rule?.id}" answers its scene now`
      const req = buildRequest(eng, ev, res, id)
      return { ...req, origin: origin ?? req.origin }
    } catch (err) {
      return `its scene does not build: ${(err as Error).message}`
    }
  }

  /**
   * A new thing the game's author asks for in a sentence (the editor's AI plan, M1): its type, made of what a player
   * can have (`had`, as the editor counts it in the author's game), with its icon. Nothing is committed: the author
   * reviews the draft with the engine's checks, and `adopt`s it.
   */
  async createThing(body: ThingBody): Promise<ThingReply> {
    const why = this.down()
    if (why || !this.backend) return { patch: null, diagnostics: [why ? `model unavailable: ${why}` : 'no model'] }
    const intent = String(body?.intent ?? '').trim().slice(0, 500)
    if (!intent) return { patch: null, diagnostics: ['say what the new thing is'] }
    const { library } = this.opts
    const onto = library.fullOntology()
    const model = new Meter(this.backend)
    const messages: ChatMessage[] = [
      { role: 'system', content: THING_SYSTEM },
      { role: 'user', content: thingUser(intent, { catalogue: catalogueOf(Object.values(onto.types)), materials: Object.keys(onto.materials ?? {}), had: body.had ?? [], stations: body.stations ?? [] }) },
    ]
    const diagnostics: string[] = []
    try {
      for (let round = 0; round < 3; round++) {
        const answer = (await model.chat(messages, { json: true, temperature: 0.6, purpose: 'create', reasoning: 'medium', deadlineMs: SLOW_MS })).content
        const j = parseJson(answer) as { patch?: Patch; looks?: Record<string, string>; look?: string } | undefined
        // a new thing is types alone: what it does is asked act by act, as holes
        const patch: Patch = { artifacts: (j?.patch?.artifacts ?? []).filter((a) => a?.kind === 'type'), ...(j?.patch?.note && { note: j.patch.note }) }
        const res = patch.artifacts.length ? library.validate(patch) : { ok: false, errors: ['no type artifact'], warnings: [] }
        if (!res.ok) {
          diagnostics.push(...res.errors)
          messages.push({ role: 'assistant', content: answer }, { role: 'user', content: repairUser(res.errors, res.warnings) })
          continue
        }
        // each new thing drawn by its own look (a pelt is not drawn as the cloak made of it)
        const types = patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type] : []))
        const lookOf = (t: TypeDef) => (typeof j?.looks?.[t.id] === 'string' ? j.looks[t.id] : types.length === 1 ? (j?.look ?? patch.note ?? intent) : `${(t.name as { en?: string })?.en ?? t.id}, ${t.id.split('/').slice(0, -1).join(' ')}`)
        const look = types.length ? lookOf(types[types.length - 1]) : undefined
        const drawn = await this.drawAll(model, patch, types.map((t) => ({ id: t.id, name: t.name as { en: string; zh: string }, why: lookOf(t) })))
        const shown = library.validate(drawn).ok ? drawn : patch
        return { patch: shown, diagnostics: [], ...(look && { look }), usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } }
      }
      return { patch: null, diagnostics }
    } catch (err) {
      this.pause((err as Error).message)
      return { patch: null, diagnostics: [...diagnostics, (err as Error).message] }
    }
  }

  /** The author took a new thing into the game: the library has it, so its holes can be asked (a thing it has is kept). */
  adopt(patch: Patch): { ok: boolean; errors: string[] } {
    const { library } = this.opts
    const fresh: Patch = { ...patch, artifacts: (patch?.artifacts ?? []).filter((a) => a?.kind !== 'type' || !library.lib.types.some((t) => t.id === a.type.id)) }
    if (!fresh.artifacts.length) return { ok: true, errors: [] }
    const r = library.commit(fresh, undefined, this.now())
    return { ok: r.ok, errors: r.result.errors }
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
    // the thing asked about is a kind only the asking client knows (its own patch, or one its save kept after the
    // library forgot it): an answer hosted on it could never be shared (the library refuses its host), so none is designed
    const host = req.event.host?.type
    if (host && body.workspace?.patches?.types?.some((t) => t?.id === host) && !(host in this.opts.library.fullOntology().types))
      return { patch: null, outcome: 'failed', diagnostics: [`"${host}" is known only to this client (a kind of its own, or one its save kept): no answer for it can be shared`] }
    if (!this.opts.model) return { patch: null, outcome: 'unavailable' }
    // the backend said it is out (of quota, or signed out): no calls until the pause is over
    const why = this.down()
    if (why) return { patch: null, outcome: 'unavailable', diagnostics: [`model unavailable: ${why}`] }
    return this.track(sig.key, this.episode(req, body.workspace, sig, { profile }))
  }

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
    // a revision or an escalation is background work nobody waits on: it takes no lane, so a player's request
    // never waits behind it (its commit is validated against the library as it is then, like any other, so a
    // second answer at the same place is refused)
    const leave = eo.revise || eo.escalatedFrom ? () => {} : await this.enterLane(laneOf(req))
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
    // an escalation or a revision that waited its turn while the backend went out: not worked against it
    const why = this.down()
    if (why) return { patch: null, outcome: 'unavailable', diagnostics: [`model unavailable: ${why}`] }
    const t0 = Date.now()
    const { state, library } = this.opts
    // the setting's workload over the harness (quality.ts): a player waiting gets their tier's; the
    // offline profile (escalations, revisions, the curriculum) works as it always does, kept in the tier asked
    const wl = workloadOf(req)
    const h = eo.profile === 'live' ? envelope(profileOf(state.harness(), eo.profile), wl) : profileOf(state.harness(), eo.profile)
    if (h.design.mode === 'repo') return this.repoEpisode(req, ws, sig, eo, h)
    const model = new Meter(this.backend!)
    const ep = this.blank(state.newEpisodeId(), req, sig, h)
    ep.profile = eo.profile
    ep.quality = { tier: wl.tier, create: wl.create }
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
    // the new things' pictures, begun as soon as they are named (the designer writes their rules meanwhile)
    const drawing = new Map<string, Promise<PixelArt | undefined>>()
    const draws = wl.create !== 'low' && wl.create !== 'off'
    const begin = (cs: Creation[]) => {
      if (draws) for (const c of cs) if (c?.id && !drawing.has(c.id)) drawing.set(c.id, this.drawOne(model, { id: c.id, name: c.name } as TypeDef, c.why, wl).catch(() => undefined))
    }
    const at = (p: ModProgress) => this.progress.set(sig.key, p)
    at({ stage: 'local' })
    if (router) ep.route = ['local']
    const added = { types: lib.types.filter((t) => !(t.id in library.ontology.types)), statuses: lib.statuses.filter((s) => !(s.id in library.ontology.statuses)) }
    const messages: ChatMessage[] = [
      { role: 'system', content: designSystem(buildModSpec(library.ontology, undefined, { types: !router }), h, router) },
      { role: 'user', content: designUser(req, recall, h.design.brief ? briefOf(req, lib, ctx.ontology, !router) : undefined, added, !router) + (eo.revise ? `\n\n${revisionUser(eo.revise.episode.patch!, eo.revise.notes)}` : '') + (workloadNote(wl) ? `\n\n${workloadNote(wl)}` : '') },
    ]

    let repairs = 0
    let reviews = 0
    let reviewLater = false
    let phase: Attempt['phase'] = 'design'
    let reviewed: Patch | undefined // a valid draft a reviewer sent back: shipped if the revision never validates
    let lastRaw = '' // the last answer, kept for an attempt the program failed on before it was recorded
    const retry = (content: string, next: Attempt['phase']) => {
      messages.push({ role: 'user', content })
      phase = next
    }
    try {
      for (;;) {
        const answer = await this.converse(model, messages, tools, h, ep, stage === 'local' ? undefined : SLOW_MS)
        lastRaw = answer
        let bracketsRepaired = false
        const parsed = parseJson(answer, () => (bracketsRepaired = true))
        const ask = router ? routeOf(parsed) : undefined
        // what the setting does not carry (quality.ts): the catalogue at low, making new kinds when it is off
        const barred = ask && ((ask.create && wl.create === 'off') || (ask.need && !wl.find && !ask.create))
        if (ask && barred) {
          ep.attempts.push({ phase, errors: [ask.create ? 'asked to create a new kind: off at this setting' : 'asked for the catalogue: not at this setting'], warnings: [], raw: answer.slice(0, 2000) })
          if (repairs++ >= h.repair.maxRounds) break
          retry(`${ask.create ? 'Making new kinds is off at this setting: answer with kinds the world has.' : 'There is no catalogue at this setting: answer with the things the request holds.'} Answer now with ONLY the JSON object {"patch": {"artifacts": [...]}}.`, 'repair')
          continue
        }
        // create only what the world lacks: a creation asked for at once, whose name is close to
        // things the catalogue has, goes through find first (the router is local, find, create)
        if (ask?.create && stage === 'local' && wl.find) {
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
        if (ask?.need && stage === 'local' && wl.find) {
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
          at({ stage: 'create', creating: creations.map((c) => shownName(c.name)) })
          begin(creations)
          ep.attempts.push({ phase, errors: [], warnings: [], raw: answer.slice(0, 2000) })
          retry(createUser(creations, Object.keys(ctx.ontology.materials ?? {})), 'create')
          continue
        }
        if (ask) {
          ep.attempts.push({ phase, errors: [ask.need ? 'asked for more things after the catalogue: write the patch now' : 'asked to create again: write the patch now'], warnings: [], raw: answer.slice(0, 2000) })
          if (repairs++ >= h.repair.maxRounds) break
          retry(`${ask.need ? 'You have the catalogue.' : 'Creating is already under way.'} Answer now with ONLY the JSON object {"patch": {"artifacts": [...]}}.`, 'repair')
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
        if (!wl.chains) {
          const own = withoutChains(patch)
          if (own.fixes.length) ((patch = own.patch), fixes.push(...own.fixes))
        }
        const qualified = qualifyTerrains(patch, ctx.ontology)
        if (qualified.fixes.length) ((patch = qualified.patch), fixes.push(...qualified.fixes))
        const crafted = stationFromRules(patch, ctx.ontology)
        if (crafted.fixes.length) ((patch = crafted.patch), fixes.push(...crafted.fixes))
        // the rule's place is the request's, never the model's (design.md §5.16)
        const put = placePatch(patch, req, { ontology: ctx.ontology, library: lib })
        patch = put.patch
        fixes.push(...put.fixes)
        let res = validate(patch)
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
        // (not at the low creation setting: a new kind shows its parent's picture)
        if (res.ok && wl.create !== 'low' && patch.artifacts.some((a) => a.kind === 'type' && !a.type.art)) {
          at({ stage: 'art', creating: patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type.name as { en: string; zh: string }] : [])) })
          const drawn = await this.drawAll(model, patch, creations, wl, drawing)
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
          // the draft makes a thing the world has no type for (a spawn or a transform into an unknown id): a
          // creation, not a slip to repair; told only "unknown type", the designer swaps in something known
          // and learns never to create
          const missing = router && stage !== 'create' && wl.create !== 'off' ? unknownMade(patch, ctx.ontology) : []
          if (missing.length) {
            stage = 'create'
            ep.route!.push('create')
            creations = missing
            at({ stage: 'create', creating: creations.map((c) => shownName(c.name)) })
            begin(creations)
            retry(createUser(creations, Object.keys(ctx.ontology.materials ?? {})), 'create')
            continue
          }
          if (repairs++ >= h.repair.maxRounds) break
          retry(repairUser(res.errors, res.warnings), 'repair')
          continue
        }
        // the auditor, before shipping: what it breaks in the sandbox goes back to the designer
        if (auditOf(h).enabled && auditOf(h).blocking && !narratesOnly(patch)) {
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
          attempt.review = await this.review(model, req, patch, ctx, h, flagsOf(patch, derived), eo.profile === 'live')
          if (attempt.review.verdict === 'revise' && attempt.review.notes.length) {
            reviews++
            reviewed = patch
            retry(reviseUser(attempt.review.notes), 'review')
            continue
          }
          // no verdict is no review: the rule ships, and is reviewed again after the fact
          if (attempt.review.verdict === 'error') reviewLater = true
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
      // the program's own failure (a stack overflow, a crash in a fix): where it came from, kept with the episode
      const stack = (err as Error).stack?.split('\n').slice(1, 12).map((l) => l.trim()).join('\n')
      if (stack) ep.stack = stack
      if (lastRaw && !ep.attempts.some((x) => x.raw === lastRaw.slice(0, 2000))) ep.attempts.push({ phase, errors: [`the harness failed on this answer: ${(err as Error).message}`], warnings: [], raw: lastRaw.slice(0, 4000) })
      if (reviewed && ep.outcome === 'failed' && this.commit(ep, reviewed, req, replaces)) ep.error += '; shipped the reviewed draft'
    }

    ep.usage = { calls: model.calls, input: model.input, output: model.output, cost: model.cost }
    ep.calls = model.log
    ep.ms = Date.now() - t0
    if (this.opts.dry) {
      this.trials.set(req.id, ep)
      return { patch: ep.outcome === 'failed' ? null : (ep.patch ?? null), outcome: ep.outcome, episode: ep.id }
    }
    state.recordEpisode(ep)
    const retired = state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
    this.log(
      `${ep.id} ${eo.profile}${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} after ${ep.attempts.length} attempt(s), ${ep.usage.calls} call(s), ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}${retired.length ? `; retired skill ${retired.join(', ')}` : ''}`,
    )
    this.afterwards(ep, req, ws, sig, h, ctx, eo, reviewLater)
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
      base: library.ontology,
      spec: buildModSpec(library.ontology, lib),
      revise: eo.revise ? { rules: replaces, notes: eo.revise.notes } : undefined,
    })
    try {
      const run = await runAgent({ ...repo.task, terms: sig.terms }, { model: this.backend!, state, harness: h, record: false, log: this.opts.log })
      const ep = run.episode as unknown as Episode
      ep.request = req
      ep.summary = req.summary
      ep.key = sig.key
      ep.profile = eo.profile
      if (eo.escalatedFrom) ep.escalatedFrom = eo.escalatedFrom
      if (eo.revise) ep.revises = eo.revise.episode.id
      const collected = repo.collect()
      const problems = collected.problems
      // the rule's place is the request's, as the library is now (design.md §5.16)
      const patch = collected.patch ? placePatch(stationFromRules(collected.patch, library.fullOntology(lib)).patch, req, { ontology: library.fullOntology(lib), library: lib }).patch : collected.patch
      ep.patch = undefined
      // the auditor, before shipping: a patch it breaks in the sandbox is not committed (nor one it
      // could not audit because the backend went out)
      let found: AuditResult | undefined
      let unaudited = false
      if (run.submitted && patch && !problems.length && auditOf(h).enabled && auditOf(h).blocking && !narratesOnly(patch))
        found = await this.audit(new Meter(this.backend!), req, patch, { library: lib, ontology: library.fullOntology(lib) }, h).catch((err: Error) => ((ep.error = err.message), (unaudited = true), undefined))
      if (found?.confirmed.length) {
        ep.attempts.push({ phase: 'audit', patch, errors: auditNotes(found.confirmed), warnings: [], audit: { confirmed: found.confirmed.map((f) => `${f.kind}: ${f.title}`), unconfirmed: found.unconfirmed.length } })
        // what the auditor broke goes back to the agent once, as the pipeline gives it to the designer
        if (h.repair.maxRounds > 0 && patch) {
          const again = await materializeWorld({ request: req, library: lib, ontology: library.fullOntology(lib), base: library.ontology, spec: buildModSpec(library.ontology, lib), revise: eo.revise ? { rules: replaces, notes: eo.revise.notes } : undefined, audit: { notes: auditNotes(found.confirmed), draft: patch } })
          try {
            const second = await runAgent({ ...again.task, terms: sig.terms }, { model: this.backend!, state, harness: h, record: false, log: this.opts.log })
            ep.usage = { calls: ep.usage.calls + second.episode.usage.calls, input: ep.usage.input + second.episode.usage.input, output: ep.usage.output + second.episode.usage.output, cost: (ep.usage.cost ?? 0) + (second.episode.usage.cost ?? 0) }
            const fixed = again.collect()
            const placed = fixed.patch ? placePatch(fixed.patch, req, { ontology: library.fullOntology(lib), library: lib }).patch : undefined
            const still = second.submitted && placed && !fixed.problems.length ? await this.audit(new Meter(this.backend!), req, placed, { library: lib, ontology: library.fullOntology(lib) }, h).catch(() => undefined) : undefined
            if (placed && still && !still.confirmed.length) this.commit(ep, { ...placed, author: 'modder' }, req, replaces)
            else ep.attempts.push({ phase: 'audit', patch: placed, errors: still?.confirmed.length ? auditNotes(still.confirmed) : fixed.problems.length ? fixed.problems : ['the second draft was not submitted'], warnings: [] })
          } finally {
            await again.dispose()
          }
        }
      } else if (run.submitted && patch && !problems.length && !unaudited) this.commit(ep, { ...patch, author: 'modder' }, req, replaces)
      else if (problems.length) ep.attempts.push({ phase: 'repair', errors: problems, warnings: [] })
      if (ep.outcome !== 'accepted') ep.outcome = 'failed'
      state.recordEpisode(ep)
      state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
      this.log(`${ep.id} ${eo.profile} repo${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} in ${ep.usage.calls} steps, ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}`)
      // a failure that is the backend's is no lesson (afterwards() says why)
      if (!(ep.outcome === 'failed' && BACKEND_DOWN.test(ep.error ?? ''))) this.later(`reflect ${ep.id}`, () => reflectAgent(ep as never, { model: this.backend!, state, harness: h }))
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
        const repo = await materializeWorld({ request: req, library: before.lib, ontology: before.fullOntology(), base: before.ontology, spec: buildModSpec(before.ontology, before.lib) })
        // the task carries its own release: its workspace and its container go with it, whoever cleans up
        return { ...repo.task, terms: ep.terms, dispose: repo.dispose }
      },
      cleanup: async (task: AgentTask) => task.dispose?.(),
    }
  }

  /** What follows an episode once the player has their answer. */
  private afterwards(ep: Episode, req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, h: Harness, ctx: ToolContext, eo: EpisodeOptions, reviewLater = false): void {
    // a failure that is the backend's (out of quota, throttled, signed out) is no lesson and no reason to
    // work the request again: nothing follows (the backend's guard has paused the calls)
    if (ep.outcome === 'failed' && BACKEND_DOWN.test(ep.error ?? '')) return
    const shipped = ep.attempts.at(-1)
    const flags = ep.patch ? flagsOf(ep.patch, shipped?.derived) : []
    if (reviewLater) flags.push('the reviewer before shipping gave no verdict: look at everything')
    // a review after the fact: for a rule that narrates only or did not generalize (and for every
    // live rule when the harness says review.unflagged)
    if (ep.outcome === 'accepted' && !eo.revise && h.review.enabled && (flags.length || (h.review.blocking === false && h.review.unflagged)) && (!shipped?.review || reviewLater))
      this.later(`review ${ep.id}`, async () => {
        const model = new Meter(this.backend!)
        const v = await this.review(model, req, ep.patch!, ctx, h, flags)
        this.opts.state.note('review', { episode: ep.id, rules: ep.rules, flags, ...v, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
        if (v.verdict === 'revise' && v.notes.length && h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: ep, notes: v.notes } })
      })
    // the auditor, after shipping: what it breaks in the sandbox leaves the library at once (clients drop
    // it on their next sync), and goes back for a revision. A patch that only narrates has nothing to
    // break: no call, and the journal says why
    const auditing = ep.outcome === 'accepted' && !eo.revise && auditOf(h).enabled && !auditOf(h).blocking && ep.patch
    if (auditing && narratesOnly(ep.patch!)) this.opts.state.note('audit', { episode: ep.id, rules: ep.rules, skipped: NARRATES_ONLY, confirmed: [], unconfirmed: [], usage: { calls: 0, input: 0, output: 0, cost: 0 } })
    else if (auditing)
      this.later(`audit ${ep.id}`, async () => {
        const model = new Meter(this.backend!)
        const found = await this.audit(model, req, ep.patch!, ctx, h)
        this.opts.state.note('audit', { episode: ep.id, rules: ep.rules, confirmed: found.confirmed.map(({ evidence: _, ...f }) => f), unconfirmed: found.unconfirmed.map((u) => `${u.finding.title}: ${u.why}`), ...(found.error && { error: found.error }), usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
        if (!found.confirmed.length) return
        // only the version audited leaves: one that replaced it under its id meanwhile (a revision) was not audited here
        const shipped = this.shipped.get(ep)
        const held = ep.rules.filter((id) => shipped !== undefined && this.opts.library.seqOf(id) === shipped)
        if (!held.length) return void this.log(`${ep.id} audit: ${found.confirmed.map((f) => `${f.kind}: ${f.title}`).join('; ')}, but ${ep.rules.join(', ')} left or was replaced meanwhile`)
        for (const id of held) this.opts.library.remove(id, this.now())
        this.log(`${ep.id} audit: ${found.confirmed.map((f) => `${f.kind}: ${f.title}`).join('; ')} → removed ${held.join(', ')}`)
        if (h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: { ...ep, rules: held }, notes: auditNotes(found.confirmed) } })
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
    // a trial run judges the patch as a commit would, and keeps nothing
    const c = this.opts.dry ? judged(this.opts.library.validate(patch, req, undefined, replaces), patch) : this.opts.library.commit(patch, req, this.now(), replaces)
    if (!c.ok) {
      ep.attempts.push({ phase: 'repair', patch, errors: c.result.errors, warnings: c.result.warnings })
      return false
    }
    ep.outcome = 'accepted'
    ep.patch = patch
    ep.rules = c.rules
    if (c.seq !== undefined) this.shipped.set(ep, c.seq)
    return true
  }

  /** The design conversation: tool calls until the model answers, or the round budget runs out. */
  /** Each new type of the patch gets a picture (two tries each); one that cannot be drawn keeps its parent's. */
  /**
   * The new things' pictures, all at once: a picture begun when the thing was named (`begun`, by its id) is waited
   * for, the rest are drawn now.
   */
  private async drawAll(model: Model, patch: Patch, creations: Creation[], wl?: Workload, begun?: Map<string, Promise<PixelArt | undefined>>): Promise<Patch> {
    const artifacts = await Promise.all(
      patch.artifacts.map(async (a) => {
        if (a.kind !== 'type' || a.type.art) return a
        const why = creations.find((c) => c.id === a.type.id)?.why
        const art = (await begun?.get(a.type.id)) ?? (await this.drawOne(model, a.type, why, wl))
        // drawn by its picture; an agent keeps its kind's animated sheet (the picture is kept with it)
        return art ? { ...a, type: { ...a.type, art, ...(!a.type.id.startsWith('actor/') && { sprite: `art:${a.type.id}` }) } } : a
      }),
    )
    return { ...patch, artifacts }
  }

  /** One new thing's picture, as the tier draws it (high: with more thought, and once more if it still has problems). */
  private drawOne(model: Model, t: TypeDef, why: string | undefined, wl?: Workload): Promise<PixelArt | undefined> {
    const what = why ?? `a new kind of ${t.id.split('/').slice(-2, -1)[0] ?? 'thing'}`
    return this.draw(model, t, what, wl?.create === 'high' ? 3 : 2, wl?.create === 'high' ? 'high' : 'medium')
  }

  private async draw(model: Model, t: TypeDef, why: string, tries = 2, reasoning: ChatOptions['reasoning'] = 'medium'): Promise<PixelArt | undefined> {
    const name = typeof t.name === 'object' && t.name ? (t.name as { en: string; zh: string }) : { en: String(t.name ?? t.id), zh: String(t.name ?? t.id) }
    const messages: ChatMessage[] = [
      { role: 'system', content: ART_SYSTEM },
      { role: 'user', content: artUser({ id: t.id, name }, why) },
    ]
    for (let i = 0; i < tries; i++) {
      const r = await model.chat(messages, { json: true, temperature: 0.4, purpose: 'art', reasoning, deadlineMs: SLOW_MS })
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
    // the deterministic probe first: a farm the sandbox shows by itself needs no model to find it
    try {
      const found = probe(req, ctx.ontology, ctx.library, withPatch(ctx.library, patch))
      if (found.length) return { confirmed: found, unconfirmed: [] }
    } catch (err) {
      this.log(`audit probe failed: ${(err as Error).message}`)
    }
    try {
      return await audit(model, AUDIT_SYSTEM, auditUser(req, patch, describeOutcome(req.scenario, patch, ctx)), req, ctx.ontology, ctx.library, patch, { rounds: a.rounds, reasoning: a.reasoning, provider: profileOf(h, 'offline').design.provider })
    } catch (err) {
      // an auditor that fails finds nothing: the deterministic checks already passed. A backend that is
      // out is no audit: that is the caller's to handle (not shipped unaudited before shipping)
      if (this.down()) throw err
      this.log(`audit failed: ${(err as Error).message}`)
      return { confirmed: [], unconfirmed: [], error: (err as Error).message }
    }
  }

  private async review(model: Model, req: ModRequest, patch: Patch, ctx: ToolContext, h: Harness, flags: string[] = [], waiting = false): Promise<{ verdict: string; notes: string[] }> {
    const outcome = describeOutcome(req.scenario, patch, ctx)
    const messages: ChatMessage[] = [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: reviewUser(req, patch, outcome, relatedRules(req, ctx.library), flags) },
    ]
    // a reply that says no verdict is no review: asked once more, then recorded as an error (never as "ship")
    for (let attempt = 0; attempt < 2; attempt++) {
      // nobody waits on a review: the cheap providers — but a player waits on one before shipping (the high setting): the fast ones
      const r = await model.chat(messages, { json: true, temperature: 0.2, purpose: 'review', reasoning: h.review.reasoning, ...(waiting ? { provider: h.design.provider, hedgeMs: h.design.hedgeMs, deadlineMs: h.design.deadlineMs } : { provider: profileOf(h, 'offline').design.provider }) })
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
    if (!h.reflect.enabled || !this.backend || !done.length) return
    const model = new Meter(this.backend)
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

const NARRATES_ONLY = 'narrates only'

/** A patch of rules that only narrate (changesNothing) has nothing the auditor could break: it adds no thing and changes none. */
function narratesOnly(patch: Patch): boolean {
  return patch.artifacts.every((a) => a.kind === 'rule' && changesNothing(a.rule))
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
    return 'the answer is JSON but holds no patch: answer {"patch": {"artifacts": [...]}}'
  } catch (err) {
    const msg = (err as Error).message
    const at = Number(/position (\d+)/.exec(msg)?.[1] ?? -1)
    const near = at >= 0 ? ` near …${text.slice(Math.max(0, at - 60), at)}⟨here⟩${text.slice(at, at + 20)}…` : ''
    return `the answer's JSON does not parse (${msg.replace(/ in JSON at position \d+.*$/, '')})${near} — count the brackets of the tree`
  }
}

/** A creation's name as the waiting player reads it: one named only in English (from its id) is so in Chinese too. */
const shownName = (n: { en: string; zh: string }) => ({ en: n.en, zh: n.zh || n.en })

/** Finding and creating take longer than a design (a long catalogue, a picture): their calls may. */
const SLOW_MS = 60_000

/**
 * The things a draft makes that the world has no type for and the patch does not define: spawned, or
 * transformed into, under a parent the world has (a new kind of ground is never made). Named from the id;
 * the create prompt names them properly.
 */
export function unknownMade(patch: Patch, onto: Ontology): Creation[] {
  const own = new Set(patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type.id] : [])))
  const ids = new Set<string>()
  for (const a of patch.artifacts) {
    if (a.kind !== 'rule' || !a.rule?.tree) continue
    for (const l of leaves(a.rule.tree)) {
      // a malformed draft (effects not a list, a null among them) is the validator's to name, not a crash here
      const effects = isDo(l) ? l.do : isHole(l) ? l.default : undefined
      for (const e of Array.isArray(effects) ? effects : []) {
        if (!e || typeof e !== 'object') continue
        const id = e.op === 'spawn' ? e.type : e.op === 'transform' ? e.into : undefined
        if (typeof id !== 'string' || id in onto.types || own.has(id) || id.startsWith('tile/') || id.startsWith('@')) continue
        const segs = id.split('/')
        // a slip of a known id (item/food/berry for berries) is the repair's to point out, not a creation
        const most = segs.at(-1)!.length >= 6 ? 2 : 1
        const slip = Object.keys(onto.types).some((k) => k.startsWith(segs.slice(0, -1).join('/') + '/') && editDistance(k, id) <= most)
        if (segs.length > 2 && segs.slice(0, -1).join('/') in onto.types && !slip) ids.add(id)
      }
    }
  }
  const title = (s: string) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return [...ids].map((id) => ({ id, name: { en: title(id.split('/').at(-1)!), zh: '' } }))
}

/** An author's new thing (POST /create): what it is, and what a player can have in their game. */
export interface ThingBody {
  intent: string
  had?: Had[]
  stations?: string[]
}

export interface ThingReply {
  patch: Patch | null
  diagnostics: string[]
  /** What it looks like, as its icon was drawn. */
  look?: string
  usage?: { calls: number; input: number; output: number; cost: number }
}

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
 * Where a request's answer is written (design.md §5.16): its host type's tree for its hole. Two
 * requests bound for one tree queue, so the later one sees what the earlier placed (and is often
 * answered by it); any others are designed side by side.
 */
export function laneOf(req: ModRequest): string {
  return patchKey(req.event.host?.type ?? '-', req.event.kind, holeKey(req.hole.rule, req.hole.path), tierOfRequest(req))
}

/** A validation as a commit reports it (a trial run keeps nothing). */
function judged(result: ValidationResult, patch: Patch): CommitResult {
  return { ok: result.ok, result, rules: patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule.id] : [])) }
}

/** How many single-character edits turn one id into the other (small ids only: a slip, not a resemblance). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

