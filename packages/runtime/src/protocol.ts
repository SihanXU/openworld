// Messages between the main thread (render + UI) and the engine Worker.

import type { ResearchDesign, AiQuality, Aim, CodexView, Difficulty, Dir, Frame, Key, LibraryData, Look, MapData, ModSpec, Patch, PixelArt, Plan, PlacementPreview, Pos, Recipe, RegionLook, Rule, SceneCmd, StatusDef, Text, UndefinedRecord, ValidationResult, WorldIndex } from '@openworld/engine'
import type { TransferProgress } from './transferQueue.ts'
import type { SaveWithQuestions } from './saves.ts'

/** Where the mouse points: its tile, and what is drawn at the point, top first (the keys act there when it is next to the player). */
export type Tile = Aim

/**
 * The shared library as the browser stores it: with the service's log it was synced from and how far (GET /patches
 * `log`, the id of that log), so that a service whose log was made anew is synced again from its start.
 */
export type StoredLibrary = LibraryData & { syncedLog?: { url: string; log: string; seq: number } }

export type FishingAction = 'press' | 'release' | 'cancel'

/** Runtime-only projection of the active fishing minigame. Coordinates are normalized. */
export type FishingInputSource = 'mouse' | 'space'

/** Tracks press edges so browser key repeat and duplicate button events do not advance fishing twice. */
export class FishingInputLatch {
  private held = new Set<FishingInputSource>()

  press(source: FishingInputSource): boolean {
    if (this.held.has(source)) return false
    const first = this.held.size === 0
    this.held.add(source)
    return first
  }

  release(source: FishingInputSource): 'none' | 'held' | 'last' {
    if (!this.held.delete(source)) return 'none'
    return this.held.size === 0 ? 'last' : 'held'
  }

  clear(): FishingInputSource[] {
    const held = [...this.held]
    this.held.clear()
    return held
  }
}

