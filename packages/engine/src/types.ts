// Core data model of the Large Symbolic World engine.
// Everything here is plain JSON-serializable data: state, rules and patches travel
// between the engine, the client, saves and (later) the modder service.

export type Id = string
export type Text = string | { en: string; zh?: string }

export type Dir = 'up' | 'down' | 'left' | 'right'
export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

// ------------------------------------------------------------------ ontology

export type EntityKind = 'actor' | 'item' | 'fixture'

/** A node in the is-a hierarchy. Type ids are slash paths: `item/container/bucket`. */
export interface TypeDef {
  id: string
  kind: EntityKind | 'tile'
  name?: Text
  /** Tags inherited by every instance (instances may add more). */
  tags?: string[]
  /** Default properties (instances may override). */
  props?: Record<string, PropValue>
  /** Render key; resolved by the client's art layer. */
  sprite?: string
  /** Fixtures and tiles: does it block movement? */
  solid?: boolean
}

export type PropValue = number | string | boolean

export interface StatusDef {
  id: string
  name?: Text
  /** Default duration in ticks; omitted = until removed. */
  duration?: number
  /** Statuses removed when this one is applied (e.g. frozen removes burning). */
  clears?: string[]
  /** An actor with this status cannot move or act. */
  immobilize?: boolean
  /** Render hint for the client overlay. */
  overlay?: string
}

export interface TerrainDef {
  id: string // terrain id, also the tile type `tile/<id>`
  name?: Text
  tags?: string[]
  solid?: boolean
  /** Swimmable/liquid terrain: items put here are not simply dropped. */
  liquid?: boolean
  color?: string // fallback render color
}

export interface Ontology {
  types: Record<string, TypeDef>
  statuses: Record<string, StatusDef>
  terrains: Record<string, TerrainDef>
  elements: string[]
  vfx: string[]
  /** Tags an instance may carry beyond its type's (materials, qualities…); used by conflict checks. */
  instanceTags?: string[]
  /** Gift tastes everyone shares (a person's own tastes override them). */
  tastes?: Tastes
}

// ------------------------------------------------------------------ world state

export interface Pos {
  map: string
  x: number
  y: number
}

/** Where an entity is: on a tile, inside a container/inventory, or nowhere (destroyed). */
export type Place =
  | { on: 'tile'; map: string; x: number; y: number }
  | { on: 'inside'; holder: Id } // in a container's contents or an actor's inventory
  | { on: 'hand'; holder: Id } // the actor's single held-item slot
  | { on: 'none' }

export interface Entity {
  id: Id
  type: string
  name?: Text
  /** Instance tags, added to the type's tags. */
  tags?: string[]
  props?: Record<string, PropValue>
  /** status id -> expiry tick (Infinity-like = -1 means no expiry) */
  statuses?: Record<string, number>
  place: Place
  facing?: Dir
  /** Actors: current hp etc. live in props (hp, maxHp, atk, def, speed). */
  /** Ordered contents of a container or an actor's inventory. */
  contents?: Id[]
  /** Actors: the held item. */
  held?: Id
  /** NPCs: schedule + appearance + role. */
  npc?: NpcData
  /** Creatures: combat behaviour. */
  ai?: AiData
  /** Set while an undefined interaction involving this entity awaits a patch. */
  frozenBy?: string
  /** Items a rule dropped on the ground (a harvest, logs, loot): the player's magnet pulls them in. */
  dropped?: boolean
  /** The player: inventory slots (design.md §5.3), each the stack key of what it holds; row 1 is the toolbar. */
  slots?: (string | null)[]
  /** The player: the selected slot (what is held). */
  selected?: number
  /** Render hint: a character look key from the client's asset catalogue. */
  look?: string
}

export interface ScheduleEntry {
  /** Game hour window [from, to) in 0..24; may wrap past midnight. */
  from: number
  to: number
  map: string
  x: number
  y: number
  activity: string
}

export interface NpcData {
  role: string
  home?: Pos
  schedule: ScheduleEntry[]
  appearance?: Appearance
  /** Character look key (asset catalogue); preferred over `appearance` when present. */
  look?: string
  lines?: Text[]
  faction?: string
  /** A hero villager's full record (docs/game-design.md §5); crowd NPCs may have none. */
  person?: PersonData
}

// ------------------------------------------------------------------ people (data)

