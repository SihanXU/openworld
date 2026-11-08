// Draw authoritative weapon traces in world coordinates. The simulation supplies their geometry and contacts.
import Phaser from 'phaser'
import type { WeaponFx } from '@openworld/engine'
import type { PrismAudio } from '../audio/prism.ts'
import { T } from '../assets/ground.ts'

type Point = { x: number; y: number }
type Pose = { from: Point; to: Point; progress: number }
type TrailPoint = Point & { at: number }
type Trace = {
  sample: WeaponFx
  from: Pose
  to: Pose
  at: number
  duration: number
  trail: TrailPoint[]
}
type Spark = { p: Point; vx: number; vy: number; at: number; life: number; color: number; size: number }

const SPECTRUM = [0xff79c8, 0xc77cff, 0x8b77ff, 0x69a5ff, 0x64d8fd, 0x62efd9, 0xb9f4a0]
const SPARKS = [0xff768e, 0xffac70, 0xf9df81, 0x91efab, 0x83efff, 0x8cb1ff, 0xdd9afa]
const WHITE = 0xfffff4
const AIR = 1e6 + 3
const TAU = Math.PI * 2
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const point = (x: number, y: number, z = 0): Point => ({ x: (x + 0.5) * T, y: (y + 0.5 - z) * T })
const direction = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x)
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const offset = (p: Point, angle: number, along: number, across = 0): Point => {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: p.x + c * along - s * across, y: p.y + s * along + c * across }
}
const mix = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
const lerpColor = (a: number, b: number, u: number) => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - u) + ((b >> shift) & 255) * u)
  return ch(16) << 16 | ch(8) << 8 | ch(0)
}
const hue = (u: number) => {
  const i = Math.min(SPECTRUM.length - 2, Math.floor(u * (SPECTRUM.length - 1)))
  return lerpColor(SPECTRUM[i], SPECTRUM[i + 1], u * (SPECTRUM.length - 1) - i)
}

function path(g: Phaser.GameObjects.Graphics, points: Point[], closed = false): Phaser.GameObjects.Graphics {
  g.beginPath().moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  return closed ? g.closePath() : g
}

function current(t: Trace, now: number): Pose {
  const u = clamp((now - t.at) / t.duration)
  return {
    from: mix(t.from.from, t.to.from, u),
    to: mix(t.from.to, t.to.to, u),
    progress: t.from.progress + (t.to.progress - t.from.progress) * u,
  }
}

export interface WeaponFxStage {
  scene: Phaser.Scene
  mark(graphics: Phaser.GameObjects.Graphics): void
  bladeOf(who: string): { texture: string; frame: string } | undefined
}

export class WeaponFxView {
  audio?: PrismAudio
  private graphics?: Phaser.GameObjects.Graphics
  private traces = new Map<string, Trace>()
  private blades = new Map<string, Phaser.GameObjects.Image>()
  private sparks: Spark[] = []
  private lastBurst = new Map<string, number>()
  private serial = 0
  private readonly still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  constructor(private stage: WeaponFxStage) {}

  sync(samples: WeaponFx[], player: string): void {
    const now = this.stage.scene.time.now
    const seen = new Set<string>()
    let sound: 'beam' | 'charge' | undefined
    let progress = 0
    for (const sample of samples) {
      seen.add(sample.id)
      const to = { from: point(sample.x, sample.y, sample.z), to: point(sample.endX, sample.endY, sample.z), progress: clamp(sample.progress) }
      const prev = this.traces.get(sample.id)
      const from = prev ? current(prev, now) : to
      if (prev?.sample.kind !== sample.kind) from.progress = to.progress
      if (prev?.sample.kind === 'beam' && sample.kind === 'tail') {
        const angle = direction(to.from, to.to) * 180 / Math.PI
        this.impact(sample.endX, sample.endY, sample.z ?? 0, angle, sample.wall === true)
      }
      const duration = prev ? Math.max(14, Math.min(105, now - prev.at)) : 16
      this.traces.set(sample.id, { sample, from, to, at: now, duration, trail: prev?.trail ?? [] })
      if (sample.who === player && (sample.kind === 'charge' || sample.kind === 'beam')) {
        sound = sample.kind
        progress = to.progress
      }
    }
    for (const id of this.traces.keys()) if (!seen.has(id)) this.traces.delete(id)
    this.audio?.sync(sound, progress)
  }

