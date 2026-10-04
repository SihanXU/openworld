// Core data model of the Large Symbolic World engine.
// Everything here is plain JSON-serializable data: state, rules and patches travel
// between the engine, the client, saves and (later) the modder service.


export type Id = string
export type Text = string | { en: string; zh?: string }

export type Dir = 'up' | 'down' | 'left' | 'right'
/** How near a lit or burning thing the creatures that fear fire will not come (tiles, Chebyshev). */
export const FIRE_RADIUS = 2

export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

// ------------------------------------------------------------------ ontology

/**
 * A 16x16 icon as data: one string per row, one character per pixel ("." transparent), each
 * other character a colour of the palette. Things the world learned carry their own picture
 * this way (the client draws it), so it travels with the patch like the rest of the type.
 */
export interface PixelArt {
  grid: string[]
  palette: Record<string, string>
}

/** A node in the is-a hierarchy. Type ids are slash paths: `item/container/bucket`. */
/**
 * A type of thing (world-model.md §4). There are no kinds: everything descends from the one root,
 * and whatever the engine asks of a thing is data here, inherited down the type path (the tags
 * `agent` — acts by itself with a body — and `portable`, the stances it `reach`es, its props).
 */
export interface TypeDef {
  id: string
  name?: Text
  /** Tags inherited by every instance (instances may add more). */
  tags?: string[]
  /** Default properties (instances may override). */
  props?: Record<string, PropValue>
  /** Render key; resolved by the client's art layer (`art:<type id>` for a type that carries its own `art`). */
  sprite?: string
  /** Its own picture, for a type a patch introduced (sprite `art:<id>`). */
  art?: PixelArt
  /** Does it block movement? (it fills its cell's volume; a body blocks by its own space) */
  solid?: boolean
  /**
   * The spaces it takes in its cell (world-model.md §5.2): in a cell each space has at most one
   * occupant. Default: a body for an agent that does not fly, the volume for a solid thing,
   * none for the rest (items and most furniture share a cell with anything).
   */
  occupies?: Space[]
  /** It is drawn as the ground of its cell, this terrain (the cell things of a map's data; world-model.md §4.6). */
  terrain?: string
  /**
   * What it is made of, which is also what it leaves when it breaks (world-model.md §6.4): each
   * part's count is scaled by the world's recovery rate, in the thing's own material.
   */
  makeup?: MakeupPart[]
  /** How long it stays what it is, and what it becomes (world-model.md §6.5). */
  stage?: StageDef
  /** Where it is made from its makeup (world-model.md §6.4): `hands` (anywhere), or a station a thing within reach is (its `station:<x>` tag). */
  station?: string
  /** The level its recipe asks (default 1): a maker above it makes it finer. */
  craftLevel?: number
  /**
   * Things bigger than a tile: the base they stand on, [width, depth] in tiles — centred on
   * their own tile, reaching back (north) from it. A solid thing blocks all of it, and only
   * while it is there. Default [1, 1].
   */
  footprint?: [number, number]
  /** The stances it acts on: what can stand or lie on it (none by default). A thing's own stance is its `stance` prop. */
  reach?: string[]
}

export type PropValue = number | string | boolean

/** A part of what a thing is made of: `count` of `type`, each with `chance` (default 1). */
export interface MakeupPart {
  type: string
  count: number
  chance?: number
}

/**
 * A material (world-model.md §4.5): its category (what tools work on: wood, stone, ore, flesh …)
 * and its hardness — an instrument softer than what it strikes does nothing (Elin: a tool below the
 * material's level). Things carry theirs as a `material:<id>` tag, or their type's `material` prop.
 */
export interface MaterialDef {
  id: string
  category: string
  hardness: number
  /** How a thing of it is named ("Stone" Axe, 石斧), what tags it gives, how much power it adds (a weapon, a tool). */
  name?: Text
  tags?: string[]
  power?: number
}

/** A quality a made thing can have (world-model.md §6.4): its tag, name and power, and from how far above a recipe's level its maker reaches it (none: not by making). */
export interface QualityDef {
  id: string
  tag?: string
  name?: Text
  power: number
  from?: number
}

/** Numbers the world is made with (world-model.md §11): data, never literals in the engine. */
export interface WorldParams {
  /** The share of its makeup a thing leaves when it breaks (D9). */
  recovery: number
  /** A drop of this many levels or less does no harm (world-model.md §5.5). */
  safeFall: number
  /** The harm of each level fallen beyond the safe height. */
  fallDamage: number
  /** How much longer a long step takes in rain, a storm or snow (a map with a `scale`). */
  rainCost?: number
  /** How many storeys may stand above the ground (world-model.md §5.2). */
  storeys?: number
  /** The largest a room may be, in cells: larger is out of doors (world-model.md §5.4). */
  roomSize?: number
  /** The hour one rises; and how much of what is missing a night's sleep gives back outside a room that says more. */
  riseHour?: number
  rest?: number
}

