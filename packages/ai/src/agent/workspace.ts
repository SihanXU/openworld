// Active, read-only world and source queries shared by API agents and MCP clients.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, extname, relative, resolve, sep } from 'node:path'
import {
  creationMaps, researchCapabilities, workshopPackages,
  type CapabilityDescriptor, type Engine, type Entity, type Ontology, type Recipe, type Rule, type WorkshopPackage,
} from '@openworld/engine'
import type { AgentTool } from './tools.ts'

export type ContentKind = 'type' | 'status' | 'terrain' | 'element' | 'material' | 'rule' | 'recipe' | 'capability' | 'package' | 'map' | 'entity' | 'asset'
export interface CreatorContext {
  gameId: string
  /** Changes when the caller's world/catalogue or library changes. */
  revision: string
  ontology: Ontology
  entities?: Record<string, Entity>
  recipes?: Iterable<Recipe>
  rules?: Iterable<Rule>
  capabilities?: CapabilityDescriptor[]
  packages?: WorkshopPackage[]
  maps?: Record<string, unknown> | { id: string; [key: string]: unknown }[]
  /** The real renderer catalogue, keyed by category and asset ID, or a flat asset map. */
  assets?: Record<string, unknown>
}
export interface WorldRecord { kind: ContentKind; id: string; name?: unknown; data: unknown }
export interface SourceHit { path: string; line: number; text: string; score: number; test: boolean }
export interface WorkspaceOptions { root: string; context(): CreatorContext; maxFileBytes?: number }

const HASH = (s: string) => createHash('sha256').update(s).digest('hex')
const OBJECT = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const SKIP = new Set(['node_modules', '.git', '.tmp', '.agent', 'dist', 'build', 'assets', 'public', 'coverage'])
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.css'])
const text = (v: unknown) => typeof v === 'string' ? v : JSON.stringify(v) ?? ''
const capped = (n: unknown, fallback: number, max: number) => Math.max(1, Math.min(max, typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback))
const termsOf = (query: string): string[] => [...new Set([query.toLowerCase().trim(), ...(query.toLowerCase().match(/[a-z0-9_/-]{2,}|[\u3400-\u9fff]{1,}/g) ?? [])].filter(Boolean))]
const summary = (r: WorldRecord) => ({ kind: r.kind, id: r.id, ...(r.name !== undefined && { name: r.name }) })

/** Pixel grids and full map rows remain accessible by their source resource, not repeated in every query. */
function concise(value: unknown, depth = 0): unknown {
  if (depth > 7) return '[nested data]'
  if (Array.isArray(value)) return value.length > 48 ? { count: value.length, sample: value.slice(0, 12).map(v => concise(v, depth + 1)) } : value.map(v => concise(v, depth + 1))
  if (!OBJECT(value)) return typeof value === 'string' && value.length > 1600 ? value.slice(0, 1600) + '…' : value
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ['pixels', 'heights'].includes(k) && Array.isArray(v) ? { count: v.length, sha256: HASH(JSON.stringify(v)) } : k === 'rows' && Array.isArray(v) && v.length > 48 ? { count: v.length, sample: v.slice(0, 6), sha256: HASH(JSON.stringify(v)) } : concise(v, depth + 1)]))
}

/** No simulation is stepped, and no content definitions are synthesized by this adapter. */
export function engineCreatorContext(eng: Engine, options: { gameId: string; revision?: string; assets?: CreatorContext['assets']; maps?: CreatorContext['maps'] }): CreatorContext {
  const capabilities = researchCapabilities()
  return {
    gameId: options.gameId, revision: options.revision ?? `${eng.world.state.seed}:${eng.world.state.tick}:${eng.lib.version}:${HASH(JSON.stringify(capabilities)).slice(0, 12)}`,
    ontology: eng.world.onto.data, entities: eng.world.state.entities, recipes: eng.recipes.values(), rules: eng.lib.rules.values(),
    capabilities, packages: workshopPackages(eng),
    maps: options.maps ?? { ...eng.maps, ...Object.fromEntries(creationMaps(eng).map(m => [m.raw.map.id, { ...m.raw.map, package: m.id, revision: m.revision, enabled: m.enabled }])) },
    ...(options.assets && { assets: options.assets }),
  }
}

export class CreatorWorkspace {
  readonly root: string
  private revision?: string
  private indexed: WorldRecord[] = []
  private sourceCache = new Map<string, { stamp: string; lines: string[] }>()
  constructor(readonly options: WorkspaceOptions) { this.root = realpathSync(resolve(options.root)) }

