// Save-local creation plans compile only trusted capabilities to the existing rule engine.
import { Engine } from './engine.ts'
import { ModPort } from './mod.ts'
import { RuleLibrary } from './rules.ts'
import { trialResearch } from './researchCraft.ts'
import { ROW } from './controls.ts'
import { weaponOf } from './blows.ts'
import { buildChannel, channelArmedKey, channelState, releasedKey, runChannel, variantChanceOf, verifyChannel } from './creationChannel.ts'
import { canLaunchWorkshopFlight, installCreationFlightHooks, launchWorkshopFlight, workshopFlights, type CreationFlight } from './creationFlight.ts'
import type { ResearchDesign } from './research.ts'
import type { Effect, Entity, Ontology, PropValue, Recipe, Ref, Rule, Selector, StatusDef, Text, TypeDef, WorldState } from './types.ts'

export interface CapabilityParameter {
  type: 'number' | 'string' | 'boolean'
  min?: number
  max?: number
  enum?: PropValue[]
  default?: PropValue
}
export interface CapabilityDescriptor {
  id: string
  version: number
  label: Text
  description: Text
  targets: string[]
  params: Record<string, CapabilityParameter>
}
export interface ResearchUse {
  id: string
  label: Text
  capability: string
  target: string
  params?: Record<string, PropValue>
}
export interface ResearchPlan {
  version: 1
  uses: ResearchUse[]
  pending?: { idea: Text; reason: Text }[]
}
export interface WorkshopDependency { id: string; revision: number }
/** The immediate exporter whose revision this local package follows. */
export interface WorkshopOrigin { id: string; typeId: string; revision: number; plan?: ResearchPlan }
export interface WorkshopManifest {
  id: string
  revision: number
  kind: 'item' | 'uses' | 'map'
  dependsOn?: WorkshopDependency[]
  origin?: WorkshopOrigin
}
export interface WorkshopDraft extends Omit<WorkshopManifest, 'kind'> {
  typeId: string
  plan: ResearchPlan
  /** Installed package revision this additive proposal was built against. Zero starts a use pack. */
  appendFrom?: number
  /** Absent when adding uses to an existing type. */
  design?: ResearchDesign
}
export interface WorkshopPackage extends WorkshopManifest {
  kind: 'item' | 'uses'
  typeId: string
  plan: ResearchPlan
  typeDefinition?: TypeDef
  capabilityVersions: Record<string, number>
  ruleIds: string[]
  statusIds: string[]
  enabled: boolean
  createdAt: string
}
export interface WorkshopUseReport {
  id: string
  ok: boolean
  observed: Record<string, unknown>
  trace: { kind: string; rule?: string; element?: string }[]
  errors: string[]
}
export interface WorkshopTrialReport {
  ok: boolean
  planDigest: string
  uses: WorkshopUseReport[]
  errors: string[]
  comparisons?: { use: string; baseline: WorkshopUseReport }[]
}
export interface WorkshopRegistration {
  ok: boolean
  package?: WorkshopPackage
  errors: string[]
}

