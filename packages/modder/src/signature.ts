// What kind of work a request is, as plain terms: the verb, each role's type chain, tags and
// statuses. Memory is retrieved by these terms (no embeddings: deterministic, inspectable),
// and the key groups requests that are the same interaction class.

import type { EntityInfo, ModRequest } from '@lsw/engine'

export interface Signature {
  /** verb | target type | instrument type | target statuses: the interaction class. */
  key: string
  terms: string[]
}

const ROLES = ['actor', 'target', 'instrument'] as const

function roleTerms(role: string, e: EntityInfo | undefined): string[] {
  if (!e) return [`${role}:none`]
  const out = new Set<string>()
  const chain = e.typeChain?.length ? e.typeChain : [e.type]
  // every ancestor, so "a sword" and "an axe" share item/tool/…
  for (const t of chain) {
    const parts = t.split('/')
    for (let i = 1; i <= parts.length; i++) out.add(`${role}:${parts.slice(0, i).join('/')}`)
  }
  out.add(`${role}:kind:${e.kind}`)
  for (const t of e.tags ?? []) out.add(`${role}#${t}`)
  for (const s of e.statuses ?? []) out.add(`${role}!${s}`)
  if (e.type === 'actor/person/player') out.add(`${role}:player`)
  return [...out]
}

export function signatureOf(req: ModRequest): Signature {
  const ev = req.event
  const terms = [`verb:${ev.verb}`, ...ROLES.flatMap((r) => roleTerms(r, ev[r])), `map:${req.context.map.kind}`]
  const key = [ev.verb, ev.target?.type ?? '-', ev.instrument?.type ?? 'hand', [...(ev.target?.statuses ?? [])].sort().join('+')].join('|')
  return { key, terms }
}

/** The coarse terms a lesson learned from this request should be filed under. */
export function coarseTerms(sig: Signature): string[] {
  return sig.terms.filter((t) => {
    if (t.startsWith('verb:')) return true
    if (t.startsWith('actor')) return false
    if (/^(target|instrument):(kind:|none)/.test(t)) return true
    if (/^(target|instrument)#/.test(t)) return !/#(material|quality):/.test(t)
    const m = /^(target|instrument):([^:]+)$/.exec(t)
    return !!m && m[2].split('/').length <= 2
  })
}

/** Overlap of two term sets, weighted toward the smaller one (a short lesson can match a long request). */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const sb = new Set(b)
  let n = 0
  for (const t of a) if (sb.has(t)) n++
  return n / Math.sqrt(a.length * b.length)
}