export type ToWorker =
  | { t: 'skipLearning' }
  | { t: 'researchAsk'; message: string }
  | { t: 'researchConfirm'; token: string }
  | { t: 'researchCancel' }
  | { t: 'init'; base: string; save?: SaveWithQuestions; library?: StoredLibrary; /** how far `library` has synced the modder's shared log (the same service's) */ librarySeq?: number; /** the modder service, if any ('': none) */ modder?: string; /** the player's own modder, over this port (docs/byok.md; sent with the message) */ modderPort?: MessagePort; /** true: prefetch undefined acts the pointer rests on (?prefetch=1: at least the medium setting's) */ prefetch?: boolean; /** the player's AI setting (the engine's quality.ts) */ quality?: AiQuality; /** a new game's difficulty */ difficulty?: Difficulty; /** where a new game begins: one of the world's other starts (the tutorial skipped) */ start?: string; /** how a new game's traveller looks (docs/looks.md) */ look?: Look; /** a new game begun at this cell instead of a start (the editor's playtest) */ at?: Pos; /** a step of the story begun at once in a new game (the editor's "play from this scene") */ scene?: string }
  /**
   * The world behind the title (the cover's backdrop): a world of its own at a place of the game's and an hour, with no
   * story, nothing asked of the modder and nothing saved; its frames are only drawn. An `init` replaces it.
   */
  | { t: 'backdrop'; base: string; at: Pos; hour?: number; library?: StoredLibrary }
  /** The one at the keys, fallen, rises again: where they fell, or at home (the death screen). */
  | { t: 'respawn'; home: boolean }
  /** Hold a direction (null: stop); `walk`: Shift, slower than the default run. */
  | { t: 'move'; dir: Dir | null; walk?: boolean }
  /** Q: dash (the skill), the way the player faces. */
  | { t: 'dash' }
  /** Space: strike ahead with the held weapon (or a fist), again and again while it is held. */
  | { t: 'attack'; on: boolean }
  /** A fishing minigame button edge; release/cancel are accepted while paused to clear held input. */
  | { t: 'fishing'; action: FishingAction }
  /** One of the inputs (design.md §5.2): E the hand, G put, the right click's use (`secondary`); on a chosen layer of the tile. */
  | { t: 'key'; key: Key; tile?: Tile; layer?: number; /** the right button dragged over a new cell: only if it sets something up */ drag?: boolean }
  /** The left button pressed (its act at once) or let go; held, its act again at the aim as a swing's pace allows (Controls.again). */
  | { t: 'primary'; on: boolean; tile?: Tile }
  | { t: 'handUp'; up: boolean }
  /** The same on an item in the bag or in the open chest (the inventory's context menu). */
  | { t: 'keyOnItem'; key: Plan['key']; item: string }
  /** A game's explicit chooser uses one carried item on another (the worker checks both identities at confirmation). */
  | { t: 'useItemOnHeldItem'; instrument: string; target: string }
  /** The layer chooser (a long press): what each layer of the tile would give. */
  | { t: 'choices'; key: Key; tile?: Tile }
  /** Where the mouse points (for the key labels). */
  | { t: 'aim'; tile?: Tile; /** its number, answered with the keys for it */ n?: number }
  /** What the camera shows (cells, on a map): frames carry what lies there and round it (docs/continent.md §9). */
  | { t: 'view'; map: string; x: number; y: number; w: number; h: number }
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
  | { t: 'moveSlot'; request: number; from: number; to: number; item: string; count: number; sourceCount: number }
  | { t: 'quickMove'; slot: number }
  | { t: 'drop'; slot: number; all: boolean; item?: string; count?: number; sourceCount?: number }
  | { t: 'organize' }
  /** The off hand: wear a carried item there (a shield), or take off what is worn (no item). */
  | { t: 'wear'; item?: string; /** from the bag: put on (another of a stack), never take off */ putOn?: boolean }
  /** The crafting panel: make a recipe from what is carried. */
  | { t: 'craft'; id: string; /** as many as what is carried makes */ all?: boolean; /** the station it is made at (the one whose panel is open) */ at?: string }
  /** Stop a batch when its crafting or shop panel closes. Completed recipes are kept. */
  | { t: 'cancelCraft' }
  /** The skill tree: spend skill points on a skill. */
  | { t: 'learn'; id: string }
  /** The skill bar: cast the skill in a slot (Shift+1–6), or set one there (null: empty it). */
  | { t: 'cast'; slot: number }
  | { t: 'setSkill'; slot: number; id: string | null }
  /** Take up (or change to) a profession at a trainer. */
  | { t: 'profession'; id: string }
  /** The dresser's: keep this look as one's own, for the price the world's params name (docs/looks.md §5). */
  | { t: 'restyle'; look: Look }
  /** A word said to someone without the talk panel (a game's panel: a choice made on it, said to the one who opened it). */
  | { t: 'speak'; who: string; verb: string; choice?: string }
  /** Up to so many of a carried kind put into a thing (a game's panel: materials handed to the one who opened it). */
  | { t: 'offer'; target: string; item: string; count: number }
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
  /** X and V (docs/npc-sandbox.md): draw one's weapon, walk soft — the input's own posture, toggled. */
  | { t: 'toggle'; what: 'drawn' | 'sneaking' }
  /** The talk panel: a verb said to the one the talk is with (and its choice); the talk closed. */
  | { t: 'talk'; verb: string; choice?: string }
  /** The journal: the quest followed (docs/quests.md §2.5); the commission board: a favour taken on. */
  | { t: 'track'; id?: string }
  | { t: 'board'; who: string; ref: string }
  | { t: 'closeTalk' }
  /** The trade panel: one of the merchant's goods bought, or a thing sold to it; the panel closed. */
  | { t: 'trade'; item: string; buy: boolean }
  | { t: 'closeTrade' }
  /** A person's pockets: a thing taken from them, or one slipped in; the panel closed. */
  | { t: 'pocket'; item: string; take: boolean }
  | { t: 'closePockets' }
  /** The gift panel (docs/npc-sandbox.md §2.15): a thing of one's own handed to the person it is open with. */
  | { t: 'gift'; item: string }
  | { t: 'closeGift' }
  /** Time stops while a menu, a dialogue or a question is open. */
  | { t: 'pause'; on: boolean }
  /** The player changed the AI setting (the options' AI section): it holds from the next event. */
  | { t: 'quality'; quality: AiQuality }
  /** Ask another modder from now on: the player's own over this port (sent with the message), a service, or none. */
  | { t: 'modder'; port?: MessagePort; url?: string }
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
  /** A boss set down again on its map (the dev's hand): the player goes there first (`from`), it stands at x, y. */
  | { t: 'debug'; op: 'summon'; kit: string; map: string; x: number; y: number; from: [number, number] }
  /** Harm the one at the keys (as a blow nobody struck): to try a fall and the death screen. */
  | { t: 'debug'; op: 'hurt'; amount: number }
  /** A fact of the story set (the dev's hand): a part of the tale opened, a gate lifted. */
  | { t: 'debug'; op: 'fact'; key: string; value: number }
  | { t: 'debug'; op: 'god'; on?: boolean }
  /** development: play a story step now (`id`), or a scene written here (`script`): a CG, a line, looked at without playing to it */
  | { t: 'debug'; op: 'scene'; id?: string; script?: SceneCmd[] }

/** Routes stale frame-driven attacks/use messages against the worker's authoritative fishing state. */
export function routeFishingWorkerInput(
  active: boolean,
  input: { t: 'attack'; on: boolean } | { t: 'key'; key: Key },
): { kind: 'fishing'; action: FishingAction } | { kind: 'ignore' } | { kind: 'game' } {
  if (!active) return { kind: 'game' }
  if (input.t === 'attack') return { kind: 'fishing', action: input.on ? 'press' : 'release' }
  return input.key === 'use' || input.key === 'primary' || input.key === 'secondary' ? { kind: 'ignore' } : { kind: 'game' }
}

