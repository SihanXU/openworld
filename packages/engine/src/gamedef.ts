// What a game gives the engine and the services around it (docs/engine-split.md, P1). The engine,
// the runtime and the modder import no game: a game's own entry hands its GameDef over, and they read
// the game's content only through it. P3 replaces the code with a bundle of data files.

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
}
