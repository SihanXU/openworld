// The engine (design.md §5.4–5.12): every happening is an event, and every event has one
// outcome, resolved the same way — the most specific rule of its host, walked to a leaf. Where
// the outcome is undefined, the Mod port is asked; with no one to ask, the leaf's default runs.
// The engine also keeps time (timers, periods), the relations between things (contact and
// containment, diffed after every outcome), sight, and the active, dormant and resident parts of
// the world. Pure, deterministic, no AI.

import { TICKS_PER_HOUR, TICKS_PER_MINUTE } from './calendar.ts'
import { EffectRunner } from './effects.ts'
import { Controls, joinSins } from './controls.ts'
import { Story } from './story.ts'
import { deriveRecipes } from './recipes.ts'
import { Behaviour, KERNEL_GOALS } from './behaviour.ts'
import { plainCombat, weaponOf } from './blows.ts'
import { Companions } from './companion.ts'
import { Quests } from './quests.ts'
import { NpcSim, scheduleAt } from './npc.ts'
import { Wellbeing } from './wellbeing.ts'
import { scheduleFor } from './people.ts'
import { OntologyIndex, isA } from './ontology.ts'
import { appearFromForage } from './appear.ts'
import { Chunks } from './sparse.ts'
import { RuleLibrary, evalCond, isDo, isPatch, matchSelector, rolesOf, type Resolution } from './rules.ts'
import { DEFAULT_QUALITY, categoryOf, tierOfLevel, type AiQuality } from './quality.ts'
import { modulesOf, noHooks, noSociety, type Combat, type Society, type EffectImpl, type EngineHooks, type EngineModule, type Goal, type EffectReading } from './module.ts'
import type { Dir, Effect, Entity, EventKind, GameEvent, Id, Invariant, MapData, Ontology, Portal, Pos, PropValue, Recipe, Ref, Sin, SkillDef, Text, Tier, Verb, WorldState } from './types.ts'
import { DIRS, FIRE_RADIUS, OPPOSITE } from './types.ts'
import { NO_EXPIRY, REVERSE, World, refKey, regionId, tileKey, type View, type Writer } from './world.ts'
import { seedOf } from './rng.ts'

export type { Resolution } from './rules.ts'

/** Receives undefined outcomes. Implemented by the Mod port (mod.ts). */
export interface UndefinedSink {
  /**
   * An outcome is undefined (design.md §5.11). True when it is held while someone works it out;
   * false when the leaf's default should run now (no one to ask, already asked, given up).
   */
  raise(ev: GameEvent, res: Resolution): boolean
  /**
   * A learned answer that only gave words is about to run (design.md §5.17): true when it is held while the
   * question is asked again (the one who acted kept trying), false to run it now.
   */
  again?(ev: GameEvent, res: Resolution): boolean
  tick(): void
}

export interface MapChunk {
  map: MapData
  entities: Entity[]
}

const STATUS_TICK_EVERY = 5
const STAY_EVERY = 5
/** Events handled in one flush; the rest wait for the next tick. */
const EVENT_BUDGET = 600
/** The clock events a map catches up on entering at most (engine.catchUp): past them, what is left is summed up. */
const CATCH_UP_BUDGET = 4 * EVENT_BUDGET
/** What is shown or said where it happens: made while a map catches up, it was not seen. */
const UNSEEN = new Set<string>(['vfx', 'say', 'emote', 'damage', 'strike'])
/** How deep a chain runs within one tick before the rest is deferred to the next (design.md §5.10). */
const MAX_DEPTH = 12
/** Events one chain may still run once it has had to wait for a later tick (design.md A7: every chain ends). */
const CHAIN_BUDGET = 2000
/** Events waiting for the next tick at most: past it, what comes is dropped. */
const LATER_MAX = 4 * EVENT_BUDGET
/** How many times a learned rule may fail at runtime before it is set aside. */
const FAULTS = 3
const INVARIANT_EVERY = 30
/** What only says and shows (a refusal, a look): an outcome of only these changes nothing. */
const SAID = new Set<string>(['log', 'say', 'vfx', 'emote'])
/** The resident hosts (design.md §5.5). */
export const STORY = 'story'

/** Where on a site's block one stood going in: the tile, and the point (0..1 across the block) it stands for. */
export interface Entry {
  rel: [number, number]
  tile: [number, number]
  size: number
  /** Going in from beside a one-cell site, from the place one stood on: the map it stands for (one arrives by the way between them). */
  from?: string
}
export const WORLD_HOST = 'world'

/** What an act is, taken before it is resolved (the seers' judgement reads it, docs/npc-sandbox.md §2.2). */
interface Before {
  at?: Pos
  thing?: Id
  whose?: string
  theirs?: boolean
  from?: 'person' | 'container' | 'ground'
  person?: boolean
  hp?: number
  worn?: boolean
  value?: number
}

const OPAQUE_TERRAIN = ['wall', 'tree', 'rock', 'roof']
/** The primitives that harm their host (a preview's `harms`). */
const HARMS = new Set<string>(['hurt', 'destroy', 'breakdown'])

export class Engine {
  world: World
  lib: RuleLibrary
  /**
   * The world's one writer (design.md §5.13, A2), lent only to outcomes (`run`), the clock (a
   * status running out), loading and the input's posture. Game code never takes it; tests, world
   * building and the dev console write as the author (`author`).
   */
  private readonly write: Writer
  effects: EffectRunner
  npcs: NpcSim
  /** What is wrong for an actor and what would put it right, read from the rules (wellbeing.ts). */
  wellbeing: Wellbeing
  /** The maps' things kept as what differs from their files, and the maps put away (sparse.ts, docs/continent.md §9). */
  chunks: Chunks
  /** Everyone's goals (behaviour.ts). */
  behaviour: Behaviour
  /** Told when a learned rule is set aside at run time (the client reports it to the service). */
  onFault?: (rule: import('./types.ts').Rule, reason: string) => void
  /** Whose things are, who notices an act, fear and the watch (module.ts): nobody's and none, or a society module's. */
  society: Society = noSociety()
  /** The story's script: its steps, scenes and beats (story.ts). */
  story: Story
  /** The player's inputs, slots and magnet (design.md §5.2–5.3). */
  controls: Controls
  /** Content the world must keep playable (game-design: the Ford's invariants). */
  invariants: Invariant[] = []
  /** Fact keys (prefixes) only the story's rules change (design.md §5.11). */
  protectedFacts: string[] = []
  /** Recipes an act of crafting may name. */
  recipes = new Map<string, Recipe>()
  /** Skills and professions an act of learning may name (the skill tree, the trainers). */
  skills = new Map<string, SkillDef>()
  /** How blows, reach and pace are worked out (module.ts): the kernel's plain combat, or a combat module's. */
  combat: Combat
  undefinedSink?: UndefinedSink
  /**
   * The AI setting (quality.ts): which tier each kind of event is asked at and takes learned answers
   * from. The player's, like a graphics setting: not the world's state, never saved with it.
   */
  quality: AiQuality = { ...DEFAULT_QUALITY }
  /** One tier for every event, over the setting: a sandbox replays a scene at the tier it was asked at. */
  tier?: Tier
  /** Companions and the tutorial's beats (companion.ts), quests (quests.ts). */
  companions: Companions
  quests: Quests
  /** Portal graph of every map (loaded or not): map -> outgoing portals. */
  graph: Record<string, { to: string; x: number; y: number; tx: number; ty: number }[]> = {}
  /** Every map's name and size, from the world's index (a quest's marker on a map not loaded yet, docs/quests.md). */
  maps: Record<string, { name: Text; width: number; height: number; regions?: Record<string, [number, number, number, number]> }> = {}
  /** Set when the player walked into a portal whose map isn't loaded yet. */
  pendingTransition?: { map: string; x: number; y: number; entry?: Entry }
  /** Ticks to run at once at the end of this tick: a long step (the overworld) passing (world-model.md §6.11). */
  private fastForward = 0
  /**
   * At most this many ticks of a long step pass in one tick (the worker sets it: the screen keeps up,
   * the clock is seen to run and one lies asleep all the while); unset, they pass at once.
   */
  fastForwardChunk?: number
  /** The modules installed (module.ts): the ontology's, in its order. */
  modules: EngineModule[] = []
  /** What the kernel asks its modules at its own steps (module.ts). */
  hooks: EngineHooks = noHooks()
  /** The modules' primitives, by op. */
  effectImpls = new Map<string, EffectImpl>()
  /** The modules' primitives only the story and the world may use. */
  residentOnly = new Set<string>()
  /** Every goal by id: the kernel's and the modules' (a goal several give is tried in their order). */
  goalImpls = new Map<string, Goal[]>()
  /** What the modules' primitives do to their host, for one's wellbeing (module.ts EffectReading), by op. */
  effectReads = new Map<string, EffectReading>()
  /** Resolution trace of the last dispatched events (for tests and the dev panel). */
  trace: { ev: GameEvent; rule?: string; defined: boolean }[] = []
  /** How many entries the trace has ever taken (it keeps only the last 300): what came after a mark is the last `traced - mark`. */
  traced = 0

  private q: GameEvent[] = []
  /** Events deferred to the next tick: too deep in their chain, over the budget, or for a held host. */
  private later: GameEvent[] = []
  /** Who each mover has been pushing into, since when (a swap once it has lasted): by the mover's id. */
  private bumps = new Map<Id, { id: Id; since: number; last: number }>()
  /**
   * Who came out of a map by its edge onto its own place, and the point they left from (a fraction of the map): in
   * again from there, they come in where they left. Forgotten at their next step (and with a save).
   */
  private leftBy = new Map<Id, { map: string; rel: [number, number] }>()
  private cooldowns = new Map<Id, number>()
  private flushing = false
  /** What outcomes touched since the last settle: ref key → ref. */
  private touched = new Map<string, Ref>()
  /** Who keeps a relation to a thing (the relations read the other way), for the state's relations as they are now. */
  private relBy?: { of: Record<string, string[]>; by: Map<Id, Set<string>> }

  constructor(state: WorldState, ontology: Ontology, lib: RuleLibrary) {
    // this game's own definitions: what it learns is its own, the world's are left for the next game (another save)
    const onto = new OntologyIndex({ ...ontology, types: { ...ontology.types }, statuses: { ...ontology.statuses } })
    for (const t of lib.types) onto.addType(t)
    for (const s of lib.statuses) onto.addStatus(s)
    this.world = new World(state, onto)
    this.write = this.world.grant()
    this.world.author = (f) => this.write(f)
    this.lib = lib
    this.effects = new EffectRunner(this)
    this.npcs = new NpcSim(this)
    this.wellbeing = new Wellbeing(this)
    this.chunks = new Chunks(this)
    this.behaviour = new Behaviour(this)
    this.story = new Story(this)
    this.companions = new Companions(this)
    this.quests = new Quests(this)
    this.world.watch = {
      fact: (key) => this.quests.news({ kind: 'fact', key }),
      gone: (id) => {
        if (this.quests.aliased(id)) this.quests.news({ kind: 'gone', target: id })
      },
      tags: (id) => this.quests.tagsOf(id),
    }
    this.controls = new Controls(this, this.write)
    this.combat = plainCombat(this)
    // what can be made: every type with a station and a makeup (world-model.md §6.4)
    for (const r of deriveRecipes(onto)) this.recipes.set(r.id, r)
    for (const [id, g] of Object.entries(KERNEL_GOALS)) this.goalImpls.set(id, [g])
    // the game's modules: what each adds, then its own state and the slots it fills
    this.modules = modulesOf(ontology.modules)
    for (const m of this.modules) {
      for (const [op, impl] of Object.entries(m.effects ?? {})) this.effectImpls.set(op, impl)
      for (const op of m.spec?.residentOnly ?? []) this.residentOnly.add(op)
      for (const [key, impl] of Object.entries(m.conds ?? {})) this.world.condImpls.push([key, impl])
      for (const [id, g] of Object.entries(m.goals ?? {})) this.goalImpls.set(id, [...(this.goalImpls.get(id) ?? []), g])
      for (const [op, read] of Object.entries(m.reads ?? {})) this.effectReads.set(op, read)
    }
    for (const m of this.modules) m.install?.(this)
  }

  /**
   * The author's hand: tests setting a scene, a world being built or loaded, the dev console.
   * Never game code — the engine's and the content's source may not call it (a test checks).
   */
  author<T>(f: () => T): T {
    return this.write(f)
  }

  loadInvariants(defs: Invariant[] = [], protectedFacts: string[] = []): void {
    this.invariants = defs
    this.protectedFacts = protectedFacts
  }

  get activeMap(): string {
    return this.world.posOf(this.world.player)?.map ?? this.world.state.spawn.map
  }

  /** The world, the story and the watches exist (design.md §5.5, docs/npc-sandbox.md §2.7): made on a new game, and for older saves. */
  ensureResidents(): void {
    const w = this.world
    this.write(() => {
      if (!w.get(WORLD_HOST)) w.add({ id: WORLD_HOST, type: 'resident/world', place: { on: 'resident' } })
      if (!w.get(STORY)) w.add({ id: STORY, type: 'resident/story', place: { on: 'resident' } })
      // the residents the modules keep (the watches)
      for (const make of this.hooks.residents) for (const e of make()) if (!w.get(e.id)) w.add(e)
    })
  }


  /**
   * A map's data has come (a new map, or one loaded again with a save). Its authored areas are
   * things (world-model.md §5.4), made the first time and kept after (they may carry props and
   * host rules); an older save's changed cells become the cells' things. On a map already in play,
   * what stands in them is in them from now, as its start, not an event.
   */
  mapArrived(map: string): void {
    const w = this.world
    // an older chunk named what appears by itself `forage`
    const data = w.map(map)
    if (data?.forage && !data.appear) (data.appear = appearFromForage(data)), delete data.forage
    const named = Object.entries(w.map(map)?.regions ?? {}).filter(([name]) => !w.get(regionId(map, name)))
    // an older save's changed cells (game.ts upgrade), kept in the state until the map's data comes
    const s = w.state
    const old = s.legacyTiles?.[map] ?? []
    if (s.legacyTiles?.[map]) delete s.legacyTiles[map]
    this.write(() => {
      for (const [name, r] of named) w.add({ id: regionId(map, name), type: 'region', place: { on: 'area', map, rects: [r] }, ...(w.map(map)?.regionProps?.[name] && { props: structuredClone(w.map(map)!.regionProps![name]) }) })
      // what is in a stage in the map's data starts its clock (a stump grows back)
      w.startStages(map)
      for (const t of old) {
        if (t.terrain) w.setTerrain(map, t.x, t.y, t.terrain)
        const top = w.cellTop(map, t.x, t.y)
        if (top) for (const [st, until] of Object.entries(t.statuses ?? {})) w.setStatus({ e: top.id }, st, until, t.statusBy?.[st])
      }
    })
    const again = !!s.reseed?.includes(map)
    if (again) s.reseed = s.reseed!.filter((m) => m !== map)
    if ((named.length || old.length || again) && w.state.loadedMaps.includes(map)) this.diffMap(map, true)
  }

