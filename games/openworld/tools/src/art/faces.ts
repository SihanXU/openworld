// Expression variants of the portraits: the pack has one face per character, so the moods a line
// carries (engine `Mood`) are drawn here as small pixel patches over each face. Deterministic: the
// eyes and mouth are found from the pixels (the pack's faces share a layout: a large head, two dark
// eye blobs of the outline colour, a small mouth below), a short table corrects the faces the
// detector misreads or skips, and each mood redraws only the eyes, brows, mouth and cheeks, in the
// face's own outline and skin colours (plus a blush and a tear from the pack's palette).
//
// Output: one strip per face, lsw/Faces/<faceset path>, its frames the face itself and then each of
// its moods; and the client's src/assets/faces.json, faceset path -> { strip, moods }, frame i + 1
// being moods[i]. A face added later gets its moods by running this again.
//
//   npm run art:faces                       (write the strips and the manifest)
//   npm run art:faces -- --sheet <dir>      (also review pages: each face's strip and its features marked)

import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Mood } from '@lsw/engine'
import { OUT, png, readPng, writePng } from './png.ts'

export const FACE_MOODS: readonly Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']

export interface Img {
  w: number
  h: number
  rgba: Uint8Array
}
/** Inclusive pixel box. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
type RGBA = [number, number, number, number]

export type EyeKind = 'dot' | 'line' | 'big'

/** Where a face's features are, in its own pixels (a doubled face: in half pixels). */
export interface FaceMap {
  /** 2 when the face is drawn on a doubled grid (the fairy). */
  scale: number
  /** Left then right, as seen. */
  eyes: [Box, Box]
  /** A small dark blob, a closed line or arc, or a large eye with whites. */
  kinds: [EyeKind, EyeKind]
  /** The mouth as drawn, if the face shows one; else only where one would be (`mouthAt`). */
  mouth?: Box
  mouthAt: [number, number]
  masked?: boolean
  dark: RGBA
  /** Skin round each eye, and round the mouth. */
  skin: [RGBA, RGBA, RGBA]
}

export interface FaceFix {
  eyes?: [Box, Box]
  /** The mouth as drawn (null: none to erase). */
  mouth?: Box | null
  /** A mask or a scarf over the mouth: only the eyes and brows change. */
  masked?: boolean
  moods?: Mood[]
}

/** Per face (keyed by the catalogue's faceset path): 'skip' (no variants), or what the detector gets wrong (boxes in the face's own pixels). */
export const FACE_FIXES: Record<string, 'skip' | FaceFix> = {
  'Actor/Character/Child/Faceset.png': 'skip', // the laugh is the whole face
  'Actor/Character/ManGreen/Faceset1.png': 'skip', // eyes under the hair
  'Actor/Character/MaskFrog/Faceset.png': 'skip', // a mask
  'Actor/Character/NinjaMasked/Faceset.png': 'skip', // a mask
  'Actor/Character/NinjaYellow/Faceset.png': 'skip', // eyes in a visor
  'Actor/Character/Samurai/Faceset.png': 'skip', // the grin is the face
  'Actor/Character/SamuraiRed/Faceset.png': 'skip', // one eye under a hat
  'Actor/Character/ShamanLion/Faceset.png': 'skip', // a skull for a face
  'Actor/Character/Monkey/Faceset.png': 'skip', // a muzzle
  'Actor/Character/LionBoy/Faceset.png': 'skip', // a muzzle
  'Actor/Character/GreenPig/Faceset.png': 'skip', // a snout and tusks
  'Actor/Character/Pig/Faceset.png': 'skip', // a snout where the mouth would be
  'Actor/Character/Sultan/Faceset.png': 'skip', // too small under the beard
  'Actor/Character/Sultan2/Faceset.png': 'skip',
  'Actor/Character/SamuraiBlue/Faceset.png': 'skip', // the far eye reads as the ear
  'Actor/Character/MonkeyBoxerBlue/Faceset.png': 'skip', // a muzzle
  'Actor/Character/MonkeyBoxerRed/Faceset.png': 'skip',
  'Actor/Character/Boy/Faceset.png': { mouth: { x0: 13, y0: 22, x1: 23, y1: 27 } }, // the laugh, teeth and tongue
  'Actor/Character/Woman/Faceset.png': { mouth: { x0: 11, y0: 22, x1: 17, y1: 24 } }, // red lips, lighter than the skin's shade
  // drawn on a doubled grid: eyes with whites and an iris, a pink mouth (in half pixels)
  'lsw/Companion/Fairy/Faceset.png': { eyes: [{ x0: 6, y0: 8, x1: 7, y1: 10 }, { x0: 11, y0: 8, x1: 12, y1: 10 }], mouth: { x0: 9, y0: 12, x1: 9, y1: 12 } },
  // eyes in the hat's shadow (brows would vanish there: no angry, no surprised), the mouth under the moustache
  'Actor/Character/OldMan2/Faceset.png': { eyes: [{ x0: 10, y0: 20, x1: 13, y1: 23 }, { x0: 21, y0: 20, x1: 24, y1: 23 }], masked: true, moods: ['happy', 'sad', 'shy'] },
  'Actor/Character/NinjaBlue2/Faceset.png': { masked: true },
  'Actor/Character/NinjaGray/Faceset.png': { masked: true },
  'Actor/Character/NinjaGreen/Faceset.png': { masked: true },
  'Actor/Character/NinjaRed2/Faceset.png': { masked: true },
}

