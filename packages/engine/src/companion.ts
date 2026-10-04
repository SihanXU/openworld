// Companions and beats (docs/prologue.md). A companion is any actor whose `companion` prop names
// a leader: it keeps beside them, flies over what blocks people, and follows them from map to
// map. It is `airborne` (its type's tag): it never blocks a tile, and blows pass under it.
// Following is its behaviour: each hop is an act of moving, and when it cannot go on (it is down)
// it reports `stuck` (design.md §5.7), whose outcome is the world's to say.
//
// Beats are the content's once-firing, non-blocking steps (the tutorial): the story's script,
// like a scene. Each waits for its condition on the leader; then the story keeps it as a fact,
// tells the leader its new stage (a notice it answers itself) and lets the companion say one line
// in a bubble. `@hint` (a `say` text) is the line of the latest beat — what the companion
// repeats when spoken to.

import type { Engine } from './engine.ts'
import { cmp } from './rules.ts'
import type { Cmp, Effect, Entity, Id, PropValue, Text } from './types.ts'
import { DIRS } from './types.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import { regionId } from './world.ts'

/** What a beat waits for, all on its leader (the actor the companion follows, or the player). */
export interface BeatCond {
  facts?: Record<string, Cmp>
  props?: Record<string, Cmp>
  map?: string
  /** The leader stands in this region of their map (MapData.regions). */
  region?: string
  /** The leader carries (hand or bag) something of a type starting with this. */
  carrying?: string
  /** The leader has learned a skill: any (true) or this one. */
  skill?: boolean | string
  /** Another beat has fired. */
  after?: string
  /** Something of a type starting with this stands within r tiles of the leader (in view: they have seen it). */
  near?: { type: string; r: number }
}

export interface Beat {
  id: string
  when: BeatCond
  /** The leader's stage props: the story tells them (`notify` what = key, value), and they keep it. */
  props?: Record<string, PropValue>
  /** The story's own facts. */
  facts?: Record<string, PropValue>
  /** Said by the companion, in a bubble, when the beat fires. */
  say?: Text
  /** What the companion says when spoken to while this is the latest beat (default: `say`). */
  hint?: Text
}

/**
 * What the story asks for now, for a companion to tell (F on it): the first guide whose stage
 * prop the leader is still within, and that stage's objective — its title, how to go about it,
 * and the counts it waits on.
 */
export interface Guide {
  /** The leader's prop that holds the stage ('prologue', 'quest'). */
  prop: string
  /** The guide applies while the stage is below this (the prologue's end). */
  until?: number
  /** The prop's value when the leader has none yet. */
  start?: number
  stages: Record<number, { title: Text; hint: Text; progress?: { fact: string; need: number; label: Text }[] }>
}

/** How often (ticks) beats are checked. */
const EVERY = 3
/** Where a companion settles: within this many tiles of a leader standing still. */
const NEAR = 1
/** How far a companion may trail a leader on the move before it hurries to catch up. */
const LAG = 3
/** A companion that cannot follow says so at most this often (ticks). */
const STUCK_EVERY = TICKS_PER_HOUR

export class Companions {
  beats: Beat[] = []
  guides: Guide[] = []
  /** Where each companion's leader last stood, and for how many ticks (runtime only). */
  private still = new Map<Id, { map: string; x: number; y: number; ticks: number }>()
  /** When each companion may next report that it cannot follow (runtime only). */
  private stuckUntil = new Map<Id, number>()

  constructor(private eng: Engine) {}

  load(beats: Beat[] | undefined, guides: Guide[] = []): void {
    this.beats = beats ?? []
    this.guides = guides
  }

