// NPC schedules with two fidelities:
//  - on the player's map: tile-level pathfinding toward the current schedule anchor;
//  - everywhere else: NPCs jump between anchors on the hour (cost ~ schedule transitions).

import type { Engine } from './engine.ts'
import { astar } from './path.ts'
import { scheduleFor } from './people.ts'
import type { Dir, Entity, Id, Pos, ScheduleEntry } from './types.ts'

interface Runtime {
  path?: [number, number][]
  goal?: string // `${map}:${x}:${y}` the path leads to
  wait: number
  blocked: number
}

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
    if (w.state.scene) return
    let budget = PATH_BUDGET_PER_TICK
    for (const e of w.entitiesOnMap(active)) {
      if (!e.npc || e.id === w.state.player) continue
      budget = this.fine(e, active, budget)
    }
  }

  /** Coarse step: every NPC not on the active map jumps to its current anchor. */
  private coarse(active: string): void {
    const w = this.eng.world
    const h = w.hour()
    for (const id of this.ids()) {
      const e = w.get(id)
      if (!e?.npc || e.place.on !== 'tile') continue
      if (e.place.map === active) continue
      const s = scheduleAt(scheduleFor(this.eng, e), h)
      if (!s) continue
      if (s.map === active) this.arrive(e, s, active)
      else if (e.place.map !== s.map || e.place.x !== s.x || e.place.y !== s.y) w.place(e, { on: 'tile', map: s.map, x: s.x, y: s.y })
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
    if (free) w.place(e, { on: 'tile', ...free })
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
        if (free) w.place(e, { on: 'tile', ...free })
      }
    }
    this.rt.clear()
  }

  private fine(e: Entity, active: string, budget: number): number {
    const eng = this.eng
    const w = eng.world
    if (!eng.ready(e.id) || eng.busy(e) || e.place.on !== 'tile') return budget
    const rt = this.rt.get(e.id) ?? { wait: 0, blocked: 0 }
    this.rt.set(e.id, rt)
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
      w.place(e, { on: 'tile', map: leaving.to, x: leaving.tx, y: leaving.ty })
      this.rt.delete(e.id)
      return budget
    }
    if (dist <= 1 && !leaving) {
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
      rt.path = astar(m.width, m.height, (px, py) => w.passable(active, px, py), x, y, gx, gy) ?? []
      rt.goal = goal
      if (!rt.path.length) {
        eng.setCooldown(e.id, 30) // unreachable for now; try later
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
    }
    eng.setCooldown(e.id, NPC_STEP_TICKS)
    return budget
  }
}