export type Mood = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy'

/**
 * A line and the context it is for. Keys, most specific first (people.ts resolves them):
 * topic:<id> · topic:<id>:memory_week · date:<season>_<day> · birthday · greeting:first ·
 * place:<map> · weekday:<day> · weather:<w> · hour:<morning|day|evening|night> ·
 * greeting:<stranger|acquaintance|friend|close> · default — and for gifts:
 * gift:item:<type> · gift:<loved|liked|neutral|disliked|hated> · gift:limit.
 * Slots in the text: {player} {name} {friend:<id>} {fact:<key>} {item}.
 */
export interface LineDef {
  key: string
  text: Text
  mood?: Mood
  /** said at most once to the player */
  once?: boolean
  /** only from this many hearts on (and preferred over lower variants) */
  hearts?: number
}

/**
 * A schedule variant. Keys, most specific first: date:<season>_<day> · fact:<key> (the fact is
 * truthy) · rain · storm · weekday:<day> · season:<s> · default.
 */
export interface ScheduleVariant {
  key: string
  entries: ScheduleEntry[]
}

/** Gift tastes: item type prefixes, or `tag:<tag>`. */
export interface Tastes {
  love?: string[]
  like?: string[]
  dislike?: string[]
  hate?: string[]
}

export interface PersonData {
  temperament?: { personality?: string; manner?: string; social?: string; outlook?: string }
  /** id → relation ('daughter', 'old friend' …) */
  ties?: Record<Id, string>
  birthday?: { season: string; day: number }
  tastes?: Tastes
  lines?: LineDef[]
  schedules?: ScheduleVariant[]
}

/** What a person remembers about the player. */
export interface NpcMemory {
  /** keys (or texts) of once-only and topic lines already said */
  said?: string[]
  /** the last line said, not repeated next time */
  last?: string
  /** the day they were last talked to */
  talked?: number
  gifts?: { day: number; week: number; count: number }
  /** How they took each kind of gift (item type → taste): the Social tab's gift log. */
  tasted?: Record<string, string>
}

/** Something that happened, which people may talk about while it is fresh. */
export interface Topic {
  id: string
  day: number
  /** days it stays fresh (default 4) */
  days?: number
}

export interface LetterDef {
  id: string
  /** delivered at the start of this day, or once this fact is truthy, or by a `mail` effect */
  day?: number
  fact?: string
  from?: Id
  text: Text
  items?: string[]
}

export interface Letter {
  id: string
  day: number
  read?: boolean
  /** items still attached (taken when read) */
  items?: string[]
}

/** A scripted scene (docs/game-design.md §8.6): an arrival, a heart event, a gathering. */
export interface SceneDef {
  id: string
  map: string
  when?: {
    hour?: { from: number; to: number }
    weather?: string[]
    weekday?: string[]
    facts?: Record<string, Cmp>
    hearts?: { npc: Id; gte: number }
    /** default false: a scene plays once */
    repeat?: boolean
  }
  script: SceneCmd[]
}

export type SceneCmd =
  | { say: Id | 'player'; text: Text; mood?: Mood }
  | { move: Id | 'player'; x: number; y: number }
  | { face: Id | 'player'; dir: Dir }
  | { emote: Id | 'player'; mood: Mood }
  | { wait: number }
  | { fade: 'out' | 'in' }
  | { place: Id; map: string; x: number; y: number }
  | { fact: string; value: PropValue }
  | { topic: string; days?: number }
  | { give: string }
  | { warp: string; x: number; y: number }
  /** add or remove a status on an entity (the Hearth goes out: remove 'lit') */
  | { status: Id; add?: string; remove?: string }
  /** set a prop on the player (the story's stage) */
  | { prop: string; value: PropValue }

export interface SceneState {
  id: string
  step: number
  until?: number
  waiting?: 'advance' | 'move'
  mover?: { who: Id; path: [number, number][]; next: number }
  started?: number
  /** the line waiting to be advanced (so a client that missed the say event can show it) */
  line?: { who: Id; text: Text; mood?: Mood }
}

export interface Appearance {
  skin: number // index into palettes; the art layer owns the actual colors
  hair: number
  hairStyle: number
  top: number
  bottom: number
}

