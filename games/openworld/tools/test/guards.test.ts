// Runtime guards (design.md A7, §5.15): whatever a learned rule does, the engine keeps the world
// whole while it runs. Chains end, numbers stay finite, things stay where a thing can be, what
// cannot be lost is not lost, and a rule that keeps failing is set aside (its hole open again).

import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, SANDBOX_MAP, buildSandbox, gainXp, holeKey, type GameEvent, type Rule, type Scenario, type Tree } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'

const onto = buildOntology()
const FEATHER = 'item/material/feather'
const STONE = 'item/material/stone'
const POT = 'fixture/container/pot'
const STATUE = 'fixture/sacred/statue'

/** A learned rule: one type's own answer at one base hole (design.md §5.16). */
const learned = (id: string, host: string, on: string, hole: string, tree: Tree): Rule => ({ id: `test/${id}`, host: { type: host }, on, hole, tree, source: { origin: 'patch' } })
/** The key of the base hole an event falls into on a world with nothing learned. */
const holeOf = (ev: GameEvent, extra: Scenario['entities'] = []): string => {
  const res = world([], extra).resolveEvent(ev)
  return holeKey(res.hole!.rule.id, res.hole!.path)
}
/** A feather used on the pot does what the learned rule says (the act's hole, filled). */
const onPot = (id: string, ...effects: unknown[]): Rule => learned(id, FEATHER, 'act/use', USE_HOLE, { if: { is: { role: 'target', sel: { type: POT } } }, then: { do: effects as never }, else: { undefined: true } })

function world(rules: Rule[], extra: Scenario['entities'] = []): Engine {
  const sc: Scenario = {
    terrain: Array.from({ length: 9 }, () => Array(9).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 4, y: 4 },
      { key: 'feather', type: FEATHER, x: 4, y: 4, heldBy: 'actor' },
      { key: 'pot', type: POT, x: 4, y: 3 },
      ...extra,
    ],
    event: {},
  }
  return buildSandbox(sc, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES, ...rules]))
}
const use = (eng: Engine) => eng.act('use', 'actor', { e: 'pot' }, { instrument: { e: 'feather' } })
const count = (eng: Engine, type: string) => Object.values(eng.world.state.entities).filter((e) => e.type === type && e.place.on !== 'none').length
const pushTo = (host: string): GameEvent => ({ kind: 'impulse/push', host: { e: host }, roles: {}, params: {}, origin: 'world' })
const USE_HOLE = holeOf(world([]).actEvent('use', 'actor', { e: 'pot' }, { e: 'feather' }))
/** A pushed fixture is a hole (only an actor moves). */
const PUSH_HOLE = holeOf(pushTo('pot'))

describe('every chain ends (design.md A7)', () => {
  it('two learned rules that answer each other for ever are stopped, and set aside', () => {
    // a pushed thing is a hole: each answers by pushing the other, with no time between
    const eng = world([learned('ping', POT, 'impulse/push', PUSH_HOLE, { do: [{ op: 'emit', impulse: 'push', to: { named: 'statue' } }] }), learned('pong', STATUE, 'impulse/push', PUSH_HOLE, { do: [{ op: 'emit', impulse: 'push', to: { named: 'pot' } }] })], [{ key: 'statue', type: STATUE, x: 6, y: 3 }])
    eng.author(() => eng.queue(pushTo('pot')))
    for (let i = 0; i < 400; i++) eng.tick()
    const before = eng.traced
    for (let i = 0; i < 50; i++) eng.tick()
    const pushes = eng.trace.slice(-(eng.traced - before)).filter((t) => t.ev.kind === 'impulse/push').length
    expect(pushes).toBe(0)
    expect(Object.keys(eng.world.state.quarantine ?? {}).some((id) => id === 'test/ping' || id === 'test/pong')).toBe(true)
  })

  it('a cascade that fans out does not grow without bound: the waiting events are capped, each tick stays short', () => {
    const statues = Array.from({ length: 24 }, (_, i) => ({ key: `s${i}`, type: STATUE, x: i % 9, y: 6 + Math.floor(i / 9) }))
    const eng = world([learned('fan', STATUE, 'impulse/push', PUSH_HOLE, { do: [{ op: 'emit', impulse: 'push', to: { area: { radius: 3 } } }] })], statues)
    eng.author(() => eng.queue(pushTo('s0')))
    let slowest = 0
    for (let i = 0; i < 60; i++) {
      const t = performance.now()
      eng.tick()
      slowest = Math.max(slowest, performance.now() - t)
      expect((eng as unknown as { later: unknown[] }).later.length).toBeLessThanOrEqual(2400)
    }
    expect(slowest).toBeLessThan(2000)
    expect(eng.world.state.quarantine?.['test/fan']).toBeDefined()
  })
})

