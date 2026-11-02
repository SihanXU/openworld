// The skills' own effects (docs/advancement.md §4), drawn by code rather than from sheets: a ring at the caster's feet
// as it casts, a shockwave, a sigil flaring on the ground, the ground opening for what is raised, an afterimage along a
// dash, a mark closing on a foe, an aura round one who takes a buff, poison falling, a blow landing, a soul flown home
// — each in its skill's colours (ActiveDef.look). The worker names them as vfx: `cast:necro`, `burst:hell:2`,
// `trail:shadow:3:0`, `soul:hell:-2:1` (the last two a way in cells from where it starts).

import Phaser from 'phaser'
import { T } from '../assets/ground.ts'

/** What a look's motes are: lights, embers rising, shards flung, leaves, drops, sparks. */
type Mote = 'light' | 'ember' | 'shard' | 'leaf' | 'drop' | 'spark'

interface Look {
  main: number
  light: number
  dark: number
  mote: Mote
  /** The sound a burst of it makes (the catalogue's sfx). */
  sound: string
}

export const LOOKS: Record<string, Look> = {
  necro: { main: 0x6fd17a, light: 0xd8ffd2, dark: 0x1d3a24, mote: 'shard', sound: 'impact' },
  poison: { main: 0x9be15d, light: 0xeaffc4, dark: 0x2f4a12, mote: 'drop', sound: 'water' },
  hell: { main: 0xff4a2e, light: 0xffc27a, dark: 0x3a0806, mote: 'ember', sound: 'fire' },
  shadow: { main: 0x8f7cff, light: 0xe2dcff, dark: 0x1a1430, mote: 'light', sound: 'wind' },
  hex: { main: 0xb07cff, light: 0xffe39a, dark: 0x2a1640, mote: 'spark', sound: 'cast' },
  holy: { main: 0xffe27a, light: 0xfffbe0, dark: 0x6a4c10, mote: 'light', sound: 'heal' },
  fire: { main: 0xff8a24, light: 0xffe08a, dark: 0x4a1606, mote: 'ember', sound: 'fire' },
  frost: { main: 0x9fdcff, light: 0xf0fbff, dark: 0x1c3a52, mote: 'shard', sound: 'ice' },
  storm: { main: 0xbfe3ff, light: 0xffffff, dark: 0x1e2a4a, mote: 'spark', sound: 'thunder' },
  blood: { main: 0xe0383a, light: 0xffb4a8, dark: 0x3a0a0e, mote: 'drop', sound: 'hit' },
  steel: { main: 0xdfe6ee, light: 0xffffff, dark: 0x3a4250, mote: 'spark', sound: 'hit' },
  war: { main: 0xffc04a, light: 0xfff2c4, dark: 0x4a2a08, mote: 'spark', sound: 'impact' },
  thorn: { main: 0x7cc25a, light: 0xd6f5b0, dark: 0x3a2412, mote: 'leaf', sound: 'impact' },
  beast: { main: 0xd8a35a, light: 0xfff0cc, dark: 0x3a2610, mote: 'leaf', sound: 'howl' },
  wind: { main: 0xa8f0d8, light: 0xf0fff8, dark: 0x1e4a40, mote: 'leaf', sound: 'wind' },
  earth: { main: 0xc09060, light: 0xf0d8b0, dark: 0x3a2814, mote: 'shard', sound: 'impact' },
  arcane: { main: 0x9fb8ff, light: 0xeef2ff, dark: 0x1e2450, mote: 'light', sound: 'cast' },
}

/** The effects this file draws, by the vfx name's first part. */
export const SKILL_FX = new Set(['cast', 'burst', 'rise', 'zone', 'mark', 'trail', 'aura', 'fall', 'impact', 'soul'])

/** What the scene lends the effects: the one drawn for an id (its root at its feet, its body), and its sounds. */
export interface FxStage {
  scene: Phaser.Scene
  viewOf(id?: string): { root: Phaser.GameObjects.Container; body: Phaser.GameObjects.Sprite } | undefined
  sfx(name: string, volume: number): void
}

