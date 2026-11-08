// One save-local authoring session. MCP and HTTP use the same trusted host operations.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative, isAbsolute, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as E from '@openworld/engine'
import '@openworld/modules'
import { CreationWorkshop } from '@openworld/runtime/src/workshop.ts'
import { compileMapPaint } from '../modder/drafts.ts'
import { CreatorWorkspace, engineCreatorContext, workspaceTools } from '../agent/workspace.ts'
import type { AgentTool } from '../agent/tools.ts'
import { LocalEnv } from '../agent/env.ts'
import { sourceVersion } from '../agent/source-version.ts'

export interface CreatorSessionConfig {
  root: string
  gameModule: string
  worldDirectory: string
  mechanismDirectory?: string
  directory: string
  jobId: string
  save: E.SaveData
  target?: { kind: 'item' | 'uses' | 'map'; id: string; operation?: 'append' | 'revise' }
  recipes?: E.Recipe[]
  assets?: Record<string, unknown>
}
interface RetainedDraft {
  kind: 'item' | 'uses' | 'map'
  title: E.Text
  item?: E.WorkshopDraft
  map?: E.CreationMapDraft
  adopted?: boolean
  initialDesign?: E.WorkshopDraft['design']
  priorAdoptions?: RetainedDraft[]
}
export interface CreatorSessionState {
  save: E.SaveData
  drafts: Record<string, RetainedDraft>
  events: { at: string; tool: string; result: unknown }[]
  checks: { kind: string; passed: boolean; result: unknown }[]
  published: boolean
  restartRequired?: boolean
  restartReason?: string
  runtimeSource?: { opened: string; current: string }
}
export const creatorDigest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
const L = (en: string, zh = en): E.Text => ({ en, zh })
function retainAdoptions(prior?: RetainedDraft): RetainedDraft[] | undefined {
  if (!prior?.adopted) return prior?.priorAdoptions
  const { priorAdoptions, ...entry } = prior
  if (!priorAdoptions?.length && entry.item && entry.initialDesign) {
    const { appendFrom: _appendFrom, ...item } = entry.item
    return [{ ...entry, kind: 'item', item: { ...item, design: entry.initialDesign } }]
  }
  return [...(priorAdoptions ?? []), entry]
}

