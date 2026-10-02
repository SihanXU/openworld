// The Mod port: the exact contract a modder (human now, LLM later) implements.
//   undefined event (the player's, or the world's own when salient) → ModRequest (event + context + scenario) + ModSpec
//   → Patch → validatePatch (schema, ontology, conflicts, sandbox replay, tests, regression)
//   → applied to the rule library with provenance → the frozen interaction re-resolves.
// The engine is the trust boundary: patches are untrusted data until validated.

import { TICKS_PER_HOUR } from './calendar.ts'
import { PRIMITIVES } from './effects.ts'
import type { Engine, UndefinedSink } from './engine.ts'
import { WORLD_KINDS, textOf } from './engine.ts'
import { OntologyIndex, isA } from './ontology.ts'
import { ROLES, RuleLibrary, cmp, compareSpec, rolesOf, specOf } from './rules.ts'
import { checkExpectations, replay } from './sandbox.ts'
import type {
  Cmp,
  Cond,
  Effect,
  EventKind,
  GameEvent,
  Ontology,
  Ref,
  Rule,
  Scenario,
  ScenarioEntity,
  Selector,
  StatusDef,
  TypeDef,
} from './types.ts'
import type { View } from './world.ts'

// ---------------------------------------------------------------- contract

export type Artifact =
  | { kind: 'rule'; rule: Rule }
  | { kind: 'type'; type: TypeDef }
  | { kind: 'status'; status: StatusDef }

export interface Patch {
  artifacts: Artifact[]
  note?: string
  author?: string
  /** Who caused the request it answers (the Threadbook's "you" or "the world"). */
  trigger?: 'player' | 'world'
}

export interface EntityInfo {
  role: string
  id?: string
  name: string
  kind: string
  type: string
  typeChain: string[]
  tags: string[]
  statuses: string[]
  props: Record<string, unknown>
  /** Offset from the target's tile. */
  at?: [number, number]
}

export interface ModRequest {
  id: string
  summary: string
  /** Who caused it: the player's own act, or the world by itself (a cascade, a creature, a person). */
  origin: 'player' | 'world'
  /**
   * The event that found no rule: an interaction (verb), a hit (element, power), a step onto a
   * tile (enter), a status taking hold, a creature meeting something, a person blocked, a
   * witness, or broken content (about, detail).
   */
  event: { kind: EventKind; verb?: string; element?: string; power?: number; status?: string; strict?: boolean; about?: string; detail?: string; actor?: EntityInfo; target?: EntityInfo; instrument?: EntityInfo }
  context: {
    map: { id: string; name: string; kind: string; region?: string }
    /** Named spots of the map (for `goto`). */
    anchors: string[]
    hour: number
    nearby: EntityInfo[]
    tiles: string[][] // terrain window around the target, target at the center
    tileStatuses: { at: [number, number]; statuses: string[] }[]
    recent: string[]
    nearMisses: Rule[]
  }
  /** A self-contained replay of the interaction (used by validation and by patch tests). */
  scenario: Scenario
}

export interface ModSpec {
  version: string
  summary: string
  rule: Record<string, string>
  selector: Record<string, string>
  conditions: string[]
  events: Record<string, string>
  primitives: Record<string, string>
  expectations: string[]
  ontology: {
    types: { id: string; kind: string; tags: string[]; name?: string }[]
    statuses: { id: string; duration?: number; immobilize?: boolean; clears?: string[] }[]
    terrains: { id: string; tags: string[]; solid?: boolean; liquid?: boolean }[]
    elements: string[]
    /** Factions: an actor belongs to those its faction:<id> tags name; the wild is hostile to folk. */
    factions: Record<string, { hostile?: string[] }>
  }
  assets: { vfx: string[] }
  authoringRules: string[]
}

export interface ModProvider {
  resolve(req: ModRequest, spec: ModSpec): Promise<Patch | null>
}

// ---------------------------------------------------------------- the wire (client ↔ modder service)

/** What the client knows that the service may not: its local patches and recent defined interactions. */
export interface ModWorkspace {
  patches?: { rules: Rule[]; types?: TypeDef[]; statuses?: StatusDef[] }
  regression?: { scenario: Scenario; rule: string }[]
}

/** POST /resolve */
export interface ResolveBody {
  request: ModRequest
  workspace?: ModWorkspace
}

/**
 * `accepted`: a new patch was written and validated; `covered`: the shared library already
 * answers this interaction (no model call); `failed`: no valid patch within the harness's
 * budget; `unavailable`: no model configured.
 */
export interface ResolveReply {
  patch: Patch | null
  outcome: 'accepted' | 'covered' | 'failed' | 'unavailable'
  episode?: string
  diagnostics?: string[]
}

/** One entry of the shared library's append-only patch log (GET /patches?since=seq). */
export type PatchLogEntry =
  | { seq: number; at: string; patch: Patch; rules: string[]; request?: string; /** the triggering interaction (kept server-side as regression) */ scenario?: Scenario }
  | { seq: number; at: string; remove: string }

export type RecordStatus = 'pending' | 'patched' | 'fallback' | 'rejected'

