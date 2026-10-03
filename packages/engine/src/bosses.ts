// Generic locked-telegraph encounters. Identity, patterns, timing and effects are world data.
// Damage still travels through ordinary hit rules; no player-ID or named-boss decisions.
import type { Engine } from './engine.ts'
import { combatDelay } from './combat.ts'
import { astar } from './path.ts'
import type { BossSkill, Entity, Pos } from './types.ts'

/** Discrete hit cells; the same locked cells are sent to the renderer and used for damage. */
export function bossPattern(skill: BossSkill, origin: Pos, aim: Pos): [number, number][] {
  const center = skill.aim === 'self' ? origin : aim
  const dx = aim.x - origin.x, dy = aim.y - origin.y
  const vx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0
  const vy = vx ? 0 : Math.sign(dy) || 1
  const r = skill.radius, cells: [number, number][] = []
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const dist = Math.max(Math.abs(x), Math.abs(y))
    const forward = x * vx + y * vy, side = Math.abs(x * vy - y * vx)
    const hit = skill.shape === 'circle' ? x * x + y * y <= r * r
      : skill.shape === 'ring' ? dist === r
      : skill.shape === 'cross' ? x === 0 || y === 0
      : skill.shape === 'line' ? forward >= 1 && forward <= r && side <= 1
      : skill.shape === 'cone' ? forward >= 1 && side <= Math.ceil(forward / 2)
      : (x === 0 && y === 0) || (dist === r && (x === 0 || y === 0))
    if (hit) cells.push([center.x + x, center.y + y])
  }
  return cells
}

const faceToward = (e: Entity, from: Pos, to: Pos) => {
  const dx = to.x - from.x, dy = to.y - from.y
  e.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'
}

/** A cached detour uses the entire body as its clearance test. */
function moveToward(eng: Engine, e: Entity, goal: Pos): boolean {
  const w = eng.world, pos = w.posOf(e)!, ai = e.ai!
  const nextStep = ([x, y]: [number, number]) => {
    if (Math.abs(x - pos.x) + Math.abs(y - pos.y) !== 1) return false
    faceToward(e, pos, { map: pos.map, x, y })
    return eng.step(e, e.facing!)
  }
  if (ai.detour && (ai.detour.x !== goal.x || ai.detour.y !== goal.y || !ai.detour.path.length)) delete ai.detour
  if (ai.detour) {
    if (nextStep(ai.detour.path[0])) { ai.detour.path.shift(); return true }
    delete ai.detour
  }
  faceToward(e, pos, goal)
  if (eng.step(e, e.facing!)) return true
  const map = w.map(pos.map)!
  const path = astar(map.width, map.height, (x, y) => w.fits(e, pos.map, x, y), pos.x, pos.y, goal.x, goal.y, 2000)
  if (!path?.length || !nextStep(path[0])) return false
  ai.detour = { x: goal.x, y: goal.y, path: path.slice(1) }
  return true
}

function release(eng: Engine, e: Entity, skill: BossSkill): void {
  const w = eng.world, b = e.boss!, p = b.pending!
  const touched = new Set(p.tiles.map(([x, y]) => `${x},${y}`))
  const victims = w.entitiesOnMap(p.origin.map).filter((o) => o.id !== e.id && o.place.on === 'tile' && eng.hostileTo(e, o)
    && w.occupiedCells(o).some(([x, y]) => touched.has(`${x},${y}`)))
  for (const target of victims) {
    // the blow is a strike the target answers for itself (design.md §5.8)
    eng.queue({ kind: 'impulse/strike', host: { e: target.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params: { power: Math.round(skill.damage * ((b.phase ?? 1) > 1 ? 1.35 : 1)), edge: 'blunt', ...(skill.element && { element: skill.element }) }, cause: e.id, origin: 'world' })
    if (w.num(target, 'hp') <= 0) continue
    if (skill.shift) {
      const at = w.posOf(target)!
      const dx = Math.sign(p.origin.x - at.x), dy = Math.sign(p.origin.y - at.y)
      const sign = skill.shift === 'pull' ? 1 : -1
      const dir = Math.abs(p.origin.x - at.x) >= Math.abs(p.origin.y - at.y) ? dx * sign > 0 ? 'right' : 'left' : dy * sign > 0 ? 'down' : 'up'
      eng.step(target, dir)
    }
    if (skill.status) eng.applyStatus({ e: target.id }, skill.status)
  }
  if (skill.heal && victims.length) eng.effects.apply({ op: 'heal', amount: skill.heal * victims.length }, { kind: 'time/period', host: { e: e.id }, roles: {}, origin: 'world' })
  if (skill.blink) {
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = p.aim.x + dx, y = p.aim.y + dy
      if (w.fits(e, p.aim.map, x, y)) { w.place(e, { on: 'tile', map: p.aim.map, x, y }); break }
    }
  }
  // Distinct generated effects at the impact's center and extremities, not a tile-sized flood.
  const center = skill.aim === 'self' ? p.origin : p.aim
  const centers = [center]
  if (skill.shape === 'ring' || skill.shape === 'spots' || skill.shape === 'cross') {
    centers.push(...p.tiles.filter(([x, y]) => (x === center.x || y === center.y) && Math.max(Math.abs(x-center.x), Math.abs(y-center.y)) === skill.radius).map(([x, y]) => ({ map: p.origin.map, x, y })))
  } else if (skill.shape === 'cone' || skill.shape === 'line') {
    const dx = p.aim.x - p.origin.x, dy = p.aim.y - p.origin.y
    const vx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, vy = vx ? 0 : Math.sign(dy) || 1
    centers.push({ map: p.origin.map, x: p.origin.x + vx * Math.ceil(skill.radius / 2), y: p.origin.y + vy * Math.ceil(skill.radius / 2) })
  }
  for (const at of centers) w.fx.push({ t: 'vfx', fx: skill.fx, ...at })
  b.actionTick = w.state.tick
  b.actionEnd = w.state.tick + Math.max(6, Math.round(skill.recovery * ((b.phase ?? 1) > 1 ? 0.65 : 1)))
  b.nextAt = b.actionEnd
  b.nextSkill = (p.skill + 1) % eng.bossKits[b.kit].skills.length
  delete b.pending
}

