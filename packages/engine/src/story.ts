// The story's script (world-model.md §6.12): one script of steps. A step waits for its trigger —
// a condition on the one at the keys and on the story (their map and region, their stage, what
// they carry and have learned, what stands near; the story's facts; the hour and weather; another
// step played) — and then plays, once (or once a day): it may take control while it plays (a scene:
// the arrival, the ferry, the far bank — lines to advance, people walked to their places) or not (a
// beat: the tutorial's steps, a line in the companion's bubble). Either way its effects are the
// story's own props (its facts, `seen.<id>`) and events it sends to others (a push to the place an
// actor must go, a notice of the leader's stage): it writes only the story (design.md §5.5–5.8).
// A step with a region begins when the one at the keys enters it, or as another step ends — an
// event, never a poll; the rest are looked at now and then. Objectives (quests, guides) are story
// props and leader props plus how they are shown: a guide tells the objective of the stage the
// leader is at (the companion's `@objective`), the latest beat its hint (`@hint`).

import type { Engine } from './engine.ts'
import { astar, wayTo } from './path.ts'
import { cmp, isDo, isHole, leaves } from './rules.ts'
import { regionId } from './world.ts'
import { calendarAt, isNight, tickAt } from './calendar.ts'
import type { Effect, Entity, Id, Lesson, Pos, Ref, Rule, SceneCmd, StepCond, StepDef, Text } from './types.ts'

const MOVE_STEP_TICKS = 4
const MOVE_TIMEOUT = 900
/** How often (ticks) the steps without a region are looked at. */
const CHECK_EVERY = 3
/** How often (ticks) the steps with a region are looked at again while nobody enters one: a condition beside the region may come true where one stands (a thing picked up, the hour). */
const REGION_EVERY = 30
/** A lesson's line waits this long (ticks) after the companion last spoke, so a beat's line is read first. */
const LESSON_AFTER_SAY = 30

/**
 * What the story asks for now, for a companion to tell (E on it): the first guide whose stage
 * prop the leader is still within, and that stage's objective — its title, how to go about it,
 * and the counts it waits on.
 */
/**
 * The topics the story raises itself: its steps' `topic` commands and its own rules' `topic` effects
 * (named, not passed in a param). They are its news, told when it happens; a patch may not raise
 * one (mod.ts, through the protected facts `topic.<id>`), only a topic of its own.
 */
export function storyTopics(steps: StepDef[], rules: Rule[]): string[] {
  const out = new Set<string>()
  for (const d of steps) for (const c of d.script ?? []) if ('topic' in c) out.add(c.topic)
  for (const r of rules)
    for (const l of leaves(r.tree)) {
      const effects = isDo(l) ? l.do : isHole(l) ? (l.default ?? []) : []
      for (const e of effects) if (e.op === 'topic' && !e.id.startsWith('@')) out.add(e.id)
    }
  return [...out]
}

export class Story {
  readonly defs = new Map<string, StepDef>()
  /** The player entered a region, or a step played: the steps with a region are looked at on the next tick (an event, not a poll). */
  private arrived = false
  /** When the companion last spoke for the story (a beat's line): a lesson's line waits for it to be read. */
  private said = -Infinity

  constructor(private eng: Engine) {}

  load(steps: StepDef[] = []): void {
    this.defs.clear()
    for (const d of steps) this.defs.set(d.id, d)
  }

  get running(): boolean {
    return !!this.eng.world.scene
  }

  /** The one the story follows: the one at the keys. */
  private leader(): Entity {
    return this.eng.world.player
  }

  /** Start a step now (an effect, a trigger). Returns false if another holds control or it is unknown. */
  start(id: string): boolean {
    const w = this.eng.world
    const d = this.defs.get(id)
    if (w.scene || !d) return false
    this.play(d)
    return true
  }

  /** A step plays: the story keeps it and sets its facts, the companion says its line, the quests hear of it; one with a script takes control. */
  private play(d: StepDef): void {
    const w = this.eng.world
    const lead = this.leader()
    const effects: Effect[] = [
      { op: 'setProp', key: `seen.${d.id}`, value: w.state.tick },
      ...(d.repeat ? [{ op: 'setProp', key: `seen.${d.id}.day`, value: w.calendar().day } as Effect] : []),
      // the latest beat: what the companion repeats when spoken to
      ...(d.script ? [] : [{ op: 'setProp', key: 'step.last', value: d.id } as Effect]),
      ...Object.entries(d.facts ?? {}).map(([key, value]): Effect => ({ op: 'setProp', key, value })),
    ]
    this.eng.script(effects, { target: { e: lead.id } }, `step/${d.id}`)
    this.eng.quests.news({ kind: 'step', key: d.id })
    const bird = this.eng.companions.of(lead.id)[0]
    if (d.say && bird) (w.fx.push({ t: 'say', who: bird.id, text: d.say }), (this.said = w.state.tick))
    if (d.script) w.scene = { id: d.id, step: 0 }
    // what has a region may begin now that the story moved
    this.arrived = true
  }

