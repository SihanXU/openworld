// The game as the wiki reads it (docs/engine-split.md P3): the bundle the engine's player loads — its ontology,
// rules and catalogue — and the world it plays, made once from the game's own builders.

import type { Catalog } from '@openworld/runtime/src/assets/types.ts'
import { openworldBundle } from '../../client/src/bundle.ts'
import { buildFord } from '../../tools/src/demo/world.ts'

export const WORLD = buildFord()
export const BUNDLE = openworldBundle(WORLD.index)
export const CATALOG = BUNDLE.catalog as Catalog