const ID = /^[a-z][a-z0-9_-]{0,47}$/
const PARAM = /^[a-z][a-zA-Z0-9_-]{0,47}$/
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const scalar = (v: unknown): v is PropValue => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)
function text(value: unknown, most = 500): Text {
  if (typeof value === 'string' && value.trim() && value.length <= most) return value
  if (record(value) && typeof value.en === 'string' && typeof value.zh === 'string' && value.en.trim() && value.zh.trim() && value.en.length <= most && value.zh.length <= most && Object.keys(value).every(k => k === 'en' || k === 'zh')) return { en: value.en, zh: value.zh }
  throw new Error('A short label in English and Chinese is required')
}
function ident(value: unknown, where: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${where}: invalid id`)
  return value
}
export function readResearchPlan(value: unknown): ResearchPlan {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.uses) || value.uses.length > 8 || Object.keys(value).some(k => !['version', 'uses', 'pending'].includes(k))) throw new Error('Invalid research plan')
  const uses: ResearchUse[] = value.uses.map((raw, i) => {
    if (!record(raw) || Object.keys(raw).some(k => !['id', 'label', 'capability', 'target', 'params'].includes(k))) throw new Error(`Invalid use ${i}`)
    const id = ident(raw.id, 'use'), capability = ident(raw.capability, 'capability')
    if (typeof raw.target !== 'string' || raw.target.length > 160 || !raw.target) throw new Error('Invalid use target')
    const params: Record<string, PropValue> = {}
    if (raw.params !== undefined) {
      if (!record(raw.params) || Object.keys(raw.params).length > 8) throw new Error('Invalid use parameters')
      for (const [k, v] of Object.entries(raw.params)) {
        if (!PARAM.test(k) || !scalar(v) || typeof v === 'string' && v.length > 160) throw new Error(`Invalid parameter ${k}`)
        params[k] = v
      }
    }
    return { id, label: text(raw.label, 120), capability, target: raw.target, ...(raw.params !== undefined && { params }) }
  })
  if (new Set(uses.map(u => u.id)).size !== uses.length) throw new Error('Use ids must be unique')
  let pending: ResearchPlan['pending']
  if (value.pending !== undefined) {
    if (!Array.isArray(value.pending) || value.pending.length > 8) throw new Error('Invalid pending uses')
    pending = value.pending.map(p => {
      if (!record(p) || Object.keys(p).some(k => !['idea', 'reason'].includes(k))) throw new Error('Invalid pending use')
      return { idea: text(p.idea), reason: text(p.reason) }
    })
  }
  return { version: 1, uses, ...(pending && { pending }) }
}
export function readCapabilityDescriptor(value: unknown): CapabilityDescriptor {
  if (!record(value) || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || !Array.isArray(value.targets) || !value.targets.length || value.targets.length > 8 || !value.targets.every(t => typeof t === 'string' && t.length <= 160) || !record(value.params) || Object.keys(value.params).length > 8) throw new Error('Invalid capability descriptor')
  const params: Record<string, CapabilityParameter> = {}
  for (const [k, p] of Object.entries(value.params)) {
    if (!PARAM.test(k) || !record(p) || !['number', 'string', 'boolean'].includes(String(p.type))) throw new Error('Invalid capability parameter')
    if (p.min !== undefined && (typeof p.min !== 'number' || !Number.isFinite(p.min)) || p.max !== undefined && (typeof p.max !== 'number' || !Number.isFinite(p.max)) || p.enum !== undefined && (!Array.isArray(p.enum) || p.enum.length > 16 || !p.enum.every(scalar)) || p.default !== undefined && !scalar(p.default)) throw new Error('Invalid capability parameter bounds')
    params[k] = { type: p.type as CapabilityParameter['type'], ...(p.min !== undefined && { min: p.min as number }), ...(p.max !== undefined && { max: p.max as number }), ...(p.enum !== undefined && { enum: [...p.enum as PropValue[]] }), ...(p.default !== undefined && { default: p.default as PropValue }) }
  }
  return { id: ident(value.id, 'capability'), version: Number(value.version), label: text(value.label, 120), description: text(value.description), targets: [...value.targets as string[]], params }
}

const L = (en: string, zh: string): Text => ({ en, zh })
const duration: CapabilityParameter = { type: 'number', min: 1, max: 600, default: 300 }
const DESCRIPTORS: CapabilityDescriptor[] = [
  { id: 'eat', version: 1, label: L('Eat', '吃'), description: L('Eat one serving to restore fullness.', '吃下这一份，补充饱食。'), targets: ['self'], params: {} },
  { id: 'feed', version: 1, label: L('Feed', '喂食'), description: L('Offer this food to a hungry person, who eats it to restore fullness.', '喂给饥饿的居民；食物吃掉后会让他更饱。'), targets: ['person'], params: {} },
  { id: 'gift', version: 1, label: L('Give as a gift', '送礼'), description: L('Give one carried item to a person, who responds according to their preferences.', '把一件物品送给居民；对方会按喜好作出反应。'), targets: ['person'], params: {} },
  { id: 'drink', version: 1, label: L('Drink', '饮用'), description: L('Drink this serving for its restorative effect.', '喝下这份饮品，获得它本身的恢复效果。'), targets: ['self'], params: {} },
  { id: 'mine', version: 1, label: L('Mine', '开采'), description: L('Work rocky ground with this pickaxe to extract its material.', '拿镐敲凿岩石地面，逐步开采其中的材料。'), targets: ['ground'], params: {} },
  { id: 'attack', version: 1, label: L('Attack', '攻击'), description: L('Take up this weapon and strike a target with its native combat effects, respecting profession, reach and attack cooldown.', '拿起这件武器，以它原有的战斗效果攻击目标，沿用职业、射程和攻击间隔。'), targets: ['person', 'creature'], params: {} },
  { id: 'wear', version: 1, label: L('Wear or wield', '穿戴或装备'), description: L('Put this wearable item into its native equipment slot. Its existing bonuses apply while worn; using this branch again keeps it equipped.', '把可穿戴物品装备到原有部位，穿着时获得它本身的加成；重复使用保持装备。'), targets: ['self'], params: {} },
  { id: 'cast', version: 1, label: L('Cast with a magic weapon', '法器施法'), description: L('Take up this wand or staff and cast its existing elemental attack through native combat. This does not create a new character skill.', '拿起这根魔杖或法杖，沿用原有战斗施放它的元素攻击；此用途不生成新的角色技能。'), targets: ['person', 'creature'], params: {} },
  { id: 'inspect', version: 1, label: L('Inspect', '查看'), description: L('Inspect this item and record that it was inspected, without consuming it.', '查看物品并记录已查看，不消耗。'), targets: ['self'], params: {} },
  { id: 'channel', version: 1, label: L('Channel', '御术'), description: L('Channel a worn accessory or held magic focus along a clear row/column. Fire burns, water wets, wind pushes, earth stuns; cost fullness is paid as stamina, all branches share one saved cooldown (10 ticks/second). Empower releases all four. Optional variantChance (0..1, default 0): that share of water casts release ice (freezing the wet) and of fire casts release lightning (charging the wet); one saved world-RNG draw per cast, and the same element drives damage, status and bolt.', '用已穿戴饰品或手持法器沿无遮挡行列御术：火燃烧、水浸湿、气推开、土眩晕；cost消耗饱食度，各分支共享存档冷却（10 tick/秒）。强化时释放四元素。可选 variantChance（0..1，默认0）：该比例的御水改为御冰（冻结湿润），御火改为御雷（电击湿润）；每次施放只掷一次存档随机数，伤害、状态与画面闪电用同一元素。'), targets: ['person', 'creature'], params: { element: { type: 'string', enum: ['fire', 'wind', 'water', 'earth'], default: 'fire' }, power: { type: 'number', min: 1, max: 5, default: 2 }, range: { type: 'number', min: 1, max: 6, default: 4 }, cost: { type: 'number', min: 1, max: 10, default: 2 }, cooldown: { type: 'number', min: 5, max: 100, default: 10 }, variantChance: { type: 'number', min: 0, max: 1, default: 0 } } },
  { id: 'empower', version: 1, label: L('Elemental convergence', '四象汇流'), description: L('With a worn accessory or held native magic focus, pay cost fullness as stamina for a finite mode: this package channels all four elements, with +2 attack and +1 defence. Duration and recovery are saved ticks (10/second); cooldown must cover duration. Cannot refresh while active or recovering.', '已穿戴饰品或手持法器消耗cost点饱食度，短暂使本包御术同时释放四元素、攻击+2防御+1。duration与cooldown按可存档tick计（10/秒），冷却须覆盖持续期；生效或恢复中不能刷新。'), targets: ['self'], params: { duration: { type: 'number', min: 10, max: 100, default: 30 }, cost: { type: 'number', min: 5, max: 30, default: 10 }, cooldown: { type: 'number', min: 50, max: 600, default: 200 } } },
  { id: 'spread', version: 1, label: L('Spread on food', '涂在食物上'), description: L('Spread this serving on another food, transferring its nutrition and leaving a temporary coating.', '抹在另一份食物上，转移这一份的营养，并暂时留下涂层。'), targets: ['item'], params: { foodBoost: { type: 'number', min: 0, max: 10, default: 0 }, duration } },
  { id: 'throw-coat', version: 1, label: L('Throw and coat', '投掷并涂覆'), description: L('Throw this item at a visible target; it splashes on arrival, or misses if the target moves away. A sticky coating slows movement until it wears off.', '向看得见的目标投出物品，落下时溅上涂层；目标走开就会落空。黏稠涂层能暂时减缓生物行动。'), targets: ['person', 'creature', 'item', 'ground'], params: { substance: { type: 'string', enum: ['wet', 'oiled', 'sticky'], default: 'wet' }, duration: { ...duration, default: 100 }, power: { type: 'number', min: 0, max: 5, default: 0 }, range: { type: 'number', min: 1, max: 6, default: 4 } } },
]
export interface WorkshopCapabilityContext {
  packageId: string
  revision: number
  use: ResearchUse
  params: Record<string, PropValue>
  type: TypeDef
  ontology: Ontology
  namespace: string
  signal: Record<string, PropValue>
}
export interface WorkshopCapabilityBuild {
  effects?: Effect[]
  receiver?: { host: Selector; effects: Effect[] }
  statuses?: StatusDef[]
  /** Actor-owned costs and temporary states, reached only by the source's event. */
  actorEffects?: Effect[]
  empowered?: { status: string; effects: Effect[] }
}
export interface WorkshopCapabilityObservation {
  use: ResearchUse
  before: Record<string, unknown>
  after: Record<string, unknown>
  trace: { kind: string; rule?: string; element?: string }[]
  expectedStatus?: string
}
export interface WorkshopCapability {
  descriptor: CapabilityDescriptor
  verb?: 'use' | 'put'
  /** This trusted use can act through the item while it is equipped. */
  equipped?: boolean
  /** Trusted adapters to existing controls, never supplied by a creation plan. */
  native?: 'attack' | 'wear' | 'channel' | 'empower'
  compile(context: WorkshopCapabilityContext): WorkshopCapabilityBuild
  verify(observation: WorkshopCapabilityObservation): string[]
  problems?(use: ResearchUse, type: TypeDef, ontology: Ontology): string[]
}
const CAPABILITIES = new Map<string, WorkshopCapability>()

/** Restore registrations and their handles together if a trusted provider refresh fails. */
export function withWorkshopCapabilityRollback<T>(apply: () => T): T {
  const previous = new Map(CAPABILITIES)
  try { return apply() }
  catch (error) {
    CAPABILITIES.clear()
    for (const [id, capability] of previous) CAPABILITIES.set(id, capability)
    throw error
  }
}
/** Developer-owned pure handlers, registered by loaded code; manifests never contain code. */
export interface WorkshopCapabilityRegistration {
  /** Ownership is lost if trusted code subsequently replaces this registration. */
  current(): boolean
  remove(): void
}
export function registerWorkshopCapability(capability: WorkshopCapability): WorkshopCapabilityRegistration {
  const descriptor = readCapabilityDescriptor(capability.descriptor)
  if (typeof capability.compile !== 'function' || typeof capability.verify !== 'function') throw new Error('A capability needs both compiler and verifier')
  const old = CAPABILITIES.get(descriptor.id)
  if (old && old.descriptor.version >= descriptor.version) throw new Error(`Capability ${descriptor.id} is already registered at this version`)
  const installed = { ...capability, descriptor }
  CAPABILITIES.set(descriptor.id, installed)
  return {
    current: () => CAPABILITIES.get(descriptor.id) === installed,
    remove: () => {
      if (CAPABILITIES.get(descriptor.id) !== installed) throw new Error(`Capability ${descriptor.id} no longer belongs to this registration`)
      if (old) CAPABILITIES.set(descriptor.id, old)
      else CAPABILITIES.delete(descriptor.id)
    },
  }
}
for (const descriptor of DESCRIPTORS) registerWorkshopCapability({ descriptor, ...(descriptor.id === 'gift' && { verb: 'put' }), ...(['attack', 'cast'].includes(descriptor.id) && { native: 'attack' as const }), ...(descriptor.id === 'wear' && { native: 'wear' as const }), ...(['channel', 'empower'].includes(descriptor.id) && { native: descriptor.id as 'channel' | 'empower' }), compile: builtinBuild, verify: observation => builtinVerify(descriptor.id, observation) })
export function researchCapabilities(): CapabilityDescriptor[] { return structuredClone([...CAPABILITIES.values()].map(c => c.descriptor)) }
export const creationCapabilities = researchCapabilities

function paramsOf(use: ResearchUse): Record<string, PropValue> {
  const d = CAPABILITIES.get(use.capability)?.descriptor
  if (!d) throw new Error(`${use.id}: unsupported capability ${use.capability}; keep it pending`)
  if (!d.targets.includes(use.target)) throw new Error(`${use.id}: unsupported target ${use.target}`)
  const out: Record<string, PropValue> = {}
  for (const k of Object.keys(use.params ?? {})) if (!Object.hasOwn(d.params, k)) throw new Error(`${use.id}: unknown parameter ${k}`)
  for (const [k, p] of Object.entries(d.params)) {
    const v = use.params?.[k] ?? p.default
    if (v === undefined || typeof v !== p.type || typeof v === 'number' && (!Number.isFinite(v) || p.min !== undefined && v < p.min || p.max !== undefined && v > p.max) || p.enum && !p.enum.includes(v)) throw new Error(`${use.id}: parameter ${k} is outside its bounds`)
    out[k] = v
  }
  return out
}
export function creationPlanProblems(plan: ResearchPlan, type: TypeDef, ontology: Ontology): string[] {
  const errors: string[] = []
  try { readResearchPlan(plan) } catch (e) { return [String(e)] }
  for (const use of plan.uses) try {
    paramsOf(use)
    const defs = type.id.split('/').map((_, i, a) => a.slice(0, i + 1).join('/')).map(id => id === type.id ? type : ontology.types[id]).filter(Boolean)
    const tags = defs.flatMap(t => t.tags ?? [])
    const props = Object.assign({}, ...defs.map(t => t.props ?? {})) as Record<string, PropValue>
    if (['eat', 'feed'].includes(use.capability) && (!tags.includes('edible') || Number(props.food ?? 0) <= 0)) throw new Error('this type is not edible food')
    if (use.capability === 'drink' && !tags.includes('drinkable')) throw new Error('this type is not drinkable')
    if (use.capability === 'mine' && !tags.includes('tool:pickaxe')) throw new Error('this type has no pickaxe capability')
    if (use.capability === 'attack' && !tags.includes('weapon')) throw new Error('this type is not a weapon')
    if (use.capability === 'wear' && (!tags.includes('wearable') || typeof props.slot !== 'string' || !props.slot)) throw new Error('this type has no wearable equipment slot')
    if (use.capability === 'cast' && !/^item\/weapon\/magic(?:\/|$)/.test(type.id)) throw new Error('this type is not a native wand or staff')
    if (['channel', 'empower'].includes(use.capability) && !/^item\/weapon\/magic(?:\/|$)/.test(type.id) && (!tags.includes('wearable') || typeof props.slot !== 'string' || !props.slot)) throw new Error('this type is neither a native magic focus nor a wearable accessory')
    if (use.capability === 'channel' && ['wet', 'burning', 'stunned'].some(id => !ontology.statuses[id])) throw new Error('this game lacks the elemental reaction statuses')
    if (use.capability === 'empower' && Number(paramsOf(use).cooldown) < Number(paramsOf(use).duration)) throw new Error('empower cooldown must cover its duration')
    if (use.capability === 'spread' && Number(paramsOf(use).foodBoost) > Number(props.food ?? 0)) throw new Error('foodBoost exceeds the source food value')
    if (use.capability === 'throw-coat' && paramsOf(use).substance !== 'sticky' && !ontology.statuses[String(paramsOf(use).substance)]) throw new Error('the coating status does not exist in this game')
    errors.push(...(CAPABILITIES.get(use.capability)?.problems?.(use, type, ontology) ?? []))
  } catch (e) { errors.push(`${use.id}: ${(e as Error).message}`) }
  return errors
}

type WorkshopState = WorldState & { workshopPackages?: WorkshopPackage[]; workshopEvidence?: Record<string, WorkshopTrialReport> }
const clone = <T>(value: T): T => structuredClone(value)
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
/** A change detector, not an authenticity signature. Admission always recomputes the trial. */
function digest(value: unknown): string {
  const s = stable(value)
  let a = 2166136261, b = 2246822519
  for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); b = Math.imul(b ^ s.charCodeAt(i), 3266489917) }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${s.length}`
}
export function workshopPackages(eng: Engine): WorkshopPackage[] { return clone((eng.world.state as WorkshopState).workshopPackages ?? []) }
export function workshopChannelState(eng: Engine, id: string) {
  const pkg = active(eng, id)
  if (!pkg?.enabled) throw new Error('This package is not enabled')
  return channelState(eng, pkg)
}
function active(eng: Engine, id: string): WorkshopPackage | undefined { return workshopPackages(eng).filter(p => p.id === id).sort((a, b) => b.revision - a.revision)[0] }
/** Omitted uses remain in place. Repeating an identical use is safe; replacement is a different operation. */
export function appendWorkshopPlan(base: ResearchPlan | undefined, additions: ResearchPlan): ResearchPlan {
  const uses = new Map(base?.uses.map(use => [use.id, use]))
  for (const use of additions.uses) {
    const old = uses.get(use.id)
    if (old && stable(old) !== stable(use)) throw new Error(`Use ${use.id} already exists. Append with a new use ID or request a revision.`)
    uses.set(use.id, use)
  }
  const pending = [...new Map([...(base?.pending ?? []), ...(additions.pending ?? [])].map(entry => [stable(entry), entry])).values()]
  return readResearchPlan({ version: 1, uses: [...uses.values()], ...(pending.length && { pending }) })
}
function versions(plan: ResearchPlan): Record<string, number> { return Object.fromEntries(plan.uses.map(u => [u.capability, CAPABILITIES.get(u.capability)?.descriptor.version ?? 0])) }
function planDigest(draft: WorkshopDraft): string { return digest({ ...draft, capabilityVersions: versions(draft.plan) }) }
function copyEngine(eng: Engine): Engine {
  const trial = new Engine(clone(eng.world.state), clone(eng.world.onto.data), RuleLibrary.fromJSON(clone(eng.lib.toJSON())))
  trial.quality = { ...eng.quality }
  trial.tier = eng.tier
  trial.loadInvariants(clone(eng.invariants), [...eng.protectedFacts])
  trial.story.load(clone([...eng.story.defs.values()]))
  for (const [id, r] of eng.recipes) trial.recipes.set(id, clone(r))
  for (const [id, s] of eng.skills) trial.skills.set(id, clone(s))
  ensureFlightHooks(trial)
  return trial
}
function draftProblems(eng: Engine, draft: WorkshopDraft, restoring = false): string[] {
  const errors: string[] = []
  try { ident(draft.id, 'package'); readResearchPlan(draft.plan) } catch (e) { errors.push(String(e)) }
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 1) errors.push('A positive integer revision is required')
  if (typeof draft.typeId !== 'string' || !/^item\/[a-zA-Z0-9_/-]{1,160}$/.test(draft.typeId) || draft.typeId.includes('..')) errors.push('A package subject must be an item type')
  if (draft.origin && (!ID.test(draft.origin.id) || !Number.isSafeInteger(draft.origin.revision) || draft.origin.revision < 1 || !/^item\/[a-zA-Z0-9_/-]{1,160}$/.test(draft.origin.typeId) || draft.origin.typeId.includes('..'))) errors.push('Invalid package origin')
  if (draft.origin?.plan) try { readResearchPlan(draft.origin.plan) } catch (e) { errors.push(`Invalid origin plan: ${String(e)}`) }
  const previous = active(eng, draft.id)
  if (!restoring && draft.appendFrom !== undefined) {
    if (draft.design || draft.appendFrom !== (previous?.revision ?? 0) || previous && !previous.enabled) errors.push('The append baseline changed. Read the active package and propose again.')
    if (previous?.plan.uses.some(use => stable(use) !== stable(draft.plan.uses.find(next => next.id === use.id)))) errors.push('An append must preserve all installed uses')
  }
  if (!restoring && draft.revision <= (previous?.revision ?? 0)) errors.push(`Revision must be newer than ${previous?.revision ?? 0}`)
  if (previous && previous.typeId !== draft.typeId) errors.push('A package update cannot change its subject type')
  if (!restoring && workshopFlights(eng).some(f => f.packageId === draft.id)) errors.push('Wait for this package\'s in-flight items before updating it')
  if (!restoring && previous) for (const other of workshopPackages(eng).filter(p => p.enabled && p.id !== draft.id)) {
    if (other.dependsOn?.some(d => d.id === draft.id && d.revision !== draft.revision)) errors.push(`Package ${other.id} pins the existing revision; update or disable it first`)
  }
  if (draft.dependsOn && (!Array.isArray(draft.dependsOn) || draft.dependsOn.length > 16)) errors.push('Too many package dependencies')
  for (const dep of draft.dependsOn ?? []) {
    const found = active(eng, dep.id)
    if (dep.id === draft.id || !found?.enabled || found.revision !== dep.revision) errors.push(`Dependency ${dep.id}@${dep.revision} is not enabled`)
  }
  return errors
}
const markKey = (draft: WorkshopDraft, use: ResearchUse) => `creation_${draft.id}_${use.id}_inspected`
const impactKey = (draft: WorkshopDraft, use: ResearchUse) => `creation_${draft.id}_r${draft.revision}_${use.id}_impact`
const stickyId = (draft: WorkshopDraft, use: ResearchUse) => `creation_${draft.id}_r${draft.revision}_${use.id}_sticky`
const prefix = (draft: WorkshopDraft, use: ResearchUse) => `creation/${draft.id}/r${draft.revision}/${use.id}`
const namedParams = (draft: Pick<WorkshopDraft, 'id' | 'revision'>, use: ResearchUse): Record<string, PropValue> => ({ creationPackage: draft.id, creationRevision: draft.revision, creationUse: use.id })
function gate(draft: WorkshopDraft, use: ResearchUse): any {
  return { all: Object.entries(namedParams(draft, use)).map(([key, value]) => ({ param: { key, cmp: value } })) }
}
function targetSelector(target: string, spread = false): Selector { return { type: target === 'person' ? 'actor/person' : target === 'creature' ? 'actor/creature' : target === 'ground' ? 'tile' : spread ? 'item/food' : 'item', ...(spread && { tags: ['edible'] }) } }
interface Compiled {
  rules: Rule[]
  statuses: StatusDef[]
}
function checkEffects(effects: Effect[], propertyPrefix: string, actorCost = false): void {
  if (effects.length > 24) throw new Error('A capability exceeds its effect budget')
  for (const effect of effects) {
    if ('of' in effect || !['emit', 'destroy', 'setProp', 'addProp', 'addStatus', 'removeStatus', 'vfx', 'log'].includes(effect.op)) throw new Error('A capability uses an unsupported effect or a cross-host write')
    if (effect.op === 'setProp' && !effect.key.startsWith(propertyPrefix)) throw new Error('A capability may set only its own creation properties')
    if (effect.op === 'addProp' && !(actorCost && effect.key === 'hunger' && typeof effect.delta === 'number' && effect.delta >= -30 && effect.delta <= -1 && effect.min === 0) && (effect.key !== 'food' || !(typeof effect.delta === 'number' && effect.delta >= 0 && effect.delta <= 10 || record(effect.delta) && 'param' in effect.delta && effect.delta.param === 'creationFood' && Object.keys(effect.delta).length === 1) || typeof effect.max !== 'number' || effect.max > 100)) throw new Error('A capability property gain/cost is outside its budget')
    if (effect.op === 'addStatus' && (typeof effect.duration !== 'number' || effect.duration < 1 || effect.duration > 600)) throw new Error('A capability coating must have a bounded duration')
    if (effect.op === 'emit' && !['coat', 'strike', 'restore', 'push', 'offered', 'notify'].includes(effect.impulse)) throw new Error('A capability impulse is not supported')
    const numbers = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v) && Math.abs(v) <= 1000 : Array.isArray(v) ? v.every(numbers) : record(v) ? Object.values(v).every(numbers) : typeof v !== 'function'
    if (!numbers(effect)) throw new Error('A capability effect contains an invalid number or executable value')
  }
}
function withModPort<T>(eng: Engine, fn: (port: ModPort) => T): T {
  const sink = eng.undefinedSink
  const port = sink instanceof ModPort ? sink : new ModPort(eng)
  try { return fn(port) } finally { eng.undefinedSink = sink }
}
function builtinBuild(ctx: WorkshopCapabilityContext): WorkshopCapabilityBuild {
  const { use, params: p, signal } = ctx
  const draft = { id: ctx.packageId, revision: ctx.revision } as WorkshopDraft
  if (['channel', 'empower'].includes(use.capability)) return buildChannel(ctx)
  if (['eat', 'feed', 'gift', 'drink', 'mine', 'attack', 'wear', 'cast'].includes(use.capability)) return {}
  if (use.capability === 'inspect') return { effects: [{ op: 'setProp', key: markKey(draft, use), value: true }, { op: 'log', text: L('You inspect {host}.', '你查看了{host}。') }, { op: 'vfx', fx: 'sparkle' }] }
  const status = use.capability === 'spread' || p.substance === 'sticky' ? stickyId(draft, use) : String(p.substance)
  const receiver: Effect[] = [{ op: 'addStatus', status, duration: Number(p.duration) }, { op: 'vfx', fx: 'splash' }, { op: 'log', text: L('The coating clings to {host}.', '涂层附着在{host}上。') }]
  if (use.capability === 'spread' && (!Object.hasOwn(use.params ?? {}, 'foodBoost') || Number(p.foodBoost) > 0)) receiver.push({ op: 'addProp', key: 'food', delta: { param: 'creationFood' }, max: 100 })
  const effects: Effect[] = []
  if (use.capability === 'throw-coat' && Number(p.power) > 0) effects.push({ op: 'emit', impulse: 'strike', to: 'target', params: { power: Number(p.power), edge: 'blunt' } })
  effects.push({ op: 'emit', impulse: 'coat', to: 'target', params: { ...signal, substance: `${draft.id}:${use.id}`, ...(use.capability === 'spread' && { creationFood: Object.hasOwn(use.params ?? {}, 'foodBoost') ? Number(p.foodBoost) : { prop: 'food' as const, of: 'host' as const } }) } }, { op: 'destroy' })
  return { effects, receiver: { host: targetSelector(use.target, use.capability === 'spread'), effects: receiver }, ...(status === stickyId(draft, use) && { statuses: [{ id: status, name: L('Sticky coating', '黏稠涂层'), moveDelay: 2, overlay: 'oil' }] }) }
}
/** Only registered, developer-owned compilers produce ASTs. The model supplies bounded parameters. */
function compile(eng: Engine, draft: WorkshopDraft): Compiled {
  const rules: Rule[] = [], statuses: StatusDef[] = []
  for (const use of draft.plan.uses) {
    const signal = namedParams(draft, use)
    const build = CAPABILITIES.get(use.capability)!.compile(clone({ packageId: draft.id, revision: draft.revision, use, params: paramsOf(use), type: eng.world.onto.data.types[draft.typeId], ontology: eng.world.onto.data, namespace: prefix(draft, use), signal }))
    checkEffects([...(build.effects ?? []), ...(build.receiver?.effects ?? [])], `creation_${draft.id}_`)
    checkEffects(build.actorEffects ?? [], `creation_${draft.id}_`, true)
    checkEffects(build.empowered?.effects ?? [], `creation_${draft.id}_`)
    if ([...(build.effects ?? []), ...(build.receiver?.effects ?? [])].some(e => e.op === 'addProp' && e.key === 'food') && !build.effects?.some(e => e.op === 'destroy')) throw new Error('A food gain must consume its source item')
    if ((build.effects?.length ?? 0) + (build.receiver?.effects.length ?? 0) + (build.actorEffects?.length ?? 0) + (build.empowered?.effects.length ?? 0) > 24 || (build.statuses?.length ?? 0) > 4) throw new Error('A capability exceeds its effect/status budget')
    if (!build.effects?.length) continue
    const local = { types: [], statuses: (build.statuses ?? []).map(s => s.id) }
    const source = { origin: 'base' as const, author: `creation:${draft.id}@${draft.revision}`, local }
    for (const status of build.statuses ?? []) {
      if (!status.id.startsWith(`creation_${draft.id}_r${draft.revision}_`)) throw new Error('A capability status must belong to its package revision')
      statuses.push(clone(status))
    }
    const armed = (role: 'host' | 'source') => ({ prop: { role, key: channelArmedKey(draft, use.id), cmp: true } })
    if (build.actorEffects) rules.push({ id: `${prefix(draft, use)}/actor`, host: { type: 'actor' }, on: 'impulse/notify', tree: { if: { all: [gate(draft, use), { same: ['host', 'actor'] }, armed('source')] }, then: { do: build.actorEffects }, else: 'inherit' }, source: clone(source), label: use.label })
    if (build.receiver) {
      if (!build.receiver.host.type || !/^(item|actor|tile)(\/|$)/.test(build.receiver.host.type) || build.receiver.host.id) throw new Error('A capability receiver must be a world object class')
      rules.push({ id: `${prefix(draft, use)}/receive`, host: build.receiver.host, on: 'impulse/coat', tree: { if: build.actorEffects ? { all: [gate(draft, use), armed('source')] } : gate(draft, use), then: { do: build.receiver.effects }, else: 'inherit' }, source: clone(source), label: use.label })
    }
    const target = use.target === 'self' ? { same: ['actor', 'target'] } : { is: { role: 'target', sel: targetSelector(use.target, use.capability === 'spread') } }
    const outcome: any = use.capability === 'throw-coat'
      ? { if: { all: [{ param: { key: 'creationFlightPhase', cmp: 'impact' } }, { prop: { role: 'host', key: impactKey(draft, use), cmp: true } }] }, then: { do: build.effects }, else: { if: { param: { key: 'creationFlightPhase', cmp: 'launch' } }, then: { do: [] }, else: 'inherit' } }
      : build.empowered ? { if: { has: { role: 'actor', status: build.empowered.status } }, then: { do: build.empowered.effects }, else: { do: build.effects } } : { do: build.effects }
    rules.push({ id: `${prefix(draft, use)}/use`, host: { type: draft.typeId }, on: 'act/use', tree: { if: { all: [gate(draft, use), target as any, ...(build.actorEffects ? [armed('host')] : [])] }, then: outcome, else: 'inherit' }, source: clone(source), label: use.label })
  }
  const unique = new Map<string, StatusDef>()
  for (const status of statuses) { if (unique.has(status.id) && stable(unique.get(status.id)) !== stable(status)) throw new Error('A package repeats a status with different definitions'); unique.set(status.id, status) }
  return { rules, statuses: [...unique.values()] }
}
function install(eng: Engine, draft: WorkshopDraft): Compiled {
  const compiled = compile(eng, draft)
  for (const s of compiled.statuses) {
    if (eng.world.onto.data.statuses[s.id] && stable(eng.world.onto.data.statuses[s.id]) !== stable(s)) throw new Error(`Status id ${s.id} is already in use`)
    if (eng.world.onto.data.statuses[s.id]) continue
    const admission = withModPort(eng, port => port.submit(undefined, { scope: 'save', artifacts: [{ kind: 'status', status: s }] }))
    if (!admission.ok) throw new Error(admission.errors.join('; '))
  }
  for (const rule of compiled.rules) {
    const old = eng.lib.rules.get(rule.id)
    if (old && old.source?.author !== `creation:${draft.id}@${draft.revision}`) throw new Error(`Rule id ${rule.id} is already in use`)
    eng.lib.add(clone(rule))
  }
  return compiled
}
export interface WorkshopUseAction { verb: 'use' | 'put'; label: Text; target: string; params: Record<string, PropValue> }
export function workshopUseAction(eng: Engine, packageId: string, useId: string): WorkshopUseAction {
  const pkg = active(eng, packageId), use = pkg?.plan.uses.find(u => u.id === useId)
  if (!pkg?.enabled || !use) throw new Error('This package use is not enabled')
  if (stable(pkg.capabilityVersions) !== stable(versions(pkg.plan))) throw new Error('This package requires unavailable capability versions')
  paramsOf(use)
  return { verb: CAPABILITIES.get(use.capability)?.verb ?? 'use', target: use.target, label: clone(use.label), params: namedParams(pkg, use) }
}
/** Select the exact bag instance through the same slot controls as the inventory. */
function selectNativeWeapon(eng: Engine, item: Entity): boolean {
  const w = eng.world, actor = w.player
  if (weaponOf(w, actor)?.id === item.id) return true
  if (!eng.controls.allows('select') || w.get(actor.held)?.frozenBy) return false
  eng.controls.sync()
  if (w.worn(actor).some(e => e.id === item.id)) {
    // Taking off an equipped piece needs a free bag slot; do not drop it from a full bag.
    if (!actor.slots?.some(k => !k)) return false
    eng.controls.wear(item.id)
  }
  let slot = actor.slotItems?.findIndex(group => group?.includes(item.id)) ?? -1
  if (slot < 0) return false
  if (slot >= ROW) { eng.controls.swap(slot, actor.selected ?? 0); slot = actor.selected ?? 0 }
  eng.controls.select(slot)
  return weaponOf(w, actor)?.id === item.id
}
/** An explicit player-selected use; ordinary actions never gain creation parameters. */
export function runWorkshopUse(eng: Engine, packageId: string, useId: string, target?: Ref, itemId?: string, refuse?: (reason: string) => void): boolean {
  const pkg = active(eng, packageId), action = workshopUseAction(eng, packageId, useId)
  const w = eng.world, actor = w.player
  const use = pkg!.plan.uses.find(u => u.id === useId)!
  const capability = CAPABILITIES.get(use.capability)!
  const native = capability.native
  const refused = (reason: string) => { refuse?.(reason); return false }
  const useEquipped = !!native || capability.equipped || use.capability === 'inspect'
  const worn = w.worn(actor).map(e => e.id)
  const carried = [...new Set([...(actor.contents ?? []), ...(actor.held ? [actor.held] : []), ...(useEquipped ? worn : [])])].filter(id => useEquipped || !worn.includes(id))
  const item = itemId ? w.get(itemId) : carried.map(id => w.get(id)).find(e => e?.type === pkg!.typeId)
  if (!item || item.type !== pkg!.typeId || !carried.includes(item.id)) return refused('This use cannot reach the required carried or equipped instance')
  if (item.frozenBy) return refused('The required instance is frozen')
  if (eng.busy(actor)) return refused('The actor is busy')
  const onto = action.target === 'self' ? { e: actor.id } : target
  if (!onto) return false
  const pos = w.posOf(w.get(onto.e))
  if (!eng.controls.allows(action.verb, { type: item.type, ...(pos && { at: { x: pos.x, y: pos.y } }) })) return false
  const view = w.view(onto)
  if (use.capability === 'spread' && use.params?.foodBoost !== undefined && Number(use.params.foodBoost) > w.num(item, 'food')) return false
  const sel = targetSelector(action.target, use.capability === 'spread')
  if (action.target !== 'self' && (!view || !(view.type === sel.type || view.type.startsWith(`${sel.type}/`)) || sel.tags?.some(t => !view.tags.has(t)))) return false
  const reach = ['throw-coat', 'channel'].includes(use.capability) ? Number(paramsOf(use).range) : undefined
  if (action.target !== 'self') {
    const at = w.posOf(actor), to = w.posOf(w.get(onto.e))
    if (!at || !to || at.map !== to.map || !eng.inReach(action.verb, actor, onto, { e: item.id }, reach)) return refused('The target is out of reach for this instance')
    if (use.capability === 'throw-coat' && !eng.lineOfSight(at.map, at, to)) return refused('The throw has no clear line to the target')
  }
  if (native === 'wear') {
    eng.controls.wear(item.id, true)
    return w.worn(actor).some(e => e.id === item.id)
  }
  if (native === 'channel' || native === 'empower') return runChannel(eng, pkg!, use.id, use.capability, paramsOf(use), item, onto, action.params)
  if (native === 'attack') {
    const at = w.posOf(actor), to = w.posOf(w.get(onto.e))
    if (!at || !to || onto.e === actor.id || (at.z ?? 0) !== (to.z ?? 0)) return refused('The native attack needs another target at the same height')
    if (!eng.ready(`atk:${actor.id}`)) return refused('The native attack is on cooldown')
    if (eng.isProtected(onto) || eng.spares(actor, onto)) return refused('The native attack cannot target this creature')
    const restriction = eng.combat.refuses(actor, item, 'fight')
    if (restriction) return refused(`Combat refused the weapon: ${JSON.stringify(restriction)}`)
    const range = eng.reachOf('use', actor, w.get(onto.e), item) ?? 1
    if (!eng.lineOfSight(at.map, at, to) || range > 1 && at.x !== to.x && at.y !== to.y) return refused('The native attack has no clear attack line')
    if (!selectNativeWeapon(eng, item)) return refused(`Could not select weapon instance ${item.id}`)
    if (view?.type.startsWith('actor/person') && !w.hasStatus({ e: actor.id }, 'drawn') && !eng.controls.toggle('drawn', true)) return false
    eng.controls.face(to)
    const mark = eng.traced
    eng.playerAttack(onto)
    return eng.traced > mark && eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length)).some(t => t.ev.kind === 'act/use' && t.ev.host.e === item.id && t.ev.params?.attack === true)
  }
  if (use.capability === 'throw-coat') {
    const from = w.posOf(actor), to = w.posOf(w.get(onto.e))
    if (!from || !to || (from.z ?? 0) !== (to.z ?? 0) || !canLaunchWorkshopFlight(eng)) return false
    if (Number(paramsOf(use).power) > 0 && eng.isProtected(onto)) return false
    const params = { ...action.params, creationFlightPhase: 'launch', attack: Number(paramsOf(use).power) > 0 }
    const probe = eng.resolveEvent(eng.actEvent(action.verb, actor.id, onto, { e: item.id }, params))
    if (probe.rule?.id !== `${prefix(pkg as WorkshopDraft, use)}/use`) return false
    if (!eng.act(action.verb, actor.id, onto, { instrument: { e: item.id }, params, ...(reach !== undefined && { reach }) }).defined) return false
    ensureFlightHooks(eng)
    return launchWorkshopFlight(eng, { itemId: item.id, typeId: item.type, actorId: actor.id, packageId, revision: pkg!.revision, useId, from, to, targetId: onto.e })
  }
  return eng.act(action.verb, actor.id, onto, { instrument: { e: item.id }, params: action.params, ...(reach !== undefined && { reach }) }).defined
}

