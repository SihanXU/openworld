// Messages between the main thread (render + UI) and the engine Worker.

import type { Aim, CodexView, Difficulty, Dir, Frame, Key, LibraryData, MapData, ModSpec, Patch, PixelArt, PlacementPreview, Rule, SaveData, Text, UndefinedRecord, ValidationResult, WorldIndex } from '@lsw/engine'

/** Where the mouse points: its tile, and what is drawn at the point, top first (the keys act there when it is next to the player). */
export type Tile = Aim

export type ToWorker =
  | { t: 'init'; base: string; save?: SaveData; library?: LibraryData; /** the modder service, if any */ modder?: string; /** false: no prefetch (?prefetch=0) */ prefetch?: boolean; /** a new game's difficulty */ difficulty?: Difficulty; /** where a new game begins: one of the world's other starts (the tutorial skipped) */ start?: string }
  /** The one at the keys, fallen, rises again: where they fell, or at home (the death screen). */
  | { t: 'respawn'; home: boolean }
  /** Hold a direction (null: stop); `walk`: Shift, slower than the default run. */
  | { t: 'move'; dir: Dir | null; walk?: boolean }
  /** Q: dash (the skill), the way the player faces. */
  | { t: 'dash' }
  /** Space: strike ahead with the held weapon (or a fist), again and again while it is held. */
  | { t: 'attack'; on: boolean }
  /** One of the four inputs (design.md §5.2): E hands, F take, left click use, right click put; on a chosen layer of the tile. */
  | { t: 'key'; key: Key; tile?: Tile; layer?: number }
  /** The same on an item in the bag or in the open chest (the inventory's context menu). */
  | { t: 'keyOnItem'; key: Key; item: string }
  /** The layer chooser (a long press): what each layer of the tile would give. */
  | { t: 'choices'; key: Key; tile?: Tile }
  /** Where the mouse points (for the key labels). */
  | { t: 'aim'; tile?: Tile }
  /** A panel opened (the bag, crafting, the build palette, the map) or a choice made from the chooser: the story notes it, for a lesson that waits on it. */
  | { t: 'ui'; what: string }
  /** Esc held: the lesson at hand is skipped. */
  | { t: 'lessonSkip' }
  | { t: 'buildAim'; id?: string; tile?: Tile; /** in the ceiling over the tile (a floor, R in the palette) */ up?: boolean }
  | { t: 'build'; id: string; tile: Tile; /** the palette's turn (R): stairs go up this way */ facing?: Dir; /** the palette's turn (R) for a floor: laid in the ceiling over the tile */ up?: boolean }
  | { t: 'answer'; yes: boolean }
  /** Slots: select (toolbar), cycle (wheel), next row (Tab, Shift+Tab back), swap and quick move (menu), drop (out of the menu), organize. */
  | { t: 'select'; slot: number }
  | { t: 'cycle'; dir: 1 | -1 }
  | { t: 'row'; dir: 1 | -1 }
  | { t: 'swap'; a: number; b: number }
  | { t: 'quickMove'; slot: number }
  | { t: 'drop'; slot: number; all: boolean }
  | { t: 'organize' }
  /** The off hand: wear a carried item there (a shield), or take off what is worn (no item). */
  | { t: 'wear'; item?: string }
  /** The crafting panel: make a recipe from what is carried. */
  | { t: 'craft'; id: string; /** as many as what is carried makes */ all?: boolean }
  /** The skill tree: spend skill points on a skill. */
  | { t: 'learn'; id: string }
  /** Take up (or change to) a profession at a trainer. */
  | { t: 'profession'; id: string }
  /** The companion carries another of its boons (only beside a woken waypoint). */
  | { t: 'boon'; id: string }
  /** The world map: what has been seen of the world (answered by `atlas`). */
  | { t: 'atlas' }
  /** The codex: every entry, the met ones marked (answered by `codex`). */
  | { t: 'codex' }
  /** Travel to an attuned waypoint stone (from the world map). */
  | { t: 'travel'; waypoint: string }
  /** The chest panel. */
  | { t: 'transfer'; from: 'chest' | 'bag'; item: string; all: boolean }
  | { t: 'closePanel' }
  /** Time stops while a menu, a dialogue or a question is open. */
  | { t: 'pause'; on: boolean }
  | { t: 'patch'; id?: string; patch: Patch }
  | { t: 'dismiss'; id: string }
  | { t: 'removeRule'; id: string }
  | { t: 'spec' }
  | { t: 'save' }
  | { t: 'newGame' }
  | { t: 'advance' }
  | { t: 'debug'; op: 'teleport'; map?: string; x: number; y: number }
  | { t: 'debug'; op: 'give'; type: string; tags?: string[] }
  | { t: 'debug'; op: 'hour'; hour: number }
  /** Harm the one at the keys (as a blow nobody struck): to try a fall and the death screen. */
  | { t: 'debug'; op: 'hurt'; amount: number }

export interface RecordView {
  id: string
  tick: number
  status: UndefinedRecord['status']
  summary: string
  request: UndefinedRecord['request']
  diagnostics?: string[]
  rules?: string[]
  patch?: Patch
}

export interface LibraryView {
  version: number
  base: number
  patches: Rule[]
  counts: Record<string, number>
}

export type FromWorker =
  | { t: 'placement'; preview: PlacementPreview }
  | { t: 'ready'; stats: WorldIndex['stats']; name: WorldIndex['name']; resumed: boolean }
  | { t: 'map'; map: MapData }
  | { t: 'frame'; frame: Frame; perf: { tickMs: number; entities: number; loaded: number }; /** the codex's version: something new was met */ codex: number }
  | { t: 'records'; records: RecordView[]; library: LibraryView }
  | { t: 'spec'; spec: ModSpec }
  | { t: 'validation'; id?: string; result: ValidationResult }
  | { t: 'saved'; save: SaveData; library: LibraryData; summary: SaveSummary }
  /** The library changed (a patch was accepted or removed): keep it at once, not at the next save. */
  | { t: 'library'; library: LibraryData }
  | { t: 'loading'; what: string }
  /** The layer chooser's list for a key at a tile. */
  | { t: 'choices'; key: Key; tile?: Tile; list: { layer: number; name: Text; label?: Text; unknown?: boolean }[] }
  | { t: 'modder'; online: boolean; url?: string; model?: string | null }
  /** The pictures of things the world learned (types a patch introduced): drawn as textures `art:<id>`. */
  | { t: 'art'; arts: { id: string; art: PixelArt }[] }
  /** The modder is making things the world does not have yet; the act waits for them. */
  | { t: 'creating'; names: Text[] }
  | { t: 'error'; message: string }
  /** The world map's data: the visited maps where they lie, their terrain, the waypoint stones. */
  | { t: 'atlas'; atlas: Atlas }
  | { t: 'codex'; codex: CodexView }

export interface AtlasMap {
  id: string
  name: Text
  /** Top left in world tiles (MapMeta.at); maps without one are not drawn. */
  at: { x: number; y: number }
  width: number
  height: number
  /** Row-major terrain ids. */
  terrain: string[]
}

export interface Atlas {
  maps: AtlasMap[]
  waypoints: { id: string; map: string; x: number; y: number; name: Text; attuned: boolean }[]
  here: { map: string; x: number; y: number }
}

/** What a save slot shows without loading it: where, when, how far. */
export interface SaveSummary {
  map: Text
  day: number
  hour: number
  minute: number
  level: number
  /** The story's stages (the objective is looked up from them). */
  prologue: number
  quest: number
  difficulty?: Difficulty
  /** A hardcore game whose one life is spent: kept as it ended, never played on. */
  ended?: boolean
}
