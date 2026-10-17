// Core data model of the Large Symbolic World engine.
// Everything here is plain JSON-serializable data: state, rules and patches travel
// between the engine, the client, saves and (later) the modder service.


import type { AffixTable } from './affixes.ts'

export type Id = string
/** The AI setting a learned answer was made at, and an event is answered at (quality.ts). */
export type Tier = 'low' | 'medium' | 'high'
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

/** The way back: the opposite of a direction. */
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

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
  /** The one thing this kind was made for (the editor's "its own kind", docs/engine-split.md §16 E-b): rules on it are that thing's alone. The engine reads nothing from it. */
  own?: Id
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
  /** The order its goals are tried in (world-model.md §6.10): encounter, threat, follow, schedule, home, idle. */
  goals?: string[]
  /** Where it is made from its makeup (world-model.md §6.4): `hands` (anywhere), or a station a thing within reach is (its `station:<x>` tag). */
  station?: string
  /** The level its recipe asks (default 1): a maker above it makes it finer. */
  craftLevel?: number
  /** Tools its making needs carried (tags: `tool:axe`), not used up (Elin's tool requirement). */
  tools?: string[]
  /** How many one making gives (a log splits into two planks); what one breaks back into is its share of the makeup. */
  yields?: number
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
  /** How a thing of it is named ("Stone" Axe, 石斧), what tags it gives. */
  name?: Text
  tags?: string[]
  /** How much it makes of a weapon's or tool's power, and of a worn thing's defence (world-model.md §6.8, Elin's material atk/pv): factors, 1 when absent. */
  attack?: number
  defence?: number
  /** What it makes of a thing's worth (docs/npc-sandbox.md §2.10): a factor, 1 when absent. */
  value?: number
}

/** A quality a made thing can have (world-model.md §6.4): its tag, name and factor on power and defence (Elin's rarity), and from how far above a recipe's level its maker reaches it (none: not by making). */
export interface QualityDef {
  id: string
  tag?: string
  name?: Text
  factor: number
  from?: number
  /** What it makes of a thing's worth: a factor, 1 when absent. */
  value?: number
  /**
   * What a piece of gear of this quality carries beyond its numbers: made, it takes one of these as its `vow` (a
   * combat module answers each by id: the Vowbound's vows), unless its kind or the maker names one.
   */
  vows?: string[]
}

/** Numbers the world is made with (world-model.md §11): data, never literals in the engine. */
export interface WorldParams {
  /** The share of its makeup a thing leaves when it breaks (D9). */
  recovery: number
  /** How many things one effect may make at once (a runtime guard; default 64). */
  spawnMax?: number
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
  /** How far a hand or a thing used reaches when the thing does not say (`handsRange` on what is handled, `range` on what is used): cells round, the actor's own included. */
  reach?: number
  /** How far one takes and puts things (F, G): cells round, the actor's own included. */
  carry?: number
  /** How many of a body's wearing slots there are of a kind, where more than one (two hands, two rings): `wear:ring`, `wear:ring.2`. */
  slotCount?: Record<string, number>
  /** The story's fact that lengthens the night by so many hours (a number; the Ford's `night.shift`): none, the night keeps its length. */
  nightFact?: string
  /**
   * Gear's levels (world-model.md §6.8, 2026-10-13): a piece of gear has a `level` from 1 to `max`; each level above the
   * first adds `perLevel` to the factor on its main stats (power, defence, attack: ×(1 + perLevel·(level − 1)); its
   * shares — a crit chance, a dodge — half as much), and `affixPerLevel` to the factor on what its rolled extras may
   * reach; `affixCount` is how many extras a piece of each quality rolls (a quality not named: the table's count).
   */
  gearLevels?: { max: number; perLevel: number; affixPerLevel: number; affixCount?: Record<string, number> }
}

/** The spaces of a cell (world-model.md §5.2): what one stands on, what fills it, what roots in it, a body. */
export type Space = 'floor' | 'soil' | 'volume' | 'body'

/**
 * The pictures a status may draw over what has it (the client's vocabulary): a status the content or a
 * patch defines picks one, and whatever it is, it shows.
 */
export const OVERLAYS = ['fire', 'flame', 'ice', 'spark', 'wet', 'oil', 'mend'] as const

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
  /** What the client draws over a thing that has it: one of OVERLAYS (an unknown one draws nothing). */
  overlay?: string
  /** What it adds to its holder's stats while held (world-model.md §6.8): fireproof's resistance to fire. */
  props?: Record<string, number>
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
  /** The modules the game uses (module.ts, docs/engine-split.md §4), installed in this order with every engine made over it. */
  modules?: string[]
  types: Record<string, TypeDef>
  /** What people take as deeds (docs/npc-sandbox.md §2.2), the watches, the numbers of their social life. */
  deeds?: DeedDef[]
  laws?: Record<string, LawDef>
  social?: SocialParams
  /** What a felled creature's kind leaves its feller beyond the rules' spoils: its own piece's pity and words (the loot module). */
  loot?: LootParams
  /** The verbs of the talk panel (docs/npc-sandbox.md §2.9): each offered when its condition holds (host: the one spoken to; actor: the speaker). */
  talk?: TalkVerb[]
  statuses: Record<string, StatusDef>
  terrains: Record<string, TerrainDef>
  elements: string[]
  /** Each element's resistance: the stat that takes a share of its harm away (percent; below 0, more harm), world-model.md §6.8. */
  resistances?: Record<string, string>
  vfx: string[]
  /** Tags an instance may carry beyond its type's (materials, qualities…); used by conflict checks. */
  instanceTags?: string[]
  /** Factions (an actor belongs to those its `faction:<id>` tags name) and whom each is hostile to. */
  factions?: Record<string, FactionDef>
  /** Professions by id (the `profession` prop, an item's `profession:<id>` tag), for their names. */
  professions?: Record<string, { name: Text }>
  /** Numeric lines that are events when a prop crosses them (design.md §5.7: threshold). */
  thresholds?: ThresholdDef[]
  /** The materials things are made of, by id. */
  materials?: Record<string, MaterialDef>
  /** The qualities made things have. */
  qualities?: QualityDef[]
  /**
   * Sets of gear (`props.set` on each piece): worn together, so many pieces give more (World.stat adds each bonus whose
   * `pieces` the worn count reaches) — the sum of its `props`, read as any worn number is.
   */
  sets?: GearSet[]
  /** Gear's rolled extras (affixes.ts): how many a piece rolls when it is made, and from what. */
  affixes?: AffixTable
  /**
   * The creatures' own skills (the kits module, docs/creatures.md), by type: a kind's kit is the nearest its type or an
   * ancestor names. How a skill is aimed and timed is here; what it does where it lands is its host's rule (`act/use`
   * with the param `kit`).
   */
  kits?: Record<string, KitSkill[]>
  /**
   * The boss fights (the kits module, docs/skills.md), by type (the nearest its type or an ancestor names): the phases
   * that take its kit's skills up in turn. A type with one is fought as a boss: its plate, the camera, the music.
   */
  encounters?: Record<string, EncounterDef>
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
  /** The order goals are tried in for a thing whose type does not say (world-model.md §6.10). */
  goals?: string[]
  /** The looks bodies are drawn from (docs/looks.md): bodies, parts, colours. */
  looks?: LookTable
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
  /** When: at night, however long the story's night has grown (World.isNight; instead of hours). */
  night?: boolean
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
  /** The event's `name` param ("broken", "hungry"). */
  name: string
  prop: string
  /** Crossed when the value comes to this or below. */
  lte?: number
  /** Or crossed when it comes under this share of another prop of the thing (hungry: under 60 % of maxHunger). */
  below?: { prop: string; mul: number }
  /** Crossed back as well: the value rises over the line again (the event's param `way` is `up`). */
  both?: boolean
}

