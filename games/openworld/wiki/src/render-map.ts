// A map as the game draws it (packages/runtime/src/render/scene.ts), drawn in Node for the wiki's location
// pages: the autotiled ground and its heights, the grass's decals, the terrain's objects (trees, rocks…),
// prefab stamps and room frames, fixtures and built things, what lies on the ground, and the people and
// creatures where the world begins, in the client's draw order (render/depth.ts). The ground's tiles are
// picked by the client's own code (assets/ground.ts groundTile) over a pixel atlas of our own; what the
// client draws with Phaser is redone here as one nearest-neighbour blit. What moves shows one fixed frame
// (water, flames, the idle loops); there is no light (night, a dark map's gloom, glows), weather or UI
// (health bars, quest marks, the focus).

// the runtime's figures draw this game's looks (packages/runtime/src/game.ts)
import '../../client/src/register.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OntologyIndex, type Dir, type Entity, type Look } from '@openworld/engine'
import { TERRAIN_CHARS } from '@openworld-game/content'
import { LSW_FLOOR, LSW_STAIRS, LSW_WALL } from '@openworld/runtime/src/assets/types.ts'
import { CATALOG } from './bundle.ts'
import { T, groundBeneath, groundTile, hash2, objectLook, stairAt, terracePieces, type GroundAtlas } from '@openworld/runtime/src/assets/ground.ts'
import { personLook } from '@openworld/runtime/src/assets/looks.ts'
import type { ActorDef, SpriteDef } from '@openworld/runtime/src/assets/types.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { depthOf } from '@openworld/runtime/src/render/depth.ts'
import type { Game } from './game.ts'
import { decodePng, encodePng, type Image } from './png.ts'
import { ANCHOR_Y, FH, FW, IDLE_ROW, ROWS, composeSprite } from '@openworld/runtime/src/assets/figure/sprite.ts'
import { crowdLook, figureId } from '@openworld/runtime/src/assets/figure/ids.ts'

// ------------------------------------------------------------------------------------------ images

const ASSETS = fileURLToPath(new URL('../../public/assets/', import.meta.url))
const images = new Map<string, Image | null>()

/** A catalogue image (a pack path, or the project's own under `lsw/`), decoded once. */
function image(path: string): Image | undefined {
  if (!images.has(path)) {
    try {
      images.set(path, decodePng(readFileSync(ASSETS + (path.startsWith('lsw/') ? path : `na/${path}`))))
    } catch {
      images.set(path, null)
    }
  }
  return images.get(path) ?? undefined
}

// ------------------------------------------------------------------------------------------ the picture

/** One drawing of a frame of an image (a Phaser image or sprite): where its origin goes, scaled, turned, tinted. */
interface Blit {
  img: Image
  /** The frame: a rectangle of the image [x, y, w, h]. */
  rect: [number, number, number, number]
  /** Where the origin goes, in world pixels (16 a tile). */
  x: number
  y: number
  /** The origin, in the frame's pixels. */
  ox: number
  oy: number
  sx?: number
  sy?: number
  /** Degrees, clockwise, round the origin. */
  angle?: number
  flipX?: boolean
  alpha?: number
  /** 0xRRGGBB, Phaser's tint modes. */
  tint?: number
  tintMode?: 'multiply' | 'overlay'
  /** Additive (Phaser's ADD blend mode). */
  add?: boolean
}

/** Phaser's OVERLAY tint of a channel (0–255) by a tint channel (0–1): light lighter, dark darker. */
const overlayTint = (c: number, t: number) => (c < 128 ? 2 * t * c : 255 - 2 * (1 - t) * (255 - c))

/** An opaque RGBA picture of `w` x `h` world pixels, `k` picture pixels to a world pixel. */
class Picture {
  readonly pw: number
  readonly ph: number
  readonly px: Uint8Array

  constructor(w: number, h: number, readonly k: number, bg: number) {
    this.pw = Math.max(1, Math.round(w * k))
    this.ph = Math.max(1, Math.round(h * k))
    this.px = new Uint8Array(this.pw * this.ph * 4)
    for (let i = 0; i < this.px.length; i += 4) (this.px[i] = bg >> 16), (this.px[i + 1] = (bg >> 8) & 255), (this.px[i + 2] = bg & 255), (this.px[i + 3] = 255)
  }