function ensureFlightHooks(eng: Engine): void {
  installCreationFlightHooks(eng, (flight: CreationFlight) => {
    const pkg = active(eng, flight.packageId), use = pkg?.plan.uses.find(u => u.id === flight.useId)
    if (!pkg?.enabled || pkg.revision !== flight.revision || !use || use.capability !== 'throw-coat' || stable(pkg.capabilityVersions) !== stable(versions(pkg.plan))) return false
    const target = eng.world.get(flight.targetId), at = eng.world.posOf(target)
    if (!target || !at || at.map !== flight.to.map || at.x !== flight.to.x || at.y !== flight.to.y || (at.z ?? 0) !== (flight.to.z ?? 0)) return false
    const item = eng.world.get(flight.itemId)
    if (!item) return false
    // Only the host can arm impact; a phase string supplied to an ordinary action cannot land it.
    eng.author(() => {
      eng.world.place(item, { on: 'tile', ...flight.to })
      eng.world.setProp(item, impactKey(pkg, use), true)
    })
    const ev = eng.actEvent('use', flight.actorId, { e: target.id }, { e: flight.itemId }, { ...namedParams(pkg, use), creationFlightPhase: 'impact', attack: Number(paramsOf(use).power) > 0 })
    try {
      if (eng.resolveEvent(ev).rule?.id !== `${prefix(pkg, use)}/use`) return false
      const result = eng.dispatch(ev)
      eng.flush()
      return result.defined
    } finally {
      const left = eng.world.get(flight.itemId)
      if (left) eng.author(() => eng.world.setProp(left, impactKey(pkg, use), undefined))
    }
  })
}

