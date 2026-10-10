// Automatic combat talents. Every actor uses the same calculations; only input chooses
// the player. Timers, fractional cadence and combo state are deterministic and saved.
//
// Where they act (design.md §5.13, A2–A3): what a talent does to the striker's blow (its power,
// a critical, a bleed it opens, health it draws back) is computed by the striker's act-making and
// carried by the act; what the one struck takes is its own outcome (`hurt`: dodges, guards, the
// brink); what a defeat gives back is the striker's rule (content: combat/learn). The memory of
// one's own blows and steps (`Entity.combat`) is written only by its owner.

import { DIRS, type Entity } from './types.ts'
import type { World } from './world.ts'
import type { Engine } from './engine.ts'
import { offhandOf, ownWeapon, weaponOf } from './profession.ts'

const skill = (w: World, e: Entity, id: string): boolean => w.hasTag(e, `skill:${id}`)
const of = (profession: string) => (w: World, e: Entity, id: string): boolean => w.prop(e, 'profession') === profession && skill(w, e, id)
const assassin = of('assassin')
const warrior = of('warrior')
const ranger = of('ranger')
const mage = of('mage')
const professionIs = (w: World, e: Entity, profession: string): boolean => w.prop(e, 'profession') === profession
/**
 * A profession's talents answer only its own weapons (profession.ts): the assassin's dagger, the
 * warrior's sword, the ranger's bow, the mage's staff. A common weapon (an axe, a mace, a wand)
 * takes none of them; the shared branches serve every weapon alike.
 */
const own = (w: World, a: Entity, weapon: Entity | undefined): weapon is Entity => ownWeapon(w, a, weapon)

/** Reach a profession adds to its own weapon (the ranger's bow, the archmage's staff). */
export function rangeBonus(w: World, a: Entity, weapon: Entity | undefined): number {
  if (!own(w, a, weapon)) return 0
  if (ranger(w, a, 'ranger-archery')) return 1
  if (mage(w, a, 'archmage')) return 1
  return 0
}
/**
 * The unique powers of what one holds and wears: a Stigmatic piece's `relic` (content items.ts RELICS) — each
 * one of its kind in the world, each answered here as a talent is.
 */
export function relicsOf(w: World, e: Entity): Set<string> {
  const out = new Set<string>()
  const held = w.get(e.held)
  const weapon = weaponOf(w, e)
  // what is held, the weapon one fights with, and what is worn — a weapon kept in the main hand only while it is the one fought with
  for (const it of [...(held ? [held] : []), ...(weapon ? [weapon] : []), ...w.worn(e).filter((it) => w.prop(it, 'slot') !== 'weapon')]) {
    const r = w.prop(it, 'relic')
    if (typeof r === 'string') out.add(r)
  }
  return out
}

const recentlyMoved = (w: World, e: Entity): boolean => e.combat?.lastMoveTick !== undefined && w.state.tick - e.combat.lastMoveTick < 6

/** Successful steps, not failed bumps/turning/teleports, charge mobility talents. */
export function recordCombatStep(w: World, e: Entity): void {
  // standing one's ground counts too (worn `holdFast`: a Vowbound piece), so the step is kept for anyone who moves
  if (!skill(w, e, 'battle-tempo') && !skill(w, e, 'evasive-step') && !skill(w, e, 'windrunner') && !skill(w, e, 'steady-aim') && !(w.stat(e, 'holdFast') > 0)) return
  const state = (e.combat ??= {})
  state.lastMoveTick = w.state.tick
  if (skill(w, e, 'windrunner')) state.steps = Math.min(3, (state.steps ?? 0) + 1)
}

