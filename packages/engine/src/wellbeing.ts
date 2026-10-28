// Wellbeing (design.md §5.18): what is wrong for an actor and what would put it right, read from the world's own
// rules. Nothing here knows rain, fire or hunger. A status is minded as its data says (StatusDef.mind, a kind's
// TypeDef.minds, `endures:<id>`); what it harms is what bearing it does (its pulse's outcome on its bearer); what a
// place does to one is what standing there brings (its contacts, the world's clocks and the pulses about it); what
// an act does is its outcome on the one it is for. Each is a dry run of the rule library (Engine.resolveEvent): a
// rule learned later — a cloak that keeps the rain off, a herb that stops a bleed — changes what people do at once.
// Outcomes no rule answers are never relied on (behaviour asks the world nothing: their default is what would
// happen, and it is not counted as a cure). The goals that act on it are in behaviour.ts (danger, need).

import type { Engine } from './engine.ts'
import { isDo, matchSelector, rolesOf, type Roles } from './rules.ts'
import type { Amount, Effect, Entity, GameEvent, Id, Pos, PropValue, Ref } from './types.ts'
import type { View } from './world.ts'

/** What an outcome does to one thing: the statuses it gives and takes, the health it costs or gives, the props it moves. */
export interface Delta {
  adds: Set<string>
  removes: Set<string>
  /** Health given (above 0) or taken (below), as near as the rules say (an amount read in the event). */
  hp: number
  props: Record<string, number>
  /** It is destroyed or broken down. */
  gone: boolean
  /** It becomes another kind (an empty bucket filled). */
  becomes?: string
  /** Somewhere on the way the rules do not answer (the world would be asked): not to be relied on. */
  unknown: boolean
}

/** What is wrong: a status borne (or one a place brings), how much it weighs, whether it harms, and for whom. */
export interface Trouble {
  /** The one it is wrong for: oneself, or one cared for. */
  subject: Id
  /** The status, or `hp` (health running low, or a place that costs it). */
  status: string
  weight: number
  /** It does harm (a danger: put before everything but a boss's fight). */
  danger: boolean
  /** It is the place one stands that brings it (leaving is the cure). */
  place?: boolean
}

/** Health lost by a pulse weighs this much (a danger), over any discomfort. */
export const HARM = 10
/** Health under this share of its most is a trouble of its own (its cure: what heals). */
export const LOW_HP = 0.5
/** How far round a place the pulses of what bears a status are read (cells): a burning neighbour. */
const PULSE_REACH = 2
/** How long a place's reading is kept (ticks). */
const PLACE_TTL = 20

/** A thing read as it would be: another kind (`type`: the bucket once filled), bearing statuses too (`bears`). */
export interface Swap {
  id: Id
  type?: string
  bears?: string[]
}

const empty = (): Delta => ({ adds: new Set(), removes: new Set(), hp: 0, props: {}, gone: false, unknown: false })

/** The other side of a relation (World.relationsOf): what the touched thing feels of the toucher. */
const REVERSE: Record<string, string> = { on: 'under', 'in-region': 'encloses', support: 'supports' }

export class Wellbeing {
  private places = new Map<string, { at: number; d: Delta }>()
  private harmCache = new Map<string, boolean>()
  private harmsOf = -1

  constructor(private eng: Engine) {}

  // ---------------------------------------------------------------- reading an outcome

  /**
   * What an event's outcome does to `subject`, followed down the impulses it sends (to a role, or to those an area,
   * a map or its sky would reach — `at` where the subject would stand). `swap` reads one thing as another kind (an
   * instrument as it would be once made: the empty bucket as a full one).
   */
  outcome(ev: GameEvent, subject: Id, at?: Pos, depth = 3, swap?: Swap): Delta {
    const w = this.eng.world
    const saved = w.state.rng
    const luck = w.luck
    // what may happen: a chance the rules give comes up (a fire's wear, a spark that may catch), and the dice are
    // left as they were
    w.luck = () => true
    try {
      return this.follow(ev, subject, at ?? w.posOf(w.get(subject)!) ?? undefined, depth, swap)
    } finally {
      w.state.rng = saved
      w.luck = luck
    }
  }

