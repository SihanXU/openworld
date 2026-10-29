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
import { DIRS } from './types.ts'
import { dayForWeather } from './people.ts'
import type { View } from './world.ts'

/** What an outcome does to one thing: the statuses it gives and takes, the health it costs or gives, the props it moves. */
export interface Delta {
  adds: Set<string>
  removes: Set<string>
  /** Health given (above 0) or taken (below), as near as the rules say (an amount read in the event). */
  hp: number
  /** The props it moves, by how much (food fills hunger). */
  moves: Record<string, number>
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
/** How far round one minds what harms those one cares for (steps), and how much: one's people, one's things. */
const CARE_REACH = 12
const CARE_KIN = 0.8
const CARE_OWN = 0.5
/** How often what is harmed on the active map is read again (ticks). */
const HARMED_EVERY = 10
/** How often one reads the place one stands (ticks): a step onto another cell reads it at once. */
const LOOK_EVERY = 15
/** How far one looks for a better place (steps), and for how many cells at most. */
const CELL_REACH = 8
const CELLS_MAX = 80
/** For what the place does not bring, how near a place that cures it is looked for. */
const CURE_REACH = 3
const CURE_CELLS = 20
/** What a step costs against what is put right. */
const STEP_COST = 0.1
/** Going to one of one's own places on another map (home, out of the rain): about this much. */
const AWAY_COST = 2
/** How far round one looks for what to use, or to use something on (cells), and how many things. */
const ACT_REACH = 6
const ABOUT_MAX = 40
/** How many things at hand are tried for making another (an empty bucket filled). */
const MAKE_TOOLS = 4
/** A way is let go and looked for again after this long (ticks). */
const PLAN_TTL = 300
/** Having found no way, one looks again after this long (ticks). */
const TRY_AGAIN = 120
/** Ways looked for each tick, over everyone. */
const PLANS_PER_TICK = 3
/** Ticks after an act, and between a creature's steps. */
const ACT_TICKS = 10
const CREATURE_STEP = 6

/** A thing read as it would be: another kind (`type`: the bucket once filled), bearing statuses too (`bears`). */
export interface Swap {
  id: Id
  type?: string
  bears?: string[]
}

/** A step of a way: walk to a place (onto it, or within `near`), or do an act there. */
export type Step = { go: Pos; near?: number } | { act: 'use' | 'hands' | 'take'; target: Id; instrument?: Id; becomes?: string }

/** A way to put a trouble right, in hand: its steps, when it was found, what it costs. */
export interface Remedy {
  trouble: Trouble
  goal: 'danger' | 'need'
  steps: Step[]
  at: number
  cost: number
}

const empty = (): Delta => ({ adds: new Set(), removes: new Set(), hp: 0, moves: {}, gone: false, unknown: false })

/** The other side of a relation (World.relationsOf): what the touched thing feels of the toucher. */
const REVERSE: Record<string, string> = { on: 'under', 'in-region': 'encloses', support: 'supports' }

export class Wellbeing {
  private places = new Map<string, { at: number; d: Delta }>()
  /** Each one's way in hand (behaviour memory: lost with a save, found again). */
  private plans = new Map<Id, Remedy>()
  /** When each may look for a way again, having found none. */
  private tried = new Map<Id, number>()
  /** Who has started at a danger (shown once, as one takes fright). */
  private alarmed = new Set<Id>()
  private budget = 0
  private budgetAt = -1
  private memos = new Map<string, boolean | string>()
  private harmedAt?: { map: string; at: number; list: Entity[] }
  private memoOf = -1
  /** When each next reads the place it stands, and what it read there last. */
  private lookedAt = new Map<Id, number>()
  private lastPlace = new Map<Id, { key: string; troubles: Trouble[] }>()
  private harmCache = new Map<string, boolean>()
  private harmsOf = -1

  constructor(private eng: Engine) {}

