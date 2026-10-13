// The game this runtime plays (docs/engine-split.md, P1). The runtime imports no game: a game's own entries
// (its pages and its worker) hand its definition over with useGame() first, and the runtime reads the
// game's content only through game(). No module reads it at its top level, so the order the modules load in
// does not matter, only that useGame() comes before the first frame.

import type { Entity, Game, GameDef, Look, LookBodyDef, LookColorDef, LookPartDef, LookTable, MapChunk, Ontology, PlacementRecipe, Pos, PropValue, Recipe, SkillDef, Text, World, WorldIndex } from '@openworld/engine'
import type { ProfessionDef } from '@openworld/modules'
import type { Catalog } from './assets/types.ts'
import type { PanelFactory } from './ui/panels.ts'

type Words = { en: string; zh: string }

/** A kind of item as the panels show it: a form of the game's item catalogue. */
export interface FormInfo {
  id: string
  en: string
  zh: string
  sprite: string
  tags?: string[]
  props?: Record<string, PropValue>
}

/** A side of the skill tree (combat, life). */
export interface SkillDirectionDef {
  id: string
  icon: string
  name: Words
}

export interface SkillBranchDef {
  id: string
  direction: string
  icon: string
  name: Words
}

/** A profession as its card shows it. */
export type ProfessionCard = ProfessionDef & { icon: string; name: Words }

export interface BoonInfo {
  id: string
  name: Text
  doc: Text
}

/** A shelf of a shop (the shop panel's tab): its recipes' group, its name, and whether it buys from the player (its offers are sold, not bought). */
export interface ShelfDef {
  group: string
  name: Text
  sell?: boolean
}

/** A shop: a station whose offers are recipes, grouped on shelves; its name heads the panel. */
export interface ShopDef {
  station: string
  name?: Text
  shelves: ShelfDef[]
}

/** A part of a look, as the creator offers it (a part only a worn thing brings is never offered). */
export interface LookPartInfo extends LookPartDef {
  gen?: { worn?: boolean }
}

/** A button of the dev console's World tab: a place to go, or a boss to set down there. */
export interface DevShortcut {
  label: string
  debug: { op: 'teleport'; map: string; x: number; y: number } | { op: 'summon'; kit: string; map: string; x: number; y: number; from: [number, number] }
}

/** What the title screen shows of the game. */
export interface CoverDef {
  /** The title, the line above it, the line below it (default: the game's name and nothing). */
  title?: Text
  kicker?: Text
  subtitle?: Text
  /** The game has a tutorial run of its own (a start named `tutorial` in its world). */
  tutorial?: boolean
  /** A page of the game's beside the player, offered on the cover (the boss challenge). */
  challenge?: { label: Text; href: string }
  /** The game's own art behind the title (the mountain at dawn), and its companion flying across: the sheet it is drawn from (in the game's assets/; true: OpenWorld's fairy). */
  art?: boolean
  companion?: boolean | string
  /** The line of credits at the foot of the cover (default: the pack's; false: none). */
  credit?: Text | false
}

export interface ClientGame extends GameDef {
  /** Sprites, sounds and music by the content's keys. */
  catalog: Catalog
  /** Where its pictures and sounds are (default: the page's `assets/`), and its world files (default: the page's `world/`). */
  assets?: string
  world?: string
  /** Where its saves and its learned library are kept in the browser (default: its id). */
  saves?: string
  cover?: CoverDef
  /** A place made by seed rather than read from a map file (the wilderness); none: every map is a file. */
  wild?(w: World, id: string): MapChunk | undefined
  /** A save made before the world last changed, brought up to it on loading (as the author). */
  upgrade?(game: Game, ctx: { index: WorldIndex; chunk(id: string): Promise<MapChunk> }): Promise<void>
  /** A new game: marks it as already the world as it is now, so no upgrade is due (as the author). */
  fresh?(game: Game): void
  /** The dev console's summon: a boss kit's body at a place, and what the log says. */
  summon?(kit: string, at: Pos, id: string): { body: Entity; say?: Text }
  dev?: { shortcuts: DevShortcut[] }
  /** The interface's words the game says its own way, by the runtime's key (ui/common.ts STRINGS): a module's panel speaking of the game's people and places. */
  texts?: Record<string, Text>
  items: {
    forms: Record<string, FormInfo>
    materials: Record<string, Words>
    /** The unique pieces' names and lore. */
    relics: Record<string, Words & { text: Words }>
    /** The Vowbound pieces' vows (`vow`): each one's name and what it does. */
    vows?: Record<string, Words & { text: Words }>
    /** The money's item type. */
    coin: string
  }
  crafting: {
    recipes: Recipe[]
    stationName(station: string): Words
    /** Shops: a station whose offers are recipes (grouped on shelves, the shop panel's tabs). None: no shop panel. */
    shops?: ShopDef[]
    /** Everything the build palette places: buildings and the farm's work. */
    placements: PlacementRecipe[]
    buildings: PlacementRecipe[]
  }
  skills: {
    all: SkillDef[]
    directions: readonly SkillDirectionDef[]
    branches: SkillBranchDef[]
    professions: ProfessionCard[]
    /** The branches a profession's tree shows (its own branch named for it). */
    branchesFor(profession: string): SkillBranchDef[]
    /** The skills open to a profession: the common ones and its own. */
    forProfession(profession: string): SkillDef[]
  }
  boons: Record<string, BoonInfo>
  /**
   * The game's own panels (ui/panels.ts), by the key a rule's `panel` effect opens them with (the fx's `by`: the host
   * whose rule did): OpenWorld's companion and its home ground's widenings. A key here replaces the runtime's own panel
   * for it (the boons module's `boons`). Code, not data: a bundle's game gets them from its plugin.
   */
  panels?: Record<string, PanelFactory>
  looks: {
    table: LookTable
    slots: readonly string[]
    /** The slots worn things fill (never chosen in the creator). */
    worn: Set<string>
    bodies: Record<string, LookBodyDef>
    colors: Record<string, LookColorDef>
    parts: Record<string, LookPartInfo>
    /** The traveller a new game starts as, before the creator changes them. */
    player: Look
    generate(seed: string, who: { sex: 'female' | 'male'; age: number; role?: string }, given?: { body?: string; parts?: Record<string, string | null>; colors?: Record<string, string> }): Look
    describe(look: Look, who?: { age?: number }): Words
  }
}

