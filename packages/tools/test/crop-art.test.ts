import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CROP_STAGES, PLACEMENTS, VEGETABLE_CROPS, buildOntology } from '@lsw/content'
import { CATALOG } from '../../client/src/assets/catalog.ts'

describe('original crop sprites', () => {
  it('registers all three growth stages and both inventory sprites per crop', () => {
    const onto = buildOntology()
    for (const c of VEGETABLE_CROPS) {
      for (const s of CROP_STAGES) {
        expect(onto.types[`fixture/crop/${c.id}/${s}`].sprite).toBe(`fixture:${c.id}_${s}`)
        expect(CATALOG.fixtures[`fixture:${c.id}_${s}`].base.img).toContain(`lsw/Crops/${c.id}/${s}.png`)
      }
      expect(CATALOG.items[`item:${c.id}`]).toBeDefined()
      expect(CATALOG.items[`item:${c.id}_seed`]).toBeDefined()
    }
  })
  it('ships 20 native-resolution RGBA sprites plus the four original atlases', () => {
    for (const c of VEGETABLE_CROPS) for (const part of [...CROP_STAGES, 'produce', 'seeds', 'atlas']) {
      const bytes = readFileSync(new URL(`../../client/public/assets/lsw/Crops/${c.id}/${part}.png`, import.meta.url))
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      if (part !== 'atlas') {
        expect(bytes.readUInt32BE(16)).toBe(16)
        expect(bytes.readUInt32BE(20)).toBe(CROP_STAGES.includes(part as typeof CROP_STAGES[number]) ? 24 : 16)
      }
      expect(bytes[25]).toBe(6)
    }
  })
  it('gives every construction or farming recipe a loaded game sprite', () => {
    for (const r of PLACEMENTS) expect(CATALOG.fixtures[r.sprite]?.base ?? CATALOG.items[r.sprite], r.id).toBeDefined()
  })
})
