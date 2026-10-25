// The `unleash` primitive (docs/skills.md): a kit skill lands, in its caster's own outcome. The caster moves as the
// skill says (it writes only itself); each foe on the marked cells is struck, coated, pushed or pulled — impulses it
// answers itself; what the skill leaves behind (a briar, embers) is made on the cells nothing stands on, and acts by
// its own rules (contact, time). One hit per foe however many of its cells the skill covers.

import { dropLevels, type EffectRunner, type Entity, type GameEvent, type KitSkill, type Pos } from '@openworld/engine'
import { kitsOf } from './cast.ts'
import { axis, cellsOf } from './pattern.ts'

/** The burst on a marked cell, by the skill's element (a skill without an effect of its own). */
const ELEMENT_FX: Record<string, string> = { fire: 'fire_burst', ice: 'frost', lightning: 'sparks', water: 'splash', earth: 'dust', wind: 'smoke' }

const dirOf = (vx: number, vy: number) => (vx > 0 ? 'right' : vx < 0 ? 'left' : vy > 0 ? 'down' : 'up')

export interface UnleashArgs { power?: unknown; element?: unknown; edge?: string; coat?: string; push?: number; pull?: number; heal?: unknown; leave?: string; leaveStatus?: string }

export function unleash(fx: EffectRunner, eff: UnleashArgs, ev: GameEvent): void {
  const eng = fx.eng, w = eng.world
  const e = fx.hostEntity(ev)
  const q = ev.params ?? {}
  const skill = e && kitsOf(eng).skillOf(e, q.kit)
  const at = e && w.posOf(e)
  if (!e || !skill || !at || typeof q.ox !== 'number' || typeof q.oy !== 'number' || typeof q.ax !== 'number' || typeof q.ay !== 'number') return
  const origin: Pos = { map: at.map, x: q.ox, y: q.oy, z: at.z }
  const aim: Pos = { map: at.map, x: q.ax, y: q.ay, z: at.z }
  const alive = (o: Entity) => o.id !== e.id && !eng.isProtected(o) && o.place.on === 'tile' && (o.place.z ?? 0) === (at.z ?? 0) && w.isAgent(o) && eng.hostileTo(e, o) && w.num(o, 'hp') > 0
  const foesOn = (cells: [number, number][]) => {
    const marked = new Set(cells.map(([x, y]) => `${x},${y}`))
    return w.entitiesOnMap(at.map).filter((o) => alive(o) && w.occupiedCells(o).some(([x, y]) => marked.has(`${x},${y}`)))
  }
  let tiles = cellsOf(eng, skill, origin, aim)
  let victims: Entity[] = []
  const moveTo = (x: number, y: number) => {
    eng.touch({ e: e.id })
    w.place(e, { on: 'tile', map: at.map, x, y, ...(at.z && { z: at.z }) })
    eng.touch({ e: e.id })
  }
  /** A leap or a blink lands only where a body could get by walking or dropping: not up a cliff, not down more than a level. */
  const level = (x: number, y: number) => {
    const d = w.heightAt(at.map, x, y) - w.heightAt(at.map, at.x, at.y)
    return w.stanceOf(e) === 'air' || (d <= 1 && dropLevels(-d) <= 1)
  }
  if (skill.move === 'dash') {
    // along the line, cell by cell (as wide as the line): the first foe stops it (it strikes from the cell before), so
    // does what it cannot enter
    const [vx, vy] = axis(origin, aim)
    const half = Math.max(0, Math.floor(((skill.width ?? 1) - 1) / 2))
    const band = (cx: number, cy: number) => Array.from({ length: half * 2 + 1 }, (_, i): [number, number] => [cx + vy * (i - half), cy + vx * (i - half)])
    let x = at.x, y = at.y, hit = false, steps = 0
    const path: [number, number][] = []
    for (let i = 0; i < skill.radius; i++) {
      const nx = x + vx, ny = y + vy
      if (!w.inBounds(at.map, nx, ny)) break
      // the cells its body comes onto with the step (a large body's leading edge), as wide as the line
      const body = new Set(w.occupiedCells(e, x, y).map(([cx, cy]) => `${cx},${cy}`))
      const lead = w.occupiedCells(e, nx, ny).filter(([cx, cy]) => !body.has(`${cx},${cy}`))
      const cells = [...new Map(lead.flatMap(([cx, cy]) => band(cx, cy)).map((c): [string, [number, number]] => [`${c[0]},${c[1]}`, c])).values()]
        .filter(([bx, by]) => w.inBounds(at.map, bx, by))
      const foes = foesOn(cells)
      if (foes.length) {
        victims = foes
        hit = true
        path.push(...cells)
        break
      }
      // a dash keeps to the ground's rule: no climbing a cliff, no drop of more than a level (World.stepOver)
      if (!w.fits(e, at.map, nx, ny) || w.safeStep(e, at.map, x, y, nx, ny) !== true) break
      x = nx
      y = ny
      steps++
      path.push(...cells)
    }
    tiles = path
    if (x !== at.x || y !== at.y) moveTo(x, y)
    w.fx.push({ t: 'vfx', fx: 'gust', map: at.map, x, y })
    // it ran headlong into a wall or a rock: it is stunned a moment (the counterplay: stand before something hard)
    if (!hit && steps < skill.radius) eng.effects.apply({ op: 'addStatus', status: 'stunned', duration: 20 }, ev)
  } else {
    if (skill.move === 'leap') {
      // onto the aimed cell, else the free cell beside it nearest where it was
      const spots = [[aim.x, aim.y], [aim.x + 1, aim.y], [aim.x - 1, aim.y], [aim.x, aim.y + 1], [aim.x, aim.y - 1]] as [number, number][]
      spots.sort((a, b) => (a[0] === aim.x && a[1] === aim.y ? -1 : b[0] === aim.x && b[1] === aim.y ? 1 : Math.abs(a[0] - at.x) + Math.abs(a[1] - at.y) - Math.abs(b[0] - at.x) - Math.abs(b[1] - at.y)))
      const spot = spots.find(([x, y]) => w.inBounds(at.map, x, y) && w.fits(e, at.map, x, y) && level(x, y))
      if (spot) moveTo(spot[0], spot[1])
    }
    victims = foesOn(tiles)
  }
  const power = eff.power === undefined ? 0 : Math.max(0, Math.round(fx.amount(ev, eff.power as never)))
  const element = eff.element === undefined ? undefined : fx.param(ev, eff.element as never)
  const send = (kind: GameEvent['kind'], to: Entity, params: GameEvent['params']) =>
    eng.queue({ kind, host: { e: to.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params, cause: e.id, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
  for (const v of victims) {
    if (power > 0 || element) send('impulse/strike', v, { power, edge: eff.edge ?? 'blunt', ...(typeof element === 'string' && element && { element }) })
    if (eff.coat) send('impulse/coat', v, { substance: eff.coat })
    const vp = w.posOf(v)!
    // pushed away from where the skill was wound up, or pulled toward it
    if (eff.push) {
      const [vx, vy] = axis(origin, vp)
      for (let i = 0; i < eff.push; i++) send('impulse/push', v, { dir: dirOf(vx, vy) })
    }
    if (eff.pull) {
      const [vx, vy] = axis(vp, origin)
      for (let i = 0; i < Math.min(eff.pull, Math.max(0, dist(vp, origin) - 1)); i++) send('impulse/push', v, { dir: dirOf(vx, vy) })
    }
  }
  if (eff.heal !== undefined && victims.length) eng.effects.apply({ op: 'heal', amount: Math.round(fx.amount(ev, eff.heal as never)) * victims.length }, ev)
  if (skill.move === 'blink') {
    // beside where it aimed, on the first side its whole body fits
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = aim.x + dx, y = aim.y + dy
      if (w.inBounds(at.map, x, y) && w.fits(e, at.map, x, y) && level(x, y)) {
        moveTo(x, y)
        break
      }
    }
  }
  if (skill.back && victims.length) {
    // it springs back from the one it struck
    const [vx, vy] = axis(w.posOf(victims[0]) ?? aim, w.posOf(e)!)
    const now = w.posOf(e)!
    let bx = now.x, by = now.y
    for (let i = 0; i < skill.back; i++) {
      const nx = bx + vx, ny = by + vy
      if (!w.inBounds(at.map, nx, ny) || !w.fits(e, at.map, nx, ny) || w.safeStep(e, at.map, bx, by, nx, ny) !== true) break
      bx = nx
      by = ny
    }
    if (bx !== now.x || by !== now.y) moveTo(bx, by)
  }
  if (eff.leave) leave(fx, e, eff.leave, eff.leaveStatus, tiles, at)
  // what it looks like where it lands
  show(fx, e, skill, tiles, origin, aim, typeof element === 'string' ? element : undefined)
}

const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** What a skill leaves: a thing of the type on each marked cell no body stands on, nor its caster, nor one like it. */
function leave(fx: EffectRunner, e: Entity, type: string, status: string | undefined, tiles: [number, number][], at: Pos): void {
  const eng = fx.eng, w = eng.world
  if (!w.onto.data.types[type]) return
  const z = at.z ?? 0
  const mine = new Set(w.occupiedCells(e).map(([x, y]) => `${x},${y}`))
  const free = tiles.filter(([x, y]) => !mine.has(`${x},${y}`) && !w.blocked(at.map, x, y, undefined, z)
    && !w.entitiesAt(at.map, x, y, z).some((o) => w.isAgent(o) || o.type === type))
  fx.most(free.length, 'what a skill leaves')
  for (const [x, y] of free) {
    const made = w.create(type, { on: 'tile', map: at.map, x, y, ...(z && { z }) })
    if (status) eng.applyStatus({ e: made.id }, status)
    eng.touch({ e: made.id })
  }
}

/** The skill's effect: its own on every cell, one beam along its line, or a few markers; else a burst by its element. */
function show(fx: EffectRunner, e: Entity, skill: KitSkill, tiles: [number, number][], origin: Pos, aim: Pos, element: string | undefined): void {
  const w = fx.eng.world, map = origin.map
  const [vx, vy] = axis(origin, aim)
  if (skill.fx) {
    if (skill.fxPlacement === 'pattern') {
      for (const [x, y] of tiles) w.fx.push({ t: 'vfx', fx: skill.fx, map, x, y })
      return
    }
    if (skill.fxPlacement === 'beam' && skill.shape === 'line') {
      w.fx.push({ t: 'vfx', fx: skill.fx, map, x: origin.x + vx * (skill.radius + 1) / 2, y: origin.y + vy * (skill.radius + 1) / 2, angle: Math.atan2(vy, vx) * 180 / Math.PI, span: skill.radius })
      return
    }
    // a few markers: the centre, and the rim on the axes (a ring, the spots, a cross), or the middle of a line or a cone
    const center = skill.aim === 'self' ? origin : aim
    const centers: Pos[] = [center]
    if (skill.shape === 'ring' || skill.shape === 'spots' || skill.shape === 'cross') {
      centers.push(...tiles.filter(([x, y]) => (x === center.x || y === center.y) && Math.max(Math.abs(x - center.x), Math.abs(y - center.y)) === skill.radius).map(([x, y]) => ({ map, x, y })))
    } else if (skill.shape === 'cone' || skill.shape === 'line') {
      centers.push({ map, x: origin.x + vx * Math.ceil(skill.radius / 2), y: origin.y + vy * Math.ceil(skill.radius / 2) })
    }
    for (const c of centers) w.fx.push({ t: 'vfx', fx: skill.fx, ...c })
    return
  }
  // a bolt along a line, a burst on each marked cell
  if (skill.shape === 'line' && !skill.move) w.fx.push({ t: 'vfx', fx: `bolt:${element || 'none'}:${e.facing ?? 'down'}:${tiles.length}`, map, x: origin.x, y: origin.y, who: e.id })
  else {
    const burst = (element && ELEMENT_FX[element]) || 'dust'
    for (const [x, y] of tiles) w.fx.push({ t: 'vfx', fx: burst, map, x, y })
  }
}
