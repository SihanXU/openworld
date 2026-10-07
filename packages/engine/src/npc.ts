// The people's goals (world-model.md §6.10; behaviour.ts runs them in each actor's order), on the
// active map only, with the same acts as the player (steps, moving through portals, work).
// Threat: a person who sees something about to attack them runs from it, toward a fire if one is
// near. Schedule: they head for their schedule's anchor (tile-level paths), across maps through
// the portal toward it; there, the activity's work is done with real acts (a woodcutter's axe on
// the trees about, the logs gathered), else they mill about. Dormant maps are frozen (design.md
// §5.12): their people stay put; entering a map places its people by their schedules, and a person
// whose schedule leads to the active map walks in on the hour, from the edge or portal they would
// come by (D21). A person whose day cannot go on — the thing their activity needs is gone or not as
// it must be, or the anchor cannot be reached — is `stuck`, an event whose outcome may change
// their script.

import type { Engine } from './engine.ts'
import { astar } from './path.ts'
import { scheduleFor } from './people.ts'
import { evalCond, matchSelector } from './rules.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import type { Ref, WorkDef } from './types.ts'
import { DIRS, FIRE_RADIUS } from './types.ts'
import type { Dir, Entity, Id, Pos, ScheduleEntry } from './types.ts'

/** How many of its turns a person holds its round for one who faces it (a few seconds). */
const ATTEND_TURNS = 12

interface Runtime {
  path?: [number, number][]
  goal?: string // `${map}:${x}:${y}` the path leads to
  wait: number
  blocked: number
  /** failed path searches toward the current anchor */
  unreachable?: number
  /** someone stood in the way: the next path goes around people */
  around?: boolean
  /** turns held for one who stands beside them and faces them */
  attended?: number
  /** running from a threat (their alarm is shown once per flight) */
  fleeing?: boolean
  /** what they are working on, and the act that does it */
  work?: { target: Id; def: WorkDef }
}

/** A person runs from what would attack them within this many tiles. */
const FLEE = 3

/** A person is blocked about one activity at most once an hour. */
const BLOCKED_EVERY = TICKS_PER_HOUR

const PATH_BUDGET_PER_TICK = 10
const NPC_STEP_TICKS = 4
/** Ticks between two acts of work (a swing of the axe). */
const WORK_TICKS = 10

export function scheduleAt(s: ScheduleEntry[], hour: number): ScheduleEntry | undefined {
  for (const e of s) {
    if (e.from <= e.to ? hour >= e.from && hour < e.to : hour >= e.from || hour < e.to) return e
  }
  return s[0]
}

export class NpcSim {
  private rt = new Map<Id, Runtime>()
  private lastHour = -1
  /** npc|activity → the tick after which they may be blocked about it again */
  private blockedUntil = new Map<string, number>()
  /** All NPC ids (the global roster); maintained lazily. */
  private roster?: Id[]
  /** Path searches left this tick. */
  private budget = PATH_BUDGET_PER_TICK

  constructor(private eng: Engine) {}

  private ids(): Id[] {
    if (!this.roster) this.roster = Object.values(this.eng.world.state.entities).filter((e) => e.npc).map((e) => e.id)
    return this.roster
  }

  invalidate(): void {
    this.roster = undefined
  }

  /** Next map toward `goal` from `from`, via BFS over the portal graph. */
  nextHop(from: string, goal: string): { x: number; y: number; to: string } | undefined {
    if (from === goal) return undefined
    const g = this.eng.graph
    const prev = new Map<string, string>([[from, '']])
    const q = [from]
    while (q.length) {
      const m = q.shift()!
      if (m === goal) break
      for (const p of g[m] ?? []) if (!prev.has(p.to)) (prev.set(p.to, m), q.push(p.to))
    }
    if (!prev.has(goal)) return undefined
    let m = goal
    while (prev.get(m) !== from) m = prev.get(m)!
    return (g[from] ?? []).find((p) => p.to === m)
  }

  /** A tick begins: path searches are budgeted afresh; on the hour, people bound for the active map come. */
  begin(active: string): void {
    this.budget = PATH_BUDGET_PER_TICK
    const hour = Math.floor(this.eng.world.hour())
    if (hour !== this.lastHour) {
      this.lastHour = hour
      this.coarse(active)
    }
  }