  /** The ways in hand let go (the player came onto another map: everyone is placed afresh). */
  forget(): void {
    this.plans.clear()
    this.tried.clear()
    this.alarmed.clear()
    this.lookedAt.clear()
    this.lastPlace.clear()
  }

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
          out.moves[eff.key] = (out.moves[eff.key] ?? 0) + d
          break
        }
        default: {
          const r = eng.effectReads.get(eff.op)?.(eff)
          if (r?.hp) out.hp += r.hp
          for (const [k, d] of Object.entries(r?.props ?? {})) out.moves[k] = (out.moves[k] ?? 0) + d
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
    return !!t && (d.moves[t.prop] ?? 0) > 0
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
    // read for the kind as it is (its statuses, its tags), so those alike share it
    const key = `${e.type}|${(e.tags ?? []).join(',')}|${Object.keys(e.statuses ?? {}).sort().join(',')}|${at.map}:${at.x},${at.y},${at.z ?? 0}|${w.calendar().weather}`
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
    // the place one stands, read now and then (what one bears is read every turn)
    const look = at && e.place.on === 'tile' && w.state.tick >= (this.lookedAt.get(e.id) ?? -Infinity)
    if (look) this.lookedAt.set(e.id, w.state.tick + LOOK_EVERY)
    const here = look ? undefined : this.lastPlace.get(e.id)
    if (here && here.key === `${at?.map}:${at?.x},${at?.y}`) out.push(...here.troubles)
    else if (at && e.place.on === 'tile') {
      const placed: Trouble[] = []
      const d = this.placeAt(e, at)
      if (d.hp < 0 || d.gone) placed.push({ subject: e.id, status: 'hp', weight: HARM, danger: true, place: true })
      for (const s of d.adds) {
        const weight = this.weight(e, s)
        if (weight > 0 && !placed.some((t) => t.status === s)) placed.push({ subject: e.id, status: s, weight, danger: weight >= HARM, place: true })
      }
      this.lastPlace.set(e.id, { key: `${at.map}:${at.x},${at.y}`, troubles: placed })
      out.push(...placed)
    }
    const max = w.num(e, 'maxHp', 0)
    if (max > 0 && w.num(e, 'hp', max) < max * LOW_HP && !out.some((t) => t.status === 'hp')) out.push({ subject: e.id, status: 'hp', weight: HARM / 2, danger: false })
    return out
  }

  /** What harms a thing one cares for (nothing of its place: it is not one's to leave), weighed by the care. */
  troublesOf(subject: Entity, care: number): Trouble[] {
    const out: Trouble[] = []
    for (const s of Object.keys(subject.statuses ?? {})) if (this.harms(subject, s)) out.push({ subject: subject.id, status: s, weight: HARM * care, danger: true })
    return out
  }

  /** Would using this thing on oneself put right something one minds (a meal, a draught)? For one who would get it. */
  wouldCure(e: Entity, item: Entity, t: Trouble): boolean {
    const kind = (x: Entity) => `${x.type}|${Object.keys(x.statuses ?? {}).sort().join(',')}`
    return this.memo(`use|${kind(e)}|${t.status}|${kind(item)}|true`, () => this.cures(this.outcome(this.eng.actEvent('use', e.id, { e: e.id }, { e: item.id }), e.id), t.status))
  }

  // ---------------------------------------------------------------- what to do about it

