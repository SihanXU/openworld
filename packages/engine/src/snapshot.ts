// Render-agnostic frame snapshots for the client (sent from the engine Worker each tick).

import type { Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import type { Appearance, Dir, FxEvent, Id, PropValue, SceneState, Text } from './types.ts'
import { SLOT_COUNT } from './controls.ts'
import { friendship, memoryOf } from './people.ts'

export interface ItemInfo {
  id: Id
  type: string
  sprite: string
  name: Text
  tags: string[]
  statuses: string[]
}

export interface EntitySnap {
  id: Id
  type: string
  kind: string
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
  /** The player's letters (newest last). */
  mailbox: { id: string; day: number; read: boolean; from?: Text; text: Text; items: number }[]
  map: string
  player: {
    id: Id
    x: number
    y: number
    facing: Dir
    hp: number
    maxHp: number
    statuses: string[]
    props: Record<string, PropValue>
    held?: ItemInfo
    inventory: ItemInfo[]
    /** The bag's slots (row 1 is the toolbar): a stack each, or empty. */
    slots: ({ item: ItemInfo; count: number } | null)[]
    selected: number
  }
  /** A yes/no question waiting for the player (time is stopped). */
  question?: { text: Text }
  /** The people the player knows of: the Social tab. */
  social: SocialEntry[]
  /** What the two keys would do right now (filled by the host, not by snapshot()). */
  keys?: { action?: KeyView; use?: KeyView }
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
}

export interface KeyView {
  label: Text
  /** Use: the world has never seen this. */
  unknown?: boolean
  /** Action: it will ask first. */
  confirm?: boolean
  x: number
  y: number
}

export interface SocialEntry {
  id: Id
  name: Text
  look?: string
  points: number
  /** Gifts this week (of 2) and today. */
  giftsWeek: number
  giftedToday: boolean
  talkedToday: boolean
  birthday?: { season: string; day: number }
  /** Gifts given so far and how they were taken (item type → taste). */
  tasted: Record<string, string>
  met: boolean
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
    entities.push({
      id: e.id,
      type: e.type,
      kind: r.kind,
      sprite: r.sprite ?? e.type,
      x: e.place.x,
      y: e.place.y,
      facing: e.facing ?? 'down',
      statuses: Object.keys(e.statuses ?? {}),
      tags: [...r.tags, ...(e.tags ?? [])],
      name: e.name ?? r.name ?? e.type.split('/').pop()!,
      hp: r.kind === 'actor' ? w.num(e, 'hp') : undefined,
      maxHp: r.kind === 'actor' ? w.num(e, 'maxHp', 1) : undefined,
      appearance: e.npc?.appearance ?? (e.id === w.state.player ? PLAYER_LOOK : e.npc ? PLAYER_LOOK : undefined),
      look: e.look ?? e.npc?.look,
      hostile: e.ai?.hostile,
      frozen: !!e.frozenBy,
      element: (w.prop(e, 'element') as string | undefined) ?? undefined,
      open: !!e.statuses?.open,
      held: held ? (w.onto.resolve(held.type).sprite ?? held.type) : undefined,
      heldTags: held ? [...w.onto.resolve(held.type).tags, ...(held.tags ?? [])] : undefined,
    })
  }
  const tiles: TileSnap[] = []
  const prefix = map + ':'
  for (const [k, t] of Object.entries(w.state.tiles)) {
    if (!k.startsWith(prefix)) continue
    const [, x, y] = k.split(':')
    tiles.push({ x: +x, y: +y, terrain: t.terrain, statuses: t.statuses ? Object.keys(t.statuses) : undefined })
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
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const k = p.slots?.[i]
    const ids = k ? carried.get(k) : undefined
    const first = ids && itemInfo(eng, ids[0])
    return first ? { item: first, count: ids!.length } : null
  })
  const cal = w.calendar()
  const week = Math.floor((cal.day - 1) / 7)
  const social: SocialEntry[] = Object.values(w.state.entities)
    .filter((e) => e.npc?.person)
    .map((e) => {
      const mem = memoryOf(eng, e.id)
      const g = mem.gifts && mem.gifts.week === week ? mem.gifts : undefined
      return {
        id: e.id,
        name: e.name ?? e.id,
        look: e.npc?.look,
        points: friendship(eng, e.id),
        giftsWeek: g?.count ?? 0,
        giftedToday: g?.day === cal.day,
        talkedToday: mem.talked === cal.day,
        birthday: e.npc?.person?.birthday,
        tasted: { ...(mem.tasted ?? {}) },
        met: mem.talked !== undefined,
      }
    })
  const fx = w.fx
  w.fx = []
  const sc = w.state.scene
  return {
    tick: w.state.tick,
    hour: w.hour(),
    calendar: w.calendar(),
    scene: sc ? { id: sc.id, waiting: sc.waiting, line: sc.line } : undefined,
    mailbox: (w.state.mailbox ?? []).map((l) => {
      const def = eng.letters.get(l.id)
      return { id: l.id, day: l.day, read: !!l.read, from: def?.from ? eng.nameOf({ e: def.from }) : undefined, text: def?.text ?? '', items: l.items?.length ?? 0 }
    }),
    map,
    player: {
      id: p.id,
      x: pos.x,
      y: pos.y,
      facing: p.facing ?? 'down',
      hp: w.num(p, 'hp'),
      maxHp: w.num(p, 'maxHp', 1),
      statuses: Object.keys(p.statuses ?? {}),
      props: { ...(p.props ?? {}) },
      held: p.held ? itemInfo(eng, p.held) : undefined,
      inventory: (p.contents ?? []).map((id) => itemInfo(eng, id)).filter((x): x is ItemInfo => !!x),
      slots,
      selected: p.selected ?? 0,
    },
    question: w.state.question ? { text: w.state.question.text } : undefined,
    social,
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