  /** The story moves someone: it sends them a push to the place, and they go there themselves (it writes only itself). */
  private send(e: Entity, to: Pos): void {
    this.story([{ op: 'emit', impulse: 'push', to: 'target', params: { map: to.map, x: to.x, y: to.y } }], { e: e.id })
  }

  /** Run effects as the story (its facts, topics, what it gives), with a target for its spawns and notices. */
  private story(effects: Effect[], target?: Ref): void {
    this.eng.script(effects, target ? { target } : {}, 'step')
  }

  /** Someone entered a region (the engine's contact): if it is the player, the steps with a region are looked at. */
  entered(who: Ref): void {
    if ('e' in who && who.e === this.eng.world.state.player) this.arrived = true
  }

  /** Does a step's trigger hold now, for the leader and the story? */
  met(c: StepCond, lead: Entity = this.leader()): boolean {
    const w = this.eng.world
    const pos = w.posOf(lead)
    if (!pos) return false
    if (c.map && pos.map !== c.map) return false
    if (c.region && !w.within(lead, regionId(c.map ?? pos.map, c.region))) return false
    const cal = w.calendar()
    if (c.hour && !(c.hour.from <= c.hour.to ? cal.hour >= c.hour.from && cal.hour < c.hour.to : cal.hour >= c.hour.from || cal.hour < c.hour.to)) return false
    if (c.weather && !c.weather.includes(cal.weather)) return false
    for (const [k, v] of Object.entries(c.facts ?? {})) if (!cmp(w.fact(k) ?? 0, v)) return false
    for (const [k, v] of Object.entries(c.props ?? {})) if (!cmp(lead.props?.[k] ?? 0, v)) return false
    for (const [id, v] of Object.entries(c.quest ?? {})) if (!cmp(this.eng.quests.stage(id), v)) return false
    for (const o of c.objectives ?? []) if (!this.eng.quests.done(o)) return false
    if (c.carrying) {
      const carried = [lead.held, ...(lead.contents ?? [])].map((id) => w.get(id)).filter((x): x is Entity => !!x)
      for (const type of typeof c.carrying === 'string' ? [c.carrying] : c.carrying) if (!carried.some((x) => x.type.startsWith(type))) return false
    }
    for (const [s, want] of Object.entries(c.statuses ?? {})) if (w.hasStatus({ e: lead.id }, s) !== want) return false
    if (c.holding && !w.get(lead.held)?.type.startsWith(c.holding)) return false
    if (c.spot && Math.max(Math.abs(pos.x - c.spot.x), Math.abs(pos.y - c.spot.y)) > (c.spot.r ?? 1)) return false
    if (c.on) {
      const { type, cells, count = 1 } = c.on
      let n = 0
      for (const [x, y] of cells) n += w.placedAt(pos.map, x, y).filter((e) => e.type.startsWith(type)).length
      if (n < count) return false
    }
    if (c.skill) {
      const skills = (lead.tags ?? []).filter((t) => t.startsWith('skill:'))
      if (c.skill === true ? !skills.length : !skills.includes(`skill:${c.skill}`)) return false
    }
    if (c.after && !w.fact(`seen.${c.after}`)) return false
    if (c.near) {
      const { type, r, status, exact } = c.near
      const seen = w.entitiesOnMap(pos.map).some((e) => e.place.on === 'tile' && (exact ? e.type === type : e.type.startsWith(type)) && Math.max(Math.abs(e.place.x - pos.x), Math.abs(e.place.y - pos.y)) <= r && (!status || w.hasStatus({ e: e.id }, status)))
      if (!seen) return false
    }
    if (c.room && !w.roomsOf(pos.map).some((r) => w.hasTag(r, `role:${c.room}`))) return false
    if (c.morningAfter) {
      const at = w.fact(`seen.${c.morningAfter}`)
      if (typeof at !== 'number') return false
      // the night that ends at the first 05:00 after it: the same day's, if it played in the small hours
      const then = calendarAt(at, w.state.seed)
      const dawn = tickAt(isNight(then.hour) && then.hour < 12 ? then.day : then.day + 1, 5)
      if (w.state.tick < dawn) return false
    }
    return true
  }

