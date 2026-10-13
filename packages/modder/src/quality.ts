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

import { tierOfRequest, type AiLevel, type ModRequest, type Patch, type Tier, type Tree } from '@openworld/engine'
import type { ChatOptions, Harness } from '@openworld/agent'

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
