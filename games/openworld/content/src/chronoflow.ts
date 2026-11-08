// The Chronoflow Sword's authored technique. Its clock steps independently of world time.
import {
  DIRS, registerModule, weaponOf, type Engine, type Entity, type Id, type Pos,
  type WeaponFx, type WeaponMode, type WeaponTechniqueInput,
} from '@openworld/engine'
import { CHRONOFLOW_SWORD } from './items.ts'

type Point = { x: number; y: number }
type Curve = [Point, Point, Point, Point]
type Element = 'water' | 'lightning' | 'wind' | 'ice' | 'fire' | 'pierce'
type Beam = { id: string; from: Point; to: Point; wall: boolean; phase: 'charge' | 'beam' | 'tail'; progress: number; ended?: number }
type Flight = {
  id: string
  kind: 'piercer' | 'echo' | 'wave'
  origin: Pos
  curve: Curve
  at: number
  life: number
  damage: number
  color: number
  element?: Element
  guide?: Id
  aim?: Point
  from?: Point
  correction: Point
  p: Point
  next: Point
  progress: number
  hits: Set<Id>
  stopped?: boolean
}
type Technique = {
  weapon: Id
  at: Pos
  mode: WeaponMode
  normal: Exclude<WeaponMode, 'beam'>
  aim: Point
  triggerDown: boolean
  pressed: number
  round: number
  echo: number
  rotation: number
  beam?: Beam
  flights: Flight[]
}

const BEAM_CHARGE = 36
const BEAM_OPEN = 5
const BEAM_TAIL = 21
const BEAM_POWER = 200
const WAVE_POWER = 216
const MAX_AIM = 15
const MAX_BEAM = 18
const WAVE_SPEED = 0.54
const ECHO_HOVER = 12
const ECHO_RISE = 5
const STRIKES = [44, 33, 27, 22, 18]
const STRIKE_ANGLES = [-2.6, .37, 2.03, -1.09, 1.24]
const STAGGER = [2, 3, 5, 7, 8]
const ECHO_COLORS = [0, 6, 1, 7, 2, 3, 5]
const COLORS = [0xb77873, 0xc8b57c, 0x85b5b0, 0x839fc3, 0xe4e1d7, 0xac98c1, 0xc89b7b, 0x83ae94]
const ECHO_DAMAGE = { pierce: [8, 9, 10, 10, 10, 9, 8], wave: [9, 10, 10, 10, 10, 10, 9] }
const PATTERNS: { color: number; element?: Element }[][] = [
  [{ color: 3, element: 'water' }, { color: 1, element: 'lightning' }, { color: 4 }, { color: 2 }, { color: 5 }],
  [{ color: 2, element: 'wind' }, { color: 7, element: 'water' }, { color: 4, element: 'ice' }, { color: 3 }, { color: 5 }],
  [{ color: 0, element: 'fire' }, { color: 6 }, { color: 4 }, { color: 1 }, { color: 5 }],
  [{ color: 5, element: 'pierce' }, { color: 4 }, { color: 6 }, { color: 2 }, { color: 7 }],
]

const add = (a: Point, b: Point, scale = 1): Point => ({ x: a.x + b.x * scale, y: a.y + b.y * scale })
const delta = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y })
const length = (v: Point): number => Math.hypot(v.x, v.y)
const distance = (a: Point, b: Point): number => length(delta(a, b))
const mix = (a: Point, b: Point, t: number): Point => add(a, delta(a, b), t)
const angle = (a: Point, b: Point): number => Math.atan2(b.y - a.y, b.x - a.x)
const direction = (radians: number): Point => ({ x: Math.cos(radians), y: Math.sin(radians) })
const clamp = (t: number): number => Math.max(0, Math.min(1, t))

function bezier([a, b, c, d]: Curve, t: number): Point {
  const v = 1 - t
  return {
    x: a.x * v ** 3 + b.x * 3 * v * v * t + c.x * 3 * v * t * t + d.x * t ** 3,
    y: a.y * v ** 3 + b.y * 3 * v * v * t + c.y * 3 * v * t * t + d.y * t ** 3,
  }
}

function nearest(a: Point, b: Point, p: Point): Point {
  const d = delta(a, b), v = delta(a, p)
  return add(a, d, clamp((v.x * d.x + v.y * d.y) / (d.x * d.x + d.y * d.y || 1)))
}

