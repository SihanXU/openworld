// Portable data only. Import prepares a new draft; normal trial/adoption still owns authority and cost.
import type { Engine } from './engine.ts'
import { creationPlanProblems, readResearchPlan, researchCapabilities, workshopPackages, type ResearchPlan, type WorkshopDependency, type WorkshopDraft, type WorkshopOrigin, type WorkshopPackage } from './creation.ts'
import { artProblems, newTypeProblems } from './mod.ts'
import { readResearchReply, type ResearchDesign } from './research.ts'
import { isOrdinaryResearchRecipe, newKindIn } from './researchCraft.ts'
import type { Recipe, TypeDef } from './types.ts'

export interface WorkshopExport {
  format: 'openworld-creation'
  schema: 1
  manifest: Pick<WorkshopPackage, 'id' | 'revision' | 'kind' | 'capabilityVersions' | 'dependsOn' | 'origin'>
  typeId: string
  plan: ResearchPlan
  typeDefinition?: TypeDef
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v))
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,47}$/.test(v)
const typeId = (v: unknown): v is string => typeof v === 'string' && /^item\/[a-z0-9_]+(?:\/[a-z0-9_]+)*$/.test(v) && v.length <= 160
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k))
const json = (v: unknown): string => {
  const pure = (x: unknown): boolean => x === null || typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number' && Number.isFinite(x) || Array.isArray(x) && x.every(pure) || record(x) && Object.values(x).every(pure)
  if (!pure(v)) throw new Error('A creation package must contain JSON data only')
  const out = JSON.stringify(v)
  if (out.length > 65536) throw new Error('A creation package is too large')
  return out
}
const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : record(v) ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v) ?? 'null'
const equal = (a: unknown, b: unknown) => stable(a) === stable(b)

export function exportWorkshopPackage(eng: Engine, packageId: string): WorkshopExport {
  const pkg = workshopPackages(eng).filter(p => p.id === packageId).sort((a, b) => b.revision - a.revision)[0]
  if (!pkg?.enabled) throw new Error('Only an enabled package can be exported')
  const definition = pkg.typeDefinition ?? eng.lib.types.find(t => t.id === pkg.typeId && t.researched)
  return structuredClone({ format: 'openworld-creation', schema: 1, manifest: { id: pkg.id, revision: pkg.revision, kind: definition ? 'item' : 'uses', capabilityVersions: pkg.capabilityVersions, ...(pkg.dependsOn?.length && { dependsOn: pkg.dependsOn }), ...(pkg.origin && { origin: pkg.origin }) }, typeId: pkg.typeId, plan: pkg.plan, ...(definition && { typeDefinition: definition }) })
}

function readTransfer(eng: Engine, value: unknown): { file: WorkshopExport; plan: ResearchPlan; dependencies: WorkshopDependency[] } {
  json(value)
  if (!record(value) || value.format !== 'openworld-creation' || value.schema !== 1 || !keys(value, ['format', 'schema', 'manifest', 'typeId', 'plan', 'typeDefinition'])) throw new Error('Invalid creation package format')
  const m = value.manifest
  if (!record(m) || !keys(m, ['id', 'revision', 'kind', 'capabilityVersions', 'dependsOn', 'origin']) || !id(m.id) || !Number.isSafeInteger(m.revision) || Number(m.revision) < 1 || !['item', 'uses'].includes(String(m.kind)) || !record(m.capabilityVersions) || !typeId(value.typeId)) throw new Error('Invalid creation package manifest')
  if (m.origin !== undefined) {
    const o = m.origin
    if (!record(o) || !keys(o, ['id', 'typeId', 'revision', 'plan']) || !id(o.id) || !typeId(o.typeId) || !Number.isSafeInteger(o.revision) || Number(o.revision) < 1) throw new Error('Invalid package origin')
    if (o.plan !== undefined) readResearchPlan(o.plan)
  }
  const plan = readResearchPlan(value.plan), capabilities = researchCapabilities()
  const required = [...new Set(plan.uses.map(u => u.capability))]
  if (Object.keys(m.capabilityVersions).length !== required.length) throw new Error('Capability version declarations do not match the plan')
  for (const capability of required) if (m.capabilityVersions[capability] !== capabilities.find(c => c.id === capability)?.version) throw new Error(`Unsupported capability version: ${capability}`)
  const dependencies: WorkshopDependency[] = []
  if (m.dependsOn !== undefined) {
    if (!Array.isArray(m.dependsOn) || m.dependsOn.length > 16) throw new Error('Invalid package dependencies')
    for (const d of m.dependsOn) {
      if (!record(d) || !keys(d, ['id', 'revision']) || !id(d.id) || !Number.isSafeInteger(d.revision) || Number(d.revision) < 1) throw new Error('Invalid package dependency')
      const enabled = workshopPackages(eng).filter(p => p.enabled)
      const direct = enabled.find(p => p.id === d.id && p.revision === d.revision)
      const imported = enabled.filter(p => p.origin?.id === d.id && p.origin?.revision === d.revision)
      const found = direct ?? (imported.length === 1 ? imported[0] : undefined)
      if (!found) throw new Error(`Missing or ambiguous dependency ${d.id}@${d.revision}`)
      dependencies.push({ id: found.id, revision: found.revision })
    }
  }
  return { file: value as unknown as WorkshopExport, plan, dependencies }
}

