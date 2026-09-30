// Render-agnostic frame snapshots for the client (sent from the engine Worker each tick).

import type { Engine } from './engine.ts'
import type { Appearance, Dir, FxEvent, Id, Text } from './types.ts'

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
  map: string
  player: {
    id: Id
    x: number
    y: number
    facing: Dir
    hp: number
    maxHp: number
    statuses: string[]
    held?: ItemInfo
    inventory: ItemInfo[]
  }
  /** The open container the player faces: what the container panel shows. */
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

export function snapshot(eng: Engine): Frame {
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
      appearance: e.npc?.appearance ?? (e.id === w.state.player ? PLAYER_LOOK : undefined),
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
  const box = eng.facingContainer()
  const capacity = box && w.prop(box, 'capacity')
  const fx = w.fx
  w.fx = []
  return {
    tick: w.state.tick,
    hour: w.hour(),
    map,
    player: {
      id: p.id,
      x: pos.x,
      y: pos.y,
      facing: p.facing ?? 'down',
      hp: w.num(p, 'hp'),
      maxHp: w.num(p, 'maxHp', 1),
      statuses: Object.keys(p.statuses ?? {}),
      held: p.held ? itemInfo(eng, p.held) : undefined,
      inventory: (p.contents ?? []).map((id) => itemInfo(eng, id)).filter((x): x is ItemInfo => !!x),
    },
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