/** Walk the tile boundaries of a continuous ray. Actors pass through the test, solid floors do not. */
function trace(eng: Engine, at: Pos, a: Point, b: Point): { end: Point; wall: boolean } {
  const w = eng.world, d = delta(a, b), sx = Math.sign(d.x), sy = Math.sign(d.y)
  let x = Math.floor(a.x + .5), y = Math.floor(a.y + .5)
  const blocked = (x: number, y: number) => !w.inBounds(at.map, x, y) || w.blocked(at.map, x, y, undefined, at.z)
  const wall = (t: number) => ({ end: mix(a, b, Math.max(0, t - .0001)), wall: true })
  if (blocked(x, y)) return wall(0)
  const tx = sx ? Math.abs(1 / d.x) : Infinity, ty = sy ? Math.abs(1 / d.y) : Infinity
  let u = sx ? (x + sx * .5 - a.x) / d.x : Infinity
  let v = sy ? (y + sy * .5 - a.y) / d.y : Infinity
  while (Math.min(u, v) <= 1) {
    const t = Math.min(u, v)
    if (Math.abs(u - v) < 1e-9) {
      if (blocked(x + sx, y) || blocked(x, y + sy)) return wall(t)
      x += sx; y += sy; u += tx; v += ty
    } else if (u < v) {
      x += sx; u += tx
    } else {
      y += sy; v += ty
    }
    if (blocked(x, y)) return wall(t)
  }
  return { end: b, wall: false }
}

class Chronoflow {
  private now = 0
  private serial = 0
  private readonly states = new Map<Id, Technique>()

  constructor(private readonly eng: Engine) {}

  private weapon(id: Id) {
    const w = this.eng.world
    const actor = w.get(id)
    const sword = actor && weaponOf(w, actor)
    const at = actor && w.posOf(actor)
    return actor && at && sword?.type === CHRONOFLOW_SWORD && !w.hasStatus({ e: id }, 'down')
      && !this.eng.combat.refuses(actor, sword, 'fight')
      ? { actor, sword, at } : undefined
  }

  supports = (actor: Id): boolean => !!this.weapon(actor)
  mode = (actor: Id): WeaponMode => {
    const equipped = this.weapon(actor), state = this.states.get(actor)
    return equipped && state?.weapon === equipped.sword.id ? state.mode : 'pierce'
  }

  private id(): string { return `chronoflow-${++this.serial}` }

  private state(id: Id, weapon: Id, at: Pos, actor: Entity): Technique {
    const old = this.states.get(id)
    if (old && old.weapon === weapon && old.at.map === at.map && old.at.z === at.z) return old
    const [x, y] = DIRS[actor.facing ?? 'down']
    const state: Technique = {
      weapon, at, mode: 'pierce', normal: 'pierce', aim: add(at, { x, y }),
      triggerDown: false, pressed: 0, round: this.now, echo: this.now, rotation: 0, flights: [],
    }
    this.states.set(id, state)
    return state
  }

