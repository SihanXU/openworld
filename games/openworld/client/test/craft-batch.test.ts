import { describe, expect, it } from 'vitest'
import { buildSandbox, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, buildOntology, RECIPE_BY_ID } from '../../content/src/index.ts'
import { TransferQueue } from '../../../../packages/runtime/src/transferQueue.ts'

describe('scheduled crafting', () => {
  it('yields between turns and keeps exactly the completed sales when cancelled', () => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'stall', type: 'fixture/furniture/stall/trade', x: 2, y: 1 },
        ...Array.from({ length: 200 }, (_, i) => ({ key: `fish${i}`, type: 'item/food/fish/sunfish', inside: 'actor', x: 2, y: 2 })),
      ], event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    const turns = new Set<() => void>()
    const queue = new TransferQueue<'craft'>((error) => { throw error }, () => 0, (run) => {
      turns.add(run)
      return () => { turns.delete(run) }
    })
    queue.enqueue(eng.controls.craftSteps(RECIPE_BY_ID['shop/sell/food-fish-sunfish']), 'craft', () => true)
    expect(eng.controls.count('item/food/fish/sunfish')).toBe(200)
    const first = [...turns][0]!
    turns.delete(first)
    first()
    const done = queue.progress!.done
    expect(done).toBeGreaterThan(0)
    expect(done).toBeLessThan(200)
    expect(turns.size).toBe(1)
    queue.cancel()
    expect(turns.size).toBe(0)
    expect(queue.busy).toBe(false)
    expect(eng.controls.count('item/food/fish/sunfish')).toBe(200 - done)
    expect(eng.controls.count('item/misc/thornmark')).toBe(done * 6)
  })
})
