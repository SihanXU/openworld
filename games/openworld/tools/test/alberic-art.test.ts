// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import type { Dir, EntitySnap } from '@openworld/engine'
import { ALBERIC_CLIPS, ALBERIC_DELIVERY, SIN_ACTORS, SIN_FX } from '@openworld/runtime/src/assets/bosses.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { actorFrames, imagePaths } from '@openworld/runtime/src/render/assets.ts'
import { CATALOG } from '../../client/src/catalog.ts'

vi.mock('phaser', () => ({ default: {} }))

// Decode actual pixels, not just PNG headers: verify transparency and the exact recovery-to-idle pose.
function decode(path: string) {
  const bytes = readFileSync(new URL(`../../public/assets/${path}`, import.meta.url))
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect([bytes[24], bytes[25], bytes[28]]).toEqual([8, 6, 0])
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20), chunks: Buffer[] = []
  for (let o = 8; o < bytes.length;) {
    const n = bytes.readUInt32BE(o)
    if (bytes.toString('ascii', o + 4, o + 8) === 'IDAT') chunks.push(bytes.subarray(o + 8, o + 8 + n))
    o += n + 12
  }
  const raw = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(w * h * 4), stride = w * 4
  expect(raw.length).toBe((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]!
    expect(filter).toBeLessThanOrEqual(4)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= 4 ? pixels[i - 4]! : 0
      const above = y ? pixels[i - stride]! : 0, corner = y && x >= 4 ? pixels[i - stride - 4]! : 0
      const p = left + above - corner, a = Math.abs(p - left), b = Math.abs(p - above), c = Math.abs(p - corner)
      const paeth = a <= b && a <= c ? left : b <= c ? above : corner
      pixels[i] = (raw[y * (stride + 1) + 1 + x]! + [0, left, above, Math.floor((left + above) / 2), paeth][filter]!) & 255
    }
  }
  return { w, h, pixels }
}

const snap = (action: NonNullable<EntitySnap['boss']>['action'], progress = 0, skill = 'arrow'): NonNullable<EntitySnap['boss']> =>
  ({ kit: 'alberic', phase: 1, color: 0xf2ead2, footprint: [3, 2], enrageAt: 0.5, action, progress, skill })

function frame(sheet: ReturnType<typeof decode>, col: number, width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = (y * sheet.w + col * width) * 4
    sheet.pixels.copy(pixels, y * width * 4, from, from + width * 4)
  }
  return pixels
}

