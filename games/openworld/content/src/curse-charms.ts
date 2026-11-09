import { DIRS, registerModule, type Engine, type EngineHooks, type Entity, type FxEvent, type Pos } from '@openworld/engine'

export const CURSE_CHARMS = [
  {
    id: 'item/valuable/mysterious_finger', name: { en: 'Mysterious Finger', zh: '神秘的手指' },
    sprite: 'item:mysterious_finger', material: 'bone',
    needs: [{ type: 'item/material/bone', count: 2 }, { type: 'item/material/ectoplasm', count: 1 }, { type: 'item/valuable/ancient_ring_shard', count: 1 }],
  },
  {
    id: 'item/valuable/six_eye_shades', name: { en: 'Six-Eye Shades', zh: '六眼墨镜' },
    sprite: 'item:six_eye_shades', material: 'glass',
    needs: [{ type: 'item/misc/mirror', count: 1 }, { type: 'item/gem', count: 2 }, { type: 'item/material/ectoplasm', count: 1 }],
  },
] as const

type Hook = NonNullable<EngineHooks['equipmentGesture']>
type Button = Parameters<Hook['binding']>[0]
type Point = Pick<Pos, 'x' | 'y'>
type Orb = 'blue' | 'red' | 'violet'
type Projectile = Orb | 'sever' | 'flame'
type FieldKind = 'scar-field' | 'still-field'
type Technique = Projectile | FieldKind | 'rend'
type Cast = { kind: Exclude<Technique, 'rend'>; due: number; aim: Point }
type Flight = { kind: Projectile; id: string; from: Pos; to: Point; started: number; steps: number; last: Point; marked: Set<string>; restUntil?: number }
type Motion = { flight: Flight; from: Point; to: Point; done: boolean }
type Field = { kind: FieldKind; id: string; at: Pos; next: number; marked: Map<string, Pos>; fired: boolean }

export const CHARM_STASIS = 'charm-stasis'
export const CHARM_STASIS_TICKS = 12
const RED_REST_TICKS = 21
const FUSION_RADIUS = 3.4
const WINDUP: Record<Cast['kind'], number> = { sever: 1, blue: 2, red: 2, violet: 4, flame: 3, 'scar-field': 3, 'still-field': 3 }
const RECOVERY: Record<Technique, number> = { sever: 3, rend: 1, blue: 5, red: 5, violet: 45, flame: 12, 'scar-field': 0, 'still-field': 0 }
const SPEED: Record<Projectile, number> = { sever: 5, blue: 3.5, red: 2.5, violet: 4, flame: 4.8 }
const WIDTH = { sever: .65, blue: 1.05, violet: 1.32, flame: 2.4 }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const sameFloor = (a: Pos, b: Pos) => a.map === b.map && (a.z ?? 0) === (b.z ?? 0)
const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x)
const along = (from: Point, to: Point, t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
const cell = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) })

/** First overlap of two moving circles over the same simulation interval. */
function contact(a: Motion, b: Motion, radius: number): number | undefined {
  const dx = a.from.x - b.from.x, dy = a.from.y - b.from.y
  const vx = a.to.x - b.to.x - dx, vy = a.to.y - b.to.y - dy
  const gap = dx * dx + dy * dy - radius * radius
  if (gap <= 0) return 0
  const speed = vx * vx + vy * vy, projection = dx * vx + dy * vy
  const discriminant = projection * projection - speed * gap
  if (!speed || projection >= 0 || discriminant < 0) return
  const t = (-projection - Math.sqrt(discriminant)) / speed
  if (t >= 0 && t <= 1) return t
}

class CurseCharms implements Hook {
  private item?: string
  private scope?: Pos
  private blinkMode = false
  private cast?: Cast
  private readonly flights: Flight[] = []
  private field?: Field
  private serial = 0
  private checkedMap?: string

  constructor(private readonly eng: Engine) {}
  private get w() { return this.eng.world }

