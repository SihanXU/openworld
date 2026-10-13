// OpenWorld's "events" as the editor makes them (docs/engine-split.md §16 E2, RPG Maker's quick events): a door
// to another map, a chest and what is in it, a sign with its words, a bed, a merchant with a stock and a purse, a
// person who gives a favour — each the format's data (a map's things and portals, a person's file, a quest's
// file), never a script of one instance; and "its own kind" (E-b): a thing given a child type of its own, so that
// rules written for that type are its behaviour alone while the model stays rules on types. Pure.

import type { Entity, QuestDef, RawChunk, Rule, Text } from '@openworld/engine'
import type { PersonFile } from '@openworld/format'
import { charOf, EditError, newId, paint, type Cell } from './mapEdit.ts'

const inMap = (m: RawChunk['map'], c: Cell) => c.x >= 0 && c.y >= 0 && c.x < m.width && c.y < m.height

/**
 * A door at a cell leading to a place (another map's cell, or this one's): the cell a door (when the game writes
 * one), a portal on it. With `back`, a portal at that cell of the place's map leading back to the cell before this
 * door (below it, the way a door is left).
 */
export function door(here: RawChunk, at: Cell, to: { map: string; x: number; y: number; label?: Text }, chars: Record<string, string>, back?: { chunk: RawChunk; at: Cell; label?: Text }): void {
  if (!inMap(here.map, at)) throw new EditError('the door is off the map')
  const d = charOf(chars, 'door')
  if (d) paint(here, 'ground', [at], d)
  here.map.portals = here.map.portals.filter((p) => !(p.x === at.x && p.y === at.y))
  here.map.portals.push({ x: at.x, y: at.y, to: to.map, tx: to.x, ty: to.y, ...(to.label && { label: to.label }) })
  if (back) wayBack(here.map, at, back, chars)
}

/** The way back from a door: a door at a cell of the other map, its portal leading to the cell before the door (below it). */
export function wayBack(here: RawChunk['map'], at: Cell, back: { chunk: RawChunk; at: Cell; label?: Text }, chars: Record<string, string>): void {
  const m = back.chunk.map
  if (!inMap(m, back.at)) throw new EditError('the way back is off its map')
  const d = charOf(chars, 'door')
  if (d) paint(back.chunk, 'ground', [back.at], d)
  m.portals = m.portals.filter((p) => !(p.x === back.at.x && p.y === back.at.y))
  const out = { x: at.x, y: Math.min(here.height - 1, at.y + 1) }
  m.portals.push({ x: back.at.x, y: back.at.y, to: here.id, tx: out.x, ty: out.y, ...(back.label && { label: back.label }) })
}

/** Things of a kind, so many of each, inside a holder (a chest, a person's bag): their entities, each with an id of its own. */
export function contents(holder: string, mapId: string, items: { type: string; count: number }[], taken: Set<string>): Entity[] {
  return items.flatMap(({ type, count }) => Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({ id: newId(mapId, type, taken), type, place: { on: 'inside' as const, holder } })))
}

/** A thing set down in a cell, with props of its own: its entity, added to the map. */
export function setDown(ch: RawChunk, type: string, at: Cell, taken: Set<string>, extra: Partial<Entity> = {}): Entity {
  if (!inMap(ch.map, at)) throw new EditError('the cell is off the map')
  const e: Entity = { id: newId(ch.map.id, type, taken), type, place: { on: 'tile', map: ch.map.id, x: at.x, y: at.y }, ...extra }
  ch.entities.push(e)
  return e
}

/** A chest (any container) at a cell and what it holds: the chest's id. */
export function chest(ch: RawChunk, type: string, at: Cell, items: { type: string; count: number }[], taken: Set<string>): string {
  const c = setDown(ch, type, at, taken)
  ch.entities.push(...contents(c.id, ch.map.id, items, taken))
  return c.id
}

/** A sign (a readable fixture) with its words (`text`, and `text_zh` beside it: what the standard library's `core/read` says). */
export function sign(ch: RawChunk, type: string, at: Cell, text: Text, taken: Set<string>): string {
  const en = typeof text === 'string' ? text : text.en
  const zh = typeof text === 'string' ? undefined : text.zh
  return setDown(ch, type, at, taken, { props: { text: en, ...(zh && { text_zh: zh }) } }).id
}