  /** On the hour: a person on a dormant map whose schedule leads here walks in (the rest stay put: their maps are frozen). */
  private coarse(active: string): void {
    const w = this.eng.world
    const h = w.hour()
    for (const id of this.ids()) {
      const e = w.get(id)
      if (!e?.npc || e.place.on !== 'tile' || e.place.map === active) continue
      const s = scheduleAt(scheduleFor(this.eng, e), h)
      if (s?.map === active) this.arrive(e, s, active)
    }
  }

  /**
   * A person whose anchor is on the active map comes in where a traveller from their map would
   * (D21): by the edge or portal of the last map on the way, walking on from there.
   */
  private arrive(e: Entity, s: ScheduleEntry, active: string): void {
    const w = this.eng.world
    const cur = e.place.on === 'tile' ? e.place.map : ''
    const last = this.lastOnTheWay(cur, active)
    const back = last !== undefined ? this.eng.graph[last]?.find((p) => p.to === active) : undefined
    const at: Pos = back ? { map: active, x: back.tx, y: back.ty } : { map: active, x: s.x, y: s.y }
    const free = w.walkable(at.map, at.x, at.y, e.id) ? at : this.eng.nearestFree(at)
    if (free) this.eng.relocate(e, free)
  }

  /** The map one comes from into `to` on the way from `from` (BFS over the portal graph). */
  private lastOnTheWay(from: string, to: string): string | undefined {
    const g = this.eng.graph
    const prev = new Map<string, string>([[from, '']])
    const q = [from]
    while (q.length) {
      const m = q.shift()!
      if (m === to) break
      for (const p of g[m] ?? []) if (!prev.has(p.to)) (prev.set(p.to, m), q.push(p.to))
    }
    return prev.has(to) && to !== from ? prev.get(to) : undefined
  }

  /** When the player enters a map, reconcile NPCs whose anchors are here. */
  onEnterMap(map: string, _from?: string): void {
    const w = this.eng.world
    const h = w.hour()
    for (const id of this.ids()) {
      const e = w.get(id)
      if (!e?.npc || e.place.on !== 'tile' || e.place.map === map) continue
      const s = scheduleAt(scheduleFor(this.eng, e), h)
      if (s?.map === map) {
        const at = { map, x: s.x, y: s.y }
        const free = w.walkable(map, s.x, s.y, e.id) ? at : this.eng.nearestFree(at)
        if (free) this.eng.relocate(e, free)
      }
    }
    this.rt.clear()
  }

  /**
   * One who stands beside a person and faces them, with no round of their own to keep (a traveller,
   * a companion), is attended to: the person holds their round a few turns — a gift handed over, a
   * word, is not a chase. Never for long, and never for another on a round (two would hold each other).
   */
  attended(e: Entity): boolean {
    if (!e.npc) return false
    const rt = this.runtime(e)
    const w = this.eng.world
    const at = w.posOf(e)
    const facing = at && (Object.entries(DIRS) as [Dir, [number, number]][]).some(([, [dx, dy]]) =>
      w.entitiesAt(at.map, at.x - dx, at.y - dy, at.z).some((o) => o.id !== e.id && w.isAgent(o) && !o.npc && !o.ai && DIRS[o.facing ?? 'down'][0] === dx && DIRS[o.facing ?? 'down'][1] === dy))
    if (!facing) return void (rt.attended = 0), false
    rt.attended = (rt.attended ?? 0) + 1
    return rt.attended <= ATTEND_TURNS
  }

  private runtime(e: Entity): Runtime {
    const rt = this.rt.get(e.id) ?? { wait: 0, blocked: 0 }
    this.rt.set(e.id, rt)
    return rt
  }