export interface PeriodDef {
  name: string
  /** Ticks between events. */
  every: number
  /** Things on the active map that have it (a selector), or a resident host. */
  host: Selector | 'world' | 'story'
  /** A prop on the host that overrides `every` for it (Iron Stomach's slower hunger: `hungerEvery`). */
  everyProp?: string
  /** Statuses that slow it for a host that has them: its interval times this (asleep, hunger comes four times slower). */
  paceBy?: Record<string, number>
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
  /** NPCs: schedule + role. */
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
  /** The skill bar (the one at the keys): the active skills set in its six slots (Shift+1–6), by id. */
  skillbar?: (string | null)[]
  /** The player: the selected slot (what is held). */
  selected?: number
  /**
   * How an actor looks: a look record (its body, a part per slot and a colour per colour key; the map
   * sprite, the portrait and the look's tags and words are all drawn from it, docs/looks.md), or the key of
   * a whole drawn sheet in the client's catalogue (a figure no parts make: a skeleton, a statue).
   */
  look?: string | Look
}

/**
 * A skill of a monster's kit (the kits module, docs/skills.md): one definition for the minor monsters and the bosses.
 * Here is where it aims, how long it winds up on the cells it marks, how it moves and when it may be taken up; what
 * lands is its host's rule (`act/use` with the param `kit`, answered with `unleash`). Ticks at 10 a second.
 */
export interface KitSkill {
  id: string
  name: Text
  /**
   * The cells it marks: a disk around its centre (`circle`), the square outline `radius` out (`ring`), a line ahead of
   * it (`line`, `radius` long, `width` wide), a cone ahead (`cone`), a cross through its centre (`cross`), its centre and
   * the four cells `radius` out along the axes (`spots`, each a disk of `spot`).
   */
  shape: 'circle' | 'ring' | 'line' | 'cone' | 'cross' | 'spots'
  /** Its centre: the creature itself, or the foe's cell when it winds up (locked: a foe that moves away is missed). */
  aim: 'self' | 'target'
  radius: number
  /** A line's width (odd; default 1). */
  width?: number
  /** Each spot's radius (`spots`; default 0: one cell). */
  spot?: number
  /** Cells out of its line of sight from where it winds up (behind a rock, a wall) are spared, and so are cells nothing can stand on. */
  occlude?: boolean
  /**
   * How it gets there: it leaps onto the aimed cell (a free one beside it when that is taken), dashes along the line to
   * the first foe or the first thing in the way, or blinks beside the aimed cell. Without it, it stands where it is.
   */
  move?: 'leap' | 'dash' | 'blink'
  /** Having hit, it springs back so many cells from the one it struck (a bat's swoop). */
  back?: number
  /** The foe's distance (in cells, the greater axis) at which it may take the skill up: [nearest, farthest]. */
  range?: [number, number]
  /** A line or a cone, and a dash, is taken up only when the foe stands in a row or a column with it. */
  aligned?: boolean
  windup: number
  /** Ticks it stands after the skill lands before it acts again (an encounter's; a minor monster rests a moment). */
  recovery?: number
  /** Ticks before it may take this skill up again. */
  cooldown?: number
  /** The chance it takes the skill up when it could (looked at once a second): default 1. */
  chance?: number
  /** Taken up only under this share of its full health (a crab that shells up when hurt). */
  below?: number
  /** Held, stunned or frozen, it keeps the skill and its wind-up waits (otherwise the skill is lost). */
  steady?: boolean
  /** Another skill of the same kit it winds up as soon as this one lands, aimed afresh (a second arrow, a second wave). */
  then?: string
  /** The marks' colour (0xRRGGBB); default the warning red (an encounter's: its plate's colour). */
  color?: number
  /** The pose an encounter's body takes (its sheet's row): a blow with its own weapon, or a cast. */
  action?: 'attack' | 'cast'
  /** A drawn clip of its own on a sheet that has more than the two poses (the White Knight's volley). */
  clip?: string
  /** The effect drawn where it lands (an `onto.vfx` key): without one, a burst by its element. */
  fx?: string
  /** Where the effect is drawn: on every marked cell, or one beam along a line. Default: a few markers. */
  fxPlacement?: 'pattern' | 'beam'
}

/** The minor monsters' name for a kit skill (docs/creatures.md). */
export type CreatureSkill = KitSkill

/** A phase of an encounter: from this share of its full health down, the skills it takes up in turn. */
export interface EncounterPhase {
  /** The share of full health at which it begins (the first: 1). */
  at: number
  /** Its skills (ids of the kit), taken up in this order, again and again. */
  rotation: string[]
  /** A skill it takes up once, as the phase begins, before the rotation. */
  enter?: string
  /** Its wind-ups, recoveries and blows, scaled (default 1). */
  windupMul?: number
  recoveryMul?: number
  powerMul?: number
}

/**
 * A boss fight (the kits module, docs/skills.md), by type: the kit's skills taken up by a director — a rotation in each
 * phase, a skill as a phase begins, and between the rotation's steps the skills that answer where its foe stands
 * (taken up as a minor monster's are). Its body (health, size) is its type's.
 */
export interface EncounterDef {
  /** How far it sees its foe, and how far it keeps from where it stands (default: its own `ai`). */
  sight?: number
  leash?: number
  /** Its health plate: the colour, and the seal it bears (the Seal-bearers, 1–5). */
  plate: { color: number; seal?: number }
  phases: EncounterPhase[]
  /** Skills taken up between the rotation's steps when their own conditions hold (range, cooldown, chance). */
  reactive?: string[]
  /** The least a wind-up and a recovery may be, however its phase scales them (default 8 and 6 ticks). */
  floors?: { windup?: number; recovery?: number }
}

/** An encounter's behaviour memory (the kits module's director): where it is in its fight. */
export interface BossState {
  /** The phase it has come to (it never goes back, healed). */
  phase?: number
  /** The phase whose opening skill it has taken up. */
  opened?: number
  /** Its place in the phase's rotation. */
  step?: number
  /**
   * What the wind-up under way was taken up as: a phase's opening or a step of the rotation. A wind-up is behaviour
   * memory and a save loses it; the director, finding this without one, gives the opening or the step back.
   */
  winding?: 'open' | 'step'
  /** Not before this tick does it take up the next. */
  nextAt?: number
  action?: 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'death'
  actionTick?: number
  actionEnd?: number
  /** The skill it last took up (its id), and the clip it is drawn with. */
  skill?: string
  clip?: string
}

