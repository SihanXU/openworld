// The AI, when this build has it (packages/ai): its plugin brings the player's own modder and the services a player may
// bring a key for (packages/ai/src/player/index.ts). It is found by a glob, so a build without the package finds none,
// and the game plays with no model: nothing starts, the settings offer no model (packages/engine/test/boundaries.test.ts
// holds that nothing else of the runtime imports the AI; the check workflow builds and plays the game without it).

/** A service a player may bring a key for, as the settings show it. */
export interface ProviderInfo {
  id: string
  name: string
  /** The model offered first. */
  model?: string
  /** Where a key is made. */
  keys?: string
  /** Where it is (none: the player gives it). */
  baseUrl?: string
  /** It answers without a key (a server on the player's own machine). */
  keyless?: boolean
  /** What a browser needs to reach it. */
  note?: string
}

export interface AiPlugin {
  providers: ProviderInfo[]
  /** The worker that runs the player's own modder in this page (modderProtocol.ts is what it is told and says). */
  startModder(): Worker
}

const found = import.meta.glob<AiPlugin>('../../ai/src/player/index.ts', { eager: true, import: 'default' })

/** The AI's plugin, or undefined in a build without it. */
export const ai: AiPlugin | undefined = Object.values(found)[0]

export const providerOf = (id: string): ProviderInfo | undefined => ai?.providers.find((p) => p.id === id)