export interface UndefinedRecord {
  id: string
  tick: number
  status: RecordStatus
  request: ModRequest
  event: GameEvent
  deadline: number
  /** The interaction's class (verb, target kind, instrument kind): what counts as "the same action". */
  signature: string
  origin: 'player' | 'world'
  /** A reply from the provider is still on its way (it may arrive after the fallback). */
  awaiting?: boolean
  patch?: Patch
  diagnostics?: string[]
  rules?: string[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Previously-defined interactions that the patch now overrides (informational). */
  overrides: string[]
}

// ---------------------------------------------------------------- the ModSpec

const AUTHORING_RULES = [
  'Write the CLASS of the interaction, not the instance: select roles by the most general type/tags/statuses that make the outcome plausible. Never use `id` unless the behaviour truly belongs to one unique entity.',
  'But never a catch-all: an interaction rule must select the target or the instrument by type, tags or status. "Anything on anything does nothing" is rejected.',
  'Prefer tags and statuses over deep types: `instrument: {tags:["liquid:oil"]}` covers every oily thing.',
  'A rule must not contradict an existing rule at the same specificity. To special-case, be MORE specific (a subtype, one more tag or status) — the engine then prefers your rule for that case only.',
  'Use only the listed primitives, statuses, terrains, types and vfx. If you need a new type or status, add a `type`/`status` artifact to the same patch.',
  'Every rule should carry at least one test (a small scenario + expectations). The triggering interaction is replayed automatically.',
  'Give the player feedback: a `vfx` and/or a `say`/`log` line, so the outcome is visible.',
  'Keep effects local and bounded: no unbounded spreading (chance < 1 or radius ≤ 3).',
  'Make interactions that consume or transform the instrument say so (transform/destroy the instrument).',
  'World events (origin "world": a status taking hold, a world hit, meet, blocked, witness, invalid) happen without the player asking: keep them small and legible, never harm a person, never touch the story\'s facts, and let people react with say/emote/topic/goto.',
]

export function buildModSpec(onto: Ontology, lib: RuleLibrary): ModSpec {
  const types = { ...onto.types }
  for (const t of lib.types) types[t.id] = t
  const statuses = { ...onto.statuses }
  for (const s of lib.statuses) statuses[s.id] = s
  return {
    version: `lsw-modspec/1 lib@${lib.version}`,
    summary:
      'Author RULES for a 2D JRPG world whose mechanics are data. Rules match events by role patterns and run effect primitives. You are called because an event matched no rule. From the player: an interaction (the player used, put or took something, or touched it bare-handed — event.strict: catch-all descriptions do not count), a hit (a blow or a spell landed on something with no reaction), or a step onto a tile in some state (enter). From the world itself: a status taking hold of something, a hit nobody aimed (lightning), a creature meeting a thing (meet), a person who cannot go on with their day (blocked), a person who saw someone act on something owned (witness), or content that state has broken (invalid).',
    rule: {
      id: 'unique string, e.g. "patch/oil-coats-frozen"',
      on: 'event kind: interaction | hit | status | expire | tick | enter | defeat | meet | blocked | witness | invalid',
      when: 'pattern: { verb?: [take|put|interact], actor?, target?, instrument?: Selector, element?: [..], status?: [..], about?: [..] (blocked: the activity; witness: "<verb>:owner" | "<verb>:bystander"; invalid: the invariant id) }',
      guard: 'optional Cond evaluated at match time',
      do: 'ordered Effect[] (primitives)',
      priority: 'optional tiebreaker (number)',
      compose: 'optional: true = run alongside the most specific rule instead of competing with it',
      fallback: 'optional: true = a catch-all description ("It is a well.") that answers only when nothing else does; it does not define a strict (bare-handed Use) interaction. Patches rarely need it.',
      confirm: 'optional Text: ask the player first when their Action key chooses this rule ("Eat {instrument}?"); for sleeping, eating and other things that end the moment',
      tests: 'RuleTest[]: { given: Scenario, expect: Expectation[] }',
      doc: 'one-line human summary',
    },
    selector: {
      kind: 'actor | item | fixture | tile',
      type: 'is-a match on the slash-path type hierarchy (prefix)',
      tags: 'all of these tags',
      notTags: 'none of these tags',
      status: 'all of these statuses',
      notStatus: 'none of these statuses',
      props: 'property comparisons: {key: value | {eq,ne,gt,gte,lt,lte}}',
      none: 'true = the role must be empty (e.g. empty-handed)',
      player: 'true/false = the role is/isn\'t the player (rarely right: say what the role IS, by type, tags or status)',
      self: 'true/false = the role is/isn\'t the event\'s actor (eating is an interaction with oneself)',
      id: 'instance id (discouraged)',
    },
    conditions: [
      '{all:[..]} {any:[..]} {not:C}',
      '{has:{role, status?, tag?}}',
      '{prop:{role, key, cmp}}',
      '{chance:p}',
      '{hour:{from,to}}',
      "{count:{role, in: contents|tile, match?: Selector, cmp: {eq|gt|gte|lt|lte: number | {prop, of: role}}}} — how many entities are in a role's contents (or on its tile besides itself); e.g. full when {gte:{prop:'capacity', of:'target'}}",
      '{fact:{key, cmp}} — a world fact (missing = 0); facts are set by setFact/addFact (e.g. ford.winch)',
      '{topic:id} — something that happened is still fresh (raised by the topic effect)',
      '{weather:[sun|cloud|rain|storm|fog]} — the weather now',
      '{exists: Selector} — something matching it exists anywhere in the world (a rope, the dead tree)',
    ],
    events: {
      interaction: 'a verb: take (pick up) / put (place the held item on the target) / interact (use; with the held item as instrument). Roles actor, target, instrument(held item).',
      hit: 'an attack landed on target (actor = attacker, instrument = weapon); has element + power',
      status: 'a status was just applied to target; `status` names it',
      expire: 'a status just ran out on target',
      tick: 'periodic (every 0.5s) for each status the target carries',
      enter: 'actor stepped onto target tile',
      defeat: 'target\'s hp reached 0 (actor = killer)',
      meet: 'a creature (actor) came up to a thing or another creature (target)',
      blocked: 'a person (actor) cannot go on with their activity (about): target is what it needs (gone, or not as it must be), or the anchor tile they cannot reach',
      witness: 'a person (actor) saw someone (target) act on a thing that is another\'s (instrument); about = "<verb>:owner" when the witness owns it, else "<verb>:bystander"',
      invalid: 'state broke content the world must keep playable: about = the invariant id, detail = what it was; actor = target = the person it belongs to',
    },
    primitives: { ...PRIMITIVES, _roles: 'RoleRef = actor | target | instrument | tileOf:actor | tileOf:target | tileOf:instrument', _amount: 'Amount = number | "power" | {prop, of, mul?, add?}' },
    expectations: [
      '{key, hasStatus} {key, lacksStatus} {key, isType} {key, destroyed:true} {key, exists:true}',
      '{key, propGt:[k,n]} {key, propLt:[k,n]} {tile:[x,y], terrain} {tile:[x,y], hasStatus} {spawned:type}',
      'Scenario: {terrain?: string[][], entities:[{key,type,x,y,tags?,statuses?,props?,heldBy?,inside?}], event:{kind?,verb?,actor?,target?,instrument?,element?,power?,status?}, ticks?} — roles reference entity keys or "tile:x,y"',
    ],
    ontology: {
      types: Object.values(types).map((t) => ({ id: t.id, kind: t.kind, tags: t.tags ?? [], name: t.name ? textOf(t.name) : undefined })),
      statuses: Object.values(statuses).map((s) => ({ id: s.id, duration: s.duration, immobilize: s.immobilize, clears: s.clears })),
      terrains: Object.values(onto.terrains).map((t) => ({ id: t.id, tags: t.tags ?? [], solid: t.solid, liquid: t.liquid })),
      elements: onto.elements,
      factions: onto.factions ?? {},
    },
    assets: { vfx: onto.vfx },
    authoringRules: AUTHORING_RULES,
  }
}

// ---------------------------------------------------------------- the port

const WINDOW = 3 // tiles around the target in the scenario (7x7)
const TIMEOUT_TICKS = 100 // 10 s: then fall back (the record stays patchable)
/**
 * How many requests one class of interaction may raise in a session. An answered class is a
 * rule and never asks again; an unanswered one (timed out, rejected, dismissed) asks once more,
 * then simply does nothing — the world does not ask the same question forever.
 */
const MAX_ASKS = 2

/** Requests per game hour the world may raise by itself, by kind (design.md §5.6). */
const WORLD_BUDGET: Record<string, number> = { physical: 6, witness: 4, blocked: 2, invalid: 4 }
/** How far from the player a physical event still counts as seen (tiles). */
const VIEW = 12
/** Tags that make a thing worth asking about when the world does something to it. */
const REACTIVE = ['flammable', 'conductive', 'edible', 'fragile', 'liquid', 'bees', 'plant', 'crop', 'cloth', 'paper', 'metal', 'wooden', 'creature', 'dry', 'tall', 'fiber']

const budgetOf = (kind: string) => (kind === 'status' || kind === 'hit' || kind === 'meet' ? 'physical' : kind)

/** The class of an event, instances aside: kind, verb / element / status / about, what is acted on, what is held (and, for the world's events, who acts). */
export function signatureOf(eng: Engine, ev: GameEvent): string {
  const w = eng.world
  const kind = (r: Ref | undefined): string => {
    if (!r) return 'hand'
    if ('tile' in r) return `tile:${w.terrainAt(r.tile.map, r.tile.x, r.tile.y)}`
    const e = w.get(r.e)
    if (!e) return '?'
    const actor = ev.roles.actor
    return r === ev.roles.target && actor && 'e' in actor && actor.e === e.id ? 'self' : e.type
  }
  const actor = ev.kind === 'interaction' || ev.kind === 'enter' ? '' : `|by:${kind(ev.roles.actor)}`
  return `${ev.kind}:${ev.verb ?? ev.element ?? ev.status ?? ev.about ?? ''}|${kind(ev.roles.target)}|${kind(ev.roles.instrument)}${ev.strict ? '|strict' : ''}${actor}`
}

export class ModPort implements UndefinedSink {
  provider?: ModProvider
  records: UndefinedRecord[] = []
  /** Scenarios of recently *defined* interactions: regression set for new patches. */
  regression: { scenario: Scenario; rule: string }[] = []
  onChange?: () => void
  /** How long an interaction waits for a patch before the fallback runs (a late patch still applies). */
  timeoutTicks = TIMEOUT_TICKS
  private seq = 0
  /** Requests raised per interaction class this session (MAX_ASKS). */
  private asks = new Map<string, number>()
  /** Ticks at which the world raised requests, by budget kind (WORLD_BUDGET). */
  private spent = new Map<string, number[]>()

