// The design stage's tools. The modder explores the world's code the way a coding agent
// explores a codebase: search the rule library, read a rule, look up types, dry-run a draft
// against the real validator and sandbox, read its own skills and past episodes.

import {
  OntologyIndex,
  SANDBOX_MAP,
  isA,
  kindCovers,
  buildSandbox,
  replay,
  textOf,
  type Entity,
  type ModRequest,
  type Ontology,
  type Patch,
  type Rule,
  type RuleLibrary,
  type Scenario,
  type Selector,
  type Tree,
  type ValidationResult,
} from '@lsw/engine'
import type { ToolSpec } from '@lsw/agent'
import type { SelfState } from '@lsw/agent'

export interface Tool extends ToolSpec {
  run(args: Record<string, unknown>): string
}

export interface ToolContext {
  library: RuleLibrary
  ontology: Ontology
  request: ModRequest
  state: SelfState
  validate: (patch: Patch) => ValidationResult
  /** Filled as skills are read (their outcomes are booked to them). */
  skillsRead: string[]
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))

export function buildTools(ctx: ToolContext, allowed: string[]): Tool[] {
  const index = new OntologyIndex(ctx.ontology)
  const all: Tool[] = [
    {
      name: 'search_rules',
      description:
        'Search the rule library (base rules and accepted patches). Filter by event kind (or a branch such as "impulse"), by the host type (either direction of is-a), by a tag or status the host or a condition names, or by text in the id/doc. Returns one compact line per rule; open one with get_rule. Use it to find the conventions in force before writing a rule, and to check what a new rule could collide with.',
      parameters: {
        type: 'object',
        properties: {
          on: { type: 'string', description: 'an event kind or branch, e.g. act/use, impulse/strike, contact' },
          host: { type: 'string', description: 'a type id the host is, e.g. fixture/nature or actor/creature/slime' },
          tag: { type: 'string', description: 'a tag the host or a condition names, e.g. liquid:water' },
          status: { type: 'string', description: 'a status the host or a condition names, e.g. burning' },
          text: { type: 'string', description: 'substring of the rule id or doc' },
          limit: { type: 'number' },
        },
      },
      run: (a) => {
        const on = str(a.on)
        const type = str(a.host) || str(a.type)
        const tag = str(a.tag)
        const status = str(a.status)
        const text = str(a.text).toLowerCase()
        const hits = [...ctx.library.rules.values()].filter((r) => {
          if (on && !(kindCovers(r.on, on) || kindCovers(on, r.on))) return false
          const h = r.host ?? {}
          if (type && !(h.type && (isA(h.type, type) || isA(type, h.type)))) return false
          const tree = JSON.stringify(r.tree)
          if (tag && !(h.tags?.includes(tag) || h.notTags?.includes(tag) || tree.includes(`"${tag}"`))) return false
          if (status && !(h.status?.includes(status) || h.notStatus?.includes(status) || tree.includes(`"${status}"`))) return false
          if (text && !`${r.id} ${r.doc ?? ''}`.toLowerCase().includes(text)) return false
          return true
        })
        const limit = Math.min(40, Number(a.limit) || 20)
        if (!hits.length) return '(no rule matches)'
        return hits.slice(0, limit).map(compactRule).join('\n') + (hits.length > limit ? `\n… ${hits.length - limit} more (narrow the search)` : '')
      },
    },
    {
      name: 'get_rule',
      description: 'Read one rule in full (host, kind, tree, tests) by id. Tests are good examples of scenarios.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: (a) => {
        const r = ctx.library.rules.get(str(a.id))
        if (!r) return `(no rule "${str(a.id)}")`
        const { source, ...rest } = r
        return JSON.stringify({ ...rest, origin: source?.origin ?? 'base' })
      },
    },
    {
      name: 'find_types',
      description: 'List ontology types under a prefix and/or carrying a tag (inherited tags count). Returns id [kind] tags.',
      parameters: { type: 'object', properties: { prefix: { type: 'string' }, tag: { type: 'string' } } },
      run: (a) => {
        const prefix = str(a.prefix)
        const tag = str(a.tag)
        const out: string[] = []
        for (const id of Object.keys(ctx.ontology.types).sort()) {
          if (prefix && !isA(id, prefix)) continue
          const r = index.resolve(id)
          if (tag && !r.tags.includes(tag)) continue
          out.push(`${id} ${r.tags.join(',')}`)
        }
        if (!out.length) return '(no type matches)'
        return out.slice(0, 80).join('\n') + (out.length > 80 ? `\n… ${out.length - 80} more` : '')
      },
    },
    {
      name: 'get_type',
      description: 'Resolve one type: its ancestor chain, all tags (inherited) and default props.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: (a) => {
        const id = str(a.id)
        if (id.startsWith('tile/')) {
          const t = ctx.ontology.terrains[id.slice(5)]
          return t ? JSON.stringify({ ...t, id }) : `(no terrain "${id.slice(5)}")`
        }
        if (!(id in ctx.ontology.types)) return `(no type "${id}")`
        const r = index.resolve(id)
        return JSON.stringify({ id, chain: r.chain, tags: r.tags, props: r.props, name: r.name ? textOf(r.name) : undefined })
      },
    },
    {
      name: 'dry_run',
      description:
        'Run a draft patch through the real validator (schema, ontology, its place in the host type\'s tree, sandbox replay of the triggering event, the patch\'s own tests) WITHOUT applying it, and show what the triggering event does under it. Pass `scenario` to replay another situation instead. Always dry-run before answering.',
      parameters: {
        type: 'object',
        properties: { patch: { type: 'object', description: '{ "artifacts": [ { "kind": "rule", "rule": {…} } ] }' }, scenario: { type: 'object' } },
        required: ['patch'],
      },
      run: (a) => {
        const patch = asPatch(a.patch)
        if (!patch) return 'not a patch: expected { "artifacts": [...] }'
        const res = ctx.validate(patch)
        const lines = [res.ok ? 'VALID' : 'INVALID']
        for (const e of res.errors) lines.push(`error: ${e}`)
        for (const w of res.warnings) lines.push(`warning: ${w}`)
        const sc = (a.scenario as Scenario | undefined) ?? ctx.request.scenario
        lines.push('', describeOutcome(sc, patch, ctx))
        return lines.join('\n')
      },
    },
    {
      name: 'read_skill',
      description: 'Read one of your own skills (listed in the prompt) in full.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      run: (a) => {
        const name = str(a.name)
        const body = ctx.state.readSkill(name)
        if (body === undefined) return `(no active skill "${name}")`
        if (!ctx.skillsRead.includes(name)) ctx.skillsRead.push(name)
        return body
      },
    },
    {
      name: 'get_episode',
      description: 'Read one of your past episodes (listed in the prompt): the request, every attempt with the validator\'s diagnostics, and the final patch.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: (a) => {
        const ep = ctx.state.episode(str(a.id)) as { summary: string; outcome: string; attempts: { phase: string; errors: string[]; review?: unknown }[]; patch?: unknown } | undefined
        if (!ep) return `(no episode "${str(a.id)}")`
        return JSON.stringify({
          summary: ep.summary,
          outcome: ep.outcome,
          attempts: ep.attempts.map((t) => ({ phase: t.phase, errors: t.errors, review: t.review })),
          patch: ep.patch,
        })
      },
    },
  ]
  return all.filter((t) => allowed.includes(t.name))
}

