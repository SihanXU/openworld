// The services a player may bring their own key for (docs/byok.md): a model chosen in the game's settings is
// called from the player's browser straight at the service, with a key that stays there. Each service is an
// OpenAI-compatible endpoint or Anthropic's own API; `custom` is any other OpenAI-compatible one.

import { AnthropicModel } from './anthropic.ts'
import { OpenAICompatModel, type Model } from './model.ts'
import { providerOf, type ProviderKind } from './providerList.ts'

export * from './providerList.ts'

/** A model the player chose: the service, where it is, which model, and the key (kept on the player's machine only). */
export interface ModelConfig {
  provider: string
  /** Default: the service's own. */
  baseUrl?: string
  model: string
  apiKey?: string
  /** Anthropic's least effort (low by default). */
  effort?: string
}

/** Where a config's service is: its own address, or the one given (`custom`, or a service somewhere else). */
export function baseUrlOf(cfg: ModelConfig): string {
  const url = (cfg.baseUrl || providerOf(cfg.provider)?.baseUrl || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(url)) throw new Error(`not an address: "${url}"`)
  return url
}

/** What is missing from a config before it can be called (none: it can). */
export function configProblem(cfg: ModelConfig | undefined): string | undefined {
  const p = cfg && providerOf(cfg.provider)
  if (!cfg || !p) return 'provider'
  try {
    baseUrlOf(cfg)
  } catch {
    return 'baseUrl'
  }
  if (!cfg.model.trim()) return 'model'
  if (!p.keyless && !cfg.apiKey?.trim()) return 'apiKey'
  return undefined
}

/** The model a config names. `browser`: called from a page's worker (Anthropic asks for it to be said). */
export function modelOf(cfg: ModelConfig, opts: { browser?: boolean } = {}): Model {
  const p = providerOf(cfg.provider)
  if (!p) throw new Error(`unknown provider "${cfg.provider}"`)
  const baseUrl = baseUrlOf(cfg)
  if (p.kind === 'anthropic')
    return new AnthropicModel({ model: cfg.model, effort: cfg.effort ?? 'low', apiKey: cfg.apiKey, browser: opts.browser, ...(baseUrl !== p.baseUrl && { baseUrl }) })
  return new OpenAICompatModel({ baseUrl, apiKey: cfg.apiKey ?? '', model: cfg.model })
}

/** The headers a call to a config's service carries its key in. */
function authOf(cfg: ModelConfig, kind: ProviderKind): Record<string, string> {
  if (kind === 'anthropic') return { 'x-api-key': cfg.apiKey ?? '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
  return cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
}

/** The models the service offers this key (its own list, sorted). */
export async function listModels(cfg: ModelConfig, signal: AbortSignal = AbortSignal.timeout(15_000)): Promise<string[]> {
  const p = providerOf(cfg.provider)
  if (!p) throw new Error(`unknown provider "${cfg.provider}"`)
  const base = baseUrlOf(cfg)
  const url = p.kind === 'anthropic' ? `${base}/v1/models?limit=1000` : `${base}/models`
  const res = await fetch(url, { headers: authOf(cfg, p.kind), signal })
  const data = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null
  if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(data)?.slice(0, 200) ?? ''}`)
  const ids = (data?.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
  return [...new Set(ids)].sort()
}

/** One small call to the chosen model: whether the key, the address and the model answer (and how fast). */
export async function testModel(cfg: ModelConfig, opts: { browser?: boolean } = {}): Promise<{ ok: true; ms: number; reply: string } | { ok: false; error: string }> {
  const t0 = Date.now()
  try {
    const r = await modelOf(cfg, opts).chat([{ role: 'user', content: 'Reply with the single word OK.' }], { temperature: 0, purpose: 'test', deadlineMs: 30_000 })
    return { ok: true, ms: Date.now() - t0, reply: r.content.trim().slice(0, 40) }
  } catch (err) {
    return { ok: false, error: scrub((err as Error).message ?? String(err), cfg.apiKey) }
  }
}

/** A message with the key taken out of it (an error may echo the request). */
export function scrub(text: string, key?: string): string {
  return key && key.length >= 6 ? text.split(key).join('[key]') : text
}

/** How a key is shown: its start and its last four. */
export function keyHint(key?: string): string {
  if (!key) return ''
  const k = key.trim()
  return k.length <= 10 ? '••••' : `${k.slice(0, Math.min(6, k.indexOf('-', 3) + 1 || 3))}…${k.slice(-4)}`
}