// ---------------------------------------------------------------- pixels

const BLUSH: RGBA = [224, 57, 76, 255] // the pack's red, as its own faces blush
const TEAR: RGBA = [121, 184, 206, 255] // the pack's water blue
const WHITE: RGBA = [242, 234, 241, 255] // the pack's eye white

const at = (im: Img, x: number, y: number): RGBA => {
  const i = (y * im.w + x) * 4
  return [im.rgba[i], im.rgba[i + 1], im.rgba[i + 2], im.rgba[i + 3]]
}
const key = (c: RGBA) => (c[3] === 0 ? 0 : ((c[0] << 16) | (c[1] << 8) | c[2]) + 1)
const luma = (c: RGBA) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
const inside = (im: Img, x: number, y: number) => x >= 0 && y >= 0 && x < im.w && y < im.h
function put(im: Img, x: number, y: number, c: RGBA): void {
  if (inside(im, x, y)) im.rgba.set(c, (y * im.w + x) * 4)
}
const clone = (im: Img): Img => ({ w: im.w, h: im.h, rgba: im.rgba.slice() })

/** 2 when every 2x2 block is one colour (a face drawn on a doubled grid), else 1. */
function gridScale(im: Img): number {
  if (im.w % 2 || im.h % 2) return 1
  for (let y = 0; y < im.h; y += 2)
    for (let x = 0; x < im.w; x += 2) {
      const k = key(at(im, x, y))
      if (key(at(im, x + 1, y)) !== k || key(at(im, x, y + 1)) !== k || key(at(im, x + 1, y + 1)) !== k) return 1
    }
  return 2
}
function shrink(im: Img, s: number): Img {
  if (s === 1) return clone(im)
  const o: Img = { w: im.w / s, h: im.h / s, rgba: new Uint8Array((im.w / s) * (im.h / s) * 4) }
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) put(o, x, y, at(im, x * s, y * s))
  return o
}
function grow(im: Img, s: number): Img {
  if (s === 1) return im
  const o: Img = { w: im.w * s, h: im.h * s, rgba: new Uint8Array(im.w * s * im.h * s * 4) }
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) put(o, x, y, at(im, Math.floor(x / s), Math.floor(y / s)))
  return o
}

/** The most frequent colour among `pts` (ties: the lower key, so the choice is stable). */
function commonest(im: Img, pts: [number, number][]): RGBA | undefined {
  const n = new Map<number, { c: RGBA; n: number }>()
  for (const [x, y] of pts) {
    if (!inside(im, x, y)) continue
    const c = at(im, x, y)
    const e = n.get(key(c)) ?? { c, n: 0 }
    e.n++
    n.set(key(c), e)
  }
  return [...n.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0]?.[1].c
}

// ---------------------------------------------------------------- detection

interface Comp {
  pts: [number, number][]
  box: Box
  cx: number
  cy: number
}

function components(im: Img, mask: boolean[]): Comp[] {
  const seen = new Uint8Array(im.w * im.h)
  const out: Comp[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    const pts: [number, number][] = []
    const stack = [i]
    seen[i] = 1
    while (stack.length) {
      const j = stack.pop()!
      const x = j % im.w
      const y = (j - x) / im.w
      pts.push([x, y])
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          const k = ny * im.w + nx
          if (inside(im, nx, ny) && mask[k] && !seen[k]) (seen[k] = 1), stack.push(k)
        }
    }
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    out.push({ pts, box, cx: xs.reduce((a, b) => a + b, 0) / pts.length, cy: ys.reduce((a, b) => a + b, 0) / pts.length })
  }
  return out
}

