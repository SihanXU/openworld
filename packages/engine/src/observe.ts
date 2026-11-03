// What a seat sees (docs/agent-players.md §3.2): the world round one actor as a person there would read it off the
// screen, from the world and the same Controls that answer the keys, never from anything hidden. Coordinates are the
// map's own (x right, y down) with the offset from the seat beside them. Names and lines are the world's data.

import type { Engine } from './engine.ts'
import { textOf } from './engine.ts'
import type { Dir, Entity, Id } from './types.ts'

export const SIGHT = 8

const KEYS = ['hands', 'put', 'primary', 'secondary'] as const
const LIST_LIMIT = 20

export interface ThingView {
  id: Id
  type: string
  name: string
  kind: 'person' | 'creature' | 'item' | 'thing'
  x: number
  y: number
  dx: number
  dy: number
  facing?: Dir
  hp?: number
  maxHp?: number
  statuses?: string[]
  hostile?: boolean
}

export interface KeyHint {
  label: string
  target?: Id
  dx: number
  dy: number
  unknown?: boolean
  confirm?: boolean
}

export interface Observation {
  tick: number
  hour: number
  map: string
  me: {
    id: Id
    name: string
    x: number
    y: number
    facing: Dir
    hp: number
    maxHp: number
    hunger?: number
    maxHunger?: number
    statuses: string[]
    held?: { id: Id; type: string; name: string }
    bag: { type: string; name: string; count: number }[]
  }
  grid: { x0: number; y0: number; rows: string[] }
  things: ThingView[]
  warnings: { from: Id; tiles: [number, number][]; progress: number; onMe: boolean }[]
  keys: Partial<Record<(typeof KEYS)[number], KeyHint>>
  container?: { id: Id; name: string; contents: { id: Id; name: string; type: string }[] }
}

export function observe(eng: Engine, actor: Id): Observation | undefined {
  const w = eng.world
  const me = w.get(actor)
  const pos = me && w.posOf(me)
  if (!me || !pos) return undefined
  const { map, x, y } = pos
  const seat = eng.seats.get(actor)
  const controls = seat?.controls ?? eng.controls
  const nameOf = (e: Entity) => textOf(e.name ?? w.onto.resolve(e.type).name ?? e.type.split('/').pop()!)
  const inSight = (tx: number, ty: number) => Math.abs(tx - x) <= SIGHT && Math.abs(ty - y) <= SIGHT

  const struck = new Set<string>()
  const warnings: Observation['warnings'] = []
  for (const hook of eng.hooks.telegraphs)
    for (const t of hook(map)) {
      const near = t.tiles.filter(([tx, ty]) => inSight(tx, ty))
      if (!near.length) continue
      for (const [tx, ty] of near) struck.add(`${tx},${ty}`)
      warnings.push({ from: t.who, tiles: near.map(([tx, ty]) => [tx - x, ty - y]), progress: t.progress, onMe: near.some(([tx, ty]) => tx === x && ty === y) })
    }

  const bodies = new Set<string>()
  const things: ThingView[] = []
  for (const e of w.entitiesOnMap(map)) {
    if (e.id === actor || e.place.on !== 'tile' || w.isTerrain(e) || !inSight(e.place.x, e.place.y)) continue
    const { x: ex, y: ey } = e.place
    const statuses = Object.keys(e.statuses ?? {})
    if (w.isAgent(e)) bodies.add(`${ex},${ey}`)
    things.push({
      id: e.id,
      type: e.type,
      name: nameOf(e),
      kind: e.type.startsWith('item/') ? 'item' : e.type.startsWith('actor/person') ? 'person' : e.type.startsWith('actor/') ? 'creature' : 'thing',
      x: ex,
      y: ey,
      dx: ex - x,
      dy: ey - y,
      ...(w.isAgent(e) && { facing: e.facing ?? 'down' }),
      ...(w.prop(e, 'maxHp') !== undefined && { hp: w.num(e, 'hp'), maxHp: w.num(e, 'maxHp', 1) }),
      ...(statuses.length && { statuses }),
      ...(e.ai && { hostile: eng.hostileTo(e, me) }),
    })
  }
  things.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)) || (a.id < b.id ? -1 : 1))

  const cell = (gx: number, gy: number) => {
    if (!w.inBounds(map, gx, gy)) return ' '
    if (gx === x && gy === y) return '@'
    if (struck.has(`${gx},${gy}`)) return '!'
    if (bodies.has(`${gx},${gy}`)) return 'o'
    return w.blocked(map, gx, gy, actor, pos.z ?? 0) ? '#' : '.'
  }
  const rows = Array.from({ length: 2 * SIGHT + 1 }, (_, i) => Array.from({ length: 2 * SIGHT + 1 }, (_, j) => cell(x - SIGHT + j, y - SIGHT + i)).join(''))

  const worn = controls.wornIds()
  const bag = new Map<string, { type: string; name: string; count: number }>()
  for (const id of me.contents ?? []) {
    const item = w.get(id)
    if (!item || worn.has(id) || item.place.on !== 'inside') continue
    const have = bag.get(item.type)
    if (have) have.count += 1
    else bag.set(item.type, { type: item.type, name: nameOf(item), count: 1 })
  }
  const held = me.held ? w.get(me.held) : undefined

  const keys: Observation['keys'] = {}
  for (const k of KEYS) {
    const plan = controls.plan(k, undefined)
    if (!plan) continue
    keys[k] = {
      label: textOf(plan.label),
      ...('e' in plan.target && { target: plan.target.e }),
      dx: plan.at.x - x,
      dy: plan.at.y - y,
      ...(plan.unknown && !plan.quiet && { unknown: true }),
      ...(plan.confirm && { confirm: true }),
    }
  }

  const contentsOf = (box: Entity) =>
    (box.contents ?? []).flatMap((id) => {
      const item = w.get(id)
      return item ? [{ id, name: nameOf(item), type: item.type }] : []
    })
  const box = seat?.panel ? w.get(seat.panel) : undefined
  const open = box && w.hasStatus({ e: box.id }, 'open')
  const maxHunger = w.num(me, 'maxHunger', 0)
  return {
    tick: w.state.tick,
    hour: w.hour(),
    map,
    me: {
      id: actor,
      name: nameOf(me),
      x,
      y,
      facing: me.facing ?? 'down',
      hp: w.num(me, 'hp'),
      maxHp: w.num(me, 'maxHp', 1),
      ...(maxHunger > 0 && { hunger: w.num(me, 'hunger'), maxHunger }),
      statuses: Object.keys(me.statuses ?? {}),
      ...(held && { held: { id: held.id, type: held.type, name: nameOf(held) } }),
      bag: [...bag.values()],
    },
    grid: { x0: x - SIGHT, y0: y - SIGHT, rows },
    things,
    warnings,
    keys,
    ...(box && open && { container: { id: box.id, name: nameOf(box), contents: contentsOf(box) } }),
  }
}

