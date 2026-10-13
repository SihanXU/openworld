// Gear's levels (world-model.md §6.8, 2026-10-13): twenty, the first the Ford's. Each level above the first adds a
// quarter to a piece's main stats (an eighth to its shares) and a tenth to what its rolled extras may reach; a finer
// piece rolls more of them (a crude one two … a Stigmatic six; a monster's own piece the table's four). So a piece of
// one level is the better the finer it is, and of one quality the higher its level. Read by the item catalogue
// (items.ts), the monsters' pieces (trophies.ts), the quests' gear (quests/kit.ts) and the world (ontology params).

import type { WorldParams } from '@openworld/engine'

export const GEAR_LEVELS: NonNullable<WorldParams['gearLevels']> = { max: 20, perLevel: 0.25, affixPerLevel: 0.1, affixCount: { crude: 2, common: 3, fine: 4, masterwork: 5, vowed: 5, legendary: 6 } }
