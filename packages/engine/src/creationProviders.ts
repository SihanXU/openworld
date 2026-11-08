// Trusted source modules provide mechanics; model-authored plans remain bounded data.
import type { Engine } from './engine.ts'
import {
  readCapabilityDescriptor, registerWorkshopCapability, researchCapabilities, withWorkshopCapabilityRollback, workshopPackages,
  type CapabilityDescriptor, type WorkshopCapability, type WorkshopCapabilityRegistration,
} from './creation.ts'

export interface WorkshopMechanismProvider {
  id: string
  version: number
  capabilities: WorkshopCapability[]
  dependsOn?: { id: string; version: number }[]
}
export interface WorkshopProviderInfo {
  id: string
  version: number
  capabilities: CapabilityDescriptor[]
  dependsOn: { id: string; version: number }[]
  sourceHash?: string
}
interface Installed {
  source: WorkshopMechanismProvider
  info: WorkshopProviderInfo
  handles: WorkshopCapabilityRegistration[]
  capabilities: WorkshopCapability[]
}
const providers = new Map<string, Installed>()
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,47}$/.test(id)

/** The inventory includes owners and versions; builtin capabilities never acquire a provider owner. */
export function workshopMechanismProviders(): WorkshopProviderInfo[] {
  return structuredClone([...providers.values()].map(p => p.info))
}

function removalProblems(id: string, engines: Iterable<Engine>): string[] {
  const installed = providers.get(id)
  if (!installed) return ['Unknown mechanism provider']
  const errors: string[] = []
  for (const p of providers.values()) if (p.info.id !== id && p.info.dependsOn.some(d => d.id === id)) errors.push(`Provider ${p.info.id} depends on ${id}`)
  const owned = new Set(installed.info.capabilities.map(c => c.id))
  for (const eng of engines) for (const pkg of workshopPackages(eng)) {
    if (pkg.enabled && pkg.plan.uses.some(u => owned.has(u.capability))) errors.push(`Package ${pkg.id}@${pkg.revision} still uses provider ${id}`)
  }
  if (installed.handles.some(h => !h.current())) errors.push('A provider capability was replaced outside its owner')
  return [...new Set(errors)]
}

/**
 * The host supplies every live Engine in this process; models never choose this set.
 * Disable dependent content packages before removing or upgrading their mechanism provider.
 */
export function removeWorkshopMechanismProvider(id: string, liveEngines: Iterable<Engine>): void {
  const errors = removalProblems(id, liveEngines)
  if (errors.length) throw new Error(errors.join('; '))
  const installed = providers.get(id)!
  for (const handle of [...installed.handles].reverse()) handle.remove()
  providers.delete(id)
}

