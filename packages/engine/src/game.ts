// Game bootstrap: new game from a generated world index, save/load.

import { START_HOUR, TICKS_PER_HOUR, type WeatherSpan } from './calendar.ts'
import { Engine, type MapChunk } from './engine.ts'
import { ModPort } from './mod.ts'
import { RuleLibrary, type LibraryData } from './rules.ts'
import type { Guide } from './story.ts'
import type { QuestDef } from './quests.ts'
import type { BossDef, Entity, Id, Invariant, MapData, NpcMemory, Ontology, Pos, Portal, PropValue, SceneState, StepDef, Text, WorldState } from './types.ts'
import { TOPIC_DAYS } from './world.ts'

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
  /** Where the map lies in the world (tiles, its top left), from the edge links; the world map lays maps out by it. */
  at?: { x: number; y: number }
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
  /** The story's script (story.ts, world-model.md §6.12): its scenes and its beats, steps all. */
  steps?: StepDef[]
  /** Content the world must keep playable (the `invalid` source). */
  invariants?: Invariant[]
  /** Fact-key prefixes that only the story's own rules may change (design.md §5.11). */
  protectedFacts?: string[]
  /** Spans of time whose weather the world fixes (the evening storm). */
  weather?: WeatherSpan[]
  /** The story's objectives by stage, for a companion to tell (F on it). */
  guides?: Guide[]
  /** Quests people give (quests.ts, docs/quests.md). */
  quests?: QuestDef[]
  /** Actors who come with the player from the start (the bird), placed beside the start. */
  companions?: Entity[]
  /** The teleport stones (fixture/waypoint ids), for the world map. */
  waypoints?: { id: Id; map: string; x: number; y: number; name: Text }[]
  bosses?: BossDef[]
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
      loadedMaps: [],
      counter: 0,
      spawn: index.start,
    }
    const eng = new Engine(state, ontology, library)
    for (const m of index.maps) eng.graph[m.id] = m.portals
    eng.ensureResidents()
    eng.author(() => {
      eng.world.add(structuredClone(index.player))
      for (const n of index.npcs) addTree(eng, n)
      // companions start beside the start, following the player (companion.ts)
      for (const c of index.companions ?? []) eng.world.add({ ...structuredClone(c), place: { on: 'tile', map: index.start.map, x: index.start.x - 1, y: index.start.y }, props: { ...c.props, companion: index.player.id } })
    })
    loadContent(eng, index)
    return new Game(eng)
  }

  static load(save: SaveData, index: WorldIndex, ontology: Ontology, library?: RuleLibrary): Game {
    const lib = library ?? RuleLibrary.fromJSON(save.library)
    const eng = new Engine(save.state, ontology, lib)
    for (const m of index.maps) eng.graph[m.id] = m.portals
    eng.ensureResidents()
    loadContent(eng, index)
    // loading is the author's: an older save is brought up to the world as it is now
    eng.author(() => upgrade(eng, index))
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
      this.engine.author(() => this.engine.teleport(this.engine.world.player, this.engine.world.state.spawn))
    }
  }

  /** Base terrain for a revisit after load (entities come from the save). */
  loadMapData(map: MapData): void {
    this.engine.world.state.maps[map.id] = map
    this.engine.mapArrived(map.id)
  }
}