/** The outline colour: the darkest colour drawn often. */
function darkOf(im: Img): RGBA {
  const n = new Map<number, { c: RGBA; n: number }>()
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      const c = at(im, x, y)
      if (c[3] < 255) continue
      const e = n.get(key(c)) ?? { c, n: 0 }
      e.n++
      n.set(key(c), e)
    }
  return [...n.values()].filter((e) => e.n >= 12).sort((a, b) => luma(a.c) - luma(b.c) || key(a.c) - key(b.c))[0].c
}

/** The pixels round a box (without its top row: over an eye lie hair, brows and headbands). */
const ring = (b: Box, top = true): [number, number][] => {
  const p: [number, number][] = []
  for (let x = b.x0 - 1; x <= b.x1 + 1; x++) p.push(...(top ? [[x, b.y0 - 1] as [number, number]] : []), [x, b.y1 + 1])
  for (let y = b.y0; y <= b.y1; y++) p.push([b.x0 - 1, y], [b.x1 + 1, y])
  return p
}
const notDark = (im: Img, dark: RGBA, pts: [number, number][]) => pts.filter(([x, y]) => inside(im, x, y) && key(at(im, x, y)) !== key(dark) && at(im, x, y)[3] === 255)

/** Find the eyes (two enclosed blobs of the outline colour, side by side) and the mouth below them. */
export function detect(src: Img, fix?: FaceFix): FaceMap | undefined {
  const scale = gridScale(src)
  const im = shrink(src, scale)
  const dark = darkOf(im)
  const dk = key(dark)
  // the outside: the clear and outline pixels reachable from the border
  const outer = new Uint8Array(im.w * im.h)
  const stack: number[] = []
  const open = (x: number, y: number) => {
    const c = at(im, x, y)
    return c[3] < 255 || key(c) === dk
  }
  for (let x = 0; x < im.w; x++) for (const y of [0, im.h - 1]) if (open(x, y)) stack.push(y * im.w + x)
  for (let y = 0; y < im.h; y++) for (const x of [0, im.w - 1]) if (open(x, y)) stack.push(y * im.w + x)
  while (stack.length) {
    const j = stack.pop()!
    if (outer[j]) continue
    outer[j] = 1
    const x = j % im.w
    const y = (j - x) / im.w
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
      if (inside(im, nx, ny) && !outer[ny * im.w + nx] && open(nx, ny)) stack.push(ny * im.w + nx)
  }
  const innerDark = Array.from({ length: im.w * im.h }, (_, i) => !outer[i] && key(at(im, i % im.w, Math.floor(i / im.w))) === dk)
  const blobs = components(im, innerDark)

  let eyes: [Box, Box] | undefined = fix?.eyes
  if (!eyes) {
    const cand = blobs.filter((b) => b.pts.length <= 20 && b.box.x1 - b.box.x0 <= 6 && b.box.y1 - b.box.y0 <= 6 && b.cy >= im.h * 0.25 && b.cy <= im.h * 0.75)
    let best: { s: number; a: Comp; b: Comp } | undefined
    for (const a of cand)
      for (const b of cand) {
        if (b.cx <= a.cx) continue
        const dx = b.cx - a.cx
        const dy = Math.abs(b.cy - a.cy)
        if (dx < 4 || dx > im.w * 0.45 || dy > 2.5) continue
        const s = dy * 2 + (Math.abs(a.pts.length - b.pts.length) / Math.max(a.pts.length, b.pts.length)) * 4 + Math.abs((a.cx + b.cx) / 2 - im.w / 2) / 4
        if (!best || s < best.s) best = { s, a, b }
      }
    if (!best) return undefined
    // an eye's whites and highlights belong to it
    const skin = commonest(im, notDark(im, dark, [...ring(best.a.box, false), ...ring(best.b.box, false)])) ?? dark
    const withWhites = (c: Comp): Box => {
      const b = { ...c.box }
      let edge = c.pts
      for (let step = 0; step < 2; step++) {
        const next: [number, number][] = []
        for (const [x, y] of edge)
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
            if (inside(im, nx, ny) && (nx < b.x0 || nx > b.x1 || ny < b.y0 || ny > b.y1) && luma(at(im, nx, ny)) > luma(skin) + 30 && at(im, nx, ny)[3] === 255) next.push([nx, ny])
        for (const [x, y] of next) (b.x0 = Math.min(b.x0, x)), (b.x1 = Math.max(b.x1, x)), (b.y0 = Math.min(b.y0, y)), (b.y1 = Math.max(b.y1, y))
        edge = next
      }
      return b.x1 - b.x0 < 7 && b.y1 - b.y0 < 6 ? b : c.box
    }
    eyes = [withWhites(best.a), withWhites(best.b)]
    if (eyes[0].x1 >= eyes[1].x0) eyes = [best.a.box, best.b.box]
  }
  const [l, r] = eyes
  const eyeBottom = Math.max(l.y1, r.y1)
  const lcx = (l.x0 + l.x1) / 2
  const rcx = (r.x0 + r.x1) / 2
  const skinOf = (b: Box, top = true) => commonest(im, notDark(im, dark, ring(b, top))) ?? dark
  const eyeSkin = skinOf(l, false)
  const mid = (lcx + rcx) / 2
  // the face's own skin below the eyes (round the eyes it may be a shade)
  const below: [number, number][] = []
  for (let y = eyeBottom + 1; y <= eyeBottom + 8; y++) for (let x = l.x0; x <= r.x1; x++) if (!outer[y * im.w + x]) below.push([x, y])
  const faceSkin = commonest(im, notDark(im, dark, below)) ?? eyeSkin

  let mouth: Box | undefined = fix?.mouth ?? undefined
  if (fix?.mouth === undefined) {
    // an enclosed dark mark below the eyes and between them, or a mark darker than the skin there
    const near = (c: Comp) => c.box.y0 > eyeBottom && c.box.y0 <= eyeBottom + 8 && Math.abs(c.cx - mid) <= Math.max(1.5, (rcx - lcx) / 2 - 1) && c.pts.length <= 30 && c.box.x1 - c.box.x0 <= 11 && c.box.y1 - c.box.y0 <= 4
    const sk = key(faceSkin)
    const shade = Array.from({ length: im.w * im.h }, (_, i) => {
      const x = i % im.w
      const y = (i - x) / im.w
      const c = at(im, x, y)
      return !outer[i] && y > eyeBottom && y <= eyeBottom + 12 && x >= l.x1 && x <= r.x0 && c[3] === 255 && key(c) !== sk && key(c) !== dk && luma(c) < luma(faceSkin) - 20
    })
    const cands = [...blobs.filter(near).map((c) => ({ c, s: 0 })), ...components(im, shade).filter((c) => c.pts.length >= 2 && near(c)).map((c) => ({ c, s: 1 }))]
    const score = (e: { c: Comp; s: number }) => e.s + Math.abs(e.c.cx - mid) + Math.abs(e.c.box.y0 - (eyeBottom + 4))
    mouth = cands.sort((a, b) => score(a) - score(b) || a.c.box.y0 - b.c.box.y0 || a.c.cx - b.c.cx)[0]?.c.box
  }
  const mouthAt: [number, number] = mouth
    ? [Math.round((mouth.x0 + mouth.x1) / 2), Math.round((mouth.y0 + mouth.y1) / 2)]
    : [Math.round(mid), eyeBottom + Math.max(4, Math.round((rcx - lcx) / 2))]
  const mb = mouth ?? { x0: mouthAt[0] - 1, y0: mouthAt[1], x1: mouthAt[0] + 1, y1: mouthAt[1] }
  const kind = (b: Box): EyeKind => {
    const w = b.x1 - b.x0 + 1
    const h = b.y1 - b.y0 + 1
    let n = 0
    let light = false
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = at(im, x, y)
        if (key(c) === dk) n++
        else if (luma(c) > luma(eyeSkin) + 30) light = true
      }
    return light || w * h >= 12 ? 'big' : h >= 2 && w <= 3 && n / (w * h) >= 0.6 ? 'dot' : 'line'
  }
  return { scale, eyes, kinds: [kind(l), kind(r)], mouth, mouthAt, ...(fix?.masked ? { masked: true } : {}), dark, skin: [eyeSkin, skinOf(r, false), skinOf(mb)] }
}

