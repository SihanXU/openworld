// The Ford's story rules (docs/game-design.md §6): the three ways across that the place
// teaches, the peddler's trade, and the rule library's discipline (no ties). Each route is
// played with the AI off (design.md §5.13: playable without an AI): no event on it reaches an
// undefined outcome.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, type Engine, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** A river two tiles wide (x = 3, 4) through a 7x5 meadow; the player at (1,2). Strict: state changes only in outcomes. */
function ford(extra: Scenario['entities'], player: Partial<Scenario['entities'][number]> = {}): Engine {
  const row = ['grass', 'grass', 'grass', 'water', 'water', 'grass', 'grass']
  const eng = buildSandbox({ terrain: Array.from({ length: 5 }, () => [...row]), entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 2, ...player }, ...extra], event: {} }, onto, lib())
  return eng
}

/** What answered the events an act started: [kind, rule] in order. */
const chain = (eng: Engine, f: () => void) => {
  eng.trace = []
  f()
  return eng.trace.map((t) => [t.ev.kind, t.rule])
}
/** No event of the route so far reached an undefined outcome. */
const noHoles = (eng: Engine) => eng.trace.filter((t) => !t.defined).map((t) => `${t.ev.kind} ${t.rule}`)

describe('the Ford', () => {
  it('the ferry: rope put on the broken winch mends the line; then the ferrykeeper takes you over', () => {
    const eng = ford([
      { key: 'winch', type: 'fixture/ferry/winch', x: 2, y: 2, statuses: ['broken'] },
      { key: 'rope', type: 'item/tool/rope', x: 1, y: 2, heldBy: 'actor' },
      { key: 'hesper', type: 'actor/person/ferrykeeper', x: 1, y: 1 },
    ])
    expect(chain(eng, () => eng.act('hands', 'actor', { e: 'winch' }, { instrument: null }))).toContainEqual(['impulse/handle', 'ford/winch-look'])
    expect(noHoles(eng)).toEqual([])
    expect(eng.controls.plan('put', { x: 2, y: 2 })?.rule).toBe('ford/mend-winch')
    expect(chain(eng, () => eng.act('put', 'actor', { e: 'winch' }))).toContainEqual(['impulse/receive', 'ford/mend-winch'])
    expect(noHoles(eng)).toEqual([])
    expect(eng.world.hasStatus({ e: 'winch' }, 'broken')).toBe(false)
    // the rope is spliced onto the drum: the winch takes it
    expect(eng.world.get('rope')!.place).toMatchObject({ on: 'inside', holder: 'winch' })
    expect(eng.world.get('actor')!.held).toBeUndefined()
    expect(eng.world.fact('ford.winch')).toBe(1)
    expect(chain(eng, () => eng.act('hands', 'actor', { e: 'hesper' }, { instrument: null }))).toEqual(expect.arrayContaining([['impulse/handle', 'ford/ask-crossing'], ['impulse/notify', 'ford/story']]))
    expect(noHoles(eng)).toEqual([])
  })

  it('the dead tree: three blows from the landward side fell it across the water', () => {
    const eng = ford([{ key: 'tree', type: 'fixture/nature/dead_tree', x: 2, y: 2 }, { key: 'axe', type: 'item/weapon/blade/axe', x: 1, y: 2, heldBy: 'actor' }])
    const hit = () => chain(eng, () => eng.act('use', 'actor', { e: 'tree' })).find(([k]) => k === 'impulse/strike')?.[1]
    expect(hit()).toBe('ford/chop-dead-tree')
    expect(hit()).toBe('ford/chop-dead-tree')
    expect(eng.world.get('tree')).toBeDefined()
    expect(eng.world.num(eng.world.get('tree')!, 'cuts')).toBe(2)
    expect(hit()).toBe('ford/chop-dead-tree')
    expect(noHoles(eng)).toEqual([])
    expect(eng.world.get('tree')).toBeUndefined()
    expect(eng.world.terrainAt('sandbox', 2, 2)).toBe('stump')
    expect([3, 4].map((x) => eng.world.terrainAt('sandbox', x, 2))).toEqual(['bridge', 'bridge'])
    expect(eng.world.terrainAt('sandbox', 5, 2)).toBe('grass')
    expect(eng.world.fact('ford.tree')).toBe(1)
  })

  it('felled toward dry land, the tree bridges nothing', () => {
    const eng = ford([{ key: 'tree', type: 'fixture/nature/dead_tree', x: 1, y: 1, props: { cuts: 2 } }, { key: 'axe', type: 'item/weapon/blade/axe', x: 1, y: 2, heldBy: 'actor' }])
    eng.act('use', 'actor', { e: 'tree' })
    expect(eng.world.get('tree')).toBeUndefined()
    expect(eng.world.terrainAt('sandbox', 1, 0)).toBe('grass')
    expect(eng.world.terrainAt('sandbox', 1, 1)).toBe('stump')
  })

  it('the ice: frost on the river freezes a path that thaws again, putting whoever stands on it ashore', () => {
    const eng = ford([])
    eng.queue({ kind: 'impulse/element', host: { tile: { map: 'sandbox', x: 3, y: 2 } }, roles: { actor: { e: 'actor' } }, params: { element: 'ice', power: 3 }, cause: 'actor', origin: 'player' })
    expect(eng.world.terrainAt('sandbox', 3, 2)).toBe('ice')
    expect(eng.world.hasStatus({ tile: { map: 'sandbox', x: 3, y: 2 } }, 'chilled')).toBe(true)
    eng.author(() => eng.teleport(eng.world.player, { map: 'sandbox', x: 3, y: 2 }))
    expect(eng.world.posOf(eng.world.player)).toMatchObject({ x: 3, y: 2 })
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
    expect(chain(eng, () => eng.act('put', 'actor', { e: 'tobin' }))).toContainEqual(['impulse/offered', 'ford/feed-peddler'])
    expect(eng.world.get('loaf')!.place).toMatchObject({ on: 'inside', holder: 'tobin' })
    expect(eng.world.fact('ford.charm')).toBe(1)
    expect(chain(eng, () => eng.act('take', 'actor', { e: 'wand' }, { instrument: null }))).toContainEqual(['seen', 'ford/wand-is-yours'])
    expect(eng.world.get('wand')!.place).toMatchObject({ holder: 'actor' })
    expect(eng.world.topicFresh('theft')).toBe(false)
    expect(noHoles(eng)).toEqual([])
  })
})
