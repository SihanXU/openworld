// The modder: one undefined outcome in, one validated patch out, and a self-state that
// is a little different afterwards (docs/rsi.md §3).
//
//   comprehend  signature of the request; the shared library may already answer it (no model)
//   recall      lessons, similar episodes and skills from the self-state; the brief (request.ts)
//   design      the model's answer: one call from the brief (live), or a tool-using conversation
//   fix         mechanical repairs and the derived generalization test, without the model (answer.ts)
//   verify      the engine's validator; its diagnostics go back into the conversation (repair)
//   review      before shipping (offline), or after it (live), when it may send the rule back
//   commit      append to the shared library (re-validated against it as it is now)
//   record      the episode, every attempt and diagnostic in it, skill bookkeeping
//   reflect     after replying: distil lessons, write or revise a skill
//
// Two profiles of one harness (state.ts): LIVE while a player waits, OFFLINE for everything
// nobody waits on — curriculum, a failed live request worked again, a revision after review.

import {
  artProblems,
  PRIVATE_RULES,
  buildModSpec,
  buildRequest,
  buildSandbox,
  restoreLibrary,
  withAside,
  closestTypes,
  holeKey,
  isDo,
  isHole,
  leaves,
  patchKey,
  placePatch,
  scenarioEvent,
  tierOfRequest,
  tiersFrom,
  patchRules,
  withArtifacts,
  type ModProgress,
  type Ontology,
  type ModRequest,
  type ModWorkspace,
  type EntityInfo,
  type Patch,
  type PixelArt,
  type ResolveBody,
  type ResolveReply,
  type Scenario,
  type Tier,
  type TypeDef,
  type ValidationResult,
} from '@openworld/engine'
import { changesNothing, deriveTests, judge, normalizePatch, qualifyTerrains, stationFromRules, statedAffordance } from './answer.ts'
import type { CommitResult, WorldLibrary } from '../library/library.ts'
import { BACKEND_DOWN, Meter, parseJson, type ChatMessage, type ChatOptions, type Model } from '../models/model.ts'
import type { AgentTask, runAgent } from '../agent/loop.ts'
import type { TaskSource } from '../agent/outer.ts'
import type { materializeWorld } from '../service/repo.ts'
import { mapProblems, personProblems, settleMap, summary, withoutThinking, type DraftContext, type DraftKind, type TraceStep } from './drafts.ts'
import { ART_SYSTEM, AUDIT_SYSTEM, FINALIZE, NO_JSON, REFLECT_SYSTEM, REVIEW_SYSTEM, DRAFT_SYSTEM, THING_SYSTEM, againUser, artUser, auditNotes, auditRepairUser, auditUser, catalogueOf, createUser, designSystem, designUser, findUser, reflectUser, repairUser, reviewUser, reviseUser, revisionUser, draftUser, reviseDraftUser, thingUser, type Creation, type Had, type Need } from './prompts.ts'
import { WORLD_TERM, briefOf, coarseTerms, envelope, relatedRules, signatureOf, skillNodeOf, withoutChains, workloadNote, workloadOf, type Signature, type Workload } from './request.ts'
import { auditOf, keepReflection, nodeSection, nodeStand, profileOf, reflectAfter, troubled, type Attempt as AgentAttempt, type Episode as AgentEpisode, type Harness, type Profile, type SelfState } from '../agent/state.ts'
import { buildTools, describeOutcome, type Tool, type ToolContext } from './tools.ts'
import { audit, probe, type AuditResult } from '../checks/audit.ts'
import { clipJson } from '../util.ts'
import { researchConversation } from './research.ts'

// (the backend's own failures are the models': kept exported here for the checks that read them from the pipeline)
export { BACKEND_DOWN }
/** How long the service makes no calls after the backend said it is out (a request meanwhile gets `unavailable`). */
const BACKEND_PAUSE_MS = 5 * 60_000

/** An episode of the patch pipeline: the request is the world's, the result a Patch. */
export type WorldEpisode = AgentEpisode<ModRequest, Patch>
type Episode = WorldEpisode
type Attempt = AgentAttempt<Patch>

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

/**
 * Turns to do one kind of work, a few at a time; the lower priority goes first (live before offline). A turn that
 * ends hands itself to the first waiting, so no newcomer slips in between the end and the waiter's waking.
 */
export class Gate {
  private running = 0
  private queue: { priority: number; go: () => void }[] = []
  constructor(private limit: () => number) {}
  async acquire(priority: number): Promise<() => void> {
    if (this.running >= this.limit())
      await new Promise<void>((go) => {
        this.queue.push({ priority, go })
        this.queue.sort((a, b) => a.priority - b.priority)
      })
    else this.running++
    let done = false
    return () => {
      if (done) return
      done = true
      const next = this.queue.shift()
      if (next) next.go()
      else this.running--
    }
  }
}

/**
 * The offline profile's repo agent (a world request as a repository it works in, repo.ts; the agent loop): Node's
 * only. The package's Node entry hands it over (service/server.ts); a modder in a browser — the player's own, docs/byok.md —
 * works live and has none.
 */
export interface OfflineAgent {
  runAgent: typeof runAgent
  materializeWorld: typeof materializeWorld
}

let offline: OfflineAgent | undefined

export function useOffline(agent: OfflineAgent): void {
  offline = agent
}

