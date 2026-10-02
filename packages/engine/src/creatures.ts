// Creature controllers (active map only): idle wander near home, chase and attack the
// player when hostile and in sight, return home when the player is gone. Attacks are
// ordinary `hit` events, so every elemental reaction is a rule.

import { isNight } from './calendar.ts'
import type { Engine } from './engine.ts'
import type { Dir, Entity } from './types.ts'

const DIRS: Dir[] = ['up', 'down', 'left', 'right']

export function stepCreatures(eng: Engine, active: string): void {
  const w = eng.world
  const player = w.player
  const pp = w.posOf(player)
  const night = isNight(w.hour())
  for (const e of w.entitiesOnMap(active)) {
    if (!e.ai || e.place.on !== 'tile' || eng.busy(e)) continue
    if (!eng.ready(e.id)) continue
    const ai = e.ai
    const { x, y } = e.place
    const speed = w.num(e, 'speed', 6)
    const dist = pp && pp.map === active ? Math.abs(pp.x - x) + Math.abs(pp.y - y) : Infinity
    if (ai.hostile && dist <= ai.sight) {
      ai.state = 'chase'
      const dx = pp!.x - x
      const dy = pp!.y - y
      const face: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      const aligned = dx === 0 || dy === 0
      if (dist === 1 || (ai.behaviour === 'ranged' && aligned && dist <= 5)) {
        e.facing = face
        if (eng.ready('atk:' + e.id)) {
          eng.attack(e)
          eng.setCooldown('atk:' + e.id, ai.behaviour === 'ranged' ? 22 : 14)
        }
        eng.setCooldown(e.id, speed)
        continue
      }
      if (!towards(eng, e, dx, dy)) eng.step(e, DIRS[Math.floor(w.rand() * 4)])
      eng.setCooldown(e.id, speed)
      continue
    }
    // idle / return home (after dark, the place it roams)
    const home = night && ai.night ? ai.night : ai.home
    const hx = home.x - x
    const hy = home.y - y
    if (Math.abs(hx) + Math.abs(hy) > 4) {
      ai.state = 'return'
      towards(eng, e, hx, hy)
    } else {
      ai.state = 'idle'
      if (w.rand() < 0.3) eng.step(e, DIRS[Math.floor(w.rand() * 4)])
    }
    eng.setCooldown(e.id, speed * 2)
  }
}

/** Greedy step reducing distance along the longer axis first. */
function towards(eng: Engine, e: Entity, dx: number, dy: number): boolean {
  const order: Dir[] = []
  const hx: Dir = dx > 0 ? 'right' : 'left'
  const vy: Dir = dy > 0 ? 'down' : 'up'
  if (Math.abs(dx) >= Math.abs(dy)) order.push(hx, vy)
  else order.push(vy, hx)
  for (const d of order) {
    if ((d === 'left' || d === 'right') && dx === 0) continue
    if ((d === 'up' || d === 'down') && dy === 0) continue
    if (eng.step(e, d)) return true
  }
  return false
}
