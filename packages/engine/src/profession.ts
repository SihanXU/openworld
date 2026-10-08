// Professions: an actor chooses one from a trainer once it has reached PROFESSION_LEVEL, and may
// change it there later. Changing gives back every point spent in the profession branch (the
// skills of any profession): their tags go, their grants are undone, and the points return to
// be spent again. Shared branches are kept. The first time an actor takes up a profession, it
// is handed the profession's starter weapon (and off-hand piece).
//
// Profession weapons: an item type tagged `profession:<id>` (the dagger, the sword and shield, the
// bow, the staff, and their legendary kin) fights only for an actor of that profession. Anyone may
// carry, give or store one; another actor's blow with it is refused, and it cannot be worn (the
// shield in the off hand: the `arm` slot). Every other weapon is common to all and takes no
// profession's talents.

import type { Entity, SkillDef, Text } from './types.ts'
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
  /** Handed over with it and worn in the off hand (the warrior's shield). */
  offhand?: Omit<Entity, 'id' | 'place'>
}

export type ProfessionRefusal = 'unknown' | 'same' | 'level' | 'trainer'

/** The profession an item fights for (its `profession:<id>` tag), or none: a common item. */
export function itemProfession(w: World, item: Entity): string | undefined {
  const tag = [...w.onto.resolve(item.type).tags, ...(item.tags ?? [])].find((t) => t.startsWith('profession:'))
  return tag?.slice('profession:'.length)
}

/** The profession an actor follows, if any. */
export function professionOf(w: World, e: Entity): string | undefined {
  const p = w.prop(e, 'profession')
  return typeof p === 'string' && p ? p : undefined
}

/** May this actor fight with (or wear) this item: a common one, or one of its own profession. */
export function canWield(w: World, e: Entity, item: Entity): boolean {
  const need = itemProfession(w, item)
  return !need || need === professionOf(w, e)
}

/** The item is its holder's own profession weapon: the only kind a profession's talents answer. */
export function ownWeapon(w: World, e: Entity, item: Entity | undefined): boolean {
  return !!item && !!itemProfession(w, item) && itemProfession(w, item) === professionOf(w, e)
}

/** The main hand: the `weapon` slot of what is worn, where a weapon is kept ready while the hand holds something else. */
export const MAINHAND = 'wear:weapon'

/**
 * What one fights with: a weapon in one's hand, else the one worn in the main hand (`World.worn`: still carried, one's
 * own to wield), else whatever the hand holds (a torch swung).
 */
export function weaponOf(w: World, e: Entity): Entity | undefined {
  const held = w.get(e.held)
  if (held && w.hasTag(held, 'weapon')) return held
  return w.worn(e).find((it) => w.prop(it, 'slot') === 'weapon') ?? held
}

/** The off hand: the `arm` slot of what is worn (world-model.md §6.8), where a shield goes. */
export const OFFHAND = 'wear:arm'

/** What is worn in the off hand and works there (`World.worn`: still carried, and the wearer's to wield). */
export function offhandOf(w: World, e: Entity): Entity | undefined {
  return w.worn(e).find((item) => w.prop(item, 'slot') === 'arm')
}

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

/** Undo the profession branch (in the actor's own outcome): every skill of any profession is unlearned and its points come back. */
export function refundProfessionSkills(w: World, e: Entity, skills: SkillDef[]): number {
  const by = new Map(skills.map((s) => [s.id, s]))
  let refunded = 0
  for (const id of skillsOf(e)) {
    const def = by.get(id)
    if (!def?.profession) continue
    w.removeTag(e, skillTag(id))
    refunded += def.cost ?? 1
    for (const [key, delta] of Object.entries(def.grant ?? {})) {
      w.setProp(e, key, w.num(e, key, key === 'hungerEvery' ? HUNGER_EVERY : 0) - delta)
      // a smaller pool: what was in it beyond the new top is gone
      if (key === 'maxHp') w.setProp(e, 'hp', Math.max(1, Math.min(w.num(e, 'hp'), w.num(e, 'maxHp', 1))))
      if (key === 'maxHunger') w.setProp(e, 'hunger', Math.min(w.num(e, 'hunger'), w.num(e, 'maxHunger')))
    }
  }
  w.setProp(e, 'skillPoints', Number(e.props?.skillPoints ?? 0) + refunded)
  // timed state of the old profession's talents goes with them
  if (e.combat) for (const k of ['comboTarget', 'comboHits', 'comboTick', 'markTarget', 'markHits', 'spellHits', 'rampageStacks', 'rampageUntil', 'retaliateUntil', 'fleetUntil'] as const) delete e.combat[k]
  return refunded
}

/** Take up a profession (in the actor's own outcome; the checks are the caller's: cannotChoose). Returns the points given back. */
export function chooseProfession(w: World, e: Entity, def: ProfessionDef, skills: SkillDef[]): number {
  const refunded = refundProfessionSkills(w, e, skills)
  w.setProp(e, 'profession', def.id)
  // what the old profession wore comes off (it stays in the bag)
  for (const [key, id] of Object.entries(e.props ?? {})) {
    const item = key.startsWith('wear:') && typeof id === 'string' ? w.get(id) : undefined
    if (item && !canWield(w, e, item)) w.setProp(e, key, undefined)
  }
  // the starter kit, once per profession; its off-hand piece is worn at once if that slot is free
  if (!w.prop(e, `kit.${def.id}`) && (def.weapon || def.offhand)) {
    w.setProp(e, `kit.${def.id}`, true)
    if (def.weapon) w.create(def.weapon.type, { on: 'inside', holder: e.id }, structuredClone(def.weapon))
    if (def.offhand) {
      const piece = w.create(def.offhand.type, { on: 'inside', holder: e.id }, structuredClone(def.offhand))
      if (!offhandOf(w, e)) w.setProp(e, OFFHAND, piece.id)
    }
  }
  return refunded
}
