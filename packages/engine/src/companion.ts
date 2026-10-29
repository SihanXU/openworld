// Companions (docs/prologue.md). A companion is any actor whose `companion` prop names a leader:
// it keeps near them (two tiles off), flies over what blocks people, and follows them from map to map — its
// goal, `follow` (behaviour.ts, world-model.md §6.10). It is `airborne` (its type's tag): it never
// blocks a tile, and blows pass under it. Each hop is an act of moving, and when it cannot go on
// (it is down) it reports `stuck` (design.md §5.7), whose outcome is the world's to say. What it
// says when the story moves, and when spoken to, is the story's (story.ts); what it remarks on for its leader (a way
// the story has not opened, run up against), a rule's (the `remark` primitive).
//
// It leads the way too (the game's `guide`, GuideParams): when the one at the keys has done nothing for a while, with a
// quest tracked, it flies to where the quest goes next (Quests.lead) — over the thing to get or the one to see, or out
// ahead toward one farther off, up to the way off the map — and calls out; the leader walking after it, it goes on
// ahead, and comes back once they are there, go another way or it has shown the spot a while.

import type { Engine } from './engine.ts'
import type { QuestLead } from './quests.ts'
import type { Entity, Id, Text } from './types.ts'
import { DIRS } from './types.ts'
import { TICKS_PER_HOUR } from './calendar.ts'

/**
 * Where a companion settles: this many tiles from a leader standing still, neither nearer nor farther — two, so it is
 * not right behind them, where turning to it would send it round behind again (its hands reach as far: `handsRange`).
 */
const NEAR = 2
/** How far a companion may trail a leader on the move before it hurries to catch up. */
const LAG = 3
/** A companion that cannot follow says so at most this often (ticks). */
const STUCK_EVERY = TICKS_PER_HOUR
/** How far out ahead of its leader a companion leading the way flies (tiles): it stays in their sight. */
const AHEAD = 8
/** A companion leading the way hops every this many ticks (slower than it follows: the leader sees it go). */
const HOP_EVERY = 2
/** How often (ticks) a companion leading the way looks again at where the quest goes next. */
const LOOK_EVERY = 10
/** The compass, clockwise from north (up): the keys of GuideParams.dirs. */
const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

/** A companion leading the way (runtime only): where to, since when, how near the leader has come, what it said, when it got there. */
interface Leading {
  lead: QuestLead
  since: number
  near: number
  said: Set<string>
  there?: { x: number; y: number; at: number; over: boolean }
}