  // ---------------------------------------------------------------- events

  queue(ev: GameEvent): void {
    // what an outcome sets off (an emit, a threshold, a contact, a status) is its chain's, a step deeper
    const now = this.outcomes[this.outcomes.length - 1]
    if (now) {
      ev.chain ??= now.ev.chain
      ev.depth ??= (now.ev.depth ?? 0) + 1
      ev.by ??= now.rule
    }
    this.onQueue?.(ev, now?.ev)
    if ((ev.depth ?? 0) > MAX_DEPTH) {
      this.defer({ ...ev, depth: 0 })
      return
    }
    this.q.push(ev)
    if (!this.flushing) this.flush()
  }

  /** Make an event only if its host could do anything with it (no-change roots make none). */
  offer(ev: GameEvent): void {
    // (a thing no rule could answer by its type is passed over before its view is made: the overworld's places)
    const w = this.world
    const e = w.get(ev.host.e)
    if (e && !this.lib.mayAnswer(ev.kind, e.type, w.isStatic(e) ? w.onto.resolve(e.type).tags : undefined)) return
    if (this.lib.answers(ev.kind, this.world.view(ev.host))) this.queue(ev)
  }

  flush(): void {
    if (this.flushing) return
    this.flushing = true
    try {
      this.drain()
    } finally {
      this.flushing = false
    }
  }

  private drain(): void {
    let n = 0
    while (this.q.length) {
      if (n++ >= EVENT_BUDGET) {
        for (const ev of this.q.splice(0)) this.defer(ev)
        break
      }
      this.dispatch(this.q.shift()!)
    }
  }

  /**
   * An event for the next tick. A chain that has to wait is counted from then on, and ends at its
   * budget; the queue itself is bounded. What is dropped is charged to the rule that made it.
   */
  private defer(ev: GameEvent): void {
    if (this.later.length >= LATER_MAX) {
      this.fault(ev.by, 'more events waiting than the world holds', true)
      return
    }
    if (ev.chain !== undefined && !this.chains.has(ev.chain)) this.chains.set(ev.chain, { n: 0, since: this.world.state.tick })
    this.later.push(ev)
  }

  /** Whether an event's chain may still run (one that never waited runs within its flush's budget). */
  private within(ev: GameEvent): boolean {
    ev.chain ??= this.nextChain++
    const c = this.chains.get(ev.chain)
    if (!c || ++c.n <= CHAIN_BUDGET) return true
    if (c.n === CHAIN_BUDGET + 1) {
      this.fault(ev.by, `a chain of events that does not end (${CHAIN_BUDGET} after it had to wait)`, true)
      this.world.fx.push({ t: 'log', text: `a chain of events was stopped after ${CHAIN_BUDGET} more (${ev.kind}, made by ${ev.by ?? 'the world'})`, tone: 'dev' })
    }
    return false
  }

  /**
   * A learned rule failed at runtime (an effect refused, a chain that would not end): counted, and
   * past FAULTS, or at once when it ran away, set aside for good: its hole is open again (the
   * leaf's default). Base rules are the author's: the tests catch theirs. True for a learned rule.
   */
  fault(ruleId: string | undefined, reason: string, severe = false): boolean {
    const rule = ruleId ? this.lib.rules.get(ruleId) : undefined
    if (!rule || !isPatch(rule)) return false
    const n = (this.faults.get(rule.id) ?? 0) + 1
    this.faults.set(rule.id, n)
    const set = (this.world.state.quarantine ??= {})
    if ((severe || n >= FAULTS) && !set[rule.id]) {
      set[rule.id] = { tick: this.world.state.tick, reason }
      // it leaves the library: its leaves are open again, for the validator's replays as for the game; its
      // tree keeps its place, so the answers that grew below it keep answering (design.md §5.16)
      this.lib.setAside(rule.id)
      this.world.fx.push({ t: 'log', text: `learned rule ${rule.id} is set aside: ${reason}`, tone: 'dev' })
      this.onFault?.(rule, reason)
    }
    return true
  }

  /** Resolve one event and run its outcome (design.md §5.6). */
  dispatch(ev: GameEvent): Resolution {
    const w = this.world
    ev.tick = w.state.tick
    if (!this.within(ev)) return { defined: false }
    this.onDispatch?.(ev)
    const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
    // a thing put away with its map (docs/continent.md §9) receives it when the map comes again, as a dormant one does
    const away = !host && 'e' in ev.host ? this.chunks.awayAt(ev.host.e) : undefined
    if (away !== undefined) {
      ;((w.state.dormant ??= {})[away] ??= { since: w.state.tick, inbox: [] }).inbox.push(ev)
      return { defined: false }
    }
    if ('e' in ev.host && (!host || host.place.on === 'none')) return { defined: false }
    if ((ev.kind === 'impulse/strike' || ev.kind === 'impulse/element') && host && this.isProtected(host)) {
      if (this.trace.length > 300) this.trace.shift()
      this.trace.push({ ev, defined: true })
      this.traced++
      return { defined: true }
    }
    // a thing on a dormant map receives it when the player comes (design.md §5.12); people and residents at once
    const at = w.posOf(host)
    // (an act is made by one who acts now — a companion following its leader off a map — and resolves at once)
    if (at && at.map !== this.activeMap && !ev.kind.startsWith('act/') && !(host && (host.npc || w.isPlaceless(host)))) {
      const d = ((w.state.dormant ??= {})[at.map] ??= { since: w.state.tick, inbox: [] })
      d.inbox.push(ev)
      return { defined: false }
    }
    // a thing held while its own outcome is worked out takes the event after
    if (host?.frozenBy && !ev.kind.startsWith('act/')) {
      this.defer(ev)
      return { defined: false }
    }
    const res = this.resolveEvent(ev)
    // a learned rule whose condition could not be read is set aside at once (its case is open: the hole's default)
    if (res.fault) this.fault(res.fault.rule, res.fault.reason, true)
    if (this.trace.length > 300) this.trace.shift()
    this.trace.push({ ev, rule: res.rule?.id, defined: res.defined })
    this.traced++
    if (res.defined && res.leaf && isDo(res.leaf)) {
      if (!this.undefinedSink?.again?.(ev, res)) this.run(res.leaf.do, ev, res.rule!.id)
    } else if (res.hole) {
      this.holes++
      const held = this.undefinedSink?.raise(ev, res) ?? false
      if (!held) this.run(res.hole.default, ev, res.hole.rule.id)
    }
    return res
  }

  /** The outcome an event would have now, without running it (randomness restored). */
  resolveEvent(ev: GameEvent): Resolution {
    const w = this.world
    const saved = w.state.rng
    const res = this.lib.resolve(ev, rolesOf(ev, w), w, () => this.tierOf(ev))
    if (!this.running) w.state.rng = saved
    return res
  }

  /** The tier an event is answered at: the sandbox's, else the setting's for its kind of work. */
  tierOf(ev: GameEvent): Tier {
    return this.tier ?? tierOfLevel(this.quality[categoryOf(this.world, ev)])
  }

  /** True while an outcome is being dispatched (its randomness is real, not a dry run's). */
  private get running(): boolean {
    return this.flushing || this.dispatching > 0
  }
  private dispatching = 0
  /** The outcomes running now, innermost last: what they set off joins their chain, one step deeper. */
  private outcomes: { ev: GameEvent; rule: string }[] = []
  /** Chains that had to wait for a later tick, and how many events they have run since. */
  private chains = new Map<number, { n: number; since: number }>()
  private nextChain = 1
  /** Runtime failures of learned rules this session (the set-aside ones are kept in the state). */
  private faults = new Map<string, number>()
  /** Watch every event as it is queued (with the event whose outcome made it) and dispatched: the termination check's; unset in play. */
  onQueue?: (ev: GameEvent, parent: GameEvent | undefined) => void
  onDispatch?: (ev: GameEvent) => void

  /** Does any event of this chain still wait (for this flush, or for a later tick)? */
  waiting(chain: number): boolean {
    return this.q.some((e) => e.chain === chain) || this.later.some((e) => e.chain === chain)
  }
  /** Undefined outcomes reached so far (an act's seers learn whether anything in its chain was). */
  private holes = 0

  /** Run an outcome's effects, then settle the relations they changed (what they set off joins its chain). */
  run(effects: Effect[], ev: GameEvent, ruleId: string): void {
    if (!effects.length) return
    this.outcomes.push({ ev, rule: ruleId })
    try {
      this.write(() => this.effects.run(effects, ev, ruleId), ev.host)
      this.settle()
    } finally {
      this.outcomes.pop()
    }
    // what the outcome made news of, the quests hear (docs/quests.md §2.3)
    if (!this.outcomes.length) this.quests.flush()
  }

  /** Is the outcome running now a learned rule's (the guards hold those to more)? */
  get learning(): boolean {
    const now = this.outcomes[this.outcomes.length - 1]
    const rule = now && this.lib.rules.get(now.rule)
    return !!rule && isPatch(rule)
  }

  /**
   * The story's script (its scenes and beats, design.md §5.5): its effects run as the story's own
   * outcome — it writes only its facts and topics, and sends the rest as impulses to `roles`.
   */
  script(effects: Effect[], roles: GameEvent['roles'], label: string): void {
    if (!this.world.get(STORY)) this.ensureResidents()
    this.run(effects, { kind: 'time/period', host: { e: STORY }, roles, params: {}, origin: 'world' }, label)
  }

