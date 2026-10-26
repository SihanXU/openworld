// The services a player may bring their own key for (docs/byok.md), as a list: what the settings offer (the page
// reads this alone; providers.ts calls them).

export type ProviderKind = 'openai' | 'anthropic'

export interface ProviderDef {
  id: string
  name: string
  kind: ProviderKind
  /** Where it is (none: the player gives it, `custom`). */
  baseUrl?: string
  /** The model offered first (none: chosen from the service's list). */
  model?: string
  /** It answers without a key (a server on the player's own machine). */
  keyless?: boolean
  /** Where a key is made. */
  keys?: string
  /** What a browser needs to reach it (a page's own origin allowed, a setting of the service's). */
  note?: string
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'moonshotai/kimi-k3', keys: 'https://openrouter.ai/keys' },
  { id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', keys: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', keys: 'https://platform.openai.com/api-keys' },
  { id: 'deepseek', name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keys: 'https://platform.deepseek.com/api_keys' },
  { id: 'moonshot', name: 'Moonshot (Kimi)', kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1', keys: 'https://platform.moonshot.ai/console/api-keys' },
  { id: 'gemini', name: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keys: 'https://aistudio.google.com/apikey' },
  { id: 'ollama', name: 'Ollama', kind: 'openai', baseUrl: 'http://localhost:11434/v1', keyless: true, note: 'OLLAMA_ORIGINS' },
  { id: 'custom', name: 'OpenAI-compatible', kind: 'openai' },
]

export const providerOf = (id: string): ProviderDef | undefined => PROVIDERS.find((p) => p.id === id)
