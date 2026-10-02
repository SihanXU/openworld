// People as data (docs/game-design.md §5, §8.2–8.4). What a person says, where they are, what
// they think of a gift: each is chosen by the most specific key that applies — the same
// principle by which the rule library chooses a rule — so a hero can have a line for this exact
// day and fall back to one for the weather, the weekday, or any time.

import type { Calendar } from './calendar.ts'
import type { Engine } from './engine.ts'
import { isA } from './ontology.ts'
import type { Entity, Id, LineDef, Mood, NpcMemory, PropValue, ScheduleEntry, Tastes, Text } from './types.ts'

export const POINTS_PER_HEART = 250
export const MAX_POINTS = POINTS_PER_HEART * 10
export const GIFT_POINTS = { loved: 80, liked: 45, neutral: 20, disliked: -20, hated: -40 } as const
export type Taste = keyof typeof GIFT_POINTS
const GIFTS_PER_WEEK = 2
const BIRTHDAY_MULT = 8
const TOPIC_DAYS = 4

// ------------------------------------------------------------------ friendship

export const friendKey = (npc: Id) => `friend.${npc}`

export function friendship(eng: Engine, npc: Id): number {
  return eng.world.num(eng.world.player, friendKey(npc), 0)
}

export function hearts(eng: Engine, npc: Id): number {
  return Math.floor(friendship(eng, npc) / POINTS_PER_HEART)
}

export function befriend(eng: Engine, npc: Id, amount: number): number {
  const p = eng.world.player
  const v = Math.max(0, Math.min(MAX_POINTS, friendship(eng, npc) + amount))
  ;(p.props ??= {})[friendKey(npc)] = v
  return v
}

export function memoryOf(eng: Engine, npc: Id): NpcMemory {
  const m = (eng.world.state.memory ??= {})
  return (m[npc] ??= {})
}

// ------------------------------------------------------------------ schedules

/** The schedule variant for today: the most specific key that applies wins (game-design §8.2). */
export function scheduleFor(eng: Engine, e: Entity, cal: Calendar = eng.world.calendar()): ScheduleEntry[] {
  const variants = e.npc?.person?.schedules
  if (!variants?.length) return e.npc?.schedule ?? []
  const facts = eng.world.state.facts ?? {}
  const rank = (key: string): number => {
    if (key === `date:${cal.season}_${cal.dayOfSeason}`) return 100
    if (key.startsWith('fact:') && truthy(facts[key.slice(5)])) return 90
    // Hearth Night is the village's weekly gathering (indoors): it outranks the weather
    if (key === 'weekday:hearthday' && cal.weekday === 'hearthday') return 75
    if (key === cal.weather && (key === 'rain' || key === 'storm')) return 70
    if (key === 'rain' && cal.weather === 'storm') return 65
    if (key === `weekday:${cal.weekday}`) return 50
    if (key === `season:${cal.season}`) return 30
    if (key === 'default') return 1
    return -1
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

export function raiseTopic(eng: Engine, id: string, days = TOPIC_DAYS): void {
  const s = eng.world.state
  const day = eng.world.calendar().day
  s.topics = (s.topics ?? []).filter((t) => t.id !== id)
  s.topics.push({ id, day, days })
}

export function topicFresh(eng: Engine, id: string): boolean {
  const day = eng.world.calendar().day
  return (eng.world.state.topics ?? []).some((t) => t.id === id && day < t.day + (t.days ?? TOPIC_DAYS))
}

// ------------------------------------------------------------------ lines

export function hourBand(hour: number): 'morning' | 'day' | 'evening' | 'night' {
  return hour >= 6 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 22 ? 'evening' : 'night'
}

export function tierOf(h: number): 'stranger' | 'acquaintance' | 'friend' | 'close' {
  return h < 1 ? 'stranger' : h < 3 ? 'acquaintance' : h < 6 ? 'friend' : 'close'
}

export interface LineContext {
  /** for gift reactions */
  gift?: { taste: Taste | 'limit'; item: Entity }
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
  const mem = memoryOf(eng, e.id)
  const said = new Set(mem.said ?? [])
  const h = hearts(eng, e.id)
  const map = e.place.on === 'tile' ? e.place.map : ''
  const topics = w.state.topics ?? []
  const birthday = e.npc?.person?.birthday
  const rank = (l: LineDef): number => {
    const k = l.key
    if (ctx.gift) {
      if (k === `gift:item:${ctx.gift.item.type}`) return 100
      if (k.startsWith('gift:item:') && isA(ctx.gift.item.type, k.slice(10))) return 95
      if (k === `gift:${ctx.gift.taste}`) return 50
      return -1
    }
    if (k.startsWith('gift:')) return -1
    if (k.startsWith('topic:')) {
      const [, id, mem] = k.split(':')
      const t = topics.find((x) => x.id === id)
      if (!t) return -1
      if (!mem) return cal.day < t.day + (t.days ?? TOPIC_DAYS) ? 100 : -1
      if (mem === 'memory_week') return cal.day >= t.day + 7 && cal.day < t.day + 10 ? 95 : -1
      return -1
    }
    if (k === 'greeting:first') return mem.talked === undefined ? 99 : -1
    if (k === `date:${cal.season}_${cal.dayOfSeason}`) return 90
    if (k === 'birthday') return birthday && birthday.season === cal.season && birthday.day === cal.dayOfSeason ? 92 : -1
    if (k === `place:${map}`) return 70
    if (k === `weekday:${cal.weekday}`) return 60
    if (k === `weather:${cal.weather}`) return 55
    if (k === `hour:${hourBand(cal.hour)}`) return 40
    // the first words of the day are a greeting (by friendship); later, the moment speaks
    if (k === `greeting:${tierOf(h)}`) return mem.talked !== cal.day ? 45 : 30
    if (k === 'default') return 10
    return -1
  }
  let best = -1
  let pool: LineDef[] = []
  for (const l of lines) {
    if ((l.hearts ?? 0) > h) continue
    const onceKey = lineId(l)
    if ((l.once || l.key.startsWith('topic:') || l.key === 'greeting:first') && said.has(onceKey)) continue
    const r = rank(l)
    if (r < 0) continue
    // heart-gated lines join their key's pool rather than replacing it
    const score = r
    if (score > best) (best = score), (pool = [l])
    else if (score === best) pool.push(l)
  }
  if (!pool.length) return undefined
  const fresh = pool.filter((l) => lineId(l) !== mem.last)
  const pick = (fresh.length ? fresh : pool)[Math.floor(w.rand() * (fresh.length ? fresh : pool).length)]
  const id = lineId(pick)
  mem.last = id
  if (pick.once || pick.key.startsWith('topic:') || pick.key === 'greeting:first') mem.said = [...(mem.said ?? []), id]
  return { text: fill(eng, e, pick.text, ctx), mood: pick.mood, key: pick.key }
}

const lineId = (l: LineDef) => `${l.key}|${typeof l.text === 'string' ? l.text : l.text.en}`.slice(0, 120)

/** Fill the slots of a line: {player} {name} {friend:<id>} {fact:<key>} {item}. */
function fill(eng: Engine, e: Entity, t: Text, ctx: LineContext): Text {
  const one = (s: string, locale: 'en' | 'zh') =>
    s.replace(/\{(player|name|item|friend:[^}]+|fact:[^}]+)\}/g, (_, slot: string) => {
      if (slot === 'player') return eng.nameOf({ e: eng.world.state.player }, locale)
      if (slot === 'name') return eng.nameOf({ e: e.id }, locale)
      if (slot === 'item') return ctx.gift ? eng.nameOf({ e: ctx.gift.item.id }, locale) : ''
      if (slot.startsWith('friend:')) return eng.nameOf({ e: slot.slice(7) }, locale)
      return String(eng.world.fact(slot.slice(5)) ?? '')
    })
  return typeof t === 'string' ? one(t, 'en') : { en: one(t.en, 'en'), zh: t.zh ? one(t.zh, 'zh') : undefined }
}

