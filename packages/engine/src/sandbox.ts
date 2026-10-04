// Sandboxed replay: build a tiny self-contained world from a Scenario, run one event
// through a candidate rule library, and check expectations. Used by patch validation
// (replay of the triggering event + the patch's own tests) and by unit tests.

import { Engine, type Resolution } from './engine.ts'
import type { World } from './world.ts'
import { parseCellId } from './cells.ts'
import type { Verb } from './types.ts'
import type { RuleLibrary } from './rules.ts'
import type { Entity, Expectation, GameEvent, MapData, Ontology, Ref, Scenario, WorldState } from './types.ts'

export const SANDBOX_MAP = 'sandbox'

export interface ReplayResult {
  resolution: Resolution
  engine: Engine
  errors: string[]
  /** Every actor's hp before the event (to tell harm from a scenario's own wounds). */
  hpBefore: Record<string, number>
}

export function buildSandbox(sc: Scenario, ontology: Ontology, lib: RuleLibrary): Engine {
  const rows = sc.terrain ?? Array.from({ length: 5 }, () => Array(5).fill('grass'))
  const height = rows.length
  const width = rows[0].length
  const map: MapData = {
    id: SANDBOX_MAP,
    name: 'sandbox',
    kind: 'sandbox',
    width,
    height,
    terrain: rows.flat(),
    portals: [],
  }
  const hasActor = sc.entities.some((e) => e.key === 'actor')
  // the player: the scenario says who (a world event's actor is not the player), else the actor
  const player = sc.player ?? (hasActor ? 'actor' : '__player')
  const state: WorldState = {
    tick: 0,
    seed: 1,
    rng: 12345,
    player,
    entities: {},
    maps: { [SANDBOX_MAP]: map },
    loadedMaps: [SANDBOX_MAP],
    counter: 0,
    spawn: { map: SANDBOX_MAP, x: 0, y: 0 },
  }
  const eng = new Engine(state, structuredClone(ontology), lib)
  eng.ensureResidents()
  eng.author(() => fill(eng, sc, player))
  eng.seedRelations(SANDBOX_MAP)
  return eng
}

function fill(eng: Engine, sc: Scenario, player: string): void {
  const w = eng.world
  if (!sc.entities.some((e) => e.key === player)) w.add({ id: player, type: 'actor/person/player', place: { on: 'none' } })
  // two passes: holders first, then things inside/held
  const ordered = [...sc.entities].sort((a, b) => Number(!!(a.heldBy || a.inside)) - Number(!!(b.heldBy || b.inside)))
  for (const s of ordered) {
    const e: Entity = {
      id: s.key,
      type: s.type,
      tags: s.tags ? [...s.tags] : undefined,
      props: s.props ? { ...s.props } : undefined,
      place: s.heldBy
        ? { on: 'hand', holder: s.heldBy }
        : s.inside
          ? { on: 'inside', holder: s.inside }
          : { on: 'tile', map: SANDBOX_MAP, x: s.x, y: s.y },
      facing: 'down',
    }
    const r = w.onto.resolve(s.type)
    if (r.tags.includes('agent')) {
      e.props = { hp: 20, maxHp: 20, atk: 1, def: 0, ...r.props, ...e.props }
    }
    w.add(e)
    for (const st of s.statuses ?? []) w.setStatus({ e: e.id }, st, -1)
  }
  for (const c of sc.cells ?? []) {
    const top = w.cellTop(SANDBOX_MAP, c.x, c.y)
    if (!top) continue
    for (const [k, v] of Object.entries(c.props ?? {})) w.setProp(top, k, v)
    for (const st of c.statuses ?? []) w.setStatus({ e: top.id }, st, -1)
  }
}

/** A scenario's role: a thing by key, or a cell (`tile:x,y`) — what makes it up on top. */
function roleRef(w: World, key: string | undefined): Ref | undefined {
  if (!key) return undefined
  if (key.startsWith('tile:')) {
    const [x, y] = key.slice(5).split(',').map(Number)
    const top = w.cellTop(SANDBOX_MAP, x, y)
    return top && { e: top.id }
  }
  return { e: key }
}

/** The scenario's event: an act (its host the instrument, or the actor) unless it names another kind and host. */
export function scenarioEvent(sc: Scenario, eng: Engine): GameEvent {
  const e = sc.event
  const kind = e.kind ?? 'act/use'
  const ref = (k?: string) => roleRef(eng.world, k)
  if (kind.startsWith('act/') && e.actor) {
    const ev = eng.actEvent(kind.slice(4) as Verb, e.actor, ref(e.target) ?? { e: e.actor }, ref(e.instrument), e.params ?? {})
    if (e.host) ev.host = ref(e.host)!
    return ev
  }
  const roles: GameEvent['roles'] = {}
  for (const r of ['actor', 'target', 'instrument', 'other', 'item', 'source'] as const) if (e[r]) roles[r] = ref(e[r])
  const host = ref(e.host) ?? roles.instrument ?? roles.actor ?? roles.target ?? { e: 'world' }
  return { kind, host, roles, params: e.params ?? {}, cause: e.actor, origin: e.actor && e.actor === sc.player ? 'player' : 'world' }
}

/**
 * What one event makes, replayed again and again with no time between (world-model.md §8.4):
 * the things each replay made (cell things changing are not things made), while its host stands.
 */