/** The spaces of a cell (world-model.md §5.2): what one stands on, what fills it, what roots in it, a body. */
export type Space = 'floor' | 'soil' | 'volume' | 'body'

export interface StatusDef {
  id: string
  name?: Text
  /** Default duration in ticks; omitted = until removed. */
  duration?: number
  /** Statuses removed when this one is applied (e.g. frozen removes burning). */
  clears?: string[]
  /** Statuses that cannot take hold while this one lasts (fireproof wards off burning). */
  wards?: string[]
  /** An actor with this status cannot move or act. */
  immobilize?: boolean
  /** Multiplier on movement delay while held (e.g. dream mist slows any actor). */
  moveDelay?: number
  /** Ticks between the status's time/period events (default 5): a bleed pulses once a second. */
  every?: number
  /** Render hint for the client overlay. */
  overlay?: string
}

export interface TerrainDef {
  id: string // terrain id; the cell things made of it are of type `tile/<id>` (world-model.md §4.6)
  name?: Text
  tags?: string[]
  solid?: boolean
  /** Swimmable/liquid terrain: items put here are not simply dropped. */
  liquid?: boolean
  /** The stances it acts on (default `ground` for a floor, none for the rest): what touches it (design.md §5.5). */
  reach?: string[]
  /** The space it takes in its cell (default `floor`): ground is a floor; trees, rock and walls fill the volume; a stump roots in the soil. */
  space?: 'floor' | 'soil' | 'volume'
  /** Its props as a thing (its material, its durability: maxHp and hp). */
  props?: Record<string, PropValue>
  /** What it is made of (TypeDef.makeup). */
  makeup?: MakeupPart[]
  /** How long it stays what it is, and what it becomes (TypeDef.stage). */
  stage?: StageDef
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
  /** Factions (an actor belongs to those its `faction:<id>` tags name) and whom each is hostile to. */
  factions?: Record<string, FactionDef>
  /** Numeric lines that are events when a prop crosses them (design.md §5.7: threshold). */
  thresholds?: ThresholdDef[]
  /** The materials things are made of, by id. */
  materials?: Record<string, MaterialDef>
  /** The qualities made things have. */
  qualities?: QualityDef[]
  /**
   * How well an instrument works on a material category (world-model.md §6.1): rows are its
   * capabilities (`tool:axe` …) and its edge (`edge:cut` …); an instrument takes its best row.
   * A category no row names: 1.
   */
  efficiency?: Record<string, Record<string, number>>
  /** The world parameters. */
  params?: WorldParams
  /**
   * What makes a room what it is (world-model.md §5.4, RimWorld's roles, as tags): a room with
   * `count` things matching `needs` in it has the tag `role:<role>`, and the role's props (a
   * bedroom's `rest`: how much a night's sleep there gives back).
   */
  roomRoles?: { role: string; needs: Selector; count?: number; props?: Record<string, PropValue> }[]
  /** Clocks that make `time/period` events for the hosts they name. */
  periods?: PeriodDef[]
  /** What appears by itself on any map its `where` fits (the night's walkers), besides each map's own (MapData.appear). */
  appear?: AppearDef[]
}

/**
 * A stage (world-model.md §6.5, after Elin's GrowSystem, generalised): a thing stays what it is
 * until its clock runs out, then becomes the next (a stump a tree, thin ice water) and leaves what
 * the stage yields (a hen's egg). One mechanism for every such change; it runs on timers, so a
 * dormant map catches up when it is entered.
 */
export interface StageDef {
  /** What it becomes at the end; none: it stays what it is and the stage begins again (a hen lays, and lays again). */
  into?: string
  /** Ticks the stage lasts, its clock (the status `stage`) started when the thing comes to be what it is. */
  lasts?: number
  /** Another status as its clock, started by whatever gives it (a crop moves on when its watering runs out): then nothing starts it by itself. */
  clock?: string
  /** A condition on the thing (the host) the end waits for (light, nobody standing on it); not met, it waits `wait` ticks and looks again. */
  needs?: Cond
  wait?: number
  /** What is seen at the end (a vfx: leaves, a splash). */
  fx?: string
  /** What the end leaves where it is (an egg laid). */
  yields?: { type: string; count?: number }[]
}

/**
 * What appears by itself (world-model.md §6.9; Don't Starve's twigs and flint, Minecraft's
 * mobs, the night's walkers): data only. Now and then one more of the weighted types appears on
 * a free cell of the right ground, at the right distance from the one at the keys, at the right
 * hours and weather, until `max` of them are on the map.
 */