/** How long one counts as fighting after the last blow, either way, or the last hostile one that came after it (ticks: five seconds). */
export const FIGHT_TICKS = 50

export interface CombatState {
  /** When it last fought: struck at an actor, was struck by one, or was chased by a hostile one (the `fighting` condition). */
  fightTick?: number
  lastMoveTick?: number
  lastAttackTick?: number
  lastHurtTick?: number
  /** Who struck it last, and what they were (kept when they are gone): who felled it, when it falls. */
  lastHurtBy?: Id
  lastHurtByType?: string
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
  /** Relics (a Stigmatic piece's power): Starfall's hits toward the fifth, the gale's speed until, the Unfallen Wall's last turned blow. */
  starHits?: number
  galeUntil?: number
  unfallenTick?: number
  /** Active skills (actives.ts): Gale Step's speed, a War Cry's guard and strength, a Smoke Bomb's veil — until these ticks. */
  hasteUntil?: number
  rallyUntil?: number
  veilUntil?: number
  /** Envenom: so many more blows open a bleed. */
  envenomHits?: number
  /** Arrow Rain: volleys still to fall on a 3×3 around (x, y), the next at tick `next`. */
  rain?: { map: string; x: number; y: number; next: number; left: number; power: number; element?: string }
  /** Iron Guard: blows taken much lighter, steps slower, until this tick. Hawk Eye: reach and criticals, until this tick. */
  ironUntil?: number
  aimUntil?: number
  /** Creatures it has felled (the talents that answer a defeat: actives.ts onDefeat), and casts made (Elemental Master). */
  defeats?: number
  casts?: number
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
  /** The work the activity is (world-model.md §6.10): real acts on what is about, tried in order. */
  work?: WorkDef[]
}

/**
 * A piece of work (world-model.md §6.10, D26): the act a person does, with the player's own acts,
 * on the nearest thing that fits within `radius` of their anchor (a woodcutter's axe on a tree),
 * with what they carry that fits `holding`.
 */
export interface WorkDef {
  verb: Verb
  target: Selector
  holding?: Selector
  radius: number
  /** A condition on the worker (the host) the work waits for: carrying fewer than six logs. */
  when?: Cond
}