let current: ClientGame | undefined
let worker: (() => Worker) | undefined
const made = new Map<string, unknown>()

/** Hand the game over: a game's entry calls this before the runtime draws or plays anything. */
export function useGame(g: ClientGame): void {
  current = g
  made.clear()
}

/** The game handed over, if one is yet (what the interface's words read before a game is chosen). */
export const gameIfAny = (): ClientGame | undefined => current

export function game(): ClientGame {
  if (!current) throw new Error('no game: a game\'s entry hands its definition over with useGame() before the runtime starts')
  return current
}

/** The game's worker entry, which hands the game over in the worker too: the page that plays the game sets it. */
export function useWorker(make: () => Worker): void {
  worker = make
}

export function newWorker(): Worker {
  if (!worker) throw new Error('no worker: the page that plays the game names its worker entry with useWorker()')
  return worker()
}

/** Made once per game and kept: what the runtime derives from the game's lists (a lookup, a palette). */
export function perGame<T>(key: string, make: () => T): T {
  if (!made.has(key)) made.set(key, make())
  return made.get(key) as T
}

/** Does the game use this engine module (its ontology names it)? A module's panels show only then. */
export const hasModule = (id: string): boolean => perGame('modules', () => new Set(ontology().modules ?? [])).has(id)

/** Does the game make looks (docs/looks.md: a look table of bodies)? Without one, people are drawn from the catalogue's sheets by their role. */
export const hasLooks = (): boolean => perGame('hasLooks', () => Object.keys(game().looks.bodies).length > 0)

/** Where the game's pictures and sounds are, and its world files: absolute URLs ending in '/'. */
/** The page's base (vite's BASE_URL; './' where there is no page bundler, a tool in node). */
const pageBase = (): string => (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './'
/** The page's own URL (a tool or a test in node has none). */
export const pageUrl = (): string => (typeof location === 'undefined' ? 'http://localhost/' : location.href)
export const assetsBase = (): string => perGame('assets', () => new URL(game().assets ?? `${pageBase()}assets/`, pageUrl()).href)
export const worldBase = (): string => perGame('world', () => new URL(game().world ?? `${pageBase()}world/`, pageUrl()).href)
/** The browser's keeping of this game's saves and library. */
export const savesKey = (): string => game().saves ?? game().id
export const libraryKey = (): string => (savesKey() === 'world' ? 'library' : `library:${savesKey()}`)

const byId = <T extends { id: string }>(list: readonly T[]): Record<string, T> => Object.fromEntries(list.map((x) => [x.id, x]))

export const catalog = (): Catalog => game().catalog
/** The game's ontology, built once per thread: what the runtime reads (its terrains' colours, its types). */
export const ontology = (): Ontology => perGame('ontology', () => game().ontology())
export const skillById = (): Record<string, SkillDef> => perGame('skills', () => byId(game().skills.all))
export const professionById = (): Record<string, ProfessionCard> => perGame('professions', () => byId(game().skills.professions))
export const recipeById = (): Record<string, Recipe> => perGame('recipes', () => byId(game().crafting.recipes))
export const placementById = (): Record<string, PlacementRecipe> => perGame('placements', () => byId(game().crafting.placements))
