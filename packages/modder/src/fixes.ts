// Deterministic repairs. A model repair round costs a full turn (5–10 s); most first answers
// that fail validation fail for mechanical reasons the harness can fix itself. Measured on
// the latency bench, every malformed first answer had a correct rule inside the wrong wrapper.
// Each fix is recorded on the attempt, so the episode shows what was changed and why.

import { PRIMITIVES, selectByType, type Artifact, type Cond, type Effect, type ModRequest, type Ontology, type Patch, type Rule, type Selector, type Tree, type ValidationResult } from '@lsw/engine'

const looksLikeRule = (x: Record<string, unknown>) => typeof x.on === 'string' && (!!x.tree || Array.isArray(x.do))

/**
 * Bring a draft into the Patch shape: a bare rule, a list of rules, or an artifact with the
 * rule's fields spread on it all become `{ kind: 'rule', rule }`; a rule written as a flat
 * `do` list (with an optional `if`) gets that as its tree.
 */
export function normalizePatch(x: unknown): { patch?: Patch; fixes: string[] } {
  const fixes: string[] = []
  if (!x || typeof x !== 'object') return { fixes }
  let o = x as Record<string, unknown>
  if (o.patch && typeof o.patch === 'object') o = o.patch as Record<string, unknown>
  let items: unknown[] | undefined = Array.isArray(o.artifacts) ? o.artifacts : undefined
  if (!items && Array.isArray(o.rules)) (items = o.rules), fixes.push('read "rules" as artifacts')
  if (!items && o.rule && typeof o.rule === 'object') (items = [o]), fixes.push('read a single artifact as the patch')
  if (!items && looksLikeRule(o)) (items = [o]), fixes.push('read a bare rule as the patch')
  if (!items) return { fixes }
  const artifacts: Artifact[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const a = it as Record<string, unknown>
    if (a.kind === 'rule' && a.rule && typeof a.rule === 'object') {
      artifacts.push({ kind: 'rule', rule: treeOf(a.rule as Record<string, unknown>, fixes) })
      continue
    }
    if ((a.kind === 'type' && a.type) || (a.kind === 'status' && a.status)) {
      artifacts.push(a as unknown as Artifact)
      continue
    }
    if (looksLikeRule(a)) {
      const { kind: _k, ...rule } = a
      artifacts.push({ kind: 'rule', rule: treeOf(rule, fixes) })
      fixes.push(`wrapped rule "${String(a.id)}" as {kind:"rule", rule}`)
      continue
    }
    if (a.kind === 'type' || a.kind === 'status') {
      const { kind, ...def } = a
      artifacts.push(kind === 'type' ? ({ kind: 'type', type: def } as unknown as Artifact) : ({ kind: 'status', status: def } as unknown as Artifact))
      fixes.push(`wrapped ${String(kind)} "${String(a.id)}"`)
      continue
    }
    artifacts.push(a as unknown as Artifact) // let the validator say what is wrong with it
  }
  // there are no kinds (world-model.md §4.1): a selector naming one selects by that root type
  for (const a of artifacts) {
    if (a?.kind !== 'rule' || !a.rule) continue
    const before = JSON.stringify(a.rule)
    selectByType(a.rule)
    if (JSON.stringify(a.rule) !== before) fixes.push(`rule "${a.rule.id}" selected by kind: now by its root type`)
  }
  return { patch: { ...(o as object), artifacts } as Patch, fixes }
}

/** A rule with `do` (and maybe `if`) beside its tree instead of in it; effects keyed by their op. */
function treeOf(r: Record<string, unknown>, fixes: string[]): Rule {
  const id = String(r.id)
  if (r.tree) return { ...(r as object), tree: flatEffects(r.tree as Tree, id, fixes) } as Rule
  if (!Array.isArray(r.do)) return r as unknown as Rule
  const { do: effects, if: cond, ...rest } = r
  const leaf = flatEffects({ do: effects as Effect[] }, id, fixes)
  fixes.push(`moved the effects of "${id}" into its tree`)
  return { ...(rest as object), tree: cond ? { if: cond as Cond, then: leaf } : leaf } as Rule
}

