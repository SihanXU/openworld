// Automatic combat talents. Every actor uses the same calculations; only input chooses
// the player. Timers, fractional cadence and combo state are deterministic and saved.

import { DIRS, type Entity } from './types.ts'
import type { World } from './world.ts'
import type { Engine } from './engine.ts'

const skill = (w: World, e: Entity, id: string): boolean => w.hasTag(e, `skill:${id}`)
const of = (profession: string) => (w: World, e: Entity, id: string): boolean => w.prop(e, 'profession') === profession && skill(w, e, id)
const assassin = of('assassin')
const warrior = of('warrior')
const ranger = of('ranger')
const mage = of('mage')
const isRanged = (weapon: Entity | undefined) => !!weapon && weapon.type.startsWith('item/weapon/ranged/')
const isMagic = (weapon: Entity | undefined) => !!weapon && weapon.type.startsWith('item/weapon/magic/')
/** A melee weapon: any weapon but bows and spellcasting foci. */
const isMeleeWeapon = (weapon: Entity | undefined) => !!weapon && weapon.type.startsWith('item/weapon/') && !isRanged(weapon) && !isMagic(weapon)

/** Reach a profession adds to the held weapon (the ranger's bow, the archmage's focus). */
export function rangeBonus(w: World, a: Entity, weapon: Entity | undefined): number {
  if (isRanged(weapon) && ranger(w, a, 'ranger-archery')) return 1
  if (isMagic(weapon) && mage(w, a, 'archmage')) return 1
  return 0
}
const recentlyMoved = (w: World, e: Entity): boolean => e.combat?.lastMoveTick !== undefined && w.state.tick - e.combat.lastMoveTick < 6

/** Successful steps, not failed bumps/turning/teleports, charge mobility talents. */
export function recordCombatStep(w: World, e: Entity): void {
  if (!skill(w, e, 'battle-tempo') && !skill(w, e, 'evasive-step') && !skill(w, e, 'windrunner') && !skill(w, e, 'steady-aim')) return
  const state = (e.combat ??= {})
  state.lastMoveTick = w.state.tick
  if (skill(w, e, 'windrunner')) state.steps = Math.min(3, (state.steps ?? 0) + 1)
}

/** Carry fractional ticks across actions so small haste bonuses really affect a 10 Hz world. */
export function combatDelay(w: World, e: Entity, base: number, kind: 'move' | 'attack'): number {
  if (kind === 'move') for (const id of Object.keys(e.statuses ?? {})) base *= w.onto.status(id)?.moveDelay ?? 1
  let haste = Math.max(0, w.num(e, kind === 'move' ? 'moveHaste' : 'attackHaste'))
  if (kind === 'move' && skill(w, e, 'pursuit') && (e.combat?.pursuitUntil ?? 0) > w.state.tick) haste += 0.25
  if (kind === 'attack' && skill(w, e, 'battle-tempo') && recentlyMoved(w, e)) haste += 0.1
  if (kind === 'move' && ranger(w, e, 'fleet-archer') && (e.combat?.fleetUntil ?? 0) > w.state.tick) haste += 0.2
  if (kind === 'move' && skill(w, e, 'slipstream') && (e.combat?.slipUntil ?? 0) > w.state.tick) haste += 0.3
  if (kind === 'move' && skill(w, e, 'adrenaline') && (e.combat?.adrenalineUntil ?? 0) > w.state.tick) haste += 0.3
  if (kind === 'attack' && ranger(w, e, 'quick-draw') && isRanged(w.get(e.held))) haste += 0.2
  if (!haste) return Math.max(1, base)
  const state = (e.combat ??= {})
  const key = kind === 'move' ? 'moveCarry' : 'attackCarry'
  const ticks = Math.max(1, base / (1 + Math.min(0.5, haste))) + (state[key] ?? 0)
  const delay = Math.floor(ticks + 1e-9)
  state[key] = Math.max(0, ticks - delay)
  return delay
}

export interface Strike {
  power: number
  critical: boolean
  charged: boolean
  comboHits: number
}

