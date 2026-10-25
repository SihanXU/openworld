// The encounter goal (docs/skills.md, docs/bosses.md): a boss fight's director over its kit. Each phase (by its health,
// never going back) takes its rotation's skills up in turn; as a phase begins its opening skill comes first; between the
// rotation's steps a skill that answers where the foe stands (taken up as a minor monster's are) may come instead. It
// walks to its foe, keeps to its arena and goes home when the foe is gone. Its place in the fight is its saved memory
// (`Entity.boss`); a wind-up is the kits' (cast.ts), lost with a save as a minor monster's is.

import { astar, wayTo, type Engine, type Entity, type Frame, type KitSkill, type Pos, type WindupPose } from '@openworld/engine'
import { TELEGRAPH_RED, beginCast, faceToward, kitsOf, scaled, stepCast } from './cast.ts'
import { foeOf, ready, skillKey } from './kit.ts'
import { edgeOf, originOf } from './pattern.ts'

const DEFAULT_FLOORS = { windup: 8, recovery: 6 }
const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** A cached detour uses the entire body as its clearance test. */
function moveToward(eng: Engine, e: Entity, goal: Pos): boolean {
  const w = eng.world, pos = w.posOf(e)!, ai = e.ai!
  const nextStep = ([x, y]: [number, number]) => {
    const dir = wayTo(pos.x, pos.y, x, y)
    return !!dir && eng.step(e, dir)
  }
  if (ai.detour && (ai.detour.x !== goal.x || ai.detour.y !== goal.y || !ai.detour.path.length)) delete ai.detour
  if (ai.detour) {
    if (nextStep(ai.detour.path[0])) {
      ai.detour.path.shift()
      return true
    }
    delete ai.detour
  }
  faceToward(e, pos, goal)
  if (eng.step(e, e.facing!)) return true
  const map = w.map(pos.map)!
  const path = astar(map.width, map.height, (x, y) => w.fits(e, pos.map, x, y), pos.x, pos.y, goal.x, goal.y, 2000, (ax, ay, bx, by) => w.safeStep(e, pos.map, ax, ay, bx, by))
  if (!path?.length || !nextStep(path[0])) return false
  ai.detour = { x: goal.x, y: goal.y, path: path.slice(1) }
  return true
}

/** The phase an encounter has come to at its health now (never back to an earlier one). */
function phaseNow(eng: Engine, e: Entity, phases: { at: number }[], reached: number): number {
  const share = eng.world.num(e, 'hp') / eng.world.num(e, 'maxHp', 1)
  let phase = Math.max(1, reached)
  while (phase < phases.length && share <= phases[phase].at) phase++
  return phase
}

/** How a minor monster's body winds a skill up (the client draws it): by how it moves, else where it lands. */
export function windupPose(skill: KitSkill): WindupPose {
  if (skill.move === 'leap') return 'leap'
  if (skill.move === 'dash') return 'dash'
  if (skill.aim === 'self') return skill.radius > 0 ? 'slam' : 'call'
  return 'cast'
}

/** The pose a skill's body takes: its own, else a blow round itself or a cast at its foe. */
const poseOf = (skill: KitSkill) => skill.action ?? (skill.aim === 'self' ? 'attack' : 'cast')

