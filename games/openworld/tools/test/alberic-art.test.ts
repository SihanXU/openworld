import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { Dir, EntitySnap } from '@openworld/engine'
import { SIN_ACTORS, SIN_FX } from '@openworld/runtime/src/assets/bosses.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'

// Decode actual pixels, not just PNG headers: reject opaque backgrounds, duplicates and clipping.
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

describe('Alberic overhead art', () => {
  it('ships 672 distinct transparent body frames and 18 distinct effect frames with clean borders', () => {
    const actor = SIN_ACTORS['boss:sin:alberic']!
    expect(actor).toMatchObject({ dir: 'lsw/Bosses/alberic/v5', cols: 32, rows: 21, anchorY: 88 })
    const assets = [{ path: `${actor.dir}/${actor.sheet}`, size: 128, cols: 32, rows: 21 },
      ...['arrow', 'volley', 'thorns'].map((id) => {
        const fx = SIN_FX[`sin:alberic:${id}`]!
        expect(fx.frames).toBe(6)
        return { path: fx.img, size: fx.fw, cols: fx.frames, rows: 1 }
      })]
    const hashes: string[] = []
    for (const { path, size, cols, rows } of assets) {
      const { w, h, pixels } = decode(path)
      expect([w, h], path).toEqual([size * cols, size * rows])
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const frame = Buffer.alloc(size * size * 4), name = `${path} ${col},${row}`
        for (let y = 0; y < size; y++) {
          const from = ((row * size + y) * w + col * size) * 4
          pixels.copy(frame, y * size * 4, from, from + size * 4)
        }
        const alpha = frame.filter((_, i) => i % 4 === 3)
        expect(alpha.filter((v) => v === 0).length, name).toBeGreaterThan(size * size / 4)
        expect(alpha.filter((v) => v > 32).length, name).toBeGreaterThan(12)
        for (let k = 0; k < size; k++) for (const i of [k, (size - 1) * size + k, k * size, k * size + size - 1])
          expect(alpha[i], `${name} edge ${i}`).toBeLessThan(16)
        hashes.push(createHash('sha256').update(frame).digest('hex'))
      }
    }
    expect(hashes).toHaveLength(690)
    expect(new Set(hashes).size).toBe(690)
  })

  it.each<Dir>(['down', 'right', 'up', 'left'])('selects all seven actions for %s without rotating the sprite', (dir) => {
    const base = dir === 'down' ? 0 : dir === 'up' ? 14 : 7
    for (const [action, skill, row] of [
      ['idle', 'arrow', 0], ['walk', 'arrow', 1], ['attack', 'thorns', 2],
      ['cast', 'arrow', 3], ['cast', 'volley', 4], ['hurt', 'arrow', 5], ['death', 'arrow', 6],
    ] as const) {
      expect(bossAnimationFrame(snap(action, 0, skill), 0, 0, dir)).toEqual({ row: base + row, col: 0 })
    }
  })

  it('keeps idle and walk registration steady across source sheet row boundaries', () => {
    const { w, pixels } = decode('lsw/Bosses/alberic/v5/actions.png')
    for (const row of [0, 1, 7, 8, 14, 15]) {
      const baselines: number[] = [], centers: number[] = []
      for (let col = 0; col < 32; col++) {
        const rows = Array<number>(128).fill(0)
        let mass = 0, xMass = 0
        for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
          const alpha = pixels[((row * 128 + y) * w + col * 128 + x) * 4 + 3]!
          rows[y] += alpha; mass += alpha; xMass += x * alpha
        }
        let sum = 0
        baselines.push(rows.findIndex((weight) => (sum += weight) >= mass * 0.9))
        centers.push(xMass / mass)
      }
      expect(Math.max(...baselines) - Math.min(...baselines), `row ${row} vertical registration`).toBeLessThanOrEqual(8)
      expect(Math.max(...centers) - Math.min(...centers), `row ${row} horizontal registration`).toBeLessThanOrEqual(6)
    }
  })

  it('separates drawn-bow frames from release/recovery and clamps death instead of looping it', () => {
    for (const [progress, col] of [[0, 0], [0.249, 6], [0.25, 9], [0.499, 15], [0.5, 16], [0.749, 22], [0.75, 25], [1, 31], [4, 31]])
      expect(bossAnimationFrame(snap('cast', progress), 0)).toEqual({ row: 3, col })
    expect(bossAnimationFrame(snap('death', 1), 80000)).toEqual({ row: 6, col: 31 })
    expect(bossAnimationFrame(snap('hurt', NaN), 0).col).toBe(0)
    expect(bossAnimationFrame(snap('cast', -1), 0).col).toBe(0)
  })

  it('leaves other boss action atlases and their two-frame death selection unchanged', () => {
    const legacy = { ...snap('death', 0.5), kit: 'pride' }
    expect(bossAnimationFrame(legacy, 0, 0, 'up')).toEqual({ row: 4, col: 2 })
    expect(bossAnimationFrame({ ...legacy, progress: 1 }, 0)).toEqual({ row: 4, col: 3 })
    expect(bossAnimationFrame({ ...legacy, action: 'cast' }, 0)).toEqual({ row: 3, col: 2 })
  })

  it('records the overhead camera, directions and real per-action generation prompts', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../../docs/alberic-art-v3-prompts.json', import.meta.url), 'utf8'))
    expect(manifest.generator).toBe('built-in imagegen')
    expect(manifest.bodyPrompt).toContain('HIGH OVERHEAD')
    expect(manifest.export.directions).toEqual(['down', 'right', 'up'])
    expect(manifest.assets.filter((a: { kind: string }) => a.kind === 'body')).toHaveLength(7)
    expect(manifest.export.bodyRows * manifest.export.bodyColumns).toBe(84)
    const dense = JSON.parse(readFileSync(new URL('../../../../docs/alberic-art-v4-prompts.json', import.meta.url), 'utf8'))
    expect(dense.generator).toBe('built-in imagegen')
    expect(dense.export.bodyRows * dense.export.bodyColumns).toBe(252)
    expect(dense.assets).toHaveLength(7)
    expect(dense.assets.every((a: { frames: number }) => a.frames === 36)).toBe(true)
    expect(dense.singleDirectionPrompt).toContain('HIGH OVERHEAD')
    const smooth = JSON.parse(readFileSync(new URL('../../../../docs/alberic-art-v5-prompts.json', import.meta.url), 'utf8'))
    expect(smooth.generator).toBe('built-in imagegen')
    expect(smooth.export.bodyRows * smooth.export.bodyColumns).toBe(672)
    expect(smooth.bodyPrompt).toContain('HIGH OVERHEAD')
    expect(smooth.assets).toHaveLength(7)
    for (const action of smooth.assets) {
      expect(action.frames).toBe(96)
      expect(action.sheets).toHaveLength(3)
      for (const sheet of action.sheets) {
        expect(sheet.columns * sheet.rows).toBe(32)
        expect(sheet.frames).toBe(32)
        expect(sheet.prompt).toContain('32 genuinely different successive poses')
        expect(sheet.prompt).not.toContain('undefined')
        expect(sheet.references).toHaveLength(2)
      }
    }
  })
})