  blit(d: Blit): void {
    const [fx, fy, fw, fh] = d.rect
    const { img, x, y, ox, oy } = d
    const k = this.k
    const sx = d.sx ?? 1, sy = d.sy ?? 1
    if (!sx || !sy) return
    const a = ((d.angle ?? 0) * Math.PI) / 180
    const cos = Math.cos(a), sin = Math.sin(a)
    // its corners in the world, for the pixels it may cover
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [qx, qy] of [[0, 0], [fw, 0], [0, fh], [fw, fh]]) {
      const lx = (qx - ox) * sx, ly = (qy - oy) * sy
      const wx = x + lx * cos - ly * sin, wy = y + lx * sin + ly * cos
      x0 = Math.min(x0, wx), x1 = Math.max(x1, wx), y0 = Math.min(y0, wy), y1 = Math.max(y1, wy)
    }
    const px0 = Math.max(0, Math.floor(x0 * k)), px1 = Math.min(this.pw, Math.ceil(x1 * k))
    const py0 = Math.max(0, Math.floor(y0 * k)), py1 = Math.min(this.ph, Math.ceil(y1 * k))
    const src = img.rgba, iw = img.w, ih = img.h, out = this.px
    const alpha = d.alpha ?? 1
    const tint = d.tint, overlay = d.tintMode === 'overlay'
    const tr = tint === undefined ? 0 : (tint >> 16) / 255, tg = tint === undefined ? 0 : ((tint >> 8) & 255) / 255, tb = tint === undefined ? 0 : (tint & 255) / 255
    for (let py = py0; py < py1; py++)
      for (let pxx = px0; pxx < px1; pxx++) {
        // the picture pixel's centre, back into the frame
        const wx = (pxx + 0.5) / k - x, wy = (py + 0.5) / k - y
        const qx = (wx * cos + wy * sin) / sx + ox
        const qy = (-wx * sin + wy * cos) / sy + oy
        if (qx < 0 || qy < 0 || qx >= fw || qy >= fh) continue
        let ix = Math.floor(qx)
        if (d.flipX) ix = fw - 1 - ix
        const ux = fx + ix, uy = fy + Math.floor(qy)
        if (ux < 0 || uy < 0 || ux >= iw || uy >= ih) continue
        const s = (uy * iw + ux) * 4
        const sa = (src[s + 3] / 255) * alpha
        if (sa <= 0) continue
        let r = src[s], g = src[s + 1], b = src[s + 2]
        if (tint !== undefined) {
          if (overlay) (r = overlayTint(r, tr)), (g = overlayTint(g, tg)), (b = overlayTint(b, tb))
          else (r *= tr), (g *= tg), (b *= tb)
        }
        const o = (py * this.pw + pxx) * 4
        if (d.add) {
          out[o] = Math.min(255, out[o] + r * sa)
          out[o + 1] = Math.min(255, out[o + 1] + g * sa)
          out[o + 2] = Math.min(255, out[o + 2] + b * sa)
        } else {
          out[o] += (r - out[o]) * sa
          out[o + 1] += (g - out[o + 1]) * sa
          out[o + 2] += (b - out[o + 2]) * sa
        }
      }
  }

  /** A rectangle of colour (Phaser's Graphics fillRect), in world pixels. */
  fill(x: number, y: number, w: number, h: number, rgb: number, alpha: number): void {
    const k = this.k
    const px0 = Math.max(0, Math.round(x * k)), px1 = Math.min(this.pw, Math.round((x + w) * k))
    const py0 = Math.max(0, Math.round(y * k)), py1 = Math.min(this.ph, Math.round((y + h) * k))
    const r = rgb >> 16, g = (rgb >> 8) & 255, b = rgb & 255, out = this.px
    for (let py = py0; py < py1; py++)
      for (let px = px0; px < px1; px++) {
        const o = (py * this.pw + px) * 4
        out[o] += (r - out[o]) * alpha
        out[o + 1] += (g - out[o + 1]) * alpha
        out[o + 2] += (b - out[o + 2]) * alpha
      }
  }

  /** An ellipse of colour round its centre (Phaser's Ellipse), in world pixels. */
  ellipse(cx: number, cy: number, w: number, h: number, rgb: number, alpha: number): void {
    const k = this.k
    const r = rgb >> 16, g = (rgb >> 8) & 255, b = rgb & 255, out = this.px
    for (let py = Math.max(0, Math.floor((cy - h / 2) * k)); py < Math.min(this.ph, Math.ceil((cy + h / 2) * k)); py++)
      for (let px = Math.max(0, Math.floor((cx - w / 2) * k)); px < Math.min(this.pw, Math.ceil((cx + w / 2) * k)); px++) {
        const dx = ((px + 0.5) / k - cx) / (w / 2), dy = ((py + 0.5) / k - cy) / (h / 2)
        if (dx * dx + dy * dy > 1) continue
        const o = (py * this.pw + px) * 4
        out[o] += (r - out[o]) * alpha
        out[o + 1] += (g - out[o + 1]) * alpha
        out[o + 2] += (b - out[o + 2]) * alpha
      }
  }
}

// ------------------------------------------------------------------------------------------ the ground atlas

/** The ground's tiles as the client's GroundAtlas composes them (a tile, its tint, over the one `under` it), by index. */
const tiles: Image[] = []
const tileIndex = new Map<string, number>()

