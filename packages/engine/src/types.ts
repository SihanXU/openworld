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
  appearance: Appearance
  lines?: Text[]
  faction?: string
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
}

// ------------------------------------------------------------------ events & interactions

export type Verb = 'take' | 'put' | 'interact'

/** A reference to anything that can fill an event role: an entity or a map tile. */
export type Ref = { e: Id } | { tile: Pos }

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
  /** For interactions: the rule "defines" the interaction but is a soft fallback. */
  tests?: RuleTest[]
  source?: Provenance
  /** Human-readable summary. */
  doc?: string
}

// ------------------------------------------------------------------ outputs to the client

export type FxEvent =
  | { t: 'vfx'; fx: string; map: string; x: number; y: number }
  | { t: 'say'; who: Id; text: Text }
  | { t: 'log'; text: Text; tone?: 'info' | 'warn' | 'ai' | 'good' | 'bad' }
  | { t: 'damage'; who: Id; amount: number; element?: string }
  | { t: 'undefined'; request: string; summary: string }
  | { t: 'patched'; request: string; rule: string }
  | { t: 'mapChanged'; map: string }
