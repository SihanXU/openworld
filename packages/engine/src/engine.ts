// The engine: resolves events through the rule library, runs the simulation tick,
// and raises undefined interactions through the Mod port. Pure, deterministic, no AI.

import { isNight, rainy } from './calendar.ts'
import { EffectRunner } from './effects.ts'
import { Controls } from './controls.ts'
import { Scenes } from './scenes.ts'
import { stepCreatures } from './creatures.ts'
import { NpcSim, scheduleAt } from './npc.ts'
import { scheduleFor } from './people.ts'
import { OntologyIndex } from './ontology.ts'
import { RuleLibrary, evalCond, rolesOf } from './rules.ts'
import type {
  Dir,
  Entity,
  GameEvent,
  Id,
  Invariant,
  MapData,
  Ontology,
  Pos,
  Ref,
  Rule,
  Text,
  Verb,
  WorldState,
} from './types.ts'
import { DIRS } from './types.ts'
import { NO_EXPIRY, World } from './world.ts'

/** Receives undefined interactions. Implemented by the Mod port (mod.ts). */
export interface UndefinedSink {
  raise(ev: GameEvent): void
  /** A world event found no rule: ask if it is salient (design.md §5.6). True if a request was raised. */
  raiseWorld?(ev: GameEvent): boolean
  tick(): void
  /** Called with every defined player interaction (pre-state), e.g. to build a regression set. */
  observe?(ev: GameEvent, rule: string): void
}

export interface Resolution {
  defined: boolean
  rule?: Rule
  composed: Rule[]
}

export interface MapChunk {
  map: MapData
  entities: Entity[]
}

const STATUS_TICK_EVERY = 5
const EVENT_BUDGET = 400
/** How far people see (tiles, Chebyshev): what they see the player do is a `witness` event. */
export const SIGHT = 7
/** A creature meets the same thing again only after this many ticks. */
const MEET_COOLDOWN = 600
const INVARIANT_EVERY = 30
/** Events the world raises by itself (design.md §5.4 B and C), asked about through the salience filter. */
export const WORLD_KINDS = new Set(['status', 'hit', 'enter', 'meet', 'blocked', 'witness', 'invalid'])

export class Engine {
  world: World
  lib: RuleLibrary
  effects: EffectRunner
  npcs: NpcSim
  scenes: Scenes
  /** The player's two keys, slots and magnet (design.md §5.2–5.3). */
  controls: Controls
  /** Content the world must keep playable (game-design: the Ford's invariants). */
  invariants: Invariant[] = []
  /** Fact keys (prefixes) the world's own patches may not touch: the story's state (design.md §5.8). */
  protectedFacts: string[] = []
  undefinedSink?: UndefinedSink
  /** Portal graph of every map (loaded or not): map -> outgoing portals. */
  graph: Record<string, { to: string; x: number; y: number; tx: number; ty: number }[]> = {}
  /** Set when the player walked into a portal whose map isn't loaded yet. */
  pendingTransition?: { map: string; x: number; y: number }
  /** Resolution trace of the last dispatched events (for tests and the dev panel). */
  trace: { ev: GameEvent; rule?: string }[] = []

  private q: GameEvent[] = []
  private bump?: { id: Id; since: number; last: number }
  private cooldowns = new Map<Id, number>()
  private flushing = false
  /** creature|thing → the tick before which they do not meet again */
  private met = new Map<string, number>()

  constructor(state: WorldState, ontology: Ontology, lib: RuleLibrary) {
    const onto = new OntologyIndex(ontology)
    for (const t of lib.types) onto.addType(t)
    for (const s of lib.statuses) onto.addStatus(s)
    this.world = new World(state, onto)
    this.lib = lib
    this.effects = new EffectRunner(this)
    this.npcs = new NpcSim(this)
    this.scenes = new Scenes(this)
    this.controls = new Controls(this)
  }