/** Install code already loaded by a trusted game loader. No code is accepted through a use plan or package file. */
export function installWorkshopMechanismProvider(provider: WorkshopMechanismProvider, liveEngines: Iterable<Engine> = [], sourceHash?: string): WorkshopProviderInfo {
  if (!provider || !validId(provider.id) || !Number.isSafeInteger(provider.version) || provider.version < 1 || !Array.isArray(provider.capabilities) || !provider.capabilities.length || provider.capabilities.length > 16) throw new Error('Invalid mechanism provider')
  if (sourceHash !== undefined && !/^[a-f0-9]{64}$/.test(sourceHash)) throw new Error('Invalid trusted mechanism source hash')
  const old = providers.get(provider.id)
  const dependencies = structuredClone(provider.dependsOn ?? [])
  if (!Array.isArray(dependencies) || dependencies.length > 16) throw new Error('Invalid mechanism dependencies')
  const seenDeps = new Set<string>()
  for (const d of dependencies) {
    if (!d || !validId(d.id) || d.id === provider.id || seenDeps.has(d.id) || !Number.isSafeInteger(d.version) || providers.get(d.id)?.info.version !== d.version) throw new Error(`Missing or invalid mechanism dependency ${d?.id}`)
    seenDeps.add(d.id)
  }
  const capabilities = provider.capabilities.map(c => {
    if (!c || typeof c.compile !== 'function' || typeof c.verify !== 'function') throw new Error('Every mechanism capability needs a compiler and verifier')
    return { ...c, descriptor: readCapabilityDescriptor(c.descriptor) }
  })
  const sameFunctions = old?.capabilities.every((c, i) => c.compile === capabilities[i]?.compile && c.verify === capabilities[i]?.verify && c.problems === capabilities[i]?.problems && c.native === capabilities[i]?.native && c.verb === capabilities[i]?.verb)
  const same = old && old.info.version === provider.version
    && JSON.stringify(old.info.dependsOn) === JSON.stringify(dependencies)
    && JSON.stringify(old.info.capabilities) === JSON.stringify(capabilities.map(c => c.descriptor))
    && (old.source === provider ? sameFunctions : sourceHash !== undefined && old.info.sourceHash === sourceHash)
  if (same) return structuredClone(old.info)
  if (old && provider.version <= old.info.version) throw new Error('A changed mechanism provider requires a newer version')
  const ids = capabilities.map(c => c.descriptor.id)
  if (new Set(ids).size !== ids.length) throw new Error('A provider declares duplicate capabilities')
  const existing = new Set(researchCapabilities().map(c => c.id)), previous = new Set(old?.info.capabilities.map(c => c.id))
  for (const id of ids) if (existing.has(id) && !previous.has(id)) throw new Error(`Capability ${id} already belongs to builtin content or another provider`)
  const engines = [...liveEngines]
  if (old) {
    const errors = removalProblems(provider.id, engines)
    if (errors.length) throw new Error(errors.join('; '))
    for (const handle of [...old.handles].reverse()) handle.remove()
  }
  const handles: WorkshopCapabilityRegistration[] = []
  try {
    for (const capability of capabilities) handles.push(registerWorkshopCapability(capability))
  } catch (error) {
    for (const handle of handles.reverse()) handle.remove()
    if (old) old.handles = old.capabilities.map(c => registerWorkshopCapability(c))
    throw error
  }
  const info: WorkshopProviderInfo = { id: provider.id, version: provider.version, capabilities: capabilities.map(c => c.descriptor), dependsOn: dependencies, ...(sourceHash && { sourceHash }) }
  providers.set(provider.id, { source: provider, info, handles, capabilities })
  return structuredClone(info)
}

/** Apply one trusted manifest as a unit, removing dependants before their dependencies. */
export function reconcileWorkshopMechanismProviders(
  owners: ReadonlyMap<string, string>,
  entries: readonly { file: string; provider: WorkshopMechanismProvider; hash?: string }[],
  liveEngines: Iterable<Engine>,
): Map<string, string> {
  const next = new Map<string, string>(), engines = [...liveEngines]
  for (const { file, provider } of entries) {
    if (!provider || next.has(provider.id)) throw new Error(`Invalid or duplicate mechanism provider: ${file}`)
    const previousFile = owners.get(provider.id)
    if (previousFile && previousFile !== file) throw new Error(`Mechanism ${provider.id} changed source ownership`)
    next.set(provider.id, file)
  }
  const previous = new Map([...providers].map(([id, installed]) => [id, { ...installed }]))
  try {
    return withWorkshopCapabilityRollback(() => {
      const removed = new Set([...owners.keys()].filter(id => !next.has(id) && providers.has(id)))
      while (removed.size) {
        const id = [...removed].find(candidate => ![...removed].some(other => providers.get(other)?.info.dependsOn.some(d => d.id === candidate)))
        if (!id) throw new Error('Mechanism dependencies contain a cycle')
        removeWorkshopMechanismProvider(id, engines)
        removed.delete(id)
      }
      for (const { provider, hash } of entries) installWorkshopMechanismProvider(provider, engines, hash)
      return next
    })
  } catch (error) {
    providers.clear()
    for (const [id, installed] of previous) providers.set(id, installed)
    throw error
  }
}
