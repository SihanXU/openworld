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
} from '@lsw/engine'
import type { ChatMessage, ChatOptions, Model } from '@lsw/agent'
import { parseJson } from '@lsw/agent'
import type { Tool } from './tools.ts'

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
}

export interface AuditResult {
  confirmed: Confirmed[]
  /** Findings the sandbox did not bear out (kept for the record, never acted on). */
  unconfirmed: { finding: Finding; why: string }[]
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
  error?: string
}

/** The request's scene with the setup added, then the steps; bounded. */
export function run(sc: Scenario, onto: Ontology, lib: RuleLibrary, setup: ScenarioEntity[] = [], steps: AuditStep[] = []): Run {
  const scene: Scenario = { ...structuredClone(sc), entities: [...structuredClone(sc.entities), ...structuredClone(setup)] }
  const eng = buildSandbox(scene, onto, lib)
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
      }
    }
  }
  try {
    go(steps)
  } catch (err) {
    return { eng, lines, error: (err as Error).message }
  }
  return { eng, lines }
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
    const e = w.get(c.prop.key)
    const v = e && w.prop(e, c.prop.name)
    if (typeof v !== 'number') return false
    return (c.prop.atLeast === undefined || v >= c.prop.atLeast) && (c.prop.atMost === undefined || v <= c.prop.atMost)
  }
  if ('status' in c) return w.hasStatus({ e: c.status.key }, c.status.has)
  if ('gone' in c) return !w.get(c.gone)
  if ('is' in c) return w.get(c.is.key)?.type === c.is.type
  if ('events' in c) return eng.traced >= c.events.atLeast
  return false
}

/** What changed in the sandbox: things by type (made, gone), the actors' numbers, what was said wrong. */
function summary(r: Run, sc: Scenario): string {
  const w = r.eng.world
  const now = new Map<string, number>()
  for (const e of Object.values(w.state.entities)) if (e.place.on !== 'none' && !e.type.startsWith('tile/') && !e.type.startsWith('resident')) now.set(e.type, (now.get(e.type) ?? 0) + 1)
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
  const warned = w.fx.filter((f) => f.t === 'log' && f.tone === 'warn').map((f) => textOf((f as { text: Parameters<typeof textOf>[0] }).text)).slice(-5)
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
export function confirm(f: Finding, sc: Scenario, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed | { why: string } {
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
  return { ...f, evidence: `with the patch:\n${summary(withIt, sc)}${without ? `\nwithout it:\n${summary(without, sc)}` : ''}` }
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
  const was = new Map<string, number>()
  for (const e of sc.entities) was.set(e.type, (was.get(e.type) ?? 0) + 1)
  let things = 0
  for (const e of Object.values(w.state.entities)) {
    if (e.place.on === 'none' || e.type.startsWith('tile/') || e.type.startsWith('resident')) continue
    things++
  }
  const a = w.get(actorKey)
  return { things: things - sc.entities.filter((e) => !e.type.startsWith('tile/')).length, nums: a ? PROBE_GAINS.map((k) => w.num(a, k)) : [] }
}

/**
 * The deterministic probe (no model): the scene's act repeated with the patch and without it. A
 * farm is what the patch lets the actor gain again and again that the world did not: things made,
 * or experience and fullness, beyond what the same steps gain without the patch.
 */
export function probe(req: ModRequest, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed[] {
  const sc = req.scenario
  const ev = sc.event
  if (!ev.actor || !(ev.kind ?? 'act/use').startsWith('act/')) return []
  const step: AuditStep = { act: (ev.kind ?? 'act/use').slice(4) as Verb, actor: ev.actor, target: ev.target ?? ev.actor, ...(ev.instrument && { instrument: ev.instrument }), ...(ev.params && { params: ev.params }) }
  const steps: AuditStep[] = [{ repeat: PROBE_REPEATS, steps: [step] }]
  const withIt = run(sc, onto, patched, [], steps)
  let without: Run | undefined
  try {
    without = run(sc, onto, base, [], steps)
  } catch {
    without = undefined
  }
  const a = gains(withIt, sc, ev.actor)
  const b = without ? gains(without, sc, ev.actor) : { things: 0, nums: a.nums.map(() => 0) }
  const start = (() => {
    const fresh = buildSandbox(sc, onto, base).world
    const e = fresh.get(ev.actor!)
    return e ? PROBE_GAINS.map((k) => fresh.num(e, k)) : []
  })()
  const out: Confirmed[] = []
  // things: more than one per repeat is a faucet pressed PROBE_REPEATS times (one made, consumed, is a trade)
  if (a.things - b.things >= PROBE_REPEATS) {
    const f: Finding = { title: `the act done ${PROBE_REPEATS} times leaves ${a.things - b.things} more things than without the patch`, kind: 'farm', steps, expect: [{ events: { atLeast: 1 } }] }
    out.push({ ...f, evidence: `with the patch:\n${summary(withIt, sc)}${without ? `\nwithout it:\n${summary(without, sc)}` : ''}` })
  }
  for (const [i, k] of PROBE_GAINS.entries()) {
    const gained = (a.nums[i] ?? 0) - (start[i] ?? 0)
    const gainedWithout = (b.nums[i] ?? 0) - (start[i] ?? 0)
    if (gained - gainedWithout >= PROBE_REPEATS) {
      const f: Finding = { title: `the act done ${PROBE_REPEATS} times gains ${gained - gainedWithout} ${k} for nothing`, kind: 'farm', steps, expect: [{ prop: { key: ev.actor, name: k, atLeast: (start[i] ?? 0) + gained } }] }
      out.push({ ...f, evidence: `with the patch:\n${summary(withIt, sc)}${without ? `\nwithout it:\n${summary(without, sc)}` : ''}` })
    }
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
    const c = confirm(f, req.scenario, onto, base, patched)
    if ('evidence' in c) out.confirmed.push(c)
    else out.unconfirmed.push({ finding: f, why: c.why })
  }
  return out
}