/** Straight-alpha source-over of a 16x16 rect of an image onto a tile. */
function over(tile: Uint8Array, img: Image, col: number, row: number): void {
  for (let j = 0; j < T; j++)
    for (let i = 0; i < T; i++) {
      const x = col * T + i, y = row * T + j
      if (x >= img.w || y >= img.h) continue
      const s = (y * img.w + x) * 4, o = (j * T + i) * 4
      const sa = img.rgba[s + 3] / 255
      if (!sa) continue
      const da = tile[o + 3] / 255
      const oa = sa + da * (1 - sa)
      for (let c = 0; c < 3; c++) tile[o + c] = (img.rgba[s + c] * sa + tile[o + c] * da * (1 - sa)) / oa
      tile[o + 3] = oa * 255
    }
}

/** The client's atlas, as groundTile asks it: the index of a source tile, composed on first use. */
const atlas = {
  tile(img: string, col: number, row: number, tint?: string, under?: [string, number, number]): number {
    const key = `${img}|${col}|${row}|${tint ?? ''}|${under?.join(',') ?? ''}`
    const hit = tileIndex.get(key)
    if (hit !== undefined) return hit
    // the tile, tinted (canvas source-atop: its colour at its strength over the tile's own pixels), then what lies
    // under it behind (the client's order: the tint never colours the underlay)
    const px = new Uint8Array(T * T * 4)
    const src = image(img)
    if (src) over(px, src, col, row)
    const m = tint && /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(tint)
    if (m) {
      const tc = [Number(m[1]), Number(m[2]), Number(m[3])], ta = m[4] === undefined ? 1 : Number(m[4])
      for (let o = 0; o < px.length; o += 4) if (px[o + 3]) for (let c = 0; c < 3; c++) px[o + c] = px[o + c] * (1 - ta) + tc[c] * ta
    }
    const below = under && image(under[0])
    if (below) {
      const back = new Uint8Array(T * T * 4)
      over(back, below, under![1], under![2])
      for (let o = 0; o < px.length; o += 4) {
        const sa = px[o + 3] / 255
        const da = back[o + 3] / 255
        const oa = sa + da * (1 - sa)
        if (!oa) continue
        for (let c = 0; c < 3; c++) back[o + c] = (px[o + c] * sa + back[o + c] * da * (1 - sa)) / oa
        back[o + 3] = oa * 255
      }
      px.set(back)
    }
    tiles.push({ w: T, h: T, rgba: px })
    tileIndex.set(key, tiles.length - 1)
    return tiles.length - 1
  },
} as unknown as GroundAtlas

// ------------------------------------------------------------------------------------------ what the client draws

/** How much higher a storey is drawn than the one below it (scene.ts STOREY_LIFT). */
const STOREY_LIFT = T
/** The camera's background (scene.ts): what shows where nothing is drawn. */
const BACKGROUND = 0x0b0d12
const LOOSE = new Set(['drygrass', 'flowers', 'bush'])
const TINT_OF: Record<string, number> = { frozen: 0xbfe9ff, burning: 0xffc9a0, wet: 0xc8dcff, electrified: 0xfff6a0, oiled: 0xb9b29a }
const OVERLAY_FX: [string, string][] = [
  ['fire', 'ovl:burning'], ['ice', 'ovl:frozen'], ['spark', 'ovl:electrified'], ['wet', 'ovl:wet'], ['oil', 'ovl:oiled'], ['flame', 'ovl:lit'], ['mend', 'ovl:mend'],
]
const DIR_COL: Record<string, number> = { down: 0, up: 1, left: 2, right: 3 }
const STAIRS_FRAME: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 }
const DOOR_ABOVE = 20
const FLOOR_LIP = 16
const DRAGON_SEGMENTS = 5
const isWallish = (type: string) => type === 'structure/wall' || type.startsWith('structure/door')