function offlineAgent(): OfflineAgent {
  if (!offline) throw new Error('the offline profile runs under Node (@openworld/ai): this modder works live only')
  return offline
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
  private jobs: { what: string; job: () => Promise<void>; key?: string }[] = []
  private running = 0
  private idle: (() => void)[] = []
  /** Where each class of request is at each tier (GET /progress; progressKey), and that key of each request id. */
  private progress = new Map<string, ModProgress>()
  private privateWork = new Map<string, Modder>()
  private requestKey = new Map<string, string>()
  /** An author's draft as it goes (GET /trace?id=): kept a while after it ends, for the chat to read. */
  private traces = new Map<string, { steps: TraceStep[]; done: boolean }>()

  /** The steps of an author's draft so far (empty: no such draft here). */
  traceOf(id: string): { steps: TraceStep[]; done: boolean } {
    return this.traces.get(id) ?? { steps: [], done: false }
  }

  /** A draft's step writer: steps under its id, timed from now; `end` marks it done and forgets it in ten minutes. */
  private tracer(id: string | undefined): { step: (s: Omit<TraceStep, 'at'>) => void; end: () => void } {
    const t0 = Date.now()
    if (!id) return { step: () => undefined, end: () => undefined }
    const tr = { steps: [] as TraceStep[], done: false }
    this.traces.set(id, tr)
    return { step: (s) => void tr.steps.push({ at: Date.now() - t0, ...s }), end: () => ((tr.done = true), void setTimeout(() => this.traces.get(id) === tr && this.traces.delete(id), 600_000).unref?.()) }
  }
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

  /** `key`: what the job will put in flight (an escalation), so the same is not queued twice meanwhile. */
  private later(what: string, job: () => Promise<void>, key?: string): void {
    this.jobs.push({ what, job, key })
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

  /** A player conversation proposes bounded recipe data, without tools or library writes. */
  async research(body: unknown) {
    const why = this.down()
    if (why || !this.backend) throw new Error(why || 'No model connected')
    return researchConversation(this.backend, body)
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
      { role: 'user', content: thingUser(intent, { catalogue: catalogueOf(Object.values(onto.types)), materials: Object.keys(onto.materials ?? {}), had: body.had ?? [], stations: body.stations ?? [], elements: onto.elements ?? [] }) },
    ]
    if (body.previous) messages.push({ role: 'user', content: reviseDraftUser(body.previous, body.feedback ?? '') })
    const diagnostics: string[] = []
    const { step, end } = this.tracer(body.id)
    try {
      for (let round = 0; round < 3; round++) {
        const answer = withoutThinking((await model.chat(messages, { json: true, temperature: 0.6, purpose: 'create', reasoning: 'medium', deadlineMs: DRAFT_MS })).content)
        const j = parseJson(answer) as { patch?: Patch; looks?: Record<string, string>; look?: string } | undefined
        // a new thing is types alone: what it does is asked act by act, as holes
        const patch: Patch = { artifacts: (j?.patch?.artifacts ?? []).filter((a) => a?.kind === 'type'), ...(j?.patch?.note && { note: j.patch.note }) }
        const types = patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type] : []))
        const made = (t: TypeDef) => `${t.station ?? 'hands'}, of ${t.makeup!.map((m) => `${m.count} ${m.type.split('/').pop()}`).join(' + ')}`
        const said = [patch.note, ...types.map((t) => `${enName(t)} (${t.id})${t.makeup?.length ? `: ${made(t)}` : ''}`)]
        step({ who: 'ai', text: said.filter(Boolean).join('\n') || 'no type in the answer', data: j })
        const res = patch.artifacts.length ? library.validate(patch) : { ok: false, errors: ['no type artifact'], warnings: [] }
        if (!res.ok) {
          diagnostics.push(...res.errors)
          step({ who: 'engine', text: 'sent back to the AI', problems: res.errors })
          messages.push({ role: 'assistant', content: answer }, { role: 'user', content: repairUser(res.errors, res.warnings) })
          continue
        }
        step({ who: 'engine', text: 'the engine takes it' })
        // each new thing drawn by its own look (a pelt is not drawn as the cloak made of it)
        const lookOf = (t: TypeDef) => {
          if (typeof j?.looks?.[t.id] === 'string') return j.looks[t.id]
          return types.length === 1 ? (j?.look ?? patch.note ?? intent) : `${enName(t)}, ${t.id.split('/').slice(0, -1).join(' ')}`
        }
        const look = types.length ? lookOf(types[types.length - 1]) : undefined
        for (const t of types) step({ who: 'artist', text: `drawing ${enName(t)}: ${lookOf(t)}` })
        const drawn = await this.drawAll(model, patch, types.map((t) => ({ id: t.id, name: t.name as { en: string; zh: string }, why: lookOf(t) })))
        const shown = library.validate(drawn).ok ? drawn : patch
        const pictured = shown.artifacts.filter((a) => a.kind === 'type' && a.type.art).length
        step({ who: 'artist', text: pictured === types.length ? 'drawn' : `${pictured} of ${types.length} drawn (the rest show their kind's picture)` })
        return { patch: shown, diagnostics: [], ...(look && { look }), usage: model.usage }
      }
      step({ who: 'engine', text: 'no draft held after three tries', problems: diagnostics.slice(-5) })
      return { patch: null, diagnostics }
    } catch (err) {
      this.pause((err as Error).message)
      step({ who: 'engine', text: (err as Error).message })
      return { patch: null, diagnostics: [...diagnostics, (err as Error).message] }
    } finally {
      end()
    }
  }

  /**
   * A person or a map the game's author asks for in a sentence (the editor's AI drafter): one file of the game, made of
   * what the editor says the game has (`context`), held to its shape and mended until it is (drafts.ts). Nothing is
   * written: the editor compiles it with the project, and the author takes it in.
   */
  async draft(body: DraftBody): Promise<DraftReply> {
    const why = this.down()
    if (why || !this.backend) return { draft: null, diagnostics: [why ? `model unavailable: ${why}` : 'no model'] }
    const kind = body?.kind
    if (kind !== 'person' && kind !== 'map') return { draft: null, diagnostics: ['kind: person or map'] }
    const intent = String(body?.intent ?? '').trim().slice(0, 500)
    if (!intent) return { draft: null, diagnostics: [`say what the ${kind} is`] }
    const ctx = body.context ?? {}
    const model = new Meter(this.backend)
    const messages: ChatMessage[] = [
      { role: 'system', content: DRAFT_SYSTEM },
      { role: 'user', content: draftUser(kind, intent, ctx) },
    ]
    if (body.previous) messages.push({ role: 'user', content: reviseDraftUser(body.previous, body.feedback ?? '') })
    const diagnostics: string[] = []
    const { step, end } = this.tracer(body.id)
    try {
      for (let round = 0; round < 3; round++) {
        const answer = withoutThinking((await model.chat(messages, { json: true, temperature: 0.7, purpose: 'create', reasoning: 'medium', deadlineMs: DRAFT_MS })).content)
        const j = parseJson(answer) as Record<string, unknown> | undefined
        step({ who: 'ai', text: j ? summary(kind, j) : 'no JSON in the answer', data: j })
        const problems = kind === 'person' ? personProblems(j, ctx) : mapProblems(j, ctx)
        if (!problems.length) {
          step({ who: 'engine', text: 'its shape holds' })
          return { draft: kind === 'map' ? settleMap(j!) : j!, diagnostics: [], usage: model.usage }
        }
        diagnostics.push(...problems)
        step({ who: 'engine', text: 'sent back to the AI', problems })
        messages.push({ role: 'assistant', content: answer }, { role: 'user', content: `The file is not yet right:\n${problems.map((p) => `- ${p}`).join('\n')}\nFix it and answer with the whole JSON object again.` })
      }
      step({ who: 'engine', text: 'no draft held after three tries', problems: diagnostics.slice(-5) })
      return { draft: null, diagnostics, usage: model.usage }
    } catch (err) {
      this.pause((err as Error).message)
      step({ who: 'engine', text: (err as Error).message })
      return { draft: null, diagnostics: [...diagnostics, (err as Error).message] }
    } finally {
      end()
    }
  }

  /** The author took a new thing into the game: the library has it, so its holes can be asked (a thing it has is kept). */
  adopt(patch: Patch): { ok: boolean; errors: string[] } {
    const { library } = this.opts
    // types alone, as createThing drafts them: a rule taken in here would pass by the pipeline's audit and review
    const fresh: Patch = { ...patch, artifacts: (patch?.artifacts ?? []).filter((a) => a?.kind === 'type' && !library.lib.types.some((t) => t.id === a.type.id)) }
    if (!fresh.artifacts.length) return { ok: true, errors: [] }
    const r = library.commit(fresh, undefined, this.now())
    return { ok: r.ok, errors: r.result.errors }
  }

  /** Where a request is: waiting its turn, designing, finding, creating (undefined: not here, or done). */
  progressOf(requestId: string): ModProgress | undefined {
    const local = this.privateWork.get(requestId)
    if (local) return local.progressOf(requestId)
    const key = this.requestKey.get(requestId)
    return key ? this.progress.get(key) : undefined
  }

  async resolve(body: ResolveBody, profile: Profile = this.opts.profile ?? 'live'): Promise<ResolveReply> {
    const req = body?.request
    if (!req?.event || !req.scenario || !req.context) return { patch: null, outcome: 'failed', diagnostics: ['malformed request'] }
    const base = signatureOf(req)
    // asked again (design.md §5.17): a question of its own, beside the provisional answer it replaces
    const sig = req.again ? { ...base, key: `${base.key}|again:${req.again.rule}` } : base
    this.requestKey.set(req.id, progressKey(sig, req))
    try {
      return await this.resolveClass(req, body, sig, profile)
    } finally {
      this.requestKey.delete(req.id)
    }
  }

  private async resolveClass(req: ModRequest, body: ResolveBody, sig: Signature, profile: Profile): Promise<ResolveReply> {
    const host = req.event.host?.type
    // a question about what only this save knows (a thing it researched) is answered for this save alone; any other
    // is answered for everyone, from the workspace without the save's own knowledge (a shared answer that named a
    // researched kind would name what no other client has)
    const own = privateOf(body.workspace)
    if (touchesPrivate(req, own)) return this.privateEpisode(req, body.workspace!)
    body = { ...body, workspace: sharedWorkspace(body.workspace, own) }
    const hit = this.cover(req, sig)
    if (hit) return hit
    // the same class already being worked on at this tier or a higher one: wait for it, then see whether it answers
    // this one too (an answer at a lower tier never does: the tier is part of what is in flight)
    const tier = tierOfRequest(req)
    const running = tiersFrom(tier).map((t) => this.inflight.get(inFlight(sig.key, t))).find((p) => !!p)
    if (running) {
      await running.catch(() => undefined)
      const again = this.cover(req, sig)
      if (again) return again
    }
    const base = this.opts.library.answeredByBase(req)
    if (base) return { patch: null, outcome: 'failed', diagnostics: [`answered by the base rule "${base}" here: the client's base rules are older than the service's`] }
    // the thing asked about is a kind only the asking client knows (its own patch, or one its save kept after the
    // library forgot it): an answer hosted on it could never be shared (the library refuses its host), so none is designed
    if (host && body.workspace?.patches?.types?.some((t) => t?.id === host) && !(host in this.opts.library.fullOntology().types))
      return { patch: null, outcome: 'failed', diagnostics: [`"${host}" is known only to this client (a kind of its own, or one its save kept): no answer for it can be shared`] }
    if (!this.opts.model) return { patch: null, outcome: 'unavailable' }
    // the backend said it is out (of quota, or signed out): no calls until the pause is over
    const why = this.down()
    if (why) return { patch: null, outcome: 'unavailable', diagnostics: [`model unavailable: ${why}`] }
    return this.track(inFlight(sig.key, tier), this.episode(req, body.workspace, sig, { profile }))
  }

  /** A researched form belongs to the asking save. Judge it in an in-memory fork and return
   * a save-only patch; neither its definitions nor its episode/memory enter shared state.
   */
  private async privateEpisode(req: ModRequest, ws: ModWorkspace): Promise<ResolveReply> {
    if (!this.backend) return { patch: null, outcome: 'unavailable' }
    const why = this.down()
    if (why) return { patch: null, outcome: 'unavailable', diagnostics: [`model unavailable: ${why}`] }
    const release = await this.design.acquire(0)
    try {
      const library = this.opts.library.fork()
      library.forOneSave = true
      const known = library.fullOntology()
      const p = ws.patches!
      const definitions: Patch['artifacts'] = [
        ...(p.types ?? []).filter(t => !(t.id in known.types)).map(type => ({ kind: 'type' as const, type })),
        ...(p.statuses ?? []).filter(s => !(s.id in known.statuses)).map(status => ({ kind: 'status' as const, status })),
      ]
      if (definitions.length) {
        const checked = library.commit({ artifacts: definitions })
        if (!checked.ok) return { patch: null, outcome: 'failed', diagnostics: checked.result.errors }
      }
      // Client rules are replayed through the normal loader, including provisional branches
      // set aside after a re-ask. They cannot redefine anything the canonical library owns.
      const data = library.lib.toJSON()
      const had = new Set(withAside(data).rules.map(r => r.id))
      const restored = restoreLibrary(library.base, {
        ...data, types: [], statuses: [],
        rules: [...data.rules, ...p.rules.filter(r => !had.has(r.id))],
        aside: [...(data.aside ?? []), ...(p.aside ?? []).filter(a => !had.has(a.rule.id))],
      }, library.fullOntology(), library.protectedFacts)
      const ordered = withAside(restored.toJSON())
      for (const rule of ordered.rules) if (!had.has(rule.id)) {
        // Keep an in-memory log too: coverage and a provisional rule's re-ask use it to
        // find the patch being reused/replaced. Nothing in this fork is persisted.
        const checked = library.commit({ artifacts: [{ kind: 'rule', rule }] })
        if (!checked.ok) return { patch: null, outcome: 'failed', diagnostics: checked.result.errors }
        if (ordered.aside.has(rule.id)) library.lib.setAside(rule.id)
      }
      const local = new Modder({ ...this.opts, library, model: this.backend, dry: true })
      this.privateWork.set(req.id, local)
      // what only this save knows grows by rules: it makes no kinds or statuses of its own (their names could be
      // taken by the shared library's later), and its rules are named apart (PRIVATE_RULES)
      const reply = await local.resolve({ request: { ...req, create: 'off' } }, 'live')
      if (!reply.patch) return { ...reply, episode: undefined }
      if (reply.patch.artifacts.some((a) => a.kind !== 'rule')) return { patch: null, outcome: 'failed', diagnostics: ['an answer for this save alone may not make new kinds or statuses'] }
      return { ...reply, episode: undefined, patch: { ...privateNames(reply.patch), scope: 'save' } }
    } finally {
      this.privateWork.delete(req.id)
      release()
    }
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
    // what is asked again is the provisional answer itself: it does not cover its own question
    if (!c || (req.again && c.rule === req.again.rule)) return undefined
    const { state } = this.opts
    const ep = this.blank(state.newEpisodeId(), req, sig, state.harness())
    ep.outcome = 'covered'
    ep.rules = [c.rule]
    ep.patch = c.patch
    if (this.opts.dry) this.trials.set(req.id, ep)
    else {
      state.recordEpisode(ep)
      this.log(`${ep.id} covered by ${c.rule}: ${req.summary}`)
    }
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
      node: skillNodeOf(req),
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
    const where = progressKey(sig, req, eo)
    if (!this.progress.has(where)) this.progress.set(where, { stage: 'queued' })
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
      this.progress.delete(where)
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
    // the setting's workload over the harness (request.ts): a player waiting gets their tier's; the
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
    const replaces = eo.revise?.episode.rules ?? (req.again ? [req.again.rule] : [])

    // recall
    const lib = library.workspace(ws, replaces)
    // this kind of request's own skill is shown whole (and booked as read): the rest by name
    const own = ep.node ? state.skillAt(ep.node) : undefined
    const ownBody = own && state.readSkill(own.name)
    const recall = { lessons: state.relevantLessons(sig.terms, h.recall.lessons), episodes: state.similarEpisodes(sig.terms, h.recall.episodes), skills: state.relevantSkills(sig.terms, ep.node), ...(own && ownBody && { skill: { name: own.name, body: ownBody.trim() } }) }
    if (own && ownBody && !ep.skillsRead.includes(own.name)) ep.skillsRead.push(own.name)
    ep.shown = { lessons: recall.lessons.map((l) => l.id), episodes: recall.episodes.map((e) => e.id), skills: recall.skills.map((s) => s.name) }

    const validate = (p: Patch) => library.validate(p, req, ws, replaces)
    const ctx: ToolContext = { library: lib, ontology: library.fullOntology(lib), request: req, state, validate, skillsRead: ep.skillsRead }
    const tools = h.design.toolRounds > 0 ? buildTools(ctx, h.tools) : []
    // the system prefix is the same for every request and every client (the base ontology), so
    // it is served from the provider's prompt cache; what patches added goes in the user turn.
    // The router (one call, no tools: live): the design sees the request's own types and asks for
    // the rest by name; the harness finds them in the catalogue, or has them created.
    const router = h.design.toolRounds === 0
    // (cast, not annotated: enter() moves it on, and an annotation would let TypeScript narrow it to 'local')
    let stage = 'local' as 'local' | 'find' | 'create'
    let creations: Creation[] = []
    // the new things' pictures, begun as soon as they are named (the designer writes their rules meanwhile)
    const drawing = new Map<string, Promise<PixelArt | undefined>>()
    const draws = wl.create !== 'low' && wl.create !== 'off'
    const begin = (cs: Creation[]) => {
      if (draws) for (const c of cs) if (c?.id && !drawing.has(c.id)) drawing.set(c.id, this.drawOne(model, { id: c.id, name: c.name } as TypeDef, c.why, wl).catch(() => undefined))
    }
    const at = (p: ModProgress) => this.progress.set(progressKey(sig, req, eo), p)
    at({ stage: 'local' })
    if (router) ep.route = ['local']
    const added = { types: lib.types.filter((t) => !(t.id in library.ontology.types)), statuses: lib.statuses.filter((s) => !(s.id in library.ontology.statuses)) }
    const setting = workloadNote(wl)
    const user = [
      designUser(req, recall, h.design.brief ? briefOf(req, lib, ctx.ontology, !router) : undefined, added, !router),
      ...(eo.revise ? [revisionUser(eo.revise.episode.patch!, eo.revise.notes)] : []),
      ...(req.again ? [againUser(req.again)] : []),
      ...(setting ? [setting] : []),
    ]
    const messages: ChatMessage[] = [
      { role: 'system', content: designSystem(buildModSpec(library.ontology, undefined, { types: !router }), h, router) },
      { role: 'user', content: user.join('\n\n') },
    ]

    let repairs = 0
    let reviews = 0
    let reviewLater = false
    let phase: Attempt['phase'] = 'design'
    let lastRaw = '' // the last answer, kept for an attempt the program failed on before it was recorded
    let sentBack = false // a use that changed nothing is sent back once; then it is kept as words
    const retry = (content: string, next: Attempt['phase']) => {
      messages.push({ role: 'user', content })
      phase = next
    }
    /** The router moves on: to find what the design needs, or to create what the world lacks. */
    const enter = (next: 'find' | 'create', p: ModProgress = { stage: next }) => {
      stage = next
      ep.route!.push(next)
      at(p)
    }
    const create = (cs: Creation[]) => {
      enter('create', { stage: 'create', creating: cs.map((c) => shownName(c.name)) })
      creations = cs
      begin(cs)
      retry(createUser(cs, Object.keys(ctx.ontology.materials ?? {})), 'create')
    }
    /** Someone else's patch, committed meanwhile, may already answer the request: then the episode is covered. */
    const coveredMeanwhile = (): boolean => {
      const meanwhile = eo.revise ? undefined : library.covering(req)
      if (!meanwhile) return false
      ep.outcome = 'covered'
      ep.rules = [meanwhile.rule]
      ep.patch = meanwhile.patch
      return true
    }
    try {
      for (;;) {
        const answer = await this.converse(model, messages, tools, h, ep, stage === 'local' ? undefined : SLOW_MS)
        lastRaw = answer
        const failed = (errors: string[]) => ep.attempts.push({ phase, errors, warnings: [], raw: answer.slice(0, 2000) })
        let bracketsRepaired = false
        const parsed = parseJson(answer, () => (bracketsRepaired = true))
        const stated = statedAffordance(parsed)
        const ask = router ? routeOf(parsed) : undefined
        // what the setting does not carry (request.ts): the catalogue at low, making new kinds when it is off
        // (and with the router off, an ablation: the request's own things only)
        const local = h.design.router === false
        const barred = ask && ((ask.create && (wl.create === 'off' || local)) || (ask.need && (!wl.find || local) && !ask.create))
        if (ask && barred) {
          failed([ask.create ? 'asked to create a new kind: off at this setting' : 'asked for the catalogue: not at this setting'])
          if (repairs++ >= h.repair.maxRounds) break
          retry(`${ask.create ? 'Making new kinds is off at this setting: answer with kinds the world has.' : 'There is no catalogue at this setting: answer with the things the request holds.'} Answer now with ONLY the JSON object {"patch": {"artifacts": [...]}}.`, 'repair')
          continue
        }
        // create only what the world lacks: a creation asked for at once, whose name is close to
        // things the catalogue has, goes through find first (the router is local, find, create)
        if (ask?.create && stage === 'local' && wl.find) {
          const close = new Map(ask.create.map((c) => [c.name.en, closestTypes(c.name.en || c.id, ctx.ontology, 6, c.name.zh)]))
          if ([...close.values()].some((ids) => ids.length)) {
            failed([])
            enter('find')
            ep.needed = ask.create.map((c) => c.name.en)
            retry(findUser(ask.create.map((c) => ({ name: c.name.en, why: c.why })), close, catalogueOf(Object.values(ctx.ontology.types))), 'find')
            continue
          }
        }
        if (ask?.need && stage === 'local' && wl.find) {
          // find: what the design needs beyond the request, in the whole catalogue
          failed([])
          enter('find')
          ep.needed = ask.need.map((n) => n.name)
          const candidates = new Map(ask.need.map((n) => [n.name, closestTypes(n.name, ctx.ontology)]))
          retry(findUser(ask.need, candidates, catalogueOf(Object.values(ctx.ontology.types))), 'find')
          continue
        }
        if (ask?.create && stage !== 'create') {
          // create: the world has no such thing; the player is told, and waits for it
          failed([])
          create(ask.create)
          continue
        }
        if (ask) {
          failed([ask.need ? 'asked for more things after the catalogue: write the patch now' : 'asked to create again: write the patch now'])
          if (repairs++ >= h.repair.maxRounds) break
          retry(`${ask.need ? 'You have the catalogue.' : 'Creating is already under way.'} Answer now with ONLY the JSON object {"patch": {"artifacts": [...]}}.`, 'repair')
          continue
        }
        const { patch: draft, fixes } = normalizePatch(parsed)
        if (bracketsRepaired) fixes.unshift('repaired the JSON brackets (one closed too early, or missing at the end)')
        if (!draft) {
          // say what was wrong: no JSON at all, JSON that does not parse (and where), or JSON with no patch in it
          const why = unreadable(answer)
          failed([why])
          if (repairs++ >= h.repair.maxRounds) break
          retry(why === NO_PATCH ? NO_JSON : `${why}\n\n${NO_JSON}`, 'repair')
          continue
        }
        let patch: Patch = { ...draft, author: 'modder' }
        const take = (fixed: { patch: Patch; fixes: string[] }) => {
          if (fixed.fixes.length) ((patch = fixed.patch), fixes.push(...fixed.fixes))
        }
        if (!wl.chains) take(withoutChains(patch))
        take(qualifyTerrains(patch, ctx.ontology))
        take(stationFromRules(patch, ctx.ontology))
        // the deterministic repairs off (an ablation): an answer that needed one is an invalid attempt
        if (h.design.fixes === false && fixes.length) {
          failed(fixes.map((f) => `needed a mechanical repair: ${f}`))
          if (repairs++ >= h.repair.maxRounds) break
          retry(`Your answer needed these repairs: ${fixes.join('; ')}. Answer now with ONLY the corrected JSON object {"patch": {"artifacts": [...]}}.`, 'repair')
          continue
        }
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
          if (coveredMeanwhile()) break
          // the draft makes a thing the world has no type for (a spawn or a transform into an unknown id): a
          // creation, not a slip to repair; told only "unknown type", the designer swaps in something known
          // and learns never to create
          const missing = router && !local && stage !== 'create' && wl.create !== 'off' ? unknownMade(patch, ctx.ontology) : []
          if (missing.length) {
            create(missing)
            continue
          }
          if (repairs++ >= h.repair.maxRounds) break
          retry(repairUser(res.errors, res.warnings), 'repair')
          continue
        }
        // what the thing affords (design.md §5.17): a use must change the scene that asked; sent back once, then words
        {
          const j = judge(patch, req, stated, lib, ctx.ontology)
          if (j.mismatch && !sentBack) {
            sentBack = true
            attempt.errors = [j.mismatch]
            if (repairs++ >= h.repair.maxRounds) break
            retry(`${j.mismatch}\n\nAnswer with the complete JSON object again, same format.`, 'repair')
            continue
          }
          const kept = j.mismatch ? judge(patch, req, stated, lib, ctx.ontology, 'words') : j
          if (j.mismatch) kept.fixes.push('a use that changed nothing in the scene, twice: kept as words (provisional)')
          patch = kept.patch
          attempt.patch = patch
          ep.affords = kept.affords
          if (kept.fixes.length) attempt.fixes = [...(attempt.fixes ?? []), ...kept.fixes]
        }
        // the auditor, before shipping: what it breaks in the sandbox goes back to the designer
        if (auditOf(h).enabled && auditOf(h).blocking && !narratesOnly(patch, req)) {
          let found = await this.audit(model, req, patch, ctx, h)
          // a failed audit is never counted as a clean one (design.md §13): asked once more, then not shipped unaudited
          if (found.error) found = await this.audit(model, req, patch, ctx, h)
          attempt.audit = { confirmed: found.confirmed.map((f) => `${f.kind}: ${f.title}`), unconfirmed: found.unconfirmed.length }
          if (found.error) {
            attempt.errors = [`the audit failed (${found.error}): not shipped unaudited`]
            ep.error = attempt.errors[0]
            break
          }
          if (found.confirmed.length) {
            attempt.errors = auditNotes(found.confirmed)
            if (repairs++ >= h.repair.maxRounds) break
            retry(auditRepairUser(attempt.errors), 'audit')
            continue
          }
        }
        // reviewed before it ships: every draft that would ship, a revision too; one the reviewer sent back never
        // ships (after maxRounds revisions sent back, the episode fails)
        if (h.review.enabled && h.review.blocking !== false) {
          attempt.review = await this.review(model, req, patch, ctx, h, flagsOf(patch, derived), eo.profile === 'live')
          if (attempt.review.verdict === 'revise') {
            if (reviews++ >= h.review.maxRounds) {
              attempt.errors = [`the reviewer sent the draft back after ${h.review.maxRounds} revision(s): not shipped`, ...attempt.review.notes]
              break
            }
            retry(reviseUser(attempt.review.notes), 'review')
            continue
          }
          // no verdict is no review: the rule ships, and is reviewed again after the fact
          if (attempt.review.verdict === 'error') reviewLater = true
        }
        if (this.commit(ep, patch, req, replaces)) break
        // the library moved under us: someone else's patch may already answer this
        if (coveredMeanwhile()) break
        if (repairs++ >= h.repair.maxRounds) break
        retry(repairUser(ep.attempts.at(-1)!.errors, [], true), 'repair')
      }
    } catch (err) {
      ep.error = (err as Error).message
      // the program's own failure (a stack overflow, a crash in a fix): where it came from, kept with the episode
      const stack = (err as Error).stack?.split('\n').slice(1, 12).map((l) => l.trim()).join('\n')
      if (stack) ep.stack = stack
      if (lastRaw && !ep.attempts.some((x) => x.raw === lastRaw.slice(0, 2000))) ep.attempts.push({ phase, errors: [`the harness failed on this answer: ${(err as Error).message}`], warnings: [], raw: lastRaw.slice(0, 4000) })
    }

    // pictures begun for new things the episode did not ship (it failed, was covered, or found them after all):
    // still the episode's calls, waited for so their usage is counted and nothing runs on after it
    if (drawing.size) await Promise.allSettled(drawing.values())
    ep.usage = model.usage
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
    return replyOf(ep)
  }

  /**
   * The request as a repository task, worked by the SWE-style agent (offline: curriculum,
   * escalations, revisions). The agent's tests are the validator; the patch it leaves is
   * committed to the shared library like any other.
   */
  private async repoEpisode(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, eo: EpisodeOptions, h: Harness): Promise<ResolveReply> {
    const { state, library } = this.opts
    // (asked again: the answer takes the provisional one's place, as in work())
    const replaces = eo.revise?.episode.rules ?? (req.again ? [req.again.rule] : [])
    const lib = library.workspace(ws, replaces)
    const world = () => ({
      request: req,
      library: lib,
      ontology: library.fullOntology(lib),
      base: library.ontology,
      protectedFacts: library.protectedFacts,
      spec: buildModSpec(library.ontology, lib),
      revise: eo.revise ? { rules: replaces, notes: eo.revise.notes } : undefined,
    })
    const repo = await offlineAgent().materializeWorld(world())
    try {
      const run = await offlineAgent().runAgent({ ...repo.task, terms: sig.terms, node: skillNodeOf(req) }, { model: this.backend!, state, harness: h, record: false, log: this.opts.log })
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
      // the checks' calls (the audit, the review) are the episode's too
      const checks = new Meter(this.backend!)
      const ctx: ToolContext = { library: lib, ontology: library.fullOntology(lib), request: req, state, validate: (p) => library.validate(p, req, ws, replaces), skillsRead: ep.skillsRead }
      // the auditor, before shipping, as work() asks it: a patch it breaks in the sandbox is not committed, nor one it
      // could not audit (asked once more after a failure; the backend out is no audit either)
      const audited = async (p: Patch): Promise<AuditResult | undefined> => {
        try {
          let found = await this.audit(checks, req, p, ctx, h)
          if (found.error) found = await this.audit(checks, req, p, ctx, h)
          if (!found.error) return found
          ep.error = `the audit failed (${found.error}): not shipped unaudited`
        } catch (err) {
          ep.error = (err as Error).message
        }
        return undefined
      }
      // reviewed before it ships when the harness says so, as work() reviews its drafts: one the reviewer sends back is not committed
      const ship = async (p: Patch): Promise<void> => {
        if (h.review.enabled && h.review.blocking !== false) {
          const review = await this.review(checks, req, p, ctx, h, flagsOf(p)).catch((err: Error) => void (ep.error = err.message))
          if (!review) return
          if (review.verdict === 'revise') return void ep.attempts.push({ phase: 'review', patch: p, errors: ['the reviewer sent the draft back: not shipped', ...review.notes], warnings: [], review })
        }
        this.commit(ep, { ...p, author: 'modder' }, req, replaces)
      }
      const auditing = run.submitted && patch && !problems.length && auditOf(h).enabled && auditOf(h).blocking && !narratesOnly(patch, req)
      const found = auditing ? await audited(patch) : undefined
      if (found?.confirmed.length) {
        ep.attempts.push({ phase: 'audit', patch, errors: auditNotes(found.confirmed), warnings: [], audit: { confirmed: found.confirmed.map((f) => `${f.kind}: ${f.title}`), unconfirmed: found.unconfirmed.length } })
        // what the auditor broke goes back to the agent once, as the pipeline gives it to the designer
        if (h.repair.maxRounds > 0 && patch) {
          const again = await offlineAgent().materializeWorld({ ...world(), audit: { notes: auditNotes(found.confirmed), draft: patch } })
          try {
            const second = await offlineAgent().runAgent({ ...again.task, terms: sig.terms, node: skillNodeOf(req) }, { model: this.backend!, state, harness: h, record: false, log: this.opts.log })
            ep.usage = { calls: ep.usage.calls + second.episode.usage.calls, input: ep.usage.input + second.episode.usage.input, output: ep.usage.output + second.episode.usage.output, cost: (ep.usage.cost ?? 0) + (second.episode.usage.cost ?? 0) }
            const fixed = again.collect()
            const placed = fixed.patch ? placePatch(fixed.patch, req, { ontology: library.fullOntology(lib), library: lib }).patch : undefined
            const submitted = second.submitted && placed && !fixed.problems.length
            const still = submitted ? await audited(placed) : undefined
            if (placed && still && !still.confirmed.length) await ship(placed)
            else ep.attempts.push({ phase: 'audit', patch: placed, errors: still?.confirmed.length ? auditNotes(still.confirmed) : fixed.problems.length ? fixed.problems : submitted ? [ep.error ?? 'not audited'] : ['the second draft was not submitted'], warnings: [] })
          } finally {
            await again.dispose()
          }
        }
      } else if (run.submitted && patch && !problems.length && (!auditing || found)) await ship(patch)
      else if (problems.length) ep.attempts.push({ phase: 'repair', errors: problems, warnings: [] })
      if (ep.outcome !== 'accepted') ep.outcome = 'failed'
      ep.usage = { calls: ep.usage.calls + checks.calls, input: ep.usage.input + checks.input, output: ep.usage.output + checks.output, cost: (ep.usage.cost ?? 0) + checks.cost }
      // a trial run (a dry modder's) keeps nothing: no episode, no skill's use, no reflection, as work() does
      if (this.opts.dry) {
        this.trials.set(req.id, ep)
        return { patch: ep.outcome === 'accepted' ? (ep.patch ?? null) : null, outcome: ep.outcome, episode: ep.id }
      }
      state.recordEpisode(ep)
      state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
      this.log(`${ep.id} ${eo.profile} repo${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} in ${ep.usage.calls} steps, ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}`)
      // a failure that is the backend's is no lesson (afterwards() says why)
      this.later(`reflect ${ep.id}`, () => reflectAfter(ep as never, { model: this.backend!, state, harness: h, kindTerm: WORLD_TERM }))
      return replyOf(ep)
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
        const repo = await offlineAgent().materializeWorld({ request: req, library: before.lib, ontology: before.fullOntology(), base: before.ontology, spec: buildModSpec(before.ontology, before.lib), protectedFacts: before.protectedFacts })
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
    // a review after shipping, with what it should look at first; a rule it sends back is revised offline
    const reviewed = async (flags: string[]) => {
      const model = new Meter(this.backend!)
      const v = await this.review(model, req, ep.patch!, ctx, h, flags)
      this.opts.state.note('review', { episode: ep.id, rules: ep.rules, flags, ...v, usage: model.usage })
      if (v.verdict === 'revise' && v.notes.length && h.revise) await this.reviseHeld(ep, req, ws, sig, v.notes, 'review')
    }
    if (reviewLater) flags.push('the reviewer before shipping gave no verdict: look at everything')
    // a review after the fact: for a rule that narrates only or that the harness's test could not check (and
    // for every live rule when the harness says review.unflagged)
    if (ep.outcome === 'accepted' && !eo.revise && h.review.enabled && (flags.length || (h.review.blocking === false && h.review.unflagged)) && (!shipped?.review || reviewLater))
      this.later(`review ${ep.id}`, () => reviewed(flags))
    // the auditor, after shipping: what it breaks in the sandbox leaves the library at once (clients drop
    // it on their next sync), and goes back for a revision. A patch that only narrates has nothing to
    // break: no call, and the journal says why
    const auditing = ep.outcome === 'accepted' && !eo.revise && auditOf(h).enabled && !auditOf(h).blocking && ep.patch
    if (auditing && narratesOnly(ep.patch!, req)) this.opts.state.note('audit', { episode: ep.id, rules: ep.rules, skipped: NARRATES_ONLY, confirmed: [], unconfirmed: [], usage: { calls: 0, input: 0, output: 0, cost: 0 } })
    else if (auditing)
      this.later(`audit ${ep.id}`, async () => {
        const model = new Meter(this.backend!)
        const found = await this.audit(model, req, ep.patch!, ctx, h)
        this.opts.state.note('audit', {
          episode: ep.id,
          rules: ep.rules,
          confirmed: found.confirmed.map(({ evidence: _, ...f }) => f),
          unconfirmed: found.unconfirmed.map((u) => `${u.finding.title}: ${u.why}`),
          ...(found.error && { error: found.error }),
          usage: model.usage,
        })
        if (!found.confirmed.length) {
          // what the sandbox reproduced but is no harm the code recognizes is not removed: a reviewer reads it
          const odd = found.reproduced ?? []
          if (!odd.length || !h.review.enabled) return
          return reviewed(odd.map((u) => `the auditor showed, but the code does not count as harm: ${u.finding.kind}: ${u.finding.title}`))
        }
        // only the version audited leaves: one that replaced it under its id meanwhile (a revision) was not audited here
        const held = this.held(ep)
        if (!held.length) return void this.log(`${ep.id} audit: ${found.confirmed.map((f) => `${f.kind}: ${f.title}`).join('; ')}, but ${ep.rules.join(', ')} left or was replaced meanwhile`)
        for (const id of held) this.opts.library.remove(id, this.now())
        this.log(`${ep.id} audit: ${found.confirmed.map((f) => `${f.kind}: ${f.title}`).join('; ')} → removed ${held.join(', ')}`)
        if (h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: { ...ep, rules: held }, notes: auditNotes(found.confirmed) } })
      })
    // a live request that failed is worked again with the offline profile: the world still learns it
    const offline = `${inFlight(sig.key, tierOfRequest(req))}#offline`
    // (one escalation per class: none while one is in flight, or still waiting its turn among the background work)
    if (ep.outcome === 'failed' && eo.profile === 'live' && h.escalate && !this.inflight.has(offline) && !this.jobs.some((j) => j.key === offline))
      this.later(
        `escalate ${ep.id}`,
        async () => {
          if (this.opts.library.covering(req)) return
          await this.track(offline, this.episode(req, ws, sig, { profile: 'offline', escalatedFrom: ep.id }))
        },
        offline,
      )
    // what went wrong is reflected on at once; live episodes that went cleanly, a batch at a time
    const clean = eo.profile === 'live' && !eo.revise && !eo.escalatedFrom && ep.outcome === 'accepted' && !flags.length && ep.attempts.every((a) => !a.errors.length && !a.fixes?.length && !a.review && ['design', 'find', 'create'].includes(a.phase))
    if (clean && (h.reflect.batch ?? 1) > 1) {
      this.clean.push({ ep, sig })
      if (this.clean.length < h.reflect.batch!) return
      const due = this.clean.splice(0)
      this.later(`reflect ${due.map((d) => d.ep.id).join(', ')}`, () => this.reflect(due))
    } else this.later(`reflect ${ep.id}`, () => this.reflect([{ ep, sig }]))
  }

  /** The rules of a shipped episode still in force in the version it shipped (not removed, nor replaced under their id since). */
  private held(ep: Episode): string[] {
    const shipped = this.shipped.get(ep)
    return ep.rules.filter((id) => shipped !== undefined && this.opts.library.seqOf(id) === shipped)
  }

  /** A revision of what a check after shipping looked at: only the version it looked at (one that replaced it meanwhile was not). */
  private async reviseHeld(ep: Episode, req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, notes: string[], by: string): Promise<void> {
    const held = this.held(ep)
    if (!held.length) return void this.log(`${ep.id} ${by}: revise, but ${ep.rules.join(', ')} left or was replaced meanwhile`)
    await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: { ...ep, rules: held }, notes } })
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
  private async drawOne(model: Model, t: TypeDef, why: string | undefined, wl?: Workload): Promise<PixelArt | undefined> {
    const what = why ?? `a new kind of ${t.id.split('/').slice(-2, -1)[0] ?? 'thing'}`
    const high = wl?.create === 'high'
    const name = typeof t.name === 'object' && t.name ? (t.name as { en: string; zh: string }) : { en: String(t.name ?? t.id), zh: String(t.name ?? t.id) }
    const messages: ChatMessage[] = [
      { role: 'system', content: ART_SYSTEM },
      { role: 'user', content: artUser({ id: t.id, name }, what) },
    ]
    for (let i = 0; i < (high ? 3 : 2); i++) {
      const r = await model.chat(messages, { json: true, temperature: 0.4, purpose: 'art', reasoning: high ? 'high' : 'medium', deadlineMs: SLOW_MS })
      const j = parseJson(r.content) as Partial<PixelArt> | undefined
      const art = { grid: j?.grid ?? [], palette: j?.palette ?? {} } as PixelArt
      const problems = artProblems(art)
      if (!problems.length) return art
      messages.push({ role: 'assistant', content: r.content }, { role: 'user', content: `Fix this and answer with the whole JSON again: ${problems.join('; ')}` })
    }
    return undefined
  }

  /** The design conversation: tool calls until the model answers, or the round budget runs out. */
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
        ep.tools.push({ name: c.name, args: clipJson(c.args, 2000), ms: Date.now() - t0 })
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
      const found = probe(req, ctx.ontology, ctx.library, withArtifacts(ctx.library, patch))
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

  /** The middle loop, what is worth keeping: one reflection call on one episode, or on a batch of clean ones (each cited by what it teaches). */
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
    const cited = done.length === 1 ? last.ep.id : ids
    // one episode: its kind of task too (its skill, or its notes); a batch of several kinds: the rules alone
    const stand = done.length === 1 ? nodeStand(state, last.ep.node ?? skillNodeOf(last.ep.request), h, troubled(last.ep as never)) : undefined
    const r = await model.chat(
      [
        { role: 'system', content: REFLECT_SYSTEM },
        { role: 'user', content: reflectUser(done.length === 1 ? last.ep : done.map((i) => i.ep), coarse, state.relevantLessons(terms, 20), stand ? nodeSection(stand) : [], similar) },
      ],
      { json: true, temperature: 0.2, purpose: 'reflect', reasoning: h.reflect.reasoning, provider: profileOf(h, 'offline').design.provider },
    )
    const kept = keepReflection(state, r.content, { cited, kindTerm: WORLD_TERM, stand })
    state.note('reflect', { episode: cited, node: stand?.node, lessons: kept.lessons, skill: kept.skill, notes: kept.notes, usage: model.usage })
  }
}

