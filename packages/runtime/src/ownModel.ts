// The page's side of the player's own modder (docs/byok.md): its worker made when first wanted (a model kept in this
// browser, or the settings opened), handed the game as data, and a port to it for the engine's worker. The key passes
// through here once, from the settings' field to the modder's worker; the page keeps only its hint.

import { game } from './game.ts'
import type { FromModder, ModelChoice, ModelStatus, Remember, ToModder } from './modderProtocol.ts'

/** Set while a model is kept in this browser (never the key: only that the modder's worker should start at once). */
const KEPT = 'lsw.model'

type Ask = Extract<ToModder, { id: number }>
type AskOf<T extends Ask['t']> = Omit<Extract<Ask, { t: T }>, 'id' | 't'>

export class OwnModel {
  status?: ModelStatus
  /** Told every status (a choice, a call's spending, an error). */
  private listeners: ((s: ModelStatus, before?: ModelStatus) => void)[] = []
  private worker?: Worker
  private next = 0
  private waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  /** A model was kept in this browser: the modder's worker is started with the page. */
  static kept(): boolean {
    try {
      return localStorage.getItem(KEPT) === '1'
    } catch {
      return false
    }
  }

  listen(fn: (s: ModelStatus, before?: ModelStatus) => void): void {
    this.listeners.push(fn)
  }

  /** Can the player's own modder answer now (a model chosen, with what it needs)? */
  get ready(): boolean {
    return !!this.status?.model
  }

  /** The modder's worker, made (and handed the game) the first time it is wanted. */
  start(): void {
    if (this.worker) return
    const w = new Worker(new URL('./modderWorker.ts', import.meta.url), { type: 'module', name: 'modder' })
    w.onmessage = (e: MessageEvent<FromModder>) => this.receive(e.data)
    w.onerror = (e) => console.error('[modder]', e.message)
    this.worker = w
    const g = game()
    this.post({ t: 'game', ontology: g.ontology(), rules: g.rules })
  }

  /** A port to the modder for the engine's worker (each its own). */
  port(): MessagePort {
    this.start()
    const ch = new MessageChannel()
    this.post({ t: 'link', port: ch.port1 }, [ch.port1])
    return ch.port2
  }

  /** Use this model. `key`: a new key (none: the one kept for the same service stays). */
  set(choice: ModelChoice, key: string | undefined, remember: Remember, cap: number): void {
    this.start()
    this.post({ t: 'set', choice, ...(key && { key }), remember, cap })
    try {
      if (remember === 'device') localStorage.setItem(KEPT, '1')
      else localStorage.removeItem(KEPT)
    } catch {
      /* a blocked store: the modder starts when the settings open */
    }
  }

  forget(): void {
    this.post({ t: 'forget' })
    try {
      localStorage.removeItem(KEPT)
    } catch {
      /* nothing kept */
    }
  }

  ask<T extends Ask['t']>(t: T, payload: AskOf<T>): Promise<unknown> {
    this.start()
    const id = ++this.next
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject })
      this.post({ t, id, ...payload } as unknown as ToModder)
    })
  }

  private post(m: ToModder, transfer: Transferable[] = []): void {
    this.worker?.postMessage(m, transfer)
  }

  private receive(m: FromModder): void {
    if (m.t === 'status') {
      const before = this.status
      this.status = m.status
      for (const fn of this.listeners) fn(m.status, before)
      return
    }
    const w = this.waiting.get(m.id)
    if (!w) return
    this.waiting.delete(m.id)
    if (m.error !== undefined) w.reject(new Error(m.error))
    else w.resolve(m.value)
  }
}

/** The page's one (the options show it; the page links the engine's worker to it). */
export const ownModel = new OwnModel()

/** A modder service the page names (?modder=<url>): asked instead of the player's own; `off`: none at all. */
export function namedModder(): string | undefined {
  try {
    return new URLSearchParams(location.search).get('modder') || undefined
  } catch {
    return undefined
  }
}
