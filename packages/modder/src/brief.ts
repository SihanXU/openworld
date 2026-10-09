// The brief: what the modder would otherwise fetch with a dozen tool round trips, assembled by
// code before the first call. In measured episodes most design time went to repeated
// search_rules calls (up to 26 per episode), each a full model turn; all of them look for the
// same few things — the roles' types, and the rules that already speak about this host or this
// kind. Those are deterministic queries, so they run here.

import { OntologyIndex, isA, kindCovers, type EntityInfo, type ModRequest, type Ontology, type Rule, type RuleLibrary, type Selector } from '@lsw/engine'
import { compactRule } from './tools.ts'

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
  if (req.hole.soft) {
    const from = lib.rules.get(req.hole.rule)
    out.push(`- inherited: here ${ev.host?.type ?? 'the host'} answers as ${req.hole.rule}${from?.host ? ` (written for ${JSON.stringify(from.host)})` : ''} does: ${JSON.stringify(req.hole.default)}. Your rule takes this place only (what ${ev.host?.type ?? 'the type'} does here instead, or the same with more); \`inherit\` keeps it.`)
  } else out.push(`- undefined at: ${req.hole.rule}${req.hole.path.length ? ` (branches ${req.hole.path.join(' → ')})` : ''}; while nobody answers: ${req.hole.default.length ? JSON.stringify(req.hole.default) : 'nothing happens'}`)
  if (ev.detail) out.push(`- detail: ${ev.detail}`)
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