/** Contextual bonuses are additive, then the critical multiplier applies before defence. */
export function combatStrike(w: World, a: Entity, target: Entity | undefined, base: number, range: number, weapon: Entity | undefined, primary: boolean): Strike {
  const out: Strike = { power: base, critical: false, charged: false, comboHits: 0 }
  if (!target || w.kindOf(target) !== 'actor' || w.num(target, 'hp') <= 0 || w.hasStatus({ e: target.id }, 'down')) return out
  const melee = range <= 1
  if (melee && weapon && w.hasTag(weapon, 'blade') && assassin(w, a, 'assassin-training')) out.power += 1
  // the professions' weapon training: the warrior's melee arms, the ranger's bow, the mage's focus
  if (melee && isMeleeWeapon(weapon) && warrior(w, a, 'warrior-arms')) out.power += 1
  if (isRanged(weapon) && ranger(w, a, 'ranger-archery')) out.power += 1
  if (isMagic(weapon) && mage(w, a, 'mage-focus')) out.power += 1
  if (isMagic(weapon) && mage(w, a, 'archmage')) out.power += 2
  let bonus = 0
  let marked = false
  // damage, deeper: an unhurt target, a chain of hits, fighting at half health
  if (primary && skill(w, a, 'first-strike') && w.num(target, 'hp') >= w.num(target, 'maxHp', 1)) bonus += 0.3
  if (primary && skill(w, a, 'momentum') && w.state.tick - (a.combat?.chainTick ?? -Infinity) <= 15) bonus += 0.05 * Math.min(5, a.combat?.chain ?? 0)
  const berserk = skill(w, a, 'berserker') && w.num(a, 'hp') <= w.num(a, 'maxHp', 1) * 0.5
  if (berserk) bonus += 0.25
  // swiftness: a blow dodged readies a sure critical
  if (primary && skill(w, a, 'untouchable') && w.state.tick - (a.combat?.dodgeTick ?? -Infinity) <= 20) marked = true
  if (primary) {
    const state = a.combat
    // warrior: a hit taken readies the next melee blow; defeats build a rampage
    if (melee && warrior(w, a, 'retaliation') && (state?.retaliateUntil ?? 0) > w.state.tick) bonus += 0.4
    if (melee && warrior(w, a, 'rampage') && (state?.rampageUntil ?? 0) > w.state.tick) bonus += 0.15 * Math.min(3, state?.rampageStacks ?? 0)
    // ranger: standing still steadies the aim; far targets reward it; every third hit on one target is sure
    if (isRanged(weapon)) {
      if (ranger(w, a, 'steady-aim') && w.state.tick - (state?.lastMoveTick ?? -Infinity) >= 10) bonus += 0.3
      const ap = w.posOf(a)
      const tp = w.posOf(target)
      if (ranger(w, a, 'sniper') && ap && tp && Math.max(Math.abs(ap.x - tp.x), Math.abs(ap.y - tp.y)) >= 3) bonus += 0.25
      if (ranger(w, a, 'hunters-mark')) {
        const hits = (state?.markTarget === target.id ? state.markHits ?? 0 : 0) + 1
        out.comboHits = hits === 3 ? 0 : hits
        marked = hits === 3
      }
    }
    // mage: elements answer the attuned; every fourth spell echoes
    if (isMagic(weapon)) {
      if (mage(w, a, 'elemental-attunement') && w.prop(weapon!, 'element')) bonus += 0.25
      if (mage(w, a, 'spell-echo') && ((state?.spellHits ?? 0) + 1) % 4 === 0) marked = true
    }
  }
  if (skill(w, a, 'executioner') && w.num(target, 'hp') <= w.num(target, 'maxHp', 1) * 0.3) bonus += 0.25
  let opening = false
  let behind = false
  if (primary && melee) {
    const state = a.combat
    if (skill(w, a, 'windrunner') && (state?.steps ?? 0) >= 3) (out.charged = true), (bonus += 0.5)
    const quietSince = Math.max(state?.lastAttackTick ?? -Infinity, state?.lastHurtTick ?? -Infinity)
    opening = assassin(w, a, 'ambush') && w.state.tick - quietSince >= 40
    if (opening) bonus += 0.5
    const ap = w.posOf(a)
    const tp = w.posOf(target)
    const [dx, dy] = DIRS[target.facing ?? 'down']
    behind = assassin(w, a, 'backstab') && !!ap && !!tp && ap.map === tp.map && (ap.x - tp.x) * dx + (ap.y - tp.y) * dy < 0
    if (behind) bonus += 0.4
    if (assassin(w, a, 'relentless')) {
      const continuing = state?.comboTarget === target.id && state.comboTick !== undefined && w.state.tick - state.comboTick <= 20
      const hits = (continuing ? state.comboHits ?? 0 : 0) + 1
      out.comboHits = hits === 3 ? 0 : hits
      if (hits === 3) bonus += 0.6
    }
  }
  const guaranteed = (primary && melee && assassin(w, a, 'death-dance') && (opening || behind)) || marked
  const chance = Math.max(0, Math.min(1, w.num(a, 'critChance') + (berserk ? 0.1 : 0)))
  out.critical = guaranteed || (chance > 0 && w.rand() < chance)
  // a critical: ×1.5 (Deadly Focus ×2), and what critDamage adds (Lethal Edge, Brutal)
  out.power *= (1 + bonus) * (out.critical ? (skill(w, a, 'deadly-focus') ? 2 : 1.5) + Math.max(0, w.num(a, 'critDamage')) : 1)
  return out
}