const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export class Companions {
  /** Where each companion's leader last stood, and for how many ticks (runtime only). */
  private still = new Map<Id, { map: string; x: number; y: number; ticks: number }>()
  /** When each companion may next report that it cannot follow (runtime only). */
  private stuckUntil = new Map<Id, number>()
  /** When each line remarked on was last said, by what said it and the line (runtime only: after a load, it is new again). */
  private remarked = new Map<string, number>()
  /** The ways being led (runtime only). */
  private leading = new Map<Id, Leading>()
  /** When each companion may lead again after showing a spot while its leader still does nothing (runtime only). */
  private rest = new Map<Id, number>()
  /** When the one at the keys last did something (runtime only: an act, a step, an input the host passes on). */
  private stirred?: number
  /** Which line comes next (they are said in turn). */
  private line = 0
  /** Does a companion lead the way (the player's option; runtime only)? */
  guiding = true

  constructor(private eng: Engine) {}

  /** The one at the keys did something: the idle count begins again, and a companion that rested may lead again. */
  stir(): void {
    this.stirred = this.eng.world.state.tick
    this.rest.clear()
  }

  /** The spot a companion leading the way is showing now, on the leader's map (the view marks it). */
  pointing(): { who: Id; x: number; y: number } | undefined {
    for (const [who, g] of this.leading) if (g.there?.over) return { who, x: g.lead.x, y: g.lead.y }
    return undefined
  }

  /** The companions following an actor. */
  of(leader: Id): Entity[] {
    const w = this.eng.world
    return [...w.companionIds].map((id) => w.state.entities[id]).filter((e) => e && e.props?.companion === leader && e.place.on === 'tile')
  }

  /**
   * A line remarked on for `by` (the `remark` primitive): which of its companions beside it says it (on its map; none:
   * no one, the caller writes the line instead) and whether it was said before (`again`). Undefined: said within
   * `every` ticks already (a way walked into on and on), so nothing now.
   */
  remark(by: Entity, key: string, every?: number): { companion?: Entity; again: boolean } | undefined {
    const w = this.eng.world
    const last = this.remarked.get(key)
    if (last !== undefined && every && w.state.tick - last < every) return undefined
    this.remarked.set(key, w.state.tick)
    const map = w.posOf(by)?.map
    const companion = map ? this.of(by.id).find((c) => c.place.on === 'tile' && c.place.map === map) : undefined
    return { companion, again: last !== undefined }
  }

  /**
   * Follow (world-model.md §6.10): an actor with a leader keeps beside them. A companion hops every
   * tick: it flies faster than anyone runs, so it never falls behind.
   */
  follow(e: Entity): boolean {
    const w = this.eng.world
    const lead = typeof e.props?.companion === 'string' ? w.get(e.props.companion) : undefined
    if (!lead) return false
    if (!this.guide(e, lead)) this.keepUp(e, lead)
    return true
  }

  /**
   * Lead the way (GuideParams): begin when the leader has done nothing for a while with somewhere for the quest to go,
   * fly there or out ahead toward it, call out, and come back when they are there, go another way, or it has shown the
   * spot a while. False: it is not leading now (it keeps up instead).
   */
  private guide(e: Entity, lead: Entity): boolean {
    const eng = this.eng
    const w = eng.world
    const p = w.onto.data.guide
    const now = w.state.tick
    const to = w.posOf(lead)
    const at = w.posOf(e)
    // never in a scene, a question, a lesson or a fight, nor while the leader is held or elsewhere
    const calm =
      !!p && this.guiding && lead.id === w.state.player && lead.place.on === 'tile' && !!to && !!at && at.map === to.map && !w.scene && !w.state.question && !eng.busy(lead) && !eng.busy(e) && !w.fighting(lead) && !eng.story.lesson()
    if (!calm || !to || !at) return this.stop(e, false)
    const idle = now - (this.stirred ??= now)
    let g = this.leading.get(e.id)
    if (!g) {
      if (idle < (p.after ?? 50) || now < (this.rest.get(e.id) ?? 0)) return false
      // nowhere to go yet: looked at again now and then, not every tick
      if (idle > (p.after ?? 50) && (idle - (p.after ?? 50)) % LOOK_EVERY) return false
      const l = eng.quests.lead()
      if (!l || l.map !== to.map || (l.kind !== 'exit' && far(l, to) <= 1)) return false
      g = { lead: l, since: now, near: far(l, to), said: new Set() }
      this.leading.set(e.id, g)
    } else if ((now - g.since) % LOOK_EVERY === 0) {
      // where the quest goes next, again (a thing picked up, a step through a door)
      const l = eng.quests.lead()
      if (!l || l.map !== to.map) return this.stop(e, false)
      if (l.key !== g.lead.key) (g = { lead: l, since: now, near: far(l, to), said: new Set() }), this.leading.set(e.id, g)
    }
    const d = far(g.lead, to)
    // the leader went another way: it comes back; they are there: it is done
    if (d > g.near && idle < (p.after ?? 50)) return this.stop(e, false)
    g.near = Math.min(g.near, d)
    if (g.lead.kind !== 'exit' && d <= 1) return this.stop(e, true)
    // over the spot when it is near the leader (just above it, not hiding it), else out ahead toward it
    const over = d <= AHEAD
    const spot = over ? (w.inBounds(to.map, g.lead.x, g.lead.y - 1) ? { x: g.lead.x, y: g.lead.y - 1 } : g.lead) : this.ahead(to.map, to, g.lead)
    if (at.x !== spot.x || at.y !== spot.y) {
      if (g.there && (g.there.over !== over || far(g.there, spot) > 1)) g.there = undefined
      if (now % HOP_EVERY === 0) {
        const x = at.x + Math.sign(spot.x - at.x)
        const y = at.y + Math.sign(spot.y - at.y)
        e.facing = x !== at.x ? (x > at.x ? 'right' : 'left') : y > at.y ? 'down' : 'up'
        this.fly(e, to.map, x, y)
      }
      return true
    }
    // there: it turns to the leader and calls out, once for each kind of spot
    e.facing = Math.abs(to.x - at.x) >= Math.abs(to.y - at.y) ? (to.x > at.x ? 'right' : 'left') : to.y > at.y ? 'down' : 'up'
    if (!g.there || g.there.over !== over) g.there = { x: spot.x, y: spot.y, at: now, over }
    const kind = g.lead.kind === 'exit' ? 'exit' : over ? 'here' : 'way'
    if (!g.said.has(kind)) {
      g.said.add(kind)
      const text = kind === 'here' && g.lead.nudge ? g.lead.nudge : this.words(p[kind], { thing: g.lead.name, place: g.lead.name, dir: p.dirs?.[this.compass(to, g.lead)] })
      if (text) w.fx.push({ t: 'say', who: e.id, text, aside: true })
    }
    // shown a while, the leader still doing nothing: it comes back and rests before it leads again
    if (now - g.there.at >= (p.show ?? 80)) return this.stop(e, true)
    return true
  }

  /** It stops leading (false: it keeps up again this turn); `done`: the leader got there or it showed the spot. */
  private stop(e: Entity, done: boolean): false {
    if (this.leading.delete(e.id) && done) this.rest.set(e.id, this.eng.world.state.tick + (this.eng.world.onto.data.guide?.every ?? 200))
    return false
  }

  /** The tile AHEAD tiles from the leader on the straight way to the spot (within the map). */
  private ahead(map: string, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const k = AHEAD / Math.max(1, Math.abs(dx), Math.abs(dy))
    const x = from.x + Math.round(dx * k)
    const y = from.y + Math.round(dy * k)
    const m = this.eng.world.map(map)
    return m ? { x: Math.max(0, Math.min(m.width - 1, x)), y: Math.max(0, Math.min(m.height - 1, y)) } : { x, y }
  }

  /** Which way the spot lies from the leader, of the compass's eight (north is up). */
  private compass(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const a = Math.atan2(to.x - from.x, from.y - to.y)
    return COMPASS[(Math.round(a / (Math.PI / 4)) + 8) % 8]
  }

  /** The next of the game's lines whose blanks can all be filled, filled in each language. */
  private words(lines: Text[] | undefined, vars: Record<string, Text | undefined>): Text | undefined {
    const fits = (lines ?? []).filter((t) => [...(typeof t === 'string' ? t : t.en).matchAll(/\{(\w+)\}/g)].every((m) => vars[m[1]] !== undefined))
    if (!fits.length) return undefined
    const t = fits[this.line++ % fits.length]
    const fill = (s: string, l: 'en' | 'zh') => s.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = vars[k]!
      return typeof v === 'string' ? v : ((l === 'zh' ? v.zh : undefined) ?? v.en)
    })
    return typeof t === 'string' ? fill(t, 'en') : { en: fill(t.en, 'en'), ...(t.zh && { zh: fill(t.zh, 'zh') }) }
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
    // once the leader stands still it drifts, unhurried, to its perch behind them (and stays where it settled, at
    // NEAR, when they turn to it)
    if (!inTheWay && d <= LAG && !(idle >= 10 && d !== NEAR && idle % 3 === 0)) return
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

  /** The tile NEAR tiles behind the leader (or beside them, nearer at the map's edge). */
  private perch(lead: Entity, map: string, x: number, y: number): { x: number; y: number } {
    const w = this.eng.world
    const [fx, fy] = DIRS[lead.facing ?? 'down']
    for (const n of [NEAR, 1])
      for (const [dx, dy] of [[-fx, -fy], [-fx - fy, -fy - fx], [-fx + fy, -fy + fx], [fy, fx], [-fy, -fx]])
        if (w.inBounds(map, x + dx * n, y + dy * n) && (dx || dy)) return { x: x + dx * n, y: y + dy * n }
    return { x, y }
  }
}