/** An older save, brought up to the world as it is now (on loading, as its author). */
function upgrade(eng: Engine, index: WorldIndex): void {
  const w = eng.world
  // what an older save kept outside the things it belongs to (world-model.md §3)
  const s = w.state as typeof w.state & {
    lastBeat?: string
    facts?: Record<string, PropValue>
    topics?: { id: string; day: number; days?: number }[]
    memory?: Record<Id, NpcMemory>
    scene?: SceneState
    weather?: unknown
    tiles?: Record<string, { terrain?: string; statuses?: Record<string, number>; statusBy?: Record<Id, Id> }>
  }
  // how the player looks is the world's to say, not the save's (a save from before a new look gets it)
  const p = w.get(s.player)
  if (p && index.player.look) p.look = index.player.look
  // Old saves acquire the world's initial profession; an explicit profession is never replaced.
  if (p && p.props?.profession === undefined && index.player.props?.profession !== undefined) w.setProp(p, 'profession', index.player.props.profession)
  for (const e of Object.values(s.entities)) {
    // Early Iron Stomach saves used its delta as an absolute interval (faster, not slower).
    if (e.tags?.includes('skill:iron-stomach') && e.props?.hungerEvery === 150) w.setProp(e, 'hungerEvery', 450)
    // the night-born were marked by a prop before they had a tag
    if (e.props?.nightborn) (w.setProp(e, 'nightborn', undefined), w.addTag(e, 'nightborn'))
    // A save taken while an outcome was being worked out holds its participants, but the request
    // itself is not saved: nobody will answer it, so they are let go (as after a time-out).
    delete e.frozenBy
  }
  // what was the world's before it was the story's or the traveller's own: facts, the latest beat,
  // the maps seen, the reported invariants (the detector's own record), topics, memories, the scene
  for (const [k, v] of Object.entries(s.facts ?? {})) {
    if (k.startsWith('visited.')) {
      if (p && w.prop(p, k) === undefined) w.setProp(p, k, v)
    } else if (k.startsWith('invalid.')) (s.reported ??= []).push(k.slice(8))
    else w.setFact(k, v)
  }
  delete s.facts
  if (s.lastBeat) (w.setFact('step.last', s.lastBeat), delete s.lastBeat)
  for (const t of s.topics ?? []) (w.setFact(`topic.${t.id}`, t.day), w.setFact(`topic.${t.id}.days`, t.days ?? TOPIC_DAYS))
  delete s.topics
  for (const [id, m] of Object.entries(s.memory ?? {})) {
    const e = w.get(id)
    if (e?.npc) e.npc.memory = m
  }
  delete s.memory
  if (s.scene) (w.scene = s.scene), delete s.scene
  delete s.weather
  // a cell was a terrain with overrides; it is made of things (world-model.md §4.6): the overrides
  // become the cells' things when each map's data comes, and relations keyed by tile start again
  for (const [k, t] of Object.entries(s.tiles ?? {})) {
    const [map, x, y] = k.split(':')
    ;((s.legacyTiles ??= {})[map] ??= []).push({ x: +x, y: +y, ...t })
  }
  delete s.tiles
  // a beat was a step of its own kind; it is a step of the story's one script now (world-model.md §6.12)
  const story = w.story
  for (const [k, v] of Object.entries(story?.props ?? {})) {
    if (!k.startsWith('beat.')) continue
    w.setProp(story!, k, undefined)
    if (k === 'beat.last') w.setFact('step.last', v)
    else if (w.fact(`seen.${k.slice(5)}`) === undefined) w.setFact(`seen.${k.slice(5)}`, v)
  }
  // a stage's clock was a status of each kind of thing's own (world-model.md §6.5): it is the stage's now
  const clock = (bag?: Record<string, number>) => {
    for (const k of ['regrowing', 'rooting', 'laying']) if (bag && k in bag) (bag.stage = bag[k]), delete bag[k]
  }
  for (const e of Object.values(s.entities)) clock(e.statuses)
  for (const t of Object.values(s.legacyTiles ?? {})) for (const c of t) clock(c.statuses)
  if (Object.values(s.relations ?? {}).some((ks) => ks.some((k) => k.includes('|t|')))) {
    delete s.relations
    s.reseed = [...new Set([...(s.reseed ?? []), ...s.loadedMaps])]
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
  eng.bossKits = Object.fromEntries((index.bosses ?? []).map((b) => [b.id, structuredClone(b)]))
  eng.story.load(index.steps, index.guides)
  eng.quests.load(index.quests)
  eng.loadInvariants(index.invariants, index.protectedFacts)
  // the weather the world fixes is content, like the scenes: read on every start, never saved
  eng.world.weather = index.weather
}
