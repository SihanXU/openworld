// Generic locked-telegraph encounters. Identity, patterns, timing and effects are world data.
// Damage still travels through ordinary hit rules; no player-ID or named-boss decisions.
//
// The approach, the aim and the telegraph are the encounter's behaviour (its memory: `boss`).
// When the telegraph runs out the blow is an act (design.md §5.13, A2): `use` with its own body
// on the aimed tile, carrying the skill and the locked cells; the encounter's rule answers it
// with `release` — a strike to each foe on those cells, a push or pull and a coat that they
// answer themselves, and its own heal or blink.
import type { Engine } from './engine.ts'
import { combatDelay } from './combat.ts'
import { astar } from './path.ts'
import type { BossSkill, Entity, GameEvent, Pos } from './types.ts'

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
  const path = astar(map.width, map.height, (x, y) => w.fits(e, pos.map, x, y), pos.x, pos.y, goal.x, goal.y, 2000, (ax, ay, bx, by) => w.safeStep(e, pos.map, ax, ay, bx, by))
  if (!path?.length || !nextStep(path[0])) return false
  ai.detour = { x: goal.x, y: goal.y, path: path.slice(1) }
  return true
}

/** The telegraph runs out: the blow is the encounter's act (its own body on the aimed tile); then its behaviour recovers. */
function release(eng: Engine, e: Entity, skill: BossSkill): void {
  const w = eng.world, b = e.boss!, p = b.pending!
  // its body on the aimed cell: on what makes up the cell there
  const aimed = w.cellTop(p.aim.map, p.aim.x, p.aim.y)
  // the skill's pattern reaches where it was aimed, however far that lies
  const pos = w.posOf(e)
  const reach = pos && aimed ? w.distance(pos, aimed) : undefined
  if (aimed) eng.act('use', e.id, { e: aimed.id }, { instrument: null, params: { skill: p.skill, ox: p.origin.x, oy: p.origin.y, ax: p.aim.x, ay: p.aim.y, enraged: (b.phase ?? 1) > 1 }, reach })
  b.actionTick = w.state.tick
  b.actionEnd = w.state.tick + Math.max(6, Math.round(skill.recovery * ((b.phase ?? 1) > 1 ? 0.65 : 1)))
  b.nextAt = b.actionEnd
  b.nextSkill = (p.skill + 1) % eng.bossKits[b.kit].skills.length
  delete b.pending
}

/**
 * The `release` primitive (the encounter's own outcome): the skill its act names lands on the
 * cells it telegraphed — each foe there is struck, pushed or pulled, and coated as the skill says
 * (impulses they answer themselves); the host heals itself by what it hit, or blinks beside its aim.
 */
