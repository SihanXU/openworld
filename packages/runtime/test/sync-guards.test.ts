// The shared library's sync takes the service's log entry by entry: one this client cannot read or take is passed
// over, never stopping the ones after it, and never leaving a learned kind it set aside for it out of the world.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type Patch, type TypeDef } from '@openworld/engine'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { takeLogEntries, type Kept } from '../src/learned.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)

const art = { grid: Array.from({ length: 16 }, (_, y) => (y > 3 && y < 12 ? '....aaaaaaaa....' : '................')), palette: { a: '#a0522d' } }
const twine: TypeDef = { id: 'item/material/twine', name: { en: 'Twine', zh: '麻绳' }, tags: ['fiber'], props: { material: 'plant' }, makeup: [{ type: 'item/material/log', count: 1 }], art } as TypeDef
const typePatch = (type: TypeDef): Patch => ({ artifacts: [{ kind: 'type', type }] })

function world() {
  const c = compile(readProject(STARTER))
  const eng = buildSandbox({ terrain: [['grass', 'grass'], ['grass', 'grass']], entities: [{ key: 'actor', type: 'actor/person/villager', x: 0, y: 0 }], event: {} }, structuredClone(c.bundle.ontology), new RuleLibrary(c.bundle.rules))
  const kept: Kept = { types: new Set(), statuses: new Set() }
  return { eng, mods: new ModPort(eng), kept }
}

describe.skipIf(!here)('the shared library sync', () => {
  it('passes over an entry it cannot read or take, and takes the ones after it', () => {
    const { eng, mods, kept } = world()
    const said: string[] = []
    const bad = [
      { seq: 1, at: '', patch: {}, rules: [] },
      { seq: 2, at: '', patch: null, rules: [] },
      { seq: 3, at: '', patch: { artifacts: null }, rules: [] },
      { seq: 4, at: '', patch: { artifacts: [{ kind: 'rule', rule: { id: 'r1', host: { type: 'item' }, on: 'act/use', tree: null } }] }, rules: [] },
      { seq: 5, at: '', somethingNew: 'x' },
      { seq: 6, at: '', patch: { ...typePatch(twine), scope: 'save' }, rules: [] },
      null,
    ]
    expect(() => takeLogEntries(eng, mods, kept, [...bad, { seq: 7, at: '', patch: typePatch(twine), rules: [] }], (m) => said.push(m))).not.toThrow()
    expect(said).toHaveLength(bad.length)
    expect(eng.lib.types.map((t) => t.id)).toEqual(['item/material/twine'])
    expect(kept.types.size).toBe(0)
  })

  it('puts back a learned kind it set aside for an entry whose judging throws', () => {
    const { eng, mods, kept } = world()
    expect(mods.submit(undefined, typePatch(twine)).errors).toEqual([])
    eng.author(() => eng.world.create(twine.id, { on: 'inside', holder: 'actor' }))
    // another kind by the same name steps the twine aside while it is judged, and judging it throws
    // (the judge throws itself: the validator refuses a malformed kind without throwing now)
    const cord = { ...twine, id: 'item/material/cord' } as TypeDef
    const throwing = { submit: () => { throw new Error('judging failed') } } as unknown as Pick<typeof mods, 'submit'>
    const said: string[] = []
    takeLogEntries(eng, throwing, kept, [{ seq: 1, at: '', patch: typePatch(cord), rules: [] }], (m) => said.push(m))
    expect(said).toHaveLength(1)
    expect(eng.lib.types.map((t) => t.id)).toEqual(['item/material/twine'])
    expect(eng.world.onto.hasType(twine.id)).toBe(true)
  })
})
