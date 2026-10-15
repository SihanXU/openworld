// The creatures' own skills (docs/creatures.md). A kind's kit is data (`Ontology.kits`); taking a skill up, the cells it
// marks and the wind-up are the creature's behaviour (the `kit` goal, its memory kept here, beside the state: a save
// taken mid wind-up only loses the wind-up). When the wind-up runs out the skill is an act (design.md §5.13, A2): `use`
// with its own body on the aimed cell, carrying the skill and the locked cells; the creature's own rule answers it,
// saying what lands, with `unleash` — the move the skill makes, and a strike, a coat and a push to each foe on those
// cells, impulses they answer themselves. A creature stunned, frozen or held in its wind-up loses the skill: that is
// the counterplay, along with stepping off the marked cells.

import type { CreatureSkill, Engine, Entity, GameEvent, Id, Pos, EffectRunner } from '@openworld/engine'

/** The warning red, for a skill that names no colour of its own. */
export const TELEGRAPH_RED = 0xe0483c

/** A wind-up under way. */
export interface Pending {
  skill: CreatureSkill
  origin: Pos
  aim: Pos
  tiles: [number, number][]
  start: number
  releaseAt: number
}

/** The kits' memory: who is winding up what (behaviour memory, never the world's state). */
export class Kits {
  pending = new Map<Id, Pending>()
  constructor(private eng: Engine) {}

  /** The kit of a thing: the nearest its type or an ancestor names. */
  kitOf(e: Entity): CreatureSkill[] | undefined {
    const kits = this.eng.world.onto.data.kits
    if (!kits) return undefined
    for (let t = e.type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') if (kits[t]) return kits[t]
    return undefined
  }
}

export const kitsOf = (eng: Engine): Kits => eng.world.ext.get('kits') as Kits

/** The axis of a cell from another: one step along the greater axis (down when they are the same cell). */
export function axis(from: Pos, to: Pos): [number, number] {
  const dx = to.x - from.x, dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return [Math.sign(dx), 0]
  return [0, Math.sign(dy) || 1]
}

/** The cells a skill marks, wound up at `origin` against a foe at `aim`. */
export function kitPattern(skill: CreatureSkill, origin: Pos, aim: Pos): [number, number][] {
  const [vx, vy] = axis(origin, aim)
  const r = skill.radius
  const out: [number, number][] = []
  if (skill.shape === 'line') {
    for (let i = 1; i <= r; i++) out.push([origin.x + vx * i, origin.y + vy * i])
    return out
  }
  const c = skill.aim === 'self' ? origin : aim
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const forward = x * vx + y * vy, side = Math.abs(x * vy - y * vx)
      const hit =
        skill.shape === 'circle' ? x * x + y * y <= r * r + r
        : skill.shape === 'cross' ? x === 0 || y === 0
        : forward >= 1 && side <= Math.ceil(forward / 2)
      // a disk or a cross around itself spares its own cell
      if (hit && !(skill.aim === 'self' && skill.shape !== 'cone' && x === 0 && y === 0)) out.push([c.x + x, c.y + y])
    }
  return out
}

/** The burst on a marked cell, by the skill's element. */
const ELEMENT_FX: Record<string, string> = { fire: 'fire_burst', ice: 'frost', lightning: 'sparks', water: 'splash', earth: 'dust', wind: 'smoke' }

const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/**
 * The kit goal: a creature with a kit, ready and with a foe in sight, may take a skill up — it turns to the foe, stands
 * and marks the cells, and when the wind-up runs out the skill is its act. False when it takes nothing up (the threat
 * goal fights on as before).
 */
