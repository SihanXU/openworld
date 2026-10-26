// The auditor (design.md §13): after the deterministic checks, an agent plays against a patch the
// way a player out to break the game would — farms that never end, a cheap road to a rare thing, a
// softlock, harm to someone the story needs, a chain that runs away. It has the sandbox, not an
// opinion: each finding is a setup, a list of steps and what must hold at the end, and it counts
// only when the sandbox shows it with the patch and not without it. The model searches; the code
// judges.

import {
  RuleLibrary,
  SANDBOX_MAP,
  buildSandbox,
  textOf,
  type Engine,
  type ModRequest,
  type Ontology,
  type Patch,
  type PropValue,
  type Ref,
  type Scenario,
  type ScenarioEntity,
  type Verb,
} from '@openworld/engine'
import type { ChatMessage, ChatOptions, Model } from '../models/model.ts'
import { parseJson } from '../models/model.ts'
import type { Tool } from '../modder/tools.ts'

/** What must hold at the end of a finding's steps. */
export type Claim =
  | { count: { type: string; in?: string; atLeast: number } }
  | { prop: { key: string; name: string; atLeast?: number; atMost?: number } }
  | { status: { key: string; has: string } }
  | { gone: string }
  | { is: { key: string; type: string } }
  | { events: { atLeast: number } }

/** One thing done in the sandbox: an act, time passing, or steps again and again. */
export type AuditStep =
  | { act: Verb; actor?: string; target?: string; instrument?: string; params?: Record<string, PropValue> }
  | { tick: number }
  | { repeat: number; steps: AuditStep[] }

export interface Finding {
  title: string
  /** farm | value | softlock | harm | runaway | other */
  kind: string
  /** Things added to the request's scene before the steps (keys of their own). */
  setup?: ScenarioEntity[]
  steps: AuditStep[]
  expect: Claim[]
}

export interface Confirmed extends Finding {
  /** What the sandbox showed, with the patch and without it. */
  evidence: string
  /** What makes it harm by construction, as the code judged it (not the finding's own `kind`). */
  proven?: HarmClass
}

/** The harms the code recognizes (design.md §13, the auditor): what a finding must be shown to be. */
export type HarmClass = 'farm' | 'value' | 'harm' | 'softlock' | 'runaway'

export interface AuditResult {
  confirmed: Confirmed[]
  /** Findings the sandbox did not bear out (kept for the record, never acted on). */
  unconfirmed: { finding: Finding; why: string }[]
  /** Of those, the ones the sandbox did reproduce but that are no harm the code recognizes: a reviewer's to read. */
  reproduced?: { finding: Finding; why: string }[]
  /** Set when the auditor itself failed (a time-out, a bad reply): nothing was looked at, which is not "nothing found". */
  error?: string
}

const VERBS = new Set<Verb>(['use', 'put', 'take', 'hands', 'move', 'craft', 'learn'])
/** The most the sandbox runs for one finding: acts, ticks, repeats (an audit is bounded too). */
const MOST = { acts: 2000, ticks: 6000, repeat: 500, findings: 5 }

/** The library with the patch in it (as the validator builds its candidate). */
export function withPatch(lib: RuleLibrary, patch: Patch): RuleLibrary {
  const cand = lib.clone()
  for (const a of patch.artifacts) {
    if (a.kind === 'type') cand.types = cand.types.filter((t) => t.id !== a.type.id).concat(a.type)
    if (a.kind === 'status') cand.statuses = cand.statuses.filter((s) => s.id !== a.status.id).concat(a.status)
    if (a.kind === 'rule') cand.add({ ...a.rule, source: { origin: 'patch' } })
  }
  return cand
}

/** A cell (`tile:x,y`) or a thing by its key. */
function refOf(eng: Engine, key: string): Ref {
  const m = /^tile:(\d+),(\d+)$/.exec(key)
  return m ? eng.world.cellRef(SANDBOX_MAP, Number(m[1]), Number(m[2])) : { e: key }
}

