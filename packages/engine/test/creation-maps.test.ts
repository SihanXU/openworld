import { describe, expect, it } from 'vitest'
import {
  Game, RuleLibrary, adoptCreationMap, creationMapChunk, creationMaps, decodeRawChunk, restoreCreationMaps, trialCreationMap,
  withCreationConnections, disableCreationMap,
  type CreationMapDraft, type CreationMapRecord, type Dir, type Engine, type Ontology, type RawChunk, type WorldIndex,
} from '../src/index.ts'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'

const CHAR = { '.': 'grass', '#': 'wall' }
const HERB = 'item/material/test_herb'
const copy = <T>(v: T): T => structuredClone(v)
const ontology = (): Ontology => ({
  ...copy(STDLIB_ONTOLOGY as Ontology),
  types: {
    ...copy(STDLIB_ONTOLOGY.types!),
    'item/material': { id: 'item/material' },
    [HERB]: { id: HERB, name: 'A gathered herb', props: { value: 1 } },
  },
  terrains: {
    ...copy(STDLIB_ONTOLOGY.terrains!),
    grass: { id: 'grass', name: 'Grass', tags: ['ground'], color: '#74835a' },
    wall: { id: 'wall', name: 'Wall', tags: ['solid'], solid: true, color: '#766955' },
  },
})
const HOME: RawChunk = {
  map: { id: 'workshop', name: 'Workshop', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] },
  entities: [],
}
function fixture() {
  const onto = ontology()
  const index: WorldIndex = {
    name: 'A small creation test', version: 'map-tests-v1', seed: 9,
    start: { map: 'workshop', x: 3, y: 3 },
    maps: [{ id: 'workshop', name: 'Workshop', kind: 'workshop', width: 7, height: 7, portals: [], npcs: 0, items: 0 }],
    npcs: [], player: { id: 'player', type: 'actor/person/player', place: { on: 'none' } },
    stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 1, fixtures: 0 },
  }
  const game = Game.create(index, onto, new RuleLibrary(copy(STDLIB_RULES)))
  game.loadChunk(decodeRawChunk(copy(HOME), CHAR))
  return { game, eng: game.engine, onto, index }
}
const draft = (revision = 1): CreationMapDraft => ({
  id: 'herb-garden', revision,
  raw: {
    map: { id: 'model-chosen-id', name: { en: 'Herb garden', zh: '小药圃' }, kind: 'wild', width: 7, height: 7, rows: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], portals: [] },
    entities: [{ id: 'model-chosen-object-id', type: HERB, place: { on: 'tile', map: 'model-chosen-id', x: 1, y: 2 } }],
  },
})
const stateOf = (eng: Engine) => JSON.parse(JSON.stringify({ state: eng.world.state, library: eng.lib.toJSON(), recipes: [...eng.recipes], graph: eng.graph, maps: eng.maps }))
const pos = (eng: Engine) => eng.world.posOf(eng.world.player)!
function step(eng: Engine, dir: Dir) {
  for (let n = 0; n < 8 && !eng.ready(eng.world.player.id); n++) eng.tick()
  expect(eng.movePlayer(dir), 'A normal player step ' + dir).toBe(true)
}
function enter(eng: Engine, record: CreationMapRecord) {
  expect(pos(eng)).toMatchObject(record.source)
  step(eng, 'down')
  step(eng, 'up')
  expect(pos(eng)).toMatchObject({ map: record.raw.map.id, x: record.entry[0], y: record.entry[1] })
}
function leave(eng: Engine, record: CreationMapRecord) {
  expect(record.gate).toEqual([record.entry[0] + 1, record.entry[1]])
  step(eng, 'right')
  expect(pos(eng)).toMatchObject(record.source)
}

