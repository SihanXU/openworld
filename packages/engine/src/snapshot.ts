// Render-agnostic frame snapshots for the client (sent from the engine Worker each tick).

import { nightHours, type Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import type { BossState, Look, Dir, Entity, FxEvent, Id, LessonInput, PropValue, SceneState, Sin, Text } from './types.ts'
import { FIGHT_TICKS } from './types.ts'
import { SLOT_COUNT } from './controls.ts'
import { oldStackKey, stackKey } from './stacks.ts'
import { parseCellId } from './cells.ts'
import { LOOSE } from './world.ts'
import { skillsOf } from './progression.ts'
import { OFFHAND, offhandOf, weaponOf } from './blows.ts'
import type { JournalQuest, QuestOffer, QuestTarget } from './quests.ts'

export interface ItemInfo {
  /** The entity's bag identity, before display names and inherited tags are filled in. */
  stackKey?: string
  id: Id
  type: string
  sprite: string
  name: Text
  tags: string[]
  statuses: string[]
  /** Its props, the type's under the instance's own (power, range, heal, food, element, owner…): what a tooltip tells. */
  props: Record<string, PropValue>
  /** It is another's than the one at the keys (taking it is a theft, docs/npc-sandbox.md §2.1). */
  steal?: boolean
  /** Its worth (the world's prices start from it). */
  value?: number
}

export interface EntitySnap {
  id: Id
  type: string
  sprite: string
  x: number
  y: number
  /** The storey it stands on (omitted: the ground's). */
  z?: number
  /** The spaces it takes in its cell, if any (a built wall, a floor laid): drawn as part of the place, not as a thing lying there. */
  spaces?: string[]
  /** A built thing come loose (World.isLoose: packed as `LOOSE`): drawn as a thing lying there, small, by the picture of what it is. */
  loose?: boolean
  facing: Dir
  statuses: string[]
  /** What its statuses draw over it (their `overlay`, OVERLAYS), in the order it has them. */
  overlays?: string[]
  /** The posture a status of its draws it in (its `pose`, POSES): the first it has. */
  pose?: string
  tags: string[]
  name: Text
  hp?: number
  maxHp?: number
  /** How it looks (docs/looks.md): a look record its sprite and portrait are drawn from, or a whole drawn sheet's key. */
  look?: string | Look
  hostile?: boolean
  frozen?: boolean
  /** The map it stands for (a place of the overworld: its `map`). */
  leadsTo?: string
  /** A way the story has not opened yet (its `opensWhen` fact unset, like a portal's): drawn sealed. */
  sealed?: boolean
  element?: string
  open?: boolean
  held?: string // sprite key of the held item
  heldTags?: string[]
  /** A boss fight's body (the kits module's encounters, filled by its frame hook). */
  boss?: {
    /** The encounter's id (its type's last name: `alberic`, `dragon`). */
    kit: string
    phase: number
    color: number
    footprint: [number, number]
    /** Where its second phase begins (a share of its health); `thresholds` has every phase's. */
    enrageAt: number
    action: BossState['action']
    /** Stable skill id, including recovery; renderer never guesses from localized warning text. */
    skill?: string
    /** The drawn clip of a sheet that has more than the two poses (the White Knight's volley). */
    clip?: string
    progress: number
    /** Time within the current visual phase, separate from normalized combat progress. */
    animationElapsedMs?: number
    warning?: { name: Text; tiles: [number, number][]; progress: number }
    /** Where each phase after the first begins (shares of its health). */
    thresholds?: number[]
    /** How many phases its fight has. */
    phases?: number
    /** The seal it bears (the Seal-bearers, 1–5). */
    seal?: number
  }
}

export interface TileSnap {
  x: number
  y: number
  terrain?: string
  statuses?: string[]
  /** The overlay each of its statuses names, a learned one too (status → overlay). */
  overlays?: Record<string, string>
  /** The durability of what fills or makes up the cell, when it has lost some (a notched tree, a cracked rock). */
  hp?: number
  maxHp?: number
}

/** Where an active skill one has comes from: the skill tree, a book read, or a piece one wears (its `skill` prop). */
export type SkillSource = 'tree' | 'book' | 'gear'

/** An active skill one has now (the skill panel). */
export interface KnownActive {
  id: string
  source: SkillSource
  /** The piece that lends it (a gear skill). */
  item?: string
}

/** A talk verb as the panel offers it: its label filled in. */
export interface TalkOption {
  id: string
  label: Text
  /** The panel's row it sits in with its kin (TalkVerb.group; a quest's is `quest`). */
  group?: string
  choices?: { id: string; label: Text }[]
}

/** How a minor monster's body winds up a skill (Frame.telegraphs). */
export type WindupPose = 'leap' | 'dash' | 'slam' | 'cast' | 'call'

/** The part of a configured home ground that its steward's panel can read. */
export interface ResidenceView {
  map: string
  /** The simulation is currently running this map. Work counts are present only while true. */
  active: boolean
  /** The player is physically on this map. */
  onMap: boolean
  residents: ResidenceResidentView[]
  /** Dead workers retain the same order on their body so the steward can expose task cargo for recovery. */
  recoveries?: { id: Id; name: Text; x: number; y: number; cargo: ItemInfo[]; status: 'paused' | 'revoked' | 'recovery'; blockedReason?: Text }[]
  beds?: { total: number; occupied: number; empty: number; slots: { anchor: string; resident?: Id }[] }
  work?: ResidenceWorkView
}

export interface ResidenceResidentView {
  id: Id
  name: Text
  slot: string
  eligible?: boolean
  eligibilityReason?: Text
  order?: {
    kind: 'harvest' | 'feed'
    status: 'working' | 'paused' | 'revoked' | 'recovery'
    warehouse: Id
    cells: { x: number; y: number }[]
    animalIds: Id[]
    pendingAnimalId?: Id
    cargo: ItemInfo[]
    blockedReason?: Text
  }
}

/** A whole-map view, supplied by the optional society module when the game configures residence work. */
export interface ResidenceWorkView {
  crops?: { total?: number; ripe?: number; needsWater?: number; targets?: { id: Id; x: number; y: number; name: Text; ripe: boolean }[] }
  livestock?: { total?: number; unfed?: number; milkable?: number; animals?: { id: Id; name: Text; type: string; x: number; y: number; fed: boolean; owner: 'mine' | 'ours' | 'nobody' | 'another'; selectable: boolean; claimable: boolean }[] }
  groundEggs?: number
  warehouses?: ResidenceWarehouseView[]
}

export interface ResidenceWarehouseView {
  id: Id
  type: string
  name: Text
  x: number
  y: number
  selectable: boolean
  unavailableReason?: Text
  capacity?: number
  usedSlots: number
  contents: (ItemInfo & { count: number })[]
}

export interface Frame {
  tick: number
  hour: number
  /** When night falls and ends now (clock hours): later dawns and earlier dusks as the story's night lengthens. */
  night: { dusk: number; dawn: number }
  calendar: Calendar
  /** A scene is playing: the player watches; `advance` moves past what is said. */
  scene?: { id: string; waiting?: 'advance' | 'move'; line?: SceneState['line']; picture?: string; dark?: boolean; /** the music it asked for: a cue, or '' for silence */ music?: string }
  map: string
  /** A fishing line's fight, when the game's fishing module has an active session. */
  fishing?: FishingView
  /** The configured home ground's resident beds and, while on its active map, its live work overview. */
  residence?: ResidenceView
  player: {
    id: Id
    x: number
    y: number
    /** The storey the player is on (omitted: the ground's). */
    z?: number
    /** The cells of the room the player stands in, if any: the storeys over it are not drawn. */
    room?: [number, number][]
    facing: Dir
    /** In a fight now: something came at the player, or the player struck someone, a moment ago (the `fighting` condition's FIGHT_TICKS). */
    fighting?: boolean
    hp: number
    maxHp: number
    /** Hunger, for actors that grow hungry (maxHunger 0: never). */
    hunger: number
    maxHunger: number
    statuses: string[]
    props: Record<string, PropValue>
    /** The skills learned (the skill tree). */
    skills: string[]
    /** The stations within reach (a shop's stall beside one): which station recipes can be made here without opening one. */
    stations: string[]
    /** One's own look (docs/looks.md), before what is worn goes over it: what the dresser's panel edits. */
    look?: Look
    held?: ItemInfo
    /** The skill bar's six slots (Shift+1–6): the active skill in each, ticks of its cooldown left and in all. */
    skillbar: ({ id: string; left: number; cooldown: number; /** one has it now (what lent it is still worn) */ usable: boolean } | null)[]
    /** Every active skill one has now, and where it comes from (the skill panel). */
    actives: KnownActive[]
    /** What is in the bag, a stack each (things alike as one, by their bag identity): how many, and which. */
    inventory: (ItemInfo & { count: number; ids: Id[] })[]
    /** The bag's slots (row 1 is the toolbar): one physical stack group each, or empty; same-kind groups may be separate. */
    slots: ({ item: ItemInfo; count: number; worn?: boolean } | null)[]
    selected: number
    /** The boons the companion following the player has been given, the one it carries, and whether a waypoint is near (the boons module). */
    boons?: { unlocked: string[]; active?: string; atWaypoint: boolean }
    /** What is worn in the off hand (a shield), and whether it works there (another profession's does not). */
    offhand?: ItemInfo & { works: boolean }
    /** What is worn, by slot (`head`, `body`, `ring`, `ring.2` …: the `wear:` props, the off hand's too), while it is still carried. */
    worn: Record<string, ItemInfo>
    /**
     * The numbers one fights with now, as the engine reckons them (World.stat: one's own, what one's statuses add, what
     * one wears and what it rolled, a set's bonuses, the night's, what a companion lends; a module may add what its
     * combat reads beside them), and the power of what a blow is struck with (blows.ts weaponOf): the character sheet's.
     */
    stats: Record<string, number> & { atk: number; def: number; critChance: number; power: number }
    /** What one owes the watch of the map one is on, and its name (docs/npc-sandbox.md §2.7). */
    wanted?: { bounty: number; by: Text }
    /** The coin one carries. */
    purse: number
  }
  /** A yes/no question waiting for the player (time is stopped); `sin`: what the act would weigh on their conscience. */
  question?: { text: Text; sin?: Sin }
  /** The world's facts (the story's counts: what the smith has been given…), for the HUD's objective. */
  facts: Record<string, PropValue>
  /**
   * The one at the keys has fallen (down): who felled them, and the game's difficulty, which says
   * what may follow (the death screen: get up where one fell, rise at home, or the end).
   */
  fallen?: { by?: Text; difficulty: Difficulty }
  /**
   * The cells creatures are winding up their skills on (the kits module): who, where, how far along (0–1), in what colour;
   * `boss`: an encounter's (drawn as a boss's warning, its body never flashing).
   */
  /**
   * The cells casters on the map are winding up on (the kits module): who, where, how far along (0–1), in what colour; a
   * boss's are drawn in its own manner. `pose` is how a minor monster's body winds up: it crouches to leap, draws back to
   * dash, gathers itself for a blow round itself, sways to cast, rears to call.
   */
  telegraphs?: { who: Id; tiles: [number, number][]; progress: number; color: number; boss?: boolean; pose?: WindupPose }[]
  /** What each input would do right now: E, G, the left click and the right click (filled by the host, not by snapshot()). */
  keys?: { hands?: KeyView; put?: KeyView; primary?: KeyView; secondary?: KeyView }
  /** The open container panel (the host names it): its contents. */
  container?: {
    id: Id
    name: Text
    capacity?: number
    contents: ItemInfo[]
  }
  /** The talk the one at the keys has open with a person (docs/npc-sandbox.md §2.9): who, what they think, the verbs that fit. */
  talk?: TalkView
  /** The trade panel open with a merchant (§2.10): its goods at its prices, what it would pay for what one carries, the purses. */
  trade?: TradeView
  /** A person's pockets open to a sneaking hand (§2.10): what they carry. */
  pockets?: { id: Id; name: Text; contents: (ItemInfo & { worn?: boolean })[] }
  /** The gift panel open with a person (§2.15): what they like best (once told), and what one carries to give. */
  gift?: GiftView
  entities: EntitySnap[]
  tiles: TileSnap[]
  fx: FxEvent[]
  pendingMap?: string
  /** What the player's E / F keys would do right now (filled by the host, not by snapshot()). */
  prompt?: Prompt
  /**
   * Quests (docs/quests.md §2.5): the marks over the people in view ('!' an offer, '?' someone to speak to), the
   * journal (every quest taken on, its objectives and its log), the tracked quest and where its open objectives
   * point (the markers), and the radiant offers (the notice board).
   */
  quests: { marks: Record<Id, '!' | '?'>; journal: JournalQuest[]; tracked?: Id; targets: QuestTarget[]; board: QuestOffer[] }
  /** The lesson at hand (docs/prologue.md, the drills): what to spotlight, the key to draw, what the keys may do. */
  lesson?: LessonView
}

/** Render-only fishing state; the client sends input edges and never submits progress or a catch. */
export interface FishingView {
  phase: 'waiting' | 'bite' | 'fight'
  fish: number
  bar: number
  barSize: number
  progress: number
  remaining: number
  bait: number
  /** The actual main candidate's item projection, shown only after the fight begins. */
  fishItem?: ItemInfo
}

/** A talk with a person, as the panel shows it. */
export interface TalkView {
  who: Id
  name: Text
  /** What they think of the one at the keys, in a word (hostile … close). */
  regard: Text
  /** And as a number (−100..100): the panel's hearts, ten at full. */
  affection?: number
  /** What they hold against them, in words. */
  grudge?: Text
  /** What the one at the keys owes the watch here. */
  bounty?: number
  /** A guard has stopped them: only the watch's choices. */
  arrest?: boolean
  verbs: TalkOption[]
}

/**
 * The gift panel (docs/npc-sandbox.md §2.15): the one given to, their regard, what they like best — named only once they
 * have said it in a chat (`told`) — and what the one at the keys carries that may be given, each with how warmly it
 * would be taken (`warmth`: 1 a trifle, 2 a kindness, 3 a treasure, 4 the thing they like best).
 */
export interface GiftView {
  who: Id
  name: Text
  /** Their regard for the one at the keys (−100..100). */
  affection: number
  /** They have said what they like best. */
  told: boolean
  /** The kind of thing they like best, as the panel can draw it (only once told). */
  favourite?: { type: string; name: Text; sprite: string }
  /** They were given their favourite today already (the special warmth comes once a day). */
  cheered?: boolean
  items: (ItemInfo & { count: number; warmth: number; favourite?: boolean })[]
}

/** A merchant's goods and offers, as the trade panel shows them. */
export interface TradeView {
  who: Id
  name: Text
  /** What it sells, and for how much to the one at the keys: things alike at one price as one row, how many (`count`, default 1). */
  goods: { item: ItemInfo; price: number; count?: number }[]
  /** What the one at the keys carries that it would buy, and for how much (alike as one row, as the goods). */
  offers: { item: ItemInfo; price: number; count?: number }[]
  /** The coin each side carries. */
  purse: number
  theirs: number
  /** What the merchant's regard takes off its prices (a share; negative: what it adds). */
  discount?: number
}

/** A lesson as the view shows it: its focus resolved to a thing, a cell, cells or a panel's part. */
export interface LessonView {
  id: string
  key?: string
  /** The inputs that work (none: all). */
  allow?: LessonInput[]
  only?: string[]
  focus?: { id?: Id; tile?: [number, number]; cells?: [number, number][]; ui?: string }
  /** Which of its stage's lessons it is, and how many there are. */
  index: number
  total: number
}

/** How forgiving a game is of a fall (chosen at a new game): get up where one fell, rise at home leaving what one carried, or one life. */
export type Difficulty = 'easy' | 'normal' | 'hardcore'

/**
 * The lesson at hand, as the view shows it (docs/prologue.md, the drills): its focus resolved — the
 * nearest thing of a type on the player's map (with a status), the nearest cell of a terrain, the
 * player, a spot, cells (an outline), or a panel's part the view finds itself.
 */
function lessonView(eng: Engine): LessonView | undefined {
  const at = eng.story.lesson()
  if (!at) return undefined
  const w = eng.world
  const { def } = at
  const p = w.player
  const pos = w.posOf(p)
  const f = def.focus
  let focus: LessonView['focus']
  if (f && pos) {
    const d = (x: number, y: number) => Math.max(Math.abs(x - pos.x), Math.abs(y - pos.y))
    if (f.self) focus = { id: p.id }
    else if (f.type) {
      const near = w
        .entitiesOnMap(pos.map)
        .filter((e) => e.place.on === 'tile' && e.id !== p.id && e.type.startsWith(f.type!) && (!f.status || w.hasStatus({ e: e.id }, f.status)))
        .sort((a, b) => (a.place.on === 'tile' && b.place.on === 'tile' ? d(a.place.x, a.place.y) - d(b.place.x, b.place.y) : 0))[0]
      if (near) focus = { id: near.id }
    } else if (f.terrain) {
      let best: [number, number] | undefined
      const [ox, oy] = f.from ?? [pos.x, pos.y]
      const from = (x: number, y: number) => Math.max(Math.abs(x - ox), Math.abs(y - oy))
      for (let r = 0; r <= 24 && !best; r++)
        for (let y = oy - r; y <= oy + r && !best; y++)
          for (let x = ox - r; x <= ox + r && !best; x++) if (from(x, y) === r && w.terrainAt(pos.map, x, y) === f.terrain) best = [x, y]
      if (best) focus = { tile: best }
    } else if (f.spot) focus = { tile: f.spot }
    if (f.cells) focus = { ...focus, cells: f.cells }
    if (f.ui) focus = { ...focus, ui: f.ui }
  }
  return { id: def.id, key: def.key, ...(def.allow && { allow: def.allow }), ...(def.only && { only: def.only }), ...(focus && { focus }), index: at.index, total: at.total }
}

/** The game's difficulty (the story keeps it; a game from before it was chosen is normal). */
export function difficultyOf(eng: Engine): Difficulty {
  const d = eng.world.fact('game.difficulty')
  return d === 'easy' || d === 'hardcore' ? d : 'normal'
}

/**
 * What is in the bag as stacks: a coin purse of two thousand is one entry, not two thousand of the same (the frame
 * goes to the page ten times a second). Things alike by their bag identity (type, name, tags, statuses) are one.
 */
function inventoryOf(eng: Engine, contents: Id[]): Frame['player']['inventory'] {
  const by = new Map<string, ItemInfo & { count: number; ids: Id[] }>()
  for (const id of contents) {
    const e = eng.world.get(id)
    if (!e) continue
    const steal = eng.society.isAnothers(e, eng.world.player)
    const k = `${stackKey(e)}|${steal}`
    const s = by.get(k)
    if (s) (s.count++, s.ids.push(id))
    else {
      const info = itemInfo(eng, id)
      if (info) by.set(k, { ...info, count: 1, ids: [id] })
    }
  }
  return [...by.values()]
}

/** The one at the keys lies fallen: by whom (the last who struck them, or what they were), and what may follow. */
function fallen(eng: Engine): Frame['fallen'] {
  const w = eng.world
  const p = w.player
  if (!w.hasStatus({ e: p.id }, 'down')) return undefined
  const c = p.combat
  const by = c?.lastHurtBy && w.get(c.lastHurtBy) ? eng.nameOf({ e: c.lastHurtBy }, 'en') : undefined
  const name = (l: 'en' | 'zh') => (c?.lastHurtBy && w.get(c.lastHurtBy) ? eng.nameOf({ e: c.lastHurtBy }, l) : c?.lastHurtByType ? typeName(eng, c.lastHurtByType, l) : undefined)
  return { ...(by || c?.lastHurtByType ? { by: { en: name('en') ?? '', zh: name('zh') ?? '' } } : {}), difficulty: difficultyOf(eng) }
}

/** A type's name in a language. */
function typeName(eng: Engine, type: string, l: 'en' | 'zh'): string {
  const n = eng.world.onto.resolve(type).name
  return typeof n === 'string' ? n : n ? ((l === 'zh' ? n.zh : undefined) ?? n.en) : type.split('/').pop()!
}

export interface KeyView {
  label: Text
  /** The world has never seen this (an experiment): the modder will be asked (never where the AI setting turns its kind of work off). */
  unknown?: boolean
  /** It will ask first. */
  confirm?: boolean
  /** It changes nothing (a hand on the floor only touches it). */
  idle?: boolean
  /** It sets what is held down there (it builds): the left button held and dragged sets one in each cell. */
  sets?: boolean
  /** It takes what is another's (a theft, docs/npc-sandbox.md). */
  steal?: boolean
  /** Its target is the ground: a terrain, a floor. */
  ground?: boolean
  /** Its target is someone to talk to: a person, a companion. */
  person?: boolean
  /** The act it makes, where an input makes more than one (E: a hand or a take; a click: a use, or a use on oneself). */
  act?: 'hands' | 'take' | 'put' | 'use' | 'self'
  x: number
  y: number
  /** The target's base when it covers more than its cell (a place of the overworld, a tent): x, y, width, height. */
  rect?: [number, number, number, number]
}

export interface Prompt {
  target: Text
  targetKind: string
  holding?: Text
  /** interact (E): defined by which rule, or undefined (the Mod port would be asked). */
  interact: { defined: boolean; rule?: string }
  /** take (F): only when there is something to take in front / underfoot. */
  take?: { defined: boolean; rule?: string; item: Text }
}

export function itemInfo(eng: Engine, id: Id): ItemInfo | undefined {
  const w = eng.world
  const e = w.get(id)
  if (!e) return undefined
  const r = w.onto.resolve(e.type)
  const steal = eng.society.isAnothers(e, w.player)
  return {
    id,
    type: e.type,
    sprite: r.sprite ?? e.type,
    name: e.name ?? r.name ?? e.type.split('/').pop()!,
    stackKey: eng.controls.key(e),
    tags: [...r.tags, ...(e.tags ?? [])],
    statuses: Object.keys(e.statuses ?? {}),
    props: { ...r.props, ...(e.props ?? {}) },
    ...(steal && { steal }),
    value: eng.society.value(e),
  }
}


/** The cells of the room a place lies in (a derived region: walls round, a floor over it), if any. */
function roomCells(eng: Engine, pos: { map: string; x: number; y: number; z?: number }): [number, number][] | undefined {
  const room = eng.world.regionsAt(pos.map, pos.x, pos.y, pos.z ?? 0).find((r) => r.type === 'region/room')
  if (!room || room.place.on !== 'area') return undefined
  const out: [number, number][] = []
  for (const [x, y, w, h] of room.place.rects) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j])
  return out
}

