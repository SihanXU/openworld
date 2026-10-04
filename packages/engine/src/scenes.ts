// Scripted scenes (docs/game-design.md §8.6): the arrival, the ferry, the far bank. A scene
// has a place, conditions and a script; while it plays the player watches (and advances what is
// said); then control returns. Scenes play once unless they say they repeat, and every scene
// that has played is a fact (`seen.<id>`), so lines, schedules and other scenes can follow it.
// A scene is the story's script (design.md §5.5–5.8): it writes only the story — its facts and
// topics, through story-hosted effects — and sends the rest as impulses that their receivers answer
// themselves: a push to the place an actor must go, a notice of the player's stage.

import type { Engine } from './engine.ts'
import { astar } from './path.ts'
import { DIRS } from './types.ts'
import { cmp } from './rules.ts'
import { regionId } from './world.ts'
import type { Dir, Effect, Entity, Id, Pos, Ref, SceneCmd, SceneDef } from './types.ts'

const MOVE_STEP_TICKS = 4
const MOVE_TIMEOUT = 900
const CHECK_EVERY = 20

export class Scenes {
  readonly defs = new Map<string, SceneDef>()
  /** The player entered a region, or a scene ended: the region scenes are checked on the next tick (an event, not a poll). */
  private arrived = false

  constructor(private eng: Engine) {}

  load(defs: SceneDef[] = []): void {
    for (const d of defs) this.defs.set(d.id, d)
  }

  get running(): boolean {
    return !!this.eng.world.scene
  }

  /** Start a scene now (effects, or a trigger). Returns false if another is playing or it is unknown. */
  start(id: string): boolean {
    const w = this.eng.world
    if (w.scene || !this.defs.has(id)) return false
    w.scene = { id, step: 0 }
    this.story([{ op: 'setProp', key: `seen.${id}`, value: true }])
    return true
  }

  /** The story moves someone: it sends them a push to the place, and they go there themselves (it writes only itself). */
  private send(e: Entity, to: Pos): void {
    this.story([{ op: 'emit', impulse: 'push', to: 'target', params: { map: to.map, x: to.x, y: to.y } }], { e: e.id })
  }

  /** Run effects as the story (its facts, topics, what it gives), with a target for its spawns and notices. */
  private story(effects: Effect[], target?: Ref): void {
    this.eng.script(effects, target ? { target } : {}, 'scene')
  }

  /** Someone entered a region (the engine's contact): if it is the player, the region scenes are checked. */
  entered(who: Ref): void {
    if ('e' in who && who.e === this.eng.world.state.player) this.arrived = true
  }

  /** Is a scene's place and moment now? */
  eligible(d: SceneDef): boolean {
    const w = this.eng.world
    const pos = w.posOf(w.player)
    if (d.manual || !pos || pos.map !== d.map) return false
    if (!d.when?.repeat && w.fact(`seen.${d.id}`)) return false
    const k = d.when
    if (!k) return true
    const cal = w.calendar()
    if (k.hour && !(k.hour.from <= k.hour.to ? cal.hour >= k.hour.from && cal.hour < k.hour.to : cal.hour >= k.hour.from || cal.hour < k.hour.to)) return false
    if (k.weather && !k.weather.includes(cal.weather)) return false
    for (const [key, c] of Object.entries(k.facts ?? {})) if (!cmp(w.fact(key) ?? 0, c)) return false
    if (k.region && !w.within(w.player, regionId(d.map, k.region))) return false
    if (k.repeat && w.fact(`seen.${d.id}.day`) === cal.day) return false
    return true
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
      // a scene tied to a region begins when the player enters it (or stands in it as another ends);
      // the rest are checked now and then
      const arrived = this.arrived
      this.arrived = false
      if (arrived || t % CHECK_EVERY === 0)
        for (const d of this.defs.values())
          if (!!d.when?.region === arrived && this.eligible(d)) {
            this.start(d.id)
            if (d.when?.repeat) this.story([{ op: 'setProp', key: `seen.${d.id}.day`, value: w.calendar().day }])
            break
          }
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
      const cmd = def?.script[s.step]
      if (!cmd) {
        w.scene = undefined
        this.arrived = true
        return
      }
      this.run(cmd)
      if (!w.scene?.waiting && w.scene?.until === undefined && w.scene) w.scene.step++
    }
  }

  private who(id: Id | 'player'): Entity | undefined {
    const w = this.eng.world
    return id === 'player' ? w.player : w.get(id)
  }

  private run(c: SceneCmd): void {
    const eng = this.eng
    const w = eng.world
    const s = w.scene!
    if ('card' in c) {
      w.fx.push({ t: 'card', text: c.card })
      s.line = { who: w.state.player, text: c.card, card: true }
      s.waiting = 'advance'
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
      const path = astar(map.width, map.height, (x, y) => w.walkable(map.id, x, y, e.id, true) || (x === c.x && y === c.y), e.place.x, e.place.y, c.x, c.y)
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
    } else if ('place' in c) {
      const e = w.get(c.place)
      if (e) this.send(e, { map: c.map, x: c.x, y: c.y })
    } else if ('fact' in c) {
      this.story([{ op: 'setProp', key: c.fact, value: c.value }])
    } else if ('topic' in c) {
      this.story([{ op: 'topic', id: c.topic, days: c.days }])
    } else if ('give' in c) {
      this.story([{ op: 'spawn', type: c.give, at: 'target', into: 'contents', still: true }], { e: w.state.player })
    } else if ('warp' in c) {
      this.send(w.player, { map: c.warp, x: c.x, y: c.y })
    } else if ('prop' in c) {
      // the story tells the player where the story stands; the player's own rule keeps it
      this.story([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: c.prop, value: c.value } }], { e: w.state.player })
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
    const dir = (Object.entries(DIRS) as [Dir, [number, number]][]).find(([, [dx, dy]]) => e.place.on === 'tile' && dx === x - e.place.x && dy === y - e.place.y)?.[0]
    if (dir) e.facing = dir
    this.send(e, { map: e.place.map, x, y })
    m.next = w.state.tick + MOVE_STEP_TICKS
    return m.path.length === 0
  }
}
