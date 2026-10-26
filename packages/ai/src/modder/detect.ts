// What the connected model carries (design.md §13, the AI setting): a game's graphics settings detect the hardware and
// recommend a preset; this plays a set of questions at each tier and recommends, for each kind of work, the
// highest tier the model answers well within the world's wait (AI_WAIT_MS, the same at every tier).
//
// The questions: the ones this service was asked before (its episodes, newest first, one per class), and the
// game's own probes (GameDef.probes) where the history has too few. Each is played on the base game alone (a
// fresh library: every question open, the yardstick the same from run to run) by a dry modder: designed and
// validated as ever, nothing committed or recorded. An answer counts when it validates within the wait.

import { defaultFiles, type Files } from '../agent/files.ts'
import { AI_WAIT_MS, TIERS, categoryOfRequest, type AiCategory, type AiLevel, type AiQuality, type ModRequest, type Tier } from '@openworld/engine'
import { WorldLibrary } from '../library/library.ts'
import { BACKEND_DOWN, Modder } from './pipeline.ts'

/** Questions played per kind of work. */
export const PER_CATEGORY = 4
/** The share of a tier's questions that must be answered in time for the tier to be recommended. */
export const PASS = 0.75
const CATEGORIES: AiCategory[] = ['things', 'people', 'world']
/** How far back the history is read for questions. */
const HISTORY = 400
/** Runs played at once: a burst of every question at every tier is what a provider throttles (HTTP 429). */
export const DETECT_AT_ONCE = 2

export interface Probe {
  request: ModRequest
  category: AiCategory
  from: 'history' | 'game'
}

export interface DetectRun {
  probe: string
  summary: string
  category: AiCategory
  tier: Tier
  /** answered within the wait */
  ok: boolean
  outcome: string
  ms: number
  cost: number
  calls: number
  error?: string
}

export interface Detection {
  model: string
  at: string
  waitMs: number
  runs: DetectRun[]
  /** per kind of work and tier: questions, answered in time, the slowest of the fastest nine in ten, the mean cost */
  table: Record<AiCategory, Record<Tier, { n: number; ok: number; p90: number; cost: number }>>
  /** the setting the model carries (prefetch is a budget's choice, not the model's: left as the player has it) */
  recommend: Omit<AiQuality, 'prefetch'>
}

/** The questions to play: the history's first, the game's where it has too few. */
export function gatherProbes(modder: Modder, game: ModRequest[] = [], per = PER_CATEGORY): Probe[] {
  const { state, library } = modder.opts
  const known = (t: string | undefined) => !t || t in library.ontology.types
  const base = (req: ModRequest) =>
    known(req.event.host?.type) && Object.values(req.event.roles).every((r) => known(r?.type)) && (req.scenario?.entities ?? []).every((e) => known(e.type))
  const out: Probe[] = []
  const seen = new Set<string>()
  const room = (c: AiCategory) => out.filter((p) => p.category === c).length < per
  // a question in the request's present shape: a history kept from an older service may hold others (the Ford's of
  // 2026-10-02 named a verb and its actor and target, with no roles), which neither play nor sort by kind of work
  const current = (req: ModRequest) => !!req?.scenario && !!req.event && typeof req.event.roles === 'object' && req.event.roles !== null
  const take = (req: ModRequest, from: Probe['from'], key: string) => {
    if (seen.has(key) || !current(req)) return
    const category = categoryOfRequest(req)
    if (!room(category) || !base(req)) return
    seen.add(key)
    out.push({ request: req, category, from })
  }
  for (const e of state.episodes().slice(-HISTORY).reverse()) {
    if (e.kind !== 'world' || !CATEGORIES.some(room)) continue
    const ep = state.episode(e.id)
    const req = ep?.request as ModRequest | undefined
    // what a player asked (not a revision, an escalation or a curriculum's offline work)
    if (!req || ep!.profile === 'offline' || ep!.revises || ep!.escalatedFrom) continue
    take(req, 'history', e.key)
  }
  for (const req of game) take(req, 'game', `game:${req.id}`)
  return out
}

/** The recommendation from the runs: per kind of work, the highest tier answered in time often enough. */
export function recommendOf(runs: DetectRun[]): Detection['recommend'] {
  const level = (c: AiCategory): AiLevel => {
    const rate = (t: Tier) => {
      const rs = runs.filter((r) => r.category === c && r.tier === t)
      return rs.length ? rs.filter((r) => r.ok).length / rs.length : undefined
    }
    if (TIERS.every((t) => rate(t) === undefined)) return 'medium' // nothing to judge by: the default
    const best = [...TIERS].reverse().find((t) => (rate(t) ?? 0) >= PASS)
    if (best) return best
    return (rate('low') ?? 0) >= 0.5 ? 'low' : 'off'
  }
  const things = level('things')
  // making new kinds rides on the answers to the player's acts: as far as those go
  return { things, people: level('people'), world: level('world'), create: things }
}

