// The OpenWorld Editor as a program of its own (docs/engine-split.md §15): one local HTTP server, no development
// tooling — the editor's page built (/editor/), the engine's player built (/runtime/play/, which the playtest
// opens), the service (/api/, the pack's files under /pack/) and the projects compiled as the player fetches them
// (/games/<key>/). The command line (cli.ts) and the desktop shell (desktop/) start it; `npm run editor` is the
// same service inside Vite's development server instead.

import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { sendFile, serveGameFolder } from '@openworld/format/src/serve.ts'
import { ProjectsApi } from './api.ts'
import { Workspace, emptyShape, type Template } from './workspace.ts'

/** Where a built editor keeps its parts (what `npm run editor:build` writes to packages/editor/dist/). */
export function layoutAt(root: string) {
  return { app: join(root, 'editor'), player: join(root, 'player'), pack: join(root, 'pack'), starter: join(root, 'templates', 'starter') }
}

/** The editor's templates over the starter: the starter itself, and an empty project made from it. */
export function templatesOf(starter: string): Record<string, Template> {
  return {
    starter: {
      name: { en: 'The Glade (starter)', zh: '林间空地（入门）' },
      doc: { en: 'A whole small game to change: a glade, a cottage, a villager with a day, an axe in a chest, a tree to fell, a slime, a favour.', zh: '一个完整的小游戏：林间空地、小屋、有日程的村民、箱子里的斧头、可以砍的树、史莱姆、一个委托。' },
      dir: starter,
    },
    empty: {
      name: { en: 'Empty', zh: '空白' },
      doc: { en: 'One blank map; the starter\'s kinds of things, rules, pictures and sounds to build with.', zh: '一张空白地图；带入门游戏的物品种类、规则、图片和声音。' },
      dir: starter,
      shape: emptyShape,
    },
  }
}

export interface EditorServerOptions {
  /** The built editor's page, the built player, the pack (default: from `root`, a built editor's folder). */
  root?: string
  app?: string
  player?: string
  pack?: string
  workspace?: Workspace
  /** Where the editor keeps its recent list, where new projects go, folders of projects always listed. */
  home?: string
  projects?: string
  shelves?: string[]
  port?: number
  host?: string
  shell?: 'browser' | 'desktop'
}

export interface EditorServer {
  server: Server
  url: string
  api: ProjectsApi
  close(): Promise<void>
}

/** Start the editor's server (port 0: any free one); its address once it listens. */
export async function startEditor(o: EditorServerOptions): Promise<EditorServer> {
  const at = o.root ? layoutAt(o.root) : undefined
  const app = o.app ?? at?.app
  const player = o.player ?? at?.player
  const pack = o.pack ?? (at && existsSync(at.pack) ? at.pack : undefined)
  if (!app || !existsSync(join(app, 'index.html'))) throw new Error(`no built editor at ${app} (npm run editor:build)`)
  if (!player || !existsSync(join(player, 'index.html'))) throw new Error(`no built player at ${player} (npm run editor:build)`)
  const workspace = o.workspace ?? new Workspace({ home: o.home, projects: o.projects, shelves: o.shelves, templates: templatesOf(at?.starter ?? '') })
  const host = o.host ?? '127.0.0.1'
  const api = new ProjectsApi(workspace, { pack, player: () => player, shell: o.shell, hosts: host === '127.0.0.1' || host === 'localhost' ? [] : [host] })
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/' || path === '/editor') return void (res.writeHead(302, { location: '/editor/' }), res.end())
    void api
      .handle(req, res)
      .then((done) => {
        if (done) return
        if (path.startsWith('/editor/')) return void sendFile(app, path === '/editor/' ? 'index.html' : path.slice('/editor/'.length), res)
        if (path.startsWith('/runtime/play/')) return void sendFile(player, path === '/runtime/play/' ? 'index.html' : path.slice('/runtime/play/'.length), res)
        const g = path.match(/^\/games\/([a-z0-9][a-z0-9-]*)\/(.*)$/)
        if (g) {
          let folder
          try {
            folder = workspace.folder(g[1])
          } catch {
            return void (res.writeHead(404, { 'content-type': 'text/plain' }), res.end(`no game ${g[1]}`))
          }
          if (serveGameFolder(folder, g[2], res, g[1])) return
        }
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end(`no ${path}`)
      })
      .catch((e: Error) => {
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' })
        res.end(e.message)
      })
  })
  await new Promise<void>((ok, fail) => (server.once('error', fail), server.listen(o.port ?? 5175, host, () => ok())))
  const { port } = server.address() as AddressInfo
  const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/editor/`
  return { server, url, api, close: () => new Promise((ok) => server.close(() => ok())) }
}
