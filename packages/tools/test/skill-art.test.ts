import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_BRANCHES, SKILL_DIRECTIONS, SKILL_PROFESSIONS } from '@lsw/content'
import { SKILL_ART_KEYS, skillArt, skillPng } from '../../client/src/ui/skillIcons.ts'

const directory = new URL('../../client/public/assets/lsw/skills/', import.meta.url)

/** Icons not drawn yet (`placeholder:<id>`): they show the origin emblem; distinct, but not registered. */
const drawn = (icon: string | undefined) => !!icon && !icon.startsWith('placeholder:')

describe('original skill illustrations', () => {
  it('gives every skill a distinct image rather than reusing generic pictograms', () => {
    expect(SKILLS.every((s) => !!s.icon)).toBe(true)
    expect(new Set(SKILLS.map((s) => s.icon)).size).toBe(SKILLS.length)
  })

  it('has a registered asset for every skill, branch, direction and profession', () => {
    const keys: readonly string[] = SKILL_ART_KEYS
    expect(new Set(keys).size).toBe(keys.length)
    for (const item of [...SKILLS, ...SKILL_BRANCHES, ...SKILL_DIRECTIONS, ...SKILL_PROFESSIONS].filter((i) => drawn(i.icon)))
      expect(keys, `${item.id} illustration`).toContain(item.icon)
  })

  it('ships every illustration as a nonempty 64px RGBA PNG', () => {
    for (const key of SKILL_ART_KEYS) {
      const bytes = readFileSync(new URL(`${key}.png`, directory))
      expect(bytes.subarray(0, 8).toString('hex'), key).toBe('89504e470d0a1a0a')
      expect(bytes.readUInt32BE(16), key).toBe(64)
      expect(bytes.readUInt32BE(20), key).toBe(64)
      expect(bytes[25], `${key} alpha channel`).toBe(6)
      expect(bytes.length, key).toBeGreaterThan(200)
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
