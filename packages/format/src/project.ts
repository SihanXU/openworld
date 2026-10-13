// The project format (docs/engine-split.md §5): a game as data files in its folder, and the bundle the
// compiler makes of them for the runtime, the modder and the wiki.
//
//   game.json         the game: its name and version, the modules it uses, the world's parameters, where a new
//                     game begins, the player, which character stands for which terrain in its maps
//   ontology/*.json   parts of the ontology (types, statuses, terrains, factions …), merged in file order over
//                     the standard library's; `types`, `statuses`, `terrains` may be lists or records by id
//   rules/*.json      base rules, each file a list (a rule of a library rule's id replaces it)
//   maps/<id>.json    a map: its terrain rows (one character a cell), heights, portals, anchors, regions, and
//                     the things on it with ids of their own
//   people/<id>.json  a person: the entity, its day (a schedule entry may name an anchor, `"at": "map:anchor"`)
//   quests/<id>.json  a quest (docs/quests.md)
//   story/*.json      the story's steps, invariants, protected facts, fixed weather
//   catalog.json      what the runtime draws and plays each content key with (the runtime's Catalog)
//   client/*.json     tables the runtime's panels read (item forms, recipes, skills, looks …), merged by key
//   learned/*.json    the patches the game ships with: answers to its holes its authors took in (rules with
//                     their places, and the types and statuses they brought)
//   locales/<code>.json  a translation table: how a language says the game's words, written in its source
//                     language (game.json `languages`; texts.ts)
//   extra.json        what the world's index carries beyond these (a module's data: bosses, the codex's entries)
//   assets/           pictures and sounds the catalogue names, served beside the bundle
//
// A game whose content a script makes (OpenWorld's TypeScript builders) writes the same files, or hands the
// compiler the same `Project` in memory.

import type { LocaleFile } from './texts.ts'
import type { Entity, Invariant, LibraryData, Ontology, Pos, QuestDef, RawChunk, Rule, ScheduleEntry, StartDef, StatusDef, StepDef, Text, TypeDef, WeatherSpan, WorldIndex, WorldParams } from '@openworld/engine'

export const FORMAT = 1

export interface GameJson {
  /** Its folder under games/. */
  id: string
  name: Text
  /** The content's version: saves of another version are not loaded. */
  version: string
  /** The engine it was made for. */
  engine?: string
  doc?: string
  /** Start from the standard library (default true). */
  stdlib?: boolean
  /** The engine's modules it uses, in the order they are installed. */
  modules?: string[]
  seed: number
  start: Pos
  /** The map the world map lays the others out from, by their edge links (default: the start's). */
  origin?: string
  /**
   * The order the world lists its maps, people and quests in, by id (the Story Manager tries quests in it);
   * those not named come after, by file name.
   */
  order?: { maps?: string[]; people?: string[]; quests?: string[] }
  begin?: Omit<StartDef, 'at'>
  starts?: Record<string, StartDef>
  startHour?: number
  player: Entity
  companions?: Entity[]
  /** Which terrain each character of a map's rows stands for. */
  terrainChars: Record<string, string>
  /** The world's parameters, over the library's. */
  params?: Partial<WorldParams>
  /** Scripts the runtime loads with the game (its own code: a wilderness, the upgrades of older saves), by URL beside the bundle. */
  plugins?: string[]
  /**
   * Its languages (docs/engine-split.md §19): the one its words are written in (default English), and those they are
   * translated into, a table each in `locales/<code>.json`.
   */
  languages?: { source: string; translations?: string[] }
}

/** An ontology file: a part of the ontology; its types, statuses and terrains as lists or as records by id. */
export type OntologyPart = Omit<Partial<Ontology>, 'types' | 'statuses' | 'terrains'> & {
  types?: Ontology['types'] | Ontology['types'][string][]
  statuses?: Ontology['statuses'] | Ontology['statuses'][string][]
  terrains?: Ontology['terrains'] | Ontology['terrains'][string][]
}

/** A schedule entry as a person's file writes it: a place, or an anchor of a map (`map:anchor`). */
export type ScheduleFileEntry = Omit<ScheduleEntry, 'map' | 'x' | 'y'> & ({ map: string; x: number; y: number; at?: undefined } | { at: string; map?: undefined; x?: undefined; y?: undefined })

/** A person's file: the entity, its schedule's places by anchor if it likes. */
export type PersonFile = Omit<Entity, 'npc'> & { npc?: Omit<NonNullable<Entity['npc']>, 'schedule'> & { schedule: ScheduleFileEntry[] }; _items?: Entity[] }

export interface StoryFile {
  steps?: StepDef[]
  invariants?: Invariant[]
  /** Fact-key prefixes only the story's own rules may change (design.md §5.11). */
  protectedFacts?: string[]
  weather?: WeatherSpan[]
}

/** A file of learned patches: a patch's artifacts, kept as data. */
export interface LearnedFile {
  rules?: Rule[]
  types?: TypeDef[]
  statuses?: StatusDef[]
}

/** A file of the project, read: where it came from (for the problems) and what it holds. */
export interface Sourced<T> {
  file: string
  data: T
}

/** A project as the compiler takes it: from its folder (node.ts `readProject`), from the editor, or from a script. */
export interface Project {
  game: GameJson
  ontology: Sourced<OntologyPart>[]
  rules: Sourced<Rule[]>[]
  maps: Sourced<RawChunk>[]
  people: Sourced<PersonFile>[]
  quests: Sourced<QuestDef>[]
  story: Sourced<StoryFile>[]
  catalog?: unknown
  client?: Sourced<Record<string, unknown>>[]
  learned?: Sourced<LearnedFile>[]
  /** Its translation tables (`locales/<code>.json`), a language each. */
  locales?: Sourced<LocaleFile>[]
  /** What is in the index beyond the format's own (a game's script adds its bosses, its codex). */
  extra?: Partial<WorldIndex>
}

/**
 * What the runtime, the modder and the wiki load (`bundle.json`; the world beside it in `world/index.json` and
 * `world/maps/<id>.json`, the runtime's own world format). Everything is data: another bundle is another game.
 */
export interface Bundle {
  format: typeof FORMAT
  game: { id: string; name: Text; version: string; engine?: string; modules: string[]; plugins?: string[]; languages?: { source: string; translations: string[] } }
  ontology: Ontology
  rules: Rule[]
  terrainChars: Record<string, string>
  catalog?: unknown
  client?: Record<string, unknown>
  /** The patches it ships with (its learned/ files). */
  learned?: LibraryData
}

/** A problem the compiler found: an error stops a build, a warning does not. */
export interface Problem {
  level: 'error' | 'warning'
  /** What kind (reference, size, tie, rule …): the editor's validation panel groups by it. */
  code: string
  file?: string
  /** Where in the file: a map cell, an entity, a rule. */
  at?: string
  message: string
}

export interface Compiled {
  bundle: Bundle
  index: WorldIndex
  chunks: RawChunk[]
  problems: Problem[]
}
