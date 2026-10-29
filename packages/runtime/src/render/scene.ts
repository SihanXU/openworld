// The world view, drawn with the Ninja Adventure pack: autotiled ground, terrain objects
// (trees, rocks…) that follow terrain state, prefab buildings, room frames, animated actors,
// status overlays, VFX and day/night. It only renders engine snapshots.

import Phaser from 'phaser'
import { cellId, type Aim, type Dir, type EntitySnap, type Frame, type FxEvent, type LightPool, type Look, type MapData, type Mood, type Ref, type RegionLook, type Text, type Vista, type WindupPose } from '@openworld/engine'
import { catalog, game, hasLooks, ontology } from '../game.ts'
import { Soundscape } from '../audio/soundscape.ts'
import { hexRgb, installWorldFilter, signalCamera } from './worldfilter.ts'
import { LSW_FLOOR, LSW_STAIRS, LSW_WALL } from '../assets/types.ts'
import { faceFrame, personLook } from '../assets/looks.ts'
import { crowdLook, figureDef, figureId, portraitOf, preparePortrait } from '../assets/figure/index.ts'
import { GroundAtlas, T, groundBeneath, groundTile, hash2, objectAt } from '../assets/ground.ts'
import { SLATE, paintRelief } from '../assets/relief.ts'
/** What a room's frame is drawn over: its walls (a door or a doorway through them is left open). */
const ROOM_WALL = new Set(['wall', 'woodwall', 'void'])
import { depthOf, footOf } from './depth.ts'
import { crackStage, pieceDepth, pieceState, piecesOf, type CellNow, type PieceDef, type PieceState, type TerrainFacts } from './pieces.ts'
import { prefs } from '../ui/common.ts'

/** How much higher a storey is drawn than the one below it (world-model.md §5.2): one tile, a wall's height. */
const STOREY_LIFT = T
import type { ActorDef, Catalog, SpriteDef } from '../assets/types.ts'
import { DIR_COL, actorFrames, assetUrl, fxAnim, preloadCatalog, spriteFrames } from './assets.ts'
import { BossAnimationClock, bossAnimationFrame } from './boss-animation.ts'
import { previewBoss, type BossPreviewMode } from '../boss-preview.ts'

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
  /** How far a posture sets the body down from where it stands (drawPose): seated, it sinks onto the seat. */
  poseDy?: number
  hp: Phaser.GameObjects.Graphics
  /** What shows over its head (the health bar, the quest mark, a sign of what it is): drawn over the world, following the body. */
  head: Phaser.GameObjects.Container
  /** The quest and role marks, placed above the body's current bounds and bobbed on their own. */
  markLayer?: Phaser.GameObjects.Container
  glow?: Phaser.GameObjects.Image
  key: string
  movingUntil: number
  phase: number
  /** Drawn in a wind-up's pose this moment (windupPose): set back when it ends. */
  posed?: boolean
  bossAnimation?: BossAnimationClock
  /** The quest mark over a person ('!' a quest to give, '?' one to take back). */
  quest?: { mark: string; text: Phaser.GameObjects.Text }
  /** What it is, over its head while no quest mark is: the catalogue's `<tag>Mark` for one of its tags. */
  role?: Phaser.GameObjects.Image
  /** The player: the tile it walks to; drawn chasing it at the walking pace (walk()). */
  walker?: { x: number; y: number; t: number }
  /** A flyer (a companion): where it heads; it is drawn gliding there, not stepped tile by tile. */
  flyer?: { x: number; y: number; t: number }
  actor?: { key: string; rows: number; cols: number; tint?: number; scale?: number; idleRow?: number; dir: string; clips?: ActorDef['clips'] }
  /** The dragon's parts round its head: wings on the head's container, body and tail trailing it in the world. */
  dragon?: { wings: Phaser.GameObjects.Image[]; segments: Phaser.GameObjects.Image[]; trail: { x: number; y: number }[] }
  /** A built thing's second picture: a wall block's top (one storey up), a raised floor's edge. */
  top?: Phaser.GameObjects.Image
  /** A raised floor's thickness, under a south edge nothing holds up (a balcony). */
  lip?: Phaser.GameObjects.Image
  /** A built wall's cracks as it loses durability (pieces.ts crackStage). */
  crack?: Phaser.GameObjects.Image
  /** Part of what hides the player (a wall's front, a floor overhead): see-through. */
  fadeFront?: boolean
  /** Standing in front of the player and over them (a statue, a dead tree): faded (fadeOver). */
  over?: boolean
}

/** A building's picture stamped on the map, cut into pieces bound to its cells (pieces.ts). */
interface StampView {
  p: import('../assets/types.ts').PrefabDef
  x: number
  y: number
  pieces: PieceView[]
}

/** A piece of a building's picture or a room's frame: its image, how it shows its cell now, what it wears for that. */
interface PieceView {
  def: PieceDef
  img: Phaser.GameObjects.Image
  /** Its building (a room's frame piece keeps its own order). */
  stamp?: StampView
  state?: PieceState
  sig?: string
  /** Its cracks, over it. */
  crack?: Phaser.GameObjects.Image
  /** Gone, under a piece still standing north of it: the shade of what overhangs, on the ground. */
  shade?: Phaser.GameObjects.Image
}

/** A wall burnt black: its piece darkened. */
const BURNT_TINT = 0x4a3c36
/** The catalogue's wall damage sheet (ui `wallDamage`): its frames — cracks a third, two thirds, nearly gone, then the eave's shade. */
const SHADE_FRAME = 3

/** Built things drawn as part of the place (structures.ts art): wall blocks, doors, floors, stairs. */
const isWallish = (type: string) => type === 'structure/wall' || type.startsWith('structure/door')
const STAIRS_FRAME: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 }
/** structures.ts: wall.png's frames past the 16 tops and 4 fronts — a door in a north-south wall from above, shut and open; floor.png's lip. */
const DOOR_ABOVE = 20
const FLOOR_LIP = 16
/** What is drawn over heads (health bars, quest marks): over the world, under the lessons' cells and the ceilings. */
const OVERHEAD = 1e5 - 3

/** How far apart (px) the dragon's body segments trail, and how many there are (the last is the tail). */
const DRAGON_GAP = 11
const DRAGON_SEGMENTS = 5

/**
 * The pictures statuses draw over a thing, by the overlay their data names (the engine's OVERLAYS),
 * most telling first: any status that names one shows it, a learned one too.
 */
