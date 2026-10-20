// The modder service: one small HTTP API next to the static game (design.md §11).
//   GET  /health          model, library and self-state at a glance
//   POST /resolve         ResolveBody → ResolveReply (a validated patch, or why not); `profile: offline` from the editor
//   GET  /patches?since=n the shared library's patch log after seq n (clients sync from it): {seq, log, entries};
//                         `log` is the log's identity (another one: the log was begun anew, sync from 0)
//   GET  /stats           the numbers the paper reports
//   GET  /progress?id=r   where request r is (queued, local, find, create, art; {} when not here)
//   POST /create          {intent, had?, stations?} → a new thing's draft (types and icons), not committed (this host only)
//   POST /adopt           {patch}: the author took the new thing into the game; the library has it (this host only)
//   POST /fault           {rule, reason, client?}: a client set a learned rule aside at run time
//   GET  /quality         what the model carries (design.md §13, the AI setting): the last detection, one running; ?plan=1 what one would play
//   POST /quality/detect  start a detection (this host only: it costs model calls)

import { createServer, type IncomingMessage, type Server } from 'node:http'
import { join } from 'node:path'
import { AI_WAIT_MS, type Patch, type ResolveBody } from '@openworld/engine'
import type { Modder, ThingBody } from './pipeline.ts'
import { Detector } from './detect.ts'

export interface ServerOptions {
  /** Access-Control-Allow-Origin (default *: the client is a static page on another origin). */
  origin?: string
  maxBody?: number
  /** The game this modder patches (its id, said at /health: the editor checks it asks the right one). */
  game?: string
}

export function createModderServer(modder: Modder, opts: ServerOptions = {}): Server {
  const { library, state } = modder.opts
  const libraryInfo = () => ({ seq: library.seq, log: library.logId, patches: library.patchRules().length, rules: library.lib.rules.size })
  const detector = new Detector(modder, { file: modder.opts.data ? join(modder.opts.data, 'quality.json') : undefined, probes: modder.opts.probes, log: modder.opts.log })
  // a detection is model calls on this service's account: asked for from this machine only
  const local = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
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
    try {
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, game: opts.game ?? null, model: modder.model?.name ?? null, library: libraryInfo(), state: state.stats(), detected: detector.last ? { model: detector.last.model, at: detector.last.at, recommend: detector.last.recommend } : null })
      if (req.method === 'GET' && url.pathname === '/quality')
        return send(200, { model: modder.model?.name ?? null, waitMs: AI_WAIT_MS, detection: detector.last ?? null, running: detector.running ?? null, error: detector.error ?? null, ...(url.searchParams.get('plan') && { plan: await detector.plan() }) })
      if (req.method === 'POST' && url.pathname === '/quality/detect') {
        if (!local(req)) return send(403, { error: 'a detection is started from the machine the service runs on' })
        return send(200, await detector.start())
      }
      if (req.method === 'GET' && url.pathname === '/patches') {
        const since = Number(url.searchParams.get('since') ?? 0) || 0
        return send(200, { seq: library.seq, log: library.logId, entries: library.since(since) })
      }
      if (req.method === 'GET' && url.pathname === '/progress') return send(200, modder.progressOf(url.searchParams.get('id') ?? '') ?? {})
      if (req.method === 'GET' && url.pathname === '/stats') return send(200, { library: libraryInfo(), state: state.stats(), snapshots: state.snapshots() })
      if (req.method === 'POST' && url.pathname === '/fault') {
        const body = (await readJson(req, 64_000)) as { rule?: unknown; reason?: unknown; client?: unknown }
        if (typeof body?.rule !== 'string') return send(400, { error: 'rule required' })
        return send(200, modder.fault(body.rule, String(body.reason ?? ''), typeof body.client === 'string' ? body.client : (req.socket.remoteAddress ?? 'anon')))
      }
      // an author's new thing: drafted on this service's account, and taken into the shared library without the AI (this host only)
      if (req.method === 'POST' && (url.pathname === '/create' || url.pathname === '/adopt') && !local(req)) return send(403, { error: 'a new thing is asked for and taken in from the machine the service runs on' })
      if (req.method === 'POST' && url.pathname === '/create') return send(200, await modder.createThing((await readJson(req, opts.maxBody ?? 4_000_000)) as ThingBody))
      if (req.method === 'POST' && url.pathname === '/adopt') {
        const body = (await readJson(req, opts.maxBody ?? 4_000_000)) as { patch?: Patch }
        if (!body?.patch) return send(400, { error: 'patch required' })
        return send(200, modder.adopt(body.patch))
      }
      if (req.method === 'POST' && url.pathname === '/resolve') {
        const body = (await readJson(req, opts.maxBody ?? 4_000_000)) as ResolveBody
        // an author asking from the editor asks with the offline profile (more care: tools, review before shipping)
        return send(200, await modder.resolve(body, body.profile === 'offline' || body.profile === 'live' ? body.profile : undefined))
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
