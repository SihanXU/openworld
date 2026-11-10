import { describe, expect, it } from 'vitest'
import { buildSandbox, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

function fixture(type: string, withSeat = false) {
  return buildSandbox({
    terrain: Array.from({ length: 5 }, () => Array(7).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 3 },
      { key: 'target', type, x: 2, y: 2 },
      ...(withSeat ? [{ key: 'seat', type: 'fixture/furniture/chair', x: 3, y: 2 }] : []),
    ],
    event: {},
  }, buildOntology(), new RuleLibrary(BASE_RULES))
}

describe('native furniture and gathering interactions', () => {
  it.each(['fixture/furniture/chair', 'fixture/furniture/bench', 'fixture/furniture/bench/log'])('E sits on %s; a normal movement stands up', type => {
    const eng = fixture(type), w = eng.world
    const plan = eng.controls.plan('hands', { x: 2, y: 2 })!
    expect(plan.unknown).not.toBe(true)
    eng.controls.run(plan, true)
    expect(w.hasStatus({ e: 'actor' }, 'seated')).toBe(true)
    expect(w.posOf(w.player)).toMatchObject({ x: 2, y: 2 })
    expect(eng.trace.some(t => t.rule === 'core/settle' && t.defined)).toBe(true)
    expect(eng.movePlayer('down')).toBe(true)
    expect(w.posOf(w.player)).toMatchObject({ x: 2, y: 3 })
    expect(w.hasStatus({ e: 'actor' }, 'seated')).toBe(false)
  })

  it('picks ripe berries, sits with the harvest, then walks away without losing it', () => {
    const eng = fixture('fixture/crop/berry/ripe', true), w = eng.world
    const plan = eng.controls.plan('hands', { x: 2, y: 2 })!
    expect(plan.unknown).not.toBe(true)
    eng.controls.run(plan, true)
    expect(eng.controls.count('item/food/berries')).toBe(1)
    expect(w.get('target')?.type).toBe('fixture/crop/berry/young')
    expect(eng.trace.some(t => t.rule === 'farm/pick' && t.defined)).toBe(true)
    expect(w.fx.some(f => f.t === 'log' && JSON.stringify(f.text).includes('摘下'))).toBe(true)
    const sit = eng.controls.plan('hands', { x: 3, y: 2 })!
    expect(sit.unknown).not.toBe(true)
    eng.controls.run(sit, true)
    expect(w.posOf(w.player)).toMatchObject({ x: 3, y: 2 })
    expect(w.hasStatus({ e: 'actor' }, 'seated')).toBe(true)
    expect(eng.movePlayer('down')).toBe(true)
    expect(w.posOf(w.player)).toMatchObject({ x: 3, y: 3 })
    expect(w.hasStatus({ e: 'actor' }, 'seated')).toBe(false)
    expect(eng.controls.count('item/food/berries')).toBe(1)
  })
})