  constructor(private eng: Engine) {
    eng.undefinedSink = this
  }

  spec(): ModSpec {
    return buildModSpec(this.eng.world.onto.data, this.eng.lib)
  }

  get(id: string): UndefinedRecord | undefined {
    return this.records.find((r) => r.id === id)
  }

  raise(ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    // the same question is asked once at a time, and not forever
    const signature = signatureOf(eng, ev)
    const open = this.records.some((r) => r.signature === signature && (r.status === 'pending' || r.awaiting))
    if (open || (this.asks.get(signature) ?? 0) >= MAX_ASKS) {
      w.fx.push({ t: 'log', text: attemptLine(eng, ev) })
      return eng.fallback(ev)
    }
    this.asks.set(signature, (this.asks.get(signature) ?? 0) + 1)
    const rec = this.open(ev, signature, 'player')
    // say at once what the player is doing (never what comes of it: that is the patch's to decide)
    w.fx.push({ t: 'log', text: attemptLine(eng, ev) })
    w.fx.push({ t: 'undefined', request: rec.id, summary: rec.request.summary, asked: !!this.provider })
    // with no one to ask, nothing is being worked out: the safe default runs now, and the record
    // stays open to a patch (the Mod Console, a later sync), which re-runs the act if it still fits
    if (!this.provider) return this.fallback(rec.id)
    // everyone and everything in the act waits for its outcome — the one acting too: they are
    // busy working it out (no other act, no step) until the patch or the fallback comes
    for (const r of [ev.roles.actor, ev.roles.target, ev.roles.instrument]) {
      const e = r && 'e' in r ? w.get(r.e) : undefined
      if (e) e.frozenBy = rec.id
    }
    this.onChange?.()
    this.ask(rec)
  }

  /**
   * The world's own event found no rule (design.md §5.6–5.7): asked about only when it is
   * salient, not yet asked, and within its kind's budget. Nothing freezes; the safe default
   * stands until a patch arrives (at the time-out, or when the provider gives up).
   */
  raiseWorld(ev: GameEvent): boolean {
    const eng = this.eng
    const w = eng.world
    if (!this.salient(ev)) return false
    const signature = signatureOf(eng, ev)
    if (this.records.some((r) => r.signature === signature && (r.status === 'pending' || r.awaiting))) return false
    if ((this.asks.get(signature) ?? 0) >= MAX_ASKS) return false
    const kind = budgetOf(ev.kind)
    const recent = (this.spent.get(kind) ?? []).filter((t) => t > w.state.tick - TICKS_PER_HOUR)
    if (recent.length >= (WORLD_BUDGET[kind] ?? 2)) return false
    this.spent.set(kind, [...recent, w.state.tick])
    this.asks.set(signature, (this.asks.get(signature) ?? 0) + 1)
    const rec = this.open(ev, signature, 'world')
    w.fx.push({ t: 'log', text: worldLine(eng, ev), tone: 'ai' })
    w.fx.push({ t: 'undefined', request: rec.id, summary: rec.request.summary, asked: !!this.provider })
    this.onChange?.()
    this.ask(rec)
    return true
  }

  /** Is a world event worth a request (design.md §5.6)? */
  salient(ev: GameEvent): boolean {
    const eng = this.eng
    const w = eng.world
    const pp = w.posOf(w.player)
    const at = w.refPos(ev.roles.target) ?? w.refPos(ev.roles.actor)
    const seen = !!pp && !!at && pp.map === at.map && Math.max(Math.abs(pp.x - at.x), Math.abs(pp.y - at.y)) <= VIEW
    // content and people matter even out of sight; a person's reaction only when the player is near
    if (ev.kind === 'invalid') return true
    if (ev.kind === 'witness' || ev.kind === 'blocked') return seen
    if (!seen) return false
    // something steps into a tile in some state: the one stepping is what the world asks about
    if (ev.kind === 'enter') {
      const tile = ev.roles.target && 'tile' in ev.roles.target ? ev.roles.target.tile : undefined
      const st = tile && w.tileState(tile.map, tile.x, tile.y)?.statuses
      const a = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
      return !!st && Object.keys(st).length > 0 && !!a && !isA(a.type, 'actor/person') && REACTIVE.some((g) => w.hasTag(a, g))
    }
    const t = ev.roles.target
    if (!t || !('e' in t)) return false // the ground itself does not ask (a meadow catching fire is just fire)
    const e = w.get(t.e)
    if (!e || isA(e.type, 'actor/person')) return false
    if (ev.kind === 'hit' && !ev.element) return false
    const v = w.view(t)!
    return REACTIVE.some((g) => v.tags.has(g)) || eng.lib.nearMisses(ev, rolesOf(ev, w)).length > 0
  }

  private open(ev: GameEvent, signature: string, origin: 'player' | 'world'): UndefinedRecord {
    const w = this.eng.world
    const id = `req-${w.state.seed.toString(36)}-${(++this.seq).toString(36)}-${w.state.tick.toString(36)}`
    const request = buildRequest(this.eng, ev, id)
    const rec: UndefinedRecord = { id, tick: w.state.tick, status: 'pending', request, event: ev, deadline: w.state.tick + this.timeoutTicks, signature, origin }
    this.records.push(rec)
    return rec
  }

  private ask(rec: UndefinedRecord): void {
    const id = rec.id
    const request = rec.request
    if (this.provider) {
      rec.awaiting = true
      this.provider
        .resolve(request, this.spec())
        .then((p) => {
          rec.awaiting = false
          return p ? this.submit(id, p) : this.fallback(id)
        })
        .catch(() => {
          rec.awaiting = false
          this.fallback(id)
        })
    }
  }

  tick(): void {
    const t = this.eng.world.state.tick
    for (const r of this.records) if (r.status === 'pending' && t >= r.deadline) this.fallback(r.id)
  }

  observe(ev: GameEvent, rule: string): void {
    if (ev.kind !== 'interaction') return
    try {
      const sc = buildScenario(this.eng, ev)
      this.regression.push({ scenario: sc, rule })
      if (this.regression.length > 40) this.regression.shift()
    } catch {
      /* best effort */
    }
  }

  private unfreeze(id: string): void {
    for (const e of Object.values(this.eng.world.state.entities)) if (e.frozenBy === id) delete e.frozenBy
  }

  fallback(id: string): void {
    const r = this.get(id)
    if (!r || r.status !== 'pending') return
    r.status = 'fallback'
    this.unfreeze(id)
    this.eng.fallback(r.event)
    this.onChange?.()
  }

