// The kit goal (docs/creatures.md, docs/skills.md): a minor monster's skills, taken up when their conditions hold —
// the foe's distance, a row or a column, its own health, a chance, a cooldown (Elin's model). It looks once a second;
// taking nothing up, it fights on as before (the threat goal). A boss's director takes its answering skills up by the
// same conditions (`ready`).

import type { Engine, Entity, KitSkill, Pos } from '@openworld/engine'
import { beginCast, kitsOf, stepCast } from './cast.ts'

const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** The key of a skill's cooldown on a caster. */
export const skillKey = (e: Entity, skill: KitSkill) => `kit:${e.id}:${skill.id}`

/** May the caster at `pos` take this skill up against a foe at `at` now (its range, row, health, cooldown, chance)? */
export function ready(eng: Engine, e: Entity, skill: KitSkill, pos: Pos, at: Pos): boolean {
  const w = eng.world
  const d = dist(pos, at)
  if (skill.range && (d < skill.range[0] || d > skill.range[1])) return false
  if (skill.aligned && pos.x !== at.x && pos.y !== at.y) return false
  if (skill.below !== undefined && w.num(e, 'hp') > w.num(e, 'maxHp', 1) * skill.below) return false
  if (!eng.ready(skillKey(e, skill))) return false
  return w.rand() < (skill.chance ?? 1)
}

/** The nearest foe a caster sees on its map, and where it stands. */
export function foeOf(eng: Engine, e: Entity, active: string, sight: number): { foe: Entity; at: Pos } | undefined {
  const w = eng.world, now = w.state.tick
  const pos = w.posOf(e)
  if (!pos) return undefined
  let best: Entity | undefined
  let near = Infinity
  for (const o of w.entitiesOnMap(active)) {
    if (o === e || o.place.on !== 'tile' || (o.place.z ?? 0) !== (e.place.on === 'tile' ? e.place.z ?? 0 : 0) || !eng.hostileTo(e, o) || w.num(o, 'hp') <= 0 || o.statuses?.down) continue
    if ((o.combat?.veilUntil ?? 0) > now) continue
    const d = Math.abs(o.place.x - pos.x) + Math.abs(o.place.y - pos.y)
    if (d <= sight && d < near) (best = o), (near = d)
  }
  const at = best && w.posOf(best)
  return best && at ? { foe: best, at } : undefined
}

/**
 * The kit goal: a creature with a kit, ready and with a foe in sight, may take a skill up — it turns to the foe, stands
 * and marks the cells, and when the wind-up runs out the skill is its act. False when it takes nothing up (the threat
 * goal fights on as before). A boss's skills are its director's (the encounter goal).
 */
export function kitGoal(eng: Engine, e: Entity, active: string): boolean {
  const w = eng.world, kits = kitsOf(eng)
  if (kits.pending.has(e.id) && !kits.encounterOf(e)) {
    const p = kits.pending.get(e.id)!
    const r = stepCast(eng, e, active)
    // held, stunned or frozen in the wind-up, it lost the skill: it waits a moment before the next
    if (r === 'lost') {
      eng.setCooldown('kit:' + e.id, 10)
      return false
    }
    // the skill let go (and no other chained after it): it rests a moment
    if (r === 'released' && !kits.pending.has(e.id)) {
      eng.setCooldown(e.id, Math.max(6, p.skill.recovery ?? Math.round(p.skill.windup / 2)))
      eng.setCooldown('atk:' + e.id, 8)
    }
    return true
  }
  const kit = kits.kitOf(e)
  if (!kit || !e.ai || e.ai.behaviour === 'passive' || kits.encounterOf(e) || e.place.on !== 'tile') return false
  if (!eng.ready(e.id) || !eng.ready('kit:' + e.id) || eng.busy(e)) return false
  // it looks once a second whether to take a skill up
  eng.setCooldown('kit:' + e.id, 10)
  const pos = w.posOf(e)!
  const home = e.ai.home
  if (home && Math.abs(home.x - pos.x) + Math.abs(home.y - pos.y) > (e.ai.leash ?? 8)) return false
  const seen = foeOf(eng, e, active, e.ai.sight)
  if (!seen) return false
  for (const skill of kit) {
    if (!ready(eng, e, skill, pos, seen.at)) continue
    ;(seen.foe.combat ??= {}).fightTick = w.state.tick
    const p = beginCast(eng, e, skill, seen.at, { target: seen.foe.id })
    if (!p) return false
    eng.setCooldown(skillKey(e, skill), skill.windup + (skill.cooldown ?? 0))
    return true
  }
  return false
}
