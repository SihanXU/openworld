import { describe, expect, it } from 'vitest'
import type { EntitySnap } from '@lsw/engine'
import { BossAnimationClock, bossAnimationFrame } from '../../client/src/render/boss-animation.ts'
import { ALBERIC_CLIPS, ALBERIC_FPS, ALBERIC_FRAME_MS } from '../../client/src/assets/bosses.ts'

const boss = (progress: number): NonNullable<EntitySnap['boss']> => ({
  kit: 'alberic', phase: 1, action: 'cast', skill: 'arrow', progress,
  color: 0xf2ead2, footprint: [3, 2], enrageAt: 0.5,
})

describe('curated boss clips at 20 fps between simulation ticks', () => {
  it('uses 8–12 distinct source poses per clip without changing the source atlas', () => {
    expect(ALBERIC_FPS).toBe(20)
    expect(ALBERIC_FRAME_MS).toBe(50)
    expect(Object.values(ALBERIC_CLIPS).map((clip) => clip.length)).toEqual([8, 10, 12, 12, 12, 8, 12])
    for (const clip of Object.values(ALBERIC_CLIPS)) {
      expect(new Set(clip).size).toBe(clip.length)
      expect(clip.every((col) => col >= 0 && col < 32)).toBe(true)
    }
    for (const name of ['thorns', 'arrow', 'volley'] as const) {
      expect(ALBERIC_CLIPS[name].slice(0, 6).every((col) => col < 16)).toBe(true)
      expect(ALBERIC_CLIPS[name].slice(6).every((col) => col >= 16)).toBe(true)
    }
  })

  it('advances every 50 ms from the first tick without changing the snapshot', () => {
    const clock = new BossAnimationClock(), first = { ...boss(0), action: 'hurt' as const, animationElapsedMs: 0 }
    clock.receive(first, 0)
    const frame = (time: number) => bossAnimationFrame({ ...first, animationElapsedMs: clock.elapsed(time) }, time).col
    expect([0, 49, 50, 99, 100].map(frame)).toEqual([0, 0, 4, 4, 8])
    const next = { ...first, progress: 1 / 3, animationElapsedMs: 100 }
    clock.receive(next, 100)
    expect([100, 149, 150, 199, 200].map(frame)).toEqual([8, 8, 12, 12, 16])
    expect(next).toMatchObject({ progress: 1 / 3, animationElapsedMs: 100 })
  })

  it('cannot show release poses before the engine resolves a telegraph', () => {
    const clock = new BossAnimationClock()
    const warning = { name: 'Arrow', tiles: [[0, 1]] as [number, number][], progress: 0.9 }
    clock.receive({ ...boss(0.4), warning, animationElapsedMs: 300 }, 0)
    clock.receive({ ...boss(0.49), warning, animationElapsedMs: 400 }, 100)
    expect(bossAnimationFrame({ ...boss(0.49), warning, animationElapsedMs: clock.elapsed(500) }, 500).col).toBe(15)
    clock.receive({ ...boss(0.5), animationElapsedMs: 0 }, 600)
    const frame = (time: number) => bossAnimationFrame({ ...boss(0.5), animationElapsedMs: clock.elapsed(time) }, time).col
    expect([600, 649, 650, 700].map(frame)).toEqual([16, 16, 19, 22])
    expect(bossAnimationFrame({ ...boss(1), animationElapsedMs: 5000 }, 5000).col).toBe(31)
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

  it('plays the complete idle/walk clips at 20 fps at different display refresh rates', () => {
    for (const action of ['idle', 'walk'] as const) {
      const clip = ALBERIC_CLIPS[action], cycleMs = clip.length * 50
      expect(clip.map((_, i) => bossAnimationFrame({ ...boss(0), action }, i * 50).col)).toEqual(clip)
      expect(bossAnimationFrame({ ...boss(0), action }, cycleMs).col).toBe(0)
      for (const refreshRate of [20, 60, 144]) {
        const visible = new Set(Array.from({ length: Math.ceil(cycleMs * refreshRate / 1000) },
          (_, i) => bossAnimationFrame({ ...boss(0), action }, i * 1000 / refreshRate).col))
        expect([...visible]).toEqual(clip)
      }
    }
  })
})