  /** Is a step's moment now: not played (today, for one that repeats), and its trigger holds? */
  eligible(d: StepDef): boolean {
    const w = this.eng.world
    if (d.manual) return false
    if (d.repeat ? w.fact(`seen.${d.id}.day`) === w.calendar().day : w.fact(`seen.${d.id}`)) return false
    return this.met(d.when ?? {})
  }

  /** The player has advanced past what was said. */
  advance(): void {
    const s = this.eng.world.scene
    if (s?.waiting === 'advance') {
      s.waiting = undefined
      s.line = undefined
      s.step++
    }
  }

  tick(): void {
    const eng = this.eng
    const w = eng.world
    const t = w.state.tick
    if (!w.scene) {
      // a step with a region begins when the player enters it (or stands in it as another plays);
      // the rest are looked at now and then; one step at a time
      const arrived = this.arrived
      this.arrived = false
      const now = t % CHECK_EVERY === 0
      const region = arrived || t % REGION_EVERY === 0
      if (region || now)
        for (const d of this.defs.values())
          if ((d.when?.region ? region : now) && this.eligible(d)) {
            this.play(d)
            break
          }
      if (now) this.lessonTick()
      return
    }
    for (let guard = 0; guard < 50; guard++) {
      const s = w.scene
      if (!s) return
      if (s.until !== undefined) {
        if (t < s.until) return
        s.until = undefined
        s.step++
        continue
      }
      if (s.waiting === 'advance') return
      if (s.waiting === 'move') {
        if (!this.moveStep()) return
        s.waiting = undefined
        s.mover = undefined
        s.step++
        continue
      }
      const def = this.defs.get(s.id)
      const cmd = def?.script?.[s.step]
      if (!cmd) {
        w.scene = undefined
        this.arrived = true
        return
      }
      this.run(cmd)
      if (!w.scene?.waiting && w.scene?.until === undefined && w.scene) w.scene.step++
    }
  }

  // ---------------------------------------------------------------- lessons (docs/prologue.md, the drills)

  /** The lesson at hand: the first of the current quest stage's lessons the story has not marked done (`lesson.<id>`); none while a scene plays. */
  lesson(): { def: Lesson; index: number; total: number } | undefined {
    const w = this.eng.world
    if (w.scene) return undefined
    const list = this.eng.quests.lessons()
    const i = list.findIndex((l) => !w.fact(`lesson.${l.id}`))
    return i < 0 ? undefined : { def: list[i], index: i, total: list.length }
  }

  /** The lesson at hand begins (its line, once the companion's last is read) and ends when its state holds. */
  private lessonTick(): void {
    const at = this.lesson()
    if (!at) return
    const w = this.eng.world
    const { def } = at
    if (!w.fact(`lesson.${def.id}.begun`)) {
      if (w.state.tick - this.said < LESSON_AFTER_SAY) return
      this.story([{ op: 'setProp', key: `lesson.${def.id}.begun`, value: w.state.tick }])
      const bird = this.eng.companions.of(this.leader().id)[0]
      if (def.say && bird) (w.fx.push({ t: 'say', who: bird.id, text: def.say }), (this.said = w.state.tick))
    }
    if (this.met(def.done)) this.finish(def.id)
  }

  /** A lesson is done: the story keeps it, and the view shows it (a tick). */
  private finish(id: string): void {
    this.story([{ op: 'setProp', key: `lesson.${id}`, value: this.eng.world.state.tick }])
    this.eng.world.fx.push({ t: 'lesson', done: id })
  }

  /** The player skips the lesson at hand (Esc held): it is done, and what it locked works again. */
  skipLesson(): void {
    const at = this.lesson()
    if (at) this.finish(at.def.id)
  }

  /** The player opened a panel (the bag, the map, the build palette) or chose from the chooser: the story notes it (`ui.<what>`), for a lesson that waits on it. */
  ui(what: string): void {
    this.story([{ op: 'setProp', key: `ui.${what}`, value: this.eng.world.state.tick }])
  }

  // ---------------------------------------------------------------- objectives

  /** The objective now, as a companion says it: the tracked quest's open objectives and its stage's hint (docs/quests.md §2.5). */
  objective(): Text | undefined {
    return this.eng.quests.objective()
  }

  /** The line a companion repeats when spoken to: the latest beat's hint. */
  hint(): Text | undefined {
    const id = this.eng.world.fact('step.last')
    const d = typeof id === 'string' ? this.defs.get(id) : undefined
    return d ? (d.hint ?? d.say) : undefined
  }

