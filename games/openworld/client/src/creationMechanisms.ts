// Game-owned trusted source providers; save-local plans never contain executable code.
import {
  reconcileWorkshopMechanismProviders,
  type Engine, type WorkshopMechanismProvider,
} from '@openworld/engine'

interface Manifest { schema: 1; providers: { file: string; enabled: boolean; hash?: string }[] }
const bundledManifest = import.meta.glob<Manifest>('../../content/src/creation-mechanisms/manifest.json', { eager: true, import: 'default' })
const bundledProviders = import.meta.glob<{ default: WorkshopMechanismProvider }>('../../content/src/creation-mechanisms/*.ts')
let owners = new Map<string, string>()
let loading = Promise.resolve()

function readManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid creation mechanism manifest')
  const m = value as Manifest
  if (m.schema !== 1 || !Array.isArray(m.providers) || m.providers.length > 32) throw new Error('Invalid creation mechanism manifest')
  const seen = new Set<string>()
  for (const p of m.providers) {
    if (!p || !/^[a-z][a-z0-9_-]{0,47}\.ts$/.test(p.file) || typeof p.enabled !== 'boolean' || p.hash !== undefined && !/^[a-f0-9]{64}$/.test(p.hash) || seen.has(p.file)) throw new Error('Invalid creation mechanism source entry')
    seen.add(p.file)
  }
  return m
}

async function load(liveEngines: Engine[]): Promise<void> {
  let manifest: Manifest
  let manifestUrl: URL | undefined
  if (import.meta.env.DEV) {
    manifestUrl = new URL('../../content/src/creation-mechanisms/manifest.json', import.meta.url)
    manifestUrl.searchParams.set('creationManifest', String(Date.now()))
    const response = await fetch(manifestUrl)
    if (!response.ok) throw new Error(`Cannot load mechanism manifest: HTTP ${response.status}`)
    manifest = readManifest(await response.json())
  } else manifest = readManifest(Object.values(bundledManifest)[0])
  const loaded: { file: string; provider: WorkshopMechanismProvider; hash?: string }[] = []
  for (const entry of manifest.providers.filter(p => p.enabled)) {
    const key = `../../content/src/creation-mechanisms/${entry.file}`
    let module: { default: WorkshopMechanismProvider }
    let sourceHash = entry.hash
    if (manifestUrl) {
      // A fresh raw module provides the source hash; the executable import is cached by that hash.
      // This supports newly generated source files even when page HMR is disabled.
      // Vite rewrites the literal manifest path to the correct /@fs URL in a worktree.
      const url = new URL(entry.file, manifestUrl), raw = new URL(url)
      raw.search = `?raw&creationRead=${Date.now()}`
      const source = (await import(/* @vite-ignore */ raw.href)).default
      if (typeof source !== 'string') throw new Error(`Cannot read mechanism source ${entry.file}`)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
      const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
      if (entry.hash && entry.hash !== hash) throw new Error(`Mechanism source hash changed: ${entry.file}`)
      sourceHash = hash
      url.searchParams.set('creationHash', hash)
      module = await import(/* @vite-ignore */ url.href)
    } else {
      const read = bundledProviders[key]
      if (!read) throw new Error(`Mechanism source ${entry.file} needs a new game build`)
      module = await read()
    }
    if (!module.default) throw new Error(`Mechanism ${entry.file} needs a default provider export`)
    loaded.push({ file: entry.file, provider: module.default, hash: sourceHash })
  }
  owners = reconcileWorkshopMechanismProviders(owners, loaded, liveEngines)
}

/** Calls are serialized so one reload cannot unregister another reload's in-progress provider. */
export function loadCreationMechanisms(liveEngines: Iterable<Engine> = []): Promise<void> {
  const engines = [...liveEngines]
  const next = loading.then(() => load(engines))
  loading = next.catch(() => {})
  return next
}
