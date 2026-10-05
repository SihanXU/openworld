// The engine (design.md §5.4–5.12): every happening is an event, and every event has one
// outcome, resolved the same way — the most specific rule of its host, walked to a leaf. Where
// the outcome is undefined, the Mod port is asked; with no one to ask, the leaf's default runs.
// The engine also keeps time (timers, periods), the relations between things (contact and
// containment, diffed after every outcome), sight, and the active, dormant and resident parts of
// the world. Pure, deterministic, no AI.

import { TICKS_PER_HOUR, TICKS_PER_MINUTE, isNight } from './calendar.ts'
import { EffectRunner } from './effects.ts'
import { Controls } from './controls.ts'
import { Story } from './story.ts'
import { deriveRecipes } from './recipes.ts'
import { Behaviour } from './behaviour.ts'
import { combatDamage, combatDelay, combatStrike, finishCombatStrike, rangeBonus, recordCombatStep } from './combat.ts'
import { Companions } from './companion.ts'
import { Quests } from './quests.ts'
import { NpcSim, scheduleAt } from './npc.ts'
import { scheduleFor } from './people.ts'
import { OntologyIndex } from './ontology.ts'
import { appearFromForage } from './appear.ts'
import { RuleLibrary, evalCond, isDo, matchSelector, rolesOf, type Resolution } from './rules.ts'
import type { BossDef, Dir, Effect, Entity, EventKind, GameEvent, Id, Invariant, MapData, Ontology, Pos, PropValue, Recipe, Ref, SkillDef, Text, Verb, WorldState } from './types.ts'
import type { ProfessionDef } from './profession.ts'
import { DIRS, FIRE_RADIUS } from './types.ts'
import { NO_EXPIRY, REVERSE, World, refKey, regionId, tileKey, type Writer } from './world.ts'

export type { Resolution } from './rules.ts'

/** Receives undefined outcomes. Implemented by the Mod port (mod.ts). */
export interface UndefinedSink {
  /**
   * An outcome is undefined (design.md §5.11). True when it is held while someone works it out;
   * false when the leaf's default should run now (no one to ask, already asked, given up).
   */
  raise(ev: GameEvent, res: Resolution): boolean
  tick(): void
  /** Called with every defined act the player made, e.g. to build a regression set. */
  observe?(ev: GameEvent, rule: string): void
}

export interface MapChunk {
  map: MapData
  entities: Entity[]
}

const STATUS_TICK_EVERY = 5
const STAY_EVERY = 5
/** Events handled in one flush; the rest wait for the next tick. */
const EVENT_BUDGET = 600
/** How deep a chain runs within one tick before the rest is deferred to the next (design.md §5.10). */
const MAX_DEPTH = 12
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
}
export const WORLD_HOST = 'world'