  private worn() {
    const actor = this.w.player, at = this.w.posOf(actor)
    if (!at || this.w.hasStatus({ e: actor.id }, 'down')) return
    const item = this.w.worn(actor).find(e => CURSE_CHARMS.some(charm => charm.id === e.type))
    if (item) return { actor, at, item, shades: item.type === CURSE_CHARMS[1].id }
  }

  binding(button: Button) {
    const equipped = this.worn()
    if (!equipped || (button === 'mode' && !equipped.shades)) return
    const current = this.item === equipped.item.id && this.scope && sameFloor(this.scope, equipped.at)
    const double = button === 'right' || (button === 'left' && (equipped.shades
      ? !(current && this.blinkMode) : !!current && !!this.scarAt(equipped.at)))
    return { item: equipped.item.id, double, ...(button === 'right' && !equipped.shades && { repeat: true }) }
  }

  clear() {
    for (const flight of this.flights) this.fx('orb-stop', { ...flight.from, ...flight.last }, { instance: flight.id })
    this.flights.length = 0
    this.clearField()
    this.item = undefined
    this.scope = undefined
    this.blinkMode = false
    this.cast = undefined
  }

  private scarAt(at: Pos) {
    const field = this.field
    if (field?.kind === 'scar-field' && sameFloor(field.at, at)) return field
  }

  private clearField() {
    const field = this.field
    if (!field) return
    this.field = undefined
    this.fx('orb-stop', field.at, { instance: field.id })
    for (const [id, at] of field.marked) this.releaseMarker(field, id, at)
  }

  private releaseMarker(field: Field, id: string, at: Pos) {
    this.fx('orb-stop', at, { instance: field.id + ':' + id })
    const ref = { e: id }
    if (this.w.statusBy(ref, CHARM_STASIS) === this.w.player.id) this.stasis(id, 'charm-still-release')
  }

  private stasis(id: string, substance: 'charm-still' | 'charm-still-release') {
    const actor = this.w.player.id
    this.eng.queue({ kind: 'impulse/coat', host: { e: id }, roles: { actor: { e: actor } }, params: { substance }, cause: actor, origin: 'world' })
    this.eng.flush()
  }

  private clearRestoredStasis(map: string) {
    // The domain is transient. Its saved target statuses have no owner instance after a reload.
    this.checkedMap = map
    for (const id of this.w.statusfulOn(map)) {
      if (this.w.statusBy({ e: id }, CHARM_STASIS) === this.w.player.id) this.stasis(id, 'charm-still-release')
    }
  }

  private fx(name: string, at: Pos, detail: Partial<Extract<FxEvent, { t: 'vfx' }>> = {}) {
    this.w.fx.push({ t: 'vfx', fx: 'charm:' + name, map: at.map, x: at.x, y: at.y, z: at.z, ...detail })
  }

