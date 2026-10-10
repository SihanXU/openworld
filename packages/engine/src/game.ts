// Game bootstrap: new game from a generated world index, save/load.

import { START_HOUR, TICKS_PER_HOUR, type WeatherSpan } from './calendar.ts'
import { Engine, type MapChunk } from './engine.ts'
import { ModPort } from './mod.ts'
import { Codex, type CodexData } from './codex.ts'
import { RuleLibrary, type LibraryData } from './rules.ts'
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

/** A place a new game may begin, and what the player is there (the story's stage they begin at). */
export interface StartDef {
  at: Pos
  props?: Record<string, PropValue>
  /** The hour of day 1 the game begins at here (else the world's). */
  hour?: number
  /** Statuses the player begins with, for so many ticks (out cold: one wakes). */
  statuses?: Record<string, number>
}

/** The generated world's global index (the per-map chunks are fetched lazily). */
export interface WorldIndex {
  name: Text
  /** Content version: saves from another version are discarded. */
  version: string
  seed: number
  start: Pos
  /** How the default start begins (its hour, the statuses one begins with). */
  begin?: Omit<StartDef, 'at'>
  /** Other places a new game may begin, by name (a tutorial skipped); `start` is the default. */
  starts?: Record<string, StartDef>
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
  /** The quests (quests.ts, docs/quests.md): the main line, what people offer, the radiant favours. */
  quests?: QuestDef[]
  /** Actors who come with the player from the start (the bird), placed beside the start. */
  companions?: Entity[]
  /** The teleport stones (fixture/waypoint ids), for the world map. */
  waypoints?: { id: Id; map: string; x: number; y: number; name: Text }[]
  bosses?: BossDef[]
  /** The codex's entries (codex.ts): the kinds of item and of creature it lists; its people are `companions` and `npcs`. */
  codex?: { items: string[]; creatures: string[] }
}

export interface SaveData {
  version: 1
  world?: string
  state: WorldState
  library: LibraryData
  savedAt: string
  /** What the player has come to know (codex.ts): the reader's record, beside the state. */
  codex?: CodexData
}

export class Game {
  engine: Engine
  mods: ModPort
  worldVersion?: string
  codex = new Codex()

  constructor(engine: Engine) {
    this.engine = engine
    this.mods = new ModPort(engine)
    engine.controls.magnetic = true
  }

  /** A new game, at the world's start, at one of its other starts (`start`, a name in `index.starts`), or at a start given (a playtest's cell). */
  static create(index: WorldIndex, ontology: Ontology, library: RuleLibrary, start?: string | StartDef): Game {
    const other = typeof start === 'object' ? start : start ? index.starts?.[start] : undefined
    if (start && !other) throw new Error(`no start ${start}`)
    const from: StartDef = other ?? { at: index.start, ...index.begin }
    const at = from.at
    const tick = (((from.hour ?? index.startHour ?? START_HOUR) - START_HOUR + 24) % 24) * TICKS_PER_HOUR
    const state: WorldState = {
      tick,
      seed: index.seed,
      rng: index.seed,
      player: index.player.id,
      entities: {},
      maps: {},
      loadedMaps: [],
      counter: 0,
      spawn: at,
    }
    const eng = new Engine(state, ontology, library)
    for (const m of index.maps) (eng.graph[m.id] = m.portals), (eng.maps[m.id] = { name: m.name, width: m.width, height: m.height })
    eng.ensureResidents()
    eng.author(() => {
      const player = structuredClone(index.player)
      if (from.props) player.props = { ...player.props, ...structuredClone(from.props) }
      for (const [s, ticks] of Object.entries(from.statuses ?? {})) (player.statuses ??= {})[s] = tick + ticks
      eng.world.add(player)
      for (const n of index.npcs) addTree(eng, n)
      // companions start beside the start, following the player (companion.ts)
      for (const c of index.companions ?? []) eng.world.add({ ...structuredClone(c), place: { on: 'tile', map: at.map, x: at.x - 1, y: at.y }, props: { ...c.props, companion: index.player.id } })
    })
    loadContent(eng, index)
    // a new game is news: the Story Manager begins what begins with the world
    eng.quests.news({ kind: 'begin' })
    return new Game(eng)
  }

  /** A save loaded (upgradeSave: the game's own save history, GameDef.upgradeSave). */
  static load(save: SaveData, index: WorldIndex, ontology: Ontology, library?: RuleLibrary, upgradeSave?: (eng: Engine) => void): Game {
    const lib = library ?? RuleLibrary.fromJSON(save.library)
    const eng = new Engine(save.state, ontology, lib)
    for (const m of index.maps) (eng.graph[m.id] = m.portals), (eng.maps[m.id] = { name: m.name, width: m.width, height: m.height })
    eng.ensureResidents()
    loadContent(eng, index)
    // loading is the author's: an older save is brought up to the world as it is now, and to its modules
    eng.author(() => {
      upgrade(eng, index)
      for (const m of eng.modules) m.upgrade?.(eng)
      upgradeSave?.(eng)
    })
    const game = new Game(eng)
    game.codex = Codex.from(save.codex)
    return game
  }

  /** Map terrain is static content and is re-fetched on load, so it is left out of saves. */
  save(): SaveData {
    const state = { ...this.engine.world.state, maps: {} }
    return { version: 1, world: this.worldVersion, state, library: this.engine.lib.toJSON(), savedAt: new Date().toISOString(), codex: this.codex.toJSON() }
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
  // how the player looks: their own once they have made one (a look record); a save from before looks were made
  // of parts (a sheet's key) takes the world's
  const p = w.get(s.player)
  if (p && index.player.look && typeof p.look !== 'object') p.look = structuredClone(index.player.look)
  // Old saves acquire the world's initial profession; an explicit profession is never replaced.
  if (p && p.props?.profession === undefined && index.player.props?.profession !== undefined) w.setProp(p, 'profession', index.player.props.profession)
  for (const e of Object.values(s.entities)) {
    // A save taken while an outcome was being worked out holds its participants, but the request
    // itself is not saved: nobody will answer it, so they are let go (as after a time-out).
    delete e.frozenBy
  }
  // the people the world has now that an older save has not met yet (a steward who came later): as a new game has them;
  // the ones it has met keep their own record, but where their days take them and what they are is the world's to say
  // (a trainer who now keeps his spot: his schedule, and the tags the world has added since — none taken away)
  for (const n of index.npcs) {
    const e = w.get(n.id)
    if (!e) {
      addTree(eng, n)
      continue
    }
    // how they look is the world's to say, unless the world changed it (a restyle: `own`); a sheet's key kept
    // from before looks were made of parts is the world's look now
    delete (e.npc as { look?: unknown } | undefined)?.look
    if (n.look && (typeof e.look !== 'object' || !e.look.own)) e.look = structuredClone(n.look)
    if (e.npc && n.npc) {
      e.npc.schedule = structuredClone(n.npc.schedule)
      if (e.npc.person && n.npc.person?.schedules) e.npc.person.schedules = structuredClone(n.npc.person.schedules)
    }
    for (const t of n.tags ?? []) if (!e.tags?.includes(t)) w.addTag(e, t)
    // and what the world has said of them since (their household, stance, the watch they keep, their trade):
    // what they never had, they have now; what they have, they keep
    for (const [k, v] of Object.entries(n.props ?? {})) if (e.props?.[k] === undefined) w.setProp(e, k, v)
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
  eng.story.load(index.steps)
  eng.quests.load(index.quests)
  eng.loadInvariants(index.invariants, index.protectedFacts)
  // the weather the world fixes is content, like the scenes: read on every start, never saved
  eng.world.weather = index.weather
}