  loadInvariants(defs: Invariant[] = [], protectedFacts: string[] = []): void {
    this.invariants = defs
    this.protectedFacts = protectedFacts
  }

  get activeMap(): string {
    return this.world.posOf(this.world.player)?.map ?? this.world.state.spawn.map
  }

  // ---------------------------------------------------------------- events

  queue(ev: GameEvent): void {
    this.q.push(ev)
    if (!this.flushing) this.flush()
  }

  private flush(): void {
    this.flushing = true
    let n = 0
    try {
      while (this.q.length && n++ < EVENT_BUDGET) this.dispatch(this.q.shift()!)
      if (this.q.length) {
        this.q.length = 0
        this.world.fx.push({ t: 'log', text: 'event budget exhausted (cascade cut)', tone: 'warn' })
      }
    } finally {
      this.flushing = false
    }
  }

  /** Resolve one event against the library: the most specific rule plus all composing rules. */
  dispatch(ev: GameEvent): Resolution {
    ev.tick = this.world.state.tick
    const roles = rolesOf(ev, this.world)
    const matches = this.lib.match(ev, roles, this.world)
    const rule = matches.find((r) => !r.compose && !(ev.strict && r.fallback))
    const composed = matches.filter((r) => r.compose)
    if (this.trace.length > 200) this.trace.shift()
    this.trace.push({ ev, rule: rule?.id })
    if (rule) this.effects.run(rule, ev)
    for (const r of composed) this.effects.run(r, ev)
    // the world's own events that find no rule: asked about when salient, else the safe default
    if (!rule && WORLD_KINDS.has(ev.kind) && ev.origin !== 'player' && !this.undefinedSink?.raiseWorld?.(ev)) this.worldFallback(ev)
    return { defined: !!rule, rule, composed }
  }

  /** Resolve without executing (dry run). */
  resolve(ev: GameEvent): Resolution {
    const roles = rolesOf(ev, this.world)
    const saved = this.world.state.rng
    const matches = this.lib.match(ev, roles, this.world)
    this.world.state.rng = saved
    const rule = matches.find((r) => !r.compose && !(ev.strict && r.fallback))
    return { defined: !!rule, rule, composed: matches.filter((r) => r.compose) }
  }

  // ---------------------------------------------------------------- interactions

  /**
   * Pick the target of a verb on a tile: actor > fixture > item > the tile itself. `take`
   * reaches into an open container (for `pick`, if it holds it; else its first item), then
   * for the top item lying on the tile (on a table, say), before the fixture itself.
   */
  targetAt(pos: Pos, verb: Verb, pick?: Id): Ref {
    const es = this.world.entitiesAt(pos.map, pos.x, pos.y)
    const by = (k: string) => es.filter((e) => this.world.kindOf(e) === k)
    const actor = by('actor')[0]
    if (actor) return { e: actor.id }
    const fixture = by('fixture')[0]
    const items = by('item')
    if (fixture && verb === 'take') {
      const inside = this.world.hasStatus({ e: fixture.id }, 'open') ? (fixture.contents ?? []) : []
      if (inside.length) return { e: pick && inside.includes(pick) ? pick : inside[0] }
      if (items.length) return { e: items[items.length - 1].id }
    }
    if (fixture) return { e: fixture.id }
    if (items.length) return { e: items[items.length - 1].id }
    return { tile: pos }
  }

  /** The open container the player faces, if any. */
  facingContainer(): Entity | undefined {
    const p = this.world.player
    const f = this.world.front(p)
    if (!f || !this.world.inBounds(f.map, f.x, f.y)) return undefined
    return this.world.entitiesAt(f.map, f.x, f.y).find((e) => this.world.kindOf(e) === 'fixture' && this.world.hasStatus({ e: e.id }, 'open'))
  }

