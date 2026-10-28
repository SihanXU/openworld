import { describe, expect, it } from 'vitest'
import { HARM, RuleLibrary, buildSandbox, type Engine, type ScenarioEntity } from '@openworld/engine'
import '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

// What weighs on one and what puts it right, read from the game's own rules (engine wellbeing.ts, design.md §5.18):
// nothing in the engine names rain, fire or hunger.

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function world(others: ScenarioEntity[], cells: NonNullable<Parameters<typeof buildSandbox>[0]['cells']> = []): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0, props: {} }, ...others]
  return buildSandbox({ entities, event: {}, cells }, onto, lib())
}
const at = (x: number, y: number) => ({ map: 'sandbox', x, y })

describe('what a place does to one', () => {
  it('a burning cell sets one burning, which harms (a danger); a cell beside it, nothing', () => {
    const eng = world([{ key: 'nell', type: 'actor/person/villager', x: 4, y: 4 }], [{ x: 2, y: 1, statuses: ['burning'] }])
    const nell = eng.world.get('nell')!
    const fire = eng.wellbeing.placeAt(nell, at(2, 1))
    expect(fire.adds.has('burning')).toBe(true)
    expect(eng.wellbeing.placeWeight(nell, at(2, 1))).toBeGreaterThanOrEqual(HARM)
    expect(eng.wellbeing.placeAt(nell, at(4, 3)).adds.size).toBe(0)
  })

  it('rain wets one under the sky, not under a roof', () => {
    const eng = world([{ key: 'nell', type: 'actor/person/villager', x: 4, y: 4 }])
    eng.world.weather = [{ day: 1, weather: 'rain' }]
    const nell = eng.world.get('nell')!
    expect(eng.wellbeing.placeAt(nell, at(3, 3)).adds.has('wet')).toBe(true)
    eng.author(() => (eng.world.state.maps.sandbox.light = 'indoor'))
    expect(eng.wellbeing.placeAt(nell, at(3, 2)).adds.has('wet')).toBe(false)
  })
})

describe('what weighs on one', () => {
  it('burning harms (its pulse costs health): a danger; wet is minded, not harm; the weathered and those who endure it do not mind it', () => {
    const eng = world([
      { key: 'nell', type: 'actor/person/villager', x: 4, y: 4, statuses: ['burning', 'wet'] },
      { key: 'odo', type: 'actor/person/farmer', x: 3, y: 4, statuses: ['wet'] },
      { key: 'ivo', type: 'actor/person/villager', x: 2, y: 4, statuses: ['wet'], tags: ['endures:wet'] },
    ])
    const w = eng.world
    expect(eng.wellbeing.harms(w.get('nell')!, 'burning')).toBe(true)
    expect(eng.wellbeing.weight(w.get('nell')!, 'burning')).toBeGreaterThanOrEqual(HARM)
    expect(eng.wellbeing.weight(w.get('nell')!, 'wet')).toBe(1)
    expect(eng.wellbeing.weight(w.get('odo')!, 'wet')).toBe(0)
    expect(eng.wellbeing.weight(w.get('ivo')!, 'wet')).toBe(0)
    expect(eng.wellbeing.troubles(w.get('nell')!).map((t) => [t.status, t.danger])).toEqual([['burning', true], ['wet', false]])
  })
})

describe('what puts it right', () => {
  it('food cures hunger (it fills the bar the status is drawn under); a stone does not', () => {
    const eng = world([
      { key: 'nell', type: 'actor/person/villager', x: 4, y: 4, statuses: ['hungry'], props: { hunger: 4 } },
      { key: 'apple', type: 'item/food/apple', x: 4, y: 4, inside: 'nell' },
      { key: 'stone', type: 'item/material/stone', x: 4, y: 4, inside: 'nell' },
    ])
    const eat = (item: string) => eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: 'nell' }, { e: item }), 'nell')
    expect(eng.wellbeing.cures(eat('apple'), 'hungry')).toBe(true)
    expect(eng.wellbeing.cures(eat('stone'), 'hungry')).toBe(false)
  })

  it('a bucket of water puts out a fire; an empty bucket at the water becomes one', () => {
    const eng = world(
      [
        { key: 'nell', type: 'actor/person/villager', x: 2, y: 2 },
        { key: 'pail', type: 'item/vessel/bucket/empty', x: 2, y: 2, heldBy: 'nell' },
        { key: 'crate', type: 'fixture/container/crate', x: 3, y: 2, statuses: ['burning'] },
      ],
      [{ x: 1, y: 2, type: 'tile/water' }],
    )
    const w = eng.world
    const water = w.cellTop('sandbox', 1, 2)!
    const fill = eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: water.id }, { e: 'pail' }), 'pail')
    expect(fill.becomes).toBe('item/vessel/bucket/water')
    const douse = eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: 'crate' }, { e: 'pail' }), 'crate', undefined, 3, { id: 'pail', type: 'item/vessel/bucket/water' })
    expect(eng.wellbeing.cures(douse, 'burning')).toBe(true)
  })
})
