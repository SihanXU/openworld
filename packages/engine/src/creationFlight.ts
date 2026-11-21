// A bounded, saveable flight queue. Only loaded creation code supplies its impact handler. The queue is the workshop's
// record beside the things; the thrown thing itself goes aloft in its throw's outcome and comes down in its landing's.
import type { Engine } from './engine.ts'
import type { Pos, WorldState } from './types.ts'

export interface CreationFlight {
  itemId: string
  typeId: string
  actorId: string
  packageId: string
  revision: number
  useId: string
  from: Pos
  to: Pos
  targetId: string
  startTick: number
  dueTick: number
}
type FlightState = WorldState & { creationFlights?: CreationFlight[] }
const installed = new WeakSet<Engine>()
const copy = <T>(v: T): T => structuredClone(v)
export const creationThrowTicks = (distance: number): number => distance <= 0 ? 1 : Math.ceil(distance / 2) + 1
export const workshopFlights = (eng: Engine): CreationFlight[] => copy((eng.world.state as FlightState).creationFlights ?? [])
export const canLaunchWorkshopFlight = (eng: Engine): boolean => workshopFlights(eng).length < 32

function flightFx(eng: Engine, flight: CreationFlight, resume = false): void {
  const progress = resume ? Math.max(0, Math.min(1, (eng.world.state.tick - flight.startTick) / Math.max(1, flight.dueTick - flight.startTick))) : 0
  const x = flight.from.x + (flight.to.x - flight.from.x) * progress, y = flight.from.y + (flight.to.y - flight.from.y) * progress
  eng.world.fx.push({ t: 'vfx', fx: `creation-throw:${flight.typeId}`, map: flight.from.map, x, y, angle: Math.atan2(flight.to.y - y, flight.to.x - x), span: Math.hypot(flight.to.x - x, flight.to.y - y), who: flight.actorId, instance: flight.itemId, durationMs: Math.max(1, flight.dueTick - eng.world.state.tick) * 100, untilTick: flight.dueTick })
}
export function launchWorkshopFlight(eng: Engine, input: Omit<CreationFlight, 'startTick' | 'dueTick'>, throwIt: () => boolean): boolean {
  const w = eng.world, item = w.get(input.itemId), actor = w.get(input.actorId)
  const distance = Math.abs(input.to.x - input.from.x) + Math.abs(input.to.y - input.from.y)
  if (!canLaunchWorkshopFlight(eng) || !item || !actor || item.type !== input.typeId || input.from.map !== input.to.map || (input.from.z ?? 0) !== (input.to.z ?? 0) || !Number.isFinite(distance) || distance > 6 || !((item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === actor.id)) return false
  if (!throwIt() || w.get(item.id)?.place.on !== 'none') return false
  const flight: CreationFlight = { ...copy(input), startTick: w.state.tick, dueTick: w.state.tick + creationThrowTicks(distance) }
  const s = w.state as FlightState
  s.creationFlights = [...(s.creationFlights ?? []), flight]
  if (actor.id === w.player.id) eng.controls.face(input.to)
  eng.controls.sync()
  flightFx(eng, flight)
  return true
}

/** One hook per engine, including after a save is loaded or a library is synced. */
export function installCreationFlightHooks(eng: Engine, impact: (flight: CreationFlight) => boolean): void {
  if (installed.has(eng)) return
  installed.add(eng)
  for (const flight of workshopFlights(eng)) if (flight.dueTick > eng.world.state.tick) flightFx(eng, flight, true)
  eng.hooks.tick.push({ phase: 'status', run: () => {
    const state = eng.world.state as FlightState
    const ready = (state.creationFlights ?? []).filter(f => f.dueTick <= state.tick)
    if (!ready.length) return
    // Remove before effects: a reentrant tick/load cannot land the same flight again.
    state.creationFlights = (state.creationFlights ?? []).filter(f => f.dueTick > state.tick)
    for (const flight of ready) {
      eng.world.fx.push({ t: 'vfx', fx: 'creation-land', map: flight.to.map, x: flight.to.x, y: flight.to.y, instance: flight.itemId })
      const item = eng.world.get(flight.itemId)
      if (!item || item.type !== flight.typeId || item.place.on !== 'none') continue
      let hit = false
      try { hit = impact(copy(flight)) } catch { /* Invalid or unavailable content lands without its effect. */ }
      if (!hit) {
        eng.world.fx.push({ t: 'vfx', fx: 'splash', map: flight.to.map, x: flight.to.x, y: flight.to.y })
        eng.world.fx.push({ t: 'log', text: { en: 'The throw lands without hitting its original target.', zh: '投掷物落下，没有击中原来的目标。' } })
      }
      if (eng.world.get(flight.itemId)) eng.run([{ op: 'destroy' }], eng.actEvent('use', flight.actorId, { e: flight.targetId }, { e: flight.itemId }, { creationFlightPhase: 'land' }), 'creation/flight/land')
    }
    eng.controls.sync()
  } })
}
