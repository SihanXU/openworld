// Render-agnostic frame snapshots for the client (sent from the engine Worker each tick).

import type { Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import type { Appearance, BossState, Dir, FxEvent, Id, PropValue, SceneState, Text } from './types.ts'
import { SLOT_COUNT } from './controls.ts'
import { parseCellId } from './cells.ts'
import { skillsOf } from './progression.ts'
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
  facing: Dir
  statuses: string[]
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
    progress: number
    warning?: { name: Text; tiles: [number, number][]; progress: number }
  }
}

export interface TileSnap {
  x: number
  y: number
  terrain?: string
  statuses?: string[]
}

export interface Frame {
  tick: number
  hour: number
  calendar: Calendar
  /** A scene is playing: the player watches; `advance` moves past what is said. */
  scene?: { id: string; waiting?: 'advance' | 'move'; line?: SceneState['line'] }
  map: string
  player: {
    id: Id
    x: number
    y: number
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
    held?: ItemInfo
    inventory: ItemInfo[]
    /** The bag's slots (row 1 is the toolbar): a stack each, or empty. */
    slots: ({ item: ItemInfo; count: number } | null)[]
    selected: number
  }
  /** A yes/no question waiting for the player (time is stopped). */
  question?: { text: Text }
  /** The world's facts (the story's counts: what the smith has been given…), for the HUD's objective. */
  facts: Record<string, PropValue>
  /** What the two keys would do right now (filled by the host, not by snapshot()). */
  keys?: { hands?: KeyView; take?: KeyView; use?: KeyView; put?: KeyView }
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
}

export interface KeyView {
  label: Text
  /** The world has never seen this (an experiment). */
  unknown?: boolean
  /** It will ask first. */
  confirm?: boolean
  x: number
  y: number
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

export function snapshot(eng: Engine, opts: { panel?: Id } = {}): Frame {
  const w = eng.world
  const p = w.player
  const pos = w.posOf(p)!
  const map = pos.map
  const entities: EntitySnap[] = []
  for (const e of w.entitiesOnMap(map)) {
    if (e.place.on !== 'tile') continue
    const r = w.onto.resolve(e.type)
    const held = e.held ? w.get(e.held) : undefined
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
      facing: e.facing ?? 'down',
      statuses: Object.keys(e.statuses ?? {}),
      tags: [...r.tags, ...(e.tags ?? [])],
      name: e.name ?? r.name ?? e.type.split('/').pop()!,
      hp: w.prop(e, 'maxHp') !== undefined ? w.num(e, 'hp') : undefined,
      maxHp: w.prop(e, 'maxHp') !== undefined ? w.num(e, 'maxHp', 1) : undefined,
      appearance: e.npc?.appearance ?? (e.id === w.state.player ? PLAYER_LOOK : e.npc ? PLAYER_LOOK : undefined),
      look: e.look ?? e.npc?.look,
      hostile: e.ai ? e.ai.state === 'chase' : undefined,
      frozen: !!e.frozenBy,
      element: (w.prop(e, 'element') as string | undefined) ?? undefined,
      open: !!e.statuses?.open,
      held: held ? (w.onto.resolve(held.type).sprite ?? held.type) : undefined,
      heldTags: held ? [...w.onto.resolve(held.type).tags, ...(held.tags ?? [])] : undefined,
      boss: b && kit ? {
        kit: b.kit, phase: b.phase ?? 1, color: kit.color, footprint: kit.footprint, enrageAt: kit.enrageAt,
        action: w.num(e, 'hp') <= 0 ? 'death' : hurt ? 'hurt' : b.action,
        progress: w.num(e, 'hp') <= 0 ? Math.min(1, elapsed / 16) : b.pending ? windup * 0.5 : Math.min(1, 0.5 + 0.5 * elapsed / Math.max(1, (b.actionEnd ?? 0) - (b.actionTick ?? 0))),
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
    tiles.push({ x, y, terrain: w.terrainAt(map, x, y), statuses: statuses.length ? statuses : undefined })
  }
  const panel = opts.panel ? w.get(opts.panel) : undefined
  const box = panel && w.hasStatus({ e: panel.id }, 'open') ? panel : undefined
  const capacity = box && w.prop(box, 'capacity')
  // the bag's slots: each the stack of carried items with that key
  const carried = new Map<string, Id[]>()
  for (const id of [...(p.held ? [p.held] : []), ...(p.contents ?? [])]) {
    const e = w.get(id)
    if (!e) continue
    const k = eng.controls.key(e)
    carried.set(k, [...(carried.get(k) ?? []), id])
  }
  const slots = Array.from({ length: Math.max(SLOT_COUNT, p.slots?.length ?? 0) }, (_, i) => {
    const k = p.slots?.[i]
    const ids = k ? carried.get(k) : undefined
    const first = ids && itemInfo(eng, ids[0])
    return first ? { item: first, count: ids!.length } : null
  })
  const fx = w.drainFx()
  const sc = w.scene
  return {
    tick: w.state.tick,
    hour: w.hour(),
    calendar: w.calendar(),
    scene: sc ? { id: sc.id, waiting: sc.waiting, line: sc.line } : undefined,
    map,
    player: {
      id: p.id,
      x: pos.x,
      y: pos.y,
      facing: p.facing ?? 'down',
      hp: w.num(p, 'hp'),
      maxHp: w.num(p, 'maxHp', 1),
      hunger: w.num(p, 'hunger', w.num(p, 'maxHunger')),
      maxHunger: w.num(p, 'maxHunger'),
      statuses: Object.keys(p.statuses ?? {}),
      props: { ...w.onto.resolve(p.type).props, ...(p.props ?? {}) },
      skills: skillsOf(p),
      held: p.held ? itemInfo(eng, p.held) : undefined,
      inventory: (p.contents ?? []).map((id) => itemInfo(eng, id)).filter((x): x is ItemInfo => !!x),
      slots,
      selected: p.selected ?? 0,
    },
    question: w.state.question ? { text: w.state.question.text } : undefined,
    quests: questsOf(eng, entities),
    facts: { ...(w.story?.props ?? {}) },
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
