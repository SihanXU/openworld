// The editor's service (docs/engine-split.md P4, §15): a local Node service over the projects' files, wherever
// they are (workspace.ts). It lists the projects the editor knows, opens a folder as one, makes a new one from a
// template, reads a project (format/node.ts), writes a file as the format writes it, says what the compiler finds;
// lists, imports and takes a project's pictures and sounds (assets.ts); browses the disk's folders; and exports a
// project as a game anyone can play (export.ts). It answers only its own machine: a request must name this host,
// and one that changes anything must carry the editor's header (which a page of another site cannot send).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, normalize, sep } from 'node:path'
// the engine's official modules, which a project may name
import '@openworld/modules'
import { formatJson } from '@openworld/format'
import { compileProject, readProject } from '@openworld/format/src/node.ts'
import { sendFile } from '@openworld/format/src/serve.ts'
import { AssetError, MAX_ASSET, importAsset, listAssets, packFiles, removeAsset, takeFromPack } from './assets.ts'
import { exportGame } from './export.ts'
import { HEADER } from './headers.ts'
import { Workspace, WorkspaceError, type ProjectInfo } from './workspace.ts'

export type { ProjectInfo }

/** The files of a project the editor may write: game.json, catalog.json, extra.json, and a JSON file in one of the format's folders. */
const WRITABLE = /^(game\.json|catalog\.json|extra\.json|(ontology|rules|maps|people|quests|story|client|learned|locales)\/[A-Za-z0-9._-]+\.json)$/

export { HEADER }

export interface ApiOptions {
  /** The pack of pictures and sounds projects take from. */
  pack?: string
  /** The built player an export copies (a function: development builds it when first asked). */
  player?: () => Promise<string> | string
  /** Host names besides this machine's that may call it (an editor served on a network on purpose). */
  hosts?: string[]
  /** What the editor's page is told it runs in. */
  shell?: 'browser' | 'desktop'
}

export class ProjectsApi {
  readonly ws: Workspace
  /** Each project's last export, served under /exported/<key>/ to be tried at once. */
  private exported = new Map<string, string>()

  constructor(ws: Workspace | string, readonly o: ApiOptions = {}) {
    // (a folder: the projects of that one shelf, the starter among them the template — the tests' and the old way)
    this.ws = typeof ws === 'string' ? new Workspace({ shelves: [ws], templates: { starter: { name: 'Starter', doc: '', dir: join(ws, 'starter') } }, home: join(ws, '.editor'), projects: ws }) : ws
  }

  list(): ProjectInfo[] {
    return this.ws.list()
  }

  private dir(key: string): string {
    return this.ws.dir(key)
  }

  /** A project file's path, refused unless the format has it. */
  private file(key: string, rel: string): string {
    const clean = normalize(rel).split(sep).join('/')
    if (!WRITABLE.test(clean)) throw new HttpError(400, `the editor writes only the format's files, not ${rel}`)
    return join(this.dir(key), clean)
  }

  read(key: string) {
    return readProject(this.dir(key))
  }

