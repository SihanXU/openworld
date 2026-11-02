// Active skills (docs/skill-tree.md, the skill bar): a skill learned in the tree that is cast — from the
// skill bar's six slots (Shift+1–6) — and then rests for its cooldown. Like the dash (combat.ts), a cast is
// the game's own logic made of the acts every actor has: its blows are acts of using the weapon on what
// it strikes (their outcomes are the rules'), its steps are moves; what it leaves on the caster (a speed,
// a guard, a veil, a poisoned edge) is combat bookkeeping, as a dash's slipstream is; a mending is told
// to the caster, who answers it (content body/stage). Content says the numbers (SkillDef.active); this
// says what each kind does.

import { DIRS, OPPOSITE, weaponOf, type ActiveDef, type Dir, type Engine, type Entity, type KnownActive, type Pos, type SkillDef } from '@openworld/engine'
import { alone, combatStrike, finishCombatStrike, paid, setPowersOf, summonerOf } from './combat.ts'
import { professionOf } from './profession.ts'

/** How many slots the skill bar has. */
export const SKILLBAR_SLOTS = 6

/** The cooldown an actor's cast of a skill rests on. */
export const castKey = (skill: string, actor: string) => `skill:${skill}:${actor}`

export type CastRefusal = 'unknown' | 'passive' | 'unlearned' | 'profession' | 'busy' | 'cooling' | 'nothing'


/**
 * The active skills an actor has now: those it learned (in the tree, or from a book: its `skillFrom:<id>`), and those
 * what it wears lends it (a piece's `skill` prop: while it is worn, whatever one's profession).
 */
export function knownActives(eng: Engine, e: Entity): KnownActive[] {
  const w = eng.world
  const out: KnownActive[] = []
  for (const t of [...(e.tags ?? [])]) {
    if (!t.startsWith('skill:')) continue
    const id = t.slice('skill:'.length)
    if (eng.skills.get(id)?.active) out.push({ id, source: w.prop(e, `skillFrom:${id}`) === 'book' ? 'book' : 'tree' })
  }
  for (const it of w.worn(e)) {
    const id = w.prop(it, 'skill')
    if (typeof id === 'string' && eng.skills.get(id)?.active && !out.some((k) => k.id === id)) out.push({ id, source: 'gear', item: it.id })
  }
  return out
}

/** Why an actor cannot cast a skill now (undefined: it can). */
export function cannotCast(eng: Engine, e: Entity, def: SkillDef | undefined): CastRefusal | undefined {
  const w = eng.world
  if (!def) return 'unknown'
  if (!def.active) return 'passive'
  const known = knownActives(eng, e).find((k) => k.id === def.id)
  if (!known) return 'unlearned'
  // what a piece lends is its own, whoever wears it; what one learned follows one's profession
  if (known.source !== 'gear' && def.profession && def.profession !== professionOf(w, e)) return 'profession'
  if (eng.busy(e) || e.place.on !== 'tile') return 'busy'
  if (!eng.ready(castKey(def.id, e.id))) return 'cooling'
  return undefined
}

const has = (e: Entity, id: string) => !!e.tags?.includes(`skill:${id}`)

/**
 * A skill as the caster casts it: its own numbers, plus what the talents it learned that strengthen it add
 * (SkillDef.modifies), its cooldown shortened by the caster's `cdr` (Mana Surge; at most by half).
 */
export function effectiveActive(eng: Engine, e: Entity, def: SkillDef): ActiveDef {
  const a: ActiveDef = { ...def.active! }
  for (const t of eng.skills.values()) {
    const m = t.modifies
    if (!m || m.skill !== def.id || !has(e, t.id)) continue
    for (const k of ['cooldown', 'power', 'range', 'count', 'ticks', 'radius'] as const) if (m[k] !== undefined) a[k] = (a[k] ?? (k === 'power' ? 1 : 0)) + m[k]!
  }
  // (the sets' own: the Shroud's keeper rests less near the end, one with a companion at their side always — content SET_POWERS)
  const powers = setPowersOf(eng.world, e)
  const kept = (powers.has('shroudward') && eng.world.num(e, 'hp') <= eng.world.num(e, 'maxHp', 1) * 0.5 ? 0.25 : 0) + (powers.has('second') && !alone(eng.world, e) ? 0.15 : 0)
  // (the advancements' passives and buffs; Ember Heart's fire)
  const ember = has(e, 'ember-heart') && a.element === 'fire' ? 0.2 : 0
  a.cooldown = Math.max(5, Math.round(a.cooldown * (1 - Math.min(0.5, Math.max(0, eng.world.stat(e, 'cdr') + kept + paid(eng.world, e, 'cdr') + ember)))))
  return a
}

/** A blow of the cast landed (Marksman counts a cast that hit). */
let landed = false
/** The skill being cast (castSkill sets it): what a buff and a mark are kept under. */
let casting = ''
/** The colours its effects are drawn in (ActiveDef.look; the renderer's skill effects). */
let look = 'arcane'

const ELEMENT_LOOK: Record<string, string> = { fire: 'fire', ice: 'frost', lightning: 'storm' }
const PROFESSION_LOOK: Record<string, string> = { assassin: 'shadow', warrior: 'steel', ranger: 'wind', mage: 'arcane' }
/** A skill's look: its own, else its element's, its kind's (a mend's light, a gale's wind), its profession's. */
export function lookOf(def: SkillDef, a: ActiveDef = def.active!): string {
  return a.look ?? (a.element && ELEMENT_LOOK[a.element]) ?? (a.kind === 'mend' ? 'holy' : a.kind === 'haste' ? 'wind' : undefined) ?? PROFESSION_LOOK[def.profession ?? ''] ?? 'steel'
}

