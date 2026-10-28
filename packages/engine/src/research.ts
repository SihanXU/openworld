// A research conversation proposes data, never executable patches. The caller supplies the
// catalogue from the current game, and rechecks it at confirmation: a model is not authority.
// A proposal is a variant of a kind the world has (its prototype, the player's materials), or a new kind the
// craftsperson thinks is needed; the service designs that kind (its numbers, makeup, station) and draws both, after the
// reply (`sketch`): the player reads the craftsperson while the picture is drawn.
import { artProblems } from './mod.ts'
import type { PixelArt, Text, TypeDef } from './types.ts'

/** A researched kind is its prototype's child named apart: `<prototype>/invention_<id>`. */
export const INVENTION = '/invention_'
/** A save's own rules are named apart too: `patch/save-<n>/…` (an answer about what only that save knows). */
export const PRIVATE_RULES = 'patch/save-'
/** A name only one save may hold: the shared library never takes one (so the two never meet). */
export const isPrivateName = (id: string): boolean => id.startsWith(PRIVATE_RULES) || id.includes(INVENTION)

export interface ResearchCatalogue {
  prototypes: string[]
  materials: string[]
  /** The stations within reach of the one who asks (`hands` is always one): where a new kind may be made. */
  stations?: string[]
  /** Every kind an ordinary craft of the game makes, open to the player or not: no new kind is one's child. */
  crafted?: string[]
  /** What the player can make already (the crafting panel's offer): asked for as it is, nothing is new. */
  makes?: { type: string; needs: { type: string; count: number }[]; station: string }[]
  /** The prototypes' icons as the game draws them (the page has the pictures): a variant's icon is one of these, edited. */
  icons?: Record<string, PixelArt>
  /** Planning hints only; confirmation recomputes all costs from the current game. */
  guidance?: {
    materials: { type: string; value: number; available: number }[]
    prototypes: { type: string; minCost: number; station: string }[]
  }
}

export interface Ingredient {
  type: string
  count: number
}

/** A variant of a kind the world has: its prototype and the player's materials (the first gives its material), drawn by its own picture. */
export interface VariantDesign {
  kind?: 'variant'
  name: Text
  prototype: string
  ingredients: Ingredient[]
  /** Its picture (the service draws it; none: the prototype's). */
  art?: PixelArt
}

/** A new kind, as the craftsperson says it (`idea`); the service designs it as a type (`type`, with its picture). */
export interface NewDesign {
  kind: 'new'
  name: Text
  idea: string
  type?: TypeDef
}

export type ResearchDesign = VariantDesign | NewDesign

export interface ResearchReply {
  /** In both languages: the game's language is switched at will, and the line follows it. */
  reply: Text
  design?: ResearchDesign
  /** The service's record of this turn (the craftsperson's own memory): what came of it is reported against it. */
  episode?: string
  /** The design's picture is still being drawn: asked for by this id (the reply does not wait for it). */
  sketch?: string
}

export interface ResearchRequest {
  npc: string
  message: string
  history: { player: string; npc: Text }[]
  catalogue: ResearchCatalogue
  /** The draft on the table (the craftsperson's last proposal, its picture if drawn): what a change of mind changes. */
  draft?: ResearchDesign
}

/** What came of a turn's design in the game: made, refused by the game (its problem's code), or left by the player. */
export interface ResearchOutcome {
  episode: string
  result: 'made' | 'refused' | 'left'
  problem?: string
}

/** Bound what a game reports before it reaches a craftsperson's memory. */
export function readResearchOutcome(value: unknown): ResearchOutcome {
  if (!record(value) || !keys(value, ['episode', 'result', 'problem']) || typeof value.episode !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.episode)) throw new Error('Invalid research outcome')
  if (value.result !== 'made' && value.result !== 'refused' && value.result !== 'left') throw new Error('Invalid research outcome')
  if (value.problem !== undefined && (typeof value.problem !== 'string' || !/^[a-z]{1,24}$/.test(value.problem))) throw new Error('Invalid research outcome')
  return { episode: value.episode, result: value.result, ...(value.problem !== undefined && { problem: value.problem as string }) }
}