/** A fishing Space press remains consumed through keyup, even if its session ends on a stale frame. */
export function routeSpaceKeyDown(active: boolean, repeat: boolean, fishingSequence: boolean): 'fishing-press' | 'attack' | 'ignore' {
  if (fishingSequence || (active && repeat)) return 'ignore'
  return active ? 'fishing-press' : 'attack'
}

export const routeFishingEscape = (active: boolean): 'cancel' | 'menu' => active ? 'cancel' : 'menu'

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
  /** The shared log synced this far from this service: the next load goes on from here. */
  | { t: 'synced'; url: string; seq: number; /** the library changed: the position is stored with it, not before it */ changed: boolean }
  | { t: 'placement'; preview: PlacementPreview }
  | { t: 'ready'; stats: WorldIndex['stats']; name: WorldIndex['name']; resumed: boolean }
  /** The slot's save is from another version of the world: nothing was started, and the slot is kept as it was. */
  | { t: 'incompatible' }
  | { t: 'map'; map: MapData; /** the look of the region it lies in (RegionMeta.look) */ look?: RegionLook }
  | { t: 'frame'; frame: Frame; /** the frame's things are only those that changed; these left it (frameDelta.ts) */ gone?: string[]; perf: { tickMs: number; entities: number; loaded: number }; /** the codex's version: something new was met */ codex: number; /** the world waits for the outcome of the player's act: for how long so far, and at most */ learning?: { seconds: number; limit: number }; transfer?: TransferProgress; crafting?: TransferProgress<'craft'> }
  /** A bag group move finished: request identifies the pending cursor action. */
  | { t: 'slotMove'; request: number; moved: boolean }
  /** What the keys would do now, sent as soon as the pointer aims somewhere else (between frames). */
  | { t: 'keys'; keys: Frame['keys']; /** the aim they answer */ n?: number }
  | { t: 'records'; records: RecordView[]; library: LibraryView }
  | { t: 'spec'; spec: ModSpec }
  | { t: 'validation'; id?: string; result: ValidationResult }
  | { t: 'saved'; save: SaveWithQuestions; library: StoredLibrary; summary: SaveSummary; /** the world's own save (no toast: on the overworld one comes with every block) */ auto?: boolean }
  /** The library changed (a patch was accepted or removed): keep it at once, not at the next save. */
  | { t: 'library'; library: StoredLibrary; /** every learned status, this save's kept ones too: what the tooltips name */ statuses: StatusDef[] }
  | { t: 'loading'; what: string }
  /** The layer chooser's list for a key at a tile. */
  | { t: 'choices'; key: Key; tile?: Tile; list: { layer: number; name: Text; label?: Text; unknown?: boolean }[] }
  | { t: 'modder'; online: boolean; url?: string; model?: string | null }
  /** The pictures of things the world learned (types a patch introduced): drawn as textures `art:<id>`. */
  | { t: 'art'; arts: { id: string; art: PixelArt }[] }
  /** The recipes of learned things (a patch's type made at hand or at a workbench from its makeup): the crafting panel lists them beside the content's. */
  | { t: 'recipes'; recipes: Recipe[] }
  | { t: 'research'; who: string; reply: string; design?: ResearchDesign; token?: string; error?: boolean; made?: boolean }
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

/**
 * The continent (the overworld, world-model.md §5.1) as the world map draws it: its grounds a cell each, the region each
 * cell is in, the named places, and the cell one is at (on the overworld, or the place one is in).
 */
export interface AtlasContinent {
  width: number
  height: number
  terrain: string[]
  /** Each cell's region, an index into `regions` (-1: none, the sea). */
  regionOf: number[]
  regions: { id: string; name: Text; color?: string; backdrop?: boolean }[]
  /** Its places: where, named, of what kind, drawn with what (the sprite its type names, as the overworld draws it). */
  places: { x: number; y: number; name: Text; kind: string; map: string; sprite?: string; sealed?: boolean; backdrop?: boolean; visited?: boolean; capital?: boolean }[]
  /** The cell one is at, where the world map can tell. */
  cell?: { x: number; y: number }
}

export interface Atlas {
  maps: AtlasMap[]
  /** The whole world map, when the world has one (an overworld). */
  continent?: AtlasContinent
  /** The cell each map with a waypoint or a quest's target lies at on the continent (its own, or the map it hangs below). */
  cells?: Record<string, { x: number; y: number }>
  waypoints: { id: string; map: string; x: number; y: number; name: Text; attuned: boolean }[]
  here: { map: string; x: number; y: number }
  /** Where the tracked quest's open objectives point (docs/quests.md §2.5): its markers on the world map. */
  targets?: { map: string; x: number; y: number; text: Text }[]
}

/** What a save slot shows without loading it: where, when, how far. */
export interface SaveSummary {
  map: Text
  day: number
  hour: number
  minute: number
  level: number
  /** The quest followed, and its first open objective (docs/quests.md). */
  quest?: Text
  objective?: Text
  difficulty?: Difficulty
  /** A hardcore game whose one life is spent: kept as it ended, never played on. */
  ended?: boolean
}