interface Run {
  eng: Engine
  /** One line per act: what answered it. */
  lines: string[]
  /** How many acts the steps made. */
  acts: number
  error?: string
}

/** The request's scene with the setup added, then the steps; bounded. `watch` sees the scene before the steps and after each act. */
export function run(sc: Scenario, onto: Ontology, lib: RuleLibrary, setup: ScenarioEntity[] = [], steps: AuditStep[] = [], watch?: (eng: Engine) => void): Run {
  const scene: Scenario = { ...structuredClone(sc), entities: [...structuredClone(sc.entities), ...structuredClone(setup)] }
  const eng = buildSandbox(scene, onto, lib)
  watch?.(eng)
  const lines: string[] = []
  let acts = 0
  let ticks = 0
  const actor = sc.event.actor ?? 'actor'
  const go = (list: AuditStep[]): void => {
    for (const s of list) {
      if ('repeat' in s) {
        for (let i = 0; i < Math.min(MOST.repeat, Math.max(0, Math.floor(s.repeat))); i++) go(s.steps ?? [])
      } else if ('tick' in s) {
        const n = Math.min(MOST.ticks - ticks, Math.max(0, Math.floor(s.tick)))
        for (let i = 0; i < n; i++) eng.tick()
        ticks += n
      } else {
        if (++acts > MOST.acts) throw new Error(`more than ${MOST.acts} acts`)
        if (!VERBS.has(s.act)) throw new Error(`unknown act "${s.act}"`)
        // (as the validator's replay: the act reaches what it reached when it happened, wherever the setup put things)
        const res = eng.act(s.act, s.actor ?? actor, refOf(eng, s.target ?? s.actor ?? actor), { ...(s.instrument !== undefined && { instrument: s.instrument ? refOf(eng, s.instrument) : null }), ...(s.params && { params: s.params }), reach: Infinity })
        if (lines.length < 40) lines.push(`${s.act} ${s.target ?? ''}${s.instrument ? ` with ${s.instrument}` : ''} → ${res.defined ? res.rule?.id : res.hole ? 'undefined' : 'nothing'}`)
        watch?.(eng)
      }
    }
  }
  try {
    go(steps)
  } catch (err) {
    return { eng, lines, acts, error: (err as Error).message }
  }
  return { eng, lines, acts }
}

/** How many things of a type there are (in a holder, at any depth, when `in` is given). */
function countOf(eng: Engine, type: string, holder?: string): number {
  const w = eng.world
  let n = 0
  for (const e of Object.values(w.state.entities)) {
    if (e.place.on === 'none' || (e.type !== type && !e.type.startsWith(type + '/'))) continue
    if (holder) {
      let h = e.place.on === 'inside' || e.place.on === 'hand' ? e.place.holder : undefined
      for (let i = 0; h && h !== holder && i < 16; i++) {
        const p = w.get(h)?.place
        h = p && (p.on === 'inside' || p.on === 'hand') ? p.holder : undefined
      }
      if (h !== holder) continue
    }
    n++
  }
  return n
}

export function holds(eng: Engine, c: Claim): boolean {
  const w = eng.world
  if ('count' in c) return countOf(eng, c.count.type, c.count.in) >= c.count.atLeast
  if ('prop' in c) {
    const v = measure(eng, c)
    return v !== undefined && (c.prop.atLeast === undefined || v >= c.prop.atLeast) && (c.prop.atMost === undefined || v <= c.prop.atMost)
  }
  if ('status' in c) return w.hasStatus({ e: c.status.key }, c.status.has)
  if ('gone' in c) return !w.get(c.gone)
  if ('is' in c) return w.get(c.is.key)?.type === c.is.type
  if ('events' in c) return eng.traced >= c.events.atLeast
  return false
}

/** A line that says something went wrong: a warning, or an effect the engine refused (its dev line names the rule). */
function refused(f: Engine['world']['fx'][number]): boolean {
  if (f.t !== 'log') return false
  return f.tone === 'warn' || (f.tone === 'dev' && typeof f.text === 'string' && f.text.startsWith('rule '))
}

