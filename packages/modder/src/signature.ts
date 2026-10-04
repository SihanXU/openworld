// What kind of work a request is, as plain terms: the event kind, the hole it reached, the host's
// type chain, each other role's type chain, tags and statuses, the params that branch outcomes.
// Memory is retrieved by these terms (no embeddings: deterministic, inspectable), and the key
// groups requests that are the same class of undefined outcome.

import type { EntityInfo, ModRequest } from '@lsw/engine'

export interface Signature {
  /** hole | kind | host type | other roles' types | branching params | host statuses: the class of the outcome. */
  key: string
  terms: string[]
}

/** Params that branch outcomes (as the engine's own signature counts them). */
const BRANCHING = ['verb', 'element', 'edge', 'how', 'status', 'name', 'act', 'owner', 'activity', 'invariant', 'what', 'substance', 'which', 'into']

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
    .filter(([k]) => BRANCHING.includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
  const others = Object.entries(ev.roles).filter(([k]) => k !== 'actor' && k !== 'source')
  const terms = [
    ...ev.kind.split('/').map((_, i, a) => `kind:${a.slice(0, i + 1).join('/')}`),
    `hole:${req.hole.rule}`,
    ...params.map((p) => `param:${p}`),
    ...roleTerms('host', ev.host),
    ...Object.entries(ev.roles).flatMap(([k, e]) => roleTerms(k, e)),
    `map:${req.context.map.kind}`,
  ]
  const key = [
    `${req.hole.rule}${req.hole.path.length ? '#' + req.hole.path.join('&') : ''}`,
    ev.kind,
    ev.host?.type ?? '-',
    others
      .map(([k, e]) => `${k}=${e?.type ?? '-'}`)
      .sort()
      .join(','),
    params.join(','),
    [...(ev.host?.statuses ?? [])].sort().join('+'),
  ].join('|')
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