/** Cells round the view a frame still carries (the camera moves before the next frame comes). */
export const VIEW_MARGIN = 4

/** What the view shows (the camera's rect, in cells, on a map): a frame carries what lies within it and its margin. */
export interface FrameView {
  map: string
  x: number
  y: number
  w: number
  h: number
}

export function snapshot(eng: Engine, opts: { panel?: Id; view?: FrameView } = {}): Frame {
  const w = eng.world
  const p = w.player
  const pos = w.posOf(p)!
  const map = pos.map
  const entities: EntitySnap[] = []
  // the view (docs/continent.md §9): a big map's things beyond it are left out — but the one at the keys, their
  // companions, and anyone who speaks or is spoken to now are always there
  const v = opts.view?.map === map ? opts.view : undefined
  const named = new Set<Id>([p.id])
  if (v) {
    for (const f of w.fx) if ('who' in f && typeof f.who === 'string') named.add(f.who)
    const line = w.scene?.line as { who?: Id } | undefined
    if (line?.who) named.add(line.who)
  }
  const shown = (e: import('./types.ts').Entity & { place: { on: 'tile'; x: number; y: number } }): boolean => {
    if (!v || named.has(e.id) || e.props?.companion !== undefined) return true
    const [fw, fd] = w.onto.resolve(e.type).footprint
    const x0 = e.place.x - Math.floor((fw - 1) / 2)
    const y0 = e.place.y - fd + 1
    return x0 + fw > v.x - VIEW_MARGIN && x0 < v.x + v.w + VIEW_MARGIN && y0 + fd > v.y - VIEW_MARGIN && y0 < v.y + v.h + VIEW_MARGIN
  }
  for (const e of w.entitiesOnMap(map)) {
    if (e.place.on !== 'tile' || !shown(e as Parameters<typeof shown>[0])) continue
    const r = w.onto.resolve(e.type)
    // a built thing come loose is drawn as what it is (a bed lying packed), small, as a thing lying there
    const inner = e.type === LOOSE ? w.get(e.contents?.[0]) : undefined
    // in the hand: what it holds, else the weapon it keeps in the main hand (only what acts wields one)
    const held = e.held ? w.get(e.held) : w.isAgent(e) ? weaponOf(w, e) : undefined
    const spaces = w.spacesOf(e)
    const hasHp = w.prop(e, 'maxHp') !== undefined
    entities.push({
      id: e.id,
      type: e.type,
      sprite: inner ? (w.onto.resolve(inner.type).sprite ?? inner.type) : (r.sprite ?? e.type),
      ...(inner && { loose: true }),
      x: e.place.x,
      y: e.place.y,
      ...(e.place.z && { z: e.place.z }),
      ...(spaces.some((s) => s !== 'body') && { spaces }),
      facing: e.facing ?? 'down',
      statuses: Object.keys(e.statuses ?? {}),
      ...((o) => o.length && { overlays: o })(Object.keys(e.statuses ?? {}).flatMap((s) => w.onto.status(s)?.overlay ?? [])),
      ...((p) => p && { pose: p })(Object.keys(e.statuses ?? {}).map((s) => w.onto.status(s)?.pose).find(Boolean)),
      tags: [...r.tags, ...(e.tags ?? [])],
      name: e.name ?? r.name ?? e.type.split('/').pop()!,
      hp: hasHp ? w.num(e, 'hp') : undefined,
      maxHp: hasHp ? w.num(e, 'maxHp', 1) : undefined,
      // as it is seen: its own look with what it wears on it (docs/looks.md)
      look: w.seenLook(e),
      // whether it would set on the one at the keys (its factions, temper, foes): not whether it is chasing
      // this moment (a bat that wheels away is no friend)
      hostile: e.ai ? eng.hostileTo(e, w.player) : undefined,
      frozen: !!e.frozenBy,
      ...(typeof e.props?.map === 'string' && { leadsTo: e.props.map }),
      ...(w.sealed(e) && { sealed: true }),
      element: (w.prop(e, 'element') as string | undefined) ?? undefined,
      open: !!e.statuses?.open,
      held: held ? (w.onto.resolve(held.type).sprite ?? held.type) : undefined,
      heldTags: held ? [...w.onto.resolve(held.type).tags, ...(held.tags ?? [])] : undefined,
    })
  }
  // the cells that differ from the map's data: what they show now, and what their things carry
  const tiles: TileSnap[] = []
  const changed = new Set<string>()
  for (const c of w.keptCells(map)) {
    const at = parseCellId(c.id)!
    changed.add(`${at.x},${at.y}`)
    if (c.place.on === 'tile' && c.place.map === map) changed.add(`${c.place.x},${c.place.y}`)
  }
  for (const k of changed) {
    const [x, y] = k.split(',').map(Number)
    const statuses = w.entitiesAt(map, x, y).filter((c) => w.isTerrain(c)).flatMap((c) => Object.keys(c.statuses ?? {}))
    const top = w.cellTop(map, x, y)
    const hurt = top && w.prop(top, 'maxHp') !== undefined && w.num(top, 'hp', w.num(top, 'maxHp')) < w.num(top, 'maxHp')
    const overlays = Object.fromEntries(statuses.flatMap((s) => ((o) => (o ? [[s, o]] : []))(w.onto.status(s)?.overlay)))
    tiles.push({ x, y, terrain: w.terrainAt(map, x, y), statuses: statuses.length ? statuses : undefined, ...(Object.keys(overlays).length && { overlays }), ...(hurt && { hp: w.num(top!, 'hp'), maxHp: w.num(top!, 'maxHp') }) })
  }
  const panel = opts.panel ? w.get(opts.panel) : undefined
  const box = panel && w.hasStatus({ e: panel.id }, 'open') ? panel : undefined
  const capacity = box && w.prop(box, 'capacity')
  // the bag's slots: each the physical stack group it holds — what is worn is on the body, not in the bag
  const carried = new Map<string, Id[]>()
  const keyById = new Map<Id, string>()
  const entityById = new Map<Id, Entity>()
  const onBody = eng.controls.wornIds()
  for (const id of [...(p.contents ?? []), ...(p.held ? [p.held] : [])]) {
    const e = w.get(id)
    const place = e?.place
    if (!e || onBody.has(id) || !((place?.on === 'inside' || place?.on === 'hand') && place.holder === p.id)) continue
    const k = eng.controls.key(e)
    keyById.set(id, k)
    entityById.set(id, e)
    const ids = carried.get(k)
    if (ids) ids.push(id)
    else carried.set(k, [id])
  }
  const slotMembers: (Id[] | undefined)[] = Array(Math.max(SLOT_COUNT, p.slots?.length ?? 0, p.slotItems?.length ?? 0))
  if (p.slotItems) {
    const claimed = new Set<Id>()
    for (let i = 0; i < slotMembers.length; i++) {
      const key = p.slots?.[i]
      if (!key) continue
      const members = p.slotItems[i] ?? []
      const valid: Id[] = []
      for (const id of members) if (!claimed.has(id) && keyById.get(id) === key) valid.push(id), claimed.add(id)
      slotMembers[i] = valid
    }
  } else {
    // Read old saves as one physical group per key without migrating them during a snapshot.
    const claimed = new Set<string>()
    const heirsByOldKey = new Map<string, string[]>()
    for (const [candidate, ids] of carried) {
      const entity = entityById.get(ids[0]!)
      if (!entity) continue
      const old = oldStackKey(entity)
      const heirs = heirsByOldKey.get(old)
      if (heirs) heirs.push(candidate)
      else heirsByOldKey.set(old, [candidate])
    }
    const nextHeir = new Map<string, number>()
    for (let i = 0; i < slotMembers.length; i++) {
      const original = p.slots?.[i]
      if (!original) continue
      let key = original
      if (!carried.has(key)) {
        const heirs = heirsByOldKey.get(original) ?? []
        let at = nextHeir.get(original) ?? 0
        while (at < heirs.length && claimed.has(heirs[at]!)) at++
        nextHeir.set(original, at + 1)
        if (heirs[at]) key = heirs[at]!
      }
      if (claimed.has(key)) continue
      const members = carried.get(key)
      if (members) slotMembers[i] = members, claimed.add(key)
    }
    // Old saves could only name one stack per key. A type that became per-entity (axes, for example)
    // may now have more carried groups than saved slots; show the remaining groups in virtual free slots.
    let free = 0
    for (const [key, members] of carried) {
      if (claimed.has(key)) continue
      while (free < slotMembers.length && slotMembers[free]?.length) free++
      if (free >= slotMembers.length) break
      slotMembers[free] = members
      claimed.add(key)
      free++
    }
  }
  const wearing = new Set(w.worn(p).map((e) => e.id))
  const slots = Array.from({ length: slotMembers.length }, (_, i) => {
    const ids = slotMembers[i]
    const first = ids?.length ? itemInfo(eng, ids[0]) : undefined
    // what of the stack the player wears (world-model.md §6.8)
    const worn = !!ids?.length && ids.some((id) => wearing.has(id))
    return first ? { item: first, count: ids!.length, ...(worn && { worn }) } : null
  })
  const fx = w.drainFx()
  const sc = w.scene
  const questView = eng.quests.withReading(() => ({
    quests: eng.quests.view(eng.quests.defs.length ? entities.filter((e) => e.tags.includes('person')).map((e) => e.id) : []),
    lesson: lessonView(eng),
  }))
  const frame: Frame = {
    tick: w.state.tick,
    hour: w.hour(),
    night: nightHours(w.nightShift()),
    calendar: w.calendar(),
    scene: sc ? { id: sc.id, waiting: sc.waiting, line: sc.line, ...(sc.picture && { picture: sc.picture }), ...(sc.dark && { dark: true }), ...(sc.music !== undefined && { music: sc.music }) } : undefined,
    map,
    player: {
      id: p.id,
      x: pos.x,
      y: pos.y,
      ...(pos.z && { z: pos.z }),
      ...((room) => room && { room })(roomCells(eng, pos)),
      facing: p.facing ?? 'down',
      ...(typeof p.look === 'object' && { look: p.look }),
      ...(w.state.tick - (p.combat?.fightTick ?? -Infinity) < FIGHT_TICKS && { fighting: true }),
      hp: w.num(p, 'hp'),
      maxHp: w.num(p, 'maxHp', 1),
      // hunger: a module's (needs), none without one
      hunger: 0,
      maxHunger: 0,
      statuses: Object.keys(p.statuses ?? {}),
      props: { ...w.onto.resolve(p.type).props, ...(p.props ?? {}) },
      skills: skillsOf(p),
      stations: [...w.stationsNear(p)],
      held: p.held ? itemInfo(eng, p.held) : undefined,
      // the skill bar and the active skills one has: a module's (classes), none without one
      skillbar: [],
      actives: [],
      inventory: inventoryOf(eng, p.contents ?? []),
      slots,
      selected: p.selected ?? 0,
      offhand: (() => {
        // what the off-hand slot names while it is still carried; `works`: and it is the wearer's to wield
        const id = w.prop(p, OFFHAND)
        const item = typeof id === 'string' ? w.get(id) : undefined
        const info = item && (item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === p.id ? itemInfo(eng, item.id) : undefined
        return info && { ...info, works: !!offhandOf(w, p) }
      })(),
      worn: Object.fromEntries(Object.entries(p.props ?? {}).flatMap(([k, id]) => {
        const item = k.startsWith('wear:') && typeof id === 'string' ? w.get(id) : undefined
        const info = item && (item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === p.id ? itemInfo(eng, item.id) : undefined
        return info ? [[k.slice(5), info]] : []
      })),
      // the sheet's numbers, as a blow reckons them (engine.ts: atk, 1 for one with none, and the weapon's power)
      stats: statsOf(w, p),
      // what one owes the watch here, and the coin one carries: a module's (society)
      purse: 0,
    },
    question: w.state.question ? { text: w.state.question.text, ...(w.state.question.sin && { sin: w.state.question.sin }) } : undefined,
    quests: questView.quests,
    ...(fallen(eng) && { fallen: fallen(eng) }),
    facts: { ...(w.story?.props ?? {}) },
    ...(questView.lesson && { lesson: questView.lesson }),
    container: box && {
      id: box.id,
      name: box.name ?? w.onto.resolve(box.type).name ?? box.type.split('/').pop()!,
      capacity: typeof capacity === 'number' ? capacity : undefined,
      contents: (box.contents ?? []).map((id) => itemInfo(eng, id)).filter((x): x is ItemInfo => !!x),
    },
    entities,
    tiles,
    fx,
    pendingMap: eng.pendingTransition?.map,
  }
  // what the world's modules show (their HUD's fields)
  for (const h of eng.hooks.frame) h(frame)
  return frame
}


/** The stats a character sheet shows, as the world reckons them (World.stat). */
export const SHEET_STATS = ['atk', 'def', 'critChance', 'critDamage', 'dodge', 'lifesteal', 'cdr', 'xpRate', 'luck', 'moveHaste', 'attackHaste', 'karma', 'faith'] as const

/**
 * One's stats, all told (World.stat: one's own, one's statuses, what one wears and what it rolled, a set's bonuses,
 * the night's, what a companion lends), and the power of the weapon one fights with (none without one). A weapon's
 * own atk, def or edge count only as it strikes (combat), never as a stat of its bearer's.
 */
function statsOf(w: import('./world.ts').World, p: import('./types.ts').Entity): Frame['player']['stats'] {
  const out = {} as Frame['player']['stats']
  for (const k of SHEET_STATS) out[k] = w.stat(p, k)
  // (as a blow reckons them, engine.ts: an attack of 1 for one with none)
  out.atk = w.stat(p, 'atk', 1)
  const weapon = weaponOf(w, p)
  out.power = weapon ? w.num(weapon, 'power', 0) : 0
  return out
}
