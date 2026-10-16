// A chest transfer can yield between acts without losing its source selection or the hand's state.
import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, snapshot } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
function play(from: 'chest' | 'bag') {
  const eng = buildSandbox({
    terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'chest', type: 'fixture/container/chest', x: 2, y: 1, statuses: ['open'] },
      ...Array.from({ length: 20 }, (_, i) => ({ key: `coin${i}`, type: 'item/misc/thornmark', x: 2, y: 2, inside: from === 'chest' ? 'chest' : 'actor' })),
    ],
    event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  eng.controls.sync()
  return eng
}
const carried = (eng: ReturnType<typeof play>) => [...eng.controls.carried(true).values()].flat()

describe('resuming container transfers', () => {
  it('reports the selection before moving, then runs one ordinary act per step', () => {
    const eng = play('bag')
    const steps = eng.controls.transferSteps('chest', 'bag', 'coin0', true)
    expect(eng.world.get('chest')!.contents ?? []).toHaveLength(0)
    expect(steps.next().value).toEqual({ done: 0, total: 20 })
    expect(steps.next().value).toEqual({ done: 1, total: 20 })
    expect(eng.world.get('chest')!.contents).toHaveLength(1)
    expect(carried(eng)).toHaveLength(19)
    for (const _ of steps) { /* finish the same selection */ }
    expect(eng.world.get('chest')!.contents).toHaveLength(20)
    expect(carried(eng)).toHaveLength(0)
  })

  it.each(['bag', 'chest'] as const)('cancelling a partial transfer from the %s keeps every coin and synchronizes the hand', (from) => {
    const eng = play(from)
    const steps = eng.controls.transferSteps('chest', from, 'coin0', true)
    steps.next()
    for (let i = 0; i < 5; i++) steps.next()
    steps.return()
    const box = eng.world.get('chest')!.contents ?? []
    const bag = carried(eng)
    expect(box).toHaveLength(from === 'bag' ? 5 : 15)
    expect(bag).toHaveLength(from === 'bag' ? 15 : 5)
    expect(new Set([...box, ...bag.map((e) => e.id)]).size).toBe(20)
    expect(snapshot(eng).player.slots.filter(Boolean).map((s) => s!.count)).toEqual([bag.length])
  })

  it('stops when the container closes between steps, leaving unprocessed coins carried', () => {
    const eng = play('bag')
    const steps = eng.controls.transferSteps('chest', 'bag', 'coin0', true)
    steps.next()
    steps.next()
    eng.author(() => eng.world.clearStatus({ e: 'chest' }, 'open'))
    expect(steps.next().done).toBe(true)
    expect(eng.world.get('chest')!.contents).toHaveLength(1)
    expect(carried(eng)).toHaveLength(19)
  })

  it('can synchronize a new bag kind for an intermediate frame and continue the same selection', () => {
    const eng = play('chest')
    const steps = eng.controls.transferSteps('chest', 'chest', 'coin0', true)
    steps.next()
    for (let i = 0; i < 5; i++) steps.next()
    eng.controls.keep()
    expect(snapshot(eng).player.slots.filter(Boolean).map(s => s!.count)).toEqual([5])
    for (const _ of steps) { /* continue after the host's intermediate frame */ }
    expect(eng.world.get('chest')!.contents).toHaveLength(0)
    expect(carried(eng)).toHaveLength(20)
    expect(snapshot(eng).player.slots.filter(Boolean).map(s => s!.count)).toEqual([20])
  })
})