  /** Validate and apply a patch for a request (or, with id undefined, a free-standing patch). */
  submit(id: string | undefined, patch: Patch): ValidationResult {
    const eng = this.eng
    const w = eng.world
    const rec = id ? this.get(id) : undefined
    // Idempotent: artifacts the library already holds verbatim (the same shared patch arriving
    // twice, e.g. by sync and by reply) are skipped; the rest is validated as usual.
    const fresh = patch.artifacts?.filter((a) => !alreadyHeld(eng.lib, a)) ?? []
    if (Array.isArray(patch.artifacts) && patch.artifacts.length && !fresh.length) {
      const res: ValidationResult = { ok: true, errors: [], warnings: ['already in the library'], overrides: [] }
      if (rec && rec.status !== 'patched') {
        const ruleIds = patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule.id] : []))
        rec.patch = patch
        rec.rules = ruleIds
        rec.status = 'patched'
        this.unfreeze(rec.id)
        w.fx.push({ t: 'patched', request: rec.id, rule: ruleIds[0] ?? '' })
        if (stillValid(eng, rec.event) && eng.resolve(rec.event).defined) eng.queue(rec.event)
        this.onChange?.()
      }
      return res
    }
    if (fresh.length !== patch.artifacts.length) patch = { ...patch, artifacts: fresh }
    const res = validatePatch(patch, {
      ontology: w.onto.data,
      library: eng.lib,
      scenario: rec?.request.scenario,
      regression: this.regression,
      world: (rec?.origin ?? patch.trigger) === 'world',
      protectedFacts: eng.protectedFacts,
    })
    if (rec) {
      rec.patch = patch
      rec.diagnostics = [...res.errors, ...res.warnings]
    }
    if (!res.ok) {
      const wasPending = rec?.status === 'pending'
      if (rec && wasPending) rec.status = 'rejected'
      if (rec) this.unfreeze(rec.id)
      if (rec && wasPending) eng.fallback(rec.event)
      w.fx.push({ t: 'log', text: `patch rejected: ${res.errors[0]}`, tone: 'warn' })
      this.onChange?.()
      return res
    }
    const now = new Date().toISOString()
    const ruleIds: string[] = []
    for (const a of patch.artifacts) {
      if (a.kind === 'type') {
        w.onto.addType(a.type)
        eng.lib.addType(a.type, now)
      } else if (a.kind === 'status') {
        w.onto.addStatus(a.status)
        eng.lib.addStatus(a.status, now)
      }
    }
    const trigger = rec?.origin ?? patch.trigger ?? a0trigger(patch)
    for (const a of patch.artifacts) {
      if (a.kind !== 'rule') continue
      const rule: Rule = { ...a.rule, source: { origin: 'patch', request: id, author: patch.author ?? 'manual', at: now, note: patch.note, trigger } }
      eng.lib.add(rule, now)
      ruleIds.push(rule.id)
    }
    const wasPending = rec?.status === 'pending' || rec?.status === 'fallback' || rec?.status === 'rejected'
    if (rec) {
      rec.rules = ruleIds
      rec.status = 'patched'
      this.unfreeze(rec.id)
      w.fx.push({ t: 'patched', request: rec.id, rule: ruleIds[0] ?? '' })
      // re-resolve the original event if it still makes sense: the player's act with its
      // participants in place; of the world's, only a standing state (a person still blocked,
      // content still broken) — a passing physical moment is learned for next time
      const again = rec.origin === 'world' ? rec.event.kind === 'blocked' || rec.event.kind === 'invalid' : stillValid(eng, rec.event)
      if (wasPending && again && eng.resolve(rec.event).defined) eng.queue(rec.event)
    }
    this.onChange?.()
    return res
  }

  /** A person answered "nothing happens": the class is not asked about again this session. */
  dismiss(id: string): void {
    const r = this.get(id)
    if (r) this.asks.set(r.signature, MAX_ASKS)
    this.fallback(id)
  }
}

/** Does the library already hold this artifact, identically (provenance aside)? */
export function alreadyHeld(lib: RuleLibrary, a: Artifact): boolean {
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  if (a?.kind === 'rule') {
    const r = lib.rules.get(a.rule?.id)
    if (!r) return false
    const { source: _s, ...held } = r
    const { source: _t, ...given } = a.rule
    return same(held, given)
  }
  if (a?.kind === 'type') return lib.types.some((t) => same(t, a.type))
  if (a?.kind === 'status') return lib.statuses.some((s) => same(s, a.status))
  return false
}

/** Patches synced from the shared library carry their trigger in their rules' provenance. */
function a0trigger(patch: Patch): 'player' | 'world' | undefined {
  for (const a of patch.artifacts ?? []) if (a?.kind === 'rule' && a.rule?.source?.trigger) return a.rule.source.trigger
  return undefined
}

/** The light cue when the world pauses over something it has never seen (design.md §5.9). */
export function worldLine(eng: Engine, ev: GameEvent): { en: string; zh: string } {
  const r = ev.roles
  const n = (ref: Ref | undefined, l: 'en' | 'zh') => eng.nameOf(ref, l)
  if (ev.kind === 'meet') return { en: `${n(r.actor, 'en')} comes up to ${n(r.target, 'en')}…`, zh: `${n(r.actor, 'zh')}凑近了${n(r.target, 'zh')}……` }
  if (ev.kind === 'witness') return { en: `${n(r.actor, 'en')} saw that.`, zh: `${n(r.actor, 'zh')}看见了。` }
  if (ev.kind === 'blocked') return { en: `${n(r.actor, 'en')} stops short.`, zh: `${n(r.actor, 'zh')}停住了。` }
  if (ev.kind === 'invalid') return { en: `Something ${n(r.actor, 'en')} was counting on is gone…`, zh: `${n(r.actor, 'zh')}指望的东西没了……` }
  if (ev.kind === 'hit') return { en: `${ev.element ?? 'Something'} strikes ${n(r.target, 'en')}…`, zh: `${n(r.target, 'zh')}被击中了……` }
  return { en: `The world pauses over ${n(r.target, 'en')}…`, zh: `世界在${n(r.target, 'zh')}上停顿了一下……` }
}

/** A neutral line for an attempt whose outcome is not known yet. */
export function attemptLine(eng: Engine, ev: GameEvent): { en: string; zh: string } {
  const r = ev.roles
  const n = (ref: Ref | undefined, l: 'en' | 'zh') => eng.nameOf(ref, l)
  const self = !!r.target && !!r.actor && 'e' in r.target && 'e' in r.actor && r.target.e === r.actor.e
  if (ev.kind === 'hit') return { en: `Your blow lands on ${n(r.target, 'en')}…`, zh: `你这一击落在了${n(r.target, 'zh')}上……` }
  if (ev.kind === 'enter') return { en: `You step onto ${n(r.target, 'en')}…`, zh: `你踏上了${n(r.target, 'zh')}……` }
  if (ev.verb === 'take') return { en: `You try to take ${n(r.target, 'en')}…`, zh: `你试着去拿${n(r.target, 'zh')}……` }
  if (ev.verb === 'put') return { en: `You set ${n(r.instrument, 'en')} against ${n(r.target, 'en')}…`, zh: `你把${n(r.instrument, 'zh')}往${n(r.target, 'zh')}上放……` }
  if (!r.instrument) return { en: `You reach out to ${n(r.target, 'en')}…`, zh: `你伸手去碰${n(r.target, 'zh')}……` }
  if (self) return { en: `You try ${n(r.instrument, 'en')} on yourself…`, zh: `你试着对自己用${n(r.instrument, 'zh')}……` }
  return { en: `You try ${n(r.instrument, 'en')} on ${n(r.target, 'en')}…`, zh: `你试着把${n(r.instrument, 'zh')}用在${n(r.target, 'zh')}上……` }
}