export function kitGoal(eng: Engine, e: Entity, active: string): boolean {
  const w = eng.world, kits = kitsOf(eng), now = w.state.tick
  const p = kits.pending.get(e.id)
  if (p) {
    // held, stunned or frozen in the wind-up, it loses the skill (it waits a moment before the next)
    if (eng.busy(e) || w.num(e, 'hp') <= 0 || e.place.on !== 'tile' || e.place.map !== active) {
      kits.pending.delete(e.id)
      eng.setCooldown('kit:' + e.id, 10)
      return false
    }
    if (now >= p.releaseAt) release(eng, e, p)
    return true
  }
  const kit = kits.kitOf(e)
  if (!kit || !e.ai || e.ai.behaviour === 'passive' || e.boss || e.place.on !== 'tile') return false
  if (!eng.ready(e.id) || !eng.ready('kit:' + e.id) || eng.busy(e)) return false
  // it looks once a second whether to take a skill up
  eng.setCooldown('kit:' + e.id, 10)
  const pos = w.posOf(e)!
  const home = e.ai.home
  if (home && Math.abs(home.x - pos.x) + Math.abs(home.y - pos.y) > (e.ai.leash ?? 8)) return false
  let target: Entity | undefined
  let best = Infinity
  for (const o of w.entitiesOnMap(active)) {
    if (o === e || o.place.on !== 'tile' || (o.place.z ?? 0) !== (e.place.z ?? 0) || !eng.hostileTo(e, o) || w.num(o, 'hp') <= 0 || o.statuses?.down) continue
    if ((o.combat?.veilUntil ?? 0) > now) continue
    const d = Math.abs(o.place.x - pos.x) + Math.abs(o.place.y - pos.y)
    if (d <= e.ai.sight && d < best) (target = o), (best = d)
  }
  const at = target && w.posOf(target)
  if (!target || !at) return false
  const hp = w.num(e, 'hp'), max = w.num(e, 'maxHp', 1)
  for (const skill of kit) {
    const d = dist(pos, at)
    if (d < skill.range[0] || d > skill.range[1]) continue
    if (skill.aligned && pos.x !== at.x && pos.y !== at.y) continue
    if (skill.below !== undefined && hp > max * skill.below) continue
    if (!eng.ready(`kit:${e.id}:${skill.id}`)) continue
    if (w.rand() >= (skill.chance ?? 1)) continue
    const [vx, vy] = axis(pos, at)
    e.facing = vx > 0 ? 'right' : vx < 0 ? 'left' : vy > 0 ? 'down' : 'up'
    ;(target.combat ??= {}).fightTick = now
    const tiles = kitPattern(skill, pos, at).filter(([x, y]) => w.inBounds(active, x, y))
    kits.pending.set(e.id, { skill, origin: { ...pos }, aim: { ...at }, tiles, start: now, releaseAt: now + skill.windup })
    eng.setCooldown(`kit:${e.id}:${skill.id}`, skill.windup + skill.cooldown)
    w.fx.push({ t: 'say', who: e.id, text: skill.name })
    return true
  }
  return false
}

/** The wind-up runs out: the skill is the creature's act, its own body on the aimed cell; then it rests a moment. */
function release(eng: Engine, e: Entity, p: Pending): void {
  const w = eng.world
  const kits = kitsOf(eng)
  kits.pending.delete(e.id)
  // a dash or a line goes as far as the marks; a leap or a disk lands where it was aimed
  const end = p.skill.shape === 'line' && p.tiles.length ? { map: p.aim.map, x: p.tiles[p.tiles.length - 1][0], y: p.tiles[p.tiles.length - 1][1] } : p.aim
  const aimed = w.cellTop(end.map, end.x, end.y, e.place.on === 'tile' ? e.place.z : undefined) ?? w.cellTop(end.map, end.x, end.y)
  const pos = w.posOf(e)
  if (aimed && pos) eng.act('use', e.id, { e: aimed.id }, { instrument: null, params: { kit: p.skill.id, ox: p.origin.x, oy: p.origin.y, ax: p.aim.x, ay: p.aim.y }, reach: dist(pos, end) + 1 })
  eng.setCooldown(e.id, Math.max(6, Math.round(p.skill.windup / 2)))
  eng.setCooldown('atk:' + e.id, 8)
}

/**
 * The `unleash` primitive (the creature's own outcome): the kit skill its act names lands. The host gets there as the
 * skill says (a leap onto the aimed cell, a dash to the first foe or the first thing in its way, a spring back after: `back`);
 * each foe on the marked cells — on a dash, the first it meets — is struck, coated and pushed as the rule says
 * (impulses it answers itself); the host mends for each foe it hit. A dash that meets only a wall stuns the dasher.
 */