/** Called after a hit resolves; immunity/misses cannot consume a charge or generate a combo. */
export function finishCombatStrike(w: World, a: Entity, target: Entity | undefined, strike: Strike, before: number, range: number, primary: boolean): void {
  const landed = !!target && w.kindOf(target) === 'actor' && before > 0 && w.num(target, 'hp') < before
  const weapon = w.get(a.held)
  if (primary && landed) {
    const state = (a.combat ??= {})
    if (skill(w, a, 'momentum')) (state.chain = w.state.tick - (state.chainTick ?? -Infinity) <= 15 ? (state.chain ?? 0) + 1 : 1), (state.chainTick = w.state.tick)
    if (strike.critical && skill(w, a, 'untouchable')) delete state.dodgeTick
    if (strike.critical && skill(w, a, 'hemorrhage') && target && w.get(target.id)) {
      const t = (target.combat ??= {})
      t.bleedUntil = w.state.tick + 40
      t.bleedBy = a.id
    }
    if (range <= 1 && warrior(w, a, 'retaliation') && (state.retaliateUntil ?? 0) > w.state.tick) {
      delete state.retaliateUntil
      // the warlord's answer also mends
      if (warrior(w, a, 'warlord')) heal(w, a, 2)
    }
    if (isRanged(weapon)) {
      if (ranger(w, a, 'hunters-mark')) (state.markTarget = target!.id), (state.markHits = strike.comboHits)
      if (ranger(w, a, 'fleet-archer')) state.fleetUntil = w.state.tick + 15
    }
    if (isMagic(weapon) && mage(w, a, 'spell-echo')) state.spellHits = (state.spellHits ?? 0) + 1
  }
  if (primary) {
    const state = (a.combat ??= {})
    state.lastAttackTick = w.state.tick
    if (landed && range <= 1) {
      if (strike.charged) state.steps = 0
      if (assassin(w, a, 'relentless')) {
        state.comboTarget = target!.id
        state.comboHits = strike.comboHits
        state.comboTick = w.state.tick
      }
    } else {
      delete state.comboTarget
      delete state.comboHits
      delete state.comboTick
    }
  }
  if (!landed || !target || !w.hasTag(target, 'creature')) return
  const defeated = !w.get(target.id) || w.num(target, 'hp') <= 0 || w.hasStatus({ e: target.id }, 'down')
  if (!defeated || !w.get(a.id) || w.num(a, 'hp') <= 0 || w.hasStatus({ e: a.id }, 'down')) return
  if (skill(w, a, 'pursuit')) (a.combat ??= {}).pursuitUntil = w.state.tick + 30
  if (range <= 1 && warrior(w, a, 'rampage')) {
    const state = (a.combat ??= {})
    state.rampageStacks = (state.rampageUntil ?? 0) > w.state.tick ? Math.min(3, (state.rampageStacks ?? 0) + 1) : 1
    state.rampageUntil = w.state.tick + 50
  }
  if (isMagic(weapon) && mage(w, a, 'arcane-recovery')) heal(w, a, 3)
  if (range <= 1 && assassin(w, a, 'shadow-recovery')) {
    const hp = w.num(a, 'hp')
    const max = w.num(a, 'maxHp', 1)
    const healed = Math.max(0, Math.min(max - hp, Math.ceil(max * 0.1)))
    if (healed) {
      ;(a.props ??= {}).hp = hp + healed
      w.fx.push({ t: 'damage', who: a.id, amount: -healed })
    }
  }
}

