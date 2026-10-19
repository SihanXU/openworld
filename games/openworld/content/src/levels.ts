// The minor monsters' levels and numbers (docs/creatures.md §8): one curve, read through each kind's role. A kind's level
// is its place in the world — the level its own piece of gear is made at (trophies.ts) — and its health grows with it as
// gear does (a quarter a level, GEAR_LEVELS.perLevel), so a monster met with gear of its own level takes as long to fell
// at level 7 as at level 1. Its role says how it plays: many and soft, a fighter, a soft caster, a wall, a gatekeeper.

import { GEAR_LEVELS } from './gear.ts'
import { TROPHY_OF } from './trophies.ts'

/** How a kind plays, as multiples of the curve: health, attack, and defence over it. */
export interface Role {
  hp: number
  atk: number
  def: number
}

export const ROLES = {
  /** Many and soft: slimes, bats. Three or four blows. */
  swarm: { hp: 0.6, atk: 0.8, def: 0 },
  /** A fighter: wolves, the dead that walk, spiders. Five or six. */
  fighter: { hp: 1, atk: 1, def: 0 },
  /** Soft and from afar: imps, wisps, ghosts. Hits as hard as a fighter, falls sooner. */
  caster: { hp: 0.7, atk: 1, def: 0 },
  /** A wall: golems, crabs, the boar. Slow to fell, armoured. */
  brute: { hp: 1.6, atk: 1.1, def: 2 },
  /** A gatekeeper: the Slime King, the barrow warden, the cyclops. A fight of its own. */
  elite: { hp: 3, atk: 1.2, def: 1 },
} as const satisfies Record<string, Role>

const C = 'actor/creature'

/** Each minor kind's role (its level is its trophy's). */
export const CREATURE_ROLES: Record<string, keyof typeof ROLES> = {
  [`${C}/slime/green_slime`]: 'swarm',
  [`${C}/slime/fire_slime`]: 'swarm',
  [`${C}/slime/frost_slime`]: 'swarm',
  [`${C}/slime/spark_slime`]: 'swarm',
  [`${C}/slime/water_slime`]: 'swarm',
  [`${C}/slime/king_slime`]: 'elite',
  [`${C}/beast/wolf`]: 'fighter',
  [`${C}/beast/frost_wolf`]: 'fighter',
  [`${C}/beast/boar`]: 'brute',
  [`${C}/beast/bat`]: 'swarm',
  [`${C}/undead/zombie`]: 'fighter',
  [`${C}/undead/skeleton`]: 'fighter',
  [`${C}/undead/ghost`]: 'caster',
  [`${C}/undead/warden`]: 'elite',
  [`${C}/golem/stone_golem`]: 'brute',
  [`${C}/golem/ice_golem`]: 'brute',
  [`${C}/imp/fire_imp`]: 'caster',
  [`${C}/wisp/storm_wisp`]: 'caster',
  [`${C}/spider`]: 'fighter',
  [`${C}/fungus/sporecap`]: 'fighter',
  [`${C}/whelp`]: 'caster',
  [`${C}/crab`]: 'brute',
  [`${C}/cyclops`]: 'elite',
}

/** A level-1 fighter's health and attack: five or six blows of a stone axe; a quarter of one's health in a short fight. */
export const BASE = { hp: 30, atk: 2.5 }
/** What each level adds to the attack (the health grows as gear does). */
export const ATK_PER_LEVEL = 0.5

/** A kind's numbers at its level, in its role. */
export function creatureStats(level: number, role: Role): { level: number; hp: number; maxHp: number; atk: number; def: number } {
  const hp = Math.round(BASE.hp * role.hp * (1 + GEAR_LEVELS.perLevel * (level - 1)))
  return { level, hp, maxHp: hp, atk: Math.max(1, Math.round((BASE.atk + ATK_PER_LEVEL * (level - 1)) * role.atk)), def: role.def + Math.floor(level / 4) }
}

/** Each minor kind's level and numbers, by type. */
export const CREATURE_STATS = Object.fromEntries(
  Object.entries(CREATURE_ROLES).map(([type, role]) => [type, creatureStats(TROPHY_OF[type]?.level ?? 1, ROLES[role])]),
)