function stillValid(eng: Engine, ev: GameEvent): boolean {
  const w = eng.world
  const a = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
  if (!a) return false
  if (ev.roles.instrument && 'e' in ev.roles.instrument && a.held !== ev.roles.instrument.e) return false
  if (ev.roles.target && 'e' in ev.roles.target && !w.get(ev.roles.target.e)) return false
  const ap = w.posOf(a)
  const tp = w.refPos(ev.roles.target)
  if (!ap || !tp || ap.map !== tp.map) return false
  return Math.abs(ap.x - tp.x) + Math.abs(ap.y - tp.y) <= 2
}

// ---------------------------------------------------------------- building requests

function info(eng: Engine, role: string, v: View | undefined, origin?: { x: number; y: number }): EntityInfo | undefined {
  if (!v) return undefined
  const w = eng.world
  const p = w.refPos(v.ref)
  const chain = v.kind === 'tile' ? [v.type] : w.onto.resolve(v.type).chain
  return {
    role,
    id: v.id,
    name: eng.nameOf(v.ref),
    kind: v.kind,
    type: v.type,
    typeChain: chain,
    tags: [...v.tags],
    statuses: [...v.statuses],
    props: v.props,
    at: p && origin ? [p.x - origin.x, p.y - origin.y] : undefined,
  }
}

export function summarize(eng: Engine, ev: GameEvent): string {
  const n = (r: Ref | undefined) => eng.nameOf(r)
  const inst = ev.roles.instrument ? ` holding ${n(ev.roles.instrument)}` : ''
  if (ev.kind === 'hit') return `${ev.roles.actor ? n(ev.roles.actor) : 'the world'} hits → ${n(ev.roles.target)}${ev.element ? ` with ${ev.element}` : ''}${inst}`
  if (ev.kind === 'enter') return `${n(ev.roles.actor)} steps onto → ${n(ev.roles.target)}`
  if (ev.kind === 'status') return `${n(ev.roles.target)} becomes ${ev.status}`
  if (ev.kind === 'meet') return `${n(ev.roles.actor)} meets → ${n(ev.roles.target)}`
  if (ev.kind === 'blocked') return `${n(ev.roles.actor)} is blocked from "${ev.about}" by → ${n(ev.roles.target)}`
  if (ev.kind === 'witness') return `${n(ev.roles.actor)} witnesses ${n(ev.roles.target)} ${ev.about?.split(':')[0]} → ${n(ev.roles.instrument)} (${ev.about?.split(':')[1]})`
  if (ev.kind === 'invalid') return `content "${ev.about}" of ${n(ev.roles.actor)} is broken`
  return `${n(ev.roles.actor)} ${ev.verb} → ${n(ev.roles.target)}${inst}${ev.strict && !ev.roles.instrument ? ' (bare hand)' : ''}`
}

export function buildRequest(eng: Engine, ev: GameEvent, id: string): ModRequest {
  const w = eng.world
  const roles = rolesOf(ev, w)
  const center = w.refPos(ev.roles.target) ?? w.refPos(ev.roles.actor)!
  const mapData = w.map(center.map)!
  const tiles: string[][] = []
  const tileStatuses: { at: [number, number]; statuses: string[] }[] = []
  for (let dy = -WINDOW; dy <= WINDOW; dy++) {
    const row: string[] = []
    for (let dx = -WINDOW; dx <= WINDOW; dx++) {
      const x = center.x + dx
      const y = center.y + dy
      row.push(w.terrainAt(center.map, x, y))
      const st = w.tileState(center.map, x, y)?.statuses
      if (st && Object.keys(st).length) tileStatuses.push({ at: [dx, dy], statuses: Object.keys(st) })
    }
    tiles.push(row)
  }
  const involved = new Set([roles.actor?.id, roles.target?.id, roles.instrument?.id].filter(Boolean))
  const nearby: EntityInfo[] = []
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      for (const e of w.entitiesAt(center.map, center.x + dx, center.y + dy)) {
        if (involved.has(e.id)) continue
        const i = info(eng, 'nearby', w.view({ e: e.id }), center)
        if (i) nearby.push(i)
      }
  const recent = w.fx
    .filter((f) => f.t === 'log' || f.t === 'say')
    .slice(-6)
    .map((f) => ('text' in f ? textOf(f.text) : ''))
  return {
    id,
    summary: summarize(eng, ev),
    origin: WORLD_KINDS.has(ev.kind) && ev.origin !== 'player' && !(ev.kind === 'hit' && isPlayer(eng, ev.roles.actor)) ? 'world' : 'player',
    event: {
      kind: ev.kind,
      verb: ev.verb,
      element: ev.element,
      power: ev.power,
      status: ev.status,
      strict: ev.strict,
      about: ev.about,
      detail: detailOf(eng, ev),
      actor: info(eng, 'actor', roles.actor, center),
      target: info(eng, 'target', roles.target, center),
      instrument: info(eng, 'instrument', roles.instrument, center),
    },
    context: {
      map: { id: mapData.id, name: textOf(mapData.name), kind: mapData.kind, region: mapData.region },
      anchors: Object.keys(mapData.anchors ?? {}),
      hour: Math.round(w.hour() * 10) / 10,
      nearby: nearby.slice(0, 16),
      tiles,
      tileStatuses,
      recent,
      nearMisses: eng.lib.nearMisses(ev, roles),
    },
    scenario: buildScenario(eng, ev),
  }
}

const isPlayer = (eng: Engine, r: Ref | undefined) => !!r && 'e' in r && r.e === eng.world.state.player

/** What a world event is about, in words, for the modder. */
function detailOf(eng: Engine, ev: GameEvent): string | undefined {
  const w = eng.world
  const n = (r: Ref | undefined) => eng.nameOf(r)
  if (ev.kind === 'invalid') {
    const inv = eng.invariants.find((i) => i.id === ev.about)
    return inv ? textOf(inv.text) : undefined
  }
  if (ev.kind === 'witness') {
    const t = ev.roles.instrument && 'e' in ev.roles.instrument ? w.get(ev.roles.instrument.e) : undefined
    const owner = t && eng.ownerOf(t)
    return `${n(ev.roles.actor)} saw ${n(ev.roles.target)} ${ev.about?.split(':')[0]} ${n(ev.roles.instrument)}${owner ? ` (it belongs to ${n({ e: owner })})` : ''}`
  }
  if (ev.kind === 'blocked') {
    const p = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    const s = p?.npc?.person?.schedules?.flatMap((v) => v.entries).find((x) => x.activity === ev.about)
    return `${n(ev.roles.actor)} wants to "${ev.about}" but ${'tile' in (ev.roles.target ?? {}) ? 'cannot reach the spot' : `${n(ev.roles.target)} is not as it must be${s?.need ? ` (${JSON.stringify(s.need)})` : ''}`}`
  }
  return undefined
}