export interface AiData {
  behaviour: 'melee' | 'ranged' | 'passive'
  hostile: boolean
  sight: number
  home: Pos
  state?: 'idle' | 'chase' | 'return'
  cooldown?: number
  loot?: string[] // item type ids
}

export interface MapData {
  id: string
  name: Text
  region?: string
  kind: string // town / village / wild / dungeon / interior …
  width: number
  height: number
  /** Row-major terrain ids, length = width*height. */
  terrain: string[]
  portals: Portal[]
  /** Render hints (the engine ignores them): prefab stamps, room wall frames, music, light. */
  stamps?: { key: string; x: number; y: number }[]
  rooms?: { style: string; x: number; y: number; w: number; h: number }[]
  /** The detail layer: purely visual sprites (catalog decor groups) — stones, tufts, baskets. */
  decor?: { k: string; x: number; y: number }[]
  music?: string
  light?: 'outdoor' | 'indoor' | 'dark'
  /** The collision layer: tile indices (y * width + x) that block movement whatever the terrain. */
  solid?: number[]
  /** Named spots ('square.well') for schedules, scenes and authors. */
  anchors?: Record<string, [number, number]>
}

export interface Portal {
  x: number
  y: number
  to: string // map id
  tx: number
  ty: number
  label?: Text
}

/** Mutable per-tile state layered on top of the map's base terrain. */
export interface TileState {
  terrain?: string // override
  statuses?: Record<string, number>
}

export interface WorldState {
  tick: number
  seed: number
  rng: number // PRNG state
  player: Id
  entities: Record<Id, Entity>
  /** Loaded maps' base data (static) keyed by id. */
  maps: Record<string, MapData>
  /** Tile overrides: `${map}:${x}:${y}` -> state. */
  tiles: Record<string, TileState>
  /** Maps whose entity chunk has been merged into `entities`. */
  loadedMaps: string[]
  counter: number // id allocator
  /** Where the player respawns. */
  spawn: Pos
  /** World facts (docs/game-design.md §8.1): `hearth.stage`, `bridge.east.fixed`, `met.npc.maren` … */
  facts?: Record<string, PropValue>
  topics?: Topic[]
  /** What each person remembers about the player. */
  memory?: Record<Id, NpcMemory>
  mailbox?: Letter[]
  scene?: SceneState
  /** A yes/no question waiting for the player (Action: "Eat the apple?"); time stops while it is open. */
  question?: { text: Text; plan: Plan }
  /** Days whose weather the world fixes. */
  weather?: Record<number, string>
}

// ------------------------------------------------------------------ events & interactions

export type Verb = 'take' | 'put' | 'interact'

/** A reference to anything that can fill an event role: an entity or a map tile. */
export type Ref = { e: Id } | { tile: Pos }

/**
 * What one of the player's two keys will do (design.md §5.2), chosen by dry runs through the
 * rule library: the HUD shows its label before the key is pressed, and pressing runs it.
 */
export interface Plan {
  /** The input: E (hands), F (take), left click (use), right click (put). */
  key: 'hands' | 'take' | 'use' | 'put'
  /** The tile aimed at. */
  at: Pos
  /** A swing or a cast toward `at` (weapons, wands) instead of an interaction. */
  attack?: boolean
  verb?: Verb
  target: Ref
  /** The instrument: the held item, or none (talking while holding a tool). */
  instrument?: Ref
  label: Text
  rule?: string
  /** No rule answers yet — the world has never seen this (an experiment). */
  unknown?: boolean
  /** Fallback rules (catch-all descriptions) do not count (hands and use). */
  strict?: boolean
  /** Ask first ("Eat the apple?", "Sleep until morning?"). */
  confirm?: Text
  /** Hands on a container: open the transfer panel for it. */
  panel?: Id
}

export type EventKind =
  | 'interaction' // a player/NPC verb
  | 'hit' // an attack landed
  | 'status' // a status was just applied (roles.target = subject)
  | 'expire' // a status just ran out
  | 'tick' // periodic, for subjects that carry statuses
  | 'enter' // an actor stepped onto a tile
  | 'defeat' // an actor's hp reached 0

export interface GameEvent {
  kind: EventKind
  verb?: Verb
  roles: { actor?: Ref; target?: Ref; instrument?: Ref }
  /** hit: element + power; status/expire/tick: the status id. */
  element?: string
  power?: number
  status?: string
  at?: Pos
  tick?: number
  /** The player's Use key: fallback rules (catch-all descriptions) do not define it. */
  strict?: boolean
}

