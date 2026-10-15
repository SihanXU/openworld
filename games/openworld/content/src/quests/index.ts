// The quests (docs/quests.md): the main line, what the people ask, the radiant favours, and the fairy's guides.

import type { QuestDef } from '@openworld/engine'
import { MAIN_QUESTS } from './main.ts'
import { SIDE_QUESTS } from './side.ts'
import { FAVORS } from './favors.ts'
import { GUIDE_QUESTS } from './guides.ts'

export { MAIN_QUESTS, PAST_KNIGHT, AWAKENING } from './main.ts'
export { SIDE_QUESTS } from './side.ts'
export { FAVORS } from './favors.ts'
export { GUIDE_BEATS, GUIDE_QUESTS, GARDEN_BARE_ROW, LUMI_ID, TRAINER_ID } from './guides.ts'
export { errand, gear, type Ask, type Errand } from './kit.ts'

export const QUESTS: QuestDef[] = [...MAIN_QUESTS, ...SIDE_QUESTS, ...FAVORS, ...GUIDE_QUESTS]