/** A person's id from a name (npc.<word>), one no other thing has. */
export function personId(name: string, taken: Set<string>): string {
  const base = `npc.${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'someone'}`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`
}

export interface PersonSpec {
  id: string
  name: Text
  type: string
  at: { map: string; x: number; y: number }
  /** A first line (the default key). */
  line?: Text
}

/** A person standing at a cell, with a line to say (their day is the people mode's). */
export function person(o: PersonSpec): PersonFile {
  return { id: o.id, type: o.type, name: o.name, place: { on: 'tile', ...o.at }, facing: 'down', npc: { role: o.type.split('/').pop()!, schedule: [], person: { lines: o.line ? [{ key: 'default', text: o.line }] : [] } } }
}

/**
 * A merchant (the society module's trade, docs/npc-sandbox.md §2.10): a person tagged `merchant`, a stock they keep
 * (`type*n|…`, restocked by the module) and carry, and a purse of the game's coin.
 */
export function merchant(o: PersonSpec & { stock: { type: string; count: number }[]; purse: number; coin?: string }): PersonFile {
  const p = person(o)
  const items = o.stock.flatMap(({ type, count }, i) => Array.from({ length: Math.max(0, Math.floor(count)) }, (_, j) => ({ id: `${o.id}.stock${i}.${j}`, type, place: { on: 'inside' as const, holder: o.id } })))
  const coins = o.coin ? Array.from({ length: Math.max(0, Math.floor(o.purse)) }, (_, i) => ({ id: `${o.id}.coin${i}`, type: o.coin!, place: { on: 'inside' as const, holder: o.id } })) : []
  return {
    ...p,
    tags: ['merchant'],
    props: { purse: o.purse, stock: o.stock.filter((s) => s.count > 0).map((s) => `${s.type}*${s.count}`).join('|') },
    _items: [...items, ...coins],
  }
}

/** The favours a quest giver can ask (RPG Maker's quick events, made a quest of Bethesda's shape: aliases, objectives, stages). */
export type Favour =
  | { kind: 'bring'; what: string; count: number }
  | { kind: 'talk'; to: string; toName: Text }
  | { kind: 'defeat'; what: string; count: number }

export interface FavourSpec {
  id: string
  title: Text
  giver: string
  favour: Favour
  /** What the giver asks, says while it runs, and says at the end. */
  ask: Text
  waiting?: Text
  thanks: Text
  reward: { xp?: number; items?: { type: string; count: number }[] }
}

const both = (en: string, zh: string): Text => ({ en, zh })

/**
 * A favour as a quest (the starter's `firewood` is one): it begins when its giver is spoken to; its objective
 * counts by itself (what the taker carries, what they fell) or is a word with someone; then back to the giver,
 * who takes what was asked, rewards and thanks.
 */
export function favourQuest(o: FavourSpec): QuestDef {
  const f = o.favour
  const aliases: QuestDef['aliases'] = { giver: { id: o.giver, essential: true } }
  const objectives: NonNullable<QuestDef['objectives']> = []
  const stages: QuestDef['stages'] = []
  if (f.kind === 'talk') {
    aliases.other = { id: f.to, essential: true }
    objectives.push({ id: 'talk', text: both('Speak to {other}', '和{other}谈谈'), target: 'other', talk: true })
    stages.push({ n: 10, log: o.ask, show: ['talk'], say: o.ask })
    stages.push({ n: 100, on: { talk: 'other' }, done: ['talk'], say: o.thanks, by: 'other', reward: o.reward, complete: true, log: both('Spoke to {other}.', '和{other}谈过了。') })
  } else {
    const sel = { type: f.what }
    objectives.push({ id: 'what', text: f.kind === 'bring' ? both('Bring', '带来') : both('Defeat', '打倒'), count: f.kind === 'bring' ? { carry: sel } : { kill: sel }, need: f.count })
    objectives.push({ id: 'back', text: both('Back to {giver}', '回去找{giver}'), target: 'giver', talk: true })
    stages.push({ n: 10, log: o.ask, show: ['what'], say: o.ask })
    stages.push({ n: 20, on: { objectives: ['what'] }, show: ['back'], log: both('Done. Back to {giver}.', '完成了。回去找{giver}。') })
    stages.push({
      n: 100,
      on: { all: [{ talk: 'giver' }, { objectives: ['what'] }] },
      done: ['back'],
      say: o.thanks,
      ...(f.kind === 'bring' && { take: [{ match: sel, count: f.count }] }),
      reward: o.reward,
      complete: true,
      log: both('Back to {giver}: done.', '回去找了{giver}：完成了。'),
    })
  }
  return { id: o.id, kind: 'side', title: o.title, summary: o.ask, aliases, objectives, stages, start: { auto: { talk: 'giver' } }, ...(o.waiting && { waiting: o.waiting }) }
}

/** A quest's id from its title (lower case words), one no other quest has. */
export function questId(title: string, taken: Set<string>): string {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'favour'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`
}

// ------------------------------------------------------------------ its own kind (E-b)

/** The child type a thing's own kind would be: its type's path and a word from its name or id, free in the ontology. */
export function ownKindId(e: Entity, types: Record<string, unknown>): string {
  const word = (typeof e.name === 'string' ? e.name : e.name?.en ?? e.id.split('.').pop() ?? 'own').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'own'
  const base = `${e.type}/${word}`
  if (!types[base]) return base
  for (let n = 2; ; n++) if (!types[`${base}_${n}`]) return `${base}_${n}`
}

/**
 * The first rule a thing's own kind is given: a hand on it says something, the author writes the rest. (Not for a
 * person: their kind's hand is their talk, which a rule of its own would take over.)
 */
export function ownKindRule(type: string, name: Text): Rule {
  const en = typeof name === 'string' ? name : name.en
  const zh = typeof name === 'string' ? en : (name.zh ?? en)
  return {
    id: `${type.split('/').slice(-2).join('/')}/hands`,
    label: { en: 'Look at {target}', zh: '看看{target}' },
    doc: `What a hand on ${en} does (its own kind: the rules written for it are its behaviour alone).`,
    host: { type },
    on: 'impulse/handle',
    tree: { if: { same: ['host', 'actor'] }, then: 'inherit', else: { do: [{ op: 'log', text: { en: `${en}: nothing yet.`, zh: `${zh}：还没有什么。` } }] } },
  }
}