/** Cast a skill: what it does, then it rests. False when it cannot be cast, or finds nothing to act on (no cooldown then). */
export function castSkill(eng: Engine, e: Entity, id: string): boolean {
  const def = eng.skills.get(id)
  if (cannotCast(eng, e, def)) return false
  const a = effectiveActive(eng, e, def!)
  landed = false
  casting = id
  look = lookOf(def!, a)
  const from = at(e)
  if (!CAST[a.kind](eng, e, a)) return false
  // the cast itself: a ring at the caster's feet in the skill's colours, where it was cast from
  if (from) fx(eng, `cast:${look}`, from.map, from.x, from.y, e.id)
  const state = (e.combat ??= {})
  state.casts = (state.casts ?? 0) + 1
  // Ascendance: each cast +10% damage for 4 s, three times
  if (has(e, 'ascendance')) (state.ascStacks = (state.ascUntil ?? 0) > eng.world.state.tick ? Math.min(3, (state.ascStacks ?? 0) + 1) : 1), (state.ascUntil = eng.world.state.tick + 40)
  // Elemental Master: every third cast does not rest
  if (!(has(e, 'elemental-master') && state.casts % 3 === 0)) eng.setCooldown(castKey(id, e.id), a.cooldown)
  // Marksman: a cast that hit brings the others half a second nearer
  if (landed && has(e, 'marksman')) hasten(eng, e, 5, id)
  return true
}

/** Bring every other active skill one has nearer by so many ticks. */
function hasten(eng: Engine, e: Entity, ticks: number, except?: string): void {
  for (const k of knownActives(eng, e)) {
    if (k.id === except) continue
    const key = castKey(k.id, e.id)
    const left = eng.cooldown(key) - eng.world.state.tick
    if (left > 0) eng.setCooldown(key, Math.max(0, left - ticks))
  }
}

/**
 * What a defeat brings the one who dealt it (its talents): Master Assassin readies Shadow Strike again, Undying
 * Spirit brings every skill a second nearer, Bloodthirst mends a twentieth (told to the striker, who mends itself).
 */
export function onDefeat(eng: Engine, a: Entity): void {
  const w = eng.world
  if (has(a, 'master-assassin')) eng.setCooldown(castKey('shadow-strike', a.id), 0)
  if (has(a, 'undying-spirit')) hasten(eng, a, 10)
  if (has(a, 'bloodthirst') && w.num(a, 'hp') < w.num(a, 'maxHp'))
    eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'mend', amount: Math.max(1, Math.ceil(w.num(a, 'maxHp') * 0.05)) } }], { target: { e: a.id } }, 'skill')
  // the advancements (docs/advancement.md): Carnage mends, a poisoned foe felled bursts (a Corpse Burst: felled by the
  // Necromancer or the dead it raised, the burst its), a Death Mark's foe readies every skill
  const felled = a.combat?.felled
  if (has(a, 'carnage') && w.num(a, 'hp') < w.num(a, 'maxHp'))
    eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'mend', amount: Math.max(1, Math.ceil(w.num(a, 'maxHp') * 0.04)) } }], { target: { e: a.id } }, 'skill')
  // (Soul Harvest: a felling by the dead mends their raiser and brings its skills a second nearer)
  const raiser = summonerOf(w, a)
  if (raiser && has(raiser, 'soul-harvest')) {
    if (w.num(raiser, 'hp') < w.num(raiser, 'maxHp')) eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'mend', amount: 3 } }], { target: { e: raiser.id } }, 'skill')
    hasten(eng, raiser, 10)
    // (the soul flown home to its raiser)
    const home = at(raiser)
    if (felled && felled.tick === w.state.tick && home && home.map === felled.map) fx(eng, `soul:hell:${home.x - felled.x}:${home.y - felled.y}`, felled.map, felled.x, felled.y)
  }
  const burster = has(a, 'corpse-burst') ? a : raiser
  if (felled && felled.tick === w.state.tick && felled.poisoned && burster && has(burster, 'corpse-burst')) {
    fx(eng, 'burst:poison:2', felled.map, felled.x, felled.y)
    for (const v of w.entitiesOnMap(felled.map).filter((v) => v.id !== felled.id && foe(eng, burster, v) && dist(felled, at(v) ?? felled) <= 2)) blow(eng, burster, v, { kind: 'detonate', cooldown: 0, afflict: 'poisoned', ticks: 30, look: 'poison' }, 0.6)
  }
  if (felled && felled.tick === w.state.tick && felled.marked && has(a, 'death-mark')) for (const k of knownActives(eng, a)) eng.setCooldown(castKey(k.id, a.id), 0)
}

/** Ticks a skill rests after a cast, as this caster casts it. */
export function castCooldown(eng: Engine, e: Entity, id: string): number {
  const def = eng.skills.get(id)
  return def?.active ? effectiveActive(eng, e, def).cooldown : 0
}

/** Ticks left before an actor may cast a skill again. */
export function castLeft(eng: Engine, e: Entity, id: string): number {
  return Math.max(0, eng.cooldown(castKey(id, e.id)) - eng.world.state.tick)
}

// ---------------------------------------------------------------- what the kinds share

