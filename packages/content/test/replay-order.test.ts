// A patch does the same the first time (its act replayed when the answer comes) as every time after
// (the act resolved by it): an impulse it sends before its host is used up meets the host still there.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, type Engine, type Patch } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const scene = () => buildSandbox({ entities: [
  { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
  { key: 'held', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
  { key: 'stick', type: 'item/material/stick', x: 2, y: 1 },
], event: {} }, buildOntology(), new RuleLibrary(BASE_RULES))

/** The stone used on a stick takes the stick into itself and is used up with it (the strips-and-stick club, 2026-10-10). */
const patch = (eng: Engine): Patch => {
  const res = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'stick' }, { e: 'held' }))
  return { artifacts: [{ kind: 'rule', rule: { id: 'patch/stone-swallows-stick', host: { type: 'item/material/stone' }, on: 'act/use', hole: holeKey(res.hole!.rule.id, res.hole!.path), at: [], doc: 'd', label: { en: 'Bind', zh: '绑' },
    tree: { if: { is: { role: 'target', sel: { type: 'item/material/stick' } } }, then: { do: [{ op: 'spawn', type: 'item/weapon/blunt/club', at: 'actor' }, { op: 'emit', impulse: 'taken', to: 'target', other: 'host', params: { into: 'contents' } }, { op: 'destroy' }] }, else: { undefined: true } } } }] }
}

describe('a patch the first time and after', () => {
  it('uses the stick up when its act is replayed on the answer, as when the act is resolved by it', () => {
    // the first time: asked, answered later, the act replayed
    const first = scene()
    const port = new ModPort(first)
    port.provider = { resolve: () => new Promise(() => {}) }
    port.timeoutTicks = 10_000
    const p = patch(first)
    first.act('use', 'actor', { e: 'stick' }, { instrument: { e: 'held' } })
    expect(port.records[0]?.status).toBe('pending')
    expect(port.submit(port.records[0].id, p).errors).toEqual([])
    expect(first.world.get('stick')).toBeUndefined()
    // every time after: the act resolved by the patch
    const after = scene()
    new ModPort(after).submit(undefined, patch(after))
    after.act('use', 'actor', { e: 'stick' }, { instrument: { e: 'held' } })
    expect(after.world.get('stick')).toBeUndefined()
  })
})
