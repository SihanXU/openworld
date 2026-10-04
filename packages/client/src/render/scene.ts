// The world view, drawn with the Ninja Adventure pack: autotiled ground, terrain objects
// (trees, rocks…) that follow terrain state, prefab buildings, room frames, animated actors,
// status overlays, VFX and day/night. It only renders engine snapshots.

import Phaser from 'phaser'
import type { Aim, Dir, EntitySnap, Frame, FxEvent, MapData, Ref, Text } from '@lsw/engine'
import { CATALOG } from '../assets/catalog.ts'
import { GroundAtlas, T, groundTile, hash2 } from '../assets/ground.ts'
import type { SpriteDef } from '../assets/types.ts'
import { DIR_COL, actorFrames, assetUrl, fxAnim, preloadCatalog, spriteFrames } from './assets.ts'

export interface SceneHooks {
  onFx(fx: FxEvent, frame: Frame): void
  onFrame(frame: Frame): void
  onMap?(map: MapData): void
  onReady?(): void
}

interface EView {
  snap: EntitySnap
  root: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Sprite
  shadow?: Phaser.GameObjects.Ellipse
  overlay?: Phaser.GameObjects.Sprite
  overlayName?: string
  held?: Phaser.GameObjects.Image
  hp: Phaser.GameObjects.Graphics
  glow?: Phaser.GameObjects.Image
  key: string
  movingUntil: number
  phase: number
  /** The quest mark over a person ('!' a quest to give, '?' one to take back). */
  quest?: { mark: string; text: Phaser.GameObjects.Text }
  /** The player: the tile it walks to; drawn chasing it at the walking pace (walk()). */
  walker?: { x: number; y: number; t: number }
  /** A flyer (a companion): where it heads; it is drawn gliding there, not stepped tile by tile. */
  flyer?: { x: number; y: number; t: number }
  actor?: { key: string; rows: number; cols: number; tint?: number; scale?: number }
  /** The dragon's parts round its head: wings on the head's container, body and tail trailing it in the world. */
  dragon?: { wings: Phaser.GameObjects.Image[]; segments: Phaser.GameObjects.Image[]; trail: { x: number; y: number }[] }
}

/** How far apart (px) the dragon's body segments trail, and how many there are (the last is the tail). */
const DRAGON_GAP = 11
const DRAGON_SEGMENTS = 5

const OVERLAY_OF: [string, string][] = [
  ['burning', 'ovl:burning'],
  ['frozen', 'ovl:frozen'],
  ['electrified', 'ovl:electrified'],
  ['wet', 'ovl:wet'],
  ['oiled', 'ovl:oiled'],
]
// The engine's DIRS, kept here so the main thread does not bundle the engine.
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** Terrain objects and decor groups that grow loose: drawn a few pixels off the tile grid. */
const LOOSE = new Set(['drygrass', 'flowers', 'bush'])
const TINT_OF: Record<string, number> ={ frozen: 0xbfe9ff, burning: 0xffc9a0, wet: 0xc8dcff, electrified: 0xfff6a0, oiled: 0xb9b29a }
const ELEMENT_COLOR: Record<string, number> = { fire: 0xff7a1a, ice: 0x9fe8ff, lightning: 0xfff27a, water: 0x4aa0ff, wind: 0xe8fff4, earth: 0xb08850, none: 0xffffff }