export interface AppearDef {
  /** What appears: types, weighted. */
  types: Record<string, number>
  /** The grounds it appears on (terrain ids); any ground one can stand on when absent. */
  on?: string[]
  /** At most this many on the map: those tagged `tag` if it is given, else those of its types. */
  max: number
  /** Ticks between appearances (a multiple of the `appear` period). */
  every: number
  /** How far from the one at the keys, [near, far] cells (default: anywhere, not within two). */
  ring?: [number, number]
  /** When: hours [from, to) (past midnight when from > to), and weathers. */
  hours?: [number, number]
  weather?: string[]
  /** Which maps (for the world's own): by the map's zone and light. */
  where?: { zone?: 'peaceful' | 'combat'; light?: 'outdoor' | 'indoor' | 'dark' }
  /** A tag what appears carries (counted by `max`). */
  tag?: string
  /** A creature's behaviour (its home is where it appears), and statuses it appears with. */
  ai?: Omit<AiData, 'home'>
  statuses?: string[]
}

export interface ThresholdDef {
  /** The event's `name` param ("broken", "starving"). */
  name: string
  prop: string
  /** Crossed when the value comes to this or below. */
  lte: number
}

export interface PeriodDef {
  name: string
  /** Ticks between events. */
  every: number
  /** Things on the active map that have it (a selector), or a resident host. */
  host: Selector | 'world' | 'story'
  /** A prop on the host that overrides `every` for it (Iron Stomach's slower hunger: `hungerEvery`). */
  everyProp?: string
}

export interface FactionDef {
  name?: Text
  /** Factions its members attack on sight (when their temper says so). */
  hostile?: string[]
}

// ------------------------------------------------------------------ world state

export interface Pos {
  map: string
  x: number
  y: number
  /** The storey (world-model.md §5.2): 0 the ground's, 1 the floor above it … (omitted: 0). */
  z?: number
}

/** Where an entity is: on a tile, inside a container/inventory, or nowhere (destroyed). */
export type Place =
  | { on: 'tile'; map: string; x: number; y: number; z?: number } // z: the storey (omitted: the ground's)
  | { on: 'inside'; holder: Id } // in a container's contents or an actor's inventory
  | { on: 'hand'; holder: Id } // the actor's single held-item slot
  | { on: 'resident' } // a host on no map: the world, the story (design.md §5.5)
  | { on: 'area'; map: string; rects: [number, number, number, number][]; z?: number } // a region: the cells it spans, as rectangles, on a storey (world-model.md §5.4)
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
  /** status id -> who gave it (the actor of the outcome that set it): its time events name them. */
  statusBy?: Record<string, Id>
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
  /**
   * The actor's memory of its own blows and steps (combos, chains, windows its talents open):
   * written only by its own act-making (combat.ts) and its own outcomes, never read by rules —
   * like a cooldown. Anything others see (health, a bleed) is a prop or a status.
   */
  combat?: CombatState
  /** The story's script: where it stands (the scene playing) — its behaviour memory. */
  script?: SceneState
  /** An encounter's behaviour memory (its telegraph, its animation); its blows are acts. */
  boss?: BossState
  /** Set while an undefined outcome involving this entity awaits a patch (design.md §5.11). */
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

export interface BossSkill {
  id: string
  name: Text
  shape: 'circle' | 'ring' | 'line' | 'cross' | 'cone' | 'spots'
  aim: 'self' | 'target'
  radius: number
  windup: number
  recovery: number
  damage: number
  element?: string
  fx: string
  action: 'attack' | 'cast'
  status?: string
  heal?: number
  shift?: 'pull' | 'push'
  blink?: boolean
}

export interface BossDef {
  id: string
  name: Text
  footprint: [number, number]
  hp: number
  defense: number
  sight: number
  leash: number
  color: number
  enrageAt: number
  skills: BossSkill[]
}

export interface BossState {
  kit: string
  phase?: number
  nextSkill?: number
  nextAt?: number
  action?: 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'death'
  actionTick?: number
  actionEnd?: number
  pending?: { skill: number; target: Id; origin: Pos; aim: Pos; tiles: [number, number][]; releaseAt: number }
}

