// Experience and levels: an actor that defeats another gains experience (the rules decide how
// much, through the `gainXp` primitive); enough of it raises the level, and each level brings a
// skill point. Any actor carries these props, not only the player: `xp` (toward the next
// level), `level` (from 1) and `skillPoints` (unspent; the skill tree spends them).

import type { Entity, SkillDef } from './types.ts'
import type { World } from './world.ts'
import { HUNGER_EVERY } from './hunger.ts'

/** Experience needed to go from `level` to the next: 20, 40, 60 … */
export const xpToNext = (level: number): number => 20 * Math.max(1, level)

/** Add experience to an actor; returns how many levels it gained. */
export function gainXp(w: World, e: Entity, amount: number): number {
  const props = (e.props ??= {})
  let level = Math.max(1, Number(props.level ?? 1))
  let xp = Number(props.xp ?? 0) + Math.max(0, Math.round(amount))
  let gained = 0
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
    gained++
  }
  props.xp = xp
  props.level = level
  if (gained) props.skillPoints = Number(props.skillPoints ?? 0) + gained
  return gained
}

// ---------------------------------------------------------------- the skill tree

/** The tag a learned skill leaves on the actor: rules and the engine test for it. */
export const skillTag = (id: string): string => `skill:${id}`

/** The skills an actor has learned. */
export function skillsOf(e: Entity): string[] {
  return (e.tags ?? []).filter((t) => t.startsWith('skill:')).map((t) => t.slice(6))
}

export type LearnRefusal = 'learned' | 'profession' | 'requires' | 'points'

/** Why an actor cannot learn a skill now, or undefined if it can. */
export function cannotLearn(e: Entity, def: SkillDef, profession = e.props?.profession): LearnRefusal | undefined {
  const have = new Set(skillsOf(e))
  if (have.has(def.id)) return 'learned'
  if (def.profession && def.profession !== profession) return 'profession'
  if ((def.requires ?? []).some((r) => !have.has(r))) return 'requires'
  if (Number(e.props?.skillPoints ?? 0) < (def.cost ?? 1)) return 'points'
  return undefined
}

/** Learn a skill: spend its points, add its grants, leave its tag. False if it cannot be learned. */
export function learnSkill(w: World, e: Entity, def: SkillDef): boolean {
  if (cannotLearn(e, def, w.prop(e, 'profession'))) return false
  const props = (e.props ??= {})
  props.skillPoints = Number(props.skillPoints ?? 0) - (def.cost ?? 1)
  for (const [key, delta] of Object.entries(def.grant ?? {})) {
    props[key] = w.num(e, key, key === 'hungerEvery' ? HUNGER_EVERY : 0) + delta
    // a bigger pool comes full by as much
    if (key === 'maxHp') props.hp = w.num(e, 'hp') + delta
    if (key === 'maxHunger') props.hunger = w.num(e, 'hunger', w.num(e, 'maxHunger')) + delta
  }
  ;(e.tags ??= []).push(skillTag(def.id))
  return true
}
