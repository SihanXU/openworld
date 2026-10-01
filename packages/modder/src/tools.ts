// The design stage's tools. The modder explores the world's code the way a coding agent
// explores a codebase: search the rule library, read a rule, look up types, dry-run a draft
// against the real validator and sandbox, read its own skills and past episodes.

import {
  OntologyIndex,
  ROLES,
  SANDBOX_MAP,
  isA,
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
  type ValidationResult,
} from '@lsw/engine'
import type { ToolSpec } from './model.ts'
import type { SelfState } from './state.ts'

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
        'Search the rule library (base rules and accepted patches). Filter by verb, by a type that some role selects (either direction of is-a), by a tag or status a role requires, or by text in the id/doc. Returns one compact line per rule; open one with get_rule. Use it to find the conventions in force before writing a rule, and to check what a new rule could collide with.',
      parameters: {
        type: 'object',
        properties: {
          verb: { type: 'string', description: 'take | put | interact' },
          on: { type: 'string', description: 'event kind, default interaction' },
          type: { type: 'string', description: 'a type id, e.g. item/tool or actor/creature/slime' },
          tag: { type: 'string', description: 'a tag some role selects, e.g. liquid:water' },
          status: { type: 'string', description: 'a status some role or the event names, e.g. burning' },
          text: { type: 'string', description: 'substring of the rule id or doc' },
          limit: { type: 'number' },
        },
      },
      run: (a) => {
        const on = str(a.on) || 'interaction'
        const verb = str(a.verb)
        const type = str(a.type)
        const tag = str(a.tag)
        const status = str(a.status)
        const text = str(a.text).toLowerCase()
        const sels = (r: Rule): Selector[] => ROLES.map((role) => r.when[role]).filter((s): s is Selector => !!s)
        const hits = ctx.library.forKind(on).filter((r) => {
          if (verb && r.when.verb && !r.when.verb.includes(verb as 'take')) return false
          if (type && !sels(r).some((s) => s.type && (isA(s.type, type) || isA(type, s.type)))) return false
          if (tag && !sels(r).some((s) => s.tags?.includes(tag) || s.notTags?.includes(tag))) return false
          if (status && !(r.when.status?.includes(status) || sels(r).some((s) => s.status?.includes(status) || s.notStatus?.includes(status)))) return false
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
      description: 'Read one rule in full (pattern, guard, effects, tests) by id. Tests are good examples of scenarios.',
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
          out.push(`${id} [${r.kind}] ${r.tags.join(',')}`)
        }
        if (!out.length) return '(no type matches)'
        return out.slice(0, 80).join('\n') + (out.length > 80 ? `\n… ${out.length - 80} more` : '')
      },
    },
    {
      name: 'get_type',
      description: 'Resolve one type: its ancestor chain, kind, all tags (inherited) and default props.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: (a) => {
        const id = str(a.id)
        if (id.startsWith('tile/')) {
          const t = ctx.ontology.terrains[id.slice(5)]
          return t ? JSON.stringify({ kind: 'tile', ...t, id }) : `(no terrain "${id.slice(5)}")`
        }
        if (!(id in ctx.ontology.types)) return `(no type "${id}")`
        const r = index.resolve(id)
        return JSON.stringify({ id, kind: r.kind, chain: r.chain, tags: r.tags, props: r.props, name: r.name ? textOf(r.name) : undefined })
      },
    },
    {
      name: 'dry_run',
      description:
        'Run a draft patch through the real validator (schema, ontology, conflicts, sandbox replay of the triggering interaction, the patch\'s own tests, regression) WITHOUT applying it, and show what the triggering interaction does under it. Pass `scenario` to replay another situation instead (e.g. to check the rule generalizes). Always dry-run before answering.',
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
        for (const o of res.overrides) lines.push(`overrides: ${o}`)
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
        const ep = ctx.state.episode(str(a.id))
        if (!ep) return `(no episode "${str(a.id)}")`
        return JSON.stringify({
          summary: ep.request.summary,
          outcome: ep.outcome,
          attempts: ep.attempts.map((t) => ({ phase: t.phase, errors: t.errors, review: t.review })),
          patch: ep.patch,
        })
      },
    },
  ]
  return all.filter((t) => allowed.includes(t.name))
}

/** One line per rule: enough to see its pattern and what it does. */
export function compactRule(r: Rule): string {
  const sel = (s?: Selector) => (s ? JSON.stringify(s).replace(/"/g, '') : '')
  const roles = ROLES.filter((role) => r.when[role]).map((role) => `${role}${sel(r.when[role])}`)
  const extra = [r.when.element?.length ? `element=${r.when.element.join(',')}` : '', r.when.status?.length ? `status=${r.when.status.join(',')}` : '', r.guard ? 'guard' : '', r.compose ? 'compose' : '']
  return [`${r.id} [${r.on}${r.when.verb ? ` ${r.when.verb.join(',')}` : ''}]`, ...roles, ...extra.filter(Boolean), `do: ${r.do.map((e) => e.op).join(',')}`, r.doc ? `— ${r.doc}` : ''].filter(Boolean).join(' ')
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
    for (const a of patch.artifacts) if (a.kind === 'rule' && a.rule?.id && a.rule.on && a.rule.when && Array.isArray(a.rule.do)) lib.add({ ...a.rule, source: { origin: 'patch' } })
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
  const out = [`outcome: ${rp.resolution.defined ? `resolved by ${rp.resolution.rule!.id}` : 'still UNDEFINED'}${rp.resolution.composed?.length ? ` (+ ${rp.resolution.composed.map((r) => r.id).join(', ')})` : ''}`]
  for (const e of rp.errors) out.push(`runtime: ${e}`)
  for (const f of w.fx) {
    if (f.t === 'log') out.push(`log: ${textOf(f.text)}`)
    if (f.t === 'say') out.push(`say (${f.who}): ${textOf(f.text)}`)
    if (f.t === 'vfx') out.push(`vfx: ${f.fx} at ${f.x},${f.y}`)
    if (f.t === 'damage') out.push(`damage: ${f.who} ${f.amount}${f.element ? ` ${f.element}` : ''}`)
  }
  const before = buildSandbox(sc, onto, lib).world
  const where = (e: Entity) => (e.place.on === 'tile' ? `tile ${e.place.x},${e.place.y}` : e.place.on === 'none' ? 'nowhere' : `${e.place.on}:${e.place.holder}`)
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
      const st = Object.keys(w.tileState(SANDBOX_MAP, x, y)?.statuses ?? {})
      if (st.length) out.push(`tile ${x},${y}: ${st.join(',')}`)
    }
  if (out.length === 1) out.push('(no visible effect: give the player feedback)')
  return out.join('\n')
}
