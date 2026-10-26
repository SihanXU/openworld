// What the modder reads of a request before it designs: its signature (the class of the outcome and the terms
// memory is retrieved by), the brief (the roles, the hole and the rules that already speak about them, assembled by
// code instead of a dozen tool round trips), and the workload of the tier it is asked at (design.md §13).

import { BRANCHING_PARAMS, classKey, holeKey, OntologyIndex, isA, kindCovers, tierOfRequest, type EntityInfo, type ModRequest, type Ontology, type Rule, type RuleLibrary, type Selector, type AiLevel, type Patch, type Tier, type Tree } from '@openworld/engine'
import { compactRule } from './tools.ts'
import type { ChatOptions } from '../models/model.ts'
import type { Harness } from '../agent/state.ts'

// ---------------------------------------------------------------- the signature
// What kind of work a request is, as plain terms: the event kind, the hole it reached, the host's
// type chain, each other role's type chain, tags and statuses, the params that branch outcomes.
// Memory is retrieved by these terms (no embeddings: deterministic, inspectable), and the key
// groups requests that are the same class of undefined outcome.

export interface Signature {
  /** hole | kind | host type | other roles' types | branching params: the class of the outcome (the engine's classKey). */
  key: string
  terms: string[]
}

function roleTerms(role: string, e: EntityInfo | undefined): string[] {
  if (!e) return [`${role}:none`]
  const out = new Set<string>()
  const chain = e.typeChain?.length ? e.typeChain : [e.type]
  // every ancestor, so "a sword" and "an axe" share item/weapon/…
  for (const t of chain) {
    const parts = t.split('/')
    for (let i = 1; i <= parts.length; i++) out.add(`${role}:${parts.slice(0, i).join('/')}`)
  }
  for (const t of e.tags ?? []) out.add(`${role}#${t}`)
  for (const s of e.statuses ?? []) out.add(`${role}!${s}`)
  return [...out]
}

export function signatureOf(req: ModRequest): Signature {
  const ev = req.event
  const params = Object.entries(ev.params ?? {})
    .filter(([k]) => BRANCHING_PARAMS.includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
  const terms = [
    ...ev.kind.split('/').map((_, i, a) => `kind:${a.slice(0, i + 1).join('/')}`),
    `hole:${req.hole.rule}`,
    ...params.map((p) => `param:${p}`),
    ...roleTerms('host', ev.host),
    ...Object.entries(ev.roles).flatMap(([k, e]) => roleTerms(k, e)),
    `map:${req.context.map.kind}`,
  ]
  // the class, as the client's port keys it (the engine's classKey: one definition)
  const self = (e: EntityInfo | undefined) => !!e?.id && e.id === ev.host?.id
  const key = classKey({ hole: holeKey(req.hole.rule, req.hole.path), kind: ev.kind, host: ev.host?.type ?? '-', roles: Object.entries(ev.roles).map(([k, e]) => [k, self(e) ? 'self' : e?.type ?? '-']), params: ev.params })
  return { key, terms: [...new Set(terms)] }
}

/** The coarse terms a lesson learned from this request should be filed under. */
export function coarseTerms(sig: Signature): string[] {
  return sig.terms.filter((t) => {
    if (t.startsWith('kind:') || t.startsWith('param:') || t.startsWith('hole:')) return true
    if (t.startsWith('actor') || t.startsWith('source') || t.startsWith('map:')) return false
    if (/^\w+:(kind:|none)/.test(t)) return true
    if (/^\w+#/.test(t)) return !/#(material|quality):/.test(t)
    const m = /^(\w+):([^:]+)$/.exec(t)
    return !!m && m[2].split('/').length <= 2
  })
}

// ---------------------------------------------------------------- the brief
// The brief: what the modder would otherwise fetch with a dozen tool round trips, assembled by
// code before the first call. In measured episodes most design time went to repeated
// search_rules calls (up to 26 per episode), each a full model turn; all of them look for the
// same few things — the roles' types, and the rules that already speak about this host or this
// kind. Those are deterministic queries, so they run here.

const MAX_RELATED = 24
const MAX_FULL = 4

/** Does a host selector name this thing's class (its type or tags), statuses aside? */
function names(sel: Selector | undefined, e: EntityInfo): number {
  if (!sel) return 0
  // a root type (actor, item, fixture, tile) names the class only loosely
  if (sel.type) return e.typeChain.includes(sel.type) || isA(e.type, sel.type) ? (sel.type.includes('/') ? 3 : 1) : 0
  if (sel.tags?.length) return sel.tags.every((t) => e.tags.includes(t)) ? 2 : sel.tags.some((t) => e.tags.includes(t)) ? 1 : 0
  return 0
}

/**
 * Rules that speak about this host or this kind, most relevant first: the rules already
 * consulted for it (the context), then this host's class on neighbouring kinds, then other hosts
 * answering this kind for things like the other roles.
 */
export function relatedRules(req: ModRequest, lib: RuleLibrary): Rule[] {
  const ev = req.event
  const consulted = new Set(req.context.rules.map((r) => r.id))
  const branch = ev.kind.split('/')[0]
  const others = Object.values(ev.roles).filter((e): e is EntityInfo => !!e)
  const scored: [number, Rule][] = []
  for (const r of lib.rules.values()) {
    let score = consulted.has(r.id) ? 6 : 0
    const host = ev.host ? names(r.host, ev.host) : 0
    const sameKind = kindCovers(r.on, ev.kind)
    if (host && sameKind) score += 4
    else if (host && r.on.split('/')[0] === branch) score += 3
    else if (host) score += 1
    else if (sameKind && others.some((o) => names(r.host, o) >= 2)) score += 2
    if (score < 2) continue
    scored.push([score, r])
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, r]) => r)
}