// ---------------------------------------------------------------- the moods

const fill = (im: Img, b: Box, c: RGBA) => {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) put(im, x, y, c)
}

/** One mood of a face (neutral: the face itself). */
export function express(src: Img, f: FaceMap, mood: Mood): Img {
  if (mood === 'neutral') return clone(src)
  const im = shrink(src, f.scale)
  const D = f.dark
  const [mx, my] = f.mouthAt
  const eyes = f.eyes.map((b, i) => ({ b, kind: f.kinds[i], w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, out: i === 0 ? -1 : 1, skin: f.skin[i] }))
  type Eye = (typeof eyes)[number]
  // a brow over an eye, from one pixel beyond its outer side to its inner side, the outer end `outerUp` higher (negative: lower)
  const brow = (e: Eye, lift: number, outerUp: number) => {
    const { b, out } = e
    const xo = out < 0 ? b.x0 - 1 : b.x1 + 1
    const xi = out < 0 ? b.x1 : b.x0
    const n = Math.abs(xi - xo)
    for (let k = 0; k <= n; k++) put(im, xo + Math.sign(xi - xo) * k, b.y0 - lift - Math.round(outerUp * (1 - k / n)), D)
  }
  const row = (x0: number, x1: number, y: number, c = D) => {
    for (let x = x0; x <= x1; x++) put(im, x, y, c)
  }
  // the eyes and brows
  for (const e of eyes)
    switch (mood) {
      case 'happy': {
        // closed and smiling: an arch as wide as the eye
        fill(im, e.b, e.skin)
        const y = Math.round((e.b.y0 + e.b.y1) / 2)
        row(e.b.x0, e.b.x1, y)
        put(im, e.b.x0 - 1, y + 1, D)
        put(im, e.b.x1 + 1, y + 1, D)
        break
      }
      case 'sad': {
        brow(e, 2, -1)
        const x = e.out < 0 ? e.b.x0 : e.b.x1
        put(im, x, e.b.y1 + 1, TEAR)
        put(im, x, e.b.y1 + 2, TEAR)
        break
      }
      case 'angry':
        brow(e, 1, 1)
        break
      case 'surprised': {
        if (e.kind === 'big') {
          row(e.b.x0, e.b.x1, e.b.y0 - 3)
          break
        }
        // wide open, with a highlight; a closed eye opens
        const cx = Math.round((e.b.x0 + e.b.x1) / 2)
        const box = e.kind === 'dot' ? { ...e.b, y0: e.b.y0 - 1 } : { x0: cx - 1, y0: e.b.y1 - 3, x1: cx, y1: e.b.y1 }
        fill(im, e.b, e.skin)
        fill(im, box, D)
        put(im, box.x0, box.y0, WHITE)
        row(box.x0, box.x1, box.y0 - 2)
        break
      }
      case 'shy': {
        if (e.kind === 'dot') {
          // looking down and aside
          fill(im, e.b, e.skin)
          fill(im, { x0: e.b.x0 - 1, y0: e.b.y0 + 1, x1: e.b.x1 - 1, y1: e.b.y1 }, D)
        }
        const x = e.out < 0 ? e.b.x0 - 1 : e.b.x1 - 1
        row(x, x + 2, e.b.y1 + 2, BLUSH)
        break
      }
    }
  // the mouth
  if (f.masked) return grow(im, f.scale)
  if (f.mouth) fill(im, f.mouth, f.skin[2])
  switch (mood) {
    case 'happy': // open, smiling
      row(mx - 2, mx + 2, my)
      row(mx - 1, mx + 1, my + 1)
      break
    case 'sad': // turned down
      row(mx - 1, mx, my)
      put(im, mx - 2, my + 1, D)
      put(im, mx + 1, my + 1, D)
      break
    case 'angry': // set flat
      row(mx - 2, mx + 1, my)
      break
    case 'surprised': // a small round o
      fill(im, { x0: mx - 1, y0: my - 1, x1: mx, y1: my + 1 }, D)
      break
    case 'shy': // small
      row(mx - 1, mx, my)
      break
  }
  return grow(im, f.scale)
}

