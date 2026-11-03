// A game that is in a page (docs/agent-players.md §3.4): a browser cannot be dialled, so the page dials out. It asks
// this relay for work with a long poll (`POST /game/next`, answered when an agent has said something, or with 204
// after a while) and brings the answer back (`POST /game/reply`). Agents speak to the relay as they would to a host.

import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ClientMsg, ServerMsg } from '@openworld/engine'
import { Unavailable, readJson, send, type Dispatch } from './http.ts'

const POLL_MS = 20_000
const GONE_MS = POLL_MS + 10_000
const ANSWER_MS = 15_000

interface Job {
  id: string
  conn: string
  msg: ClientMsg
  done: (answer: ServerMsg[]) => void
}

export function pageRelay() {
  const queue: Job[] = []
  const asked = new Map<string, Job>()
  let waiting: ((job?: Job) => void) | undefined
  let lastPoll = 0

  const connected = () => Date.now() - lastPoll <= GONE_MS

  const dispatch: Dispatch = (conn, msg) => {
    if (!connected()) return Promise.reject(new Unavailable('no game is connected: open the game with ?agents= pointing here'))
    return new Promise((resolve, reject) => {
      const job: Job = { id: randomBytes(6).toString('hex'), conn, msg, done: resolve }
      const timer = setTimeout(() => {
        asked.delete(job.id)
        const at = queue.indexOf(job)
        if (at >= 0) queue.splice(at, 1)
        reject(new Unavailable('the game did not answer', 504))
      }, ANSWER_MS)
      job.done = (answer) => (clearTimeout(timer), resolve(answer))
      asked.set(job.id, job)
      if (waiting) (waiting(job), (waiting = undefined))
      else queue.push(job)
    })
  }

  const nextJob = (): Promise<Job | undefined> =>
    new Promise((resolve) => {
      waiting?.(undefined)
      waiting = resolve
      setTimeout(() => waiting === resolve && ((waiting = undefined), resolve(undefined)), POLL_MS)
    })

  const extra = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    if (!url.pathname.startsWith('/game/')) return false
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') return res.writeHead(204).end(), true
    if (req.method !== 'POST') return false
    if (url.pathname === '/game/next') {
      lastPoll = Date.now()
      const job = queue.shift() ?? (await nextJob())
      lastPoll = Date.now()
      return job ? (send(res, 200, { id: job.id, conn: job.conn, msg: job.msg }), true) : (res.writeHead(204).end(), true)
    }
    if (url.pathname === '/game/reply') {
      const body = (await readJson(req)) as { id?: string; responses?: ServerMsg[] }
      const job = body.id ? asked.get(body.id) : undefined
      if (job) {
        asked.delete(job.id)
        job.done(Array.isArray(body.responses) ? body.responses : [{ t: 'error', reason: 'the game gave no answer' }])
      }
      return send(res, 200, { ok: !!job }), true
    }
    return false
  }

  return { dispatch, extra, connected }
}
