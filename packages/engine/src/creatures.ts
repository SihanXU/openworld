// The goals of things with a behaviour of their own (world-model.md §6.10; behaviour.ts runs them
// in each actor's order). Threat: an actor attacks the nearest actor it is hostile to
// (Engine.hostileTo: its foes, and the factions its own are hostile to when its temper says so)
// that it can see; a passive one (a cow, a hen) never attacks: it runs from whoever struck it
// (Minecraft's panic). Home: otherwise it keeps near home — by day its home, after dark where it
// roams. Idle: near home, it wanders now and then. What fears fire never comes near a lit or
// burning thing, nor chases anyone who stands by one. Attacks are ordinary acts, so every
// elemental reaction is a rule.

import { isNight } from './calendar.ts'
import type { Engine } from './engine.ts'
import { combatDelay } from './combat.ts'
import { astar } from './path.ts'
import type { Dir, Entity, Pos } from './types.ts'
import { DIRS, FIRE_RADIUS } from './types.ts'

const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right']
/** How far a creature chases from where it lives, unless it says otherwise. */
const LEASH = 8
/** Beyond this many tiles from home, it heads back. */
const HOME_NEAR = 4

/** What a tick's goals share on the active map: who is about, the fires, the hour. */
export interface Scene {
  active: string
  actors: Entity[]
  night: boolean
  fires?: Pos[]
}

export function sceneOf(eng: Engine, active: string): Scene {
  const w = eng.world
  return { active, actors: w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && w.isAgent(e)), night: isNight(w.hour()) }
}

/** Where a thing that fears fire may not go (a fire's reach). */
function safety(eng: Engine, e: Entity, sc: Scene): (x: number, y: number) => boolean {
  if (!eng.fearsFire(e)) return () => true
  const fires = (sc.fires ??= eng.fires(sc.active))
  return (px, py) => !fires.some((f) => Math.max(Math.abs(f.x - px), Math.abs(f.y - py)) <= FIRE_RADIUS)
}

/** Where it lives now: after dark, the place it roams. */
function homeOf(e: Entity, sc: Scene): Pos {
  const ai = e.ai!
  return sc.night && ai.night ? ai.night : ai.home
}

/** Threat, for a thing with a behaviour: the nearest it would attack in sight, fought (or, passive, fled). */
export function fight(eng: Engine, e: Entity, sc: Scene): boolean {
  const w = eng.world
  const ai = e.ai
  if (!ai || e.place.on !== 'tile') return false
  const { x, y } = e.place
  const speed = combatDelay(w, e, w.num(e, 'speed', 6), 'move')
  const safe = safety(eng, e, sc)
  // it chases no farther than its leash from where it lives
  const home = homeOf(e, sc)
  if (Math.abs(home.x - x) + Math.abs(home.y - y) > (ai.leash ?? LEASH)) return false
  let target: Entity | undefined
  let best = Infinity
  for (const o of sc.actors) {
    if (o.place.on !== 'tile' || !eng.hostileTo(e, o)) continue
    const d = Math.abs(o.place.x - x) + Math.abs(o.place.y - y)
    if (d <= ai.sight && d < best && safe(o.place.x, o.place.y)) (target = o), (best = d)
  }
  if (!target || target.place.on !== 'tile') return false
  if (ai.behaviour === 'passive') {
    ai.state = 'flee'
    if (!towards(eng, e, x - target.place.x, y - target.place.y, safe)) wander(eng, e, safe)
    eng.setCooldown(e.id, Math.max(2, Math.floor(speed / 2)))
    return true
  }
  ai.state = 'chase'
  const dx = target.place.x - x
  const dy = target.place.y - y
  const face: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  const aligned = dx === 0 || dy === 0
  if (best === 1 || (ai.behaviour === 'ranged' && aligned && best <= 5)) {
    e.facing = face
    if (eng.ready('atk:' + e.id)) {
      eng.attack(e, { e: target.id })
      eng.setCooldown('atk:' + e.id, combatDelay(w, e, ai.behaviour === 'ranged' ? 22 : 14, 'attack'))
    }
    eng.setCooldown(e.id, speed)
    return true
  }
  if (!go(eng, e, target.place.x, target.place.y, safe)) wander(eng, e, safe)
  eng.setCooldown(e.id, speed)
  return true
}