/** What changed in the sandbox: things by type (made, gone), the actors' numbers, what was said wrong. */
function summary(r: Run, sc: Scenario): string {
  const w = r.eng.world
  const now = things(r.eng)
  const was = new Map<string, number>()
  for (const e of sc.entities) was.set(e.type, (was.get(e.type) ?? 0) + 1)
  const delta = [...new Set([...now.keys(), ...was.keys()])].map((t) => [t, (now.get(t) ?? 0) - (was.get(t) ?? 0)] as const).filter(([, d]) => d !== 0)
  const actors = sc.entities.filter((e) => e.type.startsWith('actor')).map((e) => {
    const a = w.get(e.key)
    if (!a) return `${e.key}: gone`
    const nums = ['hp', 'maxHp', 'xp', 'level', 'hunger'].map((k) => [k, w.prop(a, k)] as const).filter(([, v]) => v !== undefined)
    const statuses = Object.keys(a.statuses ?? {})
    return `${e.key} (${a.type}): ${nums.map(([k, v]) => `${k} ${v}`).join(', ')}${statuses.length ? `; statuses ${statuses.join(', ')}` : ''}`
  })
  const warned = w.fx.filter(refused).map((f) => textOf((f as { text: Parameters<typeof textOf>[0] }).text)).slice(-5)
  return [
    ...r.lines.map((l) => `  ${l}`),
    `things: ${delta.length ? delta.map(([t, d]) => `${t} ${d > 0 ? '+' : ''}${d}`).join(', ') : 'no change'}`,
    ...actors.map((a) => `  ${a}`),
    `events: ${r.eng.traced}`,
    ...(warned.length ? [`warnings: ${warned.join(' | ')}`] : []),
    ...(r.error ? [`stopped: ${r.error}`] : []),
  ].join('\n')
}

/**
 * A finding counts when its claims all hold after its steps with the patch, and not all of them
 * without it (what the world already did is not the patch's doing).
 */
export function confirm(f: Finding, sc: Scenario, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed | { why: string; reproduced?: boolean } {
  if (!Array.isArray(f.steps) || !Array.isArray(f.expect) || !f.expect.length) return { why: 'no steps or no claims' }
  let withIt: Run
  try {
    withIt = run(sc, onto, patched, f.setup, f.steps)
  } catch (err) {
    return { why: `the scene could not be built: ${(err as Error).message}` }
  }
  const failing = f.expect.filter((c) => !holds(withIt.eng, c))
  if (failing.length) return { why: `with the patch, ${JSON.stringify(failing[0])} does not hold` }
  let without: Run | undefined
  try {
    without = run(sc, onto, base, f.setup, f.steps)
  } catch {
    // (a scene that cannot even be built without the patch's types is the patch's doing)
  }
  if (without && f.expect.every((c) => holds(without!.eng, c))) return { why: 'it holds without the patch too: the world already did this' }
  // the patch did it; whether it is harm is the code's to say, not the finding's label (a stone made wet is
  // what a rule that wets stones is for): it must be one of the harms below, shown in the sandbox
  const harm = harmOf(f, sc, onto, base, patched, withIt, without)
  if (!harm) return { why: 'it happens with the patch and not without it, but it is no harm by construction (no farm, value, harm to what the story needs, softlock or runaway)', reproduced: true }
  return { ...f, proven: harm.kind, evidence: `harm by construction, ${harm.kind}: ${harm.why}\n${evidenceOf(sc, withIt, without)}` }
}

/** What the sandbox showed with the patch (`extra` after it) and without it. */
function evidenceOf(sc: Scenario, withIt: Run, without?: Run, extra = ''): string {
  return `with the patch:\n${summary(withIt, sc)}${extra}${without ? `\nwithout it:\n${summary(without, sc)}` : ''}`
}

/** A finding's steps with every repeat done twice as often (the steps twice over when they repeat nothing). */
function doubled(steps: AuditStep[]): AuditStep[] {
  if (!steps.some((x) => 'repeat' in x)) return [{ repeat: 2, steps }]
  return steps.map((x) => ('repeat' in x ? { repeat: x.repeat * 2, steps: x.steps } : x))
}

/** What a claim measures: how many things, or a number (undefined for a claim that measures nothing). */
function measure(eng: Engine, c: Claim): number | undefined {
  if ('count' in c) return countOf(eng, c.count.type, c.count.in)
  if ('prop' in c) {
    const e = eng.world.get(c.prop.key)
    const v = e && eng.world.prop(e, c.prop.name)
    return typeof v === 'number' ? v : undefined
  }
  return undefined
}

/** Things by type, as they lie in the sandbox (the ground and the residents left out). */
function things(eng: Engine): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of Object.values(eng.world.state.entities)) if (e.place.on !== 'none' && !e.type.startsWith('tile/') && !e.type.startsWith('resident')) out.set(e.type, (out.get(e.type) ?? 0) + 1)
  return out
}