  // ---------------------------------------------------------------- a step that holds control

  private who(id: Id | 'player'): Entity | undefined {
    const w = this.eng.world
    return id === 'player' ? w.player : w.get(id)
  }

  private run(c: SceneCmd): void {
    const eng = this.eng
    const w = eng.world
    const s = w.scene!
    if ('card' in c) {
      w.fx.push({ t: 'card', text: c.card, ...(c.art && { art: c.art }) })
      s.line = { who: w.state.player, text: c.card, card: true, ...(c.art && { art: c.art }) }
      s.waiting = 'advance'
    } else if ('picture' in c) {
      // only the view draws it: the frame carries it while the scene plays (the scene's end takes it with it)
      if (c.picture) s.picture = c.picture
      else delete s.picture
    } else if ('say' in c) {
      const e = this.who(c.say)
      if (!e) return // the speaker is not in the world: the line is skipped
      w.fx.push({ t: 'say', who: e.id, text: c.text, mood: c.mood, scene: true })
      s.line = { who: e.id, text: c.text, mood: c.mood }
      s.waiting = 'advance'
    } else if ('move' in c) {
      const e = this.who(c.move)
      if (!e || e.place.on !== 'tile') return
      const map = w.map(e.place.map)!
      const path = astar(map.width, map.height, (x, y) => w.walkable(map.id, x, y, e.id, true) || (x === c.x && y === c.y), e.place.x, e.place.y, c.x, c.y, undefined, (ax, ay, bx, by) => w.safeStep(e, map.id, ax, ay, bx, by))
      s.mover = { who: e.id, path: path ?? [[c.x, c.y]], next: w.state.tick + MOVE_STEP_TICKS }
      s.until = undefined
      s.waiting = 'move'
      s.started = w.state.tick
    } else if ('face' in c) {
      const e = this.who(c.face)
      if (e) e.facing = c.dir
    } else if ('emote' in c) {
      const e = this.who(c.emote)
      if (e) w.fx.push({ t: 'emote', who: e.id, mood: c.mood })
    } else if ('wait' in c) {
      s.until = w.state.tick + c.wait
    } else if ('fade' in c) {
      w.fx.push({ t: 'fade', dir: c.fade })
      if (c.fade === 'out') s.dark = true
      else delete s.dark
    } else if ('place' in c) {
      const e = w.get(c.place)
      if (e) this.send(e, { map: c.map, x: c.x, y: c.y })
    } else if ('fact' in c) {
      this.story([{ op: 'setProp', key: c.fact, value: c.value }])
    } else if ('topic' in c) {
      this.story([{ op: 'topic', id: c.topic, days: c.days }])
    } else if ('give' in c) {
      this.story([{ op: 'spawn', type: c.give, at: 'target', into: 'contents', still: true, ...(c.count && { count: c.count }) }], { e: w.state.player })
    } else if ('warp' in c) {
      this.send(w.player, { map: c.warp, x: c.x, y: c.y })
    } else if ('stage' in c) {
      // the story tells a quest to reach a stage; the quest's own rule answers (docs/quests.md)
      this.story([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'stage', n: c.n } }], { e: `quest.${c.stage}` })
    } else if ('tell' in c) {
      this.story([{ op: 'emit', impulse: 'notify', to: 'target', params: c.params }], { e: c.tell })
    } else if ('music' in c) {
      // the music is the scene's (it ends with it): a cue of the client's, or silence
      s.music = c.music
    } else if ('status' in c) {
      if (c.add) this.story([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'status', add: c.add } }], { e: c.status })
      if (c.remove) this.story([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'status', remove: c.remove } }], { e: c.status })
    }
  }

  /** One step of a scripted walk. True when it has arrived (or given up and been placed). */
  private moveStep(): boolean {
    const w = this.eng.world
    const s = w.scene!
    const m = s.mover
    if (!m) return true
    const e = w.get(m.who)
    if (!e || e.place.on !== 'tile') return true
    const started = s.started ?? w.state.tick
    if (!m.path.length) return true
    if (w.state.tick - started > MOVE_TIMEOUT) {
      const [x, y] = m.path[m.path.length - 1]
      this.send(e, { map: e.place.map, x, y })
      return true
    }
    if (w.state.tick < m.next) return false
    const [x, y] = m.path.shift()!
    const dir = e.place.on === 'tile' ? wayTo(e.place.x, e.place.y, x, y) : undefined
    if (dir) e.facing = dir
    this.send(e, { map: e.place.map, x, y })
    m.next = w.state.tick + MOVE_STEP_TICKS
    return m.path.length === 0
  }
}
