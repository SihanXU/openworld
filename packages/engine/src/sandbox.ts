// Sandboxed replay: build a tiny self-contained world from a Scenario, run one event
// through a candidate rule library, and check expectations. Used by patch validation
// (replay of the triggering event + the patch's own tests) and by unit tests.

import { Engine, type Resolution } from './engine.ts'
import type { World } from './world.ts'
import { cellId, parseCellId, type CellSpace } from './cells.ts'
import type { Verb } from './types.ts'
import type { RuleLibrary } from './rules.ts'
import type { Entity, Expectation, GameEvent, MapData, Ontology, Ref, Scenario, Space, WorldState } from './types.ts'

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
  // holders before their contents, including nested bags
  const pending = [...sc.entities]
  while (pending.length) {
    const i = pending.findIndex((s) => !pending.some((h) => h.key === (s.heldBy ?? s.inside)))
    if (i < 0) throw new Error('cyclic scenario holding')
    const [s] = pending.splice(i, 1)
    const e: Entity = {
      id: s.key,
      type: s.type,
      tags: s.tags ? [...s.tags] : undefined,
      props: s.props ? { ...s.props } : undefined,
      place: s.heldBy
        ? { on: 'hand', holder: s.heldBy }
        : s.inside
          ? { on: 'inside', holder: s.inside }
          : { on: 'tile', map: SANDBOX_MAP, x: s.x, y: s.y, ...(s.z && { z: s.z }) },
      facing: 'down',
    }
    const r = w.onto.resolve(s.type)
    if (r.tags.includes('agent')) {
      e.props = { hp: 20, maxHp: 20, atk: 1, def: 0, ...r.props, ...e.props }
    }
    w.add(e)
    for (const st of s.statuses ?? []) w.setStatus({ e: e.id }, st, -1)
  }
  for (const [id, props] of Object.entries(sc.residents ?? {}))
    for (const [k, v] of Object.entries(props)) w.setProp(w.get(id)!, k, v)
  for (const c of sc.cells ?? []) {
    let top = c.space ? w.occupant(SANDBOX_MAP, c.x, c.y, c.space, c.z) : w.cellTop(SANDBOX_MAP, c.x, c.y, c.z)
    if (c.type) {
      if (top) w.transform(top, c.type)
      else top = w.add({ id: cellId(SANDBOX_MAP, c.x, c.y, (c.space ?? w.onto.resolve(c.type).occupies?.[0] ?? 'floor') as CellSpace, c.z), type: c.type, place: { on: 'tile', map: SANDBOX_MAP, x: c.x, y: c.y, ...(c.z && { z: c.z }) } })
    }
    if (!top) continue
    for (const [k, v] of Object.entries(c.props ?? {})) w.setProp(top, k, v)
    for (const st of c.statuses ?? []) w.setStatus({ e: top.id }, st, -1)
  }
}