export interface CombatState {
  lastMoveTick?: number
  lastAttackTick?: number
  lastHurtTick?: number
  steps?: number
  comboTarget?: Id
  comboHits?: number
  comboTick?: number
  pursuitUntil?: number
  lastStandTick?: number
  moveCarry?: number
  attackCarry?: number
  /** Warrior: a Retaliation is ready until this tick (after taking a hit). */
  retaliateUntil?: number
  /** Warrior: Rampage stacks, and when they lapse. */
  rampageStacks?: number
  rampageUntil?: number
  /** Ranger: Hunter's Mark — ranged hits in a row on one target. */
  markTarget?: Id
  markHits?: number
  /** Ranger: Fleet Archer's speed lasts until this tick. */
  fleetUntil?: number
  /** Mage: magic hits landed (every fourth echoes). */
  spellHits?: number
  /** Swiftness: the last dodge (Untouchable readies a critical from it), and blows pass by until this tick (Phantom Step, Phoenix). */
  dodgeTick?: number
  guardUntil?: number
  /** Swiftness: Slipstream's speed after a dash lasts until this tick. */
  slipUntil?: number
  /** Damage: Momentum — hits landed in a chain, and when the last one was. */
  chain?: number
  chainTick?: number
  /** Survival: Adrenaline — when it last came (once a minute; the rush itself is a status). */
  adrenalineTick?: number
}

export interface ScheduleEntry {
  /** Game hour window [from, to) in 0..24; may wrap past midnight. */
  from: number
  to: number
  map: string
  x: number
  y: number
  activity: string
  /** The thing the activity needs (the fire she tends, the cart he minds). */
  uses?: Id
  /** What `uses` must be for the activity to go on (the fire lit); else the person is blocked. */
  need?: Selector
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
  /** A person's record (docs/game-design.md §5); crowd NPCs may have none. */
  person?: PersonData
  /** A detour a rule ordered (`goto`): this anchor until the tick, whatever the schedule says. */
  override?: { map: string; x: number; y: number; until: number; activity: string }
  /** What the person remembers of talking: the lines said, the last one, the day last talked to (their own record). */
  memory?: NpcMemory
}

// ------------------------------------------------------------------ people (data)

export type Mood = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy'

/**
 * A line and the context it is for. Keys, most specific first (people.ts resolves them):
 * topic:<id> · fact:<key> (the fact is truthy) · greeting:first · weather:<w> ·
 * hour:<morning|day|evening|night> · default — and when handed something:
 * given:<type prefix> · given.
 * Slots in the text: {player} {name} {friend:<id>} {fact:<key>} {item}.
 */
export interface LineDef {
  key: string
  text: Text
  mood?: Mood
  /** said at most once to the player */
  once?: boolean
}

/** A schedule variant. Keys, most specific first: fact:<key> (the fact is truthy) · storm · rain · default. */
export interface ScheduleVariant {
  key: string
  entries: ScheduleEntry[]
}

export interface PersonData {
  temperament?: { personality?: string; manner?: string; social?: string; outlook?: string }
  /** id → relation ('daughter', 'old friend' …) */
  ties?: Record<Id, string>
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
}

/** Something that happened, which people may talk about while it is fresh. */
export interface Topic {
  id: string
  day: number
  /** days it stays fresh (default 4) */
  days?: number
}

/** A scripted scene (docs/game-design.md §8.6): the arrival, the ferry, the far bank. */
export interface SceneDef {
  id: string
  map: string
  /** Played only by a `scene` effect (the ferry), never by itself. */
  manual?: boolean
  when?: {
    hour?: { from: number; to: number }
    weather?: string[]
    facts?: Record<string, Cmp>
    /** the player stands in this region of the map (its region thing): checked when they enter it, and when a scene ends — never polled */
    region?: string
    /** default false: a scene plays once */
    repeat?: boolean
  }
  script: SceneCmd[]
}

/**
 * Content the world must keep playable (BardOS's stage invariant): while `when` holds, `holds`
 * must hold. When state breaks it (the rope she asked for burned), the story receives a `broken`
 * event (`invariant` = id, target = the giver); its outcome is undefined, and `fallback` (run
 * by the story) is the default while nobody answers.
 */