/** One line per rule: its host, its kind, and the shape of its tree. */
export function compactRule(r: Rule): string {
  const sel = (s?: Selector) => (s && Object.keys(s).length ? JSON.stringify(s).replace(/"/g, '') : '(any)')
  return [`${r.id} [${r.on}]`, `host${sel(r.host)}`, `tree: ${treeLine(r.tree)}`, r.doc ? `— ${r.doc}` : ''].filter(Boolean).join(' ')
}

/** A tree in one line: branches as `cond ? then : else`, leaves as their ops. */
function treeLine(t: Tree, depth = 0): string {
  if (t === 'inherit') return 'inherit'
  if ('undefined' in t) return 'UNDEFINED'
  if ('do' in t) return t.do.length ? t.do.map((e) => (e.op === 'emit' ? `emit:${e.impulse}` : e.op)).join(',') : 'nothing'
  if (depth > 3) return '…'
  const c = JSON.stringify(t.if).replace(/"/g, '')
  return `(${c.length > 70 ? c.slice(0, 67) + '…' : c} ? ${treeLine(t.then, depth + 1)} : ${treeLine(t.else ?? 'inherit', depth + 1)})`
}

export function asPatch(x: unknown): Patch | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as { artifacts?: unknown; patch?: unknown }
  if (Array.isArray(o.artifacts)) return o as Patch
  if (o.patch) return asPatch(o.patch)
  return undefined
}

/** What the scenario's event does under the library plus the draft: the rule that fires and every visible change. */
export function describeOutcome(sc: Scenario, patch: Patch, ctx: Pick<ToolContext, 'library' | 'ontology'>): string {
  const lib = ctx.library.clone()
  const onto: Ontology = { ...ctx.ontology, types: { ...ctx.ontology.types }, statuses: { ...ctx.ontology.statuses } }
  try {
    for (const a of patch.artifacts) {
      if (a.kind === 'type') onto.types[a.type.id] = a.type
      if (a.kind === 'status') onto.statuses[a.status.id] = a.status
    }
    for (const a of patch.artifacts) if (a.kind === 'rule' && a.rule?.id && a.rule.on && a.rule.tree) lib.add({ ...a.rule, source: { origin: 'patch' } })
  } catch (err) {
    return `outcome: (draft could not be loaded: ${(err as Error).message})`
  }
  let rp
  try {
    rp = replay(sc, onto, lib)
  } catch (err) {
    return `outcome: (${(err as Error).message})`
  }
  const w = rp.engine.world
  const out = [`outcome: ${rp.resolution.defined ? `resolved by ${rp.resolution.rule!.id}` : 'still UNDEFINED'}${rp.resolution.hole ? ` (the hole in ${rp.resolution.hole.rule.id})` : ''}`]
  for (const e of rp.errors) out.push(`runtime: ${e}`)
  for (const f of w.fx) {
    if (f.t === 'log') out.push(`log: ${textOf(f.text)}`)
    if (f.t === 'say') out.push(`say (${f.who}): ${textOf(f.text)}`)
    if (f.t === 'vfx') out.push(`vfx: ${f.fx} at ${f.x},${f.y}`)
    if (f.t === 'damage') out.push(`damage: ${f.who} ${f.amount}${f.element ? ` ${f.element}` : ''}`)
  }
  const before = buildSandbox(sc, onto, lib).world
  const where = (e: Entity) => (e.place.on === 'tile' ? `tile ${e.place.x},${e.place.y}` : e.place.on === 'none' || e.place.on === 'resident' || e.place.on === 'area' ? e.place.on : `${e.place.on}:${e.place.holder}`)
  for (const b of Object.values(before.state.entities)) {
    if (b.id === '__player') continue
    const e = w.get(b.id)
    if (!e) {
      out.push(`${b.id}: destroyed`)
      continue
    }
    const changes: string[] = []
    if (e.type !== b.type) changes.push(`type ${b.type} → ${e.type}`)
    const sb = new Set(Object.keys(b.statuses ?? {}))
    const sa = new Set(Object.keys(e.statuses ?? {}))
    for (const x of sa) if (!sb.has(x)) changes.push(`+${x}`)
    for (const x of sb) if (!sa.has(x)) changes.push(`-${x}`)
    for (const k of new Set([...Object.keys(b.props ?? {}), ...Object.keys(e.props ?? {})]))
      if (JSON.stringify(b.props?.[k]) !== JSON.stringify(e.props?.[k])) changes.push(`${k}: ${JSON.stringify(b.props?.[k])} → ${JSON.stringify(e.props?.[k])}`)
    if (where(b) !== where(e)) changes.push(`moved ${where(b)} → ${where(e)}`)
    if (e.tags?.join() !== b.tags?.join()) changes.push(`tags [${b.tags?.join(',') ?? ''}] → [${e.tags?.join(',') ?? ''}]`)
    if (changes.length) out.push(`${b.id}: ${changes.join(', ')}`)
  }
  for (const e of Object.values(w.state.entities)) if (!before.state.entities[e.id]) out.push(`spawned: ${e.type} (${where(e)})`)
  const rows = sc.terrain ?? []
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const t = w.terrainAt(SANDBOX_MAP, x, y)
      if (t !== rows[y][x]) out.push(`tile ${x},${y}: ${rows[y][x]} → ${t}`)
      const st = w.entitiesAt(SANDBOX_MAP, x, y).filter((c) => w.isTerrain(c)).flatMap((c) => Object.keys(c.statuses ?? {}))
      if (st.length) out.push(`tile ${x},${y}: ${st.join(',')}`)
    }
  if (out.length === 1) out.push('(no visible effect: give the player feedback)')
  return out.join('\n')
}
