// Scripted scenes (docs/game-design.md §8.6): the arrival, heart events, Hearth Night. A scene
// has a place, conditions and a script; while it plays the player watches (and advances what is
// said); then control returns. Scenes play once unless they say they repeat, and every scene
// that has played is a fact (`seen.<id>`), so lines, schedules and other scenes can follow it.

import type { Engine } from './engine.ts'
import { astar } from './path.ts'
import { DIRS } from './types.ts'
import { cmp } from './rules.ts'
import type { Dir, Entity, Id, SceneCmd, SceneDef } from './types.ts'

const MOVE_STEP_TICKS = 4
const MOVE_TIMEOUT = 900
const CHECK_EVERY = 20

export class Scenes {
  readonly defs = new Map<string, SceneDef>()

  constructor(private eng: Engine) {}

  load(defs: SceneDef[] = []): void {
    for (const d of defs) this.defs.set(d.id, d)
  }

  get running(): boolean {
    return !!this.eng.world.state.scene
  }

  /** Start a scene now (effects, or a trigger). Returns false if another is playing or it is unknown. */
  start(id: string): boolean {
    const w = this.eng.world
    if (w.state.scene || !this.defs.has(id)) return false
    w.state.scene = { id, step: 0 }
    w.setFact(`seen.${id}`, true)
    return true
  }

  /** Is a scene's place and moment now? */
  eligible(d: SceneDef): boolean {
    const w = this.eng.world
    const pos = w.posOf(w.player)
    if (!pos || pos.map !== d.map) return false
    if (!d.when?.repeat && w.fact(`seen.${d.id}`)) return false
    const k = d.when
    if (!k) return true
    const cal = w.calendar()
    if (k.hour && !(k.hour.from <= k.hour.to ? cal.hour >= k.hour.from && cal.hour < k.hour.to : cal.hour >= k.hour.from || cal.hour < k.hour.to)) return false
    if (k.weather && !k.weather.includes(cal.weather)) return false
    if (k.weekday && !k.weekday.includes(cal.weekday)) return false
    for (const [key, c] of Object.entries(k.facts ?? {})) if (!cmp(w.fact(key) ?? 0, c)) return false
    if (k.hearts && Math.floor(w.num(w.player, `friend.${k.hearts.npc}`, 0) / 250) < k.hearts.gte) return false
    if (k.repeat && w.fact(`seen.${d.id}.day`) === cal.day) return false
    return true
  }

  /** The player has advanced past what was said. */
  advance(): void {
    const s = this.eng.world.state.scene
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
    if (!w.state.scene) {
      if (t % CHECK_EVERY === 0)
        for (const d of this.defs.values())
          if (this.eligible(d)) {
            this.start(d.id)
            if (d.when?.repeat) w.setFact(`seen.${d.id}.day`, w.calendar().day)
            break
          }
      return
    }
    for (let guard = 0; guard < 50; guard++) {
      const s = w.state.scene
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
        w.state.scene = undefined
        return
      }
      this.run(cmd)
      if (!w.state.scene?.waiting && w.state.scene?.until === undefined && w.state.scene) w.state.scene.step++
    }
  }

  private who(id: Id | 'player'): Entity | undefined {
    const w = this.eng.world
    return id === 'player' ? w.player : w.get(id)
  }

  private run(c: SceneCmd): void {
    const eng = this.eng
    const w = eng.world
    const s = w.state.scene!
    if ('say' in c) {
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
      if (e) w.place(e, { on: 'tile', map: c.map, x: c.x, y: c.y })
    } else if ('fact' in c) {
      w.setFact(c.fact, c.value)
    } else if ('topic' in c) {
      const day = w.calendar().day
      w.state.topics = [...(w.state.topics ?? []).filter((x) => x.id !== c.topic), { id: c.topic, day, days: c.days }]
    } else if ('give' in c) {
      w.create(c.give, { on: 'inside', holder: w.state.player })
    } else if ('warp' in c) {
      eng.travel(w.player, { map: c.warp, x: c.x, y: c.y })
    } else if ('prop' in c) {
      ;(w.player.props ??= {})[c.prop] = c.value
    } else if ('status' in c) {
      const e = w.get(c.status)
      if (e && c.remove && e.statuses) delete e.statuses[c.remove]
      if (e && c.add) (e.statuses ??= {})[c.add] = -1
    }
  }

  /** One step of a scripted walk. True when it has arrived (or given up and been placed). */
  private moveStep(): boolean {
    const w = this.eng.world
    const s = w.state.scene!
    const m = s.mover
    if (!m) return true
    const e = w.get(m.who)
    if (!e || e.place.on !== 'tile') return true
    const started = s.started ?? w.state.tick
    if (!m.path.length) return true
    if (w.state.tick - started > MOVE_TIMEOUT) {
      const [x, y] = m.path[m.path.length - 1]
      w.place(e, { on: 'tile', map: e.place.map, x, y })
      return true
    }
    if (w.state.tick < m.next) return false
    const [x, y] = m.path.shift()!
    const dir = (Object.entries(DIRS) as [Dir, [number, number]][]).find(([, [dx, dy]]) => e.place.on === 'tile' && dx === x - e.place.x && dy === y - e.place.y)?.[0]
    if (dir) e.facing = dir
    w.place(e, { on: 'tile', map: e.place.map, x, y })
    m.next = w.state.tick + MOVE_STEP_TICKS
    return m.path.length === 0
  }
}
