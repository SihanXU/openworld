// The player's own modder (docs/byok.md): the modder's live pipeline, run in a worker of the player's page, calling
// the model the player chose with the player's own key. The key comes from the page once, is kept here (and, if the
// player asks, in this browser's storage) and goes to the chosen service only: never to the engine's worker, never
// into a save, never to the game's server. What the engine's worker asks over its port is what it asks a service
// (modderLink.ts); the answers it takes go through its own validator as any.
//
// The modder here has a library in memory (the client's own patches come with every request, in its workspace) and a
// self-state in files kept in this browser: it records its episodes and recalls them, and the harness is the
// default's live part — no reflection on the player's account, no offline escalation or revision (those are the
// service's), a learned rule set aside here leaves at once (one client).

import { AI_WAIT_MS, type ModRequest } from '@openworld/engine'
import { MemFiles } from '../agent/files.ts'
import { SelfState } from '../agent/state.ts'
import { keyHint, listModels, modelOf, scrub, testModel, type ModelConfig } from '../models/providers.ts'
import { providerOf } from '../models/providerList.ts'
import { type ChatMessage, type ChatOptions, type Model, type ModelReply } from '../models/model.ts'
import { Detector } from '../modder/detect.ts'
import { Modder } from '../modder/pipeline.ts'
import { WorldLibrary } from '../library/library.ts'
import type { FromModder, LinkCall, ModelChoice, ModelStatus, Remember, Spend, ToModder } from '@openworld/runtime/src/modderProtocol.ts'

/** What this browser keeps for the modder (the worker's storage: IndexedDB). */
export interface ModderStore {
  get<T>(key: StoreKey): Promise<T | undefined>
  set(key: StoreKey, value: unknown): Promise<void>
  del(key: StoreKey): Promise<void>
}

/** model: the choice and its key, kept only when the player asked this browser to remember it; prefs: the cap. */
export type StoreKey = 'model' | 'prefs' | 'spend' | 'self'

interface KeptModel {
  choice: ModelChoice
  key?: string
}

/** The harness's live part, over the default (state.ts mergeHarness takes it section by section). */
const HARNESS = { reflect: { enabled: false }, escalate: false, revise: false, faults: { remove: 1 } }
const SELF = '/self'
/** Episodes kept in this browser (the newest): what recall reads, and no more. */
const KEEP_EPISODES = 300
const SAVE_SELF_MS = 2000

const today = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const emptySpend = (day = today(), total = 0): Spend => ({ day, cost: 0, calls: 0, input: 0, output: 0, unpriced: 0, total })

export class LocalModder {
  private choice?: ModelChoice
  private key?: string
  private remember: Remember = 'session'
  private cap = 0
  private spend = emptySpend()
  private error?: string
  private model?: Model
  private library?: WorldLibrary
  private state?: SelfState
  private files?: MemFiles
  private modder?: Modder
  private detector?: Detector
  private probes?: ModRequest[]
  private saving?: ReturnType<typeof setTimeout>
  private ready: Promise<void>
  /** The game handed over and the modder made over it: the engine's port waits for it (else its one probe hears no model). */
  private gameIn: Promise<void>
  private gameArrived!: () => void

  constructor(
    private io: {
      store: ModderStore
      post: (m: FromModder) => void
      log?: (line: string) => void
    },
  ) {
    this.ready = this.load()
    this.gameIn = new Promise((resolve) => (this.gameArrived = resolve))
  }

  private async load(): Promise<void> {
    const [kept, prefs, spend] = await Promise.all([this.io.store.get<KeptModel>('model'), this.io.store.get<{ cap?: number }>('prefs'), this.io.store.get<Spend>('spend')])
    if (kept?.choice && providerOf(kept.choice.provider)) {
      this.choice = kept.choice
      this.key = kept.key
      this.remember = 'device'
    }
    this.cap = prefs?.cap ?? 0
    if (spend) this.spend = spend
    this.rollDay()
    this.rebuild()
  }

