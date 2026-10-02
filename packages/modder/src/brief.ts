// The brief: what the modder would otherwise fetch with a dozen tool round trips, assembled by
// code before the first call. In measured episodes most design time went to repeated
// search_rules calls (up to 26 per episode), each a full model turn; all of them look for the
// same few things — the roles' types, and the rules that already speak about this target or
// this instrument. Those are deterministic queries, so they run here.

import { OntologyIndex, ROLES, matchSelector, type EntityInfo, type ModRequest, type Ontology, type Rule, type RuleLibrary, type Selector, type View } from '@lsw/engine'
import { compactRule } from './tools.ts'

const MAX_RELATED = 24
const MAX_FULL = 4

const positive = (s?: Selector) => !!s && !!(s.type || s.tags?.length || s.status?.length || s.id)

function viewOf(e: EntityInfo): View {
  return { ref: { e: e.id ?? e.role }, kind: e.kind as View['kind'], type: e.type, tags: new Set(e.tags), statuses: new Set(e.statuses), props: e.props as View['props'], isPlayer: e.type === 'actor/person/player' }
}

/** Rules that speak about this target or this instrument, most relevant first. */
export function relatedRules(req: ModRequest, lib: RuleLibrary): Rule[] {
  const ev = req.event
  const near = new Set(req.context.nearMisses.map((r) => r.id))
  const scored: [number, Rule][] = []
  for (const r of lib.forKind('interaction')) {
    let score = near.has(r.id) ? 4 : 0
    for (const role of ['target', 'instrument'] as const) {
      const sel = r.when[role]
      const info = ev[role]
      if (!positive(sel) || !info) continue
      // the rule picks out this very role (by type, tags or status), whatever the other role is
      const { status: _s, notStatus: _n, props: _p, ...shape } = sel!
      if (matchSelector(shape, viewOf(info))) score += 3
      else if (sel!.tags?.some((t) => info.tags.includes(t))) score += 1
    }
    if (score < 3) continue
    if (r.when.verb?.includes(ev.verb as 'take')) score += 1
    scored.push([score, r])
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, r]) => r)
}

export function briefOf(req: ModRequest, lib: RuleLibrary, onto: Ontology): string {
  const index = new OntologyIndex(onto)
  const out = ['# Brief (prepared for you: the roles, and the rules that already speak about them)']
  const ev = req.event
  if (req.origin === 'world')
    out.push(`- the world did this by itself (${ev.kind}${ev.about ? `, about "${ev.about}"` : ''}${ev.status ? `, status ${ev.status}` : ''}${ev.element ? `, element ${ev.element}` : ''}): no player asked. Keep it small and legible; never harm a person; never touch the story's facts.`)
  if (ev.detail) out.push(`- detail: ${ev.detail}`)
  if (ev.kind === 'blocked' || ev.kind === 'invalid') out.push(`- anchors on this map (for goto): ${req.context.anchors?.join(', ') || '—'}`)
  for (const role of ROLES) {
    const e = req.event[role]
    if (!e) {
      out.push(`- ${role}: none (empty-handed)`)
      continue
    }
    let props = ''
    if (e.kind !== 'tile' && e.type in onto.types) {
      const r = index.resolve(e.type)
      props = Object.keys(r.props).length ? ` default props ${JSON.stringify(r.props)}` : ''
    }
    out.push(`- ${role}: ${e.name} — ${e.type} (chain ${e.typeChain.join(' > ')}); tags ${e.tags.join(', ') || '—'}; statuses ${e.statuses.join(', ') || '—'}${props}`)
  }
  const related = relatedRules(req, lib)
  out.push('', `## Rules about this target or this instrument (${related.length})`)
  out.push(...(related.length ? related.slice(0, MAX_RELATED).map(compactRule) : ['(none: this pair is new ground)']))
  if (related.length > MAX_RELATED) out.push(`… ${related.length - MAX_RELATED} more (search_rules if you need them)`)
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