// ------------------------------------------------------------------ rules

/** Selects the entity or tile filling a role. All given constraints must hold. */
export interface Selector {
  /** `tile`, `actor`, `item`, `fixture`. */
  kind?: EntityKind | 'tile'
  /** Is-a match against the type hierarchy (prefix on slash paths). */
  type?: string
  /** All of these tags. */
  tags?: string[]
  /** None of these tags. */
  notTags?: string[]
  /** All of these statuses. */
  status?: string[]
  /** None of these statuses. */
  notStatus?: string[]
  /** Property comparisons. */
  props?: Record<string, Cmp>
  /** Instance-bound (discouraged for patches). */
  id?: Id
  /** The role must be empty (e.g. `instrument: { none: true }` = empty-handed). */
  none?: boolean
  /** The role is the player. */
  player?: boolean
}

export type Cmp =
  | PropValue
  | { eq?: PropValue; ne?: PropValue; gt?: number; gte?: number; lt?: number; lte?: number }

export type RoleName = 'actor' | 'target' | 'instrument'

export interface Pattern {
  verb?: Verb[]
  actor?: Selector
  target?: Selector
  instrument?: Selector
  /** hit events: the attack's element(s). `none` matches element-less hits. */
  element?: string[]
  /** status/expire/tick events: which status. */
  status?: string[]
}

/** A number, or a numeric property read from a role at match time. */
export type Operand = number | { prop: string; of: RoleName }

/** Numeric bounds whose limits may be read from roles. A missing property fails the test. */
export interface Bounds {
  eq?: Operand
  gt?: Operand
  gte?: Operand
  lt?: Operand
  lte?: Operand
}

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { has: { role: RoleName; status?: string; tag?: string } }
  | { prop: { role: RoleName; key: string; cmp: Cmp } }
  | { chance: number }
  | { hour: { from: number; to: number } }
  /** How many entities (matching `match`) are in a role's contents, or on its tile besides itself. */
  | { count: { role: RoleName; in: 'contents' | 'tile'; match?: Selector; cmp: Bounds } }
  /** A world fact compared to a value (a missing fact is 0 / false). */
  | { fact: { key: string; cmp: Cmp } }
  /** Something that happened is still fresh. */
  | { topic: string }
  /** The calendar: weekday, weather, season, a day range. */
  | { calendar: { weekday?: string[]; weather?: string[]; season?: string[]; day?: { gte?: number; lte?: number } } }
  /** The player's friendship with a person (in hearts). */
  | { hearts: { role: RoleName; cmp: Cmp } }

/** An argument that names a role, or a tile relative to a role. */
export type RoleRef = RoleName | 'tileOf:actor' | 'tileOf:target' | 'tileOf:instrument'

export type Amount = number | 'power' | { prop: string; of: RoleName; mul?: number; add?: number }

export type Effect =
  | { op: 'spawn'; type: string; at: RoleRef; into?: 'tile' | 'contents' | 'hand'; count?: Amount }
  | { op: 'destroy'; of: RoleRef }
  | { op: 'transform'; of: RoleRef; into: string }
  | { op: 'moveTo'; of: RoleRef; to: RoleRef; into?: 'tile' | 'contents' | 'hand' }
  | { op: 'addStatus'; of: RoleRef; status: string; duration?: number }
  | { op: 'removeStatus'; of: RoleRef; status: string }
  | { op: 'setProp'; of: RoleRef; key: string; value: PropValue }
  | { op: 'addProp'; of: RoleRef; key: string; delta: number; min?: number; max?: number }
  | { op: 'addTag'; of: RoleRef; tag: string }
  | { op: 'removeTag'; of: RoleRef; tag: string }
  | { op: 'damage'; of: RoleRef; amount: Amount; element?: string; mul?: number; pierce?: boolean }
  | { op: 'heal'; of: RoleRef; amount: Amount }
  | { op: 'setTerrain'; of: RoleRef; terrain: string }
  | {
      op: 'spread'
      from: RoleRef
      status: string
      radius: number
      chance?: number
      /** Only tiles/entities matching this receive it. */
      filter?: Selector
      /** Also emit a hit with this element/power on actors reached. */
      hit?: { element?: string; power: number }
    }
  | { op: 'hit'; of: RoleRef; element?: string; power: Amount; by?: RoleRef }
  | { op: 'push'; of: RoleRef; away: RoleRef; tiles: number }
  | { op: 'vfx'; at: RoleRef; fx: string }
  | { op: 'say'; who: RoleRef; text: Text }
  | { op: 'log'; text: Text }
  | { op: 'open'; of: RoleRef } // containers: toggle open/closed
  | { op: 'dropContents'; of: RoleRef } // spill contents onto the tile (loot, broken crates)
  | { op: 'setFact'; key: string; value: PropValue }
  | { op: 'addFact'; key: string; delta: number }
  | { op: 'topic'; id: string; days?: number }
  | { op: 'befriend'; who: RoleRef; amount: number; daily?: boolean }
  | { op: 'gift'; to: RoleRef; item: RoleRef }
  | { op: 'sleep' }
  | { op: 'mail'; id: string }
  | { op: 'scene'; id: string }