const NARRATES_ONLY = 'narrates only'

/**
 * A patch of rules that only narrate (changesNothing) has nothing the auditor could break: it adds no thing and
 * changes none, nor cancels a default of the hole it answers that does something.
 */
function narratesOnly(patch: Patch, req: ModRequest): boolean {
  return patch.artifacts.every((a) => a.kind === 'rule' && changesNothing(a.rule, req.hole?.default))
}

/**
 * What the harness's own test could not hold a rule to (answer.ts, and the derived test the validator dropped):
 * since a learned rule has no siblings (§5.16) this is what "did not generalize" was, a rule the harness
 * could not check.
 */
const UNTESTED = /could not derive a test|derived test dropped|checks only that the rule answers/

/** What the reviewer should look at first: rules that change nothing, rules the harness's test could not check. */
function flagsOf(patch: Patch, derived?: string[]): string[] {
  const flags: string[] = []
  const quiet = new Set<string>()
  for (const a of patch.artifacts)
    if (a.kind === 'rule' && changesNothing(a.rule)) {
      quiet.add(a.rule.id)
      flags.push(`"${a.rule.id}" changes nothing in the world (it only narrates; judged ${a.rule.affords ?? 'unsaid'}: no use for this act). Check that judgment: revise if the thing has a common use a player would expect here, keep it if it has none.`)
    }
  for (const d of derived ?? [])
    if (UNTESTED.test(d) && ![...quiet].some((id) => d.startsWith(`${id}:`))) flags.push(`the harness could not test what it does (${d}): look at the whole outcome`)
  return flags
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

/** What an episode replies: its patch unless it failed, and then why. */
function replyOf(ep: Episode): ResolveReply {
  const last = ep.attempts.at(-1)
  return {
    patch: ep.outcome === 'failed' ? null : (ep.patch ?? null),
    outcome: ep.outcome,
    episode: ep.id,
    diagnostics: ep.outcome === 'failed' ? [...(last?.errors ?? []), ...(ep.error ? [ep.error] : [])] : undefined,
  }
}

/** A new type's English name (its id when it has none). */
const enName = (t: TypeDef): string => (t.name as { en?: string })?.en ?? t.id

/** A creation's name as the waiting player reads it: one named only in English (from its id) is so in Chinese too. */
const shownName = (n: { en: string; zh: string }) => ({ en: n.en, zh: n.zh || n.en })

/** Finding and creating take longer than a design (a long catalogue, a picture): their calls may. */
const SLOW_MS = 60_000
/** An author drafting (a thing, a person, a map) waits on purpose, and a map is many cells: longer than a player's. */
const DRAFT_MS = 180_000

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
  /** The draft's id, for its steps (GET /trace). */
  id?: string
  /** The draft before (its patch), and what the author asked to change in it. */
  previous?: unknown
  feedback?: string
  had?: Had[]
  stations?: string[]
}