  async handle(m: ToModder): Promise<void> {
    await this.ready
    switch (m.t) {
      case 'game':
        try {
          await this.openSelf()
          this.library = new WorldLibrary(m.ontology, m.rules)
          this.rebuild()
        } finally {
          this.gameArrived()
        }
        return
      case 'link':
        return this.link(m.port)
      case 'set': {
        // a key kept for one service is never sent to another
        const same = this.isChosen(m.choice)
        this.choice = { provider: m.choice.provider, model: m.choice.model.trim(), ...(m.choice.baseUrl?.trim() && { baseUrl: m.choice.baseUrl.trim() }) }
        this.key = m.key?.trim() || (same ? this.key : undefined)
        this.remember = m.remember
        this.cap = Math.max(0, Number(m.cap) || 0)
        this.error = undefined
        await this.io.store.set('prefs', { cap: this.cap })
        if (this.remember === 'device') await this.io.store.set('model', { choice: this.choice, key: this.key } satisfies KeptModel)
        else await this.io.store.del('model')
        this.rebuild()
        return
      }
      case 'forget':
        this.choice = undefined
        this.key = undefined
        this.remember = 'session'
        this.error = undefined
        await this.io.store.del('model')
        this.rebuild()
        return
      case 'test':
        return this.reply(m.id, async () => testModel(this.configFor(m.choice, m.key), { browser: true }))
      case 'models':
        return this.reply(m.id, async () => listModels(this.configFor(m.choice, m.key)))
      case 'quality':
        if (m.probes) this.probes = m.probes
        return this.reply(m.id, async () => this.quality(m.plan))
      case 'detect':
        this.probes = m.probes
        return this.reply(m.id, async () => (this.detector ? this.detector.start() : { started: false, why: 'no model' }))
    }
  }

  /** The config a test or a list is asked with: the key typed, or the one kept for this very service. */
  private configFor(choice: ModelChoice, key?: string): ModelConfig {
    const apiKey = key?.trim() || (this.isChosen(choice) ? this.key : undefined)
    return { provider: choice.provider, baseUrl: choice.baseUrl?.trim() || undefined, model: choice.model.trim(), apiKey }
  }

  /** The service chosen now (the one the kept key is for). */
  private isChosen(choice: ModelChoice): boolean {
    return !!this.choice && this.choice.provider === choice.provider && (this.choice.baseUrl ?? '') === (choice.baseUrl ?? '')
  }

  private async reply(id: number, work: () => Promise<unknown>): Promise<void> {
    try {
      this.io.post({ t: 'reply', id, value: await work() })
    } catch (err) {
      this.io.post({ t: 'reply', id, error: this.clean(err) })
    }
  }

  private clean(err: unknown): string {
    return scrub((err as Error)?.message ?? String(err), this.key)
  }

  status(): ModelStatus {
    this.rollDay()
    return {
      ...(this.choice && { choice: this.choice }),
      ...(this.key && { keyHint: keyHint(this.key) }),
      remember: this.remember,
      ...(this.model && { model: this.model.name }),
      cap: this.cap,
      spend: { ...this.spend },
      ...(this.error && { error: this.error }),
    }
  }

  private postStatus(): void {
    this.io.post({ t: 'status', status: this.status() })
  }

  /** The model and the modder over it, made again whenever the choice changes (the library and the self-state stay). */
  private rebuild(): void {
    this.model = undefined
    if (this.choice) {
      try {
        const cfg: ModelConfig = { ...this.choice, apiKey: this.key }
        if (!cfg.model) throw new Error('no model chosen')
        if (!providerOf(cfg.provider)?.keyless && !cfg.apiKey) throw new Error('no key')
        this.model = new Spending(modelOf(cfg, { browser: true }), this)
      } catch (err) {
        this.error = this.clean(err)
      }
    }
    if (this.library && this.state) {
      this.modder = new Modder({ library: this.library, state: this.state, model: this.model, profile: 'live', log: this.io.log, probes: async () => this.probes ?? [] })
      this.detector = new Detector(this.modder, { file: `${SELF}/quality.json`, files: this.files, probes: async () => this.probes ?? [], log: this.io.log })
    }
    this.postStatus()
  }