export interface RuleTest {
  name?: string
  given: Scenario
  expect: Expectation[]
}

/** A minimal self-contained world used for sandbox replay and rule tests. */
export interface Scenario {
  /** Terrain rows around the origin; default a 5x5 grass patch. */
  terrain?: string[][]
  entities: ScenarioEntity[]
  /** Simulation ticks to run after the event (for spreading/expiry). */
  ticks?: number
  /** The interaction/event to replay. Roles refer to scenario entity keys or `tile:x,y`. */
  event: {
    kind?: EventKind
    verb?: Verb
    actor?: string
    target?: string
    instrument?: string
    element?: string
    power?: number
    /** The player's Use key: fallback rules do not define the event. */
    strict?: boolean
    status?: string
  }
}

export interface ScenarioEntity {
  key: string
  type: string
  x: number
  y: number
  tags?: string[]
  statuses?: string[]
  props?: Record<string, PropValue>
  /** Held by / inside another scenario entity. */
  heldBy?: string
  inside?: string
}

export type Expectation =
  | { key: string; hasStatus: string }
  | { key: string; lacksStatus: string }
  | { key: string; isType: string }
  | { key: string; destroyed: true }
  | { key: string; exists: true }
  | { key: string; propGt: [string, number] }
  | { key: string; propLt: [string, number] }
  | { tile: [number, number]; terrain: string }
  | { tile: [number, number]; hasStatus: string }
  | { spawned: string } // some entity of this type now exists

export interface Provenance {
  origin: 'base' | 'patch'
  request?: string
  author?: string
  at?: string // ISO timestamp
  note?: string
}

export interface Rule {
  id: string
  on: EventKind
  when: Pattern
  guard?: Cond
  do: Effect[]
  priority?: number
  /** Runs alongside more specific rules instead of being shadowed by them. */
  compose?: boolean
  /**
   * A catch-all description ("It is a well."): it answers when nothing else does, but the
   * player's Use key does not count it as defining the interaction (design.md §5.4, source 4).
   */
  fallback?: boolean
  /** Ask the player first when chosen by the Action key ("Sleep until morning?"); slots {instrument} {target}. */
  confirm?: Text
  tests?: RuleTest[]
  source?: Provenance
  /** Human-readable summary. */
  doc?: string
}

// ------------------------------------------------------------------ outputs to the client

export type FxEvent =
  | { t: 'vfx'; fx: string; map: string; x: number; y: number }
  | { t: 'say'; who: Id; text: Text; mood?: Mood; scene?: boolean }
  | { t: 'emote'; who: Id; mood: Mood }
  | { t: 'sleep'; day: number }
  | { t: 'letter'; id: string }
  | { t: 'fade'; dir: 'out' | 'in' }
  | { t: 'strike'; map: string; x: number; y: number }
  | { t: 'log'; text: Text; tone?: 'info' | 'warn' | 'ai' | 'good' | 'bad' }
  | { t: 'damage'; who: Id; amount: number; element?: string }
  | { t: 'undefined'; request: string; summary: string }
  | { t: 'patched'; request: string; rule: string }
  | { t: 'mapChanged'; map: string }
  /** The magnet pulled a dropped item into the player's bag (from its tile). */
  | { t: 'pickup'; item: Id; sprite: string; name: Text; map: string; x: number; y: number }
