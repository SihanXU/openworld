import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, snapshot, tickAt, type Engine as EngineType } from '@openworld/engine'
import { BASE_RULES, RECIPE_BY_ID, STORY_RULES, buildOntology } from '../src/index.ts'

function farm({ twoWorkers = false }: { twoWorkers?: boolean } = {}): EngineType {
  const ontology = buildOntology()
  const residence = ontology.social!.residence!
  ontology.social!.residence = {
    ...residence,
    map: SANDBOX_MAP,
    work: {
      ...residence.work!,
      controller: { type: 'actor/person/steward', tags: ['haven-steward'] },
    },
    slots: [{ anchor: 'home.camp' }, ...(twoWorkers ? [{ anchor: 'home.bunk' }] : [])],
  }
  const eng = buildSandbox({
    terrain: Array.from({ length: 8 }, () => Array(10).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
      { key: 'cow', type: 'actor/creature/animal/cow', x: 5, y: 2, props: { owner: 'actor' } },
      { key: 'store', type: 'fixture/container/storehouse', x: 7, y: 3 },
      { key: 'stall', type: 'fixture/furniture/stall/trade', x: 0, y: 1 },
    ],
    event: {},
  }, ontology, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const w = eng.world
  w.state.maps[SANDBOX_MAP]!.anchors = { 'home.camp': [2, 3], ...(twoWorkers ? { 'home.bunk': [3, 4] as [number, number] } : {}) }
  eng.author(() => {
    w.add({ id: 'steward', type: 'actor/person/steward', tags: ['haven-steward'], place: { on: 'tile', map: SANDBOX_MAP, x: 1, y: 0 }, npc: { role: 'steward', schedule: [] } })
    w.add({ id: 'worker', type: 'actor/person/herbalist', props: { age: 24 }, place: { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 }, npc: { role: 'resident', schedule: [], resident: { map: SANDBOX_MAP, slot: 'home.camp', schedule: [] } } })
    if (twoWorkers) w.add({ id: 'worker-2', type: 'actor/person/herbalist', props: { age: 24 }, place: { on: 'tile', map: SANDBOX_MAP, x: 4, y: 4 }, npc: { role: 'resident', schedule: [], resident: { map: SANDBOX_MAP, slot: 'home.bunk', schedule: [] } } })
    w.setProp(w.get('store')!, 'capacity', 40)
    w.setProp(w.get('store')!, 'owner', 'actor')
    w.setStatus({ e: 'store' }, 'open', -1)
    w.add({ id: 'feed', type: 'item/material/feed', place: { on: 'inside', holder: 'store' } })
  })
  return eng
}

function assignFeed(eng: EngineType, animalIds = ['cow'], worker = 'worker', warehouse = 'store'): void {
  eng.act('hands', 'actor', { e: 'steward' }, {
    instrument: null,
    params: { say: 'resident-work', choice: JSON.stringify({ v: 1, op: 'assign', kind: 'feed', worker, warehouse, animalIds }) },
  })
}

function workCommand(eng: EngineType, op: 'pause' | 'resume' | 'revoke' | 'drop', worker = 'worker'): void {
  eng.act('hands', 'actor', { e: 'steward' }, {
    instrument: null,
    params: { say: 'resident-work', choice: JSON.stringify({ v: 1, op, worker }) },
  })
}

function until(eng: EngineType, predicate: () => boolean, maxTicks = 1200): boolean {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true
    eng.tick()
  }
  return predicate()
}

function inside(eng: EngineType, id: string, holder: string): boolean {
  const place = eng.world.get(id)?.place
  return place?.on === 'inside' && place.holder === holder
}

function runDay(eng: EngineType, ticks = 360): void {
  eng.world.state.tick = 600
  for (let i = 0; i < ticks; i++) eng.tick()
}

