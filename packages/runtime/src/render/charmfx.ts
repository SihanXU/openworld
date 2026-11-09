import Phaser from 'phaser'
import type { FxEvent } from '@openworld/engine'
import { T } from '../assets/ground.ts'

type Cue = Extract<FxEvent, { t: 'vfx' }>
type Graphics = Phaser.GameObjects.Graphics
type Color = { body: number; light: number; shade: number }
const BLUE = { body: 0x64a8fb, light: 0xd9faff, shade: 0x233668 }
const RED = { body: 0xf45162, light: 0xffd4ba, shade: 0x591d40 }
const VIOLET = { body: 0xb64fff, light: 0xf8eaff, shade: 0x6b28cd }
const EDGE = { body: 0xdbe8f7, light: 0xffffff, shade: 0x6d859d }
const FIRE = { body: 0xff741d, light: 0xfff3bf, shade: 0xa02c1e }
const TAU = Math.PI * 2
const fade = (p: number, from: number): number => Math.min(1, (1 - p) / (1 - from))
const ease = (p: number): number => 1 - (1 - p) ** 3
const palette = (kind: string): Color => kind.includes('violet') ? VIOLET
  : kind.includes('still') || kind.includes('blue') || kind.includes('blink') ? BLUE
  : kind.includes('flame') ? FIRE
  : kind.includes('red') || kind.includes('scar') ? RED : EDGE

