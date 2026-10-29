// The music director (audio/music.ts, docs/music.md), over a fake AudioContext and fake <audio> elements: what plays
// first to last (the title, a scene, a boss and its phase, a fight held past its end, the place), the place's piece
// held and taken up again where it was, a scene's silence, death's silence, a version of the hour waiting for the
// end of the piece playing, the rests between the wilds' pieces, and every piece brought to one loudness.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Catalog, MusicCue } from '../src/assets/types.ts'
import { useGame, type ClientGame } from '../src/game.ts'
import { MusicDirector } from '../src/audio/music.ts'
import { momentsOf, resolveCue } from '../src/audio/cues.ts'

vi.mock('../src/render/assets.ts', () => ({ assetUrl: (p: string) => p }))

/** An AudioParam that remembers where it was last sent. */
class Param {
  value = 0
  target = 0
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v
  }
  linearRampToValueAtTime(v: number): void {
    this.target = v
  }
  setTargetAtTime(v: number): void {
    this.target = v
  }
}
class Node {
  gain = new Param()
  connect<T>(n: T): T {
    return n
  }
  disconnect(): void {}
}
/** Every <audio> made, in order. */
let made: FakeAudio[] = []
class FakeAudio {
  src: string
  loop = false
  preload = ''
  paused = true
  currentTime = 0
  private ended?: () => void
  constructor(src: string) {
    this.src = src
    made.push(this)
  }
  addEventListener(kind: string, f: () => void): void {
    if (kind === 'ended') this.ended = f
  }
  play(): Promise<void> {
    this.paused = false
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
  removeAttribute(): void {
    this.src = ''
  }
  load(): void {}
  /** The piece reaches its end. */
  end(): void {
    this.paused = true
    this.ended?.()
  }
}
/** The gain each element plays at (its MediaElementSource → gain). */
const gains = new Map<FakeAudio, Param>()
const ctx = {
  currentTime: 0,
  state: 'running',
  resume: () => Promise.resolve(),
  createGain: () => new Node(),
  createMediaElementSource(el: FakeAudio) {
    // the gain it is connected to is the one it plays at
    return { connect: (g: Node) => (gains.set(el, g.gain), g), disconnect() {} }
  },
} as unknown as AudioContext

const cues: Record<string, string | MusicCue> = {
  title: { tracks: ['title.ogg'] },
  field: { tracks: ['day1.ogg', 'day2.ogg'], rest: [60, 60], at: { night: 'field_night' } },
  field_night: { tracks: ['night.ogg'], rest: [60, 60] },
  village: 'village.ogg',
  outdoor: { like: 'field' },
  battle: { tracks: ['fight.ogg'], at: { night: 'battle_night' } },
  battle_night: 'fight_night.ogg',
  boss: 'boss.ogg',
  'boss:alberic': 'alberic.ogg',
  'boss:alberic:2': 'alberic2.ogg',
  sorrow: 'sorrow.ogg',
}

/** The pieces playing now (not paused, and not let go). */
const playing = () => made.filter((a) => !a.paused && a.src).map((a) => a.src)
const day = { hour: 12, dusk: 19, dawn: 6, weather: 'sun' }
const night = { hour: 22, dusk: 19, dawn: 6, weather: 'sun' }

let dir: MusicDirector
beforeEach(() => {
  vi.useFakeTimers()
  made = []
  gains.clear()
  ;(globalThis as unknown as { Audio: unknown }).Audio = FakeAudio
  ;(globalThis as unknown as { addEventListener: unknown }).addEventListener ??= () => {}
  ;(globalThis as unknown as { removeEventListener: unknown }).removeEventListener ??= () => {}
  useGame({ id: 'test', catalog: { music: cues, loudness: { 'title.ogg': -10, 'village.ogg': -26 } } as unknown as Catalog } as unknown as ClientGame)
  dir = new MusicDirector(ctx, new Node() as unknown as AudioNode)
  dir.setMoment(day)
})
afterEach(() => {
  dir.disable()
  vi.useRealTimers()
})
/** Time passes (the fades end: what was let go or held stops). */
const pass = (ms: number) => vi.advanceTimersByTime(ms)

describe('the music director', () => {
  it('continues the same piece and its rest when a shop shares the outdoor mood', () => {
    dir.setPlace('field', 'outdoor')
    const first = made[made.length - 1]
    first.currentTime = 23
    dir.setPlace('field', 'indoor')
    pass(3000)
    expect(playing()).toEqual([first.src])
    expect(first.currentTime).toBe(23)
    expect(made).toHaveLength(1)
    first.end()
    pass(20_000)
    dir.setPlace('field', 'outdoor')
    pass(39_000)
    expect(playing()).toEqual([])
    pass(1500)
    expect(playing()).toHaveLength(1)
    expect(made).toHaveLength(2)
  })

  it('plays the place, and the title over it while the cover is up', () => {
    dir.setPlace('village', 'outdoor')
    expect(playing()).toEqual(['village.ogg'])
    dir.setTitle(true)
    pass(3000)
    expect(playing()).toEqual(['title.ogg'])
    dir.setTitle(false)
    pass(3000)
    expect(playing()).toEqual(['village.ogg'])
  })

  it('brings every piece to one loudness: a loud file down, a quiet one up (never by more than the cap)', () => {
    dir.setTitle(true)
    const title = made.find((a) => a.src === 'title.ogg')!
    expect(gains.get(title)!.target).toBeCloseTo(10 ** (-6 / 20), 3)
    dir.setTitle(false)
    dir.setPlace('village', 'outdoor')
    const village = made.find((a) => a.src === 'village.ogg')!
    expect(gains.get(village)!.target).toBeCloseTo(10 ** (9 / 20), 3)
  })

  it('takes a fight up at once, holds it past the fight, and takes the place up again where it was', () => {
    dir.setPlace('village', 'outdoor')
    const village = made.find((a) => a.src === 'village.ogg')!
    dir.setFight(true)
    pass(1000)
    expect(playing()).toEqual(['fight.ogg'])
    // the fight is over, but its music holds a few seconds
    pass(5000)
    expect(playing()).toEqual(['fight.ogg'])
    // (it fades out over three seconds as the place comes back)
    pass(5000)
    expect(playing()).toEqual(['village.ogg'])
    // the same piece, taken up again (not a new one from the start)
    expect(made.filter((a) => a.src === 'village.ogg')).toEqual([village])
  })

  it("plays a fight's night version by night", () => {
    dir.setMoment(night)
    dir.setPlace('village', 'outdoor')
    dir.setFight(true)
    pass(1000)
    expect(playing()).toEqual(['fight_night.ogg'])
  })

  it("plays a boss's own music and its later phase's", () => {
    dir.setPlace('village', 'outdoor')
    dir.setBoss({ kind: 'actor/boss/alberic', phase: 1 })
    pass(2000)
    expect(playing()).toEqual(['alberic.ogg'])
    dir.setBoss({ kind: 'actor/boss/alberic', phase: 2 })
    pass(2000)
    expect(playing()).toEqual(['alberic2.ogg'])
    dir.setBoss({ kind: 'actor/creature/slime', phase: 1 })
    pass(2000)
    expect(playing()).toEqual(['boss.ogg'])
  })

  it("plays a scene's music over everything but the title, and its silence", () => {
    dir.setPlace('village', 'outdoor')
    dir.setScene('sorrow')
    dir.setFight(true)
    pass(3000)
    expect(playing()).toEqual(['sorrow.ogg'])
    dir.setScene('')
    pass(3000)
    expect(playing()).toEqual([])
    dir.setScene(undefined)
    pass(9000)
    expect(playing()).toEqual(['village.ogg'])
  })

  it('falls silent while one lies fallen', () => {
    dir.setPlace('village', 'outdoor')
    dir.setDeath(true)
    pass(1000)
    expect(playing()).toEqual([])
    dir.setDeath(false)
    pass(3000)
    expect(playing()).toEqual(['village.ogg'])
  })

  it("rests between the wilds' pieces, and changes to the night's version at the end of the piece playing", () => {
    dir.setPlace(undefined, 'outdoor')
    expect(playing().length).toBe(1)
    const first = made[made.length - 1]
    // night falls while the day's piece plays: it plays on to its end
    dir.setMoment(night)
    pass(1000)
    expect(playing()).toEqual([first.src])
    first.end()
    // a rest of silence (the ambience alone)
    pass(30_000)
    expect(playing()).toEqual([])
    pass(31_000)
    expect(playing()).toEqual(['night.ogg'])
  })
})

describe('cues', () => {
  it('pick their versions by the weather first, then the hour (the night that lengthens moves dusk)', () => {
    expect(momentsOf({ hour: 18, dusk: 19, dawn: 6, weather: 'sun' })).toEqual(['dusk'])
    expect(momentsOf({ hour: 18, dusk: 17.5, dawn: 6, weather: 'sun' })).toEqual(['night'])
    expect(momentsOf({ hour: 2, dusk: 19, dawn: 6, weather: 'storm' })).toEqual(['storm', 'rain', 'night'])
    expect(momentsOf({ hour: 6.5, dusk: 19, dawn: 6, weather: 'fog' })).toEqual(['fog', 'dawn'])
    expect(resolveCue(cues, 'outdoor', night)?.name).toBe('field_night')
    expect(resolveCue(cues, 'nowhere', night)).toBeUndefined()
    // a loop of likes resolves to nothing rather than for ever
    expect(resolveCue({ a: { like: 'b' }, b: { like: 'a' } }, 'a')).toBeUndefined()
  })
})
