// Games served as the player fetches them (docs/engine-split.md §5): a project's folder compiled when it is
// asked for (and again when its files change), its assets from its folder; a game that writes its own bundle
// (OpenWorld: `public/bundle.json`, by gen:world) from its public folder. Used by the player's dev server and
// the editor's (P4). Node only.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
// the engine's official modules, which a project may name
import '@openworld/modules'
import { compileProject } from './node.ts'
import type { Compiled } from './project.ts'

const TYPES: Record<string, string> = { '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.js': 'text/javascript', '.svg': 'image/svg+xml' }

/** The newest change under a folder (what a compiled project is kept by). */
function newest(dir: string): number {
  let t = 0
  for (const f of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (f.split(sep)[0] === 'assets' || f.split(sep).includes('node_modules') || !f.endsWith('.json')) continue
    t = Math.max(t, statSync(join(dir, f)).mtimeMs)
  }
  return t
}

const cache = new Map<string, { at: number; c: Compiled }>()
/** A project compiled, kept until one of its files changes. */
export function compiledAt(dir: string): Compiled {
  const at = newest(dir)
  const hit = cache.get(dir)
  if (hit && hit.at === at) return hit.c
  const c = compileProject(dir)
  cache.set(dir, { at, c })
  return c
}

export const isProject = (dir: string) => existsSync(join(dir, 'game.json'))

/**
 * Answer a request under `/games/<id>/…` from the folder of games, or pass it on (false). A project's errors are
 * an answer too: the bundle is refused with them, so the author sees why.
 */
export function serveGame(games: string, req: IncomingMessage, res: ServerResponse): boolean {
  const m = (req.url ?? '').split('?')[0].match(/^\/games\/([a-z0-9][a-z0-9-]*)\/(.*)$/)
  if (!m) return false
  const [, id, rest] = m
  const dir = join(games, id)
  const send = (status: number, type: string, body: string | Buffer) => (res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }), res.end(body), true)
  const json = (v: unknown) => send(200, 'application/json', JSON.stringify(v))
  const file = (root: string, rel: string) => {
    const at = normalize(join(root, decodeURIComponent(rel)))
    if (!at.startsWith(root) || !existsSync(at) || !statSync(at).isFile()) return send(404, 'text/plain', `no ${rel}`)
    return send(200, TYPES[extname(at)] ?? 'application/octet-stream', readFileSync(at))
  }
  if (isProject(dir)) {
    if (rest.startsWith('assets/')) return file(dir, rest)
    if (rest !== 'bundle.json' && !rest.startsWith('world/')) return send(404, 'text/plain', `no ${rest}`)
    let c: Compiled
    try {
      c = compiledAt(dir)
    } catch (e) {
      return send(500, 'text/plain', `${id}: ${(e as Error).message}`)
    }
    const errors = c.problems.filter((p) => p.level === 'error')
    if (errors.length) return send(500, 'text/plain', `${id} does not compile:\n` + errors.map((p) => `${p.file ?? ''} ${p.at ?? ''}: ${p.message}`).join('\n'))
    if (rest === 'bundle.json') return json(c.bundle)
    if (rest === 'world/index.json') return json(c.index)
    const map = rest.match(/^world\/maps\/(.+)\.json$/)
    const chunk = map && c.chunks.find((x) => x.map.id === map[1])
    return chunk ? json(chunk) : send(404, 'text/plain', `no ${rest}`)
  }
  if (existsSync(join(dir, 'public', 'bundle.json'))) return file(join(dir, 'public'), rest)
  return false
}
