// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import type { EntitySnap } from '@openworld/engine'
import { BossAnimationClock, bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { ALBERIC_CLIPS } from '@openworld/runtime/src/assets/bosses.ts'

const boss = (progress: number): NonNullable<EntitySnap['boss']> => ({
  kit: 'alberic', phase: 1, action: 'cast', skill: 'arrow', progress,
  color: 0xf2ead2, footprint: [3, 2], enrageAt: 0.5,
})

describe('delivered boss clips between simulation ticks', () => {
  it('takes cadence and segment boundaries from the original delivery', () => {
    expect(ALBERIC_CLIPS.idle).toMatchObject({ frames: 8, frame_ms: 150, loop: true })
    for (const id of ['attack_right', 'attack_left', 'attack_down'] as const) {
      expect(ALBERIC_CLIPS[id]).toMatchObject({ frames: 10, frame_ms: 80, loop: false,
        hit_frame: 5, segments: { main: [0, 8], recover: [9] }, chain: { at_frame: 8, goto_frame: 0 } })
    }
  })

  it('draws an 80 ms anticipation pose inside the first tick without mutating the snapshot', () => {
    const clock = new BossAnimationClock(), first = { ...boss(0), animationElapsedMs: 0 }
    clock.receive(first, 0)
    const frame = (time: number) => bossAnimationFrame({ ...first, animationElapsedMs: clock.elapsed(time) }, time).col
    expect([0, 79, 80, 100].map(frame)).toEqual([0, 0, 1, 1])
    const next = { ...first, progress: 0.1, animationElapsedMs: 100 }
    clock.receive(next, 100)
    expect([100, 159, 160, 199, 200].map(frame)).toEqual([1, 1, 2, 2, 2])
    expect(next).toMatchObject({ progress: 0.1, animationElapsedMs: 100 })
  })

  it('cannot show release poses before the engine resolves a telegraph', () => {
    const clock = new BossAnimationClock()
    const warning = { name: 'Arrow', tiles: [[0, 1]] as [number, number][], progress: 0.9 }
    clock.receive({ ...boss(0.4), warning, animationElapsedMs: 300 }, 0)
    clock.receive({ ...boss(0.49), warning, animationElapsedMs: 400 }, 100)
    expect(bossAnimationFrame({ ...boss(0.49), warning, animationElapsedMs: clock.elapsed(500) }, 500).col).toBe(4)
    clock.receive({ ...boss(0.5), animationElapsedMs: 0 }, 600)
    const frame = (time: number) => bossAnimationFrame({ ...boss(0.5), animationElapsedMs: clock.elapsed(time) }, time).col
    // The hit begins at delivered frame five; the next pose follows exactly 80 ms later.
    expect([600, 679, 680, 700].map(frame)).toEqual([5, 5, 6, 6])
    expect(bossAnimationFrame({ ...boss(1), animationElapsedMs: 5000 }, 5000).col).toBe(9)
  })

  it('freezes at one tick of extrapolation and repeated paused snapshots never rewind it', () => {
    const clock = new BossAnimationClock()
    clock.receive({ ...boss(0.5), animationElapsedMs: 0 }, 0)
    clock.receive({ ...boss(0.6), animationElapsedMs: 100 }, 100)
    const held = clock.progress(200)
    clock.receive({ ...boss(0.6), animationElapsedMs: 100 }, 300)
    expect(clock.progress(300)).toBe(held)
    expect(clock.progress(30000)).toBe(held)
    expect(clock.elapsed(30000)).toBe(200)
    // Resuming uses engine phase time, never the time spent paused.
    clock.receive({ ...boss(0.7), animationElapsedMs: 200 }, 30100)
    expect(clock.elapsed(30150)).toBe(250)
  })

  it('resets speed at action changes, interruption, and preview loop restarts', () => {
    const clock = new BossAnimationClock()
    clock.receive(boss(0.7), 0)
    clock.receive(boss(0.8), 100)
    clock.receive({ ...boss(0), action: 'hurt' }, 150)
    expect(clock.progress(200)).toBe(0)
    clock.receive(boss(0.9), 300)
    clock.receive(boss(0), 400)
    expect(clock.progress(500)).toBe(0)
    clock.receive({ ...boss(1), action: 'death' }, 600)
    expect(clock.progress(9000)).toBe(1)
  })

  it('plays the complete idle/walk clips at their pace on the screen\'s clock, at different display refresh rates, whatever the simulation\'s phase time', () => {
    for (const action of ['idle', 'walk'] as const) {
      const ms = ALBERIC_CLIPS.idle.frame_ms, clip = Array.from({ length: ALBERIC_CLIPS.idle.frames }, (_, i) => i), cycleMs = clip.length * ms
      expect(clip.map((_, i) => bossAnimationFrame({ ...boss(0), action }, i * ms + 1).col)).toEqual(clip)
      // a lagging tick's phase time does not hold or jump the loop
      expect(bossAnimationFrame({ ...boss(0), action, animationElapsedMs: 9999 }, ms + 1).col).toBe(clip[1])
      expect(bossAnimationFrame({ ...boss(0), action }, cycleMs).col).toBe(0)
      for (const refreshRate of [20, 60, 144]) {
        const visible = new Set(Array.from({ length: Math.ceil(cycleMs * refreshRate / 1000) },
          (_, i) => bossAnimationFrame({ ...boss(0), action }, i * 1000 / refreshRate).col))
        expect([...visible]).toEqual(clip)
      }
    }
  })
})
