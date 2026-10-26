// The player's own modder, as the runtime's plugin (runtime/src/ai.ts, docs/byok.md): the services a player may bring a
// key for, and the worker that runs the modder in the page (worker.ts). The runtime finds this file when the AI is in
// the build; without it the game plays with no model.

import type { AiPlugin } from '@openworld/runtime/src/ai.ts'
import { PROVIDERS } from '../models/providerList.ts'

const plugin: AiPlugin = {
  providers: PROVIDERS,
  startModder: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'modder' }),
}

export default plugin