  write(key: string, rel: string, value: unknown): void {
    const at = this.file(key, rel)
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, formatJson(value))
  }

  remove(key: string, rel: string): void {
    const at = this.file(key, rel)
    if (rel === 'game.json') throw new HttpError(400, 'a project keeps its game.json')
    rmSync(at, { force: true })
  }

  problems(key: string) {
    const c = compileProject(this.dir(key))
    return { problems: c.problems, stats: c.index.stats }
  }

  /** A new project from a template (the first: the starter), in a folder (default: the editor's projects folder). */
  create(o: { template?: string; id: string; name: ProjectInfo['name']; folder?: string; dirName?: string; source?: string }): ProjectInfo {
    return this.ws.create(o)
  }

  /** What the editor's first page shows: the projects, the templates, where new ones go. */
  workspace() {
    return {
      projects: this.list(),
      templates: Object.entries(this.ws.opts.templates).map(([id, t]) => ({ id, name: t.name, doc: t.doc })),
      projectsDir: this.ws.projectsDir,
      pack: !!this.o.pack,
      shell: this.o.shell ?? 'browser',
    }
  }

  async export(key: string, b: { folder?: string; zip?: boolean }) {
    if (!this.o.player) throw new HttpError(400, 'this editor has no player to export with')
    const game = this.ws.folder(key)
    const id = this.read(key).game.id
    // (by default beside the project; a game on a shelf — the repository's — into the editor's projects folder)
    const shelf = this.list().find((p) => p.key === key)?.shelf
    const out = b.folder?.trim() || join(shelf ? this.ws.projectsDir : dirname(game.project!), `${id}-export`)
    const r = exportGame({ game, player: await this.o.player(), out, zip: b.zip })
    this.exported.set(key, r.dir)
    return { ...r, url: `/exported/${encodeURIComponent(key)}/` }
  }

  /** Is the request from this machine (or a host it was told of)? */
  private local(req: IncomingMessage): boolean {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
    return ['localhost', '127.0.0.1', '::1', ...(this.o.hosts ?? [])].includes(host)
  }

  /** Answer a request under /api/ (and the pack's files under /pack/), or pass it on (false). */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const send = (status: number, body: unknown) => (res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }), res.end(JSON.stringify(body)), true)
    if (url.pathname.startsWith('/pack/') && this.o.pack) {
      if (!this.local(req)) return send(403, { error: 'the editor answers only its own machine' })
      return sendFile(this.o.pack, url.pathname.slice('/pack/'.length), res)
    }
    const tried = url.pathname.match(/^\/exported\/([a-z0-9][a-z0-9-]*)\/(.*)$/)
    if (tried && this.exported.has(tried[1])) return sendFile(this.exported.get(tried[1])!, tried[2] || 'index.html', res)
    if (!url.pathname.startsWith('/api/')) return false
    if (!this.local(req)) return send(403, { error: 'the editor answers only its own machine' })
    if (req.method !== 'GET' && req.headers[HEADER] !== '1') return send(403, { error: `a change must carry the ${HEADER} header` })
    try {
      const parts = url.pathname.slice(5).split('/').map(decodeURIComponent)
      const raw = async (limit = 8 << 20) => {
        const chunks: Buffer[] = []
        let n = 0
        for await (const c of req) {
          n += (c as Buffer).length
          if (n > limit) throw new HttpError(413, 'too large')
          chunks.push(c as Buffer)
        }
        return Buffer.concat(chunks)
      }
      const body = async () => { const s = (await raw()).toString('utf8'); return s ? JSON.parse(s) : {} }
      if (parts[0] === 'workspace' && req.method === 'GET') return send(200, this.workspace())
      if (parts[0] === 'settings' && req.method === 'GET') return send(200, this.ws.settings())
      if (parts[0] === 'settings' && req.method === 'PUT') return send(200, this.ws.saveSettings(await body()))
      if (parts[0] === 'fs' && req.method === 'GET') return send(200, this.ws.browse(url.searchParams.get('path') ?? undefined))
      if (parts[0] === 'pack' && req.method === 'GET') return send(200, packFiles(this.o.pack))
      if (parts[0] !== 'projects') return send(404, { error: 'no such call' })
      const [, key, what, ...rest] = parts
      if (!key && req.method === 'GET') return send(200, this.list())
      if (!key && req.method === 'POST') return send(200, this.create(await body()))
      if (key === 'open' && !what && req.method === 'POST') return send(200, this.ws.open((await body()).path))
      if (key && !what && req.method === 'GET') return send(200, this.read(key))
      if (key && !what && req.method === 'DELETE') return (this.ws.forget(key), send(200, { ok: true }))
      if (key && what === 'problems') return send(200, this.problems(key))
      if (key && what === 'files' && rest.length) {
        const rel = rest.join('/')
        if (req.method === 'PUT') return (this.write(key, rel, await body()), send(200, { ok: true }))
        if (req.method === 'DELETE') return (this.remove(key, rel), send(200, { ok: true }))
      }
      if (key && what === 'assets') {
        const assets = this.ws.folder(key).assets
        const rel = rest.join('/')
        if (!rel && req.method === 'GET') return send(200, listAssets(assets))
        if (rel === 'from-pack' && req.method === 'POST') return send(200, { taken: takeFromPack(this.o.pack, assets, (await body()).paths ?? []) })
        if (rel && req.method === 'GET') return sendFile(assets, rel, res)
        if (rel && req.method === 'PUT') return send(200, importAsset(assets, rel, await raw(MAX_ASSET)))
        if (rel && req.method === 'DELETE') return (removeAsset(assets, rel), send(200, { ok: true }))
      }
      if (key && what === 'export' && req.method === 'POST') return send(200, await this.export(key, await body()))
      return send(404, { error: 'no such call' })
    } catch (e) {
      const status = e instanceof HttpError || e instanceof WorkspaceError ? e.status : e instanceof AssetError ? 400 : e instanceof SyntaxError ? 400 : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}