export function briefOf(req: ModRequest, lib: RuleLibrary, onto: Ontology, tools = true): string {
  const index = new OntologyIndex(onto)
  const out = ['# Brief (prepared for you: the roles, the hole, and the rules that already speak about them)']
  const ev = req.event
  if (req.origin === 'world') out.push(`- the world did this by itself (${ev.kind}): no player asked. Keep it small and legible; never harm a person; never touch the story's facts.`)
  out.push(`- event: ${ev.kind}${Object.keys(ev.params).length ? ` ${JSON.stringify(ev.params)}` : ''}`)
  out.push(`- undefined at: ${req.hole.rule}${req.hole.path.length ? ` (branches ${req.hole.path.join(' → ')})` : ''}; while nobody answers: ${req.hole.default.length ? JSON.stringify(req.hole.default) : 'nothing happens'}`)
  if (ev.detail) out.push(`- detail: ${ev.detail}`)
  if (req.context.whose) out.push(`- whose and where: ${req.context.whose}`)
  if (ev.kind === 'stuck' || ev.kind === 'broken') out.push(`- anchors on this map (for goto): ${req.context.anchors?.join(', ') || '—'}`)
  const line = (role: string, e: EntityInfo) => {
    let props = ''
    if (e.type in onto.types) {
      const r = index.resolve(e.type)
      props = Object.keys(r.props).length ? ` default props ${JSON.stringify(r.props)}` : ''
    }
    return `- ${role}: ${e.name} — ${e.type} (chain ${e.typeChain.join(' > ')}); tags ${e.tags.join(', ') || '—'}; statuses ${e.statuses.join(', ') || '—'}${props}`
  }
  if (ev.host) out.push(line('host (your rule is its nature)', ev.host))
  for (const [role, e] of Object.entries(ev.roles)) if (e) out.push(line(role, e))
  if (ev.kind.startsWith('act/use') && !ev.roles.instrument) out.push('- instrument: none (bare hands)')
  // the relative directory: what else lives beside each role's type (the router's first place to look)
  const dirs = new Map<string, string[]>()
  for (const e of [ev.host, ...Object.values(ev.roles)]) {
    if (!e || isA(e.type, 'tile')) continue
    const parent = e.type.split('/').slice(0, -1).join('/')
    if (parent.includes('/')) (dirs.get(parent) ?? dirs.set(parent, []).get(parent)!).push(e.type.split('/').at(-1)!)
  }
  if (dirs.size) {
    out.push('', '## The directories of this request (beside each role\'s type)')
    for (const [parent, here] of dirs) {
      const children = Object.keys(onto.types).filter((t) => t.startsWith(parent + '/') && !t.slice(parent.length + 1).includes('/'))
      out.push(`- ${parent}/ (${[...new Set(here)].join(', ')} here): ${children.map((c) => c.slice(parent.length + 1)).join(', ')}`)
    }
  }
  const related = relatedRules(req, lib)
  out.push('', `## Rules about this host or this event (${related.length})`)
  out.push(...(related.length ? related.slice(MAX_FULL, MAX_RELATED).map(compactRule) : ['(none: this is new ground)']))
  if (related.length > MAX_RELATED) out.push(`… ${related.length - MAX_RELATED} more${tools ? ' (search_rules if you need them)' : ''}`)
  const full = related.slice(0, MAX_FULL)
  if (full.length) {
    out.push('', '## The closest ones in full (as examples of the format)')
    for (const r of full) {
      const { source: _s, tests, ...rest } = r
      out.push(JSON.stringify({ ...rest, tests: tests?.slice(0, 1) }))
    }
  }
  return out.join('\n')
}

