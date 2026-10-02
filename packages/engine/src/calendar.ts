// Time and the calendar (docs/game-design.md §3). Days are full 24-hour days: the world never
// stops — people sleep, shops close, the night has its own life — and the player may stay up as
// long as they like (sleep skips to the morning; staying up tires). A game minute is 0.7 s (at
// 10 ticks/s, 7 ticks), so a whole day is about 17 real minutes. Weather is drawn per day from
// the world seed, unless the world fixes it for a day.

export const TICKS_PER_MINUTE = 7
export const TICKS_PER_HOUR = TICKS_PER_MINUTE * 60
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24
/** The game begins on day 1 at 06:00 (tick 0); days change at midnight. */
export const START_HOUR = 6
/** Waking up after a night's sleep. */
export const MORNING_HOUR = 6

export const WEEKDAYS = ['firstday', 'ashday', 'riverday', 'stoneday', 'seedday', 'windday', 'hearthday'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const SEASONS = ['thaw', 'bloom', 'ember', 'frost'] as const
export type Season = (typeof SEASONS)[number]
export const SEASON_DAYS = 28
export const WEATHERS = ['sun', 'cloud', 'rain', 'storm', 'fog'] as const
export type Weather = (typeof WEATHERS)[number]

export interface Calendar {
  /** Absolute day, from 1. */
  day: number
  dayOfSeason: number
  season: Season
  year: number
  weekday: Weekday
  /** The clock, 0 … 24 (fractional). */
  hour: number
  minute: number
  weather: Weather
}

/** Days the world fixes (e.g. the first week's story): day → weather. */
export type WeatherPlan = Record<number, Weather>

function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** The day's weather: fixed by the world, or drawn from the seed (sun-heavy; storms rare). */
export function weatherOf(day: number, seed: number, plan?: WeatherPlan): Weather {
  if (plan?.[day]) return plan[day]
  if (day === 1) return 'sun'
  const r = hash(seed * 7919 + day * 104729)
  return r < 0.45 ? 'sun' : r < 0.7 ? 'cloud' : r < 0.88 ? 'rain' : r < 0.94 ? 'storm' : 'fog'
}

/** Hours since day 1 began (midnight). */
export function hoursAt(tick: number): number {
  return START_HOUR + tick / TICKS_PER_HOUR
}

export function calendarAt(tick: number, seed: number, plan?: WeatherPlan): Calendar {
  const total = hoursAt(tick)
  const dayIndex = Math.floor(total / 24)
  const hour = total - dayIndex * 24
  const day = dayIndex + 1
  const seasonIndex = Math.floor(dayIndex / SEASON_DAYS)
  return {
    day,
    dayOfSeason: (dayIndex % SEASON_DAYS) + 1,
    season: SEASONS[seasonIndex % SEASONS.length],
    year: Math.floor(seasonIndex / SEASONS.length) + 1,
    weekday: WEEKDAYS[dayIndex % WEEKDAYS.length],
    hour,
    minute: Math.floor((hour % 1) * 60),
    weather: weatherOf(day, seed, plan),
  }
}

/** The tick at which a clock hour (0 … 24) of a day falls. */
export function tickAt(day: number, hour: number): number {
  return Math.round(((day - 1) * 24 + hour - START_HOUR) * TICKS_PER_HOUR)
}

/** The next time the clock shows `hour` after `tick` (e.g. the next 06:00, when you sleep). */
export function nextHour(tick: number, hour: number, seed = 0): number {
  const c = calendarAt(tick, seed)
  const today = tickAt(c.day, hour)
  return today > tick ? today : tickAt(c.day + 1, hour)
}

export const rainy = (w: Weather) => w === 'rain' || w === 'storm'
