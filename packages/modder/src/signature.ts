// What kind of work a request is, as plain terms: the event kind, the hole it reached, the host's
// type chain, each other role's type chain, tags and statuses, the params that branch outcomes.
// Memory is retrieved by these terms (no embeddings: deterministic, inspectable), and the key
// groups requests that are the same class of undefined outcome.

import { BRANCHING_PARAMS, cellSignature, classKey, holeKey, type EntityInfo, type ModRequest } from '@lsw/engine'

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
    ...(req.hole.soft ? ['soft'] : []),
    ...params.map((p) => `param:${p}`),
    ...roleTerms('host', ev.host),
    ...Object.entries(ev.roles).flatMap(([k, e]) => roleTerms(k, e)),
    `map:${req.context.map.kind}`,
  ]
  // the class, as the client's port keys it (the engine's classKey: one definition)
  const self = (e: EntityInfo | undefined) => !!e?.id && e.id === ev.host?.id
  // (a soft hole is one question per type, kind and inherited rule: what this type does instead)
  const key = req.hole.soft ? cellSignature(ev.host?.type ?? '-', ev.kind, req.hole.rule) : classKey({ hole: holeKey(req.hole.rule, req.hole.path), kind: ev.kind, host: ev.host?.type ?? '-', roles: Object.entries(ev.roles).map(([k, e]) => [k, self(e) ? 'self' : e?.type ?? '-']), params: ev.params })
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

export { similarity } from '@lsw/agent'
