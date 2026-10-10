// The classes module (docs/engine-split.md S3): professions and their weapons, the automatic combat talents,
// relics, and the active skills one casts from the skill bar. It puts its combat in the kernel's slot: what
// a blow is, how far it reaches, how fast one steps and strikes, what the struck one takes.

import { DIRS, registerModule, type Combat, type Engine, type EngineModule, type Entity, type SkillDef, type Strike as KernelStrike, type Text } from '@openworld/engine'
import { castLeft, castSkill, cannotCast, knownActives, rainTick, SKILLBAR_SLOTS } from './actives.ts'
import { combatDamage, combatDelay, combatStrike, finishCombatStrike, rangeBonus, recordCombatStep, type Strike } from './combat.ts'
import { PROFESSION_LEVEL, canWield, cannotChoose, chooseProfession, itemProfession, type ProfessionDef, type ProfessionRefusal } from './profession.ts'

export * from './actives.ts'
export * from './combat.ts'
export * from './profession.ts'

/** What the module keeps for each engine: the professions an act of learning may name (the trainers'). */
const professions = new WeakMap<Engine, Map<string, ProfessionDef>>()
const professionsOf = (eng: Engine) => professions.get(eng) ?? professions.set(eng, new Map()).get(eng)!

const words = (t: Text) => (typeof t === 'string' ? { en: t, zh: t } : { en: t.en, zh: t.zh ?? t.en })

/** "Only a warrior can fight with the sword": what is said when another profession's weapon is taken up. */
function onlyFor(eng: Engine, item: Entity, act: 'fight' | 'wear' | 'aim'): Text {
  const w = eng.world
  const need = itemProfession(w, item) ?? ''
  const name = w.onto.data.professions?.[need]?.name
  const n = name ? words(name) : { en: need, zh: need }
  const a = /^[aeiou]/i.test(n.en) ? 'n' : ''
  const it = (l: 'en' | 'zh') => eng.nameOf({ e: item.id }, l)
  if (act === 'wear') return { en: `Only a${a} ${n.en} can wear ${it('en')}.`, zh: `只有${n.zh}能装备${it('zh')}。` }
  if (act === 'aim') return { en: `Only a${a} ${n.en} can fight with ${it('en')}`, zh: `只有${n.zh}会用${it('zh')}` }
  return { en: `Only a${a} ${n.en} can fight with ${it('en')}.`, zh: `只有${n.zh}会用${it('zh')}战斗。` }
}

