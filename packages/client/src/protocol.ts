// Messages between the main thread (render + UI) and the engine Worker.

import type { Dir, Frame, Key, LibraryData, MapData, ModSpec, Patch, Rule, SaveData, Text, UndefinedRecord, ValidationResult, WorldIndex } from '@lsw/engine'

/** A tile the mouse points at (the keys aim there when it is next to the player). */
export type Tile = { x: number; y: number }

export type ToWorker =
  | { t: 'init'; base: string; save?: SaveData; library?: LibraryData; /** the modder service, if any */ modder?: string }
  /** Hold a direction (null: stop); `walk`: Shift, slower than the default run. */
  | { t: 'move'; dir: Dir | null; walk?: boolean }
  /** One of the four inputs (design.md §5.2): E hands, F take, left click use, right click put; on a chosen layer of the tile. */
  | { t: 'key'; key: Key; tile?: Tile; layer?: number }
  /** The same on an item in the bag or in the open chest (the inventory's context menu). */
  | { t: 'keyOnItem'; key: Key; item: string }
  /** The layer chooser (a long press): what each layer of the tile would give. */
  | { t: 'choices'; key: Key; tile?: Tile }
  /** Where the mouse points (for the key labels). */
  | { t: 'aim'; tile?: Tile }
  | { t: 'answer'; yes: boolean }
  /** Slots: select (toolbar), cycle (wheel), next row (Tab), swap (menu), drop (out of the menu), organize. */
  | { t: 'select'; slot: number }
  | { t: 'cycle'; dir: 1 | -1 }
  | { t: 'row' }
  | { t: 'swap'; a: number; b: number }
  | { t: 'drop'; slot: number; all: boolean }
  | { t: 'organize' }
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
  | { t: 'readMail'; id: string }
  | { t: 'debug'; op: 'teleport'; map?: string; x: number; y: number }
  | { t: 'debug'; op: 'give'; type: string; tags?: string[] }
  | { t: 'debug'; op: 'hour'; hour: number }

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
  | { t: 'ready'; stats: WorldIndex['stats']; name: WorldIndex['name']; resumed: boolean }
  | { t: 'map'; map: MapData }
  | { t: 'frame'; frame: Frame; perf: { tickMs: number; entities: number; loaded: number } }
  | { t: 'records'; records: RecordView[]; library: LibraryView }
  | { t: 'spec'; spec: ModSpec }
  | { t: 'validation'; id?: string; result: ValidationResult }
  | { t: 'saved'; save: SaveData; library: LibraryData }
  /** The library changed (a patch was accepted or removed): keep it at once, not at the next save. */
  | { t: 'library'; library: LibraryData }
  | { t: 'loading'; what: string }
  /** The layer chooser's list for a key at a tile. */
  | { t: 'choices'; key: Key; tile?: Tile; list: { layer: number; name: Text; label?: Text; unknown?: boolean }[] }
  | { t: 'modder'; online: boolean; url?: string; model?: string | null }
  | { t: 'error'; message: string }
