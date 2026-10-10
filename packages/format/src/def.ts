// A bundle as the engine side is handed a game (gamedef.ts): its ontology, rules and terrain characters are
// the bundle's data. What only code can do (the upgrades of older saves, a wilderness) comes from the game's
// plugins, which the runtime loads beside it.

import type { GameDef } from '@openworld/engine'
import type { Bundle } from './project.ts'

export function gameDefOf(b: Bundle, code: Pick<GameDef, 'upgradeSave'> = {}): GameDef {
  return {
    id: b.game.id,
    ontology: () => structuredClone(b.ontology),
    rules: b.rules,
    terrainChars: b.terrainChars,
    ...code,
  }
}