  /**
   * Threat, for a person: run from the nearest one that would attack, the step that leaves it
   * farthest — a fire's reach (where what fears fire does not come) counts as far.
   */
  flee(e: Entity, active: string): boolean {
    const eng = this.eng
    const w = eng.world
    if (!e.npc || e.place.on !== 'tile') return false
    const rt = this.runtime(e)
    const { x, y } = e.place
    let threat: Entity | undefined
    let near = Infinity
    let fires: Pos[] | undefined
    // by a fire one is safe from what fears fire
    const sheltered = (o: Entity) => eng.fearsFire(o) && (fires ??= eng.fires(active)).some((f) => Math.max(Math.abs(f.x - x), Math.abs(f.y - y)) <= FIRE_RADIUS)
    for (const o of w.entitiesOnMap(active)) {
      if (o.place.on !== 'tile' || !eng.hostileTo(o, e) || sheltered(o)) continue
      const d = Math.abs(o.place.x - x) + Math.abs(o.place.y - y)
      if (d <= FLEE && d < near) (threat = o), (near = d)
    }
    if (!threat || threat.place.on !== 'tile') return void (rt.fleeing = false), false
    if (!rt.fleeing) w.fx.push({ t: 'emote', who: e.id, mood: 'surprised' })
    rt.fleeing = true
    rt.path = undefined
    fires ??= eng.fires(active)
    const tp = threat.place
    const score = (px: number, py: number) => Math.abs(px - tp.x) + Math.abs(py - tp.y) + (eng.fearsFire(threat) && fires!.some((f) => Math.max(Math.abs(f.x - px), Math.abs(f.y - py)) <= FIRE_RADIUS) ? 6 : 0)
    let bestDir: Dir | undefined
    let best = score(x, y)
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      const [dx, dy] = DIRS[d]
      if (!w.walkable(active, x + dx, y + dy, e.id, true)) continue
      const s = score(x + dx, y + dy)
      if (s > best) (best = s), (bestDir = d)
    }
    if (bestDir) eng.step(e, bestDir)
    eng.setCooldown(e.id, NPC_STEP_TICKS - 1)
    return true
  }

  /** At the anchor: is the thing the activity needs there, and as it must be? */
  private checkNeed(e: Entity, s: ScheduleEntry): void {
    const w = this.eng.world
    const u = w.get(s.uses)
    if (u && u.place.on !== 'none' && matchSelector(s.need, w.view({ e: u.id }))) return
    const p = w.posOf(e)!
    const spot = w.cellTop(p.map, s.x, s.y)
    const at = u && u.place.on !== 'none' ? u : spot
    if (at) this.block(e, s.activity, { e: at.id })
  }

  /** The person's day cannot go on: a `stuck` event for them (at most once an hour per activity). */
  private block(e: Entity, activity: string, target: Ref): void {
    const t = this.eng.world.state.tick
    const key = `${e.id}|${activity}`
    if ((this.blockedUntil.get(key) ?? -1) > t) return
    this.blockedUntil.set(key, t + BLOCKED_EVERY)
    this.eng.queue({ kind: 'stuck', host: { e: e.id }, roles: { target }, params: { activity }, origin: 'world' })
  }

  /** What they carry that fits (a tool for the work). */
  private carried(e: Entity, sel: WorkDef['holding']): Entity | undefined {
    const w = this.eng.world
    for (const id of [...(e.held ? [e.held] : []), ...(e.contents ?? [])]) {
      const c = w.get(id)
      if (c && matchSelector(sel, w.view({ e: c.id }))) return c
    }
    return undefined
  }

  /**
   * The work to do now (world-model.md §6.10): the first piece whose tool they carry and that has
   * something to work on within its radius of the anchor — the nearest such thing. Kept while it
   * still fits.
   */
  private workFor(e: Entity, s: ScheduleEntry, active: string, rt: Runtime): Runtime['work'] {
    const w = this.eng.world
    const still = rt.work && w.get(rt.work.target)
    const def = rt.work?.def
    if (still && def && still.place.on === 'tile' && still.place.map === active && matchSelector(def.target, w.view({ e: still.id })) && (!def.when || evalCond(def.when, { host: w.view({ e: e.id }) }, w)) && (!def.holding || this.carried(e, def.holding))) return rt.work
    rt.work = undefined
    const p = w.posOf(e)!
    for (const def of s.work ?? []) {
      if (def.holding && !this.carried(e, def.holding)) continue
      if (def.when && !evalCond(def.when, { host: w.view({ e: e.id }) }, w)) continue
      let best: Entity | undefined
      let bd = Infinity
      for (let y = s.y - def.radius; y <= s.y + def.radius; y++)
        for (let x = s.x - def.radius; x <= s.x + def.radius; x++) {
          if (!w.inBounds(active, x, y)) continue
          for (const o of w.entitiesAt(active, x, y)) {
            if (o.id === e.id || !matchSelector(def.target, w.view({ e: o.id }))) continue
            const d = Math.abs(x - p.x) + Math.abs(y - p.y)
            if (d < bd) (best = o), (bd = d)
          }
        }
      if (best) return (rt.work = { target: best.id, def })
    }
    return undefined
  }

  /** One act of work on what is beside them: facing it, with the tool, as the player would. */
  private labour(e: Entity, job: NonNullable<Runtime['work']>): void {
    const eng = this.eng
    const w = eng.world
    const at = w.posOf(e)!
    const t = w.posOf(w.get(job.target))!
    if (t.x !== at.x || t.y !== at.y) e.facing = t.x > at.x ? 'right' : t.x < at.x ? 'left' : t.y > at.y ? 'down' : 'up'
    const tool = job.def.holding && this.carried(e, job.def.holding)
    eng.act(job.def.verb, e.id, { e: job.target }, { instrument: tool ? { e: tool.id } : null })
    eng.setCooldown(e.id, WORK_TICKS)
  }

  /** Schedule: toward the anchor (or the work about it), and there the activity. */
  schedule(e: Entity, active: string): boolean {
    const eng = this.eng
    const w = eng.world
    if (!e.npc || e.place.on !== 'tile') return false
    const rt = this.runtime(e)
    const s = scheduleAt(scheduleFor(this.eng, e), w.hour())
    if (!s) return false
    const { x, y } = e.place
    // where to head: the work about the anchor, the anchor here, or the portal toward the anchor's map
    let gx = s.x
    let gy = s.y
    let leaving: { to: string; tx: number; ty: number } | undefined
    const job = s.map === active ? this.workFor(e, s, active, rt) : undefined
    if (job) ({ x: gx, y: gy } = w.posOf(w.get(job.target))!)
    else if (s.map !== active) {
      const hop = this.nextHop(active, s.map)
      const portal = hop && w.map(active)?.portals.find((p) => p.x === hop.x && p.y === hop.y)
      if (!portal) return true
      gx = portal.x
      gy = portal.y
      leaving = portal
    }
    const dist = Math.abs(gx - x) + Math.abs(gy - y)
    if (dist <= 1 && leaving) {
      // walk "through" the portal from the tile beside it
      this.eng.relocate(e, { map: leaving.to, x: leaving.tx, y: leaving.ty })
      this.rt.delete(e.id)
      return true
    }
    if (dist <= 1 && job) {
      this.labour(e, job)
      return true
    }
    if (dist <= 1) {
      rt.unreachable = 0
      if (s.uses) this.checkNeed(e, s)
      // at the anchor: idle, occasionally mill about
      if (w.rand() < 0.02) {
        const dirs: Dir[] = ['up', 'down', 'left', 'right']
        const d = dirs[Math.floor(w.rand() * 4)]
        eng.step(e, d)
        eng.setCooldown(e.id, NPC_STEP_TICKS * 3)
      }
      return true
    }
    const goal = `${active}:${gx}:${gy}`
    if (!rt.path || rt.goal !== goal || !rt.path.length) {
      if (this.budget <= 0) return true
      this.budget--
      const m = w.map(active)!
      // what they work on stands in the way of walking (a tree): the path leads beside it
      const free = (px: number, py: number) => (w.passable(active, px, py) || (!!job && px === gx && py === gy)) && !(rt.around && (px !== gx || py !== gy) && w.actorAt(active, px, py))
      rt.path = astar(m.width, m.height, free, x, y, gx, gy, undefined, (ax, ay, bx, by) => w.safeStep(e, active, ax, ay, bx, by)) ?? []
      rt.around = false
      rt.goal = goal
      if (!rt.path.length) {
        eng.setCooldown(e.id, 30) // unreachable for now; try later
        // work that cannot be reached is let go; an anchor that cannot be reached is a day that cannot go on
        if (job) rt.work = undefined
        else if ((rt.unreachable = (rt.unreachable ?? 0) + 1) >= 3) {
          const spot = eng.world.cellTop(active, gx, gy)
          if (spot) this.block(e, s.activity, { e: spot.id })
        }
        return true
      }
    }
    const [nx, ny] = rt.path[0]
    if (job && nx === gx && ny === gy) {
      // beside it now
      rt.path = undefined
      this.labour(e, job)
      return true
    }
    const dir: Dir = nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up'
    if (eng.step(e, dir)) {
      rt.path.shift()
      rt.blocked = 0
    } else if (++rt.blocked > 6) {
      rt.path = undefined
      rt.blocked = 0
      rt.around = true
    }
    eng.setCooldown(e.id, NPC_STEP_TICKS)
    return true
  }
}
