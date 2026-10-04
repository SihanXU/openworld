// NPC behaviour (design.md §5.4: the game's own logic, as in any game), on the active map only:
// tile-level pathfinding toward the current schedule anchor, submitting the same acts as the
// player (steps, moving through portals). Dormant maps are frozen (design.md §5.12): their people
// stay put; entering a map places its people by their schedules, and a person whose schedule
// leads to the active map walks in through the portal on the hour. A person whose day cannot go
// on — the thing their activity needs is gone or not as it must be, or the anchor cannot be
// reached — is `stuck`, an event whose outcome may change their script.
// A person who sees something about to attack them runs from it, toward a fire if one is near.

import type { Engine } from './engine.ts'
import { astar } from './path.ts'
import { scheduleFor } from './people.ts'
import { matchSelector } from './rules.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import type { Ref } from './types.ts'
import { DIRS, FIRE_RADIUS } from './types.ts'
import type { Dir, Entity, Id, Pos, ScheduleEntry } from './types.ts'

interface Runtime {
  path?: [number, number][]
  goal?: string // `${map}:${x}:${y}` the path leads to
  wait: number
  blocked: number
  /** failed path searches toward the current anchor */
  unreachable?: number
  /** someone stood in the way: the next path goes around people */
  around?: boolean
  /** running from a threat (their alarm is shown once per flight) */
  fleeing?: boolean
}

/** A person runs from what would attack them within this many tiles. */
const FLEE = 3

/** A person is blocked about one activity at most once an hour. */
const BLOCKED_EVERY = TICKS_PER_HOUR

const PATH_BUDGET_PER_TICK = 10
const NPC_STEP_TICKS = 4

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

  tick(active: string): void {
    const w = this.eng.world
    const hour = Math.floor(w.hour())
    if (hour !== this.lastHour) {
      this.lastHour = hour
      this.coarse(active)
    }
    // during a scene the people on stage are the script's
    if (w.scene) return
    let budget = PATH_BUDGET_PER_TICK
    for (const e of w.entitiesOnMap(active)) {
      if (!e.npc || e.id === w.state.player) continue
      budget = this.fine(e, active, budget)
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

  /** An NPC whose anchor is on the active map enters through the portal from its current map. */
  private arrive(e: Entity, s: ScheduleEntry, active: string): void {
    const w = this.eng.world
    const cur = e.place.on === 'tile' ? e.place.map : ''
    // enter where a traveller from `cur` would arrive: the target of cur's portal into here
    const back = this.eng.graph[cur]?.find((p) => p.to === active)
    const at: Pos = back ? { map: active, x: back.tx, y: back.ty } : { map: active, x: s.x, y: s.y }
    const free = w.walkable(at.map, at.x, at.y, e.id) ? at : this.eng.nearestFree(at)
    if (free) this.eng.relocate(e, free)
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
   * Run from the nearest one that would attack: the step that leaves it farthest, and a fire's
   * reach (where creatures that fear fire do not come) counts as far.
   */
  private flee(e: Entity, active: string, rt: Runtime): boolean {
    const eng = this.eng
    const w = eng.world
    if (e.place.on !== 'tile') return false
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

  private fine(e: Entity, active: string, budget: number): number {
    const eng = this.eng
    const w = eng.world
    if (!eng.ready(e.id) || eng.busy(e) || e.place.on !== 'tile') return budget
    const rt = this.rt.get(e.id) ?? { wait: 0, blocked: 0 }
    this.rt.set(e.id, rt)
    if (this.flee(e, active, rt)) return budget
    const s = scheduleAt(scheduleFor(this.eng, e), w.hour())
    if (!s) return budget
    const { x, y } = e.place
    // where to head: the anchor here, or the portal toward the anchor's map
    let gx = s.x
    let gy = s.y
    let leaving: { to: string; tx: number; ty: number } | undefined
    if (s.map !== active) {
      const hop = this.nextHop(active, s.map)
      const portal = hop && w.map(active)?.portals.find((p) => p.x === hop.x && p.y === hop.y)
      if (!portal) return budget
      gx = portal.x
      gy = portal.y
      leaving = portal
    }
    const dist = Math.abs(gx - x) + Math.abs(gy - y)
    if (dist <= 1 && leaving) {
      // walk "through" the portal from the tile beside it
      this.eng.relocate(e, { map: leaving.to, x: leaving.tx, y: leaving.ty })
      this.rt.delete(e.id)
      return budget
    }
    if (dist <= 1 && !leaving) {
      rt.unreachable = 0
      if (s.uses) this.checkNeed(e, s)
      // at the anchor: idle, occasionally mill about
      if (w.rand() < 0.02) {
        const dirs: Dir[] = ['up', 'down', 'left', 'right']
        const d = dirs[Math.floor(w.rand() * 4)]
        eng.step(e, d)
        eng.setCooldown(e.id, NPC_STEP_TICKS * 3)
      }
      return budget
    }
    const goal = `${active}:${gx}:${gy}`
    if (!rt.path || rt.goal !== goal || !rt.path.length) {
      if (budget <= 0) return budget
      budget--
      const m = w.map(active)!
      const free = (px: number, py: number) => w.passable(active, px, py) && !(rt.around && (px !== gx || py !== gy) && w.actorAt(active, px, py))
      rt.path = astar(m.width, m.height, free, x, y, gx, gy, undefined, (ax, ay, bx, by) => w.safeStep(e, active, ax, ay, bx, by)) ?? []
      rt.around = false
      rt.goal = goal
      if (!rt.path.length) {
        eng.setCooldown(e.id, 30) // unreachable for now; try later
        if ((rt.unreachable = (rt.unreachable ?? 0) + 1) >= 3) {
          const spot = eng.world.cellTop(active, gx, gy)
          if (spot) this.block(e, s.activity, { e: spot.id })
        }
        return budget
      }
    }
    const [nx, ny] = rt.path[0]
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
    return budget
  }
}
