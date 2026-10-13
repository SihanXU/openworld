// A night's sleep (after Elin and Minecraft): the clock runs the night through at once while one
// lies asleep, and the body grows hungry four times slower than awake — a full stomach wakes with
// most of it, an empty one is woken by hunger in the small hours, and gets up again.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_HOUR, textOf, tickAt, type Engine } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

/** The tutorial's clearing, a bedroom round the player at (20, 12), the hunger given, half past nine at night. */
function bedtime(hunger: number): { eng: Engine; bed: string } {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]), 'tutorial')
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  const p = w.player
  const [x, y] = [20, 12]
  const bed = eng.author(() => {
    eng.teleport(p, { map: 'tutorial', x, y })
    w.clearStatus({ e: p.id }, 'out_cold')
    w.setProp(p, 'hunger', hunger)
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) w.create('structure/wall', { on: 'tile', map: 'tutorial', x: x + dx, y: y + dy })
    w.create('structure/door', { on: 'tile', map: 'tutorial', x, y: y + 1 })
    w.create('structure/floor', { on: 'tile', map: 'tutorial', x, y, z: 1 })
    return w.create('fixture/furniture/bed', { on: 'tile', map: 'tutorial', x, y })
  })
  w.state.tick = tickAt(1, 21.5)
  eng.tick()
  return { eng, bed: bed.id }
}

describe('a night in bed', () => {
  // (a whole night: under a full parallel run it outlasts the default)
  it('passes at once, asleep, and costs a quarter of the hunger a waking night would', { timeout: 90_000 }, () => {
    const { eng, bed } = bedtime(20)
    const w = eng.world
    const p = w.player
    eng.act('hands', p.id, { e: bed }, { instrument: null })
    expect(w.hasStatus({ e: p.id }, 'asleep')).toBe(true)
    eng.tick()
    expect(Math.floor(w.hour())).toBe(6)
    expect(w.hasStatus({ e: p.id }, 'asleep')).toBe(false)
    // eight and a half hours: awake that is 17 points of hunger, asleep about four
    expect(20 - w.num(p, 'hunger')).toBeLessThanOrEqual(5)
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp'))
    expect(eng.busy(p)).toBe(false)
  })

  // (a whole night: under a full parallel run it outlasts the default)
  it('passed a game hour a tick (the worker), the night is seen to pass: asleep and busy all the while, one night only', { timeout: 90_000 }, () => {
    const { eng, bed } = bedtime(20)
    const w = eng.world
    const p = w.player
    eng.fastForwardChunk = TICKS_PER_HOUR
    const day = w.calendar().day
    eng.act('hands', p.id, { e: bed }, { instrument: null })
    eng.tick()
    // an hour on, still in bed: the keys do nothing (a second press on the bed must not sleep another day)
    expect(w.hasStatus({ e: p.id }, 'asleep')).toBe(true)
    expect(eng.busy(p)).toBe(true)
    expect(w.hour()).toBeLessThan(23.6)
    let ticks = 0
    while (w.hasStatus({ e: p.id }, 'asleep') && ticks++ < 30) eng.tick()
    expect(ticks).toBeGreaterThan(5)
    expect(w.calendar().day).toBe(day + 1)
    expect(Math.floor(w.hour())).toBe(6)
    expect(eng.busy(p)).toBe(false)
  })

  // (a whole night: under a full parallel run it outlasts the default)
  it('a low stomach sleeps the night through (hungry, the bar falls slowly, and slower asleep)', { timeout: 90_000 }, () => {
    const { eng, bed } = bedtime(2)
    const w = eng.world
    const p = w.player
    eng.act('hands', p.id, { e: bed }, { instrument: null })
    eng.tick()
    expect(Math.floor(w.hour())).toBe(6)
    expect(w.num(p, 'hunger')).toBeGreaterThan(0)
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp'))
  })

  it('an empty stomach: hunger wakes one in the night, hurt by a point, and one can get up', () => {
    const { eng, bed } = bedtime(0)
    const w = eng.world
    const p = w.player
    const lay = w.state.tick
    eng.act('hands', p.id, { e: bed }, { instrument: null })
    w.fx.length = 0
    eng.tick()
    // in the night, before the morning
    expect(w.state.tick).toBeGreaterThan(lay)
    expect(w.state.tick).toBeLessThan(tickAt(2, 6))
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp') - 1)
    expect(w.fx.some((f) => f.t === 'log' && textOf(f.text) === 'Hunger wakes you.')).toBe(true)
    expect(w.hasStatus({ e: p.id }, 'asleep')).toBe(false)
    expect(eng.busy(p)).toBe(false)
  })
})
