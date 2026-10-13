// The AI setting (design.md §13): like a game's graphics settings, a level for each kind of work the
// AI does — off, low, medium, high. The world waits as long at every level (the frame budget, AI_WAIT_MS);
// a level is how much the AI does in that time: what it sees, what it may use, how hard it thinks, what
// it checks before the answer ships. A better model carries a higher setting.
//
// Learned answers keep the tier they were made at, each tier its own trees (rules.ts): an event takes
// the answers of its own tier first, then the higher ones, nearest first — a higher answer serves every
// lower setting, a lower one never a higher. A setting is the player's, not the world's state: it is
// not saved with the game.

import { isA } from './ontology.ts'
import type { GameEvent, Rule, Tier } from './types.ts'
import type { World } from './world.ts'
import type { ModRequest } from './mod.ts'

export type AiLevel = 'off' | Tier

/** What the AI answers: the player's acts on things (themselves included), on people and creatures, and the world's own events. */
export type AiCategory = 'things' | 'people' | 'world'

export interface AiQuality {
  things: AiLevel
  people: AiLevel
  world: AiLevel
  /** Making kinds the world has none of: off never; low with no picture (the parent's shows); medium drawn; high drawn and checked. */
  create: AiLevel
  /** Asking ahead for what the pointer rests on (each costs calls for acts perhaps never made): off never. */
  prefetch: AiLevel
}

export const AI_LEVELS: AiLevel[] = ['off', 'low', 'medium', 'high']
export const AI_KEYS: (keyof AiQuality)[] = ['things', 'people', 'world', 'create', 'prefetch']
/** The tiers, lowest first. */
export const TIERS: Tier[] = ['low', 'medium', 'high']

/**
 * How long the world stands still for the player's own question, the same at every level (the frame
 * budget): then the default runs, and a late answer still teaches the world.
 */
export const AI_WAIT_MS = 20_000

/** The presets, a level for every category; medium is the game as it was before there was a setting. */
export const PRESETS: Record<AiLevel, AiQuality> = {
  off: { things: 'off', people: 'off', world: 'off', create: 'off', prefetch: 'off' },
  low: { things: 'low', people: 'low', world: 'low', create: 'low', prefetch: 'off' },
  medium: { things: 'medium', people: 'medium', world: 'medium', create: 'medium', prefetch: 'off' },
  high: { things: 'high', people: 'high', world: 'high', create: 'high', prefetch: 'medium' },
}
export const DEFAULT_QUALITY: AiQuality = PRESETS.medium

/** The preset a setting is, if it is one. */
export function presetOf(q: AiQuality): AiLevel | undefined {
  return AI_LEVELS.find((l) => AI_KEYS.every((k) => PRESETS[l][k] === q[k]))
}

/** A setting read back (a stored one may be older, or written by hand): what it does not say, or says wrong, is the default's. */
export function qualityOf(x: unknown): AiQuality {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const q = { ...DEFAULT_QUALITY }
  for (const k of AI_KEYS) if (AI_LEVELS.includes(o[k] as AiLevel)) q[k] = o[k] as AiLevel
  return q
}

/** The tier a level asks at (off asks nothing, and takes every tier's answers: those of the lowest and up). */
export const tierOfLevel = (l: AiLevel): Tier => (l === 'off' ? 'low' : l)

/** The tiers whose answers an event at this tier takes: its own first, then the higher ones, nearest first. */
export const tiersFrom = (t: Tier): Tier[] => TIERS.slice(Math.max(0, TIERS.indexOf(t)))

/** A learned rule's tier (one learned before there were tiers was made at what is now medium). */
export const ruleTier = (r: Pick<Rule, 'tier'>): Tier => r.tier ?? 'medium'

/** Is this a tier? */
export const isTier = (x: unknown): x is Tier => TIERS.includes(x as Tier)

/**
 * Which kind of work an event is for the AI: the world's own (a chain the player did not start), the
 * player's act on a person or creature other than themselves, or on a thing.
 */
export function categoryOf(w: World, ev: GameEvent): AiCategory {
  if (ev.origin !== 'player') return 'world'
  const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
  const actor = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : ev.cause
  return host && host.id !== actor && isA(host.type, 'actor') ? 'people' : 'things'
}

/** The same, read from a request (the modder service's side): one definition of the categories for both. */
export function categoryOfRequest(req: Pick<ModRequest, 'origin' | 'event'>): AiCategory {
  if (req.origin !== 'player') return 'world'
  const host = req.event.host
  const actor = req.event.roles.actor
  return host && !(actor?.id && actor.id === host.id) && isA(host.type, 'actor') ? 'people' : 'things'
}

/** The tier a request is asked at (its scenario's, which the sandbox replays it at). */
export const tierOfRequest = (req: Pick<ModRequest, 'tier' | 'scenario'>): Tier => (isTier(req.scenario?.tier) ? req.scenario.tier : isTier(req.tier) ? req.tier : 'medium')