/** Over the ground, under what stands (depth.ts: decals −50, what lies flat −45, a floor −44). */
const GROUND = -43
/** With the other effects, over everything that stands. */
const AIR = 1e6

export class SkillFx {
  constructor(private stage: FxStage) {}

  private get scene(): Phaser.Scene {
    return this.stage.scene
  }

  /** Draw one; false when the name is not one of these (the scene falls back on its sheets). */
  play(kind: string, args: string[], cx: number, cy: number, who?: string): boolean {
    if (!SKILL_FX.has(kind)) return false
    const look = LOOKS[args[0]] ?? LOOKS.arcane
    // the cell's middle, and its feet (where one standing in it touches the ground)
    const x = cx * T + T / 2
    const y = cy * T + T / 2
    const n = (i: number) => Number(args[i]) || 0
    if (kind === 'cast') this.cast(look, x, y, who)
    else if (kind === 'burst') this.burst(look, x, y, n(1))
    else if (kind === 'rise') this.rise(look, x, y)
    else if (kind === 'zone') this.zone(look, x, y)
    else if (kind === 'mark') this.mark(look, x, y)
    else if (kind === 'trail') this.trail(look, x, y, n(1) * T, n(2) * T, who)
    else if (kind === 'aura') this.aura(look, x, y, who)
    else if (kind === 'fall') this.fall(look, x, y)
    else if (kind === 'impact') this.impact(look, x, y)
    else if (kind === 'soul') this.soul(look, x, y, n(1) * T, n(2) * T)
    return true
  }

  // ---------------------------------------------------------------- the pieces they are made of

