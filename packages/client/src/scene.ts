// The world view: tilemap + entity sprites + status overlays + VFX + day/night.
// It only renders snapshots from the engine Worker; it never owns game state.

import Phaser from 'phaser'
import type { EntitySnap, Frame, FxEvent, MapData, Text } from '@lsw/engine'
import { TILE, Textures } from './textures.ts'

export interface SceneHooks {
  onFx(fx: FxEvent, frame: Frame): void
  onFrame(frame: Frame): void
}

interface EView {
  snap: EntitySnap
  root: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Sprite
  overlay?: Phaser.GameObjects.Sprite
  overlayName?: string
  held?: Phaser.GameObjects.Image
  hp: Phaser.GameObjects.Graphics
  glow?: Phaser.GameObjects.Image
  key: string
  movingUntil: number
  phase: number
}

const OVERLAY_OF: [string, string][] = [
  ['burning', 'fire'],
  ['frozen', 'ice'],
  ['electrified', 'spark'],
  ['wet', 'wet'],
  ['oiled', 'oil'],
]

const TINT_OF: Record<string, number> = { frozen: 0xbfe9ff, burning: 0xffc9a0, wet: 0xc8dcff, electrified: 0xfff6a0, oiled: 0xb9b29a }

const ELEMENT_COLOR: Record<string, number> = { fire: 0xff7a1a, ice: 0x9fe8ff, lightning: 0xfff27a, water: 0x4aa0ff, wind: 0xe8fff4, earth: 0xb08850, none: 0xffffff }

export class WorldScene extends Phaser.Scene {
  tex!: Textures
  hooks!: SceneHooks
  private tilemap?: Phaser.Tilemaps.Tilemap
  private layer?: Phaser.Tilemaps.TilemapLayer
  private base?: MapData
  private overridden = new Map<string, string>() // "x,y" -> terrain
  private animated: [number, number, string][] = []
  private views = new Map<string, EView>()
  private tileFx = new Map<string, { sprites: Phaser.GameObjects.GameObject[]; sig: string }>()
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>()
  private night!: Phaser.GameObjects.Rectangle
  private playerId = 'player'
  private ready = false
  private pending: { map?: MapData; frames: Frame[] } = { frames: [] }
  private animTick = 0
  private following?: Phaser.GameObjects.Container

  constructor() {
    super('world')
  }

