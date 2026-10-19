// The tactics goals (docs/creatures.md §11): how a minor monster moves in a fight beyond walking up and striking — `rout`
// before the kit goal, `tactics` after it (a skill it can take up comes first) — as behaviour, never an outcome (design.md §5.4). Each is a kind's data, a prop of its type:
// - `keepAway` (cells): one that fights from afar steps back from a foe come closer than that, to where its skills reach;
// - `fleeBelow` (a share of its health): hurt past it, it runs from its foe;
// - the tag `pack`: one of a pack goes round to the foe's far side from a packmate already beside it (a flank).
// Taking nothing up, it leaves the fight to the kit and threat goals as before.

import type { Dir, Engine, Entity, Pos } from '@openworld/engine'
import { foeOf } from './kit.ts'

const DIRS: [Dir, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]
const manhattan = (a: Pos, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** A step onto the free neighbouring cell that best serves `score` (higher is better), never to a worse one than staying. */
function stepBy(eng: Engine, e: Entity, score: (x: number, y: number) => number): boolean {
  const w = eng.world, at = w.posOf(e)
  if (!at) return false
  let best: Dir | undefined
  let top = score(at.x, at.y)
  for (const [d, dx, dy] of DIRS) {
    const x = at.x + dx, y = at.y + dy
    if (!w.inBounds(at.map, x, y) || !w.fits(e, at.map, x, y, at.z ?? 0)) continue
    const s = score(x, y)
    if (s > top) (top = s), (best = d)
  }
  return !!best && eng.step(e, best)
}

/** The first step of a short way (at most `limit` cells searched) to `goal` over the cells `e` fits, else undefined. */
function wayRound(eng: Engine, e: Entity, from: Pos, goal: { x: number; y: number }, limit: number): Dir | undefined {
  const w = eng.world
  const queue: { x: number; y: number; first?: Dir }[] = [{ x: from.x, y: from.y }]
  const seen = new Set([`${from.x},${from.y}`])
  for (let i = 0; i < queue.length && i < limit; i++) {
    const c = queue[i]
    if (c.x === goal.x && c.y === goal.y) return c.first
    for (const [d, dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy, k = `${x},${y}`
      if (seen.has(k) || !w.inBounds(from.map, x, y) || !w.fits(e, from.map, x, y, from.z ?? 0)) continue
      seen.add(k)
      queue.push({ x, y, first: c.first ?? d })
    }
  }
  return undefined
}

/** A step away from where it lives is a step it will make back: a wary step never takes it past its leash. */
function withinLeash(e: Entity, x: number, y: number): boolean {
  const home = e.ai?.home
  return !home || Math.abs(home.x - x) + Math.abs(home.y - y) <= (e.ai?.leash ?? 8)
}

/**
 * `rout` (before the kit goal): hurt past its line, it runs. `place` (after it: a skill it can take up comes first): it
 * keeps away, or flanks with its pack.
 */
export function tacticsGoal(eng: Engine, e: Entity, active: string, mode: 'rout' | 'place' = 'place'): boolean {
  const w = eng.world
  if (!e.ai || e.ai.behaviour === 'passive' || e.boss || e.place.on !== 'tile' || eng.busy(e)) return false
  const keepAway = mode === 'place' ? w.num(e, 'keepAway', 0) : 0
  const fleeBelow = mode === 'rout' ? w.num(e, 'fleeBelow', 0) : 0
  const pack = mode === 'place' && w.hasTag(e, 'pack')
  if (!keepAway && !fleeBelow && !pack) return false
  const seen = foeOf(eng, e, active, e.ai.sight)
  if (!seen) return false
  const pos = w.posOf(e)!
  const d = manhattan(pos, seen.at)
  const pace = () => eng.setCooldown(e.id, eng.combat.delay(e, w.num(e, 'speed', 6), 'move'))
  // hurt past its line: it runs, as far from its foe as each step takes it (within its leash)
  if (fleeBelow && w.num(e, 'hp') <= w.num(e, 'maxHp', 1) * fleeBelow) {
    e.ai.state = 'flee'
    if (stepBy(eng, e, (x, y) => (withinLeash(e, x, y) ? manhattan(seen.at, { x, y }) : -1))) pace()
    else eng.setCooldown(e.id, 4)
    return true
  }
  // too close for one that fights from afar: a step back, keeping the foe in its row where it can (its skills aim there)
  if (keepAway && d < keepAway) {
    const aligned = (x: number, y: number) => (x === seen.at.x || y === seen.at.y ? 0.5 : 0)
    if (stepBy(eng, e, (x, y) => (withinLeash(e, x, y) ? Math.min(keepAway, manhattan(seen.at, { x, y })) + aligned(x, y) : -1))) {
      pace()
      return true
    }
    // cornered: it fights where it stands
    return false
  }
  // a pack: one already beside the foe, and this one not yet: it goes round to the far side
  if (pack && d > 1) {
    const mate = w.entitiesOnMap(active).find((o) => o !== e && o.place.on === 'tile' && w.hasTag(o, 'pack') && w.num(o, 'hp') > 0 && manhattan(w.posOf(o)!, seen.at) === 1)
    if (!mate) return false
    const m = w.posOf(mate)!
    const goal = { x: seen.at.x * 2 - m.x, y: seen.at.y * 2 - m.y }
    if (!w.inBounds(pos.map, goal.x, goal.y) || !w.fits(e, pos.map, goal.x, goal.y, pos.z ?? 0)) return false
    e.ai.state = 'chase'
    ;(seen.foe.combat ??= {}).fightTick = w.state.tick
    // the way round: a short search over the cells it fits (round its foe and its packmate), its first step taken
    const first = wayRound(eng, e, pos, goal, 80)
    if (first && eng.step(e, first)) {
      pace()
      return true
    }
  }
  return false
}