describe('resident feeding work', () => {
  it('accepts a bounded feed order for explicitly selected owned animals', () => {
    const eng = farm()

    assignFeed(eng)

    expect(eng.world.get('worker')?.residentWork).toMatchObject({
      kind: 'feed', controller: 'steward', map: SANDBOX_MAP, warehouse: 'store',
      animalIds: ['cow'], status: 'working', cargoIds: [],
    })
  })

  it('buys a real calf crate, preserves buyer ownership when released, and accepts that animal for a feed order', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => { for (let i = 0; i < 120; i++) w.create('item/misc/thornmark', { on: 'inside', holder: 'actor' }) })
    eng.controls.sync()

    expect(eng.controls.craft(RECIPE_BY_ID['shop/buy/misc-crate_calf']!)).toBe(true)
    const crate = [...(w.get('actor')!.contents ?? []), w.get('actor')!.held].map((id) => w.get(id)).find((item) => item?.type === 'item/misc/crate_calf')!
    expect(crate).toBeDefined()
    const released = eng.act('put', 'actor', w.cellRef(SANDBOX_MAP, 1, 1), { instrument: { e: crate.id } })
    expect(released.rule?.id).toBe('home/crate')
    const calf = w.entitiesOnMap(SANDBOX_MAP).find((item) => item.type === 'actor/creature/animal/calf')!
    expect(eng.society.ownerOf(calf)).toBe('actor')

    eng.author(() => w.setStatus({ e: calf.id }, 'stage', w.state.tick))
    eng.tick()
    expect(w.get(calf.id)?.type).toBe('actor/creature/animal/cow')
    expect(eng.society.ownerOf(w.get(calf.id)!)).toBe('actor')

    assignFeed(eng, [calf.id])
    expect(w.get('worker')?.residentWork).toMatchObject({ kind: 'feed', animalIds: [calf.id] })
  })

  it('takes one warehouse feed, feeds only its authorized animal, and preserves the worker’s private held tool', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.add({ id: 'other-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 5, y: 3 }, props: { owner: 'actor' } })
      w.add({ id: 'private-tool', type: 'item/tool/hoe', place: { on: 'hand', holder: 'worker' } })
      w.addTag(w.get('worker')!, 'skill:stockman')
      w.add({ id: 'feed-2', type: 'item/material/feed', place: { on: 'inside', holder: 'store' } })
    })
    const held = w.get('worker')!.held
    assignFeed(eng)

    runDay(eng)

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(true)
    expect(w.hasStatus({ e: 'other-cow' }, 'fed')).toBe(false)
    expect(w.get('feed')).toBeUndefined()
    expect(w.get('feed-2')?.place).toEqual({ on: 'inside', holder: 'store' })
    expect(w.get('worker')?.held).toBe(held)
    expect(w.get('private-tool')?.place).toEqual({ on: 'hand', holder: 'worker' })
    expect(w.get('worker')?.residentWork).toMatchObject({ kind: 'feed', animalIds: ['cow'], cargoIds: [], pendingAnimalId: undefined })
  })

  it('does not borrow a private held feed when the selected warehouse has no feed', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.place(w.get('feed')!, { on: 'none' })
      w.add({ id: 'private-feed', type: 'item/material/feed', place: { on: 'hand', holder: 'worker' } })
    })
    const held = w.get('worker')!.held
    assignFeed(eng)

    runDay(eng, 80)

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(false)
    expect(w.get('worker')?.held).toBe(held)
    expect(w.get('private-feed')?.place).toEqual({ on: 'hand', holder: 'worker' })
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
  })

  it('resumes with a stale pending animal and returns the same feed entity to its warehouse', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)

    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)
    expect(w.get('worker')?.residentWork).toMatchObject({ kind: 'feed', pendingAnimalId: 'cow', cargoIds: ['feed'] })

    workCommand(eng, 'pause')
    expect(w.get('worker')?.residentWork?.status).toBe('paused')
    w.author(() => w.destroy(w.get('cow')!))

    workCommand(eng, 'resume')

    expect(w.get('worker')?.residentWork?.status).toBe('working')
    expect(until(eng, () => inside(eng, 'feed', 'store'))).toBe(true)
    expect(w.get('feed')?.id).toBe('feed')
    expect(w.get('worker')?.residentWork).toMatchObject({ kind: 'feed', animalIds: ['cow'], cargoIds: [], pendingAnimalId: undefined })
  })

  it('keeps the normal Stockman area-feed radius for a manual use', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.place(w.get('cow')!, { on: 'tile', map: SANDBOX_MAP, x: 1, y: 0 })
      w.add({ id: 'near-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 2, y: 0 }, props: { owner: 'actor' } })
      w.add({ id: 'far-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 3, y: 0 }, props: { owner: 'actor' } })
      w.addTag(w.get('actor')!, 'skill:stockman')
      w.add({ id: 'manual-feed', type: 'item/material/feed', place: { on: 'hand', holder: 'actor' } })
    })

    eng.act('use', 'actor', { e: 'cow' }, { instrument: { e: 'manual-feed' } })

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(true)
    expect(w.hasStatus({ e: 'near-cow' }, 'fed')).toBe(true)
    expect(w.hasStatus({ e: 'far-cow' }, 'fed')).toBe(false)
  })

  it('does not let bare client parameters suppress a Stockman’s normal area feed', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.place(w.get('cow')!, { on: 'tile', map: SANDBOX_MAP, x: 1, y: 0 })
      w.place(w.get('worker')!, { on: 'tile', map: SANDBOX_MAP, x: 1, y: 1 })
      w.add({ id: 'near-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 2, y: 1 }, props: { owner: 'actor' } })
      w.addTag(w.get('worker')!, 'skill:stockman')
      w.add({ id: 'private-feed', type: 'item/material/feed', place: { on: 'hand', holder: 'worker' } })
    })
    assignFeed(eng)

    eng.act('use', 'worker', { e: 'cow' }, {
      instrument: { e: 'private-feed' },
      params: { residentWorkFeed: 'actor', order: 'authorized' },
    })

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(true)
    expect(w.hasStatus({ e: 'near-cow' }, 'fed')).toBe(true)
  })

  it('keeps already-fed animals authorized without spending feed until they need it again', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => { w.setStatus({ e: 'cow' }, 'fed', 10000) })
    assignFeed(eng)

    expect(w.get('worker')?.residentWork).toMatchObject({ kind: 'feed', animalIds: ['cow'] })
    runDay(eng, 100)

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(true)
    expect(w.get('feed')?.place).toEqual({ on: 'inside', holder: 'store' })
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
  })

  it('rejects unowned and other-owned animals, and never takes other-owned feed from a family warehouse', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.add({ id: 'wild-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 } })
      w.add({ id: 'rival-cow', type: 'actor/creature/animal/cow', place: { on: 'tile', map: SANDBOX_MAP, x: 6, y: 3 }, props: { owner: 'rival' } })
      w.place(w.get('feed')!, { on: 'none' })
      w.add({ id: 'rival-feed', type: 'item/material/feed', place: { on: 'inside', holder: 'store' }, props: { owner: 'rival' } })
    })

    assignFeed(eng, ['wild-cow'])
    expect(w.get('worker')?.residentWork).toBeUndefined()
    assignFeed(eng, ['rival-cow'])
    expect(w.get('worker')?.residentWork).toBeUndefined()
    assignFeed(eng)
    runDay(eng, 100)

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(false)
    expect(w.get('rival-feed')?.place).toEqual({ on: 'inside', holder: 'store' })
    expect(w.get('rival-feed')?.props?.owner).toBe('rival')
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
  })

  it('does not consume two feeds when two workers race for one animal', () => {
    const eng = farm({ twoWorkers: true })
    const w = eng.world
    eng.author(() => { w.add({ id: 'feed-2', type: 'item/material/feed', place: { on: 'inside', holder: 'store' } }) })
    assignFeed(eng, ['cow'], 'worker')
    assignFeed(eng, ['cow'], 'worker-2')

    runDay(eng, 800)

    expect(w.hasStatus({ e: 'cow' }, 'fed')).toBe(true)
    expect(['feed', 'feed-2'].filter((id) => inside(eng, id, 'store'))).toHaveLength(1)
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
    expect(w.get('worker-2')?.residentWork?.cargoIds).toEqual([])
  })

  it('returns its exact pending feed if the player feeds the animal first', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)
    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)
    workCommand(eng, 'pause')
    eng.author(() => {
      w.place(w.player, { on: 'tile', map: SANDBOX_MAP, x: 4, y: 2 })
      w.add({ id: 'player-feed', type: 'item/material/feed', place: { on: 'hand', holder: 'actor' } })
    })

    eng.act('use', 'actor', { e: 'cow' }, { instrument: { e: 'player-feed' } })
    eng.author(() => w.place(w.player, { on: 'tile', map: SANDBOX_MAP, x: 0, y: 0 }))
    workCommand(eng, 'resume')

    expect(until(eng, () => inside(eng, 'feed', 'store'))).toBe(true)
    expect(w.get('feed')?.id).toBe('feed')
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual([])
  })

  it('keeps in-flight feed stationary at night and while the player is away from the residence', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)
    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)
    const workerPos = structuredClone(w.posOf(w.get('worker')!))
    const feedPlace = structuredClone(w.get('feed')?.place)

    w.state.tick = tickAt(1, 21)
    for (let i = 0; i < 30; i++) eng.tick()
    expect(w.get('feed')?.place).toEqual(feedPlace)
    expect(w.get('worker')?.residentWork).toMatchObject({ cargoIds: ['feed'], pendingAnimalId: 'cow' })
    expect(w.posOf(w.get('worker')!)).toEqual(workerPos)

    w.author(() => w.place(w.player, { on: 'tile', map: 'elsewhere', x: 0, y: 0 }))
    for (let i = 0; i < 30; i++) eng.tick()
    expect(w.get('feed')?.place).toEqual(feedPlace)
    expect(w.get('worker')?.residentWork).toMatchObject({ cargoIds: ['feed'], pendingAnimalId: 'cow' })
    expect(w.posOf(w.get('worker')!)).toEqual(workerPos)

    w.author(() => w.place(w.player, { on: 'tile', map: SANDBOX_MAP, x: 0, y: 0 }))
    w.state.tick = tickAt(2, 7)
    expect(until(eng, () => w.hasStatus({ e: 'cow' }, 'fed'))).toBe(true)
    expect(w.get('feed')).toBeUndefined()
  })

  it('leaves feed tracked when the selected warehouse locks, then returns the same item after it opens', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)
    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)
    workCommand(eng, 'pause')
    w.author(() => {
      w.destroy(w.get('cow')!)
      w.addTag(w.get('store')!, 'locked')
    })

    workCommand(eng, 'resume')
    runDay(eng, 40)

    expect(w.get('feed')?.place).toMatchObject({ on: 'inside', holder: 'worker' })
    expect(w.get('worker')?.residentWork).toMatchObject({ status: 'paused', cargoIds: ['feed'], pendingAnimalId: 'cow' })

    w.author(() => w.removeTag(w.get('store')!, 'locked'))
    workCommand(eng, 'resume')
    expect(until(eng, () => inside(eng, 'feed', 'store'))).toBe(true)
    expect(w.get('feed')?.id).toBe('feed')
  })

  it('keeps a returned feed tracked when the warehouse is full, then drops it in place on recovery', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)
    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)
    workCommand(eng, 'pause')
    w.author(() => {
      w.destroy(w.get('cow')!)
      w.setProp(w.get('store')!, 'capacity', 1)
      w.add({ id: 'store-filler', type: 'item/material/wood', place: { on: 'inside', holder: 'store' } })
    })
    workCommand(eng, 'resume')
    expect(until(eng, () => !!w.get('worker')?.residentWork?.blockedReason)).toBe(true)

    const workerPos = w.posOf(w.get('worker')!)!
    expect(w.get('feed')?.place).toMatchObject({ on: 'inside', holder: 'worker' })
    expect(w.get('worker')?.residentWork).toMatchObject({ cargoIds: ['feed'], pendingAnimalId: 'cow' })
    workCommand(eng, 'revoke')
    expect(w.get('worker')?.residentWork?.status).toBe('recovery')
    workCommand(eng, 'drop')

    expect(w.get('worker')?.residentWork).toBeUndefined()
    expect(w.get('feed')?.place).toMatchObject({ on: 'tile', map: SANDBOX_MAP, x: workerPos.x, y: workerPos.y })
    expect(w.get('store-filler')?.place).toEqual({ on: 'inside', holder: 'store' })
  })

  it('shows a displaced resident carrying task cargo as recoverable and drops it only when they are back on the residence ground', () => {
    const eng = farm()
    const w = eng.world
    assignFeed(eng)
    expect(until(eng, () => w.get('worker')?.residentWork?.cargoIds.includes('feed') === true)).toBe(true)

    w.author(() => w.place(w.get('worker')!, { on: 'tile', map: 'elsewhere', x: 2, y: 2 }))
    const away = snapshot(eng).residence
    expect(away?.residents.find((resident) => resident.id === 'worker')?.order?.blockedReason).toMatchObject({ en: expect.stringContaining('cargo'), zh: expect.stringContaining('物资') })

    workCommand(eng, 'drop')
    expect(w.get('feed')?.place).toMatchObject({ on: 'inside', holder: 'worker' })
    expect(w.get('worker')?.residentWork?.cargoIds).toEqual(['feed'])

    w.author(() => {
      const npc = w.get('worker')!.npc!
      delete npc.resident
      w.place(w.get('worker')!, { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 })
    })
    const displaced = snapshot(eng).residence?.recoveries?.find((recovery) => recovery.id === 'worker')
    expect(displaced).toMatchObject({ status: 'recovery', cargo: [{ id: 'feed' }], x: 3, y: 3, blockedReason: { en: expect.stringContaining('current location'), zh: expect.stringContaining('当前位置') } })

    workCommand(eng, 'drop')
    expect(w.get('worker')?.residentWork).toBeUndefined()
    expect(w.get('feed')?.place).toMatchObject({ on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 })
  })

  it('preserves the native hen egg and breeding chain for a job, with owned offspring inheriting ownership', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.create('actor/creature/animal/chicken', { on: 'tile', map: SANDBOX_MAP, x: 5, y: 2 }, { id: 'hen', props: { owner: 'actor' } })
      w.create('actor/creature/animal/chicken', { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 }, { id: 'mate', props: { owner: 'actor' } })
      w.setStatus({ e: 'mate' }, 'fed', 10000)
      w.addTag(w.get('worker')!, 'skill:egg-collector')
      w.setProp(w.get('worker')!, 'feedEggs', 1)
    })
    expect(w.view({ e: 'mate' })?.props.babyType).toBe('actor/creature/animal/chick')
    assignFeed(eng, ['hen'])

    const spawned = until(eng, () => w.entitiesOnMap(SANDBOX_MAP).some((e) => e.type === 'actor/creature/animal/chick'))
    expect(spawned, 'the native breeding rule should produce an owned chick after feeding the authorized hen').toBe(true)

    const chicks = w.entitiesOnMap(SANDBOX_MAP).filter((e) => e.type === 'actor/creature/animal/chick')
    expect(w.hasStatus({ e: 'hen' }, 'fed')).toBe(true)
    expect(w.entitiesOnMap(SANDBOX_MAP).some((e) => e.type === 'item/food/egg/raw')).toBe(true)
    expect(chicks).toHaveLength(1)
    expect(eng.society.ownerOf(chicks[0]!)).toBe('actor')
    expect(w.get('worker')?.residentWork).toMatchObject({ animalIds: ['hen'] })
  })

  it('does not assign ownership to offspring of unowned wild parents', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => {
      w.create('actor/creature/animal/cow', { on: 'tile', map: SANDBOX_MAP, x: 5, y: 2 }, { id: 'wild-cow' })
      w.create('actor/creature/animal/cow', { on: 'tile', map: SANDBOX_MAP, x: 6, y: 2 }, { id: 'wild-mate' })
      w.setStatus({ e: 'wild-mate' }, 'fed', 10000)
      w.place(w.player, { on: 'tile', map: SANDBOX_MAP, x: 4, y: 2 })
      w.add({ id: 'wild-feed', type: 'item/material/feed', place: { on: 'hand', holder: 'actor' } })
    })

    eng.act('use', 'actor', { e: 'wild-cow' }, { instrument: { e: 'wild-feed' } })

    const calf = w.entitiesOnMap(SANDBOX_MAP).find((e) => e.type === 'actor/creature/animal/calf')
    expect(calf).toBeDefined()
    expect(eng.society.ownerOf(calf!)).toBeUndefined()
  })

  it('leaves a spawn unowned when ownerFrom names an event role that is absent', () => {
    const eng = farm()
    const w = eng.world
    eng.author(() => eng.effects.run(
      [{ op: 'spawn', type: 'actor/creature/animal/chick', at: 'host', ownerFrom: 'source' }],
      { kind: 'impulse/notify', host: { e: 'actor' }, roles: {}, by: 'test/missing-owner-source' },
      'test/missing-owner-source',
    ))
    const chick = w.entitiesOnMap(SANDBOX_MAP).find((entity) => entity.type === 'actor/creature/animal/chick')
    expect(chick).toBeDefined()
    expect(eng.society.ownerOf(chick!)).toBeUndefined()
  })
})
