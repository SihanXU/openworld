// The modes beyond the map and the people: the database, the rules, the story and the quests (P5), and the
// holes with the AI as co-author (P6).

import type { Mode } from './context.ts'
import { DatabaseMode } from './databaseMode.ts'
import { HolesMode } from './holesMode.ts'
import { RulesMode } from './rulesMode.ts'
import { QuestsMode, StoryMode } from './storyMode.ts'

const rules = new RulesMode()
export const MODES: Mode[] = [new DatabaseMode(), rules, new StoryMode(), new QuestsMode(), new HolesMode(() => rules)]