  private follow(ev: GameEvent, subject: Id, at: Pos | undefined, depth: number, swap?: Swap): Delta {
    const eng = this.eng
    const w = eng.world
    const roles: Roles = rolesOf(ev, w)
    if (swap) for (const k of Object.keys(roles) as (keyof Roles)[]) if (roles[k]?.id === swap.id) roles[k] = this.as(roles[k]!, swap)
    const res = eng.lib.resolve(ev, roles, w, () => eng.tierOf(ev))
    const out = empty()
    let effects: Effect[]
    if (res.defined && res.leaf && isDo(res.leaf)) effects = res.leaf.do
    else {
      out.unknown = true
      effects = res.hole?.default ?? []
    }
    const host = 'e' in ev.host ? ev.host.e : undefined
    if (host === subject) this.read(effects, ev, out, swap)
    if (depth <= 0) return out
    for (const eff of effects) {
      if (eff.op !== 'emit') continue
      if (!this.reaches(eff, ev, subject, at)) continue
      const params: Record<string, PropValue> = {}
      for (const [k, v] of Object.entries(eff.params ?? {})) {
        const x = eng.effects.param(ev, v as PropValue)
        if (x !== undefined) params[k] = x
      }
      const ref = (r?: string): Ref | undefined => (r === 'host' ? ev.host : r ? ev.roles[r as keyof GameEvent['roles']] : undefined)
      const child: GameEvent = {
        kind: `impulse/${eff.impulse}` as GameEvent['kind'],
        host: { e: subject },
        roles: { source: ev.host, actor: ev.roles.actor ?? (ev.cause ? { e: ev.cause } : undefined), instrument: ev.roles.instrument, item: ref(eff.item), other: ref(eff.other) },
        params,
        cause: ev.cause,
      }
      merge(out, this.follow(child, subject, at, depth - 1, swap))
    }
    return out
  }

  /** Would an emit's impulse reach the subject (standing at `at`)? Its receivers as the effect runner finds them. */
  private reaches(eff: Extract<Effect, { op: 'emit' }>, ev: GameEvent, subject: Id, at: Pos | undefined): boolean {
    const eng = this.eng
    const w = eng.world
    const to = eff.to
    const v = w.view({ e: subject })
    if (!v || (eff.filter && !matchSelector(eff.filter, v))) return false
    if (eff.chance !== undefined && eff.chance <= 0) return false
    if (typeof to === 'string') {
      if (to === 'story' || to === 'world' || to === 'watch' || to.startsWith('tileOf:')) return false
      const r = to === 'host' ? ev.host : ev.roles[to as keyof GameEvent['roles']]
      return !!r && 'e' in r && r.e === subject
    }
    if ('named' in to) return to.named === subject
    if (!at) return false
    const from = 'e' in ev.host ? w.posOf(w.get(ev.host.e)!) : undefined
    if ('map' in to) return (!from || from.map === at.map) && (!to.sky || !w.covered(at.map, at.x, at.y, at.z))
    if ('around' in to) return !!from && from.map === at.map && Math.max(Math.abs(from.x - at.x), Math.abs(from.y - at.y)) <= Math.min(12, to.around) && subject !== ev.host.e
    if ('area' in to) {
      const c = eng.effects.pos(ev, to.area.at ?? 'host')
      if (!c || c.map !== at.map) return false
      const d = Math.abs(c.x - at.x) + Math.abs(c.y - at.y)
      return d > 0 && d <= Math.min(3, to.area.radius)
    }
    return false
  }

  /** A view of a thing as it would be: another kind (once made), or bearing a status too (were it to catch). */
  private as(v: View, swap: Swap): View {
    const out = { ...v, statuses: new Set([...v.statuses, ...(swap.bears ?? [])]) }
    if (!swap.type) return out
    const r = this.eng.world.onto.resolve(swap.type)
    return { ...out, type: swap.type, tags: new Set(r.tags), statuses: new Set(swap.bears ?? []), props: { ...r.props } }
  }

