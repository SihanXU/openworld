// The game's page: the runtime playing this game, its engine in this game's worker (worker.ts).

import { useWorker } from '@openworld/runtime/src/game.ts'
import './register.ts'

useWorker(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }))
// the runtime's page boots as it loads, so it comes once the game and its worker are named
void import('@openworld/runtime/src/main.ts')
