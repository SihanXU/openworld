// The loot module: a creature kind's own piece of gear, found on felling one — by its chance, or surely after so many
// of the kind without it (loot.ts). What drops and how often is the game's data (each kind's `trophy` and
// `trophyChance` props); the pity and the words the finder is told are its `Ontology.loot`. It brings one primitive,
// `trophy`, which the feller's own rule runs (writing only the feller: its count, and the piece made in its bag).

import { registerModule, type EngineModule } from '@openworld/engine'
import { trophy } from './loot.ts'

export * from './loot.ts'

export const lootModule: EngineModule = {
  id: 'loot',
  effects: { trophy },
  spec: {
    primitives: {
      trophy:
        "trophy {} — the host felled a creature whose kind keeps a piece of gear of its own (params trophy: that piece, a type some kind of the world names as its `trophy`; trophyChance): it comes to the host's bag by that chance, or surely once the host has felled so many of the kind without one (the world's loot.pity, default 50: the host keeps its count, trophy.<type>); made, it rolls its extras as all gear does. A type no kind names as its trophy is never made",
    },
    rules: ['A trophy is the game\'s own spoils: it comes only through the game\'s defeat news, and only a piece some kind names as its `trophy` is ever made.'],
  },
}

registerModule(lootModule)
