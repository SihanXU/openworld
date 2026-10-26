// Before and after, side by side: looks composed from two portrait folders (the layers as they were and as they are),
// on a dark ground, each look's pair left to right — what a change to the cut layers is shown with.
//
//   npx tsx games/openworld/tools/src/art/looks/pair.ts <before dir> <after dir> <out.png> [k]

// the runtime's figures draw this game's looks (packages/runtime/src/game.ts)
import '../../../../client/src/register.ts'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Look } from '@openworld/engine'
import { composePortrait, type LayerPixels, type PortraitManifest } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { png, readPng } from '../png.ts'

/** The looks the pairs show: the ones the leaks were found on, and one of each kind of part. */
export const PAIRS: Look[] = [
  { body: 'woman', parts: { hair: 'hair.tied', face: 'face.bright', outfit: 'outfit.dress', shoes: 'shoes.shoes' }, colors: { hair: 'gold', eyes: 'sky', skin: 'fair', 'outfit.1': 'woad', 'outfit.2': 'linen' } },
  { body: 'woman', parts: { hair: 'hair.swept', face: 'face.soft', outfit: 'outfit.adventurer', shoes: 'shoes.tall' }, colors: { hair: 'gold', eyes: 'leaf', skin: 'light', 'outfit.1': 'teal' } },
  { body: 'man', parts: { hair: 'hair.bun', face: 'face.keen', outfit: 'outfit.tunic', shoes: 'shoes.boots' }, colors: { hair: 'copper', eyes: 'sky', skin: 'warm' } },
  { body: 'man', parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.plate', hat: 'hat.circlet' }, colors: { hair: 'ash', eyes: 'storm', skin: 'tan' } },
  { body: 'girl', parts: { hair: 'hair.childbob', face: 'face.child', outfit: 'outfit.smock', shoes: 'shoes.buckled' }, colors: { hair: 'gold', eyes: 'sky', skin: 'porcelain' } },
  { body: 'boy', parts: { hair: 'hair.tuft', face: 'face.child', outfit: 'outfit.smock', legs: 'legs.wraps', shoes: 'shoes.shoes' }, colors: { hair: 'snow', eyes: 'amber', skin: 'brown' } },
]

function folder(dir: string) {
  const root = resolve(dir)
  const m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as PortraitManifest
  const cache = new Map<string, LayerPixels>()
  const get = (file: string) => {
    if (!cache.has(file)) {
      const a = join(root, file + '.png')
      const b = join(root, file + '.z.png')
      if (!existsSync(a) || !existsSync(b)) return undefined
      cache.set(file, { paint: readPng(a).rgba, value: readPng(b).rgba })
    }
    return cache.get(file)
  }
  return { m, get }
}

if (process.argv[1]?.endsWith('pair.ts')) {
  const [before, after, out] = process.argv.slice(2)
  const k = Number(process.argv[5] ?? 2)
  const sides = [folder(before), folder(after)]
  const { w: CW, h: CH } = sides[1].m
  const PW = Math.floor(CW / k)
  const PH = Math.floor(CH / k)
  const W = PAIRS.length * (PW * 2 + 24)
  const H = PH
  const rgba = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) rgba.set([34, 38, 46, 255], i * 4)
  PAIRS.forEach((look, n) =>
    sides.forEach(({ m, get }, s) => {
      const fig = composePortrait(m, look, undefined, get)
      const ox = n * (PW * 2 + 24) + s * PW
      for (let y = 0; y < PH; y++)
        for (let x = 0; x < PW; x++) {
          // a box filter of k x k, weighted by coverage
          let r = 0, g = 0, b = 0, a = 0
          for (let dy = 0; dy < k; dy++)
            for (let dx = 0; dx < k; dx++) {
              const i = ((y * k + dy) * CW + x * k + dx) * 4
              const t = fig[i + 3]
              r += fig[i] * t
              g += fig[i + 1] * t
              b += fig[i + 2] * t
              a += t
            }
          if (!a) continue
          const t = a / (k * k * 255)
          const o = (y * W + ox + x) * 4
          rgba[o] = rgba[o] * (1 - t) + (r / a) * t
          rgba[o + 1] = rgba[o + 1] * (1 - t) + (g / a) * t
          rgba[o + 2] = rgba[o + 2] * (1 - t) + (b / a) * t
        }
    }),
  )
  writeFileSync(out, png(W, H, rgba))
  console.log(out)
}