/** scene.ts hashStr: a stable hash of a string (an entity's id), salted. */
function hashStr(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A thing as a frame shows it (engine snapshot.ts EntitySnap): what the client draws it from. */
interface Snap {
  id: string
  type: string
  sprite: string
  x: number
  y: number
  z: number
  spaces?: string[]
  facing: Dir
  statuses: string[]
  overlays: string[]
  tags: string[]
  look?: string | Look
  person: boolean
  element?: string
  open: boolean
  held?: string
  boss?: { kit: string; footprint: [number, number]; action: 'idle' }
}

interface Model {
  onto: OntologyIndex
  byId: Map<string, Entity>
}
const models = new WeakMap<Game, Model>()
function modelOf(g: Game): Model {
  let m = models.get(g)
  if (!m) {
    const byId = new Map<string, Entity>()
    for (const c of g.chunks) for (const e of c.entities) byId.set(e.id, e)
    for (const e of g.index.npcs ?? []) byId.set(e.id, e)
    m = { onto: new OntologyIndex(g.ontology), byId }
    models.set(g, m)
  }
  return m
}

function snapOf(g: Game, model: Model, e: Entity): Snap | undefined {
  const p = e.place
  if (p.on !== 'tile') return undefined
  const r = model.onto.resolve(e.type)
  const tags = [...r.tags, ...(e.tags ?? [])]
  const agent = tags.includes('agent')
  // world.ts spacesOf: its type's, else a body for a walking agent, the volume for a solid thing
  const spaces = r.occupies ?? (agent ? (tags.includes('airborne') ? [] : ['body']) : r.solid ? ['volume'] : [])
  const statuses = Object.keys(e.statuses ?? {})
  const held = e.held ? model.byId.get(e.held) : undefined
  const kit = e.boss ? g.bosses.find((b) => b.def.type === e.type)?.def : undefined
  const element = e.props?.element ?? r.props.element
  return {
    id: e.id,
    type: e.type,
    sprite: r.sprite ?? e.type,
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    spaces: spaces.some((s) => s !== 'body') ? spaces : undefined,
    facing: e.facing ?? 'down',
    statuses,
    overlays: statuses.flatMap((s) => g.ontology.statuses[s]?.overlay ?? []),
    tags,
    look: e.look,
    person: !!e.npc,
    element: typeof element === 'string' ? element : undefined,
    open: !!e.statuses?.open,
    held: held ? (model.onto.resolve(held.type).sprite ?? held.type) : undefined,
    boss: e.boss && kit ? { kit: kit.id, footprint: kit.footprint, action: 'idle' } : undefined,
  }
}

const fixtureDef = (e: Snap) => CATALOG.fixtures[e.sprite] ?? CATALOG.fixtures[`fixture:${e.type.split('/')[1]}`] ?? CATALOG.fixtures['fixture:fixture']

/** scene.ts actorDef: a person's character sheet, or a creature's (by its element or kind). */
function actorDef(e: Snap): ActorDef | undefined {
  if (typeof e.look === 'string') return CATALOG.characters[personLook(e.id, e.type, e.look)]
  const variant = e.element ?? e.type.split('/').pop()!
  const key = CATALOG.creatures[`${e.sprite}:${variant}`] ? `${e.sprite}:${variant}` : CATALOG.creatures[e.sprite] ? e.sprite : 'creature:slime'
  return CATALOG.creatures[key]
}

/** A frame of a SpriteDef (the first, or the n-th of an animated one). */
const frameOf = (d: SpriteDef, n = 0): [number, number, number, number] => [d.x + n * (d.step ?? d.w), d.y, d.w, d.h]

/** A body's picture: its image, frame and origin (scene.ts textureFor), with the actor's scale and tint. */
interface Body {
  img: Image
  rect: [number, number, number, number]
  ox: number
  oy: number
  scale?: number
  tint?: number
}

/** A look's map sheet (docs/looks.md), composed as the game composes it. */
function figureImage(look: Look): Image {
  const key = `fig/${figureId(look)}`
  let img = images.get(key)
  if (!img) images.set(key, (img = { w: FW * 4, h: FH * ROWS, rgba: composeSprite(look) }))
  return img
}

function bodyOf(e: Snap): Body | undefined {
  // a person drawn from a look (their own, or one drawn from their id): the sheet's standing frame facing their way
  const look = typeof e.look === 'object' ? e.look : !e.look && e.person ? crowdLook(e.id, e.type) : undefined
  if (e.tags.includes('agent') && look) return { img: figureImage(look), rect: [(DIR_COL[e.facing] ?? 0) * FW, IDLE_ROW * FH, FW, FH], ox: FW / 2, oy: ANCHOR_Y }
  if (e.tags.includes('agent')) {
    const a = actorDef(e)
    const img = a && image(`${a.dir}/${a.sheet}`)
    if (!a || !img) return undefined
    const fw = Math.floor(img.w / a.cols), fh = Math.floor(img.h / a.rows)
    // the first frame of what it does at rest: a boss's idle pose, a strip's first, a sheet's standing frame facing its way
    const { col, row } = e.boss
      ? bossAnimationFrame({ kit: e.boss.kit, phase: 1, color: 0, footprint: e.boss.footprint, enrageAt: 0.5, action: 'idle', progress: 0, animationElapsedMs: 0 }, 0, 0, e.facing)
      : { col: a.rows === 1 ? 0 : (DIR_COL[e.facing] ?? 0), row: 0 }
    return { img, rect: [col * fw, row * fh, fw, fh], ox: fw / 2, oy: a.anchorY ?? fh, scale: a.scale, tint: a.tint }
  }
  if (!e.tags.includes('portable') || e.spaces || e.type.startsWith('fixture/')) {
    const f = fixtureDef(e)
    if (f) {
      // a look of its own among the type's variants, kept for its life
      const v = f.variants?.length ? hashStr(e.id) % f.variants.length : -1
      const d = ((e.statuses.includes('lit') || e.statuses.includes('attuned')) && f.lit) || (e.open && f.open) || (v >= 0 ? f.variants![v] : f.base)
      const img = image(d.img)
      return img && { img, rect: frameOf(d), ox: d.ax, oy: d.ay }
    }
  }
  // gear lying on the ground is a bundle, all alike
  const gear = e.tags.includes('wearable') || e.type.startsWith('item/weapon') || e.type.startsWith('item/armor')
  const key = gear ? 'item:loot' : e.sprite
  const d = CATALOG.items[key] ?? CATALOG.items['item:bag'] ?? Object.values(CATALOG.items)[0]
  const img = image(d.img)
  return img && { img, rect: frameOf(d), ox: d.w / 2, oy: d.h - 2 }
}

/** An effect's frame (an overlay, the spring's steam): the n-th of its strip. */
function fxFrame(name: string, n: number): { img: Image; rect: [number, number, number, number]; scale?: number; add?: boolean } | undefined {
  const f = CATALOG.fx[name]
  const img = f && image(f.img)
  if (!f || !img) return undefined
  const i = n % f.frames
  return { img, rect: [f.vertical ? 0 : i * f.fw, f.vertical ? i * f.fh : 0, f.fw, f.fh], scale: f.scale, add: f.add }
}

// ------------------------------------------------------------------------------------------ a map

/**
 * A map of the game drawn as the game draws it when the world begins: 16 px a tile, times `scale`
 * (an integer for crisp pixels). Same map, same picture: every variant is picked by position or id.
 */
export function renderMap(g: Game, mapId: string, scale = 1): { w: number; h: number; png: Buffer } {
  const ent = g.maps.find((m) => m.id === mapId)
  if (!ent) throw new Error(`no map ${mapId}`)
  const raw = ent.map
  const W: number = raw.width, H: number = raw.height
  const terrain: string[] = []
  for (let y = 0; y < H; y++) {
    const row: string = raw.rows[y] ?? ''
    for (let x = 0; x < W; x++) terrain.push(TERRAIN_CHARS[row[x]] ?? 'void')
  }
  const heights: number[] | undefined = raw.heights?.flatMap((row: string) => [...row].map(Number))
  // outside the map the edge continues, so autotiles draw no border there
  const terrainAt = (x: number, y: number): string => terrain[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
  // the ground under buildings and fences is the ground round them, as the client draws it (ground.ts groundBeneath)
  const groundAt = groundBeneath(CATALOG, raw.stamps, terrainAt)
  const pic = new Picture(W * T, H * T, scale, BACKGROUND)
  // what is drawn, by depth; two at one depth in the order the client adds them (the sort is stable)
  const ops: { depth: number; draw: () => void }[] = []
  const at = (depth: number, draw: () => void) => ops.push({ depth, draw })
  /** A SpriteDef with its anchor at the bottom-centre of a tile (scene.ts addSprite). */
  const sprite = (d: SpriteDef, x: number, y: number, extra: Partial<Blit> = {}) => {
    const img = image(d.img)
    if (img) pic.blit({ img, rect: frameOf(d), x: x * T + T / 2, y: (y + 1) * T, ox: d.ax, oy: d.ay, ...extra })
  }

  // the ground: one tile a cell (a tilemap layer at -100); a dark map's pools have no shore
  at(-100, () => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = tiles[groundTile(atlas, CATALOG, groundAt, x, y, raw.light === 'dark')] ?? tiles[0]
        if (t) pic.blit({ img: t, rect: [0, 0, T, T], x: x * T, y: y * T, ox: 0, oy: 0 })
      }
  })

  // terrain objects, decals and the warm spring's steam, cell by cell
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = terrainAt(x, y)
      // a pine or a rock in the snow takes its winter look, as the client draws it (ground.ts objectLook)
      const list = CATALOG.terrainObjects[objectLook(CATALOG, t, groundAt(x, y))]
      if (list?.length && !(t === 'drygrass' && hash2(x, y, 13) % 100 < 35)) {
        const d = list[hash2(x, y, 11) % list.length]
        // loose growth sits a little off the grid, never in rows
        const [dx, dy] = LOOSE.has(t) ? [(hash2(x, y, 17) % 9) - 4, (hash2(x, y, 19) % 5) - 2] : [0, 0]
        at((y + 1) * T - 1, () => sprite(d, x, y, { x: x * T + T / 2 + dx, y: (y + 1) * T + dy, ...(t === 'drygrass' && { tint: 0xe8cf7a }) }))
      }
      // (snow too: frost-bitten tufts, as the client draws them)
      if ((t === 'grass' || t === 'flowers' || t === 'snow') && hash2(x, y, 7) % 100 < (t === 'flowers' ? 70 : 9)) {
        const decals = CATALOG.decals[t === 'flowers' || t === 'snow' ? t : 'grass'] ?? CATALOG.decals.grass
        if (decals?.length) at(-50, () => sprite(decals[hash2(x, y, 3) % decals.length], x, y))
      }
      if (t === 'spring' && hash2(x, y, 11) % 3 !== 0) {
        const f = fxFrame('ovl:steam', hash2(x, y, 12))
        if (f) at((y + 1) * T + 4, () => pic.blit({ ...f, x: x * T + 4 + (hash2(x, y, 12) % 8), y: (y + 1) * T - 2, ox: f.rect[2] / 2, oy: f.rect[3], sx: 1.6, sy: 1.6, tint: 0xf4fbff }))
      }
    }

  // prefab stamps: a building in front of what stands behind its last solid row, a pool as ground
  const roofs = new Map<string, number>()
  for (const s of raw.stamps ?? []) {
    const p = CATALOG.prefabs[s.key]
    const img = p && image(p.img)
    if (!p || !img) continue
    let lastSolid = 0
    p.grid.forEach((row, j) => /[#D]/.test(row) && (lastSolid = j))
    const depth = p.ground ? -40 : (s.y + lastSolid + 1) * T - 2
    at(depth, () => pic.blit({ img, rect: [p.x, p.y, p.tw * T, p.th * T], x: s.x * T, y: s.y * T, ox: 0, oy: 0 }))
    if (!p.ground) for (let j = 0; j <= lastSolid; j++) for (let i = 0; i < p.tw; i++) roofs.set(`${s.x + i},${s.y + j}`, depth)
    // the healing spring's heart (it bobs; drawn where it starts)
    const heart = CATALOG.ui.iconHeart
    const himg = s.key === 'spring' && image(heart.img)
    if (himg) at(1e6 - 1, () => pic.blit({ img: himg, rect: frameOf(heart), x: (s.x + p.tw / 2) * T, y: s.y * T - 2, ox: heart.w / 2, oy: heart.h / 2 }))
  }

  // room frames: the ring of a room's walls, the south wall in front of who stands inside
  for (const r of raw.rooms ?? []) {
    const def = CATALOG.rooms[r.style] ?? Object.values(CATALOG.rooms)[0]
    const img = def && image(def.img)
    if (!def || !img) continue
    const size = def.size
    const mid = (i: number) => 1 + ((i - 1) % (size - 2))
    for (let dx = 0; dx < r.w; dx++)
      for (let dy = 0; dy < r.h; dy++) {
        const left = dx === 0, right = dx === r.w - 1, top = dy === 0, bottom = dy === r.h - 1
        // a door, or a doorway between two rooms of a house (its floor runs through the wall): no wall drawn there
        if (!(left || right || top || bottom) || !['wall', 'woodwall', 'void'].includes(terrainAt(r.x + dx, r.y + dy))) continue
        const sc = left ? 0 : right ? size - 1 : mid(dx)
        const sr = top ? 0 : bottom ? size - 1 : mid(dy)
        at(bottom ? (r.y + dy + 1) * T + 1 : -40, () => pic.blit({ img, rect: [(def.col + sc) * T, (def.row + sr) * T, T, T], x: (r.x + dx) * T, y: (r.y + dy) * T, ox: 0, oy: 0 }))
      }
  }

  // the ground's height (scene.ts drawHeights): higher ground lighter, a ramp's steps, the terrace's rim and face where
  // it drops a level (a plain lip and a short face for a catalogue with no terrace)
  const terrace = CATALOG.terrace && image(CATALOG.terrace.img)
  if (heights?.some((h) => h)) at(-90, () => {
    const hAt = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? undefined : heights[y * W + x] ?? 0)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const h = hAt(x, y)!
        if (h >= 2) pic.fill(x * T, y * T, T, T, 0xffffff, Math.min(0.12, 0.03 * Math.floor(h / 2)))
        if (stairAt(W, H, heights, x, y))
          for (let i = 4; i < T; i += 5) {
            pic.fill(x * T + 1, y * T + i - 1, T - 2, 1, 0xfff2d8, 0.3)
            pic.fill(x * T + 1, y * T + i, T - 2, 1, 0x000000, 0.2)
          }
        if (terrace) continue
        const drop = (dx: number, dy: number) => h - (hAt(x + dx, y + dy) ?? h) >= 2
        if (drop(0, -1)) pic.fill(x * T, y * T, T, 1, 0x2a2018, 0.55)
        if (drop(-1, 0)) pic.fill(x * T, y * T, 1, T, 0x2a2018, 0.55)
        if (drop(1, 0)) pic.fill((x + 1) * T - 1, y * T, 1, T, 0x2a2018, 0.55)
        if (drop(0, 1)) {
          pic.fill(x * T, (y + 1) * T, T, 5, 0x6b5a48, 0.85)
          for (let i = 2; i < T; i += 4) pic.fill(x * T + i, (y + 1) * T, 1, 5, 0x4a3c30, 0.9)
          pic.fill(x * T, (y + 1) * T + 5, T, 3, 0x000000, 0.22)
          pic.fill(x * T, (y + 1) * T - 1, T, 1, 0xfff2d8, 0.35)
        }
      }
  })
  // the terrace's rims and faces (ground.ts terracePieces): over the ground and its specks, under all that stands
  if (terrace && heights?.some((h) => h))
    for (const p of terracePieces(W, H, heights)) at(-45, () => pic.blit({ img: terrace, rect: [p.col * T, p.row * T, T, T], x: p.x * T, y: p.y * T, ox: 0, oy: 0 }))

  // the things of the map where the world begins, and the people who start on it
  const model = modelOf(g)
  const snaps: Snap[] = []
  for (const e of ent.entities) {
    const s = snapOf(g, model, e)
    if (s && e.place.on === 'tile' && e.place.map === mapId) snaps.push(s)
  }
  for (const p of g.people) {
    const e = p.entity
    if (p.kind !== 'person' || e.place.on !== 'tile' || e.place.map !== mapId) continue
    const s = snapOf(g, model, e)
    if (s) snaps.push(s)
  }
  const walls = new Set<string>(), floors = new Set<string>(), stairs = new Set<string>()
  for (const e of snaps) {
    if (isWallish(e.type)) walls.add(`${e.x},${e.y},${e.z}`)
    else if (e.type === 'structure/floor') floors.add(`${e.x},${e.y},${e.z}`)
    else if (e.type === 'structure/stairs') stairs.add(`${e.x},${e.y},${e.z}`)
  }
  for (const e of snaps) drawThing(e)

  function drawThing(e: Snap): void {
    const agent = e.tags.includes('agent')
    const body = bodyOf(e)
    if (!body) return
    // on its storey, a storey higher for each; one on stairs half a storey more
    const rx = e.x * T + T / 2
    const ry = (e.y + 1) * T - e.z * STOREY_LIFT - (agent && stairs.has(`${e.x},${e.y},${e.z}`) ? STOREY_LIFT / 2 : 0)
    const depth = depthOf(e, { ground: fixtureDef(e)?.ground, roof: roofs.get(`${e.x},${e.y}`) })
    // the pictures of its container, in order: shadow, wings, body, a built thing's top and lip, overlay, held
    const parts: (() => void)[] = []
    if (agent) {
      const [fw, fd] = e.boss?.footprint ?? [1, 1]
      parts.push(() => pic.ellipse(rx, ry - fd * 4, fw * 11, fd * 6, 0x000000, 0.22))
    }
    const tintStatus = e.statuses.find((s) => TINT_OF[s])
    const tint: Partial<Blit> = tintStatus ? { tint: TINT_OF[tintStatus], tintMode: 'multiply' } : body.tint !== undefined ? { tint: body.tint, tintMode: 'overlay' } : {}
    const loose = !agent && !e.tags.includes('portable') && fixtureDef(e)?.loose
    const [bx, by] = loose ? [(hashStr(e.id, 23) % 9) - 4, (hashStr(e.id, 29) % 5) - 2] : [0, 0]
    const down = !e.boss && (e.statuses.includes('down') || e.statuses.includes('out_cold') || e.statuses.includes('asleep'))
    const s = body.scale ?? (e.type.startsWith('item/') && !e.spaces ? 0.8 : 1)
    let main: Blit | undefined = { img: body.img, rect: body.rect, x: rx + bx, y: ry + by, ox: body.ox, oy: body.oy, sx: s, sy: s, angle: down ? 90 : 0, flipX: !!e.boss && e.facing === 'left', alpha: 1, ...tint }
    const after: (() => void)[] = []
    if (e.type.startsWith('structure/')) main = dressBuilt(e, main, rx, ry, after)
    if (e.sprite === 'boss:dragon') parts.push(...dragonWings(rx, ry))
    if (main) {
      const m = main
      parts.push(() => pic.blit(m))
    }
    parts.push(...after)
    // what a status draws over it (a brazier with a lit picture of its own shows that, not a flame)
    const top = OVERLAY_FX.find(([o]) => e.overlays.includes(o) && !(o === 'flame' && CATALOG.fixtures[e.sprite]?.lit))
    const ov = top && fxFrame(top[1], hashStr(e.id, 31))
    if (ov) parts.push(() => pic.blit({ ...ov, x: rx, y: ry, ox: ov.rect[2] / 2, oy: ov.rect[3], sx: ov.scale ?? 1, sy: ov.scale ?? 1 }))
    const hd = e.held && agent ? CATALOG.items[e.held] : undefined
    const himg = hd && image(hd.img)
    if (hd && himg) parts.push(() => pic.blit({ img: himg, rect: frameOf(hd), x: rx + 6, y: ry - 5, ox: hd.w / 2, oy: hd.h / 2, sx: 0.55, sy: 0.55 }))
    at(depth, () => parts.forEach((p) => p()))
    if (e.sprite === 'boss:dragon') dragonBody(rx, ry, depth)
  }

  /** scene.ts dressBuilt: a wall's front and top, a raised floor's edge and lip, stairs by the way up. */
  function dressBuilt(e: Snap, body: Blit, rx: number, ry: number, after: (() => void)[]): Blit | undefined {
    const k = (dx: number, dy: number, dz = 0) => `${e.x + dx},${e.y + dy},${e.z + dz}`
    const piece = (img: string, i: number, x: number, y: number, w = T, h = T): Blit | undefined => {
      const im = image(img)
      return im && { img: im, rect: [i * w, 0, w, h], x, y, ox: w / 2, oy: h }
    }
    if (isWallish(e.type)) {
      const n = walls.has(k(0, -1)), east = walls.has(k(1, 0)), s = walls.has(k(0, 1)), w = walls.has(k(-1, 0))
      const door = e.type !== 'structure/wall'
      const across = door && (n || s) && !(east || w)
      const top = piece(LSW_WALL, across ? DOOR_ABOVE + (e.type === 'structure/door/open' ? 1 : 0) : (n ? 1 : 0) + (east ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0), rx, ry - STOREY_LIFT)
      if (top && !walls.has(k(0, 0, 1)) && !floors.has(k(0, 0, 1))) after.push(() => pic.blit(top))
      // its front shows where nothing stands south of it
      if (s && !(door && !across)) return undefined
      if (!door || across) return piece(LSW_WALL, 16 + (east ? 1 : 0) + (w ? 2 : 0), rx, ry)
      return { ...body, sx: 1, sy: 1 }
    }
    if (e.type === 'structure/floor' && e.z > 0) {
      const has = (dx: number, dy: number) => floors.has(k(dx, dy)) || walls.has(k(dx, dy, -1))
      const edge = piece(LSW_FLOOR, (has(0, -1) ? 1 : 0) + (has(1, 0) ? 2 : 0) + (has(0, 1) ? 4 : 0) + (has(-1, 0) ? 8 : 0), rx, ry)
      if (edge) after.push(() => pic.blit(edge))
      // its thickness, where nothing holds its south edge nor stands under it
      const lip = !has(0, 1) && !walls.has(k(0, 0, -1)) && piece(LSW_FLOOR, 0, rx, ry + 4, T, 4)
      if (lip) after.push(() => pic.blit({ ...lip, rect: [FLOOR_LIP * T, 0, T, 4] }))
      return { ...body, sx: 1, sy: 1 }
    }
    if (e.type === 'structure/stairs') return piece(LSW_STAIRS, STAIRS_FRAME[e.facing] ?? 0, rx, ry, T, 2 * T) ?? body
    return body
  }

  /** The dragon's wings round its head, at rest (scene.ts dragonParts / updateDragon at its first beat). */
  function dragonWings(rx: number, ry: number): (() => void)[] {
    const w = CATALOG.ui.dragonWing
    const img = image(w.img)
    if (!img) return []
    return [-1, 1].map((side, i) => () => pic.blit({ img, rect: frameOf(w), x: rx + side * 16, y: ry - 30, ox: side < 0 ? w.w : 0, oy: w.h * 0.75, flipX: side > 0, angle: (i ? 1 : -1) * 8, sy: 0.9 }))
  }

  /** The dragon's body and tail, curled behind a head that has not moved, each a little behind the one before. */
  function dragonBody(rx: number, ry: number, depth: number): void {
    const ui = CATALOG.ui
    for (let i = 0; i < DRAGON_SEGMENTS; i++) {
      const d = i === DRAGON_SEGMENTS - 1 ? ui.dragonTail : i % 2 ? ui.dragonBody2 : ui.dragonBody1
      const img = image(d.img)
      if (!img) continue
      const x = rx + Math.sin(i * 0.9) * 10, y = ry - 6 + (i + 1) * 9 + Math.sin(i) * 1.2
      at(depth - 1 - i * 0.01, () => pic.blit({ img, rect: frameOf(d), x, y, ox: d.w / 2, oy: d.h * 0.8 }))
    }
  }

  ops.sort((a, b) => a.depth - b.depth)
  for (const op of ops) op.draw()
  return { w: pic.pw, h: pic.ph, png: encodePng(pic.pw, pic.ph, pic.px) }
}
