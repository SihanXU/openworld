// A review sheet of the people's looks (docs/looks.md §4): each person's portrait and map sprite side by side,
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
import { composePortrait, type LayerPixels, type PortraitManifest } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '@openworld/runtime/src/assets/figure/sprite.ts'
import { PEOPLE } from '../../demo/people.ts'
import { OUT, png, readPng } from '../png.ts'

const ROOT = join(OUT, 'Looks', 'portrait')

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

/** Downscale RGBA by an integer factor (box filter). */
function shrink(src: Uint8ClampedArray, S: number, k: number): Uint8ClampedArray {
  const s = S / k
  const out = new Uint8ClampedArray(s * s * 4)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const acc = [0, 0, 0, 0]
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * S + x * k + dx) * 4
          const a = src[i + 3]
          acc[0] += src[i] * a
          acc[1] += src[i + 1] * a
          acc[2] += src[i + 2] * a
          acc[3] += a
        }
      const o = (y * s + x) * 4
      out[o] = acc[3] ? acc[0] / acc[3] : 0
      out[o + 1] = acc[3] ? acc[1] / acc[3] : 0
      out[o + 2] = acc[3] ? acc[2] / acc[3] : 0
      out[o + 3] = acc[3] / (k * k)
    }
  return out
}

if (process.argv[1]?.endsWith('review.ts')) {
  const out = process.argv[2] ?? 'looks-review.png'
  const mood = process.argv[3] as Mood | undefined
  const m = loadManifest()
  if (!m) throw new Error(`no manifest in ${ROOT}: run portrait/build.py first`)
  const people = peopleLooks()
  const k = 3
  const P = m.size / k
  const SP = 4
  const cw = P + FW * SP + 16
  const cols = 5
  const rows = Math.ceil(people.length / cols)
  const W = cols * cw
  const H = rows * (P + 8)
  const rgba = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) rgba.set([226, 220, 206, 255], i * 4)
  people.forEach(({ look }, n) => {
    const ox = (n % cols) * cw
    const oy = Math.floor(n / cols) * (P + 8)
    const bust = shrink(composePortrait(m, look, mood, layerFromDisk), m.size, k)
    const blend = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const o = (y * W + x) * 4
      const t = a / 255
      rgba[o] = rgba[o] * (1 - t) + r * t
      rgba[o + 1] = rgba[o + 1] * (1 - t) + g * t
      rgba[o + 2] = rgba[o + 2] * (1 - t) + b * t
    }
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const i = (y * P + x) * 4
      if (bust[i + 3]) blend(ox + x, oy + y, bust[i], bust[i + 1], bust[i + 2], bust[i + 3])
    }
    const s = composeSprite(look)
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = ((IDLE_ROW * FH + y) * FW * 4 + x) * 4
      if (!s[i + 3]) continue
      for (let dy = 0; dy < SP; dy++) for (let dx = 0; dx < SP; dx++) blend(ox + P + 8 + x * SP + dx, oy + P - FH * SP + y * SP + dy, s[i], s[i + 1], s[i + 2], 255)
    }
  })
  writeFileSync(out, png(W, H, rgba))
  console.log(out, people.length, 'people')
}