function builtinVerify(capability: string, o: WorkshopCapabilityObservation): string[] {
  if (['channel', 'empower'].includes(capability)) return verifyChannel(o)
  const errors: string[] = []
  if (['eat', 'feed'].includes(capability) && (o.after.sourceExists || Number(o.after.hunger) <= Number(o.before.hunger))) errors.push('The item must be consumed and the receiver actually fed')
  if (capability === 'gift' && o.after.holder !== o.after.targetId) errors.push('The gift must actually enter the receiver inventory')
  if (capability === 'inspect' && o.after.inspected !== true) errors.push('The inspection state was not recorded')
  if (capability === 'drink' && (o.after.sourceExists && o.after.sourceType === o.before.sourceType || !(Number(o.after.hp) > Number(o.before.hp) || Number(o.after.hunger) > Number(o.before.hunger) || (o.after.statuses as string[]).some(s => !(o.before.statuses as string[]).includes(s))))) errors.push('The drink must be consumed or emptied and affect its drinker')
  if (capability === 'mine' && o.after.targetExists && Number(o.after.hp) >= Number(o.before.hp)) errors.push('The pickaxe did not alter the rock')
  if (['attack', 'cast'].includes(capability) && (o.after.targetExists && Number(o.after.hp) >= Number(o.before.hp) || !o.trace.some(t => t.kind === 'impulse/strike'))) errors.push('The native attack did not damage its target')
  if (capability === 'cast' && !o.trace.some(t => t.rule === 'use/spell')) errors.push('The native spell rule did not execute')
  if (capability === 'wear' && o.after.worn !== true) errors.push('The item did not enter its native equipment slot')
  if (['spread', 'throw-coat'].includes(capability) && (o.after.sourceExists || !(o.after.statuses as string[]).includes(o.expectedStatus!))) errors.push('The source must be consumed and the coating must reach its receiver')
  if (capability === 'throw-coat' && paramsOf(o.use).substance === 'sticky' && ['person', 'creature'].includes(o.use.target) && Number(o.after.moveDelay) < Number(o.before.moveDelay) * 2) errors.push('The sticky coating did not actually slow movement')
  if (capability === 'throw-coat' && Number(paramsOf(o.use).power) > 0 && ['person', 'creature'].includes(o.use.target) && o.after.targetExists && Number(o.after.hp) >= Number(o.before.hp)) errors.push('The requested impact did not harm the unarmoured trial target. Native material hardness and defence still apply: revise the represented container material/makeup and bounded force, or explicitly choose a harmless coating')
  if (capability === 'spread') {
    const boost = Object.hasOwn(o.use.params ?? {}, 'foodBoost') ? Number(paramsOf(o.use).foodBoost) : Number(o.before.sourceFood)
    if (Number(o.after.food) - Number(o.before.food) !== Math.min(boost, 100 - Number(o.before.food))) errors.push('The food change did not match the source-conserving boost')
  }
  return errors
}
function packageOf(eng: Engine, draft: WorkshopDraft, compiled: Compiled, typeDefinition?: TypeDef): WorkshopPackage {
  const previous = active(eng, draft.id)
  return { id: draft.id, revision: draft.revision, kind: previous?.kind ?? (draft.design ? 'item' : 'uses'), typeId: draft.typeId, plan: clone(draft.plan), ...(draft.dependsOn && { dependsOn: clone(draft.dependsOn) }), ...((draft.origin ?? previous?.origin) && { origin: clone(draft.origin ?? previous!.origin!) }), ...((typeDefinition ?? previous?.typeDefinition) && { typeDefinition: clone(typeDefinition ?? previous!.typeDefinition!) }), capabilityVersions: versions(draft.plan), ruleIds: compiled.rules.map(r => r.id), statusIds: compiled.statuses.map(s => s.id), enabled: true, createdAt: new Date().toISOString() }
}
function remember(eng: Engine, pkg: WorkshopPackage): void {
  eng.author(() => {
    const state = eng.world.state as WorkshopState
    state.workshopPackages = [...(state.workshopPackages ?? []).map(p => p.id === pkg.id ? { ...p, enabled: false } : p), clone(pkg)]
  })
}
function removeOwnedRules(eng: Engine, id: string): void {
  for (const pkg of workshopPackages(eng).filter(p => p.id === id)) for (const rule of pkg.ruleIds) {
    if (eng.lib.rules.get(rule)?.source?.author === `creation:${pkg.id}@${pkg.revision}`) eng.lib.remove(rule)
  }
}
function stage(eng: Engine, draft: WorkshopDraft, known?: Iterable<Recipe>): { eng: Engine; compiled: Compiled; definition?: TypeDef } {
  const trial = copyEngine(eng)
  removeOwnedRules(trial, draft.id)
  let definition: TypeDef | undefined
  if (draft.design) definition = withModPort(trial, port => trialResearch(trial, port, clone(draft.design), draft.typeId, known))
  const type = trial.world.onto.data.types[draft.typeId]
  if (!type) throw new Error(`Unknown subject type ${draft.typeId}`)
  const problems = creationPlanProblems(draft.plan, type, trial.world.onto.data)
  if (problems.length) throw new Error(problems.join('; '))
  const compiled = install(trial, draft)
  remember(trial, packageOf(eng, draft, compiled, definition))
  return { eng: trial, compiled, definition }
}
function trialUse(staged: Engine, draft: WorkshopDraft, use: ResearchUse): WorkshopUseReport {
  const eng = copyEngine(staged), w = eng.world, actor = w.player
  const staminaCapacity = w.num(actor, 'maxHunger', 20)
  const errors: string[] = [], mark = eng.traced
  let observed: Record<string, unknown> = {}
  try {
    const at = w.posOf(actor)
    if (!at) throw new Error('The actor must be in a loaded map')
    if (['channel', 'empower'].includes(use.capability) && Number(paramsOf(use).cost) > staminaCapacity) throw new Error(`Stamina cost exceeds the player's fullness capacity (${staminaCapacity})`)
    const near = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).find(p => w.inBounds(at.map, p.x, p.y) && !w.blocked(at.map, p.x, p.y, actor.id)) ?? at
    const capability = CAPABILITIES.get(use.capability)!
    const currentWeapon = !draft.design && (capability.native === 'attack' || capability.equipped) ? weaponOf(w, actor) : undefined
    const existing = currentWeapon?.type === draft.typeId ? currentWeapon
      : !draft.design && capability.equipped ? w.worn(actor).find(entity => entity.type === draft.typeId) : undefined
    let item: Entity, target: Ref = { e: actor.id }
    eng.author(() => {
      item = existing ?? w.create(draft.typeId, { on: 'inside', holder: actor.id })
      // Known states for this isolated experiment, never writes to the running world.
      if (use.target === 'self') { w.setProp(actor, 'hunger', 0); w.setProp(actor, 'maxHunger', 100); w.setProp(actor, 'hp', 1); w.setProp(actor, 'maxHp', 100) }
      else if (use.target === 'person' || use.target === 'creature') {
        const creature = Object.keys(w.onto.data.types).find(id => id.startsWith('actor/creature/'))
        if (use.target === 'creature' && !creature) throw new Error('This game supplies no creature for the trial')
        const e = w.add({ id: `creation-test-${use.id}`, type: use.target === 'person' ? 'actor/person' : creature!, place: { on: 'tile', map: at.map, x: near.x, y: near.y }, props: { hunger: 0, maxHunger: 100, hp: 100, maxHp: 100, age: 30 }, ...(use.target === 'person' && { npc: { role: 'villager', schedule: [] } }) })
        target = { e: e.id }
      } else if (use.target === 'item') {
        const targetType = 'item/food/bread' in w.onto.data.types ? 'item/food/bread' : Object.keys(w.onto.data.types).find(id => id.startsWith('item/food/'))
        if (!targetType) throw new Error('This game supplies no food target for the coating trial')
        const e = w.create(targetType, { on: 'tile', map: at.map, x: near.x, y: near.y })
        target = { e: e.id }
      } else if (use.target === 'ground') {
        if (use.capability === 'mine') w.setTerrain(at.map, near.x, near.y, 'rock')
        target = w.cellRef(at.map, near.x, near.y)
      }
      else throw new Error(`No trial fixture for target ${use.target}`)
      if (['channel', 'empower'].includes(use.capability)) { w.setProp(actor, 'hunger', staminaCapacity); w.setProp(actor, 'maxHunger', staminaCapacity) }
      // Ice freezes and lightning charges only what is wet: the isolated trial target starts wet so either branch can show its reaction.
      // Ice freezes only what is wet, so water's probabilistic trial starts wet; fire and lightning both
      // show their native reaction on a dry creature, so fire's trial stays dry for the base-fire branch.
      if (use.capability === 'channel' && String(paramsOf(use).element) === 'water' && variantChanceOf(paramsOf(use)) > 0) w.setStatus(target, 'wet', w.state.tick + 400)
    })
    if (['channel', 'empower'].includes(use.capability)) {
      if (/^item\/weapon\/magic(?:\/|$)/.test(item!.type)) { if (!selectNativeWeapon(eng, item!)) throw new Error('The magic focus could not be held') }
      else { eng.controls.wear(item!.id, true); if (!w.worn(actor).some(e => e.id === item!.id)) throw new Error('The elemental accessory could not be equipped') }
    }
    const read = () => {
      const to = w.get(target.e), source = w.get(item!.id)
      return { sourceExists: !!source, sourceType: source?.type, sourceFood: source ? w.num(source, 'food') : 0, sourceProps: clone(source?.props ?? {}), holder: source?.place.on === 'inside' || source?.place.on === 'hand' ? source.place.holder : undefined, targetId: target.e, targetExists: !!to, targetProps: clone(to?.props ?? {}), hunger: to ? w.num(to, 'hunger') : 0, food: to ? w.num(to, 'food') : 0, hp: to ? w.num(to, 'hp', w.num(to, 'maxHp')) : 0, moveDelay: to ? eng.combat.delay(to, 1, 'move') : 0, statuses: to ? Object.keys(to.statuses ?? {}) : [], worn: w.worn(actor).some(e => e.id === item!.id), defense: w.stat(actor, 'def'), inspected: source ? w.prop(source, markKey(draft, use)) : undefined, ...(['channel', 'empower'].includes(use.capability) && { actorHunger: w.num(actor, 'hunger'), targetPos: w.posOf(to), tick: w.state.tick, released: w.prop(actor, releasedKey(draft)), ...channelState(eng, draft) }) }
    }
    const before = read()
    const ran = runWorkshopUse(eng, draft.id, use.id, target, item!.id, reason => errors.push(reason))
    if (!ran && !errors.length) errors.push('The normal explicit-use action could not run')
    if (use.capability === 'throw-coat') {
      for (let i = 0; i < 5 && workshopFlights(eng).some(f => f.itemId === item!.id); i++) eng.tick()
      if (workshopFlights(eng).some(f => f.itemId === item!.id)) errors.push('The throw did not finish within its flight budget')
    }
    const after = read()
    const trace = eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length)).map(t => ({ kind: t.ev.kind, rule: t.rule, ...(typeof t.ev.params?.element === 'string' && { element: t.ev.params.element }) }))
    const status = use.capability === 'spread' || paramsOf(use).substance === 'sticky' ? stickyId(draft, use) : String(paramsOf(use).substance ?? '')
    if (ran) {
      errors.push(...CAPABILITIES.get(use.capability)!.verify({ use: clone(use), before, after, trace, expectedStatus: status }))
      if (!trace.some(t => t.rule)) errors.push('No rule executed')
    }
    if (eng.traced - mark > 128) errors.push('The use exceeded its event budget')
    const countBeforeRepeat = Object.keys(w.state.entities).length
    if (!after.sourceExists) {
      if (runWorkshopUse(eng, draft.id, use.id, target, item!.id)) errors.push('A consumed item was usable again')
      if (Object.keys(w.state.entities).length !== countBeforeRepeat) errors.push('Repeating a consumed item made resources')
    }
    for (const f of w.fx) if (f.t === 'log' && f.tone === 'warn') errors.push(typeof f.text === 'string' ? f.text : f.text.en ?? f.text.zh ?? '')
    observed = { before, after, consumedItemCannotRepeat: !after.sourceExists, feedback: w.fx.filter(f => f.t === 'log' || f.t === 'vfx') }
    return { id: use.id, ok: !errors.length, observed, trace, errors }
  } catch (e) { errors.push((e as Error).message) }
  return { id: use.id, ok: false, observed, trace: eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length)).map(t => ({ kind: t.ev.kind, rule: t.rule })), errors }
}
export function trialWorkshopPackage(eng: Engine, draft: WorkshopDraft, known?: Iterable<Recipe>): WorkshopTrialReport {
  const report: WorkshopTrialReport = { ok: false, planDigest: planDigest(draft), uses: [], errors: draftProblems(eng, draft) }
  if (report.errors.length) return report
  try {
    const staged = stage(eng, clone(draft), known)
    report.uses = draft.plan.uses.map(use => trialUse(staged.eng, draft, use))
    const previous = draft.appendFrom ? active(eng, draft.id) : undefined
    if (previous) {
      const failed = new Set(report.uses.filter(use => !use.ok).map(use => use.id))
      const comparisons = previous.plan.uses.filter(use => failed.has(use.id)).map(use => ({
        use: use.id, baseline: trialUse(eng, previous, use),
      }))
      if (comparisons.length) report.comparisons = comparisons
    }
    report.errors.push(...report.uses.filter(u => !u.ok).flatMap(u => u.errors.map(e => `${u.id}: ${e}`)))
    if (!report.uses.length) report.errors.push('A package needs at least one supported use')
  } catch (e) { report.errors.push((e as Error).message) }
  report.ok = !report.errors.length
  return report
}
/** Synchronous revalidation closes the gap between preview and adoption. */
export function registerWorkshopPackage(eng: Engine, draft: WorkshopDraft, report: WorkshopTrialReport, known?: Iterable<Recipe>): WorkshopRegistration {
  if (!report?.ok || report.planDigest !== planDigest(draft)) return { ok: false, errors: ['The package has no matching successful trial'] }
  const recipes = known ? [...known] : undefined
  const current = trialWorkshopPackage(eng, draft, recipes)
  if (!current.ok) return { ok: false, errors: current.errors }
  // All model data and dependencies were checked without mutating the running world.
  const previous = active(eng, draft.id)
  let definition: TypeDef | undefined
  if (draft.design) definition = withModPort(eng, port => trialResearch(eng, port, clone(draft.design), draft.typeId, recipes))
  removeOwnedRules(eng, draft.id)
  const compiled = install(eng, draft)
  const pkg = packageOf(eng, draft, compiled, definition ?? previous?.typeDefinition)
  remember(eng, pkg)
  ensureFlightHooks(eng)
  return { ok: true, package: clone(pkg), errors: [] }
}