// ---------------------------------------------------------------- the files

const ASSETS = resolve(OUT, '..')
const NA = join(ASSETS, 'na')
const MANIFEST = resolve(OUT, '../../../src/assets/faces.json')

/** Every faceset under assets/, as the catalogue names it (`Actor/...` in the pack, `lsw/...` the project's own). */
export function facesets(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) {
        if (p !== resolve(OUT, 'Faces')) walk(p)
      } else if (/^Faceset\d*\.png$/.test(n)) found.push((p.startsWith(NA + sep) || p.startsWith(NA + '/') ? relative(NA, p) : relative(ASSETS, p)).split(sep).join('/'))
    }
  }
  walk(join(NA, 'Actor'))
  walk(OUT)
  return found
}
export const sourceOf = (path: string) => (path.startsWith('lsw/') ? join(ASSETS, path) : join(NA, path))
/** Where a faceset's strip is written, under lsw/. */
export const stripOf = (path: string) => `Faces/${path.replace(/^lsw\//, '')}`

/** A face's moods (beyond neutral) and its strip (the face, then those moods), or undefined if it has none. */
export function faceStrip(path: string): { moods: Mood[]; strip: Img; map: FaceMap } | undefined {
  const fix = FACE_FIXES[path]
  if (fix === 'skip') return undefined
  const src = readPng(sourceOf(path))
  const map = detect(src, fix)
  if (!map) return undefined
  const moods = FACE_MOODS.filter((m) => m !== 'neutral' && (!fix?.moods || fix.moods.includes(m)))
  const frames: Mood[] = ['neutral', ...moods]
  const strip: Img = { w: src.w * frames.length, h: src.h, rgba: new Uint8Array(src.w * frames.length * src.h * 4) }
  frames.forEach((m, i) => {
    const f = express(src, map, m)
    for (let y = 0; y < src.h; y++) strip.rgba.set(f.rgba.subarray(y * src.w * 4, (y + 1) * src.w * 4), (y * strip.w + i * src.w) * 4)
  })
  return { moods, strip, map }
}