/** Snapshot the interaction's neighbourhood as a replayable scenario. */
export function buildScenario(eng: Engine, ev: GameEvent): Scenario {
  const w = eng.world
  const center = w.refPos(ev.roles.target) ?? w.refPos(ev.roles.actor)!
  const ox = center.x - WINDOW
  const oy = center.y - WINDOW
  const terrain: string[][] = []
  for (let y = 0; y <= 2 * WINDOW; y++) {
    const row: string[] = []
    for (let x = 0; x <= 2 * WINDOW; x++) {
      const t = w.terrainAt(center.map, ox + x, oy + y)
      row.push(t === 'void' ? 'wall' : t)
    }
    terrain.push(row)
  }
  const entities: ScenarioEntity[] = []
  const keyOf = new Map<string, string>()
  const addEntity = (id: string, key: string) => {
    const e = w.get(id)
    if (!e || keyOf.has(id)) return
    const p = w.posOf(e)
    if (!p) return
    keyOf.set(id, key)
    const se: ScenarioEntity = {
      key,
      type: e.type,
      x: p.x - ox,
      y: p.y - oy,
      tags: e.tags?.length ? [...e.tags] : undefined,
      statuses: e.statuses ? Object.keys(e.statuses) : undefined,
      props: e.props ? { ...e.props } : undefined,
    }
    entities.push(se)
    if (e.place.on === 'hand' || e.place.on === 'inside') {
      const holderKey = keyOf.get(e.place.holder)
      if (holderKey) {
        if (e.place.on === 'hand') se.heldBy = holderKey
        else se.inside = holderKey
      } else {
        delete se.heldBy
      }
    }
  }
  const roleKey = (r: Ref | undefined, key: string): string | undefined => {
    if (!r) return undefined
    if ('tile' in r) return `tile:${r.tile.x - ox},${r.tile.y - oy}`
    const e = w.get(r.e)
    if (!e) return undefined
    // make sure holders come first so held/inside links resolve
    if (e.place.on === 'hand' || e.place.on === 'inside') {
      const h = e.place.holder
      if (!keyOf.has(h)) addEntity(h, h === (ev.roles.actor as { e?: string })?.e ? 'actor' : `holder_${key}`)
    }
    addEntity(r.e, key)
    return keyOf.get(r.e)
  }
  const actor = roleKey(ev.roles.actor, 'actor')
  const instrument = roleKey(ev.roles.instrument, 'instrument')
  const target = roleKey(ev.roles.target, 'target')
  let n = 0
  for (let y = 0; y <= 2 * WINDOW; y++)
    for (let x = 0; x <= 2 * WINDOW; x++)
      for (const e of w.entitiesAt(center.map, ox + x, oy + y)) if (!keyOf.has(e.id) && n < 12) addEntity(e.id, `n${++n}`)
  const player = keyOf.get(w.state.player) ?? '__player'
  return { terrain, entities, player, event: { kind: ev.kind, verb: ev.verb, actor, target, instrument, element: ev.element, power: ev.power, strict: ev.strict, status: ev.status, about: ev.about } }
}

// ---------------------------------------------------------------- validation

const OPS = new Set(Object.keys(PRIMITIVES))
const EVENT_KINDS = new Set(['interaction', 'hit', 'status', 'expire', 'tick', 'enter', 'defeat', 'meet', 'blocked', 'witness', 'invalid'])
/** Effects that would harm whoever fills the role. */
const HARMFUL = new Set(['damage', 'hit', 'push', 'destroy', 'transform'])
const ROLE_REFS = new Set(['actor', 'target', 'instrument', 'tileOf:actor', 'tileOf:target', 'tileOf:instrument'])

interface ValidateCtx {
  ontology: Ontology
  library: RuleLibrary
  scenario?: Scenario
  regression?: { scenario: Scenario; rule: string }[]
  /** The patch answers the world's own event: the boundaries of design.md §5.8 apply. */
  world?: boolean
  /** Fact-key prefixes only the story may change. */
  protectedFacts?: string[]
}