  private records(): { context: CreatorContext; records: WorldRecord[] } {
    const context = this.options.context()
    if (this.revision === context.revision) return { context, records: this.indexed }
    const records: WorldRecord[] = []
    const dictionary = (kind: ContentKind, values: unknown) => {
      if (OBJECT(values)) for (const [id, data] of Object.entries(values)) records.push({ kind, id, ...(OBJECT(data) && data.name !== undefined && { name: data.name }), data })
    }
    dictionary('type', context.ontology.types)
    for (const kind of ['status', 'terrain', 'element', 'material'] as const) dictionary(kind, (context.ontology as unknown as Record<string, unknown>)[kind === 'status' ? 'statuses' : `${kind}s`])
    for (const rule of context.rules ?? []) records.push({ kind: 'rule', id: rule.id, data: rule })
    for (const recipe of context.recipes ?? []) records.push({ kind: 'recipe', id: recipe.id ?? recipe.make.type, data: recipe })
    for (const cap of context.capabilities ?? []) records.push({ kind: 'capability', id: cap.id, name: cap.label, data: cap })
    for (const pkg of context.packages ?? []) records.push({ kind: 'package', id: `${pkg.id}@${pkg.revision}`, name: pkg.typeDefinition?.name, data: pkg })
    dictionary('entity', context.entities)
    if (Array.isArray(context.maps)) for (const m of context.maps) records.push({ kind: 'map', id: m.id, name: m.name, data: m })
    else dictionary('map', context.maps)
    const assets = (values: Record<string, unknown>, prefix = '', level = 0) => {
      for (const [id, data] of Object.entries(values)) {
        if (OBJECT(data) && level < 2 && !['img', 'src', 'sprite', 'url', 'w', 'width', 'frames', 'pixels'].some(k => k in data)) assets(data, prefix + id + '/', level + 1)
        else records.push({ kind: 'asset', id: prefix + id, data })
      }
    }
    if (context.assets) assets(context.assets)
    this.revision = context.revision; this.indexed = records
    return { context, records }
  }

  search(query: string, kinds?: ContentKind[], limit = 12): unknown {
    if (!query.trim()) throw new Error('query must be non-empty')
    const { context, records } = this.records(), terms = termsOf(query), take = capped(limit, 12, 30)
    const matches = records.filter(r => !kinds?.length || kinds.includes(r.kind)).map(r => {
      const id = r.id.toLowerCase(), label = text(r.name).toLowerCase(), body = JSON.stringify(concise(r.data)).toLowerCase()
      const score = terms.reduce((s, term) => s + (id === term ? 100 : id.includes(term) ? 25 : 0) + (label.includes(term) ? 15 : 0) + (body.includes(term) ? 2 : 0), 0)
      return { r, score }
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id))
    return { gameId: context.gameId, revision: context.revision, total: matches.length, results: matches.slice(0, take).map(({ r, score }) => ({ ...summary(r), score })) }
  }

  inspect(id: string, kind?: ContentKind): unknown {
    const { context, records } = this.records()
    const found = records.filter(r => (!kind || kind === r.kind) && (r.id === id || r.kind === 'package' && r.id.split('@')[0] === id))
    if (!found.length) return { gameId: context.gameId, revision: context.revision, found: false, id, suggestions: this.search(id, kind ? [kind] : undefined, 6) }
    const related = records.filter(r => !found.includes(r) && ['recipe', 'package', 'rule'].includes(r.kind) && JSON.stringify(r.data).includes(id)).slice(0, 16).map(summary)
    const parents: WorldRecord[] = []
    if (found.some(r => r.kind === 'type')) {
      let p = id
      while (p.includes('/')) { p = p.slice(0, p.lastIndexOf('/')); const record = records.find(r => r.kind === 'type' && r.id === p); if (record) parents.push(record) }
    }
    const queries = [...new Set([id, ...parents.slice(0, 2).map(p => p.id)])]
    const implementation = queries.flatMap(q => this.searchImplementation(q, 5)).filter((hit, i, all) => all.findIndex(x => x.path === hit.path && x.line === hit.line) === i).slice(0, 10)
    return { gameId: context.gameId, revision: context.revision, found: true, records: found.map(r => ({ ...summary(r), data: concise(r.data) })), parents: parents.map(r => ({ ...summary(r), data: concise(r.data) })), related, implementation }
  }

  useTree(subject: string): unknown {
    const { context, records } = this.records()
    const entity = context.entities?.[subject], type = entity?.type ?? subject
    const packages = (context.packages ?? []).filter(p => p.typeId === type || p.id === subject).sort((a, b) => b.revision - a.revision)
    const capabilities = new Set(packages.flatMap(p => p.plan.uses.map(u => u.capability)))
    return { gameId: context.gameId, revision: context.revision, subject, typeId: type, packages: packages.map(p => ({ id: p.id, revision: p.revision, enabled: p.enabled, plan: p.plan, dependencies: p.dependsOn ?? [], capabilityVersions: p.capabilityVersions })), capabilities: records.filter(r => r.kind === 'capability' && capabilities.has(r.id)).map(r => ({ id: r.id, data: r.data })), next: packages.length ? 'Revise the existing package identity; do not manufacture another subject for a use-only change.' : 'No registered use tree exists for this subject; query capabilities and propose a new use package.' }
  }