/** Only non-piercing damage attributed to another actor is direct combat damage. */
export function combatDamage(w: World, e: Entity, damage: number, attacker: Entity | undefined, pierce: boolean): number {
  if (pierce || !attacker || attacker.id === e.id || w.kindOf(attacker) !== 'actor') return damage
  const state = (e.combat ??= {})
  // untouchable for a moment (Phantom Step after a dash, Phoenix after a fall)
  if ((state.guardUntil ?? 0) > w.state.tick) return 0
  // a dodge: the blow misses entirely (no roll at all for those without dodge)
  const dodge = Math.min(0.5, Math.max(0, w.num(e, 'dodge')))
  if (dodge > 0 && w.rand() < dodge) {
    state.dodgeTick = w.state.tick
    w.fx.push({ t: 'say', who: e.id, text: { en: 'Dodged!', zh: '闪避！' } })
    return 0
  }
  state.lastHurtTick = w.state.tick
  if (skill(w, e, 'evasive-step') && recentlyMoved(w, e)) damage *= 0.75
  if (skill(w, e, 'defiance') && w.num(e, 'hp') <= w.num(e, 'maxHp', 1) * 0.3) damage *= 0.75
  if (warrior(w, e, 'bulwark')) damage *= warrior(w, e, 'warlord') ? 0.7 : 0.85
  if (mage(w, e, 'mana-shield') && isMagic(w.get(e.held))) damage *= 0.8
  if (warrior(w, e, 'retaliation')) state.retaliateUntil = w.state.tick + 20
  damage = Math.max(1, Math.round(damage))
  const hp = w.num(e, 'hp', 1)
  // adrenaline: a blow that leaves you at the brink, once a minute
  if (skill(w, e, 'adrenaline') && hp - damage > 0 && hp - damage <= w.num(e, 'maxHp', 1) * 0.3 && w.state.tick - (state.adrenalineTick ?? -Infinity) >= 600) {
    state.adrenalineTick = w.state.tick
    state.adrenalineUntil = w.state.tick + 50
    w.fx.push({ t: 'log', text: { en: 'Adrenaline!', zh: '肾上腺素！' }, tone: 'good' })
  }
  if (skill(w, e, 'last-stand') && hp > 0 && damage >= hp && w.state.tick - (state.lastStandTick ?? -Infinity) >= 300) {
    state.lastStandTick = w.state.tick
    w.fx.push({ t: 'log', text: { en: 'Last Stand: a lethal blow is survived at 1 health.', zh: '不屈意志：抵御致命一击，保留 1 点生命。' } })
    return hp - 1
  }
  return damage
}

function heal(w: World, a: Entity, amount: number): void {
  const hp = w.num(a, 'hp')
  const healed = Math.max(0, Math.min(w.num(a, 'maxHp', 1) - hp, amount))
  if (!healed) return
  ;(a.props ??= {}).hp = hp + healed
  w.fx.push({ t: 'damage', who: a.id, amount: -healed })
}

/** Each tick on the active map: bleeding (Hemorrhage) and Adrenaline's healing, every second. */
export function combatTick(eng: Engine, active: string): void {
  const w = eng.world
  if (w.state.tick % 10) return
  for (const e of w.entitiesOnMap(active)) {
    const c = e.combat
    if (!c || e.place.on !== 'tile' || w.kindOf(e) !== 'actor') continue
    if ((c.bleedUntil ?? 0) > w.state.tick && w.num(e, 'hp') > 0) eng.damage(e, 1, undefined, true, c.bleedBy && w.get(c.bleedBy) ? { e: c.bleedBy } : undefined)
    if ((c.adrenalineUntil ?? 0) > w.state.tick && skill(w, e, 'adrenaline')) heal(w, e, 1)
  }
}

/**
 * Dash (the skill, Q): up to 3 tiles the way the actor faces (Tailwind: 4), stopping before
 * anything solid, or before a creature (Phantom Step passes through, but never ends on one).
 * Cooldown 4 s (Tailwind: 2.5 s). Slipstream and Phantom Step follow it.
 */
export function dash(eng: Engine, e: Entity): boolean {
  const w = eng.world
  const at = w.posOf(e)
  if (!at || e.place.on !== 'tile' || !skill(w, e, 'dash') || eng.busy(e) || !eng.ready('dash:' + e.id)) return false
  const [dx, dy] = DIRS[e.facing ?? 'down']
  const reach = skill(w, e, 'tailwind') ? 4 : 3
  const through = skill(w, e, 'phantom-step')
  let land: { x: number; y: number } | undefined
  for (let i = 1; i <= reach; i++) {
    const x = at.x + dx * i
    const y = at.y + dy * i
    if (!w.inBounds(at.map, x, y) || w.blocked(at.map, x, y)) break
    if (w.walkable(at.map, x, y, e.id)) land = { x, y }
    else if (!through) break
  }
  if (!land) return false
  w.fx.push({ t: 'vfx', fx: 'poof', map: at.map, x: at.x, y: at.y })
  w.place(e, { on: 'tile', map: at.map, x: land.x, y: land.y })
  eng.setCooldown('dash:' + e.id, skill(w, e, 'tailwind') ? 25 : 40)
  const state = (e.combat ??= {})
  if (skill(w, e, 'slipstream')) state.slipUntil = w.state.tick + 20
  if (through) state.guardUntil = w.state.tick + 5
  return true
}
