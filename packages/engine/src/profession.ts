// Professions: an actor chooses one from a trainer once it has reached PROFESSION_LEVEL, and may
// change it there later. Changing gives back every point spent in the profession branch (the
// skills of any profession): their tags go, their grants are undone, and the points return to
// be spent again. Shared branches are kept. The first time an actor takes up a profession, it
// is handed the profession's starter weapon.

import type { Entity, PropValue, SkillDef, Text } from './types.ts'
import type { World } from './world.ts'
import { HUNGER_EVERY } from './hunger.ts'
import { skillTag, skillsOf } from './progression.ts'

/** The level from which a trainer will take you on. */
export const PROFESSION_LEVEL = 5

export interface ProfessionDef {
  id: string
  name: Text
  doc: Text
  icon?: string
  /** Handed over the first time the profession is taken up (an item: type, name, props…). */
  weapon?: Omit<Entity, 'id' | 'place'>
}

export type ProfessionRefusal = 'unknown' | 'same' | 'level' | 'trainer'

/** How far a trainer can be (tiles) for the choice to be made. */
const TRAINER_REACH = 3

/** Someone tagged `trainer` within reach, on the same map. */
export function nearTrainer(w: World, e: Entity): boolean {
  const at = w.posOf(e)
  if (!at) return false
  return w.entitiesOnMap(at.map).some((o) => o.id !== e.id && o.place.on === 'tile' && w.hasTag(o, 'trainer') && Math.max(Math.abs(o.place.x - at.x), Math.abs(o.place.y - at.y)) <= TRAINER_REACH)
}

export function cannotChoose(w: World, e: Entity, def: ProfessionDef | undefined): ProfessionRefusal | undefined {
  if (!def) return 'unknown'
  if (w.prop(e, 'profession') === def.id) return 'same'
  if (w.num(e, 'level', 1) < PROFESSION_LEVEL) return 'level'
  if (!nearTrainer(w, e)) return 'trainer'
  return undefined
}

/** Undo the profession branch: every skill of any profession is unlearned and its points come back. */
export function refundProfessionSkills(w: World, e: Entity, skills: SkillDef[]): number {
  const by = new Map(skills.map((s) => [s.id, s]))
  const props = (e.props ??= {})
  let refunded = 0
  for (const id of skillsOf(e)) {
    const def = by.get(id)
    if (!def?.profession) continue
    e.tags = (e.tags ?? []).filter((t) => t !== skillTag(id))
    refunded += def.cost ?? 1
    for (const [key, delta] of Object.entries(def.grant ?? {})) {
      props[key] = w.num(e, key, key === 'hungerEvery' ? HUNGER_EVERY : 0) - delta
      // a smaller pool: what was in it beyond the new top is gone
      if (key === 'maxHp') props.hp = Math.max(1, Math.min(w.num(e, 'hp'), w.num(e, 'maxHp', 1)))
      if (key === 'maxHunger') props.hunger = Math.min(w.num(e, 'hunger'), w.num(e, 'maxHunger'))
    }
  }
  props.skillPoints = Number(props.skillPoints ?? 0) + refunded
  // timed state of the old profession's talents goes with them
  if (e.combat) for (const k of ['comboTarget', 'comboHits', 'comboTick', 'markTarget', 'markHits', 'spellHits', 'rampageStacks', 'rampageUntil', 'retaliateUntil', 'fleetUntil'] as const) delete e.combat[k]
  return refunded
}

/** Take up a profession (the checks are the caller's: cannotChoose). Returns the points given back. */
export function chooseProfession(w: World, e: Entity, def: ProfessionDef, skills: SkillDef[]): number {
  const refunded = refundProfessionSkills(w, e, skills)
  const props = (e.props ??= {}) as Record<string, PropValue>
  props.profession = def.id
  // the starter weapon, once per profession
  if (def.weapon && !props[`kit.${def.id}`]) {
    props[`kit.${def.id}`] = true
    w.create(def.weapon.type, { on: 'inside', holder: e.id }, structuredClone(def.weapon))
  }
  return refunded
}