describe('numbers stay finite and counts stay small', () => {
  it('a spawn of a million is refused; the rule is set aside after three tries, and the act is open again', () => {
    const eng = world([onPot('million', { op: 'spawn', type: STONE, at: 'actor', into: 'contents', count: 1_000_000 })])
    for (let i = 0; i < 3; i++) use(eng)
    expect(count(eng, STONE)).toBe(0)
    expect(eng.world.state.quarantine?.['test/million']?.reason).toMatch(/more than 64/)
    const ev = eng.actEvent('use', 'actor', { e: 'pot' }, { e: 'feather' })
    expect(eng.resolveEvent(ev).rule?.id).not.toBe('test/million')
  })

  it('an amount that is not a number (a prop that is a word) is refused, not written as NaN', () => {
    const eng = world([onPot('word', { op: 'addProp', key: 'hp', delta: { prop: 'material', of: 'host' } })])
    eng.author(() => eng.world.setProp(eng.world.get('feather')!, 'material', 'goose'))
    use(eng)
    const hp = eng.world.get('feather')?.props?.hp
    expect(hp === undefined || Number.isFinite(hp)).toBe(true)
    expect(() => eng.author(() => eng.world.setProp(eng.world.get('pot')!, 'hp', Number.NaN))).toThrow(/finite/)
  })

  it('a huge experience does not hang the clock: levels come at most a hundred at a time', () => {
    const eng = world([])
    const p = eng.world.get('actor')!
    eng.author(() => {
      eng.world.setProp(p, 'level', 1)
      eng.world.setProp(p, 'xp', 1e300)
      expect(gainXp(eng.world, p, 20)).toBeLessThanOrEqual(100)
    })
  })
})

describe('things stay where a thing can be', () => {
  it('a push to a map that does not exist, or to half a cell, moves no one', () => {
    for (const params of [{ map: 'nowhere', x: 3, y: 3 }, { x: 1.5, y: 2 }]) {
      const eng = world([onPot('away', { op: 'emit', impulse: 'push', to: 'actor', params })])
      const at = structuredClone(eng.world.get('actor')!.place)
      use(eng)
      expect(eng.world.get('actor')!.place).toEqual(at)
      expect(eng.pendingTransition).toBeUndefined()
    }
  })

  it('a thing cannot be put inside itself', () => {
    const eng = world([onPot('self', { op: 'move', to: 'host', into: 'contents' })])
    use(eng)
    expect(eng.world.get('feather')!.place).toEqual({ on: 'hand', holder: 'actor' })
    expect(eng.world.posOf(eng.world.get('feather')!)?.map).toBe(SANDBOX_MAP)
  })

  it('what is essential may change into anything that can act, and stays essential; never into a stick', () => {
    // tar on a person is a hole (oil coats; anything else is undefined)
    const coat: GameEvent = { kind: 'impulse/coat', host: { e: 'actor' }, roles: {}, params: { substance: 'tar' }, origin: 'world' }
    const tar = (into: string) => {
      const eng = world([learned('change', 'actor/person/player', 'impulse/coat', holeOf(coat), { do: [{ op: 'transform', into }] })])
      eng.author(() => eng.queue(coat))
      return eng.world.get('actor')!
    }
    const hen = tar('actor/creature/animal/chicken')
    expect(hen.type).toBe('actor/creature/animal/chicken')
    expect(hen.tags).toContain('essential')
    expect(tar('item/material/stick').type).toBe('actor/person/player')
  })
})

describe('a rule set aside stays aside', () => {
  it('the save keeps it: a world loaded from the state does not answer with it', () => {
    const rules = [onPot('million', { op: 'spawn', type: STONE, at: 'actor', into: 'contents', count: 1_000_000 })]
    const eng = world(rules)
    for (let i = 0; i < 3; i++) use(eng)
    const again = new Engine(JSON.parse(JSON.stringify(eng.world.state)), eng.world.onto.data, eng.lib)
    expect(again.world.state.quarantine?.['test/million']).toBeDefined()
    expect(again.resolveEvent(again.actEvent('use', 'actor', { e: 'pot' }, { e: 'feather' })).rule?.id).not.toBe('test/million')
  })
})
