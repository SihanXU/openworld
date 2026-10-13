// Experience and levels: an actor that defeats another gains experience (the rules decide how
// much, through the `gainXp` primitive); enough of it raises the level, and each level brings a
// skill point. Any actor carries these props, not only the player: `xp` (toward the next
// level), `level` (from 1) and `skillPoints` (unspent; the skill tree spends them).

import type { Entity, SkillDef } from './types.ts'
import type { World } from './world.ts'

/** What a granted prop starts from when the thing has none: a period's own pace (its `everyProp`) starts at the period's beat; the rest at 0. */
export function grantBase(w: World, key: string): number {
  return w.onto.data.periods?.find((p) => p.everyProp === key)?.every ?? 0
}

/** Experience needed to go from `level` to the next: 20, 40, 60 … */
export const xpToNext = (level: number): number => 20 * Math.max(1, level)

/** Add experience to an actor (in its own outcome: `gainXp`); returns how many levels it gained. */
export function gainXp(w: World, e: Entity, amount: number): number {
  let level = Math.max(1, Number(e.props?.level ?? 1))
  let xp = Number(e.props?.xp ?? 0) + Math.max(0, Math.round(amount))
  let gained = 0
  // (bounded: a level per hundred is far past any the world has, and a huge xp must not hang the clock)
  while (xp >= xpToNext(level) && gained < 100) {
    xp -= xpToNext(level)
    level++
    gained++
  }
  w.setProp(e, 'xp', xp)
  w.setProp(e, 'level', level)
  if (gained) w.setProp(e, 'skillPoints', Number(e.props?.skillPoints ?? 0) + gained)
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

/**
 * Why a skill book cannot be read: known already, another profession's, or the skills before it in the tree not yet
 * learned (a book asks no points, but it does not leap the tree: its `requires` hold for it as for the tree).
 */
export function cannotRead(e: Entity, def: SkillDef, profession = e.props?.profession): LearnRefusal | undefined {
  const have = new Set(skillsOf(e))
  if (have.has(def.id)) return 'learned'
  if (def.profession && def.profession !== profession) return 'profession'
  if ((def.requires ?? []).some((r) => !have.has(r))) return 'requires'
  return undefined
}

/** A bigger pool (`maxHunger`) comes full by as much: what is in it (`hunger`, full while it has none) grows with it. */
function bigger(w: World, e: Entity, key: string, delta: number): void {
  const pool = key[3].toLowerCase() + key.slice(4)
  w.setProp(e, pool, w.num(e, pool, w.num(e, key)) + delta)
}

/** Learn a skill from a book (in its own outcome): its grants and its tag, no points; it remembers it came from a book. */
export function readSkill(w: World, e: Entity, def: SkillDef): boolean {
  if (cannotRead(e, def, w.prop(e, 'profession'))) return false
  for (const [key, delta] of Object.entries(def.grant ?? {})) {
    w.setProp(e, key, w.num(e, key, grantBase(w, key)) + delta)
    if (key === 'maxHp') w.setProp(e, 'hp', w.num(e, 'hp') + delta)
    else if (/^max[A-Z]/.test(key)) bigger(w, e, key, delta)
  }
  w.addTag(e, skillTag(def.id))
  w.setProp(e, `skillFrom:${def.id}`, 'book')
  return true
}

/** Learn a skill (in its own outcome: an act of learning): spend its points, add its grants, leave its tag. False if it cannot be learned. */
export function learnSkill(w: World, e: Entity, def: SkillDef): boolean {
  if (cannotLearn(e, def, w.prop(e, 'profession'))) return false
  w.setProp(e, 'skillPoints', Number(e.props?.skillPoints ?? 0) - (def.cost ?? 1))
  for (const [key, delta] of Object.entries(def.grant ?? {})) {
    w.setProp(e, key, w.num(e, key, grantBase(w, key)) + delta)
    // a bigger pool comes full by as much
    if (key === 'maxHp') w.setProp(e, 'hp', w.num(e, 'hp') + delta)
    else if (/^max[A-Z]/.test(key)) bigger(w, e, key, delta)
  }
  w.addTag(e, skillTag(def.id))
  return true
}
