// A second seat (docs/agent-players.md): an actor whose keys are somebody else's moves, strikes and handles through the
// same Controls as the player, while the story and the camera stay with the primary seat.

import { describe, expect, it } from 'vitest'
import { DIRS, played, put, standBeside, ticks, untilReady } from './seats.ts'

describe('a second seat', () => {
  it('walks while its key is held and rests when it is let go, leaving the player where they stood', () => {
    const eng = played()
    const w = eng.world
    put(eng, w.player, 14, 5)
    const mira = w.get('npc.mira')!
    put(eng, mira, 8, 8)
    const seat = eng.sit(mira.id)
    untilReady(eng, mira.id)
    const player = { ...w.posOf(w.player)! }
    const dir = DIRS.find((d) => eng.moveSeat(mira.id, d))!
    ticks(eng, 4)
    const start = { ...w.posOf(mira)! }
    seat.move(dir)
    ticks(eng, 20)
    const walked = w.posOf(mira)!
    expect(Math.abs(walked.x - start.x) + Math.abs(walked.y - start.y)).toBeGreaterThanOrEqual(2)
    seat.move(null)
    ticks(eng, 10)
    const rested = { ...w.posOf(mira)! }
    ticks(eng, 60)
    expect(w.posOf(mira)).toMatchObject(rested)
    expect(w.posOf(w.player)).toMatchObject(player)
  })

  it('walks a counted number of tiles, never more', () => {
    const eng = played()
    const w = eng.world
    put(eng, w.player, 2, 2)
    const mira = w.get('npc.mira')!
    put(eng, mira, 8, 8)
    const seat = eng.sit(mira.id)
    untilReady(eng, mira.id)
    const travelled = (steps: number, dir: (typeof DIRS)[number]) => {
      const before = { ...w.posOf(mira)! }
      seat.input({ t: 'move', dir, steps })
      ticks(eng, 80)
      const after = w.posOf(mira)!
      return Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
    }
    const dir = DIRS.find((d) => travelled(2, d) > 0)!
    const far = travelled(3, dir)
    expect(far).toBeGreaterThan(0)
    expect(far).toBeLessThanOrEqual(3)
  })

  it('fells the slime with a held attack key', () => {
    const eng = played()
    const w = eng.world
    put(eng, w.player, 14, 5)
    const mira = w.get('npc.mira')!
    const slime = w.get('glade.slime')!
    const seat = eng.sit(mira.id)
    standBeside(eng, mira, slime)
    seat.attack(true)
    for (let i = 0; i < 80 && w.get(slime.id); i++) eng.tick()
    expect(w.get(slime.id)).toBeUndefined()
  })

  it('opens a chest with the hand key and takes the axe into its own bag, not the player\'s', () => {
    const eng = played()
    const w = eng.world
    put(eng, w.player, 2, 2)
    const mira = w.get('npc.mira')!
    const seat = eng.sit(mira.id)
    standBeside(eng, mira, w.get('glade.chest')!)
    expect(seat.input({ t: 'key', key: 'hands' })).toEqual({ ok: true })
    expect(seat.panel).toBe('glade.chest')
    expect(seat.input({ t: 'key', key: 'hands' }).ok).toBe(false)
    expect(seat.input({ t: 'transfer', from: 'chest', item: 'glade.axe' })).toEqual({ ok: true })
    expect(w.get('glade.axe')?.place).toMatchObject({ holder: mira.id })
    expect(seat.input({ t: 'closePanel' })).toEqual({ ok: true })
    expect(w.hasStatus({ e: 'glade.chest' }, 'open')).toBe(false)
  })

  it('answers a press that does nothing with its reason, and cannot be taken at the player', () => {
    const eng = played()
    const seat = eng.sit('npc.mira')
    expect(seat.input({ t: 'craft', id: 'no.such.recipe' })).toMatchObject({ ok: false })
    expect(seat.input({ t: 'transfer', from: 'chest', item: 'x' })).toMatchObject({ ok: false, reason: 'no container is open' })
    expect(() => eng.sit(eng.world.state.player)).toThrow()
    eng.leave('npc.mira')
    expect(eng.seats.size).toBe(0)
  })
})
