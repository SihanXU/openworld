// The modes beyond the map and the people: the database, the rules, the story and the quests (P5), the holes
// with the AI as co-author (P6), (§15) the game's settings, pictures and sounds, (§16 E2) the event searcher, and
// (§19) the game's languages and their translations.

import { AssetsMode } from './assetsMode.ts'
import type { Mode } from './context.ts'
import { DatabaseMode } from './databaseMode.ts'
import { FindMode } from './findMode.ts'
import { GameMode } from './gameMode.ts'
import { HolesMode } from './holesMode.ts'
import { LocaleMode } from './localeMode.ts'
import { RulesMode } from './rulesMode.ts'
import { QuestsMode, StoryMode } from './storyMode.ts'

/** The rules' mode, which others begin a rule in (the holes' answer by hand, a thing's own kind). */
export const rulesMode = new RulesMode()
export const MODES: Mode[] = [new GameMode(), new DatabaseMode(), new AssetsMode(), rulesMode, new StoryMode(), new QuestsMode(), new LocaleMode(), new FindMode(), new HolesMode(() => rulesMode)]
