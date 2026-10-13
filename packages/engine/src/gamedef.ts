// What a game gives the engine and the services around it (docs/engine-split.md, P1). The engine,
// the runtime and the modder import no game: a game's own entry hands its GameDef over, and they read
// the game's content only through it. P3 replaces the code with a bundle of data files.

import type { Engine } from './engine.ts'
import type { LibraryData } from './rules.ts'
import type { ModRequest } from './mod.ts'
import type { Ontology, Rule } from './types.ts'

export interface GameDef {
  /** The game's id (its folder under games/). */
  id: string
  /** The ontology: types, statuses, terrains, elements… Built anew on every call, so a caller may extend its own copy. */
  ontology(): Ontology
  /** The base rule library: the world's physics and the story's rules. */
  rules: Rule[]
  /** Which terrain each character of a map file's rows stands for (chunk.ts). */
  terrainChars: Record<string, string>
  /**
   * The patches the game ships with (docs/engine-split.md P6): answers to its holes its authors took in, a
   * library every new game and every save begins from (the modder's, and a save's own, come over it).
   */
  learned?: LibraryData
  /**
   * Questions the game asks of a model to see what it carries (design.md §13, the AI setting): undefined outcomes of its own,
   * each a request as the game raises it, played at every tier by the modder's detection where its history is
   * short. Loaded only then (a player never needs them).
   */
  probes?: () => Promise<ModRequest[]>
  /** The game's own save history: an older save brought up to the game as it is now (on loading, as the author, after the engine's). */
  upgradeSave?(eng: Engine): void
}