/** An effect written as `{spawn: {type, at}}` is `{op: 'spawn', type, at}`: the op is its only key. */
function flatEffects(t: Tree, id: string, fixes: string[]): Tree {
  if (!t || typeof t !== 'object') return t
  if ('if' in t) return { ...t, then: flatEffects(t.then, id, fixes), ...(t.else !== undefined ? { else: flatEffects(t.else, id, fixes) } : {}) }
  if (!('do' in t) || !Array.isArray(t.do)) return t
  let n = 0
  const effects = t.do.map((e) => {
    const o = e as unknown as Record<string, unknown>
    const keys = o && typeof o === 'object' && !('op' in o) ? Object.keys(o) : []
    if (keys.length !== 1 || !(keys[0] in PRIMITIVES)) return e
    const args = o[keys[0]]
    n++
    return { op: keys[0], ...(args && typeof args === 'object' ? args : {}) } as Effect
  })
  if (n) fixes.push(`flattened ${n} effect(s) of "${id}" written as {op: {...}} into {op, ...}`)
  return n ? { ...t, do: effects } : t
}

/**
 * A rule that answers a broader kind than the one asked (`impulse` for `impulse/strike`) and so
 * ties with another patch there: narrow it to the requested kind. Returns the narrowed patch, or
 * undefined when that is not the problem.
 */
export function narrowKinds(patch: Patch, req: ModRequest, res: ValidationResult): { patch: Patch; fixes: string[] } | undefined {
  if (!res.errors.some((e) => e.includes(' ties with '))) return undefined
  const kind = req.event.kind
  const fixes: string[] = []
  const artifacts = patch.artifacts.map((a) => {
    if (a.kind !== 'rule' || a.rule.on === kind || !kind.startsWith(a.rule.on + '/')) return a
    if (!res.errors.some((e) => e.includes(`"${a.rule.id}"`))) return a
    fixes.push(`narrowed "${a.rule.id}" from ${a.rule.on} to ${kind}`)
    return { kind: 'rule' as const, rule: { ...a.rule, on: kind } }
  })
  return fixes.length ? { patch: { ...patch, artifacts }, fixes } : undefined
}

/**
 * A selector naming a terrain by its bare id (`{type: "bush"}`) means the tile type `tile/bush`:
 * qualify it, in the host and in every `is` condition, when no type of that name exists.
 */
export function qualifyTerrains(patch: Patch, onto: Ontology): { patch: Patch; fixes: string[] } {
  const fixes: string[] = []
  const types = new Set([...Object.keys(onto.types), ...patch.artifacts.flatMap((a) => (a.kind === 'type' && a.type?.id ? [a.type.id] : []))])
  const sel = (s: Selector | undefined, id: string): Selector | undefined => {
    if (!s?.type || s.type.startsWith('tile/') || types.has(s.type) || !(s.type in onto.terrains)) return s
    fixes.push(`read type "${s.type}" in "${id}" as the terrain "tile/${s.type}"`)
    return { ...s, type: `tile/${s.type}` }
  }
  const cond = (c: Cond, id: string): Cond => {
    if ('all' in c) return { all: c.all.map((x) => cond(x, id)) }
    if ('any' in c) return { any: c.any.map((x) => cond(x, id)) }
    if ('not' in c) return { not: cond(c.not, id) }
    if ('is' in c) return { is: { ...c.is, sel: sel(c.is.sel, id)! } }
    return c
  }
  const tree = (t: Tree, id: string): Tree => (t && typeof t === 'object' && 'if' in t ? { if: cond(t.if, id), then: tree(t.then, id), ...(t.else !== undefined ? { else: tree(t.else, id) } : {}) } : t)
  const artifacts = patch.artifacts.map((a) => (a.kind === 'rule' && a.rule ? { ...a, rule: { ...a.rule, host: sel(a.rule.host, a.rule.id), tree: tree(a.rule.tree, a.rule.id) } } : a))
  return { patch: fixes.length ? { ...patch, artifacts } : patch, fixes }
}