  press(button: Button, aim?: Point, double = false) {
    const equipped = this.worn()
    if (!equipped || this.eng.busy(equipped.actor)) return
    const { at, item, actor, shades } = equipped
    const [dx, dy] = DIRS[actor.facing ?? 'down']
    const ahead = { x: at.x + dx * 6, y: at.y + dy * 6 }
    const aimAt = aim && Number.isFinite(aim.x) && Number.isFinite(aim.y) ? aim : ahead
    if (!this.eng.controls.allows('use', { type: item.type, at: button === 'mode' ? at : aimAt })) return
    if (this.item !== item.id || !this.scope || !sameFloor(this.scope, at)) {
      this.clear()
      this.item = item.id
      this.scope = at
    }
    if (button === 'mode') {
      if (!shades) return
      this.blinkMode = !this.blinkMode
      this.fx(this.blinkMode ? 'blink-ready' : 'blink-off', at)
      return
    }
    if (this.blinkMode && button === 'left') return this.blink(actor, at, aimAt)
    const kind: Technique = shades
      ? button === 'left' ? double ? 'violet' : 'blue' : double ? 'still-field' : 'red'
      : button === 'left' ? double ? 'flame' : 'sever' : double ? 'scar-field' : 'rend'
    if (kind === 'scar-field' || kind === 'still-field') {
      if (this.field?.kind === kind) {
        this.clearField()
        if (this.cast?.kind === 'flame') this.cast = undefined
        return
      }
      if (this.cast?.kind === kind) { this.cast = undefined; return }
    }
    if (!this.eng.ready('charm:' + kind)) return
    if (kind === 'rend') {
      this.eng.controls.face({ ...at, ...aimAt })
      this.eng.setCooldown('charm:rend', RECOVERY.rend)
      this.rend(actor, at, aimAt)
      return
    }
    if (this.cast || (kind === 'flame' && this.scarAt(at)?.fired !== false)) return
    const delay = WINDUP[kind]
    const target = (kind === 'violet' || kind === 'flame' || kind === 'sever') && distance(at, aimAt) === 0 ? ahead : aimAt
    this.eng.controls.face({ ...at, ...target })
    this.cast = { kind, due: this.w.state.tick + delay, aim: target }
    if (RECOVERY[kind]) this.eng.setCooldown('charm:' + kind, RECOVERY[kind])
    this.fx('wind-' + kind, at, { angle: angle(at, target), durationMs: delay * 100, who: actor.id })
  }

  private move(actor: Entity, at: Pos) {
    this.eng.queue({ kind: 'impulse/push', host: { e: actor.id }, roles: {}, params: { map: at.map, x: at.x, y: at.y, ...(at.z !== undefined && { z: at.z }) }, origin: 'world' })
    this.eng.flush()
  }

  private blink(actor: Entity, at: Pos, aim: Point) {
    const to = cell(aim)
    const span = distance(at, to)
    if (!span || span > 7 || !this.eng.ready('charm:blink') || !this.eng.controls.allows('move')) return
    if (!this.w.inBounds(at.map, to.x, to.y) || !this.w.fits(actor, at.map, to.x, to.y, at.z) || !this.clearPath(at, to)) return
    this.eng.setCooldown('charm:blink', 8)
    this.move(actor, { ...at, ...to })
    this.fx('blink', at, { angle: angle(at, to), span })
    this.fx('blink-land', { ...at, ...to })
  }

  /** End at the first solid tile. Sampling at a quarter tile also checks both sides of a grid corner. */
  private clip(from: Pos, to: Point, range: number): Point {
    const length = distance(from, to)
    const end = along(from, to, Math.min(1, range / (length || 1)))
    const steps = Math.max(1, Math.ceil(distance(from, end) * 4))
    const solid = (p: Point) => !this.w.inBounds(from.map, p.x, p.y) || this.w.blocked(from.map, p.x, p.y, undefined, from.z)
    let last: Point = from
    for (let i = 1; i <= steps; i++) {
      const p = along(from, end, i / steps), a = cell(last), b = cell(p)
      if (solid(b) || (a.x !== b.x && a.y !== b.y && (solid({ x: a.x, y: b.y }) || solid({ x: b.x, y: a.y })))) break
      last = p
    }
    return last
  }

  private clearPath(from: Pos, to: Point): boolean {
    return distance(this.clip(from, to, distance(from, to)), to) < .01
  }

  private foes(actor: Entity, at: Pos, center: Point, radius: number) {
    const w = this.w
    return w.entitiesOnMap(at.map).flatMap(e => {
      const to = w.posOf(e)
      if (e.id === actor.id || e.place.on !== 'tile' || !to || !sameFloor(at, to) || distance(center, to) > radius
        || w.allied(actor, e) || w.hasTag(e, 'livestock') || this.eng.isProtected(e) || w.prop(e, 'invulnerable') === true
        || (!w.hasTag(e, 'creature') && !w.hasTag(e, 'boss') && !e.ai?.foes?.includes(actor.id))
        || w.num(e, 'hp', w.num(e, 'maxHp')) <= 0 || w.hasStatus({ e: e.id }, 'down')) return []
      return [{ e, at: to }]
    })
  }