export function repeatYields(eng: Engine, ev: GameEvent, times = REPEAT_TIMES): number[] {
  const w = eng.world
  const out: number[] = []
  for (let i = 0; i < times && w.get(ev.host.e); i++) {
    const before = new Set(Object.keys(w.state.entities))
    eng.queue({ ...structuredClone(ev), depth: 0 })
    eng.flush()
    let made = 0
    for (const id of Object.keys(w.state.entities)) if (!before.has(id) && !parseCellId(id) && w.get(id)) made++
    out.push(made)
  }
  return out
}

/** How often the repeat check replays an event, and how many of the last replays must make nothing. */
export const REPEAT_TIMES = 12
export const REPEAT_TAIL = 4
/** The events someone can make happen again at will (the rest wait on time or on a change). */
export const REPEATABLE = ['act', 'impulse', 'contact', 'bump', 'seen']

/**
 * An endless yield (D23): replayed with no time between, on a host that is not used up, the event
 * still makes things at the end — something from nothing, as often as one likes. A yield must cost
 * its host: change it (a status that gates the yield and runs out, a stage, durability) or use it up.
 */
export function endlessYield(eng: Engine, ev: GameEvent): boolean {
  // only what someone can do again at will: acts and what they set off (impulses, contact, bumps,
  // being seen). The clock's events wait on time, a threshold on the host changing, broken content
  // is reported once.
  if (!REPEATABLE.some((k) => ev.kind === k || ev.kind.startsWith(k + '/'))) return false
  const ys = repeatYields(eng, ev)
  return ys.length === REPEAT_TIMES && !!eng.world.get(ev.host.e) && ys.slice(-REPEAT_TAIL).some((n) => n > 0)
}

/** Replay a scenario's event once (and optional ticks); report effect errors. */
export function replay(sc: Scenario, ontology: Ontology, lib: RuleLibrary): ReplayResult {
  const errors: string[] = []
  let eng: Engine
  try {
    eng = buildSandbox(sc, ontology, lib)
  } catch (err) {
    throw new Error('scenario could not be built: ' + (err as Error).message)
  }
  const ev = scenarioEvent(sc, eng)
  const hpBefore: Record<string, number> = {}
  for (const e of Object.values(eng.world.state.entities)) if (eng.world.prop(e, 'maxHp') !== undefined) hpBefore[e.id] = eng.world.num(e, 'hp')
  const resolution = eng.resolveEvent(ev)
  try {
    const a = ev.kind.startsWith('act/') && ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : undefined
    if (a) eng.act(ev.kind.slice(4) as Verb, a, ev.roles.target!, { instrument: ev.roles.instrument ?? null, params: ev.params })
    else eng.queue(ev)
    for (let i = 0; i < (sc.ticks ?? 0); i++) eng.tick()
  } catch (err) {
    errors.push('runtime error: ' + (err as Error).message)
  }
  for (const f of eng.world.fx) if (f.t === 'log' && f.tone === 'warn') errors.push(String(f.text))
  return { resolution, engine: eng, errors, hpBefore }
}

export function checkExpectations(eng: Engine, exps: Expectation[]): string[] {
  const w = eng.world
  const fails: string[] = []
  for (const x of exps) {
    if ('spawned' in x) {
      if (!Object.values(w.state.entities).some((e) => e.type === x.spawned || e.type.startsWith(x.spawned + '/')))
        fails.push(`expected a ${x.spawned} to exist`)
      continue
    }
    if ('tile' in x) {
      const [tx, ty] = x.tile
      if ('terrain' in x && w.terrainAt(SANDBOX_MAP, tx, ty) !== x.terrain)
        fails.push(`tile ${tx},${ty}: terrain ${w.terrainAt(SANDBOX_MAP, tx, ty)} ≠ ${x.terrain}`)
      if ('hasStatus' in x && !w.entitiesAt(SANDBOX_MAP, tx, ty).some((c) => w.isTerrain(c) && w.hasStatus({ e: c.id }, x.hasStatus)))
        fails.push(`tile ${tx},${ty}: lacks status ${x.hasStatus}`)
      continue
    }
    const e = w.get(x.key)
    if ('destroyed' in x) {
      if (e) fails.push(`${x.key}: expected destroyed`)
      continue
    }
    if (!e) {
      fails.push(`${x.key}: missing`)
      continue
    }
    if ('exists' in x) continue
    if ('hasStatus' in x && !w.hasStatus({ e: e.id }, x.hasStatus)) fails.push(`${x.key}: lacks status ${x.hasStatus}`)
    if ('lacksStatus' in x && w.hasStatus({ e: e.id }, x.lacksStatus)) fails.push(`${x.key}: still has ${x.lacksStatus}`)
    if ('isType' in x && e.type !== x.isType && !e.type.startsWith(x.isType + '/')) fails.push(`${x.key}: type ${e.type} ≠ ${x.isType}`)
    if ('propGt' in x && !(w.num(e, x.propGt[0]) > x.propGt[1])) fails.push(`${x.key}: ${x.propGt[0]}=${w.num(e, x.propGt[0])} not > ${x.propGt[1]}`)
    if ('propLt' in x && !(w.num(e, x.propLt[0]) < x.propLt[1])) fails.push(`${x.key}: ${x.propLt[0]}=${w.num(e, x.propLt[0])} not < ${x.propLt[1]}`)
  }
  return fails
}