export function describe(o: Observation): string {
  const m = o.me
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  const out = [
    `Tick ${o.tick}, ${String(Math.floor(o.hour)).padStart(2, '0')}:00, on ${o.map} at (${m.x},${m.y}) facing ${m.facing}. HP ${m.hp}/${m.maxHp}${m.maxHunger ? `, hunger ${m.hunger}/${m.maxHunger}` : ''}${m.statuses.length ? `, ${m.statuses.join(', ')}` : ''}.`,
    m.held ? `Holding ${m.held.name}.` : 'Hands empty.',
  ]
  if (m.bag.length) out.push(`Carrying ${m.bag.map((b) => (b.count > 1 ? `${b.count} ${b.name}` : b.name)).join(', ')}.`)
  const onMe = o.warnings.filter((a) => a.onMe)
  if (onMe.length) out.push(`DANGER: ${onMe.map((a) => `${a.from} will strike here (${Math.round(a.progress * 100)}% wound up)`).join('; ')}. Step off the marked cells.`)
  if (o.warnings.length > onMe.length) out.push(`${o.warnings.length - onMe.length} more wind-up(s) in sight, not over you.`)
  if (o.things.length) {
    out.push('In sight (nearest first):')
    for (const t of o.things.slice(0, LIST_LIMIT)) out.push(`- ${t.name} [${t.id}] ${t.kind}${t.hostile ? ', hostile' : ''} at (${sign(t.dx)},${sign(t.dy)})${t.hp !== undefined ? `, HP ${t.hp}/${t.maxHp}` : ''}`)
    if (o.things.length > LIST_LIMIT) out.push(`- … and ${o.things.length - LIST_LIMIT} more`)
  }
  const keys = Object.entries(o.keys)
  if (keys.length) out.push(`Keys in front of you: ${keys.map(([k, v]) => `${k}: ${v.label}${v.unknown ? ' (unknown outcome)' : ''}${v.confirm ? ' (asks first)' : ''}`).join('; ')}.`)
  if (o.container) out.push(`Open: ${o.container.name} holds ${o.container.contents.map((c) => c.name).join(', ') || 'nothing'}.`)
  out.push('Map (@ you, # blocked, o a body, ! to be struck):', ...o.grid.rows)
  return out.join('\n')
}