  /**
   * The goal's turn (behaviour.ts: `danger` takes what harms, before everything but a boss's fight; `need` the rest,
   * before the day's round): what is wrong for one, and a way to put it right — away from the place that brings it,
   * to a place that cures it, or an act with what is at hand or can be made of it. A way found is kept and followed;
   * none, and the goal gives the turn to the next.
   */
  turn(e: Entity, active: string, goal: 'danger' | 'need'): boolean {
    const eng = this.eng
    const w = eng.world
    if (e.place.on !== 'tile' || e.place.map !== active || e.id === w.state.player || e.boss || eng.asleep(e)) return false
    const danger = goal === 'danger'
    const all = this.troublesFor(e).filter((t) => t.danger === danger)
    const held = this.plans.get(e.id)
    if (held && held.goal === goal) {
      const still = all.find((t) => t.subject === held.trouble.subject && t.status === held.trouble.status)
      if (still && w.state.tick - held.at < PLAN_TTL) {
        const r = this.step(e, active, held)
        if (r !== 'failed') return true
      }
      this.plans.delete(e.id)
    }
    if (!all.length) return !danger && this.holdOff(e, active)
    // looked for a way a moment ago and found none: the next goal's turn
    if ((this.tried.get(e.id) ?? -Infinity) > w.state.tick) return !danger && this.holdOff(e, active)
    // ways are looked for a few at a time each tick (a street in the rain all at once is spread over a moment)
    if (this.budgetAt !== w.state.tick) (this.budgetAt = w.state.tick), (this.budget = PLANS_PER_TICK)
    if (this.budget <= 0) return false
    this.budget--
    for (const t of all.sort((a, b) => b.weight - a.weight)) {
      const plan = this.plan(e, active, t, goal)
      if (!plan) continue
      this.plans.set(e.id, plan)
      if (danger && !this.alarmed.has(e.id)) (this.alarmed.add(e.id), w.fx.push({ t: 'emote', who: e.id, mood: 'surprised' }))
      this.step(e, active, plan)
      return true
    }
    this.tried.set(e.id, w.state.tick + TRY_AGAIN)
    this.alarmed.delete(e.id)
    return !danger && this.holdOff(e, active)
  }

  /**
   * What is wrong for one: about oneself, and what harms those one cares for (the circle one keeps: one's companions and
   * leader, one's household, one's own and one's household's things) — a burning house is its people's danger.
   */
  troublesFor(e: Entity): Trouble[] {
    // a day written for this weather says where one is in it: what its places bring is borne (but what harms)
    const authored = !!e.npc && dayForWeather(this.eng, e)
    const own = this.troubles(e).filter((t) => !(authored && t.place && !t.danger))
    if (!e.npc || e.place.on !== 'tile') return own
    const at = e.place
    for (const o of this.harmed(at.map)) {
      if (o.id === e.id || o.place.on !== 'tile' || Math.abs(o.place.x - at.x) + Math.abs(o.place.y - at.y) > CARE_REACH) continue
      const care = this.careFor(e, o)
      if (care > 0) own.push(...this.troublesOf(o, care))
    }
    return own
  }

  /** How much one cares for another thing (0: not at all): those one goes with and one's household, one's things and theirs. */
  careFor(e: Entity, o: Entity): number {
    const eng = this.eng
    const w = eng.world
    if (w.isAgent(o)) {
      if (w.allied(e, o)) return CARE_KIN
      const h = w.prop(e, 'household')
      return h && h === w.prop(o, 'household') ? CARE_KIN : 0
    }
    const r = eng.society.relation(eng.ownerOf(o), e)
    return r === 'mine' || r === 'ours' ? CARE_OWN : 0
  }

  /** What bears a status that harms it on a map now (a burning crate, a wall, a person on fire): read once a moment. */
  private harmed(map: string): Entity[] {
    const w = this.eng.world
    const t = w.state.tick
    if (this.harmedAt?.map === map && t - this.harmedAt.at < HARMED_EVERY) return this.harmedAt.list
    const list = w.entitiesOnMap(map).filter((o) => o.statuses && Object.keys(o.statuses).some((s) => this.harms(o, s)))
    this.harmedAt = { map, at: t, list }
    return list
  }

  /**
   * Out of what one minds already, one does not walk back into it: where one's day would take one now is a place that
   * would bring it (the street in the rain) and here does not — one stays, until it passes.
   */
  private holdOff(e: Entity, active: string): boolean {
    const eng = this.eng
    const w = eng.world
    if (!e.npc || e.place.on !== 'tile' || dayForWeather(eng, e)) return false
    const s = eng.npcs.anchor(e)
    if (!s || (s.map === e.place.map && s.x === e.place.x && s.y === e.place.y)) return false
    if (!w.map(s.map) || this.placeWeight(e, s) <= 0 || this.placeWeight(e, e.place) > 0) return false
    void active
    return true
  }