  /** What effects on their host do to it. */
  private read(effects: Effect[], ev: GameEvent, out: Delta, swap?: Swap): void {
    const eng = this.eng
    const w = eng.world
    const amount = (a: Amount | undefined) => (a === undefined ? 0 : Math.max(0, eng.effects.amount(ev, a)))
    for (const eff of effects) {
      switch (eff.op) {
        case 'addStatus': {
          const def = w.onto.data.statuses[eff.status]
          // warded off by what the host bears (fireproof wards burning): it does not take hold
          const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
          if (host && Object.keys(host.statuses ?? {}).some((s) => w.onto.data.statuses[s]?.wards?.includes(eff.status))) break
          out.adds.add(eff.status)
          out.removes.delete(eff.status)
          for (const c of def?.clears ?? []) (out.removes.add(c), out.adds.delete(c))
          break
        }
        case 'removeStatus':
          out.removes.add(eff.status)
          out.adds.delete(eff.status)
          break
        case 'hurt':
          out.hp -= Math.max(1, amount(eff.amount))
          break
        case 'heal':
          out.hp += Math.max(1, amount(eff.amount))
          break
        case 'destroy':
        case 'breakdown':
          out.gone = true
          break
        case 'transform': {
          // `@prop:key`: the kind the host's own prop names (an empty bucket's waterType)
          const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
          const into = eff.into.startsWith('@prop:') ? (host ? String(w.prop(host, eff.into.slice(6)) ?? '') : '') : eff.into
          out.becomes = into && w.onto.hasType(into) ? into : undefined
          break
        }
        case 'addProp': {
          const d = eng.effects.amount(ev, eff.delta)
          out.props[eff.key] = (out.props[eff.key] ?? 0) + d
          break
        }
        default: {
          const r = eng.effectReads.get(eff.op)?.(eff)
          if (r?.hp) out.hp += r.hp
          for (const [k, d] of Object.entries(r?.props ?? {})) out.props[k] = (out.props[k] ?? 0) + d
        }
      }
    }
    void swap
  }

  // ---------------------------------------------------------------- what weighs

  /** Does bearing a status harm its bearer (its pulse costs health, or breaks it)? Read for the kind, as it is now. */
  harms(e: Entity, status: string): boolean {
    const w = this.eng.world
    if (this.harmsOf !== this.eng.lib.version) (this.harmCache.clear(), (this.harmsOf = this.eng.lib.version))
    const key = `${e.type}|${status}|${Object.keys(e.statuses ?? {}).sort().join(',')}`
    const hit = this.harmCache.get(key)
    if (hit !== undefined) return hit
    // as one would be bearing it (one not yet burning is asked what burning would do)
    const d = this.outcome({ kind: 'time/period', host: { e: e.id }, roles: {}, params: { status }, origin: 'world' }, e.id, undefined, 2, { id: e.id, bears: [status] })
    const harm = !d.unknown && (d.hp < 0 || d.gone)
    this.harmCache.set(key, harm)
    void w
    return harm
  }

  /** How much a status weighs on one: its harm, and how much one minds it (one's kind's, else the status's own); nothing to one who endures it. */
  weight(e: Entity, status: string): number {
    const w = this.eng.world
    if (status === 'hp') return HARM / 2
    const harm = this.harms(e, status) ? HARM : 0
    if (w.hasTag(e, `endures:${status}`)) return harm
    const r = w.onto.resolve(e.type)
    const mind = r.minds[status] ?? w.onto.data.statuses[status]?.mind ?? 0
    return harm + Math.max(0, mind)
  }

  /** A status drawn under a prop's line (hungry: hunger under six tenths): raising the prop puts it right. */
  private threshold(status: string): { prop: string } | undefined {
    const t = this.eng.world.onto.data.thresholds?.find((t) => t.name === status && (!!t.below || t.lte !== undefined))
    return t ? { prop: t.prop } : undefined
  }

  /** Does an outcome put a status right (takes it, or fills the prop it is drawn under: food for hunger)? */
  cures(d: Delta, status: string): boolean {
    if (d.unknown || d.gone || d.hp < 0) return false
    if (status === 'hp') return d.hp > 0
    if (d.removes.has(status)) return true
    const t = this.threshold(status)
    return !!t && (d.props[t.prop] ?? 0) > 0
  }

  // ---------------------------------------------------------------- places