const at = (e: Entity): Pos | undefined => (e.place.on === 'tile' ? { map: e.place.map, x: e.place.x, y: e.place.y, z: e.place.z } : undefined)
const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** What a cast strikes: a living thing that stands, not oneself, nor one's own companion — what one would fight. */
function foe(eng: Engine, a: Entity, v: Entity | undefined): v is Entity {
  const w = eng.world
  if (!v || v.id === a.id || !w.isAgent(v) || w.hasStatus({ e: v.id }, 'down') || w.num(v, 'hp') <= 0) return false
  if (v.props?.companion === a.id || v.npc) return false
  return w.hasTag(v, 'creature') || eng.hostileTo(v, a)
}

/** The foes standing on these cells. */
function foesOn(eng: Engine, a: Entity, cells: { x: number; y: number }[]): Entity[] {
  const p = at(a)!
  const out: Entity[] = []
  for (const c of cells) {
    if (!eng.world.inBounds(p.map, c.x, c.y)) continue
    const v = eng.world.actorAt(p.map, c.x, c.y, a.id, p.z ?? 0)
    if (foe(eng, a, v) && !out.includes(v)) out.push(v)
  }
  return out
}

/** Along a row or a column from a cell (not counting it), up to `range` cells, until something solid: the cells, and the first foe met. */
function ray(eng: Engine, a: Entity, from: { x: number; y: number }, dir: Dir, range: number): { cells: { x: number; y: number }[]; first?: Entity; end?: { x: number; y: number } } {
  const w = eng.world
  const p = at(a)!
  const [dx, dy] = DIRS[dir]
  const cells: { x: number; y: number }[] = []
  for (let i = 1; i <= range; i++) {
    const x = from.x + dx * i
    const y = from.y + dy * i
    if (!w.inBounds(p.map, x, y)) break
    cells.push({ x, y })
    const v = w.actorAt(p.map, x, y, a.id, p.z ?? 0)
    if (foe(eng, a, v)) return { cells, first: v, end: { x, y } }
    if (w.blocked(p.map, x, y, undefined, p.z ?? 0)) return { cells, end: { x, y } }
  }
  return { cells, end: cells[cells.length - 1] }
}

/** Through every body along a row or a column from a cell, up to the first wall: the foes, and how far it went. */
function line(eng: Engine, a: Entity, from: { x: number; y: number }, dir: Dir, range: number): { foes: Entity[]; len: number } {
  const w = eng.world
  const p = at(a)!
  const [dx, dy] = DIRS[dir]
  const foes: Entity[] = []
  let len = 0
  for (let i = 1; i <= range; i++) {
    const x = from.x + dx * i
    const y = from.y + dy * i
    if (!w.inBounds(p.map, x, y)) break
    len = i
    const v = w.actorAt(p.map, x, y, a.id, p.z ?? 0)
    if (foe(eng, a, v)) foes.push(v)
    else if (w.blocked(p.map, x, y, undefined, p.z ?? 0)) break
  }
  return { foes, len }
}

/** How far a shot or a bolt of the skill flies: its own range, or the caster's weapon's (a bow's) when that is farther. */
function reach(eng: Engine, a: Entity, def: ActiveDef): number {
  return Math.max(eng.reachOf('use', a, undefined, weaponOf(eng.world, a)) ?? 1, def.range ?? 1)
}

/**
 * A blow of the cast on one foe: the caster's own (its atk and weapon, its talents: a critical, a combo — as a side
 * blow, never the primary's), times the skill's power, carrying what the skill leaves (a status, an element).
 */