export interface Invariant {
  id: string
  giver?: Id
  /** What the content is, in words (for the modder). */
  text: Text
  when?: Cond
  holds: Cond
  fallback?: Effect[]
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
  /** a full-screen card (the ending), advanced like a line */
  | { card: Text }

export interface SceneState {
  id: string
  step: number
  until?: number
  waiting?: 'advance' | 'move'
  mover?: { who: Id; path: [number, number][]; next: number }
  started?: number
  /** the line waiting to be advanced (so a client that missed the say event can show it) */
  line?: { who: Id; text: Text; mood?: Mood; card?: boolean }
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
  /**
   * When it attacks those its factions are hostile to: always, after dark only, or only once
   * provoked. Whoever strikes it becomes a foe, whatever its temper.
   */
  temper: 'aggressive' | 'nocturnal' | 'wary'
  /** Whoever struck it: attacked on sight. */
  foes?: Id[]
  /** How far from where it lives (home, or its night roam) it will chase before it gives up (default 8). */
  leash?: number
  sight: number
  home: Pos
  state?: 'idle' | 'chase' | 'return' | 'flee'
  /** The way around an obstacle it is following, to the goal it was planned for. */
  detour?: { x: number; y: number; path: [number, number][] }
  cooldown?: number
  loot?: string[] // item type ids
  /** Where it roams at night (creatures come out after dark); by day it keeps to `home`. */
  night?: Pos
}

/**
 * Where an input points: the tile under the pointer, and what the view draws at that point, top
 * first (things by id, a tree or tall grass by its own tile). The ground of the tile comes last.
 */
export interface Aim {
  x: number
  y: number
  stack?: Ref[]
}

export interface MapData {
  id: string
  name: Text
  region?: string
  kind: string // town / village / wild / dungeon / interior …
  width: number
  height: number
  /**
   * Row-major terrain ids, length = width*height: each cell as authored, by what is on top of it.
   * The engine makes the cell's things from it (cells.ts): the floor, and what fills or roots in it.
   */
  terrain: string[]
  /**
   * Row-major ground height of each column, in half levels (world-model.md §5.2; default 0): a
   * level is two; a column between two levels is a ramp. One walks at most half a level up or
   * down; more down is a fall, more up a cliff.
   */
  heights?: number[]
  /** A step here lasts this many minutes (times its ground's `cost`): the overworld's scale. Without it, a step is a body's own pace. */
  scale?: number
  /** Where the map lies on the overworld: the top left of its cell's block there (world-model.md §5.1). Its open edges lead to it. */
  site?: { map: string; x: number; y: number; size: number }
  portals: Portal[]
  /** Render hints (the engine ignores them): prefab stamps, room wall frames, music, light. */
  stamps?: { key: string; x: number; y: number }[]
  rooms?: { style: string; x: number; y: number; w: number; h: number }[]
  music?: string
  light?: 'outdoor' | 'indoor' | 'dark'
  /** Named spots ('square.well') for schedules, scenes and authors. */
  anchors?: Record<string, [number, number]>
  /** Named areas [x, y, w, h] ('far_bank') for scenes and goals. */
  regions?: Record<string, [number, number, number, number]>
  /** What appears on the map by itself (world-model.md §6.9): the ground's yield, creatures that come back. */
  appear?: AppearDef[]
  /** Older chunks' name for `appear`, one type each (read when a chunk is decoded). */
  forage?: Forage[]
  /** Peaceful (towns, camps: nothing comes out at night) or combat (default: zombies and bats come out after dark, nightspawn.ts). */
  zone?: 'peaceful' | 'combat'
}

/** An older chunk's appearance (MapData.forage): one type. */
export interface Forage {
  type: string
  on: string[]
  max: number
  /** Ticks between appearances (default FORAGE_EVERY). */
  every?: number
  /** A creature's behaviour (its home is where it appears). */
  ai?: Omit<AiData, 'home'>
  /** Statuses it appears with, for their default durations (a hen's laying). */
  statuses?: string[]
}

/**
 * A node of the skill tree. Learning it spends skill points (progression.ts), adds `grant` to
 * the learner's props and tags them `skill:<id>`. Stat nodes work through their grants; an
 * ability works through its tag, which rules (`actor: { tags: ['skill:<id>'] }`) and the
 * engine test for.
 */
export interface SkillDef {
  id: string
  name: Text
  doc: Text
  /** The branch it belongs to; content groups branches into directions. */
  branch: string
  /** Only this profession may learn/use the node; absent means a shared skill. */
  profession?: string
  /** Skills learned first. */
  requires?: string[]
  /** Skill points it costs (default 1). */
  cost?: number
  /** Added to the learner's props (maxHp also fills hp by as much; maxHunger, hunger). */
  grant?: Record<string, number>
  /** Unlocks something new rather than raising a number (shown as such). */
  ability?: boolean
  /** The client's round icon for it (ui/skillIcons.ts). */
  icon?: string
}

/** A recipe for the crafting panel: the carried items it uses up, and the item it makes. */
export interface Recipe {
  id: string
  name: Text
  sprite: string
  /** What it uses up: its makeup (the first part is the main ingredient, whose material it takes). */
  needs: { type: string; count: number }[]
  make: Omit<Entity, 'id' | 'place'>
  /** Where it is made: `hands`, or a station within reach. */
  station?: string
  level?: number
}

export interface Portal {
  x: number
  y: number
  to: string // map id
  tx: number
  ty: number
  label?: Text
}

export interface WorldState {
  tick: number
  seed: number
  rng: number // PRNG state
  player: Id
  /**
   * Every thing that differs from static data: what was made, and the cell things of a map's static
   * layers once changed (materialised under their derived id; one destroyed stays as a record with
   * no place, so the static one does not come back) — world-model.md §4.6.
   */
  entities: Record<Id, Entity>
  /** Loaded maps' base data (static) keyed by id. */
  maps: Record<string, MapData>
  /** Maps whose entity chunk has been merged into `entities`. */
  loadedMaps: string[]
  counter: number // id allocator
  /** Where the player respawns. */
  spawn: Pos
  /** The engine's record of the broken invariants it has already reported (not world state: the detector's memory). */
  reported?: string[]
  /** A yes/no question waiting for the player (Action: "Eat the apple?"); time stops while it is open. */
  question?: { text: Text; plan: Plan }
  /** Maps the player is not on: frozen since a tick, with the events addressed to them (design.md §5.12). */
  dormant?: Record<string, { since: number; inbox: GameEvent[] }>
  /** Each host's relations (contact and containment) when last computed: `how|ref` keys. */
  relations?: Record<string, string[]>
}

// ------------------------------------------------------------------ the player's inputs

/**
 * What one of the player's inputs will do (design.md §5.2), chosen by dry runs through the rule
 * library: the HUD shows its label before the input is pressed, and pressing runs it.
 */
export interface Plan {
  /** The input: E (hands), F (take), left click (use), right click (put). */
  key: 'hands' | 'take' | 'use' | 'put'
  /** The tile aimed at. */
  at: Pos
  /** A blow or a cast toward `at` (weapons, wands): the act is aimed along the facing. */
  attack?: boolean
  verb?: Verb
  target: Ref
  /** The instrument: the held item, or none (talking while holding a tool). */
  instrument?: Ref
  label: Text
  rule?: string
  /** The chain it starts reaches an undefined outcome — the world has never seen this. */
  unknown?: boolean
  /** Ask first ("Eat the apple?", "Sleep until morning?"). */
  confirm?: Text
  /** Hands on a container: open the transfer panel for it. */
  panel?: Id
}

// ------------------------------------------------------------------ events (design.md §5.7)

/** What an actor does: the inputs, and the behaviour of people and creatures (the same acts). */
export type Verb = 'use' | 'put' | 'take' | 'hands' | 'move' | 'craft' | 'learn'

/** A reference to anything that can host or fill an event role: an entity or a map tile. */
/** The one reference form (world-model.md §4.6): every thing has an id; a thing of a map's cells has one derived from its place. */
export type Ref = { e: Id }

/**
 * The closed tree of event kinds. A rule answers a kind or a whole branch (`impulse` answers
 * every impulse); the engine emits nothing outside this list.
 */
export const EVENT_KINDS = [
  'act/use',
  'act/put',
  'act/take',
  'act/hands',
  'act/move',
  'act/craft',
  'act/learn',
  'impulse/strike',
  'impulse/element',
  'impulse/coat',
  'impulse/restore',
  'impulse/push',
  'impulse/taken',
  'impulse/receive',
  'impulse/offered',
  'impulse/handle',
  'impulse/notify',
  'contact/begin',
  'contact/stay',
  'contact/end',
  'bump',
  'time/period',
  'time/timer',
  'threshold/gain',
  'threshold/lose',
  'threshold/cross',
  'seen',
  'stuck',
  'broken',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** The impulses: what one thing does to another (design.md §5.8). */
export type Impulse = 'strike' | 'element' | 'coat' | 'restore' | 'push' | 'taken' | 'receive' | 'offered' | 'handle' | 'notify'

/**
 * The roles of an event besides its host (whose rule answers it):
 * - act: `actor`, `target`, `instrument` (the host is the instrument, or the actor's own hands);
 * - impulse: `source` (what emitted it), `actor` (whose act started the chain), `instrument`,
 *   `item` (the thing given, put or taken), `other` (the taker, for `taken`);
 * - contact, bump: `other`, the thing on the other side;
 * - seen: `actor` (the doer), `target`, `instrument`;
 * - stuck: `target` (what the activity needs, or the spot); broken: `target` (the giver).
 */
export type RoleName = 'host' | 'actor' | 'target' | 'instrument' | 'other' | 'item' | 'source'
/** What a condition may read: the event's roles, and the stewards every rule may read (the story, the world). */
export type Reader = RoleName | 'story' | 'world'

export interface GameEvent {
  kind: EventKind
  /** Whose nature answers it. */
  host: Ref
  roles: Partial<Record<Exclude<RoleName, 'host'>, Ref>>
  /**
   * The event's parameters: an act's `verb`; an impulse's `power`, `element`, `edge`, `substance`,
   * `which`, `amount`, `dir`, `into`, `what`; a contact's `how`; a period's `name` or `status`; a
   * timer's `status`; a threshold's `status` or `name`; a seen act's `act` and `owner`; stuck's
   * `activity`; broken's `invariant`; `attack` on an act that is a blow.
   */
  params?: Record<string, PropValue>
  /** The actor whose act started the chain (held while it waits; the Threadbook's "you"). */
  cause?: Id
  /** Who started the chain: the player's input, or the world by itself. */
  origin?: 'player' | 'world'
  /** How many events led to this one within the chain. */
  depth?: number
  tick?: number
}

// ------------------------------------------------------------------ rules (design.md §5.6, §6)

/** Selects the entity or tile filling a role. All given constraints must hold. */
export interface Selector {
  /** Is-a match against the type hierarchy (prefix on slash paths): `actor`, `item/food`, `tile/grass`… */
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
}

export type Cmp =
  | PropValue
  | { eq?: PropValue; ne?: PropValue; gt?: number; gte?: number; lt?: number; lte?: number }

/** A number, or a number read from a role's prop (scaled) or from the event's params. */
export type Operand = number | { prop: string; of: RoleName; mul?: number } | { param: string; mul?: number }

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
  /** A role is filled and matches the selector. */
  | { is: { role: RoleName; sel: Selector } }
  /** A role is empty (an empty hand). */
  | { none: RoleName }
  /** Two roles are the same thing (food used on oneself). */
  | { same: [RoleName, RoleName] }
  | { has: { role: RoleName; status?: string; tag?: string } }
  /** A role's prop compared to a value, or bounded by other numbers. A missing prop is false. */
  /** `default` is read when the prop is missing (a fact the story has not set reads 0 with `default: 0`). */
  | { prop: { role: Reader; key: string; cmp?: Cmp; bounds?: Bounds; default?: PropValue } }
  /** An event parameter compared to a value (a missing parameter is false). */
  | { param: { key: string; cmp: Cmp } }
  | { chance: number }
  | { hour: { from: number; to: number } }
  /** How many entities (matching `match`) are in a role's contents, or on its tile besides itself. */
  | { count: { role: RoleName; in: 'contents' | 'tile'; match?: Selector; cmp: Bounds } }
  /** Something that happened is still fresh. */
  | { topic: string }
  /** The weather now. */
  | { weather: string[] }
  /** Something matching the selector exists anywhere in the loaded world (a rope, the dead tree). */
  | { exists: Selector }
  /** The host's map (the player's, for the story and the world) is out under the sky. */
  | { outdoors: true }
  /** A role's type says what it is made of (it has a makeup). */
  | { makeup: RoleName }
  /** A role has a relation now (world-model.md §7): `on`, `support`, `in-region` … */
  | { rel: { role: RoleName; how: string } }

/** A role, or the cell under it (`tileOf:`: the thing that makes up that cell on top — what fills it, roots in it, or the floor). */
export type RoleRef = RoleName | 'tileOf:host' | 'tileOf:actor' | 'tileOf:target' | 'tileOf:instrument' | 'tileOf:other' | 'tileOf:item' | 'tileOf:source'

export type Amount = number | { param: string; mul?: number; add?: number } | { prop: string; of: RoleName; mul?: number; add?: number }

/** Where an emitted event goes: a role, a resident host, a named thing, or a place of the host's map. */
export type EmitTo =
  | RoleRef
  | 'story'
  | 'world'
  | { named: Id }
  | { area: { at?: RoleRef; radius: number } }
  | { line: { from?: RoleRef; away: RoleRef; length: number; over?: string[] } }
  /** Everything on the host's map (the world's weather); `sky`: only what is out under it (world-model.md §5.3). */
  | { map: true; sky?: boolean }

/**
 * The effect primitives. Every one writes only the host (design.md §5.6: read anything, write only
 * yourself), spawns, or presents; `emit` sends an event to others, which answer for themselves.
 */
export type Effect =
  | { op: 'spawn'; type: string; at: RoleRef; into?: 'tile' | 'contents' | 'hand'; count?: Amount; still?: boolean }
  | { op: 'destroy' }
  | { op: 'transform'; into: string }
  | { op: 'move'; to: RoleRef; into?: 'tile' | 'contents' | 'hand' }
  | { op: 'step'; dir?: Dir; away?: RoleRef; tiles?: number }
  | { op: 'addStatus'; status: string; duration?: number }
  | { op: 'removeStatus'; status: string }
  | { op: 'setProp'; key: string; value: PropValue | { param: string } }
  | { op: 'addProp'; key: string; delta: Amount; min?: number; max?: Amount }
  | { op: 'addTag'; tag: string }
  | { op: 'removeTag'; tag: string }
  | { op: 'hurt'; amount: Amount; element?: string; pierce?: boolean; blow?: boolean }
  /** The host breaks into what it is made of (its makeup × the recovery rate, in its material), spills what it holds, and is gone. */
  | { op: 'breakdown' }
  /** With nothing under it on its storey, the host drops to the first floor below (and is struck by the drop). */
  | { op: 'fall' }
  /** The host sleeps until it is time to rise (time passes at once for the one at the keys); it wakes with health back as its room gives (a bedroom's `rest`). */
  | { op: 'sleep' }
  | { op: 'heal'; amount: Amount }
  | { op: 'feed'; amount: Amount }
  | { op: 'gainXp'; amount: Amount }
  | { op: 'foe' }
  | { op: 'open' }
  | { op: 'dropContents'; still?: boolean }
  | { op: 'goto'; anchor: string; hours: number; activity?: string }
  | { op: 'topic'; id: string; days?: number }
  /** The host (a person) is spoken to about quests: its business with the speaker goes to the story; else it says its line. */
  | { op: 'quest' }
  /** The story's: a quest's business (a word with its giver, a defeat) is settled (quests.ts). */
  | { op: 'quests' }
  /** The world's: what appears by itself on the active map now (its own and the world's appearances), or the one given. */
  | { op: 'appear'; what?: AppearDef }
  /** The host's stage clock ran out (param status): it becomes what its stage says next (world-model.md §6.5). */
  | { op: 'grow' }
  /** The host learns: the skill (param skill) or the profession (param profession) its act names. */
  | { op: 'learn' }
  /** The host's encounter skill lands on the cells its act telegraphed (bosses.ts). */
  | { op: 'release' }
  /** Open one of the player's panels (the profession trainer's: 'profession'). */
  | { op: 'panel'; panel: string }
  | { op: 'scene'; id: string }
  | { op: 'craft' }
  | { op: 'lightning'; power: number }
  /** Send an impulse: `item` names the thing it carries (given, put, taken), `other` the role it names as the other side. */
  | { op: 'emit'; impulse: Impulse; to: EmitTo; params?: Record<string, PropValue | Amount | { typeOf: RoleName }>; item?: RoleName; other?: RoleName; chance?: number; filter?: Selector }
  /** Get out of where one cannot be (water closing over the ice): to the nearest free tile. */
  | { op: 'ashore' }
  /** The story's: an invariant's authored fallback (the default of a `broken` outcome). */
  | { op: 'fallback' }
  | { op: 'vfx'; at?: RoleRef; fx: string }
  /** A line said by the host (or, for the story and the world, by one of the event's roles). */
  | { op: 'say'; text: Text; who?: RoleName }
  | { op: 'log'; text: Text }
  | { op: 'emote'; mood: Mood }

/**
 * A rule's outcome: a condition tree whose leaves are effects (an empty list: no change),
 * `inherit` (the next less specific rule answers), or undefined (the AI answers; its `default`
 * runs while nobody does). An `if` without `else` inherits.
 */
export type Tree = 'inherit' | { do: Effect[]; confirm?: Text } | { undefined: true; default?: Effect[] } | { if: Cond; then: Tree; else?: Tree }
export type Leaf = Exclude<Tree, { if: Cond }>

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
  /** Which entity key is the player (default: "actor"). */
  player?: string
  /** What the things on top of some cells carry (statuses, props), at their place in the terrain rows. */
  cells?: { x: number; y: number; statuses?: string[]; props?: Record<string, PropValue> }[]
  /** The event to replay. Roles refer to scenario entity keys or `tile:x,y`. */
  event: {
    kind?: EventKind
    host?: string
    actor?: string
    target?: string
    instrument?: string
    other?: string
    item?: string
    source?: string
    params?: Record<string, PropValue>
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
  /** Who started the chain the patch answers: the player, or the world itself (design.md §5.11). */
  trigger?: 'player' | 'world'
  request?: string
  author?: string
  at?: string // ISO timestamp
  note?: string
}

export interface Rule {
  id: string
  /** Whose nature this is: the host's class (empty: anything, the root). */
  host?: Selector
  /** The event kind it answers, or a branch of the kind tree (`impulse`). */
  on: string
  tree: Tree
  /** Ask the player first when their input chooses this rule ("Eat {instrument}?"). */
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
  | { t: 'fade'; dir: 'out' | 'in' }
  | { t: 'card'; text: Text }
  | { t: 'strike'; map: string; x: number; y: number }
  | { t: 'log'; text: Text; tone?: 'info' | 'warn' | 'ai' | 'good' | 'bad' }
  | { t: 'damage'; who: Id; amount: number; element?: string }
  | { t: 'undefined'; request: string; summary: string; /** someone (a provider) is working it out */ asked?: boolean }
  | { t: 'patched'; request: string; rule: string }
  | { t: 'mapChanged'; map: string }
  /** The magnet pulled a dropped item into the player's bag (from its tile). */
  | { t: 'pickup'; item: Id; sprite: string; name: Text; map: string; x: number; y: number }
  /** An actor the player controls reached a new level. */
  | { t: 'levelup'; level: number }
  /** A rule opened one of the player's panels ('profession'). */
  | { t: 'panel'; panel: string; by?: Id }