  /**
   * What standing at `at` does to one: the contacts it would make there (the floor and what it stands among, the
   * regions), each answered both ways; the world's clocks there (rain under the sky); the pulses of what bears a
   * status nearby (a burning neighbour's reach). Kept a moment, for the kind and its statuses.
   */
  placeAt(e: Entity, at: Pos): Delta {
    const eng = this.eng
    const w = eng.world
    const key = `${e.id}|${Object.keys(e.statuses ?? {}).sort().join(',')}|${at.map}:${at.x},${at.y},${at.z ?? 0}|${w.calendar().weather}`
    const hit = this.places.get(key)
    const t = w.state.tick
    if (hit && t - hit.at < PLACE_TTL) return hit.d
    if (this.places.size > 4000) this.places.clear()
    const d = empty()
    const st = w.stanceOf(e)
    const z = at.z ?? 0
    const touched: { o: Entity; how: string }[] = []
    if (!w.spacesOf(e).includes('floor')) {
      const floor = w.occupant(at.map, at.x, at.y, 'floor', z)
      if (floor && w.reachOf(floor).includes(st)) touched.push({ o: floor, how: 'on' })
      if (!w.reachOf(e).length) for (const f of w.entitiesAt(at.map, at.x, at.y, z)) if (f !== floor && f.id !== e.id && w.reachOf(f).includes(st)) touched.push({ o: f, how: 'on' })
    }
    for (const r of w.regionsAt(at.map, at.x, at.y, z)) touched.push({ o: r, how: 'in-region' })
    for (const { o, how } of touched) {
      merge(d, this.outcome({ kind: 'contact/begin', host: { e: o.id }, roles: { other: { e: e.id } }, params: { how: REVERSE[how] ?? how }, origin: 'world' }, e.id, at))
      merge(d, this.outcome({ kind: 'contact/begin', host: { e: e.id }, roles: { other: { e: o.id } }, params: { how }, origin: 'world' }, e.id, at))
    }
    // the world's clocks (the weather) where one would stand
    for (const p of w.onto.data.periods ?? [])
      if (p.host === 'world' || p.host === 'story') merge(d, this.outcome({ kind: 'time/period', host: { e: p.host }, roles: {}, params: { name: p.name }, origin: 'world' }, e.id, at))
    // what bears a status about the place: its pulses' reach (each kind and status once)
    const seen = new Set<string>()
    for (let dy = -PULSE_REACH; dy <= PULSE_REACH; dy++)
      for (let dx = -PULSE_REACH; dx <= PULSE_REACH; dx++) {
        if (!w.inBounds(at.map, at.x + dx, at.y + dy)) continue
        for (const o of w.entitiesAt(at.map, at.x + dx, at.y + dy, z)) {
          if (o.id === e.id || !o.statuses) continue
          for (const s of Object.keys(o.statuses)) {
            const k = `${o.type}|${s}|${dx},${dy}`
            if (seen.has(k)) continue
            seen.add(k)
            merge(d, this.outcome({ kind: 'time/period', host: { e: o.id }, roles: {}, params: { status: s }, origin: 'world' }, e.id, at))
          }
        }
      }
    this.places.set(key, { at: t, d })
    return d
  }

  /** How much a place weighs on one: what it brings that one minds (or keeps on one), and what it costs. */
  placeWeight(e: Entity, at: Pos): number {
    const d = this.placeAt(e, at)
    let n = d.hp < 0 || d.gone ? HARM : 0
    for (const s of d.adds) n += this.weight(e, s)
    return n
  }

  // ---------------------------------------------------------------- what is wrong

  /** What is wrong for one about oneself: what one bears that weighs, the place one stands, health running low. */
  troubles(e: Entity): Trouble[] {
    const w = this.eng.world
    const out: Trouble[] = []
    for (const s of Object.keys(e.statuses ?? {})) {
      const weight = this.weight(e, s)
      if (weight > 0) out.push({ subject: e.id, status: s, weight, danger: weight >= HARM })
    }
    const at = w.posOf(e)
    if (at && e.place.on === 'tile') {
      const d = this.placeAt(e, at)
      if (d.hp < 0 || d.gone) out.push({ subject: e.id, status: 'hp', weight: HARM, danger: true, place: true })
      for (const s of d.adds) {
        const weight = this.weight(e, s)
        if (weight > 0 && !out.some((t) => t.status === s && t.place)) out.push({ subject: e.id, status: s, weight, danger: weight >= HARM, place: true })
      }
    }
    const max = w.num(e, 'maxHp', 0)
    if (max > 0 && w.num(e, 'hp', max) < max * LOW_HP && !out.some((t) => t.status === 'hp')) out.push({ subject: e.id, status: 'hp', weight: HARM / 2, danger: false })
    return out
  }

  /** What is wrong for a thing one cares for (no place of its own to leave: only what it bears, and health low). */
  troublesOf(subject: Entity, care: number): Trouble[] {
    const w = this.eng.world
    const out: Trouble[] = []
    for (const s of Object.keys(subject.statuses ?? {})) {
      if (!this.harms(subject, s)) continue
      out.push({ subject: subject.id, status: s, weight: HARM * care, danger: true })
    }
    void w
    return out
  }
}

/** Two outcomes as one: what both do. */
export function merge(a: Delta, b: Delta): void {
  for (const s of b.adds) (a.adds.add(s), a.removes.delete(s))
  for (const s of b.removes) (a.removes.add(s), a.adds.delete(s))
  a.hp += b.hp
  for (const [k, v] of Object.entries(b.props)) a.props[k] = (a.props[k] ?? 0) + v
  a.gone ||= b.gone
  a.becomes ??= b.becomes
  a.unknown ||= b.unknown
}
