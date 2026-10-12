// The player's engine thread: the game its page named (the worker's name is the bundle's URL), then the runtime's
// worker. What the page sends while the bundle loads is kept and handed on once the runtime listens.

import { loadBundle } from '../src/bundle.ts'
import { useGame } from '../src/game.ts'

const early: MessageEvent[] = []
const keep = (e: MessageEvent) => early.push(e)
self.addEventListener('message', keep)
useGame(await loadBundle(self.name))
await import('../src/worker.ts')
self.removeEventListener('message', keep)
for (const e of early) self.dispatchEvent(new MessageEvent('message', { data: e.data }))