  /** A way to put a trouble right: the cheapest that works. */
  private plan(e: Entity, active: string, t: Trouble, goal: 'danger' | 'need'): Remedy | undefined {
    const eng = this.eng
    const w = eng.world
    const at = e.place.on === 'tile' ? e.place : undefined
    if (!at) return undefined
    const self = t.subject === e.id
    const options: Remedy[] = []
    const plan = (steps: Step[], cost: number): Remedy => ({ trouble: t, goal, steps, at: w.state.tick, cost })
    // a place: away from what brings it, or where it is cured
    if (self) {
      const here = this.placeWeight(e, at)
      // a place that brings it, or a harm: anywhere within a walk; else only a place close by may cure it (a warm spring)
      const near = t.place || t.danger ? this.cells(e, active, at, CELL_REACH, CELLS_MAX) : this.cells(e, active, at, CURE_REACH, CURE_CELLS)
      let best: { pos: Pos; score: number; d: number } | undefined
      for (const c of near) {
        const pos = { map: active, x: c.x, y: c.y, z: at.z }
        const there = this.placeWeight(e, pos)
        const cures = this.cures(this.placeAt(e, pos), t.status)
        const gain = (t.place ? here - there : 0) + (cures ? t.weight : 0) - (t.place ? 0 : there)
        const score = gain - c.d * STEP_COST
        if (gain > 0 && (!best || score > best.score)) best = { pos, score, d: c.d }
      }
      if (best) options.push(plan([{ go: best.pos }], best.d * STEP_COST))
      // out of a place that brings it, with nowhere near: one of one's own places that does not (home, out of the rain)
      if (!best && t.place && e.npc)
        for (const s of eng.npcs.anchors(e)) {
          if (s.map === active || !w.map(s.map)) continue
          if (this.placeWeight(e, s) > 0) continue
          options.push(plan([{ go: { map: s.map, x: s.x, y: s.y } }], AWAY_COST))
          break
        }
    }
    // an act: with what one has or may take, or with the hands on what is about; or with a thing once it is made
    if (e.npc && !(self && t.place)) {
      const subject = w.get(t.subject)
      const sp = subject && w.posOf(subject)
      const things = this.about(e, active, at)
      const mine = (x: Entity) => x.place.on !== 'tile' || this.mayTake(e, x)
      const tools = [...this.carried(e), ...things.filter((x) => w.isPortable(x) && mine(x))]
      const kind = (x: Entity | undefined) => (x ? `${x.type}|${Object.keys(x.statuses ?? {}).sort().join(',')}` : '')
      for (const i of tools) {
        const ok = this.memo(`use|${kind(subject)}|${t.status}|${kind(i)}|${self}`, () => {
          const ev = eng.actEvent('use', e.id, { e: t.subject }, { e: i.id })
          return this.cures(this.outcome(ev, t.subject), t.status) && !this.hurtsSelf(e, ev, self)
        })
        if (!ok) continue
        options.push(plan([...this.fetch(e, i), ...(self ? [] : [{ go: sp!, near: 1 } as Step]), { act: 'use', target: t.subject, instrument: i.id }], this.dist(at, i) * STEP_COST + (self ? 0 : this.dist(at, subject!) * STEP_COST)))
      }
      if (self)
        for (const f of things) {
          if (w.isPortable(f) || w.isAgent(f)) continue
          if (!this.memo(`hands|${kind(e)}|${t.status}|${kind(f)}`, () => this.cures(this.outcome(eng.actEvent('hands', e.id, { e: f.id }), e.id), t.status))) continue
          options.push(plan([{ go: w.posOf(f)!, near: 1 }, { act: 'hands', target: f.id }], this.dist(at, f) * STEP_COST))
        }
      // made: a thing at hand used on one of what is about becomes another kind, and that kind cures it
      if (!options.length)
        for (const i of tools.slice(0, MAKE_TOOLS)) {
          const seen = new Set<string>()
          for (const src of things) {
            if (src.id === i.id || seen.has(src.type)) continue
            seen.add(src.type)
            const made = this.memo(`make|${kind(i)}|${kind(src)}`, () => this.outcome(eng.actEvent('use', e.id, { e: src.id }, { e: i.id }), i.id).becomes ?? '')
            if (!made || made === i.type) continue
            if (!this.memo(`made|${kind(subject)}|${t.status}|${made}`, () => this.cures(this.outcome(eng.actEvent('use', e.id, { e: t.subject }, { e: i.id }), t.subject, undefined, 3, { id: i.id, type: made }), t.status))) continue
            options.push(
              plan(
                [...this.fetch(e, i), { go: w.posOf(src)!, near: 1 }, { act: 'use', target: src.id, instrument: i.id, becomes: made }, ...(self ? [] : [{ go: sp!, near: 1 } as Step]), { act: 'use', target: t.subject, instrument: i.id }],
                (this.dist(at, i) + this.dist(at, src) * 2) * STEP_COST,
              ),
            )
            break
          }
        }
    }
    return options.sort((a, b) => a.cost - b.cost)[0]
  }

