import { describe, expect, it, vi } from 'vitest'
import { Engine, RuleLibrary, buildSandbox } from '@openworld/engine'
import { buildOntology } from '@openworld-game/content'

function fresh() {
  return buildSandbox({ terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')), entities: [], event: {} }, buildOntology(), new RuleLibrary([]))
}

function enclose(eng: Engine) {
  eng.author(() => {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++)
      if (x !== 1 || y !== 1) eng.world.create('structure/wall', { on: 'tile', map: 'sandbox', x, y })
  })
}

describe('room geometry indices', () => {
  it('does not scan cells on an outdoor map without upper-storey cover', () => {
    const eng = fresh(), w = eng.world
    const at = vi.spyOn(w, 'entitiesAt')
    w.reindex()
    expect(w.roomsOf('sandbox')).toEqual([])
    expect(at.mock.calls.length).toBe(0)
    eng.author(() => w.create('item/material/stick', { on: 'tile', map: 'sandbox', x: 1, y: 1, z: 1 }))
    expect(w.roomsOf('sandbox')).toEqual([])
    expect(at.mock.calls.length).toBe(0)
  })

  it('keeps shapes through static state changes and geometry changes on another map', () => {
    const eng = fresh(), w = eng.world
    enclose(eng)
    eng.author(() => { w.state.maps.sandbox.light = 'indoor'; w.state.maps.other = { ...w.state.maps.sandbox, id: 'other' } })
    expect(w.roomsOf('sandbox')).toHaveLength(1)
    const occupant = vi.spyOn(w, 'occupant')
    const floor = w.cellTop('sandbox', 1, 1)!
    eng.author(() => w.setStatus({ e: floor.id }, 'wet', -1))
    eng.author(() => w.create('structure/wall', { on: 'tile', map: 'other', x: 1, y: 1 }))
    expect(w.roomsOf('sandbox')).toHaveLength(1)
    expect(occupant.mock.calls.length).toBe(0)
  })

  it('tracks cover through building, moving, transformation, destruction and loading', () => {
    const eng = fresh(), w = eng.world
    enclose(eng)
    expect(w.roomsOf('sandbox')).toEqual([])
    const roof = eng.author(() => w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 1, y: 1, z: 1 }))
    expect(w.roomsOf('sandbox')).toHaveLength(1)
    const loaded = new Engine(structuredClone(w.state), w.onto.data, new RuleLibrary([]))
    expect(loaded.world.roomsOf('sandbox')).toHaveLength(1)
    eng.author(() => w.transform(roof, 'item/material/stick'))
    expect(w.roomsOf('sandbox')).toEqual([])
    eng.author(() => w.transform(roof, 'structure/floor'))
    expect(w.roomsOf('sandbox')).toHaveLength(1)
    eng.author(() => w.place(roof, { on: 'tile', map: 'sandbox', x: 0, y: 0, z: 1 }))
    expect(w.roomsOf('sandbox')).toEqual([])
    eng.author(() => w.place(roof, { on: 'tile', map: 'sandbox', x: 1, y: 1, z: 1 }))
    expect(w.roomsOf('sandbox')).toHaveLength(1)
    eng.author(() => w.destroy(roof))
    expect(w.roomsOf('sandbox')).toEqual([])
  })

  it('reads room roles without rebuilding shapes and indexes a newly loaded map', () => {
    const eng = fresh(), w = eng.world
    enclose(eng)
    eng.author(() => w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 1, y: 1, z: 1 }))
    expect(w.roomsOf('sandbox')[0].tags).not.toContain('role:bedroom')
    const occupant = vi.spyOn(w, 'occupant')
    const bed = eng.author(() => w.create('fixture/furniture/bed', { on: 'tile', map: 'sandbox', x: 1, y: 1 }))
    expect(w.roomsOf('sandbox')[0].tags).toContain('role:bedroom')
    expect(occupant.mock.calls.length).toBe(0)
    eng.author(() => w.destroy(bed))
    expect(w.roomsOf('sandbox')[0].tags).not.toContain('role:bedroom')
    occupant.mockRestore()
    eng.loadChunk({ map: { ...w.state.maps.sandbox, id: 'loaded' }, entities: [
      { id: 'loaded.roof', type: 'structure/floor', place: { on: 'tile', map: 'loaded', x: 1, y: 1, z: 1 } },
      ...w.entitiesOnMap('sandbox').filter((e) => e.type === 'structure/wall').map((e) => ({ ...structuredClone(e), id: `loaded.${e.id}`, place: { ...e.place, map: 'loaded' } })),
    ] })
    expect(w.roomsOf('loaded')).toHaveLength(1)
  })
})

describe('companion index', () => {
  it('finds dormant companions without enumerating dormant items, in entity order', () => {
    const eng = fresh(), w = eng.world
    eng.author(() => {
      w.create('actor/companion', { on: 'tile', map: 'away', x: 1, y: 1 }, { id: 'first' })
      w.create('actor/companion', { on: 'tile', map: 'away', x: 1, y: 1 }, { id: 'second', props: { companion: w.player.id } })
      w.setProp(w.get('first')!, 'companion', w.player.id)
      for (let i = 0; i < 10; i++) w.create('item/material/stick', { on: 'tile', map: 'away', x: i, y: 0 })
    })
    const turn = vi.spyOn(eng.companions, 'follow').mockReturnValue(true)
    eng.npcs.begin('sandbox')
    const values = vi.spyOn(Object, 'values')
    eng.behaviour.tick('sandbox')
    const scans = values.mock.calls.filter(([obj]) => obj === w.state.entities).length
    values.mockRestore()
    expect(turn.mock.calls.map(([e]) => e.id)).toEqual(['first', 'second'])
    expect(scans).toBe(0)
    eng.author(() => { w.setProp(w.get('first')!, 'companion', undefined); w.destroy(w.get('second')!) })
    turn.mockClear()
    eng.behaviour.tick('sandbox')
    expect(turn).not.toHaveBeenCalled()
  })

  it('rebuilds membership on load, follows across maps and reads a changed leader', () => {
    const eng = fresh(), w = eng.world
    eng.author(() => {
      w.state.maps.away = { ...w.state.maps.sandbox, id: 'away' }
      w.create('actor/companion', { on: 'tile', map: 'away', x: 1, y: 1 }, { id: 'bird', props: { companion: w.player.id } })
    })
    const loaded = new Engine(structuredClone(w.state), w.onto.data, new RuleLibrary([]))
    const turn = vi.spyOn(loaded.companions, 'follow').mockReturnValue(true)
    loaded.behaviour.tick('sandbox')
    expect(turn.mock.calls.map(([e]) => e.id)).toEqual(['bird'])
    const bird = loaded.world.get('bird')!
    loaded.author(() => { loaded.world.setProp(bird, 'companion', 'leader'); loaded.world.place(bird, { on: 'tile', map: 'sandbox', x: 1, y: 1 }) })
    turn.mockClear()
    loaded.behaviour.tick('sandbox')
    expect(turn).toHaveBeenCalledTimes(1)
    expect(turn.mock.calls[0][0].props?.companion).toBe('leader')
  })
})
