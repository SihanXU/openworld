// A research conversation proposes data, never executable patches. The caller supplies the
// catalogue from the current game, and rechecks it at confirmation: a model is not authority.
import type { Text } from './types.ts'

export interface ResearchCatalogue {
  prototypes: string[]
  materials: string[]
  /** Planning hints only; confirmation recomputes all costs from the current game. */
  guidance?: {
    materials: { type: string; value: number; available: number }[]
    prototypes: { type: string; minCost: number; station: string }[]
  }
}

export interface ResearchDesign {
  name: Text
  prototype: string
  ingredients: { type: string; count: number }[]
}

export interface ResearchReply {
  reply: string
  design?: ResearchDesign
}

export interface ResearchRequest {
  npc: string
  message: string
  history: { player: string; npc: string }[]
  catalogue: ResearchCatalogue
}

/** Bound even direct HTTP callers before their text reaches a model or is logged. */
export function readResearchRequest(value: unknown): ResearchRequest {
  if (!record(value) || !keys(value, ['npc', 'message', 'history', 'catalogue']) || !words(value.npc, 100) || !words(value.message, 1000)) throw new Error('Invalid research request')
  const c = value.catalogue
  if (!record(c) || !keys(c, ['prototypes', 'materials', 'guidance'])) throw new Error('Invalid research catalogue')
  const ids = (x: unknown): string[] => {
    if (!Array.isArray(x) || x.length > 80 || !x.every((s) => typeof s === 'string' && s.length <= 160 && /^item\/[a-zA-Z0-9_/-]+$/.test(s))) throw new Error('Invalid research catalogue entries')
    return [...new Set(x as string[])]
  }
  if (!Array.isArray(value.history) || value.history.length > 8) throw new Error('Research conversation too long')
  const history = value.history.map((turn) => {
    if (!record(turn) || !keys(turn, ['player', 'npc']) || !words(turn.player, 1000) || !words(turn.npc, 1600)) throw new Error('Invalid research conversation')
    return { player: turn.player, npc: turn.npc }
  })
  const catalogue: ResearchCatalogue = { prototypes: ids(c.prototypes), materials: ids(c.materials) }
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
  return { npc: value.npc, message: value.message, history, catalogue }
}

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)
const keys = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).every((k) => allowed.includes(k))
const words = (x: unknown, max: number): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x)

/** Strictly decode untrusted model output. Render the returned strings as text, never HTML.
 * Instructions hidden in names or conversation have no special meaning here. No property,
 * rule, status, story fact, price, tool call or unlock supplied by the model is accepted.
 * This is only structural validation; affordability, balance and NPC reach are game checks.
 */
export function readResearchReply(value: unknown, catalogue: ResearchCatalogue): ResearchReply {
  if (!record(value) || !keys(value, ['reply', 'design']) || !words(value.reply, 1600)) throw new Error('Invalid research reply')
  const reply = value.reply.trim()
  if (value.design === undefined || value.design === null) return { reply }
  const d = value.design
  if (!record(d) || !keys(d, ['name', 'prototype', 'ingredients'])) throw new Error('Invalid recipe design')
  if (typeof d.prototype !== 'string' || !catalogue.prototypes.includes(d.prototype)) throw new Error('Choose an available kind of item')
  let name: Text
  if (words(d.name, 80)) name = d.name.trim()
  else if (record(d.name) && keys(d.name, ['en', 'zh']) && words(d.name.en, 80) && words(d.name.zh, 80)) name = { en: d.name.en.trim(), zh: d.name.zh.trim() }
  else throw new Error('Give the item a short name')
  if (!Array.isArray(d.ingredients) || d.ingredients.length < 1 || d.ingredients.length > 6) throw new Error('A recipe needs one to six ingredients')
  const seen = new Set<string>()
  const ingredients = d.ingredients.map((m) => {
    if (!record(m) || !keys(m, ['type', 'count']) || typeof m.type !== 'string' || !catalogue.materials.includes(m.type)) throw new Error('Use materials available in this game')
    if (seen.has(m.type)) throw new Error('List each material once')
    if (typeof m.count !== 'number' || !Number.isSafeInteger(m.count) || m.count < 1 || m.count > 64) throw new Error('Invalid ingredient quantity')
    seen.add(m.type)
    return { type: m.type, count: m.count }
  })
  return { reply, design: { name, prototype: d.prototype, ingredients } }
}