  /** The objective now, as a companion says it: "Mend the bridge — three planks … (planks 1/3)". */
  objective(): Text | undefined {
    const w = this.eng.world
    const lead = this.leader()
    for (const g of this.guides) {
      const v = Number(lead.props?.[g.prop] ?? g.start ?? 0)
      if (g.until !== undefined && v >= g.until) continue
      const o = g.stages[v]
      // within this guide's span but between its stages (the first moments): nothing to tell yet
      if (!o) return undefined
      const text = (l: 'en' | 'zh') => {
        const pick = (t: Text) => (typeof t === 'string' ? t : (l === 'zh' ? t.zh : undefined) ?? t.en)
        const counts = (o.progress ?? []).map((p) => `${pick(p.label)} ${Math.min(p.need, Number(w.fact(p.fact) ?? 0))}/${p.need}`)
        const head = l === 'zh' ? `现在要：${pick(o.title)}。` : `Now: ${pick(o.title)}.`
        return [head, pick(o.hint), counts.length ? (l === 'zh' ? `（${counts.join('，')}）` : `(${counts.join(', ')})`) : ''].filter(Boolean).join(' ')
      }
      return { en: text('en'), zh: text('zh') }
    }
    return undefined
  }

  /** The companions following an actor. */
  of(leader: Id): Entity[] {
    return Object.values(this.eng.world.state.entities).filter((e) => e.props?.companion === leader && e.place.on === 'tile')
  }

  /** The beats, checked now and then (following is the companions' goal, behaviour.ts). */
  tick(): void {
    const w = this.eng.world
    if (w.state.tick % EVERY === 0 && !w.scene) this.checkBeats()
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

  // ---------------------------------------------------------------- beats

  private leader(): Entity {
    const w = this.eng.world
    return w.player
  }

  met(c: BeatCond, lead: Entity): boolean {
    const w = this.eng.world
    const pos = w.posOf(lead)
    if (!pos) return false
    for (const [k, v] of Object.entries(c.facts ?? {})) if (!cmp(w.fact(k) ?? 0, v)) return false
    for (const [k, v] of Object.entries(c.props ?? {})) if (!cmp(lead.props?.[k] ?? 0, v)) return false
    if (c.map && pos.map !== c.map) return false
    if (c.region && !w.within(lead, regionId(pos.map, c.region))) return false
    if (c.carrying) {
      const carried = [lead.held, ...(lead.contents ?? [])].map((id) => w.get(id)).filter((x): x is Entity => !!x)
      if (!carried.some((x) => x.type.startsWith(c.carrying!))) return false
    }
    if (c.skill) {
      const skills = (lead.tags ?? []).filter((t) => t.startsWith('skill:'))
      if (c.skill === true ? !skills.length : !skills.includes(`skill:${c.skill}`)) return false
    }
    if (c.after && !w.fact(`beat.${c.after}`)) return false
    if (c.near) {
      const { type, r } = c.near
      const seen = w.entitiesOnMap(pos.map).some((e) => e.place.on === 'tile' && e.type.startsWith(type) && Math.max(Math.abs(e.place.x - pos.x), Math.abs(e.place.y - pos.y)) <= r)
      if (!seen) return false
    }
    return true
  }

  private checkBeats(): void {
    const w = this.eng.world
    const lead = this.leader()
    for (const b of this.beats) {
      if (w.fact(`beat.${b.id}`) || !this.met(b.when, lead)) continue
      // a beat is the story's script (the tutorial's step): the story keeps it, and tells the leader their stage
      const effects: Effect[] = [
        { op: 'setProp', key: `beat.${b.id}`, value: w.state.tick },
        { op: 'setProp', key: 'beat.last', value: b.id },
        ...Object.entries(b.facts ?? {}).map(([key, value]): Effect => ({ op: 'setProp', key, value })),
        ...Object.entries(b.props ?? {}).map(([what, value]): Effect => ({ op: 'emit', impulse: 'notify', to: 'target', params: { what, value } })),
      ]
      this.eng.script(effects, { target: { e: lead.id } }, `beat/${b.id}`)
      const bird = this.of(lead.id)[0]
      if (b.say && bird) w.fx.push({ t: 'say', who: bird.id, text: b.say })
      // one beat at a time: the next waits for the next check
      return
    }
  }

  /** The line a companion repeats when spoken to: the latest beat's hint. */
  hint(): Text | undefined {
    const id = this.eng.world.fact('beat.last')
    const b = this.beats.find((x) => x.id === id)
    return b ? (b.hint ?? b.say) : undefined
  }
}