export function validatePatch(patch: Patch, ctx: ValidateCtx): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const overrides: string[] = []
  if (!patch || !Array.isArray(patch.artifacts) || !patch.artifacts.length) {
    return { ok: false, errors: ['patch.artifacts must be a non-empty array'], warnings, overrides }
  }
  // candidate ontology (+ patch types/statuses)
  const onto: Ontology = structuredClone(ctx.ontology)
  for (const t of ctx.library.types) onto.types[t.id] = t
  for (const s of ctx.library.statuses) onto.statuses[s.id] = s
  const rules: Rule[] = []
  for (const [i, a] of patch.artifacts.entries()) {
    const where = `artifact[${i}]`
    if (a?.kind === 'type') {
      const t = a.type
      if (!t?.id || typeof t.id !== 'string') errors.push(`${where}: type.id required`)
      else if (!['actor', 'item', 'fixture'].includes(t.kind)) errors.push(`${where}: type.kind must be actor|item|fixture`)
      else if (!t.id.startsWith(t.kind + '/')) errors.push(`${where}: type id must start with "${t.kind}/"`)
      else onto.types[t.id] = t
    } else if (a?.kind === 'status') {
      if (!a.status?.id) errors.push(`${where}: status.id required`)
      else onto.statuses[a.status.id] = a.status
    } else if (a?.kind === 'rule') {
      rules.push(a.rule)
    } else errors.push(`${where}: unknown artifact kind`)
  }
  if (!rules.length && !errors.length) warnings.push('patch has no rule: nothing will change behaviour')

  // 1-3. schema, ontology & assets, effect typing
  const known = (id: string) => id in onto.types || Object.keys(onto.types).some((t) => t.startsWith(id + '/'))
  const checkSel = (s: Selector | undefined, where: string) => {
    if (!s) return
    if (typeof s !== 'object') return errors.push(`${where}: selector must be an object`)
    if (s.type && !s.type.startsWith('tile/') && !known(s.type)) errors.push(`${where}.type: unknown type "${s.type}"`)
    if (s.type?.startsWith('tile/') && !(s.type.slice(5) in onto.terrains)) errors.push(`${where}.type: unknown terrain "${s.type}"`)
    for (const st of [...(s.status ?? []), ...(s.notStatus ?? [])])
      if (!(st in onto.statuses)) errors.push(`${where}: unknown status "${st}"`)
    if (s.kind && !['actor', 'item', 'fixture', 'tile'].includes(s.kind)) errors.push(`${where}.kind invalid`)
    if (s.id) warnings.push(`${where}: instance-bound selector (id) — prefer types/tags`)
  }
  const checkCond = (c: Cond | undefined, where: string): void => {
    if (!c) return
    if ('all' in c) return c.all.forEach((x, i) => checkCond(x, `${where}.all[${i}]`))
    if ('any' in c) return c.any.forEach((x, i) => checkCond(x, `${where}.any[${i}]`))
    if ('not' in c) return checkCond(c.not, `${where}.not`)
    if ('has' in c) {
      if (!ROLES.includes(c.has.role)) errors.push(`${where}.has.role invalid`)
      if (c.has.status && !(c.has.status in onto.statuses)) errors.push(`${where}: unknown status "${c.has.status}"`)
      return
    }
    if ('count' in c) {
      const k = c.count
      if (!ROLES.includes(k.role)) errors.push(`${where}.count.role invalid`)
      if (k.in !== 'contents' && k.in !== 'tile') errors.push(`${where}.count.in must be contents|tile`)
      checkSel(k.match, `${where}.count.match`)
      const bounds = Object.entries(k.cmp ?? {})
      if (!bounds.length) errors.push(`${where}.count.cmp needs a bound`)
      for (const [op, o] of bounds) {
        if (!['eq', 'gt', 'gte', 'lt', 'lte'].includes(op)) errors.push(`${where}.count.cmp.${op}: unknown bound`)
        else if (typeof o !== 'number' && !(o && typeof o === 'object' && typeof o.prop === 'string' && ROLES.includes(o.of)))
          errors.push(`${where}.count.cmp.${op}: must be a number or {prop, of: role}`)
      }
      return
    }
    if ('prop' in c || 'chance' in c || 'hour' in c || 'fact' in c || 'topic' in c || 'weather' in c) return
    if ('exists' in c) return void checkSel(c.exists, `${where}.exists`)
    errors.push(`${where}: unknown condition`)
  }
  const roleRef = (r: unknown, where: string) => {
    if (typeof r !== 'string' || !ROLE_REFS.has(r)) errors.push(`${where}: role ref must be one of ${[...ROLE_REFS].join('|')}`)
  }
  const checkEffect = (e: Effect, where: string) => {
    if (!e || !OPS.has(e.op)) return errors.push(`${where}: unknown primitive "${(e as { op?: string })?.op}"`)
    const any = e as Record<string, unknown>
    for (const k of ['of', 'at', 'to', 'who', 'from', 'away', 'item'] as const) if (k in any) roleRef(any[k], `${where}.${k}`)
    if ((e.op === 'spawn' || e.op === 'transform') && !(e.op === 'spawn' ? e.type : e.into)) errors.push(`${where}: type required`)
    if (e.op === 'spawn' && !/^@prop:(actor|target|instrument)\.\w+$/.test(e.type) && !(e.type in onto.types)) errors.push(`${where}: unknown type "${e.type}"`)
    if (e.op === 'transform' && !e.into.startsWith('@prop:') && !(e.into in onto.types)) errors.push(`${where}: unknown type "${e.into}"`)
    if ((e.op === 'addStatus' || e.op === 'removeStatus' || e.op === 'spread') && e.status && !(e.status in onto.statuses))
      errors.push(`${where}: unknown status "${e.status}"`)
    if (e.op === 'setTerrain' && !(e.terrain in onto.terrains)) errors.push(`${where}: unknown terrain "${e.terrain}"`)
    if (e.op === 'vfx' && !onto.vfx.includes(e.fx)) errors.push(`${where}: unknown vfx "${e.fx}"`)
    if (e.op === 'spread') {
      if (e.radius > 3) errors.push(`${where}: spread radius must be ≤ 3`)
      if (e.chance === undefined || e.chance >= 1) warnings.push(`${where}: spread with chance 1 can cascade`)
      checkSel(e.filter, `${where}.filter`)
    }
    if ((e.op === 'damage' || e.op === 'hit') && e.element && !ctx.ontology.elements.includes(e.element))
      errors.push(`${where}: unknown element "${e.element}"`)
    if (e.op === 'setTerrain' && !String(e.of).startsWith('tileOf:') && e.of !== 'target') errors.push(`${where}: setTerrain needs a tile role`)
    if (e.op === 'layLine' && !(e.terrain in onto.terrains)) errors.push(`${where}: unknown terrain "${e.terrain}"`)
    if (e.op === 'layLine' && !(e.length >= 1 && e.length <= 8)) errors.push(`${where}: layLine length must be 1–8`)
    if (e.op === 'goto' && !(e.hours > 0 && e.hours <= 12)) errors.push(`${where}: goto hours must be in (0, 12]`)
    if (e.op === 'emote' && !['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'].includes(e.mood)) errors.push(`${where}: unknown mood "${e.mood}"`)
    // the boundaries of the world's own patches (design.md §5.8)
    if (ctx.world) {
      const fact = e.op === 'setFact' || e.op === 'addFact' ? e.key : undefined
      if (fact && (ctx.protectedFacts ?? []).some((p) => fact.startsWith(p))) errors.push(`${where}: a world event may not change the story's fact "${fact}"`)
      if ((e.op === 'setProp' || e.op === 'addProp') && e.key === 'quest') errors.push(`${where}: a world event may not change the story's stage`)
    }
  }
  const ids = new Set<string>()
  for (const [i, r] of rules.entries()) {
    const where = `rule[${i}]${r?.id ? ` "${r.id}"` : ''}`
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: not an object`)
      continue
    }
    if (!r.id || typeof r.id !== 'string') errors.push(`${where}: id required`)
    if (ids.has(r.id)) errors.push(`${where}: duplicate id in patch`)
    ids.add(r.id)
    if (ctx.library.rules.has(r.id)) errors.push(`${where}: id already exists in the library`)
    if (!EVENT_KINDS.has(r.on)) errors.push(`${where}: on must be one of ${[...EVENT_KINDS].join('|')}`)
    if (!r.when || typeof r.when !== 'object') errors.push(`${where}: when required`)
    else {
      for (const role of ROLES) checkSel(r.when[role], `${where}.when.${role}`)
      for (const el of r.when.element ?? []) if (el !== 'none' && !ctx.ontology.elements.includes(el)) errors.push(`${where}: unknown element "${el}"`)
      for (const st of r.when.status ?? []) if (!(st in onto.statuses)) errors.push(`${where}: unknown status "${st}"`)
      if (r.on === 'interaction' && !r.when.verb?.length) warnings.push(`${where}: interaction rule without verb matches every verb`)
      // a catch-all ("any item on anything: nothing happens") would answer every undefined
      // interaction at once and end the world's growth: say WHAT it is about
      const positive = (s?: Selector) => !!s && !!(s.type || s.tags?.length || s.status?.length || s.id || s.player)
      if (r.on === 'interaction' && !positive(r.when.target) && !positive(r.when.instrument))
        errors.push(`${where}: too broad — select the target or the instrument by type, tags or status (a catch-all would swallow every undefined interaction)`)
    }
    checkCond(r.guard, `${where}.guard`)
    if (!Array.isArray(r.do) || !r.do.length) errors.push(`${where}: do must be a non-empty array`)
    else r.do.forEach((e, j) => checkEffect(e, `${where}.do[${j}]`))
    // a world event's people (the witness, the blocked, the giver) are never harmed by it
    if (ctx.world && Array.isArray(r.do) && ['witness', 'blocked', 'invalid'].includes(r.on))
      for (const [j, e] of r.do.entries()) {
        const of = (e as { of?: string }).of
        if (HARMFUL.has(e.op) && (of === 'actor' || (r.on !== 'blocked' && of === 'target'))) errors.push(`${where}.do[${j}]: a world event may not harm a person (${e.op} on ${of})`)
      }
    if (!r.tests?.length) warnings.push(`${where}: no tests`)
  }
  if (errors.length) return { ok: false, errors, warnings, overrides }

  // 4. conflicts at equal specificity
  for (const r of rules) {
    const s = specOf(r)
    for (const other of ctx.library.forKind(r.on)) {
      if (compareSpec(s, specOf(other)) !== 0 || r.compose || other.compose) continue
      if (patternsOverlap(r, other, onto) && JSON.stringify(r.do) !== JSON.stringify(other.do))
        errors.push(`rule "${r.id}" conflicts with "${other.id}" at equal specificity — make it more specific or change the pattern`)
    }
  }
  if (errors.length) return { ok: false, errors, warnings, overrides }

  // candidate library
  const cand = ctx.library.clone()
  for (const a of patch.artifacts) {
    if (a.kind === 'type') cand.types = cand.types.filter((t) => t.id !== a.type.id).concat(a.type)
    if (a.kind === 'status') cand.statuses = cand.statuses.filter((t) => t.id !== a.status.id).concat(a.status)
  }
  for (const r of rules) cand.add({ ...r, source: { origin: 'patch' } })
  const patchIds = new Set(rules.map((r) => r.id))

  // 5. sandbox replay of the triggering interaction
  if (ctx.scenario && rules.some((r) => r.on === (ctx.scenario!.event.kind ?? 'interaction'))) {
    try {
      const rp = replay(ctx.scenario, ctx.ontology, cand)
      if (!rp.resolution.defined) errors.push('replay: the triggering interaction is still undefined under the patch')
      else if (!patchIds.has(rp.resolution.rule!.id))
        errors.push(`replay: the triggering interaction resolved to "${rp.resolution.rule!.id}", not to the patch`)
      errors.push(...rp.errors.map((e) => `replay: ${e}`))
      // no person in the scene is hurt or removed by the world's own patch (design.md §5.8)
      if (ctx.world)
        for (const se of ctx.scenario.entities) {
          if (!isA(se.type, 'actor/person')) continue
          const after = rp.engine.world.get(se.key)
          if (!after) errors.push(`replay: a world event may not remove a person (${se.key})`)
          else if (rp.engine.world.num(after, 'hp') < (rp.hpBefore[se.key] ?? 0)) errors.push(`replay: a world event may not hurt a person (${se.key})`)
        }
    } catch (err) {
      errors.push(`replay: ${(err as Error).message}`)
    }
  }
  // 6. the patch's own tests
  for (const r of rules)
    for (const [i, t] of (r.tests ?? []).entries()) {
      try {
        const rp = replay(t.given, ctx.ontology, cand)
        const fails = [...rp.errors, ...checkExpectations(rp.engine, t.expect ?? [])]
        for (const f of fails) errors.push(`test "${t.name ?? `${r.id}#${i}`}": ${f}`)
      } catch (err) {
        errors.push(`test "${t.name ?? `${r.id}#${i}`}": ${(err as Error).message}`)
      }
    }
  // 7. regression: previously-defined interactions must stay defined
  for (const reg of ctx.regression ?? []) {
    try {
      const rp = replay(reg.scenario, ctx.ontology, cand)
      if (!rp.resolution.defined) errors.push(`regression: an interaction resolved by "${reg.rule}" became undefined`)
      else if (rp.resolution.rule!.id !== reg.rule && patchIds.has(rp.resolution.rule!.id)) overrides.push(`${reg.rule} → ${rp.resolution.rule!.id}`)
    } catch {
      /* scenario no longer buildable (e.g. removed types) — ignore */
    }
  }
  return { ok: errors.length === 0, errors, warnings, overrides }
}

/**
 * Could one concrete event match both rules? Contradictory constraints rule it out, and so
 * does the ontology: two tag sets overlap only if some type (plus instance-assignable tags)
 * can carry all of them at once.
 */
export function patternsOverlap(a: Rule, b: Rule, onto?: Ontology): boolean {
  const av = a.when.verb
  const bv = b.when.verb
  if (av && bv && !av.some((v) => bv.includes(v))) return false
  const ae = a.when.element
  const be = b.when.element
  if (ae && be && !ae.some((v) => be.includes(v))) return false
  const as = a.when.status
  const bs = b.when.status
  if (as && bs && !as.some((v) => bs.includes(v))) return false
  const aa = a.when.about
  const ba = b.when.about
  if (aa && ba && !aa.some((v) => ba.includes(v))) return false
  for (const role of ROLES) {
    const x = a.when[role]
    const y = b.when[role]
    if (!x || !y) continue
    if (!!x.none !== !!y.none && (x.none || y.none)) {
      if (x.none && Object.keys(y).length > 0) return false
      if (y.none && Object.keys(x).length > 0) return false
    }
    if (x.kind && y.kind && x.kind !== y.kind) return false
    if (x.type && y.type && !isA(x.type, y.type) && !isA(y.type, x.type)) return false
    if (x.id && y.id && x.id !== y.id) return false
    if (x.tags?.some((t) => y.notTags?.includes(t)) || y.tags?.some((t) => x.notTags?.includes(t))) return false
    if (x.status?.some((t) => y.notStatus?.includes(t)) || y.status?.some((t) => x.notStatus?.includes(t))) return false
    for (const [k, c] of Object.entries(x.props ?? {})) if (y.props && k in y.props && !cmpsMeet(c, y.props[k])) return false
    if (onto && !satisfiable(x, y, onto)) return false
  }
  return true
}

/** Can some value pass both property comparisons? (`planks: 2` and `planks: 3` cannot; nor `< 4` and `>= 4`.) */
function cmpsMeet(a: Cmp, b: Cmp): boolean {
  const eqOf = (c: Cmp) => (typeof c !== 'object' || c === null ? c : c.eq)
  const ea = eqOf(a)
  const eb = eqOf(b)
  if (ea !== undefined) return cmp(ea, b) && cmp(ea, a)
  if (eb !== undefined) return cmp(eb, a)
  const lo = (c: Cmp) => (typeof c === 'object' && c ? [c.gt ?? c.gte ?? -Infinity, c.gt !== undefined] as const : ([-Infinity, false] as const))
  const hi = (c: Cmp) => (typeof c === 'object' && c ? [c.lt ?? c.lte ?? Infinity, c.lt !== undefined] as const : ([Infinity, false] as const))
  const [la, xa] = lo(a)
  const [lb, xb] = lo(b)
  const [ha, ya] = hi(a)
  const [hb, yb] = hi(b)
  const [l, lx] = la > lb ? [la, xa] : lb > la ? [lb, xb] : [la, xa || xb]
  const [h, hx] = ha < hb ? [ha, ya] : hb < ha ? [hb, yb] : [ha, ya || yb]
  return l < h || (l === h && !lx && !hx)
}

function satisfiable(x: Selector, y: Selector, onto: Ontology): boolean {
  // the player is an actor/person/player: anything that excludes that is disjoint from it
  for (const [p, q] of [[x, y], [y, x]]) {
    if (p.player !== true) continue
    if (q.kind && q.kind !== 'actor') return false
    if (q.type && !isA('actor/person/player', q.type)) return false
    if (q.player === false) return false
  }
  // oneself is the event's actor, and actors are actors: anything else is disjoint from it
  for (const [p, q] of [[x, y], [y, x]]) {
    if (p.self !== true) continue
    if (q.kind && q.kind !== 'actor') return false
    if (q.type && !isA(q.type, 'actor') && !isA('actor', q.type)) return false
    if (q.self === false) return false
  }
  if (x.none || y.none || x.id || y.id || x.player !== undefined || y.player !== undefined) return true
  const need = [...(x.tags ?? []), ...(y.tags ?? [])]
  const forbid = [...(x.notTags ?? []), ...(y.notTags ?? [])]
  const free = new Set(onto.instanceTags ?? [])
  const kind = x.kind ?? y.kind
  const type = [x.type, y.type].filter(Boolean).sort((p, q) => q!.length - p!.length)[0]
  const ok = (tags: Set<string>) => need.every((t) => tags.has(t) || free.has(t)) && !forbid.some((t) => tags.has(t))
  if (kind === 'tile' || type?.startsWith('tile/')) {
    return Object.values(onto.terrains).some((t) => (!type || isA(`tile/${t.id}`, type)) && ok(new Set(t.tags ?? [])))
  }
  const index = new OntologyIndex(onto)
  for (const id of Object.keys(onto.types)) {
    if (type && !isA(id, type)) continue
    const r = index.resolve(id)
    if (kind && r.kind !== kind) continue
    if (!kind && !type && r.kind === 'tile') continue
    if (ok(new Set(r.tags))) return true
  }
  // no x.kind/x.type: tiles can fill the role too
  if (!kind && !type) return Object.values(onto.terrains).some((t) => ok(new Set(t.tags ?? [])))
  return false
}
