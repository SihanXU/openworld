// Companions (docs/prologue.md). A companion is any actor whose `companion` prop names a leader:
// it keeps beside them, flies over what blocks people, and follows them from map to map — its
// goal, `follow` (behaviour.ts, world-model.md §6.10). It is `airborne` (its type's tag): it never
// blocks a tile, and blows pass under it. Each hop is an act of moving, and when it cannot go on
// (it is down) it reports `stuck` (design.md §5.7), whose outcome is the world's to say. What it
// says when the story moves, and when spoken to, is the story's (story.ts).

import type { Engine } from './engine.ts'
import type { Entity, Id } from './types.ts'
import { DIRS } from './types.ts'
import { TICKS_PER_HOUR } from './calendar.ts'

/** Where a companion settles: within this many tiles of a leader standing still. */
const NEAR = 1
/** How far a companion may trail a leader on the move before it hurries to catch up. */
const LAG = 3
/** A companion that cannot follow says so at most this often (ticks). */
const STUCK_EVERY = TICKS_PER_HOUR

export class Companions {
  /** Where each companion's leader last stood, and for how many ticks (runtime only). */
  private still = new Map<Id, { map: string; x: number; y: number; ticks: number }>()
  /** When each companion may next report that it cannot follow (runtime only). */
  private stuckUntil = new Map<Id, number>()

  constructor(private eng: Engine) {}

  /** The companions following an actor. */
  of(leader: Id): Entity[] {
    return Object.values(this.eng.world.state.entities).filter((e) => e.props?.companion === leader && e.place.on === 'tile')
  }

  /**
   * Follow (world-model.md §6.10): an actor with a leader keeps beside them. A companion hops every
   * tick: it flies faster than anyone runs, so it never falls behind.
   */
  follow(e: Entity): boolean {
    const w = this.eng.world
    const lead = typeof e.props?.companion === 'string' ? w.get(e.props.companion) : undefined
    if (!lead) return false
    this.keepUp(e, lead)
    return true
  }

  /**
   * Keep near the leader, behind them (never where they face and act): across maps at once,
   * else a hop toward its perch when they draw away. It flies over whatever stands between.
   */
  private keepUp(e: Entity, lead: Entity): void {
    const w = this.eng.world
    const to = w.posOf(lead)
    const at = w.posOf(e)
    if (!to || lead.place.on !== 'tile' || !w.map(to.map)) return
    // it cannot go on (down, held fast): it says so, and the world's answer is the outcome
    if (this.eng.busy(e)) {
      if (!e.frozenBy && (this.stuckUntil.get(e.id) ?? -1) <= w.state.tick) {
        this.stuckUntil.set(e.id, w.state.tick + STUCK_EVERY)
        this.eng.queue({ kind: 'stuck', host: { e: e.id }, roles: { target: { e: lead.id } }, params: { activity: 'follow' }, origin: 'world' })
      }
      return
    }
    const perch = this.perch(lead, to.map, to.x, to.y)
    if (!at || at.map !== to.map || Math.max(Math.abs(at.x - to.x), Math.abs(at.y - to.y)) > 8) return this.fly(e, to.map, perch.x, perch.y)
    const ahead = { x: to.x + DIRS[lead.facing ?? 'down'][0], y: to.y + DIRS[lead.facing ?? 'down'][1] }
    const d = Math.max(Math.abs(at.x - to.x), Math.abs(at.y - to.y))
    // how long the leader has stood still
    const s = this.still.get(e.id)
    const idle = s && s.map === to.map && s.x === to.x && s.y === to.y ? s.ticks + 1 : 0
    this.still.set(e.id, { map: to.map, x: to.x, y: to.y, ticks: idle })
    const inTheWay = (at.x === ahead.x && at.y === ahead.y) || (at.x === to.x && at.y === to.y)
    // a bird trails a few tiles behind on the move, catching up only when it falls back past LAG;
    // once the leader stands still it drifts in, unhurried, to its perch behind them
    if (!inTheWay && d <= LAG && !(idle >= 10 && d > NEAR && idle % 3 === 0)) return
    const x = at.x + Math.sign(perch.x - at.x)
    const y = at.y + Math.sign(perch.y - at.y)
    if (x === at.x && y === at.y) return
    e.facing = x !== at.x ? (x > at.x ? 'right' : 'left') : y > at.y ? 'down' : 'up'
    this.fly(e, to.map, x, y)
  }

  /** The companion's own move: an act of moving there (a flyer goes over what stops walkers). */
  private fly(e: Entity, map: string, x: number, y: number): void {
    this.eng.act('move', e.id, { e: e.id }, { instrument: null, params: { map, x, y } })
  }

  /** The tile behind the leader (or beside them, at the map's edge). */
  private perch(lead: Entity, map: string, x: number, y: number): { x: number; y: number } {
    const w = this.eng.world
    const [fx, fy] = DIRS[lead.facing ?? 'down']
    for (const [dx, dy] of [[-fx, -fy], [-fx - fy, -fy - fx], [-fx + fy, -fy + fx], [fy, fx], [-fy, -fx]])
      if (w.inBounds(map, x + dx, y + dy) && (dx || dy)) return { x: x + dx, y: y + dy }
    return { x, y }
  }
}