  /**
   * The one at the keys, fallen, rises again (the death screen's choice, after Minecraft): the
   * story tells them to get up, and they do themselves (their own rule) — where they fell, or
   * (`home`) at the place they made theirs (the bed they last slept in, the waypoint they last
   * woke; else where the world began), leaving what they carried where they fell.
   */
  respawn(home: boolean): void {
    const w = this.world
    const p = w.player
    if (!w.hasStatus({ e: p.id }, 'down')) return
    const effects: Effect[] = [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'respawn', drop: home } }]
    if (home) {
      const at = this.homeOf(p)
      effects.push({ op: 'emit', impulse: 'push', to: 'target', params: { map: at.map, x: at.x, y: at.y } })
    }
    this.script(effects, { target: { e: p.id } }, 'respawn')
  }

  /** Where one rises again: beside the thing one made one's home (its `home` prop), else where the world began. */
  homeOf(e: Entity): Pos {
    const w = this.world
    const home = w.get(typeof e.props?.home === 'string' ? e.props.home : undefined)
    const at = home && w.posOf(home)
    if (!at) return w.state.spawn
    return (w.walkable(at.map, at.x, at.y, e.id) ? at : this.nearestFree(at)) ?? at
  }

  /**
   * Re-run an event whose outcome was undefined and is now defined (a late patch). An act answered so is seen
   * again, as it comes to be (docs/npc-sandbox.md §2.12: what it does to a person is a deed like any other).
   */
  replay(ev: GameEvent): void {
    if (!ev.kind.startsWith('act/') || ev.kind === 'act/move') return this.queue({ ...ev, depth: 0 })
    const before = this.before(ev)
    // as `act` runs it: the act's own outcome, and what it sets off answered as it goes (an impulse sent
    // before the host is used up meets it still there) — not queued behind the whole outcome, or a patch
    // would do one thing the first time (replayed here) and another every time after
    this.dispatching++
    try {
      this.dispatch({ ...ev, depth: 0 })
    } finally {
      this.dispatching--
    }
    this.flush()
    this.see(ev, true, before)
    this.flush()
  }

  /**
   * A dry run of the chain an event starts (the HUD's labels, design.md §5.2): its outcome, and the
   * outcomes of the impulses it would send to single roles, a few levels deep. `unknown` when any
   * of them is undefined.
   */
  /**
   * A dry run of an event's chain: its rules, whether it reaches an undefined outcome, and whether it
   * changes anything (beyond what is said and shown: a refusal, a look, changes nothing).
   */
  preview(
    ev: GameEvent,
    depth = 3,
  ): { defined: boolean; unknown: boolean; changes: boolean; rules: string[]; labels: { text: Text; rule: string }[]; confirm?: Text; hole?: { ev: GameEvent; res: Resolution }; harms: Id[] } {
    const res = this.resolveEvent(ev)
    const rules = res.rule ? [res.rule.id] : []
    const confirm = res.defined ? ((res.leaf && isDo(res.leaf) && res.leaf.confirm) || res.rule?.confirm) : undefined
    if (!res.defined || !res.leaf || !isDo(res.leaf)) return { defined: false, unknown: true, changes: false, rules, labels: [], confirm, hole: res.hole ? { ev, res } : undefined, harms: [] }
    // what this outcome says it does: its leaf's label, else its rule's
    const own = res.leaf.label ?? res.rule?.label
    const labels: { text: Text; rule: string }[] = own && res.rule ? [{ text: own, rule: res.rule.id }] : []
    // the hosts the chain hurts, breaks or makes away with (what is harmed, as those who see it judge it)
    const harms: Id[] = res.leaf.do.some((e) => HARMS.has(e.op)) ? [ev.host.e] : []
    let unknown = false
    // what an emit changes is what its receiver does (followed below), unless it cannot be followed (to the story, an area)
    const followed = (e: Effect) => e.op === 'emit' && typeof e.to === 'string' && e.to !== 'story' && e.to !== 'world' && !e.to.startsWith('tileOf:')
    let changes = res.leaf.do.some((e) => !SAID.has(e.op) && !followed(e))
    let hole: { ev: GameEvent; res: Resolution } | undefined
    if (depth > 0)
      for (const eff of res.leaf.do) {
        if (eff.op !== 'emit' || typeof eff.to !== 'string' || eff.to === 'story' || eff.to === 'world' || eff.to.startsWith('tileOf:')) continue
        const to = eff.to === 'host' ? ev.host : ev.roles[eff.to as Exclude<import('./types.ts').RoleName, 'host'>]
        if (!to) continue
        const params: Record<string, PropValue> = {}
        for (const [k, v] of Object.entries(eff.params ?? {})) {
          const x = this.effects.param(ev, v)
          if (x !== undefined) params[k] = x
        }
        const child: GameEvent = {
          kind: `impulse/${eff.impulse}`,
          host: to,
          roles: { source: ev.host, actor: ev.roles.actor, instrument: ev.roles.instrument, item: eff.item ? (eff.item === 'host' ? ev.host : ev.roles[eff.item]) : undefined, other: eff.other ? (eff.other === 'host' ? ev.host : ev.roles[eff.other]) : undefined },
          params,
          cause: ev.cause,
        }
        const p = this.preview(child, depth - 1)
        rules.push(...p.rules)
        labels.push(...p.labels)
        harms.push(...p.harms)
        if (p.unknown) unknown = true
        if (p.changes) changes = true
        hole ??= p.hole
      }
    return { defined: true, unknown, changes, rules, labels, confirm, hole, harms }
  }

  // ---------------------------------------------------------------- acts (design.md §5.7)

  /** Whose a thing is (the society slot): its own `owner` prop ('' = nobody's), what holds it, the region it lies in. */
  ownerOf(e: Entity): string | undefined {
    return this.society.ownerOf(e)
  }

  /** The act event an actor's verb makes: hosted by the instrument, or by the actor's own hands. */
  actEvent(verb: Verb, actorId: Id, target: Ref, instrument?: Ref, params: Record<string, PropValue> = {}): GameEvent {
    const w = this.world
    const actor = w.get(actorId)
    const inst = instrument && 'e' in instrument ? w.get(instrument.e) : undefined
    const p: Record<string, PropValue> = { verb, ...params }
    if (verb === 'use' && actor) {
      p.power ??= w.stat(actor, 'atk', 1) + (inst ? w.num(inst, 'power', 0) : 0)
      const element = (inst && w.prop(inst, 'element')) || w.prop(actor, 'element')
      if (typeof element === 'string' && p.element === undefined) p.element = element
    }
    return {
      kind: `act/${verb}` as EventKind,
      host: instrument ?? { e: actorId },
      roles: { actor: { e: actorId }, target, instrument },
      params: p,
      cause: actorId,
      origin: actorId === w.state.player ? 'player' : 'world',
    }
  }

  /**
   * An actor acts: the event is resolved now, and then everyone who can see it sees it. Returns
   * the act's resolution (its outcome may be undefined, or its chain may reach one).
   */
  act(verb: Verb, actorId: Id, target: Ref, opts: { instrument?: Ref | null; params?: Record<string, PropValue>; reach?: number } = {}): Resolution {
    const w = this.world
    const actor = w.get(actorId)
    // the one at the keys does something: a companion waiting to lead the way waits again
    if (actorId === w.state.player) this.companions.stir()
    if (!actor || this.busy(actor)) return { defined: false }
    // the held item, unless the caller names another (an item from the bag) or none (talking while holding a tool)
    const instrument = opts.instrument === undefined ? (actor.held ? { e: actor.held } : undefined) : (opts.instrument ?? undefined)
    // nothing is done out of reach, by anyone (a system that pulls from farther says how far: the magnet, a skill)
    if (!this.inReach(verb, actor, target, instrument, opts.reach)) return { defined: false }
    const frozen = [target, instrument].some((r) => r && 'e' in r && w.get(r.e)?.frozenBy)
    if (frozen) {
      w.fx.push({ t: 'say', who: actorId, text: '…' })
      return { defined: false }
    }
    if (verb === 'take') {
      const thing = w.get(target.e)
      const holder = thing && this.protectedHolder(thing)
      if (holder && holder.id !== actor.id) {
        this.refuseProtection(actor.id)
        return { defined: true }
      }
    }
    const ev = this.actEvent(verb, actorId, target, instrument, opts.params)
    // what the act is, before it is resolved (a thing taken from her chest is hers until it is taken)
    const before = this.before(ev)
    const holes = this.holes
    this.dispatching++
    let res: Resolution
    try {
      res = this.dispatch(ev)
    } finally {
      this.dispatching--
    }
    this.flush()
    // what the seers see: the act, and whether the world had an answer for all it set going
    if (verb !== 'move' && verb !== 'craft' && verb !== 'learn') this.see(ev, res.defined && this.holes === holes, before)
    this.flush()
    return res
  }

  /**
   * How far an act reaches (the inputs, world-model.md §5.2): a hand as far as what it handles lets
   * it (`handsRange`: 0, standing on it — a bed; 1, beside it), a thing used as far as it carries
   * (`range`: a bow's, a wand's; the bare body's own, a dragon's breath), taking and putting as far
   * as the world's `carry`; the rest (moving, making, learning) is the actor's own. Undefined: no limit.
   */
  reachOf(verb: Verb, actor: Entity, target: Entity | undefined, instrument: Entity | undefined): number | undefined {
    const w = this.world
    const p = w.onto.data.params
    const reach = p?.reach ?? 1
    if (verb === 'hands') return target ? w.num(target, 'handsRange', reach) : reach
    if (verb === 'take' || verb === 'put') return p?.carry ?? 1
    if (verb === 'use') return (instrument ? w.num(instrument, 'range', reach) : w.num(actor, 'range', reach)) + this.combat.reach(actor, instrument)
    return undefined
  }

  /** Is the target within the act's reach of the actor (oneself and what one carries always are)? */
  inReach(verb: Verb, actor: Entity, target: Ref, instrument: Ref | undefined, reach?: number): boolean {
    const w = this.world
    const t = w.get(target.e)
    if (!t || t.id === actor.id) return true
    const r = reach ?? this.reachOf(verb, actor, t, instrument && w.get(instrument.e))
    if (r === undefined) return true
    const at = w.posOf(actor)
    // one reaches one's own storey, and over it its ceiling — the floor of the storey above, laid or
    // open — to set a floor in (G, or the left click that builds) or take one out (docs/building.md R1)
    const there = w.posOf(t)
    const ceiling = !!at && !!there && (verb === 'put' || verb === 'take' || verb === 'use') && (there.z ?? 0) === (at.z ?? 0) + 1 && (w.isAir(t) || w.spacesOf(t).includes('floor'))
    const d = at && w.distance(ceiling ? { ...at, z: there!.z } : at, t)
    return d !== undefined && d <= r
  }

  /** The verbs of the earlier model (take / put / interact), for tests and tools: interact is use, or hands when nothing is held. */
  interact(verb: 'take' | 'put' | 'interact', actorId: Id, target: Ref, opts: { instrument?: Ref | null; params?: Record<string, PropValue> } = {}): Resolution {
    if (verb !== 'interact') return this.act(verb, actorId, target, opts)
    const actor = this.world.get(actorId)
    const instrument = opts.instrument === undefined ? (actor?.held ? { e: actor.held } : undefined) : (opts.instrument ?? undefined)
    return this.act(instrument ? 'use' : 'hands', actorId, target, { ...opts, instrument: instrument ?? null })
  }

  // ---------------------------------------------------------------- sight (design.md §5.7: seen)

  /** Is the person asleep (their day says so)? */
  asleep(e: Entity): boolean {
    return !!e.npc && scheduleAt(scheduleFor(this, e), this.world.hour())?.activity === 'sleep'
  }

  /** How far an actor sees now: its own `sight`, halved after dark away from a fire's light. */
  sightOf(e: Entity, at: Pos): number {
    const w = this.world
    const s = w.num(e, 'sight', 0)
    if (!s || !w.isNight() || w.hasTag(e, 'nightsight')) return s
    const lit = this.fires(at.map).some((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) <= FIRE_RADIUS + 1)
    return lit ? s : Math.ceil(s / 2)
  }

  /** Nothing opaque stands between two tiles (walls, trees, rock; tall or opaque things). */
  lineOfSight(map: string, a: Pos, b: Pos): boolean {
    const w = this.world
    let x = a.x
    let y = a.y
    const dx = Math.abs(b.x - a.x)
    const dy = -Math.abs(b.y - a.y)
    const sx = a.x < b.x ? 1 : -1
    const sy = a.y < b.y ? 1 : -1
    let err = dx + dy
    for (let guard = 0; guard < 64; guard++) {
      if (x === b.x && y === b.y) return true
      const e2 = 2 * err
      if (e2 >= dy) (err += dy), (x += sx)
      if (e2 <= dx) (err += dx), (y += sy)
      if (x === b.x && y === b.y) return true
      const tags = w.onto.terrain(w.terrainAt(map, x, y))?.tags ?? []
      if (tags.some((t) => OPAQUE_TERRAIN.includes(t))) return false
      // ground higher than both ends stands in the way (world-model.md §5.5: height blocks sight)
      if (w.heightAt(map, x, y) > Math.max(w.heightAt(map, a.x, a.y), w.heightAt(map, b.x, b.y)) + 1) return false
      // an opaque thing hides what is behind it while it stands solid (a door shut; open, it is a gap)
      if (w.entitiesAt(map, x, y).some((o) => (w.hasTag(o, 'opaque') && w.onto.resolve(o.type).solid) || w.hasTag(o, 'tall'))) return false
    }
    return true
  }

  /**
   * What an act is, as those who see it will judge it (docs/npc-sandbox.md §2.2), taken before it is resolved:
   * whose the thing acted on was, where it was (on someone, in a container, on the ground), whether it was a
   * person, its health, its worth, and whether it was the doer's own.
   */
  private before(ev: GameEvent): Before {
    const w = this.world
    const doer = ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    const thing = ev.roles.target ? w.get(ev.roles.target.e) : undefined
    if (!doer || !thing || thing.id === doer.id) return { at: w.posOf(doer) }
    const whose = this.society.ownerOf(thing)
    const holder = thing.place.on === 'inside' || thing.place.on === 'hand' ? w.get(thing.place.holder) : undefined
    const person = w.isAgent(thing) && w.hasTag(thing, 'person')
    return {
      at: w.posOf(doer),
      thing: thing.id,
      ...(whose && { whose, theirs: this.society.relation(whose, doer) === 'another' }),
      from: holder ? (w.isAgent(holder) ? 'person' : 'container') : thing.place.on === 'tile' ? 'ground' : undefined,
      person,
      hp: w.prop(thing, 'maxHp') !== undefined ? w.num(thing, 'hp', w.num(thing, 'maxHp', 1)) : undefined,
      worn: !!holder && w.worn(holder).some((x) => x.id === thing.id),
      value: person ? undefined : this.society.value(thing),
    }
  }

  /**
   * Everyone who can see an act sees it, once it is resolved: a `seen` event each (if it could matter to them),
   * with what it was (docs/npc-sandbox.md §2.2) — whose the thing was to them, the victim as they stand to it,
   * the harm done, a death. One sneaking is seen only by some (social.ts `notices`), a hand in a pocket the same.
   */
  private see(ev: GameEvent, defined: boolean, b: Before): void {
    const w = this.world
    const doer = ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    const at = b.at ?? w.posOf(doer)
    if (!doer || !at) return
    // what the act did: the harm, a death
    const t = b.thing ? w.get(b.thing) : undefined
    const gone = !t || t.place.on === 'none' || (b.person && !w.isAgent(t))
    const harm = b.hp !== undefined ? Math.max(0, b.hp - (gone ? 0 : w.num(t!, 'hp', w.num(t!, 'maxHp', 1)))) : 0
    const killed = !!b.person && !!gone
    const facts = this.seenFacts(ev, b, at, defined, harm, killed)
    for (const e of w.entitiesOnMap(at.map)) {
      // a seer is anything with sight of its own
      if (e.id === doer.id || e.place.on !== 'tile' || !(w.num(e, 'sight') > 0) || this.asleep(e) || this.busy(e)) continue
      const p = e.place
      const d = Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y))
      const sight = this.sightOf(e, p)
      if (d > sight) continue
      if (!this.lineOfSight(at.map, p, at)) continue
      if (!this.society.notices(e, doer, { from: b.from, whose: b.whose, worn: b.worn }, d, sight)) continue
      const rel = this.society.relation(b.whose, e)
      this.offer({
        kind: 'seen',
        host: { e: e.id },
        roles: { actor: ev.roles.actor, target: ev.roles.target, instrument: ev.roles.instrument },
        params: { ...facts, owner: rel === 'mine' || rel === 'ours' ? rel : rel === 'another' ? 'another' : 'nobody', victim: this.society.victim(b.person ? b.thing : b.whose, e) },
        cause: ev.cause,
        origin: ev.origin,
      })
    }
    // and the doer sees it too, seen or not: one's own deed (its conscience: the society's deeds say what it was)
    if (w.isAgent(doer) && doer.place.on === 'tile') {
      const own = this.ownSeen(ev, b, facts, doer)
      if (this.society.deedName(own)) this.offer(own)
    }
  }

  /** What those who see an act see in it (docs/npc-sandbox.md §2.2): the act, where, whose the thing was, the harm, a death. */
  private seenFacts(ev: GameEvent, b: Before, at: Pos, defined: boolean, harm: number, killed: boolean): Record<string, PropValue> {
    const element = ev.params?.element
    return {
      act: String(ev.params?.verb ?? ''),
      defined,
      map: at.map,
      x: at.x,
      y: at.y,
      ...(b.whose && { whose: b.whose }),
      ...(b.theirs && { theirs: true }),
      ...(b.from && { from: b.from }),
      ...(b.person && { person: true }),
      ...(b.worn && { worn: true }),
      ...(harm > 0 && { harm }),
      ...(killed && { killed: true }),
      ...(b.value !== undefined && { value: b.value }),
      ...(typeof element === 'string' && element && { element }),
      ...(ev.params?.attack === true && { attack: true }),
    }
  }

  /** The doer's own sight of its act: what it holds is its own deed. */
  private ownSeen(ev: GameEvent, b: Before, facts: Record<string, PropValue>, doer: Entity): GameEvent {
    return {
      kind: 'seen',
      host: { e: doer.id },
      roles: { actor: ev.roles.actor, target: ev.roles.target, instrument: ev.roles.instrument },
      params: { ...facts, own: true, owner: this.society.relation(b.whose, doer), victim: this.society.victim(b.person ? b.thing : b.whose, doer) },
      cause: ev.cause,
      origin: ev.origin,
    }
  }

  /**
   * What an act would weigh on its doer's conscience, foreseen before it is made (the controls ask first): the own
   * `seen` it would make, as `see` makes it — a blow, or a chain that hurts or breaks what it is made on, taken to
   * harm it by the act's power, and to kill one it would leave at no health — and what the doer's own answer to it
   * (a rule's `conscience`) would cost its karma. Nothing is written.
   */
  guilt(verb: Verb, actorId: Id, target: Ref, opts: { instrument?: Ref | null; params?: Record<string, PropValue> } = {}): Sin | undefined {
    const w = this.world
    const doer = w.get(actorId)
    if (!doer || !w.isAgent(doer) || doer.place.on !== 'tile') return undefined
    const instrument = opts.instrument === undefined ? (doer.held ? { e: doer.held } : undefined) : (opts.instrument ?? undefined)
    // an act that would not be made (out of reach, a child's things: act) weighs on no one
    if (!this.inReach(verb, doer, target, instrument)) return undefined
    const thing = w.get(target.e)
    const shielded = thing && (verb === 'take' ? this.protectedHolder(thing) : opts.params?.attack === true && this.isProtected(thing) ? thing : undefined)
    if (shielded && shielded.id !== actorId) return undefined
    const ev = this.actEvent(verb, actorId, target, instrument, opts.params)
    const b = this.before(ev)
    if (!b.at) return undefined
    let harm = 0
    let killed = false
    if (verb === 'use' && b.hp !== undefined && b.hp > 0) {
      const blow = ev.params?.attack === true
      if (blow || this.preview(ev).harms.includes(target.e)) {
        const power = Math.max(1, Number(ev.params?.power ?? 1))
        harm = Math.min(b.hp, power)
        killed = !!b.person && blow && power >= b.hp
      }
    }
    const own = this.ownSeen(ev, b, this.seenFacts(ev, b, b.at, true, harm, killed), doer)
    const sin = this.society.guilt(own)
    if (!sin) return undefined
    // only where the doer's own rules answer its deed with its conscience
    const res = this.resolveEvent(own)
    if (!res.defined || !res.leaf || !isDo(res.leaf) || !res.leaf.do.some((e) => e.op === 'conscience')) return undefined
    return { deeds: [sin.deed], toll: sin.toll }
  }

  // ---------------------------------------------------------------- factions and fear

  /** The factions an entity belongs to: its `faction:<id>` tags. */
  factionsOf(e: Entity): string[] {
    return [...(this.world.view({ e: e.id })?.tags ?? [])].filter((t) => t.startsWith('faction:')).map((t) => t.slice(8))
  }

  /**
   * Would `a` attack `b` now? Its foes (whoever struck it) always; the factions its own
   * factions are hostile to, when its temper says so (always, or after dark). Nobody attacks
   * one who is down.
   */
  hostileTo(a: Entity, b: Entity): boolean {
    const w = this.world
    if (!a.ai || a.id === b.id || !w.isAgent(b) || b.place.on !== 'tile' || w.hasStatus({ e: b.id }, 'down')) return false
    if (a.ai.foes?.includes(b.id)) return true
    const t = a.ai.temper
    if (t === 'wary' || (t === 'nocturnal' && !w.isNight())) return false
    const factions = w.onto.data.factions ?? {}
    const theirs = this.factionsOf(b)
    return this.factionsOf(a).some((f) => (factions[f]?.hostile ?? []).some((h) => theirs.includes(h)))
  }

  /** Where fire burns on a map: lit things and burning things and tiles. */
  fires(map: string): Pos[] {
    const w = this.world
    const out: Pos[] = []
    for (const key of w.statusfulOn(map)) {
      const ref = w.keyRef(key)
      if (!w.hasStatus(ref, 'lit') && !w.hasStatus(ref, 'burning')) continue
      const p = w.refPos(ref)
      if (p?.map === map) out.push(p)
    }
    return out
  }

  /** Does it keep away from fire? Everything with an AI, unless it is fiery itself. */
  fearsFire(e: Entity): boolean {
    return !!e.ai && !this.world.hasTag(e, 'fiery')
  }

  /**
   * In a fight one's blows pass over one's own side (World.allied: who follows one, whom one follows, who follows the
   * same one): they are not struck, and a blow aimed at one of them is a swing at the air (design.md §5.2).
   */
  spares(a: Entity, b: Entity | Ref | undefined): boolean {
    const w = this.world
    const v = b && ('e' in b ? w.get(b.e) : 'id' in b ? b : undefined)
    return !!v && w.fighting(a) && w.allied(a, v)
  }

  /** Whether an entity matches this game's read-only protection selectors. */
  isProtected(e: Entity | Ref): boolean {
    const def = this.world.onto.data.protection
    if (!def?.subjects.length) return false
    const ref = 'e' in e ? e : { e: e.id }
    const view = this.world.view(ref)
    return !!view && def.subjects.some((sel) => matchSelector(sel, view))
  }

  /** The first protected person in the original holder chain of a carried thing. */
  protectedHolder(e: Entity): Entity | undefined {
    if (!this.world.onto.data.protection?.subjects.length) return undefined
    let held: Entity | undefined = e
    const seen = new Set<Id>()
    while (held && !seen.has(held.id)) {
      seen.add(held.id)
      if (held.id !== e.id && this.isProtected(held)) return held
      held = held.place.on === 'inside' || held.place.on === 'hand' ? this.world.get(held.place.holder) : undefined
    }
    return undefined
  }

  /** A held thing may leave a protected person's custody only through that person's own act. */
  allowsProtectedTransfer(ev: GameEvent, from: Entity): boolean {
    return ev.roles.actor?.e === from.id
  }

  /** Tell the player why an attempted act was refused, using the game's own wording. */
  refuseProtection(actor?: Id): void {
    if (actor !== this.world.state.player) return
    const text = this.world.onto.data.protection?.refusal ?? { en: 'This person is protected.', zh: '此人受到保护。' }
    this.world.fx.push({ t: 'say', who: actor, text })
  }

  // ---------------------------------------------------------------- statuses, props, health

  /** A status taken on (from `by`, if someone gave it): its `clears` are lost, and a fresh one is a threshold/gain event. */
  applyStatus(ref: Ref, status: string, duration?: number, by?: Id): void {
    const w = this.world
    if (w.onto.data.protection?.statuses?.includes(status) && this.isProtected(ref)) return
    const def = w.onto.status(status)
    // a status that wards this one off (fireproof against burning) keeps it from taking hold
    for (const held of Object.keys(w.statusesOf(ref) ?? {})) if (w.onto.status(held)?.wards?.includes(status)) return
    for (const c of def?.clears ?? []) if (w.hasStatus(ref, c)) this.removeStatus(ref, c)
    const dur = duration ?? def?.duration
    const fresh = w.setStatus(ref, status, dur ? w.state.tick + dur : NO_EXPIRY, by && w.get(by) ? by : undefined)
    if (fresh) this.offer({ kind: 'threshold/gain', host: ref, roles: {}, params: { status } })
  }

  /** A status lost by an outcome: a threshold/lose event. */
  removeStatus(ref: Ref, status: string): void {
    const w = this.world
    if (w.clearStatus(ref, status)) this.offer({ kind: 'threshold/lose', host: ref, roles: {}, params: { status } })
  }

  /**
   * Set a prop; crossing a declared line is a threshold/cross event (design.md §5.7): downward (to a
   * value, or under a share of another prop), and for a line crossed both ways, upward again (`way: up`).
   */
  setProp(e: Entity, key: string, value: PropValue, by?: GameEvent): void {
    const w = this.world
    const before = w.num(e, key, Number.NaN)
    const currentHp = Number.isFinite(before) ? before : w.num(e, 'maxHp', Number.NaN)
    if (key === 'hp' && typeof value === 'number' && Number.isFinite(currentHp) && value < currentHp && this.isProtected(e)) return
    w.setProp(e, key, value)
    if (typeof value !== 'number') return
    for (const t of w.onto.data.thresholds ?? []) {
      if (t.prop !== key) continue
      const line = t.lte ?? (t.below ? w.num(e, t.below.prop, Number.NaN) * t.below.mul : Number.NaN)
      if (Number.isNaN(line)) continue
      const under = (v: number) => (t.lte !== undefined ? v <= line : v < line)
      const down = under(value) && !under(before)
      const up = !!t.both && !Number.isNaN(before) && under(before) && !under(value)
      if (!down && !up) continue
      // the one whose act brought it there (the last blow) is the event's actor, and what they struck with its instrument
      const actor = by?.roles.actor ?? (by?.cause ? { e: by.cause } : undefined)
      const instrument = actor ? by?.roles.instrument : undefined
      this.queue({ kind: 'threshold/cross', host: { e: e.id }, roles: { ...(actor && { actor }), ...(instrument && { instrument }) }, params: { name: t.name, prop: key, ...(up && { way: 'up' }) }, cause: by?.cause, origin: by?.origin })
      // a thing brought down is news for the quests (docs/quests.md §2.3)
      if (t.name === 'broken' && !up) this.quests.news({ kind: 'kill', target: e.id, actor: actor && 'e' in actor ? actor.e : undefined, type: e.type, tags: [...(w.view({ e: e.id })?.tags ?? [])], map: w.posOf(e)?.map })
    }
  }

  /**
   * Harm from outside any rule (a test, a tool, the clock): the same as an outcome's `hurt`, as a
   * strike by `by` would deal it, and what follows (a defeat) resolves now.
   */
  damage(e: Entity, amount: number, element?: string, pierce?: boolean, by?: Ref): void {
    const ev: GameEvent = { kind: 'impulse/strike', host: { e: e.id }, roles: by ? { actor: by } : {}, params: {}, cause: by && 'e' in by ? by.e : undefined, origin: 'world' }
    this.author(() => this.hurt(e, amount, element, pierce, ev))
    this.flush()
  }

  /** The host loses health; its defence applies unless pierce. One who is down takes no more. */
  hurt(e: Entity, amount: number, element?: string, pierce?: boolean, by?: GameEvent, blow = false): void {
    const w = this.world
    if (this.isProtected(e)) return
    if (w.hasStatus({ e: e.id }, 'down')) return
    // what is invulnerable takes no harm (a development switch any actor may carry: `invulnerable`)
    if (w.prop(e, 'invulnerable') === true) return
    // what has no durability cannot be harmed (world-model.md §4.2: without maxHp, it cannot break)
    if (w.prop(e, 'maxHp') === undefined) return
    if (blow) {
      // a blow: what struck (else the striker's own body) on what the host is made of (world-model.md §6.1)
      const struckWith = by?.roles.instrument ? w.get(by.roles.instrument.e) : undefined
      const striker = by?.roles.actor ? w.get(by.roles.actor.e) : undefined
      const tool = struckWith ?? striker
      const mine = tool && w.materialOf(tool)
      const its = w.materialOf(e)
      if (mine && its && mine.hardness < its.hardness) {
        w.fx.push({ t: 'log', text: { en: 'Too hard.', zh: '太硬了。' } })
        const p = w.posOf(e)
        if (p) w.fx.push({ t: 'vfx', fx: 'dust', map: p.map, x: p.x, y: p.y })
        return
      }
      const edge = by?.params?.edge
      if (tool) amount *= w.efficiency(tool, typeof edge === 'string' ? edge : undefined, e)
    }
    // an element's harm, less what resists it (world-model.md §6.8: each element names its resistance; the
    // herbalist's draught gives it while it lasts, a worn thing may): all of it, none; below none, more
    const resist = element ? w.onto.data.resistances?.[element] : undefined
    if (resist) amount *= 1 - Math.min(100, w.stat(e, resist)) / 100
    if (amount <= 0) return
    const def = pierce ? 0 : w.stat(e, 'def')
    // the combat talents of the one struck (combat.ts): dodge, a guarded moment, reductions, the brink
    const by_ = by?.roles.actor ?? (by?.cause ? { e: by.cause } : undefined)
    const attacker = by_ && 'e' in by_ ? w.get(by_.e) : undefined
    const dmg = this.combat.damage(e, Math.max(1, Math.round(amount - def)), attacker, !!pierce)
    // a blow that found nothing (dodged, or the moment after a dash)
    if (dmg <= 0) return
    w.fx.push({ t: 'damage', who: e.id, amount: dmg, element })
    // who felled it (the death screen): the source of this harm, never an older blow's; none for a fall, hunger, the world.
    // A status's pulse from one now gone (a bleed they opened) keeps naming them, if they are the last who struck.
    const status = by?.kind.startsWith('time/') && typeof by.params?.status === 'string' ? by.params.status : undefined
    const giver = status ? w.statusBy({ e: e.id }, status) : undefined
    if (attacker && attacker.id !== e.id) Object.assign((e.combat ??= {}), { lastHurtBy: attacker.id, lastHurtByType: attacker.type, lastHurtTick: w.state.tick })
    else if (e.combat && !(giver && giver !== e.id && e.combat.lastHurtBy === giver)) {
      delete e.combat.lastHurtBy
      delete e.combat.lastHurtByType
    }
    // what has durability starts whole: its hp is its maxHp until it is struck
    // health stops at nothing: a blow past it is a blow that fells, not a debt (thresholds read lte 0)
    // health stops at nothing; what a combat module keeps from a lethal blow, it keeps (combat.lethal)
    const hp = this.combat.lethal(e, Math.max(0, w.num(e, 'hp', w.num(e, 'maxHp', 1)) - dmg))
    this.setProp(e, 'hp', hp, by)
    // what a landed blow carries beyond its harm (a bleed, an affliction, health drawn back): the combat module's
    this.combat.wounded(e, by, attacker)
  }

  // ---------------------------------------------------------------- relations (design.md §5.10)

  /** An outcome touched this (moved, made, gone, changed type; a tile changed terrain). */
  touch(ref: Ref, _gone = false): void {
    this.touched.set(refKey(ref), ref)
  }

  /**
   * Recompute the relations of what outcomes touched, and of what stands where they are, and
   * turn the differences into contact events: begin for each new relation, end for each lost one,
   * for both sides — whatever caused them.
   */
  settle(): void {
    if (!this.touched.size) return
    const w = this.world
    const rel = (w.state.relations ??= {})
    const touched = [...this.touched.values()]
    this.touched.clear()
    const hosts = new Set<string>()
    const tiles = new Set<string>()
    const addTile = (p: Pos | undefined) => p && tiles.add(tileKey(p.map, p.x, p.y))
    for (const r of touched) {
      hosts.add(r.e)
      const e = w.get(r.e)
      addTile(w.posOf(e))
      // where it was: the cells of what it lay on, and whoever relied on it (lay on it, or was held up by it:
      // a thing with a reach, or one that supports, changed, moved or gone)
      for (const k of rel[r.e] ?? []) if (k.startsWith('on|')) addTile(w.posOf(w.get(w.keyRef(k.slice(3)).e)))
      if (!e || w.reachOf(e).length || w.prop(e, 'supports') !== undefined)
        for (const h of this.relatedTo(r.e)) if (rel[h]?.some((k) => w.keyRef(k.slice(k.indexOf('|') + 1)).e === r.e)) hosts.add(h)
    }
    const storeys = w.onto.data.params?.storeys ?? 4
    for (const t of tiles) {
      const [map, x, y] = t.split(':')
      for (let z = 0; z <= storeys; z++) for (const o of w.entitiesAt(map, +x, +y, z)) hosts.add(o.id)
    }
    for (const h of hosts) this.diff(h)
  }

  /** The hosts that may keep a relation to a thing (read the other way; the caller checks each). */
  private relatedTo(id: Id): Iterable<string> {
    const rel = (this.world.state.relations ??= {})
    if (this.relBy?.of !== rel) {
      const by = new Map<Id, Set<string>>()
      for (const [h, ks] of Object.entries(rel)) for (const k of ks) this.relAdd(by, h, k)
      this.relBy = { of: rel, by }
    }
    return this.relBy.by.get(id) ?? []
  }

  private relAdd(by: Map<Id, Set<string>>, host: string, k: string): void {
    const to = this.world.keyRef(k.slice(k.indexOf('|') + 1)).e
    let s = by.get(to)
    if (!s) by.set(to, (s = new Set()))
    s.add(host)
  }

  /** One host's relations against what was kept: the differences become contact events. */
  private diff(key: string, quiet = false): void {
    const w = this.world
    const rel = (w.state.relations ??= {})
    const e = w.get(key)
    const now = e && e.place.on !== 'none' && !w.isPlaceless(e) ? w.relationsOf(e) : []
    const was = rel[key] ?? []
    if (now.length) rel[key] = now
    else delete rel[key]
    // (the other way round, kept as they change)
    if (this.relBy?.of === rel) {
      const to = (k: string) => w.keyRef(k.slice(k.indexOf('|') + 1)).e
      const still = new Set(now.map(to))
      for (const k of was) if (!still.has(to(k))) this.relBy.by.get(to(k))?.delete(key)
      for (const k of now) this.relAdd(this.relBy.by, key, k)
    }
    if (quiet) return
    for (const k of was) if (!now.includes(k)) this.contact('contact/end', key, k)
    for (const k of now) if (!was.includes(k)) this.contact('contact/begin', key, k)
  }

  /** Both sides of a relation hear of it, each from its own side (on/under, in/contains, held/holds). */
  private contact(kind: EventKind, from: string, k: string): void {
    const w = this.world
    const i = k.indexOf('|')
    const how = k.slice(0, i)
    const to = k.slice(i + 1)
    const a = w.keyRef(from)
    const b = w.keyRef(to)
    if (w.view(a)) this.offer({ kind, host: a, roles: { other: b }, params: { how } })
    if (w.view(b)) this.offer({ kind, host: b, roles: { other: a }, params: { how: REVERSE[how] ?? how } })
    // the story's script hears who enters a region (its triggers are events, not polls)
    if (how === 'in-region' && kind === 'contact/begin') {
      this.story.entered(a)
      // and the quests: the taker comes into an area (docs/quests.md §2.3)
      const r = w.get(b.e)
      if ('e' in a && a.e === w.state.player && r?.place.on === 'area') this.quests.news({ kind: 'enter', actor: a.e, key: `${r.place.map}:${b.e.slice(`region.${r.place.map}.`.length)}` })
    }
    // what the player holds changed (a thing in their bag or hand, or gone from it)
    if ((how === 'in' || how === 'held') && 'e' in b && b.e === w.state.player) this.quests.news({ kind: 'carry', actor: b.e, item: 'e' in a ? a.e : undefined })
  }

  /** A map's relations as they stand, as its start (no events): a map loaded, a sandbox built. */
  seedRelations(map: string): void {
    this.diffMap(map, true)
  }

  /** Every thing on a map, diffed against the relations kept for it (entering a map; quiet when seeding). */
  private diffMap(map: string, quiet: boolean): void {
    for (const e of this.world.entitiesOnMap(map)) {
      this.diff(e.id, quiet)
      for (const c of [...(e.contents ?? []), ...(e.held ? [e.held] : [])]) this.diff(c, quiet)
    }
  }

  // ---------------------------------------------------------------- movement

  busy(e: Entity): boolean {
    if (e.frozenBy) return true
    // the player watches a scene
    if (e.id === this.world.state.player && this.world.scene) return true
    // the player answers a yes/no question
    if (e.id === this.world.state.player && this.world.state.question) return true
    for (const s of Object.keys(e.statuses ?? {})) if (this.world.onto.status(s)?.immobilize) return true
    return false
  }

  cooldown(id: Id): number {
    return this.cooldowns.get(id) ?? 0
  }

  setCooldown(id: Id, ticks: number): void {
    this.cooldowns.set(id, this.world.state.tick + ticks)
  }

  ready(id: Id): boolean {
    return this.cooldown(id) <= this.world.state.tick
  }

  /** Step one tile: an act of moving (behaviour submits it like the player). True if it moved. */
  step(e: Entity, dir: Dir): boolean {
    if (this.busy(e) || e.place.on !== 'tile') return false
    const before = `${e.place.map}:${e.place.x}:${e.place.y}`
    this.act('move', e.id, { e: e.id }, { instrument: null, params: { dir } })
    return e.place.on === 'tile' && `${e.place.map}:${e.place.x}:${e.place.y}` !== before
  }

  /**
   * The `step` primitive: the host moves itself one tile. What is solid stops it (a bump, for both
   * sides); a portal carries the player; pushing on into a person swaps places (JRPG courtesy).
   */
  stepSelf(e: Entity, dir: Dir, ev: GameEvent): boolean {
    const w = this.world
    if (e.place.on !== 'tile') return false
    e.facing = dir
    const { map, x, y } = e.place
    const [dx, dy] = DIRS[dir]
    let nx = x + dx
    let ny = y + dy
    const isPlayer = e.id === w.state.player
    // a way the story has not opened yet is only ground
    const portalAt = (px: number, py: number) => w.map(map)?.portals.find((p) => p.x === px && p.y === py && (!p.opensWhen || !!w.fact(p.opensWhen)))
    let portalHere = portalAt(nx, ny)
    // only the player uses portals by stepping on them; NPCs transfer from the tile beside
    if (portalHere && !isPlayer) return false
    // off the edge of a map that lies on the overworld: out onto its cell there (world-model.md §5.1) — but never
    // from a way the story has not opened yet (one stands on it, so it is sealed): it leads nowhere until it opens
    const sealedHere = !!w.map(map)?.portals.some((p) => p.x === x && p.y === y)
    // off an edge where the way is one the story has not opened (a way sealed underfoot, an edge whose ways all lead
    // to places not open yet, or a map whose edges the story keeps shut): the story hears that one ran up against it —
    // a bump on it, its `sealed` the fact that opens the way (`edge` when it is the map's edges that are shut, not a
    // way) — and its rules answer (a companion's remark); the step is refused below as at any edge
    const sealed = !w.inBounds(map, nx, ny) && isPlayer ? this.sealedEdge(map, x, y) : undefined
    if (!w.inBounds(map, nx, ny) && isPlayer && w.map(map)?.site && !sealedHere && !sealed && this.leaveByEdge(e, x, y, dir)) return true
    if (sealed && w.story) this.offer({ kind: 'bump', host: { e: w.story.id }, roles: { other: { e: e.id } }, params: { dir, sealed: sealed.fact, ...(sealed.edge && { edge: 1 }) }, cause: ev.cause ?? e.id, origin: ev.origin })
    // storeys (world-model.md §5.2, §5.5): on a floor one walks; from stairs up onto the floor above;
    // onto the stairs below from above them; off a floor's edge one falls to the first below
    const z = e.place.z ?? 0
    const floorAt = (zz: number) => !!w.occupant(map, nx, ny, 'floor', zz)
    // stairs are a block a storey high whose top is steps, going up one way (their facing, north
    // unless set): one walks onto them (from the front or a side: half a storey) and, standing on them, on the
    // way they go up onto the floor a storey up; from a storey, onto the stairs below, half a storey down
    const stairsAt = (sx: number, sy: number, zz: number) => w.entitiesAt(map, sx, sy, zz).find((o) => w.hasTag(o, 'stairs'))
    const on = stairsAt(x, y, z)
    const climb = !!on && (on.facing ?? 'up') === dir && floorAt(z + 1)
    const descend = z > 0 && !floorAt(z) && !!stairsAt(nx, ny, z - 1)
    let nz = z
    let drop = 0
    if (climb) nz = z + 1
    else if (descend) nz = z - 1
    else if (!floorAt(z)) {
      if (z > 0 && w.stanceOf(e) !== 'air') {
        nz = z - 1
        while (nz > 0 && !floorAt(nz)) nz--
        drop = z - nz
      }
    }
    // the back of built stairs is their high end, a storey of block: on their own storey one neither
    // steps onto them from behind nor walks off their top into the cell behind (one goes up onto a floor
    // there). A map's own way down (stairs_down, a way to another floor) has no back.
    const fromBehind = (st: Entity | undefined, d: Dir) => !!st && !w.isTerrain(st) && OPPOSITE[st.facing ?? 'up'] === d
    const behind = !climb && !descend && nz === z ? (fromBehind(stairsAt(nx, ny, z), dir) ? stairsAt(nx, ny, z) : on && !w.isTerrain(on) && (on.facing ?? 'up') === dir ? on : undefined) : undefined
    if (behind && w.stanceOf(e) !== 'air') {
      this.offer({ kind: 'bump', host: { e: e.id }, roles: { other: { e: behind.id } }, params: { dir }, cause: ev.cause, origin: ev.origin })
      return false
    }
    // the relief (world-model.md §5.5): a cliff is neither climbed nor dropped down beyond a level, nor walked into
    // by its face — one bumps into it (what makes up the cell there); off a ledge a level high one drops, over its
    // face to its foot
    const over = z === 0 && nz === 0 ? w.stepOver(e, map, x, y, nx, ny) : ({ walk: true } as const)
    if ('wall' in over) {
      const cliff = w.cellTop(map, nx, ny)
      this.offer({ kind: 'bump', host: { e: e.id }, roles: cliff ? { other: { e: cliff.id } } : {}, params: { dir }, cause: ev.cause, origin: ev.origin })
      return false
    }
    if ('fall' in over && over.to) {
      ;({ x: nx, y: ny } = over.to)
      portalHere = portalAt(nx, ny)
      if (portalHere && !isPlayer) return false
    }
    // the one who pushed us to make way stands where we step: we take its cell as it takes ours
    const yielding = ev.params?.swap === true && ev.roles.source && 'e' in ev.roles.source && w.actorAt(map, nx, ny, undefined, nz)?.id === ev.roles.source.e
    if (!yielding && !w.fits(e, map, nx, ny, nz)) {
      const other = w.actorAt(map, nx, ny, undefined, nz)
      // the player, or a person on their way, pushing on into a person who is free: they swap places
      // (people yield to each other this way and never stand in one cell, world-model.md §5.2); one
      // holding still for the one who faces them keeps its place against another on its way (it goes round:
      // two would push each other out of it in turn)
      if (!(isPlayer || e.npc) || !other?.npc || this.busy(other) || (!isPlayer && this.npcs.holding(other)) || w.blocked(map, nx, ny, undefined, nz)) {
        const thing = w.inBounds(map, nx, ny) ? (other ?? w.solidAt(map, nx, ny, undefined, nz)) : undefined
        const other2 = thing ?? w.cellTop(map, nx, ny)
        const ref: Ref | undefined = other2 && { e: other2.id }
        this.offer({ kind: 'bump', host: { e: e.id }, roles: ref ? { other: ref } : {}, params: { dir }, cause: ev.cause, origin: ev.origin })
        if (ref && w.view(ref)) this.offer({ kind: 'bump', host: ref, roles: { other: { e: e.id } }, params: { dir }, cause: ev.cause, origin: ev.origin })
        return false
      }
      // keep pushing into a person (~0.8 s) and you swap places; a single bump just turns you to face them
      const t = w.state.tick
      const b = this.bumps.get(e.id)
      const now = b && b.id === other.id && t - b.last <= 6 ? { id: other.id, since: b.since, last: t } : { id: other.id, since: t, last: t }
      this.bumps.set(e.id, now)
      if (t - now.since < 8) return false
      this.bumps.delete(e.id)
      // the other makes way first, at once; only if it has left does the pusher step in (one body a cell)
      const back = OPPOSITE[dir]
      this.dispatching++
      try {
        this.dispatch({ kind: 'impulse/push', host: { e: other.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params: { dir: back, swap: true }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
      } finally {
        this.dispatching--
      }
      const there = w.posOf(other)
      if (there && there.map === map && there.x === nx && there.y === ny) return false
    }
    this.touch({ e: e.id })
    w.place(e, { on: 'tile', map, x: nx, y: ny, ...(nz && { z: nz }) })
    this.touch({ e: e.id })
    this.leftBy.delete(e.id)
    if (drop) this.fallBy(e, drop, ev)
    // a step off a ledge is a fall (world-model.md §5.5): the faller strikes itself by the drop
    if ('fall' in over) this.fallBy(e, over.fall, ev)
    // a step on a map with a scale lasts its minutes, by its ground and the weather (world-model.md §5.6)
    const scale = w.map(map)?.scale
    if (scale) {
      const cost = w.num(w.cellTop(map, nx, ny) ?? e, 'cost', 1)
      const wet = ['rain', 'storm', 'snow'].includes(w.calendar().weather) ? (w.onto.data.params?.rainCost ?? 1) : 1
      const ticks = Math.round(scale * cost * wet * TICKS_PER_MINUTE)
      if (isPlayer) this.fastForward = ticks
      else this.setCooldown(e.id, ticks)
    }
    // a successful step charges the swiftness talents (combat.ts)
    this.combat.stepped(e)
    if (isPlayer && portalHere) this.travel(e, { map: portalHere.to, x: portalHere.tx, y: portalHere.ty })
    return true
  }

  /** Time passes at once for the one at the keys (hours in the cells), as on a long step: it runs at the end of this tick. */
  passTime(ticks: number): void {
    this.fastForward = Math.max(this.fastForward, Math.max(0, Math.round(ticks)))
  }

  /** The one at the keys sleeps until the hour comes round (the clock runs at once, as on a long step): how long, in ticks. */
  sleepUntil(hour: number): number {
    const w = this.world
    const now = w.hour()
    const hours = (hour - now + 24) % 24 || 24
    this.fastForward = Math.round(hours * TICKS_PER_HOUR)
    return this.fastForward
  }

  /**
   * A fall of `levels` (world-model.md §5.5, D12): beyond the safe height each level hurts the
   * faller, as a blow to itself (physics: defined, never asked).
   */
  fallBy(e: Entity, levels: number, ev?: GameEvent): void {
    const w = this.world
    const p = w.onto.data.params
    const harm = Math.max(0, levels - (p?.safeFall ?? 1)) * (p?.fallDamage ?? 0)
    const at = w.posOf(e)
    if (at) w.fx.push({ t: 'vfx', fx: 'dust', map: at.map, x: at.x, y: at.y })
    if (harm <= 0) return
    if (e.id === w.state.player) w.fx.push({ t: 'log', text: { en: 'A hard fall.', zh: '重重地摔了下去。' } })
    this.hurt(e, harm, undefined, true, ev)
  }

  /**
   * Out of a map by its edge (world-model.md §5.1, Elin's ExitBorder): onto its cell's block on the
   * overworld, at the tile of the same part of the map (the bank one left from) nearest where one
   * left. A part the block does not show: its nearest open tile. A place of one cell: onto that cell,
   * where one chooses the way on (in again, it is where one left).
   */
  /**
   * The fact that opens the way off a map's edge at (x, y), where the story has not opened it: a way (a portal) there
   * sealed by its `opensWhen`; a map whose edges the story keeps shut (its `edgesWhen`: `edge`); or, on a map a barrier
   * parts, an edge whose part's ways all lead to places not open yet (the far bank before Part Two), or to places whose
   * own edges are shut (off this part's edge one would come out on their side: `edge`). Undefined where the edge is only
   * an edge, or open.
   */
  sealedEdge(map: string, x: number, y: number): { fact: string; edge?: boolean } | undefined {
    const w = this.world
    const m = w.map(map)
    if (!m) return undefined
    const shut = (p: { opensWhen?: string }) => !!p.opensWhen && !w.fact(p.opensWhen)
    const here = m.portals.find((p) => p.x === x && p.y === y && shut(p))
    if (here) return { fact: here.opensWhen! }
    if (m.edgesWhen && !w.fact(m.edgesWhen)) return { fact: m.edgesWhen, edge: true }
    if (!m.site || new Set(w.partsOf(map)?.filter((p) => p >= 0)).size <= 1) return undefined
    const part = w.partAt(map, x, y)
    const ways = m.portals.filter((p) => w.partAt(map, p.x, p.y) === part)
    if (!ways.length) return undefined
    if (ways.every(shut)) return { fact: ways[0].opensWhen! }
    const edgesShut = (p: Portal) => { const to = w.map(p.to)?.edgesWhen; return !!to && !w.fact(to) }
    const beyond = ways.find((p) => !shut(p) && edgesShut(p))
    return beyond && ways.every((p) => shut(p) || edgesShut(p)) ? { fact: w.map(beyond.to)!.edgesWhen!, edge: true } : undefined
  }

  private leaveByEdge(e: Entity, x: number, y: number, dir: Dir): boolean {
    const w = this.world
    const map = w.map(w.posOf(e)!.map)!
    const site = map.site!
    const part = w.partAt(map.id, x, y)
    const at = [(x + 0.5) / map.width, (y + 0.5) / map.height]
    // a place of one cell: out onto that cell, standing on the place one left — from there one chooses where to go
    // (a step to a neighbour, or in again). A place one cannot stand on — a barrier runs through it (its cell the
    // barrier's, or two parts to the map), or the story has sealed it — out onto the cell beside it the way one
    // left; through a barrier only onto a cell its part's ways lead to, nearest where one left (a place on the barrier's
    // own cell, the Reed Bend on the river's, as a map two parts to: never out on the far side of it).
    if (site.size === 1) {
      const open = (tx: number, ty: number) => !w.map(site.map) || w.walkable(site.map, tx, ty, e.id)
      const parted = new Set(w.partsOf(map.id)?.filter((p) => p >= 0)).size > 1 || !open(site.x, site.y)
      const linked = new Set(map.portals.filter((p) => w.partAt(map.id, p.x, p.y) === part).map((p) => p.to))
      const leads = (tx: number, ty: number) => w.entitiesAt(site.map, tx, ty).some((s) => linked.has(String(s.props?.map)))
      const ahead = { x: site.x + DIRS[dir][0], y: site.y + DIRS[dir][1] }
      let to: { x: number; y: number } | undefined
      if (!parted && open(site.x, site.y)) {
        to = { x: site.x, y: site.y }
        this.leftBy.set(e.id, { map: map.id, rel: [at[0], at[1]] })
      } else if (open(ahead.x, ahead.y) && (!parted || leads(ahead.x, ahead.y))) to = ahead
      else {
        const out = [site.x + at[0] - 0.5 + DIRS[dir][0], site.y + at[1] - 0.5 + DIRS[dir][1]]
        let best: { x: number; y: number; d: number; linked: boolean } | undefined
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const tx = site.x + dx
            const ty = site.y + dy
            const l = leads(tx, ty)
            // across a barrier, only where this part's ways lead (a cell its open ways reach): never the far side's ground
            if ((!dx && !dy) || !open(tx, ty) || (parted && !l)) continue
            const d = Math.hypot(tx - out[0], ty - out[1])
            if (!best || (l && !best.linked) || (l === best.linked && d < best.d)) best = { x: tx, y: ty, d, linked: l }
          }
        to = best
      }
      // a part whose ways all lead to places not open yet (the far bank before Part Two): its edge leads nowhere
      if (!to && parted) return false
      e.facing = dir
      this.travel(e, { map: site.map, x: to?.x ?? site.x, y: to?.y ?? site.y })
      return true
    }
    let best: { x: number; y: number; d: number; same: boolean } | undefined
    for (let j = 0; j < site.size; j++)
      for (let i = 0; i < site.size; i++) {
        const tx = site.x + i
        const ty = site.y + j
        const open = !w.map(site.map) || w.walkable(site.map, tx, ty, e.id)
        if (!open) continue
        const same = w.regionPart(map.id, i, j, site.size) === part
        const d = Math.hypot((i + 0.5) / site.size - at[0], (j + 0.5) / site.size - at[1])
        if (!best || (same && !best.same) || (same === best.same && d < best.d)) best = { x: tx, y: ty, d, same }
      }
    e.facing = dir
    this.travel(e, { map: site.map, x: best?.x ?? site.x, y: best?.y ?? site.y })
    return true
  }

  /**
   * Into a map through the thing that stands for it (a site, world-model.md §5.6): one arrives where
   * one stands on it — its block of the overworld scaled to the map — in the part that tile shows,
   * at the nearest place one fits; from beside it, on the side one came from.
   */
  enterFrom(e: Entity, map: string, through: Entity | undefined): void {
    const w = this.world
    const p = w.posOf(e)
    const size = through ? this.world.onto.resolve(through.type).footprint[0] : 1
    const bx = through?.place.on === 'tile' ? through.place.x - Math.floor((size - 1) / 2) : 0
    const by = through?.place.on === 'tile' ? through.place.y - (size - 1) : 0
    const onIt = size === 1 && p && through?.place.on === 'tile' && p.x === through.place.x && p.y === through.place.y
    // on a place of one cell: in where one came out of it, still standing where one came out; else on the side
    // one came onto it from (behind one, as one faces)
    const left = onIt ? this.leftBy.get(e.id) : undefined
    const rel: [number, number] = left?.map === map
      ? left.rel
      : onIt
      ? [0.5 - DIRS[e.facing ?? 'down'][0] * 0.5, 0.5 - DIRS[e.facing ?? 'down'][1] * 0.5]
      : p ? [Math.min(1, Math.max(0, (p.x - bx + 0.5) / size)), Math.min(1, Math.max(0, (p.y - by + 0.5) / size))] : [0.5, 0.5]
    const tile: [number, number] = [Math.min(size - 1, Math.floor(rel[0] * size)), Math.min(size - 1, Math.floor(rel[1] * size))]
    // from beside a one-cell place, standing on another: one comes in by the way between the two maps
    const beside = size === 1 && p && through?.place.on === 'tile' && (p.x !== through.place.x || p.y !== through.place.y)
    const from = beside ? w.entitiesAt(p.map, p.x, p.y).find((s) => typeof s.props?.map === 'string')?.props?.map : undefined
    const entry: Entry = { rel, tile, size, ...(typeof from === 'string' && { from }) }
    this.mapKnown(map)
    if (!w.map(map)) {
      this.pendingTransition = { map, x: -1, y: -1, entry }
      return
    }
    this.teleport(e, this.entryPoint(e, map, entry))
  }

  /** Where one comes into a map from a tile of its block: in that tile's part, nearest the point it stands for. */
  private entryPoint(e: Entity, map: string, entry: Entry): Pos {
    const w = this.world
    const m = w.map(map)!
    const ways = entry.from ? m.portals.filter((p) => p.to === entry.from) : []
    // by the way from where one stood: next to it, on its side; otherwise in the part the tile shows, nearest its point
    const part = ways.length ? w.partAt(map, ways[0].x, ways[0].y) : w.regionPart(map, entry.tile[0], entry.tile[1], entry.size)
    const tx = ways.length ? ways.reduce((a, p) => a + p.x + 0.5, 0) / ways.length : entry.rel[0] * m.width
    const ty = ways.length ? ways.reduce((a, p) => a + p.y + 0.5, 0) / ways.length : entry.rel[1] * m.height
    let best: { x: number; y: number; d: number; same: boolean } | undefined
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        if (!w.fits(e, map, x, y) || (ways.length && m.portals.some((p) => p.x === x && p.y === y))) continue
        const same = part < 0 || w.partAt(map, x, y) === part
        const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty)
        if (!best || (same && !best.same) || (same === best.same && d < best.d)) best = { x, y, d, same }
      }
    return { map, x: best?.x ?? Math.floor(m.width / 2), y: best?.y ?? Math.floor(m.height / 2) }
  }

  /** A step to a place: an act of moving there (a scene's direction, a person arriving through a portal). */
  relocate(e: Entity, to: Pos): void {
    this.act('move', e.id, { e: e.id }, { instrument: null, params: { map: to.map, x: to.x, y: to.y } })
  }

  /** The `step` primitive's travel: the host goes to a place (the nearest free tile there), across maps if need be. */
  placeSelf(e: Entity, to: Pos): void {
    this.mapKnown(to.map)
    if (e.id === this.world.state.player && this.world.posOf(e)?.map !== to.map) return this.travel(e, to)
    const w = this.world
    // a flyer goes over what stops walkers (a companion over a wall, a river)
    // one body to a cell: where another stands, the nearest free tile (two people bound for one spot)
    const open = w.hasTag(e, 'airborne') ? w.inBounds(to.map, to.x, to.y) : w.fits(e, to.map, to.x, to.y)
    const at = open ? to : (this.nearestFree(to, e) ?? to)
    this.touch({ e: e.id })
    w.place(e, { on: 'tile', map: at.map, x: at.x, y: at.y })
    this.touch({ e: e.id })
  }

  /** Player movement request (held direction); respects speed. `walk` (Shift) is slower than the default run. */
  /** What of a tick the player's last step left over (a run's pace is no whole number of ticks). */
  private moveCarry = 0

  /**
   * The player steps one tile at their pace: their `speed` (ticks a step), a tick more held to a walk, or `params.run`
   * times as quick (one and a half by default) running; what is left of a tick is carried to the next step.
   */
  movePlayer(dir: Dir, walk = false, run = false): boolean {
    const p = this.world.player
    this.companions.stir()
    // a lesson at hand that does not let the keys move (docs/prologue.md, the drills)
    if (!this.controls.allows('move')) return false
    if (!this.ready(p.id) || this.pendingTransition) {
      if (!this.busy(p)) p.facing = dir
      return false
    }
    const moved = this.step(p, dir)
    if (moved) {
      const speed = this.world.num(p, 'speed', 2)
      const base = walk ? speed + 1 : run ? speed / (this.world.onto.data.params?.run ?? 1.5) : speed
      const ticks = this.combat.delay(p, base, 'move') + this.moveCarry
      const whole = Math.max(1, Math.floor(ticks + 1e-9))
      this.moveCarry = Math.max(0, ticks - whole)
      this.setCooldown(p.id, whole)
    }
    return moved
  }

  travel(e: Entity, to: Pos): void {
    this.mapKnown(to.map)
    if (!this.world.map(to.map)) {
      this.pendingTransition = to
      return
    }
    this.teleport(e, to)
  }

  /**
   * A map one can go to: loaded, in the portal graph, or a wild one a site on the overworld names
   * (made as one goes). Any other (a learned rule's push to "nowhere") is refused before anyone moves.
   */
  private mapKnown(map: string): void {
    const w = this.world
    if (w.map(map) || map in this.graph) return
    if (w.withProp('map', map).some((e) => e.type.startsWith('site'))) return
    throw new Error(`there is no map "${map}"`)
  }

  teleport(e: Entity, to: Pos): void {
    const w = this.world
    const from = w.posOf(e)?.map
    let { x, y } = to
    if (!w.fits(e, to.map, x, y)) {
      const free = this.nearestFree(to, e)
      if (!free) return
      ;({ x, y } = free)
    }
    w.place(e, { on: 'tile', map: to.map, x, y })
    // where it has been (the world map shows the player's): its own record
    if (w.prop(e, `visited.${to.map}`) === undefined) w.setProp(e, `visited.${to.map}`, 1)
    this.touch({ e: e.id })
    if (e.id === w.state.player && from !== to.map) this.enterMap(to.map, from)
    this.settle()
  }

  nearestFree(p: Pos, actor?: Entity): Pos | undefined {
    for (let r = 1; r < 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (actor ? this.world.fits(actor, p.map, p.x + dx, p.y + dy, p.z) : this.world.walkable(p.map, p.x + dx, p.y + dy, undefined, false, p.z)) return { ...p, x: p.x + dx, y: p.y + dy }
    return undefined
  }

  // ---------------------------------------------------------------- active, dormant (design.md §5.12)

  /**
   * The player comes to a map. The map they left goes dormant (frozen from now); the one they
   * enter catches up: its statuses' clocks as they would have run while it slept (catchUp); the
   * events addressed to it, in time order; its people, by their schedules; and the relation
   * difference over the whole map against what was kept.
   */
  enterMap(map: string, from?: string): void {
    const w = this.world
    const dormant = (w.state.dormant ??= {})
    if (from && from !== map) dormant[from] = { since: w.state.tick, inbox: dormant[from]?.inbox ?? [] }
    const rec = dormant[map]
    delete dormant[map]
    w.fx.push({ t: 'mapChanged', map })
    this.quests.news({ kind: 'enter', actor: w.state.player, key: map })
    if (rec) {
      // (what the map's clock did while it slept was not seen: its smoke and its words are not shown now)
      const heard = w.fx.length
      this.catchUp(map, rec.since)
      w.fx = [...w.fx.slice(0, heard), ...w.fx.slice(heard).filter((f) => !UNSEEN.has(f.t))]
      for (const ev of rec.inbox.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))) this.queue({ ...ev, depth: 0 })
    }
    this.npcs.onEnterMap(map, from)
    // those who follow the one at the keys come with them (docs/npc-sandbox.md: following)
    for (const h of this.hooks.enterMap) h(map)
    this.diffMap(map, false)
    this.flush()
  }

  /**
   * A map's statuses' clocks from the tick it went dormant (`since`) to now, run as they would have run in play
   * (design.md §5.12): tick by tick where something comes due, the same pass as a tick in play makes (statusesOn) —
   * every status that ends goes its way to its end, each pulse of it (a burning woodpile wears, breaks and leaves its
   * logs; a bleed bleeds), then its end (what burnt out is ash) — the clock set back to that tick and each event with
   * its own dice (clockEvent), so it rolls as it would have in play; what one starts (a fire caught next door, a crop's
   * next stage) runs from then and is caught up in turn. A status without an end is a state, not a process: it waits
   * with its map, as a period does. Left out: the one at the keys and what they carry (their clock ran where they
   * were). The cost is the ticks at which a pulse could act or a status ends (a pulse no rule acts on brings no tick,
   * `RuleLibrary.mayDo`), at most CATCH_UP_BUDGET of them: past it the rest is summed up (the ends still due run at
   * the next tick).
   */
  private catchUp(map: string, since: number): void {
    const w = this.world
    const now = w.state.tick
    // what slept with the map: all but the one at the keys and what they carry
    const slept = (e: Entity): boolean => {
      for (let x: Entity | undefined = e, i = 0; x && i < 32; i++) {
        if (x.id === w.state.player) return false
        x = x.place.on === 'inside' || x.place.on === 'hand' ? w.get(x.place.holder) : undefined
      }
      return true
    }
    try {
      for (let n = 0, t = since; n < CATCH_UP_BUDGET; n++) {
        t = this.nextDue(map, t, slept)
        if (t > now) break
        w.state.tick = t
        this.statusesOn(map, slept)
      }
    } finally {
      w.state.tick = now
    }
  }

  /** The first tick after `after` at which a status on a map ends or pulses with something to do (Infinity: none). */
  private nextDue(map: string, after: number, slept: (e: Entity) => boolean): number {
    const w = this.world
    let due = Infinity
    for (const key of w.statusfulOn(map)) {
      const ref = w.keyRef(key)
      const e = w.get(ref.e)
      if (!e?.statuses || w.refPos(ref)?.map !== map || !slept(e)) continue
      const names = Object.keys(e.statuses)
      const may = this.lib.mayAnswerHaving('time/period', e.type, names)
      let view: View | undefined
      for (const status of names) {
        const exp = e.statuses[status]
        if (exp === NO_EXPIRY) continue
        // (one that fell due as the last tick ran, set then, ends at the next, as in play)
        due = Math.min(due, Math.max(exp, after + 1))
        if (!may) continue
        // with a pace of its own: every `every` ticks counted back from its end, the last as it ends; else on the clock's beat, until it ends
        const every = w.onto.status(status)?.every
        const at = every ? exp - every * Math.floor((exp - after - 1) / every) : (Math.floor(after / STATUS_TICK_EVERY) + 1) * STATUS_TICK_EVERY
        if (at > after && at < due && (every ? at <= exp : at < exp) && this.lib.mayDo('time/period', (view ??= w.view(ref)), { status })) due = at
      }
    }
    return due
  }

  /**
   * One event of a thing's own clock — a status's pulse or its end — run through with its chain before anything else
   * is: with dice of its own (the world's seed, the thing, the status, the tick), so it rolls the same whether its map
   * was in play or catches up when entered, whatever the world drew in between. On entering inside an outcome (a
   * portal's step), what that outcome has set off waits until it is done.
   */
  private clockEvent(ref: Ref, status: string, what: 'pulse' | 'end', f: () => void): void {
    const w = this.world
    const rng = w.state.rng
    const queued = this.q.splice(0)
    const outcomes = this.outcomes.splice(0)
    w.state.rng = seedOf(w.state.seed, ref.e, status, what, w.state.tick)
    try {
      f()
      if (this.flushing) this.drain()
    } finally {
      w.state.rng = rng
      this.q.unshift(...queued)
      this.outcomes.push(...outcomes)
    }
  }

  // ---------------------------------------------------------------- combat

  /** The player attacks with the held item (or bare hands): at a chosen target next to them, or along the facing direction. */
  playerAttack(target?: Ref, whiff = false): void {
    const w = this.world
    const p = w.player
    if (this.busy(p) || !this.ready('atk:' + p.id)) return
    if (!this.attack(p, target, whiff)) {
      // a weapon that is not one's to fight with (another profession's): said once per press, then the key rests a moment
      const weapon = weaponOf(w, p)!
      const why = this.combat.refuses(p, weapon, 'fight')
      if (why) w.fx.push({ t: 'log', text: why, tone: 'warn' })
      this.setCooldown('atk:' + p.id, 10)
      return
    }
    this.setCooldown('atk:' + p.id, this.combat.delay(p, 5, 'attack'))
  }

  /**
   * A blow (or a cast) along the facing: aiming is the input's; what the blow does is the act's
   * outcome. False when it cannot be made: the held weapon belongs to another profession. A `whiff` (the inputs' swing at
   * the air in a fight, design.md §5.2) strikes only a body on its way: never what stands there, never the ground.
   */
  attack(a: Entity, chosen?: Ref, whiff = false): boolean {
    const w = this.world
    // the weapon in the hand, else the one kept in the main hand (a torch held, the sword still strikes)
    const weapon = weaponOf(w, a)
    if (weapon && this.combat.refuses(a, weapon, 'fight')) return false
    // a weapon's reach; without one, the actor's own (a dragon's breath carries); a profession may lengthen it
    const range = this.reachOf('use', a, undefined, weapon) ?? 1
    const element = (weapon && (w.prop(weapon, 'element') as string | undefined)) || (w.prop(a, 'element') as string | undefined)
    const start = w.posOf(a)
    if (!start) return true
    // (one's own side, in a fight: the blow goes past them, a swing at the air)
    if (this.spares(a, chosen)) (chosen = undefined), (whiff = true)
    const aimed = this.blowAt(a, weapon, range, chosen, whiff)
    if (!aimed) return true
    const { target, last } = aimed
    const victim = target && 'e' in target ? w.get(target.e) : undefined
    if (victim && this.isProtected(victim)) {
      this.refuseProtection(a.id)
      return true
    }
    const base = w.stat(a, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
    // a blow from afar flies: a bolt of its element, or what the weapon looses (its `missile`: a bow's arrow)
    const missile = weapon && w.prop(weapon, 'missile')
    if (!target) {
      // a swing at the air is seen as one: the blade's arc, the bolt as far as it flies
      if (whiff) w.fx.push(range > 1 && last ? { t: 'vfx', fx: `bolt:${element ?? 'none'}:${a.facing}:${Math.abs(last.x - start.x) + Math.abs(last.y - start.y)}${typeof missile === 'string' ? `:${missile}` : ''}`, map: start.map, x: start.x, y: start.y, who: a.id } : { t: 'vfx', fx: `swing:${a.facing}`, map: start.map, x: start.x, y: start.y, who: a.id })
      this.combat.struck(a, undefined, { power: base }, 0, range, true)
      return true
    }
    if (range > 1 && last && (last.x !== start.x || last.y !== start.y)) w.fx.push({ t: 'vfx', fx: `bolt:${element ?? 'none'}:${a.facing}:${Math.abs(last.x - start.x) + Math.abs(last.y - start.y)}${typeof missile === 'string' ? `:${missile}` : ''}`, map: start.map, x: start.x, y: start.y, who: a.id })
    else w.fx.push({ t: 'vfx', fx: `swing:${a.facing}`, map: start.map, x: start.x, y: start.y, who: a.id })
    // the attacker's talents shape the blow (combat.ts): its power, a critical; the act carries it
    const before = victim ? w.num(victim, 'hp') : 0
    const strike = this.combat.strike(a, victim, base, range, weapon, true)
    this.act('use', a.id, target, { instrument: weapon ? { e: weapon.id } : null, params: { attack: true, ...strike.params, power: strike.power } })
    this.combat.struck(a, victim, strike, before, range, true)
    // what else the blow lands on (a sweep's sides): each its own blow, of its power alone
    for (const side of this.combat.besides(a, victim, range)) {
      if (this.isProtected(side) || this.spares(a, side)) continue
      const sideHp = w.num(side, 'hp')
      const sideStrike = this.combat.strike(a, side, base, range, weapon, false)
      this.act('use', a.id, { e: side.id }, { instrument: weapon ? { e: weapon.id } : null, params: { attack: true, power: sideStrike.power } })
      this.combat.struck(a, side, sideStrike, sideHp, range, false)
    }
    return true
  }

  /**
   * Where a blow along the facing lands: the first body on its way, else what stands there and cannot be carried,
   * else the top of the last cell it reaches; the chosen target when it lies on the way. None when it cannot be made
   * there (the chosen one out of reach, or off the bolt's way). A `whiff` lands only on a body on its way.
   */
  private blowAt(a: Entity, weapon: Entity | undefined, range: number, chosen?: Ref, whiff = false): { target?: Ref; last?: Pos } | undefined {
    const w = this.world
    const start = w.posOf(a)
    if (!start) return undefined
    const cp = chosen && w.refPos(chosen)
    if (chosen && (!cp || !this.inReach('use', a, chosen, weapon ? { e: weapon.id } : undefined))) return undefined
    const [dx, dy] = DIRS[a.facing ?? 'down']
    let target: Ref | undefined
    let last: Pos | undefined
    for (let i = 1; i <= range; i++) {
      const x = start.x + dx * i
      const y = start.y + dy * i
      if (!w.inBounds(start.map, x, y)) break
      last = { ...start, x, y }
      // a body first, then what stands there and cannot be carried (a blow on the well is a blow on the well)
      // (the ground of a cell is not in the way: a blow goes on to what the cell's top is, where it stops)
      const body = w.actorAt(start.map, x, y, a.id, start.z)
      // (one's own side, in a fight, is passed over: the blow goes on to what is beyond them)
      if (body && this.spares(a, body)) continue
      const victim = body ?? (whiff ? undefined : w.entitiesAt(start.map, x, y, start.z).find((e) => !w.isAgent(e) && !w.isPortable(e) && !w.isTerrain(e)))
      if (victim) {
        target = { e: victim.id }
        break
      }
      if (w.blocked(start.map, x, y, undefined, start.z)) break
    }
    if (!target && last && !whiff) {
      const top = w.cellTop(last.map, last.x, last.y, last.z)
      if (top) target = { e: top.id }
    }
    // a melee blow on the layer the player chose; a cast at a tile the player chose lands there when it lies on the bolt's way
    if (chosen && cp) {
      const d = Math.abs(cp.x - start.x) + Math.abs(cp.y - start.y)
      const onRay = cp.x - start.x === dx * d && cp.y - start.y === dy * d
      if (range <= 1 || d === 0) (target = chosen), (last = cp)
      else if (onRay && last && d <= Math.abs(last.x - start.x) + Math.abs(last.y - start.y)) (target = chosen), (last = cp)
      else return undefined
    }
    return { target, last }
  }

  /**
   * What a blow along the facing (attack) would weigh on the striker's conscience: on what it lands on and on what
   * its sweep's sides land on, each a `use` with `attack` (guilt); a `whiff`, on the body on its way. Nothing is
   * written, nothing rolled.
   */
  blowGuilt(a: Entity, chosen?: Ref, whiff = false): (Sin & { target: Ref }) | undefined {
    const w = this.world
    const weapon = weaponOf(w, a)
    if (weapon && this.combat.refuses(a, weapon, 'fight')) return undefined
    const range = this.reachOf('use', a, undefined, weapon) ?? 1
    if (this.spares(a, chosen)) (chosen = undefined), (whiff = true)
    const target = this.blowAt(a, weapon, range, chosen, whiff)?.target
    const victim = target && w.get(target.e)
    if (!target || !victim || this.isProtected(victim)) return undefined
    const instrument = weapon ? { e: weapon.id } : null
    const struck = [victim, ...this.combat.besides(a, victim, range).filter((s) => !this.isProtected(s) && !this.spares(a, s))]
    const sin = joinSins(struck.map((v) => this.guilt('use', a.id, { e: v.id }, { instrument, params: { attack: true } })))
    return sin && { ...sin, target }
  }

  /** The `lightning` primitive: a bolt seeks what stands tall near the player (four times in five, as lightning does), or falls near them. */
  lightning(power: number, ev: GameEvent): void {
    const w = this.world
    const active = this.activeMap
    const p = w.posOf(w.player)
    if (!p) return
    const tall = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && w.hasTag(e, 'tall') && Math.max(Math.abs(e.place.x - p.x), Math.abs(e.place.y - p.y)) <= 12)
    let target: Ref
    if (tall.length && w.rand() < 0.8) target = { e: tall[Math.floor(w.rand() * tall.length)].id }
    else {
      const x = p.x + Math.round((w.rand() - 0.5) * 12)
      const y = p.y + Math.round((w.rand() - 0.5) * 12)
      if (!w.inBounds(active, x, y)) return
      const top = w.cellTop(active, x, y)
      if (!top) return
      target = { e: top.id }
    }
    const at = w.refPos(target)!
    w.fx.push({ t: 'strike', map: active, x: at.x, y: at.y })
    this.queue({ kind: 'impulse/element', host: target, roles: { source: ev.host }, params: { element: 'lightning', power }, origin: 'world', depth: (ev.depth ?? 0) + 1 })
  }

  // ---------------------------------------------------------------- the clock

  tick(): void {
    const w = this.world
    const s = w.state
    s.tick += 1
    const active = this.activeMap
    if (this.later.length) {
      const deferred = this.later.splice(0)
      for (const ev of deferred) this.queue({ ...ev, depth: 0 })
    }
    // a waiting chain is forgotten a minute after it began (it has ended, or it was stopped)
    if (s.tick % 60 === 0) for (const [id, c] of this.chains) if (s.tick - c.since > 600) this.chains.delete(id)
    this.statusTick(active)
    for (const h of this.hooks.tick) if (h.phase === 'status') h.run(active)
    this.periodTick(active)
    this.stayTick(active)
    // everyone's behaviour, one goal system (world-model.md §6.10): their moves and blows are acts
    this.behaviour.tick(active)
    // what the modules do after everyone's turn (the people look about them, and talk among themselves)
    for (const h of this.hooks.tick) if (h.phase === 'behaviour') h.run(active)
    this.undefinedSink?.tick()
    this.controls.magnet()
    this.invariantTick()
    this.story.tick()
    this.quests.tick()
    this.quests.flush()
    this.flush()
    this.controls.keep()
    // a long step's time passes now, all at once; harm stops it (world-model.md §6.11)
    if (this.fastForward > 0) {
      const total = this.fastForward
      const n = Math.min(total, this.fastForwardChunk ?? total)
      this.fastForward = 0
      const p = this.world.player
      const hp = w.num(p, 'hp')
      let stopped = false
      // what was said and shown while the time went by was not seen (one slept, walked, sat in the cells)
      const heard = w.fx.length
      for (let i = 0; i < n; i++) {
        this.tick()
        if (w.num(p, 'hp') < hp) {
          stopped = true
          // asleep, one wakes (hunger, or something at one's bed); on the road, one stops
          const asleep = w.hasStatus({ e: p.id }, 'asleep')
          if (asleep) this.write(() => w.clearStatus({ e: p.id }, 'asleep'))
          // why one woke: a module's word (hunger), else the hurt
          const why = asleep ? this.hooks.woke.map((f) => f(p)).find(Boolean) : undefined
          w.fx.push({
            t: 'log',
            text: !asleep ? { en: 'Hurt, you stop on the way.', zh: '你受了伤，停下了脚步。' } : why ?? { en: 'Something hurts you awake.', zh: '你被疼醒了。' },
          })
          break
        }
      }
      w.fx = [...w.fx.slice(0, heard), ...w.fx.slice(heard).filter((f) => f.t !== 'say' && f.t !== 'emote')]
      // what is left passes in the next ticks, unless harm stopped it (or another long step began)
      if (!stopped && this.fastForward === 0) this.fastForward = total - n
    }
  }

  /** A status's pulse: a time/period event (its actor: who gave it). */
  private pulse(ref: Ref, status: string): void {
    const roles = this.givenBy(ref, status)
    this.offer({ kind: 'time/period', host: ref, roles, params: { status }, cause: roles.actor && 'e' in roles.actor ? roles.actor.e : undefined, origin: 'world' })
  }

  /** A status runs out (the clock clears it): a time/timer event (its actor: who gave it). */
  private expire(ref: Ref, status: string): void {
    const w = this.world
    const at = w.statusesOf(ref)?.[status] ?? w.state.tick
    const roles = this.givenBy(ref, status)
    this.write(() => w.clearStatus(ref, status))
    this.offer({ kind: 'time/timer', host: ref, roles, params: { status, at }, cause: roles.actor && 'e' in roles.actor ? roles.actor.e : undefined, origin: 'world' })
  }

  /** The roles of a status's time events: who gave it, while they are still about. */
  private givenBy(ref: Ref, status: string): GameEvent['roles'] {
    const by = this.world.statusBy(ref, status)
    return by && this.world.get(by) ? { actor: { e: by } } : {}
  }

  private statusTick(active: string): void {
    this.statusesOn(active)
  }

  /**
   * A map's statuses at this tick, thing by thing as they stand when it begins: each pulses as its pace says (a
   * time/period event) and ends when its time has come (a time/timer); the resident hosts' too (their clock runs
   * wherever the one at the keys is). `slept`: the map is catching up (catchUp) — only what slept with it, and only
   * the statuses that end (one without an end waits).
   */
  private statusesOn(map: string, slept?: (e: Entity) => boolean): void {
    const w = this.world
    const t = w.state.tick
    for (const key of w.statusfulOn(map)) {
      const ref = w.keyRef(key)
      const pos = w.refPos(ref)
      // a resident's clock runs wherever the one at the keys is (a quest's deadline, docs/quests.md)
      const host = 'e' in ref ? w.get(ref.e) : undefined
      const resident = !slept && !pos && !!host && w.isPlaceless(host)
      if (!resident && (!pos || pos.map !== map)) continue
      if (slept && host && !slept(host)) continue
      const bag = w.statusesOf(ref)
      if (!bag) continue
      for (const [status, exp] of Object.entries(bag)) {
        if (slept && exp === NO_EXPIRY) continue
        // a status with a pace of its own pulses every `every` ticks counted back from its end, the
        // last pulse as it ends (a four-second bleed bleeds four times); the rest every half second
        const every = w.onto.status(status)?.every
        const ends = exp !== NO_EXPIRY && exp <= t
        const pulse = every && exp !== NO_EXPIRY ? exp >= t && (exp - t) % every === 0 : !ends && t % (every ?? STATUS_TICK_EVERY) === 0
        if (pulse) this.clockEvent(ref, status, 'pulse', () => this.pulse(ref, status))
        if (ends) this.clockEvent(ref, status, 'end', () => this.expire(ref, status))
      }
    }
  }

  /** The declared clocks (hunger, vitals, the ground's yield, the weather): a time/period event each. */
  private periodTick(active: string): void {
    const w = this.world
    const t = w.state.tick
    for (const p of w.onto.data.periods ?? []) {
      // a host may keep its own pace (everyProp, paceBy): the period comes on as its pace is each tick
      // (hunger: hungry, or asleep, slower), what it has come carried over a change of pace — never at
      // once on a change, never a stretch at the old pace after it; the first on the clock's own beat
      const own = !!p.everyProp || !!p.paceBy || !!p.kept
      if (!own && t % p.every !== 0) continue
      // hosts back from away that had the slot of their day that sees to what this clock brings (a meal)
      const tended: Ref[] = []
      const comes = (e: Entity): boolean => {
        const every = Math.max(1, Math.round((p.everyProp ? w.num(e, p.everyProp, p.every) : p.every) * this.paceOf(p, e)))
        const k = `${p.name}|${e.id}`
        // first seen: as far as the clock's own beat has come; then the ticks gone by (a jump of the
        // clock, a step on the overworld, counts too: one a tick until it has caught up)
        // how far it has come toward its next: the ticks gone by since, over its interval as its pace is now (kept
        // with the state, `paces`, so a loaded save keeps its phase)
        const paces = (w.state.paces ??= {})
        let was = paces[k] ?? { done: (((t - 1) % every) + every) % every / every, at: t - 1 }
        // back from away past a slot of its day that sees to it (a meal had at home): the time away runs from there
        const fed = p.tendedBy && paces[k] && t - was.at > 1 ? this.wellbeing.tendedSince(e, p.tendedBy, was.at) : undefined
        if (fed !== undefined) (tended.push({ e: e.id }), (was = { done: 0, at: fed }))
        const done = was.done + (t - was.at) / every
        if (done < 1 - 1e-9) return ((paces[k] = { done, at: t }), false)
        paces[k] = { done: Math.max(0, done - 1), at: t }
        return true
      }
      const hosts: Ref[] =
        p.host === 'world' || p.host === 'story'
          ? [{ e: p.host }]
          : w
              .entitiesOnMap(active)
              .filter((e) => e.place.on === 'tile' && (!(p.host as import('./types.ts').Selector).type || isA(e.type, (p.host as import('./types.ts').Selector).type!)) && matchSelector(p.host as import('./types.ts').Selector, w.view({ e: e.id })))
              .filter((e) => (own ? comes(e) : true))
              .map((e) => ({ e: e.id }))
      for (const h of tended) this.offer({ kind: 'time/period', host: h, roles: {}, params: { name: p.name, tended: p.tendedBy! }, origin: 'world' })
      for (const h of hosts) this.offer({ kind: 'time/period', host: h, roles: {}, params: { name: p.name }, origin: 'world' })
    }
  }

  /** How much slower a period comes to a host for the statuses it has, each one's factor in turn (asleep: hunger four times slower; hungry as well: slower still). */
  private paceOf(p: { paceBy?: Record<string, number> }, e: Entity): number {
    let k = 1
    for (const [s, f] of Object.entries(p.paceBy ?? {})) if (this.world.hasStatus({ e: e.id }, s)) k *= f
    return k
  }

  /** Contact that lasts: a contact/stay event now and then, for hosts that answer it. */
  private stayTick(active: string): void {
    const w = this.world
    if (w.state.tick % STAY_EVERY !== 0) return
    const rel = w.state.relations ?? {}
    for (const e of w.entitiesOnMap(active)) {
      const ks = rel[e.id]
      if (!ks) continue
      const mine = this.lib.mayAnswer('contact/stay', e.type)
      for (const k of ks) {
        const i = k.indexOf('|')
        const how = k.slice(0, i)
        const to = k.slice(i + 1)
        const other = w.keyRef(to)
        if (mine) this.offer({ kind: 'contact/stay', host: { e: e.id }, roles: { other }, params: { how }, origin: 'world' })
        // (a floor's key names its type: a cell of the map's data no rule could answer, by its type and its tags, is passed over unread)
        const h = to.indexOf('#')
        if (h >= 0 && !w.state.entities[other.e]) {
          const type = to.slice(h + 1)
          if (!this.lib.mayAnswer('contact/stay', type, w.onto.resolve(type).tags)) continue
        }
        const o = w.get(other.e)
        if (o && o.place.on !== 'none') this.offer({ kind: 'contact/stay', host: other, roles: { other: { e: e.id } }, params: { how: REVERSE[how] ?? how }, origin: 'world' })
      }
    }
  }

  /** Content the world must keep playable: a broken invariant is a `broken` event for the story, once. */
  private invariantTick(): void {
    const w = this.world
    if (w.state.tick % INVARIANT_EVERY !== 0 || !w.get(STORY)) return
    for (const inv of this.invariants) {
      if (w.state.reported?.includes(inv.id)) continue
      // content not in play yet: its giver's map is not loaded (the player is still on the mountain)
      const at = inv.giver ? w.posOf(w.get(inv.giver)) : undefined
      if (inv.giver && (!at || !w.map(at.map))) continue
      if (inv.when && !evalCond(inv.when, {}, w)) continue
      if (evalCond(inv.holds, {}, w)) continue
      // the detector's own record (not the story's): reported once
      ;(w.state.reported ??= []).push(inv.id)
      const giver: Ref | undefined = inv.giver && w.get(inv.giver) ? { e: inv.giver } : undefined
      this.queue({ kind: 'broken', host: { e: STORY }, roles: giver ? { target: giver } : {}, params: { invariant: inv.id }, origin: 'world' })
    }
  }

  // ---------------------------------------------------------------- chunks

  /**
   * A map's file has come: its data, and its things — made the first time, brought back as they were when the map was
   * put away (sparse.ts) — before what the data starts (its areas, the clocks of what is in a stage).
   */
  loadChunk(chunk: MapChunk): void {
    const s = this.world.state
    s.maps[chunk.map.id] = chunk.map
    this.write(() => this.chunks.arrive(chunk))
    this.mapArrived(chunk.map.id)
    // a map as it was made, or as it was put away (a save leaves its relations out): where it starts, not events
    this.diffMap(chunk.map.id, true)
    // the step through a portal that waited for this map ends here (its outcome, finished on loading)
    if (this.pendingTransition?.map === chunk.map.id) {
      const to = this.pendingTransition
      this.pendingTransition = undefined
      const p = this.world.player
      this.write(() => this.teleport(p, to.entry ? this.entryPoint(p, to.map, to.entry) : to))
    }
  }

  // ---------------------------------------------------------------- names

  nameOf(ref: Ref | undefined, locale: 'en' | 'zh' = 'en'): string {
    if (!ref) return ''
    const w = this.world
    const e = w.get(ref.e)
    if (!e) return ''
    if (e.id === w.state.player) return locale === 'zh' ? '你' : 'you'
    const name: Text | undefined = e.name ?? w.onto.resolve(e.type).name ?? e.type.split('/').pop()!.replace(/_/g, ' ')
    return textOf(name, locale)
  }
}

export function textOf(t: Text | undefined, locale: 'en' | 'zh' = 'en'): string {
  if (t === undefined) return ''
  if (typeof t === 'string') return t
  // (an empty translation is none: the English stands in, not a blank)
  return (locale === 'zh' && t.zh?.trim() ? t.zh : undefined) ?? t.en
}
