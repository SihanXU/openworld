// The player's own modder (docs/byok.md): the messages between the page, the modder's worker (modderWorker.ts) and
// the engine's worker. The page hands the modder the game (as data) and the model the player chose; the key goes
// from the page to the modder's worker and nowhere else — the engine's worker reaches the modder only through a
// port that carries requests and answers, as it reaches a service over HTTP (modderLink.ts).

import type { ResearchOutcome, ResearchRequest, ModRequest, Ontology, ResolveBody, Rule, SaveData, Recipe, Text, WorkshopDraft, CreationMapDraft } from '@openworld/engine'

/** Pure data contract for an explicitly configured local coding-agent service. */
export interface CreatorOrderRequest { order: string; save: SaveData; kind?: 'item' | 'uses' | 'map'; subject?: string; operation?: 'append' | 'revise'; deferSource?: boolean; recipes?: Recipe[]; assets?: Record<string, unknown> }
export interface CreatorDiscussionRequest {
  message: string; kind: 'item' | 'uses' | 'map'; subject?: string
  history: { player: string; npc: Text }[]
}
export interface CreatorDiscussionReply { ready: boolean; reply: Text }
export interface CreatorDraft { kind: 'item' | 'uses' | 'map'; title: Text; item?: WorkshopDraft; map?: CreationMapDraft; adopted?: boolean }
export interface CreatorJobStatus {
  id: string; status: 'queued' | 'running' | 'repairing' | 'ready' | 'failed'; order: string; baseDigest: string; createdAt: string; error?: string
  candidate?: { save: SaveData; drafts: Record<string, CreatorDraft>; sourceChanged: boolean; runtimeChanged?: boolean; pageChanged?: boolean; needsPublication?: boolean }
}
export interface ModderHealth { model?: string | null; creator?: { enabled: boolean; protocol?: number; endpoint?: string; discussion?: boolean } | null }

/** Where the key is kept: this page's life only, or this browser (its storage, until the player forgets it). */
export type Remember = 'session' | 'device'

/** A model the player chose, without its key. */
export interface ModelChoice {
  provider: string
  /** Default: the service's own address. */
  baseUrl?: string
  model: string
}

/** What was spent through the player's key: today's (the cap's) and in all, in USD where the service says. */
export interface Spend {
  /** today, as YYYY-MM-DD in the player's time */
  day: string
  cost: number
  calls: number
  input: number
  output: number
  /** calls today whose cost the service did not say */
  unpriced: number
  total: number
}

/** The modder's state as the settings show it: never the key, only its hint. */
export interface ModelStatus {
  choice?: ModelChoice
  /** the key's start and last four (none: no key kept) */
  keyHint?: string
  remember: Remember
  /** the model's name, when the modder can call it */
  model?: string
  /** USD a day the modder may spend (0: no cap) */
  cap: number
  spend: Spend
  /** the last thing that went wrong, the key taken out of it */
  error?: string
}

/** The page to the modder's worker. A `key` is a new one; none: the one kept stays. */
export type ToModder =
  | { t: 'game'; ontology: Ontology; rules: Rule[] }
  /** The story's protected fact prefixes (the world index's), right after the game: commits are judged with them, as the engine's worker judges what it takes. */
  | { t: 'facts'; protectedFacts: string[] }
  | { t: 'link'; port: MessagePort }
  | { t: 'set'; choice: ModelChoice; key?: string; remember: Remember; cap: number }
  | { t: 'forget' }
  | { t: 'test'; id: number; choice: ModelChoice; key?: string }
  | { t: 'models'; id: number; choice: ModelChoice; key?: string }
  | { t: 'quality'; id: number; plan?: boolean; probes?: ModRequest[] }
  | { t: 'detect'; id: number; probes: ModRequest[] }

export type FromModder = { t: 'status'; status: ModelStatus } | { t: 'reply'; id: number; value?: unknown; error?: string }

/** The engine's worker to the modder, over the port: what it asks a service at /health, /resolve, /progress, /patches, /fault. */
export type LinkCall =
  | { id: number; op: 'draft'; body: WorkshopMapRequest }
  | { id: number; op: 'health' }
  | { id: number; op: 'research'; body: ResearchRequest }
  | { id: number; op: 'researched'; outcome: ResearchOutcome }
  | { id: number; op: 'researchSketch'; sketch: string }
  | { id: number; op: 'resolve'; body: ResolveBody }
  | { id: number; op: 'progress'; request: string }
  | { id: number; op: 'patches'; since: number }
  | { id: number; op: 'fault'; rule: string; reason: string }

export interface LinkReply {
  id: number
  value?: unknown
  error?: string
}

/** The engine's worker names the player's own modder so (in the place a service's address goes). */
export const LOCAL_MODDER = 'local:'

/** The runtime's map authoring request; pure data shared by HTTP and browser-owned models. */
export interface WorkshopMapRequest {
  kind: 'map'
  intent: string
  context?: { chars?: { char: string; terrain: string; name?: string }[]; things?: { id: string; name?: string }[]; maxSize?: [number, number]; taken?: string[]; lang?: string; environment?: { palette: string[]; water: string[]; fireflies: string }; activities?: { garden: string; crossing: string } }
  previous?: unknown
  feedback?: string
}
export interface WorkshopMapReply { draft: Record<string, unknown> | null; diagnostics: string[] }