/** The talents' combat (combat.ts) in the kernel's slot. */
function classCombat(eng: Engine): Combat {
  const w = eng.world
  return {
    refuses: (a, item, act) => (canWield(w, a, item) ? undefined : onlyFor(eng, item, act)),
    reach: (a, weapon) => rangeBonus(w, a, weapon),
    delay: (a, base, kind) => combatDelay(w, a, base, kind),
    strike(a, victim, base, range, weapon, primary) {
      const s = combatStrike(w, a, victim, base, range, weapon, primary)
      // what the act carries beyond its power: the struck one reads it again (wounded)
      return Object.assign(s, { params: { ...(s.critical && { critical: true }), ...(s.bleed && { bleed: s.bleed }), ...(s.drain && { drain: s.drain }), ...(s.afflict && { afflict: s.afflict.status, afflictFor: s.afflict.ticks }) } })
    },
    struck(a, victim, strike, before, range, primary) {
      const s: Strike = { critical: false, charged: false, comboHits: 0, bleed: 0, drain: 0, ...(strike as KernelStrike & Partial<Strike>) }
      finishCombatStrike(w, a, victim, s, before, range, primary)
    },
    besides(a, victim, range) {
      // a sweep (the skill): a melee blow also lands on the creatures on either side of the tile ahead
      const start = w.posOf(a)
      if (range > 1 || !start || !w.hasTag(a, 'skill:sweep')) return []
      const [dx, dy] = DIRS[a.facing ?? 'down']
      const out: Entity[] = []
      for (const s of [1, -1]) {
        const x = start.x + dx + dy * s
        const y = start.y + dy + dx * s
        const side = w.inBounds(start.map, x, y) ? w.actorAt(start.map, x, y, a.id, start.z) : undefined
        if (side && w.hasTag(side, 'creature') && side.id !== victim?.id) out.push(side)
      }
      return out
    },
    damage: (e, harm, attacker, pierce) => combatDamage(eng, e, harm, attacker, pierce),
    lethal(e, hp) {
      // Phoenix (the skill): once a day, any lethal damage leaves 30% health and a moment untouchable
      if (hp > 0 || !w.hasTag(e, 'skill:phoenix') || w.prop(e, 'phoenixDay') === w.calendar().day) return hp
      w.setProp(e, 'phoenixDay', w.calendar().day)
      ;(e.combat ??= {}).guardUntil = w.state.tick + 30
      w.fx.push({ t: 'log', text: { en: 'Phoenix: you rise from a lethal blow.', zh: '涅槃：你从致命一击中重新站起。' }, tone: 'good' })
      return Math.max(1, Math.ceil(w.num(e, 'maxHp', 1) * 0.3))
    },
    wounded(e, by, attacker) {
      // a wound that bleeds (from the one who struck), and health drawn back to them — a restore they answer for themselves
      const bleed = by?.params?.bleed
      if (typeof bleed === 'number' && bleed > 0 && w.get(e.id)) eng.applyStatus({ e: e.id }, 'bleeding', bleed, attacker?.id)
      // a relic's affliction (kneeling, burning, frozen): the struck takes it as its own status
      const afflict = by?.params?.afflict
      const afflictFor = by?.params?.afflictFor
      if (typeof afflict === 'string' && typeof afflictFor === 'number' && afflictFor > 0 && w.get(e.id) && w.num(e, 'hp') > 0) eng.applyStatus({ e: e.id }, afflict, afflictFor, attacker?.id)
      const drain = by?.params?.drain
      if (typeof drain === 'number' && drain > 0 && attacker && attacker.id !== e.id)
        eng.queue({ kind: 'impulse/restore', host: { e: attacker.id }, roles: { source: { e: e.id }, actor: { e: attacker.id } }, params: { which: 'hp', amount: drain }, cause: by?.cause, origin: by?.origin, depth: (by?.depth ?? 0) + 1 })
    },
    stepped: (e) => recordCombatStep(w, e),
  }
}

// ---------------------------------------------------------------- the inputs (the one at the keys)

/** The skill bar's six slots: the active skill set in each, by id. */
export function skillbar(eng: Engine): (string | null)[] {
  const bar = eng.world.player.skillbar ?? []
  return Array.from({ length: SKILLBAR_SLOTS }, (_, i) => bar[i] ?? null)
}

/**
 * Set an active skill one has learned in a slot of the skill bar (the input's own posture, as the selected
 * toolbar slot is): from another slot it moves (what was there takes its old place); null empties the slot.
 */
export function setSkill(eng: Engine, slot: number, id: string | null): boolean {
  const p = eng.world.player
  if (slot < 0 || slot >= SKILLBAR_SLOTS) return false
  // any active skill one has: learned in the tree or from a book, or lent by what one wears
  if (id && !knownActives(eng, p).some((k) => k.id === id)) return false
  const bar = skillbar(eng)
  const from = id ? bar.indexOf(id) : -1
  if (from >= 0) bar[from] = bar[slot]
  bar[slot] = id
  p.skillbar = bar
  return true
}

/** Cast the skill in a slot of the skill bar (Shift+1–6); a cast that cannot be made says why (once a press). */
export function cast(eng: Engine, slot: number): boolean {
  const w = eng.world
  const p = w.player
  const id = skillbar(eng)[slot]
  if (!id || !eng.controls.allows('use')) return false
  const def = eng.skills.get(id)
  const why = cannotCast(eng, p, def)
  if (why === 'profession') w.fx.push({ t: 'log', text: { en: 'That skill belongs to another profession.', zh: '这是别的职业的技能。' }, tone: 'warn' })
  if (why === 'unlearned') w.fx.push({ t: 'log', text: { en: 'You no longer have that skill (what lent it is not worn).', zh: '你现在没有这个技能了（带来它的装备没有穿着）。' }, tone: 'warn' })
  if (why) return false
  const done = castSkill(eng, p, id)
  if (!done) w.fx.push({ t: 'log', text: { en: 'Nothing to use it on.', zh: '附近没有可以施放的目标。' }, tone: 'warn' })
  eng.controls.sync()
  return done
}

