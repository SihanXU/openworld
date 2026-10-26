// A review sheet of the people's looks (docs/looks.md §4): each person's standing portrait and map sprite side by side,
// composed by the client's own code from the manifest and the layers the pipeline cut — what a reviewer (and the
// pipeline's next round) looks at.
//
//   npx tsx games/openworld/tools/src/art/looks/review.ts <out.png> [mood]

// the runtime's figures draw this game's looks (packages/runtime/src/game.ts)
import '../../../../client/src/register.ts'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Look, Mood } from '@openworld/engine'
import { PLAYER_LOOK, generateLook } from '@openworld-game/content'
import { bustRect, composePortrait, type LayerPixels, type PortraitManifest } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '@openworld/runtime/src/assets/figure/sprite.ts'
import { PEOPLE } from '../../demo/people.ts'
import { OUT, png, readPng } from '../png.ts'

// the game's portrait layers, or a cut being reviewed before it goes in (LSW_PORTRAIT_DIR)
const ROOT = process.env.LSW_PORTRAIT_DIR ?? join(OUT, 'Looks', 'portrait')

export function loadManifest(): PortraitManifest | undefined {
  const p = join(ROOT, 'manifest.json')
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as PortraitManifest) : undefined
}

const cache = new Map<string, LayerPixels>()
export function layerFromDisk(file: string): LayerPixels | undefined {
  if (!cache.has(file)) {
    const a = join(ROOT, file + '.png')
    const b = join(ROOT, file + '.z.png')
    if (!existsSync(a) || !existsSync(b)) return undefined
    cache.set(file, { paint: readPng(a).rgba, value: readPng(b).rgba })
  }
  return cache.get(file)
}

/** The people's looks as the world gives them (and the player's). */
export function peopleLooks(): { id: string; look: Look }[] {
  return [{ id: 'player', look: PLAYER_LOOK }, ...PEOPLE.map((p) => ({ id: p.id, look: generateLook(p.id, { sex: p.gender, age: p.age, role: p.role }, p.look) }))]
}

/** Downscale RGBA of w x h by an integer factor (box filter). */
function shrink(src: Uint8ClampedArray, w: number, h: number, k: number): Uint8ClampedArray {
  const sw = Math.floor(w / k)
  const sh = Math.floor(h / k)
  const out = new Uint8ClampedArray(sw * sh * 4)
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const acc = [0, 0, 0, 0]
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * w + x * k + dx) * 4
          const a = src[i + 3]
          acc[0] += src[i] * a
          acc[1] += src[i + 1] * a
          acc[2] += src[i + 2] * a
          acc[3] += a
        }
      const o = (y * sw + x) * 4
      out[o] = acc[3] ? acc[0] / acc[3] : 0
      out[o + 1] = acc[3] ? acc[1] / acc[3] : 0
      out[o + 2] = acc[3] ? acc[2] / acc[3] : 0
      out[o + 3] = acc[3] / (k * k)
    }
  return out
}

/** A look's bust cut from its figure (the square the dialogue box shows). */
export function bustOf(m: PortraitManifest, look: Look, figure: Uint8ClampedArray): { w: number; h: number; rgba: Uint8ClampedArray } {
  const r = bustRect(m, look)
  const rgba = new Uint8ClampedArray(r.w * r.h * 4)
  for (let y = 0; y < r.h; y++) rgba.set(figure.subarray(((r.y + y) * m.w + r.x) * 4, ((r.y + y) * m.w + r.x + r.w) * 4), y * r.w * 4)
  return { w: r.w, h: r.h, rgba }
}

/** Loud colours for a part's keys, so a stray pixel of any layer shows on the bare body and the dark ground. */
const LOUD: Record<string, string> = { hair: 'gold', skin: 'light', eyes: 'sky', '1': 'madder', '2': 'teal', '3': 'ochre' }

/**
 * Every part drawn for a body, each alone on the bare body (with the body's first face, so hair and hats sit on a
 * face), in loud colours on a dark ground, `cols` to a row, at 1/k: what the reviewer zooms into for colour leaks.
 */