const originOf = (file: WorkshopExport, plan: ResearchPlan): WorkshopOrigin => ({ id: file.manifest.id, typeId: file.typeId, revision: file.manifest.revision, plan: structuredClone(plan) })

/** Does not mutate the world or install anything, including when the incoming file is invalid. */
export function prepareWorkshopImport(eng: Engine, input: unknown, known?: Iterable<Recipe>): WorkshopDraft {
  const { file: value, plan, dependencies } = readTransfer(eng, input), m = value.manifest
  const packages = workshopPackages(eng)
  const existingIds = new Set(packages.map(p => p.id))
  // Include map package names without importing its implementation or executing its content.
  const maps = (eng.world.state as unknown as { creationMaps?: { id: string }[] }).creationMaps ?? []
  for (const map of maps) existingIds.add(map.id)
  const base = `import-${m.id}`.slice(0, 40)
  let packageId = base, n = 1
  while (existingIds.has(packageId)) packageId = `${base}-${++n}`
  let subject = value.typeId, design: ResearchDesign | undefined
  if (m.kind === 'uses') {
    if (value.typeDefinition !== undefined || !eng.world.onto.data.types[subject]) throw new Error('An added-use package needs its existing subject in this world')
  } else {
    const raw = value.typeDefinition
    if (!record(raw) || !keys(raw, ['id', 'name', 'researched', 'makeup', 'station', 'tags', 'props', 'art', 'craftLevel', 'craftSkill', 'unlockedBy', 'tools']) || raw.id !== subject || raw.researched !== true || !subject.includes('/invention_') || !Array.isArray(raw.makeup) || raw.makeup.length < 1 || raw.makeup.length > 6 || typeof raw.station !== 'string' || !record(raw.props)) throw new Error('An invented-item package needs its complete researched type definition')
    for (const part of raw.makeup) if (!record(part) || !keys(part, ['type', 'count']) || !typeId(part.type) || !/^(item\/material|item\/food)\//.test(part.type) || !eng.world.onto.data.types[part.type] || !Number.isSafeInteger(part.count) || Number(part.count) < 1 || Number(part.count) > 64) throw new Error('The recipe references invalid materials or quantities')
    const parent = subject.split('/').slice(0, -1).join('/')
    if (!eng.world.onto.data.types[parent] || eng.lib.types.some(t => t.id === parent)) throw new Error('The source family must be ordinary content in this world')
    subject = `${parent}/invention_${packageId.replaceAll('-', '_')}`
    while (eng.world.onto.data.types[subject]) { packageId = `${base}-${++n}`; subject = `${parent}/invention_${packageId.replaceAll('-', '_')}` }
    const definition = structuredClone({ ...raw, id: subject }) as unknown as TypeDef
    const issues = newTypeProblems(definition, eng.world.onto.data, { artifacts: [{ kind: 'type', type: definition }] })
    if (issues.length) throw new Error(issues.join('; '))
    if (definition.art && artProblems(definition.art).length) throw new Error('The package icon is invalid')
    const recipes = [...(known ?? []), ...eng.recipes.values()]
    const ordinary = recipes.find(r => r.make.type === parent && isOrdinaryResearchRecipe(r))
    const catalogue = { prototypes: [parent], materials: definition.makeup!.map(p => p.type), stations: [definition.station!] }
    if (ordinary) {
      const allowedProps = ['value', 'material']
      const first = eng.world.onto.resolve(definition.makeup![0].type).props.material ?? eng.world.onto.resolve(parent).props.material
      const price = (t: string) => Number(eng.world.onto.resolve(t).props.value) || 0
      const cost = definition.makeup!.reduce((sum, p) => sum + price(p.type) * p.count, 0)
      if (Object.keys(definition.props ?? {}).some(k => !allowedProps.includes(k)) || definition.tags?.length || definition.props?.material !== first || Number(definition.props?.value) > Math.min(price(parent), cost) || definition.station !== (ordinary.station ?? 'hands') || definition.craftLevel !== (ordinary.level ?? 1) || definition.craftSkill !== ordinary.skill || !equal(definition.unlockedBy, ordinary.unlockedBy) || !equal(definition.tools, ordinary.tools)) throw new Error('The variant does not preserve this world\'s craft and family constraints')
      design = readResearchReply({ reply: { en: 'Imported draft.', zh: '导入的草稿。' }, design: { name: definition.name, prototype: parent, ingredients: definition.makeup, ...(definition.art && { art: definition.art }) } }, catalogue).design!
    } else {
      design = readResearchReply({ reply: { en: 'Imported draft.', zh: '导入的草稿。' }, design: { kind: 'new', name: definition.name, idea: 'An imported, data-only creation.', type: definition } }, catalogue).design!
      const admitted = newKindIn(eng.world.onto, design as Extract<ResearchDesign, { kind: 'new' }>, subject, k => !eng.lib.types.some(t => t.id === k), k => recipes.some(r => r.make.type === k && isOrdinaryResearchRecipe(r)))
      if (!equal(admitted.props, definition.props) || !equal(admitted.tags ?? [], definition.tags ?? []) || admitted.station !== definition.station) throw new Error('The item exceeds the receiving world\'s family or resource bounds')
    }
  }
  const definition = design?.kind === 'new' ? design.type! : eng.world.onto.data.types[design?.prototype ?? subject]
  const problems = creationPlanProblems(plan, definition, eng.world.onto.data)
  if (problems.length) throw new Error(problems.join('; '))
  return { id: packageId, revision: 1, typeId: subject, plan, origin: originOf(value, plan), ...(design && { design }), ...(dependencies.length && { dependsOn: dependencies }) }
}

/** Three-way use merge: retain independent local additions and refuse competing edits to the same branch. */
function mergePlans(base: ResearchPlan, local: ResearchPlan, incoming: ResearchPlan): ResearchPlan {
  const maps = [base, local, incoming].map(plan => new Map(plan.uses.map(use => [use.id, use])))
  const uses: ResearchPlan['uses'] = []
  for (const useId of new Set([...maps[0].keys(), ...maps[1].keys(), ...maps[2].keys()])) {
    const [b, l, n] = maps.map(m => m.get(useId))
    if (!equal(l, b) && !equal(n, b) && !equal(l, n)) throw new Error(`Conflicting local and incoming changes to use ${useId}`)
    const use = equal(l, b) ? n : l
    if (use) uses.push(structuredClone(use))
  }
  let pending = incoming.pending
  if (!equal(local.pending, base.pending)) pending = equal(incoming.pending, base.pending) ? local.pending : [...new Map([...(local.pending ?? []), ...(incoming.pending ?? [])].map(row => [stable(row), row])).values()]
  return readResearchPlan({ version: 1, uses, ...(pending?.length && { pending }) })
}

export interface WorkshopUpdateOptions { packageId?: string }

/** Prepare a use revision of an imported package, retaining its local type, instances, recipe and art. */
export function prepareWorkshopUpdate(eng: Engine, input: unknown, options: WorkshopUpdateOptions = {}): WorkshopDraft {
  const { file, plan, dependencies } = readTransfer(eng, input), m = file.manifest
  const packages = workshopPackages(eng), enabled = packages.filter(p => p.enabled)
  const candidates = options.packageId ? enabled.filter(p => p.id === options.packageId) : enabled.filter(p => p.origin?.id === m.id && p.origin.typeId === file.typeId)
  if (candidates.length !== 1) throw new Error('Choose exactly one enabled imported package to update')
  const previous = candidates[0], origin = previous.origin
  if (origin && (origin.id !== m.id || origin.typeId !== file.typeId)) throw new Error('The update belongs to another source package')
  if (origin && m.revision <= origin.revision) throw new Error(`Source revision must be newer than ${origin.revision}`)
  if (!origin) {
    const base = `import-${m.id}`.slice(0, 40)
    if (!options.packageId || previous.id !== base && !(previous.id.startsWith(base + '-') && /^\d+$/.test(previous.id.slice(base.length + 1)))) throw new Error('A legacy import requires an explicit matching local package')
  }
  if (m.kind !== previous.kind) throw new Error('A package update cannot change item/use ownership')
  if (m.kind === 'item') {
    const definition = previous.typeDefinition ?? eng.lib.types.find(t => t.id === previous.typeId && t.researched)
    if (!definition || !record(file.typeDefinition) || file.typeDefinition.id !== file.typeId || !equal({ ...file.typeDefinition, id: previous.typeId }, definition)) throw new Error('Item definition changes need an explicit migration; this update preserves recipe, art and live instances')
  } else if (file.typeDefinition !== undefined || previous.typeId !== file.typeId) throw new Error('An added-use update needs the same existing subject')
  const earliest = packages.filter(p => p.id === previous.id).sort((a, b) => a.revision - b.revision)[0]
  const basePlan = origin?.plan ?? (earliest?.revision === 1 ? earliest.plan : undefined)
  if (!basePlan) throw new Error('The original imported use tree is required to merge this update')
  const merged = mergePlans(basePlan, previous.plan, plan)
  const type = eng.world.onto.data.types[previous.typeId]
  const problems = creationPlanProblems(merged, type, eng.world.onto.data)
  if (problems.length) throw new Error(problems.join('; '))
  return { id: previous.id, revision: previous.revision + 1, typeId: previous.typeId, plan: merged, origin: originOf(file, plan), ...(dependencies.length && { dependsOn: dependencies }) }
}
