import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { serveGame } from '../format/src/serve.ts'

// The engine's player (play/): no game in its build. In development it serves the games beside it
// (/games/<id>/: a project compiled when asked for, or a game's own public bundle); a build is the player alone,
// the games built next to it (npm run build:player).
const GAMES = fileURLToPath(new URL('../../games', import.meta.url))

function games(): Plugin {
  return {
    name: 'openworld-games',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // a game's own plugin, as source (one module graph with the player: one engine)
        const plugin = (req.url ?? '').match(/^\/games\/([a-z0-9-]+)\/plugin\.js$/)
        if (plugin) {
          res.writeHead(302, { location: `/@fs${GAMES}/${plugin[1]}/client/src/plugin.ts` })
          return res.end()
        }
        if (!serveGame(GAMES, req, res)) next()
      })
    },
  }
}

export default defineConfig({
  root: fileURLToPath(new URL('./play', import.meta.url)),
  base: './',
  publicDir: false,
  plugins: [games()],
  worker: { format: 'es' },
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: { port: 5174, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
})