const OPAQUE_TERRAIN = ['wall', 'tree', 'rock', 'roof']

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
  /** Everyone's goals (behaviour.ts). */
  behaviour: Behaviour
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
  professions = new Map<string, ProfessionDef>()
  undefinedSink?: UndefinedSink
  /** Encounter mechanics supplied by the world, never imported from content (bosses.ts). */
  bossKits: Record<string, BossDef> = {}
  /** Companions and the tutorial's beats (companion.ts), quests (quests.ts). */
  companions: Companions
  quests: Quests
  /** Portal graph of every map (loaded or not): map -> outgoing portals. */
  graph: Record<string, { to: string; x: number; y: number; tx: number; ty: number }[]> = {}
  /** Set when the player walked into a portal whose map isn't loaded yet. */
  pendingTransition?: { map: string; x: number; y: number; entry?: Entry }
  /** Ticks to run at once at the end of this tick: a long step (the overworld) passing (world-model.md §6.11). */
  private fastForward = 0
  /** Resolution trace of the last dispatched events (for tests and the dev panel). */
  trace: { ev: GameEvent; rule?: string; defined: boolean }[] = []
  /** How many entries the trace has ever taken (it keeps only the last 300): what came after a mark is the last `traced - mark`. */
  traced = 0

  private q: GameEvent[] = []
  /** Events deferred to the next tick: too deep in their chain, over the budget, or for a held host. */
  private later: GameEvent[] = []
  /** Who each mover has been pushing into, since when (a swap once it has lasted): by the mover's id. */
  private bumps = new Map<Id, { id: Id; since: number; last: number }>()
  private cooldowns = new Map<Id, number>()
  private flushing = false
  /** What outcomes touched since the last settle: ref key → ref. */
  private touched = new Map<string, Ref>()

  constructor(state: WorldState, ontology: Ontology, lib: RuleLibrary) {
    const onto = new OntologyIndex(ontology)
    for (const t of lib.types) onto.addType(t)
    for (const s of lib.statuses) onto.addStatus(s)
    this.world = new World(state, onto)
    this.write = this.world.grant()
    this.world.author = (f) => this.write(f)
    this.lib = lib
    this.effects = new EffectRunner(this)
    this.npcs = new NpcSim(this)
    this.behaviour = new Behaviour(this)
    this.story = new Story(this)
    this.companions = new Companions(this)
    this.quests = new Quests(this)
    this.controls = new Controls(this, this.write)
    // what can be made: every type with a station and a makeup (world-model.md §6.4)
    for (const r of deriveRecipes(onto)) this.recipes.set(r.id, r)
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

  /** The world and the story exist (design.md §5.5): made on a new game, and for older saves. */
  ensureResidents(): void {
    const w = this.world
    this.write(() => {
      if (!w.get(WORLD_HOST)) w.add({ id: WORLD_HOST, type: 'resident/world', place: { on: 'resident' } })
      if (!w.get(STORY)) w.add({ id: STORY, type: 'resident/story', place: { on: 'resident' } })
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
      for (const [name, r] of named) w.add({ id: regionId(map, name), type: 'region', place: { on: 'area', map, rects: [r] } })
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
    if ((ev.depth ?? 0) > MAX_DEPTH) {
      this.later.push({ ...ev, depth: 0 })
      return
    }
    this.q.push(ev)
    if (!this.flushing) this.flush()
  }

  /** Make an event only if its host could do anything with it (no-change roots make none). */
  offer(ev: GameEvent): void {
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
        this.later.push(...this.q.splice(0))
        break
      }
      this.dispatch(this.q.shift()!)
    }
  }

  /** Resolve one event and run its outcome (design.md §5.6). */
  dispatch(ev: GameEvent): Resolution {
    const w = this.world
    ev.tick = w.state.tick
    const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
    if ('e' in ev.host && (!host || host.place.on === 'none')) return { defined: false }
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
      this.later.push(ev)
      return { defined: false }
    }
    const res = this.resolveEvent(ev)
    if (this.trace.length > 300) this.trace.shift()
    this.trace.push({ ev, rule: res.rule?.id, defined: res.defined })
    this.traced++
    if (res.defined && res.leaf && isDo(res.leaf)) this.run(res.leaf.do, ev, res.rule!.id)
    else if (res.hole) {
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
    const res = this.lib.resolve(ev, rolesOf(ev, w), w)
    if (!this.running) w.state.rng = saved
    return res
  }

  /** True while an outcome is being dispatched (its randomness is real, not a dry run's). */
  private get running(): boolean {
    return this.flushing || this.dispatching > 0
  }
  private dispatching = 0
  /** Undefined outcomes reached so far (an act's seers learn whether anything in its chain was). */
  private holes = 0

  /** Run an outcome's effects, then settle the relations they changed. */
  run(effects: Effect[], ev: GameEvent, ruleId: string): void {
    if (!effects.length) return
    this.write(() => this.effects.run(effects, ev, ruleId), ev.host)
    this.settle()
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

  /** Re-run an event whose outcome was undefined and is now defined (a late patch). */
  replay(ev: GameEvent): void {
    this.queue({ ...ev, depth: 0 })
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
  ): { defined: boolean; unknown: boolean; changes: boolean; rules: string[]; labels: { text: Text; rule: string }[]; confirm?: Text; hole?: { ev: GameEvent; res: Resolution } } {
    const res = this.resolveEvent(ev)
    const rules = res.rule ? [res.rule.id] : []
    const confirm = res.defined ? ((res.leaf && isDo(res.leaf) && res.leaf.confirm) || res.rule?.confirm) : undefined
    if (!res.defined || !res.leaf || !isDo(res.leaf)) return { defined: false, unknown: true, changes: false, rules, labels: [], confirm, hole: res.hole ? { ev, res } : undefined }
    // what this outcome says it does: its leaf's label, else its rule's
    const own = res.leaf.label ?? res.rule?.label
    const labels: { text: Text; rule: string }[] = own && res.rule ? [{ text: own, rule: res.rule.id }] : []
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
        if (p.unknown) unknown = true
        if (p.changes) changes = true
        hole ??= p.hole
      }
    return { defined: true, unknown, changes, rules, labels, confirm, hole }
  }

  // ---------------------------------------------------------------- acts (design.md §5.7)

  /** Whose a thing is: its own `owner` prop ('' = nobody's), or the owner of the container it lies in. */
  ownerOf(e: Entity): Id | undefined {
    const w = this.world
    const own = w.prop(e, 'owner')
    if (typeof own === 'string') return own || undefined
    if (e.place.on === 'inside') {
      const holder = w.get(e.place.holder)
      const h = holder && w.prop(holder, 'owner')
      if (typeof h === 'string' && h) return h
    }
    return undefined
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
    const ev = this.actEvent(verb, actorId, target, instrument, opts.params)
    // whose the thing was, before the act (a thing taken from her chest is hers until it is taken)
    const thing = 'e' in target ? w.get(target.e) : undefined
    const owner = thing ? this.ownerOf(thing) : undefined
    const holes = this.holes
    this.dispatching++
    let res: Resolution
    try {
      res = this.dispatch(ev)
    } finally {
      this.dispatching--
    }
    this.flush()
    if (res.defined && res.rule && ev.origin === 'player') this.undefinedSink?.observe?.(ev, res.rule.id)
    // what the seers see: the act, and whether the world had an answer for all it set going
    if (verb !== 'move' && verb !== 'craft' && verb !== 'learn') this.see(ev, res.defined && this.holes === holes, owner)
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
    if (verb === 'use') return (instrument ? w.num(instrument, 'range', reach) : w.num(actor, 'range', reach)) + rangeBonus(w, actor, instrument)
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
    const d = at && w.distance(at, t)
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
    if (!s || !isNight(w.hour()) || w.hasTag(e, 'nightsight')) return s
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
      if (w.entitiesAt(map, x, y).some((o) => w.hasTag(o, 'opaque') || w.hasTag(o, 'tall'))) return false
    }
    return true
  }

  /** Everyone who can see an act sees it, once it is resolved: a `seen` event each (if it could matter to them). */
  private see(ev: GameEvent, defined: boolean, owner: Id | undefined): void {
    const w = this.world
    const doer = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    const at = w.posOf(doer)
    if (!doer || !at) return
    for (const e of w.entitiesOnMap(at.map)) {
      // a seer is anything with sight of its own
      if (e.id === doer.id || e.place.on !== 'tile' || !(w.num(e, 'sight') > 0) || this.asleep(e) || this.busy(e)) continue
      const p = e.place
      if (Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) > this.sightOf(e, p)) continue
      if (!this.lineOfSight(at.map, p, at)) continue
      this.offer({
        kind: 'seen',
        host: { e: e.id },
        roles: { actor: ev.roles.actor, target: ev.roles.target, instrument: ev.roles.instrument },
        params: { act: String(ev.params?.verb ?? ''), owner: !owner ? 'nobody' : owner === e.id ? 'mine' : 'another', defined },
        cause: ev.cause,
        origin: ev.origin,
      })
    }
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
    if (t === 'wary' || (t === 'nocturnal' && !isNight(w.hour()))) return false
    const factions = w.onto.data.factions ?? {}
    const theirs = this.factionsOf(b)
    return this.factionsOf(a).some((f) => (factions[f]?.hostile ?? []).some((h) => theirs.includes(h)))
  }

  /** Where fire burns on a map: lit things and burning things and tiles. */
  fires(map: string): Pos[] {
    const w = this.world
    const out: Pos[] = []
    for (const key of w.statusful) {
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

  // ---------------------------------------------------------------- statuses, props, health

  /** A status taken on (from `by`, if someone gave it): its `clears` are lost, and a fresh one is a threshold/gain event. */
  applyStatus(ref: Ref, status: string, duration?: number, by?: Id): void {
    const w = this.world
    const def = w.onto.status(status)
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

  /** Set a prop; crossing a declared line downward is a threshold/cross event (design.md §5.7). */
  setProp(e: Entity, key: string, value: PropValue, by?: GameEvent): void {
    const w = this.world
    const before = w.num(e, key, Number.NaN)
    w.setProp(e, key, value)
    if (typeof value !== 'number') return
    for (const t of w.onto.data.thresholds ?? []) {
      if (t.prop !== key) continue
      // the one whose act brought it there (the last blow) is the event's actor, and what they struck with its instrument
      const actor = by?.roles.actor ?? (by?.cause ? { e: by.cause } : undefined)
      const instrument = actor ? by?.roles.instrument : undefined
      if (value <= t.lte && !(before <= t.lte)) this.queue({ kind: 'threshold/cross', host: { e: e.id }, roles: { ...(actor && { actor }), ...(instrument && { instrument }) }, params: { name: t.name, prop: key }, cause: by?.cause, origin: by?.origin })
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
    if (w.hasStatus({ e: e.id }, 'down')) return
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
    const dmg = combatDamage(this, e, Math.max(1, Math.round(amount - def)), attacker, !!pierce)
    // a blow that found nothing (dodged, or the moment after a dash)
    if (dmg <= 0) return
    w.fx.push({ t: 'damage', who: e.id, amount: dmg, element })
    // what has durability starts whole: its hp is its maxHp until it is struck
    let hp = w.num(e, 'hp', w.num(e, 'maxHp', 1)) - dmg
    // Phoenix (the skill): once a day, any lethal damage leaves 30% health and a moment untouchable
    if (hp <= 0 && w.hasTag(e, 'skill:phoenix') && w.prop(e, 'phoenixDay') !== w.calendar().day) {
      hp = Math.max(1, Math.ceil(w.num(e, 'maxHp', 1) * 0.3))
      w.setProp(e, 'phoenixDay', w.calendar().day)
      ;(e.combat ??= {}).guardUntil = w.state.tick + 30
      w.fx.push({ t: 'log', text: { en: 'Phoenix: you rise from a lethal blow.', zh: '涅槃：你从致命一击中重新站起。' }, tone: 'good' })
    }
    this.setProp(e, 'hp', hp, by)
    // what a landed blow carries beyond its harm (combat.ts): a wound that bleeds (from the one who
    // struck), and health drawn back to them — a restore they answer for themselves
    const bleed = by?.params?.bleed
    if (typeof bleed === 'number' && bleed > 0 && w.get(e.id)) this.applyStatus({ e: e.id }, 'bleeding', bleed, attacker?.id)
    const drain = by?.params?.drain
    if (typeof drain === 'number' && drain > 0 && attacker && attacker.id !== e.id)
      this.queue({ kind: 'impulse/restore', host: { e: attacker.id }, roles: { source: { e: e.id }, actor: { e: attacker.id } }, params: { which: 'hp', amount: drain }, cause: by?.cause, origin: by?.origin, depth: (by?.depth ?? 0) + 1 })
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
        for (const [h, ks] of Object.entries(rel)) if (ks.some((k) => w.keyRef(k.slice(k.indexOf('|') + 1)).e === r.e)) hosts.add(h)
    }
    const storeys = w.onto.data.params?.storeys ?? 4
    for (const t of tiles) {
      const [map, x, y] = t.split(':')
      for (let z = 0; z <= storeys; z++) for (const o of w.entitiesAt(map, +x, +y, z)) hosts.add(o.id)
    }
    for (const h of hosts) this.diff(h)
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
    if (how === 'in-region' && kind === 'contact/begin') this.story.entered(a)
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
    const nx = x + dx
    const ny = y + dy
    const isPlayer = e.id === w.state.player
    // a way the story has not opened yet is only ground
    const portalHere = w.map(map)?.portals.find((p) => p.x === nx && p.y === ny && (!p.opensWhen || !!w.fact(p.opensWhen)))
    // only the player uses portals by stepping on them; NPCs transfer from the tile beside
    if (portalHere && !isPlayer) return false
    // off the edge of a map that lies on the overworld: out onto its cell there (world-model.md §5.1)
    if (!w.inBounds(map, nx, ny) && isPlayer && w.map(map)?.site) {
      this.leaveByEdge(e, x, y, dir)
      return true
    }
    // storeys (world-model.md §5.2, §5.5): on a floor one walks; from stairs up onto the floor above;
    // onto the stairs below from above them; off a floor's edge one falls to the first below
    const z = e.place.z ?? 0
    const floorAt = (zz: number) => !!w.occupant(map, nx, ny, 'floor', zz)
    // stairs go up one way (their facing, north unless set): up from them only that way, down onto them only from their top
    const BACK: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    const stairsAt = (sx: number, sy: number, zz: number, way: Dir) => w.entitiesAt(map, sx, sy, zz).some((o) => w.hasTag(o, 'stairs') && (o.facing ?? 'up') === way)
    const climb = stairsAt(x, y, z, dir) && floorAt(z + 1)
    let nz = z
    let drop = 0
    if (!floorAt(z) || climb) {
      if (climb) nz = z + 1
      else if (z > 0 && stairsAt(nx, ny, z - 1, BACK[dir])) nz = z - 1
      else if (z > 0 && w.stanceOf(e) !== 'air') {
        nz = z - 1
        while (nz > 0 && !floorAt(nz)) nz--
        drop = z - nz
      }
    }
    // a cliff cannot be climbed: one bumps into it (what makes up the cell above)
    const over = z === 0 && nz === 0 ? w.stepOver(e, map, x, y, nx, ny) : ({ walk: true } as const)
    if ('climb' in over) {
      const cliff = w.cellTop(map, nx, ny)
      this.offer({ kind: 'bump', host: { e: e.id }, roles: cliff ? { other: { e: cliff.id } } : {}, params: { dir }, cause: ev.cause, origin: ev.origin })
      return false
    }
    // the one who pushed us to make way stands where we step: we take its cell as it takes ours
    const yielding = ev.params?.swap === true && ev.roles.source && 'e' in ev.roles.source && w.actorAt(map, nx, ny, undefined, nz)?.id === ev.roles.source.e
    if (!yielding && !w.fits(e, map, nx, ny, nz)) {
      const other = w.actorAt(map, nx, ny, undefined, nz)
      // the player, or a person on their way, pushing on into a person who is free: they swap places
      // (people yield to each other this way and never stand in one cell, world-model.md §5.2)
      if (!(isPlayer || e.npc) || !other?.npc || this.busy(other) || w.blocked(map, nx, ny, undefined, nz)) {
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
      const back: Dir = dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left'
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
    recordCombatStep(w, e)
    if (isPlayer && portalHere) this.travel(e, { map: portalHere.to, x: portalHere.tx, y: portalHere.ty })
    return true
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
   * left. A part the block does not show: its nearest open tile.
   */
  private leaveByEdge(e: Entity, x: number, y: number, dir: Dir): void {
    const w = this.world
    const map = w.map(w.posOf(e)!.map)!
    const site = map.site!
    const part = w.partAt(map.id, x, y)
    const at = [(x + 0.5) / map.width, (y + 0.5) / map.height]
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
    const rel: [number, number] = p ? [Math.min(1, Math.max(0, (p.x - bx + 0.5) / size)), Math.min(1, Math.max(0, (p.y - by + 0.5) / size))] : [0.5, 0.5]
    const tile: [number, number] = [Math.min(size - 1, Math.floor(rel[0] * size)), Math.min(size - 1, Math.floor(rel[1] * size))]
    const entry: Entry = { rel, tile, size }
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
    const part = w.regionPart(map, entry.tile[0], entry.tile[1], entry.size)
    const tx = entry.rel[0] * m.width
    const ty = entry.rel[1] * m.height
    let best: { x: number; y: number; d: number; same: boolean } | undefined
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        if (!w.fits(e, map, x, y)) continue
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
  movePlayer(dir: Dir, walk = false): boolean {
    const p = this.world.player
    if (!this.ready(p.id) || this.pendingTransition) {
      if (!this.busy(p)) p.facing = dir
      return false
    }
    const moved = this.step(p, dir)
    if (moved) this.setCooldown(p.id, combatDelay(this.world, p, this.world.num(p, 'speed', 2) + (walk ? 1 : 0), 'move'))
    return moved
  }

  travel(e: Entity, to: Pos): void {
    if (!this.world.map(to.map)) {
      this.pendingTransition = to
      return
    }
    this.teleport(e, to)
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
   * enter catches up: the timers that fell due while it slept, in time order; the events
   * addressed to it, in time order; its people, by their schedules; and the relation difference
   * over the whole map against what was kept.
   */
  enterMap(map: string, from?: string): void {
    const w = this.world
    const dormant = (w.state.dormant ??= {})
    if (from && from !== map) dormant[from] = { since: w.state.tick, inbox: dormant[from]?.inbox ?? [] }
    const rec = dormant[map]
    delete dormant[map]
    w.fx.push({ t: 'mapChanged', map })
    if (rec) {
      this.catchUp(map)
      for (const ev of rec.inbox.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))) this.queue({ ...ev, depth: 0 })
    }
    this.npcs.onEnterMap(map, from)
    this.diffMap(map, false)
    this.flush()
  }

  /** The one-shot timers that ran out on a map while it slept, in the order they ran out. */
  private catchUp(map: string): void {
    const w = this.world
    const now = w.state.tick
    for (let n = 0; n < EVENT_BUDGET; n++) {
      let due: { ref: Ref; status: string; at: number } | undefined
      for (const key of w.statusful) {
        const ref = w.keyRef(key)
        if (w.refPos(ref)?.map !== map) continue
        for (const [status, exp] of Object.entries(w.statusesOf(ref) ?? {}))
          if (exp !== NO_EXPIRY && exp <= now && (!due || exp < due.at)) due = { ref, status, at: exp }
      }
      if (!due) break
      this.expire(due.ref, due.status)
      // Entry may be inside an outcome: finish the timer's chain before looking for its next clock.
      this.drain()
    }
  }

  // ---------------------------------------------------------------- combat

  /** The player attacks with the held item (or bare hands): at a chosen target next to them, or along the facing direction. */
  playerAttack(target?: Ref): void {
    const w = this.world
    const p = w.player
    if (this.busy(p) || !this.ready('atk:' + p.id)) return
    this.attack(p, target)
    this.setCooldown('atk:' + p.id, combatDelay(w, p, 5, 'attack'))
  }

  /** A blow (or a cast) along the facing: aiming is the input's; what the blow does is the act's outcome. */
  attack(a: Entity, chosen?: Ref): void {
    const w = this.world
    const weapon = w.get(a.held)
    // a weapon's reach; without one, the actor's own (a dragon's breath carries); a profession may lengthen it
    const range = this.reachOf('use', a, undefined, weapon) ?? 1
    const element = (weapon && (w.prop(weapon, 'element') as string | undefined)) || (w.prop(a, 'element') as string | undefined)
    const start = w.posOf(a)
    if (!start) return
    const cp = chosen && w.refPos(chosen)
    if (chosen && (!cp || !this.inReach('use', a, chosen, weapon ? { e: weapon.id } : undefined))) return
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
      const victim = w.actorAt(start.map, x, y, a.id, start.z) ?? w.entitiesAt(start.map, x, y, start.z).find((e) => !w.isAgent(e) && !w.isPortable(e) && !w.isTerrain(e))
      if (victim) {
        target = { e: victim.id }
        break
      }
      if (w.blocked(start.map, x, y, undefined, start.z)) break
    }
    if (!target && last) {
      const top = w.cellTop(last.map, last.x, last.y, last.z)
      if (top) target = { e: top.id }
    }
    // a melee blow on the layer the player chose; a cast at a tile the player chose lands there when it lies on the bolt's way
    if (chosen && cp) {
      const d = Math.abs(cp.x - start.x) + Math.abs(cp.y - start.y)
      const onRay = cp.x - start.x === dx * d && cp.y - start.y === dy * d
      if (range <= 1 || d === 0) (target = chosen), (last = cp)
      else if (onRay && last && d <= Math.abs(last.x - start.x) + Math.abs(last.y - start.y)) (target = chosen), (last = cp)
      else return
    }
    const base = w.stat(a, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
    if (!target) {
      finishCombatStrike(w, a, undefined, { power: base, critical: false, charged: false, comboHits: 0, bleed: 0, drain: 0 }, 0, range, true)
      return
    }
    if (range > 1 && last && (last.x !== start.x || last.y !== start.y)) w.fx.push({ t: 'vfx', fx: `bolt:${element ?? 'none'}:${a.facing}:${Math.abs(last.x - start.x) + Math.abs(last.y - start.y)}`, map: start.map, x: start.x, y: start.y })
    else w.fx.push({ t: 'vfx', fx: `swing:${a.facing}`, map: start.map, x: start.x, y: start.y })
    // the attacker's talents shape the blow (combat.ts): its power, a critical; the act carries it
    const victim = 'e' in target ? w.get(target.e) : undefined
    const before = victim ? w.num(victim, 'hp') : 0
    const strike = combatStrike(w, a, victim, base, range, weapon, true)
    this.act('use', a.id, target, { params: { attack: true, power: strike.power, ...(strike.critical && { critical: true }), ...(strike.bleed && { bleed: strike.bleed }), ...(strike.drain && { drain: strike.drain }) } })
    finishCombatStrike(w, a, victim, strike, before, range, true)
    // a sweep (the skill): a melee blow also lands on the creatures on either side of the tile ahead
    if (range <= 1 && w.hasTag(a, 'skill:sweep'))
      for (const s of [1, -1]) {
        const x = start.x + dx + dy * s
        const y = start.y + dy + dx * s
        const side = w.inBounds(start.map, x, y) ? w.actorAt(start.map, x, y, a.id, start.z) : undefined
        if (!side || !w.hasTag(side, 'creature') || ('e' in target && target.e === side.id)) continue
        const sideHp = w.num(side, 'hp')
        const sideStrike = combatStrike(w, a, side, base, range, weapon, false)
        this.act('use', a.id, { e: side.id }, { params: { attack: true, power: sideStrike.power } })
        finishCombatStrike(w, a, side, sideStrike, sideHp, range, false)
      }
  }

  /** The `lightning` primitive: a bolt seeks what stands tall near the player (or falls near them). */
  lightning(power: number, ev: GameEvent): void {
    const w = this.world
    const active = this.activeMap
    const p = w.posOf(w.player)
    if (!p) return
    const tall = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && w.hasTag(e, 'tall') && Math.max(Math.abs(e.place.x - p.x), Math.abs(e.place.y - p.y)) <= 12)
    let target: Ref
    if (tall.length && w.rand() < 0.5) target = { e: tall[Math.floor(w.rand() * tall.length)].id }
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
    this.statusTick(active)
    this.periodTick(active)
    this.stayTick(active)
    // everyone's behaviour, one goal system (world-model.md §6.10): their moves and blows are acts
    this.behaviour.tick(active)
    this.undefinedSink?.tick()
    this.controls.magnet()
    this.invariantTick()
    this.story.tick()
    this.flush()
    // a long step's time passes now, all at once; harm stops it (world-model.md §6.11)
    if (this.fastForward > 0) {
      const n = this.fastForward
      this.fastForward = 0
      const p = this.world.player
      const hp = w.num(p, 'hp')
      for (let i = 0; i < n; i++) {
        this.tick()
        if (w.num(p, 'hp') < hp) {
          // asleep, one wakes (hunger, or something at one's bed); on the road, one stops
          const asleep = w.hasStatus({ e: p.id }, 'asleep')
          if (asleep) this.write(() => w.clearStatus({ e: p.id }, 'asleep'))
          const starving = w.num(p, 'hunger', 1) <= 0
          w.fx.push({
            t: 'log',
            text: !asleep ? { en: 'Hurt, you stop on the way.', zh: '你受了伤，停下了脚步。' } : starving ? { en: 'Hunger wakes you.', zh: '你被饿醒了。' } : { en: 'Something hurts you awake.', zh: '你被疼醒了。' },
          })
          break
        }
      }
    }
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
    const w = this.world
    const t = w.state.tick
    for (const key of [...w.statusful]) {
      const ref = w.keyRef(key)
      const pos = w.refPos(ref)
      if (!pos || pos.map !== active) continue
      const bag = w.statusesOf(ref)
      if (!bag) continue
      for (const [status, exp] of Object.entries(bag)) {
        // a status with a pace of its own pulses every `every` ticks counted back from its end, the
        // last pulse as it ends (a four-second bleed bleeds four times); the rest every half second
        const every = w.onto.status(status)?.every
        const ends = exp !== NO_EXPIRY && exp <= t
        const pulse = every && exp !== NO_EXPIRY ? exp >= t && (exp - t) % every === 0 : !ends && t % (every ?? STATUS_TICK_EVERY) === 0
        if (pulse) {
          const roles = this.givenBy(ref, status)
          this.offer({ kind: 'time/period', host: ref, roles, params: { status }, cause: roles.actor && 'e' in roles.actor ? roles.actor.e : undefined, origin: 'world' })
        }
        if (ends) this.expire(ref, status)
      }
    }
  }

  /** The declared clocks (hunger, vitals, the ground's yield, the weather): a time/period event each. */
  private periodTick(active: string): void {
    const w = this.world
    const t = w.state.tick
    for (const p of w.onto.data.periods ?? []) {
      // a host may keep its own pace (everyProp): the period comes to it on its own interval
      if (!p.everyProp && t % p.every !== 0) continue
      const hosts: Ref[] =
        p.host === 'world' || p.host === 'story'
          ? [{ e: p.host }]
          : w
              .entitiesOnMap(active)
              .filter((e) => e.place.on === 'tile' && matchSelector(p.host as import('./types.ts').Selector, w.view({ e: e.id })))
              .filter((e) => t % Math.max(1, (p.everyProp ? w.num(e, p.everyProp, p.every) : p.every) * this.paceOf(p, e)) === 0)
              .map((e) => ({ e: e.id }))
      for (const h of hosts) this.offer({ kind: 'time/period', host: h, roles: {}, params: { name: p.name }, origin: 'world' })
    }
  }

  /** How much slower a period comes to a host for the statuses it has (asleep: hunger four times slower). */
  private paceOf(p: { paceBy?: Record<string, number> }, e: Entity): number {
    let k = 1
    for (const [s, f] of Object.entries(p.paceBy ?? {})) if (this.world.hasStatus({ e: e.id }, s)) k = Math.max(k, f)
    return Math.round(k)
  }

  /** Contact that lasts: a contact/stay event now and then, for hosts that answer it. */
  private stayTick(active: string): void {
    const w = this.world
    if (w.state.tick % STAY_EVERY !== 0) return
    const rel = w.state.relations ?? {}
    for (const e of w.entitiesOnMap(active)) {
      for (const k of rel[e.id] ?? []) {
        const i = k.indexOf('|')
        const how = k.slice(0, i)
        const other = w.keyRef(k.slice(i + 1))
        this.offer({ kind: 'contact/stay', host: { e: e.id }, roles: { other }, params: { how }, origin: 'world' })
        if (w.view(other)) this.offer({ kind: 'contact/stay', host: other, roles: { other: { e: e.id } }, params: { how: REVERSE[how] ?? how }, origin: 'world' })
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

  loadChunk(chunk: MapChunk): void {
    const s = this.world.state
    s.maps[chunk.map.id] = chunk.map
    this.mapArrived(chunk.map.id)
    if (!s.loadedMaps.includes(chunk.map.id)) {
      s.loadedMaps.push(chunk.map.id)
      this.write(() => {
        for (const e of chunk.entities) if (!s.entities[e.id]) this.world.add(structuredClone(e))
      })
      // a map as it was made: its relations are where it starts, not events
      this.diffMap(chunk.map.id, true)
    }
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
  return (locale === 'zh' ? t.zh : undefined) ?? t.en
}
