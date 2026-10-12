// People as data (docs/game-design.md §5). What a person says and where they are is chosen by
// the most specific key that applies — the same principle by which the rule library chooses a
// rule — so a person can have a line for one fact of the world and fall back to one for the
// weather, the hour, or any time.

import type { Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import { isA } from './ontology.ts'
import type { Entity, LineDef, Mood, NpcMemory, PropValue, ScheduleEntry, Text } from './types.ts'
import { TOPIC_DAYS } from './world.ts'

/** What a person remembers of talking: their own record (world-model.md §3). */
export function memoryOf(e: Entity): NpcMemory {
  return e.npc ? (e.npc.memory ??= {}) : {}
}

// ------------------------------------------------------------------ schedules

/** The schedule for now: a detour a rule ordered, else the most specific variant (game-design §8.2). */
export function scheduleFor(eng: Engine, e: Entity, cal: Calendar = eng.world.calendar()): ScheduleEntry[] {
  const o = e.npc?.override
  if (o && o.until > eng.world.state.tick) return [{ from: 0, to: 24, map: o.map, x: o.x, y: o.y, activity: o.activity }]
  // moved to live elsewhere (a home ground's resident): that place's days, whatever the variants say
  if (e.npc?.resident) return e.npc.resident.schedule
  const variants = e.npc?.person?.schedules
  if (!variants?.length) return e.npc?.schedule ?? []
  const one = (key: string): number => {
    if (key.startsWith('fact:') && truthy(eng.world.fact(key.slice(5)))) return 90
    if (key === cal.weather && (key === 'rain' || key === 'storm')) return 70
    if (key === 'rain' && cal.weather === 'storm') return 65
    if (key === 'default') return 1
    return -1
  }
  // a variant may join conditions with '+' (a fact and the weather): all must hold, and the more it names, the more specific
  const rank = (key: string): number => {
    const parts = key.split('+').map(one)
    return parts.some((r) => r < 0) ? -1 : Math.max(...parts) + (parts.length - 1) * 10
  }
  let best: ScheduleEntry[] | undefined
  let score = 0
  for (const v of variants) {
    const r = rank(v.key)
    if (r > score) (score = r), (best = v.entries)
  }
  return best ?? e.npc?.schedule ?? []
}

const truthy = (v: PropValue | undefined) => v !== undefined && v !== false && v !== 0 && v !== ''

// ------------------------------------------------------------------ topics

/** The story raises a topic (in its own outcome): it keeps the day it was raised and for how long. */
export function raiseTopic(eng: Engine, story: Entity, id: string, days = TOPIC_DAYS): void {
  const w = eng.world
  w.setProp(story, `topic.${id}`, w.calendar().day)
  w.setProp(story, `topic.${id}.days`, days)
}

export function topicFresh(eng: Engine, id: string): boolean {
  return eng.world.topicFresh(id)
}

// ------------------------------------------------------------------ lines

export function hourBand(hour: number): 'morning' | 'day' | 'evening' | 'night' {
  return hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'evening' : 'night'
}

export interface LineContext {
  /** what the person was just handed */
  given?: Entity
  /** false: the line is chosen for another's outcome (the story has them speak); their memory is left as it is */
  record?: boolean
  /** only a line on a fresh topic (the story's news), or none: what they tell when asked for news */
  topicOnly?: boolean
}

export interface ChosenLine {
  text: Text
  mood?: Mood
  key: string
}

/**
 * Pick what a person says now. Candidates are scored by how specific their key is; once-only
 * lines and topic lines are said once; the line said last time is not repeated if another of
 * equal rank exists.
 */
export function chooseLine(eng: Engine, e: Entity, ctx: LineContext = {}): ChosenLine | undefined {
  const lines = e.npc?.person?.lines
  if (!lines?.length) return undefined
  const w = eng.world
  const cal = w.calendar()
  // what they remember is theirs: only their own outcome records it (a line the story has them say is not)
  const mem = ctx.record === false ? { ...memoryOf(e) } : memoryOf(e)
  const said = new Set(mem.said ?? [])
  const rank = (l: LineDef): number => {
    const k = l.key
    if (ctx.given) {
      if (k.startsWith('given:') && isA(ctx.given.type, k.slice(6))) return 50 + k.length
      if (k === 'given') return 10
      return -1
    }
    if (k.startsWith('given')) return -1
    if (k.startsWith('topic:')) return w.topicFresh(k.slice(6), cal.day) ? 100 : -1
    if (ctx.topicOnly) return -1
    if (k.startsWith('fact:')) return truthy(w.fact(k.slice(5))) ? 95 : -1
    if (k === 'greeting:first') return mem.talked === undefined ? 99 : -1
    if (k === `weather:${cal.weather}`) return 55
    if (k === `hour:${hourBand(cal.hour)}`) return 40
    if (k === 'default') return 10
    return -1
  }
  let best = -1
  let pool: LineDef[] = []
  for (const l of lines) {
    const onceKey = lineId(l)
    if ((l.once || l.key.startsWith('topic:') || l.key === 'greeting:first') && said.has(onceKey)) continue
    const r = rank(l)
    if (r < 0) continue
    if (r > best) (best = r), (pool = [l])
    else if (r === best) pool.push(l)
  }
  if (!pool.length) return undefined
  const fresh = pool.filter((l) => lineId(l) !== mem.last)
  const from = fresh.length ? fresh : pool
  const pick = from[Math.floor(w.rand() * from.length)]
  const id = lineId(pick)
  mem.last = id
  if (pick.once || pick.key.startsWith('topic:') || pick.key === 'greeting:first') mem.said = [...(mem.said ?? []), id]
  // the person's own record (design.md §5.5): whom they have met is theirs, not the story's
  if (!ctx.given) mem.talked = cal.day
  return { text: fill(eng, e, pick.text, ctx), mood: pick.mood, key: pick.key }
}

const lineId = (l: LineDef) => `${l.key}|${typeof l.text === 'string' ? l.text : l.text.en}`.slice(0, 120)

/** Fill the slots of a line: {player} {name} {friend:<id>} {fact:<key>} {item}. */
function fill(eng: Engine, e: Entity, t: Text, ctx: LineContext): Text {
  const one = (s: string, locale: 'en' | 'zh') =>
    s.replace(/\{(player|name|item|friend:[^}]+|fact:[^}]+)\}/g, (_, slot: string) => {
      if (slot === 'player') return eng.nameOf({ e: eng.world.state.player }, locale)
      if (slot === 'name') return eng.nameOf({ e: e.id }, locale)
      if (slot === 'item') return ctx.given ? eng.nameOf({ e: ctx.given.id }, locale) : ''
      if (slot.startsWith('friend:')) return eng.nameOf({ e: slot.slice(7) }, locale)
      return String(eng.world.fact(slot.slice(5)) ?? '')
    })
  return typeof t === 'string' ? one(t, 'en') : { en: one(t.en, 'en'), zh: t.zh ? one(t.zh, 'zh') : undefined }
}

/** The default when a person is handed something and has no line for it. */
export const GIVEN_LINE: Text = { en: 'For me? … Thank you.', zh: '给我的？……谢谢。' }
