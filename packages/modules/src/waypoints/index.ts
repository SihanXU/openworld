// The waypoints module (docs/prologue.md): stones a traveller attunes, and the world map's travel between
// them. It adds no primitive: a stone's touch and its status are the game's rules; travel is an act of moving.

import { registerModule, type EngineModule } from '@openworld/engine'

export * from './waypoints.ts'

export const waypointsModule: EngineModule = { id: 'waypoints' }

registerModule(waypointsModule)
