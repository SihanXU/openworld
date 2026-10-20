// The tactics goals (docs/creatures.md §11): how a minor monster moves in a fight beyond walking up and striking — `rout`
// before the kit goal, `tactics` after it (a skill it can take up comes first) — as behaviour, never an outcome (design.md §5.4). Each is a kind's data, a prop of its type:
// - `keepAway` (cells): one that fights from afar steps back from a foe come closer than that, to where its skills reach;
// - `fleeBelow` (a share of its health): hurt past it, it runs from its foe;
// - the tag `pack`: one of a pack goes round to the foe's far side from a packmate already beside it (a flank), even
//   past the foe's other sides.
// Taking nothing up, it leaves the fight to the kit and threat goals as before.

import { fireSafety, homeNow, type Dir, type Engine, type Entity, type Pos, type Scene } from '@openworld/engine'
import { kitsOf } from './cast.ts'
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

/** The first step of a short way (at most `limit` cells searched) to `goal` over the cells `e` fits and `may` allows. */
function wayRound(eng: Engine, e: Entity, from: Pos, goal: { x: number; y: number }, limit: number, may: (x: number, y: number) => boolean): Dir | undefined {
  const w = eng.world
  const queue: { x: number; y: number; first?: Dir }[] = [{ x: from.x, y: from.y }]
  const seen = new Set([`${from.x},${from.y}`])
  for (let i = 0; i < queue.length && i < limit; i++) {
    const c = queue[i]
    if (c.x === goal.x && c.y === goal.y) return c.first
    for (const [d, dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy, k = `${x},${y}`
      if (seen.has(k) || !w.inBounds(from.map, x, y) || !w.fits(e, from.map, x, y, from.z ?? 0) || !may(x, y)) continue
      seen.add(k)
      queue.push({ x, y, first: c.first ?? d })
    }
  }
  return undefined
}

/**
 * Where a wary step may go: never past its leash from where it lives now (after dark, where it roams), and, for one that
 * fears fire, never into a fire's reach — the bounds the threat goal keeps (creatures.ts).
 */
function mayStand(eng: Engine, e: Entity, sc: Scene): (x: number, y: number) => boolean {
  const home = e.ai ? homeNow(e, sc) : undefined
  const safe = fireSafety(eng, e, sc)
  return (x, y) => (!home || Math.abs(home.x - x) + Math.abs(home.y - y) <= (e.ai?.leash ?? 8)) && safe(x, y)
}

/**
 * `rout` (before the kit goal): hurt past its line, it runs. `place` (after it: a skill it can take up comes first): it
 * keeps away, or flanks with its pack.
 */
export function tacticsGoal(eng: Engine, e: Entity, sc: Scene, mode: 'rout' | 'place' = 'place'): boolean {
  const w = eng.world, active = sc.active
  if (!e.ai || e.ai.behaviour === 'passive' || e.boss || e.place.on !== 'tile' || eng.busy(e)) return false
  // a skill winding up is seen through where it began: it neither runs nor steps aside from it
  if (kitsOf(eng).pending.has(e.id)) return false
  const keepAway = mode === 'place' ? w.num(e, 'keepAway', 0) : 0
  const fleeBelow = mode === 'rout' ? w.num(e, 'fleeBelow', 0) : 0
  const pack = mode === 'place' && w.hasTag(e, 'pack')
  if (!keepAway && !fleeBelow && !pack) return false
  const seen = foeOf(eng, e, active, e.ai.sight)
  if (!seen) return false
  const pos = w.posOf(e)!
  const d = manhattan(pos, seen.at)
  const pace = () => eng.setCooldown(e.id, eng.combat.delay(e, w.num(e, 'speed', 6), 'move'))
  const may = mayStand(eng, e, sc)
  // hurt past its line: it runs, as far from its foe as each step takes it (within its leash)
  if (fleeBelow && w.num(e, 'hp') <= w.num(e, 'maxHp', 1) * fleeBelow) {
    if (stepBy(eng, e, (x, y) => (may(x, y) ? manhattan(seen.at, { x, y }) : -1))) {
      e.ai.state = 'flee'
      pace()
      return true
    }
    // cornered (a wall, its leash, a fire): it turns and fights, or goes home, as the goals after it say
    return false
  }
  // too close for one that fights from afar: a step back, keeping the foe in its row where it can (its skills aim there)
  if (keepAway && d < keepAway) {
    const aligned = (x: number, y: number) => (x === seen.at.x || y === seen.at.y ? 0.5 : 0)
    if (stepBy(eng, e, (x, y) => (may(x, y) ? Math.min(keepAway, manhattan(seen.at, { x, y })) + aligned(x, y) : -1))) {
      pace()
      return true
    }
    // cornered: it fights where it stands
    return false
  }
  // a pack: it goes round to the far side of its foe from a packmate already beside it. The mate it goes by is the
  // first of the pack (by id) beside the foe before it, so two never circle each other; one already across from a mate
  // stays and fights
  if (pack) {
    const beside = sc.actors.filter((o) => o !== e && o.place.on === 'tile' && w.hasTag(o, 'pack') && w.num(o, 'hp') > 0 && manhattan(w.posOf(o)!, seen.at) === 1)
    const across = (o: Entity) => { const m = w.posOf(o)!; return pos.x === seen.at.x * 2 - m.x && pos.y === seen.at.y * 2 - m.y }
    if (d === 1 && beside.some(across)) return false
    const mate = beside.filter((o) => o.id < e.id).sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    if (!mate) return false
    const m = w.posOf(mate)!
    const goal = { x: seen.at.x * 2 - m.x, y: seen.at.y * 2 - m.y }
    if (!w.inBounds(pos.map, goal.x, goal.y) || !w.fits(e, pos.map, goal.x, goal.y, pos.z ?? 0) || !may(goal.x, goal.y)) return false
    e.ai.state = 'chase'
    ;(seen.foe.combat ??= {}).fightTick = w.state.tick
    // the way round: a short search over the cells it fits (round its foe and its packmate), its first step taken
    const first = wayRound(eng, e, pos, goal, 80, may)
    if (first && eng.step(e, first)) {
      pace()
      return true
    }
  }
  return false
}
