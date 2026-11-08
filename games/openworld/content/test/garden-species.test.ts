import { describe, expect, it } from 'vitest'
import { buildSandbox, RuleLibrary, type Engine } from '@openworld/engine'
import { BASE_RULES, FLOWER_CROPS, buildOntology, cropHours } from '../src/index.ts'

function garden() {
  const eng = buildSandbox({
    terrain: [Array(5).fill('grass'), Array(5).fill('farmland'), Array(5).fill('grass'), Array(5).fill('grass')],
    entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }], event: {},
  }, buildOntology(), new RuleLibrary(BASE_RULES))
  eng.world.player.facing = 'up'
  return eng
}
function carry(eng: Engine, type: string) {
  const item = eng.author(() => eng.world.create(type, { on: 'inside', holder: eng.world.player.id }))
  eng.controls.sync()
  eng.controls.select(eng.world.player.slots!.indexOf(eng.controls.key(item)))
  expect(eng.world.get(eng.world.player.held)?.id).toBe(item.id)
}
function use(eng: Engine) {
  const plan = eng.controls.plan('use', { x: 2, y: 1 })!
  expect(plan.unknown).not.toBe(true)
  eng.controls.run(plan, true)
}
describe('garden species use the native crop cycle', () => {
  it.each([...FLOWER_CROPS.map(c => c.id), 'wheat'])('%s sows, waters, grows and yields its own harvest', id => {
    const eng = garden(), w = eng.world, seed = 'item/seed/' + id
    carry(eng, seed); use(eng)
    expect(eng.controls.count(seed)).toBe(0)
    let crop = w.placedAt('sandbox', 2, 1).find(e => e.type.startsWith('fixture/crop/'))!
    expect(crop.type).toBe('fixture/crop/' + id + '/sprout')
    for (const stage of ['young', 'ripe']) {
      carry(eng, 'item/vessel/bucket/water'); use(eng)
      expect(w.hasStatus({ e: crop.id }, 'watered')).toBe(true)
      expect(eng.controls.count('item/vessel/bucket/water')).toBe(0)
      for (let tick = 0; tick <= cropHours(id) * 600; tick++) eng.tick()
      crop = w.get(crop.id)!
      expect(crop.type).toBe('fixture/crop/' + id + '/' + stage)
    }
    eng.controls.run(eng.controls.plan('hands', { x: 2, y: 1 })!, true)
    expect(eng.controls.count(id === 'wheat' ? 'item/material/wheat' : 'item/flower/' + id)).toBe(1)
    // The hand takes the flower; its seed is physically left on the harvested plot.
    expect(w.placedAt('sandbox', 2, 1).some(e => e.type === seed)).toBe(true)
    expect(w.fx.some(f => f.t === 'log' && JSON.stringify(f.text).includes('摘下'))).toBe(true)
  })
})
