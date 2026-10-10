// Candidates for the upstream loop (docs/upstream.md §2): where the learned layer, which answers
// one type at one leaf, shows that a class answers alike. Pure code over the shared library and
// the ontology, no model: S1 is sibling convergence (K types under one ancestor with equivalent
// trees, a share S of the class the hole reaches), S2 a hole one class was asked about N times.
// S3, the person's own request, is the driver's (tools/src/upstream.ts).

import { isA, placed, type Cond, type Effect, type Leaf, type Ontology, type Rule, type Tree } from '@openworld/engine'
import type { WorldLibrary } from './library.ts'

/** The thresholds the user set: K types alike, a share S of the class, N questions. */
export const PROMOTE = { K: 3, S: 0.5, N: 5 }

export interface Candidate {
  /** the event kind and the hole (`holeKey`) the learned rules fill */
  kind: string
  hole: string
  /** the class: the lowest common ancestor of the types that answer alike (S1), or the class asked about (S2) */
  ancestor: string
  /** the host types in the cluster (S1) or asked about (S2) */
  types: string[]
  /** the learned rules the proposal would subsume */
  rules: Rule[]
  /** the cluster's types over the class's types reached at this hole */
  share: number
  /** S1 and S2 are found here; S3 is the person's own request (the driver, tools/src/upstream.ts) */
  signal: 'S1' | 'S2' | 'S3'
  /** S1: the canonical tree the types share (`normalKey`); S2: none */
  normalized?: string
  /** S2: how many questions the class was asked at this hole */
  asked?: number
}

// ------------------------------------------------------------------ the type tree

/** The deepest type every one of these is under; none when they share only the root (or nothing). */
export function lowestCommonAncestor(types: string[]): string | undefined {
  if (!types.length) return undefined
  const paths = types.map((t) => t.split('/'))
  const common: string[] = []
  for (let i = 0; i < paths[0].length; i++) {
    const seg = paths[0][i]
    if (!paths.every((p) => p[i] === seg)) break
    common.push(seg)
  }
  // a class is below a root: `actor` alone names a kind, not a class
  return common.length >= 2 ? common.join('/') : undefined
}

/** A type's own classes, deepest first: itself and every ancestor below the root. */
function classesOf(type: string): string[] {
  const parts = type.split('/')
  const out: string[] = []
  for (let i = parts.length; i >= 2; i--) out.push(parts.slice(0, i).join('/'))
  return out
}

// ------------------------------------------------------------------ equivalence of learned trees

const HOST = '@host'
const NARRATED = new Set(['log', 'say', 'emote', 'vfx'])

/** JSON with keys in order, so two equal trees have one string. */
function canonical(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonical((x as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(x)
}

/** A value with the host's own type abstracted, wherever it is named (a selector, a transform, a spawn). */
function abstract(x: unknown, hostType: string): unknown {
  if (typeof x === 'string') return x === hostType ? HOST : x
  if (Array.isArray(x)) return x.map((v) => abstract(v, hostType))
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, abstract(v, hostType)]))
  return x
}

function normalizeEffect(e: Effect, hostType: string): unknown {
  // what is said and shown is wording, not an outcome: the op stays (a rule that narrates differs from one that is silent), its text goes
  if (NARRATED.has(e.op)) {
    const { text: _t, fx: _fx, mood: _m, ...rest } = e as Effect & { text?: unknown; fx?: unknown; mood?: unknown }
    return abstract(rest, hostType)
  }
  return abstract(e, hostType)
}

function normalizeLeaf(l: Leaf, hostType: string): unknown {
  if (l === 'inherit') return l
  if ('undefined' in l) return { undefined: true, ...(l.default?.length ? { default: l.default.map((e) => normalizeEffect(e, hostType)) } : {}) }
  // doc, label and confirm are for the player and the reviewer, not the outcome
  return { do: l.do.map((e) => normalizeEffect(e, hostType)) }
}

/**
 * A learned rule's tree in canonical form, for equivalence across types: the condition structure
 * and the effects' ops and non-text arguments, with the host's own type as `@host`.
 */
export function normalizeTree(tree: Tree, hostType: string): unknown {
  if (typeof tree === 'string' || !('if' in tree)) return normalizeLeaf(tree, hostType)
  return { if: abstract(tree.if as Cond, hostType), then: normalizeTree(tree.then, hostType), else: normalizeTree(tree.else ?? 'inherit', hostType) }
}

export const normalKey = (tree: Tree, hostType: string): string => canonical(normalizeTree(tree, hostType))

// ------------------------------------------------------------------ the evidence

