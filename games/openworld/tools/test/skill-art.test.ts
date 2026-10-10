import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_BRANCHES, SKILL_DIRECTIONS, SKILL_PROFESSIONS } from '@lsw/content'
import { SKILL_ART_KEYS, skillArt, skillPng } from '../../client/src/ui/skillIcons.ts'

const directory = new URL('../../client/public/assets/lsw/skills/', import.meta.url)

// Decode our non-interlaced RGBA8 PNGs so an alpha-channel header alone cannot
// disguise an opaque background. ImageIO may use any of the five row filters.
function rgba(bytes: Buffer): Buffer {
  const data: Buffer[] = []
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      data.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(data))
  const width = bytes.readUInt32BE(16) * 4
  const height = bytes.readUInt32BE(20)
  const pixels = Buffer.alloc(width * height)
  expect(raw.length).toBe((width + 1) * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)]!
    expect(filter).toBeLessThanOrEqual(4)
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const left = x >= 4 ? pixels[index - 4]! : 0
      const above = y > 0 ? pixels[index - width]! : 0
      const upperLeft = x >= 4 && y > 0 ? pixels[index - width - 4]! : 0
      const p = left + above - upperLeft
      const pa = Math.abs(p - left), pb = Math.abs(p - above), pc = Math.abs(p - upperLeft)
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth][filter]!
      pixels[index] = (raw[y * (width + 1) + 1 + x]! + predictor) & 255
    }
  }
  return pixels
}

describe('original skill illustrations', () => {
  it('gives every skill a distinct image rather than reusing generic pictograms', () => {
    expect(SKILLS.every((s) => !!s.icon)).toBe(true)
    expect(new Set(SKILLS.map((s) => s.icon)).size).toBe(SKILLS.length)
  })

  it('has a registered asset for every skill, branch, direction and profession', () => {
    const keys: readonly string[] = SKILL_ART_KEYS
    expect(new Set(keys).size).toBe(keys.length)
    for (const item of [...SKILLS, ...SKILL_BRANCHES, ...SKILL_DIRECTIONS, ...SKILL_PROFESSIONS]) {
      expect(item.icon, `${item.id} must not use a placeholder`).not.toMatch(/^placeholder:/)
      expect(keys, `${item.id} illustration`).toContain(item.icon)
      expect(skillArt(item.icon), `${item.id} must not fall back`).toContain(`data-icon="${item.icon}"`)
    }
  })

  it('ships every illustration as a nonempty 64px RGBA PNG', () => {
    for (const key of SKILL_ART_KEYS) {
      const bytes = readFileSync(new URL(`${key}.png`, directory))
      expect(bytes.subarray(0, 8).toString('hex'), key).toBe('89504e470d0a1a0a')
      expect(bytes.readUInt32BE(16), key).toBe(64)
      expect(bytes.readUInt32BE(20), key).toBe(64)
      expect(bytes[24], `${key} channel depth`).toBe(8)
      expect(bytes[25], `${key} alpha channel`).toBe(6)
      expect(bytes[28], `${key} non-interlaced`).toBe(0)
      expect(bytes.length, key).toBeGreaterThan(200)
    }
  })

  it('has real transparent padding and visible artwork, not an opaque square or empty PNG', () => {
    for (const key of SKILL_ART_KEYS) {
      const pixels = rgba(readFileSync(new URL(`${key}.png`, directory)))
      const alpha = pixels.filter((_, i) => i % 4 === 3)
      expect(alpha.filter((a) => a === 0).length, key).toBeGreaterThan(64 * 64 / 3)
      expect(alpha.filter((a) => a > 128).length, key).toBeGreaterThan(100)
      for (const corner of [0, 63, 63 * 64, 64 * 64 - 1])
        expect(alpha[corner], `${key} corner`).toBe(0)
    }
  })

  it('registers every shipped PNG and never duplicates another image under a new filename', () => {
    expect(readdirSync(directory).filter((file) => file.endsWith('.png')).sort())
      .toEqual(SKILL_ART_KEYS.map((key) => `${key}.png`).sort())
    const fingerprints = SKILL_ART_KEYS.map((key) => createHash('sha256')
      .update(rgba(readFileSync(new URL(`${key}.png`, directory)))).digest('hex'))
    expect(new Set(fingerprints).size).toBe(SKILL_ART_KEYS.length)
  })

  it('records a distinct built-in generation brief for each added skill or profession image', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../docs/skill-art-prompts.json', import.meta.url), 'utf8')) as {
      generator: string
      assets: { id: string; file: string; subject: string }[]
    }
    expect(manifest.generator).toBe('built-in imagegen')
    expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(manifest.assets.length)
    expect(new Set(manifest.assets.map((asset) => asset.subject)).size).toBe(manifest.assets.length)
    for (const asset of manifest.assets) {
      expect([...SKILLS, ...SKILL_PROFESSIONS].some((item) => item.icon === asset.id), asset.id).toBe(true)
      expect(SKILL_ART_KEYS).toContain(asset.id)
      expect(asset.file).toBe(`packages/client/public/assets/lsw/skills/${asset.id}.png`)
      expect(asset.subject.length).toBeGreaterThan(80)
    }
  })

  it('renders only illustrated bitmaps and falls back to the original pixel-art emblem', () => {
    for (const key of SKILL_ART_KEYS) {
      expect(skillArt(key)).toContain(`<img class="sk-png"`)
      expect(skillArt(key)).not.toMatch(/svg|<path|<circle/)
      expect(skillArt(key)).toContain(`${key}.png`)
    }
    expect(skillArt('unknown')).toContain('origin.png')
    expect(skillArt(undefined)).toContain('origin.png')
    expect(skillPng('../unknown')).toContain('origin.png')
  })

  it('does not wash out the illustrations to indicate locked/waiting nodes', () => {
    const css = readFileSync(fileURLToPath(new URL('../../client/src/ui/game.css', import.meta.url)), 'utf8')
    expect(css).not.toMatch(/\.sk-node\.(?:locked|waiting)[^{]*\{[^}]*grayscale/)
    expect(css).not.toContain('.sk-art.no-png svg')
  })
})