/** Carry fractional ticks across actions so small haste bonuses really affect a 10 Hz world. */
export function combatDelay(w: World, e: Entity, base: number, kind: 'move' | 'attack'): number {
  if (kind === 'move') for (const id of Object.keys(e.statuses ?? {})) base *= w.onto.status(id)?.moveDelay ?? 1
  // its own and what it wears (a Vowbound scallop's stride)
  let haste = Math.max(0, w.stat(e, kind === 'move' ? 'moveHaste' : 'attackHaste'))
  if (kind === 'move' && (e.combat?.galeUntil ?? 0) > w.state.tick) haste += 0.3
  if (kind === 'move' && skill(w, e, 'pursuit') && (e.combat?.pursuitUntil ?? 0) > w.state.tick) haste += 0.25
  if (kind === 'attack' && skill(w, e, 'battle-tempo') && recentlyMoved(w, e)) haste += 0.1
  if (kind === 'move' && ranger(w, e, 'fleet-archer') && (e.combat?.fleetUntil ?? 0) > w.state.tick) haste += 0.2
  if (kind === 'move' && skill(w, e, 'slipstream') && (e.combat?.slipUntil ?? 0) > w.state.tick) haste += 0.3
  if (kind === 'move' && skill(w, e, 'adrenaline') && w.hasStatus({ e: e.id }, 'adrenaline')) haste += 0.3
  // Gale Step (actives.ts)
  if (kind === 'move' && (e.combat?.hasteUntil ?? 0) > w.state.tick) haste += 0.5
  if (kind === 'attack' && ranger(w, e, 'quick-draw') && own(w, e, weaponOf(w, e))) haste += 0.2
  // a weapon's own quickness (a legendary bow)
  const fought = kind === 'attack' ? weaponOf(w, e) : undefined
  if (fought) haste += Math.max(0, w.num(fought, 'attackHaste'))
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
  /** Ticks the target bleeds if the blow lands (Hemorrhage). */
  bleed: number
  /** Health the striker draws back if the blow lands (the Warlord's answer). */
  drain: number
  /** A status the struck takes if the blow lands, for so many ticks (a relic's: kneeling, burning, frozen). */
  afflict?: { status: string; ticks: number }
}

