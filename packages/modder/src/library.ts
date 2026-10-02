// The shared rule library (design.md §9): base rules from content plus every accepted patch,
// kept as an append-only log (one JSON line per patch or removal) so the library at any point
// can be rebuilt, rolled back or ablated. Clients pull the log; the modder validates against it.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  RuleLibrary,
  buildModSpec,
  replay,
  validatePatch,
  type ModRequest,
  type ModSpec,
  type ModWorkspace,
  type Ontology,
  type Patch,
  type PatchLogEntry,
  type Rule,
  type Scenario,
  type ValidationResult,
} from '@lsw/engine'

const REGRESSION_CAP = 300

export interface CommitResult {
  ok: boolean
  result: ValidationResult
  rules: string[]
  seq?: number
}

export class WorldLibrary {
  readonly lib: RuleLibrary
  readonly log: PatchLogEntry[] = []
  /** Triggering scenarios of accepted patches: they must stay answered by later patches. */
  readonly regression: { scenario: Scenario; rule: string }[] = []

  constructor(
    readonly ontology: Ontology,
    readonly base: Rule[],
    private file?: string,
  ) {
    this.lib = new RuleLibrary(base)
    if (file && existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
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

  /** The log as clients see it (without the server-side regression scenarios). */
  since(seq: number): PatchLogEntry[] {
    return this.log.filter((e) => e.seq > seq).map((e) => ('scenario' in e ? { ...e, scenario: undefined } : e))
  }

  /** Rules added by patches and still in force. */
  patchRules(): Rule[] {
    return this.lib.patches()
  }

  /** The library a request is judged against: the shared one plus the client's own local patches. */
  workspace(ws?: ModWorkspace, without: string[] = []): RuleLibrary {
    const lib = this.lib.clone()
    for (const id of without) lib.remove(id)
    const p = ws?.patches
    if (!p) return lib
    for (const t of p.types ?? []) if (!lib.types.some((x) => x.id === t.id)) lib.types.push(t)
    for (const s of p.statuses ?? []) if (!lib.statuses.some((x) => x.id === s.id)) lib.statuses.push(s)
    for (const r of p.rules ?? []) if (r?.id && !lib.rules.has(r.id) && !without.includes(r.id) && r.source?.origin === 'patch') lib.add(r, r.source.at)
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
   * Does the shared library already answer this interaction? Then the patch that added the
   * answering rule is returned, and no model is needed.
   */
  covering(req: ModRequest): { rule: string; patch: Patch } | undefined {
    let rule: string | undefined
    try {
      const rp = replay(req.scenario, this.fullOntology(), this.lib)
      rule = rp.resolution.defined ? rp.resolution.rule?.id : undefined
    } catch {
      return undefined
    }
    if (!rule) return undefined
    for (let i = this.log.length - 1; i >= 0; i--) {
      const e = this.log[i]
      if ('patch' in e && e.rules.includes(rule)) return { rule, patch: e.patch }
    }
    return undefined // answered by a base rule the client lacks: a version skew, not the modder's job
  }

  /** replaces: patch rules this patch takes the place of (a revision), judged as if they were gone. */
  validate(patch: Patch, req?: ModRequest, ws?: ModWorkspace, replaces: string[] = []): ValidationResult {
    return validatePatch(patch, {
      ontology: this.ontology,
      library: this.workspace(ws, replaces),
      scenario: req?.scenario,
      regression: [...this.regression, ...(ws?.regression ?? [])].filter((r) => !replaces.includes(r.rule)),
    })
  }

  /** Validate against the library as it is now and, if it passes, append it. Synchronous, so atomic. */
  commit(patch: Patch, req?: ModRequest, ws?: ModWorkspace, now = new Date(), replaces: string[] = []): CommitResult {
    const result = this.validate(patch, req, ws, replaces)
    if (!result.ok) return { ok: false, result, rules: [] }
    // a revision: the old rules leave the log first, so every client sees remove-then-add
    for (const id of replaces) if (this.lib.rules.get(id)?.source?.origin === 'patch') this.remove(id, now)
    const rules = patch.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule.id] : []))
    const entry: PatchLogEntry = { seq: this.seq + 1, at: now.toISOString(), patch, rules, request: req?.id, scenario: req?.scenario }
    this.apply(entry)
    this.persist(entry)
    return { ok: true, result, rules, seq: entry.seq }
  }

  /**
   * The library as if some log entries never happened, in memory (nothing is written): the outer
   * loop replays a recorded request against the world as it was before the request was answered.
   */
  fork(keep: (e: PatchLogEntry) => boolean = () => true): WorldLibrary {
    const w = new WorldLibrary(this.ontology, this.base)
    for (const e of this.log) if (keep(e)) w.apply(e)
    return w
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
    if ('remove' in e) {
      this.lib.remove(e.remove, e.at)
      for (let i = this.regression.length - 1; i >= 0; i--) if (this.regression[i].rule === e.remove) this.regression.splice(i, 1)
      return
    }
    for (const a of e.patch.artifacts) {
      if (a.kind === 'type') this.lib.addType(a.type, e.at)
      if (a.kind === 'status') this.lib.addStatus(a.status, e.at)
    }
    for (const a of e.patch.artifacts) {
      if (a.kind !== 'rule') continue
      this.lib.add({ ...a.rule, source: { origin: 'patch', request: e.request, author: e.patch.author ?? 'modder', at: e.at, note: e.patch.note, trigger: e.patch.trigger } }, e.at)
    }
    // the interaction that asked for the patch must stay answered (by it, or by something more specific)
    const first = e.rules.find((id) => this.lib.rules.get(id)?.on === 'interaction')
    const sc = e.scenario ?? firstTestScenario(e.patch)
    if (first && sc) {
      this.regression.push({ scenario: sc, rule: first })
      if (this.regression.length > REGRESSION_CAP) this.regression.shift()
    }
  }

  private persist(e: PatchLogEntry): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, JSON.stringify(e) + '\n')
  }
}

function firstTestScenario(p: Patch): Scenario | undefined {
  for (const a of p.artifacts) if (a.kind === 'rule' && a.rule.on === 'interaction' && a.rule.tests?.length) return a.rule.tests[0].given
  return undefined
}