export class CharmFx {
  private readonly playing = new Map<Graphics, () => void>()
  private readonly instances = new Map<string, () => void>()
  private readonly clocks = new Set<Phaser.Tweens.Tween>()
  private paused = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sfx: (name: string, volume: number, rate?: number) => void,
    private readonly position: (id: string) => { x: number; y: number } | undefined,
  ) {}

  clear(): void { for (const finish of this.playing.values()) finish() }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    for (const tween of this.clocks) paused ? tween.pause() : tween.resume()
  }

  private animate(duration: number, depth: number, draw: (g: Graphics, p: number) => void, instance?: string, loop = false): void {
    if (instance) this.instances.get(instance)?.()
    const g = this.scene.add.graphics().setDepth(depth)
    if (depth > 0) g.setBlendMode(Phaser.BlendModes.ADD)
    const progress = { value: 0 }
    let tween: Phaser.Tweens.Tween
    const finish = () => {
      this.scene.tweens.killTweensOf(progress)
      this.clocks.delete(tween)
      this.playing.delete(g)
      if (instance) this.instances.delete(instance)
      g.destroy()
    }
    this.playing.set(g, finish)
    if (instance) this.instances.set(instance, finish)
    draw(g, 0)
    tween = this.scene.tweens.add({
      targets: progress, value: 1, duration, paused: this.paused, repeat: loop ? -1 : 0,
      onUpdate: () => { g.clear(); draw(g, progress.value) }, onComplete: finish,
    })
    this.clocks.add(tween)
  }

  play(fx: Cue, lift: number): void {
    const kind = fx.fx.slice('charm:'.length), look = palette(kind)
    const followsBody = kind.startsWith('wind-') || kind.startsWith('orb-hit-') || kind !== 'still-hit' && kind.endsWith('-hit')
    const body = followsBody && fx.who ? this.position(fx.who) : undefined
    const x = body?.x ?? fx.x * T + T / 2, y = body ? body.y - T / 2 : fx.y * T + T / 2 - lift
    const a = fx.angle ?? 0, span = (fx.span ?? 0) * T
    if (kind === 'orb-stop') { if (fx.instance) this.instances.get(fx.instance)?.(); return }
    if (kind.startsWith('wind-')) {
      this.sfx(kind.includes('violet') || kind === 'wind-flame' ? 'cast' : 'wind', .24, kind.includes('field') || kind === 'wind-flame' ? .65 : .98)
      this.charge(kind, look, x, y, a, fx.durationMs ?? 200)
    } else if (kind === 'sever') {
      this.sfx('attack', .48, 1.15)
      this.sever(x, y, a, span, fx.durationMs ?? 250, fx.instance)
    } else if (kind === 'sever-end' || kind === 'sever-hit') {
      if (kind === 'sever-hit') this.sfx('hit', .22, 1.2)
      this.severMark(x, y, a, kind === 'sever-hit')
    } else if (kind === 'rend' || kind === 'rend-hit' || kind === 'field-cut-hit') {
      if (kind === 'rend') this.sfx('attack', .23, 1.32)
      this.baSplinters(x, y, a, kind)
    } else if (kind === 'flame') {
      this.sfx('explosion', .65, .7)
      this.sfx('wind', .34, .65)
      this.flame(x, y, a, span, fx.durationMs ?? 600, fx.instance)
      this.scene.cameras.main.shake(220, .0031)
    } else if (kind === 'flame-hit') {
      this.impact('land-flame', FIRE, x, y, a)
    } else if (kind === 'orb-red-rest') {
      this.orb(RED, x, y, a, 0, fx.durationMs ?? 2100, fx.instance)
    } else if (kind === 'violet-fade') {
      this.violetFade(x, y, a)
    } else if (kind === 'violet-fusion') {
      this.sfx('explosion', .75, .86)
      this.sfx('cast', .32, 1.34)
      this.violetFusion(x, y, span || 3.4 * T)
      this.scene.cameras.main.shake(190, .004)
    } else if (kind.startsWith('orb-') && !kind.includes('hit')) {
      this.sfx('cast', kind === 'orb-violet' ? .53 : .34, kind === 'orb-red' ? .72 : 1.08)
      this.orb(look, x, y, a, span, fx.durationMs ?? 300, fx.instance)
    } else if (kind.endsWith('-field')) {
      this.sfx(kind === 'scar-field' ? 'impact' : 'thunder', .46, .68)
      this.domain(kind, x, y, fx.durationMs, fx.instance)
      this.scene.cameras.main.shake(150, .0021)
    } else if (kind === 'blink') {
      this.sfx('wind', .39, 1.18)
      this.animate(210, 1e6, (g, p) => {
        const from = ease(p) * span
        g.lineStyle(5, BLUE.body, (1 - p) * .24).lineBetween(x + Math.cos(a) * from, y + Math.sin(a) * from, x + Math.cos(a) * span, y + Math.sin(a) * span)
        for (let i = 0; i < 6; i++) {
          const d = span * (i / 6 + p / 7)
          g.fillStyle(BLUE.light, (1 - p) * .56).fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4)
        }
      })
    } else if (kind === 'still-hit') {
      const loop = !!fx.instance && fx.durationMs === undefined
      this.animate(fx.durationMs ?? (loop ? 1550 : 6400), 1e6, (g, p) => {
        const view = fx.who && this.position(fx.who)
        if (fx.who && !view) return
        const cx = view ? view.x : x, cy = view ? view.y - 4 : y
        const alpha = (loop ? 1 : fade(p, .94)) * (.61 + Math.sin(p * TAU) * .13)
        g.lineStyle(1.1, BLUE.body, alpha).strokeEllipse(cx, cy, 20, 8)
        for (let i = 0; i < 3; i++) {
          const theta = p * TAU * 2 + i * TAU / 3
          const mx = cx + Math.cos(theta) * 10, my = cy + Math.sin(theta) * 4
          g.fillStyle(BLUE.light, alpha).fillTriangle(mx, my - 2, mx + 1.5, my + 1, mx - 1.5, my + 1)
        }
      }, fx.instance, loop)
    } else {
      if (kind.startsWith('land-')) {
        this.sfx(kind === 'land-violet' ? 'explosion' : 'impact', .48, kind === 'land-red' ? .75 : .94)
        if (kind === 'land-violet') this.scene.cameras.main.shake(160, .0029)
      } else if (kind === 'orb-hit-violet') this.sfx('hit', .17, .88)
      this.impact(kind, look, x, y, a)
    }
  }

  private charge(kind: string, look: Color, x: number, y: number, a: number, duration: number): void {
    const violet = kind === 'wind-violet', flame = kind === 'wind-flame'
    const orb = violet || kind.endsWith('-red') || kind.endsWith('-blue')
    const cx = x + Math.cos(a) * (orb || flame ? 10 : 0), cy = y + Math.sin(a) * (orb || flame ? 10 : 0) - 4
    this.animate(duration, 1e6, (g, p) => {
      const d = (violet ? 29 : flame ? 31 : 16) * (1 - .82 * ease(p))
      for (let i = 0; i < (violet ? 2 : 6); i++) {
        const q = a + i * (violet ? Math.PI : TAU / 6) + p * (violet ? 6.2 : 3)
        const color = violet ? i ? RED : BLUE : look
        for (let j = 4; j >= 0; j--) {
          const b = q - j * .19, r = d + j * 1.5
          g.fillStyle(j ? color.body : color.light, (1 - j / 5) * (.64 + p * .34))
            .fillCircle(cx + Math.cos(b) * r, cy + Math.sin(b) * r * .75, Math.max(.65, (violet ? 3.3 : 1.7) - j * .48))
        }
      }
      if (orb || flame) {
        g.fillStyle(look.body, p * .18).fillCircle(cx, cy, 6 + (violet || flame ? 9 : 6) * p)
        g.fillStyle(look.light, p ** 3).fillCircle(cx, cy, 1 + p * (flame ? 6 : 4))
      }
      if (flame) {
        const lead = 4 + p * 18, wing = 8 + 6 * p
        const dx = Math.cos(a), dy = Math.sin(a)
        const tipX = cx + dx * lead, tipY = cy + dy * lead
        g.fillStyle(FIRE.body, .75 * p).fillTriangle(tipX, tipY, cx - dy * wing, cy + dx * wing, cx + dy * wing, cy - dx * wing)
        g.fillStyle(FIRE.light, p ** 2).fillTriangle(tipX, tipY, cx - dy * 3, cy + dx * 3, cx + dy * 3, cy - dx * 3)
      }
    })
  }

  /** A filled, tapered blade with a crisp white edge. Its two tips close rather than bloom. */
  private edge(g: Graphics, x: number, y: number, a: number, half: number, bend: number, thickness: number, alpha: number): void {
    const dx = Math.cos(a), dy = Math.sin(a)
    let px = x - dx * half, py = y - dy * half, bx = px, by = py
    for (let i = 1; i <= 9; i++) {
      const u = i / 9, t = u * 2 - 1, curve = (1 - t * t) * bend
      const thick = Math.sin(u * Math.PI) ** .78 * thickness
      const qx = x + dx * half * t - dy * curve, qy = y + dy * half * t + dx * curve
      const tx = qx + dy * thick, ty = qy - dx * thick
      g.fillStyle(EDGE.body, alpha * .72).fillTriangle(px, py, bx, by, qx, qy).fillTriangle(bx, by, tx, ty, qx, qy)
      g.lineStyle(Math.max(.52, thick * .33), EDGE.light, alpha).lineBetween(px, py, qx, qy)
      px = qx; py = qy; bx = tx; by = ty
    }
  }

  private sever(x: number, y: number, a: number, span: number, duration: number, id?: string): void {
    this.animate(duration, 1e6, (g, p) => {
      const dx = Math.cos(a), dy = Math.sin(a), blade = a - Math.PI / 2 + .42
      const head = span * p, trace = Math.min(head, 29)
      if (trace > 2) {
        const px = x + dx * head, py = y - 3 + dy * head
        g.lineStyle(1.25, EDGE.body, fade(p, .93) * .62)
          .lineBetween(px - dx * 4, py - dy * 4, px - dx * trace, py - dy * trace)
      }
      for (let i = 2; i >= 0; i--) {
        const t = p - i * .12
        if (t < 0) continue
        const along = span * t, scale = (1 - i * .16) * (.9 + .1 * ease(p))
        const alpha = fade(p, .95) * (i ? .29 / i : 1)
        const bx = x + dx * along, by = y + dy * along - 3
        this.edge(g, bx, by, blade, 22 * scale, 10 * scale, 6 * scale, alpha)
        if (!i) this.edge(g, bx - dx * 6, by - dy * 6, blade + .16, 14, 4, 1.7, alpha * .58)
      }
    }, id)
  }

  private severMark(x: number, y: number, a: number, impact: boolean): void {
    this.animate(impact ? 248 : 330, 1e6, (g, p) => {
      const alpha = fade(p, .34), stretch = .62 + ease(Math.min(1, p * 4)) * .38
      this.edge(g, x, y - 3, a + .7, (impact ? 17 : 20) * stretch, 4, 3.3, alpha)
      this.edge(g, x, y - 3, a - .66, (impact ? 12 : 16) * stretch, -3.1, 2.4, alpha * .82)
      if (p < .24) {
        const spark = 1 - p / .24
        g.fillStyle(EDGE.light, spark * .86).fillCircle(x, y - 3, impact ? 3.2 : 2.6)
      }
    })
  }

  /** Ba leaves several separate pin-thin fractures. The pieces never form a continuous blade. */
  private baSplinters(x: number, y: number, a: number, kind: string): void {
    const field = kind === 'field-cut-hit', atCursor = kind === 'rend'
    const phase = Math.sin(x * .347 + y * .219) * 1.28
    this.animate(field ? 240 : atCursor ? 230 : 182, 1e6, (g, p) => {
      for (let i = 0; i < (atCursor ? 9 : 7); i++) {
        const delay = (i % 3) * .081
        if (p < delay) continue
        const age = (p - delay) / (1 - delay), alpha = fade(age, .34)
        const offset = i * 2.39996 + phase
        const spread = 3 + i % 4 * (atCursor ? 2.5 : 1.8) + ease(age) * 4.5
        const sx = x + Math.cos(offset) * spread, sy = y - 3 + Math.sin(offset) * spread * .74
        const theta = a + phase + (i % 2 ? -.7 : .53) + (i % 3 - 1) * .34
        const dx = Math.cos(theta), dy = Math.sin(theta)
        const span = (3.5 + i % 4 * 1.45) * (.86 + ease(Math.min(1, age * 3)) * .14)
        const weight = i % 3 === 0 ? 1.15 : .74
        const glow = alpha * (kind === 'rend-hit' ? .76 : .98)
        g.fillStyle(EDGE.light, glow)
          .fillTriangle(sx - dx * span, sy - dy * span, sx + dy * weight, sy - dx * weight, sx + dx * span * .42, sy + dy * span * .42)
        g.lineStyle(i % 3 === 0 ? 1.3 : .96, EDGE.light, glow)
          .lineBetween(sx - dx * span * .82, sy - dy * span * .82, sx + dx * span * .36, sy + dy * span * .36)
        const tip = span * .76
        g.lineStyle(.76, EDGE.body, alpha * .77)
          .lineBetween(sx + dx * tip, sy + dy * tip, sx + dx * (tip + 2.6), sy + dy * (tip + 2.6))
      }
    })
  }

  private flame(x: number, y: number, a: number, span: number, duration: number, id?: string): void {
    this.animate(duration, 1e6, (g, p) => {
      const dx = Math.cos(a), dy = Math.sin(a), advance = p * span
      const alpha = fade(p, .84), width = 10 + 25 * ease(Math.min(1, p * 3.4))
      const point = (front: number, side: number) => [x + dx * front - dy * side, y - 4 + dy * front + dx * side] as const
      for (let i = 0; i < 13; i++) {
        const lane = (i - 6) / 6
        const churning = Math.sin(i * 2.34 + p * 26)
        const head = advance - Math.abs(lane) ** 1.6 * 20 + churning * 6
        const tail = Math.max(0, head - (29 + (1 - Math.abs(lane)) * 38) * (.6 + .4 * ease(p)))
        if (head <= tail) continue
        const side = lane * width, band = (1 - Math.abs(lane) * .55) * 13
        const nose = point(head, side * .81), base = point(tail, side - churning * 6)
        const midA = point(head * .6 + tail * .4, side - band), midB = point(head * .71 + tail * .29, side + band)
        g.fillStyle(FIRE.shade, .37 * alpha).fillTriangle(...base, ...midA, ...nose).fillTriangle(...base, ...midB, ...nose)
        g.fillStyle(FIRE.body, .58 * alpha).fillTriangle(...point(tail + (head - tail) * .15, side), ...point((head + tail) / 2, side - band * .68), ...nose)
        if (Math.abs(lane) < .83) {
          g.fillStyle(i % 2 ? FIRE.light : 0xffad3d, alpha * (1 - Math.abs(lane) * .49))
            .fillTriangle(...point(head - (head - tail) * .68, side), ...point(head - (head - tail) * .24, side + band * .43), ...nose)
        }
        const ember = point(tail * .76 + head * .24, side + churning * 11)
        g.lineStyle(1.4, 0xffad4f, .67 * alpha).lineBetween(...ember, ...point(tail - 5, side + churning * 14))
      }
      const front = point(advance, 0)
      g.lineStyle(1.8, FIRE.light, alpha * .72).strokeEllipse(...front, Math.abs(dx) * 12 + Math.abs(dy) * width * 1.4, Math.abs(dy) * 12 + Math.abs(dx) * width * 1.4)
    }, id)
  }

  private orb(look: Color, x: number, y: number, a: number, span: number, duration: number, id?: string): void {
    const violet = look === VIOLET, resting = span === 0
    const radius = violet ? 7.4 * 2 : 4.6 * 1.75
    this.animate(duration, 1e6, (g, p) => {
      const dx = Math.cos(a), dy = Math.sin(a), px = x + dx * span * p, py = y + dy * span * p - 4
      const alpha = resting ? fade(p, .84) : 1
      const size = resting ? radius * (.92 + Math.sin(p * 16) * .08) : radius
      if (resting) {
        for (let i = 0; i < 8; i++) {
          const q = i * TAU / 8 - p * 8, r = size * (1.44 + i % 3 * .31)
          const tx = px + Math.cos(q) * r, ty = py + Math.sin(q) * r * .6
          g.lineStyle(1.05, look.body, alpha * .75).lineBetween(tx, ty, tx - Math.sin(q) * 4, ty + Math.cos(q) * 2.5)
        }
      } else for (let i = 10; i > 0; i--) {
        const d = Math.min(i * (violet ? 6.2 : 4.6), span * p)
        const ripple = Math.sin(i * .78 + p * 18) * i * .7
        const tx = px - dx * d - dy * ripple, ty = py - dy * d + dx * ripple
        const grain = (1 - i / 11) * .58
        g.fillStyle(look.body, grain).fillCircle(tx, ty, size * (1 - i / 12))
        if (i > 2) g.lineStyle(1.25, violet ? i % 2 ? BLUE.body : RED.body : look.light, .2 + grain * .5)
          .lineBetween(tx, ty, tx - dx * (4 + i), ty - dy * (4 + i))
      }
      g.fillStyle(look.shade, .27 * alpha).fillCircle(px, py, size * 2.13)
      g.fillStyle(look.body, .34 * alpha).fillCircle(px, py, size * 1.58)
      g.fillStyle(look.body, .83 * alpha).fillCircle(px, py, size)
      g.lineStyle(1.2, look.light, .67 * alpha).strokeCircle(px, py, size * .84)
      g.fillStyle(look.light, .94 * alpha).fillCircle(px - dx * .7, py - dy * .7, size * .53)
      if (violet) g.lineStyle(2.25, look.light, .86).lineBetween(px, py, px - dx * 24, py - dy * 24)
    }, id)
  }

  private violetFade(x: number, y: number, a: number): void {
    this.animate(340, 1e6, (g, p) => {
      const alpha = fade(p, .22), size = 14.8 * (1 - ease(p))
      g.fillStyle(VIOLET.body, alpha * .26).fillCircle(x, y - 4, 4 + size * 1.72)
      if (size > 0) g.fillStyle(VIOLET.light, alpha * .79).fillCircle(x, y - 4, size * .52)
      for (let i = 0; i < 18; i++) {
        const theta = a + Math.PI + (i % 9 - 4) * .16, r = 7 + ease(p) * (12 + i * 1.45)
        const dx = Math.cos(theta), dy = Math.sin(theta)
        g.lineStyle(i % 3 === 0 ? 1.4 : 1, i % 3 === 0 ? VIOLET.light : VIOLET.body, alpha * .78)
          .lineBetween(x + dx * r, y - 4 + dy * r, x + dx * (r + 3 + p * 6), y - 4 + dy * (r + 3 + p * 6))
      }
    })
  }

  private violetFusion(x: number, y: number, radius: number): void {
    this.animate(620, 1e6, (g, p) => {
      const alpha = fade(p, .28), spread = ease(Math.min(1, p * 1.63))
      const r = 4 + radius * spread
      if (p < .15) {
        const flash = 1 - p / .15
        g.fillStyle(VIOLET.light, flash).fillCircle(x, y, 9 + spread * 35)
        for (const [dir, hue] of [[-1, BLUE.body], [1, RED.body]] as const) {
          g.fillStyle(hue, flash * .8).fillCircle(x + dir * (11 + p * 36), y, 10 + spread * 15)
        }
      }
      g.fillStyle(VIOLET.body, alpha * (1 - spread) * .38).fillCircle(x, y, r * .8)
      g.lineStyle(10 * (1 - spread) + 1.5, VIOLET.body, alpha * .32).strokeCircle(x, y, r)
      g.lineStyle(2, VIOLET.light, alpha * .94).strokeCircle(x, y, r)
      g.lineStyle(1, VIOLET.body, alpha * .6).strokeCircle(x, y, r * 1.16)
      for (let i = 0; i < 30; i++) {
        const theta = i * 2.39996, d = r * (.42 + i % 5 * .15), dx = Math.cos(theta), dy = Math.sin(theta)
        const px = x + dx * d, py = y + dy * d, end = 4 + (1 - p) * (4 + i % 8)
        g.lineStyle(i % 3 ? 1.2 : 2, i % 3 ? VIOLET.body : VIOLET.light, alpha * .87)
          .lineBetween(px, py, px + dx * end, py + dy * end)
      }
    })
  }

  /** Original stair-stepped shrine. Raised roof corners frame the open dark bay. */
  private shrine(g: Graphics, x: number, y: number, p: number, alpha: number): void {
    const cx = Math.round(x), cy = Math.round(y - 4 + (1 - alpha) * 9)
    const rect = (dx: number, dy: number, w: number, h: number, color: number, opacity = 1) =>
      g.fillStyle(color, alpha * opacity).fillRect(cx + dx, cy + dy, w, h)
    g.lineStyle(11, 0x101019, alpha * .37).strokeEllipse(cx, cy + 3, 69, 16)
    rect(-34, 2, 68, 5, 0x24232d)
    rect(-34, 2, 68, 2, 0x8a8c94)
    rect(-29, -3, 58, 5, 0x484653)
    rect(-29, -3, 58, 2, 0xa0a0a4)
    rect(-24, -8, 48, 5, 0x54535e)
    rect(-24, -8, 48, 2, 0xb2a9a4)
    rect(-25, -31, 50, 23, 0x181a24)
    rect(-18, -29, 36, 21, 0x24232a)
    rect(-13, -27, 26, 17, 0x160f18)
    rect(-10, -27, 20, 3, 0x7c3b34)
    rect(-8, -15, 16, 5, 0x3b2932)
    for (const dx of [-24, -15, 11, 20]) {
      rect(dx, -33, 5, 24, 0x694044)
      rect(dx, -33, 2, 24, 0xb27264)
      rect(dx - 1, -12, 7, 3, 0x9d9395)
      rect(dx - 1, -31, 7, 2, 0xb89171)
    }
    for (const [width, base] of [[16, -50], [23, -41], [31, -32]]) {
      for (let row = 0; row < 7; row++) {
        const edge = width - 13 + row * 2
        rect(-edge, base - 7 + row, edge * 2, 1, row % 2 ? 0x383943 : 0x464651)
        if (row > 1) for (let tx = -edge + 4; tx <= edge - 4; tx += 6) rect(tx, base - 7 + row, 1, 1, 0x6b656f, .5)
      }
      rect(-width, base, width * 2, 2, 0x201e2c)
      rect(-width, base - 1, width * 2, 1, 0x91909a)
      for (const dir of [-1, 1]) {
        const side = dir < 0 ? -width - 4 : width - 1
        rect(side, base - 3, 5, 2, 0x45444d)
        rect(side + (dir < 0 ? -2 : 3), base - 5, 4, 2, 0xa2a0a3)
      }
    }
    rect(-2, -61, 4, 5, 0x7d6d72)
    rect(-1, -63, 2, 4, 0xc5b0a0)
    rect(-5, -23, 10, 1, 0x4f363c)
    for (const dir of [-1, 1]) {
      const lantern = dir * 28, glow = .66 + Math.sin(p * 72 + dir) * .15
      g.fillStyle(0xe74126, alpha * .16).fillCircle(cx + lantern, cy - 17, 7)
      rect(lantern - 2, -19, 4, 5, 0xd76240, glow)
      rect(lantern - 1, -18, 2, 3, 0xffc080, glow)
    }
    for (let i = 0; i < 11; i++) {
      const t = (p * 1.8 + i * .121) % 1, px = Math.round(cx + (i % 2 ? -1 : 1) * (11 + i * 2.4) + Math.sin(i + t * 3) * 4)
      const py = Math.round(cy - 12 - t * (36 + i % 5 * 5))
      g.fillStyle(i % 3 ? 0xdc735c : 0xffd1a0, alpha * Math.sin(t * Math.PI) * .68).fillRect(px, py, 1.4, 1.4)
    }
  }

  private domain(kind: string, x: number, y: number, duration?: number, instance?: string): void {
    const still = kind === 'still-field'
    const loop = !!instance && duration === undefined
    const cycle = duration ?? (loop ? 2200 : 1600)
    let opened = false, sealDone = false
    this.animate(cycle, -42, (g, p) => {
      if (!sealDone) {
        const seal = p * cycle / 720
        if (seal < 1) this.domainSeal(g, x, y, still, seal)
        else sealDone = true
      }
      if (p >= .125) opened = true
      const alpha = (opened ? 1 : ease(Math.min(1, p * 8))) * (loop ? 1 : fade(p, .86))
      if (!still) {
        g.fillStyle(RED.shade, alpha * .19).fillCircle(x, y - 22, 31)
        this.shrine(g, x, y, p, alpha)
        return
      }
      g.fillStyle(BLUE.shade, alpha * .32).fillCircle(x, y, 11)
      for (let i = 0; i < 4; i++) {
        const q = i * Math.PI / 2 + p * TAU
        const dx = Math.cos(q), dy = Math.sin(q)
        const sx = x + dx * 12, sy = y + dy * 8
        g.fillStyle(BLUE.light, alpha * .68)
          .fillTriangle(sx + dx * 3, sy + dy * 3, sx - dy * 2, sy + dx * 2, sx + dy * 2, sy - dx * 2)
      }
    }, instance, loop)
  }

  private domainSeal(g: Graphics, x: number, y: number, still: boolean, p: number): void {
    const color = still ? BLUE : RED
    const alpha = ease(Math.min(1, p * 12)) * fade(p, .36)
    const radius = T * (.55 + 5.5 * (1 - (1 - p) ** 2))
    const squash = .66
    const point = (q: number, r: number): [number, number] => [x + Math.cos(q) * r, y + Math.sin(q) * r * squash]

    g.lineStyle(3.8, color.body, alpha * .27).strokeEllipse(x, y, radius * 2, radius * 2 * squash)
    g.lineStyle(1.1, color.light, alpha * .88).strokeEllipse(x, y, radius * 2, radius * 2 * squash)
    g.lineStyle(.85, color.body, alpha * .69).strokeEllipse(x, y, radius * 1.62, radius * 1.62 * squash)

    const divisions = still ? 6 : 12, step = TAU / divisions
    for (let i = 0; i < divisions; i++) {
      const q = step * (i + .5)
      const outer = point(q, radius * 1.045), inner = point(q, radius * .88)
      g.lineStyle(1, color.light, alpha * .86).lineBetween(...inner, ...outer)
      if (still) {
        // The even and odd points trace two interlocking triangles inside the ring.
        g.lineStyle(1.15, color.body, alpha * .77)
          .lineBetween(...point(q, radius * .75), ...point(q + 2 * step, radius * .75))
      } else {
        // Mirrored strokes give the shrine seal a ring of small angular stamps.
        const bend = q + (i % 2 ? -.078 : .078)
        g.lineStyle(1.2, color.body, alpha * .91)
          .lineBetween(...point(bend, radius * .9), ...point(bend, radius * .985))
          .lineBetween(...point(bend, radius * .9), ...inner)
      }
    }
  }

  private impact(kind: string, look: Color, x: number, y: number, a: number): void {
    const land = kind.startsWith('land-'), red = kind === 'land-red'
    const strong = kind === 'land-violet' || kind === 'land-flame' || kind === 'orb-hit-violet'
    this.animate(land ? 390 : 245, 1e6, (g, p) => {
      const alpha = fade(p, .18), radius = (land ? strong ? 35 : 29 : strong ? 21 : 13) * (red ? 1 - ease(p) * .78 : .22 + .78 * ease(p))
      if (land || strong || kind.startsWith('blink')) {
        g.lineStyle(4.5, look.body, alpha * .2).strokeCircle(x, y, radius)
        g.lineStyle(1.4, look.light, alpha * .84).strokeCircle(x, y, radius)
      }
      if (p < .23) g.fillStyle(look.light, (1 - p / .23) * .8).fillCircle(x, y, strong ? 6 : 3)
      for (let i = 0; i < (land ? 15 : 8); i++) {
        const theta = a + i * 2.39996 + (red ? p * 2.4 : 0), d = radius * (.42 + (i % 5) * .18)
        const dx = Math.cos(theta), dy = Math.sin(theta)
        const px = x + dx * d, py = y + dy * d
        g.lineStyle(i % 4 ? 1 : 1.8, i % 4 ? look.body : look.light, alpha * .86).lineBetween(px, py, px + dx * (red ? -3 : 4), py + dy * (red ? -3 : 4))
      }
    })
  }
}
