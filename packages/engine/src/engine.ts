// The engine (design.md §5.4–5.12): every happening is an event, and every event has one
// outcome, resolved the same way — the most specific rule of its host, walked to a leaf. Where
// the outcome is undefined, the Mod port is asked; with no one to ask, the leaf's default runs.
// The engine also keeps time (timers, periods), the relations between things (contact and
// containment, diffed after every outcome), sight, and the active, dormant and resident parts of
// the world. Pure, deterministic, no AI.

import { isNight } from './calendar.ts'
import { EffectRunner } from './effects.ts'
import { Controls } from './controls.ts'
import { Scenes } from './scenes.ts'
import { stepCreatures } from './creatures.ts'
import { combatDamage, combatDelay, combatStrike, finishCombatStrike, rangeBonus, recordCombatStep } from './combat.ts'
import { Companions } from './companion.ts'
import { Quests } from './quests.ts'
import { stepBosses } from './bosses.ts'
import { NpcSim, scheduleAt } from './npc.ts'
import { scheduleFor } from './people.ts'
import { OntologyIndex } from './ontology.ts'
import { RuleLibrary, evalCond, isDo, matchSelector, rolesOf, type Resolution } from './rules.ts'
import type { BossDef, Dir, Effect, Entity, EventKind, GameEvent, Id, Invariant, MapData, Ontology, Pos, PropValue, Recipe, Ref, SkillDef, Text, Verb, WorldState } from './types.ts'
import type { ProfessionDef } from './profession.ts'
import { DIRS, FIRE_RADIUS } from './types.ts'
import { NO_EXPIRY, REVERSE, World, refKey, tileKey, type Writer } from './world.ts'

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
/** The resident hosts (design.md §5.5). */
export const STORY = 'story'
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
  scenes: Scenes
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
  pendingTransition?: { map: string; x: number; y: number }
  /** Resolution trace of the last dispatched events (for tests and the dev panel). */
  trace: { ev: GameEvent; rule?: string; defined: boolean }[] = []

  private q: GameEvent[] = []
  /** Events deferred to the next tick: too deep in their chain, over the budget, or for a held host. */
  private later: GameEvent[] = []
  private bump?: { id: Id; since: number; last: number }
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
    this.scenes = new Scenes(this)
    this.companions = new Companions(this)
    this.quests = new Quests(this)
    this.controls = new Controls(this, this.write)
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
    let n = 0
    try {
      while (this.q.length) {
        if (n++ >= EVENT_BUDGET) {
          this.later.push(...this.q.splice(0))
          break
        }
        this.dispatch(this.q.shift()!)
      }
    } finally {
      this.flushing = false
    }
  }

  /** Resolve one event and run its outcome (design.md §5.6). */
  dispatch(ev: GameEvent): Resolution {
    const w = this.world
    ev.tick = w.state.tick
    const host = 'e' in ev.host ? w.get(ev.host.e) : undefined
    if ('e' in ev.host && (!host || host.place.on === 'none')) return { defined: false }
    // a thing on a dormant map receives it when the player comes (design.md §5.12); people and residents at once
    const at = 'tile' in ev.host ? ev.host.tile : w.posOf(host)
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

  /** Re-run an event whose outcome was undefined and is now defined (a late patch). */
  replay(ev: GameEvent): void {
    this.queue({ ...ev, depth: 0 })
  }

  /**
   * A dry run of the chain an event starts (the HUD's labels, design.md §5.2): its outcome, and the
   * outcomes of the impulses it would send to single roles, a few levels deep. `unknown` when any
   * of them is undefined.
   */
  preview(ev: GameEvent, depth = 3): { defined: boolean; unknown: boolean; rules: string[]; confirm?: Text; hole?: { ev: GameEvent; res: Resolution } } {
    const res = this.resolveEvent(ev)
    const rules = res.rule ? [res.rule.id] : []
    const confirm = res.defined ? ((res.leaf && isDo(res.leaf) && res.leaf.confirm) || res.rule?.confirm) : undefined
    if (!res.defined || !res.leaf || !isDo(res.leaf)) return { defined: false, unknown: true, rules, confirm, hole: res.hole ? { ev, res } : undefined }
    let unknown = false
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
        if (p.unknown) unknown = true
        hole ??= p.hole
      }
    return { defined: true, unknown, rules, confirm, hole }
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
      p.power ??= w.num(actor, 'atk', 1) + (inst ? w.num(inst, 'power', 0) : 0)
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
  act(verb: Verb, actorId: Id, target: Ref, opts: { instrument?: Ref | null; params?: Record<string, PropValue> } = {}): Resolution {
    const w = this.world
    const actor = w.get(actorId)
    if (!actor || this.busy(actor)) return { defined: false }
    // the held item, unless the caller names another (an item from the bag) or none (talking while holding a tool)
    const instrument = opts.instrument === undefined ? (actor.held ? { e: actor.held } : undefined) : (opts.instrument ?? undefined)
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
  hurt(e: Entity, amount: number, element?: string, pierce?: boolean, by?: GameEvent): void {
    const w = this.world
    if (w.hasStatus({ e: e.id }, 'down')) return
    const def = pierce ? 0 : w.num(e, 'def')
    // fireproof (the herbalist's draught): fire does a quarter of its harm
    if (element === 'fire' && w.hasStatus({ e: e.id }, 'fireproof')) amount *= 0.25
    // the combat talents of the one struck (combat.ts): dodge, a guarded moment, reductions, the brink
    const by_ = by?.roles.actor ?? (by?.cause ? { e: by.cause } : undefined)
    const attacker = by_ && 'e' in by_ ? w.get(by_.e) : undefined
    const dmg = combatDamage(this, e, Math.max(1, Math.round(amount - def)), attacker, !!pierce)
    // a blow that found nothing (dodged, or the moment after a dash)
    if (dmg <= 0) return
    w.fx.push({ t: 'damage', who: e.id, amount: dmg, element })
    let hp = w.num(e, 'hp', 1) - dmg
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
      if ('tile' in r) addTile(r.tile)
      else {
        hosts.add(r.e)
        const e = w.get(r.e)
        addTile(w.posOf(e))
        // where it was: the tiles of its old relations, and whoever lay on it (a thing with a reach moved or gone)
        for (const k of rel[r.e] ?? []) {
          const to = k.slice(k.indexOf('|') + 1)
          if (to.startsWith('t|')) tiles.add(to.slice(2).split('#')[0])
        }
        if (!e || w.reachOf(e).length) for (const [h, ks] of Object.entries(rel)) if (ks.includes(`on|${r.e}`)) hosts.add(h)
      }
    }
    for (const t of tiles) {
      const [map, x, y] = t.split(':')
      for (const o of w.entitiesAt(map, +x, +y)) hosts.add(o.id)
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
    if (e.id === this.world.state.player && this.world.state.scene) return true
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
    const portalHere = w.map(map)?.portals.find((p) => p.x === nx && p.y === ny)
    // only the player uses portals by stepping on them; NPCs transfer from the tile beside
    if (portalHere && !isPlayer) return false
    if (!w.fits(e, map, nx, ny)) {
      const other = w.actorAt(map, nx, ny)
      if (!isPlayer || !other?.npc || this.busy(other) || w.blocked(map, nx, ny)) {
        const thing = w.inBounds(map, nx, ny) ? (other ?? w.solidAt(map, nx, ny)) : undefined
        const ref: Ref = thing ? { e: thing.id } : { tile: { map, x: nx, y: ny } }
        this.offer({ kind: 'bump', host: { e: e.id }, roles: { other: ref }, params: { dir }, cause: ev.cause, origin: ev.origin })
        if (w.view(ref)) this.offer({ kind: 'bump', host: ref, roles: { other: { e: e.id } }, params: { dir }, cause: ev.cause, origin: ev.origin })
        return false
      }
      // keep pushing into a person (~0.8 s) and you swap places; a single bump just turns you to face them
      const t = w.state.tick
      const b = this.bump
      this.bump = b && b.id === other.id && t - b.last <= 4 ? { id: other.id, since: b.since, last: t } : { id: other.id, since: t, last: t }
      if (t - this.bump.since < 8) return false
      this.bump = undefined
      const back: Dir = dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left'
      this.queue({ kind: 'impulse/push', host: { e: other.id }, roles: { source: { e: e.id }, actor: { e: e.id } }, params: { dir: back, swap: true }, cause: ev.cause, origin: ev.origin })
    }
    this.touch({ e: e.id })
    w.place(e, { on: 'tile', map, x: nx, y: ny })
    this.touch({ e: e.id })
    // a successful step charges the swiftness talents (combat.ts)
    recordCombatStep(w, e)
    if (isPlayer && portalHere) this.travel(e, { map: portalHere.to, x: portalHere.tx, y: portalHere.ty })
    return true
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
    const open = w.hasTag(e, 'airborne') ? w.inBounds(to.map, to.x, to.y) : w.walkable(to.map, to.x, to.y, e.id, true)
    const at = open ? to : (this.nearestFree(to) ?? to)
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
          if (actor ? this.world.fits(actor, p.map, p.x + dx, p.y + dy) : this.world.walkable(p.map, p.x + dx, p.y + dy)) return { map: p.map, x: p.x + dx, y: p.y + dy }
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
    const due: { ref: Ref; status: string; at: number }[] = []
    for (const key of [...w.statusful]) {
      const ref = w.keyRef(key)
      if (w.refPos(ref)?.map !== map) continue
      for (const [status, exp] of Object.entries(w.statusesOf(ref) ?? {})) if (exp !== NO_EXPIRY && exp <= now) due.push({ ref, status, at: exp })
    }
    due.sort((a, b) => a.at - b.at)
    for (const d of due) this.expire(d.ref, d.status)
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
    const range = (weapon ? w.num(weapon, 'range', 1) : w.num(a, 'range', 1)) + rangeBonus(w, a, weapon)
    const element = (weapon && (w.prop(weapon, 'element') as string | undefined)) || (w.prop(a, 'element') as string | undefined)
    const start = w.posOf(a)
    if (!start) return
    const [dx, dy] = DIRS[a.facing ?? 'down']
    let target: Ref | undefined
    let last: Pos | undefined
    for (let i = 1; i <= range; i++) {
      const x = start.x + dx * i
      const y = start.y + dy * i
      if (!w.inBounds(start.map, x, y)) break
      last = { map: start.map, x, y }
      // a body first, then what stands there and cannot be carried (a blow on the well is a blow on the well)
      const victim = w.actorAt(start.map, x, y, a.id) ?? w.entitiesAt(start.map, x, y).find((e) => !w.isAgent(e) && !w.isPortable(e))
      if (victim) {
        target = { e: victim.id }
        break
      }
      if (w.blocked(start.map, x, y) && i > 1) break
    }
    if (!target && last) target = { tile: last }
    // a melee blow on the layer the player chose; a cast at a tile the player chose lands there when it lies on the bolt's way
    const cp = chosen && w.refPos(chosen)
    if (chosen && cp && cp.map === start.map && range <= 1 && Math.max(Math.abs(cp.x - start.x), Math.abs(cp.y - start.y)) <= 1) target = chosen
    else if (chosen && cp && cp.map === start.map && range > 1 && last) {
      const d = Math.abs(cp.x - start.x) + Math.abs(cp.y - start.y)
      const onRay = cp.x - start.x === dx * d && cp.y - start.y === dy * d
      if (onRay && d >= 1 && d <= Math.abs(last.x - start.x) + Math.abs(last.y - start.y)) (target = chosen), (last = cp)
    }
    const base = w.num(a, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
    if (!target) {
      finishCombatStrike(w, a, undefined, { power: base, critical: false, charged: false, comboHits: 0, bleed: 0, drain: 0 }, 0, range, true)
      return
    }
    if (range > 1 && last) w.fx.push({ t: 'vfx', fx: `bolt:${element ?? 'none'}:${a.facing}:${Math.abs(last.x - start.x) + Math.abs(last.y - start.y)}`, map: start.map, x: start.x, y: start.y })
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
        const side = w.inBounds(start.map, x, y) ? w.actorAt(start.map, x, y, a.id) : undefined
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
      target = { tile: { map: active, x, y } }
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
    this.npcs.tick(active)
    stepCreatures(this, active)
    // the encounters' own behaviour (bosses.ts): telegraphs, approaches; their blows are acts
    stepBosses(this, active)
    // the companions' behaviour: they fly after their leader (their moves are acts)
    this.companions.tick()
    this.undefinedSink?.tick()
    this.controls.magnet()
    this.invariantTick()
    this.scenes.tick()
    this.flush()
  }

  /** A status runs out (the clock clears it): a time/timer event (its actor: who gave it). */
  private expire(ref: Ref, status: string): void {
    const w = this.world
    const roles = this.givenBy(ref, status)
    this.write(() => w.clearStatus(ref, status))
    this.offer({ kind: 'time/timer', host: ref, roles, params: { status }, cause: roles.actor && 'e' in roles.actor ? roles.actor.e : undefined, origin: 'world' })
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
              .filter((e) => t % Math.max(1, p.everyProp ? w.num(e, p.everyProp, p.every) : p.every) === 0)
              .map((e) => ({ e: e.id }))
      for (const h of hosts) this.offer({ kind: 'time/period', host: h, roles: {}, params: { name: p.name }, origin: 'world' })
    }
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
      if (w.fact(`invalid.${inv.id}`)) continue
      // content not in play yet: its giver's map is not loaded (the player is still on the mountain)
      const at = inv.giver ? w.posOf(w.get(inv.giver)) : undefined
      if (inv.giver && (!at || !w.map(at.map))) continue
      if (inv.when && !evalCond(inv.when, {}, w)) continue
      if (evalCond(inv.holds, {}, w)) continue
      this.write(() => w.setFact(`invalid.${inv.id}`, true))
      const giver: Ref | undefined = inv.giver && w.get(inv.giver) ? { e: inv.giver } : undefined
      this.queue({ kind: 'broken', host: { e: STORY }, roles: giver ? { target: giver } : {}, params: { invariant: inv.id }, origin: 'world' })
    }
  }

  // ---------------------------------------------------------------- chunks

  loadChunk(chunk: MapChunk): void {
    const s = this.world.state
    s.maps[chunk.map.id] = chunk.map
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
      this.write(() => this.teleport(this.world.player, to))
    }
  }

  // ---------------------------------------------------------------- names

  nameOf(ref: Ref | undefined, locale: 'en' | 'zh' = 'en'): string {
    if (!ref) return ''
    const w = this.world
    let name: Text | undefined
    if ('tile' in ref) name = w.onto.terrain(w.terrainAt(ref.tile.map, ref.tile.x, ref.tile.y))?.name
    else {
      const e = w.get(ref.e)
      if (!e) return ''
      if (e.id === w.state.player) return locale === 'zh' ? '你' : 'you'
      name = e.name ?? w.onto.resolve(e.type).name ?? e.type.split('/').pop()!.replace(/_/g, ' ')
    }
    return textOf(name, locale)
  }
}

export function textOf(t: Text | undefined, locale: 'en' | 'zh' = 'en'): string {
  if (t === undefined) return ''
  if (typeof t === 'string') return t
  return (locale === 'zh' ? t.zh : undefined) ?? t.en
}