  /**
   * An actor performs a verb on a target. Returns the resolution; when nothing matches,
   * the interaction is undefined and goes to the Mod port.
   */
  interact(verb: Verb, actorId: Id, target: Ref, opts: { instrument?: Ref | null; strict?: boolean } = {}): Resolution {
    const w = this.world
    const actor = w.get(actorId)
    if (!actor) return { defined: false, composed: [] }
    // the held item, unless the caller names another (an item from the bag) or none (talking while holding a tool)
    const instrument = opts.instrument === undefined ? (actor.held ? { e: actor.held } : undefined) : (opts.instrument ?? undefined)
    const frozen = [target, instrument].some((r) => r && 'e' in r && w.get(r.e)?.frozenBy)
    if (frozen) {
      w.fx.push({ t: 'say', who: actorId, text: '…' })
      return { defined: true, composed: [] }
    }
    if (verb === 'put' && !instrument) {
      w.fx.push({ t: 'log', text: { en: 'Your hands are empty.', zh: '你手里什么也没有。' } })
      return { defined: true, composed: [] }
    }
    const ev: GameEvent = {
      kind: 'interaction',
      verb,
      roles: { actor: { e: actorId }, target, instrument },
      at: w.refPos(target),
      strict: opts.strict || undefined,
    }
    const res = this.resolve(ev)
    if (!res.defined) {
      if (this.undefinedSink) this.undefinedSink.raise(ev)
      else this.fallback(ev)
      return res
    }
    this.undefinedSink?.observe?.(ev, res.rule!.id)
    // who sees it is decided before the act (a thing taken from her chest is hers until it is taken)
    const seen = this.witnesses(ev)
    this.queue(ev)
    for (const s of seen) this.queue(s)
    return res
  }

  /** The safe default when an event stays undefined. */
  fallback(ev: GameEvent): void {
    if (WORLD_KINDS.has(ev.kind) && ev.origin !== 'player') return this.worldFallback(ev)
    const actor = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : undefined
    if (actor) this.world.fx.push({ t: 'say', who: actor, text: { en: 'Nothing happens.', zh: '什么也没有发生。' } })
  }

  /**
   * The world's safe defaults (design.md §5.7): physical events do nothing, a blocked person
   * waits where they are, a witness says nothing; broken content runs its own fallback.
   */
  worldFallback(ev: GameEvent): void {
    if (ev.kind !== 'invalid') return
    const inv = this.invariants.find((i) => i.id === ev.about)
    if (inv?.fallback?.length) this.effects.run({ id: `invariant/${inv.id}`, on: 'invalid', when: {}, do: inv.fallback }, ev)
  }

  // ---------------------------------------------------------------- the world's own events

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

  /** Is the person asleep (their day says so)? */
  asleep(e: Entity): boolean {
    return scheduleAt(scheduleFor(this, e), this.world.hour())?.activity === 'sleep'
  }