export class CreatorSession {
  private static live = new Set<CreatorSession>()
  game!: E.Game
  definition!: E.GameDef
  index!: E.WorldIndex
  workshop!: CreationWorkshop
  state: CreatorSessionState
  workspace!: CreatorWorkspace
  private views: unknown[] = []
  private openedRuntimeHash?: string
  private mechanismFiles = new Map<string, string>()
  private constructor(readonly config: CreatorSessionConfig) {
    mkdirSync(config.directory, { recursive: true })
    this.state = existsSync(this.statePath) ? json(this.statePath) : { save: structuredClone(config.save), drafts: {}, events: [], checks: [], published: false }
  }
  get statePath(): string { return resolve(this.config.directory, 'session-state.json') }
  get engine(): E.Engine { return this.game.engine }
  static async open(config: CreatorSessionConfig): Promise<CreatorSession> {
    const session = new CreatorSession(config)
    await session.reload()
    CreatorSession.live.add(session)
    return session
  }
  async reload(): Promise<void> {
    if (this.openedRuntimeHash && this.requireRuntimeRestart()) throw new Error(this.state.restartReason)
    const mod = await import(pathToFileURL(resolve(this.config.gameModule)).href)
    this.definition = (mod.default ?? mod.GAME) as E.GameDef
    if (!this.definition?.ontology || !this.definition.rules) throw new Error('The game module must export its GameDef')
    await this.loadMechanisms()
    this.index = json<E.WorldIndex>(resolve(this.config.worldDirectory, 'index.json'))
    if (this.state.save.world && this.state.save.world !== this.index.version) throw new Error('The save and world version do not match')
    const onto = this.definition.ontology()
    const lib = E.restoreLibrary(this.definition.rules, this.state.save.library, onto, this.index.protectedFacts)
    this.game = E.Game.load(structuredClone(this.state.save), structuredClone(this.index), onto, lib, this.definition.upgradeSave)
    this.game.worldVersion = this.index.version
    const errors = [...E.restoreWorkshopPackages(this.engine), ...E.restoreCreationMaps(this.engine, this.definition.terrainChars)]
    if (errors.length) throw new Error(errors.join('; '))
    for (const recipe of this.config.recipes ?? []) this.engine.recipes.set(recipe.make.type, recipe)
    const current = this.engine.world.posOf(this.engine.world.player)?.map ?? this.state.save.state.spawn.map
    const made = E.creationMapChunk(this.engine, current, this.definition.terrainChars)
    const file = resolve(this.config.worldDirectory, 'maps', `${current}.json`)
    if (made) this.game.loadChunk(made)
    else if (existsSync(file)) this.game.loadChunk(E.withCreationConnections(this.engine, E.decodeRawChunk(json<E.RawChunk>(file), this.definition.terrainChars)))
    this.workshop = new CreationWorkshop({ current: () => this.game, link: () => undefined, chars: () => this.definition.terrainChars,
      recipes: () => this.config.recipes ?? this.engine.recipes.values(), post: m => this.views.push(m), kept: () => {}, changed: () => {} })
    this.workspace = new CreatorWorkspace({ root: this.config.root, context: () => ({
      ...engineCreatorContext(this.engine, { gameId: this.definition.id, revision: `${this.state.events.length}:${this.engine.world.state.tick}:${E.researchCapabilities().map(c => `${c.id}@${c.version}`).join(',')}` }),
      maps: [...this.index.maps.map(m => ({ ...m })), ...E.creationMaps(this.engine).map(m => ({ ...m.raw.map }))], assets: this.config.assets,
    }) })
    this.openedRuntimeHash = this.runtimeSourceHash()
    this.state.runtimeSource = { opened: this.openedRuntimeHash, current: this.openedRuntimeHash }
    this.state.restartRequired = false
    delete this.state.restartReason
    this.retain()
  }
  private runtimeSourceHash(): string {
    const hash = createHash('sha256'), seen = new Set<string>()
    const excluded = [resolve(this.config.directory), resolve(this.config.worldDirectory), ...(this.config.mechanismDirectory ? [resolve(this.config.mechanismDirectory)] : [])]
    const walk = (path: string): void => {
      const file = resolve(path)
      if (seen.has(file) || excluded.some(p => file === p || file.startsWith(p + '/') || file.startsWith(p + '\\'))) return
      seen.add(file)
      if (!existsSync(file)) { hash.update(`missing:${file}`); return }
      if (statSync(file).isDirectory()) {
        for (const name of readdirSync(file).sort()) if (!['node_modules', '.git', 'creation-mechanisms'].includes(name)) walk(resolve(file, name))
      } else if (/\.(?:ts|json)$/.test(file)) hash.update(relative(this.config.root, file)).update(readFileSync(file))
    }
    for (const path of ['packages/engine/src', 'packages/modules/src', 'packages/runtime/src/workshop.ts']) walk(resolve(this.config.root, path))
    walk(dirname(this.config.gameModule))
    return hash.digest('hex')
  }
  private requireRuntimeRestart(): boolean {
    const current = this.runtimeSourceHash(), opened = this.openedRuntimeHash ?? current
    this.state.runtimeSource = { opened, current }
    if (current === opened) return false
    this.state.restartRequired = true
    this.state.restartReason = 'Runtime source changed. Checkpoint and finish this coding turn; the host resumes this same job with a fresh MCP process.'
    this.retain()
    return true
  }
  private liveEngines(): E.Engine[] {
    return [...new Set([this, ...CreatorSession.live].flatMap(s => s.game ? [s.engine] : []))]
  }
  private async loadMechanisms(): Promise<void> {
    const directory = this.config.mechanismDirectory
    if (!directory) return
    const manifest = resolve(directory, 'manifest.json')
    if (!existsSync(manifest)) return
    const data = json<{ schema: number; providers: { file: string; enabled: boolean; hash?: string }[] }>(manifest)
    if (data.schema !== 1 || !Array.isArray(data.providers) || data.providers.length > 32) throw new Error('Invalid mechanism manifest')
    const loaded: { file: string; hash: string; provider: E.WorkshopMechanismProvider }[] = [], files = new Set<string>()
    for (const entry of data.providers) {
      if (!entry || !/^[a-z][a-z0-9_-]{0,47}\.ts$/.test(entry.file) || typeof entry.enabled !== 'boolean' || entry.hash !== undefined && !/^[a-f0-9]{64}$/.test(entry.hash) || files.has(entry.file)) throw new Error('Invalid mechanism source entry')
      files.add(entry.file)
      if (entry.enabled === false) continue
      const file = this.inside(directory, entry.file)
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      if (entry.hash && entry.hash !== hash) throw new Error(`Mechanism source hash changed: ${entry.file}`)
      const module = await import(`${pathToFileURL(file).href}?creator=${hash}`)
      loaded.push({ file: entry.file, hash, provider: module.default })
    }
    this.mechanismFiles = E.reconcileWorkshopMechanismProviders(this.mechanismFiles, loaded, this.liveEngines())
  }
  close(): void { CreatorSession.live.delete(this) }
  private inside(root: string, path: string): string {
    const file = resolve(root, path), rel = relative(resolve(root), file)
    if (rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw new Error('A mechanism file must stay inside its source directory')
    return file
  }
  private retain(): void {
    this.state.save = this.game.save()
    const temporary = `${this.statePath}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(this.state, null, 2) + '\n')
    renameSync(temporary, this.statePath)
  }
  private record(tool: string, result: unknown): unknown {
    this.state.events.push({ at: new Date().toISOString(), tool, result })
    this.retain()
    return result
  }
  integrationDrafts(): CreatorSessionState['drafts'] {
    const ordered: CreatorSessionState['drafts'] = {}
    const historical = new Map<string, RetainedDraft>(Object.entries(this.state.drafts).flatMap(([id, draft]) =>
      (draft.priorAdoptions ?? []).map(entry => [`${id}@${(entry.item ?? entry.map)!.revision}`, entry] as const)))
    for (const event of this.state.events) {
      if (event.tool !== 'adopt_content') continue
      const { id, revision } = event.result as { id: string; revision: number }
      const draft = this.state.drafts[id]
      const historicalKey = `${id}@${revision}`
      const entry = historical.get(historicalKey)
      if (entry) ordered[historicalKey] = entry
      if (draft?.adopted && (draft.item ?? draft.map)?.revision === revision) ordered[id] = draft
    }
    const items = E.workshopPackages(this.engine), maps = E.creationMaps(this.engine)
    for (const [id, draft] of Object.entries(this.state.drafts)) {
      const revision = (draft.item ?? draft.map)?.revision
      const active = (draft.item ? items : maps).some(p => p.id === id && p.revision === revision && p.enabled)
      if (!draft.adopted || !active) throw new Error(`Draft ${id} must be adopted and enabled before publication`)
      ordered[id] ??= draft
      if (draft.item && draft.initialDesign && !draft.priorAdoptions?.length) {
        const { appendFrom: _appendFrom, ...item } = draft.item
        ordered[id] = { ...draft, kind: 'item', item: { ...item, design: draft.initialDesign } }
      }
    }
    for (const event of this.state.events) {
      if (event.tool !== 'disable_content') continue
      const { id, ok } = event.result as { id?: string; ok?: boolean }
      if (id && ok && ![...items, ...maps].some(p => p.id === id && p.enabled)) throw new Error(`Disabled package ${id} cannot be carried by an append bundle`)
    }
    return ordered
  }
  checkpoint(kind: string, passed: boolean, result: unknown): void {
    this.state.checks.push({ kind, passed, result }); this.record('verification', { kind, passed, result })
  }
  private selected(id: string): RetainedDraft {
    const d = this.state.drafts[id]
    if (!d) throw new Error('Unknown staged draft; inspect the job and use its current draft ID')
    this.workshop.active = { owner: this.game, id, revision: (d.item ?? d.map)!.revision, title: d.title, kind: d.kind, item: d.item, map: d.map, adopted: d.adopted }
    return d
  }
  private status(): unknown {
    return { game: this.definition.id, job: this.config.jobId, tick: this.engine.world.state.tick,
      map: this.engine.activeMap, player: this.engine.world.player.id, drafts: Object.fromEntries(Object.entries(this.state.drafts).map(([id, d]) => [id, this.draftSummary(d)])),
      packages: E.workshopPackages(this.engine).filter(p => p.enabled).map(p => ({ id: p.id, revision: p.revision, typeId: p.typeId, uses: p.plan.uses.map(u => ({ id: u.id, capability: u.capability })) })),
      maps: E.creationMaps(this.engine).filter(p => p.enabled).map(p => ({ id: p.id, revision: p.revision, map: p.raw.map.id })),
      mechanismDirectory: this.config.mechanismDirectory, mechanisms: E.workshopMechanismProviders().map(p => ({ id: p.id, version: p.version, capabilities: p.capabilities.map(c => ({ id: c.id, version: c.version })), dependsOn: p.dependsOn })),
      checks: this.state.checks.slice(-20).map(c => ({ kind: c.kind, passed: c.passed, file: (c.result as { file?: string })?.file })), published: this.state.published,
      restartRequired: !!this.state.restartRequired, runtimeSource: this.state.runtimeSource }
  }
  private draftSummary(d: RetainedDraft): unknown {
    return { kind: d.kind, title: d.title, adopted: !!d.adopted,
      ...(d.item && { item: { id: d.item.id, revision: d.item.revision, appendFrom: d.item.appendFrom, typeId: d.item.typeId, uses: d.item.plan.uses.map(u => ({ id: u.id, capability: u.capability, target: u.target })), pending: d.item.plan.pending } }),
      ...(d.map && { map: { id: d.map.id, revision: d.map.revision, appendFrom: d.map.appendFrom, mapId: d.map.raw.map.id, width: d.map.raw.map.width, height: d.map.raw.map.height, entities: d.map.raw.entities.length } }) }
  }
  private packageInput(a: Record<string, unknown>): unknown {
    if (a.content !== undefined && a.file === undefined) return a.content
    if (typeof a.file === 'string' && a.content === undefined) return json(this.inside(this.config.root, a.file))
    throw new Error('Supply either content JSON or one workspace-relative file path')
  }
  private reloadFingerprint(): unknown {
    const w = this.engine.world
    return { packages: E.workshopPackages(this.engine).filter(p => p.enabled).map(p => ({ id: p.id, revision: p.revision, typeId: p.typeId, plan: creatorDigest(p.plan), definition: creatorDigest(p.typeDefinition ?? null) })).sort((a, b) => a.id.localeCompare(b.id)),
      maps: E.creationMaps(this.engine).filter(p => p.enabled).map(p => ({ id: p.id, revision: p.revision, raw: creatorDigest(p.raw) })).sort((a, b) => a.id.localeCompare(b.id)),
      capabilities: E.researchCapabilities(),
      inventory: Object.values(w.state.entities).filter(e => 'holder' in e.place && e.place.holder === w.player.id).map(e => ({ id: e.id, type: e.type, place: e.place })).sort((a, b) => a.id.localeCompare(b.id)) }
  }
  private contract(): unknown {
    const catalogue = E.researchCatalogue(this.engine, this.config.recipes)
    const char = Object.entries(this.definition.terrainChars).find(([, id]) => /grass|dirt|floor|path/.test(id))?.[0] ?? Object.keys(this.definition.terrainChars)[0]
    const material = catalogue.materials[0] ?? 'query an available material'
    return {
      proposal: { item: { kind: 'item', key: 'stable_artifact_key', design: 'ResearchDesign', plan: 'ResearchPlan' }, uses: { kind: 'uses', subject: 'existing entity/type/package ID', plan: 'ResearchPlan' }, map: { kind: 'map', key: 'stable_artifact_key', raw: 'RawChunk', subject: 'optional existing workshop region ID for revision' } },
      plan: { version: 1, uses: [{ id: 'stable_use_id', label: L('Examine'), capability: 'inspect', target: 'self', params: {} }], pending: [{ idea: L('Future use'), reason: L('Missing registered capability') }] },
      designs: {
        variant: { name: L('A distinct useful variant'), prototype: catalogue.prototypes[0] ?? 'query a valid prototype', ingredients: [{ type: material, count: 1 }] },
        new: { kind: 'new', name: L('A new item'), idea: 'A concrete function and physical form', type: { id: 'item/misc/invention_example', name: L('A new item'), tags: [], props: {}, makeup: [{ type: material, count: 1 }], station: 'hands' } },
        note: 'Select real family/ingredients and bounded numbers from world queries. The host assigns the final invention ID. An example is a schema, not permission to invent resources or properties.',
      },
      map: { raw: { map: { id: 'draft-example', name: L('A small region'), kind: 'workshop', width: 8, height: 8, rows: Array(8).fill(char.repeat(8)), portals: [] }, entities: [] },
        entity: { id: 'draft-object', type: 'an existing ordinary type ID', place: { on: 'tile', map: 'draft-example', x: 2, y: 2 } }, palette: this.definition.terrainChars,
        note: 'Dimensions 5–32; exactly width cells per row. Host assigns final map ID, entrance and return gate. Entities use native place, not loose x/y fields; no custom props/statuses. map.paint may replace rows; inspect its compiler for stroke shapes.',
      },
      mechanism: { directory: this.config.mechanismDirectory, manifest: { schema: 1, providers: [{ file: 'example.ts', enabled: true }] },
        provider: 'Default export WorkshopMechanismProvider {id,version,capabilities:[{descriptor:{id,version,label,description,targets,params},compile(context),verify(observation)}],dependsOn?:[{id,version}]}',
        ownership: 'Versioned IDs; builtin collisions forbidden. No model-plan JS. Disable active dependent content before provider upgrade/removal. Source modules are trusted code admitted by checks.',
        bounds: 'Compilers still honor effect budgets, host-owned creation properties and recipient events. To add a new native consumer, edit its owning source and run checks; reload_capabilities then requests a fresh MCP process automatically instead of reusing cached imports.',
      },
      lifecycle: { import: { content: 'portable package JSON OR use file path' }, update: { content: 'upstream package JSON', id: 'optional local package ID for legacy imports' }, note: 'Updates retain local type/instances and merge independent local uses; definition migration and conflicting edits are explicit diagnostics.' },
      sources: ['packages/engine/src/research.ts', 'packages/engine/src/creation.ts', 'packages/engine/src/creationProviders.ts', 'packages/engine/src/chunk.ts', 'packages/ai/src/modder/drafts.ts'],
    }
  }
  tools(): AgentTool[] {
    const make = (name: string, description: string, properties: Record<string, unknown>, required: string[], run: (a: Record<string, unknown>) => unknown | Promise<unknown>): AgentTool => ({
      name, description, parameters: { type: 'object', properties, required }, run: async args => {
        try {
          if (['propose_content', 'trial_content', 'adopt_content', 'use_content', 'import_content', 'update_content', 'disable_content', 'publish_content'].includes(name) && this.requireRuntimeRestart()) return JSON.stringify({ ok: false, restartRequired: true, instruction: this.state.restartReason })
          return JSON.stringify(await run(args))
        } catch (error) { return JSON.stringify({ ok: false, error: (error as Error).message, ...(this.state.restartRequired && { restartRequired: true }) }) }
      },
    })
    const string = { type: 'string' }, object = { type: 'object' }
    return [...workspaceTools(this.workspace),
      make('creator_status', 'Inspect this save-local authoring session, staged draft IDs, installed packages, checks and trusted mechanism source directory.', {}, [], () => this.status()),
      make('creation_contract', 'Read concise actual schemas/examples for proposals, use trees, RawChunk maps, provider source and lifecycle tools before guessing fields.', {}, [], () => this.contract()),
      make('get_creation_catalogue', 'Query the real current inventory, recipe/prototype guidance, material counts, stations, tools and actor limits. No manually prepared database; art is queried separately by content ID.', {}, [], () => {
        const w = this.engine.world, groups = new Map<string, { type: string; count: number; ids: string[] }>()
        for (const e of Object.values(w.state.entities)) if ('holder' in e.place && e.place.holder === w.player.id) {
          const group = groups.get(e.type) ?? { type: e.type, count: 0, ids: [] }
          group.count++; if (group.ids.length < 8) group.ids.push(e.id); groups.set(e.type, group)
        }
        return { ok: true, catalogue: E.researchCatalogue(this.engine, this.config.recipes), capabilities: E.researchCapabilities(), inventory: [...groups.values()], worn: w.worn(w.player).map(e => ({ id: e.id, type: e.type })), held: w.player.held }
      }),
      make('inspect_draft', 'Read one staged use tree/design/map after compact status. Artwork is omitted unless includeArt=true.', { id: string, includeArt: { type: 'boolean' } }, ['id'], a => {
        const draft = this.state.drafts[String(a.id)]
        if (!draft) throw new Error('Unknown staged draft')
        const copy = structuredClone(draft)
        if (!a.includeArt && copy.item?.design) {
          const design = copy.item.design
          if (design.kind === 'new') { if (design.type) delete design.type.art }
          else delete design.art
        }
        return { ok: true, draft: copy }
      }),
      make('mechanism_status', 'Inspect loaded trusted provider owners, versions, capability schemas and source files.', {}, [], () => ({ ok: true, directory: this.config.mechanismDirectory, providers: E.workshopMechanismProviders().map(p => ({ ...p, file: this.mechanismFiles.get(p.id) })) })),
      make('inspect_map', 'Read one actual map and its placed objects. A created map includes stable package/revision and entrance information, for revision rather than duplication.', { id: string }, ['id'], a => {
        const id = String(a.id), records = E.creationMaps(this.engine).filter(p => p.id === id || p.raw.map.id === id)
        const saved = records.sort((a, b) => b.revision - a.revision)[0]
        if (saved) return { ok: true, package: { id: saved.id, revision: saved.revision, enabled: saved.enabled, source: saved.source, entry: saved.entry, gate: saved.gate }, raw: saved.raw }
        if (!this.index.maps.some(m => m.id === id)) throw new Error('Unknown map; search actual map IDs first')
        return { ok: true, raw: json<E.RawChunk>(this.inside(this.config.worldDirectory, `maps/${id}.json`)) }
      }),
      make('propose_content', 'Stage data without world mutation. kind=item needs design and plan. kind=uses supports operation=append with only new uses, or operation=revise with a replacement plan. An NPC Add Uses order is bound to its selected subject and append. For kind=map use operation=append with an installed subject and new tile objects, or supply a full RawChunk for creation or revision.', { kind: { enum: ['item', 'uses', 'map'] }, operation: { enum: ['append', 'revise'] }, title: string, subject: string, design: object, plan: object, raw: object, objects: { type: 'array', items: object }, key: string }, ['kind'], a => {
        const kind = String(a.kind), key = String(a.key ?? `draft-${Object.keys(this.state.drafts).length + 1}`)
        if (a.operation !== undefined && a.operation !== 'append' && a.operation !== 'revise') throw new Error('Choose append or revise')
        const bound = this.config.target?.kind === 'uses' ? this.config.target.id : undefined
        if (bound && (kind !== 'uses' || a.operation === 'revise')) throw new Error('This order appends uses to its selected subject')
        if (a.operation !== undefined && kind === 'item') throw new Error('This operation requires an existing subject')
        if (!/^[a-z][a-z0-9_-]{0,35}$/.test(key)) throw new Error('key must be a short stable task/artifact name')
        const id = `${this.config.jobId.slice(0, 24)}_${key}`.slice(0, 47)
        let draft: RetainedDraft
        if (kind === 'map') {
          const subject = String(a.subject ?? (this.config.target?.kind === 'map' ? this.config.target.id : ''))
          const records = E.creationMaps(this.engine), existing = records.find(p => p.enabled && (p.id === subject || p.raw.map.id === subject))
          const selected = this.config.target?.kind === 'map' ? this.config.target.id : undefined
          if (selected && selected !== existing?.id && selected !== existing?.raw.map.id) throw new Error('The proposal does not match the selected map')
          const operation = selected ? this.config.target?.operation ?? 'append' : a.operation ?? (existing ? 'append' : undefined)
          if (selected && a.operation && a.operation !== operation) throw new Error(`This order requires ${operation} on the selected map`)
          if (subject && !existing) throw new Error('A map revision needs an existing enabled workshop region; query it with inspect_map')
          const targetId = existing?.id ?? id
          const revision = 1 + Math.max(this.state.drafts[targetId]?.map?.revision ?? 0, ...records.filter(p => p.id === targetId).map(p => p.revision))
          if (operation === 'append') {
            if (!existing || !Array.isArray(a.objects)) throw new Error('A map append needs an installed subject and new tile objects')
            const map = E.appendCreationMapObjects(this.engine, subject, a.objects as E.Entity[], revision)
            draft = { kind: 'map', title: map.raw.map.name, map, priorAdoptions: retainAdoptions(this.state.drafts[targetId]) }
          } else {
            const raw = compileMapPaint(a.raw as Record<string, unknown>, { chars: Object.entries(this.definition.terrainChars).map(([char, terrain]) => ({ char, terrain })), maxSize: [32, 32] }) as unknown as E.RawChunk
            draft = { kind: 'map', title: raw.map.name, map: { id: targetId, revision, raw } }
          }
        } else {
          const catalogue = { ...E.researchCatalogue(this.engine, this.config.recipes), capabilities: E.researchCapabilities() }
          const reply = E.readResearchReply({ reply: L('A staged proposal.'), ...(a.design !== undefined ? { design: a.design } : {}), plan: a.plan }, catalogue)
          if (!reply.plan) throw new Error('A concrete proposal needs its executable use tree')
          if (kind === 'uses') {
            const subject = String(a.subject ?? bound ?? ''), pkg = E.workshopPackages(this.engine).find(p => p.enabled && (p.id === subject || p.typeId === subject || p.typeId === this.engine.world.get(subject)?.type))
            const typeId = pkg?.typeId ?? this.engine.world.get(subject)?.type ?? subject
            if (!this.engine.world.onto.data.types[typeId]) throw new Error('Query a real existing subject first')
            if (bound && bound !== typeId && bound !== pkg?.id && this.engine.world.get(bound)?.type !== typeId) throw new Error('The proposal does not match the selected subject')
            const append = !!bound || a.operation === 'append'
            const targetId = pkg?.id ?? (append ? Object.values(this.state.drafts).find(d => d.item?.typeId === typeId && d.item.appendFrom === 0)?.item?.id : undefined) ?? id
            const prior = this.state.drafts[targetId]
            const base = pkg?.revision ?? 0
            const plan = append ? E.appendWorkshopPlan(pkg?.plan, reply.plan) : reply.plan
            draft = { kind: 'uses', title: L(String(a.title ?? typeId)), item: { id: targetId, revision: Math.max(base, prior?.item?.revision ?? 0) + 1, typeId, plan, ...(append && { appendFrom: base }), ...(pkg?.dependsOn && { dependsOn: pkg.dependsOn }), ...(pkg?.origin && { origin: pkg.origin }) } }
            draft.initialDesign = prior?.initialDesign ?? (prior?.adopted ? prior.item?.design : undefined)
            if (a.operation || append || prior?.priorAdoptions?.length) draft.priorAdoptions = retainAdoptions(prior)
          } else {
            if (!reply.design) throw new Error('A new item needs its bounded recipe/type design')
            const typeId = E.inventionId(reply.design, id.replaceAll('-', '_'))
            draft = { kind: 'item', title: reply.design.name, item: { id, revision: (this.state.drafts[id]?.item?.revision ?? 0) + 1, typeId, plan: reply.plan, design: reply.design } }
          }
        }
        const targetId = (draft.item ?? draft.map)!.id
        this.state.drafts[targetId] = draft
        this.state.published = false
        this.record('propose_content', { id: targetId, kind, revision: (draft.item ?? draft.map)!.revision })
        return { ok: true, id: targetId, draft: this.draftSummary(draft) }
      }),
      make('trial_content', 'Run an isolated native trial with state/trace evidence. If an existing use fails in an append, compare it with the installed baseline in the same fixture. Diagnose a shared failure before changing content.', { id: string }, ['id'], a => {
        const id = String(a.id), d = this.selected(id), before = creatorDigest({ state: this.engine.world.state, library: this.engine.lib.toJSON() })
        this.workshop.trial(id, (d.item ?? d.map)!.revision)
        const active = this.workshop.active!, trial = active.itemTrial ?? active.mapTrial!
        const isolated = before === creatorDigest({ state: this.engine.world.state, library: this.engine.lib.toJSON() })
        const result = { ok: trial.ok && isolated, isolated, trial, id, revision: (d.item ?? d.map)!.revision }
        this.state.checks.push({ kind: `trial:${id}`, passed: result.ok, result })
        return this.record('trial_content', result)
      }),
      make('adopt_content', 'Re-run a fresh successful host trial and adopt the exact current revision into the staged save. Rechecks inventory/dependencies; no live browser save is overwritten.', { id: string }, ['id'], a => {
        const id = String(a.id), d = this.selected(id)
        this.workshop.trial(id, (d.item ?? d.map)!.revision)
        const trial = this.workshop.active!.itemTrial ?? this.workshop.active!.mapTrial!
        if (!trial.ok) throw new Error(trial.errors.join('; '))
        this.workshop.adopt(id, (d.item ?? d.map)!.revision)
        d.adopted = true
        return this.record('adopt_content', { ok: true, id, revision: (d.item ?? d.map)!.revision, draft: this.draftSummary(d) })
      }),
      make('use_content', 'Exercise an adopted use through the actual engine capability execution, not state edits. Optional target is an existing entity ID. Inspect state/trace before and after; refusal remains a failure.', { id: string, use: string, item: string, target: string }, ['id', 'use'], a => {
        const mark = this.engine.traced, before = creatorDigest(this.engine.world.state)
        const ok = E.runWorkshopUse(this.engine, String(a.id), String(a.use), a.target ? { e: String(a.target) } : undefined, a.item ? String(a.item) : undefined)
        return this.record('use_content', { ok, before, after: creatorDigest(this.engine.world.state), trace: this.engine.trace.slice(-Math.min(this.engine.traced - mark, this.engine.trace.length)) })
      }),
      make('export_content', 'Export an adopted item/use package or map as portable data. Writes a named job artifact and returns the actual manifest.', { id: string }, ['id'], a => {
        const id = String(a.id), map = E.creationMaps(this.engine).find(p => p.id === id && p.enabled)
        const content = map ? { format: 'openworld-creation', schema: 1, manifest: { id, revision: map.revision, kind: 'map' }, raw: map.raw } : E.exportWorkshopPackage(this.engine, id)
        const file = resolve(this.config.directory, `${id}.creation.json`)
        writeFileSync(file, JSON.stringify(content, null, 2) + '\n')
        return this.record('export_content', { ok: true, file, manifest: content.manifest })
      }),
      make('import_content', 'Prepare a portable package JSON/file as a new staged import. Does not craft or adopt until trial/adopt_content. File paths are workspace-relative.', { content: object, file: string }, [], a => {
        if (this.config.target?.kind === 'uses') throw new Error('Use an additive proposal for the selected subject')
        this.workshop.import(this.packageInput(a))
        const d = this.workshop.active!
        this.state.drafts[d.id] = { kind: d.kind, title: d.title, item: d.item, map: d.map }
        this.state.published = false
        return this.record('import_content', { ok: true, id: d.id, draft: this.draftSummary(this.state.drafts[d.id]) })
      }),
      make('update_content', 'Prepare an upstream use revision of an already imported package. Preserves local IDs, art, recipe, instances and nonconflicting local uses. Explicit id links a legacy import; trial/adopt still required.', { content: object, file: string, id: string }, [], a => {
        if (this.config.target?.kind === 'uses') throw new Error('Use an additive proposal for the selected subject')
        const draft = E.prepareWorkshopUpdate(this.engine, this.packageInput(a), a.id ? { packageId: String(a.id) } : {})
        const pkg = E.workshopPackages(this.engine).find(p => p.id === draft.id && p.enabled)!
        const prior = this.state.drafts[draft.id]
        this.state.drafts[draft.id] = { kind: 'uses', title: pkg.typeDefinition?.name ?? L(draft.typeId), item: draft, initialDesign: prior?.initialDesign ?? (prior?.adopted ? prior.item?.design : undefined) }
        this.state.published = false
        return this.record('update_content', { ok: true, id: draft.id, draft: this.draftSummary(this.state.drafts[draft.id]) })
      }),
      make('disable_content', 'Disable a staged-save package using native dependency/ownership checks. Move out of a region before disabling it. It never deletes referenced live instances silently.', { id: string }, ['id'], a => {
        if (this.config.target?.kind === 'uses') throw new Error('An Add Uses order cannot disable installed content')
        const id = String(a.id), map = E.creationMaps(this.engine).some(p => p.id === id && p.enabled)
        const result = map ? (E.disableCreationMap(this.engine, id), { ok: true }) : E.disableWorkshopPackage(this.engine, id)
        if (result.ok) this.state.published = false
        return this.record('disable_content', { ...result, id })
      }),
      make('disable_mechanism', 'Disable a trusted source provider in this job manifest after native checks confirm no live package or provider depends on it. Never removes builtin capabilities.', { id: string }, ['id'], a => {
        if (this.config.target?.kind === 'uses') throw new Error('An Add Uses order cannot disable a provider')
        const id = String(a.id), file = this.mechanismFiles.get(id), directory = this.config.mechanismDirectory
        if (!directory || !file) throw new Error('This session does not own that mechanism source')
        const path = resolve(directory, 'manifest.json'), before = readFileSync(path, 'utf8')
        const manifest = JSON.parse(before) as { providers: { file: string; enabled: boolean }[] }
        const entry = manifest.providers.find(p => p.file === file)
        if (!entry) throw new Error('The mechanism source is not in this manifest')
        entry.enabled = false
        writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
        try { E.removeWorkshopMechanismProvider(id, this.liveEngines()) } catch (error) { writeFileSync(path, before); throw error }
        this.mechanismFiles.delete(id)
        return this.record('disable_mechanism', { ok: true, id, file, enabled: false })
      }),
      make('reload_capabilities', 'After developing and checking a trusted mechanism source provider, reload the configured manifest and refresh actual query/trial capabilities. This resumes the same order; plans never contain executable JS.', {}, [], async () => {
        if (this.requireRuntimeRestart()) return { ok: false, restartRequired: true, instruction: this.state.restartReason, runtimeSource: this.state.runtimeSource }
        this.retain(); await this.reload()
        return this.record('reload_capabilities', { ok: true, capabilities: E.researchCapabilities(), mechanisms: E.workshopMechanismProviders() })
      }),
      make('run_checks', 'Run independent native package compilation or focused Vitest files in this candidate workspace. Returns real exit code/output; failure is retained for self-repair. paths are repository-relative test paths, never shell commands.', { kind: { enum: ['types', 'tests'] }, paths: { type: 'array', items: { type: 'string' } } }, ['kind'], async a => {
        const paths = Array.isArray(a.paths) ? a.paths.map(String) : []
        if (paths.some(p => !/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(p) || p.includes('..'))) throw new Error('Use plain relative test paths')
        const command = a.kind === 'types' ? 'npm run typecheck' : `npx vitest run ${paths.length ? paths.join(' ') : 'packages/engine/test/boundaries.test.ts'} --maxWorkers 1`
        const sourceHash = sourceVersion(this.config.root)
        const result = await new LocalEnv(this.config.root).exec(command, { timeoutMs: 300000, ...(process.platform === 'win32' && a.kind === 'types' && { env: { GOMAXPROCS: '2', GOMEMLIMIT: '768MiB', GOGC: '70' } }) })
        const stable = sourceHash === sourceVersion(this.config.root)
        const report = { ok: stable && result.code === 0 && !result.timedOut, command, code: result.code, output: (result.stdout + result.stderr).slice(-10000), ms: result.ms, sourceHash, ...(stable ? {} : { error: 'Source changed during the check; run it on the current revision' }) }
        this.checkpoint(String(a.kind), report.ok, report)
        return report
      }),
      make('publish_content', 'Check adopted artifacts survive save/reload and publish a candidate save plus draft bundle. Host coordination still independently verifies code and live-save freshness before integration.', {}, [], async () => {
        if (!Object.values(this.state.drafts).some(d => d.adopted)) throw new Error('No adopted content to publish')
        this.integrationDrafts()
        const expected = this.reloadFingerprint()
        this.retain(); await this.reload()
        const actual = this.reloadFingerprint()
        if (creatorDigest(expected) !== creatorDigest(actual)) throw new Error('Package registration changed during save/reload')
        this.state.published = true
        this.state.checks.push({ kind: 'save-reload', passed: true, result: { expected, actual } })
        const file = resolve(this.config.directory, 'candidate-save.json')
        writeFileSync(file, JSON.stringify(this.game.save(), null, 2) + '\n')
        return this.record('publish_content', { ok: true, file, drafts: Object.fromEntries(Object.entries(this.state.drafts).map(([id, d]) => [id, this.draftSummary(d)])), checks: this.state.checks.map(c => ({ kind: c.kind, passed: c.passed })) })
      }),
    ]
  }
}
