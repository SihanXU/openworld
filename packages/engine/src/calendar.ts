// Time and weather (docs/game-design.md §3). Days and nights, and the weather: nothing more —
// no weekdays or seasons. A game minute is one real second (10 ticks), so a day is 24 minutes
// and the world never stops: people sleep, creatures come out at night, a storm rolls in. The
// world may fix the weather for spans of time (the evening storm); otherwise it is drawn per
// day from the seed.

export const TICKS_PER_MINUTE = 10
export const TICKS_PER_HOUR = TICKS_PER_MINUTE * 60
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24
/** Tick 0 is day 1 at 06:00; a world may start at another hour. Days change at midnight. */
export const START_HOUR = 6

export const WEATHERS = ['sun', 'cloud', 'rain', 'storm', 'fog'] as const
export type Weather = (typeof WEATHERS)[number]

export interface Calendar {
  /** Absolute day, from 1. */
  day: number
  /** The clock, 0 … 24 (fractional). */
  hour: number
  minute: number
  weather: Weather
}

/** A span of fixed weather: a whole day, or hours [from, to) of it. */
export interface WeatherSpan {
  day: number
  from?: number
  to?: number
  weather: Weather
}

function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** The weather at an hour of a day: fixed by the world, or drawn from the seed (sun-heavy; storms rare). */
export function weatherOf(day: number, hour: number, seed: number, plan?: WeatherSpan[]): Weather {
  const span = plan?.find((s) => s.day === day && hour >= (s.from ?? 0) && hour < (s.to ?? 24))
  if (span) return span.weather
  if (day === 1) return 'sun'
  const r = hash(seed * 7919 + day * 104729)
  return r < 0.5 ? 'sun' : r < 0.75 ? 'cloud' : r < 0.9 ? 'rain' : r < 0.95 ? 'storm' : 'fog'
}

/** Hours since day 1 began (midnight). */
export function hoursAt(tick: number): number {
  return START_HOUR + tick / TICKS_PER_HOUR
}

export function calendarAt(tick: number, seed: number, plan?: WeatherSpan[]): Calendar {
  const total = hoursAt(tick)
  const dayIndex = Math.floor(total / 24)
  const hour = total - dayIndex * 24
  const day = dayIndex + 1
  return { day, hour, minute: Math.floor((hour % 1) * 60), weather: weatherOf(day, hour, seed, plan) }
}

/** The tick at which a clock hour (0 … 24) of a day falls. */
export function tickAt(day: number, hour: number): number {
  return Math.round(((day - 1) * 24 + hour - START_HOUR) * TICKS_PER_HOUR)
}

/** When night falls and when it ends, in clock hours, the night longer by `shift` hours (the story's `night.shift`). */
export const nightHours = (shift = 0): { dusk: number; dawn: number } => ({ dusk: 21 - Math.max(0, shift), dawn: 5 + Math.max(0, shift) / 2 })

/** Night: the hours creatures roam and people sleep — longer as the story's night lengthens (docs/lore.md §2). */
export const isNight = (hour: number, shift = 0) => {
  const { dusk, dawn } = nightHours(shift)
  return hour >= dusk || hour < dawn
}

export const rainy = (w: Weather) => w === 'rain' || w === 'storm'