  private ray(actor: Entity, scope: Pos, from: Point, to: Point, width: number) {
    const dx = to.x - from.x, dy = to.y - from.y, square = dx * dx + dy * dy
    return this.foes(actor, scope, from, Math.sqrt(square) + width).flatMap(foe => {
      const t = square ? ((foe.at.x - from.x) * dx + (foe.at.y - from.y) * dy) / square : 0
      const near = along(from, to, Math.max(0, Math.min(1, t)))
      if (t < 0 || distance(foe.at, near) > width || !this.clearPath({ ...scope, ...near }, foe.at)) return []
      return [{ ...foe, t }]
    }).sort((a, b) => a.t - b.t || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0))
  }

  private shove(foe: Entity, at: Pos, toward: Point, amount: number) {
    const theta = angle(at, toward)
    const dx = Math.round(Math.cos(theta)), dy = Math.round(Math.sin(theta))
    const sign = Math.sign(amount)
    let to = at
    for (let i = 1; i <= Math.abs(amount); i++) {
      const next = { ...at, x: at.x + dx * i * sign, y: at.y + dy * i * sign }
      if (sign > 0 && distance(next, toward) >= distance(to, toward)) break
      if (!this.w.fits(foe, next.map, next.x, next.y, next.z) || distance(to, this.clip(to, next, 2)) < distance(to, next) - .01) break
      to = next
    }
    if (to !== at) this.move(foe, to)
  }

  private strike(actor: Entity, foe: Entity, power: number, pierce = false) {
    this.eng.queue({ kind: 'impulse/strike', host: { e: foe.id }, roles: { actor: { e: actor.id } },
      params: { charmStrike: true, power, pierce }, cause: actor.id, origin: 'world' })
    this.eng.flush()
  }

  private rend(actor: Entity, from: Pos, aim: Point) {
    const target = cell(aim)
    if (!this.w.inBounds(from.map, target.x, target.y)) return
    const at = { ...from, ...aim }
    const heading = angle(from, at)
    this.fx('rend', at, { angle: heading, span: 1.15 })
    for (const foe of this.foes(actor, at, at, 1.15)) {
      if (!this.clearPath(at, foe.at)) continue
      this.strike(actor, foe.e, 17)
      this.fx('rend-hit', foe.at, { angle: heading, who: foe.e.id })
    }
  }

  private startCast(at: Pos, cast: Cast) {
    const { kind, aim } = cast
    if (kind === 'scar-field' || kind === 'still-field') {
      this.clearField()
      const id = 'charm-field-' + ++this.serial
      this.field = { kind, id, at, next: this.w.state.tick, marked: new Map(), fired: false }
      this.fx(kind, at, { instance: id })
      return
    }
    const map = this.w.map(at.map)
    if (!map) return
    if (kind === 'flame') {
      const field = this.scarAt(at)
      if (!field || field.fired) return
      field.fired = true
    }
    const range = kind === 'violet' || kind === 'sever' ? Math.hypot(map.width, map.height) + 1 : kind === 'flame' ? 20 : 10
    const heading = angle(at, aim)
    const target = kind === 'violet' || kind === 'flame' ? { x: at.x + Math.cos(heading) * range, y: at.y + Math.sin(heading) * range } : aim
    const to = this.clip(at, target, range), span = distance(at, to)
    const steps = Math.max(1, Math.ceil(span / SPEED[kind])), id = 'charm-shot-' + ++this.serial
    this.flights.push({ kind, id, from: at, to, started: this.w.state.tick, steps, last: at, marked: new Set() })
    this.fx(kind === 'sever' || kind === 'flame' ? kind : 'orb-' + kind, at, { instance: id, angle: heading, span, durationMs: steps * 100 })
  }

  private stopFlight(flight: Flight, at: Pos) {
    this.flights.splice(this.flights.indexOf(flight), 1)
    this.fx('orb-stop', at, { instance: flight.id })
  }

  private lethal(actor: Entity, foe: Entity) {
    this.strike(actor, foe, this.w.num(foe, 'hp', this.w.num(foe, 'maxHp')), true)
  }

  private landOrb(actor: Entity, flight: Flight, at: Pos) {
    const pull = flight.kind === 'red'
    this.fx('land-' + flight.kind, at)
    for (const foe of this.foes(actor, at, at, 2.7)) {
      if (!this.clearPath(at, foe.at)) continue
      this.strike(actor, foe.e, pull ? 26 : 34)
      const center = pull ? at : flight.from
      this.fx('orb-hit-' + flight.kind, foe.at, { angle: angle(center, foe.at), who: foe.e.id })
      if (!this.w.get(foe.e.id) || this.w.num(foe.e, 'hp', this.w.num(foe.e, 'maxHp')) <= 0) continue
      this.shove(foe.e, foe.at, center, pull ? 2 : -3)
    }
  }

  private fuse(actor: Entity, blue: Flight, red: Flight, at: Pos) {
    this.stopFlight(blue, at)
    this.stopFlight(red, at)
    this.fx('violet-fusion', at, { span: FUSION_RADIUS })
    for (const foe of this.foes(actor, at, at, FUSION_RADIUS)) {
      if (!this.clearPath(at, foe.at)) continue
      this.lethal(actor, foe.e)
      this.fx('orb-hit-violet', foe.at, { angle: angle(at, foe.at), who: foe.e.id })
    }
  }

  private stepFlights(actor: Entity) {
    const now = this.w.state.tick
    const motions = this.flights.flatMap((flight): Motion[] => {
      if (flight.restUntil !== undefined) {
        if (now >= flight.restUntil) return []
        return [{ flight, from: flight.to, to: flight.to, done: false }]
      }
      const progress = Math.min(1, (now - flight.started) / flight.steps)
      return progress > 0 ? [{ flight, from: flight.last, to: along(flight.from, flight.to, progress), done: progress === 1 }] : []
    })
    for (const flight of [...this.flights]) {
      if (flight.restUntil !== undefined && now >= flight.restUntil) this.stopFlight(flight, { ...flight.from, ...flight.to })
    }

    const blues = motions.filter(m => m.flight.kind === 'blue')
    const reds = motions.filter(m => m.flight.kind === 'red')
    for (const blue of blues) {
      const firstHit = this.ray(actor, blue.flight.from, blue.from, blue.to, WIDTH.blue)[0]
      const collisions = reds.flatMap(red => {
        if (!this.flights.includes(red.flight)) return []
        const t = contact(blue, red, 1.1)
        if (t === undefined || (firstHit && t > firstHit.t)) return []
        const b = along(blue.from, blue.to, t), r = along(red.from, red.to, t)
        if (!this.clearPath({ ...blue.flight.from, ...b }, r)) return []
        return [{ red, at: { ...red.flight.from, ...r }, t }]
      }).sort((a, b) => a.t - b.t)
      const hit = collisions[0]
      if (hit) this.fuse(actor, blue.flight, hit.red.flight, hit.at)
      else if (firstHit || blue.done) {
        const at = { ...blue.flight.from, ...(firstHit?.at ?? blue.to) }
        this.stopFlight(blue.flight, at)
        this.landOrb(actor, blue.flight, at)
      }
    }
    for (const motion of motions) {
      const { flight, to, done } = motion
      if (!this.flights.includes(flight)) continue
      flight.last = to
      if (flight.kind === 'blue' || flight.restUntil !== undefined) continue
      if (flight.kind === 'red') {
        if (!done) continue
        const at = { ...flight.from, ...to }
        this.fx('orb-stop', at, { instance: flight.id })
        this.landOrb(actor, flight, at)
        flight.restUntil = now + RED_REST_TICKS
        this.fx('orb-red-rest', at, { instance: flight.id, durationMs: RED_REST_TICKS * 100 })
        continue
      }
      this.stepPiercing(actor, motion)
    }
  }

  private stepPiercing(actor: Entity, motion: Motion) {
    const { flight, from, to, done } = motion
    const { kind, marked } = flight
    if (kind === 'red' || kind === 'blue') return
    const heading = angle(flight.from, flight.to)
    const hits = this.ray(actor, flight.from, from, to, WIDTH[kind])
    const at = { ...flight.from, ...to }
    if (done && kind === 'sever') {
      for (const foe of this.foes(actor, at, at, 1.15)) {
        if (this.clearPath(flight.from, foe.at) && this.clearPath(at, foe.at)) hits.push({ ...foe, t: 1 })
      }
    }
    for (const foe of hits) {
      if (marked.has(foe.e.id)) continue
      marked.add(foe.e.id)
      if (kind === 'sever') this.strike(actor, foe.e, 41)
      else this.lethal(actor, foe.e)
      this.fx(kind === 'violet' ? 'orb-hit-violet' : kind + '-hit', foe.at, { angle: heading, who: foe.e.id })
    }
    if (!done) return
    this.stopFlight(flight, at)
    if (kind !== 'flame') this.fx(kind === 'sever' ? 'sever-end' : 'violet-fade', at, { angle: heading })
  }

  private stepField(actor: Entity, field: Field) {
    const now = this.w.state.tick
    if (now < field.next) return
    const foes = this.foes(actor, field.at, field.at, Infinity)
    if (field.kind === 'scar-field') {
      field.next = now + 4
      for (const foe of foes) {
        const power = Math.max(29, Math.ceil(this.w.num(foe.e, 'maxHp', 1) * .35))
        this.strike(actor, foe.e, power, true)
        this.fx('field-cut-hit', foe.at, { angle: (now % 7) * .9 + angle(field.at, foe.at), who: foe.e.id })
      }
      return
    }

    field.next = now + 5
    const active = new Set(foes.map(f => f.e.id))
    for (const [id, at] of field.marked) {
      if (active.has(id)) continue
      this.releaseMarker(field, id, at)
      field.marked.delete(id)
    }
    for (const foe of foes) {
      const id = foe.e.id
      // Lease a separate status so reloads cannot leave a permanent stun or erase another attack's stun.
      if ((foe.e.statuses?.[CHARM_STASIS] ?? -1) <= now + 5) this.stasis(id, 'charm-still')
      if (field.marked.has(id) || !this.w.hasStatus({ e: id }, CHARM_STASIS)) continue
      field.marked.set(id, foe.at)
      this.fx('still-hit', foe.at, { who: id, instance: field.id + ':' + id })
    }
  }

  step(active: string) {
    if (this.checkedMap !== active) this.clearRestoredStasis(active)
    if (!this.item || !this.scope) return
    const equipped = this.worn()
    if (!equipped || equipped.item.id !== this.item || !sameFloor(this.scope, equipped.at)) return this.clear()
    if (this.cast && this.w.state.tick >= this.cast.due) {
      const cast = this.cast
      this.cast = undefined
      if (!this.eng.busy(equipped.actor) && this.eng.controls.allows('use', { type: equipped.item.type, at: cast.aim })) this.startCast(equipped.at, cast)
    }
    if (this.flights.length) this.stepFlights(equipped.actor)
    if (this.field) this.stepField(equipped.actor, this.field)
  }
}

registerModule({
  id: 'curse-charms',
  install(eng) {
    const charms = new CurseCharms(eng)
    eng.hooks.equipmentGesture = charms
    eng.hooks.tick.push({ phase: 'behaviour', run: active => charms.step(active) })
    eng.hooks.enterMap.push(() => charms.clear())
  },
})