export function encounter(eng: Engine, e: Entity, active: string): boolean {
  const w = eng.world, kits = kitsOf(eng), now = w.state.tick
  const enc = kits.encounterOf(e)
  if (!enc || !e.ai || e.place.on !== 'tile') return false
  const def = enc.def
  const b = (e.boss ??= { phase: 1, action: 'idle' })
  if (w.num(e, 'hp') <= 0) {
    if (b.action !== 'death') (b.action = 'death'), (b.actionTick = now)
    kits.pending.delete(e.id)
    return true
  }
  const floors = { ...DEFAULT_FLOORS, ...def.floors }
  const pos = w.posOf(e)!, home = e.ai.home ?? pos
  const sight = def.sight ?? e.ai.sight, leash = def.leash ?? e.ai.leash ?? 12
  const p = kits.pending.get(e.id)
  // a wind-up lost with a save (it is behaviour memory): the opening or the rotation's step it was is given back, so a
  // phase's opening (the brood, the hedge) is never skipped by loading a game
  if (!p && b.winding) {
    if (b.winding === 'open') b.opened = Math.max(1, (b.opened ?? 1) - 1)
    else b.step = Math.max(0, (b.step ?? 0) - 1)
    delete b.winding
  }
  if (p) {
    const seen = foeOf(eng, e, active, Infinity)
    // a foe gone from its arena: the skill is dropped (unless it is steady: a phase's opening skill)
    if (!p.skill.steady && (!seen || dist(pos, home) > leash || dist(seen.at, home) > leash + 3)) {
      kits.pending.delete(e.id)
      delete b.winding
      b.action = 'idle'
      b.nextAt = now + 10
      return true
    }
    const r = stepCast(eng, e, active)
    // let go or lost to a hold, the opening or the step is spent
    if (r === 'lost' || r === 'released') delete b.winding
    if (r === 'lost') {
      b.action = eng.busy(e) ? 'hurt' : 'idle'
      return true
    }
    if (r === 'released') {
      const next = kits.pending.get(e.id)
      const ph = def.phases[(b.phase ?? 1) - 1]
      if (next) {
        // a chained skill winds up at once
        b.action = poseOf(next.skill)
        b.skill = next.skill.id
        b.clip = next.skill.clip
        b.actionTick = now
        b.actionEnd = next.releaseAt + (next.skill.recovery ?? 10)
      } else {
        b.actionTick = now
        b.actionEnd = b.nextAt = now + scaled(p.skill.recovery ?? 10, ph?.recoveryMul ?? 1, floors.recovery)
      }
    }
    return true
  }
  if (eng.busy(e)) {
    b.action = 'hurt'
    return true
  }
  const phase = phaseNow(eng, e, def.phases, b.phase ?? 1)
  if (phase !== (b.phase ?? 1)) (b.phase = phase), (b.step = 0)
  const ph = def.phases[phase - 1]
  if (!ph) return true
  if (now < (b.nextAt ?? 0)) return true
  const seen = foeOf(eng, e, active, Infinity)
  const inLeash = dist(pos, home) <= leash
  if (!seen || !inLeash || dist(seen.at, edgeOf(eng, e, pos, seen.at)) > sight) {
    b.action = 'idle'
    e.ai.state = 'idle'
    // back to its arena instead of camping the map's exit or chasing into a town
    if (Math.abs(pos.x - home.x) + Math.abs(pos.y - home.y) > 1 && eng.ready(e.id)) {
      if (moveToward(eng, e, home)) b.action = 'walk'
      eng.setCooldown(e.id, eng.combat.delay(e, w.num(e, 'speed', 8), 'move'))
    }
    return true
  }
  const { foe, at } = seen
  faceToward(e, pos, at)
  e.ai.state = 'chase'
  ;(foe.combat ??= {}).fightTick = now
  // what it takes up: a phase's opening skill (once each, in order: a blow that skips a phase skips none of them), a skill
  // that answers where its foe stands, or the rotation's next
  let skill: KitSkill | undefined
  let opening = false, step = false
  while (!skill && (b.opened ?? 1) < phase) {
    b.opened = (b.opened ?? 1) + 1
    skill = kits.skillOf(e, def.phases[b.opened - 1]?.enter)
    opening = !!skill
  }
  if (!skill) skill = (def.reactive ?? []).map((id) => kits.skillOf(e, id)).find((s): s is KitSkill => !!s && ready(eng, e, s, pos, at))
  if (!skill && ph.rotation.length) {
    skill = kits.skillOf(e, ph.rotation[(b.step ?? 0) % ph.rotation.length])
    step = true
  }
  if (!skill) return true
  // a rotation's skill wants its foe within its reach: it walks there first
  const reach = skill.range ? skill.range[1] : skill.aim === 'self' ? skill.radius : sight
  if (!opening && dist(at, originOf(eng, e, skill, pos, at)) > reach) {
    if (eng.ready(e.id)) {
      b.action = moveToward(eng, e, at) ? 'walk' : 'idle'
      eng.setCooldown(e.id, eng.combat.delay(e, w.num(e, 'speed', 8), 'move'))
    }
    return true
  }
  if (step) b.step = (b.step ?? 0) + 1
  const cast = beginCast(eng, e, skill, at, { target: foe.id, boss: { windupMul: ph.windupMul ?? 1, powerMul: ph.powerMul ?? 1, floor: floors.windup } })
  if (!cast) return true
  if (opening || step) b.winding = opening ? 'open' : 'step'
  else delete b.winding
  eng.setCooldown(skillKey(e, skill), cast.releaseAt - now + (skill.cooldown ?? 0))
  b.action = poseOf(skill)
  b.skill = skill.id
  b.clip = skill.clip
  b.actionTick = now
  b.actionEnd = cast.releaseAt + (skill.recovery ?? 10)
  return true
}

