// The modder: one undefined interaction in, one validated patch out, and a self-state that
// is a little different afterwards (docs/rsi.md §3).
//
//   comprehend  signature of the request; the shared library may already answer it (no model)
//   recall      lessons, similar episodes and skills from the self-state
//   design      a tool-using conversation that ends in a draft patch
//   verify      the engine's validator; its diagnostics go back into the conversation (repair)
//   review      a second opinion on plausibility and scope (optional, bounded)
//   commit      append to the shared library (re-validated against it as it is now)
//   record      the episode, every attempt and diagnostic in it, skill bookkeeping
//   reflect     after replying: distil lessons, write or revise a skill
//
// The harness (state/harness/pipeline.json) sets the budgets and switches of every stage.

import { buildModSpec, type ModRequest, type ModWorkspace, type Patch, type ResolveBody, type ResolveReply } from '@lsw/engine'
import type { WorldLibrary } from './library.ts'
import { Meter, parseJson, type ChatMessage, type Model } from './model.ts'
import { FINALIZE, NO_JSON, REFLECT_SYSTEM, REVIEW_SYSTEM, designSystem, designUser, reflectUser, repairUser, reviewUser, reviseUser } from './prompts.ts'
import { coarseTerms, signatureOf, type Signature } from './signature.ts'
import { safeName, type Attempt, type Episode, type Harness, type SelfState } from './state.ts'
import { asPatch, buildTools, describeOutcome, type Tool, type ToolContext } from './tools.ts'

export interface ModderOptions {
  library: WorldLibrary
  state: SelfState
  /** Absent: the modder still answers from the shared library, and reports `unavailable` otherwise. */
  model?: Model
  clock?: () => Date
  log?: (line: string) => void
}

const TOOL_OUTPUT_CAP = 12_000

export class Modder {
  private inflight = new Map<string, Promise<ResolveReply>>()
  private reflecting: Promise<void> = Promise.resolve()

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

  /** Resolves when every reflection started so far has been written. */
  settled(): Promise<void> {
    return this.reflecting
  }