  private glow(x: number, y: number, color: number, scale: number, depth = AIR): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(scale).setDepth(depth)
  }

  /** A ring lying on the ground (flattened), grown from one radius to another and faded. */
  private ring(x: number, y: number, from: number, to: number, color: number, duration: number, width = 2, delay = 0, depth = GROUND): void {
    const r = this.scene.add.circle(x, y, from, color, 0).setStrokeStyle(width, color, 1).setScale(1, 0.55).setDepth(depth).setAlpha(delay ? 0 : 1)
    this.scene.tweens.add({ targets: r, scaleX: to / from, scaleY: (to / from) * 0.55, alpha: { from: 1, to: 0 }, delay, duration, ease: 'Cubic.easeOut', onComplete: () => r.destroy() })
  }

  /** One mote of a look, flown from a point by a way, fading. */
  private mote(look: Look, x: number, y: number, dx: number, dy: number, duration: number, delay = 0): void {
    const s = this.scene
    const c = Math.random() < 0.6 ? look.main : look.light
    let m: Phaser.GameObjects.Shape
    if (look.mote === 'shard') m = s.add.rectangle(x, y, 1.5, 4, look.light).setAngle(Math.random() * 180)
    else if (look.mote === 'leaf') m = s.add.ellipse(x, y, 3, 2, c).setAngle(Math.random() * 180)
    else if (look.mote === 'spark') m = s.add.rectangle(x, y, 1, 3, look.light).setAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90)
    else if (look.mote === 'drop') m = s.add.circle(x, y, 1.3 + Math.random(), c)
    else if (look.mote === 'ember') m = s.add.rectangle(x, y, 2, 2, Math.random() < 0.5 ? look.main : look.light)
    else m = s.add.circle(x, y, 1 + Math.random() * 1.2, c)
    if (look.mote !== 'shard' && look.mote !== 'drop' && look.mote !== 'leaf') m.setBlendMode(Phaser.BlendModes.ADD)
    m.setDepth(AIR).setAlpha(delay ? 0 : 1)
    // shards and drops fall back as they go; the rest drift on
    const heavy = look.mote === 'shard' || look.mote === 'drop'
    s.tweens.add({
      targets: m,
      x: x + dx,
      y: y + dy + (heavy ? 6 : 0),
      alpha: { from: 1, to: 0 },
      angle: look.mote === 'shard' || look.mote === 'leaf' ? m.angle + 160 : m.angle,
      scale: heavy ? 1 : 0.4,
      delay,
      duration,
      ease: heavy ? 'Quad.easeIn' : 'Quad.easeOut',
      onComplete: () => m.destroy(),
    })
  }

  /** So many motes thrown out round a point, a radius out, rising a little (or falling, `lift` below 0). */
  private spray(look: Look, x: number, y: number, count: number, radius: number, lift: number, duration: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const r = radius * (0.6 + Math.random() * 0.5)
      this.mote(look, x, y, Math.cos(a) * r, Math.sin(a) * r * 0.6 - lift * (0.5 + Math.random()), duration * (0.8 + Math.random() * 0.4))
    }
  }

  // ---------------------------------------------------------------- the effects

  /** The cast: a ring opening at the caster's feet, a light in it, motes rising round them. */
  private cast(look: Look, x: number, y: number, who?: string): void {
    const v = this.stage.viewOf(who)
    const fx = v ? v.root.x : x
    const fy = v ? v.root.y - 2 : y + T / 2 - 2
    this.ring(fx, fy, 3, 15, look.main, 420, 2)
    this.ring(fx, fy, 2, 10, look.light, 360, 1, 60)
    const g = this.glow(fx, fy - 8, look.main, 0.25)
    this.scene.tweens.add({ targets: g, scale: 0.55, alpha: { from: 0.9, to: 0 }, duration: 340, ease: 'Quad.easeOut', onComplete: () => g.destroy() })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      this.mote(look, fx + Math.cos(a) * 7, fy + Math.sin(a) * 3, Math.cos(a) * 3, -14 - Math.random() * 8, 520, i * 25)
    }
  }

  /** A shockwave `r` cells out (0: a burst on one cell): a flash, two rings, motes thrown to its edge. */
  private burst(look: Look, x: number, y: number, r: number): void {
    const edge = (r + 0.5) * T
    const g = this.glow(x, y, look.main, 0.3)
    this.scene.tweens.add({ targets: g, scale: 0.5 + r * 0.45, alpha: { from: 1, to: 0 }, duration: 320, ease: 'Quad.easeOut', onComplete: () => g.destroy() })
    const core = this.glow(x, y, look.light, 0.15)
    this.scene.tweens.add({ targets: core, scale: 0.35, alpha: { from: 1, to: 0 }, duration: 200, onComplete: () => core.destroy() })
    this.ring(x, y + 4, 4, edge, look.main, 460, 3)
    this.ring(x, y + 4, 3, edge * 0.8, look.light, 420, 1, 70)
    this.spray(look, x, y, 10 + r * 6, edge, 4, 520)
    if (r >= 2) this.scene.cameras.main.shake(130, 0.003)
    this.stage.sfx(look.sound, r ? 0.35 : 0.25)
  }

  /** The ground opening for what is raised: a dark mouth, a column of light out of it, motes and shards thrown up. */
  private rise(look: Look, x: number, y: number): void {
    const s = this.scene
    const fy = y + T / 2 - 3
    const mouth = s.add.ellipse(x, fy, 15, 6, look.dark, 0.85).setDepth(GROUND).setScale(0.2)
    s.tweens.chain({ targets: mouth, tweens: [{ scale: 1, duration: 140, ease: 'Back.easeOut' }, { alpha: 0, delay: 500, duration: 500 }], onComplete: () => mouth.destroy() })
    // its cracks
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      const crack = s.add.rectangle(x + Math.cos(a) * 8, fy + Math.sin(a) * 3, 6, 1, look.dark, 0.9).setAngle((a * 180) / Math.PI).setDepth(GROUND)
      s.tweens.add({ targets: crack, alpha: 0, delay: 600, duration: 400, onComplete: () => crack.destroy() })
    }
    const pillar = this.glow(x, fy - 10, look.main, 0.3).setScale(0.28, 0.15)
    s.tweens.add({ targets: pillar, scaleY: 1.1, y: fy - 18, alpha: { from: 0.95, to: 0 }, duration: 650, ease: 'Quad.easeOut', onComplete: () => pillar.destroy() })
    for (let i = 0; i < 10; i++) this.mote(look, x + (Math.random() - 0.5) * 10, fy, (Math.random() - 0.5) * 10, -16 - Math.random() * 16, 600, i * 30)
    this.ring(x, fy, 3, 12, look.main, 500, 2)
    this.stage.sfx(look.sound, 0.3)
  }

  /** A sigil flaring on a cell as what a skill lays settles there: a turning circle, its marks, a light. */
  private zone(look: Look, x: number, y: number): void {
    const s = this.scene
    const g = s.add.graphics({ x, y: y + 2 }).setDepth(GROUND)
    g.lineStyle(1.5, look.light, 1).strokeCircle(0, 0, 6)
    g.lineStyle(1, look.main, 1)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      g.lineBetween(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 7.5, Math.sin(a) * 7.5)
    }
    g.setScale(0.4, 0.22)
    const delay = Math.random() * 120
    s.tweens.add({ targets: g, scaleX: 1.15, scaleY: 0.65, angle: 90, alpha: { from: 1, to: 0 }, delay, duration: 700, ease: 'Cubic.easeOut', onComplete: () => g.destroy() })
    const light = this.glow(x, y + 2, look.main, 0.18, GROUND + 1).setAlpha(0)
    s.tweens.add({ targets: light, alpha: { from: 0.7, to: 0 }, delay, duration: 500, onComplete: () => light.destroy() })
  }

  /** A mark closing on a foe: two rings narrowing onto it, a point over its head. */
  private mark(look: Look, x: number, y: number): void {
    const s = this.scene
    for (const [from, delay] of [[18, 0], [13, 90]] as const) {
      const r = s.add.circle(x, y - 4, from, look.main, 0).setStrokeStyle(1.5, look.main, 1).setDepth(AIR).setAlpha(0)
      s.tweens.add({ targets: r, scale: 7 / from, alpha: { from: 1, to: 0.2 }, delay, duration: 520, ease: 'Cubic.easeIn', onComplete: () => r.destroy() })
    }
    const tip = s.add.triangle(x, y - 26, 0, 0, 8, 0, 4, 6, look.main).setDepth(AIR).setAlpha(0)
    s.tweens.chain({ targets: tip, tweens: [{ alpha: 1, y: y - 22, duration: 220, ease: 'Back.easeOut' }, { y: y - 24, duration: 260, yoyo: true, repeat: 1 }, { alpha: 0, duration: 240 }], onComplete: () => tip.destroy() })
    this.impact(look, x, y)
  }

  /** An afterimage along a dash: the one who went, ghosted where they were and on the way; a streak; motes. */
  private trail(look: Look, x: number, y: number, dx: number, dy: number, who?: string): void {
    const s = this.scene
    const fy = y + T / 2
    const streak = s.add.graphics().setDepth(AIR - 1).setBlendMode(Phaser.BlendModes.ADD)
    streak.lineStyle(3, look.main, 0.7).lineBetween(x, fy - 7, x + dx, fy - 7 + dy)
    streak.lineStyle(1, look.light, 0.9).lineBetween(x, fy - 7, x + dx, fy - 7 + dy)
    s.tweens.add({ targets: streak, alpha: 0, duration: 280, onComplete: () => streak.destroy() })
    const body = this.stage.viewOf(who)?.body
    if (body) {
      for (const [k, alpha] of [[0, 0.55], [0.35, 0.4], [0.7, 0.25]] as const) {
        const ghost = s.add.image(x + dx * k, fy + dy * k, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY).setScale(body.scaleX, body.scaleY).setFlipX(body.flipX).setTint(look.main).setTintMode(Phaser.TintModes.FILL).setAlpha(alpha).setDepth(AIR - 2)
        s.tweens.add({ targets: ghost, alpha: 0, duration: 380 + k * 120, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() })
      }
    }
    for (let i = 0; i < 6; i++) {
      const k = i / 6
      this.mote(look, x + dx * k, fy - 6 + dy * k, (Math.random() - 0.5) * 6, -4 - Math.random() * 6, 360, i * 20)
    }
    this.stage.sfx('wind', 0.2)
  }

  /** An aura round one who takes a buff: a light breathing round them three times, a ring, motes rising. */
  private aura(look: Look, x: number, y: number, who?: string): void {
    const s = this.scene
    const v = this.stage.viewOf(who)
    const fx = v ? v.root.x : x
    const fy = v ? v.root.y : y + T / 2
    const light = this.glow(0, -8, look.main, 0.45).setAlpha(0.55)
    if (v) v.root.addAt(light, 0)
    else light.setPosition(fx, fy - 8)
    s.tweens.add({
      targets: light,
      scale: 0.7,
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => s.tweens.add({ targets: light, alpha: 0, scale: 0.9, duration: 260, onComplete: () => light.destroy() }),
    })
    this.ring(fx, fy - 2, 4, 14, look.main, 480, 2)
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2
      this.mote(look, fx + Math.cos(a) * 7, fy - 2 + Math.sin(a) * 3, 0, -18 - Math.random() * 10, 600, i * 70)
    }
    this.stage.sfx(look === LOOKS.holy ? 'heal' : 'cast', 0.25)
  }

  /** What a plague rains: a drop falling into the cell, a splash where it lands. */
  private fall(look: Look, x: number, y: number): void {
    const s = this.scene
    const fy = y + 4
    const delay = Math.random() * 200
    const d = s.add.circle(x + (Math.random() - 0.5) * 8, fy - 30, 2, look.main).setDepth(AIR).setAlpha(0)
    s.tweens.add({
      targets: d,
      y: fy,
      alpha: { from: 1, to: 1 },
      delay,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        d.destroy()
        this.ring(d.x, fy, 1, 7, look.main, 300, 1)
        for (let i = 0; i < 3; i++) this.mote(look, d.x, fy, (Math.random() - 0.5) * 10, -4 - Math.random() * 3, 280)
      },
    })
  }

  /** A blow landing in a skill's colours: a flash, sparks every way, a small ring. */
  private impact(look: Look, x: number, y: number): void {
    const g = this.glow(x, y - 2, look.light, 0.2)
    this.scene.tweens.add({ targets: g, scale: 0.42, alpha: { from: 1, to: 0 }, duration: 220, onComplete: () => g.destroy() })
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4
      this.mote(look, x, y - 2, Math.cos(a) * 11, Math.sin(a) * 9, 300)
    }
    this.ring(x, y + 4, 2, 9, look.main, 300, 1)
  }

  /** A soul flown home: a light rising off the fallen and arcing to the one it goes to, motes in its wake. */
  private soul(look: Look, x: number, y: number, dx: number, dy: number): void {
    const s = this.scene
    const orb = this.glow(x, y - 4, look.light, 0.16)
    const halo = this.glow(x, y - 4, look.main, 0.32).setAlpha(0.5)
    const flight = { k: 0 }
    let last = 0
    s.tweens.add({
      targets: flight,
      k: 1,
      duration: 620,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const k = flight.k
        const px = x + dx * k
        const py = y - 4 + dy * k - Math.sin(k * Math.PI) * 18
        orb.setPosition(px, py)
        halo.setPosition(px, py)
        if (s.time.now - last > 40) (last = s.time.now), this.mote(look, px, py, (Math.random() - 0.5) * 4, 4, 300)
      },
      onComplete: () => {
        orb.destroy()
        halo.destroy()
        const g = this.glow(x + dx, y - 6 + dy, look.main, 0.2)
        s.tweens.add({ targets: g, scale: 0.5, alpha: { from: 0.9, to: 0 }, duration: 260, onComplete: () => g.destroy() })
      },
    })
  }
}