  input = (id: Id, input: WeaponTechniqueInput): boolean => {
    const equipped = this.weapon(id)
    if (!equipped) return false
    const { actor, sword, at } = equipped
    const state = this.state(id, sword.id, at, actor)
    state.at = at
    if (input.t === 'mode') {
      this.release(state)
      if (input.mode === 'toggleNormal') state.mode = state.normal === 'pierce' ? 'wave' : 'pierce'
      else if (input.mode === 'toggleBeam') state.mode = state.mode === 'beam' ? state.normal : 'beam'
      else state.mode = input.mode
      if (state.mode !== 'beam') state.normal = state.mode
      return true
    }
    const aim = input.aim?.point ?? input.aim
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) state.aim = { x: aim.x, y: aim.y }
    if (input.t !== 'hold') return true
    if (!input.on) this.release(state)
    else if (!state.triggerDown && !this.eng.busy(actor)) {
      state.triggerDown = true
      state.pressed = this.now
      state.beam = undefined
      if (state.mode !== 'beam') this.round(actor, state)
    }
    return true
  }

  clear = (actor: Id): void => { this.states.delete(actor) }

  private release(s: Technique) {
    s.triggerDown = false
    if (s.beam?.phase === 'beam') {
      s.beam.phase = 'tail'
      s.beam.ended = this.now
      s.beam.progress = 0
    } else if (s.beam?.phase === 'charge') s.beam = undefined
  }

  private foes(actor: Entity, at: Pos): Entity[] {
    const w = this.eng.world
    return w.entitiesOnMap(at.map).filter(e => {
      if (e.id === actor.id || e.place.on !== 'tile' || (e.place.z ?? 0) !== (at.z ?? 0)) return false
      if (!w.isAgent(e) || w.allied(actor, e) || this.eng.isProtected(e) || w.prop(e, 'invulnerable') === true) return false
      if (!w.hasTag(e, 'creature') && !w.hasTag(e, 'boss') && !e.ai?.foes?.includes(actor.id)) return false
      return w.num(e, 'hp', w.num(e, 'maxHp')) > 0 && !w.hasStatus({ e: e.id }, 'down')
        && distance(at, e.place) < MAX_BEAM + 3
    })
  }

  private shot(kind: Flight['kind'], origin: Pos, curve: Curve, at: number, life: number, damage: number, color: number): Flight {
    const [p, next] = curve
    return { id: this.id(), kind, origin, curve, at, life, damage, color, p, next, correction: { x: 0, y: 0 }, progress: 0, hits: new Set() }
  }

  private round(actor: Entity, s: Technique) {
    if (this.now < s.round || s.mode === 'beam') return
    const at = s.at
    const theta = angle(at, s.aim)
    const along = direction(theta)
    const end = trace(this.eng, at, at, add(at, along, Math.min(MAX_AIM, distance(at, s.aim)))).end
    const mode = s.mode
    s.round = this.now + (mode === 'pierce' ? 14 : 28)
    if (mode === 'pierce') {
      const pattern = PATTERNS[s.rotation % PATTERNS.length]
      const reverse = s.rotation++ % 2 ? -1 : 1
      pattern.forEach(({ color, element }, i) => {
        const axis = theta * .23 + STRIKE_ANGLES[i] * reverse
        const unit = direction(axis), side = direction(axis + Math.PI / 2)
        const from = trace(this.eng, at, end, add(end, unit, -1.35 - i * .055)).end
        const to = trace(this.eng, at, end, add(end, unit, 1.03)).end
        const bend = (i % 2 ? .17 : -.16) * reverse
        const f = this.shot('piercer', at, [from, add(mix(from, to, .33), side, bend), add(mix(from, to, .67), side, bend), to],
          this.now + STAGGER[i], 8, STRIKES[i], color)
        f.element = element
        s.flights.push(f)
      })
    } else {
      const from = trace(this.eng, at, at, add(at, along, .38)).end
      const to = trace(this.eng, at, from, add(from, along, MAX_AIM)).end
      const life = Math.max(1, Math.ceil(distance(from, to) / WAVE_SPEED))
      s.flights.push(this.shot('wave', at, [from, mix(from, to, 1 / 3), mix(from, to, 2 / 3), to], this.now + 7, life, WAVE_POWER, 4))
    }
    if (this.now < s.echo) return
    s.echo = this.now + (mode === 'pierce' ? 58 : 56)
    const from = trace(this.eng, at, at, add(at, along, .38)).end
    const guide = this.foes(actor, at)
      .map(e => ({ id: e.id, at: this.eng.world.posOf(e)! }))
      .filter(e => distance(e.at, end) <= .8)
      .sort((a, b) => distance(a.at, end) - distance(b.at, end))[0]
    const lateral = direction(theta + Math.PI / 2)
    const reach = distance(from, end)
    ECHO_COLORS.forEach((color, i) => {
      const lane = i - 3, near = lane * .50 + (i === 3 ? .63 : 0)
      const seat = trace(this.eng, at, from, add(add(from, along, .55 + .07 * (3 - Math.abs(lane))), lateral, lane * .29)).end
      const a = add(add(from, along, reach * .36), lateral, lane * Math.min(1.12, .18 + reach * .10))
      const b = add(add(end, along, -Math.min(1.75, reach * .32)), lateral, near)
      // The unsteered arc crosses the aimed point at 86% of its path, then travels beyond it.
      const pass = .86, partial = bezier([seat, a, b, { x: 0, y: 0 }], pass)
      const exit = add({ x: 0, y: 0 }, delta(partial, end), 1 / pass ** 3)
      const f = this.shot('echo', at, [seat, a, b, exit], this.now, 20 + i, ECHO_DAMAGE[mode][i], color)
      f.from = from
      f.p = from
      f.next = seat
      f.aim = end
      f.guide = guide?.id
      s.flights.push(f)
    })
  }

  private hit(actor: Entity, s: Technique, target: Entity, power: number, a: Point, b: Point, element?: Element) {
    const w = this.eng.world
    const before = w.num(target, 'hp', w.num(target, 'maxHp'))
    this.eng.queue({
      kind: 'impulse/strike', host: { e: target.id },
      roles: { actor: { e: actor.id }, source: { e: actor.id }, instrument: { e: s.weapon } },
      params: { power, weaponTechnique: true, edge: 'pierce', element: element && element !== 'pierce' ? element : '', pierce: element === 'pierce' },
      origin: 'player', cause: actor.id,
    })
    this.eng.flush()
    if (w.get(target.id)?.place.on === 'none' || w.num(target, 'hp', before) < before) {
      const impact = nearest(a, b, target.place.on === 'tile' ? target.place : b)
      w.fx.push({ t: 'vfx', fx: 'prism-impact', map: s.at.map, ...impact, angle: angle(a, b) * 180 / Math.PI, who: actor.id })
    }
  }

  private flight(actor: Entity, s: Technique, f: Flight, foes: Entity[], pulsed: Set<Id>): boolean {
    const age = this.now - f.at
    if (age < 0) return true
    const echo = f.kind === 'echo'
    const lead = echo ? ECHO_RISE + ECHO_HOVER : 0
    if (age < lead) {
      f.p = mix(f.from!, f.curve[0], 1 - (1 - clamp(age / ECHO_RISE)) ** 2)
      f.next = f.curve[1]
      f.progress = 0
      return true
    }
    if (f.stopped) return false
    const u = clamp((age - lead) / f.life)
    const q = echo ? u * u * (.79 + .21 * u) : u
    const next = bezier(f.curve, q)
    if (echo && f.guide && f.aim && q >= .13 && q < .76) {
      const tracked = foes.find(e => e.id === f.guide)
      const pos = tracked && this.eng.world.posOf(tracked)
      if (pos) {
        const error = delta(f.correction, delta(f.aim, pos))
        f.correction = add(f.correction, error, Math.min(1, .28 / (length(error) || 1)))
      }
    }
    const steering = clamp((q - .13) / .63)
    const dest = add(next, f.correction, steering * steering * (3 - 2 * steering))
    const segment = trace(this.eng, s.at, f.p, dest)
    const a = f.p, b = segment.end
    f.p = b
    f.next = add(b, delta(a, b))
    if (distance(a, b) < .00001) f.next = bezier(f.curve, clamp(q + .03))
    f.progress = q
    if (!echo || (q >= .69 && !f.hits.size)) {
      for (const e of foes) {
        const repeated = f.hits.has(e.id)
        if (f.kind === 'piercer' ? (pulsed.has(e.id) || (f.hits.size > 0 && !repeated)) : repeated) continue
        const pos = this.eng.world.posOf(e)
        const radius = f.kind === 'wave' ? .72 : .50
        if (!pos || pos.map !== s.at.map || (pos.z ?? 0) !== (s.at.z ?? 0) || distance(nearest(a, b, pos), pos) > radius
          || trace(this.eng, f.origin, f.origin, pos).wall) continue
        if (this.eng.world.num(e, 'hp', this.eng.world.num(e, 'maxHp')) <= 0) continue
        f.hits.add(e.id)
        if (f.kind === 'piercer') pulsed.add(e.id)
        this.hit(actor, s, e, f.damage, a, b, repeated && f.element !== 'pierce' ? undefined : f.element)
        if (f.kind !== 'wave') break
      }
    }
    // Keep the last geometry for the renderer through this step.
    f.stopped = u >= 1 || segment.wall
    return true
  }

  private beamLine(s: Technique, fraction: number, origin = s.at) {
    const axis = direction(angle(origin, s.aim))
    const from = trace(this.eng, origin, origin, add(origin, axis, .39)).end
    const stop = trace(this.eng, origin, from, add(from, axis, MAX_BEAM))
    return { from, to: mix(from, stop.end, fraction), wall: stop.wall && fraction >= 1 }
  }

  private beamStep(actor: Entity, s: Technique, foes: Entity[]) {
    if (!s.triggerDown || s.mode !== 'beam') {
      const b = s.beam
      if (b?.ended !== undefined) {
        b.progress = clamp((this.now - b.ended) / BEAM_TAIL)
        if (b.progress >= 1) s.beam = undefined
      }
      return
    }
    const age = this.now - s.pressed, fire = age >= BEAM_CHARGE
    const open = fire ? 1 - (1 - clamp((age - BEAM_CHARGE + 1) / BEAM_OPEN)) ** 3 : 1
    const line = this.beamLine(s, open)
    s.beam = { id: s.beam?.id ?? this.id(), ...line, phase: fire ? 'beam' : 'charge', progress: fire ? open : age / BEAM_CHARGE }
    if (!fire) return
    for (const e of foes) {
      const pos = this.eng.world.posOf(e)
      if (pos && distance(nearest(line.from, line.to, pos), pos) <= .64 && !trace(this.eng, s.at, s.at, pos).wall) {
        this.hit(actor, s, e, BEAM_POWER, line.from, line.to)
      }
    }
    if (line.wall && (age - BEAM_CHARGE) % 5 === 0) {
      this.eng.world.fx.push({ t: 'vfx', fx: 'prism-wall', map: s.at.map, ...line.to, angle: angle(line.from, line.to) * 180 / Math.PI, who: actor.id })
    }
  }

  step = (): boolean => {
    this.now++
    let active = false
    for (const [id, s] of this.states) {
      const e = this.weapon(id)
      if (!e || e.sword.id !== s.weapon || e.at.map !== s.at.map || e.at.z !== s.at.z
        || e.at.map !== this.eng.activeMap || this.eng.busy(e.actor)) {
        this.states.delete(id)
        continue
      }
      s.at = e.at
      if (s.triggerDown) this.round(e.actor, s)
      if (s.triggerDown || s.beam || s.flights.length) {
        const foes = this.foes(e.actor, s.at), pulsed = new Set<Id>()
        // On an overlap, let a newly arriving blade deliver its one elemental contact first.
        const repeating = (f: Flight) => Number(f.kind === 'piercer' && f.hits.size > 0)
        s.flights.sort((a, b) => repeating(a) - repeating(b))
        s.flights = s.flights.filter(f => this.flight(e.actor, s, f, foes, pulsed))
        this.beamStep(e.actor, s, foes)
      }
      active ||= s.triggerDown || !!s.beam || s.flights.length > 0 || this.now < Math.max(s.round, s.echo)
    }
    return active
  }

  effects = (map: string): WeaponFx[] => {
    const views: WeaponFx[] = []
    for (const [who, s] of this.states) {
      const equipped = this.weapon(who)
      if (s.at.map !== map || !equipped || equipped.sword.id !== s.weapon
        || equipped.at.map !== map || equipped.at.z !== s.at.z) continue
      const z = equipped.at.z
      const view = (id: string, kind: WeaponFx['kind'], a: Point, b: Point, progress: number, color?: number, wall?: boolean) =>
        views.push({ id, who, kind, x: a.x, y: a.y, endX: b.x, endY: b.y, z, progress, color, wall })
      if (s.beam) {
        const b = s.beam
        view(b.id, b.phase, b.from, b.to, b.progress, undefined, b.wall)
      } else if (s.mode === 'beam') {
        const b = this.beamLine(s, 1, equipped.at)
        view(`aim-${who}`, 'aim', b.from, b.to, 0)
      }
      for (const f of s.flights) if (this.now >= f.at) {
        view(f.id, f.kind, f.p, f.next, f.progress, COLORS[f.color])
      }
    }
    return views
  }
}

registerModule({
  id: 'chronoflow',
  install(eng) {
    const sword = new Chronoflow(eng)
    eng.hooks.weaponTechnique = sword
    eng.hooks.frame.push(frame => {
      if (sword.supports(frame.player.id)) frame.weaponTechnique = { mode: sword.mode(frame.player.id) }
      const fx = sword.effects(frame.map)
      if (fx.length) frame.weaponFx = fx
    })
  },
})
