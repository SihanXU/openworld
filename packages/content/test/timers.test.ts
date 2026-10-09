import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, type Engine, type Ontology } from '@lsw/engine'
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