function references(value: unknown, id: string): boolean {
  if (typeof value === 'string') return value === id || value.startsWith(`${id}/`)
  if (Array.isArray(value)) return value.some(v => references(v, id))
  return record(value) && Object.entries(value).some(([k, v]) => k === id || references(v, id))
}
export function workshopDependencyProblems(eng: Engine, packageId: string): string[] {
  const pkg = active(eng, packageId)
  if (!pkg) return ['Unknown package']
  const errors: string[] = []
  if (workshopFlights(eng).some(f => f.packageId === packageId)) errors.push('Wait for this package\'s in-flight items before disabling it')
  for (const other of workshopPackages(eng).filter(p => p.enabled && p.id !== pkg.id)) if (other.dependsOn?.some(d => d.id === pkg.id)) errors.push(`Package ${other.id} depends on this package`)
  if (pkg.kind === 'item') for (const other of workshopPackages(eng).filter(p => p.enabled && p.id !== pkg.id && p.typeId === pkg.typeId)) errors.push(`Package ${other.id} uses this package's item type`)
  const owned = workshopPackages(eng).filter(p => p.id === pkg.id)
  const ids = [...new Set(owned.flatMap(p => p.statusIds)), ...(pkg.kind === 'item' ? [pkg.typeId] : [])]
  // Trial receipts describe former observations; they do not hold live type or status references.
  const { workshopPackages: _packages, workshopEvidence: _evidence, ...state } = eng.world.state as WorkshopState
  for (const id of ids) {
    if (references(state, id)) errors.push(`World or map state still references ${id}`)
    for (const r of eng.lib.rules.values()) if (!r.id.startsWith(`creation/${pkg.id}/`) && references(r, id)) errors.push(`Rule ${r.id} still references ${id}`)
    for (const t of eng.lib.types) if (t.id !== pkg.typeId && references(t, id)) errors.push(`Type ${t.id} still references ${id}`)
    for (const r of eng.recipes.values()) if (r.id !== pkg.typeId && references(r, id)) errors.push(`Recipe ${r.id} still references ${id}`)
  }
  return errors
}
export function disableWorkshopPackage(eng: Engine, packageId: string): WorkshopRegistration {
  const pkg = active(eng, packageId)
  if (!pkg) return { ok: false, errors: ['Unknown package'] }
  const errors = workshopDependencyProblems(eng, packageId)
  if (errors.length) return { ok: false, errors }
  removeOwnedRules(eng, packageId)
  for (const p of workshopPackages(eng).filter(p => p.id === packageId)) for (const id of p.statusIds) { eng.lib.removeStatus(id); eng.world.onto.removeStatus(id) }
  if (pkg.kind === 'item') { eng.lib.removeType(pkg.typeId); eng.world.onto.removeType(pkg.typeId); eng.recipes.delete(pkg.typeId) }
  eng.author(() => { const state = eng.world.state as WorkshopState; state.workshopPackages = (state.workshopPackages ?? []).map(p => p.id === packageId ? { ...p, enabled: false } : p) })
  return { ok: true, package: { ...pkg, enabled: false }, errors: [] }
}
/** Call after a save/library reload. Recompile data; never trust saved executable rules. */
export function restoreWorkshopPackages(eng: Engine): string[] {
  const errors: string[] = []
  const packages = workshopPackages(eng)
  for (const id of new Set(packages.map(p => p.id))) removeOwnedRules(eng, id)
  for (const pkg of packages) {
    if (!active(eng, pkg.id)?.enabled) continue
    try {
      ident(pkg.id, 'package'); readResearchPlan(pkg.plan)
      if (stable(pkg.capabilityVersions) !== stable(versions(pkg.plan))) throw new Error('Its capability versions are unavailable')
      if (pkg.typeDefinition && !eng.world.onto.data.types[pkg.typeId]) {
        const admitted = withModPort(eng, port => port.submit(undefined, { scope: 'save', artifacts: [{ kind: 'type', type: clone(pkg.typeDefinition!) }] }))
        if (!admitted.ok) throw new Error(admitted.errors.join('; '))
      }
      const type = eng.world.onto.data.types[pkg.typeId]
      if (!type) { if (pkg.enabled) throw new Error('Its subject type is unavailable'); continue }
      const draft: WorkshopDraft = { id: pkg.id, revision: pkg.revision, typeId: pkg.typeId, plan: pkg.plan, dependsOn: pkg.dependsOn, origin: pkg.origin }
      const issues = [...draftProblems(eng, draft, true), ...creationPlanProblems(pkg.plan, type, eng.world.onto.data)]
      if (issues.length && pkg.enabled) throw new Error(issues.join('; '))
      const compiled = compile(eng, draft)
      // Old coating definitions may still be on objects after a use-plan update.
      for (const status of compiled.statuses) if (!eng.world.onto.data.statuses[status.id]) {
        const admitted = withModPort(eng, port => port.submit(undefined, { scope: 'save', artifacts: [{ kind: 'status', status }] }))
        if (!admitted.ok) throw new Error(admitted.errors.join('; '))
      }
      for (const id of pkg.ruleIds) if (eng.lib.rules.get(id)?.source?.author === `creation:${pkg.id}@${pkg.revision}`) eng.lib.remove(id)
      if (pkg.enabled && active(eng, pkg.id)?.revision === pkg.revision) for (const r of compiled.rules) eng.lib.add(clone(r))
    } catch (e) { errors.push(`${pkg.id}@${pkg.revision}: ${(e as Error).message}`) }
  }
  ensureFlightHooks(eng)
  return errors
}