/** `type|kind|hole` → how many questions were answered there (every patch the log took, live or since removed). */
export function askedCounts(library: WorldLibrary): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of library.log) {
    if (!('patch' in e)) continue
    for (const a of e.patch.artifacts) {
      if (a.kind !== 'rule' || !a.rule) continue
      const r = { ...a.rule, source: { origin: 'patch' as const } }
      if (!placed(r)) continue
      const key = `${r.host!.type}|${r.on}|${r.hole}`
      out.set(key, (out.get(key) ?? 0) + 1)
    }
  }
  return out
}

const splitKey = (key: string): { type: string; kind: string; hole: string } | undefined => {
  const i = key.indexOf('|')
  const j = key.indexOf('|', i + 1)
  return i < 0 || j < 0 ? undefined : { type: key.slice(0, i), kind: key.slice(i + 1, j), hole: key.slice(j + 1) }
}

/**
 * The candidates in the library now. `sweepCounts`: `type|kind|hole` → questions asked (askedCounts,
 * and the sweep's undefined cells at 0): it widens what a class is known to reach at a hole, and
 * carries the S2 signal; without it, a class reaches only the types in its group.
 */
export function candidates(library: WorldLibrary, onto: Ontology, sweepCounts?: Map<string, number>, o: Partial<typeof PROMOTE> = {}): Candidate[] {
  const { K, S, N } = { ...PROMOTE, ...o }
  // (a type the sweep names that neither the base nor a patch defines any more reaches nothing)
  const known = (t: string) => t in onto.types || library.lib.types.some((x) => x.id === t)
  const out: Candidate[] = []
  const live = library.patchRules().filter(placed)
  const groups = new Map<string, Rule[]>()
  for (const r of live) {
    const g = `${r.on}|${r.hole}`
    groups.set(g, [...(groups.get(g) ?? []), r])
  }
  // every type known to reach a (kind, hole): the group's own, and the sweep's
  const reached = (kind: string, hole: string, under: string): Set<string> => {
    const set = new Set<string>()
    for (const r of groups.get(`${kind}|${hole}`) ?? []) if (isA(r.host!.type!, under)) set.add(r.host!.type!)
    for (const key of sweepCounts?.keys() ?? []) {
      const k = splitKey(key)
      if (k && k.kind === kind && k.hole === hole && isA(k.type, under) && known(k.type)) set.add(k.type)
    }
    return set
  }

  // S1: sibling convergence
  for (const rules of groups.values()) {
    const [kind, hole] = [rules[0].on, rules[0].hole!]
    const clusters = new Map<string, Rule[]>()
    for (const r of rules) {
      const n = normalKey(r.tree, r.host!.type!)
      clusters.set(n, [...(clusters.get(n) ?? []), r])
    }
    for (const [normalized, members] of clusters) {
      const types = [...new Set(members.map((r) => r.host!.type!))].sort()
      if (types.length < K) continue
      const ancestor = lowestCommonAncestor(types)
      if (!ancestor) continue
      const share = types.length / reached(kind, hole, ancestor).size
      if (share < S) continue
      out.push({ kind, hole, ancestor, types, rules: members, share, signal: 'S1', normalized })
    }
  }

  // S2: a class asked about N times at one hole, with no cluster to show for it
  if (sweepCounts) {
    const perHole = new Map<string, Map<string, number>>() // kind|hole → type → asked
    for (const [key, n] of sweepCounts) {
      const k = splitKey(key)
      if (!k || !n) continue
      const m = perHole.get(`${k.kind}|${k.hole}`) ?? new Map<string, number>()
      m.set(k.type, (m.get(k.type) ?? 0) + n)
      perHole.set(`${k.kind}|${k.hole}`, m)
    }
    for (const [g, byType] of perHole) {
      const i = g.indexOf('|')
      const [kind, hole] = [g.slice(0, i), g.slice(i + 1)]
      const byClass = new Map<string, number>()
      for (const [type, n] of byType) for (const c of classesOf(type)) byClass.set(c, (byClass.get(c) ?? 0) + n)
      const qualifying = [...byClass].filter(([, n]) => n >= N).map(([c]) => c)
      for (const ancestor of qualifying) {
        // the narrowest class that qualifies: a wider one only repeats its evidence
        if (qualifying.some((c) => c !== ancestor && isA(c, ancestor))) continue
        if (out.some((c) => c.signal === 'S1' && c.kind === kind && c.hole === hole && (isA(c.ancestor, ancestor) || isA(ancestor, c.ancestor)))) continue
        const types = [...byType.keys()].filter((t) => isA(t, ancestor)).sort()
        const rules = (groups.get(g) ?? []).filter((r) => isA(r.host!.type!, ancestor))
        out.push({ kind, hole, ancestor, types, rules, share: types.length / reached(kind, hole, ancestor).size, signal: 'S2', asked: byClass.get(ancestor) })
      }
    }
  }
  return out.sort((a, b) => a.signal.localeCompare(b.signal) || b.share - a.share || a.ancestor.localeCompare(b.ancestor))
}
