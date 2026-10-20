import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, type Engine, type Ontology } from '@openworld/engine'
import { BASE_RULES, EGGS_LIE, LAYS_EVERY, buildOntology } from '../src/index.ts'

function fresh(onto: Ontology = buildOntology()): Engine {
  const eng = buildSandbox({
    terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }], event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  eng.loadChunk({ map: { ...structuredClone(eng.world.map('sandbox')!), id: 'away' }, entities: [] })
  return eng
}

const travel = (eng: Engine, map: string) => eng.act('move', 'actor', { e: 'actor' }, { instrument: null, params: { map, x: 3, y: 3 } })

describe('dormant stage timers', () => {
  it('three laying periods yield the same eggs and next deadline as an active map', () => {
    const run = (away: boolean) => {
      const eng = fresh()
      const w = eng.world
      const hen = eng.author(() => w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
      const interval = hen.statuses!.stage
      if (away) travel(eng, 'away')
      for (let i = 0; i < interval * 3 + 1; i++) {
        eng.tick()
        w.drainFx()
      }
      if (away) travel(eng, 'sandbox')
      return { eggs: Object.values(w.state.entities).filter((e) => e.type === 'item/food/egg/raw').length, next: hen.statuses!.stage, tick: w.state.tick }
    }
    const active = run(false)
    expect(active).toEqual({ eggs: 3, next: 7200, tick: 5401 })
    expect(run(true)).toEqual(active)
  })

  it('a hen stops laying while a dozen eggs lie about her map, active or dormant, and lays again once they are taken', () => {
    const run = (away: boolean) => {
      const eng = fresh()
      const w = eng.world
      const hen = eng.author(() => w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
      const eggs = () => Object.values(w.state.entities).filter((e) => e.type === 'item/food/egg/raw' && e.place.on === 'tile')
      const pass = (ticks: number) => {
        if (away) travel(eng, 'away')
        for (let i = 0; i < ticks; i++) (eng.tick(), w.drainFx())
        if (away) travel(eng, 'sandbox')
      }
      pass(LAYS_EVERY * (EGGS_LIE + 3) + 1)
      const piled = eggs().length
      eng.author(() => eggs().forEach((e) => w.destroy(e)))
      pass(LAYS_EVERY * 2 + 1)
      return { piled, after: eggs().length, alive: !!w.get(hen.id) }
    }
    const active = run(false)
    expect(active).toEqual({ piled: EGGS_LIE, after: expect.any(Number), alive: true })
    expect(active.after).toBeGreaterThan(0)
    expect(run(true)).toEqual(active)
  })

  it('transformed stages continue from their deadlines, including entry within the event queue', () => {
    for (const queued of [false, true]) {
      const onto = buildOntology()
      Object.assign(onto.types, {
        'fixture/test/first': { id: 'fixture/test/first', stage: { lasts: 10, into: 'fixture/test/second' } },
        'fixture/test/second': { id: 'fixture/test/second', stage: { lasts: 20, into: 'fixture/test/last' } },
        'fixture/test/last': { id: 'fixture/test/last', stage: { lasts: 40, yields: [{ type: 'item/food/egg/raw' }] } },
      })
      const eng = fresh(onto)
      const w = eng.world
      const thing = eng.author(() => w.create('fixture/test/first', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
      travel(eng, 'away')
      w.state.tick = 111
      if (queued) eng.queue(eng.actEvent('move', 'actor', { e: 'actor' }, undefined, { map: 'sandbox', x: 3, y: 3 }))
      else travel(eng, 'sandbox')
      expect(thing.type).toBe('fixture/test/last')
      expect(thing.statuses!.stage).toBe(150)
      expect(Object.values(w.state.entities).filter((e) => e.type === 'item/food/egg/raw')).toHaveLength(2)
      expect(w.state.tick).toBe(111)
    }
  })

  it('condition waits catch up in time order alongside another stage clock', () => {
    const onto = buildOntology()
    Object.assign(onto.types, {
      'fixture/test/waiting': { id: 'fixture/test/waiting', stage: { lasts: 10, needs: { prop: { role: 'host', key: 'ready', cmp: 1 } }, wait: 100, yields: [{ type: 'item/food/egg/raw' }] } },
      'fixture/test/cycle': { id: 'fixture/test/cycle', stage: { lasts: 200, yields: [{ type: 'item/food/egg/raw' }] } },
    })
    const eng = fresh(onto)
    const w = eng.world
    const waiting = eng.author(() => w.create('fixture/test/waiting', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
    eng.author(() => w.create('fixture/test/cycle', { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    travel(eng, 'away')
    w.state.tick = 550
    eng.trace.length = 0
    travel(eng, 'sandbox')
    expect(waiting.statuses!.stage).toBe(610)
    expect(eng.trace.filter((t) => t.ev.kind === 'time/timer').map((t) => t.ev.params?.at)).toEqual([10, 110, 200, 210, 310, 400, 410, 510])
    expect(Object.values(w.state.entities).filter((e) => e.type === 'item/food/egg/raw')).toHaveLength(2)
    eng.author(() => w.setProp(waiting, 'ready', 1))
    w.state.tick = 609
    eng.tick()
    expect(waiting.statuses!.stage).toBe(620)
    expect(Object.values(w.state.entities).filter((e) => e.type === 'item/food/egg/raw')).toHaveLength(4)
  })

  it('a stage that waits no time ends once a tick while its map catches up, as in play', () => {
    const onto = buildOntology()
    onto.types['fixture/test/waiting'] = { id: 'fixture/test/waiting', stage: { lasts: 10, needs: { prop: { role: 'host', key: 'ready', cmp: 1 } }, wait: 0 } }
    const eng = fresh(onto)
    const w = eng.world
    eng.author(() => w.create('fixture/test/waiting', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
    travel(eng, 'away')
    w.state.tick = 100
    eng.trace.length = 0
    travel(eng, 'sandbox')
    expect(eng.trace.filter((t) => t.ev.kind === 'time/timer').map((t) => t.ev.tick)).toEqual(Array.from({ length: 91 }, (_, i) => 10 + i))
  })

  it('a stage with a zero wait cannot keep entry looping forever', () => {
    const onto = buildOntology()
    onto.types['fixture/test/waiting'] = { id: 'fixture/test/waiting', stage: { lasts: 10, needs: { prop: { role: 'host', key: 'ready', cmp: 1 } }, wait: 0 } }
    const eng = fresh(onto)
    const w = eng.world
    const thing = eng.author(() => w.create('fixture/test/waiting', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
    travel(eng, 'away')
    w.state.tick = 100
    const before = eng.traced
    travel(eng, 'sandbox')
    expect(eng.traced - before).toBeLessThan(1000)
    expect(thing.statuses!.stage).toBe(10)
  })
})

// A status that acts every step (design.md §5.12): its pulses are caught up at their ticks, with their own dice.
describe('dormant statuses that act every step', () => {
  /** A sandbox with dry grass west of a woodpile set burning at (1, 2), the player on the grass east of it. */
  const field = () => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => ['drygrass', 'drygrass', 'grass', 'grass', 'grass']),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 4, y: 2 }], event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.loadChunk({ map: { ...structuredClone(eng.world.map('sandbox')!), id: 'away' }, entities: [] })
    return eng
  }
  /** Everything on the sandbox but the player, cell by cell, its ground too: type, place, statuses with their ends, props. */
  const scene = (eng: Engine) =>
    Array.from({ length: 25 }, (_, i) => eng.world.entitiesAt('sandbox', i % 5, Math.floor(i / 5)))
      .flat()
      .filter((e) => e.id !== 'actor')
      .map((e) => JSON.stringify([e.type, e.place, e.statuses ?? {}, e.props ?? {}]))
      .sort()

  const burn = (ticks: number, away: boolean, stir: boolean) => {
    const eng = field()
    const w = eng.world
    eng.author(() => {
      const pile = w.create('fixture/container/woodpile', { on: 'tile', map: 'sandbox', x: 1, y: 2 })
      w.setStatus({ e: pile.id }, 'burning', w.state.tick + 500)
    })
    if (away) travel(eng, 'away')
    for (let i = 0; i < ticks; i++) {
      eng.tick()
      // other dice drawn meanwhile (the map the player is on): a pulse's own are not touched
      if (stir) w.rand()
      w.drainFx()
    }
    if (away) travel(eng, 'sandbox')
    return { scene: scene(eng), tick: w.state.tick }
  }

  it('a burning woodpile on a map left behind wears, breaks into its logs and sets the grass alight, as one in play does', () => {
    for (const ticks of [10, 60, 600, 3000]) {
      const stay = burn(ticks, false, false)
      expect(burn(ticks, true, false)).toEqual(stay)
      expect(burn(ticks, true, true)).toEqual(stay)
    }
    const after = burn(600, false, false).scene.join('\n')
    expect(after).toContain('item/material/log')
    expect(after).not.toContain('fixture/container/woodpile')
    expect(after).toContain('"tile/ash"')
  })

  it('a bleed at its own pace is caught up pulse by pulse, in the name of whoever opened it', () => {
    const w0hp = () => buildOntology().types['actor/creature/animal/chicken']?.props?.hp as number
    const run = (away: boolean) => {
      const eng = field()
      const w = eng.world
      const hen = eng.author(() => w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 0 }))
      eng.author(() => w.setStatus({ e: hen.id }, 'bleeding', w.state.tick + 25, 'actor'))
      if (away) travel(eng, 'away')
      for (let i = 0; i < 40; i++) (eng.tick(), w.drainFx())
      if (away) travel(eng, 'sandbox')
      const now = w.get(hen.id)
      return { hp: now && w.num(now, 'hp'), bleeding: now?.statuses?.bleeding, by: now && eng.trace.some((t) => t.ev.kind === 'time/period' && t.ev.roles.actor && 'e' in t.ev.roles.actor && t.ev.roles.actor.e === 'actor') }
    }
    const stay = run(false)
    expect(stay.bleeding).toBeUndefined()
    expect(stay.hp).toBeLessThan(w0hp())
    expect(run(true)).toEqual(stay)
  })

  it('the one at the keys is not caught up again: their clock ran where they were', () => {
    const run = (away: boolean) => {
      const eng = field()
      const w = eng.world
      eng.author(() => w.setStatus({ e: 'actor' }, 'bleeding', w.state.tick + 40))
      if (away) travel(eng, 'away')
      for (let i = 0; i < 20; i++) (eng.tick(), w.drainFx())
      if (away) travel(eng, 'sandbox')
      return w.num(w.player, 'hp')
    }
    expect(run(true)).toBe(run(false))
  })

  it('a pulse no rule acts on is passed over: a long absence costs the ends that fell due', () => {
    const eng = field()
    const w = eng.world
    eng.author(() => w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 0 }))
    travel(eng, 'away')
    w.state.tick += LAYS_EVERY * 3
    eng.trace.length = 0
    travel(eng, 'sandbox')
    expect(eng.trace.filter((t) => t.ev.kind === 'time/period')).toHaveLength(0)
    expect(eng.trace.filter((t) => t.ev.kind === 'time/timer').length).toBeGreaterThanOrEqual(3)
  })
})