function blow(eng: Engine, a: Entity, v: Entity, def: ActiveDef, mult = def.power ?? 1): void {
  const w = eng.world
  // the weapon one fights with — never some other thing the hand happens to hold (a helmet is not swung by a skill)
  const arm = weaponOf(w, a)
  const weapon = arm && w.hasTag(arm, 'weapon') ? arm : undefined
  const base = w.stat(a, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
  const p = at(a)!
  const q = at(v)
  const far = q ? dist(p, q) : 1
  const before = w.num(v, 'hp')
  // (a skill with colours of its own lands in them)
  if (def.look && q) fx(eng, `impact:${def.look}`, q.map, q.x, q.y)
  // Elementalist: what carries an element strikes harder
  if (def.element && has(a, 'elementalist')) mult *= 1.15
  // Doctrine (a set's power): a skill's blows strike a quarter harder; the advancements' skill damage; Arcane Mastery's element
  if (setPowersOf(w, a).has('curia')) mult *= 1.25
  mult *= 1 + paid(w, a, 'skillDamage', v)
  if (def.element && has(a, 'arcane-mastery')) mult *= 1.2
  // a sure critical (a Heartseeker, an Assassinate)
  if (def.sure) (a.combat ??= {}).sureNext = true
  const strike = combatStrike(w, a, v, Math.max(1, Math.round(base * mult)), far, weapon, false)
  if (def.afflict && def.ticks) strike.afflict = { status: def.afflict, ticks: def.ticks }
  // Kindling: fire sets the struck burning one time in three
  else if (def.element === 'fire' && has(a, 'kindling') && w.rand() < 0.33) strike.afflict = { status: 'burning', ticks: 30 }
  if (def.bleed) strike.bleed = Math.max(strike.bleed, def.bleed)
  if (def.kind === 'detonate' && def.status) strike.ends = def.status
  const defeats = a.combat?.defeats ?? 0
  eng.act('use', a.id, { e: v.id }, {
    instrument: weapon ? { e: weapon.id } : null,
    // a cast reaches as far as it says (a whirlwind round one, a fireball's blast), not only the weapon's reach
    reach: far + 1,
    params: {
      attack: true,
      power: strike.power,
      ...(def.element && { element: def.element }),
      ...(strike.critical && { critical: true }),
      ...(strike.bleed && { bleed: strike.bleed }),
      ...(strike.drain && { drain: strike.drain }),
      ...(strike.afflict && { afflict: strike.afflict.status, afflictFor: strike.afflict.ticks }),
      ...(strike.ends && { ends: strike.ends }),
    },
  })
  finishCombatStrike(w, a, v, strike, before, far, false)
  if (def.sure && a.combat) delete a.combat.sureNext
  if (w.num(v, 'hp') < before || !w.get(v.id)) landed = true
  if ((a.combat?.defeats ?? 0) > defeats) onDefeat(eng, a)
}

const fx = (eng: Engine, name: string, map: string, x: number, y: number, who?: string) => eng.world.fx.push({ t: 'vfx', fx: name, map, x, y, ...(who && { who }) })

/** Step the caster to a cell as a move (a dash's way): it lands there, or nowhere. */
function leap(eng: Engine, a: Entity, to: { x: number; y: number }): boolean {
  const p = at(a)!
  eng.act('move', a.id, { e: a.id }, { instrument: null, params: { map: p.map, x: to.x, y: to.y, dash: true } })
  const now = at(a)
  const done = !!now && now.x === to.x && now.y === to.y
  // (an afterimage along the way, in the skill's colours)
  if (done) fx(eng, `trail:${look}:${to.x - p.x}:${to.y - p.y}`, p.map, p.x, p.y, a.id)
  return done
}

/** The farthest cell along the facing (up to `range`) the caster may land on; through creatures when `through`. */
function landing(eng: Engine, a: Entity, dir: Dir, range: number, through: boolean): { x: number; y: number } | undefined {
  const w = eng.world
  const p = at(a)!
  const [dx, dy] = DIRS[dir]
  let land: { x: number; y: number } | undefined
  for (let i = 1; i <= range; i++) {
    const x = p.x + dx * i
    const y = p.y + dy * i
    if (!w.inBounds(p.map, x, y) || w.blocked(p.map, x, y)) break
    if (w.walkable(p.map, x, y, a.id)) land = { x, y }
    else if (!through) break
  }
  return land
}

const around = (p: { x: number; y: number }, r: number) => {
  const out: { x: number; y: number }[] = []
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push({ x: p.x + dx, y: p.y + dy })
  return out
}
const square = (c: { x: number; y: number }, r = 1) => [c, ...around(c, r)]
/** A blow round the caster as a summon or a field is cast, when it has a power (an Army of the Dead, a Demon Prison). */
function burst(eng: Engine, a: Entity, def: ActiveDef): void {
  if (!def.power || !def.radius) return
  const p = at(a)!
  fx(eng, `burst:${look}:${def.radius}`, p.map, p.x, p.y)
  for (const v of foesOn(eng, a, around(p, def.radius))) blow(eng, a, v, def)
}

/** One volley of an Arrow Rain on its 3×3 (the world's turn: engine.tick). */
export function rainTick(eng: Engine, active: string): void {
  const w = eng.world
  for (const e of w.entitiesOnMap(active)) {
    // a buff that mends (a Sanctuary): once a second, told to the one it mends
    if (e.combat?.buffs && w.state.tick - (e.combat.regenTick ?? -Infinity) >= 10) {
      const mend = paid(w, e, 'regen')
      if (mend > 0 && w.num(e, 'hp') < w.num(e, 'maxHp')) {
        e.combat.regenTick = w.state.tick
        eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'mend', amount: mend } }], { target: { e: e.id } }, 'skill')
      }
    }
    const r = e.combat?.rain
    if (!r || w.state.tick < r.next) continue
    if (r.map !== active || r.left <= 0) {
      delete e.combat!.rain
      continue
    }
    const area = square(r, r.radius ?? 1)
    for (const c of area) r.element === 'lightning' ? fx(eng, 'sparks', r.map, c.x, c.y) : r.element === 'fire' ? fx(eng, 'explosion', r.map, c.x, c.y) : r.element === 'ice' ? fx(eng, 'frost', r.map, c.x, c.y) : r.look ? fx(eng, `fall:${r.look}`, r.map, c.x, c.y) : fx(eng, 'bolt:none:down:1:arrow', r.map, c.x, c.y - 1)
    for (const v of foesOn(eng, e, area)) blow(eng, e, v, { kind: 'rain', cooldown: 0, ...(r.element && { element: r.element }), ...(r.look && { look: r.look }), ...(r.afflict && { afflict: r.afflict, ticks: r.ticks }) }, r.power)
    r.left -= 1
    r.next = w.state.tick + 10
    if (r.left <= 0) delete e.combat!.rain
  }
}

// ---------------------------------------------------------------- the kinds