/** Events per act past which a chain is a runaway (the validator's chain bound is 1,500 events in all). */
const RUNAWAY_PER_ACT = 50
/** How much more what is made must be worth than what is used up to be a cheap road to it. */
const VALUE_FACTOR = 3
/** How long a stop must last to be a softlock: a minute of the world's time (10 ticks a second). */
const SOFTLOCK_TICKS = 600

/**
 * Whether a finding the sandbox reproduced is harm by construction, and which (the code judges; the finding's
 * `kind` is only the auditor's guess):
 * - runaway: the events per act run past RUNAWAY_PER_ACT with the patch, as they do not without it;
 * - harm: something the story needs (an essential thing, a resident) is gone or down with the patch, not without;
 * - softlock: the actor still cannot act a minute after the steps (gone, or a status that holds it), not without;
 * - farm: what a claim measures grows further when the steps repeat twice as often, more than without the patch;
 * - value: what the steps made is worth over VALUE_FACTOR times what they used up (the things' own `value`, else 1).
 */
export function harmOf(f: Finding, sc: Scenario, onto: Ontology, base: RuleLibrary, patched: RuleLibrary, withIt: Run, without?: Run): { kind: HarmClass; why: string } | undefined {
  const per = (r: Run) => r.eng.traced / Math.max(1, r.acts)
  if (per(withIt) > RUNAWAY_PER_ACT && (!without || per(without) <= RUNAWAY_PER_ACT)) return { kind: 'runaway', why: `${Math.round(per(withIt))} events an act` }
  // what the story needs: essential things and residents of the scene and the setup
  const keys = [...sc.entities, ...(f.setup ?? [])].map((e) => e.key)
  const lost = (r: Run | undefined, key: string) => {
    if (!r) return false
    const e = r.eng.world.get(key)
    return !e || e.place.on === 'none' || r.eng.world.hasStatus({ e: key }, 'down')
  }
  const fresh = run(sc, onto, base, f.setup).eng
  for (const key of keys) {
    const at = fresh.world.get(key)
    if (!at || !(at.type.startsWith('resident') || fresh.world.hasTag(at, 'essential'))) continue
    if (lost(withIt, key) && !lost(without, key)) return { kind: 'harm', why: `${key} (${at.type}), which the story needs, is gone or down` }
  }
  // the actor, a minute on: still unable to act
  const actor = sc.event.actor ?? 'actor'
  const stopped = (r: Run | undefined): boolean => {
    if (!r) return false
    for (let i = 0; i < SOFTLOCK_TICKS; i++) r.eng.tick()
    const w = r.eng.world
    const a = w.get(actor)
    if (!a || a.place.on === 'none') return true
    return Object.keys(a.statuses ?? {}).some((st) => (w.onto.status(st) as { immobilize?: boolean } | undefined)?.immobilize)
  }
  // (on copies: the runs are kept as they ended, for the evidence)
  const again = (lib: RuleLibrary) => run(sc, onto, lib, f.setup, f.steps)
  if (stopped(again(patched)) && !(without && stopped(again(base)))) return { kind: 'softlock', why: `${actor} still cannot act a minute after the steps` }
  // farm: more for more repeats, beyond what the world gives the same steps
  const twice = doubled(f.steps)
  const w2 = run(sc, onto, patched, f.setup, twice)
  let b2: Run | undefined
  try {
    b2 = without ? run(sc, onto, base, f.setup, twice) : undefined
  } catch {
    b2 = undefined
  }
  for (const c of f.expect) {
    const one = measure(withIt.eng, c)
    const two = measure(w2.eng, c)
    if (one === undefined || two === undefined) continue
    const base1 = without ? (measure(without.eng, c) ?? 0) : 0
    const base2 = b2 ? (measure(b2.eng, c) ?? 0) : 0
    if (two - base2 > one - base1 && one - base1 > 0) return { kind: 'farm', why: `${JSON.stringify(c)} measures ${one} for the steps and ${two} for them twice over (${base1} and ${base2} without the patch)` }
  }
  // value: what was made against what was used up, by the things' own worth (beyond what the steps do without the patch)
  const worth = (type: string): number => {
    const v = withIt.eng.world.onto.resolve(type).props.value
    return typeof v === 'number' && v > 0 ? v : 1
  }
  const start = things(fresh)
  const delta = (r: Run | undefined): Map<string, number> => {
    const now = r ? things(r.eng) : start
    return new Map([...new Set([...now.keys(), ...start.keys()])].map((t) => [t, (now.get(t) ?? 0) - (start.get(t) ?? 0)]))
  }
  const dw = delta(withIt)
  const db = delta(without)
  let made = 0
  let used = 0
  for (const t of new Set([...dw.keys(), ...db.keys()])) {
    const d = (dw.get(t) ?? 0) - (db.get(t) ?? 0)
    if (d > 0) made += d * worth(t)
    else used -= d * worth(t)
  }
  if (made > VALUE_FACTOR * Math.max(1, used)) return { kind: 'value', why: `made ${made} in worth for ${used} used up` }
  return undefined
}