export function partsSheet(m: PortraitManifest, body: string, k = 2, cols = 8): { w: number; h: number; rgba: Uint8Array } {
  const ids = Object.keys(m.parts).filter((id) => m.parts[id][body]).sort()
  const face = ids.find((id) => id.startsWith('face.'))
  const colors = (id: string) => {
    const slot = id.split('.')[0]
    return { hair: LOUD.hair, skin: LOUD.skin, eyes: LOUD.eyes, [`${slot}.1`]: LOUD['1'], [`${slot}.2`]: LOUD['2'], [`${slot}.3`]: LOUD['3'] }
  }
  const PW = Math.floor(m.w / k)
  const PH = Math.floor(m.h / k)
  const W = cols * PW
  const H = Math.ceil(ids.length / cols) * PH
  const rgba = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) rgba.set([34, 38, 46, 255], i * 4)
  ids.forEach((id, n) => {
    const slot = id.split('.')[0]
    const parts: Record<string, string> = { [slot]: id }
    if (face && slot !== 'face') parts.face = face
    const fig = shrink(composePortrait(m, { body, parts, colors: colors(id) }, undefined, layerFromDisk), m.w, m.h, k)
    const ox = (n % cols) * PW
    const oy = Math.floor(n / cols) * PH
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = (y * PW + x) * 4
        const t = fig[i + 3] / 255
        if (!t) continue
        const o = ((oy + y) * W + ox + x) * 4
        for (let c = 0; c < 3; c++) rgba[o + c] = rgba[o + c] * (1 - t) + fig[i + c] * t
      }
  })
  return { w: W, h: H, rgba }
}

if (process.argv[1]?.endsWith('review.ts') && process.argv[3] === '--parts') {
  // npx tsx review.ts <out-prefix> --parts [k]: <out-prefix>-<body>.png, every part alone on each body
  const m = loadManifest()
  if (!m) throw new Error(`no manifest in ${ROOT}: run portrait/build.py first`)
  const k = Number(process.argv[4] ?? 2)
  for (const body of Object.keys(m.bodies)) {
    const s = partsSheet(m, body, k)
    const out = `${process.argv[2].replace(/\.png$/, '')}-${body}.png`
    writeFileSync(out, png(s.w, s.h, s.rgba))
    console.log(out)
  }
} else if (process.argv[1]?.endsWith('review.ts')) {
  const out = process.argv[2] ?? 'looks-review.png'
  const mood = process.argv[3] as Mood | undefined
  const m = loadManifest()
  if (!m) throw new Error(`no manifest in ${ROOT}: run portrait/build.py first`)
  const people = peopleLooks()
  // each person: the standing figure at a third, the map sprite at four times beside its feet
  const k = 3
  const PW = Math.floor(m.w / k)
  const PH = Math.floor(m.h / k)
  const SP = 4
  const cw = PW + FW * SP + 12
  const cols = 8
  const rows = Math.ceil(people.length / cols)
  const W = cols * cw
  const H = rows * (PH + 8)
  const rgba = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) rgba.set([230, 226, 214, 255], i * 4)
  people.forEach(({ look }, n) => {
    const ox = (n % cols) * cw
    const oy = Math.floor(n / cols) * (PH + 8)
    const fig = shrink(composePortrait(m, look, mood, layerFromDisk), m.w, m.h, k)
    const blend = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const o = (y * W + x) * 4
      const t = a / 255
      rgba[o] = rgba[o] * (1 - t) + r * t
      rgba[o + 1] = rgba[o + 1] * (1 - t) + g * t
      rgba[o + 2] = rgba[o + 2] * (1 - t) + b * t
    }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = (y * PW + x) * 4
      if (fig[i + 3]) blend(ox + x, oy + y, fig[i], fig[i + 1], fig[i + 2], fig[i + 3])
    }
    const s = composeSprite(look)
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = ((IDLE_ROW * FH + y) * FW * 4 + x) * 4
      if (!s[i + 3]) continue
      for (let dy = 0; dy < SP; dy++) for (let dx = 0; dx < SP; dx++) blend(ox + PW + 4 + x * SP + dx, oy + PH - FH * SP + y * SP + dy, s[i], s[i + 1], s[i + 2], 255)
    }
  })
  writeFileSync(out, png(W, H, rgba))
  console.log(out, people.length, 'people')
}