function tableOf(runs: DetectRun[]): Detection['table'] {
  const t = {} as Detection['table']
  for (const c of CATEGORIES) {
    t[c] = {} as Detection['table'][AiCategory]
    for (const tier of TIERS) {
      const rs = runs.filter((r) => r.category === c && r.tier === tier)
      const ms = rs.map((r) => r.ms).sort((a, b) => a - b)
      t[c][tier] = { n: rs.length, ok: rs.filter((r) => r.ok).length, p90: ms.length ? ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.9) - 1)] : 0, cost: rs.length ? rs.reduce((s, r) => s + r.cost, 0) / rs.length : 0 }
    }
  }
  return t
}

/** One detection at a time; its last result kept in the service's data (quality.json). */
export class Detector {
  running?: { done: number; total: number; started: string }
  last?: Detection
  error?: string

  constructor(
    private modder: Modder,
    /** file: where the last detection is kept, in `files` (default: Node's disk). */
    private opts: { file?: string; files?: Files; probes?: () => Promise<ModRequest[]>; log?: (line: string) => void } = {},
  ) {
    if (opts.file && this.files().exists(opts.file))
      try {
        this.last = JSON.parse(this.files().read(opts.file)) as Detection
      } catch {
        /* a torn file: detected again when asked */
      }
  }

  private files(): Files {
    return this.opts.files ?? defaultFiles()
  }

  private game?: ModRequest[]
  /** The game's probes, loaded once. */
  private async gameProbes(): Promise<ModRequest[]> {
    this.game ??= (await this.opts.probes?.().catch(() => [])) ?? []
    return this.game
  }

  /** The questions a detection would play, and how many runs (a design and a repair or two each). */
  async plan(): Promise<{ probes: number; runs: number; byCategory: Record<AiCategory, number> }> {
    const probes = gatherProbes(this.modder, await this.gameProbes())
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, probes.filter((p) => p.category === c).length])) as Record<AiCategory, number>
    return { probes: probes.length, runs: probes.length * TIERS.length, byCategory }
  }

  /** Start a detection (none if one runs, or there is no model or nothing to play). */
  async start(): Promise<{ started: boolean; why?: string; total?: number }> {
    if (this.running) return { started: false, why: 'a detection is running' }
    const model = this.modder.model
    if (!model) return { started: false, why: 'no model' }
    const probes = gatherProbes(this.modder, await this.gameProbes())
    if (this.running) return { started: false, why: 'a detection is running' }
    if (!probes.length) return { started: false, why: 'no questions to play: no history yet, and the game has no probes' }
    const total = probes.length * TIERS.length
    this.running = { done: 0, total, started: new Date().toISOString() }
    this.error = undefined
    void this.run(probes, model.name).catch((err) => {
      this.error = (err as Error).message
      this.opts.log?.(`detection failed: ${this.error}`)
      this.running = undefined
    })
    return { started: true, total }
  }

  private async run(probes: Probe[], modelName: string): Promise<void> {
    const { library, state } = this.modder.opts
    // the base game alone, and a modder that keeps nothing
    const dry = new Modder({ library: new WorldLibrary(library.ontology, library.base), state, model: this.modder.model, dry: true, log: this.opts.log })
    const runs: DetectRun[] = []
    // a run the backend refused (throttled, out of quota, signed out: the service then pauses its calls) says
    // nothing about the model: the detection stops, and gives no verdict, rather than counting it a failed answer
    let down: string | undefined
    const play = async (p: Probe, i: number, tier: Tier): Promise<void> => {
      const id = `detect-${i}-${tier}-${Date.now().toString(36)}`
      const request: ModRequest = { ...p.request, id, tier, create: tier, scenario: { ...p.request.scenario, tier } }
      let error: string | undefined
      let outcome: string | undefined
      try {
        outcome = (await dry.resolve({ request }, 'live')).outcome
      } catch (err) {
        error = (err as Error).message
      }
      const ep = dry.trials.get(id)
      const why = outcome === 'unavailable' ? 'model unavailable' : BACKEND_DOWN.test(error ?? ep?.error ?? '') ? (error ?? ep?.error) : undefined
      if (why) {
        down ??= why
        return
      }
      const ms = ep?.ms ?? 0
      runs.push({ probe: p.request.id, summary: p.request.summary, category: p.category, tier, ok: ep?.outcome === 'accepted' && ms <= AI_WAIT_MS, outcome: ep?.outcome ?? 'failed', ms, cost: ep?.usage.cost ?? 0, calls: ep?.usage.calls ?? 0, ...((error ?? ep?.error) && { error: error ?? ep?.error }) })
      if (this.running) this.running.done++
    }
    const queue = probes.flatMap((p, i) => TIERS.map((tier) => () => play(p, i, tier)))
    await Promise.all(
      Array.from({ length: Math.min(DETECT_AT_ONCE, queue.length) }, async () => {
        for (let job = queue.shift(); job && !down; job = queue.shift()) await job()
      }),
    )
    if (down) throw new Error(`the model was unavailable during the detection (${down}): no verdict`)
    const detection: Detection = { model: modelName, at: new Date().toISOString(), waitMs: AI_WAIT_MS, runs, table: tableOf(runs), recommend: recommendOf(runs) }
    this.last = detection
    if (this.opts.file) this.files().write(this.opts.file, JSON.stringify(detection, null, 1))
    this.opts.log?.(`detection for ${modelName}: ${JSON.stringify(detection.recommend)} (${runs.filter((r) => r.ok).length}/${runs.length} in time)`)
    this.running = undefined
  }
}
