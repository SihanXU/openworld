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

import { buildModSpec, type ModRequest, type ModWorkspace, type Patch, type ResolveBody, type ResolveReply } from '@lsw/engine'
import { briefOf, relatedRules } from './brief.ts'
import { changesNothing, deriveTests } from './derive.ts'
import { narrowKinds, normalizePatch, qualifyTerrains } from './fixes.ts'
import type { WorldLibrary } from './library.ts'
import { Meter, parseJson, reflectAgent, runAgent, type AgentTask, type ChatMessage, type ChatOptions, type Model, type TaskSource } from '@lsw/agent'
import { materializeWorld } from './repo.ts'
import { FINALIZE, NO_JSON, REFLECT_SYSTEM, REVIEW_SYSTEM, designSystem, designUser, reflectUser, repairUser, reviewUser, reviseUser, revisionUser } from './prompts.ts'
import { coarseTerms, signatureOf, type Signature } from './signature.ts'
import { profileOf, safeName, type Attempt as AgentAttempt, type Episode as AgentEpisode, type Harness, type Profile, type SelfState } from '@lsw/agent'

/** An episode of the patch pipeline: the request is the world's, the result a Patch. */
export type WorldEpisode = AgentEpisode<ModRequest, Patch>
type Episode = WorldEpisode
type Attempt = AgentAttempt<Patch>
import { buildTools, describeOutcome, type Tool, type ToolContext } from './tools.ts'

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

export class Modder {
  private inflight = new Map<string, Promise<ResolveReply>>()
  /** Work after the reply: reflections, late reviews, escalations, revisions (in order). */
  private backlog: Promise<void> = Promise.resolve()

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

  /** Resolves when all background work started so far is done. */
  async settled(): Promise<void> {
    let seen: Promise<void>
    do {
      seen = this.backlog
      await seen
    } while (seen !== this.backlog)
  }

  private later(what: string, job: () => Promise<void>): void {
    this.backlog = this.backlog.then(() => job().catch((err) => this.log(`${what}: ${(err as Error).message}`)))
  }