export function releaseSkill(eng: Engine, e: Entity, ev: GameEvent): void {
  const w = eng.world
  const kit = e.boss && eng.bossKits[e.boss.kit]
  const q = ev.params ?? {}
  const skill = kit?.skills[Number(q.skill)]
  const at = w.posOf(e)
  if (!skill || !at || typeof q.ox !== 'number' || typeof q.oy !== 'number' || typeof q.ax !== 'number' || typeof q.ay !== 'number') return
  const origin: Pos = { map: at.map, x: q.ox, y: q.oy }
  const aim: Pos = { map: at.map, x: q.ax, y: q.ay }
  const tiles = bossPattern(skill, origin, aim).filter(([x, y]) => w.inBounds(at.map, x, y))
  const touched = new Set(tiles.map(([x, y]) => `${x},${y}`))
  const victims = w.entitiesOnMap(at.map).filter((o) => o.id !== e.id && o.place.on === 'tile' && eng.hostileTo(e, o)
    && w.occupiedCells(o).some(([x, y]) => touched.has(`${x},${y}`)))
  const send = (kind: GameEvent['kind'], to: Entity, params: GameEvent['params']) =>
    eng.queue({ kind, host: { e: to.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params, cause: e.id, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
  for (const target of victims) {
    // the blow is a strike the target answers for itself (design.md §5.8)
    // an encounter placed for an early chapter strikes softer (its `skillScale`, data on the body)
    send('impulse/strike', target, { power: Math.round(skill.damage * (q.enraged ? 1.35 : 1) * w.num(e, 'skillScale', 1)), edge: 'blunt', ...(skill.element && { element: skill.element }) })
    if (skill.shift) {
      const t = w.posOf(target)!
      const dx = Math.sign(origin.x - t.x), dy = Math.sign(origin.y - t.y)
      const sign = skill.shift === 'pull' ? 1 : -1
      const dir = Math.abs(origin.x - t.x) >= Math.abs(origin.y - t.y) ? dx * sign > 0 ? 'right' : 'left' : dy * sign > 0 ? 'down' : 'up'
      send('impulse/push', target, { dir })
    }
    // what clings (a mire, a trance): a coat the target answers
    if (skill.status) send('impulse/coat', target, { substance: skill.status })
  }
  if (skill.heal && victims.length) eng.effects.apply({ op: 'heal', amount: skill.heal * victims.length }, ev)
  if (skill.blink) {
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = aim.x + dx, y = aim.y + dy
      if (w.fits(e, aim.map, x, y)) {
        eng.touch({ e: e.id })
        w.place(e, { on: 'tile', map: aim.map, x, y })
        eng.touch({ e: e.id })
        break
      }
    }
  }
  // Optional visual layouts use the same locked pattern. They never change damage or timing.
  if (skill.fxPlacement === 'pattern') {
    for (const [x, y] of tiles) w.fx.push({ t: 'vfx', fx: skill.fx, map: at.map, x, y })
    return
  }
  if (skill.fxPlacement === 'beam' && skill.shape === 'line') {
    const dx = aim.x - origin.x, dy = aim.y - origin.y
    const vx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, vy = vx ? 0 : Math.sign(dy) || 1
    w.fx.push({ t: 'vfx', fx: skill.fx, map: at.map,
      x: origin.x + vx * (skill.radius + 1) / 2, y: origin.y + vy * (skill.radius + 1) / 2,
      angle: Math.atan2(vy, vx) * 180 / Math.PI, span: skill.radius })
    return
  }
  // Legacy layouts keep their sparse impact markers, unchanged.
  const center = skill.aim === 'self' ? origin : aim
  const centers = [center]
  if (skill.shape === 'ring' || skill.shape === 'spots' || skill.shape === 'cross') {
    centers.push(...tiles.filter(([x, y]) => (x === center.x || y === center.y) && Math.max(Math.abs(x-center.x), Math.abs(y-center.y)) === skill.radius).map(([x, y]) => ({ map: at.map, x, y })))
  } else if (skill.shape === 'cone' || skill.shape === 'line') {
    const dx = aim.x - origin.x, dy = aim.y - origin.y
    const vx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, vy = vx ? 0 : Math.sign(dy) || 1
    centers.push({ map: at.map, x: origin.x + vx * Math.ceil(skill.radius / 2), y: origin.y + vy * Math.ceil(skill.radius / 2) })
  }
  for (const c of centers) w.fx.push({ t: 'vfx', fx: skill.fx, ...c })
}

/**
 * The encounter goal (world-model.md §6.10): a sin's locked telegraphs — it walks to its foe, winds
 * up a skill on the cells it will strike, and releases it; it keeps to its arena.
 */
export function encounter(eng: Engine, e: Entity, active: string): boolean {
  const w = eng.world, now = w.state.tick
  if (!e.boss || !e.ai || e.place.on !== 'tile') return false
  const b = e.boss, kit = eng.bossKits[b.kit]
  if (!kit) return false
  if (w.num(e, 'hp') <= 0) {
    if (b.action !== 'death') { b.action = 'death'; b.actionTick = now }
    delete b.pending
    return true
  }
  if (eng.busy(e)) { delete b.pending; b.action = 'hurt'; return true }
  const pos = w.posOf(e)!, home = e.ai?.home ?? pos
  b.phase = w.num(e, 'hp') <= w.num(e, 'maxHp') * kit.enrageAt ? 2 : 1
  const candidates = w.entitiesOnMap(active).filter((o) => o.place.on === 'tile' && eng.hostileTo(e, o) && w.num(o, 'hp') > 0 && !o.statuses?.down)
  candidates.sort((a, c) => { const x = w.posOf(a)!, y = w.posOf(c)!; return Math.abs(x.x-pos.x)+Math.abs(x.y-pos.y)-Math.abs(y.x-pos.x)-Math.abs(y.y-pos.y) })
  const target = candidates[0], at = w.posOf(target)
  const inLeash = Math.max(Math.abs(pos.x-home.x), Math.abs(pos.y-home.y)) <= kit.leash
  if (b.pending) {
    if (!at || !inLeash || Math.max(Math.abs(at.x-home.x), Math.abs(at.y-home.y)) > kit.leash + 3) { delete b.pending; b.action = 'idle'; b.nextAt = now + 10; return true }
    if (now >= b.pending.releaseAt) release(eng, e, kit.skills[b.pending.skill])
    return true
  }
  if (now < (b.nextAt ?? 0)) return true
  if (!target || !at || !inLeash || Math.max(Math.abs(at.x-pos.x), Math.abs(at.y-pos.y)) > kit.sight) {
    b.action = 'idle'
    if (e.ai) e.ai.state = 'idle'
    // Return to the encounter instead of camping the map exit or chasing into a town.
    if (Math.abs(pos.x-home.x)+Math.abs(pos.y-home.y)>1 && eng.ready(e.id)) {
      if (moveToward(eng, e, home)) b.action = 'walk'
      eng.setCooldown(e.id, combatDelay(w, e, w.num(e, 'speed', 8), 'move'))
    }
    return true
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
    return true
  }
  const windup = Math.max(8, Math.round(skill.windup * ((b.phase ?? 1) > 1 ? 0.8 : 1)))
  b.action = skill.action; b.actionTick = now; b.actionEnd = now + windup + skill.recovery
  b.pending = { skill: skillIndex, target: target.id, origin: { ...pos }, aim: { ...at }, tiles: bossPattern(skill, pos, at).filter(([x, y]) => w.inBounds(active, x, y)), releaseAt: now + windup }
  w.fx.push({ t: 'say', who: e.id, text: skill.name })
  return true
}
