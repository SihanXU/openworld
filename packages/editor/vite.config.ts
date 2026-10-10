import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build, defineConfig, type Plugin } from 'vite'
import { serveGameFolder } from '../format/src/serve.ts'
import { ProjectsApi } from './src/server/api.ts'
import { templatesOf } from './src/server/server.ts'
import { Workspace } from './src/server/workspace.ts'

// The OpenWorld Editor in development (docs/engine-split.md P4–P6, §15): the service over the projects (the
// repository's games/ always listed, any other folder opened or made from a template), the editor's page
// (/editor/) beside the engine's player (/runtime/play/), which the playtest opens. The editor as a program of its
// own is the same service in its own server (src/server/server.ts, npm run editor:build).
const PACKAGES = fileURLToPath(new URL('..', import.meta.url))
const GAMES = fileURLToPath(new URL('../../games', import.meta.url))
const PLAYER = fileURLToPath(new URL('../runtime/dist', import.meta.url))
const workspace = new Workspace({ shelves: [GAMES], templates: templatesOf(`${GAMES}/starter`) })
const api = new ProjectsApi(workspace, {
  pack: `${GAMES}/openworld/public/assets/na`,
  // the player an export copies: built once when first needed (npm run build:player builds it too)
  async player() {
    if (!existsSync(`${PLAYER}/index.html`)) await build({ configFile: fileURLToPath(new URL('../runtime/vite.config.ts', import.meta.url)), configLoader: 'runner', logLevel: 'warn' })
    return PLAYER
  },
})

function service(): Plugin {
  return {
    name: 'openworld-editor',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/editor') return (res.writeHead(302, { location: '/editor/' }), res.end())
        const plugin = (req.url ?? '').match(/^\/games\/([a-z0-9-]+)\/plugin\.js$/)
        if (plugin && existsSync(`${GAMES}/${plugin[1]}/client/src/plugin.ts`)) return (res.writeHead(302, { location: `/@fs${GAMES}/${plugin[1]}/client/src/plugin.ts` }), res.end())
        void api.handle(req, res).then((done) => {
          if (done) return
          const g = (req.url ?? '').split('?')[0].match(/^\/games\/([a-z0-9][a-z0-9-]*)\/(.*)$/)
          let folder
          try {
            folder = g ? workspace.folder(g[1]) : undefined
          } catch {
            folder = undefined
          }
          if (!(g && folder && serveGameFolder(folder, g[2], res, g[1]))) next()
        })
      })
    },
  }
}

export default defineConfig({
  root: PACKAGES,
  base: '/',
  publicDir: false,
  plugins: [service()],
  worker: { format: 'es' },
  server: { port: 5175, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
})