  private files(): string[] {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue
        const path = resolve(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (EXT.has(extname(entry.name)) && statSync(path).size <= (this.options.maxFileBytes ?? 512_000)) files.push(path)
      }
    }
    for (const folder of ['packages', 'games', 'docs']) { const dir = resolve(this.root, folder); if (existsSync(dir)) walk(dir) }
    return files
  }

  private lines(path: string): string[] {
    const st = statSync(path), stamp = `${st.size}:${st.mtimeMs}`, old = this.sourceCache.get(path)
    if (old?.stamp === stamp) return old.lines
    const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n')
    this.sourceCache.set(path, { stamp, lines }); return lines
  }

  searchImplementation(query: string, limit = 12): SourceHit[] {
    if (!query.trim()) throw new Error('query must be non-empty')
    const terms = termsOf(query), hits: SourceHit[] = []
    for (const path of this.files()) {
      const name = basename(path).toLowerCase(), rel = relative(this.root, path).split(sep).join('/'), test = /(?:^|\/)(?:test|tests)\/|\.test\./.test(rel)
      this.lines(path).forEach((line, i) => {
        const lower = line.toLowerCase(), score = terms.reduce((s, term) => s + (lower.includes(term) ? term.includes('/') ? 10 : 4 : 0) + (name.includes(term) ? 2 : 0), 0)
        if (score) hits.push({ path: rel, line: i + 1, text: line.trim().slice(0, 360), score, test })
      })
    }
    return hits.sort((a, b) => b.score - a.score || Number(b.test) - Number(a.test) || a.path.localeCompare(b.path) || a.line - b.line).slice(0, capped(limit, 12, 30))
  }

  inspectImplementation(path: string, start = 1, end?: number): unknown {
    const file = resolve(this.root, path), rel = relative(this.root, file)
    if (rel === '..' || rel.startsWith(`..${sep}`) || /^[A-Za-z]:/.test(rel)) throw new Error('path must be inside the workspace')
    const real = realpathSync(file), actual = relative(this.root, real)
    if (actual === '..' || actual.startsWith(`..${sep}`)) throw new Error('path resolves outside the workspace')
    if (!EXT.has(extname(real))) throw new Error('Implementation queries read source/document formats only')
    if (statSync(real).size > (this.options.maxFileBytes ?? 512_000)) throw new Error('source file exceeds the query size limit')
    const lines = this.lines(real), first = capped(start, 1, Math.max(1, lines.length)), last = Math.min(lines.length, Math.max(first, Math.min(end ?? first + 119, first + 239)))
    const content = lines.slice(first - 1, last).join('\n')
    return { path: rel.split(sep).join('/'), start: first, end: last, totalLines: lines.length, sha256: HASH(readFileSync(real, 'utf8')), content, ...(last < lines.length && { nextLine: last + 1 }) }
  }
}

const input = { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] }
export function workspaceTools(workspace: CreatorWorkspace): AgentTool[] {
  return [
    { name: 'search_world', description: 'Search actual game definitions, world objects, capabilities, maps, assets and saved packages; returns IDs, not a fabricated database.', parameters: { ...input, properties: { ...input.properties, kinds: { type: 'array', items: { type: 'string', enum: ['type', 'status', 'terrain', 'element', 'material', 'rule', 'recipe', 'capability', 'package', 'map', 'entity', 'asset'] } } } }, run: a => JSON.stringify(workspace.search(String(a.query ?? ''), a.kinds as ContentKind[] | undefined, a.limit as number | undefined)) },
    { name: 'inspect_world', description: 'Inspect a real ID, its inherited type data, related recipes/packages/rules and source/test locations.', parameters: { type: 'object', properties: { id: { type: 'string' }, kind: { type: 'string' } }, required: ['id'] }, run: a => JSON.stringify(workspace.inspect(String(a.id ?? ''), a.kind as ContentKind | undefined)) },
    { name: 'get_use_tree', description: 'Read the saved use tree and pending ideas for a real entity, type or package, with revisions/dependencies and registered capability contracts.', parameters: { type: 'object', properties: { subject: { type: 'string' } }, required: ['subject'] }, run: a => JSON.stringify(workspace.useTree(String(a.subject ?? ''))) },
    { name: 'search_implementation', description: 'Find actual source, documentation and tests by identifier/name. Source index updates when files are added or changed.', parameters: input, run: a => JSON.stringify(workspace.searchImplementation(String(a.query ?? ''), a.limit as number | undefined)) },
    { name: 'inspect_implementation', description: 'Read an exact source range as plain content with coordinates and hash, without copying a line-number gutter into code.', parameters: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['path'] }, run: a => JSON.stringify(workspace.inspectImplementation(String(a.path ?? ''), a.start as number | undefined, a.end as number | undefined)) },
  ]
}
