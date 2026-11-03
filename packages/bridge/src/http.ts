// The agent protocol over plain HTTP and JSON (docs/agent-players.md §3.4): any agent with a shell can play with
// `curl`, and an MCP server or a skill is a thin layer over the same routes. Local by default; a seat's token is its
// address and nothing else is guarded. Where the game is (this process, or a page that dials out) is the Dispatch's.
//
//   GET    /spec                               what the game speaks and the inputs a seat has
//   POST   /seat  {name?, skin?, look?}        take a seat → {token, seat, inputs, …}
//   POST   /seat/:token/act  {input, hold?}    one input; `hold` seconds lets a held key go afterwards
//   GET    /seat/:token/observe[?text=1]       what the seat sees, as JSON or as text
//   DELETE /seat/:token                        leave

import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { INPUT_DOCS, PROTOCOL, TICKS_PER_SECOND, type AgentHost, type ClientMsg, type SeatInput, type ServerMsg } from '@openworld/engine'

const MAX_BODY = 64 * 1024

export type Dispatch = (conn: string, msg: ClientMsg) => Promise<ServerMsg[]>

export const localDispatch = (host: AgentHost): Dispatch => (conn, msg) => Promise.resolve(host.handle(conn, msg))

export class Unavailable extends Error {
  constructor(
    message: string,
    readonly status = 503,
  ) {
    super(message)
  }
}

export function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export interface ServerOptions {
  log?: (line: string) => void
  extra?: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>
  seats?: () => unknown
}

export function agentServer(dispatch: Dispatch, opts: ServerOptions = {}): Server {
  const log = opts.log ?? (() => {})
  const seated = new Set<string>()
  const short = (token: string) => token.slice(0, 6)

  const hello = async (req: IncomingMessage, res: ServerResponse) => {
    const body = (await readJson(req)) as Partial<Extract<ClientMsg, { t: 'hello' }>>
    const token = randomBytes(12).toString('hex')
    const [answer] = await dispatch(token, { t: 'hello', protocol: PROTOCOL, name: body.name, look: body.look, skin: body.skin, every: 0 })
    if (answer.t === 'error') return send(res, 409, { error: answer.reason })
    seated.add(token)
    log(`${short(token)} sat down as ${body.name ?? 'Visitor'}`)
    send(res, 200, { token, ...answer })
  }

  const act = async (req: IncomingMessage, res: ServerResponse, token: string) => {
    const body = (await readJson(req)) as { input?: SeatInput; hold?: number }
    if (!body.input || typeof body.input !== 'object') return send(res, 400, { error: 'say {"input": {"t": …}}' })
    const [answer] = await dispatch(token, { t: 'act', input: body.input, ...(body.hold && { hold: body.hold }) })
    log(`${short(token)} ${JSON.stringify(body.input)}${body.hold ? ` hold ${body.hold}s` : ''} → ${answer.t === 'result' ? (answer.ok ? 'ok' : answer.reason) : answer.t}`)
    send(res, 200, answer)
  }

  const observe = async (res: ServerResponse, token: string, text: boolean) => {
    const [answer] = await dispatch(token, { t: 'observe', text })
    if (answer.t !== 'observation') {
      seated.delete(token)
      return send(res, 410, answer)
    }
    return text ? send(res, 200, answer.text ?? '', 'text/plain') : send(res, 200, answer.observation)
  }

  const leave = async (res: ServerResponse, token: string) => {
    await dispatch(token, { t: 'bye' })
    seated.delete(token)
    log(`${short(token)} left`)
    send(res, 200, { ended: true })
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (opts.extra && (await opts.extra(req, res, url))) return
      const [head, token, action] = url.pathname.split('/').filter(Boolean)
      if (req.method === 'GET' && url.pathname === '/spec') return send(res, 200, { protocol: PROTOCOL, ticksPerSecond: TICKS_PER_SECOND, inputs: INPUT_DOCS })
      if (req.method === 'GET' && url.pathname === '/seats' && opts.seats) return send(res, 200, opts.seats())
      if (req.method === 'POST' && url.pathname === '/seat') return await hello(req, res)
      if (head === 'seat' && token) {
        if (!seated.has(token)) return send(res, 404, { error: 'no such seat' })
        if (req.method === 'DELETE' && !action) return await leave(res, token)
        if (req.method === 'POST' && action === 'act') return await act(req, res, token)
        if (req.method === 'GET' && action === 'observe') return await observe(res, token, url.searchParams.has('text'))
      }
      send(res, 404, { error: 'no such route' })
    } catch (err) {
      if (err instanceof Unavailable) return send(res, err.status, { error: err.message })
      send(res, 400, { error: (err as Error).message })
    }
  })
}
