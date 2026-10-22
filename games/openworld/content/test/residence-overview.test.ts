import { describe, expect, it } from 'vitest'
import { BASE_RULES, buildOntology } from '../src/index.ts'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, snapshot } from '@openworld/engine'

function haven({ residenceMap = SANDBOX_MAP, includeWork = true, unlockLodge = true }: { residenceMap?: string; includeWork?: boolean; unlockLodge?: boolean } = {}) {
  const ontology = buildOntology()
  const residence = ontology.social!.residence!
  const configuredResidence = { ...residence, map: residenceMap, slots: [
    { anchor: 'home.camp' },
    { anchor: 'home.lodge1.a', when: 'haven.build.lodge1' },
  ] }
  if (!includeWork) delete configuredResidence.work
  ontology.social!.residence = configuredResidence
  const rows = Array.from({ length: 12 }, () => Array(12).fill('grass'))
  const eng = buildSandbox({
    terrain: rows,
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 0, y: 0 },
      { key: 'ripe-turnip', type: 'fixture/crop/turnip/ripe', x: 10, y: 10 },
      { key: 'ripe-wheat', type: 'fixture/crop/wheat/ripe', x: 9, y: 10 },
      { key: 'growing-dry', type: 'fixture/crop/turnip/young', x: 8, y: 10 },
      { key: 'growing-watered', type: 'fixture/crop/turnip/young', x: 7, y: 10, statuses: ['watered'] },
      { key: 'cow-ready', type: 'actor/creature/animal/cow', x: 10, y: 9, statuses: ['fed'] },
      { key: 'cow-milked', type: 'actor/creature/animal/cow', x: 9, y: 9, statuses: ['fed', 'milked'] },
      { key: 'calf', type: 'actor/creature/animal/calf', x: 8, y: 9, statuses: ['fed'] },
      { key: 'cow-unfed', type: 'actor/creature/animal/cow', x: 7, y: 9 },
      { key: 'ground-egg', type: 'item/food/egg/raw', x: 10, y: 8 },
      { key: 'boiled-egg', type: 'item/food/egg/boiled', x: 9, y: 8 },
      { key: 'storehouse', type: 'fixture/container/storehouse', x: 11, y: 10 },
      { key: 'unbuilt-plot', type: 'fixture/build/plot', x: 11, y: 11 },
    ],
    event: {},
  }, ontology, new RuleLibrary(BASE_RULES))

  const w = eng.world
  w.state.maps[SANDBOX_MAP]!.anchors = { 'home.camp': [1, 1], 'home.lodge1.a': [2, 1] }
  eng.author(() => {
    if (unlockLodge) w.setFact('haven.build.lodge1', true)
    w.add({
      id: 'resident',
      type: 'actor/person/herbalist',
      place: { on: 'tile', map: SANDBOX_MAP, x: 1, y: 2 },
      npc: { role: 'resident', schedule: [], resident: { map: SANDBOX_MAP, slot: 'home.camp', schedule: [] } },
    })
    w.create('item/food/egg/raw', { on: 'inside', holder: 'storehouse' })
    w.create('fixture/crop/turnip/ripe', { on: 'inside', holder: 'storehouse' })
    w.create('actor/creature/animal/cow', { on: 'inside', holder: 'storehouse' }, { statuses: { fed: -1 } })
    for (let i = 0; i < 1000; i++) w.create('item/material/feed', { on: 'inside', holder: 'storehouse' })
  })
  return eng
}

describe('the residence work overview', () => {
  it('counts the whole active map from real entity state and reports real storage slots', () => {
    const eng = haven()
    const frame = snapshot(eng, { view: { map: SANDBOX_MAP, x: 0, y: 0, w: 1, h: 1 } })
    const view = frame.residence

    expect(view).toBeDefined()
    expect(view).toMatchObject({ active: true, onMap: true, beds: { total: 2, occupied: 1, empty: 1 }, residents: [{ id: 'resident' }] })
    expect(frame.entities.some((e) => e.id === 'ripe-turnip')).toBe(false)
    expect(view!.work?.crops).toMatchObject({ total: 4, ripe: 2, needsWater: 1 })
    expect(view!.work?.livestock).toMatchObject({ total: 4, unfed: 1, milkable: 1 })
    expect(view!.work?.groundEggs).toBe(1)
    expect(view!.work?.warehouses).toEqual([
      expect.objectContaining({
        id: 'storehouse',
        capacity: 40,
        usedSlots: 5,
        contents: expect.arrayContaining([
          expect.objectContaining({ type: 'item/material/feed', count: 1000 }),
          expect.objectContaining({ type: 'item/food/egg/raw', count: 1 }),
          expect.objectContaining({ type: 'fixture/crop/turnip/ripe', count: 1 }),
          expect.objectContaining({ type: 'actor/creature/animal/cow', count: 1 }),
        ]),
      }),
    ])
  })

  it('marks the residence inactive off-map and omits live work counts instead of showing zeros', () => {
    const frame = snapshot(haven({ residenceMap: 'haven' }))
    expect(frame.residence).toMatchObject({ active: false, onMap: false })
    expect(frame.residence?.work).toBeUndefined()
  })

  it('keeps configured beds but omits live work for older residence definitions and locked anchors', () => {
    const frame = snapshot(haven({ includeWork: false, unlockLodge: false }))
    expect(frame.residence).toMatchObject({ active: true, onMap: true, beds: { total: 1, occupied: 1, empty: 0 } })
    expect(frame.residence?.work).toBeUndefined()
  })

  it('omits residence data entirely when a game has no residence configured', () => {
    const ontology = buildOntology()
    delete ontology.social!.residence
    const eng = buildSandbox({ terrain: Array.from({ length: 4 }, () => Array(4).fill('grass')), entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0 }], event: {} }, ontology, new RuleLibrary(BASE_RULES))
    expect(snapshot(eng).residence).toBeUndefined()
  })
})
