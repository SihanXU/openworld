// Render-agnostic frame snapshots for the client (sent from the engine Worker each tick).

import { nightHours, type Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import type { Appearance, BossState, Dir, FxEvent, Id, LessonInput, PropValue, SceneState, Text } from './types.ts'
import { SLOT_COUNT } from './controls.ts'
import { parseCellId } from './cells.ts'
import { skillsOf } from './progression.ts'
import { OFFHAND, offhandOf, weaponOf } from './profession.ts'
import { castCooldown, castLeft, knownActives, type KnownActive } from './actives.ts'
import { activeBoon, boonsOf, companionsOf, nearAttunedWaypoint } from './boons.ts'
import type { QuestView } from './quests.ts'

export interface ItemInfo {
  id: Id
  type: string
  sprite: string
  name: Text
  tags: string[]
  statuses: string[]
  /** Its props, the type's under the instance's own (power, range, heal, food, element, owner…): what a tooltip tells. */
  props: Record<string, PropValue>
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
  facing: Dir
  statuses: string[]
  /** What its statuses draw over it (their `overlay`, OVERLAYS), in the order it has them. */
  overlays?: string[]
  tags: string[]
  name: Text
  hp?: number
  maxHp?: number
  appearance?: Appearance
  look?: string
  hostile?: boolean
  frozen?: boolean
  element?: string
  open?: boolean
  held?: string // sprite key of the held item
  heldTags?: string[]
  boss?: {
    kit: string
    phase: number
    color: number
    footprint: [number, number]
    enrageAt: number
    action: BossState['action']
    /** Stable skill id, including recovery; renderer never guesses from localized warning text. */
    skill?: string
    progress: number
    /** Time within the current visual phase, separate from normalized combat progress. */
    animationElapsedMs?: number
    warning?: { name: Text; tiles: [number, number][]; progress: number }
  }
}

export interface TileSnap {
  x: number
  y: number
  terrain?: string
  statuses?: string[]
  /** The durability of what fills or makes up the cell, when it has lost some (a notched tree, a cracked rock). */
  hp?: number
  maxHp?: number
}

export interface Frame {
  tick: number
  hour: number
  /** When night falls and ends now (clock hours): later dawns and earlier dusks as the story's night lengthens. */
  night: { dusk: number; dawn: number }
  calendar: Calendar
  /** A scene is playing: the player watches; `advance` moves past what is said. */
  scene?: { id: string; waiting?: 'advance' | 'move'; line?: SceneState['line'] }
  map: string
  player: {
    id: Id
    x: number
    y: number
    /** The storey the player is on (omitted: the ground's). */
    z?: number
    /** The cells of the room the player stands in, if any: the storeys over it are not drawn. */
    room?: [number, number][]
    facing: Dir
    hp: number
    maxHp: number
    /** Hunger, for actors that grow hungry (maxHunger 0: never). */
    hunger: number
    maxHunger: number
    statuses: string[]
    props: Record<string, PropValue>
    /** The skills learned (the skill tree). */
    skills: string[]
    /** The stations within reach (a workbench beside one): which station recipes can be made now. */
    stations: string[]
    held?: ItemInfo
    /** The skill bar's six slots (Shift+1–6): the active skill in each, ticks of its cooldown left and in all. */
    skillbar: ({ id: string; left: number; cooldown: number; /** one has it now (what lent it is still worn) */ usable: boolean } | null)[]
    /** Every active skill one has now, and where it comes from (the skill panel). */
    actives: KnownActive[]
    inventory: ItemInfo[]
    /** The bag's slots (row 1 is the toolbar): a stack each, or empty. */
    slots: ({ item: ItemInfo; count: number; worn?: boolean } | null)[]
    selected: number
    /** The boons the companion following the player has been given, the one it carries, and whether a waypoint is near (boons.ts). */
    boons?: { unlocked: string[]; active?: string; atWaypoint: boolean }
    /** What is worn in the off hand (a shield), and whether it works there (another profession's does not). */
    offhand?: ItemInfo & { works: boolean }
    /** What is worn, by slot (`head`, `body`, `ring`, `ring.2` …: the `wear:` props, the off hand's too), while it is still carried. */
    worn: Record<string, ItemInfo>
  }
  /** A yes/no question waiting for the player (time is stopped). */
  question?: { text: Text }
  /** The world's facts (the story's counts: what the smith has been given…), for the HUD's objective. */
  facts: Record<string, PropValue>
  /**
   * The one at the keys has fallen (down): who felled them, and the game's difficulty, which says
   * what may follow (the death screen: get up where one fell, rise at home, or the end).
   */
  fallen?: { by?: Text; difficulty: Difficulty }
  /** What the two keys would do right now (filled by the host, not by snapshot()). */
  keys?: { hands?: KeyView; take?: KeyView; put?: KeyView; use?: KeyView; self?: KeyView }
  /** The open container panel (the host names it): its contents. */
  container?: {
    id: Id
    name: Text
    capacity?: number
    contents: ItemInfo[]
  }
  entities: EntitySnap[]
  tiles: TileSnap[]
  fx: FxEvent[]
  pendingMap?: string
  /** What the player's E / F keys would do right now (filled by the host, not by snapshot()). */
  prompt?: Prompt
  /** Quests: the marks over the people on this map ('!' to give, '?' to take back), and the player's log. */
  quests: { marks: Record<Id, '!' | '?'>; log: QuestView[] }
  /** The lesson at hand (docs/prologue.md, the drills): what to spotlight, the key to draw, what the keys may do. */
  lesson?: LessonView
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
  /** The world has never seen this (an experiment). */
  unknown?: boolean
  /** It will ask first. */
  confirm?: boolean
  /** It sets what is held down there (it builds): the left button held and dragged sets one in each cell. */
  sets?: boolean
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
  return {
    id,
    type: e.type,
    sprite: r.sprite ?? e.type,
    name: e.name ?? r.name ?? e.type.split('/').pop()!,
    tags: [...r.tags, ...(e.tags ?? [])],
    statuses: Object.keys(e.statuses ?? {}),
    props: { ...r.props, ...(e.props ?? {}) },
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

export function snapshot(eng: Engine, opts: { panel?: Id } = {}): Frame {
  const w = eng.world
  const p = w.player
  const pos = w.posOf(p)!
  const map = pos.map
  const entities: EntitySnap[] = []
  for (const e of w.entitiesOnMap(map)) {
    if (e.place.on !== 'tile') continue
    const r = w.onto.resolve(e.type)
    // in the hand: what it holds, else the weapon it keeps in the main hand
    const held = e.held ? w.get(e.held) : weaponOf(w, e)
    const b = e.boss, kit = b && eng.bossKits[b.kit]
    const elapsed = w.state.tick - (b?.actionTick ?? w.state.tick)
    const windup = b?.pending ? Math.min(1, elapsed / Math.max(1, b.pending.releaseAt - (b.actionTick ?? 0))) : 0
    const hurt = w.num(e, 'hp') > 0 && w.state.tick - (e.combat?.lastHurtTick ?? -100) < 4
    entities.push({
      id: e.id,
      type: e.type,
      sprite: r.sprite ?? e.type,
      x: e.place.x,
      y: e.place.y,
      ...(e.place.z && { z: e.place.z }),
      ...(w.spacesOf(e).some((s) => s !== 'body') && { spaces: w.spacesOf(e) }),
      facing: e.facing ?? 'down',
      statuses: Object.keys(e.statuses ?? {}),
      ...((o) => o.length && { overlays: o })(Object.keys(e.statuses ?? {}).flatMap((s) => w.onto.status(s)?.overlay ?? [])),
      tags: [...r.tags, ...(e.tags ?? [])],
      name: e.name ?? r.name ?? e.type.split('/').pop()!,
      hp: w.prop(e, 'maxHp') !== undefined ? w.num(e, 'hp') : undefined,
      maxHp: w.prop(e, 'maxHp') !== undefined ? w.num(e, 'maxHp', 1) : undefined,
      appearance: e.npc?.appearance ?? (e.id === w.state.player ? PLAYER_LOOK : e.npc ? PLAYER_LOOK : undefined),
      look: e.look ?? e.npc?.look,
      // whether it would set on the one at the keys (its factions, temper, foes): not whether it is chasing
      // this moment (a bat that wheels away is no friend)
      hostile: e.ai ? eng.hostileTo(e, w.player) : undefined,
      frozen: !!e.frozenBy,
      element: (w.prop(e, 'element') as string | undefined) ?? undefined,
      open: !!e.statuses?.open,
      held: held ? (w.onto.resolve(held.type).sprite ?? held.type) : undefined,
      heldTags: held ? [...w.onto.resolve(held.type).tags, ...(held.tags ?? [])] : undefined,
      boss: b && kit ? {
        kit: b.kit, phase: b.phase ?? 1, color: kit.color, footprint: kit.footprint, enrageAt: kit.enrageAt,
        action: w.num(e, 'hp') <= 0 ? 'death' : hurt ? 'hurt' : b.action,
        skill: kit.skills[b.pending?.skill ?? ((b.nextSkill ?? 0) + kit.skills.length - 1) % kit.skills.length]?.id,
        progress: w.num(e, 'hp') <= 0 ? Math.min(1, elapsed / 16) : hurt ? Math.min(1, (w.state.tick - (e.combat?.lastHurtTick ?? w.state.tick)) / 3) : b.pending ? windup * 0.5 : Math.min(1, 0.5 + 0.5 * elapsed / Math.max(1, (b.actionEnd ?? 0) - (b.actionTick ?? 0))),
        animationElapsedMs: Math.max(0, hurt ? w.state.tick - (e.combat?.lastHurtTick ?? w.state.tick) : elapsed) * 100,
        warning: b.pending ? { name: kit.skills[b.pending.skill].name, tiles: b.pending.tiles, progress: windup } : undefined,
      } : undefined,
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
    tiles.push({ x, y, terrain: w.terrainAt(map, x, y), statuses: statuses.length ? statuses : undefined, ...(hurt && { hp: w.num(top!, 'hp'), maxHp: w.num(top!, 'maxHp') }) })
  }
  const panel = opts.panel ? w.get(opts.panel) : undefined
  const box = panel && w.hasStatus({ e: panel.id }, 'open') ? panel : undefined
  const capacity = box && w.prop(box, 'capacity')
  // the bag's slots: each the stack of carried items with that key — what is worn is on the body, not in the bag
  const carried = new Map<string, Id[]>()
  const onBody = eng.controls.wornIds()
  for (const id of [...(p.held ? [p.held] : []), ...(p.contents ?? [])]) {
    const e = w.get(id)
    if (!e || onBody.has(id)) continue
    const k = eng.controls.key(e)
    carried.set(k, [...(carried.get(k) ?? []), id])
  }
  const wearing = new Set(w.worn(p).map((e) => e.id))
  const slots = Array.from({ length: Math.max(SLOT_COUNT, p.slots?.length ?? 0) }, (_, i) => {
    const k = p.slots?.[i]
    const ids = k ? carried.get(k) : undefined
    const first = ids && itemInfo(eng, ids[0])
    // what of the stack the player wears (world-model.md §6.8)
    const worn = !!ids && ids.some((id) => wearing.has(id))
    return first ? { item: first, count: ids!.length, ...(worn && { worn }) } : null
  })
  const fx = w.drainFx()
  const sc = w.scene
  return {
    tick: w.state.tick,
    hour: w.hour(),
    night: nightHours(w.nightShift()),
    calendar: w.calendar(),
    scene: sc ? { id: sc.id, waiting: sc.waiting, line: sc.line } : undefined,
    map,
    player: {
      id: p.id,
      x: pos.x,
      y: pos.y,
      ...(pos.z && { z: pos.z }),
      ...((room) => room && { room })(roomCells(eng, pos)),
      facing: p.facing ?? 'down',
      hp: w.num(p, 'hp'),
      maxHp: w.num(p, 'maxHp', 1),
      hunger: w.num(p, 'hunger', w.num(p, 'maxHunger')),
      maxHunger: w.num(p, 'maxHunger'),
      statuses: Object.keys(p.statuses ?? {}),
      props: { ...w.onto.resolve(p.type).props, ...(p.props ?? {}) },
      skills: skillsOf(p),
      stations: [...w.stationsNear(p)],
      held: p.held ? itemInfo(eng, p.held) : undefined,
      ...((known) => ({
        skillbar: eng.controls.skillbar().map((id) => (id ? { id, left: castLeft(eng, p, id), cooldown: castCooldown(eng, p, id), usable: known.some((k) => k.id === id) } : null)),
        actives: known,
      }))(knownActives(eng, p)),
      inventory: (p.contents ?? []).map((id) => itemInfo(eng, id)).filter((x): x is ItemInfo => !!x),
      slots,
      selected: p.selected ?? 0,
      boons: (() => {
        const bird = companionsOf(w, p)[0]
        return bird && { unlocked: boonsOf(w, bird), active: activeBoon(bird), atWaypoint: nearAttunedWaypoint(w, p) }
      })(),
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
    },
    question: w.state.question ? { text: w.state.question.text } : undefined,
    quests: questsOf(eng, entities),
    ...(fallen(eng) && { fallen: fallen(eng) }),
    facts: { ...(w.story?.props ?? {}) },
    ...((lesson) => lesson && { lesson })(lessonView(eng)),
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
}

export const PLAYER_LOOK: Appearance = { skin: 1, hair: 2, hairStyle: 0, top: 0, bottom: 1 }

/** The marks over the people in view, and the player's quest log. */
function questsOf(eng: Engine, entities: EntitySnap[]): Frame['quests'] {
  const marks: Record<Id, '!' | '?'> = {}
  if (eng.quests.defs.length)
    for (const e of entities) {
      if (!e.tags.includes('person')) continue
      const m = eng.quests.mark(e.id)
      if (m) marks[e.id] = m
    }
  return { marks, log: eng.quests.log() }
}
