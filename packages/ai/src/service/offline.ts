// The offline profile's repo agent, handed to the modder by the package's Node entry (pipeline.ts `useOffline`).

import { runAgent } from '../agent/loop.ts'
import { useOffline } from '../modder/pipeline.ts'
import { materializeWorld } from './repo.ts'

useOffline({ runAgent, materializeWorld })
