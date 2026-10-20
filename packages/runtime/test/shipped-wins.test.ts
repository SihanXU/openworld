// A learned kind the game ships with (GameDef.learned) is the author's: corrected in a new version of the game, the
// correction reaches a returning player, whose stored shared library still holds the old copy.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { restoreLibrary, type LibraryData, type StatusDef, type TypeDef } from '@openworld/engine'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { withShipped } from '../src/learned.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)

const twine = (power: number): TypeDef => ({ id: 'item/material/twine', name: { en: 'Twine', zh: '麻绳' }, tags: ['fiber'], props: { material: 'plant', power }, makeup: [{ type: 'item/material/log', count: 1 }] }) as TypeDef
const sticky = (turns: number): StatusDef => ({ id: 'sticky', name: { en: 'Sticky', zh: '黏' }, turns }) as unknown as StatusDef
const lib = (types: TypeDef[], statuses: StatusDef[]): LibraryData => ({ rules: [], types, statuses, log: [], version: 1 })

describe.skipIf(!here)('the library a game starts from', () => {
  it("takes a shipped learned kind or status over the stored copy by the same id", () => {
    const c = compile(readProject(STARTER))
    const shipped = lib([twine(2)], [sticky(3)])
    // the stored shared library: the shipped ones as they were before the author corrected them, and one learned in play
    const learnedInPlay = { ...twine(1), id: 'item/material/cord', name: { en: 'Cord', zh: '绳' } } as TypeDef
    const stored = lib([twine(1), learnedInPlay], [sticky(9)])
    const out = restoreLibrary(c.bundle.rules, withShipped(shipped, stored), structuredClone(c.bundle.ontology))
    expect(out.types.find((t) => t.id === 'item/material/twine')?.props).toEqual({ material: 'plant', power: 2 })
    expect(out.types.map((t) => t.id).sort()).toEqual(['item/material/cord', 'item/material/twine'])
    expect((out.statuses.find((s) => s.id === 'sticky') as unknown as { turns: number }).turns).toBe(3)
  })

  it('is the shipped library alone, or the stored one alone, when there is no other', () => {
    const shipped = lib([twine(2)], [])
    expect(withShipped(shipped, undefined)).toBe(shipped)
    expect(withShipped(undefined, shipped)).toBe(shipped)
  })
})