describe('Alberic delivered pixel art', () => {
  it('preloads every directional strip and slices all frames without cropping their raised sword space', () => {
    const actor = SIN_ACTORS['boss:sin:alberic']!, key = 'cre:boss:sin:alberic'
    const paths = imagePaths(CATALOG)
    const sheets = new Map(Object.values(ALBERIC_CLIPS).map((clip) => {
      const path = `${actor.dir}/${clip.sheet}`, decoded = decode(path)
      expect(paths.filter((p) => p === path)).toHaveLength(1)
      const frames = new Map<string, number[]>()
      const texture = {
        getSourceImage: () => ({ width: decoded.w, height: decoded.h }),
        has: (name: string) => frames.has(name),
        add: vi.fn((name: string, source: number, x: number, y: number, w: number, h: number) => {
          expect(source).toBe(0)
          expect(x + w).toBeLessThanOrEqual(decoded.w)
          expect(y + h).toBeLessThanOrEqual(decoded.h)
          frames.set(name, [x, y, w, h])
        }),
      }
      return [path, { texture, frames }] as const
    }))
    const scene = { textures: { get: (path: string) => {
      const sheet = sheets.get(path)
      if (!sheet) throw new Error(`Unloaded actor sheet: ${path}`)
      return sheet.texture
    } } } as unknown as Parameters<typeof actorFrames>[0]
    expect(actorFrames(scene, key, actor)).toEqual({ img: `${actor.dir}/idle.png`, fw: 60, fh: 76 })
    for (const [id, clip] of Object.entries(ALBERIC_CLIPS)) {
      const { frames } = sheets.get(`${actor.dir}/${clip.sheet}`)!
      for (let i = 0; i < clip.frames; i++)
        expect(frames.get(`${key}:${id}:${i}`)).toEqual([i * clip.frame_w, 0, clip.frame_w, clip.frame_h])
      expect(frames.has(`${key}:${id}:${clip.frames}`)).toBe(false)
    }
    const calls = [...sheets.values()].map(({ texture }) => texture.add.mock.calls.length)
    actorFrames(scene, key, actor)
    expect([...sheets.values()].map(({ texture }) => texture.add.mock.calls.length)).toEqual(calls)
  })

  it('registers the original rectangular sheets, exact foot pivot and integer world scale', () => {
    const actor = SIN_ACTORS['boss:sin:alberic']!
    expect(actor).toMatchObject({ dir: 'lsw/Bosses/alberic/boss01_01', sheet: 'idle.png', cols: 8, rows: 1,
      anchorX: 30.5, anchorY: 72, scale: 2 })
    expect(ALBERIC_DELIVERY.canvas).toEqual([60, 76])
    expect(ALBERIC_DELIVERY.anchor).toEqual([30, 71])
    let count = 0
    for (const [id, clip] of Object.entries(ALBERIC_CLIPS)) {
      expect(actor.clips![id]).toEqual({ sheet: clip.sheet, frames: clip.frames,
        frameWidth: clip.frame_w, frameHeight: clip.frame_h, frameMs: clip.frame_ms, loop: clip.loop })
      const sheet = decode(`${actor.dir}/${clip.sheet}`)
      expect([sheet.w, sheet.h]).toEqual([clip.frame_w * clip.frames, clip.frame_h])
      for (let col = 0; col < clip.frames; col++) {
        const pixels = frame(sheet, col, clip.frame_w, clip.frame_h)
        const alpha = pixels.filter((_, i) => i % 4 === 3)
        expect(new Set(alpha)).toEqual(new Set([0, 255]))
        expect(alpha.filter((v) => v === 0).length).toBeGreaterThan(clip.frame_w * clip.frame_h / 4)
        expect(alpha.filter((v) => v === 255).length).toBeGreaterThan(100)
        count++
      }
    }
    expect(count).toBe(38)
    // Existing spell effects retain their own dimensions and six-frame playback.
    for (const id of ['arrow', 'volley', 'thorns']) {
      const fx = SIN_FX[`sin:alberic:${id}`]!, sheet = decode(fx.img)
      expect(fx.frames).toBe(6)
      expect([sheet.w, sheet.h]).toEqual([fx.fw * fx.frames, fx.fh])
    }
  })

  it('ends every directional attack on the unmirrored idle pose with no registration jump', () => {
    const actor = SIN_ACTORS['boss:sin:alberic']!, idle = ALBERIC_CLIPS.idle
    const rest = frame(decode(`${actor.dir}/${idle.sheet}`), 0, idle.frame_w, idle.frame_h)
    for (const id of ['attack_left', 'attack_right', 'attack_down'] as const) {
      const clip = ALBERIC_CLIPS[id], sheet = decode(`${actor.dir}/${clip.sheet}`)
      expect(frame(sheet, clip.segments.recover[0]!, clip.frame_w, clip.frame_h)).toEqual(rest)
    }
  })

  it.each<Dir>(['down', 'right', 'up', 'left'])('uses delivered direction %s with explicit non-mirroring and front fallback', (dir) => {
    const clip = dir === 'left' ? 'attack_left' : dir === 'right' ? 'attack_right' : 'attack_down'
    for (const action of ['attack', 'cast'] as const) {
      expect(bossAnimationFrame(snap(action), 0, 0, dir)).toEqual({ row: 0, col: 0, clip, flipX: false })
      expect(bossAnimationFrame({ ...snap(action, 1), animationElapsedMs: 9999 }, 0, 0, dir))
        .toEqual({ row: 0, col: 9, clip, flipX: false })
    }
    for (const action of ['idle', 'walk', 'hurt', 'death'] as const)
      expect(bossAnimationFrame(snap(action), 0, 0, dir)).toEqual({ row: 0, col: 0, clip: 'idle', flipX: false })
  })

  it('separates anticipation from the hit and clamps malformed progress or absent clips', () => {
    for (const [progress, col] of [[0, 0], [0.249, 2], [0.25, 2], [0.499, 4], [0.5, 5], [0.749, 7], [0.75, 7], [1, 9], [4, 9]])
      expect(bossAnimationFrame(snap('cast', progress), 0)).toEqual({ row: 0, col, clip: 'attack_down', flipX: false })
    expect(bossAnimationFrame(snap('death', 1), 80000)).toEqual({ row: 0, col: 0, clip: 'idle', flipX: false })
    expect(bossAnimationFrame(snap('hurt', NaN), 0).col).toBe(0)
    expect(bossAnimationFrame(snap('cast', -1), 0).col).toBe(0)
  })

  it('leaves other boss action atlases and their two-frame death selection unchanged', () => {
    const legacy = { ...snap('death', 0.5), kit: 'pride' }
    expect(bossAnimationFrame(legacy, 0, 0, 'up')).toEqual({ row: 4, col: 2 })
    expect(bossAnimationFrame({ ...legacy, progress: 1 }, 0)).toEqual({ row: 4, col: 3 })
    expect(bossAnimationFrame({ ...legacy, action: 'cast' }, 0)).toEqual({ row: 3, col: 2 })
  })
})
