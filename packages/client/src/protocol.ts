// Messages between the main thread (render + UI) and the engine Worker.

import type { Dir, Frame, LibraryData, MapData, ModSpec, Patch, Rule, SaveData, UndefinedRecord, ValidationResult, Verb, WorldIndex } from '@lsw/engine'

export type ToWorker =
  | { t: 'init'; base: string; save?: SaveData; library?: LibraryData; /** the modder service, if any */ modder?: string }
  | { t: 'move'; dir: Dir | null }
  | { t: 'act'; verb: Verb; self?: boolean; item?: string }
  | { t: 'attack' }
  | { t: 'hold'; item?: string }
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
  | { t: 'loading'; what: string }
  | { t: 'modder'; online: boolean; url?: string; model?: string | null }
  | { t: 'error'; message: string }
