// The player's own modder (docs/byok.md): the messages between the page, the modder's worker (modderWorker.ts) and
// the engine's worker. The page hands the modder the game (as data) and the model the player chose; the key goes
// from the page to the modder's worker and nowhere else — the engine's worker reaches the modder only through a
// port that carries requests and answers, as it reaches a service over HTTP (modderLink.ts).

import type { ModRequest, Ontology, ResolveBody, Rule } from '@openworld/engine'

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
  | { id: number; op: 'health' }
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