/** A scenario's role: a thing by key, or a cell (`tile:x,y[,z][:space]`). */
function roleRef(w: World, key: string | undefined): Ref | undefined {
  if (!key) return undefined
  if (key.startsWith('tile:')) {
    const [at, space] = key.slice(5).split(':')
    const [x, y, z = 0] = at.split(',').map(Number)
    const top = space ? w.occupant(SANDBOX_MAP, x, y, space as Space, z) : w.cellTop(SANDBOX_MAP, x, y, z)
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
export function repeatYields(eng: Engine, ev: GameEvent, times = 12): number[] {
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

/** How often the repeat check replays an event before it gives its verdict (it ends sooner when the scene comes back to a state it was in). */
export const REPEAT_TIMES = 128
/** The most a host may give with no time between: a bigger store must come back over time (a stage, a status that runs out). */
export const YIELD_MOST = 64
/** Maximum complete chance assignments explored before refusing an unproven patch. */
export const REPEAT_ASSIGNMENTS = 64
export class RepeatLimitError extends Error {}
/** The events someone can make happen again at will (the rest wait on time or on a change). */
export const REPEATABLE = ['act', 'impulse', 'contact', 'bump', 'seen']

/** JSON with its keys in order: two equal states read the same however they were written. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}

/** The state of the event's participants (host and roles; what they hold aside): where the repeat check looks for a cycle. */
function participants(eng: Engine, ev: GameEvent): string {
  const w = eng.world
  const ids = [...new Set([ev.host, ...Object.values(ev.roles)].flatMap((r) => (r && 'e' in r ? [r.e] : [])))]
  return stable(
    ids.map((id) => {
      const e = w.get(id)
      if (!e) return [id, 'gone']
      const p = e.place
      const at = p.on === 'tile' ? [p.map, p.x, p.y, p.z ?? 0] : p.on === 'inside' || p.on === 'hand' ? [p.on, p.holder] : [p.on]
      return [id, e.type, e.props ?? {}, e.statuses ?? {}, [...(e.tags ?? [])].sort(), at]
    }),
  )
}

/**
 * The repeat check on one engine (world-model.md §8.4), exact rather than sampled: the event is
 * replayed with no time between, and the state of its participants is kept after each replay.
 * When a state comes back, the replays between are a cycle that can go round for ever: endless if
 * it made anything. When the host is used up, or the replays make nothing more, it ends. A store
 * that keeps giving without coming back (charges counting down) may give at most YIELD_MOST.
 * Returns why it is endless (the certificate), or nothing.
 */
export function yieldCycle(eng: Engine, ev: GameEvent): string | undefined {
  const seen = new Map<string, number>()
  const made: number[] = []
  let total = 0
  for (let i = 0; i <= REPEAT_TIMES; i++) {
    if (!eng.world.get(ev.host.e)) return undefined
    const k = participants(eng, ev)
    const back = seen.get(k)
    if (back !== undefined) {
      const round = made.slice(back).reduce((a, n) => a + n, 0)
      return round > 0 ? `after replay ${back}, every ${i - back} replay(s) come back to where they began and make ${round} thing(s) each time round` : undefined
    }
    seen.set(k, i)
    if (i === REPEAT_TIMES) break
    const n = repeatYields(eng, ev, 1)[0] ?? 0
    made.push(n)
    total += n
    if (total > YIELD_MOST) return `${total} things from ${i + 1} replays with no time between (at most ${YIELD_MOST}: a bigger store must come back over time)`
  }
  // (no state came back: it ends if it has stopped making things)
  return made.slice(-4).some((n) => n > 0) ? `still making things after ${REPEAT_TIMES} replays` : undefined
}

/**
 * For every assignment of the chance sites the run reaches (each chance condition, chance emit and
 * breakdown fraction its own outcome, kept across the replays; depth first, at most
 * REPEAT_ASSIGNMENTS), a fresh copy of the engine with that luck: the first finding `run` makes.
 */
export function underEveryChance<T>(eng: Engine, run: (e: Engine) => T | undefined): T | undefined {
  const pending = [new Map<object, boolean>()]
  const sites = new Map<object, object[]>()
  let assignments = 0
  while (pending.length) {
    if (assignments++ === REPEAT_ASSIGNMENTS) throw new RepeatLimitError(`repeat check: exceeded ${REPEAT_ASSIGNMENTS} chance assignments; safety could not be established`)
    const choices = pending.pop()!
    const e = new Engine(structuredClone(eng.world.state), eng.world.onto.data, eng.lib)
    e.seedRelations(eng.activeMap)
    e.world.luck = (site, part) => {
      let parts = sites.get(site)
      if (!parts) sites.set(site, (parts = []))
      const key = (parts[part] ??= {})
      if (!choices.has(key)) {
        pending.push(new Map(choices).set(key, false))
        choices.set(key, true)
      }
      return choices.get(key)!
    }
    const found = run(e)
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * Why an event is an endless yield (D23), or nothing: under any outcome of its chances, the repeat
 * check finds a cycle that makes things, or more than a host may give at once. A yield must cost
 * its host: change it (a status that gates the yield and runs out, a stage, durability) or use it up.
 */
export function whyEndless(eng: Engine, ev: GameEvent, prime = false): string | undefined {
  // only what someone can do again at will: acts and what they set off (impulses, contact, bumps,
  // being seen). The clock's events wait on time, a threshold on the host changing, broken content
  // is reported once.
  if (!REPEATABLE.some((k) => ev.kind === k || ev.kind.startsWith(k + '/'))) return undefined
  return underEveryChance(eng, (e) => {
    // the triggering replay uses the same assignment, before it can gate later yields
    if (prime) repeatYields(e, ev, 1)
    return yieldCycle(e, ev)
  })
}

export function endlessYield(eng: Engine, ev: GameEvent, prime = false): boolean {
  return whyEndless(eng, ev, prime) !== undefined
}

/** How long the termination check follows a chain: ticks, and events. */
export const CHAIN_TICKS = 50
export const CHAIN_EVENTS = 1500

/**
 * Every chain ends (design.md A7), proven on the scene: the event and all it sets off, through the
 * ticks it has to wait, until nothing of its chain is left. An event that sets off, by way of its
 * own outcomes, the same event on the same world again is a loop that never ends (the certificate
 * is the round, parent to child); a chain still going past the bounds is refused too. Returns why
 * it does not end, or nothing.
 */
export function chainLoop(eng: Engine, ev: GameEvent): string | undefined {
  const w = eng.world
  const ROOT = -1
  let next = 0
  let dispatched = 0
  /** each event's parent, its key when dispatched (what it is and the world it met), its label */
  const parent = new Map<number, number | undefined>()
  const keyOf = new Map<number, string>()
  const labelOf = new Map<number, string>()
  let loop: string | undefined
  eng.onQueue = (x, from) => {
    if (x.chain !== ROOT || x.seq !== undefined) return
    x.seq = ++next
    parent.set(x.seq, from?.seq)
  }
  eng.onDispatch = (x) => {
    if (x.chain !== ROOT || x.seq === undefined || loop) return
    dispatched++
    const key = `${x.kind}|${stable(x.host)}|${stable(x.params ?? {})}|${stable(w.state.entities)}`
    keyOf.set(x.seq, key)
    labelOf.set(x.seq, `${x.kind} on ${'e' in x.host ? (w.get(x.host.e)?.type ?? x.host.e) : '?'}`)
    const round: string[] = [labelOf.get(x.seq)!]
    for (let a = parent.get(x.seq); a !== undefined; a = parent.get(a)) {
      round.unshift(labelOf.get(a) ?? '?')
      if (keyOf.get(a) === key) {
        loop = `it sets off the same event on the same world again: ${round.join(' → ')}`
        return
      }
    }
  }
  try {
    eng.queue({ ...structuredClone(ev), depth: 0, chain: ROOT, seq: undefined })
    eng.flush()
    for (let t = 0; t < CHAIN_TICKS && !loop && dispatched <= CHAIN_EVENTS && eng.waiting(ROOT); t++) eng.tick()
  } finally {
    eng.onQueue = undefined
    eng.onDispatch = undefined
  }
  if (loop) return loop
  if (dispatched > CHAIN_EVENTS || eng.waiting(ROOT)) return `it sets off ${dispatched} events and is still going after ${CHAIN_TICKS} ticks`
  return undefined
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
    // a replay of an act the world already took: it reaches as far as it did
    if (a) eng.act(ev.kind.slice(4) as Verb, a, ev.roles.target!, { instrument: ev.roles.instrument ?? null, params: ev.params, reach: Infinity })
    else eng.queue(ev)
    for (let i = 0; i < (sc.ticks ?? 0); i++) eng.tick()
  } catch (err) {
    errors.push('runtime error: ' + (err as Error).message)
  }
  for (const f of eng.world.fx) if (f.t === 'log' && f.tone === 'warn') errors.push(String(f.text))
  return { resolution, engine: eng, errors, hpBefore }
}

export function checkExpectations(eng: Engine, exps: Expectation[], res?: Resolution): string[] {
  const w = eng.world
  const fails: string[] = []
  for (const x of exps) {
    if ('resolvedBy' in x) {
      if (res?.rule?.id !== x.resolvedBy) fails.push(`expected ${x.resolvedBy} to answer, ${res?.rule ? `${res.rule.id} did` : 'nothing did'}`)
      continue
    }
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