  /**
   * People who see someone act on a thing that is another's (design.md §5.4 source 11): one
   * `witness` event per person awake within sight of the doer — actor = the witness, target =
   * the doer, instrument = the thing; about = <verb>:owner (the witness owns it) or :bystander.
   */
  witnesses(ev: GameEvent): GameEvent[] {
    const w = this.world
    const t = ev.roles.target
    const a = ev.roles.actor
    const thing = t && 'e' in t ? w.get(t.e) : undefined
    const doer = a && 'e' in a ? w.get(a.e) : undefined
    if (!thing || !doer || !ev.verb || w.kindOf(thing) === 'actor') return []
    const owner = this.ownerOf(thing)
    if (!owner || owner === doer.id) return []
    const at = w.posOf(doer)
    if (!at) return []
    const out: GameEvent[] = []
    for (const e of w.entitiesOnMap(at.map)) {
      if (!e.npc?.person || e.id === doer.id || e.place.on !== 'tile') continue
      if (Math.max(Math.abs(e.place.x - at.x), Math.abs(e.place.y - at.y)) > SIGHT || this.asleep(e) || this.busy(e)) continue
      out.push({ kind: 'witness', roles: { actor: { e: e.id }, target: { e: doer.id }, instrument: { e: thing.id } }, about: `${ev.verb}:${e.id === owner ? 'owner' : 'bystander'}` })
    }
    return out
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
    if (!a.ai || a.id === b.id || w.kindOf(b) !== 'actor' || b.place.on !== 'tile' || w.hasStatus({ e: b.id }, 'down')) return false
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

  /** A creature came up to things (design.md §5.4 source 9): a `meet` event per thing, now and then. */
  private meet(c: Entity, map: string, x: number, y: number): void {
    const w = this.world
    const t = w.state.tick
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const o of w.entitiesAt(map, x + dx, y + dy)) {
        if (o.id === c.id) continue
        const kind = w.kindOf(o)
        if (kind !== 'fixture' && !(o.ai && o.type !== c.type)) continue
        const key = `${c.id}|${o.id}`
        if ((this.met.get(key) ?? -1) > t) continue
        this.met.set(key, t + MEET_COOLDOWN)
        this.queue({ kind: 'meet', roles: { actor: { e: c.id }, target: { e: o.id } } })
      }
    }
  }

  /** Content the world must keep playable (game-design §8.10): a broken invariant raises `invalid` once. */
  private invariantTick(): void {
    const w = this.world
    if (w.state.tick % INVARIANT_EVERY !== 0) return
    for (const inv of this.invariants) {
      if (w.fact(`invalid.${inv.id}`)) continue
      if (inv.when && !evalCond(inv.when, {}, w)) continue
      if (evalCond(inv.holds, {}, w)) continue
      w.setFact(`invalid.${inv.id}`, true)
      const giver: Ref | undefined = inv.giver && w.get(inv.giver) ? { e: inv.giver } : undefined
      this.queue({ kind: 'invalid', roles: giver ? { actor: giver, target: giver } : {}, about: inv.id })
    }
  }

  /** Player verb aimed at the tile in front of them (or at themselves); `pick` chooses what to take from an open container. */
  playerVerb(verb: Verb, self = false, pick?: Id): Resolution | undefined {
    const p = this.world.player
    if (this.busy(p)) return undefined
    if (self) return this.interact(verb, p.id, { e: p.id })
    const f = this.world.front(p)
    if (!f || !this.world.inBounds(f.map, f.x, f.y)) return undefined
    let target = this.targetAt(f, verb, pick)
    // nothing in front to take? pick up what lies at your feet
    if (verb === 'take' && 'tile' in target) {
      const here = this.world.posOf(p)!
      const under = this.world.entitiesAt(here.map, here.x, here.y).filter((e) => this.world.kindOf(e) === 'item')
      if (under.length) target = { e: under[under.length - 1].id }
    }
    if (verb === 'interact') target = this.answeredInPile(p, target)
    return this.interact(verb, p.id, target)
  }

  /**
   * Using the held item on loose items reaches for the topmost one it does something to
   * (the log under a stick), then for the ground beneath them (the stump under the logs),
   * and otherwise stays on the top item.
   */
  private answeredInPile(actor: Entity, target: Ref): Ref {
    const w = this.world
    const top = 'e' in target ? w.get(target.e) : undefined
    if (!top || top.place.on !== 'tile') return target
    const { map, x, y } = top.place
    const here = w.entitiesAt(map, x, y)
    if (here.some((e) => w.kindOf(e) !== 'item')) return target
    const instrument = actor.held ? { e: actor.held } : undefined
    const answers = (ref: Ref) => this.resolve({ kind: 'interaction', verb: 'interact', roles: { actor: { e: actor.id }, target: ref, instrument } }).defined
    const candidates: Ref[] = [...here.reverse().map((e) => ({ e: e.id })), { tile: { map, x, y } }]
    return candidates.find(answers) ?? target
  }

  /** Swap the held item with an inventory item (or stow it with `undefined`). */
  hold(actorId: Id, itemId?: Id): void {
    const w = this.world
    const a = w.get(actorId)
    if (!a) return
    const cur = w.get(a.held)
    if (cur?.frozenBy) return
    if (itemId && !a.contents?.includes(itemId)) return
    if (cur) w.place(cur, { on: 'inside', holder: a.id })
    const next = w.get(itemId)
    if (next) w.place(next, { on: 'hand', holder: a.id })
  }

  // ---------------------------------------------------------------- statuses & damage

  applyStatus(ref: Ref, status: string, duration?: number): void {
    const w = this.world
    const def = w.onto.status(status)
    for (const c of def?.clears ?? []) w.clearStatus(ref, c)
    const dur = duration ?? def?.duration
    const fresh = w.setStatus(ref, status, dur ? w.state.tick + dur : NO_EXPIRY)
    if (fresh) this.queue({ kind: 'status', roles: { target: ref }, status })
  }

  /**
   * Hurt an actor. At no health it is defeated (the rules decide what that means: the essential
   * collapse, the rest are gone); whoever struck an actor with an AI becomes its foe.
   */
  damage(e: Entity, amount: number, element?: string, pierce?: boolean, by?: Ref): void {
    const w = this.world
    if (w.hasStatus({ e: e.id }, 'down')) return
    const def = pierce ? 0 : w.num(e, 'def')
    const dmg = Math.max(1, Math.round(amount - def))
    const hp = w.num(e, 'hp', 1) - dmg
    ;(e.props ??= {}).hp = hp
    w.fx.push({ t: 'damage', who: e.id, amount: dmg, element })
    if (hp <= 0) this.queue({ kind: 'defeat', roles: { target: { e: e.id }, actor: by } })
    else if (e.ai && by && 'e' in by && by.e !== e.id && w.get(by.e)) {
      const foes = (e.ai.foes ??= [])
      if (!foes.includes(by.e)) foes.push(by.e)
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

  /** Step one tile. Returns true if the entity moved. */
  step(e: Entity, dir: Dir): boolean {
    const w = this.world
    if (this.busy(e) || e.place.on !== 'tile') return false
    e.facing = dir
    const { map, x, y } = e.place
    const [dx, dy] = DIRS[dir]
    const nx = x + dx
    const ny = y + dy
    const isPlayer = e.id === w.state.player
    const portalHere = w.map(map)?.portals.find((p) => p.x === nx && p.y === ny)
    // only the player uses portals by stepping on them; NPCs transfer from the tile beside
    if (portalHere && !isPlayer) return false
    if (!w.walkable(map, nx, ny, e.id, !!e.npc)) {
      // JRPG courtesy: keep pushing into a person (~0.8 s) and you swap places;
      // a single bump just turns you to face them (so you can talk)
      const other = w.actorAt(map, nx, ny)
      if (!isPlayer || !other?.npc || this.busy(other) || w.blocked(map, nx, ny)) return false
      const t = w.state.tick
      const b = this.bump
      this.bump = b && b.id === other.id && t - b.last <= 4 ? { id: other.id, since: b.since, last: t } : { id: other.id, since: t, last: t }
      if (t - this.bump.since < 8) return false
      this.bump = undefined
      if (portalHere) {
        this.travel(e, { map: portalHere.to, x: portalHere.tx, y: portalHere.ty })
        return true
      }
      w.place(other, { on: 'tile', map, x, y })
    }
    w.place(e, { on: 'tile', map, x: nx, y: ny })
    const enter: GameEvent = { kind: 'enter', roles: { actor: { e: e.id }, target: { tile: { map, x: nx, y: ny } } } }
    // the player steps into a tile in some state the world has no answer for (design.md §5.4, source 5)
    const st = w.tileState(map, nx, ny)?.statuses
    if (isPlayer) enter.origin = 'player'
    if (isPlayer && st && Object.keys(st).length && this.undefinedSink && !this.resolve(enter).defined) this.undefinedSink.raise(enter)
    else this.queue(enter)
    if (e.ai) this.meet(e, map, nx, ny)
    if (isPlayer && portalHere) this.travel(e, { map: portalHere.to, x: portalHere.tx, y: portalHere.ty })
    return true
  }

  /** Player movement request (held direction); respects speed. `walk` (Shift) is slower than the default run. */
  movePlayer(dir: Dir, walk = false): boolean {
    const p = this.world.player
    if (!this.ready(p.id) || this.pendingTransition) {
      if (!this.busy(p)) p.facing = dir
      return false
    }
    const moved = this.step(p, dir)
    if (moved) this.setCooldown(p.id, this.world.num(p, 'speed', 2) + (walk ? 1 : 0))
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
    if (!w.walkable(to.map, x, y, e.id)) {
      const free = this.nearestFree(to)
      if (free) ({ x, y } = free)
    }
    w.place(e, { on: 'tile', map: to.map, x, y })
    if (e.id === w.state.player && from !== to.map) {
      w.fx.push({ t: 'mapChanged', map: to.map })
      this.npcs.onEnterMap(to.map, from)
    }
  }

  nearestFree(p: Pos): Pos | undefined {
    for (let r = 1; r < 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (this.world.walkable(p.map, p.x + dx, p.y + dy)) return { map: p.map, x: p.x + dx, y: p.y + dy }
    return undefined
  }

  // ---------------------------------------------------------------- combat

  /** The player attacks with the held item (or bare hands): at a chosen target next to them, or along the facing direction. */
  playerAttack(target?: Ref): void {
    const w = this.world
    const p = w.player
    if (this.busy(p) || !this.ready('atk:' + p.id)) return
    this.attack(p, target)
    this.setCooldown('atk:' + p.id, 5)
  }

  attack(a: Entity, chosen?: Ref): void {
    const w = this.world
    const weapon = w.get(a.held)
    const range = weapon ? w.num(weapon, 'range', 1) : 1
    const element = (weapon && (w.prop(weapon, 'element') as string | undefined)) || (w.prop(a, 'element') as string | undefined)
    const power = w.num(a, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
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
      // an actor first, then a fixture (a blow on the well is a blow on the well)
      const victim = w.actorAt(start.map, x, y) ?? w.entitiesAt(start.map, x, y).find((e) => w.kindOf(e) === 'fixture')
      if (victim) {
        target = { e: victim.id }
        break
      }
      if (w.blocked(start.map, x, y) && i > 1) break
    }
    if (!target && last) target = { tile: last }
    // a melee blow on the layer the player chose (the well rather than the bucket on it); a cast
    // at a tile the player chose lands there when it lies on the bolt's way (frost on the water at your feet)
    const cp = chosen && w.refPos(chosen)
    if (chosen && cp && range <= 1 && Math.max(Math.abs(cp.x - start.x), Math.abs(cp.y - start.y)) <= 1) target = chosen
    else if (chosen && cp && range > 1 && last) {
      const d = Math.abs(cp.x - start.x) + Math.abs(cp.y - start.y)
      const onRay = cp.x - start.x === dx * d && cp.y - start.y === dy * d
      if (onRay && d >= 1 && d <= Math.abs(last.x - start.x) + Math.abs(last.y - start.y)) (target = chosen), (last = cp)
    }
    if (!target) return
    if (range > 1 && last) w.fx.push({ t: 'vfx', fx: `bolt:${element ?? 'none'}:${a.facing}:${Math.abs(last.x - start.x) + Math.abs(last.y - start.y)}`, map: start.map, x: start.x, y: start.y })
    else w.fx.push({ t: 'vfx', fx: `swing:${a.facing}`, map: start.map, x: start.x, y: start.y })
    const hit: GameEvent = { kind: 'hit', roles: { actor: { e: a.id }, target, instrument: weapon ? { e: weapon.id } : undefined }, element, power }
    if (a.id === w.state.player) hit.origin = 'player'
    // the player's blow lands on something with no reaction (design.md §5.4, source 3)
    if (a.id === w.state.player && this.undefinedSink && this.salientHit(hit) && !this.resolve(hit).defined) return this.undefinedSink.raise(hit)
    this.queue(hit)
  }

  /** A hit worth asking about: on a fixture, or with an element on a tile that holds something (a status, water, plants). */
  private salientHit(ev: GameEvent): boolean {
    const w = this.world
    const t = ev.roles.target
    if (!t) return false
    if ('e' in t) return w.kindOf(w.get(t.e)!) === 'fixture'
    if (!ev.element) return false
    const { map, x, y } = t.tile
    const st = w.tileState(map, x, y)?.statuses
    if (st && Object.keys(st).length) return true
    const tags = w.onto.terrain(w.terrainAt(map, x, y))?.tags ?? []
    return tags.some((g) => !['ground', 'floor', 'road', 'indoor', 'stone', 'diggable', 'cave'].includes(g))
  }

  // ---------------------------------------------------------------- simulation tick

  tick(): void {
    const w = this.world
    const s = w.state
    s.tick += 1
    const active = this.activeMap
    this.statusTick(active)
    this.npcs.tick(active)
    stepCreatures(this, active)
    this.undefinedSink?.tick()
    this.controls.magnet()
    this.weatherTick(active)
    this.invariantTick()
    this.scenes.tick()
  }

  // ---------------------------------------------------------------- weather

  /** Rain wets everything outdoors and puts out fires; storms strike the tallest things. (The elemental rules do the rest.) */
  private weatherTick(active: string): void {
    const w = this.world
    const t = w.state.tick
    if (t % 60 !== 0) return
    const map = w.map(active)
    if (!map || (map.light ?? 'outdoor') !== 'outdoor') return
    const cal = w.calendar()
    if (!rainy(cal.weather)) return
    for (const e of w.entitiesOnMap(active)) if (e.place.on === 'tile' && w.kindOf(e) === 'actor' && w.onto.status('wet')) this.applyStatus({ e: e.id }, 'wet', 120)
    for (const key of [...w.statusful]) {
      const ref = w.keyRef(key)
      const pos = w.refPos(ref)
      if (pos?.map === active && w.hasStatus(ref, 'burning')) this.applyStatus(ref, 'wet', 120)
    }
    if (cal.weather === 'storm' && t % 300 === 0) {
      const p = w.posOf(w.player)!
      // lightning seeks what stands tall (the dead tree); otherwise it falls anywhere near
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
      this.queue({ kind: 'hit', roles: { target }, element: 'lightning', power: 4 })
    }
  }

  private statusTick(active: string): void {
    const w = this.world
    const t = w.state.tick
    const periodic = t % STATUS_TICK_EVERY === 0
    for (const key of [...w.statusful]) {
      const ref = w.keyRef(key)
      const pos = w.refPos(ref)
      if (!pos || pos.map !== active) continue
      const bag = w.statusesOf(ref)
      if (!bag) continue
      for (const [status, exp] of Object.entries(bag)) {
        if (exp !== NO_EXPIRY && exp <= t) {
          w.clearStatus(ref, status)
          this.queue({ kind: 'expire', roles: { target: ref }, status })
        } else if (periodic) {
          this.queue({ kind: 'tick', roles: { target: ref }, status })
        }
      }
    }
  }

  // ---------------------------------------------------------------- chunks

  loadChunk(chunk: MapChunk): void {
    const s = this.world.state
    s.maps[chunk.map.id] = chunk.map
    if (!s.loadedMaps.includes(chunk.map.id)) {
      s.loadedMaps.push(chunk.map.id)
      for (const e of chunk.entities) if (!s.entities[e.id]) this.world.add(structuredClone(e))
    }
    if (this.pendingTransition?.map === chunk.map.id) {
      const to = this.pendingTransition
      this.pendingTransition = undefined
      this.teleport(this.world.player, to)
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