/**
 * Take up a profession at a trainer (level 5, a trainer within reach): an act of learning it.
 * Changing gives back the profession branch's points. Returns why not, or undefined when done.
 */
export function takeProfession(eng: Engine, def: ProfessionDef | undefined, skills: SkillDef[]): ProfessionRefusal | undefined {
  const w = eng.world
  const p = w.player
  const why = cannotChoose(w, p, def)
  if (why === 'level') w.fx.push({ t: 'log', text: { en: `Come back at level ${PROFESSION_LEVEL}.`, zh: `等你到 ${PROFESSION_LEVEL} 级再来。` }, tone: 'warn' })
  if (why === 'trainer') w.fx.push({ t: 'log', text: { en: 'Only a trainer can set you on a profession.', zh: '只有职业导师能为你选定职业。' }, tone: 'warn' })
  if (why || !def || eng.busy(p)) return why
  const had = w.prop(p, 'profession')
  const points = w.num(p, 'skillPoints')
  for (const s of skills) eng.skills.set(s.id, s)
  professionsOf(eng).set(def.id, def)
  eng.act('learn', p.id, { e: p.id }, { instrument: null, params: { profession: def.id } })
  if (w.prop(p, 'profession') !== def.id) return 'unknown'
  const back = w.num(p, 'skillPoints') - points
  const name = words(def.name)
  w.fx.push({ t: 'log', text: { en: `You are now a${/^[aeiou]/i.test(name.en) ? 'n' : ''} ${name.en}.${back ? ` ${back} skill points given back.` : ''}`, zh: `你成为了${name.zh}。${back ? `返还了 ${back} 技能点。` : ''}` }, tone: 'good' })
  if (had) w.fx.push({ t: 'log', text: { en: 'Your old profession\'s skills are unlearned: spend the points again in the skill tree (K).', zh: '原职业的技能已重置：在技能树（K）里重新加点吧。' } })
  eng.controls.sync()
  return undefined
}

export const classesModule: EngineModule = {
  id: 'classes',
  spec: {
    rules: [
      'Combat talents are evaluated by the engine for any actor carrying skill:<id>. Actor props profession, moveHaste, attackHaste and critChance control eligibility/cadence/critical chance. Attack hit.power already includes offensive talents; do not apply them again in a hit rule. Direct combat damage reductions and Last Stand are handled by damage. Timed talent state lives in Entity.combat and is saved.',
    ],
  },
  install(eng) {
    const w = eng.world
    eng.combat = classCombat(eng)
    // a profession's piece (the warrior's shield) works only for its own
    w.wears.push((e, item) => canWield(w, e, item))
    // what a cast leaves falling (an Arrow Rain's volleys)
    eng.hooks.tick.push({ phase: 'status', run: (active) => rainTick(eng, active) })
    // an act of learning a profession (at a trainer): the host's own outcome
    eng.hooks.learn.push((host, ev) => {
      const prof = professionsOf(eng).get(String(ev.params?.profession ?? ''))
      if (!prof) return false
      if (cannotChoose(w, host, prof)) return true
      const before = new Set(host.contents ?? [])
      chooseProfession(w, host, prof, [...eng.skills.values()])
      for (const id of host.contents ?? []) if (!before.has(id)) eng.touch({ e: id })
      return true
    })
    // a skill learned in the tree: an active one goes in the skill bar's first empty slot
    eng.hooks.learned.push((def) => {
      const free = skillbar(eng).indexOf(null)
      if (def.active && free >= 0) setSkill(eng, free, def.id)
    })
    // the HUD's skill bar and the skill panel's list
    eng.hooks.frame.push((f) => {
      const p = w.player
      const known = knownActives(eng, p)
      f.player.skillbar = skillbar(eng).map((id) => (id ? { id, left: castLeft(eng, p, id), cooldown: eng.skills.get(id)?.active?.cooldown ?? 0, usable: known.some((k) => k.id === id) } : null))
      f.player.actives = known
    })
  },
}

registerModule(classesModule)
