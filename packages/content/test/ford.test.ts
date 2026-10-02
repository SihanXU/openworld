// The Ford's story rules (docs/game-design.md §6): the three ways across that the place
// teaches, the peddler's trade, and the rule library's discipline (no ties).

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, compareSpec, patternsOverlap, specOf, type Engine, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** A river two tiles wide (x = 3, 4) through a 7x5 meadow; the player at (1,2). */
function ford(extra: Scenario['entities'], player: Partial<Scenario['entities'][number]> = {}): Engine {
  const row = ['grass', 'grass', 'grass', 'water', 'water', 'grass', 'grass']
  return buildSandbox({ terrain: Array.from({ length: 5 }, () => [...row]), entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 2, ...player }, ...extra], event: {} }, onto, lib())
}

describe('the Ford', () => {
  it('the ferry: rope on the broken winch mends the line; then the ferrykeeper takes you over', () => {
    const eng = ford([
      { key: 'winch', type: 'fixture/ferry/winch', x: 2, y: 2, statuses: ['broken'] },
      { key: 'rope', type: 'item/tool/rope', x: 1, y: 2, heldBy: 'actor' },
      { key: 'hesper', type: 'actor/person/ferrykeeper', x: 1, y: 1 },
    ])
    expect(eng.interact('interact', 'actor', { e: 'winch' }, { instrument: null }).rule?.id).toBe('ford/winch-look')
    expect(eng.interact('put', 'actor', { e: 'winch' }).rule?.id).toBe('ford/mend-winch')
    expect(eng.world.hasStatus({ e: 'winch' }, 'broken')).toBe(false)
    expect(eng.world.get('rope')).toBeUndefined()
    expect(eng.world.fact('ford.winch')).toBe(1)
    expect(eng.interact('interact', 'actor', { e: 'hesper' }, { instrument: null }).rule?.id).toBe('ford/ask-crossing')
  })

  it('the dead tree: three blows from the landward side fell it across the water', () => {
    const eng = ford([{ key: 'tree', type: 'fixture/nature/dead_tree', x: 2, y: 2 }, { key: 'axe', type: 'item/weapon/blade/axe', x: 1, y: 2, heldBy: 'actor', tags: ['tool:axe'] }])
    const hit = () => eng.interact('interact', 'actor', { e: 'tree' }).rule?.id
    expect(hit()).toBe('ford/chop-dead-tree')
    expect(hit()).toBe('ford/chop-dead-tree')
    expect(eng.world.get('tree')).toBeDefined()
    expect(hit()).toBe('ford/fell-dead-tree')
    expect(eng.world.get('tree')).toBeUndefined()
    expect(eng.world.terrainAt('sandbox', 2, 2)).toBe('stump')
    expect([3, 4].map((x) => eng.world.terrainAt('sandbox', x, 2))).toEqual(['bridge', 'bridge'])
    expect(eng.world.terrainAt('sandbox', 5, 2)).toBe('grass')
    expect(eng.world.fact('ford.tree')).toBe(1)
  })

  it('felled toward dry land, the tree bridges nothing', () => {
    const eng = ford([{ key: 'tree', type: 'fixture/nature/dead_tree', x: 1, y: 1, props: { cuts: 2 } }, { key: 'axe', type: 'item/weapon/blade/axe', x: 1, y: 2, heldBy: 'actor', tags: ['tool:axe'] }])
    eng.interact('interact', 'actor', { e: 'tree' })
    expect(eng.world.get('tree')).toBeUndefined()
    expect(eng.world.terrainAt('sandbox', 1, 0)).toBe('grass')
  })

  it('the ice: frost on the river freezes a path that thaws again, putting whoever stands on it ashore', () => {
    const eng = ford([])
    eng.queue({ kind: 'hit', roles: { actor: { e: 'actor' }, target: { tile: { map: 'sandbox', x: 3, y: 2 } } }, element: 'ice', power: 3 })
    expect(eng.world.terrainAt('sandbox', 3, 2)).toBe('ice')
    expect(eng.world.hasStatus({ tile: { map: 'sandbox', x: 3, y: 2 } }, 'chilled')).toBe(true)
    eng.world.place(eng.world.player, { on: 'tile', map: 'sandbox', x: 3, y: 2 })
    for (let i = 0; i < 1600; i++) eng.tick()
    expect(eng.world.terrainAt('sandbox', 3, 2)).toBe('water')
    const p = eng.world.posOf(eng.world.player)!
    expect(eng.world.walkable('sandbox', p.x, p.y, eng.world.state.player)).toBe(true)
  })

  it('the peddler: food for the frost wand — and then he does not mind you taking it', () => {
    const eng = ford([
      { key: 'tobin', type: 'actor/person/peddler', x: 1, y: 1 },
      { key: 'loaf', type: 'item/food/bread', x: 1, y: 2, heldBy: 'actor' },
      { key: 'wand', type: 'item/weapon/magic/wand', x: 0, y: 2, tags: ['element:ice'], props: { owner: 'tobin', element: 'ice' } },
    ])
    eng.world.get('tobin')!.npc = { role: 'peddler', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 1, y: 1, activity: 'mind the cart' }], person: {} }
    expect(eng.interact('put', 'actor', { e: 'tobin' }).rule?.id).toBe('ford/feed-peddler')
    expect(eng.world.fact('ford.charm')).toBe(1)
    eng.interact('take', 'actor', { e: 'wand' })
    expect(eng.trace.find((t) => t.ev.kind === 'witness')?.rule).toBe('ford/wand-is-yours')
  })

  it('story rules never tie with base rules, nor the base rules with each other', () => {
    const all = [...BASE_RULES, ...STORY_RULES]
    const ties: string[] = []
    for (const [i, a] of all.entries())
      for (const b of all.slice(i + 1)) {
        if (a.on !== b.on || a.compose || b.compose || a.fallback || b.fallback) continue
        if (compareSpec(specOf(a), specOf(b)) === 0 && patternsOverlap(a, b, onto) && JSON.stringify(a.do) !== JSON.stringify(b.do)) ties.push(`${a.id} ~ ${b.id}`)
      }
    expect(ties).toEqual([])
  })
})