// ---------------------------------------------------------------- the workload of a tier
// The AI setting as the modder works it (design.md §13, the AI setting; the levels and tiers are the engine's quality.ts).
// A request says the tier it is asked at and how far it may go in making new kinds; the workload of that
// tier is laid over the harness as an envelope. The world waits as long at every tier (AI_WAIT_MS): a tier
// is how much is done in that time — what the model sees, what it may use, how hard it thinks, what is
// checked before the answer ships — never more time. Medium is the harness as it is.
//
//   low     the request's own things only (no catalogue), the host changed and nothing else (no chains),
//           no reasoning, no repair, a short memory; nothing after it ships (no review, audit, escalation)
//   medium  the harness
//   high    more memory, more reasoning, more repair, a review before it ships
//
// The harness is the modder's own (what its outer loop improves); the setting is the player's, and stays
// out of it.

export interface Workload {
  tier: Tier
  /** How far the answer may go in making kinds the world has none of (off: never; low: not drawn; medium: drawn; high: drawn and checked). */
  create: AiLevel
  /** The router's find: what the design needs from the whole catalogue (low: only what the request holds). */
  find: boolean
  /** An answer may send impulses to other things (low: it changes its host only). */
  chains: boolean
}

export function workloadOf(req: Pick<ModRequest, 'tier' | 'scenario' | 'create'>): Workload {
  const tier = tierOfRequest(req)
  const create: AiLevel = req.create && ['off', 'low', 'medium', 'high'].includes(req.create) ? req.create : 'medium'
  return { tier, create, find: tier !== 'low', chains: tier !== 'low' }
}

type Reasoning = NonNullable<ChatOptions['reasoning']>
const DEPTH: Reasoning[] = ['none', 'minimal', 'low', 'medium', 'high']
/** The deeper of two reasoning levels (unset: the model's own default, taken as low). */
const atLeast = (have: Reasoning | undefined, want: Reasoning): Reasoning => (DEPTH.indexOf(have ?? 'low') >= DEPTH.indexOf(want) ? (have ?? 'low') : want)

/** The harness a live request is worked with at its tier. */
export function envelope(h: Harness, w: Workload): Harness {
  if (w.tier === 'medium') return h
  if (w.tier === 'low')
    return {
      ...h,
      design: { ...h.design, reasoning: 'none' },
      repair: { ...h.repair, maxRounds: 0 },
      recall: { episodes: 0, lessons: Math.min(h.recall.lessons, 4) },
      review: { ...h.review, enabled: false },
      audit: { ...(h.audit ?? { rounds: 0 }), enabled: false },
      escalate: false,
      revise: false,
    }
  return {
    ...h,
    design: { ...h.design, reasoning: atLeast(h.design.reasoning, 'medium') },
    repair: { ...h.repair, maxRounds: Math.max(h.repair.maxRounds, 2) },
    recall: { episodes: Math.max(h.recall.episodes, 8), lessons: Math.max(h.recall.lessons, 20) },
    // reviewed before it ships: the player gets the answer the reviewer let through
    review: { ...h.review, enabled: true, blocking: true, maxRounds: Math.max(h.review.maxRounds, 1) },
  }
}

/** What the request tells the designer about its setting (nothing at medium). */
export function workloadNote(w: Workload): string | undefined {
  const lines: string[] = []
  if (!w.find) lines.push('Use only the things the request holds (its roles and what is nearby): there is no catalogue at this setting — do not ask for more things.')
  if (!w.chains) lines.push('Change the host itself only (its statuses, props, form, words): no emit to other things at this setting.')
  if (w.create === 'off') lines.push('Making new kinds is off: answer with kinds the world has — never ask to create one.')
  return lines.length ? ['# Setting', ...lines.map((l) => `- ${l}`)].join('\n') : undefined
}

/** A low answer changes its host only: the impulses a draft sends anywhere else are taken out (a deterministic fix). */
export function withoutChains(patch: Patch): { patch: Patch; fixes: string[] } {
  const fixes: string[] = []
  const strip = (t: Tree, id: string): Tree => {
    if (!t || typeof t !== 'object') return t
    if ('if' in t) return { ...t, then: strip(t.then, id), ...(t.else !== undefined && { else: strip(t.else, id) }) }
    if (!('do' in t) || !Array.isArray(t.do)) return t
    const kept = t.do.filter((e) => e?.op !== 'emit')
    if (kept.length === t.do.length) return t
    fixes.push(`"${id}": ${t.do.length - kept.length} impulse(s) to other things taken out (the low setting changes the host only)`)
    return { ...t, do: kept }
  }
  const artifacts = patch.artifacts.map((a) => (a.kind === 'rule' && a.rule ? { ...a, rule: { ...a.rule, tree: strip(a.rule.tree, a.rule.id) } } : a))
  return { patch: fixes.length ? { ...patch, artifacts } : patch, fixes }
}