  clear(): void {
    this.traces.clear()
    this.sparks = []
    this.lastBurst.clear()
    for (const blade of this.blades.values()) blade.destroy()
    this.blades.clear()
    this.graphics?.clear()
    this.audio?.sync()
  }

  dispose(): void {
    this.clear()
    this.graphics?.destroy()
    this.graphics = undefined
    this.audio = undefined
  }

  /** Keep the VFX cadence legible when several substep hits arrive in one frame. */
  impact(x: number, y: number, z: number, degrees: number, wall: boolean): void {
    const now = this.stage.scene.time.now
    const key = `${Math.round(x)},${Math.round(y)},${z},${wall}`
    if (now - (this.lastBurst.get(key) ?? -Infinity) < 58) return
    this.lastBurst.set(key, now)
    const origin = point(x, y, z)
    const serial = this.serial++
    const angle = degrees * Math.PI / 180
    const count = this.still ? 5 : wall ? 13 : 9
    for (let i = 0; i < count; i++) {
      const seed = (serial * 47 + i * 13) % 67
      const fan = wall ? Math.PI + 1.33 * ((i + 0.4) / count * 2 - 1) : (i % 2 ? 1 : -1) * (Math.PI / 2 + (seed % 13 - 6) * 0.104)
      const ray = angle + fan + (seed % 5 - 2) * 0.04
      const speed = 0.073 + (seed % 17) * 0.006
      this.sparks.push({
        p: origin, vx: Math.cos(ray) * speed, vy: Math.sin(ray) * speed, at: now,
        life: 185 + (seed % 11) * 15, color: SPARKS[(serial + i) % SPARKS.length], size: 0.85 + (seed % 4) * 0.32,
      })
    }
    if (this.sparks.length > 180) this.sparks.splice(0, this.sparks.length - 180)
  }

  update(now: number): void {
    for (const [id, when] of this.lastBurst) if (now - when > 420) this.lastBurst.delete(id)
    const g = this.graphics ?? (this.traces.size || this.sparks.length ? this.makeGraphics() : undefined)
    if (!g) return
    g.clear()
    const swords = new Set<string>()
    for (const [id, t] of this.traces) {
      const { from, to, progress } = current(t, now)
      const angle = direction(from, to)
      const { kind, who } = t.sample
      if (kind === 'aim' || kind === 'charge' || kind === 'beam' || kind === 'tail') {
        swords.add(id)
        this.drawHand(id, who, from, angle)
        if (kind === 'aim') this.aim(g, from, to)
        else if (kind === 'charge') this.charge(g, from, angle, progress, now)
        else this.beam(g, from, to, now, kind === 'tail' ? progress : 0, t.sample.wall === true)
      } else if (kind === 'wave') this.wave(g, from, angle, progress, now)
      else this.projectile(g, t, from, angle, now)
    }
    for (const [id, blade] of this.blades) if (!swords.has(id)) {
      blade.destroy()
      this.blades.delete(id)
    }
    this.sparks = this.sparks.filter((spark) => now - spark.at < spark.life)
    for (const s of this.sparks) {
      const age = now - s.at, f = age / s.life, travel = age * (1 - 0.42 * f)
      const p = { x: s.p.x + s.vx * travel, y: s.p.y + s.vy * travel + age * age * 0.000042 }
      const tail = 15 + 24 * (1 - f), alpha = (1 - f) ** 1.1
      g.lineStyle(s.size, s.color, alpha).lineBetween(p.x - s.vx * tail, p.y - s.vy * tail, p.x, p.y)
      g.fillStyle(WHITE, alpha * 0.92).fillRect(Math.round(p.x), Math.round(p.y), Math.min(1.4, s.size), 1)
    }
  }

  private makeGraphics(): Phaser.GameObjects.Graphics {
    const g = this.stage.scene.add.graphics().setDepth(AIR).setBlendMode(Phaser.BlendModes.ADD)
    this.stage.mark(g)
    this.graphics = g
    return g
  }

  private drawHand(id: string, who: string, tip: Point, angle: number): void {
    const art = this.stage.bladeOf(who)
    if (!art) {
      this.blades.get(id)?.destroy()
      this.blades.delete(id)
      return
    }
    let blade = this.blades.get(id)
    if (!blade) {
      blade = this.stage.scene.add.image(tip.x, tip.y, art.texture, art.frame).setOrigin(0.5, 0).setDepth(AIR - 4)
      this.blades.set(id, blade)
    }
    if (blade.texture.key !== art.texture || blade.frame.name !== art.frame) blade.setTexture(art.texture, art.frame)
    blade.setScale(Math.min(1, 17 / blade.height)).setPosition(tip.x, tip.y).setRotation(angle + Math.PI / 2)
  }

