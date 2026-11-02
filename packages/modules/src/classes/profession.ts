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

import { OFFHAND, grantBase, offhandOf, onPath, skillTag, skillsOf, type Entity, type SkillDef, type Text, type World } from '@openworld/engine'

/** The level from which a trainer will take you on. */
export const PROFESSION_LEVEL = 5
/**
 * The advancements after the first (docs/advancement.md): the level each asks, and the skill points each brings. The
 * second sets one on a path of the profession (one of its `paths`), the third opens the profession's mastery (under the
 * path's own name, when the path gives its third one).
 */
export const ADVANCE_LEVELS: Record<number, number> = { 2: 10, 3: 16 }
export const ADVANCE_POINTS = 3

/** A path of a profession (the second advancement): its words and its picture, and what its third is called. */
export interface PathDef {
  id: string
  name: Text
  doc: Text
  icon?: string
  /** The third advancement's name and picture on this path (its skills the profession's mastery, or the path's own:
   * tier-3 skills on this path). */
  third?: { name: Text; doc?: Text; icon?: string }
}

export interface ProfessionDef {
  id: string
  name: Text
  doc: Text
  icon?: string
  /** Handed over the first time the profession is taken up (an item: type, name, props…). */
  weapon?: Omit<Entity, 'id' | 'place'>
  /** Handed over with it and worn in the off hand (the warrior's shield). */
  offhand?: Omit<Entity, 'id' | 'place'>
  /** Its three paths (the second advancement), and its mastery (the third: not a path, the profession's own). */
  paths?: PathDef[]
  mastery?: { name: Text; doc: Text; icon?: string }
}

/** The third advancement as one on this path sees it: the mastery, under the path's name for it if it gives one. */
export function thirdOf(def: ProfessionDef | undefined, path?: string): { name: Text; doc: Text; icon?: string } | undefined {
  if (!def?.mastery) return undefined
  const third = def.paths?.find((p) => p.id === path)?.third
  return third ? { name: third.name, doc: third.doc ?? def.mastery.doc, icon: third.icon ?? def.mastery.icon } : def.mastery
}

export type ProfessionRefusal = 'unknown' | 'same' | 'level' | 'trainer'
export type AdvanceRefusal = 'profession' | 'order' | 'path' | 'level' | 'trainer'

/** How far an actor has advanced: 1 with a profession (0 with none), 2 on a path, 3 with its mastery. */
export function advancementOf(w: World, e: Entity): number {
  if (!professionOf(w, e)) return 0
  return Math.max(1, w.num(e, 'advancement', 1))
}
/** The path an actor is on, if any. */
export function pathOf(w: World, e: Entity): string | undefined {
  const p = w.prop(e, 'path')
  return typeof p === 'string' && p ? p : undefined
}

/**
 * Why an actor may not advance to this tier (on this path, for the second) now: no profession, the tier before not
 * reached (or this one already), a path not of its profession, the level, no trainer by. A path already taken may be
 * changed at the second tier: the old path's skills come back as points.
 */
export function cannotAdvance(w: World, e: Entity, def: ProfessionDef | undefined, tier: number, path?: string): AdvanceRefusal | undefined {
  if (!def || professionOf(w, e) !== def.id) return 'profession'
  const now = advancementOf(w, e)
  if (tier === 2) {
    if (!path || !def.paths?.some((p) => p.id === path)) return 'path'
    if (path === pathOf(w, e)) return 'order'
  } else if (tier !== 3 || now !== 2) return 'order'
  if (w.num(e, 'level', 1) < (ADVANCE_LEVELS[tier] ?? Infinity)) return 'level'
  if (!nearTrainer(w, e)) return 'trainer'
  return undefined
}

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
export function refundProfessionSkills(w: World, e: Entity, skills: SkillDef[], which: (def: SkillDef) => boolean = (def) => !!def.profession): number {
  const by = new Map(skills.map((s) => [s.id, s]))
  let refunded = 0
  for (const id of skillsOf(e)) {
    const def = by.get(id)
    if (!def || !which(def)) continue
    w.removeTag(e, skillTag(id))
    refunded += def.cost ?? 1
    for (const [key, delta] of Object.entries(def.grant ?? {})) {
      w.setProp(e, key, w.num(e, key, grantBase(w, key)) - delta)
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
  // a new profession's paths are its own: the old path goes (one advanced chooses one of the new profession's)
  w.setProp(e, 'path', undefined)
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

/**
 * Advance (in the actor's own outcome; the checks are the caller's: cannotAdvance): the second tier sets the actor on a
 * path (a change of path unlearns the old path's skills and gives their points back), the third opens the mastery. The
 * first time each tier is reached it brings ADVANCE_POINTS. Returns the points given.
 */
export function advance(w: World, e: Entity, tier: number, path: string | undefined, skills: SkillDef[]): number {
  let given = 0
  if (tier === 2) {
    // (what is not the new path's: a mastery the new path shares is kept)
    if (pathOf(w, e)) given += refundProfessionSkills(w, e, skills, (def) => !!def.path && !onPath(def, path))
    w.setProp(e, 'path', path)
  }
  if (advancementOf(w, e) < tier) {
    w.setProp(e, 'advancement', tier)
    w.setProp(e, 'skillPoints', Number(e.props?.skillPoints ?? 0) + ADVANCE_POINTS)
    given += ADVANCE_POINTS
  }
  return given
}
