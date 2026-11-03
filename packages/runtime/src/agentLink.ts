// The page's side of the agent relay (packages/bridge/src/relay.ts, docs/agent-players.md §3.4): the page dials out
// with a long poll, hands what an agent said to the game's agent host, and brings the answer back. A failed call is
// tried again a moment later, never fatal.

import type { AgentHost, ClientMsg, ServerMsg } from '@openworld/engine'

const RETRY_MS = 1000

interface Job {
  id: string
  conn: string
  msg: ClientMsg
}

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function answer(host: AgentHost | undefined, job: Job): ServerMsg[] {
  if (!host) return [{ t: 'error', reason: 'no game is running' }]
  try {
    return host.handle(job.conn, job.msg)
  } catch (err) {
    return [{ t: 'error', reason: `the game could not take that: ${(err as Error).message}` }]
  }
}

export function linkAgents(url: string, host: () => AgentHost | undefined): { stop(): void } {
  const base = url.replace(/\/+$/, '')
  const abort = new AbortController()
  const { signal } = abort
  void (async () => {
    while (!signal.aborted) {
      try {
        const next = await fetch(`${base}/game/next`, { method: 'POST', signal })
        if (next.status !== 200) {
          if (next.status !== 204) await later(RETRY_MS)
          continue
        }
        const job = (await next.json()) as Job
        await fetch(`${base}/game/reply`, { method: 'POST', body: JSON.stringify({ id: job.id, responses: answer(host(), job) }), signal })
      } catch {
        if (!signal.aborted) await later(RETRY_MS)
      }
    }
  })()
  return { stop: () => abort.abort() }
}
