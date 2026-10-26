// The modder service: one small HTTP API next to the static game (design.md §11).
//   GET  /health          model, library and self-state at a glance
//   POST /resolve         ResolveBody → ResolveReply (a validated patch, or why not); `profile: offline` from the editor
//                         (this host only: from elsewhere it is answered live)
//   GET  /patches?since=n the shared library's patch log after seq n (clients sync from it): {seq, log, entries};
//                         `log` is the log's identity (another one: the log was begun anew, sync from 0)
//   GET  /stats           the numbers the paper reports
//   GET  /progress?id=r   where request r is (queued, local, find, create, art; {} when not here)
//   POST /create          {intent, had?, stations?} → a new thing's draft (types and icons), not committed (this host only)
//   POST /draft           {kind: person | map, intent, context} → one file of the game, drafted, not written (this host only)
//   GET  /trace?id=d      an author's draft d as it goes: the AI's answers summed up (no reasoning), what the engine sent back, pictures
//   POST /adopt           {patch}: the author took the new thing into the game; the library has it (this host only)
//   POST /fault           {rule, reason, client?}: a client set a learned rule aside at run time (counted by the caller's
//                         address; `client` tells apart only the clients of a caller on this machine)
//   GET  /quality         what the model carries (design.md §13, the AI setting): the last detection, one running; ?plan=1 what one would play
//   POST /quality/detect  start a detection (this host only: it costs model calls)
// "This host only": from a loopback address, with no Origin or a localhost one (not a page on another site), as JSON.

import { createServer, type IncomingMessage, type Server } from 'node:http'
import { join } from 'node:path'
import { AI_WAIT_MS, type Patch, type ResolveBody } from '@openworld/engine'
import type { DraftBody, Modder, ThingBody } from '../modder/pipeline.ts'
import { Detector } from '../checks/detect.ts'

export interface ServerOptions {
  /** Access-Control-Allow-Origin (default *: the client is a static page on another origin). */
  origin?: string
  maxBody?: number
  /** The game this modder patches (its id, said at /health: the editor checks it asks the right one). */
  game?: string
}

