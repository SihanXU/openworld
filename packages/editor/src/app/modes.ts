// The modes beyond the map and the people: the database, the rules, the story and the quests (P5), the holes
// with the AI as co-author (P6), and (§15) the game's settings, pictures and sounds.

import { AssetsMode } from './assetsMode.ts'
import type { Mode } from './context.ts'
import { DatabaseMode } from './databaseMode.ts'
import { GameMode } from './gameMode.ts'
import { HolesMode } from './holesMode.ts'
import { RulesMode } from './rulesMode.ts'
import { QuestsMode, StoryMode } from './storyMode.ts'

const rules = new RulesMode()
export const MODES: Mode[] = [new GameMode(), new DatabaseMode(), new AssetsMode(), rules, new StoryMode(), new QuestsMode(), new HolesMode(() => rules)]