  async resolve(body: ResolveBody): Promise<ResolveReply> {
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
    if (!this.opts.model) return { patch: null, outcome: 'unavailable' }
    const p = this.episode(req, body.workspace, sig)
    this.inflight.set(sig.key, p)
    try {
      return await p
    } finally {
      if (this.inflight.get(sig.key) === p) this.inflight.delete(sig.key)
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

  private async episode(req: ModRequest, ws: ModWorkspace | undefined, sig: Signature): Promise<ResolveReply> {
    const t0 = Date.now()
    const { state, library } = this.opts
    const h = state.harness()
    const model = new Meter(this.opts.model!)
    const ep = this.blank(state.newEpisodeId(), req, sig, h)

    // recall
    const lib = library.workspace(ws)
    const recall = { lessons: state.relevantLessons(sig.terms, h.recall.lessons), episodes: state.similarEpisodes(sig.terms, h.recall.episodes), skills: state.skills() }
    ep.shown = { lessons: recall.lessons.map((l) => l.id), episodes: recall.episodes.map((e) => e.id), skills: recall.skills.map((s) => s.name) }

    const ctx: ToolContext = { library: lib, ontology: library.fullOntology(lib), request: req, state, validate: (p) => library.validate(p, req, ws), skillsRead: ep.skillsRead }
    const tools = buildTools(ctx, h.tools)
    const messages: ChatMessage[] = [
      { role: 'system', content: designSystem(buildModSpec(library.ontology, lib), h) },
      { role: 'user', content: designUser(req, recall) },
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
        const draft = asPatch(parseJson(answer))
        if (!draft) {
          ep.attempts.push({ phase, errors: ['no JSON patch in the answer'], warnings: [] })
          if (repairs++ >= h.repair.maxRounds) break
          retry(NO_JSON, 'repair')
          continue
        }
        const patch: Patch = { ...draft, author: 'modder' }
        const res = library.validate(patch, req, ws)
        const attempt: Attempt = { phase, patch, errors: res.errors, warnings: res.warnings }
        ep.attempts.push(attempt)
        if (!res.ok) {
          if (repairs++ >= h.repair.maxRounds) break
          retry(repairUser(res.errors, res.warnings), 'repair')
          continue
        }
        if (h.review.enabled && reviews < h.review.maxRounds) {
          attempt.review = await this.review(model, req, patch, ctx)
          if (attempt.review.verdict === 'revise' && attempt.review.notes.length) {
            reviews++
            reviewed = patch
            retry(reviseUser(attempt.review.notes), 'review')
            continue
          }
        }
        if (this.commit(ep, patch, req, ws)) break
        // the library moved under us: someone else's patch may already answer this
        const meanwhile = library.covering(req)
        if (meanwhile) {
          ep.outcome = 'covered'
          ep.rules = [meanwhile.rule]
          ep.patch = meanwhile.patch
          break
        }
        if (repairs++ >= h.repair.maxRounds) break
        retry(repairUser(ep.attempts.at(-1)!.errors, [], true), 'repair')
      }
      if (ep.outcome === 'failed' && reviewed && this.commit(ep, reviewed, req, ws)) ep.error = 'the revision never validated; shipped the reviewed draft'
    } catch (err) {
      ep.error = (err as Error).message
      if (reviewed && ep.outcome === 'failed' && this.commit(ep, reviewed, req, ws)) ep.error += '; shipped the reviewed draft'
    }

    ep.usage = { calls: model.calls, input: model.input, output: model.output }
    ep.ms = Date.now() - t0
    state.recordEpisode(ep)
    const retired = state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
    this.log(`${ep.id} ${ep.outcome} after ${ep.attempts.length} attempt(s), ${ep.usage.calls} call(s), ${ep.ms} ms: ${req.summary}${ep.rules.length ? ` → ${ep.rules.join(', ')}` : ''}${ep.error ? ` (${ep.error})` : ''}${retired.length ? `; retired skill ${retired.join(', ')}` : ''}`)
    this.reflecting = this.reflecting.then(() => this.reflect(ep, sig).catch((err) => this.log(`reflect ${ep.id}: ${(err as Error).message}`)))
    const last = ep.attempts.at(-1)
    return {
      patch: ep.outcome === 'failed' ? null : (ep.patch ?? null),
      outcome: ep.outcome,
      episode: ep.id,
      diagnostics: ep.outcome === 'failed' ? [...(last?.errors ?? []), ...(ep.error ? [ep.error] : [])] : undefined,
    }
  }

  /** Append to the shared library; on failure the diagnostics land on the last attempt. */
  private commit(ep: Episode, patch: Patch, req: ModRequest, ws?: ModWorkspace): boolean {
    const c = this.opts.library.commit(patch, req, ws, this.now())
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
    for (let round = 0; round < h.design.toolRounds; round++) {
      const r = await model.chat(messages, { tools: specs, temperature: h.design.temperature, purpose: 'design' })
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
    messages.push({ role: 'user', content: FINALIZE })
    const r = await model.chat(messages, { json: true, temperature: h.design.temperature, purpose: 'design' })
    messages.push({ role: 'assistant', content: r.content })
    return r.content
  }

  private async review(model: Model, req: ModRequest, patch: Patch, ctx: ToolContext): Promise<{ verdict: string; notes: string[] }> {
    const outcome = describeOutcome(req.scenario, patch, ctx)
    const r = await model.chat(
      [
        { role: 'system', content: REVIEW_SYSTEM },
        { role: 'user', content: reviewUser(req, patch, outcome, req.context.nearMisses) },
      ],
      { json: true, temperature: 0.2, purpose: 'review' },
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
      { json: true, temperature: 0.2, purpose: 'reflect' },
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
    state.note('reflect', { episode: ep.id, lessons: touched, skill, usage: { calls: model.calls, input: model.input, output: model.output } })
  }
}

function clipJson(x: unknown): unknown {
  const s = JSON.stringify(x ?? {})
  return s.length > 2000 ? `${s.slice(0, 2000)}…` : x
}
