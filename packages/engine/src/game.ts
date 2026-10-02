// Game bootstrap: new game from a generated world index, save/load.

import { START_HOUR, TICKS_PER_HOUR, type WeatherSpan } from './calendar.ts'
import { Engine, type MapChunk } from './engine.ts'
import { ModPort } from './mod.ts'
import { RuleLibrary, type LibraryData } from './rules.ts'
import type { Entity, Invariant, MapData, Ontology, Pos, Portal, SceneDef, Text, WorldState } from './types.ts'

export interface MapMeta {
  id: string
  name: Text
  kind: string
  region?: string
  width: number
  height: number
  portals: Portal[]
  npcs: number
  items: number
}

/** The generated world's global index (the per-map chunks are fetched lazily). */
export interface WorldIndex {
  name: Text
  /** Content version: saves from another version are discarded. */
  version: string
  seed: number
  start: Pos
  /** The hour of day 1 a new game begins at (default 06:00). */
  startHour?: number
  maps: MapMeta[]
  /** NPCs are global (they travel between maps); their inventories ride along. */
  npcs: Entity[]
  player: Entity
  stats: { maps: number; npcs: number; creatures: number; items: number; itemKinds: number; fixtures: number }
  /** Scripted scenes (the arrival, the ferry, the far bank). */
  scenes?: SceneDef[]
  /** Content the world must keep playable (the `invalid` source). */
  invariants?: Invariant[]
  /** Fact-key prefixes that only the story's own rules may change (design.md §5.8). */
  protectedFacts?: string[]
  /** Spans of time whose weather the world fixes (the evening storm). */
  weather?: WeatherSpan[]
}

export interface SaveData {
  version: 1
  world?: string
  state: WorldState
  library: LibraryData
  savedAt: string
}

export class Game {
  engine: Engine
  mods: ModPort
  worldVersion?: string

  constructor(engine: Engine) {
    this.engine = engine
    this.mods = new ModPort(engine)
    engine.controls.magnetic = true
  }

  static create(index: WorldIndex, ontology: Ontology, library: RuleLibrary): Game {
    const state: WorldState = {
      tick: (((index.startHour ?? START_HOUR) - START_HOUR + 24) % 24) * TICKS_PER_HOUR,
      seed: index.seed,
      rng: index.seed,
      player: index.player.id,
      entities: {},
      maps: {},
      tiles: {},
      loadedMaps: [],
      counter: 0,
      spawn: index.start,
      weather: index.weather,
    }
    const eng = new Engine(state, ontology, library)
    for (const m of index.maps) eng.graph[m.id] = m.portals
    eng.world.add(structuredClone(index.player))
    for (const n of index.npcs) addTree(eng, n)
    loadContent(eng, index)
    return new Game(eng)
  }

  static load(save: SaveData, index: WorldIndex, ontology: Ontology, library?: RuleLibrary): Game {
    const lib = library ?? RuleLibrary.fromJSON(save.library)
    const eng = new Engine(save.state, ontology, lib)
    for (const m of index.maps) eng.graph[m.id] = m.portals
    loadContent(eng, index)
    return new Game(eng)
  }

  /** Map terrain is static content and is re-fetched on load, so it is left out of saves. */
  save(): SaveData {
    const state = { ...this.engine.world.state, maps: {} }
    return { version: 1, world: this.worldVersion, state, library: this.engine.lib.toJSON(), savedAt: new Date().toISOString() }
  }

  /** Needed chunk ids: the start map on a new game, or the map a pending transition waits for. */
  neededMaps(): string[] {
    const s = this.engine.world.state
    const need: string[] = []
    const pm = this.engine.world.posOf(this.engine.world.player)?.map ?? s.spawn.map
    if (!s.maps[pm]) need.push(pm)
    const t = this.engine.pendingTransition?.map
    if (t && !s.maps[t]) need.push(t)
    return need
  }

  loadChunk(chunk: MapChunk): void {
    const first = !this.engine.world.posOf(this.engine.world.player)
    this.engine.loadChunk(chunk)
    this.engine.npcs.invalidate()
    if (first && chunk.map.id === this.engine.world.state.spawn.map) {
      this.engine.teleport(this.engine.world.player, this.engine.world.state.spawn)
    }
  }

  /** Base terrain for a revisit after load (entities come from the save). */
  loadMapData(map: MapData): void {
    this.engine.world.state.maps[map.id] = map
  }
}

/** NPC entities carry their inventory inline as `_items` in the index. */
function addTree(eng: Engine, e: Entity & { _items?: Entity[] }): void {
  const { _items, ...rest } = e
  eng.world.add(structuredClone(rest) as Entity)
  for (const it of _items ?? []) eng.world.add(structuredClone(it))
}

/** Scenes and invariants are content: read from the world on every start (they are not saved). */
function loadContent(eng: Engine, index: WorldIndex): void {
  eng.scenes.load(index.scenes)
  eng.loadInvariants(index.invariants, index.protectedFacts)
  if (index.weather && !Array.isArray(eng.world.state.weather)) eng.world.state.weather = index.weather
}
