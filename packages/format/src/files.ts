// The types the project's files are, for the schema generator (schema.ts).
import type { QuestDef, RawChunk, Rule } from '@openworld/engine'
export type { GameJson, OntologyPart, PersonFile, StoryFile } from './project.ts'
export type RuleFile = Rule[]
export type MapFile = RawChunk
export type QuestFile = QuestDef
