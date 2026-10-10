// The engine's player (docs/engine-split.md P3): no game in its build. It fetches the game named by `?game=<url>`
// (a folder with bundle.json, its world and its assets), else the one its page names (an exported game's
// `<meta name="openworld-game">`), else the starter beside it; hands it to the runtime, and plays it — the
// engine in a worker that loads the same bundle (worker.ts).

import { loadBundle } from '../src/bundle.ts'
import { useGame, useWorker } from '../src/game.ts'

const PARAMS = new URLSearchParams(location.search)
const named = document.querySelector<HTMLMetaElement>('meta[name="openworld-game"]')?.content
const url = new URL(PARAMS.get('game') ?? named ?? 'games/starter/', location.href).href

try {
  useGame(await loadBundle(url))
  // the worker is told which game by its name (it loads the bundle before the runtime's engine thread starts)
  useWorker(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: url }))
  await import('../src/main.ts')
} catch (e) {
  const at = document.getElementById('loadingText')
  if (at) at.textContent = `No game could be loaded from ${url}: ${(e as Error).message}`
  throw e
}
