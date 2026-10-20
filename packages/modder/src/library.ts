// The shared rule library (design.md §9): base rules from content plus every accepted patch,
// kept as an append-only log (one JSON line per patch or removal) so the library at any point
// can be rebuilt, rolled back or ablated. Clients pull the log; the modder validates against it.

import { appendFileSync, existsSync, mkdirSync, readFileSync, truncateSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { connected, economySteps, freeLunch } from './economy.ts'
import {
  RuleLibrary,
  RepeatLimitError,
  holeKey,
  ruleTier,
  tierOfRequest,
  tiersFrom,
  buildModSpec,
  buildSandbox,
  checkExpectations,
  whyEndless,
  replay,
  scenarioEvent,
  validatePatch,
  newStatusProblems,
  newTypeProblems,
  namesClash,
  withTerrainTypes,
  type ModRequest,
  type ModSpec,
  type ModWorkspace,
  type Ontology,
  type Patch,
  type PatchLogEntry,
  type Rule,
  type Scenario,
  type ValidationResult,
} from '@openworld/engine'

export interface CommitResult {
  ok: boolean
  result: ValidationResult
  rules: string[]
  seq?: number
}

export class WorldLibrary {
  readonly lib: RuleLibrary
  readonly log: PatchLogEntry[] = []
  /** What the log rolled back (rules) or forgot (types), until a later patch brings it again: a client that still holds it does not bring it back in its workspace. */
  private readonly gone = { rules: new Set<string>(), types: new Set<string>(), statuses: new Set<string>() }
  /** The scene each live patch answered, by its first rule (for the audit sweep and the outer loop). */
  readonly asked: { scenario: Scenario; rule: string }[] = []
  private proofs = new Map<string, { tests: string[][]; result: ValidationResult }>()
  /**
   * The log's identity, made when its file is (kept beside it, `<file>.id`): a log begun anew has another, so
   * a client that holds patches up to some seq of the old one knows to sync from the start.
   */
  readonly logId: string
  /**
   * The story's protected fact prefixes (the game's world index: `protectedFacts`, design.md §5.11): a commit is
   * judged with them as a client judges the patch it syncs, so the log holds nothing every client would refuse.
   */
  protectedFacts: string[]

  constructor(
    readonly ontology: Ontology,
    readonly base: Rule[],
    private file?: string,
    opts: { protectedFacts?: string[] } = {},
  ) {
    this.lib = new RuleLibrary(base)
    this.protectedFacts = opts.protectedFacts ?? []
    this.logId = file ? logIdentity(file) : randomUUID()
    if (file && existsSync(file)) {
      const text = readFileSync(file, 'utf8')
      // a last line cut short (the service stopped mid-write): cut back to the last whole line, so the next
      // entry starts a line of its own (appended onto the torn one, it would be lost on the next start, and its seq used again)
      if (text && !text.endsWith('\n')) {
        const cut = text.lastIndexOf('\n') + 1
        let whole = false
        try {
          JSON.parse(text.slice(cut))
          whole = true
        } catch {
          /* torn */
        }
        if (whole) appendFileSync(file, '\n')
        else truncateSync(file, Buffer.byteLength(text.slice(0, cut)))
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        try {
          this.apply(JSON.parse(line) as PatchLogEntry)
        } catch {
          /* a torn last line: skip it */
        }
      }
    }
  }

  get seq(): number {
    return this.log.length ? this.log[this.log.length - 1].seq : 0
  }

  /**
   * The log as clients see it, each patch with the scene it answered: a client replays it there
   * (the sandbox checks, the repeat check) before it takes the patch, as for its own requests.
   */
  since(seq: number): PatchLogEntry[] {
    return this.log.filter((e) => e.seq > seq)
  }

  /** Rules added by patches and still in force. */
  patchRules(): Rule[] {
    return this.lib.patches()
  }

  /** The library a request is judged against: the shared one plus the client's own local patches. */
  workspace(ws?: ModWorkspace, without: string[] = [], redefines?: Patch): RuleLibrary {
    const lib = this.lib.clone()
    for (const id of without) lib.remove(id)
    // a revision may define again what the patches it replaces made (a jam that was not edible): the types
    // and statuses it brings anew leave with the patches they came with, unless a patch that stays brought
    // them too (what it only goes on using stays as it is)
    const redefined = { types: new Set<string>(), statuses: new Set<string>() }
    if (without.length && redefines) {
      const replaced = (e: PatchLogEntry) => 'patch' in e && e.rules.length > 0 && e.rules.every((r) => without.includes(r))
      const stays = (e: PatchLogEntry) => 'patch' in e && !replaced(e) && (e.rules.length === 0 || e.rules.some((r) => this.lib.rules.has(r)))
      for (const kind of ['type', 'status'] as const) {
        const kept = new Set(this.log.filter(stays).flatMap((e) => broughtBy(e, kind)))
        const anew = new Set(broughtBy({ seq: 0, at: '', patch: redefines, rules: [] }, kind))
        for (const id of new Set(this.log.filter(replaced).flatMap((e) => broughtBy(e, kind)))) {
          if (kept.has(id) || !anew.has(id)) continue
          if (kind === 'type') lib.removeType(id)
          else lib.removeStatus(id)
          redefined[kind === 'type' ? 'types' : 'statuses'].add(id)
        }
      }
    }
    const p = ws?.patches
    if (!p) return lib
    // (what the log forgot, or a revision defines again, a client's own copy does not bring back)
    for (const t of p.types ?? []) if (!lib.types.some((x) => x.id === t.id) && !this.gone.types.has(t.id) && !redefined.types.has(t.id)) lib.types.push(t)
    for (const s of p.statuses ?? []) if (!lib.statuses.some((x) => x.id === s.id) && !this.gone.statuses.has(s.id) && !redefined.statuses.has(s.id)) lib.statuses.push(s)
    for (const r of p.rules ?? []) if (r?.id && !lib.rules.has(r.id) && !without.includes(r.id) && !this.gone.rules.has(r.id) && r.source?.origin === 'patch') lib.add(r, r.source.at)
    return lib
  }

  spec(ws?: ModWorkspace): ModSpec {
    return buildModSpec(this.ontology, this.workspace(ws))
  }

  /** The ontology with patch-introduced types and statuses folded in. */
  fullOntology(lib: RuleLibrary = this.lib): Ontology {
    const onto: Ontology = { ...this.ontology, types: { ...this.ontology.types }, statuses: { ...this.ontology.statuses } }
    for (const t of lib.types) onto.types[t.id] = t
    for (const s of lib.statuses) onto.statuses[s.id] = s
    return onto
  }

  /**
   * Does the shared library already answer this outcome? Then the patch that added the
   * answering rule is returned, and no model is needed.
   */
  covering(req: ModRequest): { rule: string; patch: Patch } | undefined {
    // no learned tree where this question falls, at its tier or a higher one: no patch can answer it
    // (design.md §5.16; §13, the AI setting), no replay needed
    if (!this.lib.grown(req.event.host?.type ?? '-', req.event.kind, holeKey(req.hole.rule, req.hole.path), tiersFrom(tierOfRequest(req)))) return undefined
    const rule = this.answering(req)
    const seq = rule ? this.seqOf(rule) : undefined
    const e = seq !== undefined ? this.log.find((x) => x.seq === seq) : undefined
    if (!rule || !e || !('patch' in e)) return undefined // answered by a base rule the client lacks: see answeredByBase
    // the patch as the library still holds it: a rule of it rolled back since (or replaced by a later version) is
    // not shipped again, nor a type or status it brought that the library has forgotten
    const held = e.patch.artifacts.filter((a) =>
      a?.kind === 'rule' ? this.seqOf(a.rule?.id) === e.seq : a?.kind === 'type' ? this.lib.types.some((t) => t.id === a.type?.id) : a?.kind === 'status' ? this.lib.statuses.some((s) => s.id === a.status?.id) : true,
    )
    return { rule, patch: held.length === e.patch.artifacts.length ? e.patch : { ...e.patch, artifacts: held } }
  }

  /** The seq of the log entry that added the version of a patch rule now in force (undefined: no patch rule by that id is). */
  seqOf(ruleId: string): number | undefined {
    if (this.lib.rules.get(ruleId)?.source?.origin !== 'patch') return undefined
    for (let i = this.log.length - 1; i >= 0; i--) {
      const e = this.log[i]
      if ('patch' in e && e.rules.includes(ruleId)) return e.seq
    }
    return undefined
  }

  /**
   * A base rule of this service answers the request: the client's base rules are older than the
   * service's (a version skew). No patch could fill a hole that is not one here, so no model is asked.
   */
  answeredByBase(req: ModRequest): string | undefined {
    const rule = this.answering(req)
    return rule && this.lib.rules.get(rule)?.source?.origin !== 'patch' ? rule : undefined
  }

  /** The rule that answers the request's event in the shared library, if any. */
  private answering(req: ModRequest): string | undefined {
    try {
      const rp = replay(req.scenario, this.fullOntology(), this.lib)
      return rp.resolution.defined ? rp.resolution.rule?.id : undefined
    } catch {
      return undefined
    }
  }

  /** replaces: patch rules this patch takes the place of (a revision), judged as if they were gone. */
  validate(patch: Patch, req?: ModRequest, ws?: ModWorkspace, replaces: string[] = []): ValidationResult {
    withTerrainTypes(this.ontology)
    // Public ontology and workspace data can change without a mutator or sequence bump.
    const artifacts = patch?.artifacts?.map((a) => a?.kind === 'rule' && a.rule ? { ...a, rule: { ...a.rule, tests: undefined } } : a)
    // (the library's version moves with every add and removal, so its rules need not be hashed)
    // judged as the client judges it: a world event's answer within the world's boundaries, the story's facts its own
    const world = (req?.origin ?? patch?.trigger) === 'world'
    const key = createHash('sha256').update(JSON.stringify([this.lib.version, this.lib.types, this.lib.statuses, this.ontology, ws, req?.scenario, replaces, artifacts, world, this.protectedFacts])).digest('hex')
    const rules = patch?.artifacts?.flatMap((a) => a?.kind === 'rule' && a.rule ? [a.rule] : []) ?? []
    const tests = rules.map((r) => (r.tests ?? []).map((t) => JSON.stringify(t)))
    const proof = this.proofs.get(key)
    if (proof && tests.every((ts, i) => ts.length === proof.tests[i].length && ts.every((t, j) => t === proof.tests[i][j]))) return structuredClone(proof.result)
    const lib = this.workspace(ws, replaces, patch)
    if (proof && tests.every((ts, i) => proof.tests[i].every((t, j) => t === ts[j]))) {
      const result = this.addedTests(patch, lib, proof)
      if (result.ok) this.proofs.set(key, { tests, result: structuredClone(result) })
      return result
    }
    const result = validatePatch(patch, { ontology: this.ontology, library: lib, scenario: req?.scenario, world, protectedFacts: this.protectedFacts })
    if (!result.ok) return result
    // what the patch costs the world (a free lunch refused): its warnings are part of the proof
    const economy = this.economy(patch, lib)
    if (economy.error) return { ...result, ok: false, errors: [...result.errors, economy.error], warnings: [...result.warnings, ...economy.warnings] }
    const proven = { ...result, warnings: [...result.warnings, ...economy.warnings] }
    if (this.proofs.size >= 32) this.proofs.delete(this.proofs.keys().next().value!)
    this.proofs.set(key, { tests, result: structuredClone(proven) })
    return proven
  }

  private addedTests(patch: Patch, lib: RuleLibrary, proof: { tests: string[][]; result: ValidationResult }): ValidationResult {
    const cand = lib.clone()
    for (const a of patch.artifacts) {
      if (a.kind === 'type') cand.types = cand.types.filter((t) => t.id !== a.type.id).concat(a.type)
      if (a.kind === 'status') cand.statuses = cand.statuses.filter((s) => s.id !== a.status.id).concat(a.status)
      if (a.kind === 'rule') cand.add({ ...a.rule, source: { origin: 'patch' } })
    }
    const result = structuredClone(proof.result)
    const rules = patch.artifacts.flatMap((a) => a.kind === 'rule' ? [a.rule] : [])
    for (const [i, r] of rules.entries()) {
      if (r.tests?.length) result.warnings = result.warnings.filter((w) => w !== `rule[${i}] "${r.id}": no tests`)
      for (const [j, t] of (r.tests ?? []).entries()) {
        if (j < proof.tests[i].length) continue
        try {
          // (a rule's tests are played at its own tier, as the validator plays them)
          const rp = replay({ ...t.given, tier: ruleTier(r) }, this.ontology, cand)
          for (const f of [...rp.errors, ...checkExpectations(rp.engine, t.expect ?? [], rp.resolution)]) result.errors.push(`test "${t.name ?? `${r.id}#${j}`}": ${f}`)
        } catch (err) {
          result.errors.push(`test "${t.name ?? `${r.id}#${j}`}": ${(err as Error).message}`)
        }
      }
    }
    result.ok = !result.errors.length
    return result
  }

  /**
   * The economy check (economy.ts): with this patch's conversions (its rules, its new types'
   * recipes and breaking down) among the world's, does any mix of them make more than it takes,
   * where none did before? Then it says which steps, and what they make from nothing.
   */
  private economy(patch: Patch, lib: RuleLibrary): { error?: string; warnings: string[] } {
    const warnings: string[] = []
    const rules = patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [{ ...a.rule, source: { ...a.rule.source, origin: 'patch' as const } }] : []))
    const types = patch.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type] : []))
    if (!rules.length && !types.length) return { warnings }
    const before = this.fullOntology(lib)
    const after: Ontology = { ...before, types: { ...before.types, ...Object.fromEntries(types.map((t) => [t.id, t])) } }
    const known = [...lib.rules.values()]
    // what the world could not model before is not this patch's to report: only what it adds
    const had: string[] = []
    const recovery = this.ontology.params?.recovery ?? 0.5
    const old = economySteps(before, known, recovery, had)
    const all = economySteps(after, [...known, ...rules], recovery, warnings)
    const seen = new Set(had)
    warnings.splice(0, warnings.length, ...warnings.filter((w) => !seen.has(w)))
    const key = (s: (typeof all)[number]) => JSON.stringify([s.name, [...s.takes].sort(), [...s.gives].sort()])
    const oldSteps = new Set(old.map(key))
    const fresh = all.filter((s) => !oldSteps.has(key(s)))
    if (!fresh.length) return { warnings }
    const pool = connected(all, fresh)
    let lunch
    try {
      lunch = freeLunch(pool)
      if (!lunch || freeLunch(connected(old, fresh).filter((s) => oldSteps.has(key(s))))) return { warnings }
    } catch (e) {
      return { warnings, error: `economy: cannot verify these conversions: ${String(e)}` }
    }
    const fmt = (n: number) => (Math.round(n * 100) / 100).toString()
    return { warnings, error: `economy: these conversions together make something from nothing (world-model.md §8.4) — ${lunch.uses.map((u) => `${u.step} ×${fmt(u.times)}`).join(', ')} leave more ${lunch.makes.map((m) => `${m.type} (+${fmt(m.n)})`).join(', ')} than they take. Make the outcome take as much as it gives, or give less.` }
  }

  /**
   * Validate against the library as it is now and, if it passes, append it. Synchronous, so atomic.
   * The shared log must stand on its own for every client, so the commit is judged against the
   * shared library alone: a patch that leans on one client's local types, statuses or rules fails
   * here (and its diagnostics go back to the design as a repair).
   */
  commit(patch: Patch, req?: ModRequest, now = new Date(), replaces: string[] = []): CommitResult {
    const result = this.validate(patch, req, undefined, replaces)
    if (!result.ok) return { ok: false, result, rules: [] }
    // a revision: the old rules leave the log first, so every client sees remove-then-add
    for (const id of replaces) if (this.lib.rules.get(id)?.source?.origin === 'patch') this.remove(id, now)
    const rules = patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule.id] : []))
    const entry: PatchLogEntry = { seq: this.seq + 1, at: now.toISOString(), patch, rules, request: req?.id, scenario: req?.scenario, ...(replaces.length && { replaces }) }
    this.apply(entry)
    this.persist(entry)
    return { ok: true, result, rules, seq: entry.seq }
  }

  /**
   * The library as if some log entries never happened, in memory (nothing is written): the outer
   * loop replays a recorded request against the world as it was before the request was answered.
   */
  fork(keep: (e: PatchLogEntry) => boolean = () => true): WorldLibrary {
    const w = new WorldLibrary(this.ontology, this.base, undefined, { protectedFacts: this.protectedFacts })
    for (const e of this.log) if (keep(e)) w.apply(e)
    return w
  }

  /**
   * The patches that make something from nothing (world-model.md §8.4, the stick farms): the event
   * each answered, repeated with no time between on a host not used up, keeps yielding. Listed
   * for the user, who removes them (`library remove <id>`); nothing is removed here.
   */
  audit(): { rule: string; reason: string }[] {
    const out: { rule: string; reason: string }[] = []
    for (const reg of this.asked) {
      if (!this.lib.rules.has(reg.rule)) continue
      try {
        const rp = replay(reg.scenario, this.fullOntology(), this.lib)
        const eng = buildSandbox(reg.scenario, this.fullOntology(), this.lib)
        const why = rp.resolution.defined ? whyEndless(eng, scenarioEvent(reg.scenario, eng), true) : undefined
        if (why) out.push({ rule: reg.rule, reason: `endless yield: ${why}` })
      } catch (err) {
        if (err instanceof RepeatLimitError) out.push({ rule: reg.rule, reason: err.message })
        /* a scenario no longer buildable (types removed): nothing to judge */
      }
    }
    return out
  }

  /**
   * The patches the validator, as it is now, no longer takes (it grew stricter; the content came to
   * answer their hole itself): each live patch, in the log's order, judged in the scene it answered
   * against what came before it and still holds, and rolled back when it fails. Every client would refuse them on
   * sync, one rejection each; the library holds only what holds. Returns what was rolled back, and why.
   */
  prune(now = new Date()): { rules: string[]; reason: string }[] {
    const out: { rules: string[]; reason: string }[] = []
    const gone = new Set<number>()
    for (const e of [...this.log]) {
      if (!('patch' in e)) continue
      const live = e.rules.filter((id) => this.lib.rules.get(id)?.source?.origin === 'patch')
      if (!live.length) continue
      const req = e.scenario ? ({ scenario: e.scenario, origin: e.patch.trigger ?? 'player' } as ModRequest) : undefined
      let res: ValidationResult
      try {
        // judged as it was taken: against what came before it and still holds (its own rules and
        // the types it brought are not there yet; what came after was judged with it in place)
        const before = this.fork((o) => o.seq < e.seq && !gone.has(o.seq))
        // without what the library has forgotten since (its removal comes later in the log)
        for (const t of [...before.lib.types]) if (!this.lib.types.some((x) => x.id === t.id)) before.lib.removeType(t.id)
        for (const st of [...before.lib.statuses]) if (!this.lib.statuses.some((x) => x.id === st.id)) before.lib.removeStatus(st.id)
        // a revision is judged in the place of what it replaced (it may define that patch's things again)
        res = before.validate(e.patch, req, undefined, e.replaces ?? [])
      } catch (err) {
        res = { ok: false, errors: [(err as Error).message], warnings: [] }
      }
      if (res.ok) continue
      gone.add(e.seq)
      for (const id of live) this.remove(id, now)
      out.push({ rules: live, reason: res.errors[0] ?? 'no longer valid' })
    }
    // the types and statuses a rolled-back patch brought go with it, unless a patch that holds brought them too:
    // left in the library, a later answer would make the thing the validator no longer takes (and no corrected
    // one could be defined, its id being taken)
    for (const kind of ['type', 'status'] as const) {
      const kept = new Set(this.log.filter((e) => 'patch' in e && !gone.has(e.seq)).flatMap((e) => broughtBy(e, kind)))
      for (const e of this.log.filter((x) => gone.has(x.seq)))
        for (const id of broughtBy(e, kind)) {
          if (kept.has(id)) continue
          if (kind === 'type' && this.lib.types.some((t) => t.id === id)) this.removeType(id, now)
          if (kind === 'status' && this.lib.statuses.some((t) => t.id === id)) this.removeStatus(id, now)
        }
    }
    // and a learned type or status the checks no longer take, whatever brought it (a patch rolled back before
    // this pass, a type-only patch): forgotten, and what makes it is judged again without it. A type is judged
    // with the patch that brought it (its own rules count: a thing that breaks by a rule of its own)
    let dropped = false
    // in the order they were first brought (a revision's definition does not make a thing later)
    const first = (id: string) => this.log.find((e) => 'patch' in e && broughtBy(e, 'type').includes(id))?.seq ?? Infinity
    const learned = [...this.lib.types].sort((a, b) => first(a.id) - first(b.id))
    for (const [i, t] of learned.entries()) {
      // judged against the world and everything else learned, but of two by one name the later is the other name:
      // a later one with its name is left out (what it is made of may well be learned after it was first brought)
      const full = this.fullOntology()
      delete full.types[t.id]
      for (const later of learned.slice(i + 1)) if (namesClash(t, later)) delete full.types[later.id]
      const from = [...this.log].reverse().find((e) => 'patch' in e && !gone.has(e.seq) && broughtBy(e, 'type').includes(t.id))
      // the patch's own types count as far as the library still has them (a kind of a forgotten thing has no parent)
      const own = (a: Patch['artifacts'][number]) => a?.kind !== 'type' || a.type?.id === t.id || this.lib.types.some((x) => x.id === a.type?.id)
      const patch = from && 'patch' in from ? { ...from.patch, artifacts: from.patch.artifacts.filter(own) } : { artifacts: [{ kind: 'type' as const, type: t }] }
      if (newTypeProblems(t, full, patch).length) {
        this.removeType(t.id, now)
        dropped = true
      }
    }
    for (const st of [...this.lib.statuses]) {
      if (st.id in this.ontology.statuses || !newStatusProblems(st).length) continue
      this.removeStatus(st.id, now)
      dropped = true
    }
    if (dropped) out.push(...this.prune(now))
    return out
  }

  /** Forget a learned status (the log keeps both its addition and its removal). */
  removeStatus(id: string, now = new Date()): void {
    const entry: PatchLogEntry = { seq: this.seq + 1, at: now.toISOString(), removeStatus: id }
    this.apply(entry)
    this.persist(entry)
  }

  /** Forget a learned type (the log keeps both its addition and its removal). */
  removeType(id: string, now = new Date()): void {
    const entry: PatchLogEntry = { seq: this.seq + 1, at: now.toISOString(), removeType: id }
    this.apply(entry)
    this.persist(entry)
  }

  /** Roll a patch rule back (the log keeps both the addition and the removal). */
  remove(ruleId: string, now = new Date()): boolean {
    if (this.lib.rules.get(ruleId)?.source?.origin !== 'patch') return false
    const entry: PatchLogEntry = { seq: this.seq + 1, at: now.toISOString(), remove: ruleId }
    this.apply(entry)
    this.persist(entry)
    return true
  }

  private apply(e: PatchLogEntry): void {
    this.log.push(e)
    if ('removeType' in e) {
      this.lib.removeType(e.removeType, e.at)
      this.gone.types.add(e.removeType)
      return
    }
    if ('removeStatus' in e) {
      this.lib.removeStatus(e.removeStatus, e.at)
      this.gone.statuses.add(e.removeStatus)
      return
    }
    if ('remove' in e) {
      this.lib.remove(e.remove, e.at)
      this.gone.rules.add(e.remove)
      for (let i = this.asked.length - 1; i >= 0; i--) if (this.asked[i].rule === e.remove) this.asked.splice(i, 1)
      return
    }
    for (const a of e.patch.artifacts) {
      if (a.kind === 'type') (this.lib.addType(a.type, e.at), this.gone.types.delete(a.type.id))
      if (a.kind === 'rule') this.gone.rules.delete(a.rule.id)
      if (a.kind === 'status') (this.lib.addStatus(a.status, e.at), this.gone.statuses.delete(a.status.id))
    }
    for (const a of e.patch.artifacts) {
      if (a.kind !== 'rule') continue
      this.lib.add({ ...a.rule, source: { origin: 'patch', request: e.request, author: e.patch.author ?? 'modder', at: e.at, note: e.patch.note, trigger: e.patch.trigger } }, e.at, (e.replaces ?? []).find((old) => !this.lib.rules.has(old)))
    }
    // the scene that asked, kept with the patch's first rule
    const first = e.rules.find((id) => !!this.lib.rules.get(id)?.host)
    const sc = e.scenario ?? firstTestScenario(e.patch)
    if (first && sc) this.asked.push({ scenario: sc, rule: first })
  }

  private persist(e: PatchLogEntry): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, JSON.stringify(e) + '\n')
  }
}

/** The identity of the log in `file`: read from beside it, or made with the file (a log with no identity of its own gets one). */
function logIdentity(file: string): string {
  const side = `${file}.id`
  if (existsSync(file) && existsSync(side)) {
    const id = readFileSync(side, 'utf8').trim()
    if (id) return id
  }
  const id = randomUUID()
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, '')
  writeFileSync(side, `${id}\n`)
  return id
}

function firstTestScenario(p: Patch): Scenario | undefined {
  for (const a of p.artifacts) if (a.kind === 'rule' && a.rule.tests?.length) return a.rule.tests[0].given
  return undefined
}

/** The ids of the types (or statuses) a log entry's patch brought. */
function broughtBy(e: PatchLogEntry, kind: 'type' | 'status'): string[] {
  if (!('patch' in e)) return []
  return e.patch.artifacts.flatMap((a) => (kind === 'type' && a.kind === 'type' && a.type?.id ? [a.type.id] : kind === 'status' && a.kind === 'status' && a.status?.id ? [a.status.id] : []))
}