export interface NpcData {
  role: string
  home?: Pos
  schedule: ScheduleEntry[]
  lines?: Text[]
  faction?: string
  /** A person's record (docs/game-design.md §5); crowd NPCs may have none. */
  person?: PersonData
  /** A detour a rule ordered (`goto`): this anchor until the tick, whatever the schedule says. */
  override?: { map: string; x: number; y: number; until: number; activity: string }
  /** Where the person has moved to live (the society module's `moveIn`, a home ground's resident): this place and its
   * days, over every schedule variant (a detour still goes first), until they move again. */
  resident?: { map: string; slot: string; schedule: ScheduleEntry[] }
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

/** What a person remembers (their own record): what they said, what they saw and heard, what they think of others. */
export interface NpcMemory {
  /** keys (or texts) of once-only and topic lines already said */
  said?: string[]
  /** the last line said, not repeated next time */
  last?: string
  /** the day they were last talked to */
  talked?: number
  /** What they know was done (docs/npc-sandbox.md §2.4): seen or heard, newest last. */
  deeds?: DeedMemory[]
  /** What they think of others, by id (−100..100; missing: their start), and when each last changed (it fades back from there). */
  regard?: Record<Id, number>
  regardAt?: Record<Id, number>
  /** Whom they know by sight (met, talked to, seen close in daylight). */
  met?: Id[]
  /** The day each was last talked to, by id (talking raises regard once a day). */
  chatted?: Record<Id, number>
  /** Whom they fear for now (they saw them do violence): run from them until the tick. */
  afraid?: Record<Id, number>
}

/** A deed a person knows of: what was done, by whom (or how they looked), to whom, and how they know. */
export interface DeedMemory {
  /** The deed's id (the world's `deeds`). */
  deed: string
  /** Who did it, if they knew them. */
  by?: Id
  /** How the doer looked, when they did not know them (a hood hides the hair): matched later against who they see. */
  desc?: Look
  /** That look in words, for what they say. */
  words?: string
  /** Against whom: a person's id, or `household:<h>`. */
  against?: string
  /** What it was done to or with (the thing taken). */
  thing?: Id
  /** The thing's name then (it may be gone since). */
  what?: Text
  map: string
  x: number
  y: number
  tick: number
  /** Seen with their own eyes (else heard). */
  firsthand: boolean
  /** The fine the watch would charge for it. */
  fine: number
  /** Told to the watch; settled (given back, paid for, forgiven). */
  reported?: boolean
  settled?: boolean
  /** Whom they have told it to. */
  told?: Id[]
}

/**
 * A kind of deed (docs/npc-sandbox.md §2.2): what in a `seen` event makes it one — a condition on the event
 * (roles actor, target, instrument; params act, owner: mine|ours|another|nobody, from: person|container|ground,
 * harm, killed, presence) — and what it costs: a fine (`value`: half the thing's worth) and the regard it takes.
 */
export interface DeedDef {
  id: string
  name: Text
  /** How it is told ({who} did it, against {whom}, to {what}): "{who} stole {what} from {whom}". */
  told?: Text
  when: Cond
  fine: number | 'value'
  /** Regard lost by its victim (others who learn of it lose a share). */
  weight: number
  /** Violence: those who see it fear the doer; the fighting answer. */
  violent?: boolean
  /** The worst first: a deed matched earlier hides the lesser ones in the same act (murder hides assault). */
  rank: number
}

/** A verb of the talk panel: what it is called, when it is offered, and its sub-choices (a request's). */
export interface TalkVerb {
  id: string
  /** What the panel says ({bounty}, {bribe}, {name} are filled in). */
  label: Text
  /** Offered when this holds (host: the one spoken to; actor: the speaker). */
  when?: Cond
  /** A guard's, offered only when the guard has stopped the speaker (an arrest), and then only these. */
  arrest?: boolean
  choices?: { id: string; label: Text; when?: Cond }[]
}

/** A watch (docs/npc-sandbox.md §2.7): who keeps the law on its maps, and where it keeps those who will not pay. */
export interface LawDef {
  id: string
  name: Text
  /** Where its jail is: a map and an anchor on it. */
  jail?: { map: string; anchor: string }
  /** A bounty this high is not talked or bought away (a murderer's). */
  unpardonable?: number
}

/**
 * The loot module's numbers and words (packages/modules/src/loot): a creature kind's own piece of gear (its type's
 * `trophy` prop, found by its `trophyChance`) comes to the one who fells it by that chance, or surely after so many.
 */
export interface LootParams {
  /** How many of a kind one fells without its piece before the next surely gives it (default 50; the count is the feller's `trophy.<type>`). */
  pity?: number
  /** What the one at the keys is told when a piece comes to them (`{item}`: its name); none, only the piece's pickup is shown. */
  found?: Text
}

/** The numbers of the people's social life (data, docs/npc-sandbox.md): the engine holds the mechanisms. */
export interface SocialParams {
  /** The coin trade and fines are paid in. */
  coin: string
  /** Regard one starts with toward a stranger, and toward one tied to them. */
  regardStart: number
  regardTie: number
  /** Talking raises regard by this once a day (harder as it rises). */
  talk: number
  /** How fast regard fades back to its start, each day (a share of the way). */
  fade: number
  /** Ticks between two rounds of gossip, and how many days a deed stays worth telling. */
  gossipEvery: number
  gossipDays: number
  /** Ticks between two looks about (trespass, the wanted, a drawn blade, a familiar description). */
  perceiveEvery: number
  /** How long one fears a violent doer, in ticks. */
  fearTicks: number
  /** How much a merchant asks over a thing's value, and pays under it; and a fence's share for what is not yours. */
  markup: number
  markdown: number
  fence: number
  /** How fast regard above its start fades back, each day (a share of the way): slower than a grudge heals. Default `fade`. */
  fadeUp?: number
  /** The share off what a merchant asks one it holds in full regard (100), and in proportion below (default 0.2). */
  discount?: number
  /** Where people held in full regard may be asked to come and live (a home ground): `moveIn`. */
  residence?: ResidenceDef
}

/**
 * A home ground's room for people (the society module's `moveIn`): its map and the beds it has, each an anchor there
 * (where the resident sleeps; `<anchor>.day` where their day is spent, else the same), open once its fact holds; a
 * resident's day there; what the one asked says, moved in or with no bed free.
 */
export interface ResidenceDef {
  map: string
  /** The regard (of the one asked toward the one asking) it takes: one a liking keeps for days as it fades. */
  at: number
  slots: { anchor: string; when?: string }[]
  /** A resident's day there, hour by hour: each span spent at its bed (`bed`) or its bed's day place (`day`), and doing what. */
  days: { from: number; to: number; at: 'bed' | 'day'; activity: string }[]
  yes: Text
  full: Text
}

/** Something that happened, which people may talk about while it is fresh. */
export interface Topic {
  id: string
  day: number
  /** days it stays fresh (default 4) */
  days?: number
}

/** A scripted scene (docs/game-design.md §8.6): the arrival, the ferry, the far bank. */
/**
 * What starts a step of the story's script (world-model.md §6.12), on the one at the keys (the
 * leader) and the story: all that is given must hold.
 */
export interface StepCond {
  /** The leader is on this map. */
  map?: string
  /** The leader stands in this region (of `map`, else of their map): looked at when they enter it, and as a step plays — never polled. */
  region?: string
  hour?: { from: number; to: number }
  weather?: string[]
  /** The story's facts. */
  facts?: Record<string, Cmp>
  /** The leader's props. */
  props?: Record<string, Cmp>
  /** Quests' stages (0 before one begins; a quest over keeps the stage it ended at): docs/quests.md. */
  quest?: Record<string, Cmp>
  /** Quests' objectives done (`quest.objective`: the warden down, Fennick heard). */
  objectives?: string[]
  /** The leader carries (hand or bag) something of a type starting with this (each of these, for a list). */
  carrying?: string | string[]
  /** The leader has (true) or has not (false) these statuses (out cold, down). */
  statuses?: Record<string, boolean>
  /** The leader has learned a skill: any (true) or this one. */
  skill?: boolean | string
  /** Another step has played. */
  after?: string
  /** Something of a type starting with this stands within r tiles of the leader (in view), with this status if one is named (a lit fire); `exact`: of that type itself (a shut door, not an open one). */
  near?: { type: string; r: number; status?: string; exact?: boolean }
  /** The leader holds (in hand) something of a type starting with this. */
  holding?: string
  /** The leader stands within r tiles of this spot (of their map). */
  spot?: { x: number; y: number; r?: number }
  /** At least `count` (1) things of a type starting with this stand on these cells of the leader's map. */
  on?: { type: string; cells: [number, number][]; count?: number }
  /** A room with this role (bedroom, kitchen …) stands on the leader's map. */
  room?: string
  /** The first morning (05:00, when the night ends) after another step played has come. */
  morningAfter?: string
}

/**
 * What a lesson lets the keys do (docs/prologue.md, the drills): moving, the five inputs, choosing
 * a toolbar slot, making (C), setting a thing down from the build palette (B) and its turn (R), and
 * the panels (the bag, the map). The input's own concern: which actor the keys move is not asked.
 */
export type LessonInput = 'move' | 'hands' | 'take' | 'put' | 'use' | 'self' | 'select' | 'craft' | 'build' | 'rotate' | 'bag' | 'map' | 'chooser'

/**
 * One lesson of a guide's stage (docs/prologue.md, the drills): it teaches one thing by the deed — what
 * is shown (a thing spotlit, the key drawn over it), what the keys may do meanwhile, and the state that
 * ends it. A guide's stage holds its lessons in order; the one at hand is the first not yet done (the
 * story keeps `lesson.<id>`).
 */
export interface Lesson {
  id: string
  /** The companion's one short line as it begins. */
  say?: Text
  /** The key drawn over the focus ('F', 'LMB', 'RMB', 'E', 'C', 'B', 'R', '1', 'WASD', 'Tab', 'M', 'hold G'). */
  key?: string
  /** What is spotlit: the nearest thing of a type (with a status), the nearest cell of a terrain (nearest to `from`, else to the leader: the grove's trees, not the forest's rim), the leader, a spot, cells (an outline), or a panel's part (`ui`). */
  focus?: { type?: string; status?: string; terrain?: string; from?: [number, number]; self?: boolean; spot?: [number, number]; cells?: [number, number][]; ui?: string }
  /** While it lasts, only these inputs work (the rest do nothing; the key shakes). None: every input works. */
  allow?: LessonInput[]
  /** Making and setting down: only these (a recipe's or a type's id, a placement recipe's id). */
  only?: string[]
  /** Setting down what `only` names: only on these cells. */
  cells?: [number, number][]
  /** Done when this holds (state, never path). */
  done: StepCond
}

/**
 * A step of the story's script (world-model.md §6.12): when its trigger holds it plays, once (or
 * once a day); it may take control while it plays (a scene: its `script`) or not (a beat); its
 * effects are the story's own props and the notices it sends.
 */
export interface StepDef {
  id: string
  when?: StepCond
  /** Played only when something starts it (a `scene` effect: the ferry), never by itself. */
  manual?: boolean
  /** Again each day its trigger holds (default: once). */
  repeat?: boolean
  /** It takes control while it plays: what is said and done, in order. */
  script?: SceneCmd[]
  /** The story's facts it sets. */
  facts?: Record<string, PropValue>
  /** Said by the leader's companion, in a bubble, when it plays. */
  say?: Text
  /** What the companion says when spoken to while this is the latest beat (default: `say`). */
  hint?: Text
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
  | { give: string; count?: number }
  | { warp: string; x: number; y: number }
  /** add or remove a status on an entity (the Hearth goes out: remove 'lit') */
  | { status: Id; add?: string; remove?: string }
  /** tell a quest to reach a stage (its own rule answers: docs/quests.md) */
  | { stage: string; n: number }
  /** tell someone something (a notice they answer themselves: the fairy given a boon) */
  | { tell: Id; params: Record<string, PropValue> }
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

/**
 * A look (docs/looks.md): what a body is drawn from — the one record its map sprite, its portrait and its
 * look's tags and words all come from, so they cannot disagree. Parts and colours are the ontology's
 * (`Ontology.looks`); their pictures are the client's.
 */
export interface Look {
  /** The body (`LookTable.bodies`): its frame on the map and its bust in the portrait. */
  body: string
  /** A part per slot (`LookTable.parts`; the slot is the part's own): hair, face, outfit, hat, beard, mark, glasses… */
  parts: Record<string, string>
  /**
   * A colour per colour key: `skin`, `hair`, `eyes`, and a part's own as `<slot>.<n>` (`outfit.1`); a colour of
   * `LookTable.colors` by id, or `#rrggbb`. A key no colour is given for takes the part's default.
   */
  colors: Record<string, string>
  /** Changed in the world (`restyle`): the world's own design of this person no longer replaces it on load. */
  own?: boolean
}

/** A body a look may have: its sex and age as a body shows them, and what it says of its bearer. */
export interface LookBodyDef {
  name: Text
  sex: 'female' | 'male'
  age: 'child' | 'adult'
  tags?: string[]
}

/** A part of a look: the slot it fills, the bodies it fits, the colour keys it is painted in, and its tags. */
export interface LookPartDef {
  slot: string
  name: Text
  /** The bodies it is drawn for (omitted: every body). */
  bodies?: string[]
  /** Its own colour keys' defaults (`1` → a colour id) and the shared keys it uses (`hair`, `skin`, `eyes`). */
  colors?: Record<string, string>
  uses?: ('skin' | 'hair' | 'eyes')[]
  tags?: string[]
}

/** A named colour: what it is called, and the tags it gives the key it colours (silver hair → `look:grey-haired`). */
export interface LookColorDef {
  hex: string
  name: Text
  /** Families it is offered for: hair, skin, eyes, cloth, metal. */
  for: string[]
  tags?: Record<string, string[]>
}

/** The looks a world knows (Ontology.looks): bodies, parts and colours; the engine checks a look against it and derives its tags. */
export interface LookTable {
  slots: string[]
  bodies: Record<string, LookBodyDef>
  parts: Record<string, LookPartDef>
  colors: Record<string, LookColorDef>
  /** The colour a worn thing shows in, by its material (an iron helmet is iron-grey): `#rrggbb` or a colour id. */
  materials?: Record<string, string>
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
  /** A goal no way led to (one shut in a house): it does not look for a way there again until then. */
  noWay?: { x: number; y: number; until: number }
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
  /**
   * The cell whose ceiling (the floor of the storey above) is drawn at the point: the view's to say,
   * as `stack` is (a storey up is drawn a tile up). The ceiling, chosen, is laid or taken there
   * (docs/building.md §5); without it, over the cell aimed at.
   */
  over?: { x: number; y: number }
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
  /** Fish shadows glide in its water now and then: the water is worth a line (a stocked pond). */
  fish?: boolean
  /** Named spots ('square.well') for schedules, scenes and authors. */
  anchors?: Record<string, [number, number]>
  /** The watch that keeps the law here (docs/npc-sandbox.md §2.7). */
  law?: string
  /** Named areas [x, y, w, h] ('far_bank') for scenes and goals. */
  regions?: Record<string, [number, number, number, number]>
  /** What a named area is beyond its cells (docs/npc-sandbox.md §2.1): whose it is (`owner`), whether it is `private`. */
  regionProps?: Record<string, Record<string, PropValue>>
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
  /** An active skill: cast from the skill bar (Shift+1–6), then it rests (actives.ts). */
  active?: ActiveDef
  /**
   * A talent that strengthens an active skill (Dungeon Fighter's "enhancements"): learned, its numbers are added to
   * the skill's when it is cast (actives.ts effectiveActive) — a shorter cooldown, more power, reach, hits or time.
   */
  modifies?: { skill: string } & Partial<Pick<ActiveDef, 'cooldown' | 'power' | 'range' | 'count' | 'ticks' | 'radius'>>
}

/**
 * What an active skill does when cast (engine/src/actives.ts implements each kind; content sets the numbers).
 * `power` multiplies the caster's blow (its atk and its weapon's power); `ticks` is how long what it leaves lasts.
 */
export interface ActiveDef {
  kind:
    | 'whirlwind' | 'cleave' | 'haste' | 'mend'
    | 'shadow-strike' | 'envenom' | 'veil' | 'flurry'
    | 'bash' | 'charge' | 'rally' | 'quake'
    | 'multishot' | 'leap-shot' | 'pierce' | 'rain'
    | 'fireball' | 'nova' | 'chain' | 'blink'
    | 'shot' | 'arc' | 'guard' | 'aim' | 'slam'
  /** Ticks before it can be cast again (10 a second). */
  cooldown: number
  power?: number
  /** Tiles it reaches (a dash's length, a search's radius; a shot's or a bolt's at least, the weapon's when farther). */
  range?: number
  /** How long what it leaves lasts (a status, a buff), in ticks; how many (hits, volleys, targets) for counts. */
  ticks?: number
  count?: number
  /** A status a blow of it leaves (stunned, frozen). */
  afflict?: string
  /** The element its blows carry (fire, ice, lightning). */
  element?: string
  /** Ticks a blow of it makes the struck bleed (a Fan of Knives). */
  bleed?: number
  /** A burst's half-width: a Fireball's (1: 3×3) or a Meteor's (2: 5×5). */
  radius?: number
  /** Its arrows fly through every body in their line (an Arrow Storm). */
  through?: boolean
  /** What is drawn in flight (a shot's): arrow, knife, ice. */
  missile?: string
}

/** A set of gear: its pieces carry `props.set: id`; worn together they give its bonuses. */
export interface GearSet {
  id: string
  name: Text
  /** How many pieces it has. */
  pieces: number
  bonuses: { pieces: number; props: Record<string, number>; text: Text }[]
}

/** A recipe for the crafting panel: the carried items it uses up, and the item it makes. */
export interface Recipe {
  id: string
  name: Text
  sprite: string
  /** What it uses up: its makeup (the first part is the main ingredient, whose material it takes). */
  needs: { type: string; count: number }[]
  /**
   * What it makes. A bare type is made of the main ingredient's material at the quality its maker reaches; a `make`
   * that names, tags or gives props to what it makes is made as it says, unless `madeOf` asks for both.
   */
  make: Omit<Entity, 'id' | 'place'>
  /**
   * What it makes is made of its main ingredient at the quality its maker reaches (its material and quality tags), with
   * `make`'s name, tags and props laid over that: a set's piece, forged of the steel it took, as well as its smith forges.
   */
  madeOf?: boolean
  /** Where it is made: `hands`, or a station within reach. */
  station?: string
  level?: number
  /** Tools it needs carried (tags), not used up. */
  tools?: string[]
  /** How many one making gives (default 1). */
  count?: number
  /** The shelf of a shop it is offered on (a shelf's `group`: the runtime's ClientGame.crafting.shops, which says whether the shelf buys). */
  group?: string
  /** A skill its maker must know (a recipe a skill teaches: steel, jewellery). */
  skill?: string
  /** A stat of the maker's that makes it give more: so many times more (a smelter's `smelt`, a farmer's `sell:farm`). */
  bonus?: string
}

export interface Portal {
  x: number
  y: number
  to: string // map id
  tx: number
  ty: number
  label?: Text
  /** A story fact that must hold for the way to be open (until then the tile is only ground): a way out the story opens. */
  opensWhen?: string
}

/** A cell of an older save as it was: its terrain and statuses (world-model.md §4.6 migration). */
export interface LegacyTile {
  x: number
  y: number
  terrain?: string
  statuses?: Record<string, number>
  statusBy?: Record<string, Id>
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
  /** Learned rules set aside for misbehaving at runtime (the engine's guards): their holes are open again. */
  quarantine?: Record<string, { tick: number; reason: string }>
  /** A yes/no question waiting for the player (Action: "Eat the apple?"); time stops while it is open. */
  question?: { text: Text; plan: Plan }
  /** Maps the player is not on: frozen since a tick, with the events addressed to them (design.md §5.12). */
  dormant?: Record<string, { since: number; inbox: GameEvent[] }>
  /** Each host's relations (contact and containment) when last computed: `how|ref` keys. */
  relations?: Record<string, string[]>
  /**
   * An older save's changed cells, by map, not yet made things (its data has not come since the
   * save was upgraded): kept in the state so a save before the map is entered keeps them.
   */
  legacyTiles?: Record<string, LegacyTile[]>
  /** Maps whose relations an older save kept in another form, not entered since: they start again from where things stand. */
  reseed?: string[]
}

// ------------------------------------------------------------------ the player's inputs

/**
 * What one of the player's inputs will do (design.md §5.2), chosen by dry runs through the rule
 * library: the HUD shows its label before the input is pressed, and pressing runs it.
 */
export interface Plan {
  /** The act's input: E (hands), F (take), G (put), left click (use), self (the held thing used on oneself); the right click (the action) makes one of them. */
  key: 'hands' | 'take' | 'put' | 'use' | 'self'
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
  /** Undefined, but the AI setting leaves this kind of work to the leaf's default (quality.ts): no one will be asked. */
  quiet?: boolean
  /** A learned answer decides it (a patch filled a hole the base rules leave): the action chooses as the base answers. */
  learned?: boolean
  /** It would change something (taking and putting are offered only then: a refusal is no option). */
  changes?: boolean
  /** Ask first ("Eat the apple?", "Sleep until morning?"). */
  confirm?: Text
  /** Hands on a container: open the transfer panel for it. */
  panel?: Id
  /** It sets what is held down where it is aimed (the cell takes it): G, or the left click with a built thing (it builds). */
  sets?: boolean
  /** It takes what is another's (docs/npc-sandbox.md §2.1): the HUD says so. */
  steal?: boolean
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
   * timer's `status` and scheduled `at`; a threshold's `status` or `name`; a seen act's `act` and `owner`; stuck's
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
  /** The chain it belongs to (engine-assigned): the event that began it, through every outcome it set off. */
  chain?: number
  /** The rule whose outcome made it (engine-assigned): what the guards charge when a chain runs away. */
  by?: string
  /** A number the termination check gives it, kept by its copies (one waiting for a later tick). */
  seq?: number
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
  /** The first role leads the second: the second follows it (a companion's own `companion` prop names it, a person's `follow`). */
  | { leads: [RoleName, RoleName] }
  | { has: { role: RoleName; status?: string; tag?: string } }
  /** A role's prop compared to a value, or bounded by other numbers. A missing prop is false. */
  /** `default` is read when the prop is missing (a fact the story has not set reads 0 with `default: 0`). */
  | { prop: { role: Reader; key: string; cmp?: Cmp; bounds?: Bounds; default?: PropValue } }
  /** An event parameter compared to a value (a missing parameter is false). */
  | { param: { key: string; cmp: Cmp } }
  | { chance: number }
  | { hour: { from: number; to: number } }
  /** It is night (true) or day (false), however long the story's night has grown (World.isNight). */
  | { night: boolean }
  /** How many entities (matching `match`) are in a role's contents, or on its tile besides itself. */
  | { count: { role: RoleName; in: 'contents' | 'tile' | 'map'; match?: Selector; cmp: Bounds
      /** Count the slots they take rather than the things: a slot holds STACK_MAX of one stack key. */
      stacks?: boolean
      /** Count as if one more of this role's thing were among them (does the one at hand still fit). */
      adding?: RoleName } }
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
  /** The role's thing is worn by the one who carries it (in one of its slot's keys). */
  | { worn: RoleName }
  /** A role has a relation now (world-model.md §7): `on`, `support`, `in-region` … */
  | { rel: { role: RoleName; how: string } }
  /** A role is fighting: it struck at an actor, was struck by one, or was chased by a hostile one, in the last FIGHT_TICKS. */
  | { fighting: RoleName }
  /** What one role thinks of another (docs/npc-sandbox.md §2.4): its regard, −100..100. */
  | { regard: { of: RoleName; toward: RoleName; cmp: Cmp } }
  /** A role's bounty with the watch of where the host is (or any watch, with no host place). */
  | { bounty: { role: RoleName; cmp: Cmp } }
  /** One role holds an unsettled deed against another (done to it or its household; any deed, or one). */
  | { grudge: { of: RoleName; toward: RoleName; deed?: string } }
  /** The first role owns the second (its own, or its household's). */
  | { owns: [RoleName, RoleName] }
  /** The first role knows the second by sight (met, talked to, tied to them). */
  | { knows: [RoleName, RoleName] }
  /** A role keeps a record of its own (what it saw and heard, what it thinks of others): a person whose day is its own. */
  | { remembers: RoleName }
  /** The seen event holds a deed (docs/npc-sandbox.md §2.2): any (true), or the one named. */
  | { deed: string | true }
  /**
   * A roll of one role swaying another (docs/npc-sandbox.md §2.9): `persuade` (its regard, the speaker's level),
   * `intimidate` (their levels and the speaker's arms), as the social numbers say; `bonus` adds to the chance.
   */
  | { sway: { of: RoleName; by: RoleName; how: 'persuade' | 'intimidate'; bonus?: number } }
  /** A role carries coin enough for its bounty with the watch of the host's map, times `mul`. */
  | { canPay: { role: RoleName; mul?: number } }
  /** A role's bounty with the watch of the host's map is past what that watch pardons (a murderer's). */
  | { unpardonable: RoleName }

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
  /** The watch that keeps the law where the host is (docs/npc-sandbox.md §2.7). */
  | 'watch'
  /** The actors within so many cells of the host, on its map (a call for help: at most 12). */
  | { around: number }

/**
 * The effect primitives. Every one writes only the host (design.md §5.6: read anything, write only
 * yourself), spawns, or presents; `emit` sends an event to others, which answer for themselves.
 */
/** The primitives the engine's official modules carry (packages/modules): typed here, worked by their module (module.ts). */
export type ModuleOp = 'unleash' | 'boon' | 'feed' | 'own' | 'witness' | 'tell' | 'hear' | 'regard' | 'settle' | 'fear' | 'report' | 'charge' | 'surrender' | 'die' | 'pay' | 'give' | 'sell' | 'buy' | 'follow' | 'talk' | 'fine' | 'imprison' | 'jail' | 'arrest' | 'restock' | 'calm' | 'moveIn' | 'conscience' | 'moral' | 'trophy'

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
  | { op: 'breakdown'; still?: boolean }
  /** The host (an actor) puts on what it is offered of its own (param item), or takes it off when it is on: one thing to a slot (world-model.md §6.8). */
  | { op: 'wear' }
  /** With nothing under it on its storey, the host drops to the first floor below (and is struck by the drop). */
  | { op: 'fall' }
  /** The host sleeps until it is time to rise (time passes at once for the one at the keys); it wakes with health back as its room gives (a bedroom's `rest`). */
  | { op: 'sleep' }
  | { op: 'heal'; amount: Amount }
  | { op: 'feed'; amount: Amount }
  | { op: 'gainXp'; amount: Amount }
  /** A companion's boon, given (param unlock) or chosen beside an attuned waypoint (param boon): boons.ts. */
  | { op: 'boon' }
  /** Into a pocket place (param map, x, y), remembering where one stood; in it already, back out there. */
  | { op: 'pocket' }
  | { op: 'foe' }
  | { op: 'open' }
  /**
   * The host spills what it holds onto its tile — or into a role's bag (`to`: a bundle opened). `keepWorn`: what it wears,
   * and the weapon in its hand, stay with it; `keep`: so do things with any of these tags (`important`). `bundle`: what
   * is spilled is packed into a new thing of this type on the tile (nothing spilled, none is made); `loose`: things with
   * any of these tags are left lying loose on the tile beside the bundle (coin), not packed into it.
   */
  | { op: 'dropContents'; still?: boolean; to?: RoleRef; keepWorn?: boolean; keep?: string[]; bundle?: string; loose?: string[] }
  | { op: 'goto'; anchor: string; hours: number; activity?: string }
  | { op: 'topic'; id: string; days?: number }
  /**
   * The host (a person, a notice board) is spoken to about quests (docs/quests.md §2.4): a quest under way that the
   * word moves on sees it; else the host says its offer (accept or decline in the talk panel), its quest's waiting
   * line, or its own. Asked with `say: quest` (a talk verb), the offer named (param quest) is accepted or declined,
   * or the quest's topic (param topic) is told to it.
   */
  | { op: 'quest' }
  /** A quest's (docs/quests.md): it sees news, and moves on — counts, objectives, the next stage whose trigger holds. */
  | { op: 'advance' }
  /** A quest's: it reaches a stage (a notice's SetStage), and looks again. */
  | { op: 'stage'; n: Amount }
  /** A quest's: an offer is taken on by the event's actor; or turned down (a radiant one is withdrawn). */
  | { op: 'accept' }
  | { op: 'decline' }
  /** A quest's: past its deadline, or told so — an offer withdrawn, a quest under way failed. */
  | { op: 'failQuest' }
  /** The story's (the Story Manager): it sees news — the quests that begin on it begin, the radiant offers are made. */
  | { op: 'begin' }
  /** The story's or a quest's: a quest begins (`offer`: is offered), its aliases filled; param `quest` names it when `id` does not. */
  | { op: 'startQuest'; id?: string; offer?: boolean }
  /** The story's: the facts it is told (params `fact.<key>`) it keeps. */
  | { op: 'facts' }
  /** The loot module's: a trophy, perhaps (the host felled a creature whose kind keeps one: params trophy, trophyChance). */
  | { op: 'trophy' }
  /** News for the quests (docs/quests.md §2.3): what this event is (its actor, host, item) — a gift handed over. */
  | { op: 'news'; kind: 'give' | 'deed' | 'hungry' | 'talk' }
  /** The world's: what appears by itself on the active map now (its own and the world's appearances), or the one given. */
  | { op: 'appear'; what?: AppearDef }
  /** The host's stage clock ran out (param status): it becomes what its stage says next (world-model.md §6.5). */
  | { op: 'grow' }
  /** The host learns: the skill (param skill) or the profession (param profession) its act names. */
  /** `book`: from a book the host holds (the event's item): no points, but its profession and the skills before it in the tree; the book is used up. */
  | { op: 'learn'; book?: boolean }
  /**
   * The host's kit skill lands (the kits module): it gets there as the skill says (a leap, a dash, a blink), and each
   * foe on the cells its act marked is struck by `power` (with `element` and `edge`), coated with `coat` (a status it
   * answers for itself), pushed `push` cells away or pulled `pull` cells toward where the skill was wound up; the host
   * mends `heal` for each foe it hit; a `leave` thing is made on each marked cell nothing stands on (holding
   * `leaveStatus` from the start: embers already burning).
   */
  | { op: 'unleash'; power?: Amount; element?: PropValue | Amount; edge?: string; coat?: string; push?: number; pull?: number; heal?: Amount; leave?: string; leaveStatus?: string }
  /** Open one of the panels the game's client shows, by its id (profession, board, haven, …), for the one at the keys who spoke to the host. */
  | { op: 'panel'; panel: string }
  | { op: 'scene'; id: string }
  | { op: 'craft' }
  | { op: 'lightning'; power: number }
  /** Send an impulse: `item` names the thing it carries (given, put, taken), `other` the role it names as the other side. */
  | { op: 'emit'; impulse: Impulse; to: EmitTo; params?: Record<string, PropValue | Amount | { typeOf: RoleName } | { idOf: RoleName }>; item?: RoleName; other?: RoleName; chance?: number; filter?: Selector }
  /** Get out of where one cannot be (water closing over the ice): to the nearest free tile. */
  | { op: 'ashore' }
  /** The story's: an invariant's authored fallback (the default of a `broken` outcome). */
  | { op: 'fallback' }
  | { op: 'vfx'; at?: RoleRef; fx: string }
  /** A line said by the host (or, for the story and the world, by one of the event's roles). */
  | { op: 'say'; text: Text; who?: RoleName }
  | { op: 'log'; text: Text }
  | { op: 'emote'; mood: Mood }
  | { op: 'restyle'; parts?: Record<string, string | null>; colors?: Record<string, string | null> }
  // the people's social life (docs/npc-sandbox.md): each writes its host only
  /** The host is someone's now: a role's (absent: nobody's). */
  | { op: 'own'; to?: RoleName }
  /** The host (a seer) takes in what it saw: a deed remembered (who, or how they looked), a face learnt, a stranger known again. */
  | { op: 'witness' }
  /** The host tells a role its fresh news (what it knows was done): the role hears it. */
  | { op: 'tell'; to: RoleName }
  /** The host takes in the news told it (params deeds, from the source). */
  | { op: 'hear' }
  /** The host's regard toward a role (default: the actor) changes by delta: gains come harder as it rises. */
  | { op: 'regard'; toward?: RoleName; delta: Amount }
  /** The host lets go what it holds against a role (default: the actor): its deeds settled (one deed, or all). */
  | { op: 'settle'; toward?: RoleName; deed?: string }
  /** The host fears a role (default: the actor) for a while (the social numbers' fearTicks). */
  | { op: 'fear'; of?: RoleName }
  /** The host tells the watch of where it is the deeds it knows of and has not told yet. */
  | { op: 'report' }
  /** The watch's: the actor's bounty rises by param amount for the deed reported (param key: once a deed); `clear`: paid, pardoned. */
  | { op: 'charge'; clear?: boolean }
  /** The host gives back what it carries that is not its own, each to its owner. */
  | { op: 'surrender' }
  /** The host dies: it becomes its body, a container of what it carried and wore, its household's. */
  | { op: 'die' }
  /** The host pays a role an amount of the world's coin from its bag (as much as it has). */
  | { op: 'pay'; amount: Amount; to: RoleName }
  /** The host gives a role the event's item (from its bag): the role's now. */
  | { op: 'give'; to: RoleName }
  /** The host (a merchant) sells the actor what it asks (param item) for its price: it hands it over, the buyer is told to pay. */
  | { op: 'sell' }
  | { op: 'moveIn' }
  /** The host saw its own deed (a seen event, params own): its karma falls by what the deed weighs. */
  | { op: 'conscience' }
  /** The host's karma or faith moves by delta (−100..100). */
  | { op: 'moral'; key: 'karma' | 'faith'; delta: Amount }
  /** The host (a merchant) buys the instrument the actor offers: it pays, the seller is told to hand it over. */
  | { op: 'buy' }
  /** The host follows a role (its `follow` prop), or (no leader) stops following. */
  | { op: 'follow'; leader?: RoleName }
  /** The host is spoken to: it knows the speaker now, warms to them (once a day), and its talk opens for them. */
  | { op: 'talk' }
  /** The host (a guard) fines the actor its bounty (times mul) here: the actor is told to pay and (unless keep) give back what is not theirs; the watch, that it is paid. */
  | { op: 'fine'; mul?: number; keep?: boolean }
  /** The host (a guard) sends the actor to its watch's jail: told to go and give back what is not theirs; the watch, that it is paid. */
  | { op: 'imprison' }
  /** The host goes to the jail named (params map, x, y) and is held there the hours (param hours): time passes at once for the one at the keys. */
  | { op: 'jail' }
  /** The host (a guard) stops the actor (the one wanted): its watch's choice is the actor's to make (the talk opens), or, not at the keys, the actor yields. */
  | { op: 'arrest' }
  /** The host (a merchant) has its stock again (its `stock` prop: types, by `|`), and its coin back up to its `purse`. */
  | { op: 'restock' }
  /** The host forgets its foes and puts its weapon away (a fight over). */
  | { op: 'calm' }

/**
 * A rule's outcome: a condition tree whose leaves are effects (an empty list: no change),
 * `inherit` (the next less specific rule answers), or undefined (the AI answers; its `default`
 * runs while nobody does). An `if` without `else` inherits.
 */
/** A leaf's `label` says what an input that ends here does ("Eat {instrument}", "Feed {target}"), over the rule's own. */
export type Tree = 'inherit' | { do: Effect[]; confirm?: Text; label?: Text } | { undefined: true; default?: Effect[] } | { if: Cond; then: Tree; else?: Tree }
export type Leaf = Exclude<Tree, { if: Cond }>

export interface RuleTest {
  name?: string
  given: Scenario
  expect: Expectation[]
}

/** A minimal self-contained world used for sandbox replay and rule tests. */
export interface Scenario {
  /** The AI tier the event is replayed at: which learned answers it may take (quality.ts; none: the engine's setting). */
  tier?: Tier
  /** Terrain rows around the origin; default a 5x5 grass patch. */
  terrain?: string[][]
  entities: ScenarioEntity[]
  /** Simulation ticks to run after the event (for spreading/expiry). */
  ticks?: number
  /** Which entity key is the player (default: "actor"). */
  player?: string
  /** Instance props of the story and world, when rules need resident context. */
  residents?: Partial<Record<'story' | 'world', Record<string, PropValue>>>
  /** Cell types and state not supplied by the terrain rows, addressed by space and storey. */
  cells?: { x: number; y: number; z?: number; space?: Space; type?: string; statuses?: string[]; props?: Record<string, PropValue> }[]
  /** The event to replay. Roles refer to entity keys or `tile:x,y[,z][:space]` (a cell's top or a specific space). */
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
  z?: number
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
  | { resolvedBy: string } // the event was answered by this rule (a test that checks the rule answers at all)

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
  /** Whose nature this is: the host's class (empty: anything, the root). A learned rule names one type. */
  host?: Selector
  /** The event kind it answers, or a branch of the kind tree (`impulse`). A learned rule names the exact kind. */
  on: string
  tree: Tree
  /**
   * A learned rule's place (design.md §5.16): the hole it fills (`holeKey`: the base rule and the
   * branch that reached it), and `at`, the path in its host type's tree to the undefined leaf it
   * replaces (none or empty: it is the tree's first answer). Set from the request, never written by hand.
   */
  hole?: string
  at?: string[]
  /**
   * A learned rule's tier: the AI setting it was answered at (quality.ts; none: medium). Each tier
   * keeps its own trees; an answer serves its own tier and every lower one, never a higher.
   */
  tier?: Tier
  /** Ask the player first when their input chooses this rule ("Eat {instrument}?"). */
  confirm?: Text
  /**
   * What an input that this rule answers does, as the HUD says it before the press ("Talk to
   * {target}", "Enter {target}"): {target}, {instrument} and {actor} are named. A leaf's own label
   * comes first. None: the input's default.
   */
  label?: Text
  tests?: RuleTest[]
  source?: Provenance
  /** Human-readable summary. */
  doc?: string
}

// ------------------------------------------------------------------ outputs to the client

export type FxEvent =
  | { t: 'vfx'; fx: string; map: string; x: number; y: number; angle?: number; span?: number; /** who made it (a blow's swing, a bolt loosed): drawn wielding it wherever they are drawn now */ who?: Id }
  | { t: 'say'; who: Id; text: Text; mood?: Mood; scene?: boolean; /** said to another (one person telling another): heard in passing, not a talk with the one at the keys */ to?: Id }
  | { t: 'emote'; who: Id; mood: Mood }
  | { t: 'fade'; dir: 'out' | 'in' }
  | { t: 'card'; text: Text }
  | { t: 'strike'; map: string; x: number; y: number }
  /** dev: for the developer (a rejected patch, a rule set aside): the console's, never a player's toast. */
  | { t: 'log'; text: Text; tone?: 'info' | 'warn' | 'ai' | 'good' | 'bad' | 'dev' }
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
  /** One spoke to someone (docs/npc-sandbox.md §2.9): their talk opens for the one at the keys (`arrest`: a guard stops them). */
  | { t: 'talk'; who: Id; arrest?: boolean }
  /** A lesson (docs/prologue.md, the drills): done (its id), or an input it does not allow tried (the key shakes). */
  | { t: 'lesson'; done?: string; blocked?: LessonInput }
  /** A quest reached a stage (docs/quests.md): its state after (the journal flashes; a save is made). */
  | { t: 'quest'; id: Id; stage: number; state: string }
  /** A companion took up a power (the boons module): a light flies from where it broke loose (`from`, else the companion) to the companion, who glows; its name, and the seal it is of (its status's `seal` prop). */
  | { t: 'boon'; who: Id; boon: string; name?: Text; seal?: number; from?: { map: string; x: number; y: number } }