/** Contextual bonuses are additive, then the critical multiplier applies before defence. */
export function combatStrike(w: World, a: Entity, target: Entity | undefined, base: number, range: number, weapon: Entity | undefined, primary: boolean): Strike {
  const out: Strike = { power: base, critical: false, charged: false, comboHits: 0, bleed: 0, drain: 0 }
  if (!target || !w.isAgent(target) || w.num(target, 'hp') <= 0 || w.hasStatus({ e: target.id }, 'down')) return out
  const melee = range <= 1
  // the professions' weapon training, each with its own weapons only: dagger, sword, bow, staff
  const mine = own(w, a, weapon)
  if (mine && melee && assassin(w, a, 'assassin-training')) out.power += 1
  if (mine && melee && warrior(w, a, 'warrior-arms')) out.power += 1
  if (mine && ranger(w, a, 'ranger-archery')) out.power += 1
  if (mine && mage(w, a, 'mage-focus')) out.power += 1
  if (mine && mage(w, a, 'archmage')) out.power += 2
  let bonus = 0
  let marked = false
  // damage, deeper: an unhurt target, a chain of hits, fighting at half health
  if (primary && skill(w, a, 'first-strike') && w.num(target, 'hp') >= w.num(target, 'maxHp', 1)) bonus += 0.3
  if (primary && skill(w, a, 'momentum') && w.state.tick - (a.combat?.chainTick ?? -Infinity) <= 15) bonus += 0.05 * Math.min(5, a.combat?.chain ?? 0)
  const berserk = skill(w, a, 'berserker') && w.num(a, 'hp') <= w.num(a, 'maxHp', 1) * 0.5
  if (berserk) bonus += 0.25
  // a War Cry's strength while it lasts (actives.ts)
  if ((a.combat?.rallyUntil ?? 0) > w.state.tick) bonus += 0.25
  // swiftness: a blow dodged readies a sure critical
  if (primary && skill(w, a, 'untouchable') && w.state.tick - (a.combat?.dodgeTick ?? -Infinity) <= 20) marked = true
  if (primary) {
    const state = a.combat
    // warrior: a hit taken readies the next melee blow; defeats build a rampage
    if (mine && melee && warrior(w, a, 'retaliation') && (state?.retaliateUntil ?? 0) > w.state.tick) {
      bonus += 0.4
      // the warlord's answer also mends
      if (warrior(w, a, 'warlord')) out.drain = 2
    }
    if (mine && melee && warrior(w, a, 'rampage') && (state?.rampageUntil ?? 0) > w.state.tick) bonus += 0.15 * Math.min(3, state?.rampageStacks ?? 0)
    // ranger: standing still steadies the aim; far targets reward it; every third hit on one target is sure
    if (mine && professionIs(w, a, 'ranger')) {
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
    if (mine && professionIs(w, a, 'mage')) {
      if (mage(w, a, 'elemental-attunement') && w.prop(weapon, 'element')) bonus += 0.25
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
    opening = mine && assassin(w, a, 'ambush') && w.state.tick - quietSince >= 40
    if (opening) bonus += 0.5
    const ap = w.posOf(a)
    const tp = w.posOf(target)
    const [dx, dy] = DIRS[target.facing ?? 'down']
    behind = mine && assassin(w, a, 'backstab') && !!ap && !!tp && ap.map === tp.map && (ap.x - tp.x) * dx + (ap.y - tp.y) * dy < 0
    if (behind) bonus += 0.4
    if (mine && assassin(w, a, 'relentless')) {
      const continuing = state?.comboTarget === target.id && state.comboTick !== undefined && w.state.tick - state.comboTick <= 20
      const hits = (continuing ? state.comboHits ?? 0 : 0) + 1
      out.comboHits = hits === 3 ? 0 : hits
      if (hits === 3) bonus += 0.6
    }
  }
  const relics = relicsOf(w, a)
  // Dragonsbane: what it was forged for
  if (relics.has('dragonsbane') && /\/(dragon|whelp)$/.test(target.type)) bonus += 1
  // Starfall: every fifth hit falls true
  const guaranteed = (primary && melee && assassin(w, a, 'death-dance') && (opening || behind)) || marked || (primary && relics.has('starfall') && (a.combat?.starHits ?? 0) >= 4)
  // a weapon that drinks: its lifesteal is health drawn back when the blow lands; and what is worn that drinks (a Vowbound ring)
  if (weapon && w.num(weapon, 'lifesteal') > 0) out.drain += w.num(weapon, 'lifesteal')
  out.drain += Math.max(0, w.stat(a, 'lifesteal'))
  // a weapon may carry its own edge (a legendary's critChance); what is worn may too; Nightfang at night
  const night = relics.has('nightfang') && w.isNight() ? 0.25 : 0
  const chance = Math.max(0, Math.min(1, w.stat(a, 'critChance') + (weapon ? w.num(weapon, 'critChance') : 0) + (berserk ? 0.1 : 0) + night))
  out.critical = guaranteed || (chance > 0 && w.rand() < chance)
  // a critical: ×1.5 (Deadly Focus ×2), and what critDamage adds (Lethal Edge, Brutal)
  out.power *= (1 + bonus) * (out.critical ? (skill(w, a, 'deadly-focus') ? 2 : 1.5) + Math.max(0, w.stat(a, 'critDamage')) : 1)
  // the relics' own: the Mirrorshard steals with a critical, the Oathbrand drinks deep near the end; the
  // Crown makes the struck kneel, the Emberheart sets them burning, the Rimecrown freezes them
  if (relics.has('mirrorshard') && out.critical) out.drain += 3
  if (relics.has('oathbrand') && w.num(a, 'hp') <= w.num(a, 'maxHp', 1) * 0.3) out.drain *= 3
  if (relics.has('crown') && w.rand() < 0.2) out.afflict = { status: 'knelt', ticks: 10 }
  else if (relics.has('emberheart') && w.rand() < 0.25) out.afflict = { status: 'burning', ticks: 30 }
  else if (relics.has('rimecrown') && w.rand() < 0.2) out.afflict = { status: 'frozen', ticks: 10 }
  // a critical opens a wound that bleeds 1 a second for 4 seconds (Hemorrhage)
  if (primary && out.critical && skill(w, a, 'hemorrhage')) out.bleed = 40
  // an envenomed edge (actives.ts): so many more blows open a bleed
  if ((a.combat?.envenomHits ?? 0) > 0) {
    out.bleed = Math.max(out.bleed, 40)
    a.combat!.envenomHits! -= 1
  }
  return out
}

/**
 * The striker's memory after its blow resolved (its own act-making, like a cooldown): combos,
 * chains, the windows a defeat opens. Immunity and misses consume no charge and build no combo.
 */
export function finishCombatStrike(w: World, a: Entity, target: Entity | undefined, strike: Strike, before: number, range: number, primary: boolean): void {
  const landed = !!target && w.isAgent(target) && before > 0 && w.num(target, 'hp') < before
  const weapon = weaponOf(w, a)
  const mine = own(w, a, weapon)
  if (primary && landed) {
    const state = (a.combat ??= {})
    if (skill(w, a, 'momentum')) (state.chain = w.state.tick - (state.chainTick ?? -Infinity) <= 15 ? (state.chain ?? 0) + 1 : 1), (state.chainTick = w.state.tick)
    if (strike.critical && skill(w, a, 'untouchable')) delete state.dodgeTick
    if (mine && range <= 1 && warrior(w, a, 'retaliation') && (state.retaliateUntil ?? 0) > w.state.tick) delete state.retaliateUntil
    if (mine && professionIs(w, a, 'ranger')) {
      if (ranger(w, a, 'hunters-mark')) (state.markTarget = target!.id), (state.markHits = strike.comboHits)
      if (ranger(w, a, 'fleet-archer')) state.fleetUntil = w.state.tick + 15
    }
    if (mine && mage(w, a, 'spell-echo')) state.spellHits = (state.spellHits ?? 0) + 1
    // relics that remember one's hits: Starfall counts to five, Galestring lends the wind's speed
    const relics = relicsOf(w, a)
    if (relics.has('starfall')) state.starHits = strike.critical && (state.starHits ?? 0) >= 4 ? 0 : (state.starHits ?? 0) + 1
    if (relics.has('galestring')) state.galeUntil = w.state.tick + 20
  }
  if (primary) {
    const state = (a.combat ??= {})
    state.lastAttackTick = w.state.tick
    if (target && w.isAgent(target)) state.fightTick = w.state.tick
    if (landed && range <= 1) {
      if (strike.charged) state.steps = 0
      if (mine && assassin(w, a, 'relentless')) {
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
  if (mine && range <= 1 && warrior(w, a, 'rampage')) {
    const state = (a.combat ??= {})
    state.rampageStacks = (state.rampageUntil ?? 0) > w.state.tick ? Math.min(3, (state.rampageStacks ?? 0) + 1) : 1
    state.rampageUntil = w.state.tick + 50
  }
  // what a defeat gives back (Arcane Recovery, Shadow Recovery) is the striker's own rule on the
  // defeat's notify (content: combat/learn)
}

/** Only non-piercing damage attributed to another actor is direct combat damage. Runs in the struck one's own outcome (`hurt`). */
export function combatDamage(eng: Engine, e: Entity, damage: number, attacker: Entity | undefined, pierce: boolean): number {
  const w = eng.world
  if (pierce || !attacker || attacker.id === e.id || !w.isAgent(attacker)) return damage
  const state = (e.combat ??= {})
  // untouchable for a moment (Phantom Step after a dash, Phoenix after a fall)
  if ((state.guardUntil ?? 0) > w.state.tick) return 0
  // a dodge: the blow misses entirely (no roll at all for those without dodge); what is worn may lend it
  const dodge = Math.min(0.5, Math.max(0, w.stat(e, 'dodge')))
  if (dodge > 0 && w.rand() < dodge) {
    state.dodgeTick = w.state.tick
    w.fx.push({ t: 'say', who: e.id, text: { en: 'Dodged!', zh: '闪避！' } })
    return 0
  }
  // a shield worn in the off hand turns a blow aside by its block (its defence, like all worn things', is `World.stat`'s)
  const shield = offhandOf(w, e)
  const block = shield ? Math.min(0.5, Math.max(0, w.num(shield, 'block'))) : 0
  if (block > 0 && w.rand() < block) {
    w.fx.push({ t: 'say', who: e.id, text: { en: 'Blocked!', zh: '格挡！' } })
    return 0
  }
  state.lastHurtTick = w.state.tick
  state.fightTick = w.state.tick
  // a War Cry's guard while it lasts (actives.ts)
  if ((state.rallyUntil ?? 0) > w.state.tick) damage *= 0.7
  if (skill(w, e, 'evasive-step') && recentlyMoved(w, e)) damage *= 0.75
  if (skill(w, e, 'defiance') && w.num(e, 'hp') <= w.num(e, 'maxHp', 1) * 0.3) damage *= 0.75
  if (warrior(w, e, 'bulwark')) damage *= warrior(w, e, 'warlord') ? 0.7 : 0.85
  if (mage(w, e, 'mana-shield') && own(w, e, weaponOf(w, e))) damage *= 0.8
  // holding one's ground (a Vowbound piece's `holdFast`): less taken while one has not stepped this second
  const hold = Math.min(0.5, Math.max(0, w.stat(e, 'holdFast')))
  if (hold > 0 && w.state.tick - (state.lastMoveTick ?? -Infinity) >= 10) damage *= 1 - hold
  if (warrior(w, e, 'retaliation')) state.retaliateUntil = w.state.tick + 20
  damage = Math.max(1, Math.round(damage))
  const hp = w.num(e, 'hp', 1)
  // adrenaline: a blow that leaves you at the brink, once a minute
  if (skill(w, e, 'adrenaline') && hp - damage > 0 && hp - damage <= w.num(e, 'maxHp', 1) * 0.3 && w.state.tick - (state.adrenalineTick ?? -Infinity) >= 600) {
    state.adrenalineTick = w.state.tick
    // the rush: faster, and mending a little each second (content: body/adrenaline)
    eng.applyStatus({ e: e.id }, 'adrenaline', 50)
    w.fx.push({ t: 'log', text: { en: 'Adrenaline!', zh: '肾上腺素！' }, tone: 'good' })
  }
  // the Unfallen Wall: once a minute, a blow that would fell its bearer is turned aside
  if (hp > 0 && damage >= hp && relicsOf(w, e).has('unfallen') && w.state.tick - (state.unfallenTick ?? -Infinity) >= 600) {
    state.unfallenTick = w.state.tick
    w.fx.push({ t: 'say', who: e.id, text: { en: 'Unfallen!', zh: '不陷！' } })
    return 0
  }
  if (skill(w, e, 'last-stand') && hp > 0 && damage >= hp && w.state.tick - (state.lastStandTick ?? -Infinity) >= 300) {
    state.lastStandTick = w.state.tick
    w.fx.push({ t: 'log', text: { en: 'Last Stand: a lethal blow is survived at 1 health.', zh: '不屈意志：抵御致命一击，保留 1 点生命。' } })
    return hp - 1
  }
  return damage
}

/**
 * Dash (the skill, Q): up to 3 tiles the way the actor faces (Tailwind: 4), stopping before
 * anything solid, or before a creature (Phantom Step passes through, but never ends on one).
 * Cooldown 4 s (Tailwind: 2.5 s). Slipstream and Phantom Step follow it. The dash is an act of
 * moving to the tile it lands on; its windows are the actor's memory.
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
  eng.act('move', e.id, { e: e.id }, { instrument: null, params: { map: at.map, x: land.x, y: land.y, dash: true } })
  const now = w.posOf(e)
  if (!now || (now.x === at.x && now.y === at.y && now.map === at.map)) return false
  w.fx.push({ t: 'vfx', fx: 'poof', map: at.map, x: at.x, y: at.y })
  const state = (e.combat ??= {})
  if (skill(w, e, 'slipstream')) state.slipUntil = w.state.tick + 20
  if (through) state.guardUntil = w.state.tick + 5
  eng.setCooldown('dash:' + e.id, skill(w, e, 'tailwind') ? 25 : 40)
  return true
}