  /** An answer read for kinds, kept until the rules change (what cures what is the same for every one alike). */
  private memo<T extends boolean | string>(key: string, f: () => T): T {
    if (this.memoOf !== this.eng.lib.version) (this.memos.clear(), (this.memoOf = this.eng.lib.version))
    if (this.memos.has(key)) return this.memos.get(key) as T
    if (this.memos.size > 20000) this.memos.clear()
    const v = f()
    this.memos.set(key, v)
    return v
  }

  /** Does an act cost the one who does it more than it is worth (it hurts them, beyond the one it is for)? */
  private hurtsSelf(e: Entity, ev: GameEvent, self: boolean): boolean {
    if (self) return false
    const d = this.outcome(ev, e.id)
    return d.hp < 0 || d.adds.has('burning')
  }

  /** To have a thing in hand to use: take it where it lies first. */
  private fetch(e: Entity, i: Entity): Step[] {
    if (i.place.on !== 'tile') return []
    return [{ go: this.eng.world.posOf(i)!, near: 1 }, { act: 'take', target: i.id }]
  }

  /** What one carries: in the hand and the bag. */
  private carried(e: Entity): Entity[] {
    const w = this.eng.world
    return [...(e.held ? [e.held] : []), ...(e.contents ?? [])].map((id) => w.get(id)).filter((x): x is Entity => !!x && !e.residentWork?.cargoIds.includes(x.id))
  }

  /** May one take a thing lying about: one's own, one's household's, or nobody's (another's would be a theft). */
  private mayTake(e: Entity, x: Entity): boolean {
    const r = this.eng.society.relation(this.eng.ownerOf(x), e)
    return r === 'mine' || r === 'ours' || r === 'nobody'
  }

  /** The things about one (within reach of a walk), and the cells' things: what one may use, or use something on. */
  private about(e: Entity, active: string, at: Pos): Entity[] {
    const w = this.eng.world
    const out: Entity[] = []
    for (let dy = -ACT_REACH; dy <= ACT_REACH; dy++)
      for (let dx = -ACT_REACH; dx <= ACT_REACH; dx++) {
        if (!w.inBounds(active, at.x + dx, at.y + dy)) continue
        for (const o of w.entitiesAt(active, at.x + dx, at.y + dy, at.z ?? 0)) if (o.id !== e.id && !w.isAgent(o)) out.push(o)
      }
    return out.sort((a, b) => this.dist(at, a) - this.dist(at, b)).slice(0, ABOUT_MAX)
  }

  private dist(at: Pos, o: Entity): number {
    const p = this.eng.world.posOf(o)
    return p && p.map === at.map ? Math.abs(p.x - at.x) + Math.abs(p.y - at.y) : 50
  }