const CAST: Record<ActiveDef['kind'], (eng: Engine, a: Entity, def: ActiveDef) => boolean> = {
  // general
  whirlwind: (eng, a, def) => {
    const p = at(a)!
    // (spun more than once: a Whirling Edge)
    for (let i = 0; i < (def.count ?? 1); i++) for (const v of foesOn(eng, a, around(p, 1))) blow(eng, a, v, def)
    fx(eng, 'gust', p.map, p.x, p.y)
    return true
  },
  cleave: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    fx(eng, `swing:${a.facing ?? 'down'}`, p.map, p.x, p.y, a.id)
    fx(eng, 'dust', p.map, p.x + dx, p.y + dy)
    for (const v of foesOn(eng, a, [{ x: p.x + dx, y: p.y + dy }])) blow(eng, a, v, def)
    return true
  },
  haste: (eng, a, def) => {
    ;(a.combat ??= {}).hasteUntil = eng.world.state.tick + (def.ticks ?? 50)
    const p = at(a)!
    fx(eng, 'gust', p.map, p.x, p.y)
    return true
  },
  mend: (eng, a, def) => {
    const w = eng.world
    if (w.num(a, 'hp') >= w.num(a, 'maxHp')) return false
    // told to mend, the caster mends itself (its own outcome: content body/stage)
    eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'mend', amount: Math.ceil(w.num(a, 'maxHp') * (def.power ?? 0.3)) } }], { target: { e: a.id } }, 'skill')
    return true
  },

  // the assassin
  'shadow-strike': (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    const near = w.entitiesOnMap(p.map).filter((v) => foe(eng, a, v) && dist(p, at(v) ?? p) <= (def.range ?? 4)).sort((u, v) => dist(p, at(u)!) - dist(p, at(v)!))
    let struck = 0
    for (const v of near) {
      if (struck >= (def.count ?? 1)) break
      const q = at(v)!
      // behind it (the way it does not face), else any side it leaves open
      const behind = DIRS[OPPOSITE[v.facing ?? 'down']]
      const sides = [behind, ...Object.values(DIRS).filter((d) => d !== behind)]
      const spot = sides.map(([dx, dy]) => ({ x: q.x + dx, y: q.y + dy })).find((c) => (c.x !== p.x || c.y !== p.y) && w.walkable(p.map, c.x, c.y, a.id))
      if (!spot) continue
      fx(eng, 'smoke', p.map, p.x, p.y)
      if (!leap(eng, a, spot)) continue
      a.facing = spot.x < q.x ? 'right' : spot.x > q.x ? 'left' : spot.y < q.y ? 'down' : 'up'
      blow(eng, a, v, def)
      struck++
    }
    return struck > 0
  },
  envenom: (eng, a, def) => {
    ;(a.combat ??= {}).envenomHits = def.count ?? 5
    const p = at(a)!
    fx(eng, 'sparkle', p.map, p.x, p.y)
    return true
  },
  veil: (eng, a, def) => {
    ;(a.combat ??= {}).veilUntil = eng.world.state.tick + (def.ticks ?? 30)
    // an Umbral Step: out of the veil the next blow is a sure critical
    if (def.sure) a.combat.sureNext = true
    const p = at(a)!
    for (const c of square(p)) fx(eng, 'smoke', p.map, c.x, c.y)
    return true
  },
  flurry: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    for (let i = 0; i < (def.count ?? 4); i++) {
      fx(eng, `swing:${a.facing ?? 'down'}`, p.map, p.x, p.y, a.id)
      for (const v of foesOn(eng, a, [{ x: p.x + dx, y: p.y + dy }])) blow(eng, a, v, def)
    }
    return true
  },

  // the warrior
  bash: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    fx(eng, 'hit', p.map, p.x + dx, p.y + dy)
    for (const v of foesOn(eng, a, [{ x: p.x + dx, y: p.y + dy }])) blow(eng, a, v, def)
    return true
  },
  charge: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    const dir = a.facing ?? 'down'
    const line = ray(eng, a, p, dir, def.range ?? 3)
    // up to the first foe (it is struck), else as far as the ground goes
    const [dx, dy] = DIRS[dir]
    let stop: { x: number; y: number } | undefined
    for (const c of line.cells) {
      if (line.first && c.x === at(line.first)!.x && c.y === at(line.first)!.y) break
      if (!w.walkable(p.map, c.x, c.y, a.id)) break
      stop = c
    }
    if (stop) leap(eng, a, stop)
    else if (!line.first || Math.abs(at(line.first)!.x - p.x) + Math.abs(at(line.first)!.y - p.y) !== 1) return false
    fx(eng, 'dust', p.map, p.x, p.y)
    const now = at(a)!
    const hit = foesOn(eng, a, [{ x: now.x + dx, y: now.y + dy }])
    for (const v of hit) blow(eng, a, v, def)
    return true
  },
  rally: (eng, a, def) => {
    ;(a.combat ??= {}).rallyUntil = eng.world.state.tick + (def.ticks ?? 50)
    const p = at(a)!
    fx(eng, 'gust', p.map, p.x, p.y)
    return true
  },
  quake: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    const centre = { x: p.x + dx * 2, y: p.y + dy * 2 }
    for (const c of square(centre)) fx(eng, 'dust', p.map, c.x, c.y)
    for (const v of foesOn(eng, a, square(centre))) blow(eng, a, v, def)
    return true
  },

  // the ranger
  multishot: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    const [dx, dy] = DIRS[dir]
    const range = reach(eng, a, def)
    // shafts side by side (three; five for an Arrow Storm): the facing row or column, and those on either side of it
    const n = def.count ?? 3
    for (const o of [0, 1, -1, 2, -2, 3, -3].slice(0, n)) {
      const from = { x: p.x + dy * o, y: p.y + dx * o }
      if (def.through) {
        const hit = line(eng, a, from, dir, range)
        fx(eng, `bolt:none:${dir}:${Math.max(1, hit.len)}:arrow`, p.map, from.x, from.y, a.id)
        for (const v of hit.foes) blow(eng, a, v, def)
        continue
      }
      const r = ray(eng, a, from, dir, range)
      const end = r.end ?? from
      fx(eng, `bolt:none:${dir}:${Math.max(1, Math.abs(end.x - from.x) + Math.abs(end.y - from.y))}:arrow`, p.map, from.x, from.y, a.id)
      if (r.first) blow(eng, a, r.first, def)
    }
    return true
  },
  'leap-shot': (eng, a, def) => {
    const dir = a.facing ?? 'down'
    // back the way one faces from, as far as the ground allows; one keeps facing the foe
    const back = landing(eng, a, OPPOSITE[dir], def.count ?? 2, false)
    if (back) (leap(eng, a, back), (a.facing = dir))
    const now = at(a)!
    const line = ray(eng, a, now, dir, reach(eng, a, def))
    const end = line.end ?? now
    fx(eng, `bolt:none:${dir}:${Math.max(1, Math.abs(end.x - now.x) + Math.abs(end.y - now.y))}:arrow`, now.map, now.x, now.y, a.id)
    if (line.first) blow(eng, a, line.first, def)
    return true
  },
  pierce: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    // through every body in the row, to the first wall
    const hit = line(eng, a, p, dir, reach(eng, a, def))
    fx(eng, `bolt:none:${dir}:${Math.max(1, hit.len)}:arrow`, p.map, p.x, p.y, a.id)
    for (const v of hit.foes) blow(eng, a, v, def)
    return true
  },
  rain: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    // round the first foe ahead, or (a Blizzard) round the caster
    const line = def.pattern === 'around' ? undefined : ray(eng, a, p, dir, reach(eng, a, def))
    const c = !line ? p : line.first ? at(line.first)! : line.end
    if (!c) return false
    // (what falls: its element's, else arrows when it looses them, else its own look's — a Pestilence's poison —, else arrows)
    ;(a.combat ??= {}).rain = { map: p.map, x: c.x, y: c.y, next: eng.world.state.tick, left: def.count ?? 3, power: def.power ?? 0.6, ...(def.element && { element: def.element }), ...(def.look && def.missile !== 'arrow' && { look: def.look }), ...(def.radius && { radius: def.radius }), ...(def.afflict && { afflict: def.afflict, ticks: def.ticks }) }
    return true
  },

  // the mage
  fireball: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    const line = ray(eng, a, p, dir, reach(eng, a, def))
    const c = line.first ? at(line.first)! : line.end
    if (!c) return false
    fx(eng, `bolt:fire:${dir}:${Math.max(1, Math.abs(c.x - p.x) + Math.abs(c.y - p.y))}`, p.map, p.x, p.y, a.id)
    for (const s of def.radius && def.radius > 1 ? square(c, def.radius) : [c]) fx(eng, 'explosion', p.map, s.x, s.y)
    for (const v of foesOn(eng, a, square(c, def.radius ?? 1))) blow(eng, a, v, def)
    return true
  },
  nova: (eng, a, def) => {
    const p = at(a)!
    // a shockwave in its colours (a Frost Nova's frost on every cell it reaches as well)
    fx(eng, `burst:${look}:${def.range ?? 2}`, p.map, p.x, p.y)
    if (def.element === 'ice' || !def.look) for (const c of around(p, def.range ?? 2)) if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= (def.range ?? 2) + 1) fx(eng, 'frost', p.map, c.x, c.y)
    for (const v of foesOn(eng, a, around(p, def.range ?? 2))) blow(eng, a, v, def)
    return true
  },
  chain: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    const dir = a.facing ?? 'down'
    const line = ray(eng, a, p, dir, reach(eng, a, def))
    if (!line.first) return false
    const hit: Entity[] = [line.first]
    // it leaps on to the nearest foe not yet struck, within three cells of the last
    while (hit.length < (def.count ?? 3)) {
      const last = at(hit[hit.length - 1])!
      const next = w.entitiesOnMap(p.map).filter((v) => foe(eng, a, v) && !hit.includes(v) && dist(last, at(v) ?? last) <= 3).sort((u, v) => dist(last, at(u)!) - dist(last, at(v)!))[0]
      if (!next) break
      hit.push(next)
    }
    for (const v of hit) {
      const q = at(v)!
      fx(eng, 'sparks', q.map, q.x, q.y)
      blow(eng, a, v, def)
    }
    return true
  },
  blink: (eng, a, def) => {
    const p = at(a)!
    const land = landing(eng, a, a.facing ?? 'down', def.range ?? 4, true)
    if (!land) return false
    fx(eng, 'sparkle', p.map, p.x, p.y)
    if (!leap(eng, a, land)) return false
    fx(eng, 'sparkle', p.map, land.x, land.y)
    return true
  },

  // the professions, deeper
  /** One shot along the facing, on the first foe in its line (a knife, a concussive arrow, an ice bolt). */
  shot: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    // (more than one: Arcane Missiles; a Convergence's three elements in turn)
    for (let i = 0; i < (def.count ?? 1); i++) {
      const element = def.element === 'all' ? ['fire', 'ice', 'lightning'][i % 3] : def.element
      const r = ray(eng, a, p, dir, reach(eng, a, def))
      const end = r.end ?? p
      const len = Math.max(1, Math.abs(end.x - p.x) + Math.abs(end.y - p.y))
      fx(eng, def.missile === 'arrow' || def.missile === 'knife' ? `bolt:none:${dir}:${len}:${def.missile}` : `bolt:${element ?? 'none'}:${dir}:${len}`, p.map, p.x, p.y, a.id)
      if (r.first) blow(eng, a, r.first, { ...def, ...(element ? { element } : {}) })
    }
    return true
  },
  /** A wide blow: the cell ahead and the two beside it. */
  arc: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    const cells = [-1, 0, 1].map((o) => ({ x: p.x + dx + dy * o, y: p.y + dy + dx * o }))
    fx(eng, `swing:${a.facing ?? 'down'}`, p.map, p.x, p.y, a.id)
    for (const c of cells) fx(eng, 'hit', p.map, c.x, c.y)
    for (const v of foesOn(eng, a, cells)) blow(eng, a, v, def)
    return true
  },
  /** Braced behind the shield a while: blows taken much lighter, steps slower (combat.ts). */
  guard: (eng, a, def) => {
    ;(a.combat ??= {}).ironUntil = eng.world.state.tick + (def.ticks ?? 30)
    const p = at(a)!
    fx(eng, 'sparkle', p.map, p.x, p.y)
    return true
  },
  /** A keen eye a while: a shooting weapon reaches farther and strikes true more often (combat.ts). */
  aim: (eng, a, def) => {
    ;(a.combat ??= {}).aimUntil = eng.world.state.tick + (def.ticks ?? 50)
    const p = at(a)!
    fx(eng, 'sparkle', p.map, p.x, p.y)
    return true
  },
  /** A blow down the facing: every foe on the cells ahead, `range` deep and three wide (a Heaven Splitter). */
  slam: (eng, a, def) => {
    const p = at(a)!
    const [dx, dy] = DIRS[a.facing ?? 'down']
    const cells: { x: number; y: number }[] = []
    for (let i = 1; i <= (def.range ?? 5); i++) for (const o of [-1, 0, 1]) cells.push({ x: p.x + dx * i + dy * o, y: p.y + dy * i + dx * o })
    for (const c of cells) fx(eng, 'dust', p.map, c.x, c.y)
    for (const v of foesOn(eng, a, cells)) blow(eng, a, v, def)
    return true
  },

  // the advancements (docs/advancement.md §4)
  /** What it pays a while (SkillPassive, combat.ts paid), at a price in health if it asks one (told to the caster). */
  buff: (eng, a, def) => {
    const w = eng.world
    if (def.cost) {
      const price = Math.ceil(w.num(a, 'maxHp', 1) * def.cost)
      if (w.num(a, 'hp') <= price) return false
      eng.script([{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'price', amount: price } }], { target: { e: a.id } }, 'skill')
    }
    ;((a.combat ??= {}).buffs ??= {})[casting] = w.state.tick + (def.ticks ?? 50)
    const p = at(a)!
    fx(eng, `aura:${look}`, p.map, p.x, p.y, a.id)
    return true
  },
  /** A hazard of the game's laid on a pattern (a line ahead, the 3×3 ahead, a ring round one, one cell ahead, round one). */
  field: (eng, a, def) => {
    burst(eng, a, def)
    const w = eng.world
    const p = at(a)!
    if (!def.leaves) return false
    const [dx, dy] = DIRS[a.facing ?? 'down']
    const r = def.range ?? 3
    const cells =
      def.pattern === 'line' ? Array.from({ length: r }, (_, i) => ({ x: p.x + dx * (i + 1), y: p.y + dy * (i + 1) }))
      : def.pattern === 'square' ? square({ x: p.x + dx * 2, y: p.y + dy * 2 })
      : def.pattern === 'ring' ? around(p, 2).filter((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) === 2)
      : def.pattern === 'around' ? square(p)
      : [{ x: p.x + dx, y: p.y + dy }]
    let laid = 0
    for (const c of cells) {
      if (!w.inBounds(p.map, c.x, c.y) || w.blocked(p.map, c.x, c.y, undefined, p.z ?? 0)) continue
      eng.script([{ op: 'spawn', type: def.leaves, at: 'target', owner: 'actor' }], { target: w.cellRef(p.map, c.x, c.y), actor: { e: a.id } }, 'skill')
      fx(eng, `zone:${look}`, p.map, c.x, c.y)
      laid++
    }
    // what the caster takes as it lays it (a Crown of Thorns' guard)
    if (def.buff) ((a.combat ??= {}).buffs ??= {})[casting] = w.state.tick + (def.ticks ?? 50)
    return laid > 0
  },
  /** Every foe within reach in a status bursts: a blow, the status ended (a Rupture, a Combustion). */
  detonate: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    const r = def.range ?? 1
    const near = w.entitiesOnMap(p.map).filter((v) => foe(eng, a, v) && dist(p, at(v) ?? p) <= r)
    const burst = near.filter((v) => !def.status || w.hasStatus({ e: v.id }, def.status))
    // (on one in reach not in the status, a plain blow: a Rupture's cut)
    const struck = burst.length ? burst : r <= 1 ? near.slice(0, 1) : []
    for (const v of struck) {
      const q = at(v)!
      fx(eng, def.status === 'burning' || def.element === 'fire' ? 'explosion' : `burst:${look}:0`, q.map, q.x, q.y)
      blow(eng, a, v, burst.includes(v) ? def : { ...def, status: undefined, kind: 'cleave' }, burst.includes(v) ? def.power : (def.power ?? 1) / 2.5)
    }
    return struck.length > 0
  },
  /** Up to a cell before the first foe ahead (or as far as the ground goes), and a blow on the 3×3 there (a Leap of Ruin). */
  leap: (eng, a, def) => {
    const p = at(a)!
    const dir = a.facing ?? 'down'
    const line = ray(eng, a, p, dir, def.range ?? 5)
    const [dx, dy] = DIRS[dir]
    const first = line.first ? at(line.first) : undefined
    const to = first ? { x: first.x - dx, y: first.y - dy } : landing(eng, a, dir, def.range ?? 5, false)
    if (to && (to.x !== p.x || to.y !== p.y) && !leap(eng, a, to)) return false
    const now = at(a)!
    for (const c of square(now)) fx(eng, 'dust', now.map, c.x, c.y)
    fx(eng, `burst:${look}:1`, now.map, now.x, now.y)
    for (const v of foesOn(eng, a, around(now, 1))) blow(eng, a, v, def)
    return true
  },
  /** A creature of the game's that fights for the caster a while (its companion; Pack Bond strengthens a beast, a Grave
   * Pact the dead). */
  summon: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    if (!def.creature) return false
    burst(eng, a, def)
    // it grows with the one who calls it (its kind's numbers at level 1, a sixth more each level), bound stronger (Pack
    // Bond, a Grave Pact), a Hell Pact stronger again
    const bond = has(a, 'pack-bond') || has(a, 'grave-pact')
    const hell = has(a, 'hell-pact') ? 1.3 : 1
    const kind = w.onto.resolve(def.creature).props
    const grow = 1 + (w.num(a, 'level', 1) - 1) / 6
    const hp = Math.round(Number(kind.maxHp ?? 20) * grow * (bond ? 1.5 : 1) * hell)
    const atk = Math.round(Number(kind.atk ?? 3) * grow * (bond ? 1.3 : 1) * hell)
    for (let i = 0; i < (def.count ?? 1); i++) {
      const c = around(p, 1).find((q) => w.walkable(p.map, q.x, q.y, a.id)) ?? p
      eng.script([{ op: 'spawn', type: def.creature, at: 'target', props: { companion: a.id, summoner: a.id, hp, maxHp: hp, atk } }], { target: w.cellRef(p.map, c.x, c.y) }, 'skill')
      // (the ground opening for what is raised, in the skill's colours)
      fx(eng, `rise:${look}`, p.map, c.x, c.y)
    }
    return true
  },
  /** The caster's summoned creature (the nearest `count` of them) leaps on the foe ahead and strikes it (a Sic, a Drive the Dead). */
  command: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    const line = ray(eng, a, p, a.facing ?? 'down', reach(eng, a, def))
    const v = line.first
    const beasts = w.entitiesOnMap(p.map).filter((h) => h.props?.summoner === a.id && w.num(h, 'hp') > 0).sort((h, k) => dist(at(h) ?? p, p) - dist(at(k) ?? p, p)).slice(0, def.count ?? 1)
    if (!v || !beasts.length) return false
    const q = at(v)!
    for (const beast of beasts) {
      const spot = around(q, 1).find((c) => w.walkable(p.map, c.x, c.y, beast.id))
      if (spot) leap(eng, beast, spot)
      blow(eng, beast, v, def)
    }
    return true
  },
  /** The nearest foe (or the one ahead, struck) takes more from the caster a while (a Death Mark, a Sunder). */
  mark: (eng, a, def) => {
    const w = eng.world
    const p = at(a)!
    let v: Entity | undefined
    if ((def.range ?? 1) > 1) v = w.entitiesOnMap(p.map).filter((u) => foe(eng, a, u) && dist(p, at(u) ?? p) <= (def.range ?? 6)).sort((u, k) => dist(p, at(u)!) - dist(p, at(k)!))[0]
    else {
      const [dx, dy] = DIRS[a.facing ?? 'down']
      v = foesOn(eng, a, [{ x: p.x + dx, y: p.y + dy }])[0]
    }
    if (!v) return false
    ;(a.combat ??= {}).mark = { target: v.id, until: w.state.tick + (def.ticks ?? 80), damage: def.buff?.damage ?? 0.3, skill: casting }
    const q = at(v)!
    fx(eng, `mark:${look}`, q.map, q.x, q.y)
    if (def.power) blow(eng, a, v, def)
    return true
  },
  /** Those within reach struck lightly and turned on the caster (struck, they come for it), the caster braced a while (a Challenge). */
  taunt: (eng, a, def) => {
    const p = at(a)!
    const near = foesOn(eng, a, around(p, def.range ?? 3))
    // (dazed a moment: the buff's while is the caster's, not theirs)
    for (const v of near) blow(eng, a, v, { ...def, ticks: 5 })
    ;((a.combat ??= {}).buffs ??= {})[casting] = eng.world.state.tick + (def.ticks ?? 40)
    fx(eng, `burst:${look}:${def.range ?? 3}`, p.map, p.x, p.y)
    fx(eng, `aura:${look}`, p.map, p.x, p.y, a.id)
    return true
  },
  /** A ward that takes so much of one's health in harm before one does, a while (a Mana Ward). */
  ward: (eng, a, def) => {
    const w = eng.world
    const state = (a.combat ??= {})
    state.ward = Math.ceil(w.num(a, 'maxHp', 1) * (def.power ?? 0.3))
    state.wardUntil = w.state.tick + (def.ticks ?? 60)
    const p = at(a)!
    fx(eng, `aura:${look}`, p.map, p.x, p.y, a.id)
    return true
  },
  /** Every other skill's rest cut by a share (a Time Warp). */
  rest: (eng, a, def) => {
    const w = eng.world
    for (const k of knownActives(eng, a)) {
      if (k.id === casting) continue
      const key = castKey(k.id, a.id)
      const left = eng.cooldown(key) - w.state.tick
      if (left > 0) eng.setCooldown(key, Math.round(left * (1 - (def.power ?? 0.5))))
    }
    const p = at(a)!
    fx(eng, `aura:${look}`, p.map, p.x, p.y, a.id)
    return true
  },
}