/** Bound even direct HTTP callers before their text reaches a model or is logged. */
export function readResearchRequest(value: unknown): ResearchRequest {
  if (!record(value) || !keys(value, ['npc', 'message', 'history', 'catalogue', 'draft']) || !words(value.npc, 100) || !words(value.message, 1000)) throw new Error('Invalid research request')
  const c = value.catalogue
  if (!record(c) || !keys(c, ['prototypes', 'materials', 'stations', 'crafted', 'makes', 'icons', 'guidance'])) throw new Error('Invalid research catalogue')
  const ids = (x: unknown): string[] => {
    if (!Array.isArray(x) || x.length > 80 || !x.every((s) => typeof s === 'string' && s.length <= 160 && /^item\/[a-zA-Z0-9_/-]+$/.test(s))) throw new Error('Invalid research catalogue entries')
    return [...new Set(x as string[])]
  }
  if (!Array.isArray(value.history) || value.history.length > 8) throw new Error('Research conversation too long')
  const history = value.history.map((turn) => {
    if (!record(turn) || !keys(turn, ['player', 'npc']) || !words(turn.player, 1000)) throw new Error('Invalid research conversation')
    return { player: turn.player, npc: lineOf(turn.npc, 1600, 'Invalid research conversation', true) }
  })
  const catalogue: ResearchCatalogue = { prototypes: ids(c.prototypes), materials: ids(c.materials) }
  if (c.stations !== undefined) {
    if (!Array.isArray(c.stations) || c.stations.length > 40 || !c.stations.every((x) => words(x, 60))) throw new Error('Invalid research catalogue entries')
    catalogue.stations = [...new Set(c.stations as string[])]
  }
  if (c.crafted !== undefined) {
    if (!Array.isArray(c.crafted) || c.crafted.length > 400 || !c.crafted.every((s) => typeof s === 'string' && s.length <= 160 && /^item\/[a-zA-Z0-9_/-]+$/.test(s))) throw new Error('Invalid research catalogue entries')
    catalogue.crafted = [...new Set(c.crafted as string[])]
  }
  if (c.makes !== undefined) {
    const id = (x: unknown): x is string => typeof x === 'string' && x.length <= 160 && /^item\/[a-zA-Z0-9_/-]+$/.test(x)
    const count = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 1 && x <= 999
    if (!Array.isArray(c.makes) || c.makes.length > 160) throw new Error('Invalid research catalogue entries')
    catalogue.makes = c.makes.map((m) => {
      if (!record(m) || !keys(m, ['type', 'needs', 'station']) || !id(m.type) || !words(m.station, 60) || !Array.isArray(m.needs) || m.needs.length < 1 || m.needs.length > 8) throw new Error('Invalid research catalogue entries')
      const needs = m.needs.map((n) => {
        if (!record(n) || !keys(n, ['type', 'count']) || !id(n.type) || !count(n.count)) throw new Error('Invalid research catalogue entries')
        return { type: n.type, count: n.count as number }
      })
      return { type: m.type, needs, station: m.station as string }
    })
  }
  if (c.icons !== undefined) {
    if (!record(c.icons) || Object.keys(c.icons).length > 80) throw new Error('Invalid research catalogue entries')
    catalogue.icons = Object.fromEntries(Object.entries(c.icons).filter(([k]) => catalogue.prototypes.includes(k)).map(([k, v]) => [k, artOf(v)]))
  }
  if (c.guidance !== undefined) {
    const g = c.guidance
    const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1e9
    if (!record(g) || !keys(g, ['materials', 'prototypes']) || !Array.isArray(g.materials) || !Array.isArray(g.prototypes) || g.materials.length > 80 || g.prototypes.length > 80) throw new Error('Invalid research guidance')
    const materials = g.materials.map((m) => {
      if (!record(m) || !keys(m, ['type', 'value', 'available']) || typeof m.type !== 'string' || !catalogue.materials.includes(m.type) || !positive(m.value) || typeof m.available !== 'number' || !Number.isSafeInteger(m.available) || m.available < 0 || m.available > 1e6) throw new Error('Invalid material guidance')
      return { type: m.type, value: m.value, available: m.available }
    })
    const prototypes = g.prototypes.map((p) => {
      if (!record(p) || !keys(p, ['type', 'minCost', 'station']) || typeof p.type !== 'string' || !catalogue.prototypes.includes(p.type) || !positive(p.minCost) || !words(p.station, 100)) throw new Error('Invalid craft guidance')
      return { type: p.type, minCost: p.minCost, station: p.station }
    })
    catalogue.guidance = { materials, prototypes }
  }
  // a draft no longer makeable here (a material spent, a craft out of reach) is no draft: the next idea starts afresh
  let draft: ResearchDesign | undefined
  if (value.draft !== undefined) {
    try {
      draft = readResearchReply({ reply: { en: 'draft', zh: 'draft' }, design: value.draft }, catalogue).design
    } catch { /* dropped */ }
  }
  return { npc: value.npc, message: value.message, history, catalogue, ...(draft && { draft }) }
}

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)
const keys = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).every((k) => allowed.includes(k))
const words = (x: unknown, max: number): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x)

/** Strictly decode untrusted model output (and the service's design built on it). Render the returned strings as text,
 * never HTML. Instructions hidden in names or conversation have no special meaning here. No rule, status, story fact,
 * price, tool call or unlock supplied by the model is accepted; a new kind's numbers are bounded by the game
 * (researchCraft.ts). This is only structural validation; affordability, balance and reach are game checks.
 */