  /** The cells one can walk to within `reach` steps, with how many steps. */
  private cells(e: Entity, map: string, at: Pos, reach: number, most: number): { x: number; y: number; d: number }[] {
    const w = this.eng.world
    const seen = new Map<string, number>([[`${at.x},${at.y}`, 0]])
    const out: { x: number; y: number; d: number }[] = []
    const q: [number, number, number][] = [[at.x, at.y, 0]]
    while (q.length && out.length < most) {
      const [x, y, d] = q.shift()!
      if (d > 0) out.push({ x, y, d })
      if (d >= reach) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        const k = `${nx},${ny}`
        if (seen.has(k) || !w.walkable(map, nx, ny, e.id) || w.safeStep(e, map, x, y, nx, ny) === false) continue
        seen.set(k, d + 1)
        q.push([nx, ny, d + 1])
      }
    }
    return out
  }

  /** One step of a way: walk on, or do its act once there. */
  private step(e: Entity, active: string, plan: Remedy): 'walking' | 'done' | 'failed' {
    const eng = this.eng
    const w = eng.world
    const s = plan.steps[0]
    if (!s) return 'done'
    if ('go' in s) {
      const r = e.npc ? eng.npcs.walkTo(e, active, s.go, s.near ?? 0) : this.edge(e, active, s.go)
      if (r === 'arrived') {
        plan.steps.shift()
        return plan.steps.length ? this.step(e, active, plan) : 'done'
      }
      return r === 'unreachable' ? 'failed' : 'walking'
    }
    const target = w.get(s.target)
    if (!target) return 'failed'
    const tp = w.posOf(target)
    if (tp && e.place.on === 'tile' && tp.map === e.place.map) {
      const dx = tp.x - e.place.x
      const dy = tp.y - e.place.y
      if (dx || dy) e.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    }
    if (s.act === 'take') eng.act('take', e.id, { e: target.id }, { instrument: null, params: { into: 'contents' } })
    else eng.act(s.act, e.id, { e: target.id }, { instrument: s.instrument ? { e: s.instrument } : null })
    eng.setCooldown(e.id, ACT_TICKS)
    plan.steps.shift()
    // a thing made on the way must be what was looked for (the bucket full), else the way is let go
    if (s.becomes && s.instrument && w.get(s.instrument)?.type !== s.becomes) return 'failed'
    return 'walking'
  }

  /** A creature (no round of its own to walk): a step toward the place, the way that brings it nearest. */
  private edge(e: Entity, active: string, to: Pos): 'walking' | 'arrived' | 'unreachable' {
    const eng = this.eng
    const w = eng.world
    if (e.place.on !== 'tile' || to.map !== active) return 'unreachable'
    const { x, y } = e.place
    if (x === to.x && y === to.y) return 'arrived'
    const dirs = (['up', 'down', 'left', 'right'] as const).filter((d) => {
      const [dx, dy] = DIRS[d]
      return w.walkable(active, x + dx, y + dy, e.id)
    })
    const best = dirs.sort((a, b) => Math.abs(x + DIRS[a][0] - to.x) + Math.abs(y + DIRS[a][1] - to.y) - (Math.abs(x + DIRS[b][0] - to.x) + Math.abs(y + DIRS[b][1] - to.y)))[0]
    if (!best || !eng.step(e, best)) return 'unreachable'
    eng.setCooldown(e.id, CREATURE_STEP)
    return 'walking'
  }
}

/** Two outcomes as one: what both do. */
export function merge(a: Delta, b: Delta): void {
  for (const s of b.adds) (a.adds.add(s), a.removes.delete(s))
  for (const s of b.removes) (a.removes.add(s), a.adds.delete(s))
  a.hp += b.hp
  for (const [k, v] of Object.entries(b.moves)) a.moves[k] = (a.moves[k] ?? 0) + v
  a.gone ||= b.gone
  a.becomes ??= b.becomes
  a.unknown ||= b.unknown
}
