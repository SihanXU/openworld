// Deterministic repairs. A model repair round costs a full turn (5–10 s); most first answers
// that fail validation fail for mechanical reasons the harness can fix itself. Measured on
// the latency bench, every malformed first answer had a correct rule inside the wrong wrapper,
// and the most common real conflict came from a verb the player did not use. Each fix is
// recorded on the attempt, so the episode shows what was changed and why.

import type { Artifact, ModRequest, Patch, Rule, ValidationResult } from '@lsw/engine'

const looksLikeRule = (x: Record<string, unknown>) => typeof x.on === 'string' && !!x.when && Array.isArray(x.do)

/**
 * Bring a draft into the Patch shape: a bare rule, a list of rules, or an artifact with the
 * rule's fields spread on it all become `{ kind: 'rule', rule }`.
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
    if ((a.kind === 'rule' && a.rule && typeof a.rule === 'object') || (a.kind === 'type' && a.type) || (a.kind === 'status' && a.status)) {
      artifacts.push(a as unknown as Artifact)
      continue
    }
    if (looksLikeRule(a)) {
      const { kind: _k, ...rule } = a
      artifacts.push({ kind: 'rule', rule: rule as unknown as Rule })
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
  return { patch: { ...(o as object), artifacts } as Patch, fixes }
}

/**
 * A rule that conflicts only because it also claims verbs the player did not use: keep the
 * requested verb. Returns the narrowed patch, or undefined when that is not the problem.
 */
export function narrowVerbs(patch: Patch, req: ModRequest, res: ValidationResult): { patch: Patch; fixes: string[] } | undefined {
  if (!res.errors.some((e) => e.includes('at equal specificity'))) return undefined
  const verb = req.event.verb
  const fixes: string[] = []
  const artifacts = patch.artifacts.map((a) => {
    if (a.kind !== 'rule' || a.rule.on !== 'interaction' || !a.rule.when?.verb?.includes(verb as 'take') || a.rule.when.verb.length < 2) return a
    if (!res.errors.some((e) => e.includes(`"${a.rule.id}" conflicts`))) return a
    fixes.push(`narrowed "${a.rule.id}" from verbs [${a.rule.when.verb.join(', ')}] to [${verb}]`)
    return { kind: 'rule' as const, rule: { ...a.rule, when: { ...a.rule.when, verb: [verb as 'take'] } } }
  })
  return fixes.length ? { patch: { ...patch, artifacts }, fixes } : undefined
}