export function readResearchReply(value: unknown, catalogue: ResearchCatalogue): ResearchReply {
  if (!record(value) || !keys(value, ['reply', 'design', 'episode', 'sketch'])) throw new Error('Invalid research reply')
  const reply = lineOf(value.reply, 1600, 'Say the reply in English and in Chinese: {"en": …, "zh": …}')
  const handle = (x: unknown) => x === undefined || (typeof x === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(x))
  if (!handle(value.episode) || !handle(value.sketch)) throw new Error('Invalid research reply')
  const episode = { ...(value.episode !== undefined && { episode: value.episode as string }), ...(value.sketch !== undefined && !!value.design && { sketch: value.sketch as string }) }
  if (value.design === undefined || value.design === null) return { reply, ...episode }
  const d = value.design
  if (!record(d) || !keys(d, ['kind', 'name', 'prototype', 'ingredients', 'art', 'idea', 'type'])) throw new Error('Invalid recipe design')
  const name = nameOf(d.name)
  if (d.kind === 'new') {
    if (!words(d.idea, 300)) throw new Error('Say what the new thing is')
    return { reply, design: { kind: 'new', name, idea: d.idea.trim(), ...(d.type !== undefined && { type: typeOf(d.type, catalogue) }) }, ...episode }
  }
  if (d.kind !== undefined && d.kind !== 'variant') throw new Error('Invalid recipe design')
  if (typeof d.prototype !== 'string' || !catalogue.prototypes.includes(d.prototype)) throw new Error('Choose an available kind of item')
  return { reply, design: { name, prototype: d.prototype, ingredients: ingredientsOf(d.ingredients, catalogue), ...(d.art !== undefined && { art: artOf(d.art) }) }, ...episode }
}

/** A line a player reads: in both languages (one alone is taken only where `either` says, the game's own history). */
function lineOf(x: unknown, max: number, problem: string, either = false): Text {
  if (either && words(x, max)) return x.trim()
  if (record(x) && keys(x, ['en', 'zh']) && words(x.en, max) && words(x.zh, max)) return { en: x.en.trim(), zh: x.zh.trim() }
  throw new Error(problem)
}

const nameOf = (x: unknown): Text => lineOf(x, 80, 'Give the item a short name in English and in Chinese: {"en": …, "zh": …}')

function ingredientsOf(x: unknown, catalogue: ResearchCatalogue): Ingredient[] {
  if (!Array.isArray(x) || x.length < 1 || x.length > 6) throw new Error('A recipe needs one to six ingredients')
  const seen = new Set<string>()
  return x.map((m) => {
    if (!record(m) || !keys(m, ['type', 'count']) || typeof m.type !== 'string' || !catalogue.materials.includes(m.type)) throw new Error('Use materials available in this game')
    if (seen.has(m.type)) throw new Error('List each material once')
    if (typeof m.count !== 'number' || !Number.isSafeInteger(m.count) || m.count < 1 || m.count > 64) throw new Error('Invalid ingredient quantity')
    seen.add(m.type)
    return { type: m.type, count: m.count }
  })
}

function artOf(x: unknown): PixelArt {
  if (!record(x) || !Array.isArray(x.grid) || !record(x.palette) || artProblems(x as unknown as PixelArt).length) throw new Error('Invalid picture')
  return { grid: (x.grid as unknown[]).map(String), palette: Object.fromEntries(Object.entries(x.palette).map(([k, v]) => [k, String(v)])) } as PixelArt
}

/** A new kind's shape: an item's id, a name, tags and numbers, what it is made of (the player's materials), where. */
function typeOf(x: unknown, catalogue: ResearchCatalogue): TypeDef {
  if (!record(x) || typeof x.id !== 'string' || !/^item\/[a-z0-9_]+(\/[a-z0-9_]+)+$/.test(x.id) || x.id.length > 160) throw new Error('Invalid new kind')
  const props = record(x.props) ? x.props : {}
  if (!Object.values(props).every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean')) throw new Error('Invalid new kind')
  const tags = Array.isArray(x.tags) && x.tags.every((t) => typeof t === 'string' && t.length <= 60) ? (x.tags as string[]) : []
  const station = x.station === undefined ? 'hands' : x.station
  if (!words(station, 60) || (station !== 'hands' && !(catalogue.stations ?? []).includes(station))) throw new Error('Make it where you are')
  return {
    id: x.id,
    name: nameOf(x.name),
    tags,
    props: props as TypeDef['props'],
    makeup: ingredientsOf(x.makeup, catalogue),
    station,
    ...(x.art !== undefined && { art: artOf(x.art) }),
  }
}
