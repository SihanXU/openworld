// This game as the engine and the services around it read it (engine/src/gamedef.ts, docs/engine-split.md):
// what the modder and the runtime are handed instead of importing the content.

import type { GameDef } from '@openworld/engine'
import { STORY_RULES } from './ford.ts'
import { TERRAIN_CHARS, buildOntology } from './ontology.ts'
import { BASE_RULES } from './rules.ts'

export const GAME: GameDef = {
  id: 'openworld',
  ontology: buildOntology,
  rules: [...BASE_RULES, ...STORY_RULES],
  terrainChars: TERRAIN_CHARS,
}

export default GAME