export function stepBosses(eng: Engine, active: string): void {
  const w = eng.world, now = w.state.tick
  for (const e of w.entitiesOnMap(active)) {
    if (!e.boss || !e.ai || e.place.on !== 'tile') continue
    const b = e.boss, kit = eng.bossKits[b.kit]
    if (!kit) continue
    if (w.num(e, 'hp') <= 0) {
      if (b.action !== 'death') { b.action = 'death'; b.actionTick = now }
      delete b.pending
      continue
    }
    if (eng.busy(e)) { delete b.pending; b.action = 'hurt'; continue }
    const pos = w.posOf(e)!, home = e.ai?.home ?? pos
    b.phase = w.num(e, 'hp') <= w.num(e, 'maxHp') * kit.enrageAt ? 2 : 1
    const candidates = w.entitiesOnMap(active).filter((o) => o.place.on === 'tile' && eng.hostileTo(e, o) && w.num(o, 'hp') > 0 && !o.statuses?.down)
    candidates.sort((a, c) => { const x = w.posOf(a)!, y = w.posOf(c)!; return Math.abs(x.x-pos.x)+Math.abs(x.y-pos.y)-Math.abs(y.x-pos.x)-Math.abs(y.y-pos.y) })
    const target = candidates[0], at = w.posOf(target)
    const inLeash = Math.max(Math.abs(pos.x-home.x), Math.abs(pos.y-home.y)) <= kit.leash
    if (b.pending) {
      if (!at || !inLeash || Math.max(Math.abs(at.x-home.x), Math.abs(at.y-home.y)) > kit.leash + 3) { delete b.pending; b.action = 'idle'; b.nextAt = now + 10; continue }
      if (now >= b.pending.releaseAt) release(eng, e, kit.skills[b.pending.skill])
      continue
    }
    if (now < (b.nextAt ?? 0)) continue
    if (!target || !at || !inLeash || Math.max(Math.abs(at.x-pos.x), Math.abs(at.y-pos.y)) > kit.sight) {
      b.action = 'idle'
      if (e.ai) e.ai.state = 'idle'
      // Return to the encounter instead of camping the map exit or chasing into a town.
      if (Math.abs(pos.x-home.x)+Math.abs(pos.y-home.y)>1 && eng.ready(e.id)) {
        if (moveToward(eng, e, home)) b.action = 'walk'
        eng.setCooldown(e.id, combatDelay(w, e, w.num(e, 'speed', 8), 'move'))
      }
      continue
    }
    faceToward(e, pos, at)
    if (e.ai) e.ai.state = 'chase'
    const skillIndex = b.nextSkill ?? 0, skill = kit.skills[skillIndex]
    const reach = skill.aim === 'self' ? skill.radius : kit.sight
    if (Math.max(Math.abs(at.x-pos.x), Math.abs(at.y-pos.y)) > reach) {
      if (eng.ready(e.id)) {
        if (moveToward(eng, e, at)) b.action = 'walk'
        else b.action = 'idle'
        eng.setCooldown(e.id, combatDelay(w, e, w.num(e, 'speed', 8), 'move'))
      }
      continue
    }
    const windup = Math.max(8, Math.round(skill.windup * ((b.phase ?? 1) > 1 ? 0.8 : 1)))
    b.action = skill.action; b.actionTick = now; b.actionEnd = now + windup + skill.recovery
    b.pending = { skill: skillIndex, target: target.id, origin: { ...pos }, aim: { ...at }, tiles: bossPattern(skill, pos, at).filter(([x, y]) => w.inBounds(active, x, y)), releaseAt: now + windup }
    w.fx.push({ t: 'say', who: e.id, text: skill.name })
  }
}
