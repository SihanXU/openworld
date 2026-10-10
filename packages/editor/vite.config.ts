import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { serveGame } from '../format/src/serve.ts'
import { ProjectsApi } from './src/server/api.ts'

// The OpenWorld Editor (docs/engine-split.md P4–P6): a local service over the projects' files (src/server/api.ts),
// and the editor's page (/editor/) beside the engine's player (/runtime/play/), which the playtest opens.
const PACKAGES = fileURLToPath(new URL('..', import.meta.url))
const GAMES = fileURLToPath(new URL('../../games', import.meta.url))
const api = new ProjectsApi(GAMES)

function service(): Plugin {
  return {
    name: 'openworld-editor',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/editor') return (res.writeHead(302, { location: '/editor/' }), res.end())
        const plugin = (req.url ?? '').match(/^\/games\/([a-z0-9-]+)\/plugin\.js$/)
        if (plugin) return (res.writeHead(302, { location: `/@fs${GAMES}/${plugin[1]}/client/src/plugin.ts` }), res.end())
        void api.handle(req, res).then((done) => done || serveGame(GAMES, req, res) || next())
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
