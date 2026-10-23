// The stage hands: what a shot uses to put people where the script wants them and to make things happen on time.
import type { Dir, EntitySnap, FxEvent, Frame } from '@openworld/engine'
import type { Cut } from './film.ts'

const TICK = 0.1

/** Something the script moves (made in the world, held still there as a body waiting on the AI is, so no behaviour moves it). */
export function puppet(c: Cut, type: string, at: [number, number], extra: Record<string, unknown> = {}): string {
  const w = c.eng.world
  let id = ''
  c.eng.author(() => {
    const e = w.create(type, { on: 'tile', map: c.shot.map, x: at[0], y: at[1] }, extra as never)
    e.frozenBy = 'stage'
    id = e.id
  })
  return id
}

/** Someone already in the world, held still for the script. */
export function hold(c: Cut, id: string): void {
  const e = c.eng.world.get(id)
  if (e) e.frozenBy = 'stage'
}

/** Gone from the world (out of the way of a shot). */
export function remove(c: Cut, id: string): void {
  const e = c.eng.world.get(id)
  if (e) c.eng.author(() => c.eng.world.destroy(e))
}

/** Put somewhere at once (the world's own placing: the scene sees a step and walks it). */
export function place(c: Cut, id: string, x: number, y: number, facing?: Dir): void {
  const w = c.eng.world
  const e = w.get(id)
  if (!e) return
  const p = w.posOf(e)
  if (!p || p.x !== x || p.y !== y) c.eng.author(() => w.place(e, { on: 'tile', map: c.shot.map, x, y }))
  if (facing) e.facing = facing
}

/** Where a walk along cells is at `t`: a cell every `per` seconds from `t0`, facing the way it goes. */
export function along(path: [number, number][], t0: number, per: number, t: number): { x: number; y: number; facing: Dir; moving: boolean } {
  const i = Math.max(0, Math.min(path.length - 1, Math.floor((t - t0) / per)))
  const [x, y] = path[i]
  const [nx, ny] = path[Math.min(path.length - 1, i + 1)]
  const [px, py] = path[Math.max(0, i - 1)]
  const dx = i < path.length - 1 ? nx - x : x - px, dy = i < path.length - 1 ? ny - y : y - py
  const facing: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up'
  return { x, y, facing, moving: t >= t0 && i < path.length - 1 }
}

/** A straight walk between cells, as a path. */
export function line(a: [number, number], b: [number, number]): [number, number][] {
  const out: [number, number][] = [a]
  let [x, y] = a
  while (x !== b[0]) (x += Math.sign(b[0] - x), out.push([x, y]))
  while (y !== b[1]) (y += Math.sign(b[1] - y), out.push([x, y]))
  return out
}

/** Does a moment at `sec` fall in this tick (the snapshot being made now)? */
export const now = (c: Cut, sec: number) => sec >= c.t - 1e-6 && sec < c.t + TICK - 1e-6
/** Once, the first tick at or after `sec` (for what is done to the world). */
export function once(c: Cut, key: string, sec: number): boolean {
  if (c.t + 1e-6 < sec || c.memo[`once:${key}`]) return false
  c.memo[`once:${key}`] = true
  return true
}

export const snap = (f: Frame, id: string): EntitySnap | undefined => f.entities.find((e) => e.id === id)
/** A body as the script wants it drawn: where, facing, what in hand, working something out or not. */
export function pose(f: Frame, id: string, o: Partial<Pick<EntitySnap, 'x' | 'y' | 'facing' | 'held' | 'frozen' | 'statuses' | 'overlays'>>): void {
  const e = snap(f, id)
  if (e) Object.assign(e, o)
}
export function vfx(f: Frame, fx: string, x: number, y: number, extra: Partial<FxEvent> = {}): void {
  f.fx.push({ t: 'vfx', fx, map: f.map ?? '', x, y, ...extra } as FxEvent)
}
/** The hour and the sky the shot wants (the scene reads both from the frame). */
export function sky(f: Frame, hour: number, weather?: 'sun' | 'cloud' | 'rain' | 'storm' | 'fog'): void {
  f.hour = hour
  if (f.calendar) {
    f.calendar.hour = Math.floor(hour)
    f.calendar.minute = Math.floor((hour % 1) * 60)
    if (weather) f.calendar.weather = weather
  }
}