/** The auditor's tools: look at the scene, and play steps in it (with the patch and without it). */
export function auditTools(sc: Scenario, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Tool[] {
  return [
    {
      name: 'look',
      description: 'The scene of the request the patch answers: every thing by key, type, place (x,y or who holds it), props and statuses; and the triggering event.',
      parameters: { type: 'object', properties: {} },
      run: () => JSON.stringify({ event: sc.event, entities: sc.entities }, null, 1),
    },
    {
      name: 'run',
      description:
        'Play steps in a fresh copy of the scene, with the patch and without it, and say what changed: what answered each act, things made or gone by type, the actors\' numbers and statuses, the event count. setup adds things first ({key, type, x, y, heldBy?, inside?, props?, statuses?}). A step is {act: "use"|"put"|"take"|"hands", actor?, target?: key or "tile:x,y", instrument?: key}, {tick: n} (10 ticks a second), or {repeat: n, steps: [...]}.',
      parameters: {
        type: 'object',
        properties: { setup: { type: 'array', items: { type: 'object' } }, steps: { type: 'array', items: { type: 'object' } } },
        required: ['steps'],
      },
      run: (args) => {
        const setup = (Array.isArray(args.setup) ? args.setup : []) as ScenarioEntity[]
        const steps = (Array.isArray(args.steps) ? args.steps : []) as AuditStep[]
        const a = run(sc, onto, patched, setup, steps)
        let b: string
        try {
          b = summary(run(sc, onto, base, setup, steps), sc)
        } catch (err) {
          b = `(the scene cannot be built without the patch: ${(err as Error).message})`
        }
        return `with the patch:\n${summary(a, sc)}\nwithout it:\n${b}`
      },
    },
  ]
}

export interface AuditOptions {
  rounds: number
  reasoning?: ChatOptions['reasoning']
  provider?: ChatOptions['provider']
}

/** What the actor stands to gain from an act done again and again: things, and numbers that only go up. */
const PROBE_REPEATS = 30
const PROBE_GAINS = ['xp', 'hunger'] as const

/** The scene's own act, done PROBE_REPEATS times: what it made, and what the actor's numbers gained. */
function gains(r: Run, sc: Scenario, actorKey: string): { things: number; nums: number[] } {
  const w = r.eng.world
  const now = [...things(r.eng).values()].reduce((a, n) => a + n, 0)
  const a = w.get(actorKey)
  return { things: now - sc.entities.filter((e) => !e.type.startsWith('tile/')).length, nums: a ? PROBE_GAINS.map((k) => w.num(a, k)) : [] }
}

/** The keys of the things the scene's event names (its host and roles): the act's participants. */
function participantsOf(sc: Scenario): string[] {
  const keys = new Set(sc.entities.map((e) => e.key))
  return [...new Set(Object.values(sc.event).filter((v): v is string => typeof v === 'string' && keys.has(v)))]
}

/**
 * A watch on the participants' numbers over a run: `rising()` gives those the steps raised on every act,
 * by `key\u0000prop`, with how much they rose in all (a number the thing does not have counts from 0,
 * as addProp counts it).
 */
function numbersWatch(sc: Scenario): { watch: (eng: Engine) => void; rising: () => Map<string, number> } {
  const parts = participantsOf(sc)
  const numbers = (eng: Engine): Map<string, number> => {
    const w = eng.world
    const out = new Map<string, number>()
    for (const key of parts) {
      const props = w.view({ e: key })?.props ?? {}
      for (const [k, v] of Object.entries(props)) if (typeof v === 'number') out.set(`${key}\u0000${k}`, v)
    }
    return out
  }
  let last: Map<string, number> | undefined
  let acts = 0
  const rose = new Map<string, { times: number; by: number }>()
  const watch = (eng: Engine): void => {
    const now = numbers(eng)
    if (last) {
      acts++
      for (const [k, v] of now) {
        const was = last.get(k) ?? 0
        if (v <= was) continue
        const r = rose.get(k) ?? { times: 0, by: 0 }
        rose.set(k, { times: r.times + 1, by: r.by + v - was })
      }
    }
    last = now
  }
  return { watch, rising: () => new Map([...rose].filter(([, r]) => acts > 0 && r.times === acts).map(([k, r]) => [k, r.by])) }
}

/**
 * The deterministic probe (no model): the scene's act repeated with the patch and without it. A
 * farm is what the patch lets the actor gain again and again that the world did not: things made,
 * or experience and fullness, beyond what the same steps gain without the patch; or any number of
 * the act's participants (a tool's power, a creature's store) that rises on every act with the patch
 * and not without it.
 */
export function probe(req: ModRequest, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed[] {
  const sc = req.scenario
  const ev = sc.event
  if (!ev.actor || !(ev.kind ?? 'act/use').startsWith('act/')) return []
  const step: AuditStep = { act: (ev.kind ?? 'act/use').slice(4) as Verb, actor: ev.actor, target: ev.target ?? ev.actor, ...(ev.instrument && { instrument: ev.instrument }), ...(ev.params && { params: ev.params }) }
  const steps: AuditStep[] = [{ repeat: PROBE_REPEATS, steps: [step] }]
  const watched = numbersWatch(sc)
  const withIt = run(sc, onto, patched, [], steps, watched.watch)
  const watchedWithout = numbersWatch(sc)
  let without: Run | undefined
  try {
    without = run(sc, onto, base, [], steps, watchedWithout.watch)
  } catch {
    without = undefined
  }
  const a = gains(withIt, sc, ev.actor)
  const b = without ? gains(without, sc, ev.actor) : { things: 0, nums: a.nums.map(() => 0) }
  const fresh = buildSandbox(sc, onto, base).world
  const actorAtStart = fresh.get(ev.actor)
  const start = actorAtStart ? PROBE_GAINS.map((k) => fresh.num(actorAtStart, k)) : []
  const out: Confirmed[] = []
  // things: more than one per repeat is a faucet pressed PROBE_REPEATS times (one made, consumed, is a trade)
  if (a.things - b.things >= PROBE_REPEATS) {
    const f: Finding = { title: `the act done ${PROBE_REPEATS} times leaves ${a.things - b.things} more things than without the patch`, kind: 'farm', steps, expect: [{ events: { atLeast: 1 } }] }
    out.push({ ...f, proven: 'farm', evidence: evidenceOf(sc, withIt, without) })
  }
  for (const [i, k] of PROBE_GAINS.entries()) {
    const gained = (a.nums[i] ?? 0) - (start[i] ?? 0)
    const gainedWithout = (b.nums[i] ?? 0) - (start[i] ?? 0)
    if (gained - gainedWithout >= PROBE_REPEATS) {
      const f: Finding = { title: `the act done ${PROBE_REPEATS} times gains ${gained - gainedWithout} ${k} for nothing`, kind: 'farm', steps, expect: [{ prop: { key: ev.actor, name: k, atLeast: (start[i] ?? 0) + gained } }] }
      out.push({ ...f, proven: 'farm', evidence: evidenceOf(sc, withIt, without) })
    }
  }
  // any participant's number that goes up every time the act is done again, as it did not without the patch
  const before = watchedWithout.rising()
  for (const [k, by] of watched.rising()) {
    const [key, name] = k.split('\u0000')
    if (before.has(k) || (key === ev.actor && (PROBE_GAINS as readonly string[]).includes(name) && out.some((f) => f.title.endsWith(`${name} for nothing`)))) continue
    const end = withIt.eng.world.get(key)
    const now = end ? withIt.eng.world.num(end, name) : by
    const f: Finding = { title: `the act done ${PROBE_REPEATS} times raises ${key}'s ${name} every time (+${by})`, kind: 'farm', steps, expect: [{ prop: { key, name, atLeast: now } }] }
    out.push({ ...f, proven: 'farm', evidence: evidenceOf(sc, withIt, without, `\n  ${key} ${name} ${now}`) })
  }
  return out
}

/** One audit of a patch: tool rounds, a final answer, every finding checked in the sandbox. */
export async function audit(model: Model, system: string, user: string, req: ModRequest, onto: Ontology, base: RuleLibrary, patch: Patch, o: AuditOptions): Promise<AuditResult> {
  const patched = withPatch(base, patch)
  const tools = auditTools(req.scenario, onto, base, patched)
  const specs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const call: ChatOptions = { temperature: 0.3, purpose: 'audit', reasoning: o.reasoning, provider: o.provider }
  let answer = ''
  for (let round = 0; round <= o.rounds; round++) {
    const last = round === o.rounds
    const r = await model.chat(messages, last ? { ...call, json: true } : { ...call, tools: specs })
    if (last || !r.toolCalls.length) {
      answer = r.content
      break
    }
    messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls })
    for (const c of r.toolCalls) {
      const tool = tools.find((t) => t.name === c.name)
      let out: string
      try {
        out = tool ? tool.run((c.args ?? {}) as Record<string, unknown>) : `unknown tool "${c.name}"`
      } catch (err) {
        out = `tool error: ${(err as Error).message}`
      }
      messages.push({ role: 'tool', toolCallId: c.id, name: c.name, content: out.slice(0, 6000) })
    }
    if (round === o.rounds - 1) messages.push({ role: 'user', content: 'No more tool calls: give your final answer now, as JSON.' })
  }
  const j = parseJson(answer) as { findings?: unknown } | undefined
  const findings = (Array.isArray(j?.findings) ? j!.findings : []).slice(0, MOST.findings) as Finding[]
  const out: AuditResult = { confirmed: [], unconfirmed: [] }
  for (const f of findings) {
    // each finding judged on its own: one the sandbox cannot judge (a claim of no known shape) is no reason to lose the rest
    let c: ReturnType<typeof confirm>
    try {
      c = confirm(f, req.scenario, onto, base, patched)
    } catch (err) {
      c = { why: `the finding could not be judged: ${(err as Error)?.message ?? String(err)}` }
    }
    if ('evidence' in c) out.confirmed.push(c)
    else {
      out.unconfirmed.push({ finding: f, why: c.why })
      if (c.reproduced) (out.reproduced ??= []).push({ finding: f, why: c.why })
    }
  }
  return out
}