export function createModderServer(modder: Modder, opts: ServerOptions = {}): Server {
  const { library, state } = modder.opts
  const maxBody = opts.maxBody ?? 4_000_000
  const libraryInfo = () => ({ seq: library.seq, log: library.logId, patches: library.patchRules().length, rules: library.lib.rules.size })
  const detector = new Detector(modder, { file: modder.opts.data ? join(modder.opts.data, 'quality.json') : undefined, probes: modder.opts.probes, log: modder.opts.log })
  // a detection is model calls on this service's account: asked for from this machine only
  const local = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
  // a page on any site can reach this machine's service through the browser of the one who opened it: its Origin
  // says where it came from (absent: not a page; a page served from this machine: the editor, the game in development)
  const ownOrigin = (req: IncomingMessage) => {
    const o = req.headers.origin
    return o === undefined || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(o)
  }
  // what only this host may ask (it costs the service model calls, or writes its library without the AI): from this
  // machine, not from a page on another site (a page's simple POST needs no preflight, so CORS * does not stop it),
  // and as JSON (which a page elsewhere cannot send without a preflight). A detection has no body: none, or JSON
  const hostOnly = (req: IncomingMessage, bodyless = false): [number, string] | undefined => {
    if (!local(req)) return [403, 'only from the machine the service runs on']
    if (!ownOrigin(req)) return [403, `not from a page on ${req.headers.origin}: only from the machine the service runs on`]
    const type = req.headers['content-type']
    const empty = type === undefined && (req.headers['content-length'] === undefined || req.headers['content-length'] === '0') && req.headers['transfer-encoding'] === undefined
    if (!/^application\/json\s*(;|$)/i.test(type ?? '') && !(bodyless && empty)) return [415, 'send JSON (Content-Type: application/json)']
    return undefined
  }
  return createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', opts.origin ?? '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'OPTIONS') return void res.writeHead(204).end()
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = `${req.method} ${url.pathname}`
    try {
      if (route === 'GET /health') {
        const last = detector.last
        const detected = last ? { model: last.model, at: last.at, recommend: last.recommend } : null
        return send(200, { ok: true, game: opts.game ?? null, model: modder.model?.name ?? null, library: libraryInfo(), state: state.stats(), detected })
      }
      if (route === 'GET /quality')
        return send(200, {
          model: modder.model?.name ?? null,
          waitMs: AI_WAIT_MS,
          detection: detector.last ?? null,
          running: detector.running ?? null,
          error: detector.error ?? null,
          ...(url.searchParams.get('plan') && { plan: await detector.plan() }),
        })
      if (route === 'POST /quality/detect') {
        const refused = hostOnly(req, true)
        if (refused) return send(refused[0], { error: `a detection is started from the machine the service runs on: ${refused[1]}` })
        return send(200, await detector.start())
      }
      if (route === 'GET /patches') {
        const since = Number(url.searchParams.get('since') ?? 0) || 0
        return send(200, { seq: library.seq, log: library.logId, entries: library.since(since) })
      }
      if (route === 'GET /trace') {
        // an author's draft is this host's own, as its asking is
        const refused = hostOnly(req, true)
        if (refused) return send(refused[0], { error: `a draft is read from the machine the service runs on: ${refused[1]}` })
        return send(200, modder.traceOf(url.searchParams.get('id') ?? ''))
      }
      if (route === 'GET /progress') return send(200, modder.progressOf(url.searchParams.get('id') ?? '') ?? {})
      if (route === 'GET /stats') return send(200, { library: libraryInfo(), state: state.stats(), snapshots: state.snapshots() })
      if (route === 'POST /fault') {
        const body = (await readJson(req, 64_000)) as { rule?: unknown; reason?: unknown; client?: unknown }
        if (typeof body?.rule !== 'string') return send(400, { error: 'rule required' })
        // a fault is counted by where it came from: a caller elsewhere is one client whatever it says it is (else one
        // caller could claim to be enough clients to remove a learned rule); only a caller on this machine (a tool,
        // a test) may tell its clients apart
        const from = req.socket.remoteAddress ?? 'anon'
        const client = local(req) && typeof body.client === 'string' && body.client ? `${from}#${body.client}` : from
        return send(200, modder.fault(body.rule, String(body.reason ?? ''), client))
      }
      // an author's new thing: drafted on this service's account, and taken into the shared library without the AI (this host only)
      const refused = ['POST /create', 'POST /adopt', 'POST /draft'].includes(route) ? hostOnly(req) : undefined
      if (refused) return send(refused[0], { error: `a new thing is asked for and taken in from the machine the service runs on: ${refused[1]}` })
      if (route === 'POST /draft') return send(200, await modder.draft((await readJson(req, maxBody)) as DraftBody))
      if (route === 'POST /create') return send(200, await modder.createThing((await readJson(req, maxBody)) as ThingBody))
      if (route === 'POST /adopt') {
        const body = (await readJson(req, maxBody)) as { patch?: Patch }
        if (!body?.patch) return send(400, { error: 'patch required' })
        return send(200, modder.adopt(body.patch))
      }
      if (route === 'POST /resolve') {
        const body = (await readJson(req, maxBody)) as ResolveBody
        // an author asking from the editor asks with the offline profile (more care: tools, review before shipping); it
        // costs the service far more, so only a caller on this machine may (anyone else is answered live)
        const profile = body?.profile === 'offline' ? (local(req) && ownOrigin(req) ? 'offline' : 'live') : body?.profile === 'live' ? 'live' : undefined
        return send(200, await modder.resolve(body, profile))
      }
      send(404, { error: 'not found' })
    } catch (err) {
      send(500, { error: (err as Error).message })
    }
  })
}

function readJson(req: IncomingMessage, max: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => {
      n += c.length
      if (n > max) {
        reject(new Error('request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}