  private async openSelf(): Promise<void> {
    if (this.state) return
    const files = new MemFiles((await this.io.store.get<Record<string, string>>('self')) ?? {})
    const harness = `${SELF}/harness/pipeline.json`
    if (!files.exists(harness)) files.write(harness, JSON.stringify(HARNESS))
    this.state = SelfState.open(SELF, () => new Date(), [], files)
    this.files = files
    files.onChange = () => {
      clearTimeout(this.saving)
      this.saving = setTimeout(() => void this.io.store.set('self', this.selfToKeep()), SAVE_SELF_MS)
    }
  }

  /** The self-state's files, the newest episodes only. */
  private selfToKeep(): Record<string, string> {
    const all = this.files!.entries()
    const keep = new Set(this.state!.episodes().slice(-KEEP_EPISODES).map((e) => e.id))
    const dir = `${SELF}/memory/episodes/`
    return Object.fromEntries(Object.entries(all).filter(([p]) => !p.startsWith(dir) || keep.has(p.slice(dir.length).replace(/\.json$/, ''))))
  }

  private async quality(plan?: boolean): Promise<unknown> {
    const d = this.detector
    return { model: this.model?.name ?? null, waitMs: AI_WAIT_MS, detection: d?.last ?? null, running: d?.running ?? null, error: d?.error ? scrub(d.error, this.key) : null, ...(plan && d && this.probes && { plan: await d.plan() }) }
  }

  /** The engine's worker on a port: it asks as it asks a service. */
  private link(port: MessagePort): void {
    port.onmessage = async (e: MessageEvent<LinkCall>) => {
      const c = e.data
      try {
        port.postMessage({ id: c.id, value: await this.answer(c) })
      } catch (err) {
        port.postMessage({ id: c.id, error: this.clean(err) })
      }
    }
  }

  private async answer(c: LinkCall): Promise<unknown> {
    await this.ready
    // the page hands the game over before any port (ownModel.start), but opening the self-state takes the database a while
    await this.gameIn
    const modder = this.modder
    switch (c.op) {
      case 'health':
        return { model: modder?.model?.name ?? null }
      case 'resolve':
        if (!modder) throw new Error('the modder has no game yet')
        // the player's own modder works live (the offline profile is the service's)
        return modder.resolve(c.body, 'live')
      case 'progress':
        return modder?.progressOf(c.request) ?? {}
      case 'patches': {
        const lib = this.library
        return lib ? { seq: lib.seq, log: lib.logId, entries: lib.since(c.since) } : { seq: 0, entries: [] }
      }
      case 'fault':
        return modder?.fault(c.rule, c.reason, 'local') ?? null
    }
  }

  // ---------------------------------------------------------------- what is spent

  private rollDay(): void {
    const day = today()
    if (this.spend.day !== day) this.spend = emptySpend(day, this.spend.total)
  }

  /** Before a call: refused once today's cap is spent (the error says quota: the modder pauses its calls). */
  admit(): void {
    this.rollDay()
    if (this.cap > 0 && this.spend.cost >= this.cap) throw new Error(`the daily cap of $${this.cap} is spent (quota): no more model calls today`)
  }

  /** After a call: what it cost, kept in this browser. */
  spent(r: ModelReply): void {
    this.rollDay()
    const s = this.spend
    s.calls++
    s.input += r.usage?.input ?? 0
    s.output += r.usage?.output ?? 0
    if (r.usage?.cost === undefined) s.unpriced++
    else {
      s.cost += r.usage.cost
      s.total += r.usage.cost
    }
    void this.io.store.set('spend', s)
    this.postStatus()
  }

  failed(err: unknown): Error {
    const e = new Error(this.clean(err))
    this.error = e.message
    this.postStatus()
    return e
  }
}

/** The chosen model, its calls counted against the day's cap and its errors cleared of the key. */
class Spending implements Model {
  readonly name: string
  constructor(
    private inner: Model,
    private host: LocalModder,
  ) {
    this.name = inner.name
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ModelReply> {
    this.host.admit()
    let r: ModelReply
    try {
      r = await this.inner.chat(messages, opts)
    } catch (err) {
      throw this.host.failed(err)
    }
    this.host.spent(r)
    return r
  }
}