  private aim(g: Phaser.GameObjects.Graphics, p: Point, end: Point): void {
    const d = dist(p, end), angle = direction(p, end)
    g.lineStyle(0.72, 0xc0aafc, 0.38)
    for (let i = 4; i < d; i += 8) {
      const a = offset(p, angle, i), b = offset(p, angle, Math.min(d, i + 3.5))
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
  }

  private charge(g: Phaser.GameObjects.Graphics, p: Point, angle: number, progress: number, now: number): void {
    const spin = this.still ? 0 : now * 0.0105
    const rx = 7 - 3.2 * progress, ry = 16 - 5.6 * progress
    const ring = Array.from({ length: 25 }, (_, i) => {
      const f = TAU * i / 24
      return offset(p, angle, Math.cos(f) * rx, Math.sin(f) * ry)
    })
    path(g.lineStyle(1.1, 0xe7a4fc, 0.22 + progress * 0.56), ring).strokePath()
    for (let i = 0; i < SPECTRUM.length; i++) {
      const f = spin + TAU * i / SPECTRUM.length
      const x = Math.cos(f) * (rx + 11 * (1 - progress)), y = Math.sin(f) * (ry + 8 * (1 - progress))
      const a = offset(p, angle, x * 0.55, y * 0.55), b = offset(p, angle, x, y)
      g.lineStyle(0.65, SPECTRUM[i], 0.32 + 0.4 * progress).lineBetween(a.x, a.y, b.x, b.y)
      g.fillStyle(SPECTRUM[i], 0.65 + 0.3 * progress).fillRect(b.x, b.y, 1.7, 1.4)
    }
    this.star(g, p, angle, 0xf0a6ff, 0.22 + 0.38 * progress, 0.42 + 0.53 * progress)
  }

  private beam(g: Phaser.GameObjects.Graphics, p: Point, end: Point, now: number, tail: number, wall: boolean): void {
    const d = dist(p, end)
    if (d < 1) return
    const angle = direction(p, end)
    const core = (1 - tail) ** 4.1, aura = (1 - tail) ** 1.35
    const phase = this.still ? 0 : now * 0.016
    const nodes = Array.from({ length: 25 }, (_, i) => {
      const u = i / 24, mask = Math.sin(u * Math.PI)
      return {
        u, x: d * u,
        y: (Math.sin(u * 25 - phase) * 0.88 + Math.sin(u * 52 + phase) * 0.38) * mask,
        width: 0.86 + 0.17 * Math.sin(u * 12 - phase * 0.69) + 0.13 * Math.cos(u * 35 + phase * 0.72),
      }
    })
    for (const [width, alpha] of [[13.4, 0.055], [10.2, 0.10], [8, 0.15], [6.1, 0.23], [4.75, 0.36]]) {
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i], w = width * (0.72 + 0.28 * aura)
        path(g.fillStyle(hue((a.u + b.u) * 0.5), alpha * aura), [
          offset(p, angle, a.x, a.y - a.width * w), offset(p, angle, b.x, b.y - b.width * w),
          offset(p, angle, b.x, b.y + b.width * w), offset(p, angle, a.x, a.y + a.width * w),
        ], true).fillPath()
      }
    }
    for (let i = 0; i < SPECTRUM.length; i++) {
      const side = i - 3
      const strand = nodes.map(({ u, x, y }) =>
        offset(p, angle, x, y + Math.sin(Math.PI * u) * (side * 2.25 + Math.sin(13 * u + phase * (0.86 + i * 0.09) + i * 0.73) * 1.4)))
      path(g.lineStyle(i % 2 ? 0.9 : 0.6, SPECTRUM[i], aura * (0.45 + Math.abs(side) * 0.07)), strand).strokePath()
    }
    for (const [width, color, alpha] of [[3.5, 0xdef1ff, 0.84], [2.1, WHITE, 1]]) {
      const ribbon = nodes.map((n) => offset(p, angle, n.x, n.y - n.width * width * core))
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        ribbon.push(offset(p, angle, n.x, n.y + n.width * width * core))
      }
      path(g.fillStyle(color, alpha * core), ribbon, true).fillPath()
    }
    this.star(g, p, angle, 0xe0a1ff, 0.67, aura)
    this.star(g, end, angle + 0.2, 0xa2ffdf, wall ? 0.61 : 0.28, aura * (wall ? 0.95 : 0.62))
  }

  private star(g: Phaser.GameObjects.Graphics, p: Point, angle: number, tint: number, scale: number, alpha: number): void {
    for (const [r, a] of [[22, 0.08], [15, 0.10], [10, 0.18], [6, 0.22]]) {
      g.fillStyle(tint, alpha * a).fillCircle(p.x, p.y, r * scale)
    }
    const rays = [[0, 16], [-0.53, 17], [-1.24, 23], [-1.67, 24], [-2.35, 16], [-2.99, 11], [0.66, 17], [1.45, 22], [2.21, 13]]
    for (const [ray, length] of rays) {
      const a = angle + ray, tip = offset(p, a, length * scale)
      const left = offset(p, a, 0, 1.5 * scale), right = offset(p, a, 0, -1.5 * scale)
      g.fillStyle(tint, alpha * 0.82).fillTriangle(left.x, left.y, tip.x, tip.y, right.x, right.y)
    }
    g.fillStyle(WHITE, alpha).fillCircle(p.x, p.y, 3.1 * scale)
  }

  private projectile(g: Phaser.GameObjects.Graphics, t: Trace, p: Point, angle: number, now: number): void {
    const echo = t.sample.kind === 'echo'
    const color = t.sample.color ?? (echo ? SPECTRUM[1] : 0xe1f6ff)
    const trail = t.trail
    if (!trail.length || (now - trail[trail.length - 1].at >= 12 && dist(trail[trail.length - 1], p) > 0.55)) trail.push({ ...p, at: now })
    while (trail.length > 11 || (trail.length > 1 && now - trail[0].at > 148)) trail.shift()
    for (let i = 0; i < trail.length; i++) {
      const a = trail[i], b = trail[i + 1] ?? p, f = clamp(1 - (now - a.at) / 148)
      g.lineStyle(1 + 2.4 * f, color, 0.47 * f).lineBetween(a.x, a.y, b.x, b.y)
    }
    const profile = echo ? [[2, 0], [-4.8, -1.8], [-10, -1.3], [-7.8, 0], [-10, 1.3], [-4.8, 1.8]] :
      [[2.5, 0], [-2, -1.35], [-8, -1.3], [-8, -2.55], [-10, -2.55], [-10, -0.82], [-14, -0.82], [-14, 0.82], [-10, 0.82], [-10, 2.55], [-8, 2.55], [-8, 1.3], [-2, 1.35]]
    path(g.fillStyle(color, 0.94), profile.map(([x, y]) => offset(p, angle, x, y)), true).fillPath()
    const a = offset(p, angle, echo ? -6.5 : -7.2), b = offset(p, angle, 1.8)
    g.lineStyle(0.82, WHITE, 0.9).lineBetween(a.x, a.y, b.x, b.y)
  }

  private wave(g: Phaser.GameObjects.Graphics, p: Point, angle: number, progress: number, now: number): void {
    const alpha = 1 - 0.8 * clamp((progress - 0.87) / 0.13)
    const curve = (side: number, spread: number, length: number) => Array.from({ length: 17 }, (_, i) => {
      const u = i / 16
      return offset(p, angle, 1 - u * length, side * spread * Math.sin(u * 2.45) * (0.9 + 0.1 * u))
    })
    for (const side of [-1, 1]) {
      const outside = curve(side, 12.7, 42), inside = curve(side, 6.7, 38).reverse()
      path(g.fillStyle(0xbce8ff, alpha * 0.30), [...outside, ...inside], true).fillPath()
      path(g.lineStyle(2.25, 0xe7f9fa, alpha * 0.91), curve(side, 11.4, 35)).strokePath()
      path(g.lineStyle(0.9, WHITE, alpha * 0.9), curve(side, 9, 26)).strokePath()
    }
    for (let i = 0; i < 5; i++) {
      const strand = Array.from({ length: 13 }, (_, j) => {
        const u = j / 12
        const flow = this.still ? 0 : Math.sin(now * 0.017 + u * 7 + i) * 0.7
        return offset(p, angle, -u * (43 - i * 2), (i - 2) * 3.25 * Math.sin(u * 2.55) + flow * u)
      })
      path(g.lineStyle(0.65, SPECTRUM[i + 1], alpha * 0.75), strand).strokePath()
    }
  }
}
