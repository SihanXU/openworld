import { describe, expect, it } from 'vitest'
import { Engine as FreshEngine, RuleLibrary, SANDBOX_MAP, buildSandbox, type Engine, type Rule, type Text } from '@openworld/engine'
import { residentWorkOrderView, residenceView } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

function farm({ capacity = 40, multipleResidents = false }: { capacity?: number; multipleResidents?: boolean } = {}): Engine {
  const ontology = buildOntology()
  const residence = ontology.social!.residence!
  ontology.social!.residence = {
    ...residence,
    map: SANDBOX_MAP,
    work: {
      ...residence.work!,
      controller: { type: 'actor/person/steward', tags: ['haven-steward'] },
      yieldTypeProp: 'yieldType',
      seedTypeProp: 'seedType',
      pickBonusProp: 'pick',
      yieldBase: 1,
      seedCount: 1,
    },
    slots: [{ anchor: 'home.camp' }, ...(multipleResidents ? [{ anchor: 'home.bunk' }] : [])],
  }
  const eng = buildSandbox({
    terrain: Array.from({ length: 8 }, () => Array(10).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
      { key: 'crop', type: 'fixture/crop/turnip/ripe', x: 5, y: 2 },
      { key: 'store', type: 'fixture/container/storehouse', x: 7, y: 3 },
    ],
    event: {},
  }, ontology, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const w = eng.world
  w.state.maps[SANDBOX_MAP]!.anchors = { 'home.camp': [2, 3], ...(multipleResidents ? { 'home.bunk': [3, 4] as [number, number] } : {}) }
  eng.author(() => {
    w.add({
      id: 'steward', type: 'actor/person/steward', tags: ['haven-steward'],
      place: { on: 'tile', map: SANDBOX_MAP, x: 1, y: 0 }, npc: { role: 'steward', schedule: [] },
    })
    w.add({
      id: 'worker', type: 'actor/person/herbalist', props: { age: 24 },
      place: { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 },
      npc: { role: 'resident', schedule: [], resident: { map: SANDBOX_MAP, slot: 'home.camp', schedule: [] } },
    })
    if (multipleResidents) w.add({
      id: 'worker-2', type: 'actor/person/herbalist', props: { age: 24 },
      place: { on: 'tile', map: SANDBOX_MAP, x: 4, y: 4 },
      npc: { role: 'resident', schedule: [], resident: { map: SANDBOX_MAP, slot: 'home.bunk', schedule: [] } },
    })
    w.setProp(w.get('store')!, 'capacity', capacity)
    w.setProp(w.get('store')!, 'owner', 'actor')
    w.setStatus({ e: 'store' }, 'open', -1)
  })
  return eng
}

function order(eng: Engine, choice: Record<string, unknown>): void {
  eng.act('hands', 'actor', { e: 'steward' }, {
    instrument: null,
    params: { say: 'resident-work', choice: JSON.stringify(choice) },
  })
}

function assign(eng: Engine, worker = 'worker', cells = [{ x: 5, y: 2 }]): void {
  order(eng, { v: 1, op: 'assign', worker, warehouse: 'store', cells })
}

function runTicks(eng: Engine, n = 240): void {
  // Start at 07:00; day work begins at 07:00 and all real movement/acts still use the engine clock.
  eng.world.state.tick = 600
  for (let i = 0; i < n; i++) eng.tick()
}

function putInside(eng: Engine, id: string, type: string, holder = 'store'): void {
  eng.author(() => eng.world.add({ id, type, place: { on: 'inside', holder } }))
}

function locale(text: Text | undefined, language: 'en' | 'zh'): string {
  return typeof text === 'string' ? text : text?.[language] ?? ''
}

describe('resident harvest work', () => {
  it('accepts a bounded harvest order through the configured steward', () => {
    const eng = farm()

    order(eng, { v: 1, op: 'assign', worker: 'worker', warehouse: 'store', cells: [{ x: 5, y: 2 }] })

    expect(eng.world.get('worker')?.residentWork).toMatchObject({
      kind: 'harvest', map: SANDBOX_MAP, warehouse: 'store', status: 'working', cells: [{ x: 5, y: 2 }],
    })
    expect(eng.world.prop(eng.world.get('worker')!, 'residentWorkMap')).toBe(SANDBOX_MAP)
  })

  it('walks to the authorized crop, captures only its new yield and seed, preserves private hand and old ground seeds, then deposits', () => {
    const eng = farm()
    const w = eng.world
    const yieldType = String(w.prop(w.get('crop')!, 'yieldType'))
    const seedType = String(w.prop(w.get('crop')!, 'seedType'))
    eng.author(() => {
      w.add({ id: 'worker-private', type: 'item/tool/hoe', place: { on: 'hand', holder: 'worker' } })
      w.add({ id: 'old-ground-seed', type: seedType, place: { on: 'tile', map: SANDBOX_MAP, x: 5, y: 2 } })
    })
    putInside(eng, 'old-store-yield', yieldType)
    const heldBefore = w.get('worker')!.held
    assign(eng)
    runTicks(eng)

    const stored = (w.get('store')?.contents ?? []).map((id) => w.get(id)).filter((e) => e?.place.on === 'inside' && e.place.holder === 'store')
    expect(stored.filter((e) => e?.type === yieldType)).toHaveLength(2)
    expect(stored.filter((e) => e?.type === seedType)).toHaveLength(1)
    expect(w.get('old-ground-seed')?.place).toEqual({ on: 'tile', map: SANDBOX_MAP, x: 5, y: 2 })
    expect(w.get('worker')?.held).toBe(heldBefore)
    expect(w.get('worker-private')?.place).toEqual({ on: 'hand', holder: 'worker' })
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
    expect(w.get('crop')).toBeUndefined()
  })

  it('does not pick when the shared-stack 999 boundary would exceed warehouse capacity', () => {
    const eng = farm({ capacity: 2 })
    const crop = eng.world.get('crop')!
    const yieldType = String(eng.world.prop(crop, 'yieldType'))
    const seedType = String(eng.world.prop(crop, 'seedType'))
    eng.author(() => { for (let i = 0; i < 999; i++) eng.world.add({ id: `edge-yield-${i}`, type: yieldType, place: { on: 'inside', holder: 'store' } }) })
    assign(eng)
    runTicks(eng)

    expect(eng.world.get('crop')?.place.on).toBe('tile')
    expect(eng.world.get('worker')?.residentWork?.cargoIds).toEqual([])
    expect(eng.world.withProp('residentWorkMap', SANDBOX_MAP).length).toBe(1)
    expect(seedType).not.toBe(yieldType)
  })

  it('opens a real unlocked warehouse through the resident’s ordinary hands action before depositing', () => {
    const eng = farm()
    eng.author(() => eng.world.clearStatus({ e: 'store' }, 'open'))
    assign(eng)
    runTicks(eng)

    expect(eng.world.hasStatus({ e: 'store' }, 'open')).toBe(true)
    expect(eng.world.get('crop')).toBeUndefined()
    expect(eng.world.get('store')?.contents?.length).toBe(2)
    expect(eng.world.get('worker')?.residentWork?.cargoIds).toEqual([])
  })

  it('leaves the crop intact and reports a failed normal take when the crop becomes frozen', () => {
    const eng = farm()
    assign(eng)
    eng.author(() => { eng.world.get('crop')!.frozenBy = 'test' })
    runTicks(eng)

    expect(eng.world.get('crop')?.place.on).toBe('tile')
    expect(eng.world.get('worker')?.residentWork?.cargoIds).toEqual([])
    expect(locale(eng.world.get('worker')?.residentWork?.blockedReason, 'zh')).toContain('预期不同')
  })

  it('records a real partial harvest before pausing for an unexpected output count', () => {
    const base = farm()
    const partialPick: Rule = {
      id: 'test/resident-work-partial-pick',
      host: { type: 'fixture/crop/turnip/ripe' },
      on: 'impulse/taken',
      tree: { do: [
        { op: 'spawn', type: '@prop:host.yieldType', at: 'other', into: 'contents', count: 1 },
        { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host', still: true },
        { op: 'destroy' },
      ] },
    }
    const eng = new FreshEngine(structuredClone(base.world.state), base.world.onto.data, new RuleLibrary([partialPick, ...BASE_RULES, ...STORY_RULES]))
    eng.author(() => eng.world.setProp(eng.world.get('worker')!, 'pick', 2))
    const crop = eng.world.get('crop')!
    const outputTypes = new Set([String(eng.world.prop(crop, 'yieldType')), String(eng.world.prop(crop, 'seedType'))])
    assign(eng)
    runTicks(eng)

    const worker = eng.world.get('worker')!
    const tracked = worker.residentWork?.cargoIds ?? []
    expect(worker.residentWork?.status).toBe('paused')
    expect(locale(worker.residentWork?.blockedReason, 'zh')).toContain('预期不同')
    expect(tracked).toHaveLength(2)
    expect(tracked.every((id) => {
      const item = eng.world.get(id)
      return !!item && outputTypes.has(item.type) && item.place.on === 'inside' && item.place.holder === worker.id
    })).toBe(true)
  })

  it('pauses at night and while the player is away, and reports those states in the read-only order view', () => {
    const eng = farm()
    assign(eng)
    const worker = eng.world.get('worker')!
    eng.world.state.tick = 9_000 // day 1, 21:00
    for (let i = 0; i < 8; i++) eng.tick()
    expect(eng.world.get('crop')?.place.on).toBe('tile')
    expect(worker.residentWork?.blockedReason).toBeUndefined()
    expect(locale(residentWorkOrderView(eng, worker)?.blockedReason, 'zh')).toContain('休息')

    eng.author(() => {
      const home = eng.world.map(SANDBOX_MAP)!
      eng.world.state.maps.other = { ...structuredClone(home), id: 'other', name: 'other', anchors: undefined }
      eng.world.state.loadedMaps.push('other')
      eng.world.place(eng.world.get('actor')!, { on: 'tile', map: 'other', x: 0, y: 0 })
    })
    expect(locale(residentWorkOrderView(eng, worker)?.blockedReason, 'zh')).toContain('离开领地')
    for (let i = 0; i < 8; i++) eng.tick()
    expect(eng.world.get('crop')?.place.on).toBe('tile')
  })

  it('chooses a walkable adjacent plot step even when the nearest orthogonal neighbor is a wall', () => {
    const eng = farm()
    eng.author(() => {
      eng.world.setTerrain(SANDBOX_MAP, 6, 2, 'wall')
      eng.world.place(eng.world.get('worker')!, { on: 'tile', map: SANDBOX_MAP, x: 3, y: 2 })
    })
    assign(eng)
    eng.world.state.tick = 600
    eng.tick()
    const at = eng.world.posOf(eng.world.get('worker')!)!
    expect([at.x, at.y]).not.toEqual([6, 2])
    expect(Math.max(Math.abs(at.x - 5), Math.abs(at.y - 2))).toBeLessThanOrEqual(1)
    expect(eng.world.walkable(SANDBOX_MAP, at.x, at.y, 'worker', true)).toBe(true)
  })

  it('routes around a resident on the direct warehouse path without moving that resident', () => {
    const eng = farm()
    const w = eng.world
    const worker = w.get('worker')!
    const crop = w.get('crop')!
    const steward = w.get('steward')!
    const yieldType = String(w.prop(crop, 'yieldType'))
    const seedType = String(w.prop(crop, 'seedType'))
    eng.author(() => {
      w.place(worker, { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 })
      w.place(steward, { on: 'tile', map: SANDBOX_MAP, x: 4, y: 3 })
      w.place(crop, { on: 'none' })
      worker.residentWork = {
        kind: 'harvest', controller: steward.id, map: SANDBOX_MAP, warehouse: 'store',
        cells: [{ x: 5, y: 2 }], status: 'working', cargoIds: ['tracked-yield', 'tracked-seed'],
      }
      w.setProp(worker, 'residentWorkMap', SANDBOX_MAP)
      w.add({ id: 'tracked-yield', type: yieldType, place: { on: 'inside', holder: worker.id }, props: { owner: 'actor' } })
      w.add({ id: 'tracked-seed', type: seedType, place: { on: 'inside', holder: worker.id }, props: { owner: 'actor' } })
    })
    eng.setCooldown(steward.id, 100_000)
    runTicks(eng)

    expect(w.get('store')?.contents ?? []).toEqual(expect.arrayContaining(['tracked-yield', 'tracked-seed']))
    expect(worker.residentWork?.cargoIds).toEqual([])
    expect(w.posOf(steward)).toMatchObject({ map: SANDBOX_MAP, x: 4, y: 3 })
  })

  it('replans around a resident who occupies the next cached warehouse step', () => {
    const eng = farm()
    const w = eng.world
    const worker = w.get('worker')!
    const crop = w.get('crop')!
    const steward = w.get('steward')!
    const yieldType = String(w.prop(crop, 'yieldType'))
    const seedType = String(w.prop(crop, 'seedType'))
    eng.author(() => {
      w.place(worker, { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 })
      w.place(crop, { on: 'none' })
      worker.residentWork = {
        kind: 'harvest', controller: steward.id, map: SANDBOX_MAP, warehouse: 'store',
        cells: [{ x: 5, y: 2 }], status: 'working', cargoIds: ['moving-yield', 'moving-seed'],
      }
      w.setProp(worker, 'residentWorkMap', SANDBOX_MAP)
      w.add({ id: 'moving-yield', type: yieldType, place: { on: 'inside', holder: worker.id }, props: { owner: 'actor' } })
      w.add({ id: 'moving-seed', type: seedType, place: { on: 'inside', holder: worker.id }, props: { owner: 'actor' } })
    })
    eng.setCooldown(steward.id, 100_000)
    w.state.tick = 600
    eng.tick()
    expect(w.posOf(worker)).toMatchObject({ map: SANDBOX_MAP, x: 4, y: 3 })

    eng.author(() => w.place(steward, { on: 'tile', map: SANDBOX_MAP, x: 5, y: 3 }))
    for (let i = 0; i < 240; i++) eng.tick()

    expect(w.get('store')?.contents ?? []).toEqual(expect.arrayContaining(['moving-yield', 'moving-seed']))
    expect(worker.residentWork?.cargoIds).toEqual([])
    expect(w.posOf(steward)).toMatchObject({ map: SANDBOX_MAP, x: 5, y: 3 })
  })

  it('reports a blocked route after bounded retries without harvesting through surrounding walls', () => {
    const eng = farm()
    eng.author(() => {
      for (const [x, y] of [[4, 2], [6, 2], [5, 1], [5, 3]]) eng.world.setTerrain(SANDBOX_MAP, x, y, 'wall')
    })
    assign(eng)
    runTicks(eng)

    expect(eng.world.get('crop')?.place.on).toBe('tile')
    expect(eng.world.get('worker')?.residentWork?.cargoIds).toEqual([])
    expect(locale(eng.world.get('worker')?.residentWork?.blockedReason, 'en')).toContain('route is blocked')
  })

  it('does not harvest an unselected crop cell and does not reserve an unauthorized warehouse', () => {
    const eng = farm()
    eng.author(() => eng.world.add({ id: 'other-crop', type: 'fixture/crop/carrot/ripe', place: { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 } }))
    assign(eng)
    runTicks(eng)
    expect(eng.world.get('crop')).toBeUndefined()
    expect(eng.world.get('other-crop')?.place.on).toBe('tile')

    const other = farm()
    other.author(() => other.world.setProp(other.world.get('store')!, 'owner', 'someone-else'))
    assign(other)
    expect(other.world.get('worker')?.residentWork).toBeUndefined()
  })

  it('rejects an empty target set, a locked warehouse, and residents with an unsafe eligibility state', () => {
    const empty = farm()
    order(empty, { v: 1, op: 'assign', worker: 'worker', warehouse: 'store', cells: [] })
    expect(empty.world.get('worker')?.residentWork).toBeUndefined()

    const locked = farm()
    locked.author(() => locked.world.addTag(locked.world.get('store')!, 'locked'))
    assign(locked)
    expect(locked.world.get('worker')?.residentWork).toBeUndefined()

    const minor = farm()
    minor.author(() => minor.world.setProp(minor.world.get('worker')!, 'age', 17))
    assign(minor)
    expect(minor.world.get('worker')?.residentWork).toBeUndefined()

    const unknownAge = farm()
    unknownAge.author(() => unknownAge.world.setProp(unknownAge.world.get('worker')!, 'age', undefined))
    assign(unknownAge)
    expect(unknownAge.world.get('worker')?.residentWork).toBeUndefined()

    const protectedAdult = farm()
    protectedAdult.author(() => protectedAdult.world.addTag(protectedAdult.world.get('worker')!, 'minor'))
    assign(protectedAdult)
    expect(protectedAdult.world.get('worker')?.residentWork).toBeUndefined()

    const bound = farm()
    bound.author(() => bound.world.addTag(bound.world.get('worker')!, 'storybound'))
    assign(bound)
    expect(bound.world.get('worker')?.residentWork).toBeUndefined()

    const fakeWarehouse = farm()
    fakeWarehouse.author(() => fakeWarehouse.world.add({ id: 'not-a-container', type: 'fixture/furniture', place: { on: 'tile', map: SANDBOX_MAP, x: 8, y: 4 }, props: { capacity: 8, owner: 'actor' } }))
    order(fakeWarehouse, { v: 1, op: 'assign', worker: 'worker', warehouse: 'not-a-container', cells: [{ x: 5, y: 2 }] })
    expect(fakeWarehouse.world.get('worker')?.residentWork).toBeUndefined()
  })

  it('lets only one worker take a shared ripe target', () => {
    const eng = farm({ multipleResidents: true })
    const crop = eng.world.get('crop')!
    const outputTypes = new Set([String(eng.world.prop(crop, 'yieldType')), String(eng.world.prop(crop, 'seedType'))])
    assign(eng, 'worker')
    order(eng, { v: 1, op: 'assign', worker: 'worker-2', warehouse: 'store', cells: [{ x: 5, y: 2 }] })
    runTicks(eng)

    expect(eng.world.get('crop')).toBeUndefined()
    expect(eng.world.get('worker')?.residentWork?.cargoIds.length ?? 0).toBeLessThanOrEqual(2)
    expect(eng.world.get('worker-2')?.residentWork?.cargoIds.length ?? 0).toBeLessThanOrEqual(2)
    expect(eng.world.get('store')?.contents?.filter((id) => outputTypes.has(eng.world.get(id)?.type ?? '')).length).toBe(2)
  })

  it('keeps order and cargo through state restore and drops only tracked cargo for physical recovery', () => {
    const eng = farm()
    assign(eng)
    // Force one ordinary harvest step, then persist only the serializable state; transient route/permit state is absent.
    eng.world.state.tick = 600
    for (let i = 0; i < 18 && !eng.world.get('worker')?.residentWork?.cargoIds.length; i++) eng.tick()
    const current = eng.world.get('worker')!
    const cargoIds = [...(current.residentWork?.cargoIds ?? [])]
    expect(cargoIds.length).toBeGreaterThan(0)
    const state = structuredClone(eng.world.state)
    const reloaded = new FreshEngine(state, eng.world.onto.data, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const worker = reloaded.world.get('worker')!
    expect(worker.residentWork?.cargoIds).toEqual(cargoIds)
    reloaded.author(() => reloaded.world.add({ id: 'worker-private', type: 'item/tool/hoe', place: { on: 'hand', holder: 'worker' } }))
    order(reloaded, { v: 1, op: 'revoke', worker: 'worker' })
    order(reloaded, { v: 1, op: 'drop', worker: 'worker' })
    expect(worker.residentWork).toBeUndefined()
    expect(cargoIds.every((id) => reloaded.world.get(id)?.place.on === 'tile')).toBe(true)
    expect(reloaded.world.get('worker-private')?.place).toEqual({ on: 'hand', holder: 'worker' })
  })

  it('retires cargo already taken out of the worker without moving it, then allows reassignment', () => {
    const eng = farm()
    eng.author(() => eng.world.add({ id: 'second-crop', type: 'fixture/crop/carrot/ripe', place: { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 } }))
    assign(eng)
    eng.world.state.tick = 600
    for (let i = 0; i < 18 && !eng.world.get('worker')?.residentWork?.cargoIds.length; i++) eng.tick()
    const worker = eng.world.get('worker')!
    const ids = [...worker.residentWork!.cargoIds]
    expect(ids.length).toBeGreaterThan(1)
    eng.author(() => eng.world.place(eng.world.get(ids[0])!, { on: 'inside', holder: 'actor' }))
    order(eng, { v: 1, op: 'revoke', worker: 'worker' })
    expect(worker.residentWork?.status).toBe('recovery')
    expect(worker.residentWork?.cargoIds).toEqual(ids.slice(1))
    order(eng, { v: 1, op: 'drop', worker: 'worker' })
    expect(worker.residentWork).toBeUndefined()
    expect(eng.world.get(ids[0])?.place).toEqual({ on: 'inside', holder: 'actor' })
    expect(eng.world.get(ids[1])?.place.on).toBe('tile')
    order(eng, { v: 1, op: 'assign', worker: 'worker', warehouse: 'store', cells: [{ x: 6, y: 2 }] })
    expect(worker.residentWork?.cells).toEqual([{ x: 6, y: 2 }])
  })

  it('keeps cargo after its warehouse disappears and allows a physical recovery drop', () => {
    const eng = farm()
    assign(eng)
    eng.world.state.tick = 600
    for (let i = 0; i < 18 && !eng.world.get('worker')?.residentWork?.cargoIds.length; i++) eng.tick()
    const worker = eng.world.get('worker')!
    const cargoIds = [...worker.residentWork!.cargoIds]
    expect(cargoIds.length).toBeGreaterThan(0)
    eng.author(() => eng.world.place(eng.world.get('store')!, { on: 'none' }))
    for (let i = 0; i < 12; i++) eng.tick()
    expect(worker.residentWork?.cargoIds).toEqual(cargoIds)
    order(eng, { v: 1, op: 'revoke', worker: 'worker' })
    expect(worker.residentWork?.status).toBe('recovery')
    order(eng, { v: 1, op: 'drop', worker: 'worker' })
    expect(worker.residentWork).toBeUndefined()
    expect(cargoIds.every((id) => eng.world.get(id)?.place.on === 'tile' && eng.world.prop(eng.world.get(id)!, 'owner') === 'actor')).toBe(true)
  })

  it('allows a same-order warehouse change to retain its previously authorized empty cell', () => {
    const eng = farm()
    assign(eng)
    runTicks(eng)
    expect(eng.world.get('crop')).toBeUndefined()

    eng.author(() => {
      eng.world.add({ id: 'crop-next', type: 'fixture/crop/turnip/ripe', place: { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 } })
      eng.world.add({ id: 'store-next', type: 'fixture/container/storehouse', place: { on: 'tile', map: SANDBOX_MAP, x: 8, y: 3 } })
      eng.world.setProp(eng.world.get('store-next')!, 'capacity', 40)
      eng.world.setProp(eng.world.get('store-next')!, 'owner', 'actor')
      eng.world.setStatus({ e: 'store-next' }, 'open', -1)
    })
    order(eng, { v: 1, op: 'assign', worker: 'worker', warehouse: 'store-next', cells: [{ x: 5, y: 2 }, { x: 6, y: 2 }] })

    expect(eng.world.get('worker')?.residentWork).toMatchObject({
      warehouse: 'store-next', cells: [{ x: 5, y: 2 }, { x: 6, y: 2 }], status: 'working',
    })
  })

  it('exposes and drops task cargo through the death rule while keeping private belongings on the body', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => w.add({ id: 'worker-private-tool', type: 'item/tool/hoe', place: { on: 'hand', holder: 'worker' } }))
    assign(eng)
    w.state.tick = 600
    for (let i = 0; i < 60 && !(w.get('worker')?.residentWork?.cargoIds.length); i++) eng.tick()
    const cargoIds = [...(w.get('worker')?.residentWork?.cargoIds ?? [])]
    expect(cargoIds.length).toBeGreaterThan(0)

    eng.queue({
      kind: 'threshold/cross', host: { e: 'worker' }, roles: { actor: { e: 'actor' } },
      params: { name: 'broken', prop: 'hp' }, origin: 'world',
    })
    const remains = w.get('worker')!
    expect(remains.npc).toBeUndefined()
    expect(remains.residentWork?.cargoIds).toEqual(cargoIds)
    expect(residenceView(eng).residence?.recoveries).toContainEqual(expect.objectContaining({
      id: 'worker', status: 'recovery', cargo: expect.arrayContaining([expect.objectContaining({ id: cargoIds[0] })]),
    }))

    order(eng, { v: 1, op: 'drop', worker: 'worker' })
    expect(remains.residentWork).toBeUndefined()
    expect(w.get(cargoIds[0]!)?.place).toMatchObject({ on: 'tile', map: SANDBOX_MAP })
    expect(w.get(cargoIds[0]!)?.props?.owner).toBe('actor')
    expect(w.get('worker-private-tool')?.place).toEqual({ on: 'inside', holder: 'worker' })
  })

  it('suppresses only the authorized crop/seed takes, while a later ordinary player-owned take remains theft', () => {
    const eng = farm()
    assign(eng)
    runTicks(eng)
    const worker = eng.world.get('worker')!
    expect(worker.npc?.memory?.deeds?.filter((d) => d.deed === 'theft') ?? []).toEqual([])
    const karmaBefore = eng.world.num(worker, 'karma')
    eng.author(() => eng.world.add({ id: 'unassigned-property', type: 'item/material/iron_ore', place: { on: 'tile', map: SANDBOX_MAP, x: 4, y: 3 }, props: { owner: 'actor' } }))
    eng.author(() => eng.world.place(worker, { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 }))
    const stolen = eng.act('take', worker.id, { e: 'unassigned-property' }, { instrument: null, params: { into: 'contents' } })
    expect(stolen.defined).toBe(true)
    expect(eng.world.get('unassigned-property')?.place).toEqual({ on: 'inside', holder: 'worker' })
    // The actor's own `seen` event changes karma; its own deed is not stored in its eyewitness ledger.
    expect(eng.world.num(worker, 'karma')).toBeLessThan(karmaBefore)
  })
})