/** Review pages under `dir`: a face a row, its strip and its features marked (eyes magenta, mouth cyan), 4x. */
function sheets(rows: { strip: Img; marks: Img }[], dir: string): void {
  const S = 4
  const per = 8
  const cellW = (FACE_MOODS.length + 1) * 39 * S
  const cellH = (38 + 3) * S
  mkdirSync(dir, { recursive: true })
  for (let p = 0; p * per < rows.length; p++) {
    const page = rows.slice(p * per, (p + 1) * per)
    const out: Img = { w: cellW, h: cellH * per, rgba: new Uint8Array(cellW * cellH * per * 4).fill(255) }
    page.forEach((r, j) => {
      const ox = 0
      const oy = j * cellH
      const fw = r.marks.w
      const frames = [...Array(r.strip.w / fw).keys()].map((k) => ({ im: r.strip, sx: k * fw })).concat([{ im: r.marks, sx: 0 }])
      frames.forEach((fr, k) => {
        for (let y = 0; y < r.marks.h * S; y++)
          for (let x = 0; x < fw * S; x++) {
            const c = at(fr.im, fr.sx + Math.floor(x / S), Math.floor(y / S))
            const a = c[3] / 255
            put(out, ox + k * 39 * S + x, oy + y, [0, 1, 2].map((i) => Math.round(c[i] * a + 200 * (1 - a))).concat(255) as RGBA)
          }
      })
    })
    writeFileSync(join(dir, `faces-${p}.png`), png(out.w, out.h, out.rgba))
  }
}

function marked(src: Img, f: FaceMap): Img {
  const im = clone(src)
  const s = f.scale
  const box = (b: Box, c: RGBA) => {
    for (let y = b.y0 * s; y < (b.y1 + 1) * s; y++) for (let x = b.x0 * s; x < (b.x1 + 1) * s; x++) put(im, x, y, c)
  }
  for (const e of f.eyes) box(e, [255, 0, 255, 255])
  box(f.mouth ?? { x0: f.mouthAt[0], y0: f.mouthAt[1], x1: f.mouthAt[0], y1: f.mouthAt[1] }, f.mouth ? [0, 255, 255, 255] : [0, 128, 255, 255])
  return im
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  rmSync(join(OUT, 'Faces'), { recursive: true, force: true })
  const manifest: string[] = []
  const rows: { strip: Img; marks: Img }[] = []
  const skipped: string[] = []
  for (const path of facesets()) {
    const r = faceStrip(path)
    if (!r) {
      skipped.push(path)
      continue
    }
    writePng(stripOf(path), r.strip.w, r.strip.h, r.strip.rgba)
    manifest.push(`  ${JSON.stringify(path)}: ${JSON.stringify({ strip: `lsw/${stripOf(path)}`, moods: r.moods })}`)
    rows.push({ strip: r.strip, marks: marked(readPng(sourceOf(path)), r.map) })
    console.log(`${String(rows.length - 1).padStart(3)} ${path}`)
  }
  writeFileSync(MANIFEST, `{\n${manifest.join(',\n')}\n}\n`)
  console.log(`faces: ${rows.length} with moods, ${skipped.length} without (${skipped.join(', ')})`)
  const i = process.argv.indexOf('--sheet')
  if (i > 0) sheets(rows, process.argv[i + 1])
}
