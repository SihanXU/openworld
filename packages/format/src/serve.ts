// Games served as the player fetches them (docs/engine-split.md §5): a project's folder compiled when it is
// asked for (and again when its files change), its assets from its folder; a game that writes its own bundle
// (OpenWorld: `public/bundle.json`, by gen:world) from its public folder. Used by the player's dev server and
// the editor's (P4), which serves projects from any folder (a GameFolder). Node only.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
// the engine's official modules, which a project may name
import '@openworld/modules'
import { compileProject } from './node.ts'
import type { Compiled } from './project.ts'

export const TYPES: Record<string, string> = { '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.wasm': 'application/wasm' }

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
 * A game's project in the folder of games: `games/<id>/` when it is a project, or `games/<id>/project/` (a game
 * written by code, baked into the format: OpenWorld's `npm run bake`).
 */
export function projectDir(games: string, id: string): string | undefined {
  const dir = join(games, id)
  return isProject(dir) ? dir : isProject(join(dir, 'project')) ? join(dir, 'project') : undefined
}

/** A game as it is served: its project (when it is one), where its pictures and sounds are, and, for a game that writes its own bundle, its public folder. */
export interface GameFolder {
  project?: string
  assets: string
  public?: string
}

/** A project's folder as served: its assets/ (or, for a project baked inside a game's folder, the game's public/assets/). */
export function projectFolder(project: string, root = project): GameFolder {
  return { project, assets: existsSync(join(project, 'assets')) || root === project ? join(project, 'assets') : join(root, 'public', 'assets') }
}

/** A game in the folder of games, as served (none: no game there). */
export function gameFolder(games: string, id: string): GameFolder | undefined {
  const dir = join(games, id)
  const project = projectDir(games, id)
  if (project) return projectFolder(project, dir)
  if (existsSync(join(dir, 'public', 'bundle.json'))) return { assets: join(dir, 'public', 'assets'), public: join(dir, 'public') }
  return undefined
}

/** Where a game's pictures and sounds are: its project's assets/, or its public/assets/. */
export function assetsDir(games: string, id: string): string {
  return gameFolder(games, id)?.assets ?? join(games, id, 'public', 'assets')
}

/** A file of a folder as an answer (404 outside it or where there is none). */
export function sendFile(root: string, rel: string, res: ServerResponse): true {
  const at = normalize(join(root, decodeURIComponent(rel)))
  const send = (status: number, type: string, body: string | Buffer) => (res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }), res.end(body), true as const)
  if (!(at === root || at.startsWith(root.endsWith(sep) ? root : root + sep)) || !existsSync(at) || !statSync(at).isFile()) return send(404, 'text/plain', `no ${rel}`)
  return send(200, TYPES[extname(at).toLowerCase()] ?? 'application/octet-stream', readFileSync(at))
}

/**
 * Answer the request for `rest` (a path under the game's URL: bundle.json, world/…, assets/…) from a game's
 * folder. A project's errors are an answer too: the bundle is refused with them, so the author sees why.
 */
export function serveGameFolder(g: GameFolder, rest: string, res: ServerResponse, name = 'the game'): boolean {
  const send = (status: number, type: string, body: string | Buffer) => (res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }), res.end(body), true)
  const json = (v: unknown) => send(200, 'application/json', JSON.stringify(v))
  if (g.project) {
    if (rest.startsWith('assets/')) return sendFile(g.assets, rest.slice('assets/'.length), res)
    // a plugin the project ships built (a script beside its data)
    if (/^(plugins\/)?[A-Za-z0-9._-]+\.js$/.test(rest)) return sendFile(g.project, rest, res)
    if (rest !== 'bundle.json' && !rest.startsWith('world/')) return send(404, 'text/plain', `no ${rest}`)
    let c: Compiled
    try {
      c = compiledAt(g.project)
    } catch (e) {
      return send(500, 'text/plain', `${name}: ${(e as Error).message}`)
    }
    const errors = c.problems.filter((p) => p.level === 'error')
    if (errors.length) return send(500, 'text/plain', `${name} does not compile:\n` + errors.map((p) => `${p.file ?? ''} ${p.at ?? ''}: ${p.message}`).join('\n'))
    if (rest === 'bundle.json') return json(c.bundle)
    if (rest === 'world/index.json') return json(c.index)
    const map = rest.match(/^world\/maps\/(.+)\.json$/)
    const chunk = map && c.chunks.find((x) => x.map.id === map[1])
    return chunk ? json(chunk) : send(404, 'text/plain', `no ${rest}`)
  }
  if (g.public) return sendFile(g.public, rest, res)
  return false
}

/** Answer a request under `/games/<id>/…` from the folder of games, or pass it on (false). */
export function serveGame(games: string, req: IncomingMessage, res: ServerResponse): boolean {
  const m = (req.url ?? '').split('?')[0].match(/^\/games\/([a-z0-9][a-z0-9-]*)\/(.*)$/)
  if (!m) return false
  const g = gameFolder(games, m[1])
  return g ? serveGameFolder(g, m[2], res, m[1]) : false
}