  async resolve(body: ResolveBody, profile: Profile = this.opts.profile ?? 'live'): Promise<ResolveReply> {
    const req = body?.request
    if (!req?.event || !req.scenario || !req.context) return { patch: null, outcome: 'failed', diagnostics: ['malformed request'] }
    const sig = signatureOf(req)
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

  private async episode(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, eo: EpisodeOptions): Promise<ResolveReply> {
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
    const messages: ChatMessage[] = [
      { role: 'system', content: designSystem(buildModSpec(library.ontology, lib), h) },
      { role: 'user', content: designUser(req, recall, h.design.brief ? briefOf(req, lib, ctx.ontology) : undefined) + (eo.revise ? `\n\n${revisionUser(eo.revise.episode.patch!, eo.revise.notes)}` : '') },
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
        const answer = await this.converse(model, messages, tools, h, ep)
        let bracketsRepaired = false
        const { patch: draft, fixes } = normalizePatch(parseJson(answer, () => (bracketsRepaired = true)))
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
        const attempt: Attempt = { phase, patch, errors: res.errors, warnings: res.warnings, ...(fixes.length ? { fixes } : {}), ...(derived?.length ? { derived } : {}) }
        ep.attempts.push(attempt)
        if (!res.ok) {
          if (repairs++ >= h.repair.maxRounds) break
          retry(repairUser(res.errors, res.warnings), 'repair')
          continue
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
    const repo = materializeWorld({
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
      if (run.submitted && patch && !problems.length) this.commit(ep, { ...patch, author: 'modder' }, req, replaces)
      else if (problems.length) ep.attempts.push({ phase: 'repair', errors: problems, warnings: [] })
      if (ep.outcome !== 'accepted') ep.outcome = 'failed'
      state.recordEpisode(ep)
      state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
      this.log(`${ep.id} ${eo.profile} repo${eo.revise ? ' revision' : eo.escalatedFrom ? ' escalation' : ''} ${ep.outcome} in ${ep.usage.calls} steps, ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}`)
      this.later(`reflect ${ep.id}`, () => reflectAgent(ep as never, { model: this.opts.model!, state, harness: h }))
      const last = ep.attempts.at(-1)
      return { patch: ep.outcome === 'accepted' ? (ep.patch ?? null) : null, outcome: ep.outcome, episode: ep.id, diagnostics: ep.outcome === 'failed' ? [...(last?.errors ?? []), ...(ep.error ? [ep.error] : [])] : undefined }
    } finally {
      repo.dispose()
    }
  }

  /**
   * World tasks for the outer loop's replays: a recorded request rebuilt as a repository against
   * the library as it was before that request was answered.
   */
  taskSource(): TaskSource {
    const dirs = new Map<AgentTask, () => void>()
    return {
      kinds: ['world-repo'],
      replay: async (ep) => {
        const req = ep.request as ModRequest
        if (!req?.scenario) return undefined
        const before = this.opts.library.fork((e) => !('patch' in e && e.request === req.id))
        if (before.covering(req)) return undefined // something else answers it now: no test of the harness
        const repo = materializeWorld({ request: req, library: before.lib, ontology: before.fullOntology(), spec: buildModSpec(before.ontology, before.lib), regression: before.regression })
        const task = { ...repo.task, terms: ep.terms }
        dirs.set(task, repo.dispose)
        return task
      },
      cleanup: async (task) => {
        dirs.get(task)?.()
        dirs.delete(task)
      },
    }
  }

  /** What follows an episode once the player has their answer. */
  private afterwards(ep: Episode, req: ModRequest, ws: ModWorkspace | undefined, sig: Signature, h: Harness, ctx: ToolContext, eo: EpisodeOptions): void {
    const shipped = ep.attempts.at(-1)
    const flags = ep.patch ? flagsOf(ep.patch, shipped?.derived) : []
    // a review after the fact: always for a live rule that narrates only or did not generalize
    if (ep.outcome === 'accepted' && !eo.revise && h.review.enabled && (h.review.blocking === false || flags.length) && !shipped?.review)
      this.later(`review ${ep.id}`, async () => {
        const model = new Meter(this.opts.model!)
        const v = await this.review(model, req, ep.patch!, ctx, h, flags)
        this.opts.state.note('review', { episode: ep.id, rules: ep.rules, flags, ...v, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
        if (v.verdict === 'revise' && v.notes.length && h.revise) await this.episode(req, ws, sig, { profile: 'offline', revise: { episode: ep, notes: v.notes } })
      })
    // a live request that failed is worked again with the offline profile: the world still learns it
    if (ep.outcome === 'failed' && eo.profile === 'live' && h.escalate && !this.inflight.has(`${sig.key}#offline`))
      this.later(`escalate ${ep.id}`, async () => {
        if (this.opts.library.covering(req)) return
        await this.track(`${sig.key}#offline`, this.episode(req, ws, sig, { profile: 'offline', escalatedFrom: ep.id }))
      })
    this.later(`reflect ${ep.id}`, () => this.reflect(ep, sig))
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
  private async converse(model: Model, messages: ChatMessage[], tools: Tool[], h: Harness, ep: Episode): Promise<string> {
    const specs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
    const call: ChatOptions = { temperature: h.design.temperature, purpose: 'design', reasoning: h.design.reasoning, hedgeMs: h.design.hedgeMs, deadlineMs: h.design.deadlineMs, retries: h.design.retries, provider: h.design.provider }
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

  private async review(model: Model, req: ModRequest, patch: Patch, ctx: ToolContext, h: Harness, flags: string[] = []): Promise<{ verdict: string; notes: string[] }> {
    const outcome = describeOutcome(req.scenario, patch, ctx)
    const r = await model.chat(
      [
        { role: 'system', content: REVIEW_SYSTEM },
        { role: 'user', content: reviewUser(req, patch, outcome, relatedRules(req, ctx.library), flags) },
      ],
      // nobody waits on a review: the cheap providers
      { json: true, temperature: 0.2, purpose: 'review', reasoning: h.review.reasoning, provider: profileOf(h, 'offline').design.provider },
    )
    const j = parseJson(r.content) as { verdict?: unknown; notes?: unknown } | undefined
    const notes = Array.isArray(j?.notes) ? j!.notes.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 5) : []
    return { verdict: j?.verdict === 'revise' ? 'revise' : 'ship', notes }
  }

  /** The middle loop: what is worth keeping from this episode. */
  private async reflect(ep: Episode, sig: Signature): Promise<void> {
    const { state } = this.opts
    const h = state.harness()
    if (!h.reflect.enabled || !this.opts.model || ep.outcome === 'covered') return
    const model = new Meter(this.opts.model)
    const coarse = coarseTerms(sig)
    const similar = state.similarEpisodes(sig.terms, 8, ep.id)
    const r = await model.chat(
      [
        { role: 'system', content: REFLECT_SYSTEM.replace('{N}', String(h.reflect.skillMinRecurrence)) },
        { role: 'user', content: reflectUser(ep, coarse, state.relevantLessons(sig.terms, 20), state.skills(), similar) },
      ],
      { json: true, temperature: 0.2, purpose: 'reflect', reasoning: h.reflect.reasoning, provider: profileOf(h, 'offline').design.provider },
    )
    const j = parseJson(r.content) as { lessons?: Parameters<SelfState['applyLessons']>[0]; skill?: { name?: unknown; description?: unknown; triggers?: unknown; body?: unknown } | null } | undefined
    const touched = j?.lessons && typeof j.lessons === 'object' ? state.applyLessons(j.lessons, ep.id, coarse) : []
    let skill: string | undefined
    const s = j?.skill
    if (s && typeof s.name === 'string' && typeof s.body === 'string' && s.body.trim()) {
      const name = safeName(s.name)
      if (state.skill(name) || similar.length >= h.reflect.skillMinRecurrence) {
        const triggers = Array.isArray(s.triggers) ? s.triggers.map(String) : coarse
        state.writeSkill({ name, description: String(s.description ?? name), triggers, body: s.body }, ep.id)
        skill = name
      }
    }
    state.note('reflect', { episode: ep.id, lessons: touched, skill, usage: { calls: model.calls, input: model.input, output: model.output, cost: model.cost } })
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
