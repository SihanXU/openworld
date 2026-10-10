// The editor's service (docs/engine-split.md P4): a local Node service over the projects' files in git. It lists
// the games under games/, reads a project (format/node.ts), writes a file as the format writes it, makes a new
// project from the starter, and says what the compiler finds. Changes go through git as any other: the editor
// writes files, people commit them.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, normalize, relative, sep } from 'node:path'
// the engine's official modules, which a project may name
import '@openworld/modules'
import { formatJson, type GameJson } from '@openworld/format'
import { compileProject, readProject } from '@openworld/format/src/node.ts'
import { projectDir } from '@openworld/format/src/serve.ts'

/** The files of a project the editor may write: game.json, catalog.json, extra.json, and a JSON file in one of the format's folders. */
const WRITABLE = /^(game\.json|catalog\.json|extra\.json|(ontology|rules|maps|people|quests|story|client)\/[A-Za-z0-9._-]+\.json)$/
const ID = /^[a-z][a-z0-9-]{0,40}$/

export interface ProjectInfo {
  id: string
  name: GameJson['name']
  modules: string[]
  maps: number
  people: number
}

export class ProjectsApi {
  constructor(readonly games: string, readonly template = 'starter') {}

  list(): ProjectInfo[] {
    return readdirSync(this.games)
      .filter((id) => projectDir(this.games, id))
      .map((id) => {
        const dir = projectDir(this.games, id)!
        const g = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')) as GameJson
        const count = (d: string) => (existsSync(join(dir, d)) ? readdirSync(join(dir, d)).filter((f) => f.endsWith('.json')).length : 0)
        return { id, name: g.name, modules: g.modules ?? [], maps: count('maps'), people: count('people') }
      })
  }

  private dir(id: string): string {
    const dir = ID.test(id) ? projectDir(this.games, id) : undefined
    if (!dir) throw new HttpError(404, `no project ${id}`)
    return dir
  }

  /** A project file's path, refused unless the format has it. */
  private file(id: string, rel: string): string {
    const clean = normalize(rel).split(sep).join('/')
    if (!WRITABLE.test(clean)) throw new HttpError(400, `the editor writes only the format's files, not ${rel}`)
    return join(this.dir(id), clean)
  }

  read(id: string) {
    return readProject(this.dir(id))
  }

  write(id: string, rel: string, value: unknown): void {
    const at = this.file(id, rel)
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, formatJson(value))
  }

  remove(id: string, rel: string): void {
    const at = this.file(id, rel)
    if (rel === 'game.json') throw new HttpError(400, 'a project keeps its game.json')
    rmSync(at, { force: true })
  }

  problems(id: string) {
    const c = compileProject(this.dir(id))
    return { problems: c.problems, stats: c.index.stats }
  }

  /** A new project: the template's files (its data and its assets, not its tests), under a new id and name. */
  create(id: string, name: GameJson['name']): ProjectInfo {
    if (!ID.test(id)) throw new HttpError(400, `"${id}" is not a project id (lower case letters, digits and -)`)
    const to = join(this.games, id)
    if (existsSync(to)) throw new HttpError(409, `games/${id} exists`)
    const from = this.dir(this.template)
    cpSync(from, to, { recursive: true, filter: (s) => { const r = relative(from, s).split(sep)[0]; return r !== 'test' && r !== 'dist' && r !== 'tsconfig.json' && r !== 'node_modules' } })
    const g = JSON.parse(readFileSync(join(to, 'game.json'), 'utf8')) as GameJson
    this.write(id, 'game.json', { ...g, id, name, version: '1', doc: undefined })
    return this.list().find((p) => p.id === id)!
  }

  /** Answer a request under /api/, or pass it on (false). */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return false
    const send = (status: number, body: unknown) => (res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }), res.end(JSON.stringify(body)), true)
    try {
      const parts = url.pathname.slice(5).split('/').map(decodeURIComponent)
      const body = async () => { let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : undefined }
      if (parts[0] !== 'projects') return send(404, { error: 'no such call' })
      const [, id, what, ...rest] = parts
      if (!id && req.method === 'GET') return send(200, this.list())
      if (!id && req.method === 'POST') { const b = await body(); return send(200, this.create(b.id, b.name)) }
      if (id && !what && req.method === 'GET') return send(200, this.read(id))
      if (id && what === 'problems') return send(200, this.problems(id))
      if (id && what === 'files' && rest.length) {
        const rel = rest.join('/')
        if (req.method === 'PUT') return (this.write(id, rel, await body()), send(200, { ok: true }))
        if (req.method === 'DELETE') return (this.remove(id, rel), send(200, { ok: true }))
      }
      return send(404, { error: 'no such call' })
    } catch (e) {
      return send(e instanceof HttpError ? e.status : 500, { error: (e as Error).message })
    }
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}