// ------------------------------------------------------------------ gifts

function matches(eng: Engine, item: Entity, entry: string): boolean {
  if (entry.startsWith('tag:')) {
    const tag = entry.slice(4)
    return (item.tags ?? []).includes(tag) || eng.world.onto.resolve(item.type).tags.includes(tag)
  }
  return isA(item.type, entry)
}

/** A person's taste for an item: their own tastes first, then everyone's, else neutral. */
export function tasteOf(eng: Engine, npc: Entity, item: Entity): Taste {
  const order: [keyof Tastes, Taste][] = [
    ['love', 'loved'],
    ['hate', 'hated'],
    ['like', 'liked'],
    ['dislike', 'disliked'],
  ]
  for (const tastes of [npc.npc?.person?.tastes, eng.world.onto.data.tastes])
    for (const [k, taste] of order) if (tastes?.[k]?.some((x) => matches(eng, item, x))) return taste
  return 'neutral'
}

/**
 * The player gives a person an item: one gift a day, two a week, eight times the effect on
 * their birthday. Returns what happened, for the reaction.
 */
export function giveGift(eng: Engine, npc: Entity, item: Entity): { taste: Taste | 'limit'; points: number } {
  const cal = eng.world.calendar()
  const mem = memoryOf(eng, npc.id)
  const week = Math.floor((cal.day - 1) / 7)
  const g = mem.gifts && mem.gifts.week === week ? mem.gifts : { day: 0, week, count: 0 }
  if (g.day === cal.day || g.count >= GIFTS_PER_WEEK) return { taste: 'limit', points: 0 }
  const taste = tasteOf(eng, npc, item)
  const b = npc.npc?.person?.birthday
  const mult = b && b.season === cal.season && b.day === cal.dayOfSeason ? BIRTHDAY_MULT : 1
  const points = GIFT_POINTS[taste] * mult
  befriend(eng, npc.id, points)
  mem.gifts = { day: cal.day, week, count: g.count + 1 }
  ;(mem.tasted ??= {})[item.type] = taste
  return { taste, points }
}

export const MOOD_OF: Record<Taste | 'limit', Mood> = { loved: 'happy', liked: 'happy', neutral: 'neutral', disliked: 'sad', hated: 'angry', limit: 'neutral' }

/** Default reactions when a person has no line for a gift. */
export const GIFT_LINES: Record<Taste | 'limit', Text> = {
  loved: { en: 'Oh! This is wonderful — thank you!', zh: '哇！太好了——谢谢你！' },
  liked: { en: 'Thank you, I like this.', zh: '谢谢，我喜欢。' },
  neutral: { en: 'Thanks.', zh: '谢谢。' },
  disliked: { en: "Oh… thanks, I suppose.", zh: '呃……那就谢谢吧。' },
  hated: { en: 'What am I supposed to do with this?', zh: '你给我这个干什么？' },
  limit: { en: "You've given me enough for now.", zh: '你送得够多了，先别了。' },
}
