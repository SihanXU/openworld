import { describe, expect, it } from 'vitest'
import { adoptCreationMap, buildSandbox, decodeRawChunk, RuleLibrary, trialCreationMap, type CreationMapDraft } from '@openworld/engine'
import { BASE_RULES, TERRAIN_CHARS, buildOntology } from '../src/index.ts'

function source() {
  return buildSandbox({ terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')), entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
  ], event: {} }, buildOntology(), new RuleLibrary(BASE_RULES))
}
const draft = (): CreationMapDraft => ({ id: 'stream', revision: 1, raw: { map: {
  id: 'chosen-by-model', name: 'Forest', kind: 'forest', width: 7, height: 7,
  rows: ['TTT~TTT', 'T..~..T', 'T..~..T', 'T..B..T', 'T..~..T', 'T..~..T', 'TTT~TTT'],
  portals: [], environment: { palette: 'verdant', water: 'stream', fireflies: true },
}, entities: [{ id: 'fall', type: 'fixture/nature/waterfall', place: { on: 'tile', map: 'chosen-by-model', x: 3, y: 1 } }] } })

describe('native forest map admission', () => {
  it('uses native hands range from a bank but refuses an ordinary remote prop at the same location', () => {
    const eng = source(), d = draft()
    d.raw.map.width = 9
    d.raw.map.rows = ['TTT~~~TTT', 'T..~~~..T', 'T..~~~..T', 'T..BBB..T', 'T..~~~..T', 'T..~~~..T', 'TTT~~~TTT']
    d.raw.entities[0].place = { on: 'tile', map: d.raw.map.id, x: 4, y: 1 }
    expect(trialCreationMap(eng, d, TERRAIN_CHARS).errors).toEqual([])
    d.raw.entities[0].type = 'fixture/furniture/chair'
    expect(trialCreationMap(eng, d, TERRAIN_CHARS).errors.join(' ')).toContain('cannot be reached')
  })
  it('trials without pollution, persists environment, and physically crosses the bridge', () => {
    const eng = source(), d = draft(), before = JSON.stringify(eng.world.state), report = trialCreationMap(eng, d, TERRAIN_CHARS)
    expect(report.errors).toEqual([])
    expect(JSON.stringify(eng.world.state)).toBe(before)
    const kept = adoptCreationMap(eng, d, report, TERRAIN_CHARS)
    const chunk = decodeRawChunk(kept.raw, TERRAIN_CHARS)
    expect(chunk.map.environment).toEqual(d.raw.map.environment)
    eng.author(() => eng.teleport(eng.world.player, { map: chunk.map.id, x: 2, y: 3 }))
    expect(eng.movePlayer('right')).toBe(true)
    expect(eng.world.posOf(eng.world.player)).toMatchObject({ x: 3, y: 3 })
    for (let t = 0; t < 5; t++) eng.tick()
    expect(eng.movePlayer('right')).toBe(true)
    expect(eng.world.posOf(eng.world.player)).toMatchObject({ x: 4, y: 3 })
  })
  it('rejects a decorative bridge that leaves the opposite bank disconnected and rejects arbitrary presentation code', () => {
    const eng = source(), d = draft()
    d.raw.map.rows[3] = 'TB.~..T'
    expect(trialCreationMap(eng, d, TERRAIN_CHARS).errors.join(' ')).toContain('bank disconnected')
    ;(d.raw.map.environment as any).script = 'doSomething()'
    expect(trialCreationMap(eng, d, TERRAIN_CHARS).errors.join(' ')).toContain('environment')
  })
  it('keeps the pavilion open to walking and offers native leaning rest', () => {
    const eng = source(), w = eng.world
    const pavilion = eng.author(() => w.create('fixture/furniture/pavilion', { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    expect(w.onto.resolve(pavilion.type).solid).toBe(false)
    const plan = eng.controls.plan('hands', { x: 2, y: 1 })!
    eng.controls.run(plan, true)
    expect(w.hasStatus({ e: w.player.id }, 'leaning')).toBe(true)
    expect(eng.movePlayer('up')).toBe(true)
    expect(w.hasStatus({ e: w.player.id }, 'leaning')).toBe(false)
  })
})
