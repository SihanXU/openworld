import { defineConfig } from 'vite'

// The game's app: its pages hand the game to the runtime (src/register.ts) and run it; its pictures,
// sounds and generated world are the game's public files (docs/engine-split.md, P1).
export default defineConfig({
  base: './',
  publicDir: '../public',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, rollupOptions: { input: { game: 'index.html', bosses: 'boss-gallery.html', looks: 'looks.html' } } },
  server: { port: 5173 },
})
