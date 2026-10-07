// The Mod port (design.md §5.11, §8): the exact contract a modder implements.
//   an event whose outcome is undefined → ModRequest (event + host + the path to the hole +
//   context + scenario) + ModSpec → Patch → validatePatch (schema, ontology, locality, sandbox
//   replay, tests, regression) → the patch layer of the library, which is consulted only where
//   the base outcome is undefined → the held event replays.
// The engine is the trust boundary: patches are untrusted data until validated.

import { EVENT_KINDS } from './types.ts'
import { PRIMITIVES, RESIDENT_ONLY } from './effects.ts'
import type { Engine, Resolution, UndefinedSink } from './engine.ts'
import { STORY, textOf } from './engine.ts'
import { OntologyIndex, isA, withTerrainTypes } from './ontology.ts'
import { deriveRecipes } from './recipes.ts'
import { RuleLibrary, cmp, compareSpec, isDo, isHole, leaves, rolesOf, specOf, type LibraryData } from './rules.ts'
import { REPEAT_TIMES, buildSandbox, checkExpectations, endlessYield, replay, scenarioEvent } from './sandbox.ts'
import type { Cmp, Cond, Effect, EmitTo, GameEvent, Ontology, PixelArt, PropValue, Ref, RoleName, Rule, Scenario, ScenarioEntity, Selector, StatusDef, Text, Tree, TypeDef } from './types.ts'
import { RECENT_LINES, type View } from './world.ts'

// ---------------------------------------------------------------- contract

export type Artifact =
  | { kind: 'rule'; rule: Rule }
  | { kind: 'type'; type: TypeDef }
  | { kind: 'status'; status: StatusDef }

export interface Patch {
  artifacts: Artifact[]
  note?: string
  author?: string
  /** Who started the chain it answers (the Threadbook's "you" or "the world"). */
  trigger?: 'player' | 'world'
}

export interface EntityInfo {
  role: string
  id?: string
  name: string
  type: string
  typeChain: string[]
  tags: string[]
  statuses: string[]
  props: Record<string, unknown>
  /** What it is made of (its material's category and hardness), and what it leaves when it breaks (world-model.md §8.1). */
  material?: { id: string; category: string; hardness: number }
  makeup?: { type: string; count: number; chance?: number }[]
  /** Offset from the host's tile. */
  at?: [number, number]
}

export interface ModRequest {
  id: string
  summary: string
  /** Who started the chain: the player's own act, or the world by itself (a cascade, a creature, a person, the story). */
  origin: 'player' | 'world'
  /** The event whose outcome is undefined: its kind, its parameters, its host and its other roles. */
  event: { kind: string; params: Record<string, unknown>; host?: EntityInfo; roles: Partial<Record<RoleName, EntityInfo>>; detail?: string }
  /** Where the base outcome is undefined: the rule, the branches taken to reach it, and its default (what happens while nobody answers). */
  hole: { rule: string; path: string[]; default: Effect[] }
  context: {
    map: { id: string; name: string; kind: string; region?: string }
    /** Named spots of the map (for `goto`). */
    anchors: string[]
    hour: number
    nearby: EntityInfo[]
    tiles: string[][] // terrain window around the host, the host at the center
    tileStatuses: { at: [number, number]; statuses: string[] }[]
    recent: string[]
    /** What the world already says about this host and kind: the rules that cover it, most specific first. */
    rules: Rule[]
  }
  /** A self-contained replay of the event (used by validation and by patch tests). */
  scenario: Scenario
}