/** A stable hash of a string (an entity's id), salted. */
function hashStr(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export class WorldScene extends Phaser.Scene {
  hooks!: SceneHooks
  private atlas!: GroundAtlas
  private groundKey = 'ground'
  private tilemap?: Phaser.Tilemaps.Tilemap
  private layer?: Phaser.Tilemaps.TilemapLayer
  private base?: MapData
  private overrides = new Map<string, string>() // "x,y" -> terrain
  private statics: Phaser.GameObjects.GameObject[] = []
  private objects = new Map<string, Phaser.GameObjects.Image>() // terrain objects by "x,y"
  private views = new Map<string, EView>()
  private tileFx = new Map<string, { sprites: Phaser.GameObjects.GameObject[]; sig: string }>()
  private night!: Phaser.GameObjects.Rectangle
  // weather (outdoors): rain streaks, fog, the flash of a strike
  private rainG?: Phaser.GameObjects.Graphics
  private fogR?: Phaser.GameObjects.Rectangle
  private flash?: Phaser.GameObjects.Rectangle
  private drops: { x: number; y: number; v: number; len: number }[] = []
  private weather = 'sun'
  private playerId = 'player'
  private ready = false
  private pending: { map?: MapData; frames: Frame[] } = { frames: [] }
  private following?: Phaser.GameObjects.Container
  private focus?: Phaser.GameObjects.Graphics
  private bossWarnings?: Phaser.GameObjects.Graphics
  private darkness = 0
  private music?: Phaser.Sound.BaseSound
  private musicKey?: string
  muted = false

  constructor() {
    super('world')
  }

  preload(): void {
    preloadCatalog(this, CATALOG)
    const bar = this.add.rectangle(this.scale.width / 4, this.scale.height / 2, 1, 6, 0xf0b85a).setOrigin(0, 0.5)
    this.preloadBar = bar
    this.load.on('progress', this.onPreloadProgress, this)
  }

  private preloadBar?: Phaser.GameObjects.Rectangle
  private onPreloadProgress(p: number): void {
    if (this.preloadBar?.active) this.preloadBar.setSize(Math.max(1, (this.scale.width / 2) * p), 6)
  }

  create(): void {
    this.load.off('progress', this.onPreloadProgress, this)
    this.preloadBar?.destroy()
    this.preloadBar = undefined
    const images: Record<string, HTMLImageElement> = {}
    for (const b of Object.values(CATALOG.blobs)) images[b.img] = this.textures.get(b.img).getSourceImage() as HTMLImageElement
    for (const [img] of Object.values(CATALOG.plain).flat()) images[img] = this.textures.get(img).getSourceImage() as HTMLImageElement
    for (const list of Object.values(CATALOG.plain)) for (const [img] of list) images[img] = this.textures.get(img).getSourceImage() as HTMLImageElement
    this.atlas = new GroundAtlas(CATALOG, images)
    this.textures.addCanvas(this.groundKey, this.atlas.canvas)
    this.makeGlowTexture()
    this.cameras.main.setZoom(this.fitZoom()).setRoundPixels(true).setBackgroundColor('#0b0d12')
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(this.fitZoom())
      this.fitBounds()
    })
    this.night = this.add.rectangle(-4000, -4000, 8000, 8000, 0x0a1030, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7)
    this.fogR = this.add.rectangle(-4000, -4000, 8000, 8000, 0xd8e2ea, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7 - 2)
    this.rainG = this.add.graphics().setScrollFactor(0).setDepth(1e7 - 1)
    this.flash = this.add.rectangle(-4000, -4000, 8000, 8000, 0xf4f8ff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7 + 1)
    this.ready = true
    this.hooks.onReady?.()
    if (this.pending.map) this.setMap(this.pending.map)
    for (const f of this.pending.frames) this.applyFrame(f)
    this.pending = { frames: [] }
  }

  private fitZoom(): number {
    const h = this.scale.height || window.innerHeight
    const w = this.scale.width || window.innerWidth
    return Math.max(2, Math.min(4, Math.floor(Math.min(h / (T * 13), w / (T * 20)))))
  }

  private fitBounds(): void {
    if (!this.base) return
    const cam = this.cameras.main
    const mw = this.base.width * T
    const mh = this.base.height * T
    const vw = cam.width / cam.zoom
    const vh = cam.height / cam.zoom
    const bw = Math.max(mw, vw)
    const bh = Math.max(mh, vh)
    cam.setBounds(-(bw - mw) / 2, -(bh - mh) / 2, bw, bh)
  }

  // ---------------------------------------------------------------- map

  private terrainAt = (x: number, y: number): string => {
    const m = this.base!
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) {
      // outside the map: continue the edge so autotiles don't draw a border there
      const cx = Math.min(m.width - 1, Math.max(0, x))
      const cy = Math.min(m.height - 1, Math.max(0, y))
      return this.overrides.get(`${cx},${cy}`) ?? m.terrain[cy * m.width + cx]
    }
    return this.overrides.get(`${x},${y}`) ?? m.terrain[y * m.width + x]
  }

  setMap(map: MapData): void {
    if (!this.ready) {
      this.pending.map = map
      this.pending.frames = []
      return
    }
    this.cameras.main.fadeIn(220, 8, 10, 16)
    for (const v of this.views.values()) this.destroyView(v)
    this.views.clear()
    for (const t of this.tileFx.values()) t.sprites.forEach((s) => s.destroy())
    this.tileFx.clear()
    for (const o of this.statics) o.destroy()
    this.statics = []
    for (const o of this.objects.values()) o.destroy()
    this.objects.clear()
    this.overrides.clear()
    this.following = undefined
    this.focus?.destroy()
    this.focus = undefined
    this.layer?.destroy()
    this.tilemap?.destroy()
    this.base = map
    const data: number[][] = []
    for (let y = 0; y < map.height; y++) {
      const row: number[] = []
      for (let x = 0; x < map.width; x++) row.push(groundTile(this.atlas, CATALOG, this.terrainAt, x, y, this.base?.light === 'dark'))
      data.push(row)
    }
    this.refreshGround()
    this.tilemap = this.make.tilemap({ data, tileWidth: T, tileHeight: T })
    const ts = this.tilemap.addTilesetImage(this.groundKey, this.groundKey, T, T, 0, 0)!
    this.layer = this.tilemap.createLayer(0, ts, 0, 0) as Phaser.Tilemaps.TilemapLayer
    this.layer.setDepth(-100)
    // decals, terrain objects, prefab stamps, room frames
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        this.placeObject(x, y)
        const t = map.terrain[y * map.width + x]
        if ((t === 'grass' || t === 'flowers') && hash2(x, y, 7) % 100 < (t === 'flowers' ? 70 : 9)) this.decal(x, y, t)
      }
    for (const s of map.stamps ?? []) this.stamp(s.key, s.x, s.y)
    for (const r of map.rooms ?? []) this.roomFrame(r.style, r.x, r.y, r.w, r.h)
    this.fitBounds()
    this.playMusic(map.music)
    this.hooks.onMap?.(map)
  }

  private refreshGround(): void {
    const tex = this.textures.get(this.groundKey) as Phaser.Textures.CanvasTexture
    tex.refresh?.()
  }

  private decal(x: number, y: number, t: string): void {
    const list = CATALOG.decals[t === 'flowers' ? 'flowers' : 'grass'] ?? CATALOG.decals.grass
    if (!list?.length) return
    const d = list[hash2(x, y, 3) % list.length]
    const img = this.addSprite(`decal:${t}:${list.indexOf(d)}`, d, x, y)
    img.setDepth(-50)
    this.statics.push(img)
  }

  /** Place a SpriteDef so its anchor sits at the bottom-centre of tile (x,y). */
  private addSprite(key: string, d: SpriteDef, x: number, y: number): Phaser.GameObjects.Image {
    const [frame] = spriteFrames(this, key, d)
    return this.add.image(x * T + T / 2, (y + 1) * T, d.img, frame).setOrigin(d.ax / d.w, d.ay / d.h)
  }

  private placeObject(x: number, y: number): void {
    const k = `${x},${y}`
    this.objects.get(k)?.destroy()
    this.objects.delete(k)
    const t = this.terrainAt(x, y)
    const list = CATALOG.terrainObjects[t]
    if (!list?.length) return
    // tall grass is a meadow, not a crop: a third of its tiles stay bare
    if (t === 'drygrass' && hash2(x, y, 13) % 100 < 35) return
    const i = hash2(x, y, 11) % list.length
    const img = this.addSprite(`tobj:${t}:${i}`, list[i], x, y)
    img.setDepth((y + 1) * T - 1)
    if (t === 'drygrass') img.setTint(0xe8cf7a)
    // loose growth (tall grass, flowers, bushes) sits a little off the grid, never in rows
    if (LOOSE.has(t)) img.setPosition(img.x + (hash2(x, y, 17) % 9) - 4, img.y + (hash2(x, y, 19) % 5) - 2)
    this.objects.set(k, img)
  }

  private stamp(key: string, x: number, y: number): void {
    const p = CATALOG.prefabs[key]
    if (!p) return
    const tex = this.textures.get(p.img)
    const name = `prefab:${key}`
    if (!tex.has(name)) tex.add(name, 0, p.x, p.y, p.tw * T, p.th * T)
    let lastSolid = 0
    p.grid.forEach((row, j) => /[#D]/.test(row) && (lastSolid = j))
    const img = this.add.image(x * T, y * T, p.img, name).setOrigin(0, 0).setDepth((y + lastSolid + 1) * T - 2)
    this.statics.push(img)
  }

  private roomFrame(style: string, x: number, y: number, w: number, h: number): void {
    const r = CATALOG.rooms[style] ?? Object.values(CATALOG.rooms)[0]
    if (!r) return
    const tex = this.textures.get(r.img)
    const s = r.size
    const piece = (sc: number, sr: number, dx: number, dy: number) => {
      const name = `room:${style}:${sc},${sr}`
      if (!tex.has(name)) tex.add(name, 0, (r.col + sc) * T, (r.row + sr) * T, T, T)
      const img = this.add.image((x + dx) * T, (y + dy) * T, r.img, name).setOrigin(0, 0).setDepth(dy === h - 1 ? (y + dy + 1) * T + 1 : -40)
      this.statics.push(img)
    }
    const mid = (i: number, _len: number) => 1 + ((i - 1) % (s - 2)) // cycle the edge's middle tiles 1,2,3,1,2,3
    for (let dx = 0; dx < w; dx++)
      for (let dy = 0; dy < h; dy++) {
        const left = dx === 0
        const right = dx === w - 1
        const top = dy === 0
        const bottom = dy === h - 1
        if (!(left || right || top || bottom)) continue
        if (this.terrainAt(x + dx, y + dy) === 'door') continue
        const sc = left ? 0 : right ? s - 1 : mid(dx, w)
        const sr = top ? 0 : bottom ? s - 1 : mid(dy, h)
        piece(sc, sr, dx, dy)
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
    this.bossWarnings ??= this.add.graphics().setDepth(-20)
    this.bossWarnings.clear()
    for (const e of f.entities) if (e.boss?.warning) {
      const warning = e.boss.warning, color = e.boss.color
      for (const [x, y] of warning.tiles) {
        this.bossWarnings.fillStyle(color, 0.13 + warning.progress * 0.24).fillRect(x * T + 1, y * T + 1, T - 2, T - 2)
        this.bossWarnings.lineStyle(1, color, 0.6 + warning.progress * 0.4).strokeRect(x * T + 1, y * T + 1, T - 2, T - 2)
        this.bossWarnings.fillStyle(0xffeee0, warning.progress).fillRect(x * T + 7, y * T + 7, 2, 2)
      }
    }
    const seen = new Set<string>()
    for (const e of f.entities) {
      seen.add(e.id)
      const v = this.views.get(e.id)
      if (!v) this.views.set(e.id, this.makeView(e))
      else this.updateView(v, e)
    }
    for (const [id, v] of this.views) if (!seen.has(id)) (this.destroyView(v), this.views.delete(id))
    this.drawQuestMarks(f)
    const me = this.views.get(this.playerId)
    if (me && this.following !== me.root) {
      this.following = me.root
      this.cameras.main.startFollow(me.root, true, 0.2, 0.2)
    }
    // Frame the crown and the player's dodge floor together, reserving the encounter
    // plate and toolbar. Scale belongs to the actor, not to the camera.
    const sovereign = f.entities.find((e) => e.boss && (e.hp ?? 0) > 0 && Math.max(Math.abs(e.x - f.player.x), Math.abs(e.y - f.player.y)) <= 12)
    const view = sovereign && this.views.get(sovereign.id)
    let zoom = this.fitZoom(), offset = 0
    if (me && view) {
      const top = Math.min(me.root.y - T, view.root.y - view.body.displayHeight * 0.9)
      const bottom = Math.max(me.root.y, view.root.y)
      const span = Math.max(bottom - top, view.body.displayHeight * 0.9 + T)
      const compact = this.scale.height <= 800
      zoom = Math.min(zoom, Math.max(1.5, Math.floor((this.scale.height - (compact ? 240 : 300)) / span * 4) / 4))
      offset = me.root.y - ((top + bottom) / 2 - (compact ? 20 : 40) / zoom)
    }
    if (this.cameras.main.zoom !== zoom) { this.cameras.main.setZoom(zoom); this.fitBounds() }
    this.cameras.main.setFollowOffset(0, offset)
    // Tall silhouettes may overhang walkable cells behind their actual collision base.
    // Keep a backstabbing player and ground warnings legible through that overhang.
    if (me) for (const v of this.views.values()) if (v.snap.boss) {
      const behind = me.root.depth < v.root.depth && v.body.getBounds().contains(me.root.x, me.root.y - T / 2)
      v.body.setAlpha(behind ? 0.55 : 1)
    }
    this.drawFocus(f)
    for (const fx of f.fx) this.playFx(fx)
    this.weather = (this.base.light ?? 'outdoor') === 'outdoor' ? f.calendar.weather : 'sun'
    this.updateNight(f)
    this.hooks.onFrame(f)
    for (const fx of f.fx) this.hooks.onFx(fx, f)
  }

  /** A yellow "!" over people with a quest to give, "?" over those to hand one back to (bobbing). */
  private drawQuestMarks(f: Frame): void {
    const marks = f.quests?.marks ?? {}
    for (const [id, v] of this.views) {
      const mark = marks[id]
      if (v.quest && v.quest.mark !== mark) (v.quest.text.destroy(), (v.quest = undefined))
      if (!mark || v.quest) continue
      const text = this.add.text(0, -T * 1.45, mark, { fontFamily: 'Pixelify Sans, monospace', fontSize: '20px', color: '#ffd23f', stroke: '#3a2414', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5, 1).setResolution(2)
      text.setScale(0.5)
      v.root.add(text)
      this.tweens.add({ targets: text, y: -T * 1.45 - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      v.quest = { mark, text }
    }
  }

  /** Outline the tile the inputs aim at: the mouse's own or neighbour tile, or the one in front. */
  private drawFocus(f: Frame): void {
    const k = f.keys?.hands ?? f.keys?.take ?? f.keys?.use ?? f.keys?.put
    const [dx, dy] = STEP[f.player.facing]
    const tx = k ? k.x : f.player.x + dx
    const ty = k ? k.y : f.player.y + dy
    this.focus ??= this.add.graphics().setDepth(1e5)
    const ks = f.keys ? Object.values(f.keys).filter(Boolean) : []
    const unknown = ks.length > 0 && ks.every((v) => v!.unknown)
    this.focus.clear()
    if (f.scene || !f.keys) return
    this.focus.lineStyle(1, unknown ? 0xf0b85a : 0xffffff, 0.6).strokeRoundedRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1, 2)
  }

  /**
   * Where a screen point aims: its tile, and everything drawn at the point, top first — things
   * by id, trees and tall grass by their own tile (a canopy reaches over the tile behind it). The
   * test is the picture's own pixels, so a thing is met wherever it shows and nowhere else.
   */
  aimAtScreen(sx: number, sy: number): Aim | undefined {
    if (!this.base) return undefined
    const cam = this.cameras.main
    const wx = cam.worldView.x + sx / cam.zoom
    const wy = cam.worldView.y + sy / cam.zoom
    const hits: { ref: Ref; depth: number }[] = []
    for (const v of this.views.values()) if (this.drawnAt(v.body, wx, wy)) hits.push({ ref: { e: v.snap.id }, depth: v.root.depth })
    for (const [k, img] of this.objects) {
      if (!this.drawnAt(img, wx, wy)) continue
      const [x, y] = k.split(',').map(Number)
      hits.push({ ref: { tile: { map: this.base.id, x, y } }, depth: img.depth })
    }
    hits.sort((a, b) => b.depth - a.depth)
    return { x: Math.floor(wx / T), y: Math.floor(wy / T), stack: hits.map((h) => h.ref) }
  }

  /** Is a picture's own (not transparent) pixel at this world point? */
  private drawnAt(o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, wx: number, wy: number): boolean {
    if (!o.visible || !o.frame) return false
    const p = o.getWorldTransformMatrix().applyInverse(wx, wy)
    const fx = Math.floor(p.x + o.displayOriginX)
    const fy = Math.floor(p.y + o.displayOriginY)
    if (fx < 0 || fy < 0 || fx >= o.frame.width || fy >= o.frame.height) return false
    return this.textures.getPixelAlpha(o.flipX ? o.frame.width - 1 - fx : fx, o.flipY ? o.frame.height - 1 - fy : fy, o.texture.key, o.frame.name) > 0
  }

  /** The map on screen (for the menu's map tab). */
  currentMap(): MapData | undefined {
    return this.base
  }

  private lastStep = 0
  /** The player's steps come every 1–2 ticks when hasted (fractional cadence): their glide follows the running average, so the walk keeps an even speed. */
  private stepAvg = 200

  private applyTiles(f: Frame): void {
    const now = new Map<string, string>()
    const statusNow = new Map<string, string[]>()
    for (const t of f.tiles) {
      if (t.terrain) now.set(`${t.x},${t.y}`, t.terrain)
      if (t.statuses?.length) statusNow.set(`${t.x},${t.y}`, t.statuses)
    }
    const dirty = new Set<string>()
    for (const [k, terrain] of now) if (this.overrides.get(k) !== terrain) (this.overrides.set(k, terrain), dirty.add(k))
    for (const k of [...this.overrides.keys()]) if (!now.has(k)) (this.overrides.delete(k), dirty.add(k))
    if (dirty.size) {
      const redo = new Set<string>()
      for (const k of dirty) {
        const [x, y] = k.split(',').map(Number)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) redo.add(`${x + dx},${y + dy}`)
        this.placeObject(x, y)
      }
      for (const k of redo) {
        const [x, y] = k.split(',').map(Number)
        if (x < 0 || y < 0 || x >= this.base!.width || y >= this.base!.height) continue
        this.layer!.putTileAt(groundTile(this.atlas, CATALOG, this.terrainAt, x, y, this.base?.light === 'dark'), x, y)
      }
      this.refreshGround()
    }
    for (const [k, list] of statusNow) {
      const sig = list.slice().sort().join('|')
      const cur = this.tileFx.get(k)
      if (cur?.sig === sig) continue
      cur?.sprites.forEach((s) => s.destroy())
      const [x, y] = k.split(',').map(Number)
      const sprites: Phaser.GameObjects.GameObject[] = []
      for (const [st, ov] of OVERLAY_OF) {
        if (!list.includes(st)) continue
        const s = this.overlaySprite(ov, x * T + T / 2, (y + 1) * T)
        if (s) {
          s.setDepth((y + 1) * T + (st === 'burning' ? 3 : -30)).setAlpha(st === 'wet' ? 0.7 : 1)
          sprites.push(s)
        }
        if (st === 'burning') sprites.push(this.add.image(x * T + 8, y * T + 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e7 + 1).setTint(0xff9a40).setScale(0.9))
        break
      }
      this.tileFx.set(k, { sprites, sig })
    }
    for (const [k, v] of this.tileFx) if (!statusNow.has(k)) (v.sprites.forEach((s) => s.destroy()), this.tileFx.delete(k))
  }

  private overlaySprite(name: string, x: number, y: number): Phaser.GameObjects.Sprite | undefined {
    const f = CATALOG.fx[name]
    if (!f) return undefined
    const anim = fxAnim(this, name, f, -1)
    const s = this.add.sprite(x, y, f.img).setOrigin(0.5, 1)
    if (f.scale) s.setScale(f.scale)
    if (f.add) s.setBlendMode(Phaser.BlendModes.ADD)
    s.play({ key: anim, startFrame: Math.floor(Math.random() * f.frames) })
    return s
  }

  // ---------------------------------------------------------------- entities

  private actorDef(e: EntitySnap): { key: string; def: (typeof CATALOG.characters)[string] } | undefined {
    if (e.appearance || e.look) {
      const role = e.type.split('/').pop()!
      const look = e.look ?? CATALOG.roles[role]?.[hash2(e.id.length, e.id.charCodeAt(e.id.length - 1)) % (CATALOG.roles[role]?.length || 1)]
      const key = look && CATALOG.characters[look] ? look : (CATALOG.roles.villager?.[0] ?? Object.keys(CATALOG.characters)[0])
      return { key: `char:${key}`, def: CATALOG.characters[key] }
    }
    const variant = e.element ?? e.type.split('/').pop()!
    const key = CATALOG.creatures[`${e.sprite}:${variant}`] ? `${e.sprite}:${variant}` : CATALOG.creatures[e.sprite] ? e.sprite : 'creature:slime'
    const def = CATALOG.creatures[key]
    return def ? { key: `cre:${key}`, def } : undefined
  }

  private textureFor(e: EntitySnap): { img: string; frame: string; ax: number; ay: number; actor?: EView['actor'] } {
    // a thing the world learned, with a picture of its own
    if (e.kind !== 'actor' && e.sprite?.startsWith('art:') && this.textures.exists(e.sprite)) return { img: e.sprite, frame: '__BASE', ax: 8, ay: 14 }
    if (e.kind === 'actor') {
      const a = this.actorDef(e)
      if (a) {
        const { img, fw, fh } = actorFrames(this, a.key, a.def)
        const col = e.boss || a.def.rows === 1 ? 0 : (DIR_COL[e.facing] ?? 0)
        return { img, frame: `${a.key}:${col},0`, ax: fw / 2, ay: a.def.anchorY ?? fh, actor: { key: a.key, rows: a.def.rows, cols: a.def.cols, tint: a.def.tint, scale: a.def.scale } }
      }
    }
    if (e.kind === 'fixture') {
      const f = this.fixtureDef(e)
      if (f) {
        // a look of its own among the type's variants, kept for its life
        const v = f.variants?.length ? hashStr(e.id) % f.variants.length : -1
        const d = ((e.statuses.includes('lit') || e.statuses.includes('attuned')) && f.lit) || (e.open && f.open) || (v >= 0 ? f.variants![v] : f.base)
        const [frame] = spriteFrames(this, `fix:${e.sprite}:${d === f.lit ? 'lit' : d === f.open ? 'open' : v >= 0 ? `v${v}` : 'base'}`, d)
        return { img: d.img, frame, ax: d.ax, ay: d.ay }
      }
    }
    const d = CATALOG.items[e.sprite] ?? CATALOG.items['item:bag'] ?? Object.values(CATALOG.items)[0]
    const [frame] = spriteFrames(this, `ico:${e.sprite}`, d)
    return { img: d.img, frame, ax: d.w / 2, ay: d.h - 2 }
  }

  private fixtureDef(e: EntitySnap): (typeof CATALOG.fixtures)[string] | undefined {
    return CATALOG.fixtures[e.sprite] ?? CATALOG.fixtures[`fixture:${e.type.split('/')[1]}`] ?? CATALOG.fixtures['fixture:fixture']
  }

  private makeView(e: EntitySnap): EView {
    const t = this.textureFor(e)
    const root = this.add.container(e.x * T + T / 2, (e.y + 1) * T)
    let shadow: Phaser.GameObjects.Ellipse | undefined
    if (e.kind === 'actor') {
      const [width, depth] = e.boss?.footprint ?? [1, 1]
      shadow = this.add.ellipse(0, -depth * 4, width * 11, depth * 6, 0x000000, 0.22)
      root.add(shadow)
    }
    const body = this.add.sprite(0, 0, t.img, t.frame)
    body.setOrigin(t.ax / body.width, t.ay / body.height)
    if (t.actor?.scale) body.setScale(t.actor.scale)
    if (e.kind === 'item') body.setScale(0.8)
    // small growth and litter sit a little off the grid, never in rows
    if (e.kind === 'fixture' && this.fixtureDef(e)?.loose) body.setPosition((hashStr(e.id, 23) % 9) - 4, (hashStr(e.id, 29) % 5) - 2)
    const hp = this.add.graphics()
    root.add([body, hp])
    const v: EView = { snap: e, root, body, shadow, hp, key: `${t.img}|${t.frame}`, movingUntil: 0, phase: Math.random() * 1000, actor: t.actor }
    if (e.sprite === 'boss:dragon') v.dragon = this.dragonParts(root, body)
    this.updateView(v, e, true)
    return v
  }

  /** The dragon composed (the pack draws it in parts): two wings behind the head, a body of segments and a tail in the world behind it. */
  private dragonParts(root: Phaser.GameObjects.Container, head: Phaser.GameObjects.Sprite): EView['dragon'] {
    const ui = CATALOG.ui
    const wings = [-1, 1].map((side) => {
      const w = this.add.image(side * 16, -30, ui.dragonWing.img).setOrigin(side < 0 ? 1 : 0, 0.75)
      if (side > 0) w.setFlipX(true)
      return w
    })
    root.addAt(wings, 1)
    root.bringToTop(head)
    const segments = Array.from({ length: DRAGON_SEGMENTS }, (_, i) => {
      const img = i === DRAGON_SEGMENTS - 1 ? ui.dragonTail.img : i % 2 ? ui.dragonBody2.img : ui.dragonBody1.img
      return this.add.image(root.x, root.y, img).setOrigin(0.5, 0.8)
    })
    return { wings, segments, trail: [] }
  }

  /** Wings beat; the body follows the way the head has come, and curls behind it at rest. */
  private updateDragon(v: EView, time: number): void {
    const d = v.dragon!
    const beat = Math.sin((time + v.phase) / 160)
    d.wings.forEach((w, i) => w.setAngle((i ? 1 : -1) * (8 + beat * 14)).setScale(1, 0.9 + 0.1 * beat))
    const head = { x: v.root.x, y: v.root.y - 6 }
    const last = d.trail[0]
    if (!last || Math.hypot(last.x - head.x, last.y - head.y) >= 2) d.trail.unshift(head)
    d.trail.length = Math.min(d.trail.length, DRAGON_SEGMENTS * DRAGON_GAP + 2)
    d.segments.forEach((s, i) => {
      // along the trail, or where it would lie curled behind a head that has not moved yet
      const p = d.trail[Math.round(((i + 1) * DRAGON_GAP) / 2)] ?? { x: head.x + Math.sin(i * 0.9) * 10, y: head.y + (i + 1) * 9 }
      s.setPosition(p.x, p.y + Math.sin((time + v.phase) / 300 + i) * 1.2)
      s.setDepth(v.root.depth - 1 - i * 0.01)
    })
  }

  private updateView(v: EView, e: EntitySnap, first = false): void {
    const prev = v.snap
    v.snap = e
    const px = e.x * T + T / 2
    const py = (e.y + 1) * T
    // a flyer glides toward where it is (update()); only a long way off does it appear there at once
    if (e.tags.includes('companion')) {
      if (first || !v.flyer || Math.max(Math.abs(prev.x - e.x), Math.abs(prev.y - e.y)) > 6) v.root.setPosition(px, py)
      v.flyer = { x: px, y: py, t: v.flyer?.t ?? this.time.now }
    } else if (!first && (prev.x !== e.x || prev.y !== e.y)) {
      // one step, straight or diagonal, slides; anything farther jumps
      const far = Math.max(Math.abs(prev.x - e.x), Math.abs(prev.y - e.y)) > 1
      this.tweens.killTweensOf(v.root)
      if (far) {
        v.root.setPosition(px, py)
        if (v.walker) v.walker = { x: px, y: py, t: this.time.now }
      }
      else {
        const now = this.time.now
        const gap = now - this.lastStep
        if (e.id === this.playerId) {
          this.lastStep = now
          // a pause (a stop, a turn) does not count toward the walking pace
          if (gap < 400) this.stepAvg = this.stepAvg * 0.75 + gap * 0.25
        }
        if (e.id === this.playerId) {
          // the player is not tweened step by step: walk() chases the tile at the walking pace
          v.walker = { x: px, y: py, t: v.walker?.t ?? now }
          v.movingUntil = now + this.stepAvg
        } else {
          const dur = e.tags.includes('companion') ? 110 : e.kind === 'actor' && (e.look || e.appearance) ? 380 : 330
          this.tweens.add({ targets: v.root, x: px, y: py, duration: dur, ease: 'Linear' })
          v.movingUntil = this.time.now + dur
        }
      }
    }
    if (e.kind !== 'actor') {
      const t = this.textureFor(e)
      const k = `${t.img}|${t.frame}`
      if (k !== v.key) {
        v.key = k
        v.body.setTexture(t.img, t.frame)
        v.body.setOrigin(t.ax / v.body.width, t.ay / v.body.height)
      }
    } else if (!v.actor || (prev.type !== e.type && !first)) {
      const t = this.textureFor(e)
      v.actor = t.actor
      v.body.setTexture(t.img, t.frame)
      v.body.setScale(t.actor?.scale ?? 1)
    }
    // items lie on top of the fixture sharing their tile (a table, a counter), under actors
    // what lies flat on the ground (moss, leaves, pebbles) is under all that stands
    v.root.setDepth(e.kind === 'fixture' && this.fixtureDef(e)?.ground ? -45 : py + (e.kind === 'actor' ? 2 : e.kind === 'item' ? 1 : 0))
    // status overlay + tint
    const top = OVERLAY_OF.find(([s]) => e.statuses.includes(s))
    const want = top?.[1]
    if (want !== v.overlayName) {
      v.overlay?.destroy()
      v.overlay = undefined
      v.overlayName = want
      if (want) {
        v.overlay = this.overlaySprite(want, 0, 0)
        if (v.overlay) v.root.add(v.overlay)
      }
    }
    const tintStatus = e.statuses.find((s) => TINT_OF[s])
    if (tintStatus) v.body.setTint(TINT_OF[tintStatus]).setTintMode(Phaser.TintModes.MULTIPLY)
    else if (v.actor?.tint) v.body.setTint(v.actor.tint).setTintMode(Phaser.TintModes.OVERLAY)
    else v.body.clearTint()
    // a thing an act waits on shimmers; one who is down lies on the ground
    v.body.setAlpha(e.frozen && e.kind !== 'actor' ? 0.75 : 1)
    v.body.setAngle(!e.boss && e.statuses.includes('down') ? 90 : 0)
    // held item (small, at the hand)
    if (e.held && e.kind === 'actor') {
      const d = CATALOG.items[e.held]
      if (d) {
        const [frame] = spriteFrames(this, `ico:${e.held}`, d)
        if (!v.held) {
          v.held = this.add.image(6, -5, d.img, frame).setScale(0.55)
          v.root.add(v.held)
        } else v.held.setTexture(d.img, frame)
      }
    } else if (v.held) (v.held.destroy(), (v.held = undefined))
    // lights glow at night
    const lit = e.statuses.includes('lit') || e.statuses.includes('burning') || e.statuses.includes('attuned') || (e.id === this.playerId && e.heldTags?.includes('light'))
    if (lit && !v.glow) v.glow = this.add.image(px, py - 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e7 + 1).setTint(0xffb050)
    if (!lit && v.glow) (v.glow.destroy(), (v.glow = undefined))
    // hp bar
    v.hp.clear()
    if (e.kind === 'actor' && !e.boss && e.maxHp && e.hp !== undefined && (e.hp < e.maxHp || e.hostile) && e.id !== this.playerId) {
      const w = 14
      const top2 = -v.body.displayHeight - 3
      v.hp.fillStyle(0x000000, 0.6).fillRect(-w / 2, top2, w, 2)
      v.hp.fillStyle(e.hostile ? 0xe04848 : 0x6ad06a, 1).fillRect(-w / 2, top2, Math.max(1, (w * e.hp) / e.maxHp), 2)
    }
  }

  private destroyView(v: EView): void {
    this.tweens.killTweensOf(v.root)
    v.glow?.destroy()
    for (const s of v.dragon?.segments ?? []) s.destroy()
    v.root.destroy()
  }

  /**
   * The player's sprite chases its tile at the walking pace (a tile per average step), a little
   * faster the further behind it is. Steps come every one or two ticks when hasted (fractional
   * cadence); stepping a tween per step made it stop and lurch, this keeps it moving evenly and
   * never more than about a tile and a half behind.
   */
  private walk(v: EView, time: number): void {
    const w = v.walker!
    const dt = Math.min(100, time - w.t)
    w.t = time
    const dx = w.x - v.root.x
    const dy = w.y - v.root.y
    const lag = Math.hypot(dx, dy) / T
    if (lag < 0.001) return
    const speed = (1 / Math.max(60, Math.min(320, this.stepAvg))) * Math.max(0.4, 1 + 0.3 * (lag - 0.9))
    const step = Math.min(lag, speed * dt)
    v.root.x += (dx / lag) * step
    v.root.y += (dy / lag) * step
  }

  /**
   * A flyer eases toward where it is going (fast when far, slow as it arrives), bobs as it flies,
   * and turns to face the way it goes.
   */
  private glide(v: EView, time: number): void {
    const f = v.flyer!
    const dt = Math.min(100, time - f.t)
    f.t = time
    const dx = f.x - v.root.x
    const dy = f.y - v.root.y
    const a = 1 - Math.exp(-dt / 330)
    v.root.x += dx * a
    v.root.y += dy * a
    if (Math.abs(dx) > 2) v.body.setFlipX(dx < 0)
    // aloft: a little above the ground, rising and falling with its wingbeats
    v.body.y = -4 - Math.sin((time + v.phase) / 210) * 1.5
  }

  update(time: number): void {
    this.drawWeather(time)
    for (const v of this.views.values()) {
      const e = v.snap
      if (v.flyer) this.glide(v, time)
      if (v.walker) this.walk(v, time)
      if (v.actor && e.boss) {
        const { action, progress } = e.boss
        const row = action === 'idle' ? 0 : action === 'walk' ? 1 : action === 'attack' ? 2 : action === 'cast' ? 3 : 4
        const col = action === 'death' ? progress < 0.6 ? 2 : 3 : action === 'hurt' ? Math.floor(time / 100) % 2
          : action === 'idle' || action === 'walk' ? Math.floor((time + v.phase) / (action === 'walk' ? 150 : 260)) % 4
          : Math.min(3, Math.floor(progress * 4))
        v.body.setFrame(`${v.actor.key}:${col},${row}`).setFlipX(e.facing === 'left')
      } else if (v.actor && v.actor.rows === 1) {
        // single-row strips (bosses): animate across the columns
        v.body.setFrame(`${v.actor.key}:${Math.floor((time + v.phase) / 140) % v.actor.cols},0`)
      } else if (v.actor) {
        const moving = time < v.movingUntil
        const col = DIR_COL[e.facing] ?? 0
        const walkRows = Math.min(4, v.actor.rows)
        // working something out (an act the world is learning): busy hands in place, a little bob
        const working = e.frozen && !e.statuses.includes('down')
        const row = moving ? Math.floor((time + v.phase) / 130) % walkRows : working ? Math.floor(time / 110) % walkRows : e.look || e.appearance ? 0 : Math.floor((time + v.phase) / 260) % walkRows
        v.body.setFrame(`${v.actor.key}:${col},${row}`)
        v.body.y = working ? -Math.abs(Math.sin(time / 95)) * 1.5 : 0
      }
      if (v.dragon) this.updateDragon(v, time)
      if (v.glow) v.glow.setPosition(v.root.x, v.root.y - 8).setAlpha(this.darkness * 1.4 * (0.85 + 0.15 * Math.sin((time + v.phase) / 120)))
    }
    for (const t of this.tileFx.values())
      for (const s of t.sprites) if (s instanceof Phaser.GameObjects.Image && s.texture.key === 'glow') s.setAlpha(this.darkness * 1.2)
  }

  screenOf(id: string): { x: number; y: number } | undefined {
    const v = this.views.get(id)
    if (!v) return undefined
    const cam = this.cameras.main
    return { x: (v.root.x - cam.worldView.x) * cam.zoom, y: (v.root.y - v.body.displayHeight * 0.6 - cam.worldView.y) * cam.zoom }
  }

  screenOfTile(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main
    return { x: (x * T + 8 - cam.worldView.x) * cam.zoom, y: (y * T + 8 - cam.worldView.y) * cam.zoom }
  }

  lookOf(id: string): { img: string; frame: string } | undefined {
    const v = this.views.get(id)
    if (!v?.actor) return undefined
    return { img: v.body.texture.key, frame: `${v.actor.key}:0,0` }
  }

  facesetOf(id: string): string | undefined {
    const v = this.views.get(id)
    if (!v?.actor) return undefined
    const key = v.actor.key.split(':').slice(1).join(':')
    const def = v.actor.key.startsWith('char:') ? CATALOG.characters[key] : CATALOG.creatures[key]
    return def?.faceset ? `${def.dir}/${def.faceset}` : undefined
  }

  // ---------------------------------------------------------------- light & sound

  private updateNight(f: Frame): void {
    const light = this.base?.light ?? 'outdoor'
    const h = f.hour
    let d = 0
    if (h >= 21 || h < 4.5) d = 0.6
    else if (h >= 18) d = ((h - 18) / 3) * 0.6
    else if (h < 7) d = ((7 - h) / 2.5) * 0.6
    if (light === 'dark') d = 0.55
    if (light === 'indoor') d *= 0.4
    // a grey day is a little darker
    const dim: Record<string, number> = { cloud: 0.1, rain: 0.16, storm: 0.26, fog: 0.06 }
    if (light === 'outdoor') d = Math.min(0.7, d + (dim[this.weather] ?? 0))
    this.darkness = d
    this.night.setFillStyle(light === 'dark' ? 0x05060c : 0x0a1030, d)
  }

  /** Rain and storm streaks across the screen; fog as a slow, breathing veil. */
  private drawWeather(time: number): void {
    const g = this.rainG
    if (!g) return
    g.clear()
    const w = this.scale.width
    const h = this.scale.height
    const n = this.weather === 'storm' ? 260 : this.weather === 'rain' ? 140 : 0
    while (this.drops.length < n) this.drops.push({ x: Math.random() * w, y: Math.random() * h, v: 9 + Math.random() * 6, len: 8 + Math.random() * 10 })
    if (this.drops.length > n) this.drops.length = n
    if (n) {
      g.lineStyle(1, 0xbfd4ff, this.weather === 'storm' ? 0.55 : 0.45)
      const slant = this.weather === 'storm' ? 0.45 : 0.22
      for (const d of this.drops) {
        d.y += d.v
        d.x += d.v * slant
        if (d.y > h || d.x > w) ((d.y = -d.len), (d.x = Math.random() * w - h * slant * 0.3))
        g.lineBetween(d.x, d.y, d.x - d.len * slant, d.y - d.len)
      }
    }
    this.fogR?.setFillStyle(0xd8e2ea, this.weather === 'fog' ? 0.22 + 0.06 * Math.sin(time / 2200) : 0)
  }

  private playMusic(mood?: string): void {
    const path = mood ? CATALOG.music[mood] : undefined
    if (!path || this.musicKey === path) return
    this.musicKey = path
    const key = `music:${mood}`
    const start = () => {
      if (this.musicKey !== path) return
      const old = this.music
      if (old) {
        // a quick second map change: its fade-in may still be running on the track we drop
        this.tweens.killTweensOf(old)
        if (old.isPlaying) this.tweens.add({ targets: old, volume: 0, duration: 600, onComplete: () => old.destroy() })
        else old.destroy()
      }
      this.music = this.sound.add(key, { loop: true, volume: 0 })
      if (!this.muted) {
        this.music.play()
        this.tweens.add({ targets: this.music, volume: 0.35, duration: 900 })
      }
    }
    if (this.cache.audio.exists(key)) start()
    else {
      this.load.audio(key, assetUrl(path))
      this.load.once('complete', start)
      this.load.start()
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.sound.mute = m
    if (!m && this.music && !this.music.isPlaying) this.music.play()
  }

  private sfxLoading = new Set<string>()
  sfx(name: string, volume = 0.5): void {
    if (this.muted) return
    const key = `sfx:${name}`
    if (this.cache.audio.exists(key)) return void this.sound.play(key, { volume })
    // first use: fetch it in the background; this one plays when it arrives (if still recent)
    const path = CATALOG.sfx[name]
    if (!path || this.sfxLoading.has(key)) return
    this.sfxLoading.add(key)
    const asked = this.time.now
    this.load.audio(key, assetUrl(path))
    this.load.once(`filecomplete-audio-${key}`, () => {
      this.sfxLoading.delete(key)
      if (!this.muted && this.time.now - asked < 600) this.sound.play(key, { volume })
    })
    this.load.start()
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

  private oneShot(name: string, x: number, y: number, opts: { angle?: number; tint?: number; depth?: number } = {}): Phaser.GameObjects.Sprite | undefined {
    const f = CATALOG.fx[name]
    if (!f) return undefined
    const anim = fxAnim(this, name, f, 0)
    const s = this.add.sprite(x, y, f.img).setDepth(opts.depth ?? 1e6)
    if (f.scale) s.setScale(f.scale)
    if (f.add) s.setBlendMode(Phaser.BlendModes.ADD)
    if (opts.angle) s.setAngle(opts.angle)
    if (opts.tint) s.setTint(opts.tint)
    s.play(anim)
    s.once('animationcomplete', () => s.destroy())
    return s
  }

  private static SFX_OF: Record<string, string> = {
    steam: 'water',
    splash: 'water',
    fire_burst: 'fire',
    sparks: 'thunder',
    frost: 'ice',
    explosion: 'explosion',
    heal: 'heal',
    hit: 'hit',
    poof: 'death',
    gust: 'wind',
    shatter: 'ice',
    sparkle: 'coin',
    dust: 'open',
  }

  playFx(fx: FxEvent): void {
    if (fx.t === 'strike') {
      // lightning: a flash over everything, then the bolt where it lands
      this.flash?.setAlpha(0.75)
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 320 })
      this.oneShot('sparks', fx.x * T + 8, fx.y * T + 8)
      return this.sfx('thunder', 0.7)
    }
    if (fx.t === 'vfx') {
      const x = fx.x * T + 8
      const y = fx.y * T + 8
      const [kind, a, b, c] = fx.fx.split(':')
      if (kind === 'swing') {
        const [dx, dy] = dirVec(a)
        this.oneShot('slash', x + dx * 10, y + dy * 10, { angle: (Math.atan2(dy, dx) * 180) / Math.PI })
        return this.sfx('attack', 0.35)
      }
      if (kind === 'bolt') {
        const [dx, dy] = dirVec(b)
        const len = Number(c) || 1
        const f = CATALOG.fx[`bolt:${a}`] ?? CATALOG.fx['bolt:none']
        this.sfx('cast', 0.35)
        if (!f) return
        const anim = fxAnim(this, `bolt:${a}`, f, -1)
        const p = this.add.sprite(x, y, f.img).setDepth(1e6).setAngle((Math.atan2(dy, dx) * 180) / Math.PI)
        if (f.add) p.setBlendMode(Phaser.BlendModes.ADD)
        if (f.scale) p.setScale(f.scale)
        p.play(anim)
        this.tweens.add({ targets: p, x: x + dx * len * T, y: y + dy * len * T, duration: 45 * len + 40, onComplete: () => p.destroy() })
        return
      }
      // Authored effects may have a namespaced key (sin:greed:stamp); keep the
      // complete key before falling back to the legacy colon-argument convention.
      const s = this.oneShot(CATALOG.fx[fx.fx] ? fx.fx : kind, x, y)
      if (!s) this.oneShot('poof', x, y, { tint: ELEMENT_COLOR[kind] })
      if (kind === 'explosion') this.cameras.main.shake(160, 0.004)
      const snd = WorldScene.SFX_OF[kind]
      if (snd) this.sfx(snd, 0.4)
      return
    }
    if (fx.t === 'mapChanged') return this.sfx('door', 0.4)
    if (fx.t === 'damage' && fx.who === this.playerId && fx.amount > 0) return this.sfx('hurt', 0.5)
    if (fx.t === 'undefined') return this.sfx('undefined', 0.6)
    if (fx.t === 'patched') return this.sfx('patched', 0.6)
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
