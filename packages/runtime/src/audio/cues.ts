// The music's cues by name (docs/music.md): which version of a cue the hour and the weather pick, through its
// `like`s. Pure: the director plays what this resolves, and the games' tests check their tables with it.

import type { MusicCue, MusicMoment } from '../assets/types.ts'

/** The hours either side of dusk and dawn that count as them. */
const TWILIGHT = 1.5

/** Where the day and the weather stand now (the frame's: the night's hours move as the story's night lengthens). */
export interface Moment {
  hour: number
  dusk: number
  dawn: number
  weather: string
}

/** Whether an hour is in the night (dusk to dawn, across midnight). */
export function isNight(hour: number, dusk: number, dawn: number): boolean {
  return dusk > dawn ? hour >= dusk || hour < dawn : hour >= dusk && hour < dawn
}

/** The moments that may pick a version of a cue, the strongest first: the weather's, then the hour's. */
export function momentsOf(m: Moment): MusicMoment[] {
  const out: MusicMoment[] = []
  if (m.weather === 'storm') out.push('storm', 'rain')
  else if (m.weather === 'rain' || m.weather === 'snow' || m.weather === 'fog') out.push(m.weather)
  const { hour: h, dusk, dawn } = m
  if (isNight(h, dusk, dawn)) out.push('night')
  else if (h >= dusk - TWILIGHT) out.push('dusk')
  else if (h < dawn + TWILIGHT) out.push('dawn')
  else out.push('day')
  return out
}

/** A cue by name, through its `like`s and its versions for the moment: the name it comes to and its pieces. */
export function resolveCue(cues: Record<string, string | MusicCue>, name: string, moment?: Moment): { name: string; cue: MusicCue } | undefined {
  const seen = new Set<string>()
  let n = name
  for (;;) {
    if (seen.has(n)) return undefined
    seen.add(n)
    const raw = cues[n]
    if (raw === undefined) return undefined
    const cue: MusicCue = typeof raw === 'string' ? { tracks: [raw] } : raw
    if (cue.like) {
      n = cue.like
      continue
    }
    const version = moment && cue.at ? momentsOf(moment).map((m) => cue.at![m]).find((v) => v && cues[v] !== undefined && !seen.has(v)) : undefined
    if (version) {
      n = version
      continue
    }
    return cue.tracks?.length ? { name: n, cue } : undefined
  }
}
