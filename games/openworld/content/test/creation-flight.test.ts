import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, buildSandbox, disableWorkshopPackage, registerWorkshopPackage, restoreLibrary, restoreWorkshopPackages, runWorkshopUse, trialWorkshopPackage, workshopFlights, workshopUseAction, type WorkshopDraft, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const draft = (revision = 1): WorkshopDraft => ({ id: 'flight-test', revision, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'throw', label: { en: 'Throw', zh: '投掷' }, capability: 'throw-coat', target: 'person', params: { substance: 'wet', duration: 20, range: 6, power: 0 } }] } })
function world() {
  const eng = buildSandbox({ terrain: Array.from({ length: 4 }, () => Array(8).fill('grass')), entities: [
    { key: 'actor', type: 'actor/person/player', x: 0, y: 1, props: { hunger: 100, maxHunger: 100 } },
    { key: 'berry', type: 'item/food/berries', x: 0, y: 1, heldBy: 'actor' },
    { key: 'spare', type: 'item/food/berries', x: 0, y: 1, inside: 'actor' },
    { key: 'target', type: 'actor/person', x: 3, y: 1, props: { age: 30, hp: 100, maxHp: 100, hunger: 100, maxHunger: 100 } },
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const report = trialWorkshopPackage(eng, draft())
  expect(report.errors, JSON.stringify(report)).toEqual([])
  expect(registerWorkshopPackage(eng, draft(), report).ok).toBe(true)
  return eng
}
function finish(eng: ReturnType<typeof world>) {
  for (let i = 0; i < 5 && workshopFlights(eng).length; i++) eng.tick()
  expect(workshopFlights(eng)).toEqual([])
}
const impacts = (eng: ReturnType<typeof world>) => eng.trace.filter(t => t.rule === 'creation/flight-test/r1/throw/receive').length

describe('saveable workshop throw flights', () => {
  it('launches the actual source once and changes the target only at arrival', () => {
    const eng = world(), w = eng.world
    const before = eng.controls.count('item/food/berries')
    expect(runWorkshopUse(eng, 'flight-test', 'throw', { e: 'target' }, 'berry')).toBe(true)
    const [flight] = workshopFlights(eng)
    expect(flight.dueTick - flight.startTick).toBe(3)
    expect(eng.controls.count('item/food/berries')).toBe(before - 1)
    expect(w.get('berry')!.place).toEqual({ on: 'none' })
    expect(w.hasStatus({ e: 'target' }, 'wet')).toBe(false)
    expect(impacts(eng)).toBe(0)
    expect(runWorkshopUse(eng, 'flight-test', 'throw', { e: 'target' }, 'berry')).toBe(false)
    expect(w.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'creation-throw:item/food/berries', x: 0, y: 1, angle: 0, span: 3, who: 'actor', instance: 'berry', durationMs: 300, untilTick: flight.dueTick }))
    while (w.state.tick < flight.dueTick - 1) { eng.tick(); expect(w.hasStatus({ e: 'target' }, 'wet')).toBe(false) }
    // The throw does not depend on its actor staying within range after launch.
    eng.author(() => eng.teleport(w.player, { map: 'sandbox', x: 7, y: 3 }))
    eng.tick()
    expect(w.hasStatus({ e: 'target' }, 'wet')).toBe(true)
    expect(w.get('berry')).toBeUndefined()
    expect(w.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'creation-land', instance: 'berry' }))
    expect(impacts(eng)).toBe(1)
    for (let i = 0; i < 4; i++) eng.tick()
    expect(impacts(eng)).toBe(1)
    expect(w.get('spare')).toBeDefined()
  })

  it('resumes a sparse save mid-flight and lands exactly once with idempotent restore hooks', () => {
    const eng = world(), w = eng.world
    expect(runWorkshopUse(eng, 'flight-test', 'throw', { e: 'target' }, 'berry')).toBe(true)
    eng.tick()
    const map = structuredClone(w.state.maps.sandbox)
    const index: WorldIndex = { name: 'creation-flight', version: '1', seed: 1, start: w.state.spawn, maps: [{ id: 'sandbox', name: 'sandbox', kind: 'sandbox', width: 8, height: 4, portals: [], npcs: 0, items: 0 }], npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 0, fixtures: 0 } }
    const save = JSON.parse(JSON.stringify(new Game(eng).save()))
    const loaded = Game.load(save, index, buildOntology(), restoreLibrary([...BASE_RULES, ...STORY_RULES], save.library, buildOntology()))
    loaded.loadMapData(map)
    expect(restoreWorkshopPackages(loaded.engine)).toEqual([])
    const hookCount = loaded.engine.hooks.tick.length
    expect(restoreWorkshopPackages(loaded.engine)).toEqual([])
    expect(loaded.engine.hooks.tick).toHaveLength(hookCount)
    expect(workshopFlights(loaded.engine)).toEqual(workshopFlights(eng))
    expect(loaded.engine.world.get('berry')!.place).toEqual({ on: 'none' })
    expect(loaded.engine.world.hasStatus({ e: 'target' }, 'wet')).toBe(false)
    expect(loaded.engine.world.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'creation-throw:item/food/berries', durationMs: 200 }))
    finish(loaded.engine)
    expect(loaded.engine.world.hasStatus({ e: 'target' }, 'wet')).toBe(true)
    expect(loaded.engine.world.get('berry')).toBeUndefined()
    expect(impacts(loaded.engine)).toBe(1)
    for (let i = 0; i < 4; i++) loaded.engine.tick()
    expect(impacts(loaded.engine)).toBe(1)
    expect(workshopFlights(eng)).toHaveLength(1)
    expect(w.get('berry')).toBeDefined()
  })

  it.each(['tile', 'map'] as const)('misses a target which changed its %s without spending another source', change => {
    const eng = world(), w = eng.world
    expect(runWorkshopUse(eng, 'flight-test', 'throw', { e: 'target' }, 'berry')).toBe(true)
    eng.author(() => w.place(w.get('target')!, { on: 'tile', map: change === 'map' ? 'elsewhere' : 'sandbox', x: 4, y: 1 }))
    finish(eng)
    expect(w.hasStatus({ e: 'target' }, 'wet')).toBe(false)
    expect(impacts(eng)).toBe(0)
    expect(w.get('berry')).toBeUndefined()
    expect(w.get('spare')!.place).toEqual(expect.objectContaining({ holder: 'actor' }))
    expect(w.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'splash', map: 'sandbox', x: 3, y: 1 }))
    for (let i = 0; i < 3; i++) eng.tick()
    expect(eng.controls.count('item/food/berries')).toBe(1)
  })

  it('blocks revision changes and disabling until launched objects have landed', () => {
    const eng = world(), update = draft(7)
    const report = trialWorkshopPackage(eng, update)
    expect(report.ok).toBe(true)
    expect(runWorkshopUse(eng, 'flight-test', 'throw', { e: 'target' }, 'berry')).toBe(true)
    expect(registerWorkshopPackage(eng, update, report).errors.join()).toContain('in-flight')
    expect(disableWorkshopPackage(eng, 'flight-test').errors.join()).toContain('in-flight')
    finish(eng)
    expect(registerWorkshopPackage(eng, update, report).ok).toBe(true)
    expect(disableWorkshopPackage(eng, 'flight-test').ok).toBe(true)
  })

  it('does not turn a caller-supplied impact parameter into a host-owned landing', () => {
    const eng = world()
    const params = { ...workshopUseAction(eng, 'flight-test', 'throw').params, creationFlightPhase: 'impact' }
    eng.act('use', 'actor', { e: 'target' }, { instrument: { e: 'berry' }, params, reach: 6 })
    expect(eng.world.hasStatus({ e: 'target' }, 'wet')).toBe(false)
    expect(impacts(eng)).toBe(0)
    expect(workshopFlights(eng)).toEqual([])
  })
})