  create(): void {
    this.tex = new Textures(this)
    this.tex.terrain()
    this.tex.particles()
    this.makeGlowTexture()
    this.cameras.main.setZoom(this.fitZoom()).setRoundPixels(true).setBackgroundColor('#0b0d12')
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(this.fitZoom())
      this.fitBounds()
    })
    this.night = this.add.rectangle(-4000, -4000, 8000, 8000, 0x0a1030, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7)
    this.ready = true
    if (this.pending.map) this.setMap(this.pending.map)
    for (const f of this.pending.frames) this.applyFrame(f)
    this.pending = { frames: [] }
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.animateWater() })
  }

  /** Integer zoom so roughly 14+ tiles fit vertically: 2x on small windows, 3-4x on large ones. */
  private fitZoom(): number {
    const h = this.scale.height || window.innerHeight
    const w = this.scale.width || window.innerWidth
    return Math.max(2, Math.min(4, Math.floor(Math.min(h / (TILE * 14), w / (TILE * 22)))))
  }

  // ---------------------------------------------------------------- map

  setMap(map: MapData): void {
    if (!this.ready) {
      this.pending.map = map
      this.pending.frames = []
      return
    }
    this.cameras.main.fadeIn(250, 8, 10, 16)
    for (const v of this.views.values()) this.destroyView(v)
    this.views.clear()
    this.following = undefined
    for (const t of this.tileFx.values()) t.sprites.forEach((s) => s.destroy())
    this.tileFx.clear()
    this.overridden.clear()
    this.layer?.destroy()
    this.tilemap?.destroy()
    this.base = map
    const data: number[][] = []
    this.animated = []
    for (let y = 0; y < map.height; y++) {
      const row: number[] = []
      for (let x = 0; x < map.width; x++) {
        const t = map.terrain[y * map.width + x]
        row.push(this.tex.tileFor(t, x, y))
        if (this.tex.terrainIndex[t]?.anim) this.animated.push([x, y, t])
      }
      data.push(row)
    }
    this.tilemap = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE })
    const ts = this.tilemap.addTilesetImage('terrain', 'terrain', TILE, TILE, 0, 0)!
    this.layer = this.tilemap.createLayer(0, ts, 0, 0) as Phaser.Tilemaps.TilemapLayer
    this.layer.setDepth(-10)
    this.fitBounds()
  }

  /** Camera bounds = the map, centred in the view when the map is smaller than the screen. */
  private fitBounds(): void {
    if (!this.base) return
    const cam = this.cameras.main
    const mw = this.base.width * TILE
    const mh = this.base.height * TILE
    const vw = cam.width / cam.zoom
    const vh = cam.height / cam.zoom
    const bw = Math.max(mw, vw)
    const bh = Math.max(mh, vh)
    cam.setBounds(-(bw - mw) / 2, -(bh - mh) / 2, bw, bh)
  }

  private animateWater(): void {
    if (!this.layer) return
    this.animTick ^= 1
    for (const [x, y, t] of this.animated) {
      if (this.overridden.has(`${x},${y}`)) continue
      const a = this.tex.terrainIndex[t].anim!
      if ((x + y) % 3 === 0) this.layer.putTileAt(this.animTick ? a[1] : a[0], x, y)
    }
  }

  // ---------------------------------------------------------------- frames

  applyFrame(f: Frame): void {
    if (!this.ready || !this.base) {
      this.pending.frames = [f]
      return
    }
    if (f.map !== this.base.id) return
    this.playerId = f.player.id
    this.applyTiles(f)
    const seen = new Set<string>()
    for (const e of f.entities) {
      seen.add(e.id)
      const v = this.views.get(e.id)
      if (!v) this.views.set(e.id, this.makeView(e))
      else this.updateView(v, e)
    }
    for (const [id, v] of this.views) if (!seen.has(id)) (this.destroyView(v), this.views.delete(id))
    const me = this.views.get(this.playerId)
    if (me && this.following !== me.root) {
      this.following = me.root
      this.cameras.main.startFollow(me.root, true, 0.2, 0.2)
    }
    for (const fx of f.fx) this.playFx(fx)
    this.updateNight(f)
    this.hooks.onFrame(f)
    for (const fx of f.fx) this.hooks.onFx(fx, f)
  }

  private applyTiles(f: Frame): void {
    const base = this.base!
    const now = new Map<string, string>()
    const statusNow = new Map<string, string[]>()
    for (const t of f.tiles) {
      if (t.terrain) now.set(`${t.x},${t.y}`, t.terrain)
      if (t.statuses?.length) statusNow.set(`${t.x},${t.y}`, t.statuses)
    }
    for (const [k, terrain] of now)
      if (this.overridden.get(k) !== terrain) {
        const [x, y] = k.split(',').map(Number)
        this.layer!.putTileAt(this.tex.tileFor(terrain, x, y), x, y)
        this.overridden.set(k, terrain)
      }
    for (const k of [...this.overridden.keys()])
      if (!now.has(k)) {
        const [x, y] = k.split(',').map(Number)
        this.layer!.putTileAt(this.tex.tileFor(base.terrain[y * base.width + x], x, y), x, y)
        this.overridden.delete(k)
      }
    // status overlays on tiles
    for (const [k, list] of statusNow) {
      const sig = list.slice().sort().join('|')
      const cur = this.tileFx.get(k)
      if (cur?.sig === sig) continue
      cur?.sprites.forEach((s) => s.destroy())
      const [x, y] = k.split(',').map(Number)
      const sprites: Phaser.GameObjects.GameObject[] = []
      for (const [st, ov] of OVERLAY_OF) {
        if (!list.includes(st)) continue
        const s = this.animSprite(ov, x * TILE + 8, y * TILE + 8)
        s.setDepth(y * TILE + (st === 'burning' ? 12 : -1)).setAlpha(st === 'wet' ? 0.75 : 1)
        sprites.push(s)
        if (st === 'burning') {
          const g = this.add.image(x * TILE + 8, y * TILE + 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e7 + 1).setTint(0xff9a40).setScale(0.9)
          sprites.push(g)
        }
        break
      }
      this.tileFx.set(k, { sprites, sig })
    }
    for (const [k, v] of this.tileFx)
      if (!statusNow.has(k)) {
        v.sprites.forEach((s) => s.destroy())
        this.tileFx.delete(k)
      }
  }

  private animSprite(overlay: string, x: number, y: number): Phaser.GameObjects.Sprite {
    const key = this.tex.overlay(overlay)
    const frames = this.tex.overlayFrames(overlay)
    const s = this.add.sprite(x, y, key, frames[0])
    if (frames.length > 1) {
      const animKey = `ovl-anim:${overlay}`
      if (!this.anims.exists(animKey)) this.anims.create({ key: animKey, frames: frames.map((f) => ({ key, frame: f })), frameRate: 7, repeat: -1 })
      s.play({ key: animKey, startFrame: Math.floor(Math.random() * frames.length) })
    }
    return s
  }

  // ---------------------------------------------------------------- entities

  private textureFor(e: EntitySnap): { key: string; frame: string } {
    if (e.kind === 'actor' && e.appearance) {
      const role = e.type.split('/').pop()!
      return { key: this.tex.character(e.appearance, role), frame: `${e.facing}0` }
    }
    if (e.kind === 'actor') {
      const variant = e.element ?? e.type.split('/').pop()!
      return { key: this.tex.creature(e.sprite, variant), frame: 'idle0' }
    }
    if (e.kind === 'fixture') {
      const key = this.tex.fixture(e.sprite)
      const names = this.tex.frameNames(key)
      const frame = e.statuses.includes('lit') && names.includes('lit') ? 'lit' : e.open && names.includes('open') ? 'open' : 'base'
      return { key, frame }
    }
    return { key: this.tex.icon(e.sprite, e.tags), frame: 'icon' }
  }

  private makeView(e: EntitySnap): EView {
    const { key, frame } = this.textureFor(e)
    const px = e.x * TILE + 8
    const py = e.y * TILE + 8
    const root = this.add.container(px, py)
    const body = this.add.sprite(0, 0, key, frame)
    const tall = body.height > TILE
    body.setOrigin(0.5, tall ? 1 - 8 / body.height : 0.5)
    if (e.kind === 'item') body.setScale(0.75)
    const hp = this.add.graphics()
    root.add([body, hp])
    const v: EView = { snap: e, root, body, hp, key, movingUntil: 0, phase: Math.random() * 1000 }
    this.updateView(v, e, true)
    return v
  }

  private updateView(v: EView, e: EntitySnap, first = false): void {
    const prev = v.snap
    v.snap = e
    const px = e.x * TILE + 8
    const py = e.y * TILE + 8
    if (!first && (prev.x !== e.x || prev.y !== e.y)) {
      const far = Math.abs(prev.x - e.x) + Math.abs(prev.y - e.y) > 1
      this.tweens.killTweensOf(v.root)
      if (far) v.root.setPosition(px, py)
      else {
        const dur = e.id === this.playerId ? 190 : e.kind === 'actor' && e.appearance ? 380 : 330
        this.tweens.add({ targets: v.root, x: px, y: py, duration: dur, ease: 'Linear' })
        v.movingUntil = this.time.now + dur
      }
    }
    // texture may change (fixture opened/lit, item transformed, creature re-typed)
    const { key, frame } = this.textureFor(e)
    if (key !== v.key) {
      v.key = key
      v.body.setTexture(key, frame)
    } else if (e.kind !== 'actor') v.body.setFrame(frame)
    v.root.setDepth(py + (e.kind === 'actor' ? 4 : e.kind === 'item' ? -2 : 0))
    // status overlay + tint
    const top = OVERLAY_OF.find(([s]) => e.statuses.includes(s))
    const want = top?.[1]
    if (want !== v.overlayName) {
      v.overlay?.destroy()
      v.overlay = undefined
      v.overlayName = want
      if (want) {
        v.overlay = this.animSprite(want, 0, 0)
        v.root.add(v.overlay)
      }
    }
    const tintStatus = e.statuses.find((s) => TINT_OF[s])
    if (tintStatus) v.body.setTint(TINT_OF[tintStatus])
    else v.body.clearTint()
    v.body.setAlpha(e.frozen ? 0.75 : 1)
    // held item
    if (e.held && e.kind === 'actor') {
      const ik = this.tex.icon(e.held, e.heldTags)
      if (!v.held) {
        v.held = this.add.image(5, 1, ik, 'icon').setScale(0.5)
        v.root.add(v.held)
      } else v.held.setTexture(ik, 'icon')
    } else if (v.held) {
      v.held.destroy()
      v.held = undefined
    }
    // light sources glow at night
    const lit = e.statuses.includes('lit') || e.statuses.includes('burning') || (e.id === this.playerId && e.heldTags?.includes('light'))
    if (lit && !v.glow) v.glow = this.add.image(px, py, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e7 + 1).setTint(0xffb050)
    if (!lit && v.glow) (v.glow.destroy(), (v.glow = undefined))
    // hp bar
    v.hp.clear()
    if (e.kind === 'actor' && e.maxHp && e.hp !== undefined && (e.hp < e.maxHp || e.hostile) && e.id !== this.playerId) {
      const w = 12
      v.hp.fillStyle(0x000000, 0.6).fillRect(-w / 2, -11, w, 2)
      v.hp.fillStyle(e.hostile ? 0xe04848 : 0x6ad06a, 1).fillRect(-w / 2, -11, Math.max(1, (w * e.hp) / e.maxHp), 2)
    }
  }

  private destroyView(v: EView): void {
    this.tweens.killTweensOf(v.root)
    v.glow?.destroy()
    v.root.destroy()
  }

  update(time: number): void {
    for (const v of this.views.values()) {
      const e = v.snap
      if (e.kind === 'actor' && e.appearance) {
        const moving = time < v.movingUntil
        const i = moving ? 1 + (Math.floor((time + v.phase) / 140) % 2) : 0
        v.body.setFrame(`${e.facing}${i}`)
      } else if (e.kind === 'actor') {
        v.body.setFrame(Math.floor((time + v.phase) / 420) % 2 ? 'idle1' : 'idle0')
        if (e.facing === 'left') v.body.setFlipX(true)
        else if (e.facing === 'right') v.body.setFlipX(false)
      }
      if (v.glow) v.glow.setPosition(v.root.x, v.root.y).setAlpha(this.darkness * 1.4 * (0.85 + 0.15 * Math.sin((time + v.phase) / 120)))
    }
    for (const t of this.tileFx.values())
      for (const s of t.sprites) if (s instanceof Phaser.GameObjects.Image && s.texture.key === 'glow') s.setAlpha(this.darkness * 1.2)
  }

  /** Screen position (CSS px) of an entity, for DOM labels. */
  screenOf(id: string): { x: number; y: number } | undefined {
    const v = this.views.get(id)
    if (!v) return undefined
    const cam = this.cameras.main
    return { x: (v.root.x - cam.worldView.x) * cam.zoom, y: (v.root.y - cam.worldView.y) * cam.zoom }
  }

  screenOfTile(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main
    return { x: (x * TILE + 8 - cam.worldView.x) * cam.zoom, y: (y * TILE + 8 - cam.worldView.y) * cam.zoom }
  }

  // ---------------------------------------------------------------- day / night

  private darkness = 0

  private updateNight(f: Frame): void {
    const kind = this.base?.kind
    const h = f.hour
    let d = 0
    if (h >= 21 || h < 4.5) d = 0.62
    else if (h >= 18) d = ((h - 18) / 3) * 0.62
    else if (h < 7) d = ((7 - h) / 2.5) * 0.62
    if (kind === 'dungeon') d = 0.58
    if (kind === 'interior') d = d * 0.45
    this.darkness = d
    this.night.setFillStyle(kind === 'dungeon' ? 0x05060c : 0x0a1030, d)
  }

  // ---------------------------------------------------------------- vfx

  private makeGlowTexture(): void {
    if (this.textures.exists('glow')) return
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,255,255,0.55)')
    grd.addColorStop(0.4, 'rgba(255,255,255,0.22)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    this.textures.addCanvas('glow', c)
  }

  private emitter(name: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.emitters.get(name)
    if (!e) {
      e = this.add.particles(0, 0, this.tex.particles(), { ...cfg, emitting: false })
      e.setDepth(1e6)
      this.emitters.set(name, e)
    }
    return e
  }

  private burst(name: string, x: number, y: number, n: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): void {
    this.emitter(name, cfg).explode(n, x, y)
  }

  playFx(fx: FxEvent): void {
    if (fx.t === 'vfx') {
      const x = fx.x * TILE + 8
      const y = fx.y * TILE + 8
      const [kind, a, b, c] = fx.fx.split(':')
      switch (kind) {
        case 'steam':
          return this.burst('steam', x, y, 12, { frame: 'smoke', speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 900, scale: { start: 0.6, end: 1.6 }, alpha: { start: 0.8, end: 0 }, tint: 0xffffff })
        case 'splash':
          return this.burst('splash', x, y, 14, { frame: 'drop', speed: { min: 30, max: 80 }, angle: { min: 200, max: 340 }, gravityY: 260, lifespan: 520, tint: 0x6ab4ff })
        case 'fire_burst':
          return this.burst('fire', x, y, 16, { frame: 'spark', speed: { min: 20, max: 70 }, lifespan: 520, scale: { start: 1, end: 0.2 }, color: [0xffe066, 0xff8a1a, 0xc9301a] })
        case 'sparks':
          return this.burst('sparks', x, y, 16, { frame: 'spark', speed: { min: 60, max: 130 }, lifespan: 260, tint: 0xfff27a })
        case 'frost':
          return this.burst('frost', x, y, 14, { frame: 'flake', speed: { min: 15, max: 55 }, lifespan: 750, alpha: { start: 1, end: 0 }, tint: 0xd8f6ff })
        case 'smoke':
          return this.burst('smoke', x, y, 8, { frame: 'smoke', speedY: { min: -30, max: -12 }, lifespan: 1300, scale: { start: 0.6, end: 2 }, alpha: { start: 0.55, end: 0 }, tint: 0x6a6a6a })
        case 'poof':
          return this.burst('poof', x, y, 10, { frame: 'smoke', speed: { min: 20, max: 50 }, lifespan: 420, scale: { start: 0.5, end: 1.2 }, alpha: { start: 0.9, end: 0 }, tint: 0xf0f0f0 })
        case 'heal':
          return this.burst('heal', x, y, 9, { frame: 'star', speedY: { min: -40, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 800, tint: 0x7dff9a })
        case 'hit':
          return this.burst('hit', x, y, 6, { frame: 'star', speed: { min: 40, max: 90 }, lifespan: 180, tint: 0xffffff })
        case 'explosion':
          this.burst('fire', x, y, 34, { frame: 'spark', speed: { min: 20, max: 70 }, lifespan: 520, scale: { start: 1, end: 0.2 }, color: [0xffe066, 0xff8a1a, 0xc9301a] })
          this.cameras.main.shake(160, 0.004)
          return this.burst('smoke', x, y, 12, { frame: 'smoke', speedY: { min: -30, max: -12 }, lifespan: 1300, scale: { start: 0.6, end: 2 }, alpha: { start: 0.55, end: 0 }, tint: 0x6a6a6a })
        case 'leaves':
          return this.burst('leaves', x, y, 12, { frame: 'leaf', speed: { min: 20, max: 60 }, gravityY: 70, lifespan: 950, tint: 0x6abe30, rotate: { min: 0, max: 360 } })
        case 'dust':
          return this.burst('dust', x, y, 10, { frame: 'dot', speed: { min: 10, max: 40 }, lifespan: 500, alpha: { start: 0.8, end: 0 }, tint: 0xb09a70 })
        case 'sparkle':
          return this.burst('sparkle', x, y, 10, { frame: 'star', speed: { min: 10, max: 40 }, lifespan: 700, tint: 0xffe98a })
        case 'gust':
          return this.burst('gust', x, y, 14, { frame: 'dot', speed: { min: 80, max: 150 }, lifespan: 300, alpha: { start: 0.8, end: 0 }, tint: 0xeafff4 })
        case 'shatter':
          return this.burst('shatter', x, y, 16, { frame: 'flake', speed: { min: 60, max: 120 }, gravityY: 180, lifespan: 600, tint: 0xbfe6f5 })
        case 'swing': {
          const [dx, dy] = dirVec(a)
          const g = this.add.graphics().setDepth(1e6)
          g.lineStyle(2, 0xffffff, 0.9)
          g.beginPath()
          g.arc(x + dx * 10, y + dy * 10, 7, Math.atan2(dy, dx) - 1.1, Math.atan2(dy, dx) + 1.1)
          g.strokePath()
          this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() })
          return
        }
        case 'bolt': {
          const [dx, dy] = dirVec(b)
          const len = Number(c) || 1
          const color = ELEMENT_COLOR[a] ?? 0xffffff
          const p = this.add.image(x, y, this.tex.particles(), 'star').setTint(color).setDepth(1e6).setScale(1.4)
          const trail = this.add.particles(0, 0, this.tex.particles(), { frame: 'dot', follow: p, lifespan: 220, speed: 8, scale: { start: 1, end: 0 }, tint: color, frequency: 16 }).setDepth(1e6 - 1)
          this.tweens.add({
            targets: p,
            x: x + dx * len * TILE,
            y: y + dy * len * TILE,
            duration: 40 * len + 40,
            onComplete: () => {
              p.destroy()
              this.time.delayedCall(240, () => trail.destroy())
            },
          })
          return
        }
      }
    }
    if (fx.t === 'mapChanged') this.cameras.main.fadeIn(250, 8, 10, 16)
  }
}

function dirVec(d: string): [number, number] {
  return d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0]
}

export function textOf(t: Text | undefined, locale: 'en' | 'zh'): string {
  if (t === undefined) return ''
  if (typeof t === 'string') return t
  return (locale === 'zh' ? t.zh : undefined) ?? t.en
}
