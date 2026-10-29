// The music (docs/music.md): every map plays a cue the client has, at every hour and in every weather; every cue the
// runtime and the scenes ask for is there; every cue's `like` and versions name cues there are; every file is in the
// game's assets and its loudness measured (npm run loudness), so every piece plays as loud as the rest.

// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MusicCue } from '@openworld/runtime/src/assets/types.ts'
import { resolveCue, type Moment } from '@openworld/runtime/src/audio/cues.ts'
import { CATALOG } from '../../client/src/catalog.ts'
import { fileOf, musicFiles } from '../src/audio/loudness.ts'
import { buildFord } from '../src/demo/world.ts'

const cues = CATALOG.music
/** A moment of each kind: every hour of the day in clear weather, and noon in every weather. */
const MOMENTS: Moment[] = [
  ...[5, 6.5, 12, 17.8, 19.5, 23].map((hour) => ({ hour, dusk: 19, dawn: 6, weather: 'sun' })),
  ...['rain', 'storm', 'snow', 'fog'].map((weather) => ({ hour: 12, dusk: 19, dawn: 6, weather })),
]

describe('music', () => {
  it('plays Firstlight’s own daytime theme and keeps its old evening, night and rainy music', () => {
    const { chunks } = buildFord()
    const village = chunks.find((c) => c.map.id === 'meadow')!.map
    const day = { hour: 12, dusk: 19, dawn: 6, weather: 'sun' }
    const theme = 'lsw/Audio/Musics/che-shui-ma-long.ogg'
    expect(resolveCue(cues, village.music!, day)?.cue.tracks).toEqual([theme])
    for (const moment of [
      { ...day, hour: 18 },
      { ...day, hour: 23 },
      { ...day, weather: 'rain' },
      { ...day, hour: 23, weather: 'rain' },
      { ...day, weather: 'storm' },
    ]) expect(resolveCue(cues, village.music!, moment)).toEqual(resolveCue(cues, 'village', moment))
    const store = chunks.find((c) => c.map.id === 'meadow.store')!.map
    // The same mood keeps the playing strand (or its rest) when entering and leaving the shop.
    expect(store.music).toBe(village.music)
    for (const moment of MOMENTS) expect(resolveCue(cues, store.music!, moment)).toEqual(resolveCue(cues, village.music!, moment))
    for (const id of ['waystation', 'emberfall', 'mill', 'meadow.church']) {
      const map = chunks.find((c) => c.map.id === id)!.map
      expect(resolveCue(cues, map.music!, day)?.cue.tracks).not.toContain(theme)
    }
    const haven = chunks.find((c) => c.map.id === 'haven')!.map
    for (const moment of [day, { ...day, hour: 23 }, { ...day, weather: 'rain' }]) {
      const cue = resolveCue(cues, haven.music!, moment)?.cue
      expect(cue?.tracks).toEqual([theme])
      expect(cue?.rest).toEqual([5, 5])
    }
  })

  it('gives the dragon Battle Thrill without replacing the other bosses or ordinary fights', () => {
    expect(resolveCue(cues, 'boss:dragon')?.cue.tracks).toEqual(['lsw/Audio/Musics/battle-thrill.ogg'])
    expect(resolveCue(cues, 'boss:alberic')?.cue.tracks).toEqual(['Audio/Musics/24 - Final Area.ogg'])
    expect(resolveCue(cues, 'boss:alberic:2')?.cue.tracks).toEqual(['Audio/Musics/10 - Dark Castle.ogg'])
    expect(resolveCue(cues, 'battle')?.cue.tracks).toEqual(['Audio/Musics/17 - Fight.ogg', 'Audio/Musics/34  - Fight.ogg'])
  })

  it('every map plays a cue the client has, whatever the hour and the weather', () => {
    const { chunks } = buildFord()
    const bad: string[] = []
    for (const c of chunks) {
      const mood = c.map.music ?? c.map.light ?? 'outdoor'
      for (const m of MOMENTS) if (!resolveCue(cues, mood, m)) bad.push(`${c.map.id}: ${mood} at ${m.hour}h ${m.weather}`)
    }
    expect(bad).toEqual([])
  })

  it('has every cue the runtime and the scenes ask for', () => {
    const { steps } = buildFord().index
    const asked = new Set(['title', 'battle', 'boss', 'outdoor', 'indoor', 'dark'])
    for (const s of steps ?? []) for (const c of s.script ?? []) if ('music' in c && c.music) asked.add(c.music)
    expect([...asked].filter((n) => !resolveCue(cues, n, MOMENTS[2]))).toEqual([])
    // (the scenes do ask for some)
    expect(asked.size).toBeGreaterThan(6)
  })

  it("names only cues there are in its likes and versions, and every cue has pieces", () => {
    const bad: string[] = []
    for (const [name, raw] of Object.entries(cues)) {
      if (typeof raw === 'string') continue
      const cue = raw as MusicCue
      if (cue.like && cues[cue.like] === undefined) bad.push(`${name}: like ${cue.like}`)
      for (const [m, v] of Object.entries(cue.at ?? {})) if (cues[v!] === undefined) bad.push(`${name}: at ${m} ${v}`)
      if (!cue.like && !cue.tracks?.length) bad.push(`${name}: no pieces`)
      if (cue.rest && !(cue.rest[0] >= 0 && cue.rest[1] >= cue.rest[0])) bad.push(`${name}: rest ${cue.rest}`)
      for (const m of MOMENTS) if (!resolveCue(cues, name, m)) bad.push(`${name}: nothing at ${m.hour}h ${m.weather}`)
    }
    expect(bad).toEqual([])
  })

  it('has every file in the assets, its loudness measured', () => {
    const files = musicFiles()
    expect(files.filter((f) => !existsSync(fileOf(f)))).toEqual([])
    expect(files.filter((f) => typeof CATALOG.loudness?.[f] !== 'number')).toEqual([])
  })
})
