// The modder service: one small HTTP API next to the static game (design.md §11).
//   GET  /health          model, library and self-state at a glance
//   POST /resolve         ResolveBody → ResolveReply (a validated patch, or why not); `profile: offline` from the editor
//   GET  /patches?since=n the shared library's patch log after seq n (clients sync from it)
//   GET  /stats           the numbers the paper reports
//   GET  /progress?id=r   where request r is (queued, local, find, create, art; {} when not here)

import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { ResolveBody } from '@openworld/engine'
import type { Modder } from './pipeline.ts'

export interface ServerOptions {
  /** Access-Control-Allow-Origin (default *: the client is a static page on another origin). */
  origin?: string
  maxBody?: number
  /** The game this modder patches (its id, said at /health: the editor checks it asks the right one). */
  game?: string
}

export function createModderServer(modder: Modder, opts: ServerOptions = {}): Server {
  const { library, state } = modder.opts
  const libraryInfo = () => ({ seq: library.seq, patches: library.patchRules().length, rules: library.lib.rules.size })
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
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, game: opts.game ?? null, model: modder.model?.name ?? null, library: libraryInfo(), state: state.stats() })
      if (req.method === 'GET' && url.pathname === '/patches') {
        const since = Number(url.searchParams.get('since') ?? 0) || 0
        return send(200, { seq: library.seq, entries: library.since(since) })
      }
      if (req.method === 'GET' && url.pathname === '/progress') return send(200, modder.progressOf(url.searchParams.get('id') ?? '') ?? {})
      if (req.method === 'GET' && url.pathname === '/stats') return send(200, { library: libraryInfo(), state: state.stats(), snapshots: state.snapshots() })
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