/** An author's person or map (POST /draft): what it is, and what the game has to make it of. */
export interface DraftBody {
  kind: DraftKind
  intent: string
  context?: DraftContext
  /** The draft's id, for its steps (GET /trace). */
  id?: string
  /** The draft before, and what the author asked to change in it: a revision, not a new draft. */
  previous?: unknown
  feedback?: string
}

export interface DraftReply {
  draft: Record<string, unknown> | null
  diagnostics: string[]
  usage?: { calls: number; input: number; output: number; cost: number }
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

/** What is in flight for a class of request: its answer serves its tier and the lower ones (covering, tiersFrom). */
const inFlight = (key: string, tier: Tier): string => `${key}@${tier}`

/**
 * Where a request's progress is kept: its class at its tier, as it is in flight (another tier, or a revision or an
 * escalation of the class nobody waits on, keeps its own, and its end does not clear the request's).
 */
const progressKey = (sig: Signature, req: ModRequest, eo?: EpisodeOptions): string => `${inFlight(sig.key, tierOfRequest(req))}${eo?.revise || eo?.escalatedFrom ? '#background' : ''}`

/** A validation as a commit reports it (a trial run keeps nothing). */
function judged(result: ValidationResult, patch: Patch): CommitResult {
  return { ok: result.ok, result, rules: patchRules(patch).map((r) => r.id) }
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

// ---------------------------------------------------------------- what only one save knows (NPC recipe research)

/** What of a client's workspace is its save's own: the kinds it researched, and the rules only it keeps. */
function privateOf(ws?: ModWorkspace): { types: Set<string>; statuses: Set<string>; rules: Set<string> } {
  const p = ws?.patches
  const rules = [...(p?.rules ?? []), ...(p?.aside ?? []).map((a) => a.rule)].filter((r) => r.source?.local)
  return {
    rules: new Set(rules.map((r) => r.id)),
    types: new Set([...(p?.types ?? []).filter((t) => t.researched).map((t) => t.id), ...(p?.local?.types ?? []), ...rules.flatMap((r) => r.source!.local!.types)]),
    statuses: new Set([...(p?.local?.statuses ?? []), ...rules.flatMap((r) => r.source!.local!.statuses)]),
  }
}

/** Does the question touch what only the save knows: one of its things (the host, a role) of a kind it researched or with a status only it keeps, or a hole in a rule only it keeps? */
function touchesPrivate(req: ModRequest, own: ReturnType<typeof privateOf>): boolean {
  const things = [req.event.host, ...Object.values(req.event.roles)].filter((e): e is EntityInfo => !!e)
  return own.rules.has(req.hole.rule) || things.some((e) => [e.type, ...(e.typeChain ?? [])].some((t) => own.types.has(t)) || (e.statuses ?? []).some((x) => own.statuses.has(x)))
}

/** The workspace a shared answer is designed from: the client's patches without what only its save knows. */
function sharedWorkspace(ws: ModWorkspace | undefined, own: ReturnType<typeof privateOf>): ModWorkspace | undefined {
  const p = ws?.patches
  if (!p || (!own.types.size && !own.rules.size && !own.statuses.size)) return ws
  return {
    ...ws,
    patches: {
      rules: p.rules.filter((r) => !own.rules.has(r.id)),
      ...(p.aside && { aside: p.aside.filter((a) => !own.rules.has(a.rule.id)) }),
      ...(p.types && { types: p.types.filter((t) => !own.types.has(t.id)) }),
      ...(p.statuses && { statuses: p.statuses.filter((x) => !own.statuses.has(x.id)) }),
    },
  }
}

/** A private answer's rules under names of their own, and every place the patch names them (holes, tests). */
function privateNames(patch: Patch): Patch {
  const tag = Math.random().toString(16).slice(2, 10)
  let text = JSON.stringify(patch)
  for (const a of patch.artifacts)
    if (a.kind === 'rule' && !a.rule.id.startsWith(PRIVATE_RULES)) {
      const to = `${PRIVATE_RULES}${tag}/${a.rule.id.replace(/^patch\//, '')}`
      // the id as a whole string, or as the rule part of a hole key (`<rule>#<path>`)
      text = text.split(`"${a.rule.id}"`).join(`"${to}"`).split(`"${a.rule.id}#`).join(`"${to}#`)
    }
  return JSON.parse(text) as Patch
}