describe('save-local creation maps', () => {
  it('tests a valid AI-shaped raw map on an isolated fork, with no world or library changes', () => {
    const { eng } = fixture()
    const before = stateOf(eng)
    const report = trialCreationMap(eng, draft(), CHAR)
    expect(report.ok, report.errors.join('; ')).toBe(true)
    expect(report.checks.find(c => c.id === 'navigation')?.ok).toBe(true)
    expect(report.entry).toEqual([1, 1])
    expect(report.gate).toEqual([2, 1])
    expect(stateOf(eng)).toEqual(before)
    expect(creationMaps(eng)).toEqual([])
    const adopted = adoptCreationMap(eng, draft(), report, CHAR)
    expect(adopted.raw.map.zone).toBe('peaceful')
  })

  it('requires the exact successful report and permits skipped newer revisions but refuses stale revisions', () => {
    const { eng } = fixture()
    const first = draft()
    const report = trialCreationMap(eng, first, CHAR)
    const changed = copy(first)
    changed.raw.map.name = 'A changed garden'
    const before = stateOf(eng)
    expect(() => adoptCreationMap(eng, changed, report, CHAR)).toThrow(/Test this map revision/)
    expect(() => adoptCreationMap(eng, first, { ...report, ok: false }, CHAR)).toThrow(/Test this map revision/)
    expect(() => adoptCreationMap(eng, draft(2), report, CHAR)).toThrow(/Test this map revision/)
    expect(stateOf(eng)).toEqual(before)
    adoptCreationMap(eng, first, report, CHAR)
    const newer = draft(4)
    adoptCreationMap(eng, newer, trialCreationMap(eng, newer, CHAR), CHAR)
    expect(creationMaps(eng).map(r => r.revision)).toEqual([1, 4])
    const after = stateOf(eng)
    for (const revision of [1, 3, 4]) {
      const stale = draft(revision)
      expect(() => adoptCreationMap(eng, stale, trialCreationMap(eng, stale, CHAR), CHAR)).toThrow(/stale/)
      expect(stateOf(eng)).toEqual(after)
    }
  })

  it.each([
    ['unknown object', (d: CreationMapDraft) => { d.raw.entities[0].type = 'item/material/missing' }, /Unknown or unsupported/],
    ['unknown terrain character', (d: CreationMapDraft) => { d.raw.map.rows[1] = '#..x..#' }, /known terrain/],
    ['blocked entry and return', (d: CreationMapDraft) => { d.raw.map.rows = Array(7).fill('#######') }, /walkable entry/],
    ['unreachable object', (d: CreationMapDraft) => {
      d.raw.map.rows = ['#######', '#..####', '#######', '###.###', '#######', '#######', '#######']
      d.raw.entities[0].place = { on: 'tile', map: 'model-chosen-id', x: 3, y: 3 }
    }, /cannot be reached/],
  ] as const)('refuses %s while preserving the live state and definitions', (_name, change, problem) => {
    const { eng } = fixture()
    const d = draft()
    change(d)
    const before = stateOf(eng)
    const report = trialCreationMap(eng, d, CHAR)
    expect(report.ok).toBe(false)
    expect(report.errors.join('; ')).toMatch(problem)
    expect(stateOf(eng)).toEqual(before)
    expect(() => adoptCreationMap(eng, d, report, CHAR)).toThrow()
    expect(stateOf(eng)).toEqual(before)
  })

  it('physically enters and returns through string-target portals, including after whole save/load and chunk reloading', () => {
    const { game, eng, onto, index } = fixture()
    const d = draft()
    const record = adoptCreationMap(eng, d, trialCreationMap(eng, d, CHAR), CHAR)
    expect(record.raw.map.id).toBe('creation.herb_garden.r1')
    expect(record.raw.map.portals[0]).toMatchObject({ to: 'workshop', x: record.gate[0], y: record.gate[1], tx: 3, ty: 3 })
    expect(eng.world.state.maps.workshop.portals[0]).toMatchObject({ to: record.raw.map.id, x: 3, y: 3, tx: 1, ty: 1 })
    enter(eng, record)
    const herbId = record.raw.entities[0].id
    const take = eng.controls.plan('hands', { x: 1, y: 2, stack: [{ e: herbId }] })
    expect(take?.rule).toBe('core/take')
    eng.controls.run(take!)
    expect(eng.world.get(herbId)?.place).toMatchObject({ holder: 'player' })
    expect(eng.world.entitiesOnMap(record.raw.map.id).filter(e => e.type === HERB)).toHaveLength(0)
    leave(eng, record)
    enter(eng, record)

    const save = JSON.parse(JSON.stringify(game.save({ whole: true })))
    expect(save.state.maps).toEqual({})
    const loaded = Game.load(save, index, onto)
    // Authored terrain is fetched separately; then save-local source links and custom chunks are restored.
    loaded.loadChunk(decodeRawChunk(copy(HOME), CHAR))
    expect(restoreCreationMaps(loaded.engine, CHAR)).toEqual([])
    const chunk = creationMapChunk(loaded.engine, record.raw.map.id, CHAR)
    expect(chunk).toBeDefined()
    loaded.loadChunk(chunk!)
    loaded.loadChunk(creationMapChunk(loaded.engine, record.raw.map.id, CHAR)!)
    const back = loaded.engine
    expect(pos(back)).toMatchObject({ map: record.raw.map.id, x: 1, y: 1 })
    expect(back.world.get(herbId)?.place).toMatchObject({ holder: 'player' })
    expect(Object.values(back.world.state.entities).filter(e => e.type === HERB)).toHaveLength(1)
    expect(back.world.entitiesOnMap(record.raw.map.id).filter(e => e.type === HERB)).toHaveLength(0)
    leave(back, record)
    enter(back, record)
    leave(back, record)
    expect(Object.values(back.world.state.entities).filter(e => e.type === HERB)).toHaveLength(1)
    expect(back.world.get(herbId)?.place).toMatchObject({ holder: 'player' })
  })

  it('keeps the source gateway usable for a newly adopted revision', () => {
    const { eng } = fixture()
    for (const revision of [1, 4]) {
      const d = draft(revision)
      adoptCreationMap(eng, d, trialCreationMap(eng, d, CHAR), CHAR)
    }
    const latest = creationMaps(eng).at(-1)!
    enter(eng, latest)
    leave(eng, latest)
  })

  it('reattaches the latest local entrance when the ordinary source chunk arrives after restoration', () => {
    const { game, eng, onto, index } = fixture()
    for (const revision of [1, 3]) {
      const d = draft(revision)
      adoptCreationMap(eng, d, trialCreationMap(eng, d, CHAR), CHAR)
    }
    const save = JSON.parse(JSON.stringify(game.save({ whole: true })))
    const loaded = Game.load(save, index, onto).engine
    expect(restoreCreationMaps(loaded, CHAR)).toEqual([])
    const ordinary = decodeRawChunk(copy(HOME), CHAR)
    const chunk = withCreationConnections(loaded, ordinary)
    expect(ordinary.map.portals).toEqual([])
    expect(chunk.map.portals).toHaveLength(1)
    expect(chunk.map.portals[0].to).toBe('creation.herb_garden.r3')
    loaded.loadChunk(chunk)
    loaded.loadChunk(creationMapChunk(loaded, chunk.map.portals[0].to, CHAR)!)
    enter(loaded, creationMaps(loaded).at(-1)!)
    leave(loaded, creationMaps(loaded).at(-1)!)
  })

  it('unplugs only owned entrances and refuses to disable an inhabited or depended-on region', () => {
    const { eng } = fixture()
    const d = draft()
    const record = adoptCreationMap(eng, d, trialCreationMap(eng, d, CHAR), CHAR)
    enter(eng, record)
    expect(() => disableCreationMap(eng, d.id)).toThrow(/Return/)
    const nested = { ...draft(), id: 'nested' }
    adoptCreationMap(eng, nested, trialCreationMap(eng, nested, CHAR), CHAR)
    leave(eng, record)
    expect(() => disableCreationMap(eng, d.id)).toThrow(/Another/)
    disableCreationMap(eng, nested.id)
    disableCreationMap(eng, d.id)
    expect(eng.world.state.maps.workshop.portals).toEqual([])
    expect(withCreationConnections(eng, decodeRawChunk(copy(HOME), CHAR)).map.portals).toEqual([])
    expect(creationMapChunk(eng, record.raw.map.id, CHAR)).toBeUndefined()
  })
})