/** Begin one of an encounter's skills by hand (the Boss Studio's buttons): at its nearest foe, scaled by its phase. */
export function castNow(eng: Engine, e: Entity, id: string): boolean {
  const kits = kitsOf(eng), w = eng.world
  const enc = kits.encounterOf(e), skill = kits.skillOf(e, id)
  const seen = foeOf(eng, e, e.place.on === 'tile' ? e.place.map : '', Infinity)
  if (!enc || !skill || !seen) return false
  const b = (e.boss ??= { phase: 1, action: 'idle' })
  const ph = enc.def.phases[(b.phase ?? 1) - 1]
  const cast = beginCast(eng, e, skill, seen.at, { target: seen.foe.id, boss: { windupMul: ph?.windupMul ?? 1, powerMul: ph?.powerMul ?? 1, floor: enc.def.floors?.windup ?? DEFAULT_FLOORS.windup } })
  if (!cast) return false
  b.action = poseOf(skill)
  b.skill = skill.id
  b.clip = skill.clip
  b.actionTick = w.state.tick
  b.actionEnd = cast.releaseAt + (skill.recovery ?? 10)
  b.nextAt = 0
  return true
}

/**
 * What the kits put in the frame: the cells every caster on the map is winding up on, and each boss's plate and pose
 * (its phase, its skill, how far along).
 */
export function kitFrame(eng: Engine, f: Frame): void {
  const w = eng.world, kits = kitsOf(eng), now = w.state.tick
  const marks: NonNullable<Frame['telegraphs']> = []
  for (const [who, p] of kits.pending) {
    const e = w.get(who)
    if (!e || e.place.on !== 'tile' || e.place.map !== f.map) continue
    const enc = p.boss && kits.encounterOf(e)
    marks.push({ who, tiles: p.tiles, progress: Math.min(1, (now - p.start) / Math.max(1, p.releaseAt - p.start)), color: p.skill.color ?? enc?.def.plate.color ?? TELEGRAPH_RED, ...(p.boss ? { boss: true } : { pose: windupPose(p.skill) }) })
  }
  if (marks.length) f.telegraphs = marks
  for (const snap of f.entities) {
    const e = w.get(snap.id)
    const enc = e && kits.encounterOf(e)
    if (!e || !enc) continue
    const b = e.boss ?? {}
    const p = kits.pending.get(e.id)
    const hp = w.num(e, 'hp')
    const hurt = hp > 0 && now - (e.combat?.lastHurtTick ?? -100) < 4
    const elapsed = now - (b.actionTick ?? now)
    const windup = p ? Math.min(1, (now - p.start) / Math.max(1, p.releaseAt - p.start)) : 0
    const thresholds = enc.def.phases.slice(1).map((ph) => ph.at)
    const footprint = w.onto.resolve(e.type).footprint ?? [1, 1]
    snap.boss = {
      kit: enc.id,
      phase: b.phase ?? 1,
      color: enc.def.plate.color,
      footprint: [footprint[0], footprint[1]],
      enrageAt: thresholds[0] ?? 0,
      action: hp <= 0 ? 'death' : hurt ? 'hurt' : b.action ?? 'idle',
      skill: p?.skill.id ?? b.skill,
      ...((p?.skill.clip ?? b.clip) && { clip: p?.skill.clip ?? b.clip }),
      progress: hp <= 0 ? Math.min(1, elapsed / 16) : hurt ? Math.min(1, (now - (e.combat?.lastHurtTick ?? now)) / 3) : p ? windup * 0.5 : Math.min(1, 0.5 + 0.5 * elapsed / Math.max(1, (b.actionEnd ?? 0) - (b.actionTick ?? 0))),
      animationElapsedMs: Math.max(0, hurt ? now - (e.combat?.lastHurtTick ?? now) : p ? now - p.start : elapsed) * 100,
      warning: p ? { name: p.skill.name, tiles: p.tiles, progress: windup } : undefined,
      thresholds,
      phases: enc.def.phases.length,
      ...(enc.def.plate.seal && { seal: enc.def.plate.seal }),
    }
  }
}