export function unleash(fx: EffectRunner, eff: { power?: unknown; element?: unknown; edge?: string; coat?: string; push?: number; heal?: unknown }, ev: GameEvent): void {
  const eng = fx.eng, w = eng.world
  const e = fx.hostEntity(ev)
  const q = ev.params ?? {}
  const skill = e && kitsOf(eng).kitOf(e)?.find((s) => s.id === q.kit)
  const at = e && w.posOf(e)
  if (!e || !skill || !at || typeof q.ox !== 'number' || typeof q.oy !== 'number' || typeof q.ax !== 'number' || typeof q.ay !== 'number') return
  const origin: Pos = { map: at.map, x: q.ox, y: q.oy, z: at.z }
  const aim: Pos = { map: at.map, x: q.ax, y: q.ay, z: at.z }
  const foeAt = (x: number, y: number) =>
    w.entitiesAt(at.map, x, y, at.z ?? 0).filter((o) => o.id !== e.id && w.isAgent(o) && eng.hostileTo(e, o) && w.num(o, 'hp') > 0)
  let victims: Entity[] = []
  let tiles = kitPattern(skill, origin, aim).filter(([x, y]) => w.inBounds(at.map, x, y))
  const moveTo = (x: number, y: number) => {
    eng.touch({ e: e.id })
    w.place(e, { on: 'tile', map: at.map, x, y, ...(at.z && { z: at.z }) })
    eng.touch({ e: e.id })
  }
  if (skill.move === 'dash') {
    // along the line, cell by cell: the first foe stops it (it strikes from the cell before), so does what it cannot enter
    const [vx, vy] = axis(origin, aim)
    let x = at.x, y = at.y, hit = false
    const path: [number, number][] = []
    for (let i = 0; i < skill.radius; i++) {
      const nx = x + vx, ny = y + vy
      if (!w.inBounds(at.map, nx, ny)) break
      const foes = foeAt(nx, ny)
      if (foes.length) {
        victims = foes
        hit = true
        path.push([nx, ny])
        break
      }
      if (!w.fits(e, at.map, nx, ny)) break
      x = nx
      y = ny
      path.push([x, y])
    }
    tiles = path
    if (x !== at.x || y !== at.y) moveTo(x, y)
    w.fx.push({ t: 'vfx', fx: 'gust', map: at.map, x, y })
    // it ran headlong into a wall or a tree: it is stunned a moment (the counterplay: stand before something hard)
    if (!hit && path.length < skill.radius) eng.effects.apply({ op: 'addStatus', status: 'stunned', duration: 20 }, ev)
  } else {
    if (skill.move === 'leap') {
      // onto the aimed cell, else the free cell beside it nearest where it was
      const spots = [[aim.x, aim.y], [aim.x + 1, aim.y], [aim.x - 1, aim.y], [aim.x, aim.y + 1], [aim.x, aim.y - 1]] as [number, number][]
      spots.sort((a, b) => (a[0] === aim.x && a[1] === aim.y ? -1 : b[0] === aim.x && b[1] === aim.y ? 1 : Math.abs(a[0] - at.x) + Math.abs(a[1] - at.y) - Math.abs(b[0] - at.x) - Math.abs(b[1] - at.y)))
      const spot = spots.find(([x, y]) => w.inBounds(at.map, x, y) && w.fits(e, at.map, x, y))
      if (spot) moveTo(spot[0], spot[1])
    }
    const marked = new Set(tiles.map(([x, y]) => `${x},${y}`))
    victims = w.entitiesOnMap(at.map).filter((o) => o.id !== e.id && o.place.on === 'tile' && (o.place.z ?? 0) === (at.z ?? 0) && w.isAgent(o) && eng.hostileTo(e, o) && w.num(o, 'hp') > 0
      && w.occupiedCells(o).some(([x, y]) => marked.has(`${x},${y}`)))
  }
  const power = eff.power === undefined ? 0 : Math.max(0, Math.round(fx.amount(ev, eff.power as never)))
  const element = eff.element === undefined ? undefined : fx.param(ev, eff.element as never)
  const send = (kind: GameEvent['kind'], to: Entity, params: GameEvent['params']) =>
    eng.queue({ kind, host: { e: to.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params, cause: e.id, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
  for (const v of victims) {
    if (power > 0 || element) send('impulse/strike', v, { power, edge: eff.edge ?? 'blunt', ...(typeof element === 'string' && element && { element }) })
    if (eff.coat) send('impulse/coat', v, { substance: eff.coat })
    if (eff.push) {
      const vp = w.posOf(v)!
      const [vx, vy] = axis(origin, vp)
      for (let i = 0; i < eff.push; i++) send('impulse/push', v, { dir: vx > 0 ? 'right' : vx < 0 ? 'left' : vy > 0 ? 'down' : 'up' })
    }
  }
  if (eff.heal !== undefined && victims.length) eng.effects.apply({ op: 'heal', amount: Math.round(fx.amount(ev, eff.heal as never)) * victims.length }, ev)
  if (skill.back && victims.length) {
    // it springs back from the one it struck
    const [vx, vy] = axis(w.posOf(victims[0]) ?? aim, w.posOf(e)!)
    const now = w.posOf(e)!
    let bx = now.x, by = now.y
    for (let i = 0; i < skill.back; i++) {
      const nx = bx + vx, ny = by + vy
      if (!w.inBounds(at.map, nx, ny) || !w.fits(e, at.map, nx, ny)) break
      bx = nx
      by = ny
    }
    if (bx !== now.x || by !== now.y) moveTo(bx, by)
  }
  // what it looks like where it lands: a bolt along a line, a burst on each marked cell
  if (skill.shape === 'line' && !skill.move) w.fx.push({ t: 'vfx', fx: `bolt:${typeof element === 'string' && element ? element : 'none'}:${e.facing ?? 'down'}:${tiles.length}`, map: at.map, x: at.x, y: at.y, who: e.id })
  else {
    const burst = (typeof element === 'string' && ELEMENT_FX[element]) || 'dust'
    for (const [x, y] of tiles) w.fx.push({ t: 'vfx', fx: burst, map: at.map, x, y })
  }
}