export interface ModSpec {
  version: string
  summary: string
  rule: Record<string, string>
  tree: Record<string, string>
  selector: Record<string, string>
  conditions: string[]
  events: Record<string, string>
  impulses: Record<string, string>
  primitives: Record<string, string>
  expectations: string[]
  ontology: {
    types: { id: string; tags: string[]; name?: string }[]
    statuses: { id: string; duration?: number; immobilize?: boolean; moveDelay?: number; clears?: string[] }[]
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

/** What the client knows that the service may not: its local patches and recent defined acts. */
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
 * answers this event (no model call); `failed`: no valid patch within the harness's budget;
 * `unavailable`: no model configured.
 */
export interface ResolveReply {
  patch: Patch | null
  outcome: 'accepted' | 'covered' | 'failed' | 'unavailable'
  episode?: string
  diagnostics?: string[]
}

/**
 * Where a request is in the modder (GET /progress?id=): waiting its turn, designed from what the
 * request holds (local), looked up in the world's catalogue (find), or making things the world
 * does not have yet (create, art), with their names. While it creates, the client keeps waiting.
 */
export interface ModProgress {
  stage: 'queued' | 'local' | 'find' | 'create' | 'art'
  creating?: Text[]
}

/** One entry of the shared library's append-only patch log (GET /patches?since=seq). */
export type PatchLogEntry =
  | { seq: number; at: string; patch: Patch; rules: string[]; request?: string; /** the triggering event (kept server-side as regression) */ scenario?: Scenario }
  | { seq: number; at: string; remove: string }

export type RecordStatus = 'pending' | 'patched' | 'fallback' | 'rejected'

export interface UndefinedRecord {
  id: string
  tick: number
  status: RecordStatus
  request: ModRequest
  event: GameEvent
  deadline: number
  /** The hole and the class of the event: what counts as "the same question". */
  signature: string
  origin: 'player' | 'world'
  /** A reply from the provider is still on its way (it may arrive after the default ran). */
  awaiting?: boolean
  patch?: Patch
  diagnostics?: string[]
  rules?: string[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Earlier patches the new one now shadows for some events (informational). */
  overrides: string[]
}

// ---------------------------------------------------------------- the ModSpec

const AUTHORING_RULES = [
  'You answer ONE undefined outcome: an event reached an undefined leaf (request.hole). Write a rule that gives that outcome — your rule is consulted only where the world says "undefined", so it can never change what is already defined.',
  'A rule belongs to a HOST: the thing whose nature it describes. Write what the host does when the event happens to it. Read anything (conditions on any role), but WRITE ONLY THE HOST: every effect acts on the host, spawns new things, or presents. To affect anything else, `emit` an impulse to it — the receiver answers for itself (lava does not hurt people; lava emits element fire to what stands on it, and a person, taking fire, loses health).',
  'Write the CLASS, not the instance: select the host by the most general type/tags/statuses that make the outcome plausible. Never use `id` unless the behaviour truly belongs to one unique thing.',
  'Name the host: a rule with an empty host is a root rule and is not allowed in a patch.',
  'Conditions narrow the cases (the other role\'s tags, a param like element or how). Cases you do not want to answer: leave them to `inherit` (an `if` without `else` inherits).',
  'Use only the listed event kinds, impulses, primitives, statuses, terrains, types and vfx. If you need a new type or status, add a `type`/`status` artifact to the same patch.',
  'Every rule should carry at least one test (a small scenario + expectations). The triggering event is replayed automatically.',
  'Combat talents are evaluated by the engine for any actor carrying skill:<id>. Actor props profession, moveHaste, attackHaste and critChance control eligibility/cadence/critical chance. Attack hit.power already includes offensive talents; do not apply them again in a hit rule. Direct combat damage reductions and Last Stand are handled by damage. Timed talent state lives in Entity.combat and is saved.',
  'Give the player feedback: a `vfx` and/or a `say`/`log` line, so the outcome is visible.',
  'Name slots ({actor}, {target}, {host}, …) read "you" when they are the player: write lines that read right either way — no verb or possessive straight after a slot ("a warm glow mends {target}", not "{actor} holds" or "{target}\'s wounds").',
  'Keep emissions local and bounded: an area radius of at most 3, and a chance below 1 when it could cascade.',
  'A yield must cost its host (world-model.md §8.4): what someone can do again at will (an act, what it sets off) may not keep making things from a host that is neither changed nor used up — the validator replays the triggering event 12 times with no time between, and refuses an endless yield. Change the host (a status that gates the yield and runs out, its durability, its type) or use it up.',
  'Things with durability (props.maxHp) already lose it to blows and fire, and break into their makeup: a blow on a tree, rock or a wall is defined. A new type that can break names props.material and what it leaves (makeup [{type, count}] or a rule of its own on threshold/cross "broken").',
  'An act hosted by an instrument that consumes or changes it says so: `destroy` or `transform` the host.',
  'Outcomes the world started by itself (origin "world") happen without the player asking: keep them small and legible, never harm a person, never touch the story\'s facts, and let people react with say/emote, a notice to the story (a topic), or goto.',
]

const EVENTS: Record<string, string> = {
  'act/use': 'an actor uses the host (an instrument) on the target; with no instrument the host is the actor\'s own hands. Roles actor, target, instrument. Params verb, power (atk + the instrument\'s power), element (the instrument\'s or the actor\'s), attack (a blow aimed along the facing).',
  'act/put': 'an actor puts the host (an item) onto or into the target. The root emits `receive` (or `offered` to an actor) to the target.',
  'act/take': 'an actor takes the target with their hands (host: the actor). The root emits `taken` to the target.',
  'act/hands': 'an actor touches, opens, talks to the target bare-handed (host: the actor). The root emits `handle` to the target.',
  'act/move': 'an actor steps (param dir) or goes to a place (params map, x, y); the root moves it.',
  'act/craft': 'an actor crafts the recipe of param recipe from what it carries.',
  'act/learn': 'an actor learns what it names: param skill (spending skill points) or param profession (at a trainer).',
  'impulse/*': 'something was done to the host by another (source = the emitter; actor = whose act started it; instrument; item). See `impulses` for each kind and its params.',
  'contact/begin|stay|end': 'the host and other start, keep, or stop touching. Param how, from the host\'s side: on (I stand on other), under (other stands on me), in (I am inside other), contains (other is inside me), held (I am in other\'s hand), holds (other is in my hand), in-region (I stand in the region other: a named area of a map, type region, or a room, region/room, found where cells are walled round and covered), encloses (other stands in me, a region). Only where a stance (ground, air, water) meets a reach: a flyer never touches lava.',
  bump: 'the host and other collided: a step into something solid (param dir).',
  'time/period': 'a clock ticked for the host: param status (every 0.5 s while it has that status, or at the pace the status sets; actor: who gave it) or name (a declared period: hunger, vitals, appear, weather, storm, dawn).',
  'time/timer': 'a status ran out on the host (params status, at: its scheduled deadline; actor: who gave it).',
  'threshold/gain|lose': 'the host gained or lost a status (param status).',
  'threshold/cross': 'a prop of the host came to a declared line (param name: broken at hp 0 — for every thing with durability: a person goes down, a tree falls, a rock breaks into its makeup; hungry under six tenths of maxHunger, and back over it with param way "up" — the host gains or loses the status hungry, and hunger falls slowly while it lasts; param prop).',
  seen: 'the host (an actor) saw someone act: roles actor (the doer), target, instrument; params act (the verb), owner (mine | another | nobody: whose the target was before), defined (the world had an answer for the act and all it set going).',
  stuck: 'the host cannot go on with what it does (param activity): the day of a person — target is what it needs (gone, or not as it must be), or the spot they cannot reach; a companion that cannot follow (activity follow) — target is its leader.',
  broken: 'the story: content it must keep playable broke (param invariant; target the person it belongs to). The default is the invariant\'s fallback.',
}

const IMPULSES: Record<string, string> = {
  strike: 'a blow or a tool\'s work: params power, edge (cut | blunt | pierce | dig), element (optional); the instrument role says what struck (an axe, a hoe)',
  element: 'fire, water, ice, lightning, wind or earth reaching the host: params element, power',
  coat: 'a substance laid on the host: param substance (oil, …)',
  restore: 'health or hunger given back: params which (hp | hunger), amount',
  push: 'shoved: param dir (and swap: a person making way)',
  taken: 'the host (a thing) is being taken: other = the taker (or receiver); param into (hand | contents | tile). Its root moves it there.',
  receive: 'something is put on or into the host: item = the thing. The host decides: take it (emit taken to the item with into) or refuse.',
  offered: 'the host (an actor) is handed a thing: item = the thing; accept (emit taken with into contents) or decline.',
  handle: 'a bare hand on the host: open, read, talk, push, shake — the host says',
  notify: 'news for the host: params what (a key) and value — a topic for the story, the player\'s stage, a defeat for the one who struck.',
}

/**
 * The ModSpec: the ontology, with the types and statuses `lib` adds (patches) when it is given.
 * It carries no library version: a model's prompt built from it stays byte for byte the same
 * while the library grows, so a provider's prompt cache keeps serving it.
 */
export function buildModSpec(onto: Ontology, lib?: Pick<RuleLibrary, 'types' | 'statuses'>, opts: { types?: boolean } = {}): ModSpec {
  const types = { ...onto.types }
  for (const t of lib?.types ?? []) types[t.id] = t
  const statuses = { ...onto.statuses }
  for (const s of lib?.statuses ?? []) statuses[s.id] = s
  return {
    version: 'lsw-modspec/2',
    summary:
      'Author RULES for a 2D JRPG world whose mechanics are data. Every happening is an event with one outcome. A rule belongs to a HOST type and answers one event kind (or a branch of kinds) with a condition tree whose leaves are effects, `inherit` or undefined. You are called because an event reached an undefined leaf (request.hole): write the host rule that gives it an outcome. Effects write only the host; to affect others, emit impulses (strike, element, coat, restore, push, taken, receive, offered, handle, notify), which their receivers answer.',
    rule: {
      id: 'unique string, e.g. "patch/slime-wets-in-rain"',
      host: 'Selector: the class of thing whose nature this is (required in a patch)',
      on: `an event kind or a branch: ${[...EVENT_KINDS].join(' | ')} — or a prefix such as "impulse" or "contact"`,
      tree: 'the outcome: a Tree (see `tree`)',
      confirm: 'optional Text: ask the player first when their input chooses this rule ("Eat {instrument}?")',
      label: 'Text, for a rule an input reaches (act/*, impulse/*): what the input does, as the HUD shows it before the press — {en, zh}, naming {target}, {instrument}, {actor} ("Feed {instrument} to {target}" / "给{target}吃{instrument}"); a leaf may carry its own. Without it the input shows its default.',
      tests: 'RuleTest[]: { given: Scenario, expect: Expectation[] }',
      doc: 'one-line human summary',
    },
    tree: {
      leaf: '{do: Effect[], label?: Text} — the outcome; an empty list means no change (a definition); label: what an input ending here does, over the rule\'s',
      inherit: '"inherit" — not this rule\'s case: the next, less specific rule answers',
      branch: '{if: Cond, then: Tree, else?: Tree} — else defaults to "inherit"',
      note: 'patches may not contain undefined leaves',
    },
    selector: {
      type: 'is-a match on the slash-path type hierarchy (prefix): everything is one tree of things — actor (agents, with bodies), item (portable), fixture, tile/<terrain>, resident/story, resident/world. There are no kinds.',
      tags: 'all of these tags',
      notTags: 'none of these tags',
      status: 'all of these statuses',
      notStatus: 'none of these statuses',
      props: 'property comparisons: {key: value | {eq,ne,gt,gte,lt,lte}}',
      id: 'instance id (discouraged)',
    },
    conditions: [
      '{all:[..]} {any:[..]} {not:C}',
      '{is:{role, sel: Selector}} — a role is filled and matches (roles: host, actor, target, instrument, other, item, source)',
      '{none: role} — a role is empty (an empty hand)',
      '{same:[roleA, roleB]} — the same thing (food used on oneself: same [actor, target])',
      '{has:{role, status?, tag?}}',
      "{prop:{role, key, cmp?, bounds?, default?}} — role may also be story or world (anyone may read them; the story's facts are its props: {prop:{role:'story', key:'mq.ore', cmp:{gte:5}, default:0}}); default is read when the prop is missing. bounds: {eq|gt|gte|lt|lte: number | {prop, of: role, mul?} | {param, mul?}}",
      '{param:{key, cmp}} — an event parameter (element, how, edge, verb, status, name, …)',
      '{chance:p}',
      '{hour:{from,to}}',
      "{count:{role, in: contents|tile, match?: Selector, cmp: Bounds}} — how many things are in a role's contents (or on its tile besides itself)",
      '{topic:id} — something that happened is still fresh',
      '{weather:[sun|cloud|rain|storm|fog]} — the weather now',
      '{exists: Selector} — something matching it exists anywhere in the world',
      '{outdoors:true} — the host is out under the sky',
      "{makeup: role} — the role's type says what it is made of (its makeup: what it leaves when it breaks)",
      "{rel: {role, how}} — the role has that relation now: on (stands on something), support (something holds it up), in-region …",
    ],
    events: EVENTS,
    impulses: IMPULSES,
    primitives: { _shape: 'Each effect is ONE flat object naming its op: {"op": "spawn", "type": "item/tool/rope", "at": "target"} — never {"spawn": {…}}. Below, `name {args}` lists the fields beside op.', ...PRIMITIVES, _roles: 'RoleRef = host | actor | target | instrument | other | item | source | tileOf:<role>', _amount: 'Amount = number | {param, mul?, add?} | {prop, of: role, mul?, add?}' },
    expectations: [
      '{key, hasStatus} {key, lacksStatus} {key, isType} {key, destroyed:true} {key, exists:true}',
      '{key, propGt:[k,n]} {key, propLt:[k,n]} {tile:[x,y], terrain} {tile:[x,y], hasStatus} {spawned:type} {resolvedBy:ruleId} (the event was answered by that rule)',
      'Scenario: {terrain?: string[][], entities:[{key,type,x,y,z?,tags?,statuses?,props?,heldBy?,inside?}], cells?:[{x,y,z?,space?,type?,statuses?,props?}], residents?:{story?:props,world?:props}, event:{kind?, host?, actor?, target?, instrument?, other?, item?, source?, params?}, ticks?} — roles reference entity keys or "tile:x,y[,z][:floor|soil|volume]" (a cell top or a specific space); kind defaults to act/use, host to the instrument (or the actor)',
    ],
    ontology: {
      // without types: the model is shown the request's own types (the brief) and asks for the rest (the router)
      types: opts.types === false ? [] : Object.values(types).map((t) => ({ id: t.id, tags: t.tags ?? [], name: t.name ? textOf(t.name) : undefined })),
      statuses: Object.values(statuses).map((s) => ({ id: s.id, duration: s.duration, immobilize: s.immobilize, moveDelay: s.moveDelay, clears: s.clears })),
      terrains: Object.values(onto.terrains).map((t) => ({ id: t.id, tags: t.tags ?? [], solid: t.solid, liquid: t.liquid })),
      elements: onto.elements,
      factions: onto.factions ?? {},
    },
    assets: { vfx: onto.vfx },
    authoringRules: AUTHORING_RULES,
  }
}

// ---------------------------------------------------------------- the port

const WINDOW = 3 // tiles around the host in the scenario (7x7)
const TIMEOUT_TICKS = 100 // 10 s: then the default (the record stays patchable)

/**
 * A library as a save kept it: the base rules fresh from content, then the patches' types and
 * statuses, then each patch rule validated again as it comes back (a save is a file: what it holds
 * is checked like anything sent). A rule that no longer holds is left out and reported.
 */
export function restoreLibrary(base: Rule[], saved: LibraryData | undefined, ontology: Ontology, protectedFacts: string[] = [], dropped?: (id: string, why: string) => void): RuleLibrary {
  const lib = new RuleLibrary(base)
  if (!saved) return lib
  for (const t of saved.types ?? []) lib.addType(t, 'restored')
  for (const s of saved.statuses ?? []) lib.addStatus(s, 'restored')
  for (const r of saved.rules ?? []) {
    if (r.source?.origin !== 'patch' || lib.rules.has(r.id)) continue
    const res = validatePatch({ artifacts: [{ kind: 'rule', rule: r }] }, { ontology, library: lib, world: r.source.trigger === 'world', protectedFacts })
    if (res.ok) lib.add(r, r.source.at ?? 'restored')
    else dropped?.(r.id, res.errors[0])
  }
  lib.log = [...(saved.log ?? [])]
  lib.version = Math.max(lib.version, saved.version ?? 0)
  return lib
}

/** The params whose value branches an outcome: they are part of an outcome's class. */
export const BRANCHING_PARAMS = ['verb', 'element', 'edge', 'how', 'status', 'name', 'act', 'owner', 'activity', 'invariant', 'what', 'substance', 'which', 'into']

/** A hole as a key: its rule, and the branch that reached it. */
export const holeKey = (rule: string, path: string[]): string => `${rule}${path.length ? '#' + path.join('&') : ''}`

/**
 * The class of an undefined outcome, instances aside (one question per hole and class): the hole,
 * the kind, the host's type, the other roles' types (`self` when it is the host), the branching
 * params. The one definition: the client's port and the modder service both key by it.
 */
export function classKey(c: { hole: string; kind: string; host: string; roles: [string, string][]; params?: Record<string, unknown> }): string {
  // (the actor and the source are who did it, not what it is; the residents are in every event)
  const roles = c.roles
    .filter(([k, t]) => k !== 'actor' && k !== 'source' && !t.startsWith('resident'))
    .map(([k, t]) => `${k}=${t}`)
    .sort()
    .join(',')
  const params = Object.entries(c.params ?? {})
    .filter(([k]) => BRANCHING_PARAMS.includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join(',')
  return `${c.hole}|${c.kind}|${c.host}|${roles}|${params}`
}

/** The class of an event, instances aside (classKey). */
export function signatureOf(eng: Engine, ev: GameEvent, res?: Resolution): string {
  const w = eng.world
  const kind = (r: Ref | undefined): string => {
    if (!r) return '-'
    const e = w.get(r.e)
    if (!e) return '?'
    return e.type
  }
  const same = (r: Ref | undefined) => !!r && 'e' in r && 'e' in ev.host && r.e === ev.host.e
  return classKey({
    hole: res?.hole ? holeKey(res.hole.rule.id, res.hole.path) : '?',
    kind: ev.kind,
    host: kind(ev.host),
    roles: Object.entries(ev.roles).map(([k, r]) => [k, same(r) ? 'self' : kind(r)]),
    params: ev.params,
  })
}

/** Asks of one question that may go unanswered (no reply) before it is given up for the session. */
const MAX_UNREACHABLE = 3

export class ModPort implements UndefinedSink {
  provider?: ModProvider
  records: UndefinedRecord[] = []
  /** Scenarios of recently *defined* acts: regression set for new patches. */
  regression: { scenario: Scenario; rule: string }[] = []
  onChange?: () => void
  /** How long an outcome waits for a patch before the default runs (a late patch still applies). */
  timeoutTicks = TIMEOUT_TICKS
  private seq = 0
  /** Questions that failed this session: not asked again until the next one. */
  private failed = new Set<string>()
  /** Questions whose asking itself failed (no reply: the service restarting, a dropped connection), by count. */
  private unreachable = new Map<string, number>()

  constructor(private eng: Engine) {
    eng.undefinedSink = this
  }

  spec(): ModSpec {
    return buildModSpec(this.eng.world.onto.data, this.eng.lib)
  }

  get(id: string): UndefinedRecord | undefined {
    return this.records.find((r) => r.id === id)
  }

  /**
   * An outcome is undefined (design.md §5.11). One question per hole and class at a time; one that
   * failed is not asked again this session. With no one to ask, the default runs now and the record
   * stays open to a patch. Otherwise the event's participants — and the actor who started the
   * chain — are held, and the default runs at the time-out if no patch has come.
   */
  raise(ev: GameEvent, res: Resolution): boolean {
    const eng = this.eng
    const w = eng.world
    const signature = signatureOf(eng, ev, res)
    const origin: 'player' | 'world' = ev.origin === 'player' ? 'player' : 'world'
    if (this.records.some((r) => r.signature === signature && (r.status === 'pending' || r.awaiting)) || this.failed.has(signature)) {
      if (origin === 'player' && ev.kind.startsWith('act/')) w.fx.push({ t: 'log', text: attemptLine(eng, ev) })
      return false
    }
    const rec = this.open(ev, res, signature, origin)
    // say at once what is being tried (never what comes of it: that is the patch's to decide)
    w.fx.push({ t: 'log', text: origin === 'player' ? attemptLine(eng, ev) : worldLine(eng, ev), tone: origin === 'player' ? undefined : 'ai' })
    w.fx.push({ t: 'undefined', request: rec.id, summary: rec.request.summary, asked: !!this.provider })
    this.onChange?.()
    if (!this.provider) {
      rec.status = 'fallback'
      return false
    }
    // everyone and everything in the event waits for its outcome — the one who started it too:
    // they are at work on it (no other act, no step) until the patch or the default comes
    for (const r of [ev.host, ...Object.values(ev.roles), ...(ev.cause ? [{ e: ev.cause }] : [])]) {
      const e = r && 'e' in r ? w.get(r.e) : undefined
      if (e && !w.isPlaceless(e)) e.frozenBy = rec.id
    }
    this.ask(rec)
    return true
  }

  private open(ev: GameEvent, res: Resolution, signature: string, origin: 'player' | 'world'): UndefinedRecord {
    const w = this.eng.world
    const id = `req-${w.state.seed.toString(36)}-${(++this.seq).toString(36)}-${w.state.tick.toString(36)}`
    const request = buildRequest(this.eng, ev, res, id)
    const rec: UndefinedRecord = { id, tick: w.state.tick, status: 'pending', request, event: ev, deadline: w.state.tick + this.timeoutTicks, signature, origin }
    this.records.push(rec)
    return rec
  }

  private ask(rec: UndefinedRecord): void {
    const id = rec.id
    if (!this.provider) return
    rec.awaiting = true
    this.provider
      .resolve(rec.request, this.spec())
      .then((p) => {
        rec.awaiting = false
        if (p) this.submit(id, p)
        else {
          this.failed.add(rec.signature)
          this.fallback(id)
        }
      })
      .catch(() => {
        // no reply at all is not an answer: the question may be asked again, a few times
        rec.awaiting = false
        const n = (this.unreachable.get(rec.signature) ?? 0) + 1
        this.unreachable.set(rec.signature, n)
        if (n >= MAX_UNREACHABLE) this.failed.add(rec.signature)
        this.fallback(id)
      })
  }

  tick(): void {
    const t = this.eng.world.state.tick
    for (const r of this.records) if (r.status === 'pending' && t >= r.deadline) this.fallback(r.id)
  }

  /**
   * The modder is making things the world does not have yet: the outcome waits for them, past the
   * time-out, until the patch comes (or the asking fails, which runs the default as ever).
   */
  hold(id: string): boolean {
    const r = this.get(id)
    if (!r || r.status !== 'pending') return false
    r.deadline = Number.POSITIVE_INFINITY
    return true
  }

  observe(ev: GameEvent, rule: string): void {
    if (!ev.kind.startsWith('act/') || ev.kind === 'act/move') return
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

  /** Nobody answered in time (or the answer failed): the default runs; a later patch still applies. */
  fallback(id: string): void {
    const r = this.get(id)
    if (!r || r.status !== 'pending') return
    r.status = 'fallback'
    this.unfreeze(id)
    this.eng.run(r.request.hole.default, r.event, r.request.hole.rule)
    this.syncBag()
    this.onChange?.()
  }

  /** Validate and apply a patch for a request (or, with id undefined, a free-standing patch). */
  /**
   * Validate a patch and take it. A patch for a request of this port is checked in that request's
   * scene; one from elsewhere (the shared library, a prefetch) in the scene it came with.
   */
  submit(id: string | undefined, patch: Patch, scenario?: Scenario): ValidationResult {
    const eng = this.eng
    const w = eng.world
    const rec = id ? this.get(id) : undefined
    // Idempotent: artifacts the library already holds verbatim (the same shared patch arriving
    // twice, e.g. by sync and by reply) are skipped; the rest is validated as usual.
    const fresh = patch.artifacts?.filter((a) => !alreadyHeld(eng.lib, a)) ?? []
    if (Array.isArray(patch.artifacts) && patch.artifacts.length && !fresh.length) {
      const res: ValidationResult = { ok: true, errors: [], warnings: ['already in the library'], overrides: [] }
      if (rec && rec.status !== 'patched') this.settled(rec, patch, patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule.id] : [])))
      return res
    }
    if (fresh.length !== patch.artifacts.length) patch = { ...patch, artifacts: fresh }
    const res = validatePatch(patch, {
      ontology: w.onto.data,
      library: eng.lib,
      scenario: rec?.request.scenario ?? scenario,
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
      if (rec) this.failed.add(rec.signature)
      if (rec && wasPending) {
        rec.status = 'rejected'
        this.unfreeze(rec.id)
        eng.run(rec.request.hole.default, rec.event, rec.request.hole.rule)
      }
      w.fx.push({ t: 'log', text: `patch rejected: ${res.errors[0]}`, tone: 'dev' })
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
    // a new thing made at hand or at a station from its makeup can be crafted at once (world-model.md §6.4)
    if (patch.artifacts.some((a) => a.kind === 'type')) for (const r of deriveRecipes(w.onto)) eng.recipes.set(r.id, r)
    const trigger = rec?.origin ?? patch.trigger ?? a0trigger(patch)
    for (const a of patch.artifacts) {
      if (a.kind !== 'rule') continue
      const rule: Rule = { ...a.rule, source: { origin: 'patch', request: id, author: patch.author ?? 'manual', at: now, note: patch.note, trigger } }
      eng.lib.add(rule, now)
      ruleIds.push(rule.id)
    }
    if (rec) this.settled(rec, patch, ruleIds)
    this.onChange?.()
    return res
  }

  /** A record's question is answered: the held let go, and the event replays if it still stands. */
  private settled(rec: UndefinedRecord, patch: Patch, ruleIds: string[]): void {
    const eng = this.eng
    const wasOpen = rec.status !== 'patched'
    rec.patch = patch
    rec.rules = ruleIds
    rec.status = 'patched'
    this.failed.delete(rec.signature)
    this.unreachable.delete(rec.signature)
    this.unfreeze(rec.id)
    eng.world.fx.push({ t: 'patched', request: rec.id, rule: ruleIds[0] ?? '' })
    if (wasOpen && stillValid(eng, rec.event) && eng.resolveEvent(rec.event).defined) eng.replay(rec.event)
    this.syncBag()
  }

  /** What the outcome did to the player's things (a held ore become an ingot) shows in their slots. */
  private syncBag(): void {
    const w = this.eng.world
    if (w.state.player && w.get(w.state.player)) this.eng.controls.sync()
  }

  /** A person answered "nothing happens": the question is not asked again this session. */
  dismiss(id: string): void {
    const r = this.get(id)
    if (r) this.failed.add(r.signature)
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
  if (a?.kind === 'status') return lib.statuses.some((s) => statusDefinition(s) === statusDefinition(a.status))
  return false
}

/** Object key order is not part of a status's definition. */
function statusDefinition(s: StatusDef): string {
  return JSON.stringify(s, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
}

/** Patches synced from the shared library carry their trigger in their rules' provenance. */
function a0trigger(patch: Patch): 'player' | 'world' | undefined {
  for (const a of patch.artifacts ?? []) if (a?.kind === 'rule' && a.rule?.source?.trigger) return a.rule.source.trigger
  return undefined
}

const nm = (eng: Engine, ref: Ref | undefined, l: 'en' | 'zh') => eng.nameOf(ref, l)

/** The light cue when the world pauses over something it has never seen (design.md §5.11). */
export function worldLine(eng: Engine, ev: GameEvent): { en: string; zh: string } {
  const h = ev.host
  const o = ev.roles.other ?? ev.roles.source
  if (ev.kind.startsWith('contact') || ev.kind === 'bump') return { en: `${nm(eng, h, 'en')} meets ${nm(eng, o, 'en')}…`, zh: `${nm(eng, h, 'zh')}碰上了${nm(eng, o, 'zh')}……` }
  if (ev.kind === 'seen') return { en: `${nm(eng, h, 'en')} saw that.`, zh: `${nm(eng, h, 'zh')}看见了。` }
  if (ev.kind === 'stuck') return { en: `${nm(eng, h, 'en')} stops short.`, zh: `${nm(eng, h, 'zh')}停住了。` }
  if (ev.kind === 'broken') return { en: `Something ${nm(eng, ev.roles.target, 'en')} was counting on is gone…`, zh: `${nm(eng, ev.roles.target, 'zh')}指望的东西没了……` }
  if (ev.kind === 'impulse/element') return { en: `${String(ev.params?.element ?? 'Something')} reaches ${nm(eng, h, 'en')}…`, zh: `${nm(eng, h, 'zh')}被波及了……` }
  return { en: `The world pauses over ${nm(eng, h, 'en')}…`, zh: `世界在${nm(eng, h, 'zh')}上停顿了一下……` }
}

/** A neutral line for an attempt whose outcome is not known yet. */
export function attemptLine(eng: Engine, ev: GameEvent): { en: string; zh: string } {
  const r = ev.roles
  const verb = ev.params?.verb
  const target = ev.kind.startsWith('impulse') ? ev.host : r.target
  const self = !!r.target && !!r.actor && 'e' in r.target && 'e' in r.actor && r.target.e === r.actor.e
  if (ev.params?.attack || ev.kind === 'impulse/strike') return { en: `Your blow lands on ${nm(eng, target, 'en')}…`, zh: `你这一击落在了${nm(eng, target, 'zh')}上……` }
  if (verb === 'take') return { en: `You try to take ${nm(eng, target, 'en')}…`, zh: `你试着去拿${nm(eng, target, 'zh')}……` }
  if (verb === 'put') return { en: `You set ${nm(eng, r.instrument, 'en')} against ${nm(eng, target, 'en')}…`, zh: `你把${nm(eng, r.instrument, 'zh')}往${nm(eng, target, 'zh')}上放……` }
  if (!r.instrument) return { en: `You reach out to ${nm(eng, target, 'en')}…`, zh: `你伸手去碰${nm(eng, target, 'zh')}……` }
  if (self) return { en: `You try ${nm(eng, r.instrument, 'en')} on yourself…`, zh: `你试着对自己用${nm(eng, r.instrument, 'zh')}……` }
  return { en: `You try ${nm(eng, r.instrument, 'en')} on ${nm(eng, target, 'en')}…`, zh: `你试着把${nm(eng, r.instrument, 'zh')}用在${nm(eng, target, 'zh')}上……` }
}

/** Does the event still stand (its things there, the actor still near and holding what it held)? */
function stillValid(eng: Engine, ev: GameEvent): boolean {
  const w = eng.world
  if ('e' in ev.host && !w.get(ev.host.e)) return false
  for (const r of Object.values(ev.roles)) if (r && 'e' in r && !w.get(r.e)) return false
  if (!ev.kind.startsWith('act/')) return true
  const a = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
  if (!a) return false
  if (ev.roles.instrument && 'e' in ev.roles.instrument && a.held !== ev.roles.instrument.e && !(a.contents ?? []).includes(ev.roles.instrument.e)) return false
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
  const chain = w.onto.resolve(v.type).chain
  return {
    role,
    id: v.id,
    name: eng.nameOf(v.ref),
    type: v.type,
    typeChain: chain,
    tags: [...v.tags],
    statuses: [...v.statuses],
    props: v.props,
    material: v.entity && w.materialOf(v.entity),
    makeup: w.onto.resolve(v.type).makeup,
    at: p && origin ? [p.x - origin.x, p.y - origin.y] : undefined,
  }
}

export function summarize(eng: Engine, ev: GameEvent): string {
  const n = (r: Ref | undefined) => eng.nameOf(r)
  const p = ev.params ?? {}
  const r = ev.roles
  if (ev.kind.startsWith('act/')) {
    const verb = String(p.verb ?? ev.kind.slice(4))
    const what = r.instrument ? ` ${n(r.instrument)}` : ''
    const how = verb === 'use' ? (r.instrument ? ' on' : ' bare hands on') : verb === 'put' ? ' on' : ''
    return `${n(r.actor)} ${verb}${what}${how} ${n(r.target)}`
  }
  if (ev.kind.startsWith('impulse/')) {
    const what = ev.kind.slice(8)
    const detail = [p.element, p.edge, p.substance, p.what].filter(Boolean).join(' ')
    const from = r.source && !(r.item && 'e' in r.item && 'e' in r.source && r.item.e === r.source.e) ? ` from ${n(r.source)}` : ''
    return `${n(ev.host)} is sent ${what}${detail ? ` (${detail})` : ''}${from}${r.item ? ` (the thing: ${n(r.item)})` : ''}`
  }
  if (ev.kind.startsWith('contact/')) return `${n(ev.host)} ${ev.kind.slice(8)}s contact (${p.how}) → ${n(r.other)}`
  if (ev.kind === 'bump') return `${n(ev.host)} bumps → ${n(r.other)}`
  if (ev.kind.startsWith('time/')) return `${n(ev.host)}: ${ev.kind === 'time/timer' ? `${p.status} runs out` : `period ${p.name ?? p.status}`}`
  if (ev.kind.startsWith('threshold/')) return `${n(ev.host)} ${ev.kind === 'threshold/cross' ? `crosses ${p.name}` : `${ev.kind.slice(10)}s ${p.status}`}`
  if (ev.kind === 'seen') return `${n(ev.host)} sees ${n(r.actor)} ${p.act} → ${n(r.target)} (${p.owner})`
  if (ev.kind === 'stuck') return `${n(ev.host)} is stuck at "${p.activity}" by → ${n(r.target)}`
  if (ev.kind === 'broken') return `content "${p.invariant}" of ${n(r.target)} is broken`
  return `${ev.kind} → ${n(ev.host)}`
}

export function buildRequest(eng: Engine, ev: GameEvent, res: Resolution, id: string): ModRequest {
  const w = eng.world
  const roles = rolesOf(ev, w)
  const center = w.refPos(ev.host) ?? w.refPos(ev.roles.target) ?? w.refPos(ev.roles.actor) ?? w.posOf(w.player)!
  const mapData = w.map(center.map)!
  const tiles: string[][] = []
  const tileStatuses: { at: [number, number]; statuses: string[] }[] = []
  for (let dy = -WINDOW; dy <= WINDOW; dy++) {
    const row: string[] = []
    for (let dx = -WINDOW; dx <= WINDOW; dx++) {
      const x = center.x + dx
      const y = center.y + dy
      row.push(w.terrainAt(center.map, x, y))
      // what the things that make up the cell carry
      const st = w.entitiesAt(center.map, x, y).filter((c) => w.isTerrain(c)).flatMap((c) => Object.keys(c.statuses ?? {}))
      if (st.length) tileStatuses.push({ at: [dx, dy], statuses: st })
    }
    tiles.push(row)
  }
  const involved = new Set(Object.values(roles).map((v) => v?.id).filter(Boolean))
  const nearby: EntityInfo[] = []
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      for (const e of w.entitiesAt(center.map, center.x + dx, center.y + dy)) {
        // the cells themselves are the tiles' rows; nearby is what stands or lies there
        if (w.isTerrain(e) || involved.has(e.id) || nearby.some((x) => x.id === e.id)) continue
        const i = info(eng, 'nearby', w.view({ e: e.id }), center)
        if (i) nearby.push(i)
      }
  // what was said lately: the lines already shown (drained each frame) and this frame's
  const recent = [...w.recent, ...w.fx.flatMap((f) => (f.t === 'log' || f.t === 'say' ? [f.text] : []))].slice(-RECENT_LINES).map((t) => textOf(t))
  const hostView = roles.host
  const infos: Partial<Record<RoleName, EntityInfo>> = {}
  for (const [k, v] of Object.entries(roles)) if (k !== 'host' && v) infos[k as RoleName] = info(eng, k, v, center)
  return {
    id,
    summary: summarize(eng, ev),
    origin: ev.origin === 'player' ? 'player' : 'world',
    event: { kind: ev.kind, params: { ...(ev.params ?? {}) }, host: info(eng, 'host', hostView, center), roles: infos, detail: detailOf(eng, ev) },
    hole: { rule: res.hole?.rule.id ?? '?', path: res.hole?.path ?? [], default: res.hole?.default ?? [] },
    context: {
      map: { id: mapData.id, name: textOf(mapData.name), kind: mapData.kind, region: mapData.region },
      anchors: Object.keys(mapData.anchors ?? {}),
      hour: Math.round(w.hour() * 10) / 10,
      nearby: nearby.slice(0, 16),
      tiles,
      tileStatuses,
      recent,
      rules: [...eng.lib.candidates(ev.kind, hostView), ...eng.lib.candidates(ev.kind, hostView, true)].slice(0, 8),
    },
    scenario: buildScenario(eng, ev),
  }
}

/** What a world event is about, in words, for the modder. */
function detailOf(eng: Engine, ev: GameEvent): string | undefined {
  const w = eng.world
  const n = (r: Ref | undefined) => eng.nameOf(r)
  if (ev.kind === 'broken') {
    const inv = eng.invariants.find((i) => i.id === ev.params?.invariant)
    return inv ? textOf(inv.text) : undefined
  }
  if (ev.kind === 'seen') return `${n(ev.host)} saw ${n(ev.roles.actor)} ${ev.params?.act} ${n(ev.roles.target)} (${ev.params?.owner === 'mine' ? 'it is theirs' : ev.params?.owner === 'another' ? "it is someone else's" : "it is nobody's"})`
  if (ev.kind === 'stuck') {
    const p = 'e' in ev.host ? w.get(ev.host.e) : undefined
    const s = p?.npc?.person?.schedules?.flatMap((v) => v.entries).find((x) => x.activity === ev.params?.activity)
    // behaviour that is not a day (a companion following): what holds the host back is its own state
    if (!s) return `${n(ev.host)} cannot go on with "${ev.params?.activity}" (${n(ev.roles.target)}): it is ${Object.keys(p?.statuses ?? {}).join(', ') || 'held fast'}`
    return `${n(ev.host)} wants to "${ev.params?.activity}" but ${ev.roles.target && w.get(ev.roles.target.e) && w.isTerrain(w.get(ev.roles.target.e)!) ? 'cannot reach the spot' : `${n(ev.roles.target)} is not as it must be${s?.need ? ` (${JSON.stringify(s.need)})` : ''}`}`
  }
  return undefined
}

/** Snapshot the event's neighbourhood as a replayable scenario. */
export function buildScenario(eng: Engine, ev: GameEvent): Scenario {
  const w = eng.world
  const center = w.refPos(ev.host) ?? w.refPos(ev.roles.target) ?? w.refPos(ev.roles.actor) ?? w.posOf(w.player)!
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
  // Terrain rows supply the top; lower spaces and upstairs cells keep their actual type.
  const cells: NonNullable<Scenario['cells']> = []
  const storeys = Math.max(center.z ?? 0, w.onto.data.params?.storeys ?? 4)
  for (let z = 0; z <= storeys; z++)
    for (let y = 0; y <= 2 * WINDOW; y++)
      for (let x = 0; x <= 2 * WINDOW; x++) {
        const top = w.cellTop(center.map, ox + x, oy + y, z)
        for (const c of w.entitiesAt(center.map, ox + x, oy + y, z))
          if (w.isTerrain(c) && (z || c !== top || (!w.isStatic(c) && (c.statuses || c.props))))
            cells.push({ x, y, ...(z && { z }), space: w.spacesOf(c)[0], ...((z || c !== top) && { type: c.type }), statuses: c.statuses && Object.keys(c.statuses), props: c.props && { ...c.props } })
      }
  const addEntity = (id: string, key: string) => {
    const e = w.get(id)
    // what makes up a cell comes with the terrain rows
    if (!e || keyOf.has(id) || w.isPlaceless(e) || w.isTerrain(e)) return
    const p = w.posOf(e)
    if (!p) return
    if (e.place.on === 'hand' || e.place.on === 'inside') addEntity(e.place.holder, `holder_${key}`)
    keyOf.set(id, key)
    const se: ScenarioEntity = {
      key,
      type: e.type,
      x: p.x - ox,
      y: p.y - oy,
      ...(p.z && { z: p.z }),
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
      }
    }
  }
  const roleKey = (r: Ref | undefined, key: string): string | undefined => {
    if (!r) return undefined
    const e = w.get(r.e)
    if (!e) return undefined
    if (w.isTerrain(e)) {
      const p = w.posOf(e)
      // the cell's top by its cell alone; what lies under it (the floor under a tree) by its space too
      const space = p?.z || w.cellTop(p?.map ?? '', p?.x ?? 0, p?.y ?? 0)?.id !== e.id ? w.spacesOf(e)[0] : undefined
      return p && `tile:${p.x - ox},${p.y - oy}${p.z ? `,${p.z}` : ''}${space ? `:${space}` : ''}`
    }
    if (w.isPlaceless(e)) return e.id
    // make sure holders come first so held/inside links resolve
    if (e.place.on === 'hand' || e.place.on === 'inside') {
      const h = e.place.holder
      if (!keyOf.has(h)) addEntity(h, ev.roles.actor && 'e' in ev.roles.actor && h === ev.roles.actor.e ? 'actor' : `holder_${key}`)
    }
    addEntity(r.e, key)
    return keyOf.get(r.e)
  }
  const event: Scenario['event'] = { kind: ev.kind, params: ev.params ? { ...ev.params } : undefined }
  for (const role of ['actor', 'instrument', 'target', 'other', 'item', 'source'] as const) {
    const k = roleKey(ev.roles[role], role)
    if (k) event[role] = k
  }
  event.host = roleKey(ev.host, 'host') ?? undefined
  let n = 0
  const carry = (id: string) => {
    const e = w.get(id)
    for (const child of [...(e?.contents ?? []), ...(e?.held ? [e.held] : [])]) {
      if (keyOf.has(child)) continue
      addEntity(child, `c${++n}`)
      carry(child)
    }
  }
  // A participant's bag and cover are needed even when the loose-neighbour limit is full.
  for (const id of [...keyOf.keys()]) {
    carry(id)
    const p = w.posOf(w.get(id))!
    for (let z = (p.z ?? 0) + 1; z <= storeys; z++)
      for (const e of w.entitiesAt(p.map, p.x, p.y, z)) if (w.spacesOf(e).some((s) => s === 'floor' || s === 'volume')) addEntity(e.id, `roof${++n}`)
  }
  n = 0
  for (let z = 0; z <= storeys; z++)
    for (let y = 0; y <= 2 * WINDOW; y++)
      for (let x = 0; x <= 2 * WINDOW; x++)
        for (const e of w.entitiesAt(center.map, ox + x, oy + y, z)) if (!w.isTerrain(e) && !keyOf.has(e.id) && n < 12) addEntity(e.id, `n${++n}`)
  const residents: NonNullable<Scenario['residents']> = {}
  for (const id of ['story', 'world'] as const) {
    const props = w.get(id)?.props
    if (props && Object.keys(props).length) residents[id] = { ...props }
  }
  const player = keyOf.get(w.state.player) ?? '__player'
  return { terrain, entities, player, event, ...(cells.length && { cells }), ...(Object.keys(residents).length && { residents }) }
}

// ---------------------------------------------------------------- validation

const OPS = new Set(Object.keys(PRIMITIVES))
const IMPULSE_KINDS = new Set(['strike', 'element', 'coat', 'restore', 'push', 'taken', 'receive', 'offered', 'handle', 'notify'])
const KIND_PREFIXES = new Set<string>(EVENT_KINDS.flatMap((k) => k.split('/').map((_, i, a) => a.slice(0, i + 1).join('/'))))
const BOUNDS = new Set(['eq', 'gt', 'gte', 'lt', 'lte'])
const ROLE_NAMES = new Set(['host', 'actor', 'target', 'instrument', 'other', 'item', 'source'])
const ROLE_REFS = new Set([...ROLE_NAMES, ...[...ROLE_NAMES].map((r) => `tileOf:${r}`)])

interface ValidateCtx {
  ontology: Ontology
  library: RuleLibrary
  scenario?: Scenario
  regression?: { scenario: Scenario; rule: string }[]
  /** The patch answers an event the world started by itself: the boundaries apply. */
  world?: boolean
  /** Fact-key prefixes only the story may change. */
  protectedFacts?: string[]
}

export function validatePatch(patch: Patch, ctx: ValidateCtx): ValidationResult {
  withTerrainTypes(ctx.ontology)
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
  const statuses = [...Object.values(ctx.ontology.statuses), ...ctx.library.statuses]
  const rules: Rule[] = []
  for (const [i, a] of patch.artifacts.entries()) {
    const where = `artifact[${i}]`
    if (a?.kind === 'type') {
      const t = a.type
      if (!t?.id || typeof t.id !== 'string') errors.push(`${where}: type.id required`)
      else {
        const problems = newTypeProblems(t, onto, patch)
        if (problems.length) errors.push(...problems.map((p) => `${where} (type "${t.id}"): ${p}`))
        else onto.types[t.id] = t
      }
    } else if (a?.kind === 'status') {
      if (!a.status?.id) errors.push(`${where}: status.id required`)
      else if (statuses.some((s) => s.id === a.status.id && statusDefinition(s) !== statusDefinition(a.status))) errors.push(`${where}: status "${a.status.id}" already exists with a different definition`)
      else {
        onto.statuses[a.status.id] = a.status
        statuses.push(a.status)
      }
    } else if (a?.kind === 'rule') {
      rules.push(a.rule)
    } else errors.push(`${where}: unknown artifact kind`)
  }
  if (!rules.length && !errors.length) warnings.push('patch has no rule: nothing will change behaviour')

  // 1-3. schema, ontology & assets, effect typing, locality
  const known = (id: string) => id in onto.types || Object.keys(onto.types).some((t) => t.startsWith(id + '/'))
  const checkSel = (s: Selector | undefined, where: string) => {
    if (!s) return
    if (typeof s !== 'object') return errors.push(`${where}: selector must be an object`)
    if (s.type && s.type !== 'tile' && !s.type.startsWith('tile/') && !known(s.type)) errors.push(`${where}.type: unknown type "${s.type}"${s.type in onto.terrains ? ` — a terrain is named "tile/${s.type}"` : closest(s.type, onto)}`)
    if (s.type?.startsWith('tile/') && !(s.type.slice(5) in onto.terrains)) errors.push(`${where}.type: unknown terrain "${s.type}"`)
    for (const st of [...(s.status ?? []), ...(s.notStatus ?? [])]) if (!(st in onto.statuses)) errors.push(`${where}: unknown status "${st}"`)
    if ('kind' in s) errors.push(`${where}.kind: there are no kinds; select by type (actor, item, fixture, tile/…, resident/…), tags or props`)
    if (s.id) warnings.push(`${where}: instance-bound selector (id) — prefer types/tags`)
  }
  const role = (r: unknown, where: string) => {
    if (typeof r !== 'string' || !ROLE_NAMES.has(r)) errors.push(`${where}: role must be one of ${[...ROLE_NAMES].join('|')}`)
  }
  const checkCond = (c: Cond | undefined, where: string): void => {
    if (!c || typeof c !== 'object') return void errors.push(`${where}: condition must be an object`)
    if ('all' in c) return c.all.forEach((x, i) => checkCond(x, `${where}.all[${i}]`))
    if ('any' in c) return c.any.forEach((x, i) => checkCond(x, `${where}.any[${i}]`))
    if ('not' in c) return checkCond(c.not, `${where}.not`)
    if ('is' in c) {
      role(c.is.role, `${where}.is.role`)
      checkSel(c.is.sel, `${where}.is.sel`)
      return
    }
    if ('none' in c) return role(c.none, `${where}.none`)
    if ('makeup' in c) return role(c.makeup, `${where}.makeup`)
    if ('rel' in c) return role(c.rel.role, `${where}.rel.role`)
    if ('same' in c) return c.same.forEach((r, i) => role(r, `${where}.same[${i}]`))
    if ('has' in c) {
      role(c.has.role, `${where}.has.role`)
      if (c.has.status && !(c.has.status in onto.statuses)) errors.push(`${where}: unknown status "${c.has.status}"`)
      return
    }
    if ('prop' in c) {
      for (const b of Object.keys(c.prop.bounds ?? {})) if (!BOUNDS.has(b)) errors.push(`${where}.prop.bounds.${b}: a bound is eq|gt|gte|lt|lte`)
      return c.prop.role === 'story' || c.prop.role === 'world' ? undefined : role(c.prop.role, `${where}.prop.role`)
    }
    if ('count' in c) {
      const k = c.count
      role(k.role, `${where}.count.role`)
      if (k.in !== 'contents' && k.in !== 'tile') errors.push(`${where}.count.in must be contents|tile`)
      checkSel(k.match, `${where}.count.match`)
      if (!Object.keys(k.cmp ?? {}).length) errors.push(`${where}.count.cmp needs a bound`)
      for (const b of Object.keys(k.cmp ?? {})) if (!BOUNDS.has(b)) errors.push(`${where}.count.cmp.${b}: a bound is eq|gt|gte|lt|lte`)
      return
    }
    if ('param' in c || 'chance' in c || 'hour' in c || 'topic' in c || 'weather' in c || 'outdoors' in c) return
    if ('exists' in c) return void checkSel(c.exists, `${where}.exists`)
    errors.push(`${where}: unknown condition`)
  }
  const checkTo = (to: EmitTo, where: string) => {
    if (typeof to === 'string') {
      if (to !== 'story' && to !== 'world' && !ROLE_REFS.has(to)) errors.push(`${where}: unknown receiver "${to}"`)
      return
    }
    if ('named' in to || 'map' in to) return
    if ('area' in to) {
      if (!(to.area.radius >= 1 && to.area.radius <= 3)) errors.push(`${where}: area radius must be 1–3`)
      return
    }
    if ('line' in to) {
      if (!(to.line.length >= 1 && to.line.length <= 8)) errors.push(`${where}: line length must be 1–8`)
      return
    }
    errors.push(`${where}: unknown receiver`)
  }
  const checkEffect = (e: Effect, where: string, resident: boolean) => {
    if ((e as { op?: string })?.op === 'setTerrain') return errors.push(`${where}: there is no setTerrain — a cell is made of things; the host becomes another with {op: "transform", into: "tile/<terrain>"}`)
    if (!e || !OPS.has(e.op)) return errors.push(`${where}: unknown primitive "${(e as { op?: string })?.op}"`)
    const any = e as Record<string, unknown>
    if ('of' in any) errors.push(`${where}: effects act on the host only (no "of"): to affect another thing, emit an impulse to it`)
    for (const k of ['at', 'to'] as const) if (k in any && typeof any[k] === 'string' && e.op !== 'emit' && !ROLE_REFS.has(any[k] as string)) errors.push(`${where}.${k}: role ref must be one of ${[...ROLE_REFS].join('|')}`)
    if (RESIDENT_ONLY.has(e.op) && !resident) errors.push(`${where}: ${e.op} is the story's and the world's only — notify the story instead`)
    if (e.op === 'spawn' && !/^@prop:(host|actor|target|instrument|other|item|source)\.\w+$/.test(e.type) && !(e.type in onto.types)) errors.push(`${where}: unknown type "${e.type}"${closest(e.type, onto)}`)
    if (e.op === 'transform' && !e.into.startsWith('@prop:') && !(e.into in onto.types)) errors.push(`${where}: unknown type "${e.into}"${closest(e.into, onto)}`)
    if ((e.op === 'addStatus' || e.op === 'removeStatus') && !(e.status in onto.statuses)) errors.push(`${where}: unknown status "${e.status}"`)
    if (e.op === 'vfx' && !onto.vfx.includes(e.fx)) errors.push(`${where}: unknown vfx "${e.fx}"`)
    if (e.op === 'hurt' && e.element && !ctx.ontology.elements.includes(e.element)) errors.push(`${where}: unknown element "${e.element}"`)
    if (e.op === 'goto' && !(e.hours > 0 && e.hours <= 12)) errors.push(`${where}: goto hours must be in (0, 12]`)
    if (e.op === 'emote' && !['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'].includes(e.mood)) errors.push(`${where}: unknown mood "${e.mood}"`)
    if (e.op === 'emit') {
      if (!IMPULSE_KINDS.has(e.impulse)) errors.push(`${where}: unknown impulse "${e.impulse}"`)
      checkTo(e.to, `${where}.to`)
      if (e.item) role(e.item, `${where}.item`)
      if (e.other) role(e.other, `${where}.other`)
      const el = e.params?.element
      if (typeof el === 'string' && !ctx.ontology.elements.includes(el)) errors.push(`${where}: unknown element "${el}"`)
      if (typeof e.to === 'object' && ('area' in e.to || 'map' in e.to) && (e.chance === undefined || e.chance >= 1)) warnings.push(`${where}: an emission to an area with chance 1 can cascade`)
      checkSel(e.filter, `${where}.filter`)
    }
    // the boundaries of what the world does by itself
    if (ctx.world) {
      // the story's facts are its props: a world event's patch on the story may not change its protected ones
      const fact = (e.op === 'setProp' || e.op === 'addProp') && resident ? e.key : undefined
      if (fact && (ctx.protectedFacts ?? []).some((p) => fact.startsWith(p))) errors.push(`${where}: a world event may not change the story's fact "${fact}"`)
      if (e.op === 'setProp' && e.key === 'quest') errors.push(`${where}: a world event may not change the story's stage`)
    }
  }
  /** A label is Text naming only the roles an input has: {target}, {instrument}, {actor}. */
  const checkLabel = (l: unknown, where: string) => {
    const texts = typeof l === 'string' ? [l] : l && typeof l === 'object' ? Object.values(l as object) : []
    if (!texts.length || texts.some((s) => typeof s !== 'string')) return void errors.push(`${where}: a label is Text: a string, or {en, zh}`)
    for (const s of texts as string[]) for (const m of s.matchAll(/\{(\w+)\}/g)) if (!['target', 'instrument', 'actor'].includes(m[1])) errors.push(`${where}: a label names {target}, {instrument} or {actor}, not {${m[1]}}`)
  }
  /** Does a tree say what it does anywhere (a leaf's label)? */
  const labelled = (t: Tree): boolean => (t === 'inherit' || !t || typeof t !== 'object' ? false : 'if' in t ? labelled(t.then) || (t.else !== undefined && labelled(t.else)) : 'do' in t ? t.label !== undefined : false)
  const checkTree = (t: Tree, where: string, resident: boolean, host: Selector | undefined) => {
    if (t === 'inherit') return
    if (!t || typeof t !== 'object') return void errors.push(`${where}: a tree is "inherit", {do}, or {if, then, else?}`)
    if ('if' in t) {
      checkCond(t.if, `${where}.if`)
      checkTree(t.then, `${where}.then`, resident, host)
      if (t.else !== undefined) checkTree(t.else, `${where}.else`, resident, host)
      return
    }
    if ('undefined' in t) return void errors.push(`${where}: a patch may not leave an outcome undefined`)
    if (!('do' in t) || !Array.isArray(t.do)) return void errors.push(`${where}: a leaf is {do: Effect[]}`)
    if (t.label !== undefined) checkLabel(t.label, `${where}.label`)
    t.do.forEach((e, j) => checkEffect(e, `${where}.do[${j}]`, resident))
    // a world event's people are never harmed by what it learns
    if (ctx.world && host && (host.type ? isA(host.type, 'actor/person') || isA('actor/person', host.type) : !host.type))
      for (const [j, e] of t.do.entries()) if (e.op === 'hurt' || e.op === 'destroy') errors.push(`${where}.do[${j}]: a world event may not harm a person (${e.op})`)
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
    if (typeof r.on !== 'string' || !KIND_PREFIXES.has(r.on)) errors.push(`${where}: on must be an event kind or a branch (${[...EVENT_KINDS].join('|')})`)
    if (!r.host || typeof r.host !== 'object' || !Object.keys(r.host).length) errors.push(`${where}: name the host — a patch answers for a class of thing, never for anything at all`)
    else checkSel(r.host, `${where}.host`)
    if ('when' in (r as object) || 'do' in (r as object)) errors.push(`${where}: this is the earlier rule shape (when/do); write {host, on, tree}`)
    const resident = !!r.host?.type && isA(r.host.type, 'resident')
    if (r.tree === undefined) errors.push(`${where}: tree required`)
    else checkTree(r.tree, `${where}.tree`, resident, r.host)
    if (r.label !== undefined) checkLabel(r.label, `${where}.label`)
    // an input that ends here says what it does: without a label the HUD shows the input's default
    if (r.tree !== undefined && /^(act|impulse)/.test(String(r.on)) && r.label === undefined && !labelled(r.tree)) warnings.push(`${where}: no label — the input that reaches it shows its default description`)
    if (r.tree !== undefined && leaves(r.tree).every((l) => l === 'inherit')) errors.push(`${where}: every leaf inherits — the rule answers nothing`)
    if (!r.tests?.length) warnings.push(`${where}: no tests`)
  }
  if (errors.length) return { ok: false, errors, warnings, overrides }

  // 4. no two patches tie (one event could reach both at equal specificity), the rules of this
  //    patch among themselves included
  rules.forEach((r, i) => {
    for (const other of [...ctx.library.patches(), ...rules.slice(i + 1)]) {
      if (rulesTie(r, other, onto)) errors.push(`rule "${r.id}" ties with "${other.id}" (same kind, same specificity, an event both could answer) — make it more specific or name a different host`)
    }
  })
  if (errors.length) return { ok: false, errors, warnings, overrides }

  // candidate library
  const cand = ctx.library.clone()
  for (const a of patch.artifacts) {
    if (a.kind === 'type') cand.types = cand.types.filter((t) => t.id !== a.type.id).concat(a.type)
    if (a.kind === 'status') cand.statuses = cand.statuses.filter((t) => t.id !== a.status.id).concat(a.status)
  }
  for (const r of rules) cand.add({ ...r, source: { origin: 'patch' } })
  const patchIds = new Set(rules.map((r) => r.id))

  // 5. sandbox replay of the triggering event: it now resolves to the patch
  if (ctx.scenario) {
    try {
      const rp = replay(ctx.scenario, ctx.ontology, cand)
      if (!rp.resolution.defined) errors.push('replay: the triggering event is still undefined under the patch')
      else if (!patchIds.has(rp.resolution.rule!.id)) errors.push(`replay: the triggering event resolved to "${rp.resolution.rule!.id}", not to the patch`)
      errors.push(...rp.errors.map((e) => `replay: ${e}`))
      // the repeat check (world-model.md §8.4): again and again with no time between, it must stop making things
      const again = buildSandbox(ctx.scenario, ctx.ontology, cand)
      if (rp.resolution.defined && endlessYield(again, scenarioEvent(ctx.scenario, again), true))
        errors.push(`endless yield: the triggering event, repeated with no time between on a host that is not used up, keeps making things (${REPEAT_TIMES} times). A yield must cost its host — change it (a status that gates the yield and runs out, durability) or use it up`)
      // no person in the scene is hurt or removed by what the world learns by itself
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
        const fails = [...rp.errors, ...checkExpectations(rp.engine, t.expect ?? [], rp.resolution)]
        for (const f of fails) errors.push(`test "${t.name ?? `${r.id}#${i}`}": ${f}`)
      } catch (err) {
        errors.push(`test "${t.name ?? `${r.id}#${i}`}": ${(err as Error).message}`)
      }
    }
  // 7. regression: what was defined stays defined (base outcomes cannot change — patches only fill holes —
  // but a more specific patch may now answer where an earlier patch did)
  for (const reg of ctx.regression ?? []) {
    try {
      const rp = replay(reg.scenario, ctx.ontology, cand)
      if (!rp.resolution.defined) errors.push(`regression: an act resolved by "${reg.rule}" became undefined`)
      else if (rp.resolution.rule!.id !== reg.rule && patchIds.has(rp.resolution.rule!.id)) overrides.push(`${reg.rule} → ${rp.resolution.rule!.id}`)
    } catch {
      /* scenario no longer buildable (e.g. removed types) — ignore */
    }
  }
  return { ok: errors.length === 0, errors, warnings, overrides }
}

/** Could one thing be the host of both rules? Contradictory constraints rule it out, and so does the ontology. */
export function hostsOverlap(x: Selector, y: Selector, onto?: Ontology): boolean {
  if (x.type && y.type && !isA(x.type, y.type) && !isA(y.type, x.type)) return false
  if (x.id && y.id && x.id !== y.id) return false
  if (x.tags?.some((t) => y.notTags?.includes(t)) || y.tags?.some((t) => x.notTags?.includes(t))) return false
  if (x.status?.some((t) => y.notStatus?.includes(t)) || y.status?.some((t) => x.notStatus?.includes(t))) return false
  for (const k of Object.keys(x.props ?? {})) if (k in (y.props ?? {}) && !cmpsOverlap(x.props![k], y.props![k])) return false
  if (onto && !satisfiable(x, y, onto)) return false
  return true
}

/** Can one value pass both comparisons? Tried on the values that decide them: each limit, between limits, beyond them. */
function cmpsOverlap(a: Cmp, b: Cmp): boolean {
  const vals: PropValue[] = []
  const nums: number[] = []
  for (const c of [a, b]) {
    if (typeof c !== 'object' || c === null) vals.push(c)
    else {
      if (c.eq !== undefined) vals.push(c.eq)
      for (const v of [c.ne, c.gt, c.gte, c.lt, c.lte]) if (typeof v === 'number') nums.push(v)
    }
  }
  for (const v of vals) if (typeof v === 'number') nums.push(v)
  if (!vals.length && !nums.length) return true
  const s = [...new Set(nums)].sort((p, q) => p - q)
  const tries: PropValue[] = [...vals, ...s, ...s.slice(1).map((v, i) => (v + s[i]) / 2)]
  if (s.length) tries.push(s[0] - 1, s[s.length - 1] + 1)
  return tries.some((v) => cmp(v, a) && cmp(v, b))
}

function satisfiable(x: Selector, y: Selector, onto: Ontology): boolean {
  if (x.id || y.id) return true
  const need = [...(x.tags ?? []), ...(y.tags ?? [])]
  const forbid = [...(x.notTags ?? []), ...(y.notTags ?? [])]
  const free = new Set(onto.instanceTags ?? [])
  const type = [x.type, y.type].filter(Boolean).sort((p, q) => q!.length - p!.length)[0]
  const ok = (tags: Set<string>) => need.every((t) => tags.has(t) || free.has(t)) && !forbid.some((t) => tags.has(t))
  const index = new OntologyIndex(onto)
  for (const id of Object.keys(onto.types)) {
    if (type && !isA(id, type)) continue
    const r = index.resolve(id)
    if (ok(new Set(r.tags))) return true
  }
  if (!type) return Object.values(onto.terrains).some((t) => ok(new Set(t.tags ?? [])))
  return false
}

// ---------------------------------------------------------------- ties

type Literal = { c: Cond; yes: boolean }

/** The paths of a tree to the leaves that answer (anything but `inherit`), as the literals taken on the way. */
function answering(t: Tree, path: Literal[] = []): Literal[][] {
  if (t === 'inherit') return []
  if (typeof t === 'string' || !('if' in t)) return [path]
  const flat = (c: Cond, yes: boolean): Literal[] => (yes && 'all' in c ? c.all.flatMap((x) => flat(x, true)) : !yes && 'any' in c ? c.any.flatMap((x) => flat(x, false)) : 'not' in c ? flat(c.not, !yes) : [{ c, yes }])
  return [...answering(t.then, [...path, ...flat(t.if, true)]), ...answering(t.else ?? 'inherit', [...path, ...flat(t.if, false)])]
}

const primitive = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v)

/** Can every literal hold at once (for one event), with these hosts? Decided against the ontology; unknown conditions are taken to be satisfiable. */
function consistent(lits: Literal[], hosts: Selector[], onto: Ontology): boolean {
  const key = (c: Cond) => JSON.stringify(c)
  const pos = new Set(lits.filter((l) => l.yes).map((l) => key(l.c)))
  if (lits.some((l) => !l.yes && pos.has(key(l.c)))) return false
  // a parameter has one value
  const params = new Map<string, unknown[]>()
  for (const { c, yes } of lits) if ('param' in c) (params.get(c.param.key) ?? params.set(c.param.key, []).get(c.param.key)!).push(yes ? c.param.cmp : { not: c.param.cmp })
  for (const vs of params.values()) {
    const eq = vs.filter(primitive)
    if (new Set(eq).size > 1) return false
    for (const v of vs) {
      const ne = v && typeof v === 'object' ? ((v as { ne?: unknown }).ne ?? (v as { not?: unknown }).not) : undefined
      if (primitive(ne) && eq.includes(ne)) return false
    }
  }
  // each role is one thing: what the conditions say of it must fit one type
  const roles = new Map<string, { sels: Selector[]; none: boolean | undefined }>()
  const of = (r: string) => roles.get(r) ?? roles.set(r, { sels: [], none: undefined }).get(r)!
  for (const h of hosts) of('host').sels.push(h)
  for (const { c, yes } of lits) {
    if ('is' in c && yes) of(c.is.role).sels.push(c.is.sel)
    if ('none' in c) {
      const r = of(c.none)
      if (r.none !== undefined && r.none !== yes) return false
      r.none = yes
    }
    if ('prop' in c && yes && c.prop.cmp !== undefined) of(c.prop.role).sels.push({ props: { [c.prop.key]: c.prop.cmp } })
    if ('has' in c) {
      const s: Selector = c.has.tag ? (yes ? { tags: [c.has.tag] } : { notTags: [c.has.tag] }) : c.has.status ? (yes ? { status: [c.has.status] } : { notStatus: [c.has.status] }) : {}
      of(c.has.role).sels.push(s)
    }
  }
  for (const { sels, none } of roles.values()) {
    if (none && sels.some((s) => Object.keys(s).length)) return false
    const merged: Selector = {}
    for (const s of sels) {
      if (s.type) merged.type = !merged.type || isA(s.type, merged.type) ? s.type : merged.type
      for (const k of ['tags', 'notTags', 'status', 'notStatus'] as const) if (s[k]?.length) merged[k] = [...(merged[k] ?? []), ...s[k]!]
    }
    for (let i = 0; i < sels.length; i++) for (let j = i + 1; j < sels.length; j++) if (!hostsOverlap(sels[i], sels[j], onto)) return false
    if (!hostsOverlap(merged, merged, onto)) return false
  }
  return true
}

/**
 * Two rules tie when one event could reach both at equal specificity: the same kind, the same
 * specificity, hosts that overlap, and answering cases that can hold together. Rules that split a
 * host's cases between them (a plank put on a frame, a plank put on a stick) do not tie.
 */
export function rulesTie(a: Rule, b: Rule, onto?: Ontology): boolean {
  if (a.on !== b.on || compareSpec(specOf(a), specOf(b)) !== 0) return false
  if (!hostsOverlap(a.host ?? {}, b.host ?? {}, onto)) return false
  if (!onto) return true
  const hosts = [a.host ?? {}, b.host ?? {}]
  for (const pa of answering(a.tree)) for (const pb of answering(b.tree)) if (consistent([...pa, ...pb], hosts, onto)) return true
  return false
}

// re-exported helpers some tools use
export { isDo, isHole, STORY }

// ---------------------------------------------------------------- new types: names and pictures

const SEGMENT = /^[a-z0-9]+(_[a-z0-9]+)*$/
const HEX = /^#[0-9a-fA-F]{6}$/
/** A word as its singular (berries: berry, boxes: box, ingots: ingot): names that differ only by number name one thing. */
const singular = (w: string) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 4 && /(x|z|ch|sh|ss)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const words = (id: string) => id.toLowerCase().split(/[/_\s-]+/).filter(Boolean).map(singular)
const enName = (t: TypeDef) => (typeof t.name === 'string' ? t.name : t.name?.en ?? '').trim().toLowerCase()
const zhName = (t: TypeDef) => (typeof t.name === 'object' && t.name ? t.name.zh ?? '' : '').trim()
/** A name as one thing: its words, singular, in order (Iron Ingots, iron_ingot: iron ingot). */
const nameKey = (s: string) => words(s).join(' ')

/**
 * The types whose id or English name shares the most words with `name` (an id or a plain name),
 * best first; the same thing by name (in either language, either number) comes first of all.
 */
export function closestTypes(name: string, onto: Ontology, n = 6, zh?: string): string[] {
  const want = new Set(words(name))
  const whole = nameKey(name)
  return Object.values(onto.types)
    .map((t) => {
      const same = nameKey(enName(t)) === whole || nameKey(t.id.split('/').at(-1)!) === whole || (!!zh?.trim() && zhName(t) === zh.trim())
      return [(same ? 100 : 0) + new Set([...words(t.id), ...words(enName(t))].filter((w) => want.has(w))).size, t.id] as const
    })
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || a[1].length - b[1].length)
    .slice(0, n)
    .map(([, t]) => t)
}

/** " — the closest known types: a, b, c" for an unknown type id (by shared words), or "". */
export function closest(id: string, onto: Ontology, n = 4): string {
  const found = closestTypes(id, onto, n)
  return found.length ? ` — the closest known types: ${found.join(', ')}` : ''
}

/**
 * What is wrong with a type a patch introduces: it must be new, live under a type that exists
 * (or another of the patch's own), have a lowercase snake_case id, an English and a Chinese
 * name, not be another name for something the world has, and draw a valid picture if it has one.
 */
export function newTypeProblems(t: TypeDef, onto: Ontology, patch: Patch): string[] {
  const out: string[] = []
  if (t.id in onto.types) out.push('a type of this id exists already: use it instead of defining it')
  // a cell's ground is drawn and walked as its terrain (world-model.md §4.6): a patch makes things on cells, not new ground
  if (t.id.startsWith('tile/')) out.push('a patch cannot make a new kind of ground (tile/*): make a thing that lies on the cell instead (a fixture), or turn the cell into a terrain the world has')
  const segs = t.id.split('/')
  if (segs.length < 2 || !segs.every((s) => SEGMENT.test(s))) out.push('ids are lowercase snake_case segments under the kind, e.g. "item/material/iron_ingot"')
  const parent = segs.slice(0, -1).join('/')
  const ownTypes = new Set(patch.artifacts.flatMap((a) => (a?.kind === 'type' && a.type?.id ? [a.type.id] : [])))
  if (segs.length > 2 && !(parent in onto.types) && !ownTypes.has(parent)) out.push(`its parent "${parent}" does not exist${closest(parent, onto)}`)
  const name = t.name
  if (!name || typeof name === 'string' || !name.en?.trim() || !name.zh?.trim()) out.push('a new type needs a name in both languages: {"en": "...", "zh": "..."}')
  const leaf = segs.at(-1)!
  // the same thing under another name: the same leaf or English name (either number), or the same Chinese name
  const same = Object.values(onto.types).find(
    (o) => o.id !== t.id && (nameKey(o.id.split('/').at(-1)!) === nameKey(leaf) || (!!enName(t) && nameKey(enName(o)) === nameKey(enName(t))) || (!!zhName(t) && zhName(o) === zhName(t))),
  )
  if (same) out.push(`"${same.id}" already is this thing (same name): use it, or name what is different about the new one`)
  if (t.art) out.push(...artProblems(t.art))
  // what it is made of and how it breaks (world-model.md §8.3), read through what it inherits
  const index = new OntologyIndex({ ...onto, types: { ...onto.types, ...Object.fromEntries(patch.artifacts.flatMap((a) => (a?.kind === 'type' && a.type?.id ? [[a.type.id, a.type]] : []))) } })
  const r = index.resolve(t.id)
  const material = r.props.material
  if (material !== undefined && (typeof material !== 'string' || !onto.materials?.[material])) out.push(`props.material "${String(material)}" is not a material: one of ${Object.keys(onto.materials ?? {}).join(', ')}`)
  // every thing the AI makes is made of something, so it can be crafted, broken and recovered like the world's own (§8.3)
  if (material === undefined) out.push(`a new thing names what it is made of: props.material (one of ${Object.keys(onto.materials ?? {}).join(', ')})`)
  const ownRule = patch.artifacts.some((a) => a?.kind === 'rule' && a.rule?.host?.type === t.id && a.rule.on === 'threshold/cross')
  if (!r.makeup?.length && !(typeof r.props.maxHp === 'number' && ownRule))
    out.push('a new thing says what it is made of, which is also what it leaves when it breaks: makeup [{type, count, chance?}] of types the world has (or the patch defines)')
  for (const [i, m] of (r.makeup ?? []).entries()) {
    if (!m || typeof m.type !== 'string' || !(m.type in onto.types || ownTypes.has(m.type))) out.push(`makeup[${i}]: unknown type "${m?.type}"${m?.type ? closest(m.type, onto) : ''}`)
    if (!(Number.isSafeInteger(m?.count) && m.count > 0)) out.push(`makeup[${i}].count: a positive safe integer`)
  }
  return out
}

/** What is wrong with a 16x16 picture given as data. */
export function artProblems(art: PixelArt): string[] {
  const out: string[] = []
  if (!Array.isArray(art?.grid) || art.grid.length !== 16 || !art.grid.every((r) => typeof r === 'string' && r.length === 16)) out.push('art.grid must be 16 strings of 16 characters')
  const pal = art?.palette && typeof art.palette === 'object' ? art.palette : {}
  const keys = Object.keys(pal)
  if (!keys.length || keys.length > 8) out.push('art.palette must have 1 to 8 colours')
  for (const [k, v] of Object.entries(pal)) if (k.length !== 1 || k === '.' || !HEX.test(String(v))) out.push(`art.palette entry "${k}": one character (not ".") to a "#rrggbb" colour`)
  if (!out.length) {
    const unknown = new Set(art.grid.join('').split('').filter((c) => c !== '.' && !(c in pal)))
    if (unknown.size) out.push(`art.grid uses characters not in the palette: ${[...unknown].join(' ')}`)
    if (art.grid.join('').replace(/\./g, '').length < 20) out.push('art.grid draws almost nothing')
  }
  return out
}
