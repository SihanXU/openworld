import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // the game's pictures, sounds and generated world (docs/engine-split.md, P1)
  publicDir: '../../games/openworld/public',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, rollupOptions: { input: { game: 'index.html', bosses: 'boss-gallery.html', looks: 'looks.html' } } },
  server: { port: 5173 },
})