/** Home: far from where it lives (after dark, where it roams), it heads back. */
export function home(eng: Engine, e: Entity, sc: Scene): boolean {
  const w = eng.world
  if (!e.ai || e.place.on !== 'tile') return false
  const h = homeOf(e, sc)
  if (Math.abs(h.x - e.place.x) + Math.abs(h.y - e.place.y) <= HOME_NEAR) return false
  e.ai.state = 'return'
  go(eng, e, h.x, h.y, safety(eng, e, sc))
  eng.setCooldown(e.id, combatDelay(w, e, w.num(e, 'speed', 6), 'move') * 2)
  return true
}

/** Idle: near home, a step now and then. */
export function idle(eng: Engine, e: Entity, sc: Scene): boolean {
  const w = eng.world
  if (!e.ai || e.place.on !== 'tile') return false
  e.ai.state = 'idle'
  if (w.rand() < 0.3) wander(eng, e, safety(eng, e, sc))
  eng.setCooldown(e.id, combatDelay(w, e, w.num(e, 'speed', 6), 'move') * 2)
  return true
}

/** One step in a random direction, if it is safe. */
function wander(eng: Engine, e: Entity, safe: (x: number, y: number) => boolean): boolean {
  if (e.place.on !== 'tile') return false
  const d = DIR_LIST[Math.floor(eng.world.rand() * 4)]
  const [dx, dy] = DIRS[d]
  return safe(e.place.x + dx, e.place.y + dy) && eng.step(e, d)
}

/**
 * One step toward (gx, gy): along a detour it is already following to there; else the greedy
 * step; and when that is blocked (a clump of trees in the way), a path around (A*, over the
 * ground as it is) that it then keeps to, so it does not slide back into the same corner. A
 * fire's reach still stops it.
 */
function go(eng: Engine, e: Entity, gx: number, gy: number, safe: (x: number, y: number) => boolean): boolean {
  const ai = e.ai
  if (e.place.on !== 'tile') return false
  const d = ai?.detour
  if (ai && d && (d.x !== gx || d.y !== gy || !d.path.length)) delete ai.detour
  if (ai?.detour) {
    if (stepTo(eng, e, ai.detour.path[0], safe)) {
      ai.detour.path.shift()
      return true
    }
    delete ai.detour
  }
  if (towards(eng, e, gx - e.place.x, gy - e.place.y, safe)) return true
  const w = eng.world
  const { map, x, y } = e.place
  const m = w.map(map)
  const path = m && astar(m.width, m.height, (px, py) => w.passable(map, px, py) || (px === gx && py === gy), x, y, gx, gy, 2000, (ax, ay, bx, by) => w.safeStep(e, map, ax, ay, bx, by))
  if (!path?.length || !stepTo(eng, e, path[0], safe)) return false
  if (ai) ai.detour = { x: gx, y: gy, path: path.slice(1) }
  return true
}

/** One step onto a neighbouring tile, if it is safe. */
function stepTo(eng: Engine, e: Entity, [nx, ny]: [number, number], safe: (x: number, y: number) => boolean): boolean {
  if (e.place.on !== 'tile' || !safe(nx, ny)) return false
  const { x, y } = e.place
  if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return false
  return eng.step(e, nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up')
}

/** Greedy step reducing distance along the longer axis first (never into a fire's reach). */
function towards(eng: Engine, e: Entity, dx: number, dy: number, safe: (x: number, y: number) => boolean): boolean {
  if (e.place.on !== 'tile') return false
  const order: Dir[] = []
  const hx: Dir = dx > 0 ? 'right' : 'left'
  const vy: Dir = dy > 0 ? 'down' : 'up'
  if (Math.abs(dx) >= Math.abs(dy)) order.push(hx, vy)
  else order.push(vy, hx)
  for (const d of order) {
    if ((d === 'left' || d === 'right') && dx === 0) continue
    if ((d === 'up' || d === 'down') && dy === 0) continue
    const [sx, sy] = DIRS[d]
    if (!safe(e.place.x + sx, e.place.y + sy)) continue
    if (eng.step(e, d)) return true
  }
  return false
}
