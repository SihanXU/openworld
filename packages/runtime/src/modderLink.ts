// How the engine's worker reaches a modder: a service over HTTP (its address), or the player's own modder in a
// worker of this page over a port (docs/byok.md). Both answer the same five questions.

import type { ModProgress, PatchLogEntry, ResolveBody, ResolveReply } from '@openworld/engine'
import { LOCAL_MODDER, type LinkCall, type LinkReply } from './modderProtocol.ts'

export interface PatchLog {
  seq: number
  log?: string
  entries: PatchLogEntry[]
}

export interface ModderLink {
  /** Where it is: the service's address, or `local:` (what the shared log's position is kept under). */
  readonly where: string
  health(): Promise<{ model?: string | null }>
  resolve(body: ResolveBody): Promise<ResolveReply>
  progress(request: string): Promise<ModProgress>
  patches(since: number): Promise<PatchLog>
  fault(rule: string, reason: string): void
}

/** A modder service at `url` (the modder's server.ts). */
export function serviceLink(url: string): ModderLink {
  const at = url.replace(/\/+$/, '')
  const get = async <T>(path: string, ms: number): Promise<T> => (await (await fetch(`${at}${path}`, { signal: AbortSignal.timeout(ms) })).json()) as T
  const post = (path: string, body: unknown, ms: number) => fetch(`${at}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) })
  return {
    where: at,
    health: () => get('/health', 2500),
    resolve: async (body) => (await (await post('/resolve', body, 240_000)).json()) as ResolveReply,
    progress: (request) => get(`/progress?id=${encodeURIComponent(request)}`, 2000),
    patches: (since) => get(`/patches?since=${since}`, 5000),
    fault: (rule, reason) => void post('/fault', { rule, reason }, 5000).catch(() => undefined),
  }
}

/** A call as asked, before its id. */
type Call = LinkCall extends infer C ? (C extends LinkCall ? Omit<C, 'id'> : never) : never

/** The player's own modder, over a port to its worker (modderWorker.ts). */
export function portLink(port: MessagePort): ModderLink {
  let next = 0
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  port.onmessage = (e: MessageEvent<LinkReply>) => {
    const w = waiting.get(e.data.id)
    if (!w) return
    waiting.delete(e.data.id)
    clearTimeout(w.timer)
    if (e.data.error !== undefined) w.reject(new Error(e.data.error))
    else w.resolve(e.data.value)
  }
  const call = <T>(c: Call, ms: number): Promise<T> =>
    new Promise((resolve, reject) => {
      const id = ++next
      const timer = setTimeout(() => waiting.delete(id) && reject(new Error('the modder did not answer')), ms)
      waiting.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      port.postMessage({ ...c, id })
    })
  return {
    where: LOCAL_MODDER,
    health: () => call({ op: 'health' }, 2500),
    resolve: (body) => call({ op: 'resolve', body }, 240_000),
    progress: (request) => call({ op: 'progress', request }, 2000),
    patches: (since) => call({ op: 'patches', since }, 5000),
    fault: (rule, reason) => void call({ op: 'fault', rule, reason }, 5000).catch(() => undefined),
  }
}