const OVERLAY_FX: [string, string][] = [
  ['fire', 'ovl:burning'],
  ['ice', 'ovl:frozen'],
  ['spark', 'ovl:electrified'],
  ['wet', 'ovl:wet'],
  ['oil', 'ovl:oiled'],
  ['flame', 'ovl:lit'],
  ['mend', 'ovl:mend'],
]
/** The overlay each of the base statuses names (ontology.ts), for a cell whose snapshot names none. */
const CELL_OVERLAY: Record<string, string> = { burning: 'fire', frozen: 'ice', electrified: 'spark', wet: 'wet', oiled: 'oil', lit: 'flame' }
// The engine's DIRS, kept here so the main thread does not bundle the engine.
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** The ground a stocked pond's fish shadows swim in. */
const FISH_WATER = new Set(['water', 'deepwater'])
const TINT_OF: Record<string, number> ={ frozen: 0xbfe9ff, burning: 0xffc9a0, wet: 0xc8dcff, electrified: 0xfff6a0, oiled: 0xb9b29a, poisoned: 0xb6ec8c, webbed: 0xd9d2e6, frenzied: 0xff9f9f, shelled: 0xcfc4ad }
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
  /** The cells a building's picture covers ("x,y"), with the depth it is drawn at: what flies over them is drawn over it. */
  private roofs = new Map<string, number>()
  /** The pieces of the buildings' pictures and the rooms' frames bound to a wall, by its cell ("x,y"). */
  private pieces = new Map<string, PieceView>()
  /** The cells whose piece shows something besides a whole wall (cracked, burnt, gone): looked at again every frame. */
  private marred = new Set<string>()
  private facts?: TerrainFacts
  /** Where the player stands (and on which storey): what is above them near them fades. */
  private playerAt?: { x: number; y: number; z: number }
  /** The durability bars over struck cells. */
  private tileBars?: Phaser.GameObjects.Graphics
  private objects = new Map<string, Phaser.GameObjects.Image>() // terrain objects by "x,y"
  /**
   * The map's buildings, each one picture laid (a building's strips together, PrefabDef.part): its pieces, and the
   * pixels they cover. Whichever hides the player fades whole in front of them (fadeOver).
   */
  private buildings = new Map<string, { pieces: Phaser.GameObjects.Image[]; x0: number; y0: number; x1: number; y1: number }>()
  /** The terrain objects faded because they stand over the player (fadeOver). */
  private faded = new Set<Phaser.GameObjects.Image>()
  private views = new Map<string, EView>()
  private tileFx = new Map<string, { sprites: Phaser.GameObjects.GameObject[]; sig: string }>()
  /** A stocked pond's water cells (MapData.fish), the fish shadows gliding in it now, and when the next one shows. */
  private fishWater: [x: number, y: number, open: boolean][] = []
  private fishShadows = new Set<Phaser.GameObjects.Image>()
  private nextFish = 0
  private night!: Phaser.GameObjects.Rectangle
  // weather (outdoors): rain streaks, fog, the flash of a strike
  private rainG?: Phaser.GameObjects.Graphics
  private fogR?: Phaser.GameObjects.Rectangle
  private flash?: Phaser.GameObjects.Rectangle
  private drops: { x: number; y: number; v: number; len: number }[] = []
  private weather = 'sun'
  private playerId = 'player'
  /** The player's worn weapon's picture: what is swung when nothing held is a weapon (blows.ts weaponOf). */
  private mainHand?: string
  private ready = false
  /** The scene has loaded its pictures and been made: until then a frame draws nothing (only Phaser's own loading). */
  get loaded(): boolean {
    return this.ready
  }
  private pending: { map?: MapData; frames: Frame[] } = { frames: [] }
  private following?: Phaser.GameObjects.Container
  /** A boss fight under way: the camera holds still over the arena, zoomed out, until it ends. */
  private bossCam?: { id: string; x: number; y: number }
  private focus?: Phaser.GameObjects.Graphics
  /** The map one last came out of, and its mark on the overworld (where one just was); the seals on places not open yet. */
  private cameFrom?: string
  private marks?: Phaser.GameObjects.Graphics
  private bossWarnings?: Phaser.GameObjects.Graphics
  /** The creatures winding up a skill this frame (the kits module), and how far along: they flash white near its end. */
  private windup = new Map<string, { progress: number; pose?: WindupPose }>()
  private bossPreview?: { id: string; mode: Exclude<BossPreviewMode, 'live'>; startedAt?: number }
  private darkness = 0
  /** The look of the region the map lies in (RegionMeta.look), and the look shown, eased toward it as one goes from region to region. */
  private regionLook?: RegionLook
  private shownLook = { tint: [1, 1, 1] as [number, number, number], amount: 0, desat: 0, shade: 0 }
  /** The editor's view (docs/engine-split.md P4): the camera is the author's to move, never the player's to follow; no music. */
  private free = false
  private editorLayer?: Phaser.GameObjects.Graphics
  /** The music and the ambience (audio/soundscape.ts): made as the scene is, none in the editor's view. */
  audio?: Soundscape
  /** The title's music, asked for before the scene was made (the cover shows first). */
  private titleMusic = false
  /** When the ambience was last told what is near (performance.now ms). */
  private ambienceAt = 0
  muted = false

  constructor() {
    super('world')
  }

  preload(): void {
    preloadCatalog(this, catalog())
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
    for (const b of Object.values(catalog().blobs)) images[b.img] = this.textures.get(b.img).getSourceImage() as HTMLImageElement
    for (const [img] of Object.values(catalog().plain).flat()) images[img] = this.textures.get(img).getSourceImage() as HTMLImageElement
    for (const list of Object.values(catalog().plain)) for (const [img] of list) images[img] = this.textures.get(img).getSourceImage() as HTMLImageElement
    this.atlas = new GroundAtlas(catalog(), images)
    this.textures.addCanvas(this.groundKey, this.atlas.canvas)
    this.makeGlowTexture()
    this.makeFishTexture()
    this.cameras.main.setZoom(this.fitZoom()).setRoundPixels(true).setBackgroundColor('#0b0d12')
    // the music and the ambience, through the sound manager's own way out (its mute holds for them)
    const sm = this.sound as Phaser.Sound.WebAudioSoundManager
    if (!this.free && sm.context) {
      this.audio = new Soundscape(sm.context, sm.destination)
      this.audio.music.setTitle(this.titleMusic)
    }
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(this.bossCam ? this.bossZoom() : this.viewZoom())
      this.fitBounds()
    })
    this.night = this.add.rectangle(-4000, -4000, 8000, 8000, 0x0a1030, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7)
    this.fogR = this.add.rectangle(-4000, -4000, 8000, 8000, 0xd8e2ea, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7 - 2)
    this.rainG = this.add.graphics().setScrollFactor(0).setDepth(1e7 - 1)
    this.flash = this.add.rectangle(-4000, -4000, 8000, 8000, 0xf4f8ff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7 + 1)
    this.lookFilter()
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

  /** How far out the camera draws back for a boss fight: the arena whole (about 40 × 24 tiles), always further than the normal view. */
  private bossZoom(): number {
    const h = this.scale.height || window.innerHeight
    const w = this.scale.width || window.innerWidth
    return Math.min(this.fitZoom() - 0.5, Math.max(1, Math.floor(Math.min(h / (T * 24), w / (T * 40)) * 4) / 4))
  }

  private padTick = 0
  private padSig = ''
  /**
   * How much of each screen edge the HUD covers (the clock, the tracker and the minimap above, the toolbar below, the
   * corner buttons on the right), in screen pixels: the camera may go that far past the map's edge, so a cell in a corner
   * (the ossuary's stair down, under the tracker) can always be brought out from under it.
   */
  private hudPad(): { top: number; right: number; bottom: number } {
    const rect = (id: string) => {
      const r = document.getElementById(id)?.getBoundingClientRect()
      return r && r.width > 0 && r.height > 0 ? r : undefined
    }
    const h = this.scale.height || window.innerHeight
    const w = this.scale.width || window.innerWidth
    const top = Math.max(0, ...['clockbox', 'objective', 'minimap'].map((id) => rect(id)?.bottom ?? 0))
    const corner = rect('corner')
    // the toolbar's own height (it moves to the top near the bottom edge, so it is counted at the bottom alone)
    const bar = rect('hotbar')
    return { top, right: corner ? Math.max(0, w - corner.left) : 0, bottom: bar ? Math.min(h / 3, bar.height + 16) : 0 }
  }

  private fitBounds(zoom = this.cameras.main.zoom): void {
    if (!this.base || this.free) return
    const cam = this.cameras.main
    const pad = this.hudPad()
    const top = pad.top / zoom, right = pad.right / zoom, bottom = pad.bottom / zoom
    const mw = this.base.width * T + right
    const mh = this.base.height * T + top + bottom
    const vw = cam.width / zoom
    const vh = cam.height / zoom
    const bw = Math.max(mw, vw)
    const bh = Math.max(mh, vh)
    cam.setBounds(-(bw - mw) / 2, -top - (bh - mh) / 2, bw, bh)
  }


  // ---------------------------------------------------------------- map

  /** The terrain the ground layer draws: the map's, under a building or a fence the ground round it (set as a map loads). */
  private groundAt = (x: number, y: number): string => this.terrainAt(x, y)

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

  /** The look of the region the next map lies in (before `setMap`): the first map takes it at once, the rest ease to it. */
  setLook(look?: RegionLook): void {
    this.regionLook = look
    if (!this.base) this.easeLook(1)
  }

  /** The shown look a step `k` (0…1) toward the region's. */
  private easeLook(k: number): void {
    const t = this.regionLook
    const s = this.shownLook
    const amount = t?.tint ? (t.tintAmount ?? 0.2) : 0
    if (t?.tint) {
      const c = hexRgb(t.tint)
      // a fresh tint takes its colour at once when none was showing; otherwise the colour eases too
      for (let i = 0; i < 3; i++) s.tint[i] = s.amount < 0.01 ? c[i] : s.tint[i] + (c[i] - s.tint[i]) * k
    }
    s.amount += (amount - s.amount) * k
    s.desat += ((t?.desat ?? 0) - s.desat) * k
    s.shade += ((t?.shade ?? 0) - s.shade) * k
  }

  setMap(map: MapData): void {
    if (!this.ready) {
      this.pending.map = map
      this.pending.frames = []
      return
    }
    if (!this.free) this.cameras.main.fadeIn(220, 8, 10, 16)
    for (const v of this.views.values()) this.destroyView(v)
    this.views.clear()
    for (const t of this.tileFx.values()) t.sprites.forEach((s) => s.destroy())
    this.tileFx.clear()
    for (const f of this.fishShadows) (this.tweens.killTweensOf(f), f.destroy())
    this.fishShadows.clear()
    // (a fade under way ends with what it fades)
    for (const o of this.faded) this.tweens.killTweensOf(o)
    for (const o of this.statics) o.destroy()
    this.statics = []
    this.buildings.clear()
    this.faded = new Set([...this.faded].filter((o) => o.active))
    this.roofs.clear()
    this.pieces.clear()
    this.marred.clear()
    // read again with each map: the editor hands over another game without a new scene
    this.facts = undefined
    for (const o of this.objects.values()) o.destroy()
    this.objects.clear()
    this.covered.clear()
    this.overrides.clear()
    this.following = undefined
    this.bossCam = undefined
    this.focus?.destroy()
    this.focus = undefined
    this.marks?.destroy()
    this.marks = undefined
    this.layer?.destroy()
    this.tilemap?.destroy()
    if (this.base && this.base.id !== map.id) this.cameFrom = this.base.id
    this.base = map
    // a new map: no vista yet (the first frame finds the one the player stands in)
    if (this.vista) {
      this.vista = undefined
      this.cameras.main.setZoom(this.fitZoom()).setFollowOffset(0, 0)
    }
    this.fishWater = []
    if (map.fish) {
      const water = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && FISH_WATER.has(map.terrain[y * map.width + x])
      // away from the shore: water on all four sides, so no shore edge is drawn across the cell (open: water on the
      // diagonals too, so no shore corner either); a pond too small for that, anywhere in it
      const cells: [number, number, boolean][] = []
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++)
          if (water(x, y) && water(x - 1, y) && water(x + 1, y) && water(x, y - 1) && water(x, y + 1))
            cells.push([x, y, water(x - 1, y - 1) && water(x + 1, y - 1) && water(x - 1, y + 1) && water(x + 1, y + 1)])
      if (!cells.length) for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (water(x, y)) cells.push([x, y, false])
      this.fishWater = cells
    }
    // the ground layer reads the ground under buildings and fences as the ground round them (ground.ts groundBeneath)
    this.groundAt = groundBeneath(catalog(), map.stamps, this.terrainAt)
    const data: number[][] = []
    for (let y = 0; y < map.height; y++) {
      const row: number[] = []
      for (let x = 0; x < map.width; x++) row.push(groundTile(this.atlas, catalog(), this.groundAt, x, y, this.base?.light === 'dark'))
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
        // (snow too: frost-bitten tufts, so a snowfield is not a blank sheet)
        if ((t === 'grass' || t === 'flowers' || t === 'snow') && hash2(x, y, 7) % 100 < (t === 'flowers' ? 70 : 9)) this.decal(x, y, t)
        // a warm spring steams: a wisp over most of its cells, always rising
        if (t === 'spring' && hash2(x, y, 11) % 3 !== 0) {
          const s = this.overlaySprite('ovl:steam', x * T + 4 + (hash2(x, y, 12) % 8), (y + 1) * T - 2)
          if (s) this.statics.push(s.setDepth((y + 1) * T + 4).setScale(1.6).setTint(0xf4fbff))
        }
      }
    for (const s of map.stamps ?? []) this.stamp(s.key, s.x, s.y)
    // (a room of style `shell` has its walls drawn by its building's picture, docs/showcase.md: no frame of the pack's)
    for (const r of map.rooms ?? []) if (r.style !== 'shell') this.roomFrame(r.style, r.x, r.y, r.w, r.h)
    this.layPools(map)
    this.drawHeights(map)
    if (this.free) this.setEditorDim(this.dim)
    this.fitBounds()
    // (the music hears of the map with its first frame, when the hour and the weather there are known too)
    this.ambienceAt = 0
    this.hooks.onMap?.(map)
  }

  private refreshGround(): void {
    const tex = this.textures.get(this.groundKey) as Phaser.Textures.CanvasTexture
    tex.refresh?.()
  }

  private decal(x: number, y: number, t: string): void {
    const list = catalog().decals[t === 'flowers' || t === 'snow' ? t : 'grass'] ?? catalog().decals.grass
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
    const was = this.objects.get(k)
    if (was) (this.tweens.killTweensOf(was), was.destroy())
    this.objects.delete(k)
    const t = this.terrainAt(x, y)
    // its look (a pine in the snow, a wood's heart), its pick and its place off the grid (ground.ts objectAt)
    const o = objectAt(catalog(), this.terrainAt, this.groundAt, x, y)
    if (!o) return
    const img = this.addSprite(`tobj:${o.key}`, o.def, x, y)
    img.setDepth((y + 1) * T - 1)
    if (t === 'drygrass') img.setTint(0xe8cf7a)
    if (o.dx || o.dy) img.setPosition(img.x + o.dx, img.y + o.dy)
    if (this.free && this.dim.ground < 1) img.setAlpha(this.dim.ground)
    this.objects.set(k, img)
  }

  private stamp(key: string, x: number, y: number): void {
    const p = catalog().prefabs[key]
    if (!p) return
    const tex = this.textures.get(p.img)
    const m = this.base!
    // the map's file: what each piece is bound to (pieces.ts)
    const original = (cx: number, cy: number) => (cx >= 0 && cy >= 0 && cx < m.width && cy < m.height ? m.terrain[cy * m.width + cx] : '')
    const sv: StampView = { p, x, y, pieces: [] }
    for (const d of piecesOf(p, { x, y }, original, this.terrainFacts())) {
      const name = `prefab:${key}:${d.i},${d.j}`
      if (!tex.has(name)) tex.add(name, 0, p.x + d.i * T, p.y + d.j * T, T, T)
      const img = this.add.image(d.x * T, d.y * T, p.img, name).setOrigin(0, 0).setDepth(pieceDepth(p, { y }, d.j, false))
      this.statics.push(img)
      // a building's piece: the building fades whole over the player behind it (fadeOver); a pool or a shadow is ground
      if (!p.ground) {
        // (a building's strips by where the building is; any other picture laid is a building of its own)
        const k = p.part ? `${p.part.of}|${x - p.part.dx}|${y - p.part.dy}` : `${key}|${x}|${y}`
        const b = this.buildings.get(k) ?? this.buildings.set(k, { pieces: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }).get(k)!
        b.pieces.push(img)
        b.x0 = Math.min(b.x0, img.x)
        b.y0 = Math.min(b.y0, img.y)
        b.x1 = Math.max(b.x1, img.x + T)
        b.y1 = Math.max(b.y1, img.y + T)
      }
      const pv: PieceView = { def: d, img, stamp: sv }
      sv.pieces.push(pv)
      if (d.bound) this.pieces.set(`${d.x},${d.y}`, pv)
    }
    let lastSolid = 0
    p.grid.forEach((row, j) => /[#D]/.test(row) && (lastSolid = j))
    if (p.base !== undefined) lastSolid = p.base
    const depth = pieceDepth(p, { y }, lastSolid, false)
    // a roof hides what is under it (the draw order); a pool one wades into is ground, no roof
    if (!p.ground) for (let j = 0; j <= lastSolid; j++) for (let i = 0; i < p.tw; i++) this.roofs.set(`${x + i},${y + j}`, depth)
    // the healing spring says what it is: a heart bobbing over its middle
    const h = catalog().ui.iconHeart
    if (key === 'spring' && h) {
      const htex = this.textures.get(h.img)
      if (!htex.has('spring:heart')) htex.add('spring:heart', 0, h.x, h.y, h.w, h.h)
      const heart = this.add.image((x + p.tw / 2) * T, y * T - 2, h.img, 'spring:heart').setDepth(1e6 - 1)
      this.tweens.add({ targets: heart, y: y * T - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.statics.push(heart)
    }
  }

  private roomFrame(style: string, x: number, y: number, w: number, h: number): void {
    const r = catalog().rooms[style] ?? Object.values(catalog().rooms)[0]
    if (!r) return
    const tex = this.textures.get(r.img)
    const s = r.size
    const piece = (sc: number, sr: number, dx: number, dy: number) => {
      const name = `room:${style}:${sc},${sr}`
      if (!tex.has(name)) tex.add(name, 0, (r.col + sc) * T, (r.row + sr) * T, T, T)
      const img = this.add.image((x + dx) * T, (y + dy) * T, r.img, name).setOrigin(0, 0).setDepth(dy === h - 1 ? (y + dy + 1) * T + 1 : -40)
      this.statics.push(img)
      // a frame's piece goes with the wall it is drawn over (pieces.ts): broken, the room is open there
      const t = this.terrainAt(x + dx, y + dy)
      if (this.terrainFacts().solid(t)) this.pieces.set(`${x + dx},${y + dy}`, { def: { x: x + dx, y: y + dy, i: dx, j: dy, bound: t }, img })
    }
    const mid = (i: number, _len: number) => 1 + ((i - 1) % (s - 2)) // cycle the edge's middle tiles 1,2,3,1,2,3
    for (let dx = 0; dx < w; dx++)
      for (let dy = 0; dy < h; dy++) {
        const left = dx === 0
        const right = dx === w - 1
        const top = dy === 0
        const bottom = dy === h - 1
        if (!(left || right || top || bottom)) continue
        // a door, or a doorway between two rooms of a house (its floor runs through the wall): no wall drawn there
        if (!ROOM_WALL.has(this.terrainAt(x + dx, y + dy))) continue
        const sc = left ? 0 : right ? s - 1 : mid(dx, w)
        const sr = top ? 0 : bottom ? s - 1 : mid(dy, h)
        piece(sc, sr, dx, dy)
      }
  }

  /** What the renderer knows of the terrains (the game's ontology): which fill their cell, which are a wall burnt. */
  private terrainFacts(): TerrainFacts {
    if (!this.facts) {
      const ts = game().ontology().terrains
      this.facts = { solid: (t) => !!ts[t]?.solid, burnt: (t) => !!ts[t]?.tags?.includes('burnt') }
    }
    return this.facts
  }

  /**
   * The pieces bound to the cells the frame names, and to those that showed damage before (pieces.ts): each shows
   * its wall as it is now. A building with a piece gone is drawn row by row, and its cells open no longer hide.
   */
  private refreshPieces(f: Frame): void {
    if (!this.pieces.size) return
    const now = new Map<string, CellNow>()
    for (const t of f.tiles) if (t.terrain) now.set(`${t.x},${t.y}`, { terrain: t.terrain, hp: t.hp, maxHp: t.maxHp })
    const touched = new Set<StampView>()
    for (const k of new Set([...now.keys(), ...this.marred])) {
      const pv = this.pieces.get(k)
      if (!pv) continue
      const st = pieceState(pv.def, now.get(k), this.terrainFacts())
      const sig = st.gone ? 'gone' : `${st.crack}${st.burnt ? 'b' : ''}`
      if (sig === (pv.sig ?? '0')) continue
      pv.sig = sig
      pv.state = st
      if (sig === '0') this.marred.delete(k)
      else this.marred.add(k)
      if (pv.stamp) touched.add(pv.stamp)
      else this.dressPiece(pv, pv.img.depth)
    }
    for (const sv of touched) this.dressStamp(sv)
  }

  /** A building's pieces as their walls are: the order of its rows, its roof's cells, each piece's look. */
  private dressStamp(sv: StampView): void {
    const open = sv.pieces.some((pv) => pv.state?.gone)
    let lastSolid = 0
    sv.p.grid.forEach((row, j) => /[#D]/.test(row) && (lastSolid = j))
    for (const pv of sv.pieces) {
      const depth = pieceDepth(sv.p, sv, pv.def.j, open)
      this.dressPiece(pv, depth)
      const k = `${pv.def.x},${pv.def.y}`
      if (sv.p.ground || pv.def.j > lastSolid) continue
      if (pv.state?.gone) this.roofs.delete(k)
      else this.roofs.set(k, depth)
    }
  }

  /** A piece as its wall is: whole (its cracks, blackened if it burnt), or gone (the shade of what still stands over it). */
  private dressPiece(pv: PieceView, depth: number): void {
    const st = pv.state ?? { gone: false, crack: 0, burnt: false }
    const dmg = catalog().ui.wallDamage
    const frames = dmg ? spriteFrames(this, 'ui:wallDamage', dmg) : []
    pv.img.setDepth(depth).setVisible(!st.gone)
    if (!st.gone && st.burnt) pv.img.setTint(BURNT_TINT)
    else pv.img.clearTint()
    const crack = !st.gone && st.crack > 0 && frames[st.crack - 1]
    if (crack) {
      if (!pv.crack) this.statics.push((pv.crack = this.add.image(pv.def.x * T, pv.def.y * T, dmg!.img, crack).setOrigin(0, 0)))
      pv.crack.setFrame(crack).setDepth(depth + 0.1).setVisible(true)
    } else pv.crack?.setVisible(false)
    // a hole under what still stands north of it (the eave over a broken front wall): its shade on the ground
    const north = pv.stamp?.pieces.find((o) => o.def.i === pv.def.i && o.def.j === pv.def.j - 1)
    const shade = st.gone && north && !north.state?.gone && frames[SHADE_FRAME]
    if (shade) {
      if (!pv.shade) this.statics.push((pv.shade = this.add.image(pv.def.x * T, pv.def.y * T, dmg!.img, shade).setOrigin(0, 0).setDepth(-39)))
      pv.shade.setVisible(true)
    } else pv.shade?.setVisible(false)
  }

  // ---------------------------------------------------------------- frames

  applyFrame(f: Frame): void {
    if (!this.ready || !this.base) {
      this.pending.frames = [f]
      return
    }
    if (f.map !== this.base.id) return
    // the HUD shows and hides its panels (the tracker): now and then the camera's margins follow it
    if (++this.padTick % 20 === 0) {
      const sig = JSON.stringify(this.hudPad())
      if (sig !== this.padSig) (this.padSig = sig), this.bossCam || this.fitBounds()
    }
    this.playerId = f.player.id
    this.mainHand = f.player.worn?.weapon?.sprite
    this.playerAt = { x: f.player.x, y: f.player.y, z: f.player.z ?? 0 }
    this.walls.clear()
    this.floors.clear()
    this.stairs.clear()
    for (const e of f.entities) {
      if (isWallish(e.type)) this.walls.add(`${e.x},${e.y},${e.z ?? 0}`)
      else if (e.type === 'structure/floor') this.floors.add(`${e.x},${e.y},${e.z ?? 0}`)
      else if (e.type === 'structure/stairs') this.stairs.add(`${e.x},${e.y},${e.z ?? 0}`)
    }
    // a floor laid on the ground covers what grew there (flowers, clover, tall grass)
    for (const k of this.covered) if (!this.floors.has(`${k},0`)) (this.objects.get(k)?.setVisible(true), this.covered.delete(k))
    for (const k of this.floors) {
      if (!k.endsWith(',0')) continue
      const cell = k.slice(0, -2)
      const o = this.objects.get(cell)
      if (o?.visible) (o.setVisible(false), this.covered.add(cell))
    }
    // where the player is under cover — the room they stand in, or any covered stretch walls bound
    // (no need to be shut in) — and the cells round it (its walls): what is above is not drawn
    this.underRoof.clear()
    this.inRoom.clear()
    for (const k of [...(f.player.room ?? []).map(([x, y]) => `${x},${y}`), ...this.coveredRound(f)]) {
      this.inRoom.add(k)
      const [x, y] = k.split(',').map(Number)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.underRoof.add(`${x + dx},${y + dy}`)
    }
    this.findSeeThrough(f)
    this.drawCeilings()
    this.applyTiles(f)
    if (!this.bossWarnings) {
      this.bossWarnings = this.add.graphics().setDepth(-20)
      // the cells a blow will fall on stay legible: drawn above the world filter
      this.signals?.mark(this.bossWarnings)
    }
    this.bossWarnings.clear()
    // a skill winding up (the kits module): its cells marked in the skill's colour, filling as it nears; a boss's in its
    // own manner (fainter, a spark in each cell), and its body never flashes
    const was = new Map(this.windup)
    this.windup.clear()
    for (const t of f.telegraphs ?? []) {
      if (!t.boss) this.windup.set(t.who, { progress: t.progress, pose: t.pose })
      for (const [x, y] of t.tiles) {
        if (t.boss) {
          this.bossWarnings.fillStyle(t.color, 0.13 + t.progress * 0.24).fillRect(x * T + 1, y * T + 1, T - 2, T - 2)
          this.bossWarnings.lineStyle(1, t.color, 0.6 + t.progress * 0.4).strokeRect(x * T + 1, y * T + 1, T - 2, T - 2)
          this.bossWarnings.fillStyle(0xffeee0, t.progress).fillRect(x * T + 7, y * T + 7, 2, 2)
          continue
        }
        this.bossWarnings.fillStyle(t.color, 0.22 + t.progress * 0.33).fillRect(x * T + 1, y * T + 1, T - 2, T - 2)
        this.bossWarnings.lineStyle(1.5, t.color, 0.75 + t.progress * 0.25).strokeRect(x * T + 1, y * T + 1, T - 2, T - 2)
      }
    }
    // what a minor monster's wind-up sounds like: a cast or a call as it begins, a leap, a dash or a blow as it lands
    for (const [who, w] of this.windup) if (!was.has(who)) {
      if (w.pose === 'cast') this.sfx('cast', 0.25)
      if (w.pose === 'call') this.sfx('howl', 0.35, 0.6)
    }
    // a landing only for a wind-up let go: one lost (its caster felled, held or stunned before the end) makes no sound
    const standing = new Map(f.entities.map((e) => [e.id, e]))
    for (const [who, w] of was) if (!this.windup.has(who) && this.views.has(who)) {
      const e = standing.get(who)
      if (!e || (e.hp !== undefined && e.hp <= 0) || w.progress < 0.6) continue
      if (w.pose === 'leap') this.sfx('hop', 0.35)
      if (w.pose === 'dash') this.sfx('wind', 0.35)
      if (w.pose === 'slam') this.sfx('impact', 0.4, 0.8)
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
    this.drawQuestArrows(f)
    this.guideAt = f.guide
    const me = this.views.get(this.playerId)
    // a free camera (the editor's, a film's) is never taken over by a boss fight
    if (!this.free && !this.cinema) this.frameBossFight(f, me)
    if (me && !this.bossCam && !this.free && !this.cinema && this.following !== me.root) {
      this.following = me.root
      this.cameras.main.startFollow(me.root, true, 0.2, 0.2)
    }
    if (me && !this.bossCam && !this.free && !this.cinema) this.frameVista(f)
    // Tall silhouettes may overhang walkable cells behind their actual collision base.
    // Keep a backstabbing player and ground warnings legible through that overhang.
    if (me) for (const v of this.views.values()) if (v.snap.boss) {
      const behind = me.root.depth < v.root.depth && v.body.getBounds().contains(me.root.x, me.root.y - T / 2)
      v.body.setAlpha(behind ? 0.55 : 1)
    }
    this.focusOn(f)
    this.drawMarks()
    for (const fx of f.fx) this.playFx(fx)
    this.weather = (this.base.light ?? 'outdoor') === 'outdoor' ? f.calendar.weather : 'sun'
    this.updateNight(f)
    this.hearFrame(f)
    this.hooks.onFrame(f)
    for (const fx of f.fx) this.hooks.onFx(fx, f)
  }

  /** A yellow "!" over people with a quest to give, "?" over those to hand one back to (bobbing). */
  private drawQuestMarks(f: Frame): void {
    const marks = f.quests?.marks ?? {}
    for (const [id, v] of this.views) {
      const mark = marks[id]
      if (v.quest && v.quest.mark !== mark) (this.tweens.killTweensOf(v.quest.text), v.quest.text.destroy(), (v.quest = undefined))
      if (!mark || v.quest) continue
      const text = this.add.text(0, 0, mark, { fontFamily: 'Pixelify Sans, monospace', fontSize: '20px', color: '#ffd23f', stroke: '#3a2414', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5, 1).setResolution(2)
      text.setScale(0.5)
      this.markLayer(v).add(text)
      this.tweens.add({ targets: text, y: -2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      v.quest = { mark, text }
    }
    // what one is for, over the head: the catalogue's `<tag>Mark` for the first of one's tags that has one (OpenWorld's
    // trainer's crossed blades, its smith's anvil); the quest mark, when there is one, comes first
    for (const v of this.views.values()) {
      const tag = v.snap.tags.find((t) => catalog().ui[`${t}Mark`])
      const icon = tag ? catalog().ui[`${tag}Mark`] : undefined
      const show = !!icon && !v.quest
      if (show && !v.role) {
        v.role = this.add.image(0, 0, icon.img).setOrigin(0.5, 1).setScale(0.5)
        this.markLayer(v).add(v.role)
        this.tweens.add({ targets: v.role, y: -2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
      v.role?.setVisible(show)
      this.positionHeadMarks(v)
    }
  }

  /** The spot a companion leading the way shows (Frame.guide): a ring of light that breathes on it, and motes rising. */
  private guideAt?: Frame['guide']
  private guideRing?: Phaser.GameObjects.Graphics
  private drawGuide(time: number): void {
    if (!this.guideAt && !this.guideRing?.visible) return
    this.guideRing ??= this.add.graphics().setDepth(1e5 - 2)
    const g = this.guideRing.clear().setVisible(!!this.guideAt)
    if (!this.guideAt) return
    const cx = this.guideAt.x * T + T / 2
    const cy = this.guideAt.y * T + T / 2
    const s = time / 1000
    const breath = 0.5 + 0.5 * Math.sin(s * 4)
    g.lineStyle(1.5, 0xfff1a8, 0.55 + 0.4 * breath).strokeEllipse(cx, cy + 3, T * (0.95 + 0.15 * breath), T * (0.45 + 0.08 * breath))
    g.fillStyle(0xfff6c8, 0.12 + 0.12 * breath).fillEllipse(cx, cy + 3, T * 0.9, T * 0.4)
    // four motes rising round it, each on its own beat
    for (let i = 0; i < 4; i++) {
      const p = (s * 0.7 + i / 4) % 1
      const a = i * (Math.PI / 2) + s
      g.fillStyle(0xfffbe0, 1 - p).fillCircle(cx + Math.cos(a) * 5, cy + 2 - p * 12, 1)
    }
  }

  private markLayer(v: EView): Phaser.GameObjects.Container {
    if (!v.markLayer) {
      v.markLayer = this.add.container(0, 0)
      v.head.add(v.markLayer)
    }
    return v.markLayer
  }

  /** Keep visible marks three pixels above the body's displayed top, regardless of scale or posture. */
  private positionHeadMarks(v: EView): void {
    if (!v.markLayer || (!v.quest && !v.role?.visible)) return
    v.markLayer.setPosition(0, v.body.getBounds().top - v.root.y - 3)
  }

  private arrows?: HTMLElement
  /**
   * The tracked quest's markers on this map (docs/quests.md §2.5): a diamond over a target in view, and an arrow
   * at the screen's edge pointing to one out of it (the options turn them off).
   */
  private drawQuestArrows(f: Frame): void {
    if (!this.arrows) {
      this.arrows = document.createElement('div')
      this.arrows.className = 'quest-arrows'
      this.game.canvas.parentElement?.appendChild(this.arrows)
    }
    const targets = prefs.get('markers') ? (f.quests?.targets ?? []).filter((q) => q.map === f.map) : []
    const cam = this.cameras.main
    const w = cam.width
    const h = cam.height
    const pad = 26
    const html: string[] = []
    for (const q of targets) {
      const sx = ((q.x + 0.5) * T - cam.worldView.x) * cam.zoom
      const sy = ((q.y + 0.5) * T - cam.worldView.y) * cam.zoom - T * cam.zoom
      if (sx >= pad && sx <= w - pad && sy >= pad && sy <= h - pad) {
        html.push(`<span class="qa on" style="left:${sx}px;top:${sy}px"><i></i></span>`)
        continue
      }
      // out of view: on the edge, the way to it
      const cx = w / 2
      const cy = h / 2
      const dx = sx - cx
      const dy = sy - cy
      const k = Math.min((w / 2 - pad) / Math.max(1e-6, Math.abs(dx)), (h / 2 - pad) / Math.max(1e-6, Math.abs(dy)))
      const ex = cx + dx * k
      const ey = cy + dy * k
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
      html.push(`<span class="qa" style="left:${ex}px;top:${ey}px;transform:rotate(${deg}deg)"><i></i></span>`)
    }
    const out = html.join('')
    if (this.arrows.innerHTML !== out) this.arrows.innerHTML = out
  }

  /**
   * On the overworld: the place one just came out of (a gold ring that breathes, a pin bobbing over it), and a
   * padlock on each place the story has not opened yet (its picture dimmed).
   */
  private drawMarks(): void {
    if (this.base?.kind !== 'overworld') return
    this.marks ??= this.add.graphics().setDepth(1e5 - 1)
    const g = this.marks.clear()
    const now = this.time.now / 1000
    for (const v of this.views.values()) {
      const s = v.snap
      if (!s.leadsTo) continue
      v.body.setTint(s.sealed ? 0x8a8a8a : 0xffffff)
      if (s.sealed) {
        // a padlock in the cell's top right
        const x = s.x * T + 10
        const y = s.y * T + 1
        g.lineStyle(1.5, 0x2a2026, 1).beginPath().arc(x + 2.5, y + 4, 2, Math.PI, 0).strokePath()
        g.fillStyle(0x2a2026, 1).fillRect(x - 0.5, y + 3.5, 7, 6)
        g.fillStyle(0xe8c050, 1).fillRect(x + 0.5, y + 4.5, 5, 4)
        g.fillStyle(0x2a2026, 1).fillRect(x + 2.5, y + 5.5, 1, 2)
      }
      if (s.leadsTo === this.cameFrom) {
        const a = 0.55 + 0.35 * Math.sin(now * 3)
        g.lineStyle(1, 0xffd860, a).strokeRoundedRect(s.x * T + 0.5, s.y * T + 0.5, T - 1, T - 1, 3)
        const bob = Math.sin(now * 4) * 1.5
        const px = s.x * T + T / 2
        const py = s.y * T - 7 + bob
        g.fillStyle(0x2a2026, 1).fillTriangle(px - 4, py - 1, px + 4, py - 1, px, py + 5)
        g.fillStyle(0xffd860, 1).fillTriangle(px - 3, py, px + 3, py, px, py + 3.5)
      }
    }
  }

  /**
   * The spot the inputs act on, framed as Stardew frames its tile: four small corners that glide to the next
   * spot (never jump), breathe a little and pop as they take a new one — faint over the bare ground, plainer over
   * a thing or someone; amber where the world has never seen the act. A frame from the worker (or the keys it
   * sends as the pointer moves) only says where the frame is going; it is drawn every animation frame
   * (tickFocus). With the keys aiming (the pointer aims at nothing) the bare ground in front goes along with the
   * player as drawn, who trails their cell while walking: the frame keeps beside them, and comes to rest on the
   * cell as they stop; a thing in front is framed where it stands. While a key walks the player the frame keeps to
   * the cell ahead, faint and steady (no leap to each thing passed, no pop), and settles once the key is let go.
   */
  focusOn(f: Frame): void {
    // a frame made before the worker saw the latest aim tells the old spot: the frame waits for the new
    if (!this.keysFresh()) return
    const k = f.keys?.hands ?? f.keys?.put ?? f.keys?.primary ?? f.keys?.secondary
    const [dx, dy] = STEP[f.player.facing]
    const tx = k ? k.x : f.player.x + dx
    const ty = k ? k.y : f.player.y + dy
    const ks = f.keys ? Object.values(f.keys).filter(Boolean) : []
    // past the map's edge there is nothing to aim at (an edge that leads nowhere: the tutorial's)
    if (f.scene || !f.keys || (this.base && (tx < 0 || ty < 0 || tx >= this.base.width || ty >= this.base.height))) return void (this.focusGoal = undefined)
    // the whole of a target that covers more than its cell (a place of the overworld: its block)
    const [x, y, w, h] = k?.rect ?? [tx, ty, 1, 1]
    const unknown = ks.length > 0 && ks.every((v) => v!.unknown)
    // quiet: faint over the bare ground, plainer over a thing or someone to act on
    const bare = ks.length > 0 && ks.every((v) => v!.ground)
    // the bare ground ahead goes along with the player; a thing stays put, framed where it is
    this.focusGoal = { x, y, w, h, z: f.player.z ?? 0, color: unknown ? 0xffc35a : 0xfff6dd, alpha: bare ? 0.35 : 0.7, ahead: this.keysAhead() && bare && w === 1 && h === 1 }
    this.focusFront = { x: f.player.x + dx, y: f.player.y + dy, z: f.player.z ?? 0 }
  }

  /** The cell in front of the player (the frame's while the keys walk them). */
  private focusFront?: { x: number; y: number; z: number }
  /** When the player was last on the move: a key walking them, or their sprite catching up with their cell. */
  private movedAt = -1e9
  /** Set by main.ts: a key walks the player. */
  walking: () => boolean = () => false
  /** The player has stopped a moment: the tip comes over the frame (ui/cursor.ts). */
  settled(): boolean {
    return this.time.now - this.movedAt >= 120
  }

  /** The frame where it is drawn now (world px), where it was last going, and when it last took a new spot. */
  private focusGoal?: { x: number; y: number; w: number; h: number; z: number; color: number; alpha: number; ahead: boolean }
  private focusAt?: { x: number; y: number; w: number; h: number }
  private focusTo?: { x: number; y: number }
  private focusT = 0
  private focusPopAt = -1e9

  /** Every animation frame: the frame eases toward its spot (see focusOn). */
  private tickFocus(time: number): void {
    const found = this.focusGoal
    this.focus?.clear()
    if (!found) return void ((this.focusAt = undefined), (this.focusTo = undefined))
    // walked by a key: the cell ahead, faint and steady, whatever is near (see focusOn)
    const front = this.focusFront
    const walking = this.keysAhead() && this.walking() && !!front
    const goal = walking ? { ...found, ...front, w: 1, h: 1, color: 0xfff6dd, alpha: 0.35, ahead: true } : found
    this.focus ??= this.add.graphics().setDepth(1e5)
    const g = this.focus
    // where it is going: the cell on the storey the player stands on — the keys' beside the player as drawn
    let x = goal.x * T
    let y = goal.y * T - goal.z * STOREY_LIFT
    const v = goal.ahead ? this.views.get(this.playerId) : undefined
    if (v?.walker) {
      const lx = v.root.x - v.walker.x
      const ly = v.root.y - v.walker.y
      // (a trail longer than a walk's is a jump the sprite has not made yet: a portal)
      if (Math.hypot(lx, ly) <= 2 * T) (x += lx), (y += ly)
    }
    const w = goal.w * T
    const h = goal.h * T
    // a new spot (a turn, the pointer onto another cell, appearing) pops a little
    if (!walking && (!this.focusTo || Math.hypot(x - this.focusTo.x, y - this.focusTo.y) > T / 2)) this.focusPopAt = time
    this.focusTo = { x, y }
    const at = this.focusAt
    const k = at ? 1 - Math.exp(-Math.min(100, time - this.focusT) / 40) : 1
    this.focusT = time
    const now = at ? { x: at.x + (x - at.x) * k, y: at.y + (y - at.y) * k, w: at.w + (w - at.w) * k, h: at.h + (h - at.h) * k } : { x, y, w, h }
    this.focusAt = now
    const pop = Math.max(0, 1 - (time - this.focusPopAt) / 180)
    const out = 0.25 + Math.sin(time / 280) * 0.25 + pop * 0.75
    const fx = now.x - out
    const fy = now.y - out
    const fw = now.w + 2 * out
    const fh = now.h + 2 * out
    const arm = Math.min(3, fw / 4, fh / 4)
    const corners = (dy: number, color: number, alpha: number) => {
      g.fillStyle(color, alpha)
      for (const [cx, cy, sx, sy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]] as const) {
        g.fillRect(sx > 0 ? cx : cx - arm, (sy > 0 ? cy : cy - 1) + dy, arm, 1)
        g.fillRect(sx > 0 ? cx : cx - 1, (sy > 0 ? cy : cy - arm) + dy, 1, arm)
      }
    }
    // a light shadow under the corners, so they still show on pale ground
    corners(1, 0x2a1608, goal.alpha * 0.35)
    corners(0, goal.color, goal.alpha)
  }

  /** The frame on screen (the tip of what the inputs would do stands over it: ui/cursor.ts). */
  focusRect(): { x: number; y: number; w: number; h: number } | undefined {
    const at = this.focusAt
    if (!at) return undefined
    const cam = this.cameras.main
    return { x: (at.x - cam.worldView.x) * cam.zoom, y: (at.y - cam.worldView.y) * cam.zoom, w: at.w * cam.zoom, h: at.h * cam.zoom }
  }

  /**
   * Where a screen point aims: its tile, and everything drawn at the point, top first — things
   * by id, trees and tall grass by their cell (a canopy reaches over the tile behind it): the id of
   * what fills it, which the engine takes for whatever makes up that cell on top. The
   * test is the picture's own pixels, so a thing is met wherever it shows and nowhere else.
   */
  aimAtScreen(sx: number, sy: number): Aim | undefined {
    if (!this.base) return undefined
    const cam = this.cameras.main
    const wx = cam.worldView.x + sx / cam.zoom
    const wy = cam.worldView.y + sy / cam.zoom
    const hits: { ref: Ref; depth: number }[] = []
    const z = this.playerAt?.z ?? 0
    const x = Math.floor(wx / T)
    const y = Math.floor((wy + z * STOREY_LIFT) / T)
    // one's own body is aimed at only in one's own cell: drawn taller than a tile, it covers the foot of what
    // stands just north, which is what the pointer there means (oneself has the right click)
    const mine = !this.playerAt || (this.playerAt.x === x && this.playerAt.y === y)
    for (const v of this.views.values()) if ((mine || v.snap.id !== this.playerId) && this.drawnAt(v.body, wx, wy)) hits.push({ ref: { e: v.snap.id }, depth: v.root.depth })
    for (const [k, img] of this.objects) {
      if (!this.drawnAt(img, wx, wy)) continue
      const [x, y] = k.split(',').map(Number)
      hits.push({ ref: { e: cellId(this.base.id, x, y, 'volume') }, depth: img.depth })
    }
    hits.sort((a, b) => b.depth - a.depth)
    // the cell under the point on the storey the player stands on (drawn a storey higher for each)
    // the cell of the player's storey under the point, and the cell whose ceiling (a storey up, drawn a
    // tile higher) is drawn there (docs/building.md §5)
    return { x, y, stack: hits.map((h) => h.ref), over: { x, y: Math.floor((wy + (z + 1) * STOREY_LIFT) / T) } }
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

  // ---------------------------------------------------------------- the editor's canvas (docs/engine-split.md P4)

  /** The camera free (the editor's): it follows no one, and the author moves it; no music plays. */
  setFreeCamera(on: boolean): void {
    this.free = on
    if (on) {
      this.following = undefined
      this.cameras.main.stopFollow()
      this.cameras.main.removeBounds()
      this.muted = true
      this.audio?.disable()
      this.audio = undefined
    }
  }

  /** Move the free camera by so many screen pixels; zoom it by a factor, about a screen point. */
  panBy(dx: number, dy: number): void {
    const cam = this.cameras.main
    cam.scrollX -= dx / cam.zoom
    cam.scrollY -= dy / cam.zoom
  }
  zoomBy(f: number, sx = this.scale.width / 2, sy = this.scale.height / 2): void {
    const cam = this.cameras.main
    const before = cam.getWorldPoint(sx, sy)
    cam.setZoom(Math.max(0.5, Math.min(6, cam.zoom * f)))
    cam.preRender()
    const after = cam.getWorldPoint(sx, sy)
    cam.scrollX += before.x - after.x
    cam.scrollY += before.y - after.y
  }
  /** Zoom the free camera to a level (1: a cell is 16 screen pixels), about a screen point (default its middle). */
  zoomTo(z: number, sx?: number, sy?: number): void {
    this.zoomBy(z / this.cameras.main.zoom, sx, sy)
  }
  get zoom(): number {
    return this.cameras.main.zoom
  }
  /** What the camera shows now, in cells, and on which map (the worker's frames carry what lies there, docs/continent.md §9). */
  viewCells(): { map: string; x: number; y: number; w: number; h: number } | undefined {
    const v = this.cameras?.main?.worldView
    if (!this.base || !v || !v.width) return undefined
    return { map: this.base.id, x: Math.floor(v.x / T), y: Math.floor(v.y / T), w: Math.ceil(v.width / T) + 1, h: Math.ceil(v.height / T) + 1 }
  }
  // ---------------------------------------------------------------- the title's camera

  /**
   * The camera behind the title (the cover's backdrop): it follows no one and drifts slowly about a point of the map
   * (in cells), which stands at a share of the screen (`at`: 0.5, 0.5 its middle), as close as `zoom` (a share of the
   * game's own view, default 1); the map's music plays. Undefined: back to following the player.
   */
  private cinema?: { x: number; y: number; zoom?: number; at: [number, number]; t0?: number }
  setCinema(c?: { x: number; y: number; zoom?: number; at?: [number, number] }): void {
    this.cinema = c && { ...c, at: c.at ?? [0.5, 0.5] }
    const cam = this.cameras?.main
    if (!cam) return
    if (c) (this.following = undefined), (this.bossCam = undefined), cam.stopFollow()
    else (cam.setZoom(this.fitZoom()), this.fitBounds())
  }
  private driftCinema(time: number): void {
    const c = this.cinema!
    const cam = this.cameras.main
    c.t0 ??= time
    const t = (time - c.t0) / 1000
    // two slow swells, out of step, so the drift never seems to repeat (a little over a cell each way)
    const dx = 1.4 * Math.sin((t / 47) * Math.PI * 2) + 0.5 * Math.sin((t / 19) * Math.PI * 2)
    const dy = 0.6 * Math.sin((t / 61) * Math.PI * 2 + 1)
    // (as close as the game's own view, or a share of it the scene asks for)
    const zoom = (c.zoom ?? 1) * this.fitZoom()
    if (Math.abs(cam.zoom - zoom) > 0.001) (cam.setZoom(zoom), this.fitBounds(zoom))
    const w = cam.width / cam.zoom, h = cam.height / cam.zoom
    cam.centerOn((c.x + dx) * T + (0.5 - c.at[0]) * w, (c.y + dy) * T + (0.5 - c.at[1]) * h)
  }

  /** Centre the camera on a cell. */
  lookAt(x: number, y: number): void {
    this.cameras.main.centerOn(x * T + T / 2, y * T + T / 2)
  }
  /** Centre the camera on a point of the world, in cells (a map's middle: half cells). */
  lookAtPoint(x: number, y: number): void {
    this.cameras.main.centerOn(x * T, y * T)
  }

  /** The editor's layers (docs/engine-split.md §16 E1): the ground (its tiles, what is drawn on it) and the things, each as opaque as given. */
  private dim = { ground: 1, things: 1 }
  setEditorDim(d: { ground?: number; things?: number }): void {
    this.dim = { ground: d.ground ?? 1, things: d.things ?? 1 }
    this.layer?.setAlpha(this.dim.ground)
    for (const o of this.statics) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(this.dim.ground)
    for (const o of this.objects.values()) o.setAlpha(this.dim.ground)
    for (const v of this.views.values()) (v.root.setAlpha(this.dim.things), v.head.setAlpha(this.dim.things))
  }

  /** The cell under a screen point (the editor's: the ground storey's). */
  cellAt(sx: number, sy: number): { x: number; y: number } | undefined {
    if (!this.base) return undefined
    const p = this.cameras.main.getWorldPoint(sx, sy)
    const x = Math.floor(p.x / T)
    const y = Math.floor(p.y / T)
    return x >= 0 && y >= 0 && x < this.base.width && y < this.base.height ? { x, y } : undefined
  }

  /** What the editor draws over the world (a selection, the anchors, the areas, the portals), in world pixels; drawn anew each call. */
  drawOverlay(draw: (g: Phaser.GameObjects.Graphics, tile: number) => void): void {
    if (!this.ready) return
    this.editorLayer ??= this.add.graphics().setDepth(1e7 - 3)
    this.editorLayer.clear()
    draw(this.editorLayer, T)
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
    const overlayOf = new Map<string, Record<string, string>>()
    for (const t of f.tiles) {
      if (t.terrain) now.set(`${t.x},${t.y}`, t.terrain)
      if (t.statuses?.length) statusNow.set(`${t.x},${t.y}`, t.statuses)
      if (t.overlays) overlayOf.set(`${t.x},${t.y}`, t.overlays)
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
        this.layer!.putTileAt(groundTile(this.atlas, catalog(), this.groundAt, x, y, this.base?.light === 'dark'), x, y)
      }
      this.refreshGround()
    }
    this.refreshPieces(f)
    for (const [k, list] of statusNow) {
      const sig = list.slice().sort().join('|')
      const cur = this.tileFx.get(k)
      if (cur?.sig === sig) continue
      cur?.sprites.forEach((s) => s.destroy())
      const [x, y] = k.split(',').map(Number)
      const sprites: Phaser.GameObjects.GameObject[] = []
      for (const [o, ov] of OVERLAY_FX) {
        const st = list.find((s) => (overlayOf.get(k)?.[s] ?? CELL_OVERLAY[s]) === o)
        if (!st) continue
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
    // what a struck tree or rock has left: a small bar over its cell
    this.tileBars ??= this.add.graphics().setDepth(1e7)
    this.tileBars.clear()
    for (const t of f.tiles) {
      if (t.hp === undefined || !t.maxHp) continue
      const w = 12
      const bx = t.x * T + (T - w) / 2
      const by = t.y * T - 4
      this.tileBars.fillStyle(0x000000, 0.6).fillRect(bx, by, w, 2)
      this.tileBars.fillStyle(0xd8b060, 1).fillRect(bx, by, Math.max(1, (w * t.hp) / t.maxHp), 2)
    }
  }

  /**
   * The ground's height (world-model.md §5.2, §5.5): higher ground a little lighter, and the relief painted as one
   * layer over the ground and its specks, under all that stands (assets/relief.ts: the faces of rock where it drops,
   * the rims, the stairs cut in it), in the rock of the map's region. Heights are half levels. The wiki draws them
   * alike (render-map.ts).
   */
  private drawHeights(map: MapData): void {
    const hs = map.heights
    if (!hs?.some((h) => h)) return
    const g = this.add.graphics().setDepth(-90)
    this.statics.push(g)
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const h = hs[y * map.width + x] ?? 0
        if (h >= 2) g.fillStyle(0xffffff, Math.min(0.12, 0.03 * Math.floor(h / 2))).fillRect(x * T, y * T, T, T)
      }
    const rock = catalog().relief
    const layer = paintRelief(map.width, map.height, hs, this.groundAt, (map.region && rock?.[map.region]) || rock?.['*'] || SLATE)
    if (!layer) return
    const key = `relief:${map.id}`
    if (this.textures.exists(key)) this.textures.remove(key)
    const tex = this.textures.createCanvas(key, layer.width, layer.height)!
    tex.getContext().putImageData(new ImageData(layer.rgba, layer.width, layer.height), 0, 0)
    tex.refresh()
    this.statics.push(this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-45))
  }

  private overlaySprite(name: string, x: number, y: number): Phaser.GameObjects.Sprite | undefined {
    const f = catalog().fx[name]
    if (!f) return undefined
    const anim = fxAnim(this, name, f, -1)
    const s = this.add.sprite(x, y, f.img).setOrigin(0.5, 1)
    if (f.scale) s.setScale(f.scale)
    if (f.add) s.setBlendMode(Phaser.BlendModes.ADD)
    s.play({ key: anim, startFrame: Math.floor(Math.random() * f.frames) })
    return s
  }

  // ---------------------------------------------------------------- entities

  /** The look record an actor is drawn from: its own, or (a person no one gave one) one drawn from its id. */
  private lookRecord(e: EntitySnap): Look | undefined {
    if (e.look && typeof e.look === 'object') return e.look
    if (!e.look && e.tags.includes('person') && hasLooks()) return crowdLook(e.id, e.type)
    return undefined
  }

  private actorDef(e: EntitySnap): { key: string; def: ActorDef } | undefined {
    const look = this.lookRecord(e)
    if (look) {
      // its portrait is fetched as it comes onto the map, ready for the dialogue box
      void preparePortrait(look)
      return figureDef(this, look)
    }
    if (typeof e.look === 'string' || (e.tags.includes('person') && !hasLooks())) {
      const key = personLook(e.id, e.type, typeof e.look === 'string' ? e.look : undefined)
      return { key: `char:${key}`, def: catalog().characters[key] }
    }
    const variant = e.element ?? e.type.split('/').pop()!
    const key = catalog().creatures[`${e.sprite}:${variant}`] ? `${e.sprite}:${variant}` : catalog().creatures[e.sprite] ? e.sprite : 'creature:slime'
    const def = catalog().creatures[key]
    return def ? { key: `cre:${key}`, def } : undefined
  }

  private textureFor(e: EntitySnap): { img: string; frame: string; ax: number; ay: number; actor?: EView['actor'] } {
    // a body (docs/npc-sandbox.md §2.8): the one it was, as they looked, lying where they fell
    if (e.tags.includes('body') && e.look && typeof e.look === 'object') {
      const a = figureDef(this, e.look)
      const { img, fw, fh } = actorFrames(this, a.key, a.def)
      return { img, frame: `${a.key}:0,0`, ax: a.def.anchorX ?? fw / 2, ay: a.def.anchorY ?? fh }
    }
    // a thing the world learned, with a picture of its own
    if (!e.tags.includes('agent') && e.sprite?.startsWith('art:') && this.textures.exists(e.sprite)) return { img: e.sprite, frame: '__BASE', ax: 8, ay: 14 }
    if (e.tags.includes('agent')) {
      const a = this.actorDef(e)
      if (a) {
        const { img, fw, fh } = actorFrames(this, a.key, a.def)
        const col = (e.boss && a.def.rows >= 5) || a.def.rows === 1 ? 0 : (DIR_COL[e.facing] ?? 0)
        return { img, frame: `${a.key}:${col},${a.def.idleRow ?? 0}`, ax: a.def.anchorX ?? fw / 2, ay: a.def.anchorY ?? fh, actor: { key: a.key, rows: a.def.rows, cols: a.def.cols, tint: a.def.tint, scale: a.def.scale, idleRow: a.def.idleRow, dir: a.def.dir, clips: a.def.clips } }
      }
    }
    // a thing set in its cell (a built wall, a laid floor) is drawn as part of the place; a fixture
    // one can carry (a bed) is drawn as itself once set down, not as its icon in the bag
    if (!e.tags.includes('agent') && (!e.tags.includes('portable') || e.spaces || e.type.startsWith('fixture/'))) {
      const f = this.fixtureDef(e)
      if (f) {
        // a look of its own among the type's variants, kept for its life
        const v = f.variants?.length ? hashStr(e.id) % f.variants.length : -1
        // a thing that turns, turned east or west, shows its picture across (a fence running north-south)
        const across = (e.facing === 'left' || e.facing === 'right') && f.across
        const d = ((e.statuses.includes('lit') || e.statuses.includes('attuned')) && f.lit) || (e.open && f.open) || across || (v >= 0 ? f.variants![v] : f.base)
        const [frame] = spriteFrames(this, `fix:${e.sprite}:${d === f.lit ? 'lit' : d === f.open ? 'open' : d === across ? 'across' : v >= 0 ? `v${v}` : 'base'}`, d)
        return { img: d.img, frame, ax: d.ax, ay: d.ay }
      }
    }
    // gear lying on the ground is a bundle, all alike: what it is shows once it is picked up (its own icon in the bag)
    const gear = e.tags.includes('wearable') || e.type.startsWith('item/weapon') || e.type.startsWith('item/armor')
    const key = gear ? 'item:loot' : e.sprite
    const d = catalog().items[key] ?? catalog().items['item:bag'] ?? Object.values(catalog().items)[0]
    const [frame] = spriteFrames(this, `ico:${key}`, d)
    return { img: d.img, frame, ax: d.w / 2, ay: d.h - 2 }
  }

  private fixtureDef(e: EntitySnap): Catalog['fixtures'][string] | undefined {
    return catalog().fixtures[e.sprite] ?? catalog().fixtures[`fixture:${e.type.split('/')[1]}`] ?? catalog().fixtures['fixture:fixture']
  }

  /** Walls and doors, floors, and stairs of the frame, by `x,y,z`. */
  private walls = new Set<string>()
  private floors = new Set<string>()
  /** Ground cells whose growth (flowers, tall grass) a floor laid on them hides. */
  private covered = new Set<string>()
  private stairs = new Set<string>()
  /** The cells of the room the player stands in and round it: the storeys above them are not drawn. */
  private underRoof = new Set<string>()
  /** The room's own cells: the wall south of them is see-through (its top not drawn) so one sees in. */
  private inRoom = new Set<string>()
  /**
   * The covered stretch the player stands in (docs/building.md §5): from their cell, if anything is
   * built above it, the cells of their storey with something built above them, bounded by walls (and
   * doors) — a room or not, shut in or not.
   */
  private coveredRound(f: Frame): string[] {
    const me = { x: f.player.x, y: f.player.y, z: f.player.z ?? 0 }
    const top = me.z + 4
    const covered = (x: number, y: number) => { for (let z = me.z + 1; z <= top; z++) if (this.floors.has(`${x},${y},${z}`) || this.walls.has(`${x},${y},${z}`)) return true; return false }
    if (!covered(me.x, me.y)) return []
    const seen = new Set<string>()
    const todo: [number, number][] = [[me.x, me.y]]
    while (todo.length && seen.size < 400) {
      const [x, y] = todo.pop()!
      const k = `${x},${y}`
      if (seen.has(k) || !covered(x, y) || (this.walls.has(`${x},${y},${me.z}`) && k !== `${me.x},${me.y}`)) continue
      seen.add(k)
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    return [...seen]
  }

  /** The build palette is open: what is above the player's storey is not drawn (one builds one's own storey, The Sims' build mode). */
  private ceilingOverlay = false
  /** Laying ceilings: the ceilings over the player's storey are tinted where they are drawn (a storey up), never hiding what is under them. */
  private ceilingTints = false
  private ceilings?: Phaser.GameObjects.Graphics

  /** The lesson's outline on the ground (docs/prologue.md, the drills: where the first wall goes), on the player's storey. */
  private lessonCells?: Phaser.GameObjects.Graphics
  setLessonCells(cells?: [number, number][]): void {
    if (!this.ready) return
    this.lessonCells ??= this.add.graphics().setDepth(1e5 - 2)
    this.lessonCells.clear()
    const lift = (this.playerAt?.z ?? 0) * STOREY_LIFT
    for (const [x, y] of cells ?? []) {
      this.lessonCells.fillStyle(0xffe08a, 0.22).fillRect(x * T + 1, y * T + 1 - lift, T - 2, T - 2)
      this.lessonCells.lineStyle(1, 0xffe08a, 0.95).strokeRect(x * T + 1.5, y * T + 1.5 - lift, T - 3, T - 3)
    }
  }

  /** The build palette's view (docs/building.md §5): open, one's own storey; laying ceilings, the ceilings where they are drawn. */
  setBuildView(open: boolean, ceilings: boolean): void {
    this.ceilingOverlay = open
    this.ceilingTints = open && ceilings
    this.drawCeilings()
  }

  private drawCeilings(): void {
    if (!this.ready) return
    this.ceilings ??= this.add.graphics().setDepth(1e5 - 1)
    this.ceilings.clear()
    const me = this.playerAt
    if (!this.ceilingTints || !me) return
    // where each is drawn: a storey above the player's, a tile higher than its cell
    const lift = (me.z + 1) * STOREY_LIFT
    for (const k of this.floors) {
      const [x, y, z] = k.split(',').map(Number)
      if (z !== me.z + 1) continue
      this.ceilings.fillStyle(0x9fd4ff, 0.28).fillRect(x * T, y * T - lift, T, T)
      this.ceilings.lineStyle(1, 0xcfe9ff, 0.6).strokeRect(x * T + 0.5, y * T - lift + 0.5, T - 1, T - 1)
    }
  }

  /** What is drawn see-through: the whole wall (by `x,y,z`) or the row of floor (by `f:x,y,z`) that hides the player. */
  private seeThrough = new Set<string>()

  /**
   * What hides the player, all of it (after Stardew): a wall or a floor drawn in front of them over
   * their body — or the wall on the south side of the room they are in, the camera's side — then the
   * run it belongs to: a wall along its row and up and down what is stacked on it, a floor along its
   * row. A see-through wall shows its front faint and no top.
   */
  private findSeeThrough(f: Frame): void {
    this.seeThrough.clear()
    const me = { x: f.player.x, y: f.player.y, z: f.player.z ?? 0 }
    const xyz = (k: string) => k.split(',').map(Number) as [number, number, number]
    // the player's body as drawn: in their cell, a tile up a storey, half a tile up on stairs
    const head = (me.y + 1 - me.z) * T - T - (this.stairs.has(`${me.x},${me.y},${me.z}`) ? T / 2 : 0)
    const body = { x0: me.x * T + 4, x1: me.x * T + 12, y0: head + 4, y1: head + 14 }
    const mine = (me.y + 1) * T + me.z * 3 + 2
    // drawn after them (in front), drawn at all (not over the room they are in), and over their body
    const over = (x: number, y: number, z: number, y0: number, y1: number) =>
      (y + 1) * T + z * 3 > mine && !(z > me.z && (this.ceilingOverlay || this.underRoof.has(`${x},${y}`))) && x * T < body.x1 && x * T + T > body.x0 && y0 < body.y1 && y1 > body.y0
    const seeds: string[] = []
    for (const k of this.walls) {
      const [x, y, z] = xyz(k)
      const foot = (y + 1 - z) * T
      const front = !this.walls.has(`${x},${y + 1},${z}`)
      const top = !this.walls.has(`${x},${y},${z + 1}`) && !this.floors.has(`${x},${y},${z + 1}`)
      if ((front && over(x, y, z, foot - T, foot)) || (top && over(x, y, z, foot - 2 * T, foot - T)) || (z === me.z && this.inRoom.has(`${x},${y - 1}`))) seeds.push(k)
    }
    for (const k of this.floors) {
      const [x, y, z] = xyz(k)
      const foot = (y + 1 - z) * T
      if (z > 0 && over(x, y, z, foot - T, foot + 4)) seeds.push(`f:${k}`)
    }
    while (seeds.length) {
      const k = seeds.pop()!
      if (this.seeThrough.has(k)) continue
      const floor = k.startsWith('f:')
      const [x, y, z] = xyz(floor ? k.slice(2) : k)
      if (!(floor ? this.floors : this.walls).has(`${x},${y},${z}`)) continue
      this.seeThrough.add(k)
      const p = floor ? 'f:' : ''
      seeds.push(`${p}${x - 1},${y},${z}`, `${p}${x + 1},${y},${z}`)
      if (!floor) seeds.push(`${x},${y},${z + 1}`, `${x},${y},${z - 1}`)
    }
  }

  /**
   * A built thing as part of the place (structures.ts): a block (a wall, a door) shows its front in
   * its cell (where nothing stands south of it on its storey) and its top one storey up (where nothing
   * is built on it), the top a dark cap outlined where no wall is beside it; a door in a wall that runs
   * east-west is its front, in one that runs north-south its top (seen from above). A floor laid a
   * storey up has an edge where nothing is beside it, and shows its thickness under a south edge
   * nothing holds up. Stairs are a block whose top is steps, drawn by the way up.
   */
  private dressBuilt(v: EView, e: EntitySnap): void {
    const z = e.z ?? 0
    const at = (dx: number, dy: number, dz = 0) => `${e.x + dx},${e.y + dy},${z + dz}`
    const frameOf = (img: string, i: number, w = 16, h = 16) => {
      const tex = this.textures.get(img)
      const name = `${img}#${i}`
      if (!tex.has(name)) tex.add(name, 0, i * w, 0, w, h)
      return name
    }
    const topImage = () => {
      if (!v.top) {
        v.top = this.add.image(0, -STOREY_LIFT, LSW_WALL).setOrigin(0.5, 1)
        v.root.addAt(v.top, v.root.getIndex(v.body) + 1)
      }
      return v.top
    }
    if (isWallish(e.type)) {
      const n = this.walls.has(at(0, -1)), east = this.walls.has(at(1, 0)), s = this.walls.has(at(0, 1)), w = this.walls.has(at(-1, 0))
      // a door in a wall that runs north-south is seen from above: a wall's front, the door on its top
      const door = e.type !== 'structure/wall'
      const across = door && (n || s) && !(east || w)
      if (!door || across) v.body.setTexture(LSW_WALL, frameOf(LSW_WALL, 16 + (east ? 1 : 0) + (w ? 2 : 0)))
      else {
        const d = this.fixtureDef(e)?.base
        if (d) v.body.setTexture(d.img, spriteFrames(this, `ico:${e.sprite}`, d)[0])
      }
      // its front shows where nothing stands south of it
      v.body.setOrigin(0.5, 1).setScale(1).setVisible(!s || (door && !across))
      const top = topImage()
      top.setTexture(LSW_WALL, frameOf(LSW_WALL, across ? DOOR_ABOVE + (e.type === 'structure/door/open' ? 1 : 0) : (n ? 1 : 0) + (east ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0)))
      // the wall that hides the player, all of it, is see-through: its front faint, and its top not
      // drawn where it lies over a cell one stands in (over a wall, a corner's, it hides no one)
      const clear = this.seeThrough.has(at(0, 0))
      // its top shows unless something is built on it — and is drawn (not hidden over the room one is in)
      const hiddenAbove = (this.playerAt?.z ?? 0) < z + 1 && (this.ceilingOverlay || this.underRoof.has(`${e.x},${e.y}`))
      top.setVisible(!(clear && !n) && (hiddenAbove || (!this.walls.has(at(0, 0, 1)) && !this.floors.has(at(0, 0, 1)))))
      v.fadeFront = clear
      v.key = 'built'
      // its cracks as it loses durability, as a building's wall shows them (pieces.ts)
      const dmg = catalog().ui.wallDamage
      const stage = crackStage(e.hp, e.maxHp)
      const crack = dmg && stage > 0 ? spriteFrames(this, 'ui:wallDamage', dmg)[stage - 1] : undefined
      if (crack && !v.crack) v.root.addAt((v.crack = this.add.image(0, 0, dmg!.img, crack).setOrigin(0.5, 1)), v.root.getIndex(v.body) + 1)
      if (crack) v.crack!.setFrame(crack)
      v.crack?.setVisible(!!crack && v.body.visible)
      return
    }
    if (e.type === 'structure/floor' && z > 0) {
      const has = (dx: number, dy: number) => this.floors.has(at(dx, dy)) || this.walls.has(at(dx, dy, -1))
      const top = topImage()
      top.setPosition(0, 0)
      top.setTexture(LSW_FLOOR, frameOf(LSW_FLOOR, (has(0, -1) ? 1 : 0) + (has(1, 0) ? 2 : 0) + (has(0, 1) ? 4 : 0) + (has(-1, 0) ? 8 : 0)))
      v.body.setScale(1)
      // its thickness, where nothing holds its south edge nor stands under it
      const lip = !has(0, 1) && !this.walls.has(at(0, 0, -1))
      if (lip && !v.lip) {
        v.lip = this.add.image(0, 4, LSW_FLOOR, frameOf(LSW_FLOOR, FLOOR_LIP, 16, 4)).setOrigin(0.5, 1)
        v.root.add(v.lip)
      }
      v.lip?.setVisible(lip)
      const clear = this.seeThrough.has(`f:${at(0, 0)}`)
      top.setAlpha(clear ? 0.35 : 1)
      v.lip?.setAlpha(clear ? 0.35 : 1)
      v.fadeFront = clear
      return
    }
    if (e.type === 'structure/stairs') {
      v.body.setTexture(LSW_STAIRS, frameOf(LSW_STAIRS, STAIRS_FRAME[e.facing] ?? 0, 16, 32)).setOrigin(0.5, 1).setScale(1)
      v.key = 'built'
    }
  }

  /** The draw order of a thing (depth.ts); `foot` is where it stands now (a walker between two cells). */
  private depthOf(e: EntitySnap, foot?: number): number {
    return depthOf(e, { ground: this.fixtureDef(e)?.ground, roof: this.roofs.get(`${e.x},${e.y}`), foot })
  }

  /** How much higher than its storey a thing is drawn: one standing on stairs, half a storey. */
  private liftOf(e: EntitySnap): number {
    return e.tags.includes('agent') && this.stairs.has(`${e.x},${e.y},${e.z ?? 0}`) ? STOREY_LIFT / 2 : 0
  }

  private makeView(e: EntitySnap): EView {
    const t = this.textureFor(e)
    // on its storey: drawn a storey higher for each
    const root = this.add.container(e.x * T + T / 2, (e.y + 1) * T - (e.z ?? 0) * STOREY_LIFT - this.liftOf(e))
    let shadow: Phaser.GameObjects.Ellipse | undefined
    if (e.tags.includes('agent')) {
      const [width, depth] = e.boss?.footprint ?? [1, 1]
      shadow = this.add.ellipse(0, -depth * 4, width * 11, depth * 6, 0x000000, 0.22)
      root.add(shadow)
    }
    const body = this.add.sprite(0, 0, t.img, t.frame)
    body.setOrigin(t.ax / body.width, t.ay / body.height)
    if (t.actor?.scale) body.setScale(t.actor.scale)
    if (e.type.startsWith('item/') && !e.spaces) body.setScale(0.8)
    // a built thing come loose lies as a thing does: its own picture, as small as an item's
    if (e.loose) body.setScale(Math.min(0.8, 14 / Math.max(body.width, body.height)))
    // small growth and litter sit a little off the grid, never in rows
    if ((!e.tags.includes('agent') && !e.tags.includes('portable')) && this.fixtureDef(e)?.loose) body.setPosition((hashStr(e.id, 23) % 9) - 4, (hashStr(e.id, 29) % 5) - 2)
    const hp = this.add.graphics()
    root.add(body)
    // over the head, over everything in the world (a tree in front does not hide a quest mark), under the roofs' ceilings
    const head = this.add.container(root.x, root.y, [hp]).setDepth(OVERHEAD)
    const v: EView = { snap: e, root, body, shadow, hp, head, key: `${t.img}|${t.frame}`, movingUntil: 0, phase: Math.random() * 1000, actor: t.actor }
    if (e.sprite === 'boss:dragon' && catalog().ui.dragonBody1) v.dragon = this.dragonParts(root, body)
    this.updateView(v, e, true)
    if (this.free && this.dim.things < 1) (root.setAlpha(this.dim.things), head.setAlpha(this.dim.things))
    return v
  }

  /** The dragon composed (the pack draws it in parts): two wings behind the head, a body of segments and a tail in the world behind it. */
  private dragonParts(root: Phaser.GameObjects.Container, head: Phaser.GameObjects.Sprite): EView['dragon'] {
    const ui = catalog().ui
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

  /**
   * Wings beat; the body follows the way the head has come, and curls behind it at rest. Winding a skill up (a boss
   * fight's warning), it rears: the wings flare and beat faster, the head draws back as the blow nears.
   */
  private updateDragon(v: EView, time: number): void {
    const d = v.dragon!
    const warning = v.snap.boss?.warning
    const beat = Math.sin((time + v.phase) / (warning ? 90 : 160))
    d.wings.forEach((w, i) => w.setAngle((i ? 1 : -1) * ((warning ? 20 : 8) + beat * 14)).setScale(1, 0.9 + 0.1 * beat))
    v.body.y = warning ? -4 * warning.progress : 0
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
    if (e.boss?.kit === 'alberic') {
      v.bossAnimation ??= new BossAnimationClock()
      v.bossAnimation.receive(e.boss, this.time.now)
    }
    const px = e.x * T + T / 2
    // a storey above the ground's is drawn raised; one on stairs, half a storey more
    const py = (e.y + 1) * T - (e.z ?? 0) * STOREY_LIFT - this.liftOf(e)
    // a flyer glides toward where it is (update()); only a long way off does it appear there at once
    if (e.tags.includes('companion')) {
      if (first || !v.flyer || Math.max(Math.abs(prev.x - e.x), Math.abs(prev.y - e.y)) > 6) v.root.setPosition(px, py)
      v.flyer = { x: px, y: py, t: v.flyer?.t ?? this.time.now }
    } else if (!first && prev.x === e.x && prev.y === e.y && (prev.z ?? 0) !== (e.z ?? 0)) {
      // up or down a storey in place
      this.tweens.killTweensOf(v.root)
      v.root.setPosition(px, py)
      if (v.walker) v.walker = { x: px, y: py, t: this.time.now }
    } else if (!first && (prev.x !== e.x || prev.y !== e.y)) {
      // one step, straight or diagonal, slides; anything farther jumps
      const far = Math.max(Math.abs(prev.x - e.x), Math.abs(prev.y - e.y)) > 1
      this.tweens.killTweensOf(v.root)
      // two cells on in a line on one storey, nothing between: a leap off a ledge over its face (World.stepOver) — a
      // hop down to its foot
      const hs = this.base?.heights
      const hAt = (x: number, y: number) => hs?.[y * this.base!.width + x] ?? 0
      const leap = (prev.x === e.x) !== (prev.y === e.y) && Math.abs(prev.x - e.x) + Math.abs(prev.y - e.y) === 2 && !(prev.z ?? 0) && !(e.z ?? 0) && hAt(prev.x, prev.y) - hAt(e.x, e.y) >= 2
      if (leap) {
        const walker = !!v.walker
        v.walker = undefined
        this.tweens.add({ targets: v.root, x: px, y: py, duration: 260, ease: 'Sine.easeIn', onComplete: () => walker && (v.walker = { x: px, y: py, t: this.time.now }) })
        this.tweens.add({ targets: v.body, y: v.body.y - 7, duration: 110, yoyo: true, ease: 'Quad.easeOut' })
        v.movingUntil = this.time.now + 260
        this.sfx('hop', 0.35)
      }
      // a creature's leap or dash (the kits module) flies the few cells quickly
      else if (far && e.id !== this.playerId && e.tags.includes('creature') && Math.max(Math.abs(prev.x - e.x), Math.abs(prev.y - e.y)) <= 6) {
        this.tweens.add({ targets: v.root, x: px, y: py, duration: 160, ease: 'Quad.easeOut' })
        v.movingUntil = this.time.now + 160
      } else if (far) {
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
          const dur = e.tags.includes('companion') ? 110 : e.tags.includes('agent') && (e.look || e.tags.includes('person')) ? 380 : 330
          this.tweens.add({ targets: v.root, x: px, y: py, duration: dur, ease: 'Linear' })
          v.movingUntil = this.time.now + dur
        }
      }
    }
    if (e.type.startsWith('structure/')) this.dressBuilt(v, e)
    else if (!e.tags.includes('agent')) {
      const t = this.textureFor(e)
      const k = `${t.img}|${t.frame}`
      if (k !== v.key) {
        v.key = k
        v.body.setTexture(t.img, t.frame)
        v.body.setOrigin(t.ax / v.body.width, t.ay / v.body.height)
      }
    } else if (!v.actor || (prev.type !== e.type && !first) || (typeof e.look === 'object' && v.actor.key !== `fig:${figureId(e.look)}`)) {
      // (a look changed in the world — a restyle — is a new sheet)
      const t = this.textureFor(e)
      v.actor = t.actor
      v.body.setTexture(t.img, t.frame)
      v.body.setScale(t.actor?.scale ?? 1)
    }
    v.root.setDepth(this.depthOf(e))
    // what stands on a storey above the player over the room they are in is not drawn (one sees into
    // it); elsewhere, what hides them is see-through (findSeeThrough)
    const me = this.playerAt
    v.root.setVisible(!(!!me && (e.z ?? 0) > me.z && (this.ceilingOverlay || this.underRoof.has(`${e.x},${e.y}`))))
    // status overlay + tint
    // (a thing with a lit picture of its own, a brazier, shows that, not a flame over it)
    const top = OVERLAY_FX.find(([o]) => e.overlays?.includes(o) && !(o === 'flame' && catalog().fixtures[e.sprite]?.lit))
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
    // a body is grey (docs/npc-sandbox.md §2.8)
    if (e.tags.includes('body')) v.body.setTint(0x8a8a8a).setTintMode(Phaser.TintModes.MULTIPLY)
    else if (tintStatus) v.body.setTint(TINT_OF[tintStatus]).setTintMode(Phaser.TintModes.MULTIPLY)
    else if (v.actor?.tint) v.body.setTint(v.actor.tint).setTintMode(Phaser.TintModes.OVERLAY)
    else v.body.clearTint()
    // winding up a skill, it flashes white as the blow nears
    const wound = this.windup.get(e.id)?.progress
    if (wound !== undefined && wound > 0.5 && Math.floor(wound * 10) % 2 === 0) v.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    // a thing an act waits on shimmers; one who is down lies on the ground
    v.body.setAlpha(this.alphaOf(v))
    this.drawPose(v, e.boss ? undefined : e.tags.includes('body') ? 'lie' : e.pose)
    // (what is held is not drawn in the hand: a weapon shows only as it is swung, swingWeapon)
    // lights glow at night
    const lit = e.statuses.includes('lit') || e.statuses.includes('burning') || e.statuses.includes('attuned') || (e.id === this.playerId && e.heldTags?.includes('light'))
    if (lit && !v.glow) v.glow = this.add.image(px, py - 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e7 + 1).setTint(0xffb050)
    if (!lit && v.glow) (v.glow.destroy(), (v.glow = undefined))
    // hp bar
    v.hp.clear()
    // a body's health, or what a thing has left of its durability once struck (world-model.md §6.3)
    if (!e.boss && e.maxHp && e.hp !== undefined && (e.hp < e.maxHp || (e.tags.includes('agent') && e.hostile)) && e.id !== this.playerId) {
      const w = 14
      const top2 = -v.body.displayHeight - 3
      v.hp.fillStyle(0x000000, 0.6).fillRect(-w / 2, top2, w, 2)
      // red: would attack you; green: a person or a companion; amber: anything else (a creature at peace, a thing)
      const friend = e.tags.includes('person') || e.tags.includes('companion')
      v.hp.fillStyle(e.hostile ? 0xe04848 : friend ? 0x6ad06a : 0xd8b060, 1).fillRect(-w / 2, top2, Math.max(1, (w * e.hp) / e.maxHp), 2)
    }
  }

  /**
   * A body in the posture a status of its names (POSES), drawn from its standing frame: lying turned on its side,
   * seated with its legs folded out of sight onto the seat, kneeling lower, leaning tilted the way it faces.
   */
  private drawPose(v: EView, pose: string | undefined): void {
    const b = v.body
    b.setAngle(pose === 'lie' ? 90 : pose === 'lean' ? (v.snap.facing === 'left' ? -10 : v.snap.facing === 'right' ? 10 : 0) : 0)
    // the frame's own rows, from its top: what is folded away is the bottom of it (the legs), and the rest sinks onto the seat
    const h = b.frame.height
    const fold = pose === 'sit' ? Math.round(h * 0.28) : pose === 'kneel' ? Math.round(h * 0.18) : 0
    if (fold) b.setCrop(0, 0, b.frame.width, h - fold)
    else b.setCrop()
    v.poseDy = fold ? Math.round(fold * 0.55 * b.scaleY) : 0
    b.setY(v.poseDy)
  }

  /** How opaque a thing's picture is: shimmering while an act waits on it, faded where it hides the player. */
  private alphaOf(v: EView): number {
    return v.snap.frozen && !v.snap.tags.includes('agent') ? 0.75 : v.fadeFront ? 0.35 : v.over ? 0.45 : 1
  }

  /**
   * What stands in front of the player and over them fades, so they are never lost behind it: a
   * tree's crown, a tall statue, a dead tree, stairs (Stardew's trees), a building — the whole of it that
   * is drawn in front of them, as Stardew's do (built walls and floors have their own see-through,
   * findSeeThrough). Checked every frame, as the player's picture moves; a fade comes and goes in a moment.
   */
  private fadeOver(): void {
    const me = this.views.get(this.playerId)
    const faded = new Set<Phaser.GameObjects.Image>()
    const px = me?.root.x ?? 0
    const py = (me?.root.y ?? 0) - T / 2
    const mine = me?.root.depth ?? 0
    const near = (x: number, y: number) => !!me && Math.abs(x - me.snap.x) <= 2 && y - me.snap.y >= 0 && y - me.snap.y <= 3
    const hides = (o: Phaser.GameObjects.Image) => o.visible && o.depth > mine && o.getBounds().contains(px, py)
    if (me?.root.visible) {
      for (let dy = 0; dy <= 3; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const o = this.objects.get(`${me.snap.x + dx},${me.snap.y + dy}`)
          if (o && hides(o)) faded.add(o)
        }
      // a building drawn over the player — some piece of it in front of them, its own pixels on their body (its middle,
      // head and sides: a roof's edge at their feet hides no one), not just its square: every piece of it in front of
      // them fades (those behind hide no one)
      const body = [[0, 0], [0, -T], [-4, -T / 2], [4, -T / 2]].map(([ox, oy]) => [px + ox, py + oy])
      const over = (o: Phaser.GameObjects.Image, [x, y]: number[]) =>
        o.visible && o.depth > mine && x >= o.x && x < o.x + T && y >= o.y && y < o.y + T && this.textures.getPixelAlpha(Math.floor(x - o.x), Math.floor(y - o.y), o.texture.key, o.frame.name) > 0
      for (const b of this.buildings.values()) {
        if (px < b.x0 - T || px > b.x1 + T || py < b.y0 - T || py > b.y1 + T) continue
        if (b.pieces.some((o) => body.some((q) => over(o, q)))) for (const o of b.pieces) if (o.visible && o.depth > mine) faded.add(o)
      }
    }
    for (const o of this.faded) if (!faded.has(o) && o.active) this.fadeTo(o, 1)
    for (const o of faded) if (!this.faded.has(o)) this.fadeTo(o, 0.45)
    this.faded = faded
    for (const v of this.views.values()) {
      const e = v.snap
      // (built walls and floors have their own see-through; stairs, a storey-high block drawn two tiles up, fade as a statue does)
      const over = !!me && v !== me && !e.tags.includes('agent') && (!e.type.startsWith('structure/') || e.type === 'structure/stairs') && near(e.x, e.y) && v.body.displayHeight > T && v.root.depth > mine && v.body.getBounds().contains(px, py)
      if (over !== !!v.over) (v.over = over), v.body.setAlpha(this.alphaOf(v))
    }
  }

  /** A picture's alpha eased to `to` (a fade over the player comes and goes in a moment, never a blink). */
  private fadeTo(o: Phaser.GameObjects.Image, to: number): void {
    this.tweens.killTweensOf(o)
    this.tweens.add({ targets: o, alpha: to, duration: 150, ease: 'Sine.easeOut' })
  }

  private destroyView(v: EView): void {
    this.tweens.killTweensOf(v.root)
    if (v.role) this.tweens.killTweensOf(v.role)
    if (v.quest) this.tweens.killTweensOf(v.quest.text)
    v.head.destroy()
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

  /** Studio-only playback uses the render clock, never the combat snapshot extrapolator. */
  setBossPreview(id: string, mode: BossPreviewMode): void {
    // Returning to combat starts from its next authoritative snapshot, not a preview sample.
    const previous = this.bossPreview && this.views.get(this.bossPreview.id)
    if (previous) previous.bossAnimation = undefined
    this.bossPreview = mode === 'live' ? undefined : { id, mode }
  }

  update(time: number): void {
    if (this.cinema) this.driftCinema(time)
    this.drawWeather(time)
    this.drawGuide(time)
    this.swimFish(time)
    this.fadeOver()
    for (const v of this.views.values()) {
      const e = v.snap
      if (v.flyer) this.glide(v, time)
      if (v.walker) this.walk(v, time)
      v.head?.setPosition(v.root.x, v.root.y).setVisible(v.root.visible).setAlpha(v.root.alpha)
      // a body between two cells is ordered by where it is drawn now (depth.ts footOf)
      if (e.tags.includes('agent') && !e.boss) v.root.setDepth(this.depthOf(e, footOf(e.y, v.root.y + (e.z ?? 0) * STOREY_LIFT + this.liftOf(e))))
      // a boss drawn on its own atlas (rows of poses); one drawn otherwise (the dragon in parts) moves as any creature
      if (v.actor && e.boss && (v.actor.clips || v.actor.rows >= 5)) {
        let animated = e.boss
        // a preview plays on its own timeline (a loop starts at its first pose); the game on the screen's clock
        let clock = time, offset = v.phase
        const preview = this.bossPreview
        if (preview?.id === e.id) {
          // Start on the first rendered pose, even if rebuilding the view delayed the click.
          preview.startedAt ??= time
          const entity = { ...e, boss: { ...e.boss } }
          previewBoss(entity, preview.mode, time - preview.startedAt)
          animated = entity.boss
          clock = time - preview.startedAt
          offset = 0
        } else if (v.bossAnimation) {
          animated = { ...e.boss, progress: v.bossAnimation.progress(time), animationElapsedMs: v.bossAnimation.elapsed(time) }
        }
        const { col, row, clip, flipX } = bossAnimationFrame(animated, clock, offset, e.facing)
        const strip = clip && v.actor.clips?.[clip]
        if (strip) v.body.setTexture(`${v.actor.dir}/${strip.sheet}`, `${v.actor.key}:${clip}:${col}`)
        else v.body.setFrame(`${v.actor.key}:${col},${row}`)
        v.body.setFlipX(flipX ?? e.facing === 'left')
      } else if (v.actor && v.actor.rows === 1) {
        // single-row strips (bosses): animate across the columns
        v.body.setFrame(`${v.actor.key}:${Math.floor((time + v.phase) / 140) % v.actor.cols},0`)
      } else if (v.actor) {
        const moving = time < v.movingUntil
        const col = DIR_COL[e.facing] ?? 0
        const walkRows = Math.min(4, v.actor.rows)
        // working something out (an act the world is learning): busy hands in place, a little bob
        const working = e.frozen && !e.statuses.includes('down')
        const row = moving ? Math.floor((time + v.phase) / 130) % walkRows : working ? Math.floor(time / 110) % walkRows : e.look || e.tags.includes('person') ? (v.actor.idleRow ?? 0) : Math.floor((time + v.phase) / 260) % walkRows
        v.body.setFrame(`${v.actor.key}:${col},${row}`)
        v.body.y = (working ? -Math.abs(Math.sin(time / 95)) * 1.5 : 0) + (v.poseDy ?? 0)
      }
      if (v.dragon) this.updateDragon(v, time)
      if (!e.boss) this.windupPose(v, time)
      this.positionHeadMarks(v)
      if (v.glow) v.glow.setPosition(v.root.x, v.root.y - 8).setAlpha(this.darkness * 1.4 * (0.85 + 0.15 * Math.sin((time + v.phase) / 120)))
    }
    for (const t of this.tileFx.values())
      for (const s of t.sprites) if (s instanceof Phaser.GameObjects.Image && s.texture.key === 'glow') s.setAlpha(this.darkness * 1.2)
    const me = this.views.get(this.playerId)
    if (this.walking() || (me?.walker && Math.hypot(me.root.x - me.walker.x, me.root.y - me.walker.y) > 0.05)) this.movedAt = time
    // the frame of the spot the inputs act on, after the player has moved this frame
    this.tickFocus(time)
  }

  /**
   * A boss fight's camera: once a living boss is fighting (telegraphing, striking, hurt — not idling) near
   * the player, the camera stops following, draws back and holds over the arena where it began; it
   * returns to the player when the boss falls or the player leaves the fight far behind. The boss's music
   * plays meanwhile.
   */
  /** The vista the player stands in (MapData.vistas), if any. */
  private vista?: Vista
  /** The view's scale now: the game's own, times the vista's. */
  private viewZoom(): number {
    return this.fitZoom() * (this.vista?.zoom ?? 1)
  }
  /**
   * The camera in a vista (docs/showcase.md §3.3): standing in one of the map's vistas, it eases back to the vista's
   * scale and over to where it looks (a cathedral's front from its square); out of it, back to the usual.
   */
  private frameVista(f: Frame): void {
    const v = this.base?.vistas?.find(({ at: [x, y, w, h] }) => f.player.x >= x && f.player.x < x + w && f.player.y >= y && f.player.y < y + h)
    const cam = this.cameras.main
    if (v !== this.vista) {
      this.vista = v
      const zoom = this.viewZoom()
      this.fitBounds(zoom)
      cam.zoomTo(zoom, 900, 'Sine.easeInOut')
    }
    // where it looks: ahead by `look`, or between the player and the point it keeps in sight; eased there a frame at a time
    const me = this.views.get(this.playerId)
    let [lx, ly] = v?.look ?? [0, 0]
    if (v?.focus && me) {
      const s = v.share ?? 0.5
      lx = (((v.focus[0] + 0.5) * T - me.root.x) / T) * s
      ly = (((v.focus[1] + 0.5) * T - me.root.y) / T) * s
    }
    const o = cam.followOffset
    o.set(o.x + (-lx * T - o.x) * 0.12, o.y + (-ly * T - o.y) * 0.12)
  }

  private frameBossFight(f: Frame, me: EView | undefined): void {
    const cam = this.cameras.main
    const near = (e: EntitySnap, r: number) => Math.max(Math.abs(e.x - f.player.x), Math.abs(e.y - f.player.y)) <= r
    const alive = (e: EntitySnap) => !!e.boss && (e.hp ?? 0) > 0 && e.boss.action !== 'death'
    if (this.bossCam) {
      const boss = f.entities.find((e) => e.id === this.bossCam!.id)
      // (its music follows its phase)
      if (boss && alive(boss) && near(boss, 18)) return this.audio?.music.setBoss({ kind: boss.type, phase: boss.boss!.phase ?? 1 })
      // the fight is over: back to the player, at the usual distance, and the map's own music
      this.bossCam = undefined
      this.audio?.music.setBoss(undefined)
      const zoom = this.viewZoom()
      this.fitBounds(zoom)
      cam.zoomTo(zoom, 450, 'Sine.easeInOut')
      if (me) (this.following = me.root), cam.startFollow(me.root, true, 0.08, 0.08)
      return
    }
    const boss = f.entities.find((e) => alive(e) && near(e, 12) && (e.boss!.action !== 'idle' || !!e.boss!.warning))
    const view = boss && this.views.get(boss.id)
    if (!boss || !view || !me) return
    // hold over the middle of the boss and the player as the fight begins, a little above the boss's feet
    const x = (view.root.x + me.root.x) / 2
    const y = (view.root.y - view.body.displayHeight * 0.3 + me.root.y) / 2
    this.bossCam = { id: boss.id, x, y }
    this.following = undefined
    cam.stopFollow()
    cam.setFollowOffset(0, 0)
    const zoom = this.bossZoom()
    this.fitBounds(zoom)
    cam.zoomTo(zoom, 600, 'Sine.easeInOut')
    cam.pan(x, y, 600, 'Sine.easeInOut')
    this.audio?.music.setBoss({ kind: boss.type, phase: boss.boss!.phase ?? 1 })
  }

  screenOf(id: string): { x: number; y: number } | undefined {
    const v = this.views.get(id)
    if (!v) return undefined
    const cam = this.cameras.main
    return { x: (v.root.x - cam.worldView.x) * cam.zoom, y: (v.root.y - v.body.displayHeight * 0.6 - cam.worldView.y) * cam.zoom }
  }

  /** A cell's middle on screen, on the storey the player stands on. */
  screenOfTile(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main
    const lift = (this.playerAt?.z ?? 0) * STOREY_LIFT
    return { x: (x * T + 8 - cam.worldView.x) * cam.zoom, y: (y * T + 8 - lift - cam.worldView.y) * cam.zoom }
  }

  /** Set by main.ts: the keys aim (the pointer aims at nothing), at the spot in front. */
  keysAhead: () => boolean = () => false
  /** Set by main.ts: the worker has answered the latest aim (the frame's keys are for where the pointer is). */
  keysFresh: () => boolean = () => true

  lookOf(id: string): { img: string; frame: string } | undefined {
    const v = this.views.get(id)
    if (!v?.actor) return undefined
    const idle = v.actor.clips?.idle
    if (idle) return { img: `${v.actor.dir}/${idle.sheet}`, frame: `${v.actor.key}:idle:0` }
    return { img: v.body.texture.key, frame: `${v.actor.key}:0,0` }
  }

  /** A look's portrait for a mood (docs/looks.md), when the actor is drawn from a look and its layers are here. */
  portraitOf(id: string, mood?: Mood): HTMLCanvasElement | undefined {
    const e = this.views.get(id)?.snap
    const look = e && this.lookRecord(e)
    // with what its statuses show (wet, burning, frozen…), as the sprite on the map shows them
    return look ? portraitOf(look, mood, e.overlays) : undefined
  }

  /** An actor's portrait for a mood (the plain faceset when its face has no such mood). */
  faceOf(id: string, mood?: Mood): ReturnType<typeof faceFrame> {
    const v = this.views.get(id)
    if (!v?.actor) return undefined
    const key = v.actor.key.split(':').slice(1).join(':')
    return faceFrame(v.actor.key.startsWith('char:') ? catalog().characters[key] : catalog().creatures[key], mood)
  }

  // ---------------------------------------------------------------- light & sound

  /** The game's world filter (render/worldfilter.ts), as strong as the player chose, told each frame where the camera is and how dark the hour. */
  private signals?: ReturnType<typeof signalCamera>
  private lookFilter(): void {
    const look = game().worldFilter
    if (!look) return
    const strength = prefs.filter()
    const f = installWorldFilter(this, look, strength === 'light' ? look.light : look.full)
    if (!f) return
    this.signals = signalCamera(this, (cam) => {
      const s = prefs.filter()
      f.active = s !== 'off'
      f.params = s === 'light' ? look.light : look.full
      f.zoom = cam.zoom
      f.view.x = cam.worldView.x
      f.view.y = cam.worldView.y
      f.dark = Math.min(1, this.darkness / 0.6)
      // the region's grade, lighter at the light strength
      const r = this.shownLook
      const scale = s === 'light' ? 0.6 : 1
      f.tint = [r.tint[0], r.tint[1], r.tint[2], r.amount * scale]
      f.desat = r.desat * scale
    })
  }

  private updateNight(f: Frame): void {
    const light = this.base?.light ?? 'outdoor'
    const h = f.hour
    // dusk and dawn move as the story's night lengthens (the frame's night)
    const { dusk, dawn } = f.night ?? { dusk: 21, dawn: 5 }
    let d = 0
    if (h >= dusk || h < dawn - 0.5) d = 0.6
    else if (h >= dusk - 3) d = ((h - (dusk - 3)) / 3) * 0.6
    else if (h < dawn + 2) d = ((dawn + 2 - h) / 2.5) * 0.6
    if (light === 'dark') d = 0.55
    if (light === 'indoor') d *= 0.4
    // a grey day is a little darker
    const dim: Record<string, number> = { cloud: 0.1, rain: 0.16, storm: 0.26, fog: 0.06 }
    if (light === 'outdoor') d = Math.min(0.7, d + (dim[this.weather] ?? 0))
    // the region's own shade (a dusk that hardly lifts): over its hours out of doors, a little of it indoors
    this.easeLook(0.2)
    if (light === 'outdoor') d = Math.min(0.78, d + this.shownLook.shade)
    else if (light === 'indoor') d = Math.min(0.5, d + this.shownLook.shade * 0.4)
    this.darkness = d
    this.night.setFillStyle(light === 'dark' ? 0x05060c : 0x0a1030, d)
    this.shinePools(f)
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

  /** The title's music (the cover is up), whatever place shows behind it. */
  setTitleMusic(on: boolean): void {
    this.titleMusic = on
    this.audio?.music.setTitle(on)
  }

  /** The death screen: the music stops (its jingle plays). */
  setDeathMusic(on: boolean): void {
    this.audio?.music.setDeath(on)
  }

  /**
   * What the music and the ambience hear of a frame: the hour and the weather, a fight, a scene's music; and, each
   * second, what is near the middle of the view — water, snow and ice, the nearest fire burning.
   */
  private hearFrame(f: Frame): void {
    const a = this.audio
    if (!a || !this.base) return
    const map = this.base
    const light = (map.light ?? 'outdoor') as 'outdoor' | 'indoor' | 'dark'
    // the hour and the weather first: a new map's music is chosen for them, not for the map before
    // Music follows the world's weather even under a roof: a shop sharing its square's cue keeps playing it.
    // The ambience and rain drawn on screen still use this.weather (clear indoors).
    a.music.setMoment({ hour: f.hour, dusk: f.night.dusk, dawn: f.night.dawn, weather: f.calendar.weather })
    a.music.setPlace(map.music, light)
    a.music.setFight(!!f.player.fighting)
    a.music.setScene(f.scene?.music)
    const now = performance.now()
    if (now - this.ambienceAt < 1000) return
    this.ambienceAt = now
    const v = this.cameras.main.worldView
    const cx = Math.floor((v.x + v.width / 2) / T)
    const cy = Math.floor((v.y + v.height / 2) / T)
    const R = 7
    let water = 0
    let cold = 0
    let cells = 0
    const onto = ontology()
    const tags = (id: string) => this.terrainTags.get(id) ?? this.terrainTags.set(id, new Set(onto.terrains[id]?.tags ?? [])).get(id)!
    for (let y = cy - R; y <= cy + R; y++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue
        cells++
        const t = tags(map.terrain[y * map.width + x])
        if (t.has('water')) water++
        else if (t.has('cold')) cold++
      }
    let fire = 0
    for (const e of f.entities)
      if (e.statuses.includes('lit') || e.statuses.includes('burning')) fire = Math.max(fire, 1 - Math.hypot(e.x - cx, e.y - cy) / 7)
    a.ambience.update({ light, hour: f.hour, dusk: f.night.dusk, dawn: f.night.dawn, weather: this.weather, water: Math.min(1, water / 30), cold: cells ? Math.min(1, (cold / cells) * 1.6) : 0, fire: Math.max(0, fire) })
  }
  private terrainTags = new Map<string, Set<string>>()

  setMuted(m: boolean): void {
    this.muted = m
    this.sound.mute = m
  }

  private sfxLoading = new Set<string>()
  /**
   * A minor monster winding a skill up, drawn on its body as it nears (Frame.telegraphs' pose): it crouches to leap, draws
   * back from its foe to dash, gathers itself up for a blow round itself, sways to cast, rears to call. Let go, it is
   * drawn as it was.
   */
  private windupPose(v: EView, time: number): void {
    const w = this.windup.get(v.snap.id)
    const base = v.actor?.scale ?? 1
    if (!w?.pose) {
      if (v.posed) {
        v.body.setScale(base)
        v.body.x = 0
        v.posed = false
      }
      return
    }
    v.posed = true
    const p = w.progress
    const [fx, fy] = STEP[v.snap.facing] ?? [0, 1]
    let sx = 1, sy = 1, dx = 0, dy = 0
    if (w.pose === 'leap') (sx = 1 + 0.18 * p), (sy = 1 - 0.28 * p)
    else if (w.pose === 'dash') (dx = -fx * 3 * p), (dy = -fy * 3 * p), (sx = 1 + 0.08 * p)
    else if (w.pose === 'slam') (sx = 1 - 0.06 * p), (sy = 1 + 0.16 * p), (dy = -3 * p)
    else if (w.pose === 'cast') (dx = Math.sin(time / 45) * 1.2 * p), (sy = 1 + 0.05 * Math.sin(time / 90))
    else (sy = 1 + 0.18 * p), (dy = -2 * p), (dx = Math.sin(time / 30) * 0.8 * p)
    v.body.setScale(base * sx, base * sy)
    v.body.x = dx
    v.body.y += dy
  }

  /** When each sound last began: one heard twice in the same moment (a burst on nine cells) is heard once. */
  private sfxAt = new Map<string, number>()
  sfx(name: string, volume = 0.5, rate = 1): void {
    if (this.muted) return
    const key = `sfx:${name}`
    const last = this.sfxAt.get(key)
    if (last !== undefined && this.time.now - last < 70) return
    this.sfxAt.set(key, this.time.now)
    if (this.cache.audio.exists(key)) return void this.sound.play(key, { volume, rate })
    // first use: fetch it in the background; this one plays when it arrives (if still recent)
    // a game whose catalogue has no felling of its own hears its death instead
    const path = catalog().sfx[name] ?? (name === 'fell' ? catalog().sfx.death : undefined)
    if (!path || this.sfxLoading.has(key)) return
    this.sfxLoading.add(key)
    const asked = this.time.now
    this.load.audio(key, assetUrl(path))
    this.load.once(`filecomplete-audio-${key}`, () => {
      this.sfxLoading.delete(key)
      if (!this.muted && this.time.now - asked < 600) this.sound.play(key, { volume, rate })
    })
    this.load.start()
  }

  // ---------------------------------------------------------------- vfx

  /** Now and then a fish shadow shows for a moment in a stocked pond (MapData.fish), still, wholly inside one water cell — not where a cast has stirred it. */
  private swimFish(time: number): void {
    if (!this.fishWater.length || time < this.nextFish) return
    this.nextFish = time + 1800 + Math.random() * 3200
    if (this.fishShadows.size >= 3) return
    const fishable = (x: number, y: number) => FISH_WATER.has(this.terrainAt(x, y)) && !this.tileFx.get(`${x},${y}`)?.sig.split('|').includes('stirred')
    let cell: [number, number, boolean] | undefined
    for (let i = 0; i < 6 && !cell; i++) {
      const c = this.fishWater[Math.floor(Math.random() * this.fishWater.length)]
      if (fishable(c[0], c[1])) cell = c
    }
    if (!cell) return
    const [x, y, open] = cell
    // the shadow (12 × 5) is kept inside its cell: in open water its centre strays at most 2 px across and 4 px up or
    // down; by a shore corner it sits in the middle, clear of the corner
    const jx = open ? Math.round(Math.random() * 4 - 2) : 0
    const jy = open ? Math.round(Math.random() * 8 - 4) : 0
    const fish = this.add.image(x * T + T / 2 + jx, y * T + T / 2 + jy, 'fishShadow')
    fish.setDepth(-90).setAlpha(0).setFlipX(Math.random() < 0.5)
    this.fishShadows.add(fish)
    const show = 900 + Math.random() * 900
    this.tweens.add({ targets: fish, alpha: 0.38, duration: 350 })
    this.tweens.add({ targets: fish, alpha: 0, delay: 350 + show, duration: 450, onComplete: () => (this.fishShadows.delete(fish), fish.destroy()) })
  }

  /** A fish's shadow, head to the left: a dark body and a forked tail. */
  private makeFishTexture(): void {
    if (this.textures.exists('fishShadow')) return
    const rows = ['...####.....', '.#########.#', '###########.', '.#########.#', '...####.....']
    const c = document.createElement('canvas')
    c.width = rows[0].length
    c.height = rows.length
    const g = c.getContext('2d')!
    g.fillStyle = '#08142a'
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && g.fillRect(x, y, 1, 1)))
    this.textures.addCanvas('fishShadow', c)
  }

  /**
   * The pools of coloured light on the floor (MapData.lights, docs/showcase.md §3.4): a window's shape, soft at its edges,
   * crossed by the lead of its panes; laid on the floor over the ground and under all that stands, added to what is there.
   */
  private pools: { img: Phaser.GameObjects.Image; l: LightPool }[] = []
  private layPools(map: MapData): void {
    this.pools = []
    for (const l of map.lights ?? []) {
      const key = `pool:${l.shape}`
      this.makePoolTexture(l.shape)
      const img = this.add.image((l.x + 0.5) * T, (l.y + 0.5) * T, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(-43)
      img.setDisplaySize(l.w * T, l.h * T).setTint(Number.parseInt(l.color.slice(1), 16)).setAlpha(0)
      this.statics.push(img)
      this.pools.push({ img, l })
    }
  }
  private makePoolTexture(shape: LightPool['shape']): void {
    const key = `pool:${shape}`
    if (this.textures.exists(key)) return
    const w = shape === 'lancet' ? 32 : 64
    const h = 64
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    const img = g.createImageData(w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0
        if (shape === 'glow') {
          const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32
          a = Math.max(0, 1 - d) ** 1.6
        } else if (shape === 'rose') {
          const dx = x + 0.5 - 32
          const dy = y + 0.5 - 32
          const d = Math.hypot(dx, dy) / 30
          const petal = Math.abs(Math.sin(Math.atan2(dy, dx) * 6))
          a = d > 1 ? 0 : (1 - d ** 4) * (petal < 0.18 && d > 0.25 ? 0.35 : 1) * (Math.abs(d - 0.55) < 0.05 ? 0.4 : 1)
        } else {
          // a pointed light: straight sides, the arch over them, the lead's bars across every eighth of it
          const u = (x + 0.5 - 16) / 13
          const v = (y + 0.5) / h
          const top = 0.3
          const inside = v > top ? Math.abs(u) <= 1 : Math.hypot(Math.abs(u) + 0.6, (top - v) / top * 1.4) <= 1.6
          const edge = Math.min(1, (1 - Math.abs(u)) * 4, (1 - v) * 10)
          a = inside ? Math.max(0, edge) * ((y % 8 === 0 || Math.abs(u) < 0.08) ? 0.45 : 1) : 0
        }
        img.data.set([255, 255, 255, Math.round(a * 255)], (y * w + x) * 4)
      }
    g.putImageData(img, 0, 0)
    this.textures.addCanvas(key, c)
  }
  /** The pools as the hour makes them: the sun's by day, moving and lengthening with it; the night's after dark. */
  private shinePools(f: Frame): void {
    if (!this.pools.length) return
    const { dusk, dawn } = f.night ?? { dusk: 21, dawn: 5 }
    const day = Math.max(0, 1 - this.darkness / 0.6)
    const up = f.hour > dawn && f.hour < dusk
    // the sun's hour from noon, -1 at dawn to 1 at dusk
    const sun = Math.max(-1, Math.min(1, (f.hour - (dawn + dusk) / 2) / ((dusk - dawn) / 2)))
    for (const { img, l } of this.pools) {
      const s = l.strength ?? 0.5
      const a = l.when === 'sun' ? (up ? s * day * (1 - 0.35 * Math.abs(sun)) : 0) : l.when === 'night' ? s * (1 - day) : s
      img.setAlpha(a)
      if (l.when === 'sun') {
        // the morning sun throws the window's light to the west, the evening's to the east, longer as it sinks
        img.setPosition((l.x + 0.5 - sun * l.h * 0.35) * T, (l.y + 0.5 + Math.abs(sun) * l.h * 0.15) * T)
        img.setDisplaySize(l.w * T, l.h * T * (1 + Math.abs(sun) * 0.3))
        img.setAngle(-sun * 18)
      }
    }
  }

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
    const f = catalog().fx[name]
    if (!f) return undefined
    const anim = fxAnim(this, name, f, 0)
    const s = this.add.sprite(x, y, f.img).setDepth(opts.depth ?? 1e6)
    if (f.originY !== undefined) s.setOrigin(0.5, f.originY)
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
    poof: 'fell',
    gust: 'wind',
    shatter: 'ice',
    sparkle: 'coin',
    dust: 'open',
  }

  /**
   * The one who struck from a tile, seen wielding their weapon for a moment, as its catalogue entry's `swing` says
   * (assets/types.ts Swing): swept in an arc across the way they face, raised, drawn and loosed, or swung up and brought
   * down to point. A weapon with no swing (and bare hands) shows the blow alone.
   */
  private swingWeapon(x: number, y: number, dir: string, who?: string): void {
    // whoever made it, wherever they are drawn now (one striking on the move has stepped on); else whoever stands there
    const v = (who && this.views.get(who)) || [...this.views.values()].find((u) => u.snap.tags.includes('agent') && u.snap.x === x && u.snap.y === y)
    if (!v) return
    const isMe = v.snap.id === this.playerId
    const held = v.snap.heldTags?.includes('weapon') ? v.snap.held : undefined
    const key = held ?? (isMe ? this.mainHand : undefined)
    const d = key ? catalog().items[key] : undefined
    const kind = d?.swing
    if (!kind || !key || !d) return
    const [frame] = spriteFrames(this, `ico:${key}`, d)
    const [dx, dy] = dirVec(dir)
    // the hand: before the body, to its right side as it faces (behind it, facing away)
    const hand = { down: [5, -6], up: [-5, -8], left: [-4, -7], right: [4, -7] }[dir as 'down'] ?? [5, -6]
    const facing = (Math.atan2(dy, dx) * 180) / Math.PI
    const img = this.add.image(hand[0], hand[1], d.img, frame)
    if (dir === 'up') v.root.addAt(img, Math.max(0, v.root.getIndex(v.body)))
    else v.root.add(img)
    const gone = (delay = 0) => this.tweens.add({ targets: img, alpha: 0, delay, duration: 90, onComplete: () => img.destroy() })
    // a lean into the blow
    this.tweens.add({ targets: v.body, x: dx * 2, duration: 70, yoyo: true, onComplete: () => v.body.setX(0) })
    if (kind === 'sweep') {
      // the blade points up in its picture: swept from one side of the facing to the other, about the hilt
      img.setOrigin(0.5, 0.9).setAngle(facing + 90 - 80)
      this.tweens.add({ targets: img, angle: facing + 90 + 70, duration: 170, ease: 'Cubic.easeOut', onComplete: () => gone() })
    } else if (kind === 'shoot') {
      // the arrow in its picture points up-left: turned to the facing, drawn back, loosed forward
      img.setOrigin(0.5, 0.5).setScale(0.8).setAngle(facing + 135).setPosition(hand[0] + dx * 3, hand[1] + dy * 3)
      this.tweens.chain({
        targets: img,
        tweens: [
          { x: img.x - dx * 2, y: img.y - dy * 2, scaleX: 0.72, duration: 90, ease: 'Sine.easeIn' },
          { x: img.x + dx * 2, y: img.y + dy * 2, scaleX: 0.8, duration: 50, ease: 'Back.easeOut' },
          { alpha: 1, duration: 110 },
        ],
        onComplete: () => gone(),
      })
    } else {
      // the staff's head is up in its picture: raised overhead (and back, facing away), brought down to point where it
      // casts, the head glinting
      img.setOrigin(0.5, 0.9).setAngle((dir === 'up' ? -130 : -90) + 90)
      this.tweens.add({
        targets: img,
        // the short way round from overhead (pointing left is a quarter turn back, not three forward)
        angle: Phaser.Math.Angle.WrapDegrees(facing + 90),
        duration: 160,
        ease: 'Back.easeOut',
        onComplete: () => {
          const tip = this.add.circle(hand[0] + dx * 15, hand[1] + dy * 15, 3, 0xbfe9ff, 0.9).setBlendMode(Phaser.BlendModes.ADD)
          v.root.add(tip)
          this.tweens.add({ targets: tip, scale: 2.2, alpha: 0, duration: 200, onComplete: () => tip.destroy() })
          gone(90)
        },
      })
    }
  }

  /**
   * A companion takes up a power (the boons module): a cold light leaves where it broke loose (a fallen bearer, a
   * relic in a hand) and runs to the companion along an arc, motes trailing it; arriving, it bursts — a ring, sparks,
   * a flash over everything — and the companion glows and lifts for a moment. The HUD names what was taken up.
   */
  private boonLight(fx: Extract<FxEvent, { t: 'boon' }>): void {
    const bird = this.views.get(fx.who)
    if (!bird) return
    const here = fx.from && fx.from.map === this.base?.id ? { x: fx.from.x * T + T / 2, y: fx.from.y * T + T / 2 - 6 } : { x: bird.root.x, y: bird.root.y - 40 }
    const goal = () => ({ x: bird.root.x, y: bird.root.y - 10 })
    const LIGHT = 0xdff3ff
    const COLD = 0xa9c8ff
    const orb = this.add.circle(here.x, here.y, 4.5, LIGHT, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 2)
    const halo = this.add.circle(here.x, here.y, 11, COLD, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 1)
    this.sfx('cast', 0.4)
    // the arc: a bezier from the source over a point above the way's middle to the companion, who may be drifting
    const start = { ...here }
    const flight = { k: 0 }
    let lastMote = 0
    this.tweens.add({
      targets: flight,
      k: 1,
      duration: 1150,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const g = goal()
        const k = flight.k
        const cx = (start.x + g.x) / 2
        const cy = Math.min(start.y, g.y) - 48
        const x = (1 - k) * (1 - k) * start.x + 2 * (1 - k) * k * cx + k * k * g.x
        const y = (1 - k) * (1 - k) * start.y + 2 * (1 - k) * k * cy + k * k * g.y
        orb.setPosition(x, y)
        halo.setPosition(x, y).setScale(1 + 0.25 * Math.sin(this.time.now / 60))
        if (this.time.now - lastMote > 36) {
          lastMote = this.time.now
          const m = this.add.circle(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 1.5 + Math.random() * 1.5, LIGHT, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 1)
          this.tweens.add({ targets: m, y: m.y - 6 - Math.random() * 8, alpha: 0, scale: 0.3, duration: 420 + Math.random() * 200, onComplete: () => m.destroy() })
        }
      },
      onComplete: () => {
        orb.destroy()
        halo.destroy()
        const g = goal()
        this.sfx('heal', 0.5)
        // the burst: a ring, sparks every way, a flash over everything
        const ring = this.add.circle(g.x, g.y, 6, COLD, 0).setStrokeStyle(2, LIGHT, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 2)
        this.tweens.add({ targets: ring, scale: 5.5, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() })
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3
          const r = 22 + Math.random() * 18
          const sp = this.add.circle(g.x, g.y, 1.5 + Math.random() * 1.5, LIGHT, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 2)
          this.tweens.add({ targets: sp, x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r - 8, alpha: 0, duration: 520 + Math.random() * 260, ease: 'Quad.easeOut', onComplete: () => sp.destroy() })
        }
        this.flash?.setAlpha(0.5)
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 700, ease: 'Quad.easeOut' })
        // she glows and lifts: her body lit cold-white, a halo breathing round her, a rise and a settle
        const live = this.views.get(fx.who)
        if (!live) return
        live.body.setTint(LIGHT).setTintMode(Phaser.TintModes.FILL)
        this.time.delayedCall(160, () => live.body.setTint(COLD).setTintMode(Phaser.TintModes.MULTIPLY))
        this.time.delayedCall(1500, () => live.body.clearTint())
        const aura = this.add.circle(0, -8, 14, COLD, 0.42).setBlendMode(Phaser.BlendModes.ADD)
        live.root.addAt(aura, 0)
        this.tweens.add({ targets: aura, scale: 1.6, alpha: 0.15, duration: 380, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => this.tweens.add({ targets: aura, alpha: 0, scale: 2.2, duration: 360, onComplete: () => aura.destroy() }) })
        this.tweens.add({ targets: live.body, y: live.body.y - 7, duration: 520, yoyo: true, ease: 'Sine.easeInOut' })
        this.tweens.add({ targets: live.body, scaleX: live.body.scaleX * 1.18, scaleY: live.body.scaleY * 1.18, duration: 260, yoyo: true, ease: 'Back.easeOut' })
      },
    })
  }

  /** A jingle (a level, a quest done, a seal's power taken up): the music steps back under it. */
  private jingle(name: string): void {
    if (!catalog().sfx[name]) return
    this.audio?.duck()
    this.sfx(name, 0.55)
  }

  playFx(fx: FxEvent): void {
    if (fx.t === 'strike') {
      // lightning: a flash over everything, then the bolt where it lands
      this.flash?.setAlpha(0.75)
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 320 })
      this.oneShot('sparks', fx.x * T + 8, fx.y * T + 8)
      this.audio?.ambience.thunder()
      return this.sfx('thunder', 0.7)
    }
    if (fx.t === 'vfx') {
      const x = fx.x * T + 8
      const y = fx.y * T + 8
      const [kind, a, b, c, d] = fx.fx.split(':')
      if (kind === 'swing') {
        const [dx, dy] = dirVec(a)
        this.swingWeapon(fx.x, fx.y, a, fx.who)
        this.oneShot('slash', x + dx * 10, y + dy * 10, { angle: (Math.atan2(dy, dx) * 180) / Math.PI })
        return this.sfx('attack', 0.35)
      }
      if (kind === 'bolt') {
        const [dx, dy] = dirVec(b)
        this.swingWeapon(fx.x, fx.y, b, fx.who)
        const len = Number(c) || 1
        // what the weapon looses (d: an arrow, tinted by its element), else a bolt of the element
        const key = d && catalog().fx[`missile:${d}`] ? `missile:${d}` : `bolt:${a}`
        const f = catalog().fx[key] ?? catalog().fx['bolt:none']
        this.sfx(key.startsWith('missile:') ? 'attack' : 'cast', 0.35)
        if (!f) return
        const anim = fxAnim(this, key, f, -1)
        const p = this.add.sprite(x, y, f.img).setDepth(1e6).setAngle((Math.atan2(dy, dx) * 180) / Math.PI)
        if (f.add) p.setBlendMode(Phaser.BlendModes.ADD)
        if (f.scale) p.setScale(f.scale)
        if (key.startsWith('missile:') && a !== 'none' && ELEMENT_COLOR[a]) p.setTint(ELEMENT_COLOR[a])
        p.play(anim)
        this.tweens.add({ targets: p, x: x + dx * len * T, y: y + dy * len * T, duration: 45 * len + 40, onComplete: () => p.destroy() })
        return
      }
      // Authored effects may have a namespaced key (sin:greed:stamp); keep the
      // complete key before falling back to the legacy colon-argument convention.
      const definition = catalog().fx[fx.fx]
      const s = this.oneShot(definition ? fx.fx : kind, x, y, definition?.beam ? { angle: fx.angle } : {})
      if (s && definition?.beam && fx.span !== undefined) s.setDisplaySize(fx.span * T, 3 * T)
      if (!s) this.oneShot('poof', x, y, { tint: ELEMENT_COLOR[kind] })
      if (kind === 'explosion') this.cameras.main.shake(160, 0.004)
      const snd = WorldScene.SFX_OF[kind]
      if (snd) this.sfx(snd, 0.4)
      return
    }
    if (fx.t === 'boon') return this.boonLight(fx), this.jingle('boon')
    if (fx.t === 'levelup') return this.jingle('levelup')
    if (fx.t === 'quest' && fx.state === 'done') return this.jingle('quest')
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
